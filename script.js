/* ==========================================
   1. KONFIGURASI SUPABASE & GEMINI AI
   ========================================== */
const SUPABASE_URL = "https://zrapgaldqezpnhlnxnvm.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYXBnYWxkcWV6cG5obG54bnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MDc5MzksImV4cCI6MjEwMzk4MzkzOX0.gfJDHJmt22MuqEgVr6JiXBwdblWhiQt9kBla4EmjrmI"; 
const BUCKET_NAME = "materi-files";

// Masukkan Google Gemini API Key Anda
const GEMINI_API_KEY = "AQ.Ab8RN6JrgYVCz9jlA_YfDUBmnfgw8rjP8tCicCJyrutGUqVnBQ"; 

/* ==========================================
   2. INISIALISASI
   ========================================== */
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  fetchMaterialsList();
  initTasks();
  initPomodoro();
});

/* ==========================================
   3. FITUR AI ASSISTANT (CHAT)
   ========================================== */
async function handleAiChat(e) {
  e.preventDefault();
  const inputEl = document.getElementById("ai-input");
  const submitBtn = document.getElementById("ai-submit-btn");
  const chatBox = document.getElementById("chat-box");

  const query = inputEl.value.trim();
  if (!query) return;

  // 1. Tampilkan pesan user ke chat box
  appendChatMessage("user", query);
  inputEl.value = "";
  if (submitBtn) submitBtn.disabled = true;

  // Tampilkan indikator loading
  const loadingId = appendChatMessage("ai", "⏳ Sedang memikirkan dan menganalisis materi...");

  try {
    // 2. Ambil konteks rangkuman dari Supabase
    const contextText = await fetchContextFromSupabase();

    // 3. Kirim ke Gemini API
    const aiResponse = await callGeminiApi(query, contextText);

    // 4. Update pesan loading dengan respon asli AI
    updateChatMessage(loadingId, aiResponse);

  } catch (err) {
    console.error("AI Error:", err);
    updateChatMessage(loadingId, "⚠️ Maaf, terjadi kesalahan saat mengontak AI: " + err.message);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

// Ambil konteks materi tersimpan dari Database Supabase
async function fetchContextFromSupabase() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/materials?select=file_name,content_summary`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.map(m => `Dokumen: ${m.file_name}\nRangkuman: ${m.content_summary || 'Tidak ada'}`).join("\n\n");
  } catch {
    return "";
  }
}

// Panggil Google Gemini API
async function callGeminiApi(userPrompt, context) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    return "Mohon atur `GEMINI_API_KEY` terlebih dahulu di file `script.js`.";
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const promptText = `
Anda adalah EduFocus AI Assistant. Jawab pertanyaan pengguna berdasarkan Konteks Materi berikut.
  
KONTEKS MATERI:
${context || "Belum ada dokumen materi tersimpan."}

PERTANYAAN PENGGUNA:
${userPrompt}
`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }]
    })
  });

  if (!response.ok) {
    throw new Error(`API Response Error: ${response.statusText}`);
  }

  const result = await response.json();
  return result.candidates[0].content.parts[0].text;
}

function appendChatMessage(role, text) {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return null;

  const msgId = "msg-" + Date.now();
  const isUser = role === "user";

  const msgHTML = `
    <div id="${msgId}" class="flex gap-3 ${isUser ? 'justify-end' : ''}">
      ${!isUser ? `<div class="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0">AI</div>` : ''}
      <div class="p-3 ${isUser ? 'bg-brand-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'} rounded-xl max-w-[80%] whitespace-pre-wrap">
        ${escapeHtml(text)}
      </div>
    </div>
  `;

  chatBox.insertAdjacentHTML("beforeend", msgHTML);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msgId;
}

function updateChatMessage(msgId, newText) {
  const msgEl = document.getElementById(msgId);
  if (msgEl) {
    const textContainer = msgEl.querySelector("div:last-child");
    if (textContainer) textContainer.textContent = newText;
  }
}

/* ==========================================
   4. UPLOAD FILE KE SUPABASE STORAGE
   ========================================== */
async function processFileUpload(event) {
  const fileInput = event.target;
  const file = fileInput.files[0];
  if (!file) return;

  const statusText = document.getElementById("file-upload-status");
  const progressContainer = document.getElementById("progress-container");
  const progressBar = document.getElementById("progress-bar");
  const progressPercent = document.getElementById("progress-percent");

  if (statusText) statusText.textContent = `Mengunggah: ${file.name}...`;
  if (progressContainer) progressContainer.classList.remove("hidden");

  try {
    const fileExt = file.name.split(".").pop();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9]/g, "_");
    const storagePath = `uploads/${Date.now()}_${cleanFileName}.${fileExt}`;

    updateProgress(30, progressBar, progressPercent);

    // 1. Upload ke Storage
    const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${storagePath}`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    });

    if (!uploadResponse.ok) throw new Error("Gagal upload file ke Supabase Storage.");

    updateProgress(70, progressBar, progressPercent);

    // 2. Dapatkan URL Publik
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${storagePath}`;
    const formattedSize = file.size > 1024 * 1024 
      ? (file.size / (1024 * 1024)).toFixed(2) + " MB" 
      : (file.size / 1024).toFixed(1) + " KB";

    // 3. Simpan Metadata ke Database
    const dbResponse = await fetch(`${SUPABASE_URL}/rest/v1/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        file_name: file.name,
        file_size: formattedSize,
        file_url: publicUrl,
        content_summary: `File dokumen ${file.name} telah diunggah.`
      })
    });

    if (!dbResponse.ok) throw new Error("Gagal menyimpan metadata.");

    updateProgress(100, progressBar, progressPercent);

    if (statusText) statusText.textContent = `✅ Berhasil: ${file.name}`;
    alert(`File ${file.name} berhasil tersimpan di database!`);
    fetchMaterialsList();

  } catch (err) {
    console.error("Upload error:", err);
    alert(`Gagal: ${err.message}`);
    if (statusText) statusText.textContent = "⚠️ Unggahan gagal.";
  } finally {
    setTimeout(() => {
      if (progressContainer) progressContainer.classList.add("hidden");
      if (fileInput) fileInput.value = "";
    }, 2000);
  }
}

