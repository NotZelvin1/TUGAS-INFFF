/* ============================================================
   belajar.js: halaman Belajar (index.html)
   daftar materi + unggah, pembaca PDF/teks, dan chat AI (Gemini)
   Membutuhkan: config.js, common.js, pdf.js
   ============================================================ */

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

let daftarMateri = [];
let aktif = null;         // materi yang sedang dibuka
let pesanChat = [];       // [{peran, isi}]
let pdfObserver = null;
let sedangTanya = false;

/* ============================================================
   MATERI: daftar, unggah, hapus
   ============================================================ */
async function muatMateri() {
  const { data, error } = await sb.from("materi")
    .select("id, judul, tipe, file_path, jumlah_halaman, dibuat_pada")
    .order("dibuat_pada", { ascending: false });
  if (error) { toast("Gagal memuat materi: " + error.message); return; }
  daftarMateri = data; renderDaftar();
}

function renderDaftar() {
  const ul = $("#daftar"); ul.replaceChildren();
  if (!daftarMateri.length) {
    ul.append(buat("li", { className: "meta", textContent: "Belum ada materi. Unggah file pertamamu di atas." }));
    return;
  }
  daftarMateri.forEach((m) => {
    const li = buat("li", { className: aktif && aktif.id === m.id ? "aktif" : "" });
    const buka = buat("button", { className: "buka", onclick: () => bukaMateri(m.id) },
      buat("span", { className: "judul", textContent: m.judul }),
      buat("span", { className: "meta", textContent: m.tipe === "pdf" ? "PDF · " + (m.jumlah_halaman || "?") + " hlm" : "Teks" }));
    const hapus = buat("button", { className: "hapus", title: "Hapus materi", textContent: "Hapus", onclick: () => hapusMateri(m) });
    li.append(buka, hapus); ul.append(li);
  });
}

async function ekstrakPdf(buf) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let isi = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const hal = await pdf.getPage(i);
    const tc = await hal.getTextContent();
    isi += "[Halaman " + i + "]\n" + tc.items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim() + "\n\n";
  }
  return { isi, halaman: pdf.numPages };
}

/* ---------- Materi menyesuaikan nama file yang diunggah ---------- */

