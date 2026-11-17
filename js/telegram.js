// Kirim notifikasi ke Telegram lewat Bot API (dipanggil langsung dari browser).
// Pengaturan disimpan admin di Firestore: pengaturan/telegram
//   { token, chatId: "id1, id2", kirimKeluar, kirimDitolak, kirimTakDikenal, aktif }

const API = "https://api.telegram.org/bot";

const daftarChat = (chatId) => String(chatId || "").split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);

async function panggil(token, metode, data) {
  // Body form-urlencoded = "simple request": tidak perlu preflight CORS
  const r = await fetch(`${API}${encodeURIComponent(token)}/${metode}`, {
    method: "POST",
    body: new URLSearchParams(data),
  });
  const j = await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
  if (!j.ok) throw new Error(j.description || "Gagal menghubungi Telegram");
  return j.result;
}

export const escHtml = (s) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

// Kirim teks (HTML) ke semua chat ID. Mengembalikan jumlah yang berhasil.
export async function kirimTelegram(cfg, teks) {
  if (!cfg || cfg.aktif === false || !cfg.token) return 0;
  const tujuan = daftarChat(cfg.chatId);
  const hasil = await Promise.allSettled(tujuan.map((chat_id) =>
    panggil(cfg.token, "sendMessage", { chat_id, text: teks, parse_mode: "HTML", disable_web_page_preview: "true" })));
  const gagal = hasil.find((h) => h.status === "rejected");
  if (gagal && hasil.every((h) => h.status === "rejected")) throw gagal.reason;
  return hasil.filter((h) => h.status === "fulfilled").length;
}

// Cari chat (pribadi/grup) yang pernah mengirim pesan ke bot
export async function cariChat(token) {
  const pembaruan = await panggil(token, "getUpdates", { limit: "100" });
  const peta = new Map();
  for (const u of pembaruan) {
    const m = u.message || u.channel_post || u.my_chat_member || u.edited_message;
    const c = m?.chat;
    if (c) peta.set(String(c.id), c.title || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.username || c.type);
  }
  return [...peta].map(([id, nama]) => ({ id, nama }));
}

export async function cekBot(token) {
  return panggil(token, "getMe", {});
}
