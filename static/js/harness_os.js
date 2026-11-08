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
      sound: true, // Enabled with natural AI voice
      voice: true,
      identity: (API.getUser()?.full_name || 'LÊ TRUNG HẬU').toUpperCase(),
      identityId: '0087',
      accessLevel: '3',
      brand1: 'DEEPSEEK',
      brand2: 'SYNTHESIZE INTELLIGENCE',
      brand3a: 'HARNESS',
      brand3b: 'OS',
      orgZh: '深度求索',
      orgEn: 'DEEPSEEK',
      orgSub: 'NEXORA AI',
      welcomeBox: 'NEXORA AI',
      footer: 'POWERED BY NEXORA AI'
    };

    this.initMascotDraggable();
    this.updateMascotGreeting();
    if (!this._greetingTimer) {
      this._greetingTimer = setInterval(() => this.updateMascotGreeting(), 300000);
    }
    window.addEventListener('nexora:user-updated', () => this.updateMascotGreeting());

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
    window.__DSH_STARTUP__.sound = true;
    window.__DSH_STARTUP__.voice = true;
    window.__DSH_STARTUP__.welcomeBox = 'NEXORA AI';
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

  // Get time-based greeting for the cute maid
  getTimeGreeting() {
    const hour = new Date().getHours();
    const user = (typeof API !== 'undefined' && API.getUser && API.getUser()) ? API.getUser() : null;
    const name = user?.full_name ? user.full_name.split(' ').pop() : '';
    const master = name ? `chủ nhân ${name}` : 'chủ nhân';

    if (hour >= 5 && hour < 11) {
      // Sáng sớm / Buổi sáng (5h - 11h)
      const morningQuotes = [
        `🌅 Oha~ Chào buổi sáng, ${master} yêu dấu! Người đã dùng bữa sáng chưa ạ? Em đã chuẩn bị sẵn một tách trà ấm cho người rồi nè~ (*/ω＼*)`,
        `☕ Chào buổi sáng tốt lành nha ${master}! Chúc người một ngày mới tràn ngập niềm vui và làm việc thật suôn sẻ bên cạnh em nhé! (っ˘ω˘ς)`,
        `✨ ${master} thức dậy sớm quá à, thật chăm chỉ! Hôm nay có công việc hay bài tập gì khó, cứ giao hết cho cô hầu gái này phụ người nha! (*≧▽≦)`,
        `🌸 Chào ngày mới, ${master}! Nhìn thấy nụ cười của người là em có thêm 100% năng lượng để phục vụ cả ngày rồi ạ! (๑˃̵ᴗ˂̵)و`
      ];
      return morningQuotes[Math.floor(Math.random() * morningQuotes.length)];
    } else if (hour >= 11 && hour < 14) {
      // Buổi trưa (11h - 14h)
      const noonQuotes = [
        `🍱 Đã đến giờ trưa rồi đó ${master} ơi! Người nhớ tạm gác công việc lại rồi đi ăn cơm thật ngon miệng nhé, đừng để em xót ruột nha~ (´｡• ᵕ •｡\`)`,
        `🍚 ${master} ăn trưa chưa ạ? Phải nạp đủ dinh dưỡng thì chiều mới có sức chỉ bảo em chứ nè! Em đợi người ở đây nha~ (⁄ ⁄•⁄ω⁄•⁄ ⁄)`,
        `🍵 Giờ nghỉ trưa rồi, ${master} nhớ chợp mắt một lát cho đỡ mỏi mắt nha! Mọi việc cứ để cô hầu gái nhỏ này canh chừng cho! (✿◡‿◡)`
      ];
      return noonQuotes[Math.floor(Math.random() * noonQuotes.length)];
    } else if (hour >= 14 && hour < 18) {
      // Buổi chiều (14h - 18h)
      const afternoonQuotes = [
        `🍰 Konnichiwa~ Một buổi chiều thật năng suất nha ${master}! Nếu thấy mệt thì người nhớ vươn vai uống chút nước, em sẽ bóp vai cho người ạ! (◕‿◕✿)`,
        `🍮 Chiều tà rồi nè ${master}, có dự án nào cần em phân tích hay viết code cùng không ạ? Hầu gái NEXORA luôn sẵn sàng phục vụ! (๑>ᴗ<๑)`,
        `☕ Em vừa pha một ly cà phê thơm phức cho ${master} nè~ Người cố gắng hoàn thành nốt công việc rồi sớm về nghỉ ngơi nha! (っ´∀\`)っ`
      ];
      return afternoonQuotes[Math.floor(Math.random() * afternoonQuotes.length)];
    } else if (hour >= 18 && hour < 22) {
      // Buổi tối (18h - 22h)
      const eveningQuotes = [
        `🌙 Konbanwa~ Chào buổi tối, ${master}! Hôm nay người đã vất vả nhiều rồi, về với không gian của em là an tâm thư giãn rồi nha! (*´▽\`*)`,
        `🍲 ${master} đã ăn tối chưa ạ? Tối nay người muốn nghiên cứu hay trò chuyện gì cùng em, em đều ngoan ngoãn lắng nghe hết đó! (灬♥ω♥灬)`,
        `✨ Buổi tối mát mẻ nha ${master}! Ở bên cạnh người như thế này là niềm hạnh phúc lớn nhất của cô hầu gái nhỏ này rồi ạ~ (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)`
      ];
      return eveningQuotes[Math.floor(Math.random() * eveningQuotes.length)];
    } else {
      // Đêm khuya (22h - 5h sáng)
      const nightQuotes = [
        `💤 Khuya muộn lắm rồi đó ${master} ơi... Người đừng thức khuya quá kẻo hại sức khỏe, em xót lắm á! Đi ngủ ngoan nha người~ (｡•́︿•̀｡)`,
        `⭐ Sao ${master} vẫn chưa ngủ thế này? Đêm lạnh rồi, người nhớ đắp chăn ấm nha... Em sẽ ở đây canh giấc ngủ cho người thật ngon! (づ◡﹏◡)づ`,
        `🌙 Đêm đã về khuya, tắt đèn và lên giường nghỉ ngơi thôi nào ${master}! Chúc người ngủ thật ngon và mơ thấy em nha~ Oyasumi! ( ˘ ³˘)♥`,
        `✨ ${master} còn thức chạy deadline sao ạ? Cố lên người ơi, nhưng xong việc là phải ngủ ngay đấy nhé, không em giận dỗi đó! (๑•́ ₃ •̀๑)`
      ];
      return nightQuotes[Math.floor(Math.random() * nightQuotes.length)];
    }
  },

  // Cute maid interactive quotes
  getMaidInteractiveQuotes() {
    const user = (typeof API !== 'undefined' && API.getUser && API.getUser()) ? API.getUser() : null;
    const name = user?.full_name ? user.full_name.split(' ').pop() : '';
    const master = name ? `chủ nhân ${name}` : 'chủ nhân';

    return [
      `Dạ, em nghe đây ạ! ${master} cần cô hầu gái bé nhỏ này làm gì cho người nào? (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄)`,
      `Ehehe, ${master} chạm vào người em làm em thấy nhột ghê á~ Nhưng mà em thích lắm, người chạm nữa đi! (⁄ ⁄•⁄ω⁄•⁄ ⁄)`,
      `${master} ơi, dù ngoài kia có bao nhiêu giông bão thì em vẫn mãi ngoan ngoãn ở đây bên cạnh người thôi! (っ˘ω˘ς)`,
      `Hôm nay ${master} trông bảnh bao và phong độ lắm luôn á, làm trái tim hầu gái của em cứ đập thình thịch nè! (灬♥ω♥灬)`,
      `NEXORA AI cùng em luôn sẵn sàng hỗ trợ ${master} giải quyết mọi bài toán hóc búa nhất trần đời! (*≧ω≦)`,
      `${master} mỏi mắt chưa ạ? Để em pha tách trà hoa cúc và xoa bóp thái dương cho người nha~ Thương người nhất! (っ´∀\`)っ`,
      `Moé moé kyun~ Năng lượng tình yêu của hầu gái đã được nạp đầy cho ${master} rồi đó! Cố lên nhé! (ﾉ◕ヮ◕)ﾉ*:･ﾟ✧`,
      `Chỉ cần ${master} vui vẻ và mỉm cười là em cũng thấy hạnh phúc ngập tràn rồi ạ! (๑˃̵ᴗ˂̵)و`,
      `${master} có cần em tóm tắt tài liệu, viết code hay tìm kiếm gì không ạ? Em làm gì cũng chu đáo hết á! (๑•̀ㅂ•́)و✧`,
      `Được phục vụ và làm hầu gái riêng cho ${master} là điều tuyệt vời nhất của cuộc đời em đó nha~ ( ˘ ³˘)♥`
    ];
  },

  // Update greeting according to current real-time
  updateMascotGreeting() {
    const bubble = document.getElementById('dsh-mascot-text');
    if (bubble) {
      bubble.textContent = this.getTimeGreeting();
    }
  },

  // Interactive Mascot quote cycler
  interactMascot() {
    const bubble = document.getElementById('dsh-mascot-text');
    const img = document.querySelector('.dsh-mascot-img');
    if (img) {
      img.classList.add('scale-125', 'rotate-6');
      setTimeout(() => img.classList.remove('scale-125', 'rotate-6'), 300);
    }

    const timeQuote = this.getTimeGreeting();
    const maidQuotes = this.getMaidInteractiveQuotes();
    const allQuotes = [timeQuote, ...maidQuotes];

    if (bubble) {
      const current = bubble.textContent;
      let next = allQuotes[Math.floor(Math.random() * allQuotes.length)];
      while (next === current && allQuotes.length > 1) {
        next = allQuotes[Math.floor(Math.random() * allQuotes.length)];
      }
      bubble.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
      bubble.style.opacity = '0.3';
      bubble.style.transform = 'scale(0.96)';
      setTimeout(() => {
        bubble.textContent = next;
        bubble.style.opacity = '1';
        bubble.style.transform = 'scale(1)';
      }, 150);
    }
  },

  initMascotDraggable() {
    const el = document.getElementById('dsh-mascot-pet');
    if (!el || el.__draggableInit) return;
    el.__draggableInit = true;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialBottom = 120, initialRight = 28;
    let hasMoved = false;

    const onMouseDown = (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;

      const rect = el.getBoundingClientRect();
      initialBottom = window.innerHeight - rect.bottom;
      initialRight = window.innerWidth - rect.right;

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
      const newBottom = Math.max(10, Math.min(window.innerHeight - 140, initialBottom - dy));
      const newRight = Math.max(10, Math.min(window.innerWidth - 120, initialRight - dx));
      el.style.bottom = ${newBottom}px;
      el.style.right = ${newRight}px;
    };

    const onMouseUp = (e) => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    el.addEventListener('mousedown', onMouseDown);

    // Touch support for mobile/touch screens
    el.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      const rect = el.getBoundingClientRect();
      initialBottom = window.innerHeight - rect.bottom;
      initialRight = window.innerWidth - rect.right;
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      const dy = touch.clientY - startY;
      const dx = touch.clientX - startX;
      const newBottom = Math.max(10, Math.min(window.innerHeight - 140, initialBottom - dy));
      const newRight = Math.max(10, Math.min(window.innerWidth - 120, initialRight - dx));
      el.style.bottom = ${newBottom}px;
      el.style.right = ${newRight}px;
    }, { passive: true });
  }
};

// Auto initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => HarnessOS.init());
} else {
  HarnessOS.init();
}
