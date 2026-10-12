/* ============================================================
   config.js: pengaturan yang perlu kamu isi / ubah
   ============================================================ */

/* Data proyek Supabase (Supabase > Project Settings > API).
   Anon key aman ditaruh di sini karena data dilindungi Row Level Security.
   JANGAN pernah menaruh service_role key atau API key Gemini di file ini. */
const SUPABASE_URL = "https://pchfbjqrltcglbinnpty.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjaGZianFybHRjZ2xiaW5ucHR5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0NTQ2MDYsImV4cCI6MjEwNzAzMDYwNn0.vcX3fRVPN5MMLoafl8h0JpFQoEZXpOW-MAsI2ZIpazs";

/* Teks bawaan halaman About. Ganti isinya di sini, atau ubah langsung dari
   tab About lewat tombol "Ubah teks" (tersimpan di Supabase dan menimpa teks ini). */
const ABOUT_BAWAAN = {
  judul: "Tentang Ruang Belajar",
  teks:
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\n" +
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\n" +
    "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.",
};

const BUCKET = "materi";              // nama bucket Supabase Storage
const MAKS_UKURAN = 25 * 1024 * 1024; // ukuran file unggahan maksimal
const MAKS_TEKS = 600000;             // teks materi yang disimpan untuk AI (karakter)

/* To-do: tenggat <= jumlah jam ini (atau sudah lewat) tampil merah. */
const TENGGAT_DEKAT_JAM = 48;

const BELUM_DIATUR = SUPABASE_URL.includes("GANTI") || SUPABASE_ANON_KEY.includes("GANTI");
