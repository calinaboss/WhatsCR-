document.querySelectorAll('.safe-mail').forEach(el => {
  const u = el.getAttribute('data-u');
  const d = el.getAttribute('data-d');
  const sub = el.getAttribute('data-sub');
  if (u && d) {
    const addr = `${u}@${d}`;
    if (el.tagName === 'A') {
      el.href = sub ? `mailto:${addr}?subject=${encodeURIComponent(sub)}` : `mailto:${addr}`;
    }
    el.textContent = addr;
  }
});
