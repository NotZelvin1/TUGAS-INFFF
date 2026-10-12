/* ============================================================
   common.js: kode bersama untuk SEMUA halaman
   Memasang header (tab halaman + Pomodoro + saklar tema), navigasi bawah (HP),
   dialog "Cara pakai", dan notifikasi. Dimuat setelah config.js.
   ============================================================ */

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (s) => document.querySelector(s);
const JUDUL_HALAMAN = document.title;

function toast(teks) {
  const t = $("#toast");
  t.textContent = teks; t.classList.add("show");
  clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("show"), 3500);
}
function buat(tag, props = {}, ...anak) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  anak.forEach((a) => e.append(a));
  return e;
}

/* ---------- Helper tanggal ---------- */
const NAMA_BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const NAMA_HARI = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const iso = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const dariIso = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const jam = (t) => (t ? t.slice(0, 5) : "");

/* ---------- Materi yang terakhir dibuka (per tab browser) ---------- */
function materiTerakhir() { try { return sessionStorage.getItem("materi_terakhir"); } catch { return null; } }
function simpanMateriTerakhir(id) {
  try { if (id) sessionStorage.setItem("materi_terakhir", id); else sessionStorage.removeItem("materi_terakhir"); } catch {}
}

/* ============================================================
   KERANGKA: header, navigasi bawah, dialog cara pakai, toast
   Daftar halaman ada di sini; tambah/ubah halaman cukup di satu tempat.
   ============================================================ */
const HALAMAN = [
  ["belajar", "index.html", "Belajar"],
  ["kalender", "kalender.html", "Kalender"],
  ["todo", "todo.html", "To-do"],
  ["about", "about.html", "About"],
];
const TAUTAN = HALAMAN.map(([id, href, label]) => '<a href="' + href + '" data-page="' + id + '">' + label + "</a>").join("");

const KERANGKA_HEADER = `<header>
  <div id="bar"></div>
  <div class="brand">Ruang Belajar</div>
  <nav class="pages" aria-label="Halaman">%TAUTAN%</nav>
  <div id="judulAktif"></div>

  <div id="pomo" aria-label="Pomodoro timer">
    <svg id="ring" viewBox="0 0 36 36" width="40" height="40" aria-hidden="true">
      <circle class="track" cx="15" cy="15" r="15" transform="translate(3 3)"/>
      <circle class="prog" id="ringProg" cx="15" cy="15" r="15" transform="translate(3 3)"/>
    </svg>
    <div>
      <div id="pTime" role="timer">25:00</div>
      <div id="pMode">Fokus</div>
    </div>
    <button class="btn primary" id="pToggle">Mulai</button>
    <button class="btn small" id="pReset" title="Ulang sesi ini">Ulang</button>
    <button class="btn small" id="pSkip" title="Lewati ke sesi berikutnya">Lewati</button>
    <details class="atur">
      <summary class="btn small">Atur</summary>
      <div class="pop">
        <label>Fokus (menit) <input type="number" id="setFokus" min="1" max="180"></label>
        <label>Istirahat <input type="number" id="setIstirahat" min="1" max="60"></label>
        <label>Istirahat panjang <input type="number" id="setPanjang" min="1" max="120"></label>
        <p>Istirahat panjang muncul setiap 4 sesi fokus.</p>
      </div>
    </details>
  </div>

  <div class="tema">
    <span class="tema-label">Mode gelap</span>
    <button class="switch" id="tema" role="switch" aria-checked="false" aria-label="Mode gelap" title="Mode gelap"><span class="knob"></span></button>
  </div>
  <button class="btn small" id="btnCara">Cara pakai</button>
</header>`;
const KERANGKA_CARA = `<dialog id="dlgCara">
  <h1>Selamat datang di Ruang Belajar</h1>
  <p class="sub">Satu tempat untuk membaca materi, menjaga fokus, bertanya ke AI, dan mengatur jadwal.</p>
  <ol class="langkah">
    <li><div><b>Tambah materi</b><span>Klik atau seret file PDF, TXT, atau MD ke kotak “Tambah materi”. File tersimpan di Supabase dan bisa dibuka dari perangkat mana pun.</span></div></li>
    <li><div><b>Baca sambil fokus</b><span>Pilih materi untuk membukanya, lalu tekan <em>Mulai</em> pada timer di atas: fokus 25 menit, lalu istirahat. Timer tetap berjalan saat kamu pindah materi atau tab.</span></div></li>
    <li><div><b>Tanya AI</b><span>Di panel kanan, tanyakan apa saja tentang materi yang sedang dibuka, atau pakai tombol <em>Ringkas materi</em> dan <em>Buat soal latihan</em>. PDF hasil scan belum bisa dibaca AI.</span></div></li>
    <li><div><b>Atur jadwal dan tugas</b><span>Tab <em>Kalender</em> untuk mencatat jadwal dan ujian. Tab <em>To-do</em> untuk daftar tugas dengan tenggat: makin dekat tenggatnya, makin merah warnanya.</span></div></li>
    <li><div><b>Ganti tampilan</b><span>Gunakan saklar <em>Mode gelap</em> di bagian atas. Pilihanmu berlaku di semua tab dan diingat saat situs dibuka lagi.</span></div></li>
  </ol>
  <p class="catatan">Panduan ini bisa dibuka lagi kapan saja lewat tombol “Cara pakai” di pojok atas.</p>
  <div class="aksi"><button class="btn primary" id="tutupCara">Mulai belajar</button></div>
</dialog>`;

