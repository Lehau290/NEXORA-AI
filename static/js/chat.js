// ============================================================
// NEXORA AI - Chat Module (ChatGPT / Claude Experience)
// ============================================================

const Chat = {
  currentConversationId: null,
  currentAgent: null,
  isStreaming: false,

  async init(convId = null, agentId = null) {
    if (convId) {
      await this.loadConversation(convId);
    } else if (agentId) {
      await this.startNewWithAgent(agentId);
    } else {
      await this.startNewWithDefaultAgent();
    }
    this.bindEvents();
  },

  bindEvents() {
    const input = document.getElementById("chat-input");
    const sendBtn = document.getElementById("btn-send-message");
    const attachBtn = document.getElementById("btn-attach-file");
    const fileInput = document.getElementById("chat-file-upload");

    if (input && !input.dataset.bound) {
      input.dataset.bound = "true";
      // Auto-grow textarea
      input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 180) + "px";
      });

      // Enter to send, Shift+Enter for newline
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    if (sendBtn && !sendBtn.dataset.bound) {
      sendBtn.dataset.bound = "true";
      sendBtn.addEventListener("click", () => this.sendMessage());
    }

    if (attachBtn && fileInput && !attachBtn.dataset.bound) {
      attachBtn.dataset.bound = "true";
      attachBtn.addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (e) => this.handleFileAttachment(e));
    }
  },

  async startNewWithDefaultAgent() {
    try {
      const res = await API.get("/api/agents");
      const general = res.agents?.find(a => a.slug === "general-assistant") || res.agents?.[0];
      if (general) {
        await this.startNewWithAgent(general.id);
      }
    } catch (e) {
      console.error(e);
    }
  },

  async startNewWithAgent(agentId) {
    try {
      const res = await API.get(`/api/agents/${agentId}`);
      this.currentAgent = res.agent;
      this.currentConversationId = null;
      this.renderHeader();
      this.clearMessages();
      this.renderWelcomeScreen();
    } catch (e) {
      showToast("Không thể tải thông tin Agent", "error");
    }
  },

  async loadConversation(convId) {
    try {
      const res = await API.get(`/api/chat/conversations/${convId}`);
      this.currentConversationId = res.conversation.id;
      this.currentAgent = {
        id: res.conversation.agent_id,
        name: res.conversation.agent_name,
        avatar: res.conversation.agent_avatar,
        slug: res.conversation.agent_slug,
        description: res.conversation.agent_description,
        ai_model: res.conversation.ai_model,
        role_desc: res.conversation.role_desc
      };

      this.renderHeader(res.conversation.title, res.conversation.is_favorite);
      this.renderMessages(res.messages || []);
    } catch (e) {
      showToast("Không thể tải cuộc trò chuyện", "error");
    }
  },

  renderHeader(title = null, isFav = false) {
    const avatarEl = document.getElementById("chat-agent-avatar");
    const nameEl = document.getElementById("chat-agent-name");
    const modelBadgeEl = document.getElementById("chat-model-badge");
    const favBtn = document.getElementById("btn-favorite-chat");
    const titleEl = document.getElementById("chat-header-title");

    if (this.currentAgent) {
      if (avatarEl) avatarEl.textContent = this.currentAgent.avatar || "🤖";
      if (nameEl) nameEl.textContent = this.currentAgent.name || "AI Assistant";
      if (modelBadgeEl) modelBadgeEl.textContent = this.currentAgent.ai_model || "gemini-2.0-flash";
    }

    if (titleEl) {
      titleEl.textContent = title || "Cuộc trò chuyện mới";
    }

    if (favBtn) {
      favBtn.innerHTML = isFav 
        ? `<i data-lucide="star" class="w-4 h-4 fill-amber-400 text-amber-400"></i>` 
        : `<i data-lucide="star" class="w-4 h-4 text-slate-400"></i>`;
      lucide.createIcons();
    }
  },

  clearMessages() {
    const container = document.getElementById("chat-messages-container");
    if (container) container.innerHTML = "";
  },

  renderWelcomeScreen() {
    const container = document.getElementById("chat-messages-container");
    if (!container || !this.currentAgent) return;

    container.innerHTML = `
      <div class="flex flex-col items-center justify-center min-h-[50vh] text-center px-4 py-8 max-w-xl mx-auto view-transition">
        <div class="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#7C5CFC]/20 to-[#22D3EE]/20 border border-[#7C5CFC]/30 flex items-center justify-center text-4xl mb-4 shadow-xl">
          ${this.currentAgent.avatar || "✨"}
        </div>
        <h2 class="text-2xl font-bold mb-2 gradient-text">${this.currentAgent.name}</h2>
        <p class="text-sm text-slate-400 mb-6 leading-relaxed">
          ${this.currentAgent.description || "Hãy nhập câu hỏi bên dưới để bắt đầu tương tác với chuyên gia AI."}
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 w-full text-left">
          <button onclick="Chat.setQuickPrompt('Hãy giải thích nguyên lý hoạt động của hệ thống Multi-Agent AI')" class="p-3.5 rounded-xl bg-slate-900/60 hover:bg-[#7C5CFC]/10 border border-white/5 hover:border-[#7C5CFC]/30 text-xs text-slate-300 transition-all flex items-center justify-between group">
            <span>💡 Giải thích hệ thống Multi-Agent AI</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-slate-500 group-hover:text-[#22D3EE] transition-colors"></i>
          </button>
          <button onclick="Chat.setQuickPrompt('Giúp tôi viết một kế hoạch phát triển ứng dụng SaaS hoàn chỉnh')" class="p-3.5 rounded-xl bg-slate-900/60 hover:bg-[#7C5CFC]/10 border border-white/5 hover:border-[#7C5CFC]/30 text-xs text-slate-300 transition-all flex items-center justify-between group">
            <span>🚀 Lập kế hoạch phát triển SaaS</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-slate-500 group-hover:text-[#22D3EE] transition-colors"></i>
          </button>
          <button onclick="Chat.setQuickPrompt('Tối ưu hóa đoạn code Python sau đây để đạt hiệu năng cao nhất')" class="p-3.5 rounded-xl bg-slate-900/60 hover:bg-[#7C5CFC]/10 border border-white/5 hover:border-[#7C5CFC]/30 text-xs text-slate-300 transition-all flex items-center justify-between group">
            <span>⚡ Tối ưu hóa code & thuật toán</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-slate-500 group-hover:text-[#22D3EE] transition-colors"></i>
          </button>
          <button onclick="Chat.setQuickPrompt('Tóm tắt tài liệu kiến thức và trích xuất các ý chính')" class="p-3.5 rounded-xl bg-slate-900/60 hover:bg-[#7C5CFC]/10 border border-white/5 hover:border-[#7C5CFC]/30 text-xs text-slate-300 transition-all flex items-center justify-between group">
            <span>📚 Phân tích tài liệu & RAG</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-slate-500 group-hover:text-[#22D3EE] transition-colors"></i>
          </button>
        </div>
      </div>
    `;
    lucide.createIcons();
  },

  setQuickPrompt(text) {
    const input = document.getElementById("chat-input");
    if (input) {
      input.value = text;
      input.focus();
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 180) + "px";
    }
  },

  renderMessages(messages) {
    const container = document.getElementById("chat-messages-container");
    if (!container) return;
    container.innerHTML = "";

    messages.forEach(m => {
      if (m.sender_type === "user") {
        this.appendUserMessage(m.content, m.created_at, m.id);
      } else {
        this.appendAssistantMessage(m.content, m.created_at, m.id, m.citations, m.feedback);
      }
    });

    this.scrollToBottom();
  },

  appendUserMessage(text, time = null, msgId = null) {
    const container = document.getElementById("chat-messages-container");
    if (!container) return;

    const user = API.getUser() || { full_name: "Bạn", avatar: "👤" };
    const div = document.createElement("div");
    div.className = "flex gap-4 max-w-3xl mx-auto w-full group mb-6 px-4";
    div.innerHTML = `
      <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7C5CFC] to-[#22D3EE] flex items-center justify-center text-sm font-semibold flex-shrink-0 shadow-md">
        ${user.avatar || "👤"}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-xs font-semibold text-slate-200">${escapeHtml(user.full_name)}</span>
          <span class="text-[11px] text-slate-500">${time || "Vừa xong"}</span>
        </div>
        <div class="p-4 rounded-2xl rounded-tl-sm bg-[#1A202E] border border-white/5 text-slate-100 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          ${escapeHtml(text)}
        </div>
      </div>
    `;
    container.appendChild(div);
    this.scrollToBottom();
  },

  appendAssistantMessage(content, time = null, msgId = null, citations = [], feedback = null) {
    const container = document.getElementById("chat-messages-container");
    if (!container) return;

    const div = document.createElement("div");
    div.className = "flex gap-4 max-w-3xl mx-auto w-full group mb-6 px-4";
    div.id = msgId ? `msg-${msgId}` : "";

    const renderedHtml = this.parseMarkdown(content);
    const citationsHtml = this.buildCitationsBadge(citations);

    div.innerHTML = `
      <div class="w-9 h-9 rounded-xl bg-slate-900 border border-[#7C5CFC]/30 flex items-center justify-center text-lg flex-shrink-0 shadow-lg">
        ${this.currentAgent?.avatar || "✨"}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1.5">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-[#7C5CFC]">${this.currentAgent?.name || "NEXORA AI"}</span>
            <span class="text-[11px] text-slate-500">${time || "Vừa xong"}</span>
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="Chat.copyMessageText(this)" class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Sao chép nội dung">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="Chat.rateFeedback(${msgId}, 'like', this)" class="p-1 rounded hover:bg-slate-800 ${feedback === 'like' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}" title="Hữu ích">
              <i data-lucide="thumbs-up" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="Chat.rateFeedback(${msgId}, 'dislike', this)" class="p-1 rounded hover:bg-slate-800 ${feedback === 'dislike' ? 'text-rose-400' : 'text-slate-400 hover:text-slate-200'}" title="Chưa chính xác">
              <i data-lucide="thumbs-down" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
        ${citationsHtml}
        <div class="markdown-body p-4 rounded-2xl rounded-tl-sm bg-[#151923] border border-white/5 text-slate-200 text-[15px] leading-relaxed break-words">
          ${renderedHtml}
        </div>
      </div>
    `;

    container.appendChild(div);
    lucide.createIcons();
    this.scrollToBottom();
  },

  buildCitationsBadge(citations) {
    if (!citations || !citations.length) return "";
    let html = `<div class="flex flex-wrap gap-1.5 mb-2">`;
    citations.forEach(c => {
      html += `
        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#7C5CFC]/15 text-[#22D3EE] border border-[#7C5CFC]/30">
          <i data-lucide="book-open" class="w-3 h-3"></i>
          ${escapeHtml(c.document_name)}
        </span>
      `;
    });
    html += `</div>`;
    return html;
  },

  async sendMessage() {
    if (this.isStreaming) return;

    const input = document.getElementById("chat-input");
    const prompt = input?.value.trim();
    if (!prompt) return;

    input.value = "";
    input.style.height = "auto";

    // Remove welcome screen if present
    const welcome = document.querySelector("#chat-messages-container .text-center");
    if (welcome) welcome.remove();

    // 1. Append User Message
    this.appendUserMessage(prompt);

    // 2. Append AI Thinking Aura Placeholder
    const container = document.getElementById("chat-messages-container");
    const aiBubbleWrapper = document.createElement("div");
    aiBubbleWrapper.className = "flex gap-4 max-w-3xl mx-auto w-full group mb-6 px-4 view-transition";
    aiBubbleWrapper.innerHTML = `
      <div class="w-9 h-9 rounded-xl bg-slate-900 border border-[#7C5CFC]/30 flex items-center justify-center text-lg flex-shrink-0 shadow-lg">
        ${this.currentAgent?.avatar || "✨"}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="text-xs font-bold text-[#7C5CFC]">${this.currentAgent?.name || "NEXORA AI"}</span>
          <span class="text-[11px] text-slate-500">Đang suy nghĩ...</span>
        </div>
        <div id="ai-live-bubble" class="markdown-body p-4 rounded-2xl rounded-tl-sm bg-[#151923] border border-white/5 text-slate-200 text-[15px] leading-relaxed break-words streaming-cursor">
          <div class="flex items-center gap-2 text-xs text-slate-400 thinking-pulse">
            <span class="w-2 h-2 rounded-full bg-[#7C5CFC] animate-ping"></span>
            <span>AI đang phân tích yêu cầu và tổng hợp dữ liệu...</span>
          </div>
        </div>
      </div>
    `;
    container.appendChild(aiBubbleWrapper);
    this.scrollToBottom();

    const liveBubble = document.getElementById("ai-live-bubble");
    this.isStreaming = true;
    let accumulatedText = "";
    let citations = [];

    try {
      const token = API.getToken();
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id: this.currentConversationId,
          agent_id: this.currentAgent?.id,
          message: prompt
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Lỗi kết nối Server-Sent Events");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop(); // keep last incomplete line

        for (const line of lines) {
          if (!line.trim()) continue;
          const matchEvent = line.match(/^event:\s*(.+)$/m);
          const matchData = line.match(/^data:\s*(.+)$/m);

          const eventType = matchEvent ? matchEvent[1].trim() : "message";
          const dataJson = matchData ? JSON.parse(matchData[1]) : {};

          if (eventType === "init") {
            if (dataJson.conversation_id && !this.currentConversationId) {
              this.currentConversationId = dataJson.conversation_id;
              window.dispatchEvent(new CustomEvent("nexora:conversation-created", { detail: { id: this.currentConversationId } }));
            }
            if (dataJson.citations && dataJson.citations.length) {
              citations = dataJson.citations;
            }
          } else if (eventType === "chunk") {
            accumulatedText += dataJson.text;
            if (liveBubble) {
              liveBubble.innerHTML = this.parseMarkdown(accumulatedText);
              this.scrollToBottom();
            }
          } else if (eventType === "error") {
            accumulatedText += `\n\n> ⚠️ **Lỗi**: ${dataJson.error}`;
            if (liveBubble) {
              liveBubble.innerHTML = this.parseMarkdown(accumulatedText);
            }
          } else if (eventType === "done") {
            // Completed
          }
        }
      }

    } catch (err) {
      if (liveBubble) {
        accumulatedText += `\n\n> ⚠️ **Không thể hoàn thành phản hồi**: ${err.message}`;
        liveBubble.innerHTML = this.parseMarkdown(accumulatedText);
      }
      showToast(err.message, "error");
    } finally {
      this.isStreaming = false;
      if (liveBubble) {
        liveBubble.classList.remove("streaming-cursor");
      }
      lucide.createIcons();
      this.scrollToBottom();
      // Refresh conversation list in sidebar
      window.dispatchEvent(new CustomEvent("nexora:refresh-conversations"));
    }
  },

  parseMarkdown(text) {
    if (typeof marked !== "undefined") {
      // Configure marked with highlight.js
      marked.setOptions({
        highlight: function(code, lang) {
          if (typeof hljs !== "undefined" && lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (__) {}
          }
          return typeof hljs !== "undefined" ? hljs.highlightAuto(code).value : escapeHtml(code);
        },
        breaks: true,
        gfm: true
      });

      // Wrap pre code in custom container with Copy button
      const renderer = new marked.Renderer();
      renderer.code = function({ text, lang }) {
        const validLang = lang || "plaintext";
        let highlighted = text;
        if (typeof hljs !== "undefined" && hljs.getLanguage(validLang)) {
          highlighted = hljs.highlight(text, { language: validLang }).value;
        } else if (typeof hljs !== "undefined") {
          highlighted = hljs.highlightAuto(text).value;
        }

        return `
          <div class="code-block-wrapper my-3">
            <div class="code-header">
              <span>${validLang}</span>
              <button onclick="Chat.copyCodeBlock(this)">
                <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                <span>Copy</span>
              </button>
            </div>
            <pre><code class="hljs language-${validLang}">${highlighted}</code></pre>
          </div>
        `;
      };

      return marked.parse(text, { renderer });
    }
    return escapeHtml(text).replace(/\n/g, "<br>");
  },

  copyCodeBlock(btn) {
    const code = btn.closest(".code-block-wrapper")?.querySelector("code")?.innerText;
    if (code) {
      navigator.clipboard.writeText(code).then(() => {
        const span = btn.querySelector("span");
        if (span) span.textContent = "Copied!";
        setTimeout(() => {
          if (span) span.textContent = "Copy";
        }, 2000);
      });
    }
  },

  copyMessageText(btn) {
    const text = btn.closest(".group")?.querySelector(".markdown-body")?.innerText;
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        showToast("Đã sao chép nội dung!", "success");
      });
    }
  },

  async rateFeedback(msgId, feedback, btn) {
    if (!msgId) return;
    try {
      await API.post(`/api/chat/messages/${msgId}/feedback`, { feedback });
      showToast("Cảm ơn đánh giá của bạn!", "success");
      const parent = btn.parentElement;
      parent.querySelectorAll("button").forEach(b => b.classList.remove("text-emerald-400", "text-rose-400"));
      if (feedback === "like") btn.classList.add("text-emerald-400");
      if (feedback === "dislike") btn.classList.add("text-rose-400");
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  async handleFileAttachment(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast(`Đang tải lên và phân tích ${file.name}...`, "info");
    const formData = new FormData();
    formData.append("file", file);
    if (this.currentAgent?.id) {
      formData.append("agent_id", this.currentAgent.id);
    }

    try {
      const res = await API.post("/api/knowledge/upload", formData);
      showToast(`Đã nạp ${file.name} vào Knowledge Base! AI sẽ tham chiếu tài liệu này.`, "success");
      const input = document.getElementById("chat-input");
      if (input) {
        input.value = `Dựa vào tài liệu '${file.name}', hãy tóm tắt các nội dung cốt lõi nhất.`;
        input.focus();
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      e.target.value = "";
    }
  },

  exportChat(format = "txt") {
    if (!this.currentConversationId) {
      showToast("Chưa có nội dung cuộc trò chuyện để xuất.", "warning");
      return;
    }

    const token = API.getToken();
    if (format === "txt") {
      window.open(`/api/chat/conversations/${this.currentConversationId}/export?format=txt&token=${token}`, "_blank");
    } else if (format === "pdf") {
      window.print();
    }
  },

  scrollToBottom() {
    const container = document.getElementById("chat-scroll-area");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }
};

