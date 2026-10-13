    const tracksContainer = document.getElementById('tracks-container');
    const searchInput = document.querySelector('.search-input');
    const searchBtn = document.querySelector('.search-submit-btn');

    let fetchAbortController = null;
    let lastFetchKey = '';
    let fetchCooldownTime = 0;

    async function fetchTracks(searchTerm = '', genre = '') {
      if (!tracksContainer) return;

      const cleanTerm = (searchTerm || '').trim().slice(0, 100);
      const cleanGenre = (genre || '').trim().slice(0, 50);
      const fetchKey = `${cleanTerm}:::${cleanGenre}`;

      if (lastFetchKey === fetchKey && tracksContainer.children.length > 0) {
        return;
      }

      const now = Date.now();
      if (now < fetchCooldownTime) {
        return;
      }
      fetchCooldownTime = now + 400;

      if (fetchAbortController) {
        fetchAbortController.abort();
      }
      fetchAbortController = new AbortController();

      tracksContainer.innerHTML = '<div style="text-align:center; padding: 24px; color: #64748b;">Loading tracks...</div>';

      try {
        let url = '/api/tracks';
        const params = new URLSearchParams();
        if (cleanTerm) params.append('q', cleanTerm);
        if (cleanGenre) params.append('genre', cleanGenre);
        if (params.toString()) url += `?${params.toString()}`;

        const res = await fetch(url, { signal: fetchAbortController.signal });
        if (!res.ok) throw new Error('API failed');
        const tracks = await res.json();

        lastFetchKey = fetchKey;
        renderTracks(tracks);
      } catch (err) {
        if (err.name === 'AbortError') return;
        renderFallback();
      }
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function sanitizeUrl(url) {
      if (!url || typeof url !== 'string') return '#';
      const clean = url.trim();
      if (clean.startsWith('audio/') || clean.startsWith('/api/') || clean.startsWith('http://') || clean.startsWith('https://')) {
        return clean.replace(/"/g, '%22').replace(/'/g, '%27').replace(/</g, '%3C').replace(/>/g, '%3E');
      }
      return '#';
    }

    function renderTracks(tracks) {
      if (!tracks || tracks.length === 0) {
        tracksContainer.innerHTML = '<div style="text-align:center; padding: 32px; color: #64748b;">No tracks found.</div>';
        return;
      }

      tracksContainer.innerHTML = tracks.map(t => {
        const safeId = parseInt(t.id, 10) || 0;
        const safeTitle = escapeHtml(t.title || 'Untitled');
        const safeArtist = escapeHtml(t.artist || 'Unknown');
        const safeGenre = escapeHtml(t.genre || 'Soundtrack');
        const safeLicense = escapeHtml(t.license_type || 'CC0 Free');
        const safeDuration = escapeHtml(t.duration || '0:00');
        const safeLikes = parseInt(t.likes_count, 10) || 0;
        const safeAudioUrl = sanitizeUrl(t.audio_url);
        const isLiked = Boolean(t.is_liked);
        const isLoop = Boolean(t.is_loop);

        return `
        <article class="track-row" id="track-row-${safeId}">
          <button class="track-play-btn" data-track-id="${safeId}" aria-label="Play ${safeTitle}">
            <i class="fa-solid fa-play"></i>
          </button>
          <div class="track-meta">
            <h4 class="track-name">${safeTitle}</h4>
            <span class="track-artist"><a href="profile.html?u=${encodeURIComponent(t.artist || 'Unknown')}" class="artist-link">${safeArtist}</a> &bull; ${safeGenre}</span>
          </div>
          <div class="track-waveform" id="waveform-${safeId}"></div>
          <div class="track-badges">
            ${isLoop ? '<span class="badge badge-loop term-badge" data-term="seamless-loop" title="Click to view definition in Audio Encyclopedia">Seamless Loop</span>' : ''}
            <span class="badge badge-cc term-badge" data-term="cc0-license" title="Click to view definition in Audio Encyclopedia">${safeLicense}</span>
          </div>
          <span class="track-time" id="time-${safeId}">${safeDuration}</span>
          <div class="track-volume-wrap">
            <button class="track-vol-btn" data-track-id="${safeId}" aria-label="Toggle mute">
              <i class="fa-solid fa-volume-high"></i>
            </button>
            <input type="range" class="track-vol-slider" min="0" max="1" step="0.05" value="0.8" data-track-id="${safeId}" aria-label="Volume slider">
          </div>
          <div class="track-actions">
            <button type="button" class="track-like-btn ${isLiked ? 'liked' : ''}" data-track-id="${safeId}" aria-label="Like track" title="${isLiked ? 'Unlike' : 'Like'}">
              <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
              <span class="like-count">${safeLikes}</span>
            </button>
            <a href="${safeAudioUrl}" download class="btn-download" title="Download track">
              <i class="fa-solid fa-download"></i>
              <span>Download</span>
            </a>
          </div>
        </article>
      `;
      }).join('');

      tracksContainer.querySelectorAll('.track-like-btn').forEach(btn => {
        btn.addEventListener('click', () => handleLikeTrack(btn));
      });

      initWaveSurfers(tracks);
    }

    function renderFallback() {
      const fallbackTracks = [
        { id: 1, title: 'Test Track 01 - Cyber Drift', artist: 'Test Artist', genre: 'Synthwave', duration: '2:30', audio_url: 'audio/test-track-01.mp3', is_loop: true, license_type: 'CC0 Free' },
        { id: 2, title: 'Test Track 02 - 8-Bit Quest', artist: 'Test Artist', genre: 'Chiptune', duration: '1:45', audio_url: 'audio/test-track-02.mp3', is_loop: true, license_type: 'CC0 Free' }
      ];
      renderTracks(fallbackTracks);
    }

    const waveSurferInstances = new Map();

    function initWaveSurfers(tracks) {
      waveSurferInstances.forEach(ws => ws.destroy());
      waveSurferInstances.clear();

      tracks.forEach(t => {
        const container = document.getElementById(`waveform-${t.id}`);
        if (!container) return;

        const ws = WaveSurfer.create({
          container: container,
          waveColor: '#cbd5e1',
          progressColor: '#0097b2',
          cursorColor: 'transparent',
          barWidth: 2,
          barGap: 3,
          barRadius: 2,
          height: 34,
          url: t.audio_url
        });

        ws.setVolume(0.8);

        const row = document.getElementById(`track-row-${t.id}`);
        const btn = row.querySelector('.track-play-btn');
        const icon = btn.querySelector('i');
        const timeEl = document.getElementById(`time-${t.id}`);
        const volBtn = row.querySelector('.track-vol-btn');
        const volSlider = row.querySelector('.track-vol-slider');
        const volIcon = volBtn.querySelector('i');

        volSlider.addEventListener('input', (e) => {
          const val = parseFloat(e.target.value);
          ws.setVolume(val);
          if (val === 0) {
            volIcon.className = 'fa-solid fa-volume-xmark';
          } else if (val < 0.5) {
            volIcon.className = 'fa-solid fa-volume-low';
          } else {
            volIcon.className = 'fa-solid fa-volume-high';
          }
        });

        let prevVolume = 0.8;
        volBtn.addEventListener('click', () => {
          if (ws.getVolume() > 0) {
            prevVolume = ws.getVolume();
            ws.setVolume(0);
            volSlider.value = 0;
            volIcon.className = 'fa-solid fa-volume-xmark';
          } else {
            ws.setVolume(prevVolume || 0.8);
            volSlider.value = prevVolume || 0.8;
            volIcon.className = prevVolume < 0.5 ? 'fa-solid fa-volume-low' : 'fa-solid fa-volume-high';
          }
        });

        ws.on('ready', () => {
          const totalSec = Math.max(1, Math.round(ws.getDuration()));
          const mins = Math.floor(totalSec / 60);
          const secs = (totalSec % 60).toString().padStart(2, '0');
          if (timeEl) timeEl.textContent = `${mins}:${secs}`;
        });

        ws.on('timeupdate', (currentTime) => {
          const totalSec = Math.floor(ws.getDuration());
          const curSec = Math.floor(currentTime);
          const mins = Math.floor(curSec / 60);
          const secs = (curSec % 60).toString().padStart(2, '0');
          if (timeEl) timeEl.textContent = `${mins}:${secs}`;
        });

        ws.on('finish', () => {
          icon.className = 'fa-solid fa-play';
          row.classList.remove('is-playing');
        });

        btn.addEventListener('click', () => {
          waveSurferInstances.forEach((otherWs, otherId) => {
            if (otherId !== t.id && otherWs.isPlaying()) {
              otherWs.pause();
              const otherRow = document.getElementById(`track-row-${otherId}`);
              if (otherRow) {
                otherRow.classList.remove('is-playing');
                otherRow.querySelector('.track-play-btn i').className = 'fa-solid fa-play';
              }
            }
          });

          if (ws.isPlaying()) {
            ws.pause();
            icon.className = 'fa-solid fa-play';
            row.classList.remove('is-playing');
          } else {
            ws.play();
            icon.className = 'fa-solid fa-pause';
            row.classList.add('is-playing');
          }
        });

        waveSurferInstances.set(t.id, ws);
      });
    }

    async function handleLikeTrack(btn) {
      const trackId = btn.getAttribute('data-track-id');
      if (!trackId) return;

      btn.disabled = true;
      try {
        const res = await fetch('/api/tracks?action=like', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ track_id: parseInt(trackId, 10) })
        });
        if (res.status === 401) {
          window.location.href = 'login.html';
          return;
        }
        const data = await res.json();
        if (res.ok && data.success) {
          const icon = btn.querySelector('i');
          const countSpan = btn.querySelector('.like-count');
          if (data.liked) {
            btn.classList.add('liked');
            btn.title = 'Unlike';
            if (icon) icon.className = 'fa-solid fa-heart';
          } else {
            btn.classList.remove('liked');
            btn.title = 'Like';
            if (icon) icon.className = 'fa-regular fa-heart';
          }
          if (countSpan) {
            countSpan.textContent = data.likes_count;
          }
        }
      } catch (err) {
      } finally {
        btn.disabled = false;
      }
    }

    let redirectCooldown = 0;
    function redirectToSearch(query) {
      const now = Date.now();
      if (now < redirectCooldown) return;
      redirectCooldown = now + 400;

      const clean = (query || '').trim().slice(0, 100);
      if (clean.startsWith('@')) {
        window.location.href = `search.html?q=${encodeURIComponent(clean.slice(1))}&type=creators`;
      } else if (clean) {
        window.location.href = `search.html?q=${encodeURIComponent(clean)}`;
      } else {
        window.location.href = 'search.html';
      }
    }

    if (searchBtn && searchInput) {
      searchBtn.addEventListener('click', () => {
        redirectToSearch(searchInput.value.trim());
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          redirectToSearch(searchInput.value.trim());
        }
      });
    }

    document.querySelectorAll('.sort-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sort-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.textContent.trim();
        if (filter === 'Game Loops') {
          fetchTracks('', 'Gaming');
        } else {
          fetchTracks('');
        }
      });
    });

    document.querySelectorAll('.cat-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const genreName = card.getAttribute('data-genre') || card.querySelector('.cat-name').textContent.trim();
        window.location.href = `search.html?genre=${encodeURIComponent(genreName)}`;
      });
    });

    const heroSlides = document.querySelectorAll('.hero-slide');
    if (heroSlides.length > 1) {
      let currentSlide = 0;
      setInterval(() => {
        heroSlides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % heroSlides.length;
        heroSlides[currentSlide].classList.add('active');
      }, 6500);
    }

    async function checkHeaderAuth() {
      try {
        const res = await fetch('/api/auth?action=me');
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.user) {
          const rightNav = document.getElementById('header-user-nav');
          if (!rightNav) return;
          const isAdmin = data.user.role === 'admin';
          const userName = escapeHtml(data.user.username ? `@${data.user.username}` : (data.user.email || '').split('@')[0]);
          rightNav.innerHTML = `
            ${isAdmin ? '<a href="admin.html" class="nav-link nav-admin-btn" style="color: #ef4444; font-weight: 700;"><i class="fa-solid fa-shield-halved"></i> Admin</a>' : ''}
            <a href="login.html" class="nav-link nav-user-link" title="My Account"><i class="fa-solid fa-user"></i><span class="nav-user-name">${userName}</span></a>
            <button id="nav-logout-btn" class="nav-logout-btn">Log out</button>
            <a href="upload.html" class="btn-upload">
              <i class="fa-solid fa-arrow-up-from-bracket"></i>
              <span>Upload</span>
            </a>
          `;
          const logoutBtn = document.getElementById('nav-logout-btn');
          if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
              await fetch('/api/auth?action=logout', { method: 'POST' });
              window.location.reload();
            });
          }
        }
      } catch (e) {}
    }

    checkHeaderAuth();
    fetchTracks();

    const wikiGlossary = {
      'seamless-loop': {
        title: 'Seamless Game Loop',
        pronounce: "/'si:m.l@s geim lu:p/ &bull; Audio Engineering &bull; Interactive Media",
        definition: 'An audio track designed and mastered so its end transitions into its beginning without any audible gap, click, or tempo disruption. It loops continuously in game engines indefinitely.',
        details: [
          { heading: 'Game Engine Integration', text: 'When placed into an AudioSource in Unity, Unreal Engine, or Godot with loop enabled, seamless loops maintain smooth immersion during exploration, combat, and gameplay.' },
          { heading: 'Mastering Standard', text: 'Rendered at zero-crossing points with identical boundary amplitude to eliminate phase cancellation and audio pops.' }
        ]
      },
      'cc0-license': {
        title: 'CC0 1.0 Universal (Public Domain)',
        pronounce: "/si:.si:.zi:.rou/ &bull; Legal License &bull; Copyright Waiver",
        definition: 'A Creative Commons dedication where the creator waives all copyright rights worldwide. Tracks marked as CC0 belong to the public domain and can be freely used in commercial games, videos, and apps without asking permission or giving credit.',
        details: [
          { heading: 'Commercial Safety', text: '100% safe for monetized YouTube videos, Steam indie games, iOS/Android apps, podcasts, and Twitch broadcasts with zero risk of DMCA strikes.' },
          { heading: 'No Royalties or Hidden Fees', text: 'Never registered with automated collection societies (PROs) and completely free of royalties.' }
        ]
      },
      'sfx': {
        title: 'Sound Effects (SFX)',
        pronounce: "/es.ef.eks/ &bull; Interactive Audio &bull; Foley & Sound Design",
        definition: 'Short, targeted audio samples designed to simulate physical collisions, UI feedback, spells, weapons, and environmental events in software and video games.',
        details: [
          { heading: 'Gameplay Role', text: 'Provides immediate sensory feedback to players for button presses, item pickups, jump mechanics, and damage notifications.' }
        ]
      }
    };

    const wikiModal = document.getElementById('wiki-modal');
    const wikiTitle = document.getElementById('wiki-title');
    const wikiPronounce = document.getElementById('wiki-pronounce');
    const wikiCallout = document.getElementById('wiki-callout');
    const wikiDetails = document.getElementById('wiki-details');
    const wikiClose = document.getElementById('wiki-close');
    const wikiBtnClose = document.getElementById('wiki-btn-close');

    function openWikiModal(termKey) {
      const modal = document.getElementById('wiki-modal');
      const title = document.getElementById('wiki-title');
      const pronounce = document.getElementById('wiki-pronounce');
      const callout = document.getElementById('wiki-callout');
      const details = document.getElementById('wiki-details');
      if (!modal || !title) return;
      const data = wikiGlossary[termKey] || wikiGlossary['seamless-loop'];
      if (!data) return;
      title.textContent = data.title;
      if (pronounce) pronounce.innerHTML = data.pronounce;
      if (callout) callout.textContent = data.definition;
      if (details) {
        details.innerHTML = (data.details || []).map(d => `
          <h4 class="wiki-subheading"><i class="fa-solid fa-circle-info" style="color: var(--primary); font-size: 0.85rem;"></i>${d.heading}</h4>
          <p style="font-size: 0.9rem; color: var(--text-muted); line-height: 1.6; margin-bottom: 12px;">${d.text}</p>
        `).join('');
      }
      modal.style.display = 'flex';
    }

    function closeWikiModal() {
      const modal = document.getElementById('wiki-modal');
      if (modal) modal.style.display = 'none';
    }

    document.addEventListener('click', (e) => {
      const badge = e.target.closest('.term-badge');
      if (badge) {
        e.preventDefault();
        const term = badge.getAttribute('data-term');
        if (term) openWikiModal(term);
        return;
      }
      if (e.target.closest('#wiki-close') || e.target.closest('#wiki-btn-close') || e.target.id === 'wiki-modal') {
        closeWikiModal();
      }
    });
