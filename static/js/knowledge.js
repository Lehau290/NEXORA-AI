// ============================================================
// NEXORA AI - Knowledge Base & RAG Module
// ============================================================

const Knowledge = {
  documents: [],

  async init() {
    await this.loadDocuments();
    this.bindEvents();
  },

  bindEvents() {
    const fileInput = document.getElementById("kb-file-input");
    const dropZone = document.getElementById("kb-drop-zone");
    const searchBtn = document.getElementById("btn-test-rag-search");

    if (fileInput && !fileInput.dataset.bound) {
      fileInput.dataset.bound = "true";
      fileInput.addEventListener("change", (e) => this.handleUpload(e.target.files));
    }

    if (dropZone && !dropZone.dataset.bound) {
      dropZone.dataset.bound = "true";
      dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.classList.add("border-[#7C5CFC]", "bg-[#7C5CFC]/5");
      });
      dropZone.addEventListener("dragleave", () => {
        dropZone.classList.remove("border-[#7C5CFC]", "bg-[#7C5CFC]/5");
      });
      dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("border-[#7C5CFC]", "bg-[#7C5CFC]/5");
        if (e.dataTransfer.files?.length) {
          this.handleUpload(e.dataTransfer.files);
        }
      });
    }

    if (searchBtn && !searchBtn.dataset.bound) {
      searchBtn.dataset.bound = "true";
      searchBtn.addEventListener("click", () => this.testRAGSearch());
    }
  },

  async loadDocuments() {
    try {
      const res = await API.get("/api/knowledge/documents");
      this.documents = res.documents || [];
      this.renderDocumentList();
    } catch (e) {
      console.error(e);
    }
  },

  renderDocumentList() {
    const container = document.getElementById("kb-documents-list");
    const countBadge = document.getElementById("kb-doc-count-badge");
    if (countBadge) countBadge.textContent = `${this.documents.length} tài liệu`;
    if (!container) return;

    if (!this.documents.length) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-500 text-xs">
          <i data-lucide="folder-open" class="w-8 h-8 mx-auto mb-2 opacity-40"></i>
          Kho kiến thức hiện đang trống. Hãy kéo thả hoặc tải lên tài liệu đầu tiên!
        </div>
      `;
      lucide.createIcons();
      return;
    }

    container.innerHTML = this.documents.map(d => {
      const sizeKb = (d.file_size / 1024).toFixed(1);
      return `
        <div class="p-4 rounded-xl bg-slate-900/60 hover:bg-[#7C5CFC]/10 border border-white/5 hover:border-[#7C5CFC]/30 transition-all flex items-center justify-between group">
          <div class="flex items-center gap-3 min-w-0 pr-4">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7C5CFC]/20 to-[#22D3EE]/20 border border-[#7C5CFC]/30 flex items-center justify-center text-xs font-bold uppercase text-[#22D3EE] flex-shrink-0">
              ${escapeHtml(d.file_type)}
            </div>
            <div class="min-w-0">
              <h4 class="text-xs font-bold text-slate-200 truncate group-hover:text-[#7C5CFC] transition-colors">${escapeHtml(d.original_name)}</h4>
              <div class="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                <span>${sizeKb} KB</span>
                <span>•</span>
                <span class="text-[#22D3EE]">${d.chunk_count || 0} đoạn tri thức (chunks)</span>
                <span>•</span>
                <span>${d.created_at?.split(" ")[0] || ""}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="Knowledge.deleteDocument(${d.id})" class="p-2 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors" title="Xóa tài liệu">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </div>
      `;
    }).join("");

    lucide.createIcons();
  },

  async handleUpload(files) {
    if (!files || !files.length) return;
    const file = files[0];

    showToast(`Đang tải lên & lập chỉ mục RAG: ${file.name}...`, "info");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await API.post("/api/knowledge/upload", formData);
      showToast(res.message, "success");
      await this.loadDocuments();
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  async deleteDocument(docId) {
    if (!confirm("Bạn có chắc chắn muốn xóa tài liệu này khỏi kho tri thức?")) return;
    try {
      await API.delete(`/api/knowledge/documents/${docId}`);
      showToast("Đã xóa tài liệu thành công.", "success");
      await this.loadDocuments();
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  async testRAGSearch() {
    const input = document.getElementById("kb-search-query-input");
    const query = input?.value.trim();
    const resultBox = document.getElementById("kb-search-results");

    if (!query) {
      showToast("Vui lòng nhập câu hỏi hoặc từ khóa tra cứu.", "warning");
      return;
    }

    if (resultBox) {
      resultBox.innerHTML = `<span class="text-xs text-slate-400 animate-pulse">Đang quét kho dữ liệu vector và trích xuất đoạn ngữ nghĩa...</span>`;
    }

    try {
      const res = await API.post("/api/knowledge/search", { query });
      if (!res.results?.length) {
        resultBox.innerHTML = `<span class="text-xs text-slate-500">Không tìm thấy phân đoạn tài liệu phù hợp với truy vấn.</span>`;
        return;
      }

      resultBox.innerHTML = res.results.map((r, i) => `
        <div class="p-3.5 rounded-xl bg-slate-900/90 border border-white/5 mb-2.5">
          <div class="flex items-center justify-between text-[11px] font-semibold text-[#22D3EE] mb-1.5">
            <span>#${i+1} • ${escapeHtml(r.document_name)} (Đoạn ${r.chunk_index})</span>
            <span class="px-2 py-0.5 rounded bg-[#7C5CFC]/20 text-[#c4b5fd]">Độ khớp: ${r.score}</span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">${escapeHtml(r.content)}</p>
        </div>
      `).join("");

    } catch (e) {
      showToast(e.message, "error");
    }
  }
};