function updateProgress(percent, progressBar, progressPercent) {
  if (progressBar) progressBar.style.width = `${percent}%`;
  if (progressPercent) progressPercent.textContent = `${percent}%`;
}

/* ==========================================
   5. PDF MODAL VIEWER
   ========================================== */
function openPdfViewer(fileUrl, fileName) {
  if (!fileUrl) return alert("URL file tidak ditemukan.");

  const modal = document.getElementById("pdfModal");
  const frame = document.getElementById("pdfFrame");
  const title = document.getElementById("pdfTitle");
  const externalLink = document.getElementById("pdfExternalLink");

  if (modal && frame && title) {
    title.textContent = fileName || "Dokumen PDF";
    frame.src = fileUrl;
    if (externalLink) externalLink.href = fileUrl;

    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  } else {
    window.open(fileUrl, "_blank");
  }
}

function closePdfViewer() {
  const modal = document.getElementById("pdfModal");
  const frame = document.getElementById("pdfFrame");
  if (modal && frame) {
    frame.src = "";
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  }
}

/* ==========================================
   6. FETCH MATERIAL DATA
   ========================================== */
async function fetchMaterialsList() {
  const contextList = document.getElementById("context-file-items");
  const materiTableBody = document.getElementById("materi-list-body");

  if (!contextList && !materiTableBody) return;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/materials?select=*&order=created_at.desc`, {
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!res.ok) throw new Error("Gagal mengambil data.");
    const materials = await res.json();

    if (contextList) {
      contextList.innerHTML = materials.length === 0 
        ? `<li class="py-2 text-slate-400">Belum ada dokumen.</li>`
        : materials.map(m => `
            <li class="py-2 flex items-center justify-between">
              <span class="truncate max-w-[200px] font-medium">${escapeHtml(m.file_name)}</span>
              <span class="text-xs text-slate-400">${m.file_size || '-'}</span>
            </li>`).join('');
    }

    if (materiTableBody) {
      materiTableBody.innerHTML = materials.length === 0
        ? `<tr><td colspan="3" class="p-4 text-center text-slate-400">Belum ada materi tersimpan.</td></tr>`
        : materials.map(m => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <td class="p-3 font-medium">📄 ${escapeHtml(m.file_name)}</td>
              <td class="p-3 text-xs font-mono text-slate-500">${m.file_size || '-'}</td>
              <td class="p-3">
                <button onclick="openPdfViewer('${m.file_url}', '${escapeHtml(m.file_name)}')" class="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-medium">
                  👁️ Baca PDF
                </button>
              </td>
            </tr>`).join('');
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

