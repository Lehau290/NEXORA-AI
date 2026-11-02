// ============================================================
// NEXORA AI - User Profile & Settings Module
// ============================================================

const Profile = {
  userProfile: null,

  async init() {
    await this.loadProfile();
    this.bindEvents();
    this.checkCurrentKeys();
  },

  bindEvents() {
    const profileForm = document.getElementById("profile-update-form");
    const saveKeyBtn = document.getElementById("btn-save-custom-api-key");
    const themeToggleBtn = document.getElementById("btn-toggle-theme");

    if (profileForm && !profileForm.dataset.bound) {
      profileForm.dataset.bound = "true";
      profileForm.addEventListener("submit", (e) => {
        e.preventDefault();
        this.updateProfile();
      });
    }

    if (saveKeyBtn && !saveKeyBtn.dataset.bound) {
      saveKeyBtn.dataset.bound = "true";
      saveKeyBtn.addEventListener("click", () => this.saveApiKey());
    }

    if (themeToggleBtn && !themeToggleBtn.dataset.bound) {
      themeToggleBtn.dataset.bound = "true";
      themeToggleBtn.addEventListener("click", () => this.toggleTheme());
    }
  },

  async loadProfile() {
    try {
      const res = await API.get("/api/auth/me");
      this.userProfile = res.user;
      this.renderProfileDetails(res.user, res.stats);
    } catch (e) {
      console.error(e);
    }
  },

  renderProfileDetails(user, stats = {}) {
    if (!user) return;

    const avatarEl = document.getElementById("profile-avatar-display");
    const nameEl = document.getElementById("profile-name-display");
    const emailEl = document.getElementById("profile-email-display");
    const planEl = document.getElementById("profile-plan-badge");
    const tokensUsedEl = document.getElementById("profile-tokens-used");
    const tokensLimitEl = document.getElementById("profile-tokens-limit");
    const tokenBarEl = document.getElementById("profile-tokens-bar");

    const inputName = document.getElementById("input-profile-fullname");
    const inputAvatar = document.getElementById("input-profile-avatar");

    if (avatarEl) avatarEl.textContent = user.avatar || "👤";
    if (nameEl) nameEl.textContent = user.full_name;
    if (emailEl) emailEl.textContent = user.email;
    if (planEl) planEl.textContent = `Gói ${user.plan || "Free"}`;

    if (inputName) inputName.value = user.full_name || "";
    if (inputAvatar) inputAvatar.value = user.avatar || "👤";

    const used = user.tokens_used || 0;
    const limit = user.tokens_limit || 50000;
    const percent = Math.min(100, Math.round((used / limit) * 100));

    if (tokensUsedEl) tokensUsedEl.textContent = used.toLocaleString();
    if (tokensLimitEl) tokensLimitEl.textContent = limit.toLocaleString();
    if (tokenBarEl) tokenBarEl.style.width = `${percent}%`;

    // Render Stats
    const convCount = document.getElementById("stat-user-conversations");
    const agentCount = document.getElementById("stat-user-agents");
    const docCount = document.getElementById("stat-user-docs");

    if (convCount) convCount.textContent = stats.conversations || 0;
    if (agentCount) agentCount.textContent = stats.custom_agents || 0;
    if (docCount) docCount.textContent = stats.documents || 0;
  },

  async updateProfile() {
    const fullName = document.getElementById("input-profile-fullname")?.value.trim();
    const avatar = document.getElementById("input-profile-avatar")?.value.trim() || "👤";
    const currentPassword = document.getElementById("input-profile-old-pass")?.value;
    const newPassword = document.getElementById("input-profile-new-pass")?.value;

    const payload = { full_name: fullName, avatar };
    if (newPassword) {
      if (!currentPassword) {
        showToast("Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu.", "warning");
        return;
      }
      payload.current_password = currentPassword;
      payload.new_password = newPassword;
    }

    try {
      const res = await API.post("/api/auth/update-profile", payload);
      showToast(res.message, "success");
      
      // Update local storage user data
      const curr = API.getUser() || {};
      curr.full_name = fullName;
      curr.avatar = avatar;
      API.setUser(curr);

      // Clear password inputs
      if (document.getElementById("input-profile-old-pass")) document.getElementById("input-profile-old-pass").value = "";
      if (document.getElementById("input-profile-new-pass")) document.getElementById("input-profile-new-pass").value = "";

      await this.loadProfile();
      window.dispatchEvent(new CustomEvent("nexora:user-updated"));
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  async checkCurrentKeys() {
    try {
      const res = await API.get("/api/system/status");
      const geminiStatus = document.getElementById("status-key-gemini");
      const openaiStatus = document.getElementById("status-key-openai");
      const anthropicStatus = document.getElementById("status-key-anthropic");

      if (geminiStatus) {
        geminiStatus.className = `text-[11px] font-semibold ${res.keys_configured?.gemini ? 'text-emerald-400' : 'text-amber-400'}`;
        geminiStatus.textContent = res.keys_configured?.gemini ? "✓ Đã sẵn sàng" : "⚠️ Chưa cấu hình";
      }
      if (openaiStatus) {
        openaiStatus.className = `text-[11px] font-semibold ${res.keys_configured?.openai ? 'text-emerald-400' : 'text-slate-500'}`;
        openaiStatus.textContent = res.keys_configured?.openai ? "✓ Đã sẵn sàng" : "Chưa cấu hình";
      }
      if (anthropicStatus) {
        anthropicStatus.className = `text-[11px] font-semibold ${res.keys_configured?.anthropic ? 'text-emerald-400' : 'text-slate-500'}`;
        anthropicStatus.textContent = res.keys_configured?.anthropic ? "✓ Đã sẵn sàng" : "Chưa cấu hình";
      }
    } catch (e) {
      console.error(e);
    }
  },

  async saveApiKey() {
    const provider = document.getElementById("input-key-provider")?.value || "gemini";
    const apiKey = document.getElementById("input-key-secret")?.value.trim();

    if (!apiKey) {
      showToast("Vui lòng nhập mã API Key hợp lệ.", "warning");
      return;
    }

    try {
      const res = await API.post("/api/system/save-key", { provider, api_key: apiKey });
      showToast(res.message, "success");
      document.getElementById("input-key-secret").value = "";
      await this.checkCurrentKeys();
      // Hide banner if was visible
      const banner = document.getElementById("global-api-key-banner");
      if (banner) banner.classList.add("hidden");
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  toggleTheme() {
    const isLight = document.documentElement.classList.toggle("light");
    localStorage.setItem("nexora_theme", isLight ? "light" : "dark");
    showToast(`Đã chuyển sang ${isLight ? 'Giao diện Sáng (Light Mode)' : 'Giao diện Tối (Dark Mode)'}`, "info");
    const icon = document.getElementById("theme-toggle-icon");
    if (icon) {
      icon.setAttribute("data-lucide", isLight ? "moon" : "sun");
      lucide.createIcons();
    }
  }
};

