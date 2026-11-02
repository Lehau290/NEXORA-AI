// ============================================================
// NEXORA AI - Chat History Module
// ============================================================

const History = {
  conversations: [],
  searchKeyword: "",
  selectedAgentId: "all",

  async init() {
    await this.loadConversations();
    this.bindEvents();
  },

  bindEvents() {
    const searchInput = document.getElementById("history-search-input");
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = "true";
      searchInput.addEventListener("input", (e) => {
        this.searchKeyword = e.target.value.toLowerCase().trim();
        this.renderList();
      });
    }
  },

  async loadConversations() {
    try {
      const res = await API.get("/api/chat/conversations");
      this.conversations = res.conversations || [];
      this.renderList();
    } catch (e) {
      console.error(e);
    }
  },

  renderList() {
    const container = document.getElementById("history-full-list");
    if (!container) return;

    let filtered = this.conversations;
    if (this.searchKeyword) {
      filtered = filtered.filter(c => c.title.toLowerCase().includes(this.searchKeyword) || (c.last_message || "").toLowerCase().includes(this.searchKeyword));
    }

    if (!filtered.length) {
      container.innerHTML = `
        <div class="p-12 text-center text-slate-500 text-xs">
          <i data-lucide="message-square-off" class="w-10 h-10 mx-auto mb-2 opacity-40"></i>
          Không tìm thấy lịch sử cuộc trò chuyện nào.
        </div>
      `;
      lucide.createIcons();
      return;
    }

    container.innerHTML = filtered.map(c => `
      <div class="p-4 rounded-2xl bg-[#151923] border border-white/5 hover:border-[#7C5CFC]/30 transition-all flex items-center justify-between group mb-3">
        <div class="flex items-center gap-3.5 min-w-0 flex-1 pr-4 cursor-pointer" onclick="window.location.hash='#/chat?conv_id=${c.id}'">
          <div class="w-10 h-10 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center text-xl flex-shrink-0">
            ${c.agent_avatar || "🤖"}
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <h4 class="text-sm font-bold text-slate-100 group-hover:text-[#7C5CFC] transition-colors truncate">${escapeHtml(c.title)}</h4>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-[#22D3EE]">${escapeHtml(c.agent_name)}</span>
            </div>
            <p class="text-xs text-slate-400 truncate">${escapeHtml(c.last_message || "Chưa có tin nhắn.")}</p>
          </div>
        </div>

        <div class="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
          <span class="text-[11px] text-slate-500 mr-2">${c.updated_at?.split(" ")[0] || ""}</span>
          <button onclick="History.renameConversation(${c.id}, '${escapeHtml(c.title)}')" class="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Đổi tên">
            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="History.deleteConversation(${c.id})" class="p-2 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400" title="Xóa">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `).join("");

    lucide.createIcons();
  },

  async renameConversation(convId, oldTitle) {
    const newTitle = prompt("Nhập tiêu đề mới cho cuộc trò chuyện:", oldTitle);
    if (!newTitle || newTitle.trim() === oldTitle) return;

    try {
      await API.post(`/api/chat/conversations/${convId}/rename`, { title: newTitle.trim() });
      showToast("Đã đổi tên cuộc trò chuyện!", "success");
      await this.loadConversations();
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  async deleteConversation(convId) {
    if (!confirm("Bạn có chắc chắn muốn xóa cuộc trò chuyện này?")) return;
    try {
      await API.delete(`/api/chat/conversations/${convId}/delete`);
      showToast("Đã xóa cuộc trò chuyện.", "success");
      await this.loadConversations();
    } catch (e) {
      showToast(e.message, "error");
    }
  }
};

