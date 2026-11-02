// ============================================================
// NEXORA AI - Admin Dashboard & System Control Module
// ============================================================

const Admin = {
  users: [],
  chartInstance: null,

  async init() {
    const user = API.getUser();
    if (user?.role !== "admin") {
      showToast("Bạn không có quyền truy cập trang quản trị Admin.", "error");
      window.location.hash = "#/dashboard";
      return;
    }

    await this.loadStats();
    await this.loadUsers();
    await this.loadSettings();
    this.bindEvents();
  },

  bindEvents() {
    const userSearch = document.getElementById("admin-user-search");
    if (userSearch && !userSearch.dataset.bound) {
      userSearch.dataset.bound = "true";
      userSearch.addEventListener("input", (e) => this.filterUsers(e.target.value));
    }

    const settingsForm = document.getElementById("admin-settings-form");
    if (settingsForm && !settingsForm.dataset.bound) {
      settingsForm.dataset.bound = "true";
      settingsForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.saveSettings();
      });
    }
  },

  async loadStats() {
    try {
      const res = await API.get("/api/admin/stats");
      const s = res.stats || {};

      document.getElementById("admin-stat-users").textContent = s.total_users || 0;
      document.getElementById("admin-stat-agents").textContent = s.total_agents || 0;
      document.getElementById("admin-stat-convs").textContent = s.total_conversations || 0;
      document.getElementById("admin-stat-tokens").textContent = (s.total_tokens || 0).toLocaleString();
      document.getElementById("admin-stat-wfs").textContent = s.total_workflows || 0;

      // Render chart
      this.renderChart(res.model_distribution || []);

      // Render recent logs
      this.renderLogs(res.recent_logs || []);
    } catch (e) {
      console.error(e);
    }
  },

  renderChart(distribution) {
    const canvas = document.getElementById("admin-model-chart");
    if (!canvas || typeof Chart === "undefined") return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    const labels = distribution.length ? distribution.map(d => d.model) : ["gemini-2.0-flash", "gpt-4o", "claude-3-5-sonnet"];
    const counts = distribution.length ? distribution.map(d => d.count) : [85, 30, 15];

    this.chartInstance = new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [{
          data: counts,
          backgroundColor: ["#7C5CFC", "#22D3EE", "#38BDF8", "#F59E0B"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#94A3B8", font: { size: 11 } }
          }
        }
      }
    });
  },

  renderLogs(logs) {
    const container = document.getElementById("admin-logs-table-body");
    if (!container) return;

    if (!logs.length) {
      container.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500 text-xs">Chưa có nhật ký hoạt động.</td></tr>`;
      return;
    }

    container.innerHTML = logs.map(l => `
      <tr class="border-b border-white/5 hover:bg-slate-900/40 text-xs text-slate-300">
        <td class="p-3 font-semibold text-slate-200">${escapeHtml(l.username || 'System')}</td>
        <td class="p-3"><span class="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-[#22D3EE] uppercase">${escapeHtml(l.action_type)}</span></td>
        <td class="p-3 text-slate-400 font-mono text-[11px]">${escapeHtml(l.model || 'N/A')}</td>
        <td class="p-3 font-mono text-slate-300">${(l.tokens_out || 0).toLocaleString()}</td>
        <td class="p-3 text-slate-500 text-[11px]">${l.created_at || ''}</td>
      </tr>
    `).join("");
  },

  async loadUsers() {
    try {
      const res = await API.get("/api/admin/users");
      this.users = res.users || [];
      this.renderUsersTable(this.users);
    } catch (e) {
      console.error(e);
    }
  },

  filterUsers(keyword) {
    const kw = keyword.toLowerCase().trim();
    const filtered = this.users.filter(u => 
      u.full_name.toLowerCase().includes(kw) || 
      u.email.toLowerCase().includes(kw) || 
      u.username.toLowerCase().includes(kw)
    );
    this.renderUsersTable(filtered);
  },

  renderUsersTable(userList) {
    const tbody = document.getElementById("admin-users-table-body");
    if (!tbody) return;

    if (!userList.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-500 text-xs">Không tìm thấy người dùng phù hợp.</td></tr>`;
      return;
    }

    tbody.innerHTML = userList.map(u => `
      <tr class="border-b border-white/5 hover:bg-slate-900/50 text-xs text-slate-300 transition-colors">
        <td class="p-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-sm">
              ${u.avatar || "👤"}
            </div>
            <div>
              <div class="font-bold text-slate-100">${escapeHtml(u.full_name)}</div>
              <div class="text-[11px] text-slate-500">@${escapeHtml(u.username)} • ${escapeHtml(u.email)}</div>
            </div>
          </div>
        </td>
        <td class="p-4">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold ${u.role === 'admin' ? 'bg-[#7C5CFC]/20 text-[#7C5CFC] border border-[#7C5CFC]/40' : 'bg-slate-800 text-slate-400'}">
            ${u.role}
          </span>
        </td>
        <td class="p-4">
          <span class="px-2 py-0.5 rounded text-[11px] font-semibold text-[#22D3EE] bg-[#22D3EE]/10">
            ${u.plan || 'Free'}
          </span>
        </td>
        <td class="p-4 font-mono text-[11px] text-slate-400">
          ${(u.tokens_used || 0).toLocaleString()} / ${(u.tokens_limit || 0).toLocaleString()}
        </td>
        <td class="p-4">
          <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${u.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
            <span class="w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-400' : 'bg-rose-400'}"></span>
            ${u.is_active ? 'Hoạt động' : 'Đã khóa'}
          </span>
        </td>
        <td class="p-4 text-right">
          <div class="flex items-center justify-end gap-1.5">
            <button onclick="Admin.toggleUserStatus(${u.id})" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold ${u.is_active ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'} transition-colors">
              ${u.is_active ? 'Khóa' : 'Mở khóa'}
            </button>
            <button onclick="Admin.changeRole(${u.id}, '${u.role === 'admin' ? 'user' : 'admin'}')" class="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors" title="Chuyển quyền">
              Đổi vai trò
            </button>
          </div>
        </td>
      </tr>
    `).join("");
  },

  async toggleUserStatus(userId) {
    try {
      const res = await API.post(`/api/admin/users/${userId}/toggle-status`);
      showToast(res.message, "success");
      await this.loadUsers();
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  async changeRole(userId, newRole) {
    try {
      const res = await API.post(`/api/admin/users/${userId}/role`, { role: newRole });
      showToast(res.message, "success");
      await this.loadUsers();
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  async loadSettings() {
    try {
      const res = await API.get("/api/admin/settings");
      (res.settings || []).forEach(s => {
        const el = document.getElementById(`setting-${s.key}`);
        if (el) el.value = s.value;
      });
    } catch (e) {
      console.error(e);
    }
  },

  async saveSettings() {
    const payload = {
      site_name: document.getElementById("setting-site_name")?.value || "NEXORA AI",
      site_tagline: document.getElementById("setting-site_tagline")?.value || "",
      default_provider: document.getElementById("setting-default_provider")?.value || "gemini",
      default_model: document.getElementById("setting-default_model")?.value || "gemini-2.0-flash",
      max_daily_requests: document.getElementById("setting-max_daily_requests")?.value || "100"
    };

    try {
      const res = await API.post("/api/admin/settings", payload);
      showToast(res.message, "success");
    } catch (e) {
      showToast(e.message, "error");
    }
  }
};

