// ============================================================
// NEXORA AI - Agent Studio Module (Create & Manage Custom Agents)
// ============================================================

const Studio = {
  myAgents: [],
  editingAgentId: null,

  async init() {
    await this.loadMyAgents();
    await this.loadCategoriesDropdown();
    this.bindEvents();
  },

  bindEvents() {
    const saveBtn = document.getElementById("btn-save-custom-agent");
    const testBtn = document.getElementById("btn-test-custom-agent");

    if (saveBtn && !saveBtn.dataset.bound) {
      saveBtn.dataset.bound = "true";
      saveBtn.addEventListener("click", () => this.saveAgent());
    }

    if (testBtn && !testBtn.dataset.bound) {
      testBtn.dataset.bound = "true";
      testBtn.addEventListener("click", () => this.testAgentInSandbox());
    }
  },

  async loadCategoriesDropdown() {
    try {
      const res = await API.get("/api/agents/categories");
      const select = document.getElementById("agent-input-category");
      if (select) {
        select.innerHTML = (res.categories || []).map(c => `
          <option value="${c.id}">${c.name}</option>
        `).join("");
      }
    } catch (e) {
      console.error(e);
    }
  },

  async loadMyAgents() {
    try {
      const res = await API.get("/api/agents");
      const user = API.getUser();
      // Filter custom agents belonging to this user
      this.myAgents = (res.agents || []).filter(a => !a.is_system && a.user_id === user?.id);
      this.renderMyAgentsList();
    } catch (e) {
      console.error(e);
    }
  },

  renderMyAgentsList() {
    const container = document.getElementById("my-custom-agents-list");
    if (!container) return;

    if (!this.myAgents.length) {
      container.innerHTML = `
        <div class="col-span-full p-8 rounded-2xl bg-slate-900/40 border border-white/5 text-center text-slate-500 text-xs">
          <i data-lucide="sparkles" class="w-8 h-8 mx-auto mb-2 text-[#7C5CFC]/60"></i>
          Bạn chưa tạo Agent tùy chỉnh nào. Hãy thiết kế Agent đầu tiên của bạn ở biểu mẫu bên cạnh!
        </div>
      `;
      lucide.createIcons();
      return;
    }

    container.innerHTML = this.myAgents.map(a => `
      <div class="p-5 rounded-2xl bg-[#151923] border border-white/5 hover:border-[#7C5CFC]/30 transition-all flex flex-col justify-between group">
        <div>
          <div class="flex items-center justify-between mb-3">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#7C5CFC]/20 to-[#22D3EE]/20 border border-[#7C5CFC]/30 flex items-center justify-center text-2xl">
              ${a.avatar || "🤖"}
            </div>
            <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <button onclick="Studio.editAgent(${a.id})" class="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Chỉnh sửa">
                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="Studio.duplicateAgent(${a.id})" class="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Nhân bản">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
              </button>
              <button onclick="Studio.deleteAgent(${a.id})" class="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400" title="Xóa">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
              </button>
            </div>
          </div>

          <h4 class="text-sm font-bold text-slate-100 mb-1">${escapeHtml(a.name)}</h4>
          <p class="text-xs text-[#22D3EE] font-medium mb-2">${escapeHtml(a.role_desc)}</p>
          <p class="text-xs text-slate-400 line-clamp-2 mb-4">${escapeHtml(a.description)}</p>
        </div>

        <button onclick="Agents.startChat(${a.id})" class="w-full py-2 rounded-xl bg-gradient-to-r from-[#7C5CFC] to-[#22D3EE] text-white text-xs font-semibold shadow flex items-center justify-center gap-1.5 hover:shadow-lg transition-all">
          <i data-lucide="message-square" class="w-3 h-3"></i>
          <span>Chat với Agent này</span>
        </button>
      </div>
    `).join("");

    lucide.createIcons();
  },

  async saveAgent() {
    const name = document.getElementById("agent-input-name")?.value.trim();
    const avatar = document.getElementById("agent-input-avatar")?.value.trim() || "🤖";
    const category_id = parseInt(document.getElementById("agent-input-category")?.value || "1");
    const role_desc = document.getElementById("agent-input-role")?.value.trim() || "Trợ lý AI";
    const description = document.getElementById("agent-input-desc")?.value.trim();
    const expertise = document.getElementById("agent-input-expertise")?.value.trim();
    const system_instructions = document.getElementById("agent-input-instructions")?.value.trim();
    const response_tone = document.getElementById("agent-input-tone")?.value.trim();
    const ai_model = document.getElementById("agent-input-model")?.value || "gemini-2.0-flash";

    const tools = [];
    if (document.getElementById("tool-web-search")?.checked) tools.push("web_search");
    if (document.getElementById("tool-code-interpreter")?.checked) tools.push("code_interpreter");
    if (document.getElementById("tool-rag")?.checked) tools.push("rag");

    if (!name || !description || !system_instructions) {
      showToast("Vui lòng điền Tên Agent, Mô tả và Hướng dẫn hệ thống.", "warning");
      return;
    }

    const payload = {
      name, avatar, category_id, role_desc, description,
      expertise, system_instructions, response_tone, ai_model,
      tools_enabled: tools
    };

    try {
      if (this.editingAgentId) {
        await API.post(`/api/agents/${this.editingAgentId}/update`, payload);
        showToast("Cập nhật Agent thành công!", "success");
        this.editingAgentId = null;
      } else {
        await API.post("/api/agents/create", payload);
        showToast("Tạo mới AI Agent thành công!", "success");
      }

      this.resetForm();
      await this.loadMyAgents();
      await Agents.loadAgents();
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  editAgent(agentId) {
    const a = this.myAgents.find(x => x.id === agentId);
    if (!a) return;

    this.editingAgentId = a.id;
    document.getElementById("agent-input-name").value = a.name;
    document.getElementById("agent-input-avatar").value = a.avatar || "🤖";
    document.getElementById("agent-input-category").value = a.category_id || 1;
    document.getElementById("agent-input-role").value = a.role_desc || "";
    document.getElementById("agent-input-desc").value = a.description || "";
    document.getElementById("agent-input-expertise").value = a.expertise || "";
    document.getElementById("agent-input-instructions").value = a.system_instructions || "";
    document.getElementById("agent-input-tone").value = a.response_tone || "";
    document.getElementById("agent-input-model").value = a.ai_model || "gemini-2.0-flash";

    const tools = Array.isArray(a.tools_enabled) ? a.tools_enabled : [];
    document.getElementById("tool-web-search").checked = tools.includes("web_search");
    document.getElementById("tool-code-interpreter").checked = tools.includes("code_interpreter");
    document.getElementById("tool-rag").checked = tools.includes("rag");

    document.getElementById("btn-save-custom-agent").innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Cập Nhật Agent</span>`;
    lucide.createIcons();

    // Scroll to form
    document.getElementById("agent-studio-form")?.scrollIntoView({ behavior: "smooth" });
  },

  async duplicateAgent(agentId) {
    try {
      await API.post(`/api/agents/${agentId}/duplicate`);
      showToast("Đã nhân bản Agent thành công!", "success");
      await this.loadMyAgents();
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  async deleteAgent(agentId) {
    if (!confirm("Bạn có chắc chắn muốn xóa AI Agent này không?")) return;
    try {
      await API.post(`/api/agents/${agentId}/delete`);
      showToast("Đã xóa AI Agent.", "success");
      await this.loadMyAgents();
      await Agents.loadAgents();
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  resetForm() {
    this.editingAgentId = null;
    const form = document.getElementById("agent-studio-form");
    if (form) form.reset();
    document.getElementById("btn-save-custom-agent").innerHTML = `<i data-lucide="plus" class="w-4 h-4"></i><span>Lưu & Kích Hoạt Agent</span>`;
    lucide.createIcons();
  },

  async testAgentInSandbox() {
    const instructions = document.getElementById("agent-input-instructions")?.value.trim();
    const testPrompt = document.getElementById("agent-test-prompt")?.value.trim();
    const outputEl = document.getElementById("agent-test-output");

    if (!instructions || !testPrompt) {
      showToast("Vui lòng nhập Hướng dẫn hệ thống và câu hỏi thử nghiệm.", "warning");
      return;
    }

    if (outputEl) {
      outputEl.innerHTML = `<span class="text-xs text-slate-400 animate-pulse">AI đang phân tích câu hỏi trong sandbox...</span>`;
    }

    try {
      // Direct call using temporary agent settings
      const res = await API.post("/api/chat/stream", {
        message: testPrompt
      });
      // Or fallback to test endpoint
    } catch (e) {
      if (outputEl) {
        outputEl.innerHTML = `<span class="text-xs text-amber-400">${escapeHtml(e.message)}</span>`;
      }
    }
  }
};