// "bab-3_jaringan-komputer (1).PDF" -> "Bab 3 Jaringan Komputer"
function judulDariNamaFile(nama) {
  let t = nama.replace(/\.(pdf|txt|md|markdown|text)$/i, "");   // buang ekstensi yang dikenal
  try { t = decodeURIComponent(t); } catch {}                    // "Bab%203" -> "Bab 3"
  t = t.replace(/[_\-]+/g, " ");
  t = t.replace(/(\d)?\.(\d)?/g, (m, a, b) => (a && b ? m : (a || "") + " " + (b || "")));   // "bab.1.final" -> "bab 1 final", tapi "3.1" tetap
  t = t.replace(/\s+/g, " ").trim();
  t = t.replace(/\s*\(\d+\)$/, "").trim();                       // akhiran " (1)" dari browser
  // satu kata panjang bergaya CamelCase: "MateriJaringanKomputer" -> "Materi Jaringan Komputer"
  if (!t.includes(" ") && (t.match(/[a-z][A-Z]/g) || []).length >= 2) t = t.replace(/([a-z])([A-Z])/g, "$1 $2");
  // semua huruf kecil -> awal tiap kata dikapitalkan. Judul huruf besar/campuran dibiarkan (mis. singkatan).
  if (t === t.toLowerCase()) t = t.replace(/(^|\s)(\p{L})/gu, (_, sp, h) => sp + h.toUpperCase());
  t = t.slice(0, 110).trim();
  return t || "Materi " + new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

// Judul yang sudah ada diberi nomor: "Judul", "Judul (2)", "Judul (3)", ...
function judulUnik(dasar) {
  const ada = new Set(daftarMateri.map((m) => m.judul.toLowerCase()));
  if (!ada.has(dasar.toLowerCase())) return dasar;
  let n = 2; while (ada.has((dasar + " (" + n + ")").toLowerCase())) n++;
  return dasar + " (" + n + ")";
}

// Jenis file dikenali dari ekstensi, tipe MIME, atau isinya, jadi nama file apa pun boleh
// (huruf besar, banyak titik, atau tanpa ekstensi sama sekali).
async function jenisFile(file) {
  const nama = file.name.toLowerCase();
  const ext = nama.includes(".") ? nama.split(".").pop() : "";
  if (ext === "pdf" || file.type === "application/pdf") return "pdf";
  if (["txt", "md", "markdown", "text"].includes(ext) || file.type === "text/plain" || file.type === "text/markdown") return "teks";
  const kepala = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  if (String.fromCharCode(...kepala.slice(0, 5)) === "%PDF-") return "pdf";
  if (!ext && !kepala.includes(0)) return "teks";   // tanpa ekstensi dan tidak berisi data biner
  return null;
}

async function unggah(file) {
  if (!file.size) { toast("File “" + file.name + "” kosong."); return; }
  if (file.size > MAKS_UKURAN) { toast("Ukuran file maksimal 25 MB."); return; }
  const jenis = await jenisFile(file);
  if (!jenis) { toast("Format “" + file.name + "” belum didukung. Pakai PDF, TXT, atau MD."); return; }
  const label = $("#dropzone"); label.style.opacity = .6; label.style.pointerEvents = "none";
  try {
    toast("Membaca “" + file.name + "”…");
    let isi = "", halaman = null;
    if (jenis === "pdf") {
      // slice(0) supaya buffer asli tidak "terpakai" oleh pdf.js
      const r = await ekstrakPdf((await file.arrayBuffer()).slice(0)); isi = r.isi; halaman = r.halaman;
      if (r.isi.replace(/\[Halaman \d+\]/g, "").trim().length < 50)
        toast("PDF ini tampaknya hasil scan: bisa dibaca, tapi AI belum bisa membaca isinya.");
    } else {
      isi = await file.text();
      if (!isi.trim()) throw new Error("file teks ini tidak berisi tulisan");
    }

    // Nama di storage dibuat acak, jadi nama file seaneh apa pun (spasi, emoji, simbol) aman.
    const path = crypto.randomUUID() + (jenis === "pdf" ? ".pdf" : ".txt");
    const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: jenis === "pdf" ? "application/pdf" : "text/plain" });
    if (up.error) throw up.error;

    const judul = judulUnik(judulDariNamaFile(file.name));
    const { data, error } = await sb.from("materi").insert({
      judul, tipe: jenis, file_path: path, isi: isi.slice(0, MAKS_TEKS), jumlah_halaman: halaman,
    }).select("id").single();
    if (error) { await sb.storage.from(BUCKET).remove([path]); throw error; }

    await muatMateri(); await bukaMateri(data.id); toast("Materi tersimpan sebagai “" + judul + "”.");
  } catch (e) {
    toast("Gagal mengunggah: " + (e.message || e));
  } finally { label.style.opacity = 1; label.style.pointerEvents = ""; $("#berkas").value = ""; }
}

$("#berkas").onchange = (e) => e.target.files[0] && unggah(e.target.files[0]);
const dz = $("#dropzone");
["dragenter", "dragover"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); }));
["dragleave", "drop"].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("over"); }));
dz.addEventListener("drop", (e) => e.dataTransfer.files[0] && unggah(e.dataTransfer.files[0]));

async function hapusMateri(m) {
  if (!confirm("Hapus materi “" + m.judul + "” beserta riwayat chat-nya?")) return;
  if (m.file_path) await sb.storage.from(BUCKET).remove([m.file_path]);
  const { error } = await sb.from("materi").delete().eq("id", m.id);
  if (error) { toast("Gagal menghapus: " + error.message); return; }
  if (aktif && aktif.id === m.id) { aktif = null; simpanMateriTerakhir(null); tampilKosong(); renderChat(); }
  await muatMateri();
}

/* ============================================================
   PEMBACA
   ============================================================ */
