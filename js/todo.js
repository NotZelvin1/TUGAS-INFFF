/* ============================================================
   todo.js: halaman To-do (todo.html)
   Fungsi status tenggat (statusTodo, dll.) ada di common.js
   karena juga dipakai untuk lencana merah di tab To-do.
   Membutuhkan: config.js, common.js
   ============================================================ */

/* ============================================================
   TO-DO
   ============================================================ */
let todos = [];
let filterTodo = "semua";
let todoEditId = null;

function fmtTenggat(t) {
  const d = dariIso(t.tenggat);
  return NAMA_HARI[d.getDay()].slice(0, 3) + ", " + d.getDate() + " " + NAMA_BULAN[d.getMonth()].slice(0, 3) + " " + d.getFullYear() + (t.jam ? " · " + jam(t.jam) : "");
}
function urutTodo(a, b) {
  if (a.selesai !== b.selesai) return a.selesai ? 1 : -1;
  const wa = waktuTenggat(a), wb = waktuTenggat(b);
  if (wa && wb) return wa - wb;
  if (wa) return -1;
  if (wb) return 1;
  return a.dibuat_pada.localeCompare(b.dibuat_pada);
}

async function muatTodo() {
  renderTodo();
  if (BELUM_DIATUR) return;
  const { data, error } = await sb.from("todo").select("*").order("dibuat_pada", { ascending: true });
  if (error) { toast("Gagal memuat to-do: " + error.message + " (sudah menjalankan schema.sql terbaru?)"); return; }
  todos = data; renderTodo();
}

function itemTodo(t) {
  const st = statusTodo(t);
  const li = buat("li", { className: "todo-item " + st.kelas });
  const cb = buat("input", { type: "checkbox", checked: t.selesai, title: t.selesai ? "Tandai belum selesai" : "Tandai selesai" });
  cb.setAttribute("aria-label", "Selesai: " + t.teks);
  cb.onchange = () => toggleTodo(t);
  const info = buat("span", { className: "todo-info" }, buat("span", { className: "label", textContent: st.label }));
  if (t.tenggat) info.append(buat("span", { textContent: fmtTenggat(t) }));
  const aksi = buat("span", { className: "todo-aksi" },
    buat("button", { className: "btn small", type: "button", textContent: "Ubah", onclick: () => dialogTodo(t) }),
    buat("button", { className: "btn small danger", type: "button", textContent: "Hapus", onclick: () => hapusTodo(t) }));
  li.append(cb, buat("span", { className: "todo-teks", textContent: t.teks }), info, aksi);
  return li;
}

function renderTodo() {
  const status = todos.map(statusTodo);
  const aktifN = todos.filter((t) => !t.selesai).length;
  const lewatN = status.filter((s) => s.kelas === "lewat").length;
  const dekatN = status.filter((s) => s.kelas === "dekat").length;
  const ring = $("#todoRingkas"); ring.replaceChildren();
  ring.append(buat("span", { className: "pil", textContent: aktifN + " aktif" }));
  if (lewatN) ring.append(buat("span", { className: "pil merah", textContent: lewatN + " terlambat" }));
  if (dekatN) ring.append(buat("span", { className: "pil merah", textContent: dekatN + " mendesak" }));
  ring.append(buat("span", { className: "pil", textContent: (todos.length - aktifN) + " selesai" }));

  const ul = $("#todoList"); ul.replaceChildren();
  const tampil = todos.slice().sort(urutTodo).filter((t) => filterTodo === "semua" || (filterTodo === "aktif" ? !t.selesai : t.selesai));
  if (!tampil.length) {
    ul.append(buat("li", { className: "todo-kosong", textContent:
      todos.length ? "Tidak ada tugas di filter ini." : "Belum ada tugas. Tulis satu di kolom di atas, lalu tentukan tenggatnya." }));
  }
  tampil.forEach((t) => ul.append(itemTodo(t)));

  setLencanaTodo(lewatN + dekatN);   // lencana merah di tab To-do
}

$("#formTodo").onsubmit = async (e) => {
  e.preventDefault();
  const teks = $("#tTeks").value.trim(); if (!teks) return;
  const tenggat = $("#tTenggat").value || null, jamV = $("#tJam").value || null;
  if (jamV && !tenggat) { toast("Pilih tanggal tenggat jika jam diisi."); return; }
  if (BELUM_DIATUR) { toast("Isi konfigurasi Supabase dulu."); return; }
  const { data, error } = await sb.from("todo").insert({ teks, tenggat, jam: jamV }).select().single();
  if (error) { toast("Tugas belum tersimpan: " + error.message); return; }
  todos.push(data); $("#formTodo").reset(); renderTodo(); $("#tTeks").focus();
};

async function toggleTodo(t) {
  t.selesai = !t.selesai; renderTodo();           // tampil dulu, simpan setelahnya
  const { error } = await sb.from("todo").update({ selesai: t.selesai }).eq("id", t.id);
  if (error) { t.selesai = !t.selesai; renderTodo(); toast("Gagal memperbarui: " + error.message); }
}
async function hapusTodo(t) {
  if (!t || !confirm("Hapus tugas “" + t.teks + "”?")) return;
  const { error } = await sb.from("todo").delete().eq("id", t.id);
  if (error) { toast("Gagal menghapus: " + error.message); return; }
  todos = todos.filter((x) => x.id !== t.id); renderTodo();
}
$("#todoBersih").onclick = async () => {
  if (!todos.some((t) => t.selesai)) { toast("Belum ada tugas yang selesai."); return; }
  if (!confirm("Hapus semua tugas yang sudah selesai?")) return;
  const { error } = await sb.from("todo").delete().eq("selesai", true);
  if (error) { toast("Gagal menghapus: " + error.message); return; }
  todos = todos.filter((t) => !t.selesai); renderTodo();
};
document.querySelectorAll("#todoFilter button[data-f]").forEach((b) => b.onclick = () => {
  filterTodo = b.dataset.f;
  document.querySelectorAll("#todoFilter button[data-f]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  renderTodo();
});

const dlgTodo = $("#dlgTodo");
function dialogTodo(t) {
  todoEditId = t.id;
  $("#etTeks").value = t.teks; $("#etTenggat").value = t.tenggat || ""; $("#etJam").value = jam(t.jam);
  dlgTodo.showModal(); $("#etTeks").focus();
}
$("#etBatal").onclick = () => dlgTodo.close();
$("#formEditTodo").onsubmit = async (e) => {
  e.preventDefault();
  const t = todos.find((x) => x.id === todoEditId); if (!t) return;
  const teks = $("#etTeks").value.trim(), tenggat = $("#etTenggat").value || null, jamV = $("#etJam").value || null;
  if (!teks) return;
  if (jamV && !tenggat) { toast("Pilih tanggal tenggat jika jam diisi."); return; }
  const { error } = await sb.from("todo").update({ teks, tenggat, jam: jamV }).eq("id", t.id);
  if (error) { toast("Gagal menyimpan: " + error.message); return; }
  Object.assign(t, { teks, tenggat, jam: jamV }); dlgTodo.close(); renderTodo();
};
// Warna tenggat diperbarui tiap menit tanpa perlu memuat ulang halaman.
setInterval(renderTodo, 60000);


muatTodo();
