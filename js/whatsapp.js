// Kirim notifikasi WhatsApp lewat gateway Fonnte (https://fonnte.com).
// Pengaturan disimpan admin di Firestore: pengaturan/whatsapp
//   { token, target: "08xx, 1203...@g.us", kirimKeluar, kirimDitolak, kirimTakDikenal, aktif }

const API = "https://api.fonnte.com";

async function panggil(token, jalur, data = {}) {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => fd.append(k, v));
  const r = await fetch(`${API}/${jalur}`, { method: "POST", mode: "cors", headers: { Authorization: token }, body: fd });
  const j = await r.json().catch(() => ({ status: false, reason: `HTTP ${r.status}` }));
  if (j.status === false) throw new Error(j.reason || j.detail || "Gagal menghubungi Fonnte");
  return j;
}

const rapikanTujuan = (t) => String(t || "").split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean).join(",");

// Kirim teks ke semua tujuan (nomor dan/atau ID grup, dipisah koma)
export async function kirimWA(cfg, teks) {
  if (!cfg || cfg.aktif === false || !cfg.token || !cfg.target) return false;
  await panggil(cfg.token, "send", { target: rapikanTujuan(cfg.target), message: teks, countryCode: "62" });
  return true;
}

// Ambil daftar grup WA yang diikuti nomor pengirim
export async function cariGrupWA(token) {
  try { await panggil(token, "fetch-group"); } catch (e) { /* boleh gagal jika sudah pernah diperbarui */ }
  const j = await panggil(token, "get-whatsapp-group");
  const data = Array.isArray(j.data) ? j.data : [];
  return data.map((g) => ({ id: String(g.id || g.groupid || ""), nama: g.name || g.subject || g.id })).filter((g) => g.id);
}