function tampilKosong() {
  $("#judulAktif").textContent = "";
  $("#reader").replaceChildren(buat("div", { className: "kosong" },
    buat("strong", { textContent: "Belum ada materi yang dibuka" }),
    "Pilih materi di daftar, atau unggah PDF/TXT. Timer Pomodoro tetap berjalan selama kamu membaca."));
}

async function bukaMateri(id) {
  const meta = daftarMateri.find((m) => m.id === id); if (!meta) return;
  aktif = meta; simpanMateriTerakhir(id); renderDaftar();
  $("#judulAktif").textContent = meta.judul;
  setView("reader");
  const area = $("#reader"); area.scrollTop = 0;
  area.replaceChildren(buat("div", { className: "kosong", textContent: "Memuat materi…" }));
  muatChat();

  try {
    if (meta.tipe === "teks") {
      const { data, error } = await sb.from("materi").select("isi").eq("id", id).single();
      if (error) throw error;
      if (aktif.id !== id) return;
      area.replaceChildren(buat("article", { className: "doc", textContent: data.isi }));
    } else {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(meta.file_path, 3600);
      if (error) throw error;
      if (aktif.id !== id) return;
      await tampilPdf(data.signedUrl, id);
    }
  } catch (e) {
    area.replaceChildren(buat("div", { className: "kosong", textContent: "Materi tidak bisa dimuat: " + (e.message || e) }));
  }
}

