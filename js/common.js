import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, JEDA_JAM, ADMIN_EMAIL } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const JEDA_MS = JEDA_JAM * 3600 * 1000;

export const emailSaya = () => (auth.currentUser?.email || "").toLowerCase();

// Format waktu WIB, contoh: "16 Nov 14.05"
export function fmtWaktu(ms, denganTanggal = true) {
  if (!ms) return "-";
  const opsi = { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" };
  if (denganTanggal) { opsi.day = "numeric"; opsi.month = "short"; }
  return new Date(ms).toLocaleString("id-ID", opsi);
}

// Status kartu: siap dipakai atau masih jeda
export function statusKartu(k, nowMs = Date.now()) {
  if (k.aktif === false) return { siap: false, blokir: true };
  const t = k.terakhirDipakai?.toMillis ? k.terakhirDipakai.toMillis() : null;
  if (!t) return { siap: true };
  const aktifLagi = t + JEDA_MS;
  return nowMs >= aktifLagi ? { siap: true } : { siap: false, aktifLagi };
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Kotak login sederhana. peranDiizinkan: ['satpam'] / ['pengasuh'] / ['admin']
// Admin selalu boleh masuk ke halaman mana pun.
export function pasangLogin({ peranDiizinkan, judul, onMasuk }) {
  const box = document.getElementById("login");
  const isi = document.getElementById("app");
  box.innerHTML = `
    <div class="login-card">
      <img src="logo.png" alt="" style="width:96px;height:96px;border-radius:22px;display:block;margin:0 auto 12px">
      <h1>${esc(judul)}</h1>
      <input id="lg-email" type="email" placeholder="Email" autocomplete="username">
      <div class="pass-wrap">
        <input id="lg-pass" type="password" placeholder="Kata sandi" autocomplete="current-password">
        <button type="button" id="lg-mata" class="mata" aria-label="Tampilkan kata sandi">👁</button>
      </div>
      <button id="lg-btn" class="btn besar">MASUK</button>
      <p id="lg-msg" class="pesan"></p>
    </div>`;
  const msg = box.querySelector("#lg-msg");
  const pass = box.querySelector("#lg-pass"), mata = box.querySelector("#lg-mata");
  mata.onclick = () => {
    const lihat = pass.type === "password";
    pass.type = lihat ? "text" : "password";
    mata.textContent = lihat ? "🙈" : "👁";
    mata.setAttribute("aria-label", lihat ? "Sembunyikan kata sandi" : "Tampilkan kata sandi");
  };
  pass.onkeydown = (e) => { if (e.key === "Enter") box.querySelector("#lg-btn").click(); };
  box.querySelector("#lg-btn").onclick = async () => {
    msg.textContent = "Memproses…";
    try {
      await signInWithEmailAndPassword(auth,
        box.querySelector("#lg-email").value.trim(), box.querySelector("#lg-pass").value);
    } catch (e) { msg.textContent = "Email atau kata sandi salah."; }
  };

  onAuthStateChanged(auth, async (user) => {
    if (!user) { box.hidden = false; isi.hidden = true; return; }
    let peran = null;
    try {
      const s = await getDoc(doc(db, "peran", user.email.toLowerCase()));
      peran = s.exists() ? s.data() : null;
    } catch (e) { /* abaikan */ }
    if (user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) peran = { role: "admin", nama: "Admin" };
    // Arahkan otomatis ke halaman yang sesuai peran
    if (peran && !(peranDiizinkan.includes(peran.role) || peran.role === "admin")) {
      const tujuan = { satpam: "index.html", pengasuh: "pengasuh.html" }[peran.role];
      if (tujuan) { location.replace(tujuan); return; }
    }
    if (!peran || !(peranDiizinkan.includes(peran.role) || peran.role === "admin")) {
      box.hidden = false; isi.hidden = true;
      msg.innerHTML = `Akun <b>${esc(user.email)}</b> tidak punya akses ke halaman ini.
        <br><button class="btn kecil" id="lg-out">Keluar akun</button>`;
      msg.querySelector("#lg-out").onclick = () => signOut(auth);
      return;
    }
    box.hidden = true; isi.hidden = false;
    onMasuk(user, peran);
  });
}

export const keluarAkun = () => signOut(auth);
