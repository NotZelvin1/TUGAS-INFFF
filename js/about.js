/* ============================================================
   about.js: halaman About (about.html)
   Teks bawaan ada di config.js (ABOUT_BAWAAN).
   Membutuhkan: config.js, common.js
   ============================================================ */

/* ============================================================
   ABOUT (teks bisa diubah dari aplikasi)
   ============================================================ */
let aboutData = { ...ABOUT_BAWAAN };

function renderAbout() {
  $("#aboutJudul").textContent = aboutData.judul;
  const badan = $("#aboutBadan"); badan.replaceChildren();
  aboutData.teks.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .forEach((p) => badan.append(buat("p", { textContent: p })));
}
async function muatAbout() {
  renderAbout();
  if (BELUM_DIATUR) return;
  const { data, error } = await sb.from("pengaturan").select("nilai").eq("kunci", "about").maybeSingle();
  if (error) { console.warn("About: memakai teks bawaan.", error.message); return; }
  if (data && data.nilai) {
    aboutData = { judul: data.nilai.judul || ABOUT_BAWAAN.judul, teks: typeof data.nilai.teks === "string" ? data.nilai.teks : ABOUT_BAWAAN.teks };
    renderAbout();
  }
}
function modeUbahAbout(ubah) {
  $("#aboutLihat").hidden = ubah; $("#aboutForm").hidden = !ubah;
  if (ubah) { $("#abJudul").value = aboutData.judul; $("#abTeks").value = aboutData.teks; $("#abJudul").focus(); }
}
$("#aboutUbah").onclick = () => modeUbahAbout(true);
$("#abBatal").onclick = () => modeUbahAbout(false);
$("#aboutForm").onsubmit = async (e) => {
  e.preventDefault();
  const judul = $("#abJudul").value.trim() || ABOUT_BAWAAN.judul, teks = $("#abTeks").value.trim();
  if (BELUM_DIATUR) { toast("Isi konfigurasi Supabase dulu."); return; }
  const { error } = await sb.from("pengaturan").upsert({ kunci: "about", nilai: { judul, teks }, diubah_pada: new Date().toISOString() });
  if (error) { toast("Gagal menyimpan: " + error.message + " (sudah menjalankan schema.sql terbaru?)"); return; }
  aboutData = { judul, teks }; renderAbout(); modeUbahAbout(false); toast("Teks About disimpan.");
};
$("#abReset").onclick = async () => {
  if (!confirm("Kembalikan ke teks bawaan?")) return;
  if (!BELUM_DIATUR) {
    const { error } = await sb.from("pengaturan").delete().eq("kunci", "about");
    if (error) { toast("Gagal mengembalikan: " + error.message); return; }
  }
  aboutData = { ...ABOUT_BAWAAN }; renderAbout(); modeUbahAbout(false); toast("Dikembalikan ke teks bawaan.");
};


muatAbout();
