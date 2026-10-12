/* ============================================================
   kalender.js: halaman Kalender (kalender.html)
   Membutuhkan: config.js, common.js
   ============================================================ */

const NAMA_KAT_PLACEHOLDER = null;
let daftarMateri = [];   // untuk pilihan "tautkan ke materi" dan tombol "Buka materi"
async function muatDaftarMateri() {
  if (BELUM_DIATUR) return;
  const { data } = await sb.from("materi").select("id, judul").order("dibuat_pada", { ascending: false });
  daftarMateri = data || [];
}

/* ============================================================
   KALENDER
   Tanggal disimpan sebagai teks "YYYY-MM-DD" (waktu lokal) agar
   tidak bergeser karena zona waktu.
   ============================================================ */
const NAMA_KAT = { tugas: "Tugas", ujian: "Ujian", belajar: "Belajar", lainnya: "Lainnya" };


let kalBulan = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let tglDipilih = iso(new Date());
let acaraGrid = [];      // acara yang terlihat di grid bulan ini
let acaraNanti = [];     // acara mendatang
let acaraEditId = null;

function awalGrid() {
  const d = new Date(kalBulan);
  d.setDate(1 - ((d.getDay() + 6) % 7));   // minggu dimulai hari Senin
  return d;
}
function urutAcara(a, b) { return (a.jam_mulai || "").localeCompare(b.jam_mulai || "") || a.judul.localeCompare(b.judul); }
const acaraPada = (k) => acaraGrid.filter((a) => a.tanggal === k).sort(urutAcara);

async function muatAcara() {
  renderKalender();
  if (BELUM_DIATUR) return;
  const awal = awalGrid(); const akhir = new Date(awal); akhir.setDate(awal.getDate() + 41);
  const [g, n] = await Promise.all([
    sb.from("acara").select("*").gte("tanggal", iso(awal)).lte("tanggal", iso(akhir)).order("tanggal", { ascending: true }),
    sb.from("acara").select("*").gte("tanggal", iso(new Date())).order("tanggal", { ascending: true }).limit(8),
  ]);
  if (g.error || n.error) {
    toast("Gagal memuat acara: " + (g.error || n.error).message + " (sudah menjalankan schema.sql terbaru?)");
    return;
  }
  acaraGrid = g.data; acaraNanti = n.data.sort((x, y) => x.tanggal.localeCompare(y.tanggal) || urutAcara(x, y));
  renderKalender();
}

function renderKalender() {
  $("#kalJudul").textContent = NAMA_BULAN[kalBulan.getMonth()] + " " + kalBulan.getFullYear();
  const grid = $("#kalGrid"); grid.replaceChildren();
  ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].forEach((h) => grid.append(buat("div", { className: "hdr", textContent: h })));
  const awal = awalGrid(), hariIni = iso(new Date());
  for (let i = 0; i < 42; i++) {
    const d = new Date(awal); d.setDate(awal.getDate() + i);
    const k = iso(d), daftar = acaraPada(k);
    const sel = buat("div", {
      className: "hari" + (d.getMonth() !== kalBulan.getMonth() ? " lain" : "") + (k === hariIni ? " hariini" : "") + (k === tglDipilih ? " dipilih" : ""),
      tabIndex: 0,
    });
    sel.setAttribute("role", "button");
    sel.setAttribute("aria-label", d.getDate() + " " + NAMA_BULAN[d.getMonth()] + ", " + daftar.length + " acara");
    sel.append(buat("span", { className: "tgl", textContent: d.getDate() }));
    daftar.slice(0, 3).forEach((a) => {
      const c = buat("button", { className: "chip", type: "button", title: a.judul, textContent: (a.jam_mulai ? jam(a.jam_mulai) + " " : "") + a.judul });
      c.dataset.kat = a.kategori;
      c.onclick = (e) => { e.stopPropagation(); pilihTanggal(k); dialogAcara(a); };
      sel.append(c);
    });
    if (daftar.length > 3) sel.append(buat("span", { className: "lagi", textContent: "+" + (daftar.length - 3) + " lagi" }));
    sel.onclick = () => pilihTanggal(k);
    sel.ondblclick = () => dialogAcara(null, k);
    sel.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pilihTanggal(k); } };
    grid.append(sel);
  }
  renderSamping();
}

function itemAcara(a, denganTanggal) {
  const li = buat("li", { className: "item" }); li.dataset.kat = a.kategori;
  const waktu = a.jam_mulai ? jam(a.jam_mulai) + (a.jam_selesai ? "–" + jam(a.jam_selesai) : "") : "Sepanjang hari";
  const tgl = denganTanggal ? (() => { const d = dariIso(a.tanggal); return NAMA_HARI[d.getDay()].slice(0, 3) + ", " + d.getDate() + " " + NAMA_BULAN[d.getMonth()].slice(0, 3) + " · "; })() : "";
  const edit = buat("button", { className: "edit", type: "button", title: "Ubah acara", onclick: () => dialogAcara(a) },
    buat("span", { className: "jdl", textContent: a.judul }),
    buat("span", { className: "info", textContent: tgl + waktu + " · " + NAMA_KAT[a.kategori] }));
  li.append(edit);
  const m = a.materi_id && daftarMateri.find((x) => x.id === a.materi_id);
  if (m) li.append(buat("a", { className: "btn small buka-materi", href: "index.html?materi=" + encodeURIComponent(m.id), textContent: "Buka materi", title: m.judul }));
  return li;
}

