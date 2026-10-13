const urlParams = new URLSearchParams(window.location.search);
const type = urlParams.get('type');
const mainIcon = document.getElementById('main-icon');
const iconContainer = document.getElementById('icon-container');
const thankTitle = document.getElementById('thank-title');
const thankDesc = document.getElementById('thank-desc');
const primaryCta = document.getElementById('primary-cta');
const secondaryCta = document.getElementById('secondary-cta');

if (type === 'login') {
  mainIcon.className = 'fa-solid fa-shield-halved';
  iconContainer.style.background = '#e0f2fe';
  iconContainer.style.color = 'var(--primary)';
  thankTitle.textContent = 'Welcome Back!';
  thankDesc.textContent = 'You are successfully logged in. Your verified creator session is active and safe. Redirecting to home...';
  primaryCta.innerHTML = '<i class="fa-solid fa-compass"></i><span>Continue to Home</span>';
  secondaryCta.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i><span>Upload New Music</span>';
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 2500);
} else if (type === 'register') {
  mainIcon.className = 'fa-solid fa-party-horn fa-sparkles';
  iconContainer.style.background = '#ecfdf5';
  iconContainer.style.color = '#16a34a';
  thankTitle.textContent = 'Account Created!';
  thankDesc.textContent = 'Welcome to WhatsCR. You can now publish royalty-free tracks, game loops, and sound effects.';
  primaryCta.innerHTML = '<i class="fa-solid fa-compass"></i><span>Start Exploring</span>';
  secondaryCta.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i><span>Upload Your First Track</span>';
} else if (type === 'upload') {
  mainIcon.className = 'fa-solid fa-cloud-arrow-up';
  iconContainer.style.background = '#fef3c7';
  iconContainer.style.color = '#d97706';
  thankTitle.textContent = 'Track Submitted for Review!';
  thankDesc.textContent = 'Your music submission is in our moderation queue. Once approved by our team, it will be published immediately to the public library.';
  primaryCta.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i><span>Upload Another Track</span>';
  primaryCta.href = 'upload.html';
  secondaryCta.innerHTML = '<i class="fa-solid fa-house"></i><span>Return to Home</span>';
  secondaryCta.href = 'index.html';
}