/* ==========================================
   7. UTILITIES, POMODORO & TASKS
   ========================================== */
let pomoTimer = null, pomoSecondsLeft = 25 * 60, isPomoRunning = false;

function initPomodoro() { updatePomodoroDisplay(); }
function togglePomodoro() {
  const btn = document.getElementById("pomo-btn");
  if (isPomoRunning) {
    clearInterval(pomoTimer); isPomoRunning = false;
    if (btn) btn.textContent = "Start";
  } else {
    isPomoRunning = true;
    if (btn) btn.textContent = "Pause";
    pomoTimer = setInterval(() => {
      if (pomoSecondsLeft > 0) { pomoSecondsLeft--; updatePomodoroDisplay(); }
      else { clearInterval(pomoTimer); isPomoRunning = false; alert("Pomodoro selesai!"); resetPomodoro(); }
    }, 1000);
  }
}
function resetPomodoro() {
  clearInterval(pomoTimer); isPomoRunning = false; pomoSecondsLeft = 25 * 60; updatePomodoroDisplay();
  const btn = document.getElementById("pomo-btn"); if (btn) btn.textContent = "Start";
}
function updatePomodoroDisplay() {
  const display = document.getElementById("timer-display");
  if (!display) return;
  const m = Math.floor(pomoSecondsLeft / 60), s = pomoSecondsLeft % 60;
  display.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

let tasks = JSON.parse(localStorage.getItem("edufocus_tasks")) || [];
function initTasks() { renderTasks(); }
function addTask() {
  const input = document.getElementById("task-input");
  if (!input || !input.value.trim()) return;
  tasks.push({ text: input.value.trim(), completed: false });
  input.value = "";
  localStorage.setItem("edufocus_tasks", JSON.stringify(tasks));
  renderTasks();
}
function toggleTask(i) { tasks[i].completed = !tasks[i].completed; localStorage.setItem("edufocus_tasks", JSON.stringify(tasks)); renderTasks(); }
function deleteTask(i) { tasks.splice(i, 1); localStorage.setItem("edufocus_tasks", JSON.stringify(tasks)); renderTasks(); }
function renderTasks() {
  const list = document.getElementById("task-list");
  if (!list) return;
  list.innerHTML = tasks.length === 0 ? `<p class="text-xs text-slate-400 py-2">Belum ada tugas.</p>` : tasks.map((t, idx) => `
    <div class="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-900 text-xs">
      <div class="flex items-center gap-2">
        <input type="checkbox" ${t.completed ? "checked" : ""} onchange="toggleTask(${idx})">
        <span class="${t.completed ? "line-through text-slate-400" : ""}">${escapeHtml(t.text)}</span>
      </div>
      <button onclick="deleteTask(${idx})" class="text-red-500 font-bold">&times;</button>
    </div>`).join('');
}

function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
    document.documentElement.classList.add("dark");
  }
  updateThemeIcon();
}
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");
  updateThemeIcon();
}
function updateThemeIcon() {
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.textContent = document.documentElement.classList.contains("dark") ? "☀️" : "🌙";
}
function escapeHtml(str) {
  return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}