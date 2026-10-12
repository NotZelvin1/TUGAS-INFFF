-- VERSI TANPA LOGIN
-- Jalankan seluruh isi file ini di Supabase > SQL Editor > New query > Run.
--
-- File ini AMAN DIJALANKAN ULANG: tabel yang sudah ada tidak diubah, data tidak hilang.
--
-- Jika sebelumnya kamu menjalankan versi lama yang memakai login (kolom user_id),
-- hapus dulu tabel lamanya dengan menjalankan 2 baris ini, baru jalankan file ini:
--   drop table if exists public.chat, public.sesi_pomodoro, public.materi cascade;
--   drop policy if exists "file materi milik sendiri" on storage.objects;

create table if not exists public.materi (
  id             uuid primary key default gen_random_uuid(),
  judul          text not null,
  tipe           text not null check (tipe in ('pdf', 'teks')),
  file_path      text,
  isi            text not null default '',
  jumlah_halaman int,
  dibuat_pada    timestamptz not null default now()
);

create table if not exists public.sesi_pomodoro (
  id           uuid primary key default gen_random_uuid(),
  materi_id    uuid references public.materi on delete set null,
  jenis        text not null default 'fokus',
  durasi_menit int  not null,
  selesai_pada timestamptz not null default now()
);

create table if not exists public.chat (
  id          uuid primary key default gen_random_uuid(),
  materi_id   uuid not null references public.materi on delete cascade,
  peran       text not null check (peran in ('user', 'model')),
  isi         text not null,
  dibuat_pada timestamptz not null default now()
);

create index if not exists chat_materi_idx on public.chat (materi_id, dibuat_pada);
create index if not exists sesi_waktu_idx  on public.sesi_pomodoro (selesai_pada);

alter table public.materi        enable row level security;
alter table public.sesi_pomodoro enable row level security;
alter table public.chat          enable row level security;

-- Tanpa login, siapa pun yang memegang anon key bisa membaca & menulis.
-- Cukup untuk tahap belajar/pribadi. Sebelum dibagikan ke orang lain, tambahkan login.
drop policy if exists "akses terbuka materi" on public.materi;
create policy "akses terbuka materi" on public.materi        for all to anon using (true) with check (true);
drop policy if exists "akses terbuka sesi" on public.sesi_pomodoro;
create policy "akses terbuka sesi"   on public.sesi_pomodoro for all to anon using (true) with check (true);
drop policy if exists "akses terbuka chat" on public.chat;
create policy "akses terbuka chat"   on public.chat          for all to anon using (true) with check (true);

-- Bucket penyimpanan file (privat; file dibuka lewat link sementara).
insert into storage.buckets (id, name, public)
values ('materi', 'materi', false)
on conflict (id) do nothing;

drop policy if exists "akses terbuka file materi" on storage.objects;
create policy "akses terbuka file materi" on storage.objects
  for all to anon
  using (bucket_id = 'materi') with check (bucket_id = 'materi');

-- ============================================================
-- KALENDER
-- ============================================================
create table if not exists public.acara (
  id          uuid primary key default gen_random_uuid(),
  judul       text not null,
  tanggal     date not null,
  jam_mulai   time,
  jam_selesai time,
  kategori    text not null default 'lainnya' check (kategori in ('tugas', 'ujian', 'belajar', 'lainnya')),
  catatan     text not null default '',
  materi_id   uuid references public.materi on delete set null,
  dibuat_pada timestamptz not null default now()
);

create index if not exists acara_tanggal_idx on public.acara (tanggal);

alter table public.acara enable row level security;
drop policy if exists "akses terbuka acara" on public.acara;
create policy "akses terbuka acara" on public.acara for all to anon using (true) with check (true);

-- ============================================================
-- TO-DO
-- ============================================================
create table if not exists public.todo (
  id          uuid primary key default gen_random_uuid(),
  teks        text not null,
  tenggat     date,
  jam         time,
  selesai     boolean not null default false,
  dibuat_pada timestamptz not null default now()
);

create index if not exists todo_tenggat_idx on public.todo (tenggat);

alter table public.todo enable row level security;
drop policy if exists "akses terbuka todo" on public.todo;
create policy "akses terbuka todo" on public.todo for all to anon using (true) with check (true);

-- ============================================================
-- PENGATURAN (dipakai untuk teks halaman About yang bisa diubah dari aplikasi)
-- ============================================================
create table if not exists public.pengaturan (
  kunci       text primary key,
  nilai       jsonb not null,
  diubah_pada timestamptz not null default now()
);

alter table public.pengaturan enable row level security;
drop policy if exists "akses terbuka pengaturan" on public.pengaturan;
create policy "akses terbuka pengaturan" on public.pengaturan for all to anon using (true) with check (true);
