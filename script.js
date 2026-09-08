/* ==========================================
   1. KONFIGURASI SUPABASE & GEMINI API
   ========================================== */
// Ganti kredensial berikut sesuai dengan proyek Supabase & Gemini Anda
const SUPABASE_URL = "https://zrapgaldqezpnhlnxnvm.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyYXBnYWxkcWV6cG5obG54bnZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MDc5MzksImV4cCI6MjEwMzk4MzkzOX0.gfJDHJmt22MuqEgVr6JiXBwdblWhiQt9kBla4EmjrmI"; 
const BUCKET_NAME = "materi-files";
const GEMINI_API_KEY = "AQ.Ab8RN6JrgYVCz9jlA_YfDUBmnfgw8rjP8tCicCJyrutGUqVnBQ"; 

document.addEventListener("DOMContentLoaded", () => {
  fetchMaterialsList();
  renderTasks();
  updatePomodoroDisplay();
});

/* ==========================================
   2. HELPER & UTILITIES
   ========================================== */
function escapeHtml(str) {
  return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function updateProgress(percent, barElement, textElement) {
  if (barElement) barElement.style.width = percent + "%";
  if (textElement) textElement.textContent = percent + "%";
}

/* ==========================================
   3. MEMUAT & MENAMPILKAN DATA MATERI
   ========================================== */
async function fetchMaterialsList() {
  const dashboardList = document.getElementById("context-file-items");
  const tableBody = document.getElementById("materi-list-body");

  try {
    // Timeout 5 detik agar tidak memicu pemuatan tanpa akhir (stuck)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/materials?select=*&order=created_at.desc`, {
      headers: { 
        "apikey": SUPABASE_ANON_KEY, 
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}` 
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP ${res.status}: Gagal terhubung ke Supabase.`);

    const materials = await res.json();

    // Render di Dashboard Side Panel
    if (dashboardList) {
      if (!Array.isArray(materials) || materials.length === 0) {
        dashboardList.innerHTML = "<li>Belum ada file tersimpan.</li>";
      } else {
        dashboardList.innerHTML = materials.map(m => 
          `<li>📄 ${escapeHtml(m.file_name)} (${m.file_size || 'N/A'})</li>`
        ).join("");
      }
    }

    // Render Tabel Halaman Materi
    if (tableBody) {
      if (!Array.isArray(materials) || materials.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='3' class='text-center'>Belum ada dokumen tersimpan.</td></tr>";
      } else {
        tableBody.innerHTML = materials.map(m => {
          const targetUrl = m.file_url || m.url || m.file_path || m.path || '';
          const safeName = escapeHtml(m.file_name).replace(/'/g, "\\'");

          return `
            <tr>
              <td>📄 ${escapeHtml(m.file_name)}</td>
              <td>${m.file_size || '-'}</td>
              <td>
                <button onclick="openPdfViewer('${targetUrl}', '${safeName}')" class="btn btn-primary btn-sm">Baca PDF</button>
                ${targetUrl ? `<a href="${targetUrl}" target="_blank" class="btn btn-secondary btn-sm" download>Unduh</a>` : ''}
              </td>
            </tr>
          `;
        }).join("");
      }
    }

  } catch (e) {
    console.error("Gagal memuat materi:", e);

    if (dashboardList) {
      dashboardList.innerHTML = `<li style="color: #ef4444;">⚠️ Gagal memuat data (Periksa API Key / Koneksi).</li>`;
    }
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="3" class="text-center" style="color: #ef4444;">⚠️ Gagal terhubung ke database.</td></tr>`;
    }
  }
}

/* ==========================================
   4. MODAL PDF VIEWER
   ========================================== */
function openPdfViewer(url, name) {
  const modal = document.getElementById("pdfModal");
  const frame = document.getElementById("pdfFrame");
  const title = document.getElementById("pdfTitle");
  const ext = document.getElementById("pdfExternalLink");

  if (!url || url === 'undefined' || url === 'null' || url.trim() === '') {
    alert("URL file tidak valid atau belum terunggah dengan benar.");
    return;
  }

  const cleanUrl = url.trim();

  if (modal && frame) {
    if (title) title.textContent = name || "Dokumen PDF";
    if (ext) ext.href = cleanUrl;

    // Gunakan Google Docs Viewer sebagai renderer fallback yang stabil
    frame.src = `https://docs.google.com/gview?url=${encodeURIComponent(cleanUrl)}&embedded=true`;
    modal.style.display = "flex";
  } else {
    window.open(cleanUrl, "_blank");
  }
}

function closePdfViewer() {
  const modal = document.getElementById("pdfModal");
  const frame = document.getElementById("pdfFrame");
  if (modal && frame) {
    frame.src = "about:blank";
    modal.style.display = "none";
  }
}

/* ==========================================
   5. UNGGAH FILE KE SUPABASE STORAGE
   ========================================== */
async function processFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const status = document.getElementById("file-upload-status");
  const pContainer = document.getElementById("progress-container");
  const pBar = document.getElementById("progress-bar");
  const pPercent = document.getElementById("progress-percent");

  if (status) status.textContent = `Mengunggah: ${file.name}...`;
  if (pContainer) pContainer.style.display = "block";

  try {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `uploads/${Date.now()}_${cleanFileName}`;

    updateProgress(30, pBar, pPercent);

    // 1. Upload ke Storage
    const upRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${filePath}`, {
      method: "POST",
      headers: {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    });

    if (!upRes.ok) {
      const errData = await upRes.json().catch(() => ({}));
      throw new Error(errData.message || "Pastikan Bucket 'materi-files' sudah dibuat, diatur Public, dan memuat Policy INSERT/SELECT.");
    }

    updateProgress(70, pBar, pPercent);

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${filePath}`;
    const sizeFormatted = (file.size / (1024 * 1024)).toFixed(2) + " MB";

    // 2. Simpan URL ke Tabel Database
    const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        file_name: file.name,
        file_size: sizeFormatted,
        file_url: publicUrl,
        content_summary: `Dokumen ${file.name} telah berhasil diunggah.`
      })
    });

    if (!dbRes.ok) throw new Error("Gagal menyimpan metadata file ke tabel database.");

    updateProgress(100, pBar, pPercent);
    if (status) status.textContent = `✅ Berhasil diunggah: ${file.name}`;
    
    fetchMaterialsList();
  } catch (err) {
    alert("Proses Upload Gagal: " + err.message);
    if (status) status.textContent = "❌ Unggah gagal.";
  } finally {
    setTimeout(() => { 
      if (pContainer) pContainer.style.display = "none"; 
    }, 2000);
  }
}