async function tampilPdf(url, id) {
  const area = $("#reader");
  const pdf = await pdfjsLib.getDocument({ url }).promise;
  if (!aktif || aktif.id !== id) return;
  area.replaceChildren();
  if (pdfObserver) pdfObserver.disconnect();

  const lebar = Math.min(area.clientWidth - 24, 900);
  const pertama = await pdf.getPage(1);
  const skala = lebar / pertama.getViewport({ scale: 1 }).width;
  const tinggiPerkiraan = pertama.getViewport({ scale: skala }).height;

  pdfObserver = new IntersectionObserver((entri) => {
    entri.forEach(async (en) => {
      if (!en.isIntersecting) return;
      const div = en.target; pdfObserver.unobserve(div);
      const hal = await pdf.getPage(+div.dataset.n);
      const vp = hal.getViewport({ scale: skala });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const c = buat("canvas");
      c.width = vp.width * dpr; c.height = vp.height * dpr;
      c.style.width = vp.width + "px"; c.style.height = vp.height + "px";
      div.style.height = ""; div.append(c);
      await hal.render({ canvasContext: c.getContext("2d"), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise;
    });
  }, { root: area, rootMargin: "800px 0px" });

  for (let i = 1; i <= pdf.numPages; i++) {
    const div = buat("div", { className: "page" }, buat("span", { className: "nomor", textContent: "Hlm " + i }));
    div.dataset.n = i; div.style.width = lebar + "px"; div.style.height = tinggiPerkiraan + "px";
    area.append(div); pdfObserver.observe(div);
  }
}

/* ============================================================
   CHAT AI (lewat Supabase Edge Function "ask-ai" -> Gemini)
   ============================================================ */
function md(teks) {
  const blok = [];
  let s = teks.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/```[a-z]*\n?([\s\S]*?)```/g, (_, c) => { blok.push(c.trim()); return "\u0000" + (blok.length - 1) + "\u0000"; });
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>").replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/^(?:[-*] .+(?:\n|$))+/gm, (m) => "<ul>" + m.trim().split("\n").map((l) => "<li>" + l.replace(/^[-*] /, "") + "</li>").join("") + "</ul>");
  s = s.replace(/\n{2,}/g, "<br><br>").replace(/\n/g, "<br>").replace(/<\/ul><br>/g, "</ul>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => "<pre>" + blok[i] + "</pre>");
}

function tambahPesan(peran, teks, kelas = "") {
  const el = buat("div", { className: "msg " + peran + " " + kelas });
  if (peran === "model" && !kelas) el.innerHTML = md(teks); else el.textContent = teks;
  const box = $("#pesan"); box.append(el); box.scrollTop = box.scrollHeight;
  return el;
}

function aturInputChat() {
  const aktifChat = !!aktif && !sedangTanya;
  $("#inputTanya").disabled = !aktif || sedangTanya;
  $("#kirim").disabled = !aktifChat;
  $("#chips").querySelectorAll("button").forEach((b) => b.disabled = !aktifChat);
  $("#inputTanya").placeholder = aktif ? "Tulis pertanyaan…" : "Buka materi dulu";
}

function renderChat() {
  $("#pesan").replaceChildren();
  if (!aktif) tambahPesan("model", "Buka sebuah materi, lalu tanyakan apa saja. Jawaban AI berpedoman pada isi materi itu.", "pending");
  else if (!pesanChat.length) tambahPesan("model", "Materi siap ditanyakan. Coba tombol di bawah, atau tulis pertanyaanmu sendiri.", "pending");
  else pesanChat.forEach((m) => tambahPesan(m.peran, m.isi));
  aturInputChat();
}

async function muatChat() {
  pesanChat = []; renderChat();
  if (!aktif) return;
  const id = aktif.id;
  const { data } = await sb.from("chat").select("peran, isi").eq("materi_id", id)
    .order("dibuat_pada", { ascending: true }).limit(100);
  if (!aktif || aktif.id !== id) return;
  pesanChat = data || []; renderChat();
}

async function tanya(q) {
  q = q.trim();
  if (!aktif || !q || sedangTanya) return;
  sedangTanya = true; aturInputChat();
  const materiId = aktif.id;
  const riwayat = pesanChat.slice(-10);
  if (!pesanChat.length) $("#pesan").replaceChildren();
  tambahPesan("user", q);
  pesanChat.push({ peran: "user", isi: q });
  sb.from("chat").insert({ materi_id: materiId, peran: "user", isi: q }).then(({ error }) => error && console.warn(error));
  const tunggu = tambahPesan("model", "Membaca materi…", "pending");

  try {
    const { data, error } = await sb.functions.invoke("ask-ai", { body: { materi_id: materiId, pertanyaan: q, riwayat } });
    if (error) {
      let detail = error.message;
      try { const j = await error.context.json(); if (j && j.error) detail = j.error; } catch {}
      throw new Error(detail);
    }
    if (aktif && aktif.id === materiId) {
      tunggu.className = "msg model"; tunggu.innerHTML = md(data.jawaban);
      pesanChat.push({ peran: "model", isi: data.jawaban });
    }
    sb.from("chat").insert({ materi_id: materiId, peran: "model", isi: data.jawaban }).then(({ error }) => error && console.warn(error));
  } catch (e) {
    tunggu.className = "msg model error"; tunggu.textContent = e.message || "AI tidak bisa menjawab sekarang.";
    pesanChat.pop(); // pertanyaan gagal tidak dijadikan konteks
  } finally {
    sedangTanya = false; aturInputChat();
    $("#pesan").scrollTop = $("#pesan").scrollHeight;
  }
}

$("#formTanya").onsubmit = (e) => { e.preventDefault(); const i = $("#inputTanya"); const q = i.value; i.value = ""; tanya(q); };
$("#chips").onclick = (e) => { const b = e.target.closest("button[data-q]"); if (b) tanya(b.dataset.q); };

/* ============================================================
   Sub-tab layar kecil (Materi / Baca / Tanya AI)
   ============================================================ */
function setView(v) {
  document.body.dataset.view = v;
  document.querySelectorAll("nav.tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === v)));
}
document.querySelectorAll("nav.tabs button").forEach((b) => b.onclick = () => setView(b.dataset.view));
setView("reader");

/* ============================================================
   Mulai
   Materi dibuka dari ?materi=ID (mis. dari Kalender), atau materi
   terakhir yang dibuka di tab ini.
   ============================================================ */
async function mulai() {
  if (BELUM_DIATUR) {
    $("#daftar").replaceChildren(buat("li", { className: "meta", textContent: "Supabase belum dikonfigurasi (lihat README)." }));
    return;
  }
  await muatMateri();
  const id = new URLSearchParams(location.search).get("materi") || materiTerakhir();
  if (id && daftarMateri.some((m) => m.id === id)) bukaMateri(id);
}
tampilKosong(); renderChat(); mulai();