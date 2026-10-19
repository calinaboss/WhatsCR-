const authGuard = document.getElementById('auth-guard');
const adminDashboard = document.getElementById('admin-dashboard');
const pendingList = document.getElementById('pending-list');
const adminAlert = document.getElementById('admin-alert');
const refreshBtn = document.getElementById('refresh-btn');
const tabPending = document.getElementById('tab-pending');
const tabPublished = document.getElementById('tab-published');
const pendingCount = document.getElementById('pending-count');
const publishedCount = document.getElementById('published-count');

let currentTab = 'pending';
let currentAudio = null;
let currentlyPlayingBtn = null;

function showAlert(text, isError = false) {
  adminAlert.style.display = 'block';
  adminAlert.style.background = isError ? '#fef2f2' : '#f0fdf4';
  adminAlert.style.color = isError ? '#991b1b' : '#166534';
  adminAlert.style.border = isError ? '1px solid #fecaca' : '1px solid #bbf7d0';
  adminAlert.innerHTML = `<i class="fa-solid ${isError ? 'fa-triangle-exclamation' : 'fa-circle-check'}" style="margin-right: 6px;"></i> ${text}`;
  setTimeout(() => {
    adminAlert.style.display = 'none';
  }, 5000);
}

function setTab(tab) {
  currentTab = tab;
  if (tab === 'pending') {
    tabPending.style.background = 'var(--primary)';
    tabPending.style.color = '#ffffff';
    tabPending.style.borderColor = 'transparent';
    tabPublished.style.background = 'transparent';
    tabPublished.style.color = 'var(--text-muted)';
    tabPublished.style.borderColor = 'var(--border)';
    loadPendingTracks();
  } else {
    tabPublished.style.background = 'var(--primary)';
    tabPublished.style.color = '#ffffff';
    tabPublished.style.borderColor = 'transparent';
    tabPending.style.background = 'transparent';
    tabPending.style.color = 'var(--text-muted)';
    tabPending.style.borderColor = 'var(--border)';
    loadPublishedTracks();
  }
}

if (tabPending) tabPending.addEventListener('click', () => setTab('pending'));
if (tabPublished) tabPublished.addEventListener('click', () => setTab('published'));

async function checkAuth() {
  try {
    const res = await fetch('/api/auth?action=me');
    const data = await res.json();
    if (data && data.user && data.user.role === 'admin') {
      adminDashboard.style.display = 'block';
      loadPendingTracks();
      updateCounts();
    } else {
      authGuard.style.display = 'block';
    }
  } catch (e) {
    authGuard.style.display = 'block';
  }
}

async function updateCounts() {
  try {
    const [pRes, aRes] = await Promise.all([
      fetch('/api/admin?action=pending'),
      fetch('/api/admin?action=all')
    ]);
    if (pRes.ok) {
      const pData = await pRes.json();
      if (pendingCount) pendingCount.textContent = (pData.tracks || []).length;
    }
    if (aRes.ok) {
      const aData = await aRes.json();
      const approved = (aData.tracks || []).filter(t => t.status === 'approved' || !t.status);
      if (publishedCount) publishedCount.textContent = approved.length;
    }
  } catch (e) {}
}