function renderSamping() {
  const d = dariIso(tglDipilih);
  $("#sampingTgl").textContent = NAMA_HARI[d.getDay()] + ", " + d.getDate() + " " + NAMA_BULAN[d.getMonth()] + " " + d.getFullYear();
  const hari = $("#agendaHari"); hari.replaceChildren();
  const daftar = acaraPada(tglDipilih);
  if (!daftar.length) hari.append(buat("li", { className: "kosong-kecil", textContent: "Belum ada acara di tanggal ini." }));
  daftar.forEach((a) => hari.append(itemAcara(a, false)));
  const nanti = $("#agendaNanti"); nanti.replaceChildren();
  if (!acaraNanti.length) nanti.append(buat("li", { className: "kosong-kecil", textContent: "Tidak ada acara mendatang." }));
  acaraNanti.forEach((a) => nanti.append(itemAcara(a, true)));
}

function pilihTanggal(k) {
  tglDipilih = k;
  const d = dariIso(k);
  if (d.getMonth() !== kalBulan.getMonth() || d.getFullYear() !== kalBulan.getFullYear()) {
    kalBulan = new Date(d.getFullYear(), d.getMonth(), 1); muatAcara();
  } else renderKalender();
}
function gantiBulan(n) {
  kalBulan = new Date(kalBulan.getFullYear(), kalBulan.getMonth() + n, 1);
  tglDipilih = iso(kalBulan); muatAcara();
}
$("#kalPrev").onclick = () => gantiBulan(-1);
$("#kalNext").onclick = () => gantiBulan(1);
$("#kalHariIni").onclick = () => { const t = new Date(); kalBulan = new Date(t.getFullYear(), t.getMonth(), 1); tglDipilih = iso(t); muatAcara(); };
$("#kalTambah").onclick = () => dialogAcara(null, tglDipilih);
$("#sampingTambah").onclick = () => dialogAcara(null, tglDipilih);

/* ---------- Dialog tambah / ubah acara ---------- */
const dlgAcara = $("#dlgAcara");
function dialogAcara(a, tanggal) {
  $("#formAcara").reset();
  const sel = $("#aMateri");
  sel.replaceChildren(new Option("— Tidak ditautkan —", ""), ...daftarMateri.map((m) => new Option(m.judul, m.id)));
  acaraEditId = a ? a.id : null;
  $("#acaraHeading").textContent = a ? "Ubah acara" : "Acara baru";
  $("#aHapus").hidden = !a;
  $("#aJudul").value = a ? a.judul : "";
  $("#aTanggal").value = a ? a.tanggal : (tanggal || tglDipilih);
  $("#aMulai").value = a ? jam(a.jam_mulai) : "";
  $("#aSelesai").value = a ? jam(a.jam_selesai) : "";
  const mt = daftarMateri.some((m) => m.id === materiTerakhir()) ? materiTerakhir() : "";
  $("#aKategori").value = a ? a.kategori : (mt ? "belajar" : "tugas");
  $("#aMateri").value = a && a.materi_id ? a.materi_id : (!a ? mt : "");
  $("#aCatatan").value = a ? a.catatan : "";
  dlgAcara.showModal();
  $("#aJudul").focus();
}
$("#aBatal").onclick = () => dlgAcara.close();

$("#formAcara").onsubmit = async (e) => {
  e.preventDefault();
  if (BELUM_DIATUR) { toast("Isi konfigurasi Supabase dulu."); return; }
  const judul = $("#aJudul").value.trim(), tanggal = $("#aTanggal").value;
  const mulai = $("#aMulai").value || null, selesai = $("#aSelesai").value || null;
  if (!judul || !tanggal) return;
  if (selesai && !mulai) { toast("Isi jam mulai jika jam selesai diisi."); return; }
  if (mulai && selesai && selesai < mulai) { toast("Jam selesai tidak boleh sebelum jam mulai."); return; }
  const data = { judul, tanggal, jam_mulai: mulai, jam_selesai: selesai, kategori: $("#aKategori").value, catatan: $("#aCatatan").value.trim(), materi_id: $("#aMateri").value || null };
  const q = acaraEditId ? sb.from("acara").update(data).eq("id", acaraEditId) : sb.from("acara").insert(data);
  const { error } = await q;
  if (error) { toast("Acara belum tersimpan: " + error.message); return; }
  dlgAcara.close();
  // pindah ke bulan acara agar langsung terlihat
  const d = dariIso(tanggal); kalBulan = new Date(d.getFullYear(), d.getMonth(), 1); tglDipilih = tanggal;
  await muatAcara(); toast(acaraEditId ? "Acara diperbarui." : "Acara ditambahkan.");
};
$("#aHapus").onclick = async () => {
  if (!acaraEditId || !confirm("Hapus acara ini?")) return;
  const { error } = await sb.from("acara").delete().eq("id", acaraEditId);
  if (error) { toast("Gagal menghapus: " + error.message); return; }
  dlgAcara.close(); await muatAcara(); toast("Acara dihapus.");
};


muatDaftarMateri().then(muatAcara);
