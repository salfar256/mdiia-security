// Menggambar kartu izin MDIIA (desain vertikal hijau-emas) ke <canvas>.
// Ukuran asli template: 1275 x 2022 px = 54 x 85,6 mm (±600 dpi).
// Membutuhkan library global `qrcode` (qrcode-generator).

const W = 1275, H = 2022;
const TEMPLATE = new URL("../img/kartu-template.jpg", import.meta.url).href;
const FONT = '"Noto Sans", "Open Sans", Arial, sans-serif';

let templatePromise = null;
function muatTemplate() {
  if (!templatePromise) {
    templatePromise = new Promise((ok, gagal) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = gagal;
      img.src = TEMPLATE;
    });
  }
  return templatePromise;
}

async function siapkanFont() {
  try {
    await Promise.all([
      document.fonts.load(`700 73px "Noto Sans"`),
      document.fonts.load(`700 25px "Noto Sans"`),
    ]);
  } catch (e) { /* pakai font cadangan */ }
}

function tulisDenganSpasi(ctx, teks, cx, y, spasi) {
  // canvas lama belum mendukung letterSpacing: gambar per huruf
  const lebar = [...teks].reduce((t, h) => t + ctx.measureText(h).width, 0) + spasi * (teks.length - 1);
  let x = cx - lebar / 2;
  ctx.textAlign = "left";
  for (const h of teks) { ctx.fillText(h, x, y); x += ctx.measureText(h).width + spasi; }
}

export async function gambarKartu({ id, pemilik, nomor }) {
  const [img] = await Promise.all([muatTemplate(), siapkanFont()]);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0, W, H);

  // Nama pemilik (otomatis mengecil jika terlalu panjang)
  let ukuran = 73;
  ctx.font = `700 ${ukuran}px ${FONT}`;
  while (ctx.measureText(pemilik).width > 940 && ukuran > 40) {
    ukuran -= 2; ctx.font = `700 ${ukuran}px ${FONT}`;
  }
  ctx.fillStyle = "#fff7e9";
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  ctx.fillText(pemilik, W / 2, 1005);

  // Label "KARTU 1" di dalam bingkai
  ctx.font = `700 25px ${FONT}`;
  ctx.fillStyle = "#d5e2d9";
  tulisDenganSpasi(ctx, String(nomor || "").toUpperCase(), 638, 1099, 3.6);

  // QR code di kotak putih (area 428–848 px)
  const q = qrcode(0, "M"); q.addData("IZIN:" + id); q.make();
  const n = q.getModuleCount(), luas = 420, sel = luas / n, x0 = 428, y0 = 1288;
  ctx.fillStyle = "#000";
  for (let r = 0; r < n; r++) {
    for (let k = 0; k < n; k++) {
      if (q.isDark(r, k)) {
        ctx.fillRect(Math.floor(x0 + k * sel), Math.floor(y0 + r * sel), Math.ceil(sel), Math.ceil(sel));
      }
    }
  }
  return c;
}