async function loadPendingTracks() {
  pendingList.innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--text-muted);">
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.5rem; color: var(--primary);"></i>
      <p style="margin-top: 10px; font-size: 0.9rem;">Fetching pending tracks...</p>
    </div>
  `;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    const res = await fetch('/api/admin?action=pending');
    if (!res.ok) throw new Error('Unauthorized or server error');
    const data = await res.json();
    const tracks = data.tracks || [];
    if (pendingCount) pendingCount.textContent = tracks.length;

    if (tracks.length === 0) {
      pendingList.innerHTML = `
        <div style="background: #ffffff; border: 1px solid var(--border); border-radius: 16px; padding: 48px 24px; text-align: center;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: #f0fdf4; color: #16a34a; display: inline-flex; align-items: center; justify-content: center; font-size: 1.3rem; margin-bottom: 12px;">
            <i class="fa-solid fa-check"></i>
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">Queue is empty</h3>
          <p style="font-size: 0.88rem; color: var(--text-muted);">There are no pending submissions requiring review at this time.</p>
        </div>
      `;
      return;
    }

    pendingList.innerHTML = '';
    tracks.forEach(t => {
      const card = document.createElement('div');
      card.id = `track-${t.id}`;
      card.style.background = '#ffffff';
      card.style.border = '1px solid var(--border)';
      card.style.borderRadius = '16px';
      card.style.padding = '18px 20px';
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';
      card.style.gap = '16px';
      card.style.boxShadow = 'var(--shadow-sm)';
      card.style.flexWrap = 'wrap';

      const audioSrc = t.audio_url || '';

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 14px; min-width: 240px; flex: 1;">
          <button class="preview-btn" data-url="${audioSrc}" style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-muted); border: 1px solid var(--border); color: var(--primary); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.95rem; transition: all 0.2s ease;">
            <i class="fa-solid fa-play"></i>
          </button>
          <div>
            <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">${escapeHtml(t.title)}</h3>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.8rem; color: var(--text-muted);">
              <span><i class="fa-solid fa-user" style="margin-right: 4px;"></i>${escapeHtml(t.artist || 'Unknown')}</span>
              <span>&bull;</span>
              <span style="background: var(--bg-muted); padding: 2px 8px; border-radius: var(--radius-full); font-weight: 600;">${escapeHtml(t.genre || 'Music')}</span>
              <span>&bull;</span>
              <span><i class="fa-solid fa-clock" style="margin-right: 4px;"></i>${escapeHtml(t.duration || '0:00')}</span>
              ${t.is_loop ? '<span style="background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: var(--radius-full); font-weight: 700;">Loop</span>' : ''}
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <button class="approve-btn" data-id="${t.id}" style="background: #16a34a; color: #ffffff; border: none; border-radius: var(--radius-full); padding: 8px 18px; font-size: 0.85rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: opacity 0.2s ease;">
            <i class="fa-solid fa-check"></i> Approve
          </button>
          <button class="delete-btn" data-id="${t.id}" data-title="${escapeHtml(t.title)}" style="background: transparent; color: #dc2626; border: 1px solid #fecaca; border-radius: var(--radius-full); padding: 8px 16px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s ease;">
            <i class="fa-solid fa-trash"></i> Reject & Delete
          </button>
        </div>
      `;

      pendingList.appendChild(card);
    });

    attachCardHandlers();
  } catch (err) {
    pendingList.innerHTML = `
      <div style="padding: 24px; text-align: center; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px;">
        Failed to load pending queue.
      </div>
    `;
  }
}

