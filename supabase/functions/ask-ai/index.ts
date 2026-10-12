// Supabase Edge Function: menjawab pertanyaan berdasarkan isi materi memakai Gemini.
// API key Gemini disimpan sebagai secret di server, tidak pernah sampai ke browser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

const MAX_MATERI_CHARS = 600_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json({ error: "GEMINI_API_KEY belum diatur di Supabase secrets." }, 500);
    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.6-flash";

    // Versi tanpa login: cukup anon key (tersedia otomatis di lingkungan Edge Function).
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    const { materi_id, pertanyaan, riwayat = [] } = await req.json();
    if (!materi_id || typeof pertanyaan !== "string" || !pertanyaan.trim()) {
      return json({ error: "materi_id dan pertanyaan wajib diisi." }, 400);
    }

    const { data: materi, error } = await supabase
      .from("materi").select("judul, isi").eq("id", materi_id).single();
    if (error || !materi) return json({ error: "Materi tidak ditemukan." }, 404);
    if (!materi.isi || materi.isi.trim().length < 20) {
      return json({
        error: "Materi ini tidak punya teks yang bisa dibaca (kemungkinan PDF hasil scan).",
      }, 422);
    }

    const system = [
      "Kamu adalah asisten belajar. Jawab pertanyaan pengguna berdasarkan MATERI di bawah.",
      "Aturan:",
      "- Gunakan bahasa yang dipakai pengguna (default: Bahasa Indonesia).",
      "- Utamakan isi materi. Jika memungkinkan, sebutkan nomor halaman, misalnya (hlm. 3).",
      "- Jika jawabannya tidak ada di materi, katakan terus terang, lalu beri penjelasan umum dan tandai bahwa itu di luar materi.",
      "- Jelaskan singkat dan jelas, cocok untuk pelajar.",
      "",
      `JUDUL MATERI: ${materi.judul}`,
      "ISI MATERI:",
      materi.isi.slice(0, MAX_MATERI_CHARS),
    ].join("\n");

    // Riwayat percakapan: maksimal 10 pesan terakhir, harus diawali pesan user.
    const hist = (Array.isArray(riwayat) ? riwayat : [])
      .slice(-10)
      .filter((m) => m && (m.peran === "user" || m.peran === "model") && typeof m.isi === "string")
      .map((m) => ({ role: m.peran, parts: [{ text: m.isi.slice(0, 4000) }] }));
    while (hist.length && hist[0].role !== "user") hist.shift();

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [...hist, { role: "user", parts: [{ text: pertanyaan.slice(0, 4000) }] }],
          generationConfig: { temperature: 0.3 },
        }),
      },
    );

    if (res.status === 429) {
      return json({ error: "Batas pemakaian Gemini tercapai. Coba lagi sebentar." }, 429);
    }
    if (!res.ok) {
      const detail = await res.text();
      console.error("Gemini error", res.status, detail);
      return json({ error: `Gemini menolak permintaan (${res.status}). Periksa API key dan nama model.` }, 502);
    }

    const data = await res.json();
    const jawaban = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "").join("").trim();
    if (!jawaban) return json({ error: "Gemini tidak mengembalikan jawaban. Coba ulangi pertanyaan." }, 502);

    return json({ jawaban });
  } catch (e) {
    console.error(e);
    return json({ error: "Terjadi kesalahan di server." }, 500);
  }
});
