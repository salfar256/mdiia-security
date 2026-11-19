// MDIIA Security – server WhatsApp kecil (Baileys) untuk Railway.
// Endpoint (semua butuh kunci API lewat header X-Api-Key atau ?key=):
//   GET  /          halaman status + QR untuk menautkan nomor WA
//   GET  /status    { terhubung, nomor, adaQr }
//   GET  /groups    [{ id, nama }]
//   POST /send      { target: "0812.., 1203..@g.us", message: "..." }
//   POST /logout    putuskan nomor (perlu scan ulang)
import http from "node:http";
import fs from "node:fs";
import makeWASocket, {
  useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import pino from "pino";

const PORT = Number(process.env.PORT || 8080);
const API_KEY = process.env.API_KEY || "";
const AUTH_DIR = process.env.AUTH_DIR || "/data/auth";
const ASAL = (process.env.ALLOWED_ORIGIN || "*").trim();

if (!API_KEY) console.warn("PERINGATAN: API_KEY belum diisi. Semua permintaan akan ditolak.");

let sock = null, qrTerakhir = null, terhubung = false, nomor = null, mulaiUlang = null;
let istirahat = false, sedangMulai = false;
// Sudah pernah tertaut? (ada file kredensial di volume)
const sudahTertaut = () => fs.existsSync(`${AUTH_DIR}/creds.json`) &&
  JSON.parse(fs.readFileSync(`${AUTH_DIR}/creds.json`, "utf8") || "{}").registered === true;

async function mulai() {
  if (sedangMulai) return;
  sedangMulai = true; istirahat = false;
  setTimeout(() => { sedangMulai = false; }, 5000);
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  let version;
  try { ({ version } = await fetchLatestBaileysVersion()); } catch { /* pakai bawaan */ }
  sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: state,
    logger: pino({ level: "warn" }),
    browser: Browsers.ubuntu("MDIIA Security"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      if (!qrTerakhir) console.log("Menunggu scan QR – buka halaman / dari panel Admin.");
      qrTerakhir = qr;
    }
    if (connection === "open") {
      terhubung = true; qrTerakhir = null;
      nomor = (sock.user?.id || "").split(":")[0].split("@")[0];
      console.log("Terhubung sebagai", nomor);
    }
    if (connection === "close") {
      terhubung = false;
      const kode = lastDisconnect?.error?.output?.statusCode;
      console.log("Koneksi tertutup, kode:", kode);
      if (kode === DisconnectReason.loggedOut) {
        fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        nomor = null;
      }
      clearTimeout(mulaiUlang);
      // Belum pernah tertaut dan QR kedaluwarsa (408): istirahat sampai halaman QR dibuka lagi
      if (!sudahTertaut() && (kode === DisconnectReason.timedOut || kode === DisconnectReason.loggedOut)) {
        istirahat = true; qrTerakhir = null;
        console.log("QR tidak di-scan. Server istirahat sampai halaman QR dibuka lagi.");
        return;
      }
      mulaiUlang = setTimeout(() => mulai().catch((e) => console.error("Gagal mulai:", e)), 3000);
    }
  });
}

// Ubah "0812-345", "62812..", "1203..@g.us" menjadi JID WhatsApp
function keJid(t) {
  t = String(t).trim();
  if (!t) return null;
  if (t.includes("@")) return t;
  let d = t.replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  return d ? `${d}@s.whatsapp.net` : null;
}

