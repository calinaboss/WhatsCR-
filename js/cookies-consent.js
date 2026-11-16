(function () {
  const CONSENT_STORAGE_KEY = 'whatscr_cookie_consent_v1';

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied',
    'wait_for_update': 500
  });

  gtag('js', new Date());
  gtag('config', 'G-NQY8JZWCJP');

  function injectStyles() {
    if (document.getElementById('whatscr-cookie-styles')) return;
    const style = document.createElement('style');
    style.id = 'whatscr-cookie-styles';
    style.textContent = `
.cookie-floating-btn {
  position: fixed !important;
  bottom: 24px !important;
  left: 24px !important;
  width: 48px !important;
  height: 48px !important;
  border-radius: 50% !important;
  background: #ffffff !important;
  color: #0097b2 !important;
  border: 1.5px solid #cbd5e1 !important;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 1.3rem !important;
  cursor: pointer !important;
  z-index: 99995 !important;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease !important;
}
.cookie-floating-btn:hover {
  transform: scale(1.08) !important;
  border-color: #0097b2 !important;
  box-shadow: 0 6px 20px rgba(0, 151, 178, 0.25) !important;
  background: #f8fafc !important;
}
.cookie-floating-btn:focus-visible {
  outline: 3px solid #0097b2 !important;
  outline-offset: 3px !important;
}
.cookie-banner {
  position: fixed !important;
  bottom: 24px !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  width: calc(100% - 32px) !important;
  max-width: 660px !important;
  z-index: 99998 !important;
  background: #ffffff !important;
  color: #0f172a !important;
  border: 1px solid #e2e8f0 !important;
  border-radius: 18px !important;
  padding: 22px 24px !important;
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.14) !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 14px !important;
  animation: cookieBannerFadeUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
  font-family: inherit !important;
}
.cookie-banner.is-hidden {
  display: none !important;
}
@keyframes cookieBannerFadeUp {
  from { opacity: 0; transform: translate(-50%, 16px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
.cookie-banner-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 10px !important;
}
.cookie-banner-header-left {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
}
.cookie-banner-icon {
  font-size: 1.35rem !important;
  color: #0097b2 !important;
  flex-shrink: 0 !important;
}
.cookie-banner-title {
  margin: 0 !important;
  font-size: 1.05rem !important;
  font-weight: 700 !important;
  color: #0f172a !important;
  letter-spacing: -0.01em !important;
}
.cookie-banner-body {
  margin: 0 !important;
  font-size: 0.88rem !important;
  line-height: 1.55 !important;
  color: #475569 !important;
}
.cookie-banner-body a {
  color: #0097b2 !important;
  text-decoration: underline !important;
  text-underline-offset: 2px !important;
}
.cookie-banner-actions {
  display: flex !important;
  flex-wrap: wrap !important;
  gap: 10px !important;
  align-items: center !important;
}
.cookie-btn {
  padding: 10px 18px !important;
  border-radius: 10px !important;
  font-size: 0.88rem !important;
  font-weight: 600 !important;
  cursor: pointer !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  transition: all 0.15s ease !important;
  border: none !important;
  font-family: inherit !important;
}
.cookie-btn-primary {
  background: #0097b2 !important;
  color: #ffffff !important;
}
.cookie-btn-primary:hover {
  background: #007a91 !important;
  transform: translateY(-1px) !important;
}
.cookie-btn-secondary {
  background: #f1f5f9 !important;
  color: #334155 !important;
  border: 1px solid #e2e8f0 !important;
}
.cookie-btn-secondary:hover {
  background: #e2e8f0 !important;
  color: #0f172a !important;
}
.cookie-btn-outline {
  background: #ffffff !important;
  color: #475569 !important;
  border: 1px solid #cbd5e1 !important;
}
.cookie-btn-outline:hover {
  color: #0f172a !important;
  border-color: #94a3b8 !important;
  background: #f8fafc !important;
}
.cookie-modal-overlay {
  position: fixed !important;
  inset: 0 !important;
  background: rgba(15, 23, 42, 0.6) !important;
  z-index: 100005 !important;
  display: flex;
  align-items: center !important;
  justify-content: center !important;
  padding: 16px !important;
  animation: cookieFadeIn 0.2s ease !important;
}
.cookie-modal-overlay.is-hidden {
  display: none !important;
}
@keyframes cookieFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.cookie-modal {
  background: #ffffff !important;
  color: #0f172a !important;
  width: 100% !important;
  max-width: 600px !important;
  max-height: 90vh !important;
  border-radius: 18px !important;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25) !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  font-family: inherit !important;
  animation: cookieModalZoom 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
}
@keyframes cookieModalZoom {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}
.cookie-modal-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 18px 22px !important;
  border-bottom: 1px solid #e2e8f0 !important;
}
.cookie-modal-title-row {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
}
.cookie-modal-title-row i {
  color: #0097b2 !important;
  font-size: 1.3rem !important;
}
.cookie-modal-title {
  margin: 0 !important;
  font-size: 1.1rem !important;
  font-weight: 700 !important;
  color: #0f172a !important;
}
.cookie-modal-close {
  background: transparent !important;
  border: none !important;
  font-size: 1.2rem !important;
  color: #64748b !important;
  cursor: pointer !important;
  padding: 6px !important;
  border-radius: 8px !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.15s ease !important;
}
.cookie-modal-close:hover {
  background: #f1f5f9 !important;
  color: #0f172a !important;
}
.cookie-modal-body {
  padding: 18px 22px !important;
  overflow-y: auto !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 14px !important;
}
.cookie-modal-desc {
  margin: 0 !important;
  font-size: 0.88rem !important;
  line-height: 1.5 !important;
  color: #475569 !important;
}
.cookie-cat-card {
  border: 1px solid #e2e8f0 !important;
  border-radius: 12px !important;
  padding: 14px 16px !important;
  background: #f8fafc !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 6px !important;
  transition: border-color 0.15s ease !important;
}
.cookie-cat-card:hover {
  border-color: #cbd5e1 !important;
}
.cookie-cat-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
}
.cookie-cat-title-wrap {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
}
.cookie-cat-icon {
  font-size: 1.05rem !important;
  color: #0097b2 !important;
}
.cookie-cat-title {
  font-size: 0.94rem !important;
  font-weight: 700 !important;
  color: #0f172a !important;
  cursor: pointer !important;
}
.cookie-cat-badge {
  font-size: 0.72rem !important;
  font-weight: 700 !important;
  padding: 3px 8px !important;
  border-radius: 6px !important;
  background: #e2e8f0 !important;
  color: #475569 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.04em !important;
}
.cookie-cat-badge.badge-required {
  background: #e0f2fe !important;
  color: #00687a !important;
}
.cookie-cat-desc {
  margin: 0 !important;
  font-size: 0.84rem !important;
  color: #64748b !important;
  line-height: 1.45 !important;
}
.cookie-toggle {
  position: relative !important;
  display: inline-block !important;
  width: 42px !important;
  height: 22px !important;
  flex-shrink: 0 !important;
}
.cookie-toggle input {
  opacity: 0 !important;
  width: 0 !important;
  height: 0 !important;
}
.cookie-toggle-slider {
  position: absolute !important;
  cursor: pointer !important;
  inset: 0 !important;
  background-color: #cbd5e1 !important;
  transition: 0.2s ease !important;
  border-radius: 22px !important;
}
.cookie-toggle-slider::before {
  position: absolute !important;
  content: "" !important;
  height: 16px !important;
  width: 16px !important;
  left: 3px !important;
  bottom: 3px !important;
  background-color: white !important;
  transition: 0.2s ease !important;
  border-radius: 50% !important;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2) !important;
}
.cookie-toggle input:checked + .cookie-toggle-slider {
  background-color: #0097b2 !important;
}
.cookie-toggle input:checked + .cookie-toggle-slider::before {
  transform: translateX(20px) !important;
}
.cookie-toggle input:disabled + .cookie-toggle-slider {
  opacity: 0.65 !important;
  cursor: not-allowed !important;
}
.cookie-modal-footer {
  padding: 14px 22px !important;
  border-top: 1px solid #e2e8f0 !important;
  background: #f8fafc !important;
  display: flex !important;
  flex-wrap: wrap !important;
  justify-content: flex-end !important;
  gap: 10px !important;
}
@media (max-width: 640px) {
  .cookie-floating-btn {
    bottom: 16px !important;
    left: 16px !important;
    width: 44px !important;
    height: 44px !important;
    font-size: 1.15rem !important;
  }
  .cookie-banner {
    bottom: 12px !important;
    width: calc(100% - 20px) !important;
    padding: 16px 18px !important;
  }
  .cookie-banner-actions {
    flex-direction: column !important;
  }
  .cookie-btn {
    width: 100% !important;
  }
  .cookie-modal {
    max-height: 94vh !important;
  }
  .cookie-modal-footer {
    flex-direction: column !important;
  }
  .cookie-modal-footer .cookie-btn {
    width: 100% !important;
  }
}
    `;
    document.head.appendChild(style);
  }

  function loadGtmScript() {
    if (document.getElementById('gtm-script-loaded')) return;
    const s = document.createElement('script');
    s.id = 'gtm-script-loaded';
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=G-NQY8JZWCJP';
    document.head.appendChild(s);
  }

  function getStoredConsent() {
    try {
      const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveConsent(prefs) {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(prefs));
    } catch (e) {}
    applyConsent(prefs);
  }

  function applyConsent(prefs) {
    if (!prefs) return;

    loadGtmScript();

    gtag('consent', 'update', {
      'analytics_storage': prefs.analytics ? 'granted' : 'denied',
      'ad_storage': prefs.marketing ? 'granted' : 'denied',
      'ad_user_data': prefs.marketing ? 'granted' : 'denied',
      'ad_personalization': prefs.marketing ? 'granted' : 'denied'
    });
  }

  function createFloatingButton() {
    if (document.getElementById('cookie-floating-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'cookie-floating-btn';
    btn.className = 'cookie-floating-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Cookie Preferences');
    btn.setAttribute('title', 'Manage cookie preferences');
    btn.innerHTML = '<i class="fa-solid fa-cookie-bite" aria-hidden="true"></i>';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openCookieModal();
    });

    document.body.appendChild(btn);
  }

  function createBanner() {
    let existingBanner = document.getElementById('cookie-banner');
    if (existingBanner && existingBanner.parentNode) {
      existingBanner.parentNode.removeChild(existingBanner);
    }

    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'true');
    banner.setAttribute('aria-labelledby', 'cookie-banner-title');
    banner.setAttribute('aria-describedby', 'cookie-banner-desc');

    banner.innerHTML = `
      <div class="cookie-banner-header">
        <div class="cookie-banner-header-left">
          <i class="fa-solid fa-cookie-bite cookie-banner-icon" aria-hidden="true"></i>
          <h3 id="cookie-banner-title" class="cookie-banner-title">Cookie &amp; Privacy Preferences</h3>
        </div>
        <button type="button" id="cookie-banner-close" class="cookie-modal-close" aria-label="Close banner">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
      <p id="cookie-banner-desc" class="cookie-banner-body">
        We use essential technical cookies and, with your consent, analytics and advertising tools to enhance your audio experience and support the WhatsCR platform. You can accept all, reject non-essential cookies, or customize your choices. Read our <a href="cookies.html">Cookie Policy</a>.
      </p>
      <div class="cookie-banner-actions">
        <button type="button" id="cookie-btn-accept-all" class="cookie-btn cookie-btn-primary">
          <i class="fa-solid fa-check" aria-hidden="true"></i> Accept All
        </button>
        <button type="button" id="cookie-btn-reject-all" class="cookie-btn cookie-btn-secondary">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i> Reject Non-Essential
        </button>
        <button type="button" id="cookie-btn-customize" class="cookie-btn cookie-btn-outline">
          <i class="fa-solid fa-sliders" aria-hidden="true"></i> Customize
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    const closeBanner = () => {
      banner.classList.add('is-hidden');
      banner.style.setProperty('display', 'none', 'important');
      if (banner.parentNode) {
        banner.parentNode.removeChild(banner);
      }
    };

    const bannerCloseBtn = document.getElementById('cookie-banner-close');
    if (bannerCloseBtn) {
      bannerCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveConsent({ necessary: true, analytics: false, marketing: false, timestamp: new Date().toISOString() });
        closeBanner();
      });
    }

    const acceptBtn = document.getElementById('cookie-btn-accept-all');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveConsent({ necessary: true, analytics: true, marketing: true, timestamp: new Date().toISOString() });
        closeBanner();
      });
    }

    const rejectBtn = document.getElementById('cookie-btn-reject-all');
    if (rejectBtn) {
      rejectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveConsent({ necessary: true, analytics: false, marketing: false, timestamp: new Date().toISOString() });
        closeBanner();
      });
    }

    const customizeBtn = document.getElementById('cookie-btn-customize');
    if (customizeBtn) {
      customizeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openCookieModal();
      });
    }
  }

  function openCookieModal() {
    let existingOverlay = document.getElementById('cookie-modal-overlay');
    if (existingOverlay && existingOverlay.parentNode) {
      existingOverlay.parentNode.removeChild(existingOverlay);
    }

    const overlay = document.createElement('div');
    overlay.id = 'cookie-modal-overlay';
    overlay.className = 'cookie-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'cookie-modal-title');

    const current = getStoredConsent() || { necessary: true, analytics: false, marketing: false };

    overlay.innerHTML = `
      <div class="cookie-modal" role="document">
        <div class="cookie-modal-header">
          <div class="cookie-modal-title-row">
            <i class="fa-solid fa-cookie-bite" aria-hidden="true"></i>
            <h3 id="cookie-modal-title" class="cookie-modal-title">Cookie Consent Management</h3>
          </div>
          <button type="button" id="cookie-modal-close" class="cookie-modal-close" aria-label="Close window">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div class="cookie-modal-body">
          <p class="cookie-modal-desc">
            Customize your cookie choices for WhatsCR. Strictly necessary technical cookies cannot be disabled because they ensure infrastructure security and core platform features.
          </p>

          <div class="cookie-cat-card">
            <div class="cookie-cat-header">
              <div class="cookie-cat-title-wrap">
                <i class="fa-solid fa-shield-halved cookie-cat-icon" aria-hidden="true"></i>
                <span class="cookie-cat-title">Strictly Necessary &amp; Security Cookies</span>
              </div>
              <span class="cookie-cat-badge badge-required">Always Active</span>
            </div>
            <p class="cookie-cat-desc">
              Required for DDoS defense (Cloudflare), audio player volume &amp; playback state persistence, and secure request verification.
            </p>
          </div>

          <div class="cookie-cat-card">
            <div class="cookie-cat-header">
              <div class="cookie-cat-title-wrap">
                <i class="fa-solid fa-chart-line cookie-cat-icon" aria-hidden="true"></i>
                <label for="cookie-opt-analytics" class="cookie-cat-title">Analytics Cookies (Google Analytics)</label>
              </div>
              <label class="cookie-toggle">
                <input type="checkbox" id="cookie-opt-analytics" ${current.analytics ? 'checked' : ''}>
                <span class="cookie-toggle-slider"></span>
              </label>
            </div>
            <p class="cookie-cat-desc">
              Collect anonymous, aggregated traffic statistics (Google Tag Manager / GA4 ID G-NQY8JZWCJP) to help us understand which music genres and audio sounds are most popular.
            </p>
          </div>

          <div class="cookie-cat-card">
            <div class="cookie-cat-header">
              <div class="cookie-cat-title-wrap">
                <i class="fa-solid fa-rectangle-ad cookie-cat-icon" aria-hidden="true"></i>
                <label for="cookie-opt-marketing" class="cookie-cat-title">Advertising Cookies (Google AdSense)</label>
              </div>
              <label class="cookie-toggle">
                <input type="checkbox" id="cookie-opt-marketing" ${current.marketing ? 'checked' : ''}>
                <span class="cookie-toggle-slider"></span>
              </label>
            </div>
            <p class="cookie-cat-desc">
              Used by advertising partners (Google) to deliver relevant ads and support server hosting and free audio streaming bandwidth.
            </p>
          </div>
        </div>
        <div class="cookie-modal-footer">
          <button type="button" id="cookie-modal-btn-reject" class="cookie-btn cookie-btn-outline">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i> Reject Non-Essential
          </button>
          <button type="button" id="cookie-modal-btn-save" class="cookie-btn cookie-btn-secondary">
            <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Save Preferences
          </button>
          <button type="button" id="cookie-modal-btn-accept" class="cookie-btn cookie-btn-primary">
            <i class="fa-solid fa-check" aria-hidden="true"></i> Accept All
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    const closeModal = () => {
      document.removeEventListener('keydown', onKeyDown);
      overlay.classList.add('is-hidden');
      overlay.style.setProperty('display', 'none', 'important');
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    };

    document.addEventListener('keydown', onKeyDown);

    const closeBtn = document.getElementById('cookie-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      });
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    const rejectBtn = document.getElementById('cookie-modal-btn-reject');
    if (rejectBtn) {
      rejectBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveConsent({ necessary: true, analytics: false, marketing: false, timestamp: new Date().toISOString() });
        closeModal();
        const b = document.getElementById('cookie-banner');
        if (b && b.parentNode) {
          b.parentNode.removeChild(b);
        }
      });
    }

    const saveBtn = document.getElementById('cookie-modal-btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const analyticsInput = document.getElementById('cookie-opt-analytics');
        const marketingInput = document.getElementById('cookie-opt-marketing');
        const analytics = analyticsInput ? Boolean(analyticsInput.checked) : false;
        const marketing = marketingInput ? Boolean(marketingInput.checked) : false;
        saveConsent({ necessary: true, analytics, marketing, timestamp: new Date().toISOString() });
        closeModal();
        const b = document.getElementById('cookie-banner');
        if (b && b.parentNode) {
          b.parentNode.removeChild(b);
        }
      });
    }

    const acceptBtn = document.getElementById('cookie-modal-btn-accept');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        saveConsent({ necessary: true, analytics: true, marketing: true, timestamp: new Date().toISOString() });
        closeModal();
        const b = document.getElementById('cookie-banner');
        if (b && b.parentNode) {
          b.parentNode.removeChild(b);
        }
      });
    }
  }

  window.openWhatsCRCookieModal = openCookieModal;

  function init() {
    injectStyles();
    createFloatingButton();
    const consent = getStoredConsent();
    if (consent) {
      applyConsent(consent);
    } else {
      setTimeout(createBanner, 400);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
