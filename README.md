# Ruang Belajar

Website belajar dengan tiga bagian dalam satu halaman:

- **Materi**: unggah PDF/TXT/MD, disimpan di Supabase Storage, dibaca langsung di halaman.
- **Pomodoro**: timer selalu terlihat di header saat membaca. Sesi fokus yang selesai dicatat per materi.
- **Tanya AI**: Gemini menjawab berdasarkan isi materi yang sedang dibuka.
- **Kalender**: tab tersendiri untuk mencatat tugas, ujian, dan jadwal belajar. Acara bisa ditautkan ke materi.
- **To-do**: daftar tugas dengan tenggat (tanggal, jam opsional). Tenggat yang dekat (<= 48 jam) atau sudah lewat tampil merah, dan tab To-do menampilkan lencana jumlahnya.
- **About**: halaman tentang yang teksnya bisa diganti (lihat bagian di bawah).
- **Mode terang/gelap**: saklar di header; berlaku di semua tab dan diingat di browser.
- **Cara pakai**: dialog panduan muncul saat situs pertama kali dibuka, dan bisa dibuka lagi lewat tombol di pojok atas.

Tanpa framework dan tanpa proses build: HTML/CSS/JS biasa, satu file SQL, satu Edge Function.

## Struktur

```
index.html        halaman Belajar   (materi, pembaca, chat AI)
kalender.html     halaman Kalender
todo.html         halaman To-do
about.html        halaman About

css/
  base.css        gaya bersama: tema terang/gelap, header, Pomodoro, tombol, dialog
  belajar.css     gaya khusus halaman Belajar
  kalender.css    gaya khusus halaman Kalender
  todo.css        gaya khusus halaman To-do
  about.css       gaya khusus halaman About

js/
  config.js       PENGATURAN: URL + anon key Supabase, teks About bawaan, batas tenggat
  tema-awal.js    menerapkan tema tersimpan sebelum halaman digambar (anti-berkedip)
  common.js       kode bersama: header + tab halaman, Pomodoro, tema, "Cara pakai", toast
  belajar.js      logika halaman Belajar
  kalender.js     logika halaman Kalender
  todo.js         logika halaman To-do
  about.js        logika halaman About

supabase/schema.sql                     tabel, keamanan (RLS), dan bucket penyimpanan
supabase/functions/ask-ai/index.ts      penghubung aman ke Gemini
```

Setiap halaman memuat `css/base.css` + CSS miliknya, lalu `js/config.js` -> `js/common.js` -> JS miliknya
(urutan ini penting). Header dan navigasi dipasang oleh `common.js`, jadi menambah atau mengubah tab
cukup di daftar `HALAMAN` pada file itu (dan membuat file HTML/CSS/JS barunya).

Pindah tab berarti memuat halaman baru. Timer Pomodoro tetap berjalan karena statusnya disimpan di
browser, dan tema serta materi terakhir yang dibuka juga diingat.

## Langkah pemasangan

