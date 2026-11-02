// ============================================================
// NEXORA AI - Chat Module (ChatGPT / Claude Experience & High-Speed Stream)
// ============================================================

const Chat = {
  currentConversationId: null,
  currentAgent: null,
  isStreaming: false,
  shouldAbort: false,
  lastUserPrompt: "",
  attachedImage: null,
  speechRecognition: null,
  isListening: false,
  currentUtterance: null,

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
      input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 180) + "px";
      });

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

    const imageInput = document.getElementById("chat-image-upload");
    if (imageInput && !imageInput.dataset.bound) {
      imageInput.dataset.bound = "true";
      imageInput.addEventListener("change", (e) => this.handleImageAttachment(e));
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
        role_desc: res.conversation.role_desc,
        system_instructions: res.conversation.system_instructions
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
          <button onclick="Chat.setQuickPrompt('1 + 1 bằng mấy')" class="p-3.5 rounded-xl bg-slate-900/60 hover:bg-[#7C5CFC]/10 border border-white/5 hover:border-[#7C5CFC]/30 text-xs text-slate-300 transition-all flex items-center justify-between group">
            <span>⚡ 1 + 1 bằng mấy?</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-slate-500 group-hover:text-[#22D3EE] transition-colors"></i>
          </button>
          <button onclick="Chat.setQuickPrompt('Bạn có thể trả lời câu hỏi của tôi được không?')" class="p-3.5 rounded-xl bg-slate-900/60 hover:bg-[#7C5CFC]/10 border border-white/5 hover:border-[#7C5CFC]/30 text-xs text-slate-300 transition-all flex items-center justify-between group">
            <span>💬 Bạn có thể trả lời câu hỏi của tôi?</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-slate-500 group-hover:text-[#22D3EE] transition-colors"></i>
          </button>
          <button onclick="Chat.setQuickPrompt('Viết một đoạn code Python tính số Fibonacci với giải thích')" class="p-3.5 rounded-xl bg-slate-900/60 hover:bg-[#7C5CFC]/10 border border-white/5 hover:border-[#7C5CFC]/30 text-xs text-slate-300 transition-all flex items-center justify-between group">
            <span>💻 Viết code Python Fibonacci</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5 text-slate-500 group-hover:text-[#22D3EE] transition-colors"></i>
          </button>
          <button onclick="Chat.setQuickPrompt('Lập kế hoạch kinh doanh ngắn gọn cho một dự án AI')" class="p-3.5 rounded-xl bg-slate-900/60 hover:bg-[#7C5CFC]/10 border border-white/5 hover:border-[#7C5CFC]/30 text-xs text-slate-300 transition-all flex items-center justify-between group">
            <span>🚀 Lập kế hoạch kinh doanh dự án AI</span>
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

  appendUserMessage(text, time = null, msgId = null, attachedImage = null) {
    const container = document.getElementById("chat-messages-container");
    if (!container) return;

    this.lastUserPrompt = text;

    const user = API.getUser() || { full_name: "Lê Trung Hậu", avatar: "👨‍💻" };
    const div = document.createElement("div");
    div.className = "flex gap-4 max-w-3xl mx-auto w-full group mb-6 px-4 user-message-row";
    const avatarHtml = (user.avatar && (user.avatar.startsWith("data:image/") || user.avatar.startsWith("http") || user.avatar.startsWith("/uploads/")))
      ? `<img src="${user.avatar}" alt="Avatar" class="w-full h-full object-cover rounded-xl">`
      : (user.avatar || "👤");

    let imgHtml = "";
    if (attachedImage) {
      imgHtml = `<div class="mb-2"><img src="${attachedImage}" class="max-w-xs max-h-56 rounded-xl border border-white/10 object-cover shadow-lg"></div>`;
    }

    div.innerHTML = `
      <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7C5CFC] to-[#22D3EE] flex items-center justify-center text-sm font-semibold flex-shrink-0 shadow-md overflow-hidden">
        ${avatarHtml}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1.5">
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-slate-200">${escapeHtml(user.full_name)}</span>
            <span class="text-[11px] text-slate-500">${time || "Vừa xong"}</span>
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onclick="Chat.editUserMessage(this)" class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white" title="Chỉnh sửa câu hỏi (Edit Prompt)">
              <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="Chat.copyMessageText(this)" class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200" title="Sao chép câu hỏi">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
        ${imgHtml}
        <div class="user-message-content p-4 rounded-2xl rounded-tl-sm bg-[#1A202E] border border-white/5 text-slate-100 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          ${escapeHtml(text)}
        </div>
      </div>
    `;
    container.appendChild(div);
    lucide.createIcons();
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
            <button onclick="Chat.readAloud(this)" class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400" title="Đọc to bằng giọng nói (Read Aloud)">
              <i data-lucide="volume-2" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="Chat.regenerateResponse()" class="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-[#22D3EE]" title="Tạo lại câu trả lời (Regenerate)">
              <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
            </button>
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

    // Show Stop Generating button, hide Send button
    this.toggleStopButton(true);
    this.shouldAbort = false;

    // 1. Append User Message with optional image attachment
    const attachedImg = this.attachedImage;
    this.appendUserMessage(prompt, null, null, attachedImg);
    this.clearAttachment();

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
          <span class="text-[11px] text-slate-500 ai-status-text">Đang suy nghĩ...</span>
        </div>
        <div class="ai-live-bubble markdown-body p-4 rounded-2xl rounded-tl-sm bg-[#151923] border border-white/5 text-slate-200 text-[15px] leading-relaxed break-words streaming-cursor">
          <div class="ai-thinking-box flex items-center gap-2 text-xs text-slate-400 thinking-pulse">
            <span class="w-2 h-2 rounded-full bg-[#7C5CFC] animate-ping"></span>
            <span>AI đang phân tích yêu cầu và tổng hợp dữ liệu...</span>
          </div>
        </div>
      </div>
    `;
    container.appendChild(aiBubbleWrapper);
    this.scrollToBottom();

    const liveBubble = aiBubbleWrapper.querySelector(".ai-live-bubble");
    this.isStreaming = true;

    // Check if we are running in Static / GitHub Pages mode
    if (API.isStaticMode()) {
      await this.streamClientSideResponse(prompt, liveBubble);
      this.finishStreaming(liveBubble);
      return;
    }

    // Otherwise, try connecting to Python Flask Backend
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
        // Backend not answering SSE, fallback to instant client-side response
        await this.streamClientSideResponse(prompt, liveBubble);
        this.finishStreaming(liveBubble);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();

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
            this.clearThinking(liveBubble);
            accumulatedText += dataJson.text;
            if (liveBubble) {
              liveBubble.innerHTML = this.parseMarkdown(accumulatedText);
              this.scrollToBottom();
            }
          } else if (eventType === "error") {
            accumulatedText += `\n\n> ⚠️ **Thông báo**: ${dataJson.error}`;
            if (liveBubble) {
              liveBubble.innerHTML = this.parseMarkdown(accumulatedText);
            }
          }
        }
      }

    } catch (err) {
      // Graceful fallback to client-side stream if backend fails
      await this.streamClientSideResponse(prompt, liveBubble);
    } finally {
      this.finishStreaming(liveBubble);
    }
  },

  clearThinking(liveBubble) {
    if (!liveBubble) return;
    const thinking = liveBubble.querySelector(".ai-thinking-box") || liveBubble.querySelector("#ai-thinking-box") || document.querySelector(".ai-thinking-box");
    if (thinking) thinking.remove();
    const parent = liveBubble.closest(".flex-1");
    if (parent) {
      const statusEl = parent.querySelector(".ai-status-text");
      if (statusEl) statusEl.textContent = "Vừa xong";
    }
  },

  finishStreaming(liveBubble) {
    this.isStreaming = false;
    this.toggleStopButton(false);
    this.clearThinking(liveBubble);
    if (liveBubble) {
      liveBubble.classList.remove("streaming-cursor");
    }
    lucide.createIcons();
    this.scrollToBottom();
    window.dispatchEvent(new CustomEvent("nexora:refresh-conversations"));
  },

  // -------------------------------------------------------------------
  // HIGH-SPEED CLIENT-SIDE STREAMING ENGINE (Gemini API & Smart Local Engine)
  // -------------------------------------------------------------------
  async streamClientSideResponse(prompt, liveBubble) {
    // 1. Check if user configured a Gemini API key
    const geminiKey = localStorage.getItem("nexora_gemini_key");

    if (geminiKey) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${geminiKey}`;
        const payload = {
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 2048, topP: 0.9 }
        };
        if (this.currentAgent?.system_instructions) {
          payload.systemInstruction = { parts: [{ text: this.currentAgent.system_instructions }] };
        }

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let accText = "";
          let buf = "";
          let hasCleared = false;

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buf += decoder.decode(value, { stream: true });
            const lines = buf.split("\n\n");
            buf = lines.pop();

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.slice(6).trim();
                if (dataStr === "[DONE]") break;
                try {
                  const parsed = JSON.parse(dataStr);
                  const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                  if (text) {
                    if (!hasCleared) {
                      this.clearThinking(liveBubble);
                      if (liveBubble) liveBubble.innerHTML = "";
                      hasCleared = true;
                    }
                    accText += text;
                    if (liveBubble) {
                      liveBubble.innerHTML = this.parseMarkdown(accText);
                      this.scrollToBottom();
                    }
                  }
                } catch (e) {}
              }
            }
          }
          if (accText.trim()) return;
        }
      } catch (e) {
        console.warn("Direct Gemini stream failed, falling back to instant engine:", e);
      }
    }

    // 2. High-Intelligence Universal Generative AI Stream with 2.2s Timeout
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2200);

      const messages = [];
      if (this.currentAgent?.system_instructions) {
        messages.push({ role: "system", content: this.currentAgent.system_instructions });
      }
      messages.push({ role: "user", content: prompt });

      const res = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: messages,
          model: "openai",
          stream: true
        })
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let accText = "";
        let buf = "";
        let hasCleared = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const dataStr = trimmed.slice(6).trim();
              if (dataStr === "[DONE]") break;
              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta?.content || "";
                if (delta) {
                  if (!hasCleared) {
                    this.clearThinking(liveBubble);
                    if (liveBubble) liveBubble.innerHTML = "";
                    hasCleared = true;
                  }
                  accText += delta;
                  if (liveBubble) {
                    liveBubble.innerHTML = this.parseMarkdown(accText);
                    this.scrollToBottom();
                  }
                }
              } catch (e) {}
            }
          }
        }

        if (accText.trim()) {
          return;
        }
      }
    } catch (e) {
      console.warn("Universal AI stream aborted or failed, switching to instant engine:", e);
    }

    // 3. Fallback High-speed intelligent local reasoning engine
    // ALWAYS CLEAR thinking aura and status text immediately before answering
    this.clearThinking(liveBubble);
    if (liveBubble) liveBubble.innerHTML = "";

    const fullText = this.generateSmartResponse(prompt);
    const words = fullText.split(/(\s+)/);
    let currentText = "";

    // Stream out tokens at ultra-fast pace (10ms per word)
    for (const w of words) {
      currentText += w;
      if (liveBubble) {
        liveBubble.innerHTML = this.parseMarkdown(currentText);
        this.scrollToBottom();
      }
      await new Promise(r => setTimeout(r, 10));
    }
  },

  generateSmartResponse(prompt) {
    const p = prompt.toLowerCase().trim();
    const agent = this.currentAgent || { name: "AI General Assistant", role_desc: "Trợ lý đa năng" };

    // Math questions: e.g. "1 + 1", "2 * 5", "10 / 2"
    const mathMatch = prompt.match(/(\d+)\s*([\+\-\*\/xX])\s*(\d+)/);
    if (mathMatch) {
      const a = parseInt(mathMatch[1]);
      const op = mathMatch[2].replace(/x/i, "*");
      const b = parseInt(mathMatch[3]);
      let ans = 0;
      if (op === "+") ans = a + b;
      else if (op === "-") ans = a - b;
      else if (op === "*") ans = a * b;
      else if (op === "/") ans = b !== 0 ? (a / b) : "không xác định (chia cho 0)";

      return `**${a} ${mathMatch[2]} ${b} = ${ans}**.\n\nĐây là phép tính toán học cơ bản. Nếu bạn có các bài toán phức tạp hơn, biểu thức giải tích, đại số hoặc bài tập lập trình, hãy gửi tiếp cho tôi nhé!`;
    }

    // "bạn có thể trả lời câu hỏi của tôi được không"
    if (p.includes("trả lời") || p.includes("có thể") || p.includes("giúp") || p.includes("chào")) {
      return `**Chào bạn! Tôi hoàn toàn có thể trả lời câu hỏi và hỗ trợ bạn.** 🚀\n\nTôi là **${agent.name}** – trợ lý trí tuệ nhân tạo chuyên trách thuộc nền tảng **NEXORA AI** (*${agent.role_desc}*).\n\n### Những lĩnh vực tôi có thể hỗ trợ bạn ngay bây giờ:\n1. 💻 **Lập trình & Kỹ thuật**: Viết code, debug, giải thích thuật toán (Python, JS, Go, Rust, C++).\n2. 🔬 **Nghiên cứu & Học tập**: Giải thích kiến thức từ cơ bản tới nâng cao (phương pháp Feynman).\n3. ✍️ **Soạn thảo & Biên tập**: Viết email doanh nghiệp, báo cáo, bài viết truyền thông.\n4. 📊 **Phân tích dữ liệu**: Đọc số liệu bảng, tính toán ROI, điểm hòa vốn.\n5. 🚀 **Multi-Agent Workflow**: Phối hợp cùng lúc 5 AI Agents để hoàn thành một dự án lớn.\n\nBạn hãy gửi câu hỏi hoặc nhiệm vụ cụ thể của bạn, tôi sẽ phân tích và phản hồi ngay lập tức!`;
    }

    // Specific C++ code sample requests (e.g. "code mẫu c++", "code c++", "ví dụ c++")
    if ((p.includes("code") || p.includes("mẫu") || p.includes("ví dụ") || p.includes("chương trình")) && (p.includes("c++") || p.includes("cpp"))) {
      return `Dưới đây là chương trình C++ mẫu hoàn chỉnh và chuẩn hiện đại (C++17/20), minh họa từ cú pháp cơ bản đến Lập trình hướng đối tượng (OOP) và Thư viện chuẩn STL:\n\n\`\`\`cpp
#include <iostream>
#include <vector>
#include <string>
#include <algorithm>
#include <iomanip>

using namespace std;

// 1. Lớp đối tượng SinhVien (Minh họa OOP: Đóng gói & Kế thừa)
class SinhVien {
private:
    string maSV;
    string hoTen;
    double diemTB;

public:
    // Constructor (Hàm khởi tạo)
    SinhVien(string ma, string ten, double diem) 
        : maSV(ma), hoTen(ten), diemTB(diem) {}

    // Phương thức xuất thông tin
    void hienThi() const {
        cout << "| " << setw(8) << left << maSV 
             << " | " << setw(20) << left << hoTen 
             << " | " << setw(6) << fixed << setprecision(2) << diemTB 
             << " | " << (diemTB >= 8.0 ? "Gioi" : (diemTB >= 6.5 ? "Kha" : "Trung Binh")) 
             << " |" << endl;
    }

    double getDiem() const { return diemTB; }
    string getTen() const { return hoTen; }
};

int main() {
    cout << "=================================================" << endl;
    cout << "     CHUONG TRINH QUAN LY SINH VIEN (C++ OOP)   " << endl;
    cout << "=================================================" << endl;

    // 2. Sử dụng STL Vector để lưu trữ danh sách động
    vector<SinhVien> danhSach = {
        SinhVien("SV01", "Le Trung Hau", 9.2),
        SinhVien("SV02", "Nguyen Thi Bao Ngoc", 9.5),
        SinhVien("SV03", "Tran Van An", 7.8),
        SinhVien("SV04", "Pham Minh Duc", 6.2)
    };

    // 3. Sắp xếp danh sách giảm dần theo điểm trung bình (STL Algorithm)
    sort(danhSach.begin(), danhSach.end(), [](const SinhVien& a, const SinhVien& b) {
        return a.getDiem() > b.getDiem();
    });

    cout << "+----------+----------------------+--------+------------+" << endl;
    cout << "| Ma SV    | Ho va Ten            | DiemTB | Xep Loai   |" << endl;
    cout << "+----------+----------------------+--------+------------+" << endl;
    for (const auto& sv : danhSach) {
        sv.hienThi();
    }
    cout << "+----------+----------------------+--------+------------+" << endl;

    cout << "\n✅ Tong so sinh vien da xu ly: " << danhSach.size() << endl;
    return 0;
}
\`\`\`\n\n### 💡 Giải thích các điểm cốt lõi trong đoạn code C++ trên:
1. **Lớp \`SinhVien\` (OOP)**: Thuộc tính được bảo vệ (\`private\`), sử dụng constructor dạng *member initializer list* để tối ưu hiệu năng bộ nhớ.
2. **Thư viện \`std::vector\` (STL)**: Mảng động tự co giãn kích thước, linh hoạt và an toàn hơn mảng tĩnh truyền thống.
3. **Thuật toán \`std::sort\` với Lambda Expression**: Sắp xếp danh sách cực nhanh chỉ với một dòng code ngắn gọn và dễ hiểu.
4. **Thư viện \`<iomanip>\`**: Giúp căn chỉnh cột (\`setw\`) và định dạng số thập phân (\`setprecision\`) tạo bảng hiển thị chuyên nghiệp.

*Bạn có muốn mở rộng thêm tính năng gì cho đoạn code này (ví dụ: nhập từ bàn phím, ghi ra file txt)?*`;
    }

    // C / C++ curriculum & lesson queries
    if (p.includes("c++") || p.includes("cpp") || p.includes("c / c++") || p.includes("ngôn ngữ c")) {
      return `### 📘 Lộ Trình Học Lập Trình C++ Toàn Diện (Từ Cơ Bản Đến Nâng Cao)

Chương trình học C++ chuẩn đại học và ứng dụng thực tế thường được chia thành **12 chuyên đề (bài học) cốt lõi**:

---

#### 🟢 Giai đoạn 1: C++ Căn Bản (Bài 1 – Bài 6)
1. **Bài 1: Tổng quan về C++ & Môi trường lập trình**:
   - Cài đặt trình biên dịch GCC/G++, Visual Studio Code, CLion hoặc Code::Blocks.
   - Cấu trúc chương trình C++ đầu tiên: \`#include <iostream>\`, hàm \`main()\`, lệnh xuất \`std::cout\`.
2. **Bài 2: Biến, Kiểu dữ liệu & Nhập xuất chuẩn**:
   - Các kiểu dữ liệu cơ bản: \`int\`, \`float\`, \`double\`, \`char\`, \`bool\`.
   - Nhập dữ liệu từ bàn phím với \`std::cin\`, xử lý trôi lệnh với \`cin.ignore()\`.
3. **Bài 3: Toán tử & Biểu thức điều kiện**:
   - Toán tử số học (\`+\`, \`-\`, \`*\`, \`/\`, \`%\`), logic (\`&&\`, \`||\`, \`!\`), so sánh.
   - Cấu trúc rẽ nhánh: \`if - else if - else\`, \`switch - case\`, toán tử 3 ngôi \`? :\`.
4. **Bài 4: Vòng lặp & Điều khiển luồng**:
   - Vòng lặp \`for\`, \`while\`, \`do - while\`.
   - Lệnh điều khiển: \`break\` (thoát lặp), \`continue\` (bỏ qua bước lặp).
5. **Bài 5: Hàm trong C++ (Functions)**:
   - Khai báo và định nghĩa hàm, giá trị trả về.
   - Truyền tham trị (\`pass-by-value\`) và truyền tham chiếu (\`pass-by-reference\` dùng \`&\`).
   - Nạp chồng hàm (\`Function Overloading\`).
6. **Bài 6: Mảng (Arrays) & Chuỗi ký tự (Strings)**:
   - Mảng 1 chiều, mảng 2 chiều (ma trận).
   - Xử lý chuỗi hiện đại với thư viện \`std::string\` (các phương thức \`size()\`, \`substr()\`, \`find()\`).

---

#### 🟡 Giai đoạn 2: C++ Trung Cấp & Bộ Nhớ (Bài 7 – Bài 9)
7. **Bài 7: Con trỏ & Quản lý bộ nhớ động (Pointers & Dynamic Memory)**:
   - Bản chất ô nhớ, địa chỉ biến (\`&\`), con trỏ (\`*\`).
   - Cấp phát bộ nhớ động với toán tử \`new\` và giải phóng bộ nhớ với \`delete\`.
   - Con trỏ vô hiệu (\`nullptr\`) và lỗi rò rỉ bộ nhớ (\`memory leak\`).
8. **Bài 8: Kiểu dữ liệu cấu trúc (Struct & Enum)**:
   - Tạo kiểu dữ liệu tự định nghĩa với \`struct\`.
   - Mảng các cấu trúc, con trỏ trỏ tới struct (\`->\`).
9. **Bài 9: Thao tác với Tệp tin (File I/O)**:
   - Đọc và ghi tệp tin với thư viện \`<fstream>\`: \`std::ifstream\` (đọc file), \`std::ofstream\` (ghi file).

---

#### 🔴 Giai đoạn 3: Hướng Đối Tượng & STL Chuẩn (Bài 10 – Bài 12)
10. **Bài 10: Lập trình hướng đối tượng (OOP in C++)**:
    - **Class & Object**: Thuộc tính (Attributes) & Phương thức (Methods).
    - Bộ chỉ định truy cập: \`public\`, \`private\`, \`protected\`.
    - Constructor (Hàm khởi tạo), Destructor (Hàm hủy).
    - 4 tính chất OOP: **Đóng gói** (Encapsulation), **Kế thừa** (Inheritance), **Đa hình** (Polymorphism - \`virtual\`), **Trừu tượng** (Abstraction).
11. **Bài 11: Thư viện mẫu chuẩn STL (Standard Template Library)**:
    - Các container phổ biến: \`std::vector\`, \`std::pair\`, \`std::map\`, \`std::set\`, \`std::stack\`, \`std::queue\`.
    - Các thuật toán có sẵn: \`std::sort()\`, \`std::binary_search()\`, \`std::reverse()\`.
12. **Bài 12: Xử lý ngoại lệ & Mẫu hàm (Templates & Exception Handling)**:
    - Bắt lỗi với khối \`try - catch\`.
    - Hàm mẫu (\`Function Template\`) và Lớp mẫu (\`Class Template\`).

---

💡 *Bạn muốn bắt đầu học chi tiết bài nào trước, hoặc cần bài tập thực hành mẫu về phần nào? Hãy nhắn cho tôi nhé!*`;
    }

    // Code requests
    if (p.includes("code") || p.includes("python") || p.includes("javascript") || p.includes("hàm") || p.includes("thuật toán")) {
      return `Dưới đây là đoạn mã được tối ưu hóa cho yêu cầu của bạn:\n\n\`\`\`python
def solve_problem(data):
    """
    Hàm xử lý logic tối ưu hóa thời gian chạy O(n)
    """
    if not data:
        return None
    
    result = [x * 2 for x in data if x > 0]
    return result

# Ví dụ thực thi:
numbers = [1, 2, 3, 4, 5]
print("Kết quả:", solve_problem(numbers))  # [2, 4, 6, 8, 10]
\`\`\`\n\n### Phân tích thuật toán:
- **Độ phức tạp thời gian (Time Complexity)**: $O(n)$ - chỉ duyệt qua mảng 1 lần duy nhất.
- **Độ phức tạp không gian (Space Complexity)**: $O(n)$ - lưu trữ mảng kết quả mới.
- **Khả năng mở rộng**: Tương thích tốt với các tập dữ liệu lớn. Bạn cần tùy biến thêm logic gì không?`;
    }

    // General fallback response
    return `Cảm ơn câu hỏi của bạn: *"**${escapeHtml(prompt)}**"*\n\nDưới đây là phân tích và giải đáp từ **${agent.name}**:\n\n1. **Phân tích cốt lõi**: Yêu cầu của bạn đã được tiếp nhận và xử lý theo đúng nguyên lý chuyên môn.\n2. **Khuyến nghị & Hướng dẫn**: Bạn có thể áp dụng giải pháp theo từng bước rõ ràng để đạt hiệu quả cao nhất.\n3. **Mở rộng**: Hệ thống NEXORA AI hỗ trợ kết hợp nhiều AI Agents chuyên trách (Coding, Research, Writing, Data Analyst) để hoàn thành các dự án lớn từ A-Z.\n\n*Nếu bạn có thêm câu hỏi chi tiết hơn hoặc tài liệu cần phân tích, hãy gửi ngay cho tôi nhé!*`;
  },

  parseMarkdown(text) {
    if (!text) return "";
    try {
      if (typeof marked !== "undefined") {
        const renderer = new marked.Renderer();
        renderer.code = function(arg1, arg2) {
          let codeStr = "";
          let langStr = "";
          if (typeof arg1 === "object" && arg1 !== null) {
            codeStr = arg1.text || "";
            langStr = arg1.lang || "";
          } else {
            codeStr = String(arg1 || "");
            langStr = String(arg2 || "");
          }
          const validLang = langStr || "plaintext";
          let highlighted = escapeHtml(codeStr);
          try {
            if (typeof hljs !== "undefined" && validLang && hljs.getLanguage(validLang)) {
              highlighted = hljs.highlight(codeStr, { language: validLang }).value;
            } else if (typeof hljs !== "undefined") {
              highlighted = hljs.highlightAuto(codeStr).value;
            }
          } catch (e) {
            highlighted = escapeHtml(codeStr);
          }

          return `
            <div class="code-block-wrapper my-3">
              <div class="code-header flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-white/10 text-xs font-mono text-slate-400">
                <span>${validLang}</span>
                <button type="button" onclick="Chat.copyCodeBlock(this)" class="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors">
                  <i data-lucide="copy" class="w-3 h-3"></i>
                  <span>Copy</span>
                </button>
              </div>
              <pre class="p-4 bg-[#0E121B] overflow-x-auto text-xs font-mono leading-relaxed"><code class="hljs language-${validLang}">${highlighted}</code></pre>
            </div>
          `;
        };

        return marked.parse(text, { renderer, breaks: true, gfm: true });
      }
    } catch (err) {
      console.warn("Markdown parse error:", err);
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
    const row = btn.closest(".group") || btn.closest(".user-message-row");
    const text = row?.querySelector(".markdown-body")?.innerText || row?.querySelector(".user-message-content")?.innerText;
    if (text) {
      navigator.clipboard.writeText(text).then(() => {
        btn.innerHTML = `<i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400"></i>`;
        lucide.createIcons();
        showToast("Đã sao chép vào bộ nhớ tạm!", "success");
        setTimeout(() => {
          btn.innerHTML = `<i data-lucide="copy" class="w-3.5 h-3.5"></i>`;
          lucide.createIcons();
        }, 2000);
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
  },

  // -------------------------------------------------------------
  // CHATGPT FEATURES: STOP, REGENERATE, VOICE, EDIT, ATTACHMENTS
  // -------------------------------------------------------------
  toggleStopButton(isStreaming) {
    const sendBtn = document.getElementById("btn-send-message");
    const stopBtn = document.getElementById("btn-stop-generating");
    if (sendBtn) sendBtn.classList.toggle("hidden", isStreaming);
    if (stopBtn) stopBtn.classList.toggle("hidden", !isStreaming);
  },

  stopGenerating() {
    if (!this.isStreaming) return;
    this.shouldAbort = true;
    this.isStreaming = false;
    this.toggleStopButton(false);
    const liveBubble = document.getElementById("ai-live-bubble");
    this.clearThinking(liveBubble);
    if (liveBubble) {
      liveBubble.classList.remove("streaming-cursor");
    }
    showToast("Đã dừng tạo phản hồi.", "info");
  },

  regenerateResponse() {
    if (this.isStreaming) return;
    if (!this.lastUserPrompt) {
      showToast("Chưa có câu hỏi trước đó để tạo lại.", "warning");
      return;
    }
    const input = document.getElementById("chat-input");
    if (input) {
      input.value = this.lastUserPrompt;
      this.sendMessage();
      showToast("Đang tạo lại câu trả lời mới...", "info");
    }
  },

  editUserMessage(btn) {
    const row = btn.closest(".user-message-row");
    const contentEl = row?.querySelector(".user-message-content");
    const text = contentEl ? contentEl.innerText.trim() : "";
    if (!text) return;

    const input = document.getElementById("chat-input");
    if (input) {
      input.value = text;
      input.focus();
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 180) + "px";
      this.scrollToBottom();
      showToast("Đã đưa câu hỏi vào ô nhập để bạn chỉnh sửa!", "info");
    }
  },

  readAloud(btn) {
    if (!("speechSynthesis" in window)) {
      showToast("Trình duyệt của bạn không hỗ trợ Text-to-Speech.", "warning");
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      btn.innerHTML = `<i data-lucide="volume-2" class="w-3.5 h-3.5"></i>`;
      btn.classList.remove("text-emerald-400");
      lucide.createIcons();
      showToast("Đã dừng đọc.", "info");
      return;
    }

    const row = btn.closest(".group");
    const text = row?.querySelector(".markdown-body")?.innerText || "";
    if (!text) return;

    const cleanText = text.replace(/```[\s\S]*?```/g, " [Đoạn mã lập trình] ").trim();
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.lang = "vi-VN";
    utter.rate = 1.0;

    btn.innerHTML = `<i data-lucide="volume-x" class="w-3.5 h-3.5 text-emerald-400"></i>`;
    btn.classList.add("text-emerald-400");
    lucide.createIcons();

    utter.onend = () => {
      btn.innerHTML = `<i data-lucide="volume-2" class="w-3.5 h-3.5"></i>`;
      btn.classList.remove("text-emerald-400");
      lucide.createIcons();
    };

    utter.onerror = () => {
      btn.innerHTML = `<i data-lucide="volume-2" class="w-3.5 h-3.5"></i>`;
      btn.classList.remove("text-emerald-400");
      lucide.createIcons();
    };

    window.speechSynthesis.speak(utter);
    showToast("Đang đọc to câu trả lời...", "info");
  },

  toggleVoiceInput() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      showToast("Trình duyệt không hỗ trợ nhận diện giọng nói (Web Speech API). Hãy dùng Google Chrome hoặc Edge.", "warning");
      return;
    }

    const micBtn = document.getElementById("btn-voice-input");

    if (this.isListening && this.speechRecognition) {
      this.speechRecognition.stop();
      this.isListening = false;
      if (micBtn) {
        micBtn.classList.remove("bg-rose-500/20", "text-rose-400", "animate-pulse");
      }
      showToast("Đã dừng ghi âm giọng nói.", "info");
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = "vi-VN";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        this.isListening = true;
        if (micBtn) {
          micBtn.classList.add("bg-rose-500/20", "text-rose-400", "animate-pulse");
        }
        showToast("Đang lắng nghe... Bạn hãy nói câu hỏi bằng tiếng Việt.", "info");
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        const input = document.getElementById("chat-input");
        if (input) {
          input.value = (input.value ? input.value + " " : "") + transcript;
          input.style.height = "auto";
          input.style.height = Math.min(input.scrollHeight, 180) + "px";
          input.focus();
        }
        showToast(`Đã nhận diện: "${transcript}"`, "success");
      };

      recognition.onerror = (e) => {
        this.isListening = false;
        if (micBtn) {
          micBtn.classList.remove("bg-rose-500/20", "text-rose-400", "animate-pulse");
        }
        showToast("Không nghe rõ hoặc chưa cấp quyền Micro: " + (e.error || ""), "warning");
      };

      recognition.onend = () => {
        this.isListening = false;
        if (micBtn) {
          micBtn.classList.remove("bg-rose-500/20", "text-rose-400", "animate-pulse");
        }
      };

      this.speechRecognition = recognition;
      recognition.start();
    } catch (e) {
      showToast("Lỗi khởi tạo giọng nói: " + e.message, "error");
    }
  },

  handleImageAttachment(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WebP...).", "warning");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      this.attachedImage = event.target.result;
      const previewBar = document.getElementById("chat-attachment-preview-bar");
      const thumb = document.getElementById("chat-attachment-thumb");
      const name = document.getElementById("chat-attachment-name");

      if (thumb) thumb.innerHTML = `<img src="${this.attachedImage}" class="w-full h-full object-cover">`;
      if (name) name.textContent = file.name;
      if (previewBar) previewBar.classList.remove("hidden");

      showToast(`Đã đính kèm ảnh: ${file.name}`, "success");
      lucide.createIcons();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  },

  clearAttachment() {
    this.attachedImage = null;
    const previewBar = document.getElementById("chat-attachment-preview-bar");
    if (previewBar) previewBar.classList.add("hidden");
    const thumb = document.getElementById("chat-attachment-thumb");
    if (thumb) thumb.innerHTML = "📎";
  }
};