function pasangKerangka() {
  document.body.insertAdjacentHTML("afterbegin", KERANGKA_HEADER.replace("%TAUTAN%", TAUTAN));
  document.body.insertAdjacentHTML("beforeend",
    '<nav class="bawah" aria-label="Halaman">' + TAUTAN + "</nav>" + KERANGKA_CARA + '<div id="toast" role="status"></div>');
  const halaman = document.body.dataset.page;
  document.querySelectorAll(".pages a, nav.bawah a").forEach((a) => { if (a.dataset.page === halaman) a.setAttribute("aria-current", "page"); });
}
pasangKerangka();

/* ---------- Lencana merah pada tab To-do (tugas mendesak / terlambat) ---------- */
function setLencanaTodo(n) {
  document.querySelectorAll('.pages a[data-page="todo"], nav.bawah a[data-page="todo"]').forEach((a) => {
    if (n) a.dataset.badge = n; else delete a.dataset.badge;
  });
}
function waktuTenggat(t) {
  if (!t.tenggat) return null;
  const [y, m, d] = t.tenggat.split("-").map(Number);
  const [hh, mm] = (t.jam ? jam(t.jam) : "23:59").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}
function selisihHari(w) {
  const n = new Date();
  return Math.round((new Date(w.getFullYear(), w.getMonth(), w.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5);
}
function statusTodo(t) {
  if (t.selesai) return { kelas: "selesai", label: "Selesai" };
  const w = waktuTenggat(t);
  if (!w) return { kelas: "aman", label: "Tanpa tenggat" };
  const sisaJam = (w - Date.now()) / 36e5, h = selisihHari(w);
  if (sisaJam < 0) return { kelas: "lewat", label: h < 0 ? "Terlambat " + (-h) + " hari" : "Terlambat" };
  if (sisaJam <= TENGGAT_DEKAT_JAM) {
    return { kelas: "dekat", label: h === 0 ? "Hari ini" : h === 1 ? "Besok" : h + " hari lagi" };
  }
  return { kelas: "aman", label: h + " hari lagi" };
}
async function muatLencanaTodo() {
  if (BELUM_DIATUR) return;
  const { data } = await sb.from("todo").select("tenggat, jam, selesai").eq("selesai", false);
  if (!data) return;
  setLencanaTodo(data.filter((t) => ["dekat", "lewat"].includes(statusTodo(t).kelas)).length);
}

/* ============================================================
   POMODORO
   Waktu dihitung dari jam dinding (endsAt), jadi tetap akurat
   saat tab di latar belakang, dan bertahan setelah refresh.
   ============================================================ */
const DEF = { fokus: 25, istirahat: 5, panjang: 15 };
const LABEL = { fokus: "Fokus", istirahat: "Istirahat", panjang: "Istirahat panjang" };
const KELILING = 94.25;

function bacaP() {
  try {
    const s = JSON.parse(localStorage.getItem("pomo"));
    if (s && s.dur && LABEL[s.mode]) return s;
  } catch {}
  return null;
}
let P = bacaP() || { mode: "fokus", running: false, endsAt: null, remaining: DEF.fokus * 60, cycle: 0, dur: { ...DEF } };
let sesiHariIni = 0;
let audioCtx = null;
function siapkanAudio() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}
// Browser baru mengizinkan suara setelah ada interaksi di halaman ini.
document.addEventListener("pointerdown", siapkanAudio, { once: true });

const simpanP = () => { try { localStorage.setItem("pomo", JSON.stringify(P)); } catch {} };
const totalDetik = () => P.dur[P.mode] * 60;
const sisaDetik = () => P.running ? Math.max(0, Math.ceil((P.endsAt - Date.now()) / 1000)) : P.remaining;
const fmt = (d) => String(Math.floor(d / 60)).padStart(2, "0") + ":" + String(d % 60).padStart(2, "0");

function renderP() {
  const sisa = sisaDetik();
  const prog = 1 - sisa / totalDetik();
  $("#pTime").textContent = fmt(sisa);
  $("#pMode").textContent = LABEL[P.mode] + " · " + sesiHariIni + " sesi hari ini";
  $("#ringProg").style.strokeDashoffset = KELILING * (1 - prog);
  $("#bar").style.width = (prog * 100) + "%";
  $("#pToggle").textContent = P.running ? "Jeda" : (sisa < totalDetik() ? "Lanjut" : "Mulai");
  document.body.dataset.mode = P.mode;
  document.title = P.running ? fmt(sisa) + " · " + LABEL[P.mode] : JUDUL_HALAMAN;
}

function togglePomo() {
  if (P.running) {
    P.remaining = sisaDetik(); P.running = false; P.endsAt = null;
  } else {
    siapkanAudio();
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    P.running = true; P.endsAt = Date.now() + P.remaining * 1000;
    P.materiId = materiTerakhir();   // sesi dicatat untuk materi yang sedang dibaca saat timer dimulai
  }
  simpanP(); renderP();
}
function resetPomo() {
  P.running = false; P.endsAt = null; P.remaining = totalDetik();
  simpanP(); renderP();
}
function selesaiPomo(hitung) {
  const sebelum = P.mode;
  if (hitung && sebelum === "fokus") { P.cycle++; catatSesi(); }
  P.mode = sebelum === "fokus" ? (P.cycle % 4 === 0 ? "panjang" : "istirahat") : "fokus";
  P.running = false; P.endsAt = null; P.remaining = totalDetik();
  simpanP(); renderP();
  if (hitung) {
    bunyi();
    const pesan = sebelum === "fokus" ? "Sesi fokus selesai. Waktunya " + LABEL[P.mode].toLowerCase() + "." : "Istirahat selesai. Siap fokus lagi?";
    toast(pesan);
    if ("Notification" in window && Notification.permission === "granted") new Notification("Ruang Belajar", { body: pesan });
  }
}
function bunyi() {
  if (!audioCtx) return;
  [0, 0.35, 0.7].forEach((t) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
    const mulai = audioCtx.currentTime + t;
    g.gain.setValueAtTime(0.0001, mulai);
    g.gain.exponentialRampToValueAtTime(0.25, mulai + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, mulai + 0.25);
    o.start(mulai); o.stop(mulai + 0.3);
  });
}
async function catatSesi() {
  if (BELUM_DIATUR) return;
  const baris = { materi_id: P.materiId || null, jenis: "fokus", durasi_menit: P.dur.fokus };
  let { error } = await sb.from("sesi_pomodoro").insert(baris);
  // materi sudah dihapus -> catat tanpa materi
  if (error && error.code === "23503") ({ error } = await sb.from("sesi_pomodoro").insert({ ...baris, materi_id: null }));
  if (error) toast("Sesi belum tersimpan: " + error.message);
  else muatJumlahSesi();
}
async function muatJumlahSesi() {
  if (BELUM_DIATUR) return;
  const awal = new Date(); awal.setHours(0, 0, 0, 0);
  const { count } = await sb.from("sesi_pomodoro").select("id", { count: "exact", head: true }).gte("selesai_pada", awal.toISOString());
  sesiHariIni = count || 0; renderP();
}

