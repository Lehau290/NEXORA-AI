// ============================================================
// NEXORA AI - User Profile & Settings Module (Photo Upload & Account)
// ============================================================

const Profile = {
  userProfile: null,
  currentAvatar: "👤",

  async init() {
    await this.loadProfile();
    this.bindEvents();
    this.checkCurrentKeys();
  },

  bindEvents() {
    const profileForm = document.getElementById("profile-update-form");
    const saveKeyBtn = document.getElementById("btn-save-custom-api-key");
    const themeToggleBtn = document.getElementById("btn-toggle-theme");
    const photoFileInput = document.getElementById("input-profile-photo-file");
    const removePhotoBtn = document.getElementById("btn-remove-avatar-photo");
    const emojiInput = document.getElementById("input-profile-avatar");

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

    const keyProviderSelect = document.getElementById("input-key-provider");
    const keySecretInput = document.getElementById("input-key-secret");
    if (keyProviderSelect && keySecretInput && !keyProviderSelect.dataset.bound) {
      keyProviderSelect.dataset.bound = "true";
      keyProviderSelect.addEventListener("change", () => {
        const val = keyProviderSelect.value;
        if (val === "openai") {
          keySecretInput.placeholder = "Dán mã OpenAI API Key (ví dụ: sk-proj-... hoặc sk-...)";
        } else if (val === "anthropic") {
          keySecretInput.placeholder = "Dán mã Anthropic Claude API Key (ví dụ: sk-ant-api03-...)";
        } else if (val === "deepseek") {
          keySecretInput.placeholder = "Dán mã DeepSeek API Key (ví dụ: sk-...)";
        } else {
          keySecretInput.placeholder = "Dán mã Google Gemini API Key (ví dụ: AIzaSy...)";
        }
      });
    }

    if (themeToggleBtn && !themeToggleBtn.dataset.bound) {
      themeToggleBtn.dataset.bound = "true";
      themeToggleBtn.addEventListener("click", () => this.toggleTheme());
    }

    // Avatar Photo File Input Change
    if (photoFileInput && !photoFileInput.dataset.bound) {
      photoFileInput.dataset.bound = "true";
      photoFileInput.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
          showToast("Vui lòng chọn định dạng file hình ảnh hợp lệ (PNG, JPG, WebP, GIF).", "warning");
          return;
        }

        // Limit size to 10MB
        if (file.size > 10 * 1024 * 1024) {
          showToast("Kích thước file ảnh quá lớn (tối đa 10MB).", "warning");
          return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            // High-quality Canvas compression to max 512x512
            const maxDim = 512;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.88);

            this.currentAvatar = dataUrl;
            this.renderAvatarPreview(dataUrl);
            showToast("Đã tải ảnh lên! Hãy bấm 'Cập Nhật Hồ Sơ' để lưu ảnh đại diện.", "success");
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(file);
      });
    }

    // Remove photo button -> Revert to emoji
    if (removePhotoBtn && !removePhotoBtn.dataset.bound) {
      removePhotoBtn.dataset.bound = "true";
      removePhotoBtn.addEventListener("click", () => {
        const fallbackEmoji = document.getElementById("input-profile-avatar")?.value.trim() || "👤";
        this.currentAvatar = fallbackEmoji;
        this.renderAvatarPreview(fallbackEmoji);
        if (photoFileInput) photoFileInput.value = "";
        showToast("Đã chuyển về Avatar Emoji. Hãy bấm 'Cập Nhật Hồ Sơ' để lưu.", "info");
      });
    }

    // Listen for manual emoji input change
    if (emojiInput && !emojiInput.dataset.bound) {
      emojiInput.dataset.bound = "true";
      emojiInput.addEventListener("input", () => {
        const val = emojiInput.value.trim();
        // If user is not currently using a photo, update preview
        if (!this.currentAvatar || !this.currentAvatar.startsWith("data:image/")) {
          this.currentAvatar = val || "👤";
          this.renderAvatarPreview(this.currentAvatar);
        }
      });
    }
  },

  async loadProfile() {
    try {
      const res = await API.get("/api/auth/me");
      this.userProfile = res.user;
      this.currentAvatar = res.user.avatar || "👤";
      this.renderProfileDetails(res.user, res.stats);
    } catch (e) {
      console.error(e);
    }
  },

  renderAvatarPreview(avatar) {
    const avatarEl = document.getElementById("profile-avatar-display");
    const miniPreviewEl = document.getElementById("form-avatar-mini-preview");
    const removeBtn = document.getElementById("btn-remove-avatar-photo");
    const statusText = document.getElementById("form-avatar-status-text");

    const isImage = avatar && (avatar.startsWith("data:image/") || avatar.startsWith("http://") || avatar.startsWith("https://") || avatar.startsWith("/uploads/"));

    if (avatarEl) {
      if (isImage) {
        avatarEl.innerHTML = `<img src="${avatar}" alt="Avatar" class="w-full h-full object-cover rounded-3xl">`;
      } else {
        avatarEl.textContent = avatar || "👤";
      }
    }

    if (miniPreviewEl) {
      if (isImage) {
        miniPreviewEl.innerHTML = `<img src="${avatar}" alt="Avatar" class="w-full h-full object-cover rounded-xl">`;
      } else {
        miniPreviewEl.textContent = avatar || "👤";
      }
    }

    if (removeBtn) {
      if (isImage) {
        removeBtn.classList.remove("hidden");
      } else {
        removeBtn.classList.add("hidden");
      }
    }

    if (statusText) {
      statusText.textContent = isImage ? "✓ Đã chọn ảnh chân dung (Bấm 'Cập Nhật Hồ Sơ' để lưu)" : "Hỗ trợ PNG, JPG, GIF, WebP (tối đa 10MB)";
    }
  },

  renderProfileDetails(user, stats = {}) {
    if (!user) return;

    const nameEl = document.getElementById("profile-name-display");
    const emailEl = document.getElementById("profile-email-display");
    const planEl = document.getElementById("profile-plan-badge");
    const tokensUsedEl = document.getElementById("profile-tokens-used");
    const tokensLimitEl = document.getElementById("profile-tokens-limit");
    const tokenBarEl = document.getElementById("profile-tokens-bar");

    const inputName = document.getElementById("input-profile-fullname");
    const inputAvatar = document.getElementById("input-profile-avatar");

    this.currentAvatar = user.avatar || "👤";
    this.renderAvatarPreview(this.currentAvatar);

    if (nameEl) nameEl.textContent = user.full_name;
    if (emailEl) emailEl.textContent = user.email;
    if (planEl) planEl.textContent = `Gói ${user.plan || "Free"}`;

    if (inputName) inputName.value = user.full_name || "";
    if (inputAvatar) {
      // If avatar is image data URL, don't fill the text box with long base64
      if (user.avatar && (user.avatar.startsWith("data:image/") || user.avatar.startsWith("http") || user.avatar.startsWith("/uploads/"))) {
        inputAvatar.value = "📸 (Đang dùng ảnh)";
      } else {
        inputAvatar.value = user.avatar || "👤";
      }
    }

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
    const currentPassword = document.getElementById("input-profile-old-pass")?.value;
    const newPassword = document.getElementById("input-profile-new-pass")?.value;

    let avatar = this.currentAvatar;
    // If not using an uploaded image, check emoji input
    if (!avatar || !avatar.startsWith("data:image/")) {
      const emojiVal = document.getElementById("input-profile-avatar")?.value.trim();
      if (emojiVal && !emojiVal.includes("📸")) {
        avatar = emojiVal;
      }
    }

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
      showToast(res.message || "Cập nhật hồ sơ thành công!", "success");
      
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
      lucide.createIcons();
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
      const deepseekStatus = document.getElementById("status-key-deepseek");

      const localGemini = localStorage.getItem("nexora_gemini_key");
      const localOpenai = localStorage.getItem("nexora_openai_key");
      const localAnthropic = localStorage.getItem("nexora_anthropic_key") || localStorage.getItem("nexora_claude_key");
      const localDeepseek = localStorage.getItem("nexora_deepseek_key");

      const isGeminiReady = res?.keys_configured?.gemini || !!localGemini;
      const isOpenaiReady = res?.keys_configured?.openai || !!localOpenai;
      const isAnthropicReady = res?.keys_configured?.anthropic || !!localAnthropic;
      const isDeepseekReady = res?.keys_configured?.deepseek || !!localDeepseek;

      if (geminiStatus) {
        geminiStatus.className = `text-[11px] font-semibold ${isGeminiReady ? 'text-emerald-400' : 'text-slate-500'}`;
        geminiStatus.textContent = isGeminiReady ? "✓ Đã sẵn sàng (Hoạt động)" : "Chưa cấu hình";
      }
      if (openaiStatus) {
        openaiStatus.className = `text-[11px] font-semibold ${isOpenaiReady ? 'text-emerald-400' : 'text-slate-500'}`;
        openaiStatus.textContent = isOpenaiReady ? "✓ Đã sẵn sàng (Hoạt động)" : "Chưa cấu hình";
      }
      if (anthropicStatus) {
        anthropicStatus.className = `text-[11px] font-semibold ${isAnthropicReady ? 'text-emerald-400' : 'text-slate-500'}`;
        anthropicStatus.textContent = isAnthropicReady ? "✓ Đã sẵn sàng (Hoạt động)" : "Chưa cấu hình";
      }
      if (deepseekStatus) {
        deepseekStatus.className = `text-[11px] font-semibold ${isDeepseekReady ? 'text-emerald-400' : 'text-slate-500'}`;
        deepseekStatus.textContent = isDeepseekReady ? "✓ Đã sẵn sàng (Hoạt động)" : "Chưa cấu hình";
      }
    } catch (e) {
      console.error(e);
    }
  },

  async saveApiKey() {
    const provider = (document.getElementById("input-key-provider")?.value || "gemini").toLowerCase();
    const apiKey = document.getElementById("input-key-secret")?.value.trim();

    if (!apiKey) {
      showToast("Vui lòng nhập mã API Key hợp lệ.", "warning");
      return;
    }

    let storageKey = provider;
    if (storageKey === "claude") storageKey = "anthropic";
    localStorage.setItem(`nexora_${storageKey}_key`, apiKey);

    try {
      const res = await API.post("/api/system/save-key", { provider, api_key: apiKey });
      showToast(res.message || `Đã lưu khóa API ${provider.toUpperCase()} thành công!`, "success");
      document.getElementById("input-key-secret").value = "";
      await this.checkCurrentKeys();
      const banner = document.getElementById("global-api-key-banner");
      if (banner) banner.classList.add("hidden");
    } catch (e) {
      showToast(`Đã lưu khóa API ${provider.toUpperCase()} thành công!`, "success");
      document.getElementById("input-key-secret").value = "";
      await this.checkCurrentKeys();
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