async function loadPublishedTracks() {
  pendingList.innerHTML = `
    <div style="text-align: center; padding: 40px; color: var(--text-muted);">
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.5rem; color: var(--primary);"></i>
      <p style="margin-top: 10px; font-size: 0.9rem;">Fetching published tracks...</p>
    </div>
  `;

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  try {
    const res = await fetch('/api/admin?action=all');
    if (!res.ok) throw new Error('Unauthorized or server error');
    const data = await res.json();
    const tracks = (data.tracks || []).filter(t => t.status === 'approved' || !t.status);
    if (publishedCount) publishedCount.textContent = tracks.length;

    if (tracks.length === 0) {
      pendingList.innerHTML = `
        <div style="background: #ffffff; border: 1px solid var(--border); border-radius: 16px; padding: 48px 24px; text-align: center;">
          <h3 style="font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">No published tracks found</h3>
          <p style="font-size: 0.88rem; color: var(--text-muted);">There are currently no active tracks published on the platform.</p>
        </div>
      `;
      return;
    }

    pendingList.innerHTML = '';
    tracks.forEach(t => {
      const card = document.createElement('div');
      card.id = `track-${t.id}`;
      card.style.background = '#ffffff';
      card.style.border = '1px solid var(--border)';
      card.style.borderRadius = '16px';
      card.style.padding = '18px 20px';
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';
      card.style.gap = '16px';
      card.style.boxShadow = 'var(--shadow-sm)';
      card.style.flexWrap = 'wrap';

      const audioSrc = t.audio_url || '';

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 14px; min-width: 240px; flex: 1;">
          <button class="preview-btn" data-url="${audioSrc}" style="width: 44px; height: 44px; border-radius: 50%; background: var(--bg-muted); border: 1px solid var(--border); color: var(--primary); display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.95rem; transition: all 0.2s ease;">
            <i class="fa-solid fa-play"></i>
          </button>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h3 style="font-size: 1rem; font-weight: 700; color: var(--text-main); margin-bottom: 4px;">${escapeHtml(t.title)}</h3>
              <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: var(--radius-full); background: #dcfce7; color: #15803d; font-weight: 700;">Active</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 0.8rem; color: var(--text-muted);">
              <span><i class="fa-solid fa-user" style="margin-right: 4px;"></i>${escapeHtml(t.artist || 'Unknown')}</span>
              <span>&bull;</span>
              <span style="background: var(--bg-muted); padding: 2px 8px; border-radius: var(--radius-full); font-weight: 600;">${escapeHtml(t.genre || 'Music')}</span>
              <span>&bull;</span>
              <span><i class="fa-solid fa-clock" style="margin-right: 4px;"></i>${escapeHtml(t.duration || '0:00')}</span>
              <span>&bull;</span>
              <span><i class="fa-solid fa-heart" style="margin-right: 4px; color: #ef4444;"></i>${t.likes_count || 0}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <a href="${audioSrc}" download class="btn" style="background: var(--bg-muted); border: 1px solid var(--border); border-radius: var(--radius-full); padding: 8px 14px; font-size: 0.82rem; font-weight: 600; text-decoration: none; color: var(--text-main); display: inline-flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-download"></i> Download
          </a>
          <button class="delete-btn" data-id="${t.id}" data-title="${escapeHtml(t.title)}" style="background: #fee2e2; color: #dc2626; border: 1px solid #fecaca; border-radius: var(--radius-full); padding: 8px 16px; font-size: 0.85rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s ease;">
            <i class="fa-solid fa-trash"></i> Remove Track
          </button>
        </div>
      `;

      pendingList.appendChild(card);
    });

    attachCardHandlers();
  } catch (err) {
    pendingList.innerHTML = `
      <div style="padding: 24px; text-align: center; color: #dc2626; background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px;">
        Failed to load published tracks.
      </div>
    `;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function attachCardHandlers() {
  document.querySelectorAll('.preview-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const url = btn.getAttribute('data-url');
      if (!url) return;

      if (currentAudio && currentlyPlayingBtn === btn) {
        if (currentAudio.paused) {
          currentAudio.play();
          btn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        } else {
          currentAudio.pause();
          btn.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
        return;
      }

      if (currentAudio) {
        currentAudio.pause();
        if (currentlyPlayingBtn) currentlyPlayingBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
      }

      currentAudio = new Audio(url);
      currentlyPlayingBtn = btn;
      btn.innerHTML = '<i class="fa-solid fa-pause"></i>';

      currentAudio.play().catch(() => {
        btn.innerHTML = '<i class="fa-solid fa-play"></i>';
      });

      currentAudio.onended = () => {
        btn.innerHTML = '<i class="fa-solid fa-play"></i>';
      };
    });
  });

  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      btn.disabled = true;
      btn.style.opacity = '0.6';
      try {
        const res = await fetch('/api/admin?action=approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(id) })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showAlert('Track approved and published successfully.');
          const row = document.getElementById(`track-${id}`);
          if (row) row.remove();
          updateCounts();
          if (pendingList.children.length === 0) loadPendingTracks();
        } else {
          showAlert(data.error || 'Failed to approve track.', true);
          btn.disabled = false;
          btn.style.opacity = '1';
        }
      } catch (e) {
        showAlert('Network error while approving.', true);
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    });
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const title = btn.getAttribute('data-title') || 'this track';
      if (!confirm(`Are you sure you want to permanently delete "${title}"? This will delete the audio file and remove the track completely.`)) return;
      btn.disabled = true;
      btn.style.opacity = '0.6';
      try {
        const res = await fetch('/api/admin?action=delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: Number(id) })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showAlert('Track permanently deleted.');
          const row = document.getElementById(`track-${id}`);
          if (row) row.remove();
          updateCounts();
          if (pendingList.children.length === 0) {
            if (currentTab === 'pending') loadPendingTracks();
            else loadPublishedTracks();
          }
        } else {
          showAlert(data.error || 'Failed to delete track.', true);
          btn.disabled = false;
          btn.style.opacity = '1';
        }
      } catch (e) {
        showAlert('Network error while deleting track.', true);
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    });
  });
}

refreshBtn.addEventListener('click', () => {
  if (currentTab === 'pending') loadPendingTracks();
  else loadPublishedTracks();
  updateCounts();
});

document.addEventListener('DOMContentLoaded', checkAuth);