setInterval(() => {
  if (P.running && sisaDetik() <= 0) {
    // Jika halaman/tab lain sudah menyelesaikan sesi ini, ikuti statusnya (hindari tercatat dua kali).
    const s = bacaP();
    if (s && (!s.running || s.endsAt !== P.endsAt)) { P = s; renderP(); return; }
    // Jika halaman baru dibuka lagi jauh setelah waktu habis, jangan hitung sebagai sesi belajar.
    selesaiPomo(Date.now() - P.endsAt < 120000);
  } else renderP();
}, 250);

$("#pToggle").onclick = togglePomo;
$("#pReset").onclick = resetPomo;
$("#pSkip").onclick = () => selesaiPomo(false);
[["#setFokus", "fokus", 180], ["#setIstirahat", "istirahat", 60], ["#setPanjang", "panjang", 120]].forEach(([sel, kunci, maks]) => {
  const el = $(sel); el.value = P.dur[kunci];
  el.onchange = () => {
    P.dur[kunci] = Math.min(maks, Math.max(1, parseInt(el.value) || DEF[kunci])); el.value = P.dur[kunci];
    if (!P.running && P.mode === kunci) P.remaining = totalDetik();
    simpanP(); renderP();
  };
});

// Timer yang diubah di halaman/tab lain langsung ikut di sini.
window.addEventListener("storage", (e) => {
  if (e.key !== "pomo") return;
  const s = bacaP(); if (!s) return;
  P = s;
  $("#setFokus").value = P.dur.fokus; $("#setIstirahat").value = P.dur.istirahat; $("#setPanjang").value = P.dur.panjang;
  renderP();
});

