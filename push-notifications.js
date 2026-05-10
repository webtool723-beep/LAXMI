class PushNotificationManager {
  constructor() {
    this.messaging = null;
    this.currentToken = null;
    this.permissionGranted = false;
    this.prePromptShown = false;
    this.initialized = false;
    this.swRegistration = null;
  }

  async init(messagingInstance) {
    if (this.initialized) return;
    this.messaging = messagingInstance;
    this.initialized = true;

    const savedToken = localStorage.getItem('rms_fcm_token');
    if (savedToken) this.currentToken = savedToken;

    const permission = Notification.permission;
    if (permission === 'granted') {
      this.permissionGranted = true;
      if (!savedToken) await this.getToken();
    }

    try {
      this.swRegistration = await navigator.serviceWorker.ready;
    } catch (e) {}
  }

  showPrePermissionPrompt() {
    if (this.prePromptShown) return Promise.resolve(false);
    if (Notification.permission === 'granted') {
      this.prePromptShown = true;
      return Promise.resolve(true);
    }
    if (Notification.permission === 'denied') {
      this.prePromptShown = true;
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'push-prompt-overlay';
      overlay.innerHTML = `
        <div class="push-prompt-card">
          <div class="push-prompt-icon">🔔</div>
          <div class="push-prompt-title">Stay Updated with LAXMI</div>
          <div class="push-prompt-text">
            Get instant order updates, status changes, and exclusive offers — even when you're not on the website.
          </div>
          <div class="push-prompt-actions">
            <button class="push-prompt-btn push-prompt-allow">Enable Notifications</button>
            <button class="push-prompt-btn push-prompt-skip">Maybe Later</button>
          </div>
          <div class="push-prompt-footer">You can change this anytime in browser settings</div>
        </div>
      `;
      document.body.appendChild(overlay);

      const style = document.createElement('style');
      style.textContent = `
        .push-prompt-overlay {
          position: fixed; inset: 0; z-index: 99999;
          background: rgba(0,0,0,0.5);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .push-prompt-card {
          background: #fff; border-radius: 16px; padding: 32px 28px 24px;
          max-width: 380px; width: 100%; text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          animation: slideUp 0.4s ease;
        }
        .push-prompt-icon { font-size: 3.5rem; margin-bottom: 12px; }
        .push-prompt-title {
          font-size: 1.3rem; font-weight: 700; color: #1a2e1a;
          font-family: 'Playfair Display', Georgia, serif; margin-bottom: 10px;
        }
        .push-prompt-text {
          font-size: 0.9rem; color: #555; line-height: 1.6; margin-bottom: 24px;
          font-family: 'DM Sans', sans-serif;
        }
        .push-prompt-actions { display: flex; flex-direction: column; gap: 10px; }
        .push-prompt-btn {
          padding: 12px 24px; border-radius: 10px; font-size: 0.95rem;
          font-weight: 600; cursor: pointer; border: none; transition: all 0.2s;
          font-family: 'DM Sans', sans-serif;
        }
        .push-prompt-allow {
          background: #1a2e1a; color: #c8a96e;
        }
        .push-prompt-allow:hover { background: #2d4a2d; }
        .push-prompt-skip {
          background: transparent; color: #888; border: 1px solid #ddd;
        }
        .push-prompt-skip:hover { background: #f5f5f5; }
        .push-prompt-footer { font-size: 0.75rem; color: #aaa; margin-top: 16px; }
      `;
      document.head.appendChild(style);

      overlay.querySelector('.push-prompt-allow').onclick = async () => {
        overlay.remove();
        style.remove();
        this.prePromptShown = true;
        const granted = await this.requestPermission();
        resolve(granted);
      };
      overlay.querySelector('.push-prompt-skip').onclick = () => {
        overlay.remove();
        style.remove();
        this.prePromptShown = true;
        localStorage.setItem('rms_push_prompt_skipped', 'true');
        resolve(false);
      };
    });
  }

  async requestPermission() {
    try {
      if (!this.messaging) return false;
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        this.permissionGranted = true;
        await this.getToken();
        return true;
      }
      return false;
    } catch (e) {
      console.warn('Push: permission request failed', e);
      return false;
    }
  }

  async getToken() {
    try {
      if (!this.messaging || !this.permissionGranted) return null;
      const { getToken } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js');
      const token = await getToken(this.messaging, {
        vapidKey: 'BAUyRSwvRJvvc_DSvWCx8lQtjW70RjQNUM4F05WJQt5VaEODsaTs4aOTmM4PepLcN1x42hE_GFwPXc-6qQhWaOY'
      });
      if (token) {
        this.currentToken = token;
        localStorage.setItem('rms_fcm_token', token);
      }
      return token;
    } catch (e) {
      console.warn('Push: getToken failed', e);
      return null;
    }
  }

  async sendPushNotification(notif) {
    if (!notif || !notif.title) return;

    if (Notification.permission !== 'granted') return;

    const payload = {
      type: 'show-notification',
      title: notif.title,
      body: notif.message || '',
      icon: '/logo-192.png',
      tag: 'rms-' + (notif.id || Date.now()),
      url: notif.url || window.location.href,
      orderId: notif.orderId || null
    };

    try {
      if (this.swRegistration && this.swRegistration.active) {
        this.swRegistration.active.postMessage(payload);
      } else {
        const reg = await navigator.serviceWorker.ready;
        this.swRegistration = reg;
        if (reg.active) reg.active.postMessage(payload);
      }
    } catch (e) {
      console.warn('Push: service worker postMessage failed', e);
    }

    // ── FCM token stored for future backend integration ──
    // When a backend server is available, send the token to:
    //   POST /api/push-token  { token, device, userAgent }
    // The backend can then send via FCM HTTP API using the Server Key
    // from Firebase Console → Project Settings → Cloud Messaging
    const token = this.currentToken || localStorage.getItem('rms_fcm_token');
    if (token) {
      const storeKey = 'rms_fcm_tokens_sent';
      const sent = JSON.parse(localStorage.getItem(storeKey) || '[]');
      if (!sent.includes(token)) {
        sent.push(token);
        localStorage.setItem(storeKey, JSON.stringify(sent));
      }
    }
  }

  async initializeWithPermissionCheck() {
    const skipped = localStorage.getItem('rms_push_prompt_skipped');
    if (skipped === 'true') return;
    if (Notification.permission === 'denied') return;

    if (Notification.permission === 'granted') {
      this.permissionGranted = true;
      await this.getToken();
      return;
    }

    const userActivity = localStorage.getItem('rms_user_orders') || localStorage.getItem('rms_notifications');
    if (userActivity) {
      setTimeout(() => this.showPrePermissionPrompt(), 3000);
    }
  }
}

window.pushNotificationManager = new PushNotificationManager();
