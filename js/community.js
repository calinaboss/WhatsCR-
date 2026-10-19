(function() {
  let currentUser = null;
  let guestName = '';
  let currentRoomId = null;
  let currentRoomData = null;
  let activeReply = null;
  let lastMessageTimestamp = null;
  let pollIntervalId = null;
  let lastTypingSent = 0;

  const commLayout = document.getElementById('comm-layout');
  const roomsList = document.getElementById('rooms-list');
  const searchRoomsInput = document.getElementById('search-rooms-input');
  const btnOpenCreateRoom = document.getElementById('btn-open-create-room');
  const chatEmptyState = document.getElementById('chat-empty-state');
  const activeChatContainer = document.getElementById('active-chat-container');
  const chatTitle = document.getElementById('chat-title');
  const chatSubtitle = document.getElementById('chat-subtitle');
  const chatRoomActions = document.getElementById('chat-room-actions');
  const chatMessagesContainer = document.getElementById('chat-messages-container');
  const chatTypingBar = document.getElementById('chat-typing-bar');
  const chatTypingText = document.getElementById('chat-typing-text');
  const chatReplyBanner = document.getElementById('chat-reply-banner');
  const replyBannerUser = document.getElementById('reply-banner-user');
  const replyBannerSnippet = document.getElementById('reply-banner-snippet');
  const btnCancelReply = document.getElementById('btn-cancel-reply');
  const chatAuthorIndicator = document.getElementById('chat-author-indicator');
  const charCounter = document.getElementById('char-counter');
  const chatInput = document.getElementById('chat-input');
  const btnSendMessage = document.getElementById('btn-send-message');
  const btnBackToRooms = document.getElementById('btn-back-to-rooms');
  const commUserBadge = document.getElementById('comm-user-badge');

  const createRoomModal = document.getElementById('create-room-modal');
  const createRoomForm = document.getElementById('create-room-form');
  const newRoomTitle = document.getElementById('new-room-title');
  const newRoomDesc = document.getElementById('new-room-desc');
  const btnCloseCreateRoom = document.getElementById('btn-close-create-room');
  const btnCancelCreateRoom = document.getElementById('btn-cancel-create-room');

  const guestNameModal = document.getElementById('guest-name-modal');
  const guestNameForm = document.getElementById('guest-name-form');
  const guestNicknameInput = document.getElementById('guest-nickname-input');
  const btnRandomGuestName = document.getElementById('btn-random-guest-name');
  const btnCloseGuestModal = document.getElementById('btn-close-guest-modal');
  const btnCancelGuestModal = document.getElementById('btn-cancel-guest-modal');

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function generateRandomGuestName() {
    return 'Guest_' + Math.floor(1000 + Math.random() * 9000);
  }

  function initGuestName() {
    let saved = localStorage.getItem('whatscr_guest_name');
    if (!saved || typeof saved !== 'string' || saved.trim().length < 2) {
      saved = generateRandomGuestName();
      localStorage.setItem('whatscr_guest_name', saved);
    }
    guestName = saved.trim().slice(0, 24);
  }

  function getSenderName() {
    if (currentUser && currentUser.username) {
      return currentUser.username;
    }
    return guestName;
  }

  function renderUserHeader() {
    if (!commUserBadge) return;
    if (currentUser && currentUser.username) {
      const initial = (currentUser.username[0] || 'U').toUpperCase();
      commUserBadge.innerHTML = `
        <a href="profile.html?u=${encodeURIComponent(currentUser.username)}" class="comm-user-pill" title="View profile">
          <span class="comm-user-avatar">${escapeHtml(initial)}</span>
          <span>@${escapeHtml(currentUser.username)}</span>
        </a>
      `;
    } else {
      commUserBadge.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="comm-user-pill guest" id="btn-change-guest-pill" title="Click to change your guest nickname">
            <i class="fa-solid fa-user-secret"></i>
            <span>${escapeHtml(guestName)}</span>
            <i class="fa-solid fa-pen" style="font-size: 0.72rem; opacity: 0.7;"></i>
          </div>
          <a href="login.html?next=community.html" class="nav-link" style="font-size: 0.85rem; font-weight: 700; color: var(--primary);">Log In</a>
        </div>
      `;
      const pill = document.getElementById('btn-change-guest-pill');
      if (pill) {
        pill.addEventListener('click', openGuestModal);
      }
    }
    updateInputAuthorIndicator();
  }

  function updateInputAuthorIndicator() {
    if (!chatAuthorIndicator) return;
    if (currentUser && currentUser.username) {
      chatAuthorIndicator.innerHTML = `Writing as <strong>@${escapeHtml(currentUser.username)}</strong>`;
    } else {
      chatAuthorIndicator.innerHTML = `Writing as <span class="chat-guest-name-pill" id="btn-input-change-guest"><i class="fa-solid fa-user-secret"></i> <strong>${escapeHtml(guestName)}</strong> <i class="fa-solid fa-pen" style="font-size: 0.68rem;"></i></span>`;
      const pill = document.getElementById('btn-input-change-guest');
      if (pill) {
        pill.addEventListener('click', openGuestModal);
      }
    }
  }

  function openGuestModal() {
    if (guestNicknameInput) {
      guestNicknameInput.value = guestName;
    }
    if (guestNameModal) {
      guestNameModal.style.display = 'flex';
      setTimeout(() => guestNicknameInput && guestNicknameInput.focus(), 50);
    }
  }

  function closeGuestModal() {
    if (guestNameModal) guestNameModal.style.display = 'none';
  }

  function openCreateRoomModal() {
    if (newRoomTitle) newRoomTitle.value = '';
    if (newRoomDesc) newRoomDesc.value = '';
    if (createRoomModal) {
      createRoomModal.style.display = 'flex';
      setTimeout(() => newRoomTitle && newRoomTitle.focus(), 50);
    }
  }

  function closeCreateRoomModal() {
    if (createRoomModal) createRoomModal.style.display = 'none';
  }

  function formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function formatMessageTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth?action=me');
      if (res.ok) {
        const data = await res.json();
        currentUser = data.user || null;
      }
    } catch (e) {
      currentUser = null;
    }
    initGuestName();
    renderUserHeader();
  }

  async function loadRooms(searchQuery = '') {
    if (!roomsList) return;
    try {
      let url = '/api/forum?action=rooms';
      if (searchQuery) {
        url += `&q=${encodeURIComponent(searchQuery)}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load rooms');
      const data = await res.json();
      renderRoomsList(data.rooms || []);
    } catch (err) {
      roomsList.innerHTML = `<div style="text-align: center; padding: 24px; color: #ef4444; font-size: 0.88rem;">Failed to load chat rooms.</div>`;
    }
  }

  function renderRoomsList(rooms) {
    if (!rooms || rooms.length === 0) {
      roomsList.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted); font-size: 0.86rem;">
          <i class="fa-regular fa-comment-dots" style="font-size: 1.8rem; margin-bottom: 8px; color: #cbd5e1; display: block;"></i>
          No chat rooms found. Be the first to create one!
        </div>
      `;
      return;
    }

    roomsList.innerHTML = rooms.map(r => {
      const isActive = currentRoomId === r.id;
      const count = parseInt(r.message_count, 10) || 0;
      const timeStr = formatRelativeTime(r.last_message_at || r.created_at);

      return `
        <div class="room-item ${isActive ? 'active' : ''}" data-room-id="${escapeHtml(r.id)}">
          <div class="room-item-icon">
            <i class="fa-solid fa-hashtag"></i>
          </div>
          <div class="room-item-body">
            <div class="room-item-head">
              <span class="room-item-title">${escapeHtml(r.title)}</span>
              <span class="room-item-badge">${count} msg</span>
            </div>
            ${r.description ? `<div class="room-item-desc">${escapeHtml(r.description)}</div>` : ''}
            <div class="room-item-footer">
              <span>by ${escapeHtml(r.creator_name)}</span>
              <span>&bull;</span>
              <span>${escapeHtml(timeStr)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  async function openRoom(roomId) {
    if (!roomId) return;
    currentRoomId = roomId;
    activeReply = null;
    hideReplyBanner();
    lastMessageTimestamp = null;

    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }

    const items = document.querySelectorAll('.room-item');
    items.forEach(el => {
      if (el.getAttribute('data-room-id') === roomId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    if (commLayout) commLayout.classList.add('in-room');
    if (chatEmptyState) chatEmptyState.style.display = 'none';
    if (activeChatContainer) activeChatContainer.style.display = 'flex';
    if (chatMessagesContainer) {
      chatMessagesContainer.innerHTML = '<div style="text-align:center; padding: 32px; color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i>Loading chat...</div>';
    }

    try {
      const res = await fetch(`/api/forum?action=room&id=${encodeURIComponent(roomId)}`);
      if (!res.ok) throw new Error('Room not found');
      const data = await res.json();
      currentRoomData = data.room;
      renderRoomHeader(data.room);
    } catch (e) {
      if (chatMessagesContainer) {
        chatMessagesContainer.innerHTML = '<div style="text-align:center; padding: 32px; color: #ef4444;">Failed to load chat details.</div>';
      }
      return;
    }

    await loadInitialMessages(roomId);

    pollIntervalId = setInterval(() => {
      if (currentRoomId === roomId) {
        pollMessages(roomId);
        pollTyping(roomId);
      }
    }, 2400);

    if (chatInput) {
      chatInput.focus();
    }
  }

  function renderRoomHeader(room) {
    if (!room) return;
    if (chatTitle) chatTitle.textContent = room.title;
    if (chatSubtitle) {
      const count = parseInt(room.message_count, 10) || 0;
      chatSubtitle.textContent = `Created by ${room.creator_name} \u2022 ${count} messages`;
    }

    if (chatRoomActions) {
      const isAdmin = currentUser && currentUser.role === 'admin';
      const isCreator = currentUser && room.creator_id && currentUser.id === room.creator_id;
      if (isAdmin || isCreator) {
        chatRoomActions.innerHTML = `
          <button class="btn-room-action" id="btn-delete-room" title="Delete this room">
            <i class="fa-solid fa-trash-can"></i>
            <span>Delete Chat</span>
          </button>
        `;
        const delBtn = document.getElementById('btn-delete-room');
        if (delBtn) {
          delBtn.addEventListener('click', handleDeleteRoom);
        }
      } else {
        chatRoomActions.innerHTML = '';
      }
    }
  }

  async function loadInitialMessages(roomId) {
    if (!chatMessagesContainer) return;
    try {
      const res = await fetch(`/api/forum?action=messages&room_id=${encodeURIComponent(roomId)}`);
      if (!res.ok) throw new Error('Failed to load messages');
      const data = await res.json();
      const messages = data.messages || [];

      chatMessagesContainer.innerHTML = '';
      if (messages.length === 0) {
        chatMessagesContainer.innerHTML = `
          <div style="text-align: center; padding: 48px 20px; color: #94a3b8; font-size: 0.9rem;">
            <i class="fa-regular fa-comment-dots" style="font-size: 2.2rem; margin-bottom: 12px; color: #cbd5e1; display: block;"></i>
            No messages here yet. Say hello and start the conversation!
          </div>
        `;
        return;
      }

      messages.forEach(msg => {
        appendMessageElement(msg);
        lastMessageTimestamp = msg.created_at;
      });

      scrollChatToBottom();
    } catch (e) {
      chatMessagesContainer.innerHTML = '<div style="text-align: center; padding: 32px; color: #ef4444;">Failed to load messages.</div>';
    }
  }

  async function pollMessages(roomId) {
    if (!roomId || !lastMessageTimestamp || !chatMessagesContainer) return;
    try {
      const res = await fetch(`/api/forum?action=messages&room_id=${encodeURIComponent(roomId)}&since=${encodeURIComponent(lastMessageTimestamp)}`);
      if (!res.ok) return;
      const data = await res.json();
      const newMsgs = data.messages || [];
      if (newMsgs.length > 0) {
        const wasNearBottom = isChatNearBottom();
        newMsgs.forEach(msg => {
          if (!document.getElementById(`msg-${msg.id}`)) {
            appendMessageElement(msg);
            lastMessageTimestamp = msg.created_at;
          }
        });
        if (wasNearBottom) {
          scrollChatToBottom();
        }
      }
    } catch (e) {}
  }

  async function pollTyping(roomId) {
    if (!roomId || !chatTypingBar || !chatTypingText) return;
    try {
      const myName = getSenderName();
      const res = await fetch(`/api/forum?action=typing&room_id=${encodeURIComponent(roomId)}&exclude=${encodeURIComponent(myName)}`);
      if (!res.ok) return;
      const data = await res.json();
      const typingList = data.typing || [];

      if (typingList.length === 0) {
        chatTypingBar.style.display = 'none';
      } else if (typingList.length === 1) {
        chatTypingText.textContent = `${typingList[0]} sta scrivendo...`;
        chatTypingBar.style.display = 'flex';
      } else if (typingList.length === 2) {
        chatTypingText.textContent = `${typingList[0]} e ${typingList[1]} stanno scrivendo...`;
        chatTypingBar.style.display = 'flex';
      } else {
        chatTypingText.textContent = `${typingList[0]}, ${typingList[1]} e altri stanno scrivendo...`;
        chatTypingBar.style.display = 'flex';
      }
    } catch (e) {
      chatTypingBar.style.display = 'none';
    }
  }

  function appendMessageElement(msg) {
    if (!chatMessagesContainer) return;

    const myName = getSenderName();
    const isOwn = (currentUser && msg.sender_id && currentUser.id === msg.sender_id) || (!currentUser && msg.is_guest && msg.sender_name === myName);
    const canDelete = (currentUser && currentUser.role === 'admin') || (currentUser && msg.sender_id && currentUser.id === msg.sender_id);

    const safeId = escapeHtml(msg.id);
    const safeSender = escapeHtml(msg.sender_name);
    const timeStr = formatMessageTime(msg.created_at);

    const group = document.createElement('div');
    group.className = `msg-group ${isOwn ? 'own-message' : ''}`;
    group.id = `msg-${safeId}`;

    let senderHtml = '';
    if (!msg.is_guest) {
      senderHtml = `<a href="profile.html?u=${encodeURIComponent(msg.sender_name)}" class="msg-sender-name">@${safeSender}</a>`;
    } else {
      senderHtml = `<span class="msg-sender-name" style="cursor: default;">${safeSender} <span class="msg-guest-tag">Guest</span></span>`;
    }

    if (currentRoomData && msg.sender_name === currentRoomData.creator_name) {
      senderHtml += ` <span class="msg-creator-tag">Host</span>`;
    }
    if (msg.sender_role === 'admin') {
      senderHtml += ` <span class="msg-admin-tag">Admin</span>`;
    }

    let quoteHtml = '';
    if (msg.reply_to_text) {
      quoteHtml = `
        <div class="msg-reply-quote" data-target-id="${escapeHtml(msg.reply_to_id || '')}">
          <div class="msg-reply-quote-sender"><i class="fa-solid fa-reply" style="font-size: 0.7rem; margin-right: 4px;"></i>${escapeHtml(msg.reply_to_sender || 'User')}</div>
          <div class="msg-reply-quote-text">${escapeHtml(msg.reply_to_text)}</div>
        </div>
      `;
    }

    group.innerHTML = `
      <div class="msg-bubble">
        <div class="msg-sender-row">
          <div>${senderHtml}</div>
          <div class="msg-actions">
            <button class="msg-btn-action btn-reply-msg" data-msg-id="${safeId}" data-sender="${safeSender}" title="Reply WhatsApp-style">
              <i class="fa-solid fa-reply"></i>
            </button>
            ${canDelete ? `
              <button class="msg-btn-action delete btn-delete-msg" data-msg-id="${safeId}" title="Delete message">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ''}
          </div>
        </div>
        ${quoteHtml}
        <div class="msg-content">${escapeHtml(msg.content)}</div>
        <div class="msg-meta-row">
          <span>${escapeHtml(timeStr)}</span>
        </div>
      </div>
    `;

    chatMessagesContainer.appendChild(group);

    const quoteEl = group.querySelector('.msg-reply-quote');
    if (quoteEl) {
      quoteEl.addEventListener('click', () => {
        const targetId = quoteEl.getAttribute('data-target-id');
        if (targetId) {
          const targetNode = document.getElementById(`msg-${targetId}`);
          if (targetNode) {
            targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
            targetNode.style.transition = 'background-color 0.4s ease';
            targetNode.style.backgroundColor = 'rgba(0,151,178,0.18)';
            setTimeout(() => {
              targetNode.style.backgroundColor = '';
            }, 1200);
          }
        }
      });
    }

    const replyBtn = group.querySelector('.btn-reply-msg');
    if (replyBtn) {
      replyBtn.addEventListener('click', () => {
        setReplyState(safeId, msg.sender_name, msg.content);
      });
    }

    const delBtn = group.querySelector('.btn-delete-msg');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        handleDeleteMessage(safeId);
      });
    }
  }

  function setReplyState(id, sender, content) {
    activeReply = {
      id: id,
      sender: sender,
      text: (content || '').slice(0, 140)
    };
    if (replyBannerUser) replyBannerUser.textContent = `Replying to @${sender}`;
    if (replyBannerSnippet) replyBannerSnippet.textContent = activeReply.text;
    if (chatReplyBanner) chatReplyBanner.style.display = 'flex';
    if (chatInput) chatInput.focus();
  }

  function hideReplyBanner() {
    activeReply = null;
    if (chatReplyBanner) chatReplyBanner.style.display = 'none';
  }

  function isChatNearBottom() {
    if (!chatMessagesContainer) return true;
    const threshold = 120;
    const position = chatMessagesContainer.scrollHeight - chatMessagesContainer.scrollTop - chatMessagesContainer.clientHeight;
    return position < threshold;
  }

  function scrollChatToBottom() {
    if (!chatMessagesContainer) return;
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }

  async function sendMessage() {
    if (!currentRoomId || !chatInput) return;
    const content = chatInput.value.trim();
    if (!content) return;

    if (btnSendMessage) btnSendMessage.disabled = true;

    try {
      const payload = {
        room_id: currentRoomId,
        content: content,
        guest_name: guestName
      };
      if (activeReply && activeReply.id) {
        payload.reply_to_id = activeReply.id;
      }

      const res = await fetch('/api/forum?action=send_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Failed to send message');
        return;
      }

      const data = await res.json();
      if (data.message) {
        appendMessageElement(data.message);
        lastMessageTimestamp = data.message.created_at;
        scrollChatToBottom();
      }

      chatInput.value = '';
      if (charCounter) charCounter.textContent = '0/800';
      hideReplyBanner();
    } catch (err) {
      alert('Error sending message. Check your connection.');
    } finally {
      if (btnSendMessage) btnSendMessage.disabled = false;
      if (chatInput) chatInput.focus();
    }
  }

  function triggerTypingIndicator() {
    if (!currentRoomId) return;
    const now = Date.now();
    if (now - lastTypingSent < 2500) return;
    lastTypingSent = now;

    fetch('/api/forum?action=typing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        room_id: currentRoomId,
        guest_name: guestName
      })
    }).catch(() => {});
  }

  async function handleDeleteMessage(msgId) {
    if (!msgId) return;
    if (!confirm('Are you sure you want to delete this message?')) return;

    try {
      const res = await fetch('/api/forum?action=delete_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message_id: msgId })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Could not delete message');
        return;
      }
      const el = document.getElementById(`msg-${msgId}`);
      if (el) el.remove();
    } catch (e) {
      alert('Network error while deleting message');
    }
  }

  async function handleDeleteRoom() {
    if (!currentRoomId) return;
    if (!confirm('Are you sure you want to delete this chat room and all its messages? This action cannot be undone.')) return;

    try {
      const res = await fetch('/api/forum?action=delete_room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: currentRoomId })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Could not delete room');
        return;
      }

      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
      currentRoomId = null;
      if (commLayout) commLayout.classList.remove('in-room');
      if (activeChatContainer) activeChatContainer.style.display = 'none';
      if (chatEmptyState) chatEmptyState.style.display = 'flex';
      loadRooms();
    } catch (e) {
      alert('Network error while deleting room');
    }
  }

  async function handleCreateRoomSubmit(e) {
    e.preventDefault();
    if (!newRoomTitle) return;
    const title = newRoomTitle.value.trim();
    const desc = newRoomDesc ? newRoomDesc.value.trim() : '';

    if (title.length < 3) {
      alert('Room title must be at least 3 characters long');
      return;
    }

    const submitBtn = document.getElementById('btn-submit-create-room');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch('/api/forum?action=create_room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title,
          description: desc,
          guest_name: guestName
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to create room');
        return;
      }

      const data = await res.json();
      closeCreateRoomModal();
      await loadRooms();
      if (data.room && data.room.id) {
        openRoom(data.room.id);
      }
    } catch (e) {
      alert('Network error creating room');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  function handleSaveGuestName(e) {
    e.preventDefault();
    if (!guestNicknameInput) return;
    let clean = guestNicknameInput.value.trim().replace(/[^\w\s-]/g, '').slice(0, 24);
    if (clean.length < 2) {
      alert('Nickname must be between 2 and 24 characters.');
      return;
    }
    guestName = clean;
    localStorage.setItem('whatscr_guest_name', guestName);
    renderUserHeader();
    closeGuestModal();
  }

  function setupEventListeners() {
    if (btnOpenCreateRoom) {
      btnOpenCreateRoom.addEventListener('click', openCreateRoomModal);
    }
    if (btnCloseCreateRoom) {
      btnCloseCreateRoom.addEventListener('click', closeCreateRoomModal);
    }
    if (btnCancelCreateRoom) {
      btnCancelCreateRoom.addEventListener('click', closeCreateRoomModal);
    }
    if (createRoomForm) {
      createRoomForm.addEventListener('submit', handleCreateRoomSubmit);
    }

    if (btnCloseGuestModal) {
      btnCloseGuestModal.addEventListener('click', closeGuestModal);
    }
    if (btnCancelGuestModal) {
      btnCancelGuestModal.addEventListener('click', closeGuestModal);
    }
    if (btnRandomGuestName) {
      btnRandomGuestName.addEventListener('click', () => {
        if (guestNicknameInput) guestNicknameInput.value = generateRandomGuestName();
      });
    }
    if (guestNameForm) {
      guestNameForm.addEventListener('submit', handleSaveGuestName);
    }

    if (btnCancelReply) {
      btnCancelReply.addEventListener('click', hideReplyBanner);
    }

    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
      chatInput.addEventListener('input', () => {
        if (charCounter) {
          charCounter.textContent = `${chatInput.value.length}/800`;
        }
        triggerTypingIndicator();
      });
    }

    if (btnSendMessage) {
      btnSendMessage.addEventListener('click', sendMessage);
    }

    if (btnBackToRooms) {
      btnBackToRooms.addEventListener('click', () => {
        if (commLayout) commLayout.classList.remove('in-room');
        if (pollIntervalId) {
          clearInterval(pollIntervalId);
          pollIntervalId = null;
        }
        currentRoomId = null;
      });
    }

    if (searchRoomsInput) {
      let searchTimeout = null;
      searchRoomsInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          loadRooms(searchRoomsInput.value.trim());
        }, 300);
      });
    }

    document.addEventListener('click', (e) => {
      const roomCard = e.target.closest('.room-item');
      if (roomCard) {
        const id = roomCard.getAttribute('data-room-id');
        if (id) openRoom(id);
      }
    });
  }

  async function init() {
    setupEventListeners();
    await checkAuth();
    await loadRooms();

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      openRoom(roomParam);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