/* ============================================================
   TEMA TERANG / GELAP
   Disimpan di localStorage; berlaku untuk semua tab/halaman.
   ============================================================ */
const swTema = $("#tema");
function terapkanTema(t, simpan) {
  document.documentElement.dataset.tema = t;
  swTema.setAttribute("aria-checked", String(t === "gelap"));
  if (simpan) { try { localStorage.setItem("tema", t); } catch {} }
}
terapkanTema(document.documentElement.dataset.tema === "gelap" ? "gelap" : "terang", false);
swTema.onclick = () => terapkanTema(document.documentElement.dataset.tema === "gelap" ? "terang" : "gelap", true);
// Jika situs terbuka di beberapa tab browser, tema ikut berubah di semuanya.
window.addEventListener("storage", (e) => { if (e.key === "tema" && (e.newValue === "gelap" || e.newValue === "terang")) terapkanTema(e.newValue, false); });

/* ============================================================
   DIALOG "CARA PAKAI" (muncul otomatis saat pertama kali membuka situs)
   ============================================================ */
const dlgCara = $("#dlgCara");
function bukaCara() { if (!dlgCara.open) dlgCara.showModal(); }
function tutupCara() { dlgCara.close(); }
dlgCara.addEventListener("close", () => { try { localStorage.setItem("cara_dilihat", "1"); } catch {} });
$("#tutupCara").onclick = tutupCara;
$("#btnCara").onclick = bukaCara;
dlgCara.addEventListener("click", (e) => { if (e.target === dlgCara) tutupCara(); });
try { if (!localStorage.getItem("cara_dilihat")) bukaCara(); } catch { bukaCara(); }


/* ---------- Mulai ---------- */
renderP();
muatJumlahSesi();
if (document.body.dataset.page !== "todo") muatLencanaTodo();   // halaman To-do menghitungnya sendiri
if (BELUM_DIATUR) toast("Isi SUPABASE_URL dan SUPABASE_ANON_KEY di js/config.js dulu.");
