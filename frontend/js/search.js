    const urlParams = new URLSearchParams(window.location.search);
    const initialQuery = urlParams.get('q') || '';
    const initialGenre = urlParams.get('genre') || '';

    const searchInput = document.getElementById('page-search-input');
    const searchBtn = document.getElementById('page-search-btn');
    const tracksContainer = document.getElementById('search-tracks-container');
    const creatorsContainer = document.getElementById('search-creators-container');
    const searchHeading = document.getElementById('search-heading');
    const resultsCount = document.getElementById('results-count');
    const genrePills = document.querySelectorAll('#genre-pills .pill');
    const genrePillsWrap = document.getElementById('genre-pills');
    const tabTracks = document.getElementById('tab-tracks');
    const tabCreators = document.getElementById('tab-creators');

    const initialType = (urlParams.get('type') || urlParams.get('tab') || '').toLowerCase();
    let currentSearchMode = (initialType === 'creators' || initialType === 'users') ? 'creators' : 'tracks';
    let currentGenre = initialGenre;
    searchInput.value = initialQuery;

    if (currentGenre) {
      const norm = currentGenre.toLowerCase();
      genrePills.forEach(p => {
        const pillG = (p.getAttribute('data-genre') || '').toLowerCase();
        if (pillG === norm || (norm.includes('sound') && pillG === 'sound effects') || (norm.includes('chiptune') && pillG === 'chiptune') || (norm.includes('lo-fi') && pillG === 'lo-fi') || (norm.includes('lofi') && pillG === 'lo-fi')) {
          genrePills.forEach(x => x.classList.remove('active'));
          p.classList.add('active');
          currentGenre = p.getAttribute('data-genre');
        }
      });
    }

    let searchAbortController = null;
    let lastSearchKey = '';
    let searchCooldownTime = 0;
    let currentAuthUser = null;
    let latestUsersResult = [];
    let latestUsersQuery = '';

    async function executeSearch(query = '', genre = '') {
      const cleanQ = query.trim().slice(0, 100);
      const cleanG = genre.trim().slice(0, 50);
      const searchKey = `${cleanQ}:::${cleanG}`;

      if (lastSearchKey === searchKey && tracksContainer.children.length > 0) {
        return;
      }

      const now = Date.now();
      if (now < searchCooldownTime) {
        return;
      }
      searchCooldownTime = now + 400;

      if (searchAbortController) {
        searchAbortController.abort();
      }
      searchAbortController = new AbortController();

      if (searchBtn) {
        searchBtn.disabled = true;
      }

      tracksContainer.innerHTML = '<div style="text-align:center; padding: 48px; color: #64748b;">Loading tracks...</div>';

      if (cleanQ && cleanG) {
        searchHeading.textContent = `Results for "${cleanQ}" in ${cleanG}`;
      } else if (cleanQ) {
        searchHeading.textContent = `Results for "${cleanQ}"`;
      } else if (cleanG) {
        searchHeading.textContent = `${cleanG}`;
      } else {
        searchHeading.textContent = 'All Found';
      }

      try {
        let endpoint = '/api/tracks';
        const params = new URLSearchParams();
        if (cleanQ) params.append('q', cleanQ);
        if (cleanG) params.append('genre', cleanG);
        if (params.toString()) endpoint += `?${params.toString()}`;

        const res = await fetch(endpoint, { signal: searchAbortController.signal });
        if (!res.ok) throw new Error('Query error');
        const tracks = await res.json();

        lastSearchKey = searchKey;
        displayResults(tracks, cleanQ);
      } catch (err) {
        if (err.name === 'AbortError') return;
        displayResults([], cleanQ);
      } finally {
        if (searchBtn) {
          searchBtn.disabled = false;
        }
      }
    }

    function displayResults(tracks, query) {
      if (!tracks || tracks.length === 0) {
        resultsCount.textContent = '0 tracks';
        tracksContainer.innerHTML = `
          <div class="no-results-box">
            <h3>No tracks found</h3>
            <p>${query ? `No results matching "${escapeHtml(query)}"` : 'No tracks available in this genre.'}</p>
          </div>
        `;
        return;
      }

      resultsCount.textContent = `${tracks.length} track${tracks.length > 1 ? 's' : ''}`;

      tracksContainer.innerHTML = tracks.map(t => {
        const safeId = parseInt(t.id, 10) || 0;
        const safeAudioUrl = sanitizeUrl(t.audio_url);
        const safeLikes = parseInt(t.likes_count, 10) || 0;

        return `
        <article class="track-row" id="track-row-${safeId}">
          <button class="track-play-btn" data-track-id="${safeId}" aria-label="Play ${escapeHtml(t.title)}">
            <i class="fa-solid fa-play"></i>
          </button>
          <div class="track-meta">
            <h4 class="track-name">${escapeHtml(t.title)}</h4>
            <span class="track-artist"><a href="profile.html?u=${encodeURIComponent(t.artist || 'Unknown')}" class="artist-link">${escapeHtml(t.artist || 'Unknown')}</a> &bull; ${escapeHtml(t.genre || 'Soundtrack')}</span>
          </div>
          <div class="track-waveform" id="waveform-${safeId}"></div>
          <div class="track-badges">
            ${t.is_loop ? '<span class="badge badge-loop term-badge" data-term="seamless-loop" title="Click to view definition in Audio Encyclopedia">Seamless Loop</span>' : ''}
            <span class="badge badge-cc term-badge" data-term="cc0-license" title="Click to view definition in Audio Encyclopedia">${escapeHtml(t.license_type || 'CC0 Free')}</span>
          </div>
          <span class="track-time" id="time-${safeId}">${escapeHtml(t.duration || '0:00')}</span>
          <div class="track-volume-wrap">
            <button class="track-vol-btn" data-track-id="${safeId}" aria-label="Toggle mute">
              <i class="fa-solid fa-volume-high"></i>
            </button>
            <input type="range" class="track-vol-slider" min="0" max="1" step="0.05" value="0.8" data-track-id="${safeId}" aria-label="Volume slider">
          </div>
          <div class="track-actions">
            <button type="button" class="track-like-btn ${t.is_liked ? 'liked' : ''}" data-track-id="${safeId}" aria-label="Like track" title="${t.is_liked ? 'Unlike' : 'Like'}">
              <i class="${t.is_liked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
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

    function sanitizeUrl(url) {
      if (!url || typeof url !== 'string') return '#';
      const clean = url.trim();
      if (clean.startsWith('audio/') || clean.startsWith('/api/') || clean.startsWith('http://') || clean.startsWith('https://')) {
        return clean.replace(/"/g, '%22').replace(/'/g, '%27').replace(/</g, '%3C').replace(/>/g, '%3E');
      }
      return '#';
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[m]));
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

    async function executeUserSearch(query = '') {
      const cleanQ = query.trim().replace(/^@/, '').slice(0, 50);

      if (searchAbortController) {
        searchAbortController.abort();
      }
      searchAbortController = new AbortController();

      if (searchBtn) {
        searchBtn.disabled = true;
      }

      creatorsContainer.innerHTML = '<div style="text-align:center; padding: 48px; color: #64748b; grid-column: 1 / -1;">Searching creators...</div>';

      if (cleanQ) {
        searchHeading.textContent = `Creators matching "@${cleanQ}"`;
      } else {
        searchHeading.textContent = 'Top Creators';
      }

      try {
        const endpoint = `/api/auth?action=search_users${cleanQ ? `&q=${encodeURIComponent(cleanQ)}` : ''}`;
        const res = await fetch(endpoint, { signal: searchAbortController.signal });
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        latestUsersResult = data.users || [];
        latestUsersQuery = cleanQ;
        displayUserResults(latestUsersResult, cleanQ);
      } catch (err) {
        if (err.name === 'AbortError') return;
        latestUsersResult = [];
        latestUsersQuery = cleanQ;
        displayUserResults([], cleanQ);
      } finally {
        if (searchBtn) {
          searchBtn.disabled = false;
        }
      }
    }

    function displayUserResults(users, query) {
      const filtered = (users || []).filter(u => {
        if (!u || !u.username) return false;
        if (currentAuthUser && currentAuthUser.username) {
          if (u.username.toLowerCase() === currentAuthUser.username.toLowerCase()) {
            return false;
          }
        }
        return true;
      });

      if (!filtered || filtered.length === 0) {
        resultsCount.textContent = '0 creators';
        creatorsContainer.innerHTML = `
          <div class="no-results-box" style="grid-column: 1 / -1;">
            <h3>No creators found</h3>
            <p>${query ? `No creators matching "@${escapeHtml(query)}"` : 'No creators found yet.'}</p>
          </div>
        `;
        return;
      }

      resultsCount.textContent = `${filtered.length} creator${filtered.length > 1 ? 's' : ''}`;
      creatorsContainer.innerHTML = filtered.map(u => {
        const initial = (u.username || 'C')[0].toUpperCase();
        return `
          <article class="creator-card">
            <div class="creator-card-header">
              <div class="creator-card-avatar">${escapeHtml(initial)}</div>
              <div class="creator-card-info">
                <a href="profile.html?u=${encodeURIComponent(u.username)}" class="creator-card-name">@${escapeHtml(u.username)}</a>
                <span style="font-size: 0.74rem; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 9999px; display: inline-block; width: fit-content;">Creator</span>
              </div>
            </div>
            <div class="creator-card-stats">
              <span><i class="fa-solid fa-music" style="color: var(--primary);"></i> ${u.track_count || 0} tracks</span>
              <span><i class="fa-solid fa-users" style="color: var(--primary);"></i> ${u.follower_count || 0} followers</span>
            </div>
            <div class="creator-card-actions">
              <a href="profile.html?u=${encodeURIComponent(u.username)}" class="btn-view-profile">
                <i class="fa-solid fa-user"></i> View Profile
              </a>
            </div>
          </article>
        `;
      }).join('');
    }

    function setSearchMode(mode) {
      currentSearchMode = mode;
      if (mode === 'creators') {
        tabCreators.classList.add('active');
        tabTracks.classList.remove('active');
        genrePillsWrap.style.display = 'none';
        tracksContainer.style.display = 'none';
        creatorsContainer.style.display = 'grid';
        searchInput.placeholder = 'Search creators by username...';
        executeUserSearch(searchInput.value.trim());
      } else {
        tabTracks.classList.add('active');
        tabCreators.classList.remove('active');
        genrePillsWrap.style.display = 'flex';
        tracksContainer.style.display = 'flex';
        creatorsContainer.style.display = 'none';
        searchInput.placeholder = 'Search music, loops, genres...';
        executeSearch(searchInput.value.trim(), currentGenre);
      }
    }

    tabTracks.addEventListener('click', () => setSearchMode('tracks'));
    tabCreators.addEventListener('click', () => setSearchMode('creators'));

    searchBtn.addEventListener('click', () => {
      const q = searchInput.value.trim();
      if (currentSearchMode === 'creators') {
        executeUserSearch(q);
      } else {
        executeSearch(q, currentGenre);
      }
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = searchInput.value.trim();
        if (currentSearchMode === 'creators') {
          executeUserSearch(q);
        } else {
          executeSearch(q, currentGenre);
        }
      }
    });

    genrePills.forEach(pill => {
      pill.addEventListener('click', () => {
        genrePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentGenre = pill.getAttribute('data-genre');
        if (currentSearchMode === 'tracks') {
          executeSearch(searchInput.value.trim(), currentGenre);
        }
      });
    });

    async function checkHeaderAuth() {
      try {
        const res = await fetch('/api/auth?action=me');
        if (!res.ok) return;
        const data = await res.json();
        if (data && data.user) {
          currentAuthUser = data.user;
          if (currentSearchMode === 'creators' && latestUsersResult.length > 0) {
            displayUserResults(latestUsersResult, latestUsersQuery);
          }
          const rightNav = document.getElementById('header-user-nav');
          if (!rightNav) return;
          const isAdmin = data.user.role === 'admin';
          const userName = escapeHtml(data.user.username ? `@${data.user.username}` : (data.user.email || '').split('@')[0]);
          rightNav.innerHTML = `
            <a href="community.html" class="nav-link nav-community-btn" title="Community"><i class="fa-solid fa-comments"></i><span>Community</span></a>
            ${isAdmin ? '<a href="admin.html" class="nav-link nav-admin-btn" style="color: #ef4444; font-weight: 700;"><i class="fa-solid fa-shield-halved"></i><span> Admin</span></a>' : ''}
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
    if (currentSearchMode === 'creators') {
      setSearchMode('creators');
    } else {
      executeSearch(initialQuery, initialGenre);
    }

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
