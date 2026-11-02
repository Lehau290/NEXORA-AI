// ============================================================
// NEXORA AI - Multi-Agent Workflow Engine UI
// ============================================================

const Workflow = {
  activeWorkflowId: null,
  pollTimer: null,

  async init(workflowId = null) {
    if (workflowId) {
      await this.loadWorkflow(workflowId);
    } else {
      await this.loadRecentWorkflows();
    }
    this.bindEvents();
  },

  bindEvents() {
    const startBtn = document.getElementById("btn-start-workflow");
    if (startBtn && !startBtn.dataset.bound) {
      startBtn.dataset.bound = "true";
      startBtn.addEventListener("click", () => this.startNewWorkflow());
    }
  },

  async loadRecentWorkflows() {
    try {
      const res = await API.get("/api/workflows");
      this.renderRecentList(res.workflows || []);
    } catch (e) {
      console.error(e);
    }
  },

  renderRecentList(workflows) {
    const container = document.getElementById("workflow-history-list");
    if (!container) return;

    if (!workflows.length) {
      container.innerHTML = `
        <div class="p-6 text-center text-slate-500 text-xs">
          Chưa có quy trình nào được khởi tạo. Hãy nhập mục tiêu phía trên để bắt đầu!
        </div>
      `;
      return;
    }

    container.innerHTML = workflows.map(wf => `
      <div onclick="Workflow.loadWorkflow(${wf.id})" class="p-4 rounded-xl bg-slate-900/60 hover:bg-[#7C5CFC]/10 border border-white/5 hover:border-[#7C5CFC]/30 transition-all cursor-pointer flex items-center justify-between group">
        <div class="flex-1 min-w-0 pr-4">
          <div class="flex items-center gap-2 mb-1">
            <h4 class="text-xs font-bold text-slate-200 group-hover:text-[#7C5CFC] transition-colors truncate">${escapeHtml(wf.title)}</h4>
            <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${wf.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : wf.status === 'running' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400'}">
              ${wf.status === 'completed' ? 'Hoàn thành' : wf.status === 'running' ? 'Đang chạy' : wf.status}
            </span>
          </div>
          <p class="text-[11px] text-slate-400 truncate">${escapeHtml(wf.goal)}</p>
        </div>
        <div class="flex items-center gap-3 text-right">
          <div class="text-right">
            <span class="text-xs font-bold text-[#22D3EE]">${wf.progress_percent || 0}%</span>
            <div class="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div class="h-full bg-gradient-to-r from-[#7C5CFC] to-[#22D3EE] rounded-full" style="width: ${wf.progress_percent || 0}%"></div>
            </div>
          </div>
          <i data-lucide="chevron-right" class="w-4 h-4 text-slate-500 group-hover:text-slate-200 transition-colors"></i>
        </div>
      </div>
    `).join("");

    lucide.createIcons();
  },

  async startNewWorkflow() {
    const goalInput = document.getElementById("workflow-goal-input");
    const goal = goalInput?.value.trim();
    if (!goal) {
      showToast("Vui lòng nhập mục tiêu dự án cần phân công.", "warning");
      return;
    }

    const startBtn = document.getElementById("btn-start-workflow");
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Đang khởi động...</span>`;
      lucide.createIcons();
    }

    try {
      const res = await API.post("/api/workflows/create", { goal });
      showToast("Đã khởi động quy trình Multi-Agent!", "success");
      if (goalInput) goalInput.value = "";
      await this.loadWorkflow(res.workflow_id);
    } catch (e) {
      showToast(e.message, "error");
    } finally {
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i><span>Khởi Động Multi-Agent</span>`;
        lucide.createIcons();
      }
    }
  },

  setQuickGoal(text) {
    const input = document.getElementById("workflow-goal-input");
    if (input) {
      input.value = text;
      input.focus();
    }
  },

  async loadWorkflow(wfId) {
    this.activeWorkflowId = wfId;
    if (this.pollTimer) clearInterval(this.pollTimer);

    const viewer = document.getElementById("workflow-live-viewer");
    if (viewer) viewer.classList.remove("hidden");

    await this.fetchAndRenderProgress();

    // Poll status every 3 seconds if running
    this.pollTimer = setInterval(async () => {
      const isStillRunning = await this.fetchAndRenderProgress();
      if (!isStillRunning && this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
      }
    }, 3000);
  },

  async fetchAndRenderProgress() {
    if (!this.activeWorkflowId) return false;

    try {
      const res = await API.get(`/api/workflows/${this.activeWorkflowId}`);
      const wf = res.workflow;
      const steps = res.steps || [];

      // Update Header
      const titleEl = document.getElementById("wf-view-title");
      const goalEl = document.getElementById("wf-view-goal");
      const progressText = document.getElementById("wf-view-progress-text");
      const progressBar = document.getElementById("wf-view-progress-bar");
      const statusBadge = document.getElementById("wf-view-status");

      if (titleEl) titleEl.textContent = wf.title;
      if (goalEl) goalEl.textContent = wf.goal;
      if (progressText) progressText.textContent = `${res.progress_percent}%`;
      if (progressBar) progressBar.style.width = `${res.progress_percent}%`;

      if (statusBadge) {
        const isDone = wf.status === "completed";
        const isRun = wf.status === "running";
        statusBadge.className = `px-3 py-1 rounded-full text-xs font-bold border ${isDone ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : isRun ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-slate-800 text-slate-400 border-white/5'}`;
        statusBadge.textContent = isDone ? "✓ Hoàn thành xuất sắc" : isRun ? "⏳ Đang phân tích & thực hiện" : wf.status;
      }

      // Render Steps Timeline
      const timeline = document.getElementById("wf-steps-timeline");
      if (timeline) {
        timeline.innerHTML = steps.map((s, idx) => {
          const isCompleted = s.status === "completed";
          const isRunning = s.status === "running";
          const isPending = s.status === "pending";

          return `
            <div class="relative flex gap-4 items-start mb-6 group">
              <!-- Step order badge -->
              <div class="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm flex-shrink-0 z-10 transition-all ${isCompleted ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30' : isRunning ? 'bg-[#7C5CFC] text-white animate-pulse shadow-lg shadow-[#7C5CFC]/40' : 'bg-slate-800 text-slate-500 border border-white/5'}">
                ${isCompleted ? '✓' : idx + 1}
              </div>

              <!-- Connecting line -->
              ${idx < steps.length - 1 ? `<div class="absolute left-5 top-10 bottom-[-24px] w-0.5 ${isCompleted ? 'bg-emerald-500/40' : 'bg-slate-800'}"></div>` : ''}

              <!-- Content Card -->
              <div class="flex-1 p-5 rounded-2xl bg-[#151923] border ${isRunning ? 'border-[#7C5CFC]/50 glow-primary' : isCompleted ? 'border-emerald-500/20' : 'border-white/5'} transition-all">
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <span class="text-xl">${s.agent_avatar || '🤖'}</span>
                    <div>
                      <h4 class="text-sm font-bold text-slate-100">${escapeHtml(s.step_name)}</h4>
                      <span class="text-[11px] text-[#22D3EE]">${escapeHtml(s.agent_name)}</span>
                    </div>
                  </div>
                  <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold ${isCompleted ? 'bg-emerald-500/10 text-emerald-400' : isRunning ? 'bg-[#7C5CFC]/20 text-[#7C5CFC] animate-pulse' : 'bg-slate-800 text-slate-500'}">
                    ${isCompleted ? 'Đã hoàn thành' : isRunning ? 'Đang xử lý...' : 'Chờ thực hiện'}
                  </span>
                </div>

                ${isCompleted && s.result ? `
                  <div class="mt-4 pt-3 border-t border-white/5">
                    <details class="cursor-pointer group/details">
                      <summary class="text-xs font-semibold text-[#7C5CFC] hover:text-[#22D3EE] transition-colors flex items-center gap-1.5 list-none select-none">
                        <i data-lucide="chevron-right" class="w-3.5 h-3.5 group-open/details:rotate-90 transition-transform"></i>
                        <span>Xem kết quả chi tiết của Agent này</span>
                      </summary>
                      <div class="markdown-body mt-3 p-4 rounded-xl bg-slate-900/80 border border-white/5 text-xs text-slate-300 max-h-72 overflow-y-auto">
                        ${Chat.parseMarkdown(s.result)}
                      </div>
                    </details>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join("");
      }

      // Render Final Master Summary if completed
      const summaryBox = document.getElementById("wf-final-summary-box");
      const summaryContent = document.getElementById("wf-final-summary-content");
      if (summaryBox && summaryContent) {
        if (wf.status === "completed" && wf.summary) {
          summaryBox.classList.remove("hidden");
          summaryContent.innerHTML = Chat.parseMarkdown(wf.summary);
        } else {
          summaryBox.classList.add("hidden");
        }
      }

      lucide.createIcons();
      return wf.status === "running";
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  async pause() {
    if (!this.activeWorkflowId) return;
    try {
      await API.post(`/api/workflows/${this.activeWorkflowId}/pause`);
      showToast("Đã tạm dừng quy trình.", "info");
      this.fetchAndRenderProgress();
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  async resume() {
    if (!this.activeWorkflowId) return;
    try {
      await API.post(`/api/workflows/${this.activeWorkflowId}/resume`);
      showToast("Đã tiếp tục thực hiện quy trình.", "success");
      this.loadWorkflow(this.activeWorkflowId);
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  async stop() {
    if (!this.activeWorkflowId) return;
    try {
      await API.post(`/api/workflows/${this.activeWorkflowId}/stop`);
      showToast("Đã dừng quy trình.", "warning");
      this.fetchAndRenderProgress();
    } catch (e) {
      showToast(e.message, "error");
    }
  },

  copySummary() {
    const content = document.getElementById("wf-final-summary-content")?.innerText;
    if (content) {
      navigator.clipboard.writeText(content).then(() => {
        showToast("Đã sao chép báo cáo tổng hợp Multi-Agent!", "success");
      });
    }
  }
};

