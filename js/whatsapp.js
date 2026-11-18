// Kirim notifikasi WhatsApp.
// Dua penyedia:
//  - "server": server WA milik sendiri di Railway (folder wa-server/) — disarankan
//  - "fonnte": gateway Fonnte (https://fonnte.com)
// Pengaturan disimpan admin di Firestore: pengaturan/whatsapp
//   { penyedia, serverUrl, token, target, nomorPengasuh: [{ email, nama, nomor }],
//     kirimKeluar, kirimDitolak, kirimTakDikenal, aktif }
// target = penerima SEMUA kartu (admin/grup); nomorPengasuh = hanya kartu milik pengasuh itu.

// Daftar tujuan untuk satu kartu: penerima umum + nomor pengasuh pemilik kartu
export function tujuanUntuk(cfg, kartu) {
  const daftar = [cfg?.target || ""];
  if (kartu?.pemilikEmail) {
    const p = (cfg?.nomorPengasuh || []).find((x) => x.email === kartu.pemilikEmail);
    if (p?.nomor) daftar.push(p.nomor);
  }
  const unik = [...new Set(daftar.join(",").split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean))];
  return unik.join(",");
}

const FONNTE = "https://api.fonnte.com";
const rapikanTujuan = (t) => String(t || "").split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean).join(",");
const alamat = (u) => String(u || "").trim().replace(/\/+$/, "").replace(/^(?!https?:\/\/)/, "https://");

async function bacaJson(r) {
  const j = await r.json().catch(() => ({ status: false, reason: `HTTP ${r.status}` }));
  if (j.status === false || !r.ok) throw new Error(j.reason || j.detail || `HTTP ${r.status}`);
  return j;
}

async function fonnte(token, jalur, data = {}) {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => fd.append(k, v));
  return bacaJson(await fetch(`${FONNTE}/${jalur}`, { method: "POST", mode: "cors", headers: { Authorization: token }, body: fd }));
}

async function server(cfg, jalur, data) {
  const opsi = { headers: { "X-Api-Key": cfg.token } };
  if (data) { opsi.method = "POST"; opsi.body = new URLSearchParams(data); }
  return bacaJson(await fetch(`${alamat(cfg.serverUrl)}/${jalur}`, opsi));
}

// Kirim teks ke semua tujuan (nomor dan/atau ID grup, dipisah koma)
export async function kirimWA(cfg, teks, tujuan = cfg?.target) {
  const target = rapikanTujuan(tujuan);
  if (!cfg || cfg.aktif === false || !cfg.token || !target) return false;
  if (cfg.penyedia === "fonnte") await fonnte(cfg.token, "send", { target, message: teks, countryCode: "62" });
  else await server(cfg, "send", { target, message: teks });
  return true;
}

// Ambil daftar grup WA yang diikuti nomor pengirim
export async function cariGrupWA(cfg) {
  let data;
  if (cfg.penyedia === "fonnte") {
    try { await fonnte(cfg.token, "fetch-group"); } catch (e) { /* boleh gagal */ }
    data = (await fonnte(cfg.token, "get-whatsapp-group")).data;
  } else {
    data = (await server(cfg, "groups")).data;
  }
  return (Array.isArray(data) ? data : [])
    .map((g) => ({ id: String(g.id || g.groupid || ""), nama: g.nama || g.name || g.subject || g.id }))
    .filter((g) => g.id);
}

// Status sambungan server sendiri
export async function statusServerWA(cfg) {
  return server(cfg, "status");
}

export const urlHalamanQR = (cfg) => `${alamat(cfg.serverUrl)}/?key=${encodeURIComponent(cfg.token || "")}`;