### 1. Supabase: buat proyek dan ambil URL + anon key
1. Masuk ke https://supabase.com, **New project**, beri nama dan password database.
2. Tunggu proyek siap, lalu buka **Project Settings > API** (atau tombol *Connect*).
3. Salin **Project URL** (`https://xxxx.supabase.co`) dan **anon / publishable key**.
4. Tempel keduanya di **`js/config.js`** (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
   Jangan pakai `service_role` key di sini.

### 2. Supabase: buat tabel dan bucket
Buka **SQL Editor > New query**, tempel seluruh isi `supabase/schema.sql`, klik **Run**.
Setelah itu cek **Storage**: harus ada bucket bernama `materi`.

> Sudah pernah menjalankan `schema.sql` sebelumnya? Jalankan ulang file yang baru ini.
> Aman: data lama tidak berubah, dan hanya tabel baru yang ditambahkan (`acara`, `todo`, `pengaturan`).

### 3. Gemini: ambil API key
1. Buka https://aistudio.google.com/apikey dan masuk dengan akun Google.
2. Klik **Create API key**, lalu salin keynya. Free tier tersedia tanpa kartu kredit.

### 4. Deploy Edge Function (tempat key Gemini disimpan)
Di terminal, dari folder proyek ini (butuh Node.js):
```bash
npx supabase login
npx supabase link --project-ref <ID_PROYEK>      # ID = bagian xxxx pada https://xxxx.supabase.co
npx supabase secrets set GEMINI_API_KEY=<KEY_GEMINI>
npx supabase functions deploy ask-ai
```
Lihat hasilnya di Supabase > **Edge Functions**: `ask-ai` harus berstatus aktif.
Model bisa diganti: `npx supabase secrets set GEMINI_MODEL=gemini-3.1-flash-lite`
(default `gemini-3.6-flash`; daftar terbaru: https://ai.google.dev/gemini-api/docs/models).

### Alternatif tanpa terminal / npx
- **Edge Function lewat dashboard:** Supabase > **Edge Functions > Deploy a new function > Via Editor**.
  Beri nama `ask-ai`, tempel isi `supabase/functions/ask-ai/index.ts`, lalu **Deploy**.
  Simpan key di **Edge Functions > Secrets** dengan nama `GEMINI_API_KEY`.
  Jika muncul error "Invalid JWT", matikan opsi **Verify JWT** pada pengaturan fungsi tersebut.
- **Menjalankan situs:** unggah folder ke Netlify (drag & drop di app.netlify.com/drop),
  atau jalankan `python -m http.server 8000` di folder proyek, atau pakai ekstensi *Live Server* di VS Code.

### 5. Jalankan
```bash
npx serve .
```
Buka alamat yang tampil (jangan lewat `file://`). Untuk online, unggah folder ke
Netlify, Vercel, Cloudflare Pages, atau GitHub Pages.

## Mengubah teks halaman About
Ada dua cara:
1. **Dari aplikasi:** buka tab About, klik **Ubah teks**, edit judul dan isi (pisahkan paragraf dengan satu baris kosong), lalu **Simpan**. Tersimpan di Supabase (tabel `pengaturan`) dan muncul di semua perangkat. Tombol *Kembalikan ke teks bawaan* mengembalikannya.
2. **Dari kode:** ubah konstanta `ABOUT_BAWAAN` di `js/config.js`. Ini teks bawaan yang dipakai selama belum ada teks yang disimpan dari aplikasi.

## Mengatur batas "tenggat dekat"
Di `js/config.js`, ubah `TENGGAT_DEKAT_JAM` (bawaan 48 jam). Tugas yang tenggatnya kurang dari angka ini, atau sudah lewat, tampil merah.

## Keamanan (versi tanpa login)
- **Jangan menaruh API key Gemini di file mana pun di folder ini (termasuk `js/config.js`).** Key hanya ada di Supabase secrets.
- Tanpa login, siapa pun yang memegang URL situsmu bisa melihat materi, mengubah to-do, kalender, dan teks About, serta memakai kuota Gemini-mu.
  Aman untuk dipakai sendiri atau lokal; **jangan dipublikasikan luas** sebelum login ditambahkan.
- `token.txt` dari proyek lama tidak dipakai di sini. Jika isinya API key dan pernah terkirim
  atau ter-commit, buat ulang key tersebut.

## Batasan yang perlu diketahui
- **PDF hasil scan** (gambar) bisa dibaca di layar, tetapi AI belum bisa membacanya karena tidak ada
  teks yang bisa diekstrak. Gunakan PDF yang teksnya bisa diseleksi.
- Teks materi dipotong di 600.000 karakter (kira-kira ratusan halaman).
- Free tier Gemini dibatasi per menit dan per hari. Jika tercapai, aplikasi menampilkan pesan
  dan kamu bisa mencoba lagi sebentar kemudian.
- Sesi Pomodoro hanya dihitung jika timer benar-benar selesai. Jika tab dibuka lagi lebih dari
  2 menit setelah waktu habis, sesi itu tidak dicatat.
