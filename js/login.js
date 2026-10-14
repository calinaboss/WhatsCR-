    let currentMode = 'login';
    let currentUser = null;

    const authBox = document.getElementById('auth-box');
    const profileBox = document.getElementById('profile-box');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const authForm = document.getElementById('auth-form');
    const groupUsername = document.getElementById('group-username');
    const usernameInput = document.getElementById('auth-username');
    const identifierInput = document.getElementById('auth-identifier');
    const labelIdentifier = document.getElementById('label-identifier');
    const iconIdentifier = document.getElementById('icon-identifier');
    const passwordInput = document.getElementById('auth-password');
    const submitBtn = document.getElementById('submit-btn');
    const submitText = document.getElementById('submit-text');
    const alertBox = document.getElementById('auth-alert');
    const passwordHint = document.getElementById('password-hint');
    const formTimeInput = document.getElementById('form_time');

    const verifyBox = document.getElementById('verify-box');
    const verifyEmailDisplay = document.getElementById('verify-email-display');
    const verifyForm = document.getElementById('verify-form');
    const verifyCodeInput = document.getElementById('verify-code-input');
    const verifySubmitBtn = document.getElementById('verify-submit-btn');
    const verifyResendBtn = document.getElementById('verify-resend-btn');
    const verifySkipBtn = document.getElementById('verify-skip-btn');
    const authLegalNote = document.getElementById('auth-legal-note');

    const profileEmailBadgeWrap = document.getElementById('profile-email-badge-wrap');
    const profileVerifyBanner = document.getElementById('profile-verify-banner');
    const profileBtnSendCode = document.getElementById('profile-btn-send-code');
    const profileVerifyBox = document.getElementById('profile-verify-box');
    const profileVerifyForm = document.getElementById('profile-verify-form');
    const profileVerifyCode = document.getElementById('profile-verify-code');
    const profileVerifySubmitBtn = document.getElementById('profile-verify-submit-btn');
    const profileVerifyCancelBtn = document.getElementById('profile-verify-cancel-btn');

    let pendingVerifyEmail = '';

    const profileDisplayName = document.getElementById('profile-display-name');
    const profileDisplayEmail = document.getElementById('profile-display-email');
    const profileRoleBadge = document.getElementById('profile-role-badge');
    const profileUsernameInput = document.getElementById('profile-username-input');
    const profileAlert = document.getElementById('profile-alert');
    const profileForm = document.getElementById('profile-form');
    const profileLogoutBtn = document.getElementById('profile-logout-btn');
    const profilePublicLink = document.getElementById('profile-public-link');
    const usernameCooldownText = document.getElementById('username-cooldown-text');

    const togglePwSectionBtn = document.getElementById('toggle-pw-section-btn');
    const togglePwSectionText = document.getElementById('toggle-pw-section-text');
    const pwChangeSection = document.getElementById('pw-change-section');
    const changePwForm = document.getElementById('change-pw-form');
    const currentPwInput = document.getElementById('current-pw-input');
    const newPwInput = document.getElementById('new-pw-input');
    const confirmPwInput = document.getElementById('confirm-pw-input');
    const savePwBtn = document.getElementById('save-pw-btn');
    const cancelPwBtn = document.getElementById('cancel-pw-btn');
    const pwStrengthMeter = document.getElementById('pw-strength-meter');
    const pwStrengthLabel = document.getElementById('pw-strength-label');
    const pwMatchError = document.getElementById('pw-match-error');

    formTimeInput.value = Date.now();

    function setMode(mode) {
      currentMode = mode;
      alertBox.style.display = 'none';
      if (verifyBox) verifyBox.style.display = 'none';
      if (authForm) authForm.style.display = 'block';
      if (tabLogin && tabLogin.parentElement) tabLogin.parentElement.style.display = 'flex';
      if (authLegalNote) authLegalNote.style.display = 'block';
      if (mode === 'login') {
        tabLogin.style.background = '#ffffff';
        tabLogin.style.color = 'var(--text-main)';
        tabLogin.style.boxShadow = 'var(--shadow-sm)';
        tabRegister.style.background = 'transparent';
        tabRegister.style.color = 'var(--text-muted)';
        tabRegister.style.boxShadow = 'none';
        groupUsername.style.display = 'none';
        labelIdentifier.textContent = 'Email or Username';
        identifierInput.placeholder = 'Enter your email or username';
        iconIdentifier.className = 'fa-solid fa-user';
        submitText.textContent = 'Log In to WhatsCR';
        passwordHint.style.display = 'none';
      } else {
        tabRegister.style.background = '#ffffff';
        tabRegister.style.color = 'var(--text-main)';
        tabRegister.style.boxShadow = 'var(--shadow-sm)';
        tabLogin.style.background = 'transparent';
        tabLogin.style.color = 'var(--text-muted)';
        tabLogin.style.boxShadow = 'none';
        groupUsername.style.display = 'block';
        labelIdentifier.textContent = 'Email address';
        identifierInput.placeholder = 'Enter your email address';
        iconIdentifier.className = 'fa-solid fa-envelope';
        submitText.textContent = 'Create Account';
        passwordHint.style.display = 'block';
      }
    }

    tabLogin.addEventListener('click', () => setMode('login'));
    tabRegister.addEventListener('click', () => setMode('register'));

    function showAlert(msg, isSuccess = false) {
      alertBox.textContent = msg;
      alertBox.style.display = 'block';
      if (isSuccess) {
        alertBox.style.background = '#ecfdf5';
        alertBox.style.color = '#065f46';
        alertBox.style.border = '1px solid #a7f3d0';
      } else {
        alertBox.style.background = '#fef2f2';
        alertBox.style.color = '#991b1b';
        alertBox.style.border = '1px solid #fecaca';
      }
    }

    function showProfileAlert(msg, isSuccess = false) {
      profileAlert.textContent = msg;
      profileAlert.style.display = 'block';
      if (isSuccess) {
        profileAlert.style.background = '#ecfdf5';
        profileAlert.style.color = '#065f46';
        profileAlert.style.border = '1px solid #a7f3d0';
      } else {
        profileAlert.style.background = '#fef2f2';
        profileAlert.style.color = '#991b1b';
        profileAlert.style.border = '1px solid #fecaca';
      }
    }

    function displayProfile(user) {
      currentUser = user;
      authBox.style.display = 'none';
      profileBox.style.display = 'block';

      const handle = user.username || user.email.split('@')[0];
      profileDisplayName.textContent = `@${handle}`;
      profileDisplayEmail.textContent = user.email;
      profileUsernameInput.value = handle;

      if (profileEmailBadgeWrap) {
        if (user.email_verified) {
          profileEmailBadgeWrap.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.76rem; font-weight: 700; color: #16a34a; background: #dcfce7; padding: 2px 10px; border-radius: 9999px;"><i class="fa-solid fa-circle-check"></i> Email Verified</span>';
          if (profileVerifyBanner) profileVerifyBanner.style.display = 'none';
          if (profileVerifyBox) profileVerifyBox.style.display = 'none';
        } else {
          profileEmailBadgeWrap.innerHTML = '<span style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.76rem; font-weight: 700; color: #d97706; background: #fef3c7; padding: 2px 10px; border-radius: 9999px;"><i class="fa-solid fa-triangle-exclamation"></i> Not Verified</span>';
          if (profileVerifyBanner) profileVerifyBanner.style.display = 'flex';
        }
      }

      if (profilePublicLink) {
        profilePublicLink.href = `profile.html?u=${encodeURIComponent(handle)}`;
      }

      if (user.username_changed_at) {
        const lastChanged = new Date(user.username_changed_at).getTime();
        const diffMs = Date.now() - lastChanged;
        const cooldownMs = 24 * 60 * 60 * 1000;
        if (diffMs < cooldownMs) {
          const remainingMin = Math.ceil((cooldownMs - diffMs) / (60 * 1000));
          const hours = Math.floor(remainingMin / 60);
          const mins = remainingMin % 60;
          const timeText = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
          if (usernameCooldownText) {
            usernameCooldownText.textContent = `Username updated recently. Next change available in ${timeText}.`;
            usernameCooldownText.style.color = '#d97706';
          }
        } else {
          if (usernameCooldownText) {
            usernameCooldownText.textContent = 'Username can be updated once every 24 hours.';
            usernameCooldownText.style.color = '#64748b';
          }
        }
      }
    }

    async function checkCurrentSession() {
      try {
        const res = await fetch('/api/auth?action=me');
        if (res.ok) {
          const data = await res.json();
          if (data && data.user) {
            displayProfile(data.user);
          }
        }
      } catch (e) {}
    }

    const initialTab = new URLSearchParams(window.location.search).get('tab');
    if (initialTab === 'register') {
      setMode('register');
    }

    checkCurrentSession();

    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertBox.style.display = 'none';

      const botTrap = document.getElementById('bot_trap').value;
      if (botTrap) {
        showAlert('Automated submission blocked.');
        return;
      }

      let captchaToken = '';
      if (typeof turnstile !== 'undefined') {
        captchaToken = turnstile.getResponse();
      }
      if (!captchaToken && currentMode === 'register') {
        showAlert('Please complete the verification captcha.');
        return;
      }

      const identifier = identifierInput.value.trim();
      const password = passwordInput.value;
      const username = usernameInput ? usernameInput.value.trim() : '';

      if (!identifier || !password) {
        showAlert('Please fill in all required fields.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.style.opacity = '0.7';

      try {
        const payload = {
          identifier,
          email: identifier,
          password,
          username,
          form_time: formTimeInput.value,
          bot_trap: botTrap,
          captcha_token: captchaToken
        };

        const res = await fetch(`/api/auth?action=${currentMode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
          showAlert(data.error || 'Operation failed. Please try again.');
          if (typeof turnstile !== 'undefined') {
            try { turnstile.reset(); } catch (e) {}
          }
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          return;
        }

        if (currentMode === 'register' && data.requires_verification) {
          pendingVerifyEmail = data.email || identifier;
          authForm.style.display = 'none';
          tabLogin.parentElement.style.display = 'none';
          if (authLegalNote) authLegalNote.style.display = 'none';
          alertBox.style.display = 'none';
          verifyEmailDisplay.textContent = pendingVerifyEmail;
          verifyBox.style.display = 'block';
          verifyCodeInput.value = '';
          verifyCodeInput.focus();
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          return;
        }

        showAlert(currentMode === 'login' ? 'Login successful! Redirecting...' : 'Account created! Redirecting...', true);
        setTimeout(() => {
          const redirectUrl = new URLSearchParams(window.location.search).get('next');
          if (redirectUrl) {
            window.location.href = redirectUrl;
          } else {
            window.location.href = `thank-you.html?type=${currentMode}`;
          }
        }, 500);

      } catch (err) {
        showAlert('Network error. Please check your connection.');
        if (typeof turnstile !== 'undefined') {
          try { turnstile.reset(); } catch (e) {}
        }
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
      }
    });

    profileForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      profileAlert.style.display = 'none';

      const newUsername = profileUsernameInput.value.trim().toLowerCase();
      if (!newUsername || newUsername.length < 3) {
        showProfileAlert('Username must be at least 3 characters.');
        return;
      }

      const saveBtn = document.getElementById('save-profile-btn');
      saveBtn.disabled = true;
      saveBtn.style.opacity = '0.7';

      try {
        const res = await fetch('/api/auth?action=update_profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: newUsername })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          showProfileAlert('Username updated successfully!', true);
          currentUser = data.user;
          profileDisplayName.textContent = `@${data.user.username}`;
          if (profilePublicLink) {
            profilePublicLink.href = `profile.html?u=${encodeURIComponent(data.user.username)}`;
          }
          if (usernameCooldownText) {
            usernameCooldownText.textContent = 'Username updated recently. Next change available in 24 hours.';
            usernameCooldownText.style.color = '#d97706';
          }
        } else {
          showProfileAlert(data.error || 'Failed to update username.');
        }
      } catch (err) {
        showProfileAlert('Network error while updating username.');
      } finally {
        saveBtn.disabled = false;
        saveBtn.style.opacity = '1';
      }
    });

    document.querySelectorAll('.btn-toggle-pw').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        const input = document.getElementById(targetId);
        if (!input) return;
        const icon = btn.querySelector('i');
        if (input.type === 'password') {
          input.type = 'text';
          if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
          }
        } else {
          input.type = 'password';
          if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
          }
        }
      });
    });

    if (togglePwSectionBtn) {
      togglePwSectionBtn.addEventListener('click', () => {
        const isHidden = pwChangeSection.style.display === 'none';
        pwChangeSection.style.display = isHidden ? 'block' : 'none';
        togglePwSectionText.textContent = isHidden ? 'Close' : 'Edit';
        if (isHidden) {
          currentPwInput.focus();
        } else {
          changePwForm.reset();
          pwStrengthMeter.style.display = 'none';
          pwMatchError.style.display = 'none';
        }
      });
    }

    if (cancelPwBtn) {
      cancelPwBtn.addEventListener('click', () => {
        pwChangeSection.style.display = 'none';
        togglePwSectionText.textContent = 'Edit';
        changePwForm.reset();
        pwStrengthMeter.style.display = 'none';
        pwMatchError.style.display = 'none';
      });
    }

    if (newPwInput) {
      newPwInput.addEventListener('input', () => {
        const val = newPwInput.value;
        if (!val) {
          pwStrengthMeter.style.display = 'none';
          return;
        }
        pwStrengthMeter.style.display = 'block';

        let score = 0;
        if (val.length >= 8) score++;
        if (/[A-Z]/.test(val) && /[a-z]/.test(val)) score++;
        if (/\d/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;

        const b1 = document.getElementById('pw-bar-1');
        const b2 = document.getElementById('pw-bar-2');
        const b3 = document.getElementById('pw-bar-3');
        const b4 = document.getElementById('pw-bar-4');

        const colors = ['#e2e8f0', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
        const labels = ['', 'Weak password', 'Fair password', 'Good password', 'Strong password'];

        const activeColor = colors[score] || '#e2e8f0';
        b1.style.background = score >= 1 ? activeColor : '#e2e8f0';
        b2.style.background = score >= 2 ? activeColor : '#e2e8f0';
        b3.style.background = score >= 3 ? activeColor : '#e2e8f0';
        b4.style.background = score >= 4 ? activeColor : '#e2e8f0';

        pwStrengthLabel.textContent = labels[score];
        pwStrengthLabel.style.color = activeColor;
      });
    }

    if (changePwForm) {
      changePwForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        profileAlert.style.display = 'none';
        pwMatchError.style.display = 'none';

        const currentPw = currentPwInput.value;
        const newPw = newPwInput.value;
        const confirmPw = confirmPwInput.value;

        if (newPw !== confirmPw) {
          pwMatchError.style.display = 'block';
          confirmPwInput.focus();
          return;
        }

        savePwBtn.disabled = true;
        savePwBtn.style.opacity = '0.7';
        savePwBtn.textContent = 'Updating...';

        try {
          const res = await fetch('/api/auth?action=change_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              current_password: currentPw,
              new_password: newPw
            })
          });
          const data = await res.json();
          if (res.ok && data.success) {
            showProfileAlert('Password updated successfully! Please keep it safe.', true);
            changePwForm.reset();
            pwStrengthMeter.style.display = 'none';
            pwChangeSection.style.display = 'none';
            togglePwSectionText.textContent = 'Edit';
          } else {
            showProfileAlert(data.error || 'Failed to update password.');
          }
        } catch (err) {
          showProfileAlert('Network error while updating password.');
        } finally {
          savePwBtn.disabled = false;
          savePwBtn.style.opacity = '1';
          savePwBtn.textContent = 'Update Password';
        }
      });
    }

    if (verifyForm) {
      verifyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = verifyCodeInput.value.trim().replace(/\D/g, '');
        if (code.length !== 6) {
          showAlert('Please enter the 6-digit code sent to your email.');
          return;
        }

        verifySubmitBtn.disabled = true;
        verifySubmitBtn.style.opacity = '0.7';

        try {
          const res = await fetch('/api/auth?action=verify_email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingVerifyEmail, code })
          });
          const data = await res.json();
          if (!res.ok) {
            showAlert(data.error || 'Verification failed. Please check the code.');
            verifySubmitBtn.disabled = false;
            verifySubmitBtn.style.opacity = '1';
            return;
          }

          showAlert('Email verified successfully! Redirecting...', true);
          setTimeout(() => {
            const redirectUrl = new URLSearchParams(window.location.search).get('next');
            if (redirectUrl) {
              window.location.href = redirectUrl;
            } else {
              window.location.href = 'thank-you.html?type=register';
            }
          }, 800);
        } catch (err) {
          showAlert('Network error. Please try again.');
          verifySubmitBtn.disabled = false;
          verifySubmitBtn.style.opacity = '1';
        }
      });
    }

    if (verifyResendBtn) {
      verifyResendBtn.addEventListener('click', async () => {
        verifyResendBtn.disabled = true;
        verifyResendBtn.textContent = 'Sending...';
        try {
          const res = await fetch('/api/auth?action=send_verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingVerifyEmail })
          });
          const data = await res.json();
          if (res.ok) {
            showAlert('New code sent! Please check your email.', true);
          } else {
            showAlert(data.error || 'Failed to resend code.');
          }
        } catch (e) {
          showAlert('Failed to resend code.');
        } finally {
          setTimeout(() => {
            verifyResendBtn.disabled = false;
            verifyResendBtn.textContent = 'Resend Code';
          }, 3000);
        }
      });
    }

    if (verifySkipBtn) {
      verifySkipBtn.addEventListener('click', () => {
        const redirectUrl = new URLSearchParams(window.location.search).get('next');
        if (redirectUrl) {
          window.location.href = redirectUrl;
        } else {
          window.location.href = 'thank-you.html?type=register';
        }
      });
    }

    if (profileBtnSendCode) {
      profileBtnSendCode.addEventListener('click', async () => {
        profileBtnSendCode.disabled = true;
        profileBtnSendCode.textContent = 'Sending...';
        try {
          const res = await fetch('/api/auth?action=send_verification', { method: 'POST' });
          const data = await res.json();
          if (res.ok) {
            showProfileAlert('Verification code sent to your email!', true);
            profileVerifyBanner.style.display = 'none';
            profileVerifyBox.style.display = 'block';
            profileVerifyCode.value = '';
            profileVerifyCode.focus();
          } else {
            showProfileAlert(data.error || 'Failed to send verification code.');
          }
        } catch (e) {
          showProfileAlert('Failed to send verification code.');
        } finally {
          profileBtnSendCode.disabled = false;
          profileBtnSendCode.textContent = 'Send Code';
        }
      });
    }

    if (profileVerifyCancelBtn) {
      profileVerifyCancelBtn.addEventListener('click', () => {
        profileVerifyBox.style.display = 'none';
        if (currentUser && !currentUser.email_verified) {
          profileVerifyBanner.style.display = 'flex';
        }
      });
    }

    if (profileVerifyForm) {
      profileVerifyForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const code = profileVerifyCode.value.trim().replace(/\D/g, '');
        if (code.length !== 6) {
          showProfileAlert('Please enter the 6-digit code.');
          return;
        }

        profileVerifySubmitBtn.disabled = true;
        try {
          const res = await fetch('/api/auth?action=verify_email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
          });
          const data = await res.json();
          if (!res.ok) {
            showProfileAlert(data.error || 'Invalid code.');
            profileVerifySubmitBtn.disabled = false;
            return;
          }

          showProfileAlert('Email verified successfully!', true);
          profileVerifyBox.style.display = 'none';
          if (currentUser) {
            currentUser.email_verified = true;
            displayProfile(currentUser);
          }
        } catch (err) {
          showProfileAlert('Network error. Please try again.');
          profileVerifySubmitBtn.disabled = false;
        }
      });
    }

    profileLogoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth?action=logout', { method: 'POST' });
        window.location.reload();
      } catch (e) {
        window.location.reload();
      }
    });
