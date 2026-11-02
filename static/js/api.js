// ============================================================
// NEXORA AI - API Client & Token Management
// ============================================================

const API = {
  TOKEN_KEY: "nexora_access_token",
  USER_KEY: "nexora_user_data",

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
      
      // If unauthorized, clear token and open login modal if needed
      if (response.status === 401) {
        if (!endpoint.includes("/api/auth/login") && !endpoint.includes("/api/auth/register")) {
          this.setToken(null);
          this.setUser(null);
          window.dispatchEvent(new CustomEvent("nexora:unauthorized"));
        }
      }

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Yêu cầu thất bại (${response.status})`);
      }
      return data;
    } catch (err) {
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
  }
};

