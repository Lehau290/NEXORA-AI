// ============================================================
// NEXORA AI - Main Router, State Store & App Coordinator
// ============================================================

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `p-3.5 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2.5 transition-all transform duration-300 translate-y-2 opacity-0 z-50 border ${
    type === "success" ? "bg-emerald-950/90 text-emerald-300 border-emerald-500/40" :
    type === "error" ? "bg-rose-950/90 text-rose-300 border-rose-500/40" :
    type === "warning" ? "bg-amber-950/90 text-amber-300 border-amber-500/40" :
    "bg-[#151923]/95 text-slate-200 border-[#7C5CFC]/40"
  }`;

  const iconName = type === "success" ? "check-circle" : type === "error" ? "alert-circle" : type === "warning" ? "alert-triangle" : "info";
  toast.innerHTML = `
    <i data-lucide="${iconName}" class="w-4 h-4 flex-shrink-0"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);
  lucide.createIcons();

  requestAnimationFrame(() => {
    toast.classList.remove("translate-y-2", "opacity-0");
  });

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove("hidden");
    modal.classList.add("flex");
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
}

const App = {
  currentRoute: "",

  init() {
    this.initTheme();
    this.bindGlobalEvents();
    this.bindAuthForms();
    this.updateUserUI();
    this.checkSystemStatus();

    // Listen to hash changes for SPA routing
    window.addEventListener("hashchange", () => this.handleRoute());
    this.handleRoute();

    // Check for unauthorized events
    window.addEventListener("nexora:unauthorized", () => {
      openModal("auth-modal");
      this.switchAuthTab("login");
      showToast("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", "warning");
    });

    window.addEventListener("nexora:user-updated", () => {
      this.updateUserUI();
    });

    window.addEventListener("nexora:refresh-conversations", () => {
      this.loadSidebarConversations();
    });
  },

  initTheme() {
    const savedTheme = localStorage.getItem("nexora_theme");
    if (savedTheme === "light") {
      document.documentElement.classList.add("light");
    }
  },

  async checkSystemStatus() {
    try {
      const res = await API.get("/api/system/status");
      const banner = document.getElementById("global-api-key-banner");
      if (banner) {
        if (!res.has_active_ai_key) {
          banner.classList.remove("hidden");
        } else {
          banner.classList.add("hidden");
        }
      }
    } catch (e) {
      console.error(e);
    }
  },

  bindGlobalEvents() {
    // Quick Demo / Owner / Admin Login buttons
    const btnOwner = document.getElementById("btn-quick-owner-login");
    const btnDemo = document.getElementById("btn-quick-demo-login");
    const btnAdmin = document.getElementById("btn-quick-admin-login");

    if (btnOwner) {
      btnOwner.addEventListener("click", () => this.quickLogin("letrunghau", "123456"));
    }
    if (btnDemo) {
      btnDemo.addEventListener("click", () => this.quickLogin("demouser", "demo123"));
    }
    if (btnAdmin) {
      btnAdmin.addEventListener("click", () => this.quickLogin("admin", "admin123"));
    }

    // Sidebar New Chat
    const btnNewChat = document.getElementById("btn-sidebar-new-chat");
    if (btnNewChat) {
      btnNewChat.addEventListener("click", () => {
        window.location.hash = "#/chat";
        if (this.currentRoute === "chat") {
          Chat.startNewWithDefaultAgent();
        }
      });
    }

    // Logout
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => API.logout());
    }
  },

  async quickLogin(username, password) {
    try {
      const res = await API.post("/api/auth/login", {
        identifier: username,
        password: password
      });
      API.setToken(res.token);
      API.setUser(res.user);
      closeModal("auth-modal");
      this.updateUserUI();

      if (typeof HarnessOS !== "undefined") {
        HarnessOS.startSequence(res.user, () => {
          showToast(`Xin chào mừng ${res.user.full_name}!`, "success");
          window.location.hash = "#/dashboard";
        });
      } else {
        showToast(`Xin chào mừng ${res.user.full_name}!`, "success");
        window.location.hash = "#/dashboard";
      }
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  bindAuthForms() {
    // Login form
    const loginForm = document.getElementById("form-login");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const identifier = document.getElementById("login-identifier").value.trim();
        const password = document.getElementById("login-password").value;

        try {
          const res = await API.post("/api/auth/login", { identifier, password });
          API.setToken(res.token);
          API.setUser(res.user);
          closeModal("auth-modal");
          this.updateUserUI();

          if (typeof HarnessOS !== "undefined") {
            HarnessOS.startSequence(res.user, () => {
              showToast(`Đăng nhập thành công! Chào ${res.user.full_name}`, "success");
              window.location.hash = "#/dashboard";
            });
          } else {
            showToast(`Đăng nhập thành công! Chào ${res.user.full_name}`, "success");
            window.location.hash = "#/dashboard";
          }
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    }

    // Register form
    const regForm = document.getElementById("form-register");
    if (regForm) {
      regForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const full_name = document.getElementById("reg-fullname").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const username = document.getElementById("reg-username").value.trim();
        const password = document.getElementById("reg-password").value;
        const confirm_password = document.getElementById("reg-confirm-password").value;

        try {
          const res = await API.post("/api/auth/register", {
            full_name, email, username, password, confirm_password
          });
          API.setToken(res.token);
          API.setUser(res.user);
          closeModal("auth-modal");
          showToast("Đăng ký tài khoản thành công!", "success");
          this.updateUserUI();
          window.location.hash = "#/dashboard";
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    }
  },

  switchAuthTab(tab) {
    const loginBox = document.getElementById("auth-login-box");
    const regBox = document.getElementById("auth-register-box");
    const tabLogin = document.getElementById("tab-login-btn");
    const tabReg = document.getElementById("tab-register-btn");

    if (tab === "login") {
      loginBox?.classList.remove("hidden");
      regBox?.classList.add("hidden");
      tabLogin?.classList.add("border-b-2", "border-[#7C5CFC]", "text-[#7C5CFC]");
      tabReg?.classList.remove("border-b-2", "border-[#7C5CFC]", "text-[#7C5CFC]");
    } else {
      loginBox?.classList.add("hidden");
      regBox?.classList.remove("hidden");
      tabReg?.classList.add("border-b-2", "border-[#7C5CFC]", "text-[#7C5CFC]");
      tabLogin?.classList.remove("border-b-2", "border-[#7C5CFC]", "text-[#7C5CFC]");
    }
  },

  updateUserUI() {
    const user = API.getUser();
    const guestNav = document.querySelectorAll(".guest-only");
    const userNav = document.querySelectorAll(".user-only");
    const adminNav = document.querySelectorAll(".admin-only");

    if (user) {
      guestNav.forEach(el => el.classList.add("hidden"));
      userNav.forEach(el => el.classList.remove("hidden"));

      const nameEls = document.querySelectorAll(".current-user-name");
      const avatarEls = document.querySelectorAll(".current-user-avatar");
      const planEls = document.querySelectorAll(".current-user-plan");

      nameEls.forEach(el => el.textContent = user.full_name);
      avatarEls.forEach(el => {
        if (user.avatar && (user.avatar.startsWith("data:image/") || user.avatar.startsWith("http") || user.avatar.startsWith("/uploads/"))) {
          el.innerHTML = `<img src="${user.avatar}" alt="Avatar" class="w-full h-full object-cover rounded-full">`;
        } else {
          el.textContent = user.avatar || "👤";
        }
      });
      planEls.forEach(el => el.textContent = user.plan || "Free");

      if (user.role === "admin") {
        adminNav.forEach(el => el.classList.remove("hidden"));
      } else {
        adminNav.forEach(el => el.classList.add("hidden"));
      }

      if (typeof HarnessOS !== "undefined") {
        if (typeof HarnessOS.initMascotDraggable === "function") {
          setTimeout(() => HarnessOS.initMascotDraggable(), 100);
        }
        if (typeof HarnessOS.updateMascotGreeting === "function") {
          HarnessOS.updateMascotGreeting();
        }
      }

      this.loadSidebarConversations();
    } else {
      guestNav.forEach(el => el.classList.remove("hidden"));
      userNav.forEach(el => el.classList.add("hidden"));
      adminNav.forEach(el => el.classList.add("hidden"));
    }
  },

  async loadSidebarConversations() {
    const container = document.getElementById("sidebar-conversations-list");
    if (!container) return;

    try {
      const res = await API.get("/api/chat/conversations");
      const convs = res.conversations || [];
      if (!convs.length) {
        container.innerHTML = `<div class="px-3 py-2 text-[11px] text-slate-500">Chưa có hội thoại gần đây</div>`;
        return;
      }

      container.innerHTML = convs.slice(0, 15).map(c => `
        <a href="#/chat?conv_id=${c.id}" class="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors group truncate ${Chat.currentConversationId == c.id ? 'bg-[#7C5CFC]/15 text-[#7C5CFC] font-semibold border border-[#7C5CFC]/30' : ''}">
          <span class="text-sm flex-shrink-0">${c.agent_avatar || '🤖'}</span>
          <span class="truncate flex-1">${escapeHtml(c.title)}</span>
          ${c.is_favorite ? '<i data-lucide="star" class="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0"></i>' : ''}
        </a>
      `).join("");
      lucide.createIcons();
    } catch (e) {
      console.error(e);
    }
  },

  handleRoute() {
    const hash = window.location.hash || "#/";
    const [path, queryString] = hash.split("?");
    const params = new URLSearchParams(queryString || "");
    const user = API.getUser();

    // Guard authenticated views
    const protectedViews = ["#/dashboard", "#/chat", "#/workflows", "#/studio", "#/knowledge", "#/history", "#/profile", "#/admin"];
    if (protectedViews.includes(path) && !user) {
      openModal("auth-modal");
      this.switchAuthTab("login");
      window.location.hash = "#/";
      return;
    }

    // Hide all view panels
    document.querySelectorAll(".view-panel").forEach(p => p.classList.add("hidden"));

    // Highlight active nav item
    document.querySelectorAll(".nav-item").forEach(item => {
      const target = item.getAttribute("href");
      if (target === path) {
        item.classList.add("bg-[#7C5CFC]/15", "text-[#7C5CFC]", "font-semibold");
      } else {
        item.classList.remove("bg-[#7C5CFC]/15", "text-[#7C5CFC]", "font-semibold");
      }
    });

    const appSidebar = document.getElementById("app-sidebar");
    const landingNav = document.getElementById("landing-navbar");

    if (path === "#/") {
      // Landing Page
      document.getElementById("view-landing")?.classList.remove("hidden");
      if (appSidebar) appSidebar.classList.add("hidden");
      if (landingNav) landingNav.classList.remove("hidden");
      this.currentRoute = "landing";
    } else {
      // App Shell (Sidebar visible)
      if (appSidebar) appSidebar.classList.remove("hidden");
      if (landingNav) landingNav.classList.add("hidden");

      if (path === "#/dashboard") {
        document.getElementById("view-dashboard")?.classList.remove("hidden");
        this.currentRoute = "dashboard";
        this.initDashboard();
      } else if (path === "#/chat") {
        document.getElementById("view-chat")?.classList.remove("hidden");
        this.currentRoute = "chat";
        Chat.init(params.get("conv_id"), params.get("agent_id"));
      } else if (path === "#/agents") {
        document.getElementById("view-agents")?.classList.remove("hidden");
        this.currentRoute = "agents";
        Agents.init();
      } else if (path === "#/workflows") {
        document.getElementById("view-workflows")?.classList.remove("hidden");
        this.currentRoute = "workflows";
        Workflow.init(params.get("id"));
      } else if (path === "#/studio") {
        document.getElementById("view-studio")?.classList.remove("hidden");
        this.currentRoute = "studio";
        Studio.init();
      } else if (path === "#/knowledge") {
        document.getElementById("view-knowledge")?.classList.remove("hidden");
        this.currentRoute = "knowledge";
        Knowledge.init();
      } else if (path === "#/history") {
        document.getElementById("view-history")?.classList.remove("hidden");
        this.currentRoute = "history";
        History.init();
      } else if (path === "#/profile") {
        document.getElementById("view-profile")?.classList.remove("hidden");
        this.currentRoute = "profile";
        Profile.init();
      } else if (path === "#/admin") {
        document.getElementById("view-admin")?.classList.remove("hidden");
        this.currentRoute = "admin";
        Admin.init();
      }
    }

    lucide.createIcons();
    window.scrollTo(0, 0);
  },

  async initDashboard() {
    const greetingEl = document.getElementById("dashboard-greeting-name");
    const user = API.getUser();
    if (greetingEl && user) {
      greetingEl.textContent = user.full_name;
    }

    // Load recommended agents
    try {
      const res = await API.get("/api/agents");
      const container = document.getElementById("dashboard-recommended-agents");
      if (container) {
        container.innerHTML = (res.agents || []).slice(0, 4).map(a => `
          <div onclick="Agents.startChat(${a.id})" class="p-4 rounded-2xl bg-[#151923] border border-white/5 hover:border-[#7C5CFC]/30 transition-all cursor-pointer group hover:-translate-y-0.5">
            <div class="flex items-center gap-3 mb-2">
              <span class="text-2xl">${a.avatar || '🤖'}</span>
              <div>
                <h4 class="text-xs font-bold text-slate-200 group-hover:text-[#7C5CFC] transition-colors">${escapeHtml(a.name)}</h4>
                <p class="text-[10px] text-[#22D3EE]">${escapeHtml(a.role_desc)}</p>
              </div>
            </div>
            <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed">${escapeHtml(a.description)}</p>
          </div>
        `).join("");
      }

      // Load recent conversations for center dashboard
      const convRes = await API.get("/api/chat/conversations");
      const convContainer = document.getElementById("dashboard-recent-convs");
      if (convContainer) {
        if (!convRes.conversations?.length) {
          convContainer.innerHTML = `<div class="p-4 text-center text-slate-500 text-xs">Chưa có hội thoại nào. Nhập câu hỏi bên dưới để bắt đầu!</div>`;
        } else {
          convContainer.innerHTML = convRes.conversations.slice(0, 3).map(c => `
            <a href="#/chat?conv_id=${c.id}" class="p-3.5 rounded-xl bg-slate-900/60 hover:bg-[#7C5CFC]/10 border border-white/5 flex items-center justify-between group transition-all">
              <div class="flex items-center gap-3 truncate">
                <span class="text-lg">${c.agent_avatar || '🤖'}</span>
                <div class="truncate">
                  <div class="text-xs font-bold text-slate-200 group-hover:text-[#7C5CFC] transition-colors truncate">${escapeHtml(c.title)}</div>
                  <div class="text-[11px] text-slate-400 truncate">${escapeHtml(c.last_message || 'Bắt đầu trò chuyện...')}</div>
                </div>
              </div>
              <i data-lucide="chevron-right" class="w-4 h-4 text-slate-500 group-hover:text-slate-200 transition-colors flex-shrink-0"></i>
            </a>
          `).join("");
        }
      }

    } catch (e) {
      console.error(e);
    }
    lucide.createIcons();
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());

