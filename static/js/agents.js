// ============================================================
// NEXORA AI - AI Agents Library Module
// ============================================================

const Agents = {
  allAgents: [],
  categories: [],
  selectedCategory: "all",
  searchKeyword: "",

  async init() {
    await this.loadCategories();
    await this.loadAgents();
    this.bindEvents();
  },

  bindEvents() {
    const searchInput = document.getElementById("agents-search-input");
    if (searchInput && !searchInput.dataset.bound) {
      searchInput.dataset.bound = "true";
      searchInput.addEventListener("input", (e) => {
        this.searchKeyword = e.target.value.toLowerCase().trim();
        this.renderAgents();
      });
    }
  },

  async loadCategories() {
    try {
      const res = await API.get("/api/agents/categories");
      this.categories = res.categories || [];
      this.renderCategoryTabs();
    } catch (e) {
      console.error("Failed to load categories:", e);
    }
  },

  async loadAgents() {
    try {
      const res = await API.get("/api/agents");
      this.allAgents = res.agents || [];
      this.renderAgents();
    } catch (e) {
      console.error("Failed to load agents:", e);
    }
  },

  renderCategoryTabs() {
    const container = document.getElementById("agents-category-tabs");
    if (!container) return;

    let html = `
      <button onclick="Agents.filterCategory('all')" 
        class="category-tab px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${this.selectedCategory === 'all' ? 'bg-[#7C5CFC] text-white shadow-lg shadow-[#7C5CFC]/25' : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/5'}">
        Tất cả (${this.allAgents.length})
      </button>
    `;

    this.categories.forEach(cat => {
      const count = this.allAgents.filter(a => a.category_slug === cat.slug).length;
      const isActive = this.selectedCategory === cat.slug;
      html += `
        <button onclick="Agents.filterCategory('${cat.slug}')" 
          class="category-tab px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${isActive ? 'bg-[#7C5CFC] text-white shadow-lg shadow-[#7C5CFC]/25' : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/5'}">
          ${cat.name} (${count})
        </button>
      `;
    });

    container.innerHTML = html;
  },

  filterCategory(slug) {
    this.selectedCategory = slug;
    this.renderCategoryTabs();
    this.renderAgents();
  },

  renderAgents() {
    const container = document.getElementById("agents-grid");
    if (!container) return;

    let filtered = this.allAgents;

    if (this.selectedCategory !== "all") {
      filtered = filtered.filter(a => a.category_slug === this.selectedCategory);
    }

    if (this.searchKeyword) {
      filtered = filtered.filter(a => 
        a.name.toLowerCase().includes(this.searchKeyword) ||
        a.description.toLowerCase().includes(this.searchKeyword) ||
        a.expertise.toLowerCase().includes(this.searchKeyword)
      );
    }

    if (!filtered.length) {
      container.innerHTML = `
        <div class="col-span-full py-16 text-center text-slate-500">
          <i data-lucide="bot-off" class="w-12 h-12 mx-auto mb-3 opacity-40"></i>
          <p class="text-sm">Không tìm thấy AI Agent phù hợp với từ khóa của bạn.</p>
        </div>
      `;
      lucide.createIcons();
      return;
    }

    container.innerHTML = filtered.map(agent => `
      <div class="agent-card group relative p-6 rounded-2xl bg-[#151923] border border-white/5 hover:border-[#7C5CFC]/40 transition-all duration-300 flex flex-col justify-between hover:shadow-2xl hover:shadow-[#7C5CFC]/10 hover:-translate-y-1">
        <div>
          <!-- Header -->
          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#7C5CFC]/20 to-[#22D3EE]/20 border border-[#7C5CFC]/30 flex items-center justify-center text-3xl shadow-inner group-hover:scale-105 transition-transform">
              ${agent.avatar || "🤖"}
            </div>
            <div class="flex items-center gap-1.5">
              <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Online
              </span>
              <button onclick="Agents.toggleFavorite(${agent.id}, this)" class="p-2 rounded-xl bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors">
                <i data-lucide="star" class="w-4 h-4 ${agent.is_favorite ? 'fill-amber-400 text-amber-400' : ''}"></i>
              </button>
            </div>
          </div>

          <!-- Title & Badges -->
          <h3 class="text-lg font-bold text-slate-100 group-hover:text-[#7C5CFC] transition-colors mb-1.5">
            ${escapeHtml(agent.name)}
          </h3>
          <p class="text-xs font-medium text-[#22D3EE] mb-3">
            ${escapeHtml(agent.role_desc || agent.category_name || "Trợ lý AI")}
          </p>

          <p class="text-xs text-slate-400 line-clamp-3 mb-4 leading-relaxed">
            ${escapeHtml(agent.description)}
          </p>

          <!-- Expertise Tags -->
          <div class="flex flex-wrap gap-1.5 mb-6">
            ${(agent.expertise || "").split(",").slice(0, 3).map(tag => `
              <span class="px-2 py-0.5 rounded-md text-[10px] bg-slate-900/80 text-slate-300 border border-white/5">
                ${escapeHtml(tag.trim())}
              </span>
            `).join("")}
          </div>
        </div>

        <!-- Actions -->
        <div class="pt-4 border-t border-white/5 flex items-center gap-2">
          <button onclick="Agents.startChat(${agent.id})" class="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#7C5CFC] to-[#6845f5] hover:from-[#6845f5] hover:to-[#5532e8] text-white text-xs font-semibold transition-all shadow-md flex items-center justify-center gap-2 group-hover:shadow-lg group-hover:shadow-[#7C5CFC]/25">
            <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
            <span>Bắt đầu Chat</span>
          </button>
          <button onclick="Agents.viewDetails(${agent.id})" class="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/5 transition-colors" title="Xem chi tiết Agent">
            <i data-lucide="info" class="w-4 h-4"></i>
          </button>
        </div>
      </div>
    `).join("");

    lucide.createIcons();
  },

  async toggleFavorite(agentId, btn) {
    try {
      const res = await API.post("/api/favorites/toggle", {
        target_type: "agent",
        target_id: agentId
      });
      const icon = btn.querySelector("i");
      if (res.is_favorite) {
        icon.classList.add("fill-amber-400", "text-amber-400");
        showToast("Đã thêm Agent vào mục yêu thích!", "success");
      } else {
        icon.classList.remove("fill-amber-400", "text-amber-400");
        showToast("Đã bỏ yêu thích Agent.", "info");
      }
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  viewDetails(agentId) {
    const agent = this.allAgents.find(a => a.id === agentId);
    if (!agent) return;

    const modal = document.getElementById("agent-details-modal");
    const content = document.getElementById("agent-details-content");
    if (!modal || !content) return;

    content.innerHTML = `
      <div class="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#7C5CFC]/20 to-[#22D3EE]/20 border border-[#7C5CFC]/30 flex items-center justify-center text-4xl shadow-xl">
          ${agent.avatar || "🤖"}
        </div>
        <div>
          <h2 class="text-xl font-bold text-slate-100">${escapeHtml(agent.name)}</h2>
          <p class="text-xs text-[#22D3EE] font-medium">${escapeHtml(agent.role_desc)}</p>
          <span class="inline-block mt-1 text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">Mô hình: ${agent.ai_model}</span>
        </div>
      </div>

      <div class="space-y-4 text-xs text-slate-300">
        <div>
          <h4 class="font-semibold text-slate-400 mb-1">MÔ TẢ VAI TRÒ</h4>
          <p class="text-slate-300 leading-relaxed">${escapeHtml(agent.description)}</p>
        </div>

        <div>
          <h4 class="font-semibold text-slate-400 mb-1">CHUYÊN MÔN CỐT LÕI</h4>
          <p class="text-slate-300 leading-relaxed">${escapeHtml(agent.expertise)}</p>
        </div>

        <div>
          <h4 class="font-semibold text-slate-400 mb-1">HƯỚNG DẪN HỆ THỐNG (SYSTEM INSTRUCTIONS)</h4>
          <div class="p-3 rounded-xl bg-slate-900 border border-white/5 font-mono text-[11px] text-slate-400 max-h-36 overflow-y-auto whitespace-pre-wrap">
            ${escapeHtml(agent.system_instructions)}
          </div>
        </div>

        <div>
          <h4 class="font-semibold text-slate-400 mb-1">PHONG CÁCH PHẢN HỒI</h4>
          <p class="text-slate-300">${escapeHtml(agent.response_tone || "Chuyên nghiệp, chính xác")}</p>
        </div>
      </div>

      <div class="mt-8 pt-4 border-t border-white/10 flex justify-end gap-3">
        <button onclick="closeModal('agent-details-modal')" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300">
          Đóng
        </button>
        <button onclick="closeModal('agent-details-modal'); Agents.startChat(${agent.id})" class="px-5 py-2 rounded-xl bg-gradient-to-r from-[#7C5CFC] to-[#22D3EE] text-white text-xs font-semibold shadow-lg shadow-[#7C5CFC]/25 flex items-center gap-2">
          <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
          <span>Bắt đầu trò chuyện ngay</span>
        </button>
      </div>
    `;

    openModal("agent-details-modal");
    lucide.createIcons();
  },

  startChat(agentId) {
    window.location.hash = `#/chat?agent_id=${agentId}`;
  }
};

