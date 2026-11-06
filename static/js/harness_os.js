// ============================================================
// NEXORA AI - HARNESS OS CINEMATIC BOOT & LOGIN SEQUENCE
// Pixel-perfect video experience with muted sound & instant skip
// ============================================================

const HarnessOS = {
  active: false,
  videoEl: null,
  onCompleteCallback: null,
  fallbackTimer: null,

  startSequence(user = null, onComplete = null) {
    this.active = true;
    this.onCompleteCallback = onComplete;

    const overlay = document.getElementById("harness-os-overlay");
    if (!overlay) {
      if (typeof onComplete === "function") onComplete();
      return;
    }

    overlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    const container = document.getElementById("harness-os-content");
    if (!container) return;

    // Render the pixel-perfect cinematic video viewport
    container.innerHTML = `
      <div class="harness-viewport relative w-full h-full bg-[#05070B] flex items-center justify-center select-none overflow-hidden animate-fadeIn">
        <!-- Subtle Background Cyber Ambient Glow -->
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.08)_0%,rgba(11,13,18,0.95)_75%)] pointer-events-none"></div>

        <!-- Sleek High-Tech Window Container (16:9 Widescreen) -->
        <div class="relative w-full max-w-6xl aspect-video max-h-[92vh] mx-auto md:p-3 flex flex-col items-center justify-center">
          <div class="relative w-full h-full bg-black rounded-none md:rounded-2xl border border-white/10 shadow-[0_0_70px_rgba(0,0,0,0.9)] overflow-hidden flex items-center justify-center group">
            
            <!-- Video Element (Muted / No Sound, Autoplay, PlaysInline) -->
            <video 
              id="harness-boot-video" 
              class="w-full h-full object-contain bg-black" 
              src="static/images/harness_boot.mp4" 
              autoplay 
              muted 
              playsinline
              preload="auto">
            </video>

            <!-- Top Right: Minimalist Sci-Fi SKIP > Button -->
            <button 
              type="button" 
              onclick="HarnessOS.skip()" 
              class="absolute top-4 right-5 z-30 px-3.5 py-1.5 rounded-lg bg-black/60 hover:bg-white/15 border border-white/20 text-slate-300 hover:text-white font-mono text-xs tracking-[0.25em] transition-all backdrop-blur-md shadow-lg flex items-center gap-1.5"
              title="Bỏ qua và vào hệ thống ngay (Esc / Space)">
              <span>SKIP</span>
              <span class="text-cyan-400 font-bold">&gt;</span>
            </button>

            <!-- Bottom Progress Track Bar -->
            <div class="absolute bottom-0 inset-x-0 h-1 bg-white/10 z-20">
              <div id="harness-video-progress" class="h-full bg-gradient-to-r from-[#7C5CFC] via-[#22D3EE] to-emerald-400 w-0 transition-all duration-100"></div>
            </div>

            <!-- Interactive Climax Overlay: Enter Workspace Button (Reveals at end) -->
            <div id="harness-enter-prompt" class="absolute inset-0 z-20 bg-black/55 backdrop-blur-[2px] hidden flex-col items-center justify-center text-center p-6 animate-fadeIn">
              <div class="p-6 md:p-8 rounded-3xl bg-[#0B0D12]/92 border border-cyan-500/35 shadow-[0_0_50px_rgba(34,211,238,0.25)] flex flex-col items-center">
                <span class="px-3 py-1 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 uppercase tracking-widest mb-3">
                  AUTHENTICATION COMPLETE • PRO MODE ACTIVE
                </span>
                <h2 class="text-xl md:text-2xl font-black tracking-[0.2em] text-white mb-1">
                  欢迎来到专业工作模式
                </h2>
                <p class="text-xs font-mono tracking-[0.3em] text-slate-400 uppercase mb-6">
                  PROFESSIONAL WORK MODE READY
                </p>
                <button 
                  onclick="HarnessOS.finish()" 
                  class="px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#7C5CFC] to-[#22D3EE] text-white font-bold tracking-[0.2em] uppercase shadow-[0_0_25px_rgba(34,211,238,0.4)] hover:shadow-[0_0_35px_rgba(34,211,238,0.7)] hover:scale-105 transition-all flex items-center gap-2 text-xs md:text-sm">
                  <span>进入控制台 &nbsp;|&nbsp; ENTER WORKSPACE</span>
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
                <p class="mt-4 text-[10px] font-mono tracking-widest text-slate-500">
                  [ NHẤN PHÍM BẤT KỲ HOẶC CLICK ĐỂ VÀO NGAY ]
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;

    this.videoEl = document.getElementById("harness-boot-video");
    this.bindEvents();
  },

  bindEvents() {
    if (!this.videoEl) return;

    const progressBar = document.getElementById("harness-video-progress");
    const enterPrompt = document.getElementById("harness-enter-prompt");

    // Track video progress
    this.videoEl.addEventListener("timeupdate", () => {
      if (this.videoEl && this.videoEl.duration) {
        const percent = (this.videoEl.currentTime / this.videoEl.duration) * 100;
        if (progressBar) progressBar.style.width = percent + "%";

        // Show Enter button when near the end (after cyberpunk scene reveals at 20s)
        if (this.videoEl.currentTime >= 20.0 && enterPrompt && enterPrompt.classList.contains("hidden")) {
          enterPrompt.classList.remove("hidden");
        }
      }
    });

    // Auto finish when video ends
    this.videoEl.addEventListener("ended", () => {
      if (enterPrompt) enterPrompt.classList.remove("hidden");
      setTimeout(() => this.finish(), 2000);
    });

    // If video fails or can't play, auto-skip after 1s
    this.videoEl.addEventListener("error", () => {
      console.warn("Video playback encountered error, skipping to dashboard.");
      setTimeout(() => this.skip(), 1000);
    });

    // Keyboard handlers (Space, Enter, Escape)
    this._keyHandler = (e) => {
      if (!this.active) return;
      if (e.key === "Escape") {
        this.skip();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        this.finish();
      }
    };
    window.addEventListener("keydown", this._keyHandler);

    // Fallback safety timeout (28 seconds max)
    clearTimeout(this.fallbackTimer);
    this.fallbackTimer = setTimeout(() => {
      if (this.active) this.finish();
    }, 28000);
  },

  unbindEvents() {
    if (this._keyHandler) {
      window.removeEventListener("keydown", this._keyHandler);
      this._keyHandler = null;
    }
    clearTimeout(this.fallbackTimer);
  },

  skip() {
    this.finish();
  },

  finish() {
    if (!this.active) return;
    this.active = false;
    this.unbindEvents();

    if (this.videoEl) {
      try {
        this.videoEl.pause();
      } catch (e) {}
    }

    const overlay = document.getElementById("harness-os-overlay");
    if (overlay) {
      overlay.classList.add("animate-fadeOut");
      setTimeout(() => {
        overlay.classList.add("hidden");
        overlay.classList.remove("animate-fadeOut");
        document.body.style.overflow = "auto";
      }, 350);
    }

    if (typeof this.onCompleteCallback === "function") {
      this.onCompleteCallback();
      this.onCompleteCallback = null;
    }
  }
};
