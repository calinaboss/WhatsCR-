    const urlParams = new URLSearchParams(window.location.search);
    const targetUsername = (urlParams.get('u') || urlParams.get('username') || '').trim();

    const pageTitle = document.getElementById('page-title');
    const breadcrumbUsername = document.getElementById('breadcrumb-username');
    const creatorAvatar = document.getElementById('creator-avatar');
    const creatorHandle = document.getElementById('creator-handle');
    const creatorBadge = document.getElementById('creator-badge');
    const creatorJoined = document.getElementById('creator-joined');
    const tracksHeadingArtist = document.getElementById('tracks-heading-artist');
    const tracksCountBadge = document.getElementById('tracks-count-badge');
    const tracksContainer = document.getElementById('creator-tracks-container');
    const statTracks = document.getElementById('stat-tracks');
    const statDuration = document.getElementById('stat-duration');
    const statFollowers = document.getElementById('stat-followers');
    const statFollowing = document.getElementById('stat-following');
    const cardFollowers = document.getElementById('card-followers');
    const cardFollowing = document.getElementById('card-following');
    const btnFollow = document.getElementById('btn-follow');
    const followIcon = document.getElementById('follow-icon');
    const followText = document.getElementById('follow-text');
    const btnShareProfile = document.getElementById('btn-share-profile');
    const shareBtnText = document.getElementById('share-btn-text');
    const btnEditProfile = document.getElementById('btn-edit-profile');
    const usersModal = document.getElementById('users-modal');
    const usersModalTitle = document.getElementById('users-modal-title');
    const usersModalList = document.getElementById('users-modal-list');
    const usersModalClose = document.getElementById('users-modal-close');
    const usersModalBtnClose = document.getElementById('users-modal-btn-close');

    let currentUserSession = null;

    const waveSurferInstances = new Map();

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[m]));
    }

    function sanitizeUrl(url) {
      if (!url || typeof url !== 'string') return '#';
      const clean = url.trim();
      if (clean.startsWith('audio/') || clean.startsWith('/api/') || clean.startsWith('http://') || clean.startsWith('https://')) {
        return clean.replace(/"/g, '%22').replace(/'/g, '%27').replace(/</g, '%3C').replace(/>/g, '%3E');
      }
      return '#';
    }

    async function loadProfile() {
      if (!targetUsername) {
        window.location.href = 'index.html';
        return;
      }

      const displayUser = targetUsername.startsWith('@') ? targetUsername.slice(1) : targetUsername;
      pageTitle.textContent = `@${displayUser} - Creator Profile \u2022 WhatsCR?`;
      breadcrumbUsername.textContent = `@${displayUser}`;
      creatorHandle.textContent = `@${displayUser}`;
      tracksHeadingArtist.textContent = `@${displayUser}`;
      creatorAvatar.textContent = (displayUser[0] || 'C').toUpperCase();

      try {
        const profileRes = await fetch(`/api/auth?action=profile&username=${encodeURIComponent(displayUser)}`);
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          if (profileData && profileData.user) {
            const u = profileData.user;
            if (u.avatar_url) {
              creatorAvatar.innerHTML = `<img src="${sanitizeUrl(u.avatar_url)}" alt="${escapeHtml(displayUser)}" onerror="this.onerror=null; this.parentElement.textContent='${escapeHtml((displayUser[0] || 'C').toUpperCase())}';">`;
            } else {
              creatorAvatar.textContent = (displayUser[0] || 'C').toUpperCase();
            }
            const creatorBio = document.getElementById('creator-bio');
            if (creatorBio) {
              if (u.bio && u.bio.trim()) {
                creatorBio.textContent = u.bio.trim();
                creatorBio.style.display = 'block';
              } else {
                creatorBio.textContent = '';
                creatorBio.style.display = 'none';
              }
            }
            creatorBadge.textContent = 'Creator';
            creatorBadge.style.background = '#f1f5f9';
            creatorBadge.style.color = '#64748b';
            statFollowers.textContent = u.follower_count || 0;
            statFollowing.textContent = u.following_count || 0;
            updateFollowBtnState(Boolean(u.is_following));
            if (u.created_at) {
              const d = new Date(u.created_at);
              creatorJoined.innerHTML = `<i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>Member since ${d.toLocaleString('default', { month: 'short', year: 'numeric' })}`;
            }
          }
        }
      } catch (e) {}

      loadTracks(displayUser);
    }

    async function loadTracks(artistName) {
      try {
        const res = await fetch(`/api/tracks?artist=${encodeURIComponent(artistName)}`);
        if (!res.ok) throw new Error('Tracks fetch error');
        const tracks = await res.json();

        statTracks.textContent = tracks.length;
        tracksCountBadge.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;

        let totalSeconds = 0;
        tracks.forEach(t => {
          if (t.duration && t.duration.includes(':')) {
            const [m, s] = t.duration.split(':').map(Number);
            totalSeconds += (m || 0) * 60 + (s || 0);
          }
        });
        const totalMins = Math.floor(totalSeconds / 60);
        const totalSecs = (totalSeconds % 60).toString().padStart(2, '0');
        statDuration.textContent = `${totalMins}:${totalSecs}`;

        if (!tracks || tracks.length === 0) {
          tracksContainer.innerHTML = `
            <div style="text-align: center; padding: 48px 20px; background: #fafcfe; border: 1px dashed var(--border); border-radius: 16px;">
              <i class="fa-solid fa-music" style="font-size: 2.2rem; color: #cbd5e1; margin-bottom: 12px;"></i>
              <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">No tracks published yet</h3>
              <p style="font-size: 0.88rem; color: var(--text-muted);">This creator hasn't uploaded any public audio tracks yet.</p>
            </div>
          `;
          return;
        }

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
              <span class="track-artist">${escapeHtml(t.artist || 'Unknown')} &bull; ${escapeHtml(t.genre || 'Soundtrack')}</span>
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

      } catch (err) {
        tracksContainer.innerHTML = '<div style="text-align: center; padding: 48px; color: #ef4444;">Failed to load creator tracks.</div>';
      }
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

    btnShareProfile.addEventListener('click', () => {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href);
        shareBtnText.textContent = 'Link Copied!';
        setTimeout(() => {
          shareBtnText.textContent = 'Share Profile';
        }, 2000);
      }
    });

    function updateFollowBtnState(isFollowing) {
      if (isFollowing) {
        btnFollow.classList.add('following');
        followIcon.className = 'fa-solid fa-user-check';
        followText.textContent = 'Following';
      } else {
        btnFollow.classList.remove('following');
        followIcon.className = 'fa-solid fa-user-plus';
        followText.textContent = 'Follow';
      }
    }

    btnFollow.addEventListener('click', async () => {
      if (!currentUserSession) {
        window.location.href = 'login.html';
        return;
      }

      const displayUser = targetUsername.startsWith('@') ? targetUsername.slice(1) : targetUsername;
      btnFollow.disabled = true;
      try {
        const res = await fetch('/api/auth?action=follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: displayUser })
        });
        if (res.status === 401) {
          window.location.href = 'login.html';
          return;
        }
        const data = await res.json();
        if (res.ok && data.success) {
          updateFollowBtnState(Boolean(data.is_following));
          if (typeof data.follower_count === 'number') {
            statFollowers.textContent = data.follower_count;
          }
        }
      } catch (err) {
      } finally {
        btnFollow.disabled = false;
      }
    });

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

    async function openUsersModal(type) {
      const displayUser = targetUsername.startsWith('@') ? targetUsername.slice(1) : targetUsername;
      usersModalTitle.textContent = type === 'followers' ? `Followers of @${displayUser}` : `Following of @${displayUser}`;
      usersModalList.innerHTML = '<div style="text-align: center; padding: 32px; color: #64748b;">Loading...</div>';
      usersModal.style.display = 'flex';

      try {
        const res = await fetch(`/api/auth?action=${type}&username=${encodeURIComponent(displayUser)}`);
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();
        const users = data.users || [];
        if (users.length === 0) {
          usersModalList.innerHTML = `<div style="text-align: center; padding: 32px; color: #64748b;">No ${type} yet.</div>`;
          return;
        }
        usersModalList.innerHTML = users.map(u => `
          <div class="user-list-item">
            <div class="user-list-left">
              <div class="user-list-avatar">${u.avatar_url ? `<img src="${sanitizeUrl(u.avatar_url)}" alt="${escapeHtml(u.username)}" onerror="this.onerror=null; this.parentElement.textContent='${escapeHtml((u.username || 'C')[0].toUpperCase())}';">` : escapeHtml((u.username || 'C')[0].toUpperCase())}</div>
              <div class="user-list-meta">
                <a href="profile.html?u=${encodeURIComponent(u.username)}" class="user-list-name">@${escapeHtml(u.username)}</a>
                <span class="user-list-sub">${u.track_count || 0} published tracks</span>
              </div>
            </div>
            <a href="profile.html?u=${encodeURIComponent(u.username)}" class="btn" style="background: var(--bg-muted); border: 1px solid var(--border); color: var(--text-main); padding: 5px 14px; border-radius: var(--radius-full); font-size: 0.78rem; font-weight: 700; text-decoration: none;">View</a>
          </div>
        `).join('');
      } catch (err) {
        usersModalList.innerHTML = '<div style="text-align: center; padding: 32px; color: #ef4444;">Failed to load list.</div>';
      }
    }

    cardFollowers.addEventListener('click', () => openUsersModal('followers'));
    cardFollowing.addEventListener('click', () => openUsersModal('following'));

    usersModalClose.addEventListener('click', () => { usersModal.style.display = 'none'; });
    usersModalBtnClose.addEventListener('click', () => { usersModal.style.display = 'none'; });
    usersModal.addEventListener('click', (e) => {
      if (e.target === usersModal) usersModal.style.display = 'none';
    });

    async function checkHeaderAuth() {
      try {
        const res = await fetch('/api/auth?action=me');
        if (!res.ok) {
          btnFollow.style.display = 'inline-flex';
          btnEditProfile.style.display = 'none';
          return;
        }
        const data = await res.json();
        if (data && data.user) {
          currentUserSession = data.user;
          const rightNav = document.getElementById('header-user-nav');
          if (rightNav) {
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

          const loggedInHandle = data.user.username || data.user.email.split('@')[0];
          const currentTarget = (targetUsername.startsWith('@') ? targetUsername.slice(1) : targetUsername).toLowerCase();
          if (loggedInHandle.toLowerCase() === currentTarget) {
            btnEditProfile.style.display = 'inline-flex';
            btnFollow.style.display = 'none';
          } else {
            btnEditProfile.style.display = 'none';
            btnFollow.style.display = 'inline-flex';
          }
        } else {
          btnFollow.style.display = 'inline-flex';
          btnEditProfile.style.display = 'none';
        }
      } catch (e) {
        btnFollow.style.display = 'inline-flex';
        btnEditProfile.style.display = 'none';
      }
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

    const editProfileModal = document.getElementById('edit-profile-modal');
    const editModalClose = document.getElementById('edit-modal-close');
    const editModalBtnCancel = document.getElementById('edit-modal-btn-cancel');
    const editProfileForm = document.getElementById('edit-profile-form');
    const editAvatarPreview = document.getElementById('edit-avatar-preview');
    const editAvatarInput = document.getElementById('edit-avatar-input');
    const btnRemoveAvatar = document.getElementById('btn-remove-avatar');
    const editBioInput = document.getElementById('edit-bio-input');
    const editBioCounter = document.getElementById('edit-bio-counter');
    const editUsernameInput = document.getElementById('edit-username-input');
    const editProfileAlert = document.getElementById('edit-profile-alert');
    const editModalBtnSave = document.getElementById('edit-modal-btn-save');

    function showEditAlert(msg, isSuccess = false) {
      if (!editProfileAlert) return;
      editProfileAlert.textContent = msg;
      editProfileAlert.style.display = 'block';
      editProfileAlert.style.background = isSuccess ? '#ecfdf5' : '#fef2f2';
      editProfileAlert.style.color = isSuccess ? '#047857' : '#b91c1c';
      editProfileAlert.style.border = isSuccess ? '1px solid #a7f3d0' : '1px solid #fecaca';
    }

    function updateEditAvatarDisplay(url, name) {
      if (!editAvatarPreview) return;
      if (url) {
        editAvatarPreview.innerHTML = `<img src="${sanitizeUrl(url)}" alt="Avatar" onerror="this.onerror=null; this.parentElement.textContent='${escapeHtml((name[0] || 'C').toUpperCase())}';">`;
        if (btnRemoveAvatar) btnRemoveAvatar.style.display = 'inline-flex';
      } else {
        editAvatarPreview.textContent = (name[0] || 'C').toUpperCase();
        if (btnRemoveAvatar) btnRemoveAvatar.style.display = 'none';
      }
    }

    function openEditModal() {
      if (!currentUserSession || !editProfileModal) return;
      if (editProfileAlert) editProfileAlert.style.display = 'none';
      const handle = currentUserSession.username || '';
      if (editUsernameInput) editUsernameInput.value = handle;
      const currentBio = currentUserSession.bio || '';
      if (editBioInput) {
        editBioInput.value = currentBio;
        if (editBioCounter) editBioCounter.textContent = `${currentBio.length}/100`;
      }
      updateEditAvatarDisplay(currentUserSession.avatar_url, handle);
      editProfileModal.style.display = 'flex';
    }

    function closeEditModal() {
      if (editProfileModal) editProfileModal.style.display = 'none';
    }

    if (btnEditProfile) {
      btnEditProfile.addEventListener('click', openEditModal);
    }
    if (editModalClose) {
      editModalClose.addEventListener('click', closeEditModal);
    }
    if (editModalBtnCancel) {
      editModalBtnCancel.addEventListener('click', closeEditModal);
    }
    if (editProfileModal) {
      editProfileModal.addEventListener('click', (e) => {
        if (e.target === editProfileModal) closeEditModal();
      });
    }

    if (editBioInput && editBioCounter) {
      editBioInput.addEventListener('input', () => {
        editBioCounter.textContent = `${editBioInput.value.length}/100`;
      });
    }

    function compressAvatar(file, maxDimension = 400, quality = 0.82) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onerror = () => resolve(file);
        reader.onload = () => {
          const img = new Image();
          img.onerror = () => resolve(file);
          img.onload = () => {
            try {
              const width = img.width;
              const height = img.height;
              const minSide = Math.min(width, height);
              const srcX = (width - minSide) / 2;
              const srcY = (height - minSide) / 2;
              const targetSize = Math.min(minSide, maxDimension);

              const canvas = document.createElement('canvas');
              canvas.width = targetSize;
              canvas.height = targetSize;

              const ctx = canvas.getContext('2d');
              ctx.imageSmoothingEnabled = true;
              ctx.imageSmoothingQuality = 'high';
              ctx.drawImage(img, srcX, srcY, minSide, minSide, 0, 0, targetSize, targetSize);

              canvas.toBlob((blob) => {
                if (blob && blob.size <= 500 * 1024) {
                  resolve(new File([blob], 'avatar.webp', { type: 'image/webp' }));
                } else if (blob) {
                  canvas.toBlob((jpgBlob) => {
                    if (jpgBlob) {
                      resolve(new File([jpgBlob], 'avatar.jpg', { type: 'image/jpeg' }));
                    } else {
                      resolve(file);
                    }
                  }, 'image/jpeg', 0.80);
                } else {
                  resolve(file);
                }
              }, 'image/webp', quality);
            } catch (err) {
              resolve(file);
            }
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });
    }

    if (editAvatarInput) {
      editAvatarInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
          showEditAlert('Image must be under 10 MB.', false);
          editAvatarInput.value = '';
          return;
        }

        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
          showEditAlert('Only JPG, PNG or WebP images are allowed.', false);
          editAvatarInput.value = '';
          return;
        }

        showEditAlert('Optimizing photo...', true);
        const optimizedFile = await compressAvatar(file, 400, 0.82);

        const tempUrl = URL.createObjectURL(optimizedFile);
        updateEditAvatarDisplay(tempUrl, currentUserSession.username || 'C');

        const formData = new FormData();
        formData.append('avatar', optimizedFile);

        showEditAlert('Uploading photo...', true);
        try {
          const res = await fetch('/api/auth?action=upload_avatar', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            showEditAlert(data.error || 'Failed to upload photo.', false);
            updateEditAvatarDisplay(currentUserSession.avatar_url, currentUserSession.username || 'C');
            return;
          }

          currentUserSession.avatar_url = data.avatar_url;
          updateEditAvatarDisplay(data.avatar_url, currentUserSession.username || 'C');
          if (creatorAvatar) {
            creatorAvatar.innerHTML = `<img src="${sanitizeUrl(data.avatar_url)}" alt="Avatar" onerror="this.onerror=null; this.parentElement.textContent='${escapeHtml(((currentUserSession.username || 'C')[0]).toUpperCase())}';">`;
          }
          showEditAlert('Photo updated successfully!', true);
        } catch (err) {
          showEditAlert('Network error while uploading photo.', false);
          updateEditAvatarDisplay(currentUserSession.avatar_url, currentUserSession.username || 'C');
        } finally {
          editAvatarInput.value = '';
        }
      });
    }

    if (btnRemoveAvatar) {
      btnRemoveAvatar.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to remove your profile photo?')) return;
        showEditAlert('Removing photo...', true);
        try {
          const res = await fetch('/api/auth?action=delete_avatar', {
            method: 'POST'
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            showEditAlert(data.error || 'Failed to remove photo.', false);
            return;
          }

          currentUserSession.avatar_url = null;
          updateEditAvatarDisplay(null, currentUserSession.username || 'C');
          if (creatorAvatar) {
            creatorAvatar.textContent = ((currentUserSession.username || 'C')[0]).toUpperCase();
          }
          showEditAlert('Photo removed successfully!', true);
        } catch (err) {
          showEditAlert('Network error while removing photo.', false);
        }
      });
    }

    if (editProfileForm) {
      editProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newBio = editBioInput ? editBioInput.value.trim() : '';
        const newUsername = editUsernameInput ? editUsernameInput.value.trim().toLowerCase() : '';

        if (editModalBtnSave) {
          editModalBtnSave.disabled = true;
          editModalBtnSave.textContent = 'Saving...';
        }

        try {
          const res = await fetch('/api/auth?action=update_profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: newUsername,
              bio: newBio
            })
          });

          const data = await res.json();
          if (!res.ok || !data.success) {
            showEditAlert(data.error || 'Failed to update profile.', false);
            return;
          }

          currentUserSession = data.user;
          const creatorBio = document.getElementById('creator-bio');
          if (creatorBio) {
            if (data.user.bio && data.user.bio.trim()) {
              creatorBio.textContent = data.user.bio.trim();
              creatorBio.style.display = 'block';
            } else {
              creatorBio.textContent = '';
              creatorBio.style.display = 'none';
            }
          }

          const currentTarget = (targetUsername.startsWith('@') ? targetUsername.slice(1) : targetUsername).toLowerCase();
          if (data.user.username && data.user.username.toLowerCase() !== currentTarget) {
            window.location.href = `profile.html?u=${encodeURIComponent(data.user.username)}`;
          } else {
            closeEditModal();
          }
        } catch (err) {
          showEditAlert('Network error while saving profile.', false);
        } finally {
          if (editModalBtnSave) {
            editModalBtnSave.disabled = false;
            editModalBtnSave.textContent = 'Save Changes';
          }
        }
      });
    }

    checkHeaderAuth();
    loadProfile();
