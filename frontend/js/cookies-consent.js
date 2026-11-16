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
  width: 50px !important;
  height: 50px !important;
  border-radius: 50% !important;
  background: linear-gradient(135deg, #0097b2, #007a91) !important;
  color: #ffffff !important;
  border: 2px solid rgba(255, 255, 255, 0.45) !important;
  box-shadow: 0 6px 20px rgba(0, 151, 178, 0.5) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  font-size: 1.35rem !important;
  cursor: pointer !important;
  z-index: 99995 !important;
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease, background 0.2s ease !important;
}
.cookie-floating-btn:hover {
  transform: scale(1.1) !important;
  box-shadow: 0 8px 26px rgba(0, 151, 178, 0.65) !important;
  background: linear-gradient(135deg, #00a8c6, #0087a0) !important;
}
.cookie-floating-btn:focus-visible {
  outline: 3px solid #00bcd4 !important;
  outline-offset: 3px !important;
}
.cookie-banner {
  position: fixed !important;
  bottom: 24px !important;
  left: 50% !important;
  transform: translateX(-50%) !important;
  width: calc(100% - 32px) !important;
  max-width: 680px !important;
  z-index: 99998 !important;
  background: rgba(15, 23, 42, 0.96) !important;
  backdrop-filter: blur(18px) !important;
  -webkit-backdrop-filter: blur(18px) !important;
  color: #f8fafc !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 20px !important;
  padding: 22px 26px !important;
  box-shadow: 0 20px 48px -8px rgba(15, 23, 42, 0.5), 0 4px 16px rgba(0, 0, 0, 0.25) !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 16px !important;
  animation: cookieBannerFadeUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
  font-family: inherit !important;
}
@keyframes cookieBannerFadeUp {
  from { opacity: 0; transform: translate(-50%, 20px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
.cookie-banner-header {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
}
.cookie-banner-icon {
  font-size: 1.5rem !important;
  color: #00bcd4 !important;
  flex-shrink: 0 !important;
}
.cookie-banner-title {
  margin: 0 !important;
  font-size: 1.08rem !important;
  font-weight: 700 !important;
  color: #ffffff !important;
  letter-spacing: -0.01em !important;
}
.cookie-banner-body {
  margin: 0 !important;
  font-size: 0.88rem !important;
  line-height: 1.55 !important;
  color: #cbd5e1 !important;
}
.cookie-banner-body a {
  color: #38bdf8 !important;
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
  transition: all 0.2s ease !important;
  border: none !important;
  font-family: inherit !important;
}
.cookie-btn-primary {
  background: #0097b2 !important;
  color: #ffffff !important;
}
.cookie-btn-primary:hover {
  background: #008199 !important;
  transform: translateY(-1px) !important;
}
.cookie-btn-secondary {
  background: rgba(255, 255, 255, 0.1) !important;
  color: #f1f5f9 !important;
  border: 1px solid rgba(255, 255, 255, 0.15) !important;
}
.cookie-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.18) !important;
  color: #ffffff !important;
}
.cookie-btn-outline {
  background: transparent !important;
  color: #94a3b8 !important;
  border: 1px solid rgba(148, 163, 184, 0.3) !important;
}
.cookie-btn-outline:hover {
  color: #ffffff !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
}
.cookie-modal-overlay {
  position: fixed !important;
  inset: 0 !important;
  background: rgba(15, 23, 42, 0.75) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  z-index: 100005 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 16px !important;
  animation: cookieFadeIn 0.2s ease !important;
}
@keyframes cookieFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.cookie-modal {
  background: #ffffff !important;
  color: #0f172a !important;
  width: 100% !important;
  max-width: 620px !important;
  max-height: 90vh !important;
  border-radius: 20px !important;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.35) !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  font-family: inherit !important;
  animation: cookieModalZoom 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
}
@keyframes cookieModalZoom {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.cookie-modal-header {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 20px 24px !important;
  border-bottom: 1px solid #e2e8f0 !important;
}
.cookie-modal-title-row {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
}
.cookie-modal-title-row i {
  color: #0097b2 !important;
  font-size: 1.4rem !important;
}
.cookie-modal-title {
  margin: 0 !important;
  font-size: 1.15rem !important;
  font-weight: 700 !important;
  color: #0f172a !important;
}
.cookie-modal-close {
  background: transparent !important;
  border: none !important;
  font-size: 1.25rem !important;
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
  padding: 20px 24px !important;
  overflow-y: auto !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 16px !important;
}
.cookie-modal-desc {
  margin: 0 !important;
  font-size: 0.9rem !important;
  line-height: 1.55 !important;
  color: #475569 !important;
}
.cookie-cat-card {
  border: 1px solid #e2e8f0 !important;
  border-radius: 14px !important;
  padding: 16px !important;
  background: #f8fafc !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 8px !important;
  transition: border-color 0.2s ease !important;
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
  font-size: 1.1rem !important;
}
.cookie-cat-title {
  font-size: 0.98rem !important;
  font-weight: 700 !important;
  color: #0f172a !important;
}
.cookie-cat-badge {
  font-size: 0.75rem !important;
  font-weight: 700 !important;
  padding: 3px 8px !important;
  border-radius: 6px !important;
  background: #e2e8f0 !important;
  color: #475569 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.04em !important;
}
.cookie-cat-badge.badge-required {
  background: #dbeafe !important;
  color: #1e40af !important;
}
.cookie-cat-desc {
  margin: 0 !important;
  font-size: 0.85rem !important;
  color: #64748b !important;
  line-height: 1.5 !important;
}
.cookie-toggle {
  position: relative !important;
  display: inline-block !important;
  width: 44px !important;
  height: 24px !important;
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
  border-radius: 24px !important;
}
.cookie-toggle-slider::before {
  position: absolute !important;
  content: "" !important;
  height: 18px !important;
  width: 18px !important;
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
  padding: 16px 24px !important;
  border-top: 1px solid #e2e8f0 !important;
  background: #f8fafc !important;
  display: flex !important;
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
    btn.setAttribute('aria-label', 'Preferenze Cookie');
    btn.setAttribute('title', 'Gestisci preferenze cookie');
    btn.innerHTML = '<i class="fa-solid fa-cookie-bite" aria-hidden="true"></i>';

    btn.addEventListener('click', () => {
      openCookieModal();
    });

    document.body.appendChild(btn);
  }

  function createBanner() {
    if (document.getElementById('cookie-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'true');
    banner.setAttribute('aria-labelledby', 'cookie-banner-title');
    banner.setAttribute('aria-describedby', 'cookie-banner-desc');

    banner.innerHTML = `
      <div class="cookie-banner-header">
        <i class="fa-solid fa-cookie-bite cookie-banner-icon" aria-hidden="true"></i>
        <h3 id="cookie-banner-title" class="cookie-banner-title">Preferenze Cookie & Privacy</h3>
      </div>
      <p id="cookie-banner-desc" class="cookie-banner-body">
        Utilizziamo cookie tecnici essenziali e, previo tuo consenso, cookie di analisi (Google Analytics) e pubblicitari (Google AdSense) per migliorare la piattaforma audio e supportare i creator. Puoi accettarli tutti, rifiutare quelli non necessari o personalizzare le tue scelte. Per maggiori dettagli consulta la nostra <a href="cookies.html">Cookie Policy</a>.
      </p>
      <div class="cookie-banner-actions">
        <button type="button" id="cookie-btn-accept-all" class="cookie-btn cookie-btn-primary">
          <i class="fa-solid fa-check" aria-hidden="true"></i> Accetta tutti
        </button>
        <button type="button" id="cookie-btn-reject-all" class="cookie-btn cookie-btn-secondary">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i> Rifiuta non necessari
        </button>
        <button type="button" id="cookie-btn-customize" class="cookie-btn cookie-btn-outline">
          <i class="fa-solid fa-sliders" aria-hidden="true"></i> Personalizza
        </button>
      </div>
    `;

    document.body.appendChild(banner);

    document.getElementById('cookie-btn-accept-all').addEventListener('click', () => {
      saveConsent({ necessary: true, analytics: true, marketing: true, timestamp: new Date().toISOString() });
      banner.remove();
    });

    document.getElementById('cookie-btn-reject-all').addEventListener('click', () => {
      saveConsent({ necessary: true, analytics: false, marketing: false, timestamp: new Date().toISOString() });
      banner.remove();
    });

    document.getElementById('cookie-btn-customize').addEventListener('click', () => {
      openCookieModal();
    });
  }

  function openCookieModal() {
    let overlay = document.getElementById('cookie-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
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
              <h3 id="cookie-modal-title" class="cookie-modal-title">Gestione Consenso Cookie</h3>
            </div>
            <button type="button" id="cookie-modal-close" class="cookie-modal-close" aria-label="Chiudi finestra">
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
          <div class="cookie-modal-body">
            <p class="cookie-modal-desc">
              Personalizza le tue scelte sui cookie utilizzati su WhatsCR. I cookie tecnici essenziali non possono essere disattivati poich\u00e9 garantiscono la sicurezza dell'infrastruttura e le funzionalit\u00e0 base.
            </p>

            <div class="cookie-cat-card">
              <div class="cookie-cat-header">
                <div class="cookie-cat-title-wrap">
                  <i class="fa-solid fa-shield-halved cookie-cat-icon" style="color: #0097b2;" aria-hidden="true"></i>
                  <span class="cookie-cat-title">Cookie Tecnici & Sicurezza</span>
                </div>
                <span class="cookie-cat-badge badge-required">Sempre Attivi</span>
              </div>
              <p class="cookie-cat-desc">
                Necessari per la difesa DDoS (Cloudflare), la memorizzazione delle preferenze audio del player e la sicurezza delle richieste.
              </p>
            </div>

            <div class="cookie-cat-card">
              <div class="cookie-cat-header">
                <div class="cookie-cat-title-wrap">
                  <i class="fa-solid fa-chart-line cookie-cat-icon" style="color: #0284c7;" aria-hidden="true"></i>
                  <label for="cookie-opt-analytics" class="cookie-cat-title">Cookie Statistici (Google Analytics)</label>
                </div>
                <label class="cookie-toggle">
                  <input type="checkbox" id="cookie-opt-analytics" ${current.analytics ? 'checked' : ''}>
                  <span class="cookie-toggle-slider"></span>
                </label>
              </div>
              <p class="cookie-cat-desc">
                Raccolgono informazioni anonime e aggregate sul traffico (Google Tag Manager / GA4 ID G-NQY8JZWCJP) per aiutarci a capire quali generi audio e sonorit\u00e0 piacciono di pi\u00f9.
              </p>
            </div>

            <div class="cookie-cat-card">
              <div class="cookie-cat-header">
                <div class="cookie-cat-title-wrap">
                  <i class="fa-solid fa-rectangle-ad cookie-cat-icon" style="color: #7c3aed;" aria-hidden="true"></i>
                  <label for="cookie-opt-marketing" class="cookie-cat-title">Cookie Pubblicitari (Google AdSense)</label>
                </div>
                <label class="cookie-toggle">
                  <input type="checkbox" id="cookie-opt-marketing" ${current.marketing ? 'checked' : ''}>
                  <span class="cookie-toggle-slider"></span>
                </label>
              </div>
              <p class="cookie-cat-desc">
                Utilizzati dai partner pubblicitari (Google) per erogare annunci pertinenti e coprire i costi dei server e della banda audio gratuita.
              </p>
            </div>
          </div>
          <div class="cookie-modal-footer">
            <button type="button" id="cookie-modal-btn-save" class="cookie-btn cookie-btn-secondary">
              <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Salva preferenze
            </button>
            <button type="button" id="cookie-modal-btn-accept" class="cookie-btn cookie-btn-primary">
              <i class="fa-solid fa-check" aria-hidden="true"></i> Accetta tutti
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const closeModal = () => {
        overlay.style.display = 'none';
      };

      document.getElementById('cookie-modal-close').addEventListener('click', closeModal);
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.style.display !== 'none') closeModal();
      });

      document.getElementById('cookie-modal-btn-save').addEventListener('click', () => {
        const analytics = document.getElementById('cookie-opt-analytics').checked;
        const marketing = document.getElementById('cookie-opt-marketing').checked;
        saveConsent({ necessary: true, analytics, marketing, timestamp: new Date().toISOString() });
        closeModal();
        const b = document.getElementById('cookie-banner');
        if (b) b.remove();
      });

      document.getElementById('cookie-modal-btn-accept').addEventListener('click', () => {
        saveConsent({ necessary: true, analytics: true, marketing: true, timestamp: new Date().toISOString() });
        document.getElementById('cookie-opt-analytics').checked = true;
        document.getElementById('cookie-opt-marketing').checked = true;
        closeModal();
        const b = document.getElementById('cookie-banner');
        if (b) b.remove();
      });
    }

    const analyticsCheck = document.getElementById('cookie-opt-analytics');
    const marketingCheck = document.getElementById('cookie-opt-marketing');
    const current = getStoredConsent() || { necessary: true, analytics: false, marketing: false };
    if (analyticsCheck) analyticsCheck.checked = Boolean(current.analytics);
    if (marketingCheck) marketingCheck.checked = Boolean(current.marketing);

    overlay.style.display = 'flex';
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