function kirimJson(res, kode, data) {
  res.writeHead(kode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function bacaBody(req) {
  return new Promise((ok, gagal) => {
    let isi = "";
    req.on("data", (c) => { isi += c; if (isi.length > 1e5) req.destroy(); });
    req.on("end", () => {
      const jenis = req.headers["content-type"] || "";
      try {
        if (jenis.includes("application/json")) return ok(JSON.parse(isi || "{}"));
        return ok(Object.fromEntries(new URLSearchParams(isi)));
      } catch (e) { gagal(e); }
    });
    req.on("error", gagal);
  });
}

const halaman = (isi) => `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>MDIIA Security – WhatsApp</title>
<style>body{font-family:system-ui,sans-serif;background:#003a46;color:#fff;text-align:center;padding:24px}
.kotak{background:#fff;color:#1b2a1f;max-width:420px;margin:0 auto;border-radius:18px;padding:24px}
img{width:280px;height:280px}.ok{color:#1f7a3f;font-size:22px;font-weight:800}ol{text-align:left;line-height:1.6}</style>
</head><body><div class="kotak">${isi}</div></body></html>`;

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", ASAL);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Api-Key");
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, "http://x");
  if (url.pathname === "/health") return kirimJson(res, 200, { ok: true });

  const kunci = req.headers["x-api-key"] || url.searchParams.get("key");
  if (!API_KEY || kunci !== API_KEY) {
    if (url.pathname === "/") {
      res.writeHead(401, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(halaman("<h2>Kunci salah</h2><p>Buka halaman ini dari tombol di panel Admin MDIIA Security.</p>"));
    }
    return kirimJson(res, 401, { status: false, reason: "Kunci API salah" });
  }

  try {
    if (url.pathname === "/" && req.method === "GET") {
      if (istirahat) mulai().catch((e) => console.error("Gagal mulai:", e)); // bangunkan untuk QR baru
      let isi;
      if (terhubung) {
        isi = `<p class="ok">✅ WhatsApp terhubung</p><p>Nomor: <b>+${nomor}</b></p><p>Halaman ini boleh ditutup.</p>`;
      } else if (qrTerakhir) {
        const gambar = await QRCode.toDataURL(qrTerakhir, { width: 560, margin: 1 });
        isi = `<h2>Tautkan WhatsApp</h2><img src="${gambar}" alt="QR">
          <ol><li>Buka WhatsApp di HP</li><li>Menu ⋮ → <b>Perangkat tertaut</b> → <b>Tautkan perangkat</b></li>
          <li>Arahkan kamera ke kode QR ini</li></ol><p style="opacity:.6">Halaman diperbarui otomatis.</p>`;
      } else {
        isi = `<h2>Menyiapkan…</h2><p>Tunggu beberapa detik.</p>`;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Refresh": terhubung ? "60" : "5" });
      return res.end(halaman(isi));
    }

    if (url.pathname === "/status") return kirimJson(res, 200, { status: true, terhubung, nomor, adaQr: !!qrTerakhir, istirahat });

    if (url.pathname === "/groups") {
      if (!terhubung) return kirimJson(res, 503, { status: false, reason: "WhatsApp belum terhubung. Scan QR dulu." });
      const grup = await sock.groupFetchAllParticipating();
      return kirimJson(res, 200, { status: true,
        data: Object.values(grup).map((g) => ({ id: g.id, nama: g.subject })).sort((a, b) => a.nama.localeCompare(b.nama)) });
    }

    if (url.pathname === "/send" && req.method === "POST") {
      // Sambungan WA kadang putus 1–3 detik lalu tersambung lagi: tunggu sampai 15 detik
      for (let i = 0; i < 30 && !terhubung && !istirahat; i++) await new Promise((r) => setTimeout(r, 500));
      if (!terhubung) return kirimJson(res, 503, { status: false, reason: "WhatsApp belum terhubung. Scan QR dulu." });
      const body = await bacaBody(req);
      const pesan = String(body.message || "").slice(0, 4000);
      const tujuan = String(body.target || "").split(/[\s,;]+/).map(keJid).filter(Boolean);
      if (!pesan || !tujuan.length) return kirimJson(res, 400, { status: false, reason: "target dan message wajib diisi" });
      const hasil = [];
      for (const jid of tujuan) {
        try { await sock.sendMessage(jid, { text: pesan }); hasil.push({ jid, ok: true }); }
        catch (e) { hasil.push({ jid, ok: false, reason: e.message }); }
      }
      const berhasil = hasil.filter((h) => h.ok).length;
      return kirimJson(res, berhasil ? 200 : 500, { status: berhasil > 0, terkirim: berhasil, hasil,
        reason: berhasil ? undefined : hasil[0]?.reason });
    }

    if (url.pathname === "/logout" && req.method === "POST") {
      const lama = nomor;
      try { await sock.logout(); } catch { /* abaikan */ }
      try { sock.end(undefined); } catch { /* abaikan */ }
      clearTimeout(mulaiUlang);
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
      terhubung = false; nomor = null; qrTerakhir = null; istirahat = true;
      console.log("Nomor dilepas:", lama || "-", "– tekan Tautkan nomor WA untuk QR baru.");
      return kirimJson(res, 200, { status: true, dilepas: lama });
    }

    kirimJson(res, 404, { status: false, reason: "Tidak ditemukan" });
  } catch (e) {
    console.error(e);
    kirimJson(res, 500, { status: false, reason: e.message });
  }
});

server.listen(PORT, () => console.log("Server WA MDIIA Security berjalan di port", PORT));
mulai().catch((e) => console.error("Gagal mulai:", e));
