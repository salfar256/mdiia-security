// =====================================================
//  PENGATURAN — isi bagian ini SEKALI saja
// =====================================================

// 1) Salin dari Firebase Console > Project settings > Your apps > Web app
export const firebaseConfig = {
  apiKey: "AIzaSyCPs21N39efUwTJpGCNJ2ulAeKfz1rzFJU",
  authDomain: "mdiia-security.firebaseapp.com",
  projectId: "mdiia-security",
  storageBucket: "mdiia-security.firebasestorage.app",
  messagingSenderId: "131151025667",
  appId: "1:131151025667:web:b1894506b4b861c100e036",
};

// 2) Email akun ADMIN (Anda). Harus sama dengan yang ditulis di firestore.rules
export const ADMIN_EMAIL = "salimfaroghy@gmail.com";

// 3) Lama jeda sebelum kartu terisi kembali (jam).
//    PENTING: jika diubah, ubah juga angka 6 di firestore.rules
export const JEDA_JAM = 6;

// 4) Nama pondok yang tercetak di kartu
export const NAMA_PONDOK = "Pondok Pesantren Ibnu Aqil";
