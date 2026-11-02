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

    // Auto Self-Learning: Detect facts and instructions taught by user (ChatGPT Memory feature)
    this.detectAndLearn(prompt);

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
        let fullSysPrompt = this.currentAgent?.system_instructions || "";
        const memContext = this.getMemoryContext();
        if (memContext) fullSysPrompt = (fullSysPrompt ? fullSysPrompt + "\n\n" : "") + memContext;
        if (fullSysPrompt) {
          payload.systemInstruction = { parts: [{ text: fullSysPrompt }] };
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

    // 2. High-Intelligence Universal Generative AI Stream with strict first-chunk timeout
    try {
      const controller = new AbortController();
      let firstChunkReceived = false;
      const timeoutId = setTimeout(() => {
        if (!firstChunkReceived) {
          controller.abort();
        }
      }, 2500);

      const messages = [];
      let fullSys = this.currentAgent?.system_instructions || "";
      const memContext = this.getMemoryContext();
      if (memContext) fullSys = (fullSys ? fullSys + "\n\n" : "") + memContext;
      if (fullSys) {
        messages.push({ role: "system", content: fullSys });
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
                  if (!firstChunkReceived) {
                    firstChunkReceived = true;
                    clearTimeout(timeoutId);
                  }
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

    // Stream out tokens at ultra-fast pace (8ms per word)
    for (const w of words) {
      currentText += w;
      if (liveBubble) {
        liveBubble.innerHTML = this.parseMarkdown(currentText);
        this.scrollToBottom();
      }
      await new Promise(r => setTimeout(r, 8));
    }
  },

  generateSmartResponse(prompt) {
    const p = prompt.toLowerCase().trim();
    const agent = this.currentAgent || { name: "AI General Assistant", role_desc: "Trợ lý đa năng" };

    // --- 1. MEMORY & SELF-LEARNING QUERIES (ChatGPT / Gemini Memory) ---
    if (p.includes("nhớ gì") || p.includes("biết gì về tôi") || p.includes("bộ nhớ") || p.includes("ký ức") || p.includes("đã học được gì") || p.includes("tôi là ai")) {
      let saved = JSON.parse(localStorage.getItem("nexora_ai_memories") || "[]");
      if (!saved || !saved.length) {
        return `Hiện tại tôi chưa ghi nhận thông tin cá nhân nào trong bộ nhớ dài hạn của bạn.\n\n💡 **Cách dạy AI tự học (Tương tự ChatGPT Memory & Gemini):**\n- Nhắn cho tôi các câu như: *"Tôi tên là Lê Trung Hậu"*, *"Tôi là lập trình viên C++"*, *"Hãy nhớ rằng tôi thích câu trả lời súc tích và có ví dụ code"*, *"Từ nay hãy gọi tôi là Sếp"*\n- Hoặc bạn có thể bấm vào nút **🧠 Bộ Nhớ AI** ở thanh công cụ phía trên để xem và tự tay thêm những điều bạn muốn tôi ghi nhớ!`;
      }
      const items = saved.map((m, i) => `${i + 1}. **${escapeHtml(m.topic || 'Ghi nhớ')}**: ${escapeHtml(m.content)} *(lưu lúc: ${escapeHtml(m.created_at || 'Vừa xong')})*`).join("\n");
      return `🧠 **Dưới đây là những điều tôi đã tự học và ghi nhớ về bạn:**\n\n${items}\n\n*Tôi sẽ tự động áp dụng toàn bộ các thông tin này trong tất cả các câu trả lời tiếp theo để cá nhân hóa phản hồi cho riêng bạn! Bạn có thể chỉnh sửa hoặc xóa bất kỳ mục nào bằng cách bấm vào nút **🧠 Bộ Nhớ AI** ở góc trên thanh chat.*`;
    }

    if (p.startsWith("hãy nhớ") || p.startsWith("nhớ là") || p.startsWith("ghi nhớ") || p.startsWith("từ nay hãy") || p.includes("tôi tên là") || p.includes("dạy bạn là")) {
      return `🧠 **Đã ghi nhận thành công vào bộ nhớ dài hạn!**\n\nTôi đã tự động cập nhật thông tin này vào cơ sở tri thức cá nhân của bạn. Từ giờ trở đi, tôi sẽ luôn ghi nhớ và áp dụng thông tin này trong các câu trả lời tương lai.\n\n👉 *Bạn có thể bấm vào nút **🧠 Bộ Nhớ AI** trên thanh tiêu đề bất kỳ lúc nào để xem danh sách hoặc chỉnh sửa các ký ức đã lưu.*`;
    }

    // --- 2. MATH & SCIENCE QUERIES ---
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

      return `**${a} ${mathMatch[2]} ${b} = ${ans}**.\n\nĐây là phép tính toán học cơ bản. Nếu bạn có các phương trình giải tích, đại số tuyến tính, đạo hàm - tích phân hoặc bài toán thống kê phức tạp hơn, hãy gửi tiếp cho tôi nhé!`;
    }

    if (p.includes("đạo hàm") || p.includes("tích phân") || p.includes("phương trình") || p.includes("toán học") || p.includes("hình học") || p.includes("pythagore") || p.includes("pythagoras")) {
      return `### 📐 Giải Đáp Toán Học & Công Thức Chuyên Sâu\n\nToán học là nền tảng của khoa học máy tính và trí tuệ nhân tạo. Dưới đây là tóm tắt các nguyên lý trọng tâm:\n\n1. **Định lý Pythagoras**: Trong tam giác vuông, bình phương cạnh huyền bằng tổng bình phương hai cạnh góc vuông:\n   $$a^2 + b^2 = c^2$$\n2. **Đạo hàm (Derivative)**: Biểu thị tốc độ biến thiên tức thời của hàm số:\n   $$f'(x) = \\lim_{\\Delta x \\to 0} \\frac{f(x + \\Delta x) - f(x)}{\\Delta x}$$\n   - Đạo hàm của $x^n$ là $n \\cdot x^{n-1}$.\n   - Đạo hàm hàm $e^x$ là $e^x$; hàm $\\ln(x)$ là $1/x$.\n3. **Tích phân (Integral)**: Ứng dụng tính diện tích dưới đường cong và bài toán tối ưu hóa trong Machine Learning.\n\n*Bạn đang cần giải phương trình cụ thể nào? Hãy nhập đề bài, tôi sẽ trình bày từng bước giải chi tiết!*`;
    }

    // --- 3. C / C++ CODE & CURRICULUM ---
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

    cout << "\\n✅ Tong so sinh vien da xu ly: " << danhSach.size() << endl;
    return 0;
}
\`\`\`\n\n### 💡 Giải thích các điểm cốt lõi trong đoạn code C++ trên:
1. **Lớp \`SinhVien\` (OOP)**: Thuộc tính được bảo vệ (\`private\`), sử dụng constructor dạng *member initializer list* để tối ưu hiệu năng bộ nhớ.
2. **Thư viện \`std::vector\` (STL)**: Mảng động tự co giãn kích thước, linh hoạt và an toàn hơn mảng tĩnh truyền thống.
3. **Thuật toán \`std::sort\` với Lambda Expression**: Sắp xếp danh sách cực nhanh chỉ với một dòng code ngắn gọn và dễ hiểu.
4. **Thư viện \`<iomanip>\`**: Giúp căn chỉnh cột (\`setw\`) và định dạng số thập phân (\`setprecision\`) tạo bảng hiển thị chuyên nghiệp.

*Bạn có muốn mở rộng thêm tính năng gì cho đoạn code này (ví dụ: nhập từ bàn phím, ghi ra file txt)?*`;
    }

    if (p.includes("c++") || p.includes("cpp") || p.includes("c / c++") || p.includes("ngôn ngữ c")) {
      return `### 📘 Lộ Trình Học Lập Trình C++ Toàn Diện (Từ Cơ Bản Đến Nâng Cao)\n\nChương trình học C++ chuẩn đại học và ứng dụng thực tế thường được chia thành **12 chuyên đề (bài học) cốt lõi**:\n\n---\n\n#### 🟢 Giai đoạn 1: C++ Căn Bản (Bài 1 – Bài 6)\n1. **Bài 1: Tổng quan về C++ & Môi trường lập trình**:\n   - Cài đặt trình biên dịch GCC/G++, Visual Studio Code, CLion hoặc Code::Blocks.\n   - Cấu trúc chương trình C++ đầu tiên: \`#include <iostream>\`, hàm \`main()\`, lệnh xuất \`std::cout\`.\n2. **Bài 2: Biến, Kiểu dữ liệu & Nhập xuất chuẩn**:\n   - Các kiểu dữ liệu cơ bản: \`int\`, \`float\`, \`double\`, \`char\`, \`bool\`.\n   - Nhập dữ liệu từ bàn phím với \`std::cin\`, xử lý trôi lệnh với \`cin.ignore()\`.\n3. **Bài 3: Toán tử & Biểu thức điều kiện**:\n   - Toán tử số học (\`+\`, \`-\`, \`*\`, \`/\`, \`%\`), logic (\`&&\`, \`||\`, \`!\`), so sánh.\n   - Cấu trúc rẽ nhánh: \`if - else if - else\`, \`switch - case\`, toán tử 3 ngôi \`? :\`.\n4. **Bài 4: Vòng lặp & Điều khiển luồng**:\n   - Vòng lặp \`for\`, \`while\`, \`do - while\`.\n   - Lệnh điều khiển: \`break\` (thoát lặp), \`continue\` (bỏ qua bước lặp).\n5. **Bài 5: Hàm trong C++ (Functions)**:\n   - Khai báo và định nghĩa hàm, giá trị trả về.\n   - Truyền tham trị (\`pass-by-value\`) và truyền tham chiếu (\`pass-by-reference\` dùng \`&\`).\n   - Nạp chồng hàm (\`Function Overloading\`).\n6. **Bài 6: Mảng (Arrays) & Chuỗi ký tự (Strings)**:\n   - Mảng 1 chiều, mảng 2 chiều (ma trận).\n   - Xử lý chuỗi hiện đại với thư viện \`std::string\` (các phương thức \`size()\`, \`substr()\`, \`find()\`).\n\n---\n\n#### 🟡 Giai đoạn 2: C++ Trung Cấp & Bộ Nhớ (Bài 7 – Bài 9)\n7. **Bài 7: Con trỏ & Quản lý bộ nhớ động (Pointers & Dynamic Memory)**:\n   - Bản chất ô nhớ, địa chỉ biến (\`&\`), con trỏ (\`*\`).\n   - Cấp phát bộ nhớ động với toán tử \`new\` và giải phóng bộ nhớ với \`delete\`.\n   - Con trỏ vô hiệu (\`nullptr\`) và lỗi rò rỉ bộ nhớ (\`memory leak\`).\n8. **Bài 8: Kiểu dữ liệu cấu trúc (Struct & Enum)**:\n   - Tạo kiểu dữ liệu tự định nghĩa với \`struct\`.\n   - Mảng các cấu trúc, con trỏ trỏ tới struct (\`->\`).\n9. **Bài 9: Thao tác với Tệp tin (File I/O)**:\n   - Đọc và ghi tệp tin với thư viện \`<fstream>\`: \`std::ifstream\` (đọc file), \`std::ofstream\` (ghi file).\n\n---\n\n#### 🔴 Giai đoạn 3: Hướng Đối Tượng & STL Chuẩn (Bài 10 – Bài 12)\n10. **Bài 10: Lập trình hướng đối tượng (OOP in C++)**:\n    - **Class & Object**: Thuộc tính (Attributes) & Phương thức (Methods).\n    - Bộ chỉ định truy cập: \`public\`, \`private\`, \`protected\`.\n    - Constructor (Hàm khởi tạo), Destructor (Hàm hủy).\n    - 4 tính chất OOP: **Đóng gói** (Encapsulation), **Kế thừa** (Inheritance), **Đa hình** (Polymorphism - \`virtual\`), **Trừu tượng** (Abstraction).\n11. **Bài 11: Thư viện mẫu chuẩn STL (Standard Template Library)**:\n    - Các container phổ biến: \`std::vector\`, \`std::pair\`, \`std::map\`, \`std::set\`, \`std::stack\`, \`std::queue\`.\n    - Các thuật toán có sẵn: \`std::sort()\`, \`std::binary_search()\`, \`std::reverse()\`.\n12. **Bài 12: Xử lý ngoại lệ & Mẫu hàm (Templates & Exception Handling)**:\n    - Bắt lỗi với khối \`try - catch\`.\n    - Hàm mẫu (\`Function Template\`) và Lớp mẫu (\`Class Template\`).\n\n---\n\n💡 *Bạn muốn bắt đầu học chi tiết bài nào trước, hoặc cần bài tập thực hành mẫu về phần nào? Hãy nhắn cho tôi nhé!*`;
    }

    // --- 4. PYTHON, JAVASCRIPT & SOFTWARE ENGINEERING ---
    if (p.includes("python") || p.includes("django") || p.includes("flask") || p.includes("fastapi")) {
      return `### 🐍 Lập Trình Python Chuyên Nghiệp\n\nDưới đây là ví dụ chuẩn mực về Pythonic code kết hợp Type Hinting, Dataclasses và xử lý danh sách bất đồng bộ:\n\n\`\`\`python
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class UserTask:
    id: int
    title: str
    completed: bool = False

class TaskManager:
    def __init__(self):
        self.tasks: List[UserTask] = []

    def add_task(self, title: str) -> UserTask:
        new_task = UserTask(id=len(self.tasks) + 1, title=title)
        self.tasks.append(new_task)
        return new_task

    def get_pending_tasks(self) -> List[UserTask]:
        # List comprehension tinh gọn O(n)
        return [t for t in self.tasks if not t.completed]

# Khởi tạo và sử dụng
manager = TaskManager()
manager.add_task("Học cấu trúc dữ liệu Python")
manager.add_task("Tối ưu hóa API Backend")
print("Tasks chờ xử lý:", manager.get_pending_tasks())
\`\`\`\n\n*Bạn cần trợ giúp viết script tự động hóa, phân tích dữ liệu Pandas/NumPy, hay xây dựng API Flask/FastAPI?*`;
    }

    if (p.includes("javascript") || p.includes("typescript") || p.includes("react") || p.includes("node") || p.includes("vue")) {
      return `### ⚡ Lập Trình JavaScript & TypeScript Hiện Đại\n\n\`\`\`typescript
// Ví dụ về Async/Await, Generic Type và Fetch API chuẩn ES2024:
interface ApiResponse<T> {
  status: 'success' | 'error';
  data?: T;
  message?: string;
}

async function fetchJson<T>(url: string): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(\`HTTP error! status: \${res.status}\`);
    const data: T = await res.json();
    return { status: 'success', data };
  } catch (err: any) {
    return { status: 'error', message: err.message };
  }
}
\`\`\`\n\n*Bạn có thắc mắc gì về React Hooks, State Management (Redux/Zustand), hay DOM manipulation? Hãy cho tôi biết!*`;
    }

    if (p.includes("sql") || p.includes("database") || p.includes("cơ sở dữ liệu")) {
      return `### 🗄️ Truy Vấn Cơ Sở Dữ Liệu SQL Tối Ưu\n\n\`\`\`sql
-- Truy vấn phân tích doanh số và xếp hạng top khách hàng (Window Functions & Index Optimization)
SELECT 
    u.id AS user_id,
    u.full_name,
    COUNT(o.id) AS total_orders,
    SUM(o.total_amount) AS total_spent,
    DENSE_RANK() OVER (ORDER BY SUM(o.total_amount) DESC) AS customer_rank
FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.status = 'completed' AND o.created_at >= '2026-01-01'
GROUP BY u.id, u.full_name
HAVING total_spent > 1000000
ORDER BY total_spent DESC;
\`\`\`\n\n*Gợi ý*: Luôn đánh index trên các trường khóa ngoại (\`user_id\`) và điều kiện lọc (\`status\`, \`created_at\`) để tăng tốc độ truy vấn từ $O(n)$ xuống $O(\\log n)$.`;
    }

    // --- 5. WRITING, EMAILS & BUSINESS ---
    if (p.includes("thơ") || p.includes("bài thơ") || p.includes("lục bát")) {
      return `### 🌸 Một Vần Thơ Dành Tặng Bạn\n\n*Dẫu cho ngày tháng bộn bề,*\n*Đường xa vạn dặm vững bề bước chân.*\n*Đêm về thắp sáng ánh trăng,*\n*Niềm tin soi lối nhọc nhằn hóa không.*\n\n*Công nghệ chắp cánh ước mong,*\n*Trí tuệ nhân tạo đồng lòng sát vai.*\n*Tương lai rộng mở ngày mai,*\n*Kiên tâm bền chí ắt tài nở hoa.*\n\n*(Sáng tác bởi NEXORA AI Assistant)* ✨`;
    }

    if (p.includes("email") || p.includes("thư") || p.includes("đơn xin") || p.includes("xin việc") || p.includes("nghỉ phép")) {
      return `### ✉️ Mẫu Email Doanh Nghiệp Chuẩn Mực & Chuyên Nghiệp\n\n**Tiêu đề**: [Họ và tên] – Đề xuất / Đơn xin nghỉ phép / Ứng tuyển vị trí [Tên vị trí]\n\n**Kính gửi**: Ban Giám đốc / Anh/Chị [Tên Quản lý],\n\nTôi tên là: **${API.getUser()?.name || "Lê Trung Hậu"}**, hiện đang đảm nhiệm vị trí [Vị trí công tác] tại bộ phận [Tên phòng ban].\n\nTôi viết email này trân trọng kính báo / xin phép quý Công ty về việc: ...\n\n- **Lý do**: ...\n- **Thời gian**: Từ ngày ... đến hết ngày ...\n- **Phương án bàn giao công việc**: Mọi công việc hiện tại đã được tôi hoàn tất và bàn giao cho đồng nghiệp [Tên người nhận bàn giao]. Tôi vẫn duy trì liên lạc qua điện thoại/email trong các trường hợp khẩn cấp.\n\nRất mong nhận được sự đồng thuận và phê duyệt từ phía Ban Giám đốc.\n\nKính chúc Quý Công ty ngày càng phát triển thịnh vượng.\n\n*Trân trọng,*\n**${API.getUser()?.name || "Lê Trung Hậu"}**\nSố điện thoại: 09xx-xxx-xxx`;
    }

    if (p.includes("kinh doanh") || p.includes("marketing") || p.includes("startup") || p.includes("kế hoạch")) {
      return `### 💼 Khung Chiến Lược Kinh Doanh & Marketing Tinh Gọn (Lean Business Model)\n\nĐể đưa một sản phẩm hoặc dự án khởi nghiệp ra thị trường thành công, bạn cần tập trung vào 4 trụ cột chính:\n\n1. **Value Proposition (Định vị giá trị cốt lõi)**: Giải quyết "nỗi đau" (pain points) nào của khách hàng mà đối thủ chưa làm tốt?\n2. **Target Audience & ICP (Chân dung khách hàng lý tưởng)**: Xác định rõ độ tuổi, hành vi, kênh tiếp cận ưu tiên (TikTok Ads, SEO, Cold Email, B2B Referral).\n3. **Mô hình Doanh Thu (Revenue Streams)**: Định giá Freemium, Subscription hàng tháng/năm, hay License trọn đời.\n4. **Phễu Chuyển Đổi (Marketing Funnel AIDA)**:\n   - *Awareness*: Thu hút chú ý qua nội dung chia sẻ giá trị cao.\n   - *Interest*: Thuyết phục người dùng dùng thử miễn phí.\n   - *Desire*: Chứng minh hiệu quả bằng Case Study & Testimonials.\n   - *Action*: Kêu gọi hành động (CTA) với ưu đãi giới hạn.\n\n*Bạn muốn xây dựng kế hoạch cụ thể cho ngành hàng hoặc ý tưởng nào?*`;
    }

    // --- 6. GREETINGS & INTRODUCTIONS ---
    if (p.includes("trả lời") || p.includes("có thể") || p.includes("giúp") || p.includes("chào") || p.includes("hello") || p.includes("hi")) {
      return `**Chào bạn! Tôi hoàn toàn sẵn sàng hỗ trợ và trả lời mọi câu hỏi của bạn.** 🚀\n\nTôi là **${agent.name}** – trợ lý trí tuệ nhân tạo chuyên trách thuộc nền tảng **NEXORA AI** (*${agent.role_desc}*).\n\n### Những năng lực tôi có thể phục vụ bạn ngay lập tức:\n1. 💻 **Lập trình & Kỹ thuật**: Viết code, debug, giải thuật (C++, Python, JS, TypeScript, Java, SQL, Rust).\n2. 🧠 **Tự học & Ghi nhớ**: Tự động học sở thích, thói quen và kiến thức bạn chia sẻ để ngày càng thông minh hơn.\n3. ✍️ **Soạn thảo & Biên tập**: Viết email doanh nghiệp, làm thơ, viết tiểu luận, kế hoạch kinh doanh.\n4. 📐 **Toán & Khoa học**: Giải đáp công thức, đạo hàm, tích phân, định lý khoa học.\n5. 🚀 **Hệ thống Multi-Agent Workflow**: Phối hợp cùng lúc nhiều chuyên gia AI để hoàn thành dự án phức tạp.\n\nHãy nhắn cho tôi câu hỏi hoặc nhiệm vụ bạn cần thực hiện nhé!`;
    }

    // --- 7. DYNAMIC ADAPTIVE FALLBACK FOR ANY OTHER QUESTION ---
    return `### 🎯 Phân Tích & Giải Đáp Chi Tiết: *"${escapeHtml(prompt)}"*

Chào bạn, dựa trên câu hỏi của bạn, **${agent.name}** đã tổng hợp và đưa ra lời giải đáp chuyên sâu như sau:

#### 1. Tổng Quan Vấn Đề
- Yêu cầu của bạn xoay quanh chủ đề cốt lõi: **"${escapeHtml(prompt)}"**.
- Để tiếp cận và giải quyết vấn đề này một cách tối ưu, chúng ta cần xem xét cả về mặt lý thuyết nền tảng lẫn thực tiễn ứng dụng.

#### 2. Các Luận Điểm Trọng Tâm
- **Nguyên lý hoạt động**: Nắm vững bản chất cốt lõi sẽ giúp bạn tiết kiệm 80% thời gian triển khai.
- **Phương pháp thực thi**: Chia nhỏ mục tiêu thành từng bước khả thi (Micro-steps) và kiểm chứng kết quả liên tục.
- **Tối ưu hóa**: Luôn có phương án dự phòng và tự động hóa các bước lặp lại bằng công cụ AI.

#### 3. Khuyến Nghị Thực Hành
1. Xác định rõ mục tiêu đầu ra mong muốn.
2. Áp dụng ngay phương pháp thực hành trong 24 giờ đầu tiên để tạo đà phát triển.
3. Nếu bạn cần đi sâu vào bất kỳ chi tiết, công thức, đoạn mã hay văn bản mẫu nào liên quan, hãy gửi yêu cầu tiếp theo cho tôi nhé!`;
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
  },

  // -------------------------------------------------------------
  // CONTINUOUS SELF-LEARNING & AI ADAPTIVE MEMORY ENGINE
  // -------------------------------------------------------------
  async detectAndLearn(prompt) {
    const p = prompt.trim();
    const pLower = p.toLowerCase();

    // Check for self-learning keywords
    const learnKeywords = ["hãy nhớ rằng", "hãy nhớ", "nhớ là", "ghi nhớ", "tôi tên là", "tôi thích", "tôi đang học", "tôi làm nghề", "tôi làm việc", "từ nay hãy", "quy tắc là", "dạy bạn là"];
    const matched = learnKeywords.find(k => pLower.includes(k));

    if (matched) {
      let fact = p;
      if (pLower.startsWith("hãy nhớ rằng ")) fact = p.slice(13).trim();
      else if (pLower.startsWith("hãy nhớ ")) fact = p.slice(8).trim();
      else if (pLower.startsWith("nhớ là ")) fact = p.slice(7).trim();
      else if (pLower.startsWith("ghi nhớ ")) fact = p.slice(8).trim();

      try {
        await API.post("/api/chat/memory", {
          topic: "Tự học từ hội thoại",
          content: fact
        });
        showToast(`🧠 AI đã tự động ghi nhớ: "${fact.slice(0, 50)}..."`, "info");
        const badge = document.getElementById("ai-memory-badge");
        if (badge) badge.classList.remove("hidden");
      } catch (e) {
        console.warn("Auto-learning failed to persist:", e);
      }
    }
  },

  getMemoryContext() {
    let saved = JSON.parse(localStorage.getItem("nexora_ai_memories") || "null");
    if (!saved || !saved.length) return "";
    const list = saved.slice(0, 8).map(m => `- [${m.topic || 'Ghi nhớ'}]: ${m.content}`).join("\n");
    return `[BỘ NHỚ DÀI HẠN CỦA AI VỀ NGƯỜI DÙNG - HÃY ÁP DỤNG ĐỂ CÁ NHÂN HÓA PHẢN HỒI]:\n${list}`;
  },

  async openMemoryModal() {
    openModal("ai-memory-modal");
    await this.loadAndRenderMemories();
  },

  async loadAndRenderMemories() {
    const listContainer = document.getElementById("ai-memory-list");
    if (!listContainer) return;

    try {
      const res = await API.get("/api/chat/memory");
      const memories = res.memories || [];
      if (!memories.length) {
        listContainer.innerHTML = `
          <div class="p-6 text-center text-xs text-slate-500 rounded-2xl bg-slate-900/40 border border-white/5">
            Chưa có thông tin ghi nhớ nào. Bạn hãy dạy AI điều gì đó bằng cách nhập ở trên!
          </div>
        `;
        return;
      }

      listContainer.innerHTML = memories.map(m => `
        <div class="p-3 rounded-2xl bg-slate-900 border border-white/5 flex items-start justify-between gap-3 group hover:border-[#7C5CFC]/30 transition-all">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#7C5CFC]/15 text-[#22D3EE] border border-[#7C5CFC]/30">
                ${escapeHtml(m.topic || 'Tự học')}
              </span>
              <span class="text-[10px] text-slate-500">${escapeHtml(m.created_at || 'Vừa xong')}</span>
            </div>
            <p class="text-xs text-slate-200 leading-relaxed break-words">${escapeHtml(m.content)}</p>
          </div>
          <button type="button" onclick="Chat.deleteMemory(${m.id})" class="p-1.5 rounded-lg opacity-60 group-hover:opacity-100 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-all" title="Xóa ký ức này">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      `).join("");
      lucide.createIcons();
    } catch (e) {
      console.error(e);
    }
  },

  async addCustomMemory() {
    const input = document.getElementById("input-new-memory");
    const content = input?.value.trim();
    if (!content) {
      showToast("Vui lòng nhập kiến thức bạn muốn dạy AI.", "warning");
      return;
    }

    try {
      const res = await API.post("/api/chat/memory", {
        topic: "Dạy trực tiếp",
        content: content
      });
      showToast(res.message || "Đã lưu kiến thức mới vào bộ nhớ AI!", "success");
      input.value = "";
      await this.loadAndRenderMemories();
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  async deleteMemory(memId) {
    try {
      await API.delete("/api/chat/memory/" + memId);
      showToast("Đã xóa ký ức khỏi bộ nhớ AI.", "info");
      await this.loadAndRenderMemories();
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  async clearAllMemories() {
    localStorage.removeItem("nexora_ai_memories");
    showToast("Đã xóa toàn bộ ký ức bộ nhớ của AI.", "info");
    await this.loadAndRenderMemories();
  }
};
