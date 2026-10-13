let selectedFile = null;
let detectedDuration = '0:01';
let currentUser = null;

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('audio-file-input');
const dropText = document.getElementById('drop-text');
const dropSub = document.getElementById('drop-sub');
const uploadForm = document.getElementById('upload-form');
const uploadAlert = document.getElementById('upload-alert');
const submitBtn = document.getElementById('upload-submit-btn');
const btnText = document.getElementById('btn-text');
const artistInput = document.getElementById('track-artist');
const formTimeInput = document.getElementById('form_time');

formTimeInput.value = Date.now();

async function checkAuth() {
  try {
    const res = await fetch('/api/auth?action=me');
    if (!res.ok) {
      window.location.href = 'login.html?next=upload.html';
      return;
    }
    const data = await res.json();
    if (!data || !data.user) {
      window.location.href = 'login.html?next=upload.html';
      return;
    }
    currentUser = data.user;
    const initialHandle = currentUser.username || currentUser.email.split('@')[0];
    if (!artistInput.value) {
      artistInput.value = initialHandle;
    }
  } catch (err) {
    window.location.href = 'login.html?next=upload.html';
  }
}
checkAuth();

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = 'var(--primary)';
  dropZone.style.background = '#f0faff';
});

dropZone.addEventListener('dragleave', () => {
  dropZone.style.borderColor = 'var(--border)';
  dropZone.style.background = '#fafcfe';
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = 'var(--border)';
  dropZone.style.background = '#fafcfe';
  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
    handleFileSelection(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files && fileInput.files[0]) {
    handleFileSelection(fileInput.files[0]);
  }
});

function handleFileSelection(file) {
  if (file.size > 15 * 1024 * 1024) {
    showAlert('File size exceeds the 15 MB limit.');
    return;
  }
  selectedFile = file;
  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  dropText.textContent = `${file.name}`;
  dropSub.textContent = `Size: ${sizeMb} MB - Analyzing audio duration...`;

  const audioObj = new Audio();
  const objectUrl = URL.createObjectURL(file);
  audioObj.src = objectUrl;

  function updateDuration() {
    if (!isNaN(audioObj.duration) && isFinite(audioObj.duration)) {
      const totalSec = Math.max(1, Math.round(audioObj.duration));
      const mins = Math.floor(totalSec / 60);
      const secs = (totalSec % 60).toString().padStart(2, '0');
      detectedDuration = `${mins}:${secs}`;
      dropSub.textContent = `Size: ${sizeMb} MB \u2022 Duration: ${detectedDuration}`;
    }
  }

  audioObj.addEventListener('loadedmetadata', updateDuration);
  audioObj.addEventListener('canplaythrough', updateDuration);
  setTimeout(updateDuration, 800);
}

function showAlert(msg, isSuccess = false) {
  uploadAlert.textContent = msg;
  uploadAlert.style.display = 'block';
  if (isSuccess) {
    uploadAlert.style.background = '#ecfdf5';
    uploadAlert.style.color = '#065f46';
    uploadAlert.style.border = '1px solid #a7f3d0';
  } else {
    uploadAlert.style.background = '#fef2f2';
    uploadAlert.style.color = '#991b1b';
    uploadAlert.style.border = '1px solid #fecaca';
  }
}

uploadForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  uploadAlert.style.display = 'none';

  const botTrap = document.getElementById('bot_trap').value;
  if (botTrap) {
    showAlert('Automated submission blocked.');
    return;
  }

  if (!selectedFile) {
    showAlert('Please choose an audio file to upload.');
    return;
  }

  const title = document.getElementById('track-title').value.trim();
  const artist = document.getElementById('track-artist').value.trim();
  const genre = document.getElementById('track-genre').value;
  const isLoop = document.getElementById('track-loop').checked;

  const formData = new FormData();
  formData.append('file', selectedFile);
  formData.append('title', title);
  formData.append('artist', artist);
  formData.append('genre', genre);
  formData.append('duration', detectedDuration);
  formData.append('is_loop', isLoop ? 'true' : 'false');
  formData.append('form_time', formTimeInput.value);
  formData.append('bot_trap', botTrap);

  submitBtn.disabled = true;
  submitBtn.style.opacity = '0.7';
  btnText.textContent = 'Uploading and verifying...';

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(data.error || 'Upload failed.');
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      btnText.textContent = 'Submit Track for Review';
      return;
    }

    showAlert(data.message || 'Track uploaded successfully!', true);
    setTimeout(() => {
      window.location.href = 'thank-you.html?type=upload';
    }, 1200);

  } catch (err) {
    showAlert('Network error occurred during upload.');
    submitBtn.disabled = false;
    submitBtn.style.opacity = '1';
    btnText.textContent = 'Submit Track for Review';
  }
});

const wikiGlossary = {
  'seamless-loop': {
    title: 'Seamless Game Loop',
    pronounce: "/'si:m.l@s geim lu:p/ &bull; Audio Engineering &bull; Interactive Media",
    definition: 'An audio track designed and mastered so its end transitions into its beginning without any audible gap, click, or tempo disruption. It loops continuously in game engines indefinitely.',
    details: [
      { heading: 'Game Engine Integration', text: 'When placed into an AudioSource in Unity, Unreal Engine, or Godot with loop enabled, seamless loops maintain smooth immersion during exploration, combat, and gameplay.' },
      { heading: 'Mastering Standard', text: 'Rendered at zero-crossing points with identical boundary amplitude to eliminate phase cancellation and audio pops.' }
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
  const btn = e.target.closest('.wiki-term-btn');
  if (btn) {
    e.preventDefault();
    const term = btn.getAttribute('data-term');
    if (term) openWikiModal(term);
    return;
  }
  if (e.target.closest('#wiki-close') || e.target.closest('#wiki-btn-close') || e.target.id === 'wiki-modal') {
    closeWikiModal();
  }
});