/* ==========================================
   6. AI ASSISTANT (GEMINI INTEGRATION)
   ========================================== */
async function handleAiChat(e) {
  e.preventDefault();
  const input = document.getElementById("ai-input");
  const query = input ? input.value.trim() : "";
  if (!query) return;

  appendMessage("user", query);
  if (input) input.value = "";

  const loadingId = appendMessage("ai", "⏳ Membaca konteks materi & menyusun jawaban...");

  try {
    const context = await fetchMaterialsContext();
    const aiAnswer = await queryGemini(query, context);
    updateMessage(loadingId, aiAnswer);
  } catch (err) {
    updateMessage(loadingId, "⚠️ Kesalahan AI: " + err.message);
  }
}

async function fetchMaterialsContext() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/materials?select=file_name,content_summary`, {
      headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.map(m => `Dokumen: ${m.file_name}\nRangkuman: ${m.content_summary || ''}`).join("\n\n");
  } catch { return ""; }
}

async function queryGemini(prompt, context) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    return "Harap atur GEMINI_API_KEY di script.js terlebih dahulu.";
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const fullPrompt = `Gunakan konteks materi berikut untuk menjawab pertanyaan pengguna:\n\n${context}\n\nPertanyaan: ${prompt}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: fullPrompt }] }] })
  });

  const data = await res.json();
  return data.candidates[0].content.parts[0].text;
}

function appendMessage(role, text) {
  const box = document.getElementById("chat-box");
  if (!box) return;
  const msgId = "msg-" + Date.now();
  const isUser = role === "user";

  const html = `
    <div id="${msgId}" class="chat-message ${isUser ? 'user' : 'ai'}">
      ${!isUser ? '<div class="avatar">AI</div>' : ''}
      <div class="message-content">${escapeHtml(text)}</div>
    </div>
  `;
  box.insertAdjacentHTML("beforeend", html);
  box.scrollTop = box.scrollHeight;
  return msgId;
}

function updateMessage(id, text) {
  const el = document.getElementById(id);
  if (el) el.querySelector(".message-content").textContent = text;
}

/* ==========================================
   7. TASK MANAGER & POMODORO TIMER
   ========================================== */
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

function addTask() {
  const input = document.getElementById("task-input");
  if (!input || !input.value.trim()) return;
  tasks.push({ text: input.value.trim(), done: false });
  input.value = "";
  saveTasks();
}

function toggleTask(i) { tasks[i].done = !tasks[i].done; saveTasks(); }
function deleteTask(i) { tasks.splice(i, 1); saveTasks(); }

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
  renderTasks();
}

function renderTasks() {
  const list = document.getElementById("task-list");
  if (!list) return;
  list.innerHTML = tasks.length === 0 ? "<p class='subtitle'>Belum ada tugas.</p>" :
    tasks.map((t, i) => `
      <div class="task-item">
        <div>
          <input type="checkbox" ${t.done ? "checked" : ""} onchange="toggleTask(${i})">
          <span style="${t.done ? 'text-decoration: line-through;' : ''}">${escapeHtml(t.text)}</span>
        </div>
        <button onclick="deleteTask(${i})" class="btn-icon">🗑️</button>
      </div>
    `).join("");
}

let pomoTime = 25 * 60, pomoTimer = null, isRunning = false;

function togglePomodoro() {
  const btn = document.getElementById("pomo-btn");
  if (isRunning) {
    clearInterval(pomoTimer); 
    isRunning = false;
    if (btn) btn.textContent = "Start";
  } else {
    isRunning = true;
    if (btn) btn.textContent = "Pause";
    pomoTimer = setInterval(() => {
      if (pomoTime > 0) { 
        pomoTime--; 
        updatePomodoroDisplay(); 
      } else { 
        clearInterval(pomoTimer); 
        alert("Sesi Pomodoro Selesai!"); 
        resetPomodoro(); 
      }
    }, 1000);
  }
}

function resetPomodoro() {
  clearInterval(pomoTimer); 
  isRunning = false; 
  pomoTime = 25 * 60;
  updatePomodoroDisplay();
  const btn = document.getElementById("pomo-btn");
  if (btn) btn.textContent = "Start";
}

function updatePomodoroDisplay() {
  const el = document.getElementById("timer-display");
  if (!el) return;
  const m = Math.floor(pomoTime / 60), s = pomoTime % 60;
  el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}