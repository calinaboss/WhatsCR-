    const tracksContainer = document.getElementById('tracks-container');
    const searchInput = document.querySelector('.search-input');
    const searchBtn = document.querySelector('.search-submit-btn');

    let fetchAbortController = null;
    let lastFetchKey = '';
    let fetchCooldownTime = 0;
    let allLoadedTracks = [];
    let currentPlayingTrack = null;
    let currentPlayingWaveSurfer = null;

    function showToast(msg, type = 'info', iconClass = 'fa-solid fa-circle-info') {
      const container = document.getElementById('smart-toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = `smart-toast toast-${type}`;
      const icon = document.createElement('i');
      icon.className = iconClass;
      const text = document.createElement('span');
      text.textContent = msg;
      toast.appendChild(icon);
      toast.appendChild(text);
      container.appendChild(toast);
      setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 220);
      }, 3000);
    }

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
        allLoadedTracks = Array.isArray(tracks) ? tracks : [];
        renderTracks(allLoadedTracks);
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
            <button type="button" class="btn-share-track" data-track-id="${safeId}" data-track-title="${safeTitle}" title="Share / Copy Link" aria-label="Share track">
              <i class="fa-solid fa-share-nodes"></i>
            </button>
            <button type="button" class="track-like-btn ${isLiked ? 'liked' : ''}" data-track-id="${safeId}" aria-label="Like track" title="${isLiked ? 'Unlike' : 'Like'}">
              <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
              <span class="like-count">${safeLikes}</span>
            </button>
            <a href="${safeAudioUrl}" download class="btn-download" title="Download track" data-track-title="${safeTitle}">
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

      tracksContainer.querySelectorAll('.btn-share-track').forEach(btn => {
        btn.addEventListener('click', () => {
          const title = btn.getAttribute('data-track-title') || 'track';
          const url = `${window.location.origin}/search.html?q=${encodeURIComponent(title)}`;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
              showToast(`Copied link for "${title}"`, 'success', 'fa-solid fa-link');
            }).catch(() => {
              showToast('Link ready to share!', 'info', 'fa-solid fa-link');
            });
          } else {
            showToast('Link ready to share!', 'info', 'fa-solid fa-link');
          }
        });
      });

      tracksContainer.querySelectorAll('.btn-download').forEach(btn => {
        btn.addEventListener('click', () => {
          const title = btn.getAttribute('data-track-title') || 'track';
          showToast(`Downloading "${title}"...`, 'info', 'fa-solid fa-circle-down');
        });
      });

      initWaveSurfers(tracks);
    }

    function renderFallback() {
      const fallbackTracks = [
        { id: 1, title: 'Test Track 01 - Cyber Drift', artist: 'Test Artist', genre: 'Synthwave', duration: '2:30', audio_url: 'audio/test-track-01.mp3', is_loop: true, license_type: 'CC0 Free', likes_count: 5 },
        { id: 2, title: 'Test Track 02 - 8-Bit Quest', artist: 'Test Artist', genre: 'Chiptune', duration: '1:45', audio_url: 'audio/test-track-02.mp3', is_loop: true, license_type: 'CC0 Free', likes_count: 8 }
      ];
      allLoadedTracks = fallbackTracks;
      renderTracks(fallbackTracks);
    }

    const waveSurferInstances = new Map();

    const floatingMiniPlayer = document.getElementById('floating-mini-player');
    const miniPlayerPlayBtn = document.getElementById('mini-player-play-btn');
    const miniPlayerTitle = document.getElementById('mini-player-title');
    const miniPlayerArtist = document.getElementById('mini-player-artist');
    const miniPlayerBarBg = document.getElementById('mini-player-bar-bg');
    const miniPlayerBarFill = document.getElementById('mini-player-bar-fill');
    const miniPlayerTime = document.getElementById('mini-player-time');
    const miniPlayerVolBtn = document.getElementById('mini-player-vol-btn');
    const miniPlayerDownloadBtn = document.getElementById('mini-player-download-btn');
    const miniPlayerCloseBtn = document.getElementById('mini-player-close-btn');

    if (miniPlayerPlayBtn) {
      miniPlayerPlayBtn.addEventListener('click', () => {
        if (!currentPlayingWaveSurfer) return;
        if (currentPlayingWaveSurfer.isPlaying()) {
          currentPlayingWaveSurfer.pause();
        } else {
          currentPlayingWaveSurfer.play();
        }
      });
    }

    if (miniPlayerBarBg) {
      miniPlayerBarBg.addEventListener('click', (e) => {
        if (!currentPlayingWaveSurfer) return;
        const rect = miniPlayerBarBg.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = Math.max(0, Math.min(1, clickX / rect.width));
        const duration = currentPlayingWaveSurfer.getDuration();
        if (duration > 0) {
          currentPlayingWaveSurfer.setTime(duration * pct);
        }
      });
    }

    if (miniPlayerVolBtn) {
      miniPlayerVolBtn.addEventListener('click', () => {
        if (!currentPlayingWaveSurfer) return;
        const icon = miniPlayerVolBtn.querySelector('i');
        if (currentPlayingWaveSurfer.getVolume() > 0) {
          currentPlayingWaveSurfer.setVolume(0);
          if (icon) icon.className = 'fa-solid fa-volume-xmark';
          showToast('Audio muted', 'info', 'fa-solid fa-volume-xmark');
        } else {
          currentPlayingWaveSurfer.setVolume(0.8);
          if (icon) icon.className = 'fa-solid fa-volume-high';
          showToast('Audio unmuted', 'info', 'fa-solid fa-volume-high');
        }
      });
    }

    if (miniPlayerCloseBtn) {
      miniPlayerCloseBtn.addEventListener('click', () => {
        if (floatingMiniPlayer) floatingMiniPlayer.style.display = 'none';
      });
    }

    function syncMiniPlayer(track, ws, isPlaying) {
      if (!floatingMiniPlayer) return;
      currentPlayingTrack = track;
      currentPlayingWaveSurfer = ws;

      if (miniPlayerTitle) miniPlayerTitle.textContent = track.title || 'Untitled';
      if (miniPlayerArtist) miniPlayerArtist.textContent = track.artist || 'Unknown';
      if (miniPlayerDownloadBtn) miniPlayerDownloadBtn.href = track.audio_url || '#';
      if (miniPlayerPlayBtn) {
        const icon = miniPlayerPlayBtn.querySelector('i');
        if (icon) icon.className = isPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play';
      }
      floatingMiniPlayer.style.display = 'block';
    }

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

          if (currentPlayingTrack && currentPlayingTrack.id === t.id) {
            const totMins = Math.floor(totalSec / 60);
            const totSecs = (totalSec % 60).toString().padStart(2, '0');
            if (miniPlayerTime) miniPlayerTime.textContent = `${mins}:${secs} / ${totMins}:${totSecs}`;
            if (miniPlayerBarFill && totalSec > 0) {
              const pct = Math.min(100, Math.max(0, (currentTime / totalSec) * 100));
              miniPlayerBarFill.style.width = `${pct}%`;
            }
          }
        });

        ws.on('play', () => {
          syncMiniPlayer(t, ws, true);
        });

        ws.on('pause', () => {
          if (currentPlayingTrack && currentPlayingTrack.id === t.id) {
            if (miniPlayerPlayBtn) {
              const mi = miniPlayerPlayBtn.querySelector('i');
              if (mi) mi.className = 'fa-solid fa-play';
            }
          }
        });

        ws.on('finish', () => {
          icon.className = 'fa-solid fa-play';
          row.classList.remove('is-playing');
          if (currentPlayingTrack && currentPlayingTrack.id === t.id) {
            if (miniPlayerPlayBtn) {
              const mi = miniPlayerPlayBtn.querySelector('i');
              if (mi) mi.className = 'fa-solid fa-play';
            }
            if (miniPlayerBarFill) miniPlayerBarFill.style.width = '0%';
          }
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
            showToast('Added to your favorites', 'success', 'fa-solid fa-heart');
          } else {
            btn.classList.remove('liked');
            btn.title = 'Like';
            if (icon) icon.className = 'fa-regular fa-heart';
            showToast('Removed from favorites', 'info', 'fa-regular fa-heart');
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

    const smartChips = document.querySelectorAll('.smart-chip');
    smartChips.forEach(chip => {
      chip.addEventListener('click', () => {
        smartChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const filter = chip.getAttribute('data-filter');
        const genre = chip.getAttribute('data-genre');

        if (filter === 'all') {
          renderTracks(allLoadedTracks);
        } else if (filter === 'top-liked') {
          const sorted = [...allLoadedTracks].sort((a, b) => (parseInt(b.likes_count, 10) || 0) - (parseInt(a.likes_count, 10) || 0));
          renderTracks(sorted);
          showToast('Sorted by Top Liked', 'info', 'fa-solid fa-fire');
        } else if (filter === 'loops') {
          const loops = allLoadedTracks.filter(t => Boolean(t.is_loop));
          renderTracks(loops);
          showToast(`Showing ${loops.length} Seamless Loops`, 'info', 'fa-solid fa-repeat');
        } else if (filter === 'sfx') {
          const sfx = allLoadedTracks.filter(t => {
            const parts = (t.duration || '').split(':');
            const totalSec = (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
            return (totalSec > 0 && totalSec <= 30) || (t.genre && t.genre.toLowerCase().includes('sound'));
          });
          renderTracks(sfx);
          showToast(`Showing ${sfx.length} Short SFX`, 'info', 'fa-solid fa-bolt');
        } else if (genre) {
          fetchTracks('', genre);
          showToast(`Browsing ${genre}`, 'info', 'fa-solid fa-music');
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
            <a href="community.html" class="nav-link nav-community-btn" title="Community"><i class="fa-solid fa-comments"></i><span>Community</span></a>
            ${isAdmin ? '<a href="admin.html" class="nav-link nav-admin-btn" style="color: #ef4444; font-weight: 700;"><i class="fa-solid fa-shield-halved"></i><span> Admin</span></a>' : ''}
            <a href="login.html" class="nav-link nav-user-link" title="My Account">${data.user.avatar_url ? `<img src="${sanitizeUrl(data.user.avatar_url)}" class="nav-avatar-img" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">` : '<i class="fa-solid fa-user"></i>'}<span class="nav-user-name">${userName}</span></a>
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
        tag: 'Game Audio &bull; Loop',
        definition: 'An audio track designed to repeat smoothly in a continuous loop without any gap, click, or pause.',
        details: [
          { heading: 'In game engines', text: 'Ready for Unity, Unreal Engine, Godot, and streaming software with loop enabled.' }
        ]
      },
      'cc0-license': {
        title: 'CC0 Public Domain',
        tag: 'Free License &bull; Commercial Safe',
        definition: '100% free copyright-free music. You can use it in commercial games, YouTube videos, and applications without copyright strikes or required attribution.',
        details: [
          { heading: 'Safe everywhere', text: 'Free for monetized videos, Steam games, mobile apps, and streams with zero copyright claims.' }
        ]
      },
      'sfx': {
        title: 'Sound Effects (SFX)',
        tag: 'Sound Design &bull; Audio',
        definition: 'Short audio effects and foley samples for in-game actions, button clicks, user interfaces, weapons, and animations.',
        details: [
          { heading: 'Usage', text: 'Provides immediate audio feedback for player actions, collisions, and interface interactions.' }
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
      if (pronounce) pronounce.innerHTML = data.tag || '';
      if (callout) callout.textContent = data.definition;
      if (details) {
        details.innerHTML = (data.details || []).map(d => `
          <h4 class="wiki-subheading"><i class="fa-solid fa-circle-check" style="color: var(--primary); font-size: 0.82rem;"></i>${d.heading}</h4>
          <p style="font-size: 0.88rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 8px;">${d.text}</p>
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
