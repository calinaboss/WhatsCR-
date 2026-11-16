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

  function init() {
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
