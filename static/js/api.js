// ============================================================
// NEXORA AI - API Client & Smart Hybrid Adapter (Backend & Static/GitHub Pages)
// ============================================================

const API = {
  TOKEN_KEY: "nexora_access_token",
  USER_KEY: "nexora_user_data",

  isStaticMode() {
    return window.location.hostname.includes("github.io") || window.location.protocol === "file:";
  },

  getToken() {
    return localStorage.getItem(this.TOKEN_KEY);
  },

  setToken(token) {
    if (token) {
      localStorage.setItem(this.TOKEN_KEY, token);
      document.cookie = `nexora_token=${token}; path=/; max-age=259200; SameSite=Lax`;
    } else {
      localStorage.removeItem(this.TOKEN_KEY);
      document.cookie = "nexora_token=; path=/; max-age=0";
    }
  },

  getUser() {
    const raw = localStorage.getItem(this.USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  setUser(user) {
    if (user) {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(this.USER_KEY);
    }
  },

  logout() {
    this.setToken(null);
    this.setUser(null);
    window.location.hash = "#/";
    window.location.reload();
  },

  async request(endpoint, options = {}) {
    // If running statically on GitHub Pages, handle via local client-side data adapter
    if (this.isStaticMode()) {
      return this.handleStaticFallback(endpoint, options);
    }

    const headers = options.headers || {};
    const token = this.getToken();

    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(endpoint, config);
      
      if (response.status === 401) {
        if (!endpoint.includes("/api/auth/login") && !endpoint.includes("/api/auth/register")) {
          this.setToken(null);
          this.setUser(null);
          window.dispatchEvent(new CustomEvent("nexora:unauthorized"));
        }
      }

      if (response.status === 404 && !endpoint.includes("/static/")) {
        return this.handleStaticFallback(endpoint, options);
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Yêu cầu thất bại (${response.status})`);
      }
      return data;
    } catch (err) {
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        return this.handleStaticFallback(endpoint, options);
      }
      console.error(`API Error on [${endpoint}]:`, err);
      throw err;
    }
  },

  get(endpoint) {
    return this.request(endpoint, { method: "GET" });
  },

  post(endpoint, body) {
    return this.request(endpoint, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  },

  delete(endpoint) {
    return this.request(endpoint, { method: "DELETE" });
  },

  // -------------------------------------------------------------
  // STATIC FALLBACK ENGINE (For GitHub Pages & Client-side Demo)
  // -------------------------------------------------------------
  handleStaticFallback(endpoint, options = {}) {
    const body = options.body ? (typeof options.body === "string" ? JSON.parse(options.body) : options.body) : {};

    // 1. System Status
    if (endpoint.includes("/api/system/status")) {
      const hasKey = !!localStorage.getItem("nexora_gemini_key");
      return {
        status: "online",
        version: "2.5.0-pro (GitHub Pages Mode)",
        site_name: "NEXORA AI",
        tagline: "One Platform. Multiple AI Agents. Infinite Possibilities.",
        default_provider: "gemini",
        default_model: "gemini-2.0-flash",
        keys_configured: { gemini: hasKey, openai: false, anthropic: false },
        has_active_ai_key: hasKey
      };
    }

    // 1.1 Save API Key
    if (endpoint.includes("/api/system/save-key")) {
      const provider = body.provider || "gemini";
      const key = body.api_key || "";
      if (provider === "gemini") {
        localStorage.setItem("nexora_gemini_key", key);
      } else {
        localStorage.setItem(`nexora_${provider}_key`, key);
      }
      return {
        success: true,
        message: `Đã kết nối và lưu khóa API ${provider.toUpperCase()} thành công!`
      };
    }

    // 2. Auth Login
    if (endpoint.includes("/api/auth/login")) {
      const ident = (body.identifier || "").toLowerCase();
      let user = {
        id: 3,
        full_name: "Lê Trung Hậu",
        email: "letrunghau@nexora.ai",
        username: "letrunghau",
        role: "user",
        plan: "Pro",
        avatar: "👨‍💻"
      };

      if (ident.includes("admin") || ident === "admin_hau" || ident === "admin_ngoc") {
        user = {
          id: 4,
          full_name: ident.includes("ngoc") ? "Nguyễn Thị Bảo Ngọc (Admin)" : "Lê Trung Hậu (Admin)",
          email: ident.includes("ngoc") ? "admin.ngoc@nexora.ai" : "admin.hau@nexora.ai",
          username: ident.includes("ngoc") ? "admin_ngoc" : "admin_hau",
          role: "admin",
          plan: "Enterprise",
          avatar: "👑"
        };
      } else if (ident.includes("ngoc") || ident === "baongoc") {
        user = {
          id: 5,
          full_name: "Nguyễn Thị Bảo Ngọc",
          email: "baongoc@nexora.ai",
          username: "baongoc",
          role: "user",
          plan: "Pro",
          avatar: "👩‍💼"
        };
      } else if (ident === "demouser" || ident === "demo@nexora.ai") {
        user = {
          id: 2,
          full_name: "Alex Rivers",
          email: "demo@nexora.ai",
          username: "demouser",
          role: "user",
          plan: "Pro",
          avatar: "⚡"
        };
      }

      return {
        success: true,
        message: "Đăng nhập thành công!",
        token: "static-demo-token-nexora-2026",
        user
      };
    }

    // 3. Auth Register
    if (endpoint.includes("/api/auth/register")) {
      return {
        success: true,
        message: "Đăng ký tài khoản thành công!",
        token: "static-demo-token-nexora-2026",
        user: {
          id: 10,
          full_name: body.full_name || "Thành viên mới",
          email: body.email,
          username: body.username,
          role: "user",
          plan: "Free",
          avatar: "⚡"
        }
      };
    }

    // 4. Auth Me
    if (endpoint.includes("/api/auth/me")) {
      const user = this.getUser() || {
        id: 3,
        full_name: "Lê Trung Hậu",
        email: "letrunghau@nexora.ai",
        username: "letrunghau",
        role: "user",
        plan: "Pro",
        avatar: "👨‍💻",
        tokens_used: 1250,
        tokens_limit: 500000
      };
      return {
        success: true,
        user,
        stats: { conversations: 2, custom_agents: 1, documents: 1 }
      };
    }

    // 4.1 Update Profile
    if (endpoint.includes("/api/auth/update-profile")) {
      const user = this.getUser() || { id: 3, full_name: "Lê Trung Hậu", email: "letrunghau@nexora.ai" };
      if (body.full_name) user.full_name = body.full_name;
      if (body.avatar) user.avatar = body.avatar;
      this.setUser(user);
      return {
        success: true,
        message: "Cập nhật hồ sơ tài khoản thành công!",
        user
      };
    }

    // 5. Categories
    if (endpoint.includes("/api/agents/categories")) {
      return {
        success: true,
        categories: [
          { id: 1, name: "Tổng quát", slug: "general", icon: "Compass" },
          { id: 2, name: "Lập trình", slug: "programming", icon: "Code2" },
          { id: 3, name: "Nghiên cứu", slug: "research", icon: "Search" },
          { id: 4, name: "Viết lách", slug: "writing", icon: "PenTool" },
          { id: 5, name: "Học tập", slug: "education", icon: "GraduationCap" },
          { id: 6, name: "Phân tích dữ liệu", slug: "analytics", icon: "BarChart3" },
          { id: 7, name: "Dịch thuật", slug: "translation", icon: "Languages" },
          { id: 8, name: "Tiếp thị & Kinh doanh", slug: "marketing", icon: "Megaphone" }
        ]
      };
    }

    // 6. Agents List
    if (endpoint.includes("/api/agents")) {
      const defaultAgents = [
        {
          id: 1, name: "AI General Assistant", slug: "general-assistant", avatar: "✨",
          description: "Trợ lý trí tuệ nhân tạo toàn diện hàng đầu. Giải đáp mọi thắc mắc, phân tích logic và hỗ trợ công việc thường ngày.",
          category_slug: "general", category_name: "Tổng quát", role_desc: "Trợ lý đa năng toàn diện",
          expertise: "Tư duy phân tích, lập kế hoạch, kiến thức tổng hợp", ai_model: "gemini-2.0-flash", is_favorite: 1
        },
        {
          id: 2, name: "AI Coding Agent", slug: "coding-agent", avatar: "💻",
          description: "Kỹ sư phần mềm AI cấp cao. Viết mã sạch (Clean Code), gỡ lỗi thần tốc và giải thích thuật toán đa ngôn ngữ.",
          category_slug: "programming", category_name: "Lập trình", role_desc: "Chuyên gia phát triển phần mềm",
          expertise: "Python, JavaScript, TypeScript, Go, Rust, SQL, Docker", ai_model: "gemini-2.0-flash", is_favorite: 1
        },
        {
          id: 3, name: "AI Research Agent", slug: "research-agent", avatar: "🔬",
          description: "Nhà nghiên cứu khoa học chuyên sâu. Khám phá tài liệu, phân tích dữ kiện và luôn trích dẫn nguồn kiểm chứng rõ ràng.",
          category_slug: "research", category_name: "Nghiên cứu", role_desc: "Nhà nghiên cứu học thuật",
          expertise: "Phân tích tài liệu chuyên sâu, xác thực dữ liệu, tổng quan thị trường", ai_model: "gemini-2.0-flash"
        },
        {
          id: 4, name: "AI Writing Agent", slug: "writing-agent", avatar: "✍️",
          description: "Bậc thầy ngôn từ và sáng tạo nội dung. Soạn thảo email doanh nghiệp, viết bài SEO và định hình phong cách viết ấn tượng.",
          category_slug: "writing", category_name: "Viết lách", role_desc: "Chuyên gia sáng tạo nội dung",
          expertise: "Copywriting, Email doanh nghiệp, Báo cáo quản trị, SEO Content", ai_model: "gemini-2.0-flash"
        },
        {
          id: 5, name: "AI Study Agent", slug: "study-agent", avatar: "🎓",
          description: "Gia sư trí tuệ nhân tạo tận tâm. Đơn giản hóa kiến thức phức tạp bằng phương pháp Feynman và tạo câu hỏi trắc nghiệm.",
          category_slug: "education", category_name: "Học tập", role_desc: "Cố vấn giáo dục và gia sư cá nhân",
          expertise: "Phương pháp Feynman, Giải bài tập, Tạo đề ôn thi, Lộ trình tự học", ai_model: "gemini-2.0-flash"
        },
        {
          id: 6, name: "AI Data Analyst", slug: "data-analyst", avatar: "📊",
          description: "Chuyên viên phân tích dữ liệu và thống kê. Đọc hiểu file CSV, Excel, bóc tách insight kinh doanh và đề xuất biểu đồ trực quan.",
          category_slug: "analytics", category_name: "Phân tích dữ liệu", role_desc: "Chuyên gia phân tích dữ liệu & BI",
          expertise: "Phân tích CSV/Excel, Thống kê mô tả, Mô hình tài chính, ROI", ai_model: "gemini-2.0-flash"
        },
        {
          id: 7, name: "AI Translator", slug: "translator-agent", avatar: "🌐",
          description: "Chuyên gia ngôn ngữ học và dịch thuật đa ngữ. Chuyển ngữ chuẩn văn phong bản địa, dịch tài liệu chuyên ngành.",
          category_slug: "translation", category_name: "Dịch thuật", role_desc: "Chuyên gia ngôn ngữ & dịch thuật",
          expertise: "Dịch thuật Anh - Việt, Nhật, Hàn, Trung; Thuật ngữ chuyên ngành", ai_model: "gemini-2.0-flash"
        },
        {
          id: 8, name: "AI Marketing Agent", slug: "marketing-agent", avatar: "🚀",
          description: "Chiến lược gia tiếp thị & tăng trưởng số. Lập kế hoạch Go-To-Market, định vị thương hiệu và tối ưu hóa phễu khách hàng.",
          category_slug: "marketing", category_name: "Tiếp thị & Kinh doanh", role_desc: "Chiến lược gia Marketing & Tăng trưởng",
          expertise: "Go-To-Market, Định vị USP, Phễu chuyển đổi, Content Viral", ai_model: "gemini-2.0-flash"
        }
      ];

      const match = endpoint.match(/\/api\/agents\/(\d+)/);
      if (match) {
        const id = parseInt(match[1]);
        const ag = defaultAgents.find(a => a.id === id) || defaultAgents[0];
        return { success: true, agent: ag };
      }

      return { success: true, agents: defaultAgents, count: defaultAgents.length };
    }

    // 7. Conversations
    if (endpoint.includes("/api/chat/conversations")) {
      const match = endpoint.match(/\/api\/chat\/conversations\/(\d+)/);
      if (match) {
        return {
          success: true,
          conversation: {
            id: 1, agent_id: 1, agent_name: "AI General Assistant", agent_avatar: "✨",
            title: "Khám phá nền tảng Multi-Agent NEXORA AI", is_favorite: 1, ai_model: "gemini-2.0-flash"
          },
          messages: [
            { id: 1, sender_type: "user", content: "Xin chào NEXORA AI!", created_at: "Hôm nay" },
            { id: 2, sender_type: "assistant", content: "Chào mừng bạn đến với **NEXORA AI** – Nền tảng Đa Tác Nhân Trí Tuệ Nhân Tạo thế hệ mới! 🚀\n\nTôi có thể giúp bạn giải quyết các công việc về lập trình, nghiên cứu, viết lách, phân tích dữ liệu hoặc khởi chạy Multi-Agent Workflow phối hợp nhiều chuyên gia AI cùng lúc.\n\nBạn muốn thực hiện công việc gì hôm nay?", created_at: "Hôm nay" }
          ]
        };
      }

      return {
        success: true,
        conversations: [
          {
            id: 1, agent_name: "AI General Assistant", agent_avatar: "✨",
            title: "Khám phá nền tảng Multi-Agent NEXORA AI", is_favorite: 1,
            last_message: "Chào mừng bạn đến với NEXORA AI – Nền tảng Đa Tác Nhân...",
            updated_at: "Hôm nay"
          }
        ]
      };
    }

    // 8. Workflows
    if (endpoint.includes("/api/workflows")) {
      return {
        success: true,
        workflows: [
          {
            id: 1,
            title: "Kế hoạch kinh doanh quán cà phê công nghệ",
            goal: "Nghiên cứu và xây dựng kế hoạch mở chuỗi cà phê công nghệ",
            status: "completed",
            progress_percent: 100,
            summary: "# BÁO CÁO KẾ HOẠCH KINH DOANH - TECH CAFE SPECIALTY\n\n**Manager Agent**: Đã tổng hợp toàn bộ số liệu và chiến lược từ 5 AI Agents.\n\n- 🔬 **Nghiên cứu**: Thị trường cà phê specialty tăng trưởng 18%/năm.\n- 📊 **Tài chính**: CAPEX ước tính 850M VNĐ, điểm hòa vốn 9 tháng.\n- 🚀 **Marketing**: Go-To-Market tập trung phân khúc lập trình viên & người làm việc tự do."
          }
        ]
      };
    }

    // 9. Knowledge Base Documents
    if (endpoint.includes("/api/knowledge/documents")) {
      return {
        success: true,
        documents: [
          { id: 1, original_name: "Tai_Lieu_Gioi_Thieu_NEXORA_AI.pdf", file_type: "pdf", file_size: 154200, chunk_count: 8, created_at: "2026-11-02" }
        ]
      };
    }

    // 10. Admin Stats
    if (endpoint.includes("/api/admin/stats")) {
      return {
        success: true,
        stats: {
          total_users: 6,
          total_agents: 8,
          total_conversations: 14,
          total_messages: 58,
          total_workflows: 4,
          total_documents: 6,
          total_tokens: 38400
        },
        recent_logs: [
          { username: "letrunghau", action_type: "chat", model: "gemini-2.0-flash", tokens_out: 420, created_at: "Vừa xong" },
          { username: "baongoc", action_type: "workflow", model: "gemini-2.0-flash", tokens_out: 1250, created_at: "5 phút trước" }
        ],
        model_distribution: [
          { model: "gemini-2.0-flash", count: 85 },
          { model: "gpt-4o", count: 30 },
          { model: "claude-3-5-sonnet", count: 15 }
        ]
      };
    }

    // 11. Admin Users
    if (endpoint.includes("/api/admin/users")) {
      return {
        success: true,
        users: [
          { id: 1, full_name: "NEXORA Administrator", email: "admin@nexora.ai", username: "admin", role: "admin", plan: "Enterprise", is_active: 1, tokens_used: 12500, tokens_limit: 10000000 },
          { id: 3, full_name: "Lê Trung Hậu", email: "letrunghau@nexora.ai", username: "letrunghau", role: "user", plan: "Pro", is_active: 1, tokens_used: 1540, tokens_limit: 500000 },
          { id: 4, full_name: "Lê Trung Hậu (Admin)", email: "admin.hau@nexora.ai", username: "admin_hau", role: "admin", plan: "Enterprise", is_active: 1, tokens_used: 3200, tokens_limit: 10000000 },
          { id: 5, full_name: "Nguyễn Thị Bảo Ngọc", email: "baongoc@nexora.ai", username: "baongoc", role: "user", plan: "Pro", is_active: 1, tokens_used: 890, tokens_limit: 500000 },
          { id: 6, full_name: "Nguyễn Thị Bảo Ngọc (Admin)", email: "admin.ngoc@nexora.ai", username: "admin_ngoc", role: "admin", plan: "Enterprise", is_active: 1, tokens_used: 2400, tokens_limit: 10000000 }
        ]
      };
    }

    return { success: true, message: "Thao tác thành công!" };
  }
};
