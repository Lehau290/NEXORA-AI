// ============================================================
// NEXORA AI - DEEPSEEK HARNESS OS STARTUP & WORKSPACE INTEGRATION
// Powered by dsh-startup-screen & dsh-wallpaper-engine
// ============================================================

const HarnessOS = {
  active: false,
  onCompleteCallback: null,

  init() {
    window.__DSH_STARTUP_SCRIPT_URL__ = 'static/js/splash.js';
    window.__DSH_STARTUP_SKIP__ = true; // Wait for login or manual trigger

    // Default configuration matching dsh-startup-screen
    window.__DSH_STARTUP__ = {
      enabled: true,
      mode: 'always',
      theme: 'light', // Light warm-white dossier theme matching video
      speed: 1,
      requireInteraction: true, // Step 1 & 2 require user confirmation
      allowSkip: true,
      sound: false, // Muted by default per user request ("đừng có tiếng")
      voice: false,
      identity: (API.getUser()?.full_name || 'LÊ TRUNG HẬU').toUpperCase(),
      identityId: '0087',
      accessLevel: '3',
      brand1: 'DEEPSEEK',
      brand2: 'SYNTHESIZE INTELLIGENCE',
      brand3a: 'HARNESS',
      brand3b: 'OS',
      orgZh: '深度求索',
      orgEn: 'DEEPSEEK',
      orgSub: 'DEEPSEEK HARNESS',
      welcomeBox: 'DEEPSEEK HARNESS',
      footer: 'POWERED BY DEEPSEEK'
    };

    window.addEventListener('dsh-startup:done', () => {
      this.active = false;
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      if (typeof this.onCompleteCallback === 'function') {
        const cb = this.onCompleteCallback;
        this.onCompleteCallback = null;
        cb();
      }
    });
  },

  startSequence(user = null, onComplete = null) {
    this.active = true;
    this.onCompleteCallback = onComplete;

    const userName = (user?.full_name || API.getUser()?.full_name || 'LÊ TRUNG HẬU').toUpperCase();
    if (!window.__DSH_STARTUP__) {
      this.init();
    }

    window.__DSH_STARTUP__.identity = userName;
    window.__DSH_STARTUP__.identityId = '0087';
    window.__DSH_STARTUP__.accessLevel = user?.role === 'admin' ? 'ROOT' : '3';
    window.__DSH_STARTUP__.theme = 'light';
    window.__DSH_STARTUP__.sound = false;
    window.__DSH_STARTUP__.voice = false;
    window.__DSH_STARTUP_SKIP__ = false;

    // Trigger authentic dsh-startup-screen replay
    if (window.__DSH_STARTUP_API__ && typeof window.__DSH_STARTUP_API__.replay === 'function') {
      window.__DSH_STARTUP_API__.replay();
    } else {
      // Re-inject script if not loaded
      const s = document.createElement('script');
      s.setAttribute('data-dsh-startup-runtime', '1');
      s.src = 'static/js/splash.js?t=' + Date.now();
      document.head.appendChild(s);
    }
  },

  skip() {
    if (window.__DSH_STARTUP_API__ && typeof window.__DSH_STARTUP_API__.skip === 'function') {
      window.__DSH_STARTUP_API__.skip();
    }
  },

  // Interactive Mascot quote cycler
  interactMascot() {
    const bubble = document.getElementById('dsh-mascot-text');
    const img = document.querySelector('.dsh-mascot-img');
    if (img) {
      img.classList.add('scale-125');
      setTimeout(() => img.classList.remove('scale-125'), 300);
    }

    const quotes = [
      '✨ Chào bạn! Tôi là linh vật DeepSeek Harness. Bạn cần tìm hiểu điều gì hôm nay?',
      '🚀 DeepSeek-V3.1 & Multi-Agent sẵn sàng hỗ trợ bạn hoàn thành mọi dự án!',
      '💡 Mẹo: Bạn có thể bấm nút "Harness OS" trên thanh điều hướng để xem lại hiệu ứng khởi động!',
      '📊 Bộ nhớ AI đã sẵn sàng ghi nhớ các thông tin và sở thích của bạn.',
      '🌟 Không gian làm việc Liquid Glass & Wallpaper Engine đã được tối ưu hiệu năng tối đa!'
    ];

    if (bubble) {
      const current = bubble.textContent;
      let next = quotes[Math.floor(Math.random() * quotes.length)];
      while (next === current && quotes.length > 1) {
        next = quotes[Math.floor(Math.random() * quotes.length)];
      }
      bubble.textContent = next;
    }
  }
};

// Auto initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => HarnessOS.init());
} else {
  HarnessOS.init();
}
