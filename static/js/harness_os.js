// ============================================================
// NEXORA AI - HARNESS OS BOOT & VERIFICATION INTERFACE
// Faithfully recreated from Sci-Fi / Cyberpunk Terminal Sequence
// ============================================================

const HarnessOS = {
  active: false,
  currentStep: 0,
  totalSteps: 6,
  onCompleteCallback: null,
  autoTimer: null,
  audioCtx: null,
  userName: "LÊ TRUNG HẬU",
  userId: "0887",
  userLevel: "LEVEL 04 - ROOT / PRO",

  // Audio synthesize system (Web Audio API & Speech Synthesis)
  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  },

  playBeep(freq = 880, duration = 0.08, type = "sine", gain = 0.15) {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gainNode.gain.setValueAtTime(gain, this.audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {}
  },

  playAccessGranted() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        setTimeout(() => this.playBeep(freq, 0.12, "triangle", 0.2), idx * 70);
      });
    } catch (e) {}
  },

  playScanSonar() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1400, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.audioCtx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.35);
    } catch (e) {}
  },

  playWarpSwoosh() {
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(960, this.audioCtx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.25, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.6);
    } catch (e) {}
  },

  speakVoice(text) {
    if (!window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "en-US";
      utter.rate = 0.95;
      utter.pitch = 1.05;

      // Prefer high quality English voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v => v.lang.startsWith("en") && (v.name.includes("Female") || v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Zira") || v.name.includes("Jenny")));
      if (preferred) utter.voice = preferred;

      window.speechSynthesis.speak(utter);
    } catch (e) {}
  },

  // Main Entry Point
  startSequence(user = null, onComplete = null) {
    this.active = true;
    this.onCompleteCallback = onComplete;
    this.userName = (user?.full_name || API.getUser()?.full_name || "LÊ TRUNG HẬU").toUpperCase();
    this.userId = String(user?.id || API.getUser()?.id || "0887").padStart(4, "0");
    this.userLevel = user?.role === "admin" ? "LEVEL 01 - ADMIN / ROOT" : "LEVEL 04 - ROOT / PRO";

    const overlay = document.getElementById("harness-os-overlay");
    if (!overlay) {
      console.warn("Harness OS overlay element not found.");
      if (onComplete) onComplete();
      return;
    }

    overlay.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    this.bindKeyEvents();

    // Start with Phase 0 (Black Splash with glowing whale/cyber emblem)
    this.renderPhase0();
  },

  bindKeyEvents() {
    this._keyHandler = (e) => {
      if (!this.active) return;
      if (e.key === "Escape") {
        this.skip();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        this.nextStep();
      }
    };
    window.addEventListener("keydown", this._keyHandler);
  },

  unbindKeyEvents() {
    if (this._keyHandler) {
      window.removeEventListener("keydown", this._keyHandler);
      this._keyHandler = null;
    }
  },

  // -------------------------------------------------------------
  // PHASE 0: Black Splash & DeepSeek / Nexora Whale Emblem
  // -------------------------------------------------------------
  renderPhase0() {
    clearTimeout(this.autoTimer);
    const container = document.getElementById("harness-os-content");
    if (!container) return;

    this.playBeep(220, 0.3, "sine", 0.1);

    container.innerHTML = `
      <div class="harness-screen bg-[#07090E] text-white flex flex-col items-center justify-center min-h-screen w-full relative overflow-hidden select-none animate-fadeIn">
        <!-- Sci-Fi background grid -->
        <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(124,92,252,0.15)_0%,transparent_70%)]"></div>
        <div class="absolute inset-0 opacity-10 bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>

        <div class="z-10 flex flex-col items-center text-center px-4">
          <!-- Cyber Whale / Nexora Emblem -->
          <div class="w-24 h-24 mb-6 relative flex items-center justify-center">
            <div class="absolute inset-0 rounded-full border border-cyan-400/30 animate-ping opacity-30"></div>
            <div class="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500/20 to-purple-600/30 border border-white/20 flex items-center justify-center shadow-[0_0_35px_rgba(34,211,238,0.4)]">
              <svg class="w-12 h-12 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
                <path d="M7 13c1.5 2 4 3 6.5 2s3.5-3 3.5-5c-2 0-4 1-5 2.5s-2.5 1-5 .5z"/>
                <circle cx="9" cy="9" r="1.2" fill="currentColor"/>
              </svg>
            </div>
          </div>

          <h1 class="text-2xl md:text-3xl font-extrabold tracking-[0.35em] text-white mb-1 drop-shadow-md">
            深度探索
          </h1>
          <h2 class="text-xl md:text-2xl font-bold tracking-[0.25em] text-cyan-400 mb-2">
            NEXORA AI
          </h2>
          <p class="text-[11px] uppercase tracking-[0.4em] text-slate-400 font-mono">
            DEEPSEEK HARNESS • SYNTHESIZE INTELLIGENCE
          </p>
        </div>

        <!-- Skip hint -->
        <button onclick="HarnessOS.skip()" class="absolute top-6 right-8 text-xs font-mono tracking-widest text-slate-400 hover:text-white transition-colors">
          SKIP &gt;
        </button>
      </div>
    `;

    // Automatically transition to Phase 1 after 1.8 seconds
    this.autoTimer = setTimeout(() => {
      this.renderPhase1();
    }, 1800);
  },

  // -------------------------------------------------------------
  // PHASE 1: Access Permission Required (需要访问许可)
  // -------------------------------------------------------------
  renderPhase1() {
    clearTimeout(this.autoTimer);
    this.currentStep = 1;
    this.playBeep(440, 0.1, "sine", 0.12);
    this.speakVoice("Access permission required");

    this.renderHarnessFrame({
      stepNum: "01",
      stepName: "AUTHORIZATION",
      statusText: "等待用户授权...",
      contentHtml: `
        <div class="flex flex-col items-center justify-center text-center py-12 animate-fadeIn">
          <div class="mb-4">
            <span class="text-[11px] font-mono tracking-[0.3em] text-slate-400 uppercase">SYS // HARNESS OS PERMISSION</span>
          </div>
          <h2 class="text-3xl md:text-5xl font-black tracking-[0.25em] text-[#1E232E] mb-3">
            需要访问许可
          </h2>
          <p class="text-sm md:text-base font-mono tracking-[0.3em] text-slate-500 uppercase mb-12">
            ACCESS PERMISSION REQUIRED
          </p>

          <button onclick="HarnessOS.nextStep()" class="group relative px-8 py-3.5 bg-transparent border border-[#1E232E]/30 hover:border-[#1E232E] text-[#1E232E] font-mono text-xs md:text-sm tracking-[0.25em] uppercase transition-all duration-300 hover:shadow-[0_0_20px_rgba(0,0,0,0.1)] flex items-center gap-3">
            <span class="w-1.5 h-1.5 bg-[#1E232E] rounded-full group-hover:scale-150 transition-transform"></span>
            <span>授予访问权限 &nbsp;|&nbsp; GRANT ACCESS</span>
            <span class="w-1.5 h-1.5 bg-[#1E232E] rounded-full group-hover:scale-150 transition-transform"></span>
          </button>

          <p class="mt-6 text-[10px] font-mono tracking-widest text-slate-400">
            [ 按下空格键或回车 / PRESS SPACE OR ENTER ]
          </p>
        </div>
      `
    });
  },

  // -------------------------------------------------------------
  // PHASE 2: Identity Verification (身份资料确认)
  // -------------------------------------------------------------
  renderPhase2() {
    clearTimeout(this.autoTimer);
    this.currentStep = 2;
    this.playBeep(587.33, 0.08, "triangle", 0.15);
    this.speakVoice("Identity verification");

    this.renderHarnessFrame({
      stepNum: "02",
      stepName: "IDENTITY",
      statusText: "核对身份资料...",
      contentHtml: `
        <div class="flex flex-col items-center justify-center text-center py-10 animate-fadeIn">
          <h2 class="text-3xl md:text-4xl font-black tracking-[0.25em] text-[#1E232E] mb-2">
            身份资料确认
          </h2>
          <p class="text-xs md:text-sm font-mono tracking-[0.3em] text-slate-500 uppercase mb-8">
            IDENTITY VERIFICATION
          </p>

          <!-- User Card Frame -->
          <div class="w-full max-w-md p-6 bg-white/60 border border-[#1E232E]/15 rounded-sm shadow-sm backdrop-blur-sm mb-8 text-left font-mono text-xs text-slate-700 leading-relaxed">
            <div class="flex justify-between border-b border-[#1E232E]/10 pb-2 mb-3">
              <span class="text-slate-400">OPERATOR NAME:</span>
              <span class="font-bold text-[#1E232E] tracking-wider">${this.userName}</span>
            </div>
            <div class="flex justify-between border-b border-[#1E232E]/10 pb-2 mb-3">
              <span class="text-slate-400">OPERATOR ID:</span>
              <span class="font-bold text-[#1E232E] tracking-widest">${this.userId}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-400">CLEARANCE:</span>
              <span class="font-bold text-emerald-600 tracking-wider">${this.userLevel}</span>
            </div>
          </div>

          <button onclick="HarnessOS.nextStep()" class="group relative px-8 py-3.5 bg-transparent border border-[#1E232E]/30 hover:border-[#1E232E] text-[#1E232E] font-mono text-xs md:text-sm tracking-[0.25em] uppercase transition-all duration-300 flex items-center gap-3">
            <span class="w-1.5 h-1.5 bg-[#1E232E] rounded-full group-hover:scale-150 transition-transform"></span>
            <span>确认身份 &nbsp;|&nbsp; CONFIRM IDENTITY</span>
            <span class="w-1.5 h-1.5 bg-[#1E232E] rounded-full group-hover:scale-150 transition-transform"></span>
          </button>

          <p class="mt-6 text-[10px] font-mono tracking-widest text-slate-400">
            [ 按下空格键或回车 / PRESS SPACE OR ENTER ]
          </p>
        </div>
      `
    });
  },

  // -------------------------------------------------------------
  // PHASE 3: Access Request Received (接收访问需求)
  // -------------------------------------------------------------
  renderPhase3() {
    clearTimeout(this.autoTimer);
    this.currentStep = 3;
    this.playBeep(659.25, 0.08, "triangle", 0.15);
    this.speakVoice("Access request received");

    this.renderHarnessFrame({
      stepNum: "03",
      stepName: "REQUEST",
      statusText: "接收访问需求, 建立会话通道...",
      contentHtml: `
        <div class="flex flex-col items-center justify-center text-center py-10 animate-fadeIn">
          <h2 class="text-3xl md:text-4xl font-black tracking-[0.25em] text-[#1E232E] mb-2">
            接收访问需求
          </h2>
          <p class="text-xs md:text-sm font-mono tracking-[0.3em] text-slate-500 uppercase mb-8">
            ACCESS REQUEST RECEIVED
          </p>

          <!-- Signature Line SVG Animation -->
          <div class="w-72 h-24 relative flex items-center justify-center my-4">
            <svg class="w-full h-full text-[#1E232E]" viewBox="0 0 300 100" fill="none" stroke="currentColor" stroke-width="2">
              <path class="harness-signature-path" d="M 20 60 Q 60 20, 100 55 T 180 50 T 260 40 M 230 30 Q 250 80, 270 45" stroke-linecap="round"/>
            </svg>
          </div>

          <p class="font-mono text-xs tracking-[0.35em] text-slate-600 uppercase mb-1">
            N E X O R A
          </p>
          <p class="font-mono text-[10px] tracking-widest text-slate-400 mb-8">
            088708870887
          </p>

          <div class="w-32 h-[1px] bg-[#1E232E]/20 mb-6"></div>
          <p class="text-[10px] font-mono tracking-widest text-slate-400 animate-pulse">
            [ 会话通道建立中 • 正在跳转... ]
          </p>
        </div>
      `
    });

    // Auto advance after 2.0s
    this.autoTimer = setTimeout(() => {
      this.renderPhase4();
    }, 2000);
  },

  // -------------------------------------------------------------
  // PHASE 4: Permission Read Started (开始读取权限)
  // -------------------------------------------------------------
  renderPhase4() {
    clearTimeout(this.autoTimer);
    this.currentStep = 4;
    this.playBeep(783.99, 0.08, "sine", 0.15);
    this.speakVoice("Beginning permission read");

    // Matrix calendar numbers
    let calGrid = "";
    for (let i = 1; i <= 31; i++) {
      const numStr = String(i).padStart(2, "0");
      const isSpecial = [7, 14, 21, 28].includes(i);
      calGrid += `<span class="${isSpecial ? 'text-cyan-600 font-bold' : 'text-slate-400'}">${numStr}</span>`;
    }

    this.renderHarnessFrame({
      stepNum: "04",
      stepName: "READ",
      statusText: "开始读取权限, 请核对工作空间与会话...",
      contentHtml: `
        <div class="flex flex-col md:flex-row items-center justify-around py-8 px-4 gap-8 animate-fadeIn">
          <!-- Left side details -->
          <div class="text-center md:text-left">
            <h2 class="text-3xl md:text-4xl font-black tracking-[0.25em] text-[#1E232E] mb-2">
              开始读取权限
            </h2>
            <p class="text-xs md:text-sm font-mono tracking-[0.3em] text-slate-500 uppercase mb-6">
              PERMISSION READ STARTED
            </p>
            <p class="font-mono text-xs tracking-[0.35em] text-slate-600 uppercase mb-1">
              DEEPSEEK • NEXORA
            </p>
            <p class="font-mono text-[10px] tracking-widest text-slate-400">
              088708870887
            </p>
          </div>

          <!-- Right side digital matrix calendar -->
          <div class="p-6 bg-white/70 border border-[#1E232E]/15 rounded-sm shadow-sm font-mono text-xs">
            <div class="grid grid-cols-7 gap-3 text-center mb-3 text-[10px] text-slate-400 border-b border-[#1E232E]/10 pb-2">
              <span>01</span><span>02</span><span>03</span><span>04</span><span>05</span><span>06</span><span>07</span>
            </div>
            <div class="grid grid-cols-7 gap-3 text-center harness-matrix-grid">
              ${calGrid}
            </div>
          </div>
        </div>
      `
    });

    // Auto advance after 1.8s
    this.autoTimer = setTimeout(() => {
      this.renderPhase5();
    }, 1800);
  },

  // -------------------------------------------------------------
  // PHASE 5: Read Complete · Verified (读取完毕 · 核验通过)
  // -------------------------------------------------------------
  renderPhase5() {
    clearTimeout(this.autoTimer);
    this.currentStep = 5;
    this.playScanSonar();
    this.speakVoice("Read complete. Verification passed.");

    this.renderHarnessFrame({
      stepNum: "05",
      stepName: "VERIFY",
      statusText: "读取完毕, 核验通过, 权限已授予",
      contentHtml: `
        <div class="flex flex-col items-center justify-center text-center py-6 relative animate-fadeIn">
          <!-- Large Circular Biometric Radar HUD Scan -->
          <div class="w-64 h-64 md:w-80 md:h-80 relative flex items-center justify-center my-2">
            <!-- Rotating Outer Arc -->
            <svg class="absolute inset-0 w-full h-full text-[#1E232E] harness-spin-slow" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="90" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="8 6" opacity="0.4"/>
              <path d="M 100 10 A 90 90 0 0 1 190 100" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="190" cy="100" r="4" fill="currentColor"/>
            </svg>

            <!-- Counter-rotating Inner Arc with dots -->
            <svg class="absolute inset-0 w-full h-full text-cyan-600 harness-spin-reverse" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="68" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="14 10" opacity="0.5"/>
              <circle cx="100" cy="32" r="3" fill="#F97316"/>
              <circle cx="50" cy="150" r="3" fill="#22D3EE"/>
            </svg>

            <!-- Center Verification Typography -->
            <div class="z-10 flex flex-col items-center justify-center p-4">
              <h2 class="text-2xl md:text-3xl font-black tracking-[0.25em] text-[#1E232E] mb-2 leading-snug">
                读取完毕 • 核验通过
              </h2>
              <p class="text-[11px] md:text-xs font-mono tracking-[0.3em] text-slate-500 uppercase">
                READ COMPLETE • VERIFIED
              </p>
            </div>
          </div>
        </div>
      `
    });

    // Auto advance after 2.2s
    this.autoTimer = setTimeout(() => {
      this.renderPhase6();
    }, 2200);
  },

  // -------------------------------------------------------------
  // PHASE 6: Welcome (WELCOME TO NEXORA HARNESS)
  // -------------------------------------------------------------
  renderPhase6() {
    clearTimeout(this.autoTimer);
    this.currentStep = 6;
    this.playAccessGranted();
    this.speakVoice("Welcome to Nexora Harness");

    this.renderHarnessFrame({
      stepNum: "06",
      stepName: "WELCOME",
      statusText: "身份验证完成, 会话已建立",
      contentHtml: `
        <div class="flex flex-col items-center justify-center text-center py-12 animate-fadeIn">
          <!-- Whale / Harness Logo Icon -->
          <div class="w-16 h-16 rounded-full bg-slate-900 text-white flex items-center justify-center mb-6 shadow-md">
            <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/>
              <path d="M7 13c1.5 2 4 3 6.5 2s3.5-3 3.5-5c-2 0-4 1-5 2.5s-2.5 1-5 .5z"/>
            </svg>
          </div>

          <h2 class="text-3xl md:text-5xl font-black tracking-[0.25em] text-[#1E232E] mb-3">
            WELCOME TO
          </h2>
          <h3 class="text-xl md:text-3xl font-extrabold tracking-[0.2em] text-[#1E232E] mb-4">
            NEXORA HARNESS
          </h3>
          <p class="text-xs md:text-sm font-mono tracking-[0.35em] text-slate-500 uppercase mb-2">
            N E X O R A &nbsp; H A R N E S S
          </p>
          <p class="text-xs font-mono tracking-[0.25em] text-cyan-700 font-semibold mb-8">
            欢迎 ${this.userName} 访问
          </p>

          <div class="w-24 h-1 bg-gradient-to-r from-transparent via-[#1E232E] to-transparent animate-pulse"></div>
        </div>
      `
    });

    // Auto transition to Dark Anime Cyberpunk UI after 2.4s
    this.autoTimer = setTimeout(() => {
      this.renderPhase7AnimeCyber();
    }, 2400);
  },

  // -------------------------------------------------------------
  // PHASE 7: Anime Cyberpunk Professional Mode Reveal (The Climax)
  // -------------------------------------------------------------
  renderPhase7AnimeCyber() {
    clearTimeout(this.autoTimer);
    this.playWarpSwoosh();

    const container = document.getElementById("harness-os-content");
    if (!container) return;

    container.innerHTML = `
      <div class="harness-screen bg-[#07090E] text-white flex flex-col justify-between min-h-screen w-full relative overflow-hidden select-none animate-warpFadeIn">
        <!-- Background Neon Grid & Particle Effects -->
        <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(34,211,238,0.2)_0%,rgba(124,92,252,0.15)_40%,transparent_80%)]"></div>
        <div class="absolute inset-0 opacity-15 bg-[linear-gradient(to_right,#22D3EE_1px,transparent_1px),linear-gradient(to_bottom,#22D3EE_1px,transparent_1px)] bg-[size:3rem_3rem]"></div>

        <!-- Top Status Bar -->
        <div class="z-20 flex justify-between items-center px-6 py-4 border-b border-white/10 font-mono text-[11px] text-slate-400">
          <div class="flex items-center gap-3">
            <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span class="text-white font-bold tracking-widest">NEXORA AI // HARNESS OS V1.9</span>
            <span class="hidden md:inline text-slate-500">|</span>
            <span class="hidden md:inline text-slate-400 tracking-wider">BATTERY: 100% • MEMORY: OPTIMIZED</span>
          </div>
          <button onclick="HarnessOS.skip()" class="px-3 py-1 rounded bg-white/5 hover:bg-white/15 border border-white/15 text-slate-300 hover:text-white transition-all">
            SKIP &gt;
          </button>
        </div>

        <!-- Main Body: Cyber Anime AI Muse & HUD -->
        <div class="z-10 flex-1 flex flex-col md:flex-row items-center justify-between px-6 md:px-16 py-8 relative">
          <!-- Left Column: Telemetry & Title -->
          <div class="w-full md:w-1/2 flex flex-col items-start z-10">
            <div class="flex items-center gap-2 mb-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                PRO ACTIVE
              </span>
              <span class="text-[11px] font-mono tracking-widest text-slate-400">
                SYSTEM NORMAL • NO HAZARDS
              </span>
            </div>

            <h1 class="text-4xl md:text-6xl font-black tracking-tight text-white mb-2 drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]">
              Nexora<span class="text-cyan-400">+</span>
            </h1>
            <h2 class="text-2xl md:text-3xl font-extrabold tracking-widest text-slate-200 mb-4">
              欢迎来到专业工作模式
            </h2>
            <p class="text-xs md:text-sm font-mono tracking-[0.3em] text-cyan-400 uppercase mb-6">
              PROFESSIONAL WORK MODE
            </p>

            <!-- Telemetry Box -->
            <div class="w-full max-w-md p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 backdrop-blur-md mb-6 font-mono text-xs">
              <div class="flex justify-between items-center text-slate-400 mb-2 border-b border-white/10 pb-2">
                <span>AI CORE INTELLECT</span>
                <span class="text-cyan-300 font-bold">87.5% • CALIBRATED</span>
              </div>
              <div class="flex justify-between items-center text-slate-400 mb-2">
                <span>OPERATOR CLEARANCE</span>
                <span class="text-white font-bold">${this.userName} (${this.userId})</span>
              </div>
              <!-- Oscilloscope Waveform Line -->
              <div class="w-full h-8 flex items-center justify-between gap-1 overflow-hidden">
                <div class="harness-audio-bar bg-cyan-400 h-2 flex-1 rounded-full animate-pulse"></div>
                <div class="harness-audio-bar bg-purple-400 h-6 flex-1 rounded-full"></div>
                <div class="harness-audio-bar bg-cyan-400 h-4 flex-1 rounded-full"></div>
                <div class="harness-audio-bar bg-purple-400 h-7 flex-1 rounded-full"></div>
                <div class="harness-audio-bar bg-cyan-400 h-3 flex-1 rounded-full"></div>
                <div class="harness-audio-bar bg-cyan-400 h-5 flex-1 rounded-full"></div>
                <div class="harness-audio-bar bg-purple-400 h-2 flex-1 rounded-full"></div>
              </div>
            </div>

            <!-- Action Button -->
            <button onclick="HarnessOS.finish()" class="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#7C5CFC] to-[#22D3EE] text-white font-bold tracking-[0.2em] uppercase shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:shadow-[0_0_40px_rgba(34,211,238,0.7)] hover:scale-105 transition-all flex items-center gap-3">
              <span>进入控制台 &nbsp;|&nbsp; ENTER WORKSPACE</span>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
            <p class="mt-3 text-[11px] font-mono text-slate-500 tracking-wider">
              &gt; Initializing Nexora Design 2.0... (Nhấn Enter để vào ngay)
            </p>
          </div>

          <!-- Right Column: Stunning Cyber Anime AI Muse Artwork -->
          <div class="w-full md:w-1/2 flex items-center justify-center relative mt-8 md:mt-0">
            <div class="relative w-72 h-72 md:w-96 md:h-96 flex items-center justify-center">
              <!-- Glowing neon cyber halo ring -->
              <div class="absolute inset-0 rounded-full border border-cyan-400/30 animate-spin-slow"></div>
              <div class="absolute inset-4 rounded-full border border-purple-500/20 animate-spin-reverse"></div>
              <div class="absolute inset-10 rounded-full bg-gradient-to-b from-cyan-500/10 to-transparent blur-xl"></div>

              <!-- Cyber Anime Muse Illustration Vector -->
              <svg class="w-full h-full drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]" viewBox="0 0 400 400" fill="none">
                <!-- Hair Strands & Ribbons -->
                <path d="M 120 180 Q 80 120, 160 80 Q 240 60, 280 120 Q 320 200, 260 280 T 160 320 Q 110 280, 120 180 Z" stroke="#22D3EE" stroke-width="1.5" stroke-dasharray="4 2" opacity="0.6"/>
                <path d="M 160 80 Q 200 40, 240 70 Q 280 100, 250 160" stroke="#7C5CFC" stroke-width="2"/>
                <!-- Cyber Hat / Ribbon Bow -->
                <path d="M 170 90 L 150 50 L 190 70 Z M 210 90 L 230 50 L 190 70 Z" fill="#151923" stroke="#22D3EE" stroke-width="1.8"/>
                <!-- Face Contour -->
                <path d="M 170 140 Q 160 200, 195 240 Q 230 200, 220 140" stroke="#E2E8F0" stroke-width="2" stroke-linecap="round"/>
                <!-- Closed Eye & Eyelashes (Anime elegance) -->
                <path d="M 175 175 Q 185 180, 195 175" stroke="#F8FAFC" stroke-width="2.5" stroke-linecap="round"/>
                <!-- Glowing Green Cybernetic Iris (As in video!) -->
                <circle cx="215" cy="175" r="7" fill="#10B981" filter="drop-shadow(0 0 8px #10B981)"/>
                <circle cx="215" cy="175" r="3" fill="#FFFFFF"/>
                <path d="M 205 175 Q 215 168, 225 175" stroke="#22D3EE" stroke-width="2" stroke-linecap="round"/>
                <!-- Nose & Lips -->
                <path d="M 193 195 L 195 200" stroke="#94A3B8" stroke-width="1.5"/>
                <path d="M 188 215 Q 195 218, 202 215" stroke="#F43F5E" stroke-width="2"/>
                <!-- Cyber circuit lines on cheek -->
                <path d="M 160 200 L 175 205 L 175 220" stroke="#22D3EE" stroke-width="1.2" stroke-dasharray="2 2"/>
                <circle cx="160" cy="200" r="2" fill="#22D3EE"/>
                <!-- Crown / Cyber Star Icon -->
                <path d="M 280 260 L 285 245 L 295 240 L 285 235 L 280 220 L 275 235 L 265 240 L 275 245 Z" fill="#22D3EE" opacity="0.8"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- Bottom Footer Status -->
        <div class="z-20 flex justify-between items-center px-6 py-3 border-t border-white/10 font-mono text-[10px] text-slate-500">
          <span>YOUR COMPANION FOR A SMARTER FUTURE</span>
          <span>POWERED BY DEEPSEEK & NEXORA ARCHITECTURE</span>
        </div>
      </div>
    `;

    // Auto finish after 6 seconds if user doesn't click
    this.autoTimer = setTimeout(() => {
      this.finish();
    }, 6000);
  },

  // Helper to render the Sci-Fi White Terminal Frame
  renderHarnessFrame({ stepNum, stepName, statusText, contentHtml }) {
    const container = document.getElementById("harness-os-content");
    if (!container) return;

    container.innerHTML = `
      <div class="harness-screen bg-[#F4F4F6] text-[#1E232E] flex flex-col justify-between min-h-screen w-full relative overflow-hidden select-none font-sans">
        <!-- Sci-Fi Technical Grid & Vertical Dividers -->
        <div class="absolute inset-0 pointer-events-none opacity-40 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
        <div class="absolute top-0 bottom-0 left-1/4 w-[1px] bg-[#1E232E]/10 pointer-events-none"></div>
        <div class="absolute top-0 bottom-0 right-1/4 w-[1px] bg-[#1E232E]/10 pointer-events-none"></div>

        <!-- Top Header Bar -->
        <div class="z-20 flex justify-between items-start px-8 py-6">
          <div class="font-mono text-xs leading-relaxed text-[#1E232E]">
            <div class="font-black text-sm tracking-[0.2em]">NEXORA AI</div>
            <div class="tracking-[0.25em] text-slate-600">SYNTHESIZE INTELLIGENCE</div>
            <div class="tracking-[0.25em] font-bold text-slate-800">HARNESS OS</div>
            <div class="text-[10px] text-slate-400 mt-2 tracking-wider">NCV V 1.9 . M32 PROFILE 16:33:24</div>
          </div>

          <button onclick="HarnessOS.skip()" class="font-mono text-xs tracking-[0.25em] text-slate-500 hover:text-[#1E232E] font-bold transition-colors py-1 px-2">
            SKIP &gt;
          </button>
        </div>

        <!-- Center Content Area -->
        <div class="z-10 flex-1 flex items-center justify-center px-4">
          ${contentHtml}
        </div>

        <!-- Bottom Technical Bar -->
        <div class="z-20 flex flex-col md:flex-row justify-between items-center px-8 py-4 border-t border-[#1E232E]/10 font-mono text-[11px] gap-2">
          <!-- Step indicator -->
          <div class="text-[#1E232E] font-bold tracking-widest">
            [ ${stepNum} / 06 ] ${stepName}
          </div>

          <!-- Dynamic Status text -->
          <div class="flex items-center gap-2 text-slate-600 tracking-wider">
            <span class="w-2 h-2 rounded-full bg-[#1E232E] animate-ping"></span>
            <span>${statusText}</span>
          </div>

          <!-- Confirmed & Powered by -->
          <div class="text-slate-400 tracking-widest text-right">
            ID CONFIRMED : ${this.userId} &nbsp;|&nbsp; POWERED BY NEXORA AI
          </div>
        </div>
      </div>
    `;
  },

  nextStep() {
    this.playBeep(600, 0.05, "sine", 0.1);
    if (this.currentStep === 1) this.renderPhase2();
    else if (this.currentStep === 2) this.renderPhase3();
    else if (this.currentStep === 3) this.renderPhase4();
    else if (this.currentStep === 4) this.renderPhase5();
    else if (this.currentStep === 5) this.renderPhase6();
    else if (this.currentStep === 6) this.renderPhase7AnimeCyber();
    else if (this.currentStep === 7) this.finish();
  },

  skip() {
    clearTimeout(this.autoTimer);
    this.finish();
  },

  finish() {
    clearTimeout(this.autoTimer);
    this.active = false;
    this.unbindKeyEvents();

    const overlay = document.getElementById("harness-os-overlay");
    if (overlay) {
      overlay.classList.add("animate-fadeOut");
      setTimeout(() => {
        overlay.classList.add("hidden");
        overlay.classList.remove("animate-fadeOut");
        document.body.style.overflow = "auto";
      }, 500);
    }

    if (typeof this.onCompleteCallback === "function") {
      this.onCompleteCallback();
      this.onCompleteCallback = null;
    }
  }
};
