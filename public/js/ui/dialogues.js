// Toasts et modales génériques.

export function toast(message, { cards = null, type = 'info', duration = 4200 } = {}) {
  const zone = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const txt = document.createElement('div');
  txt.textContent = message;
  el.appendChild(txt);
  if (cards) el.appendChild(cards);
  zone.appendChild(el);
  requestAnimationFrame(() => el.classList.add('visible'));
  setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 400);
  }, duration);
}

// Modale : remplace toute modale existante. closable=false → pas de fermeture.
export function modal(contentEl, { closable = true } = {}) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal';
  const box = document.createElement('div');
  box.className = 'modal-boite';
  box.appendChild(contentEl);
  overlay.appendChild(box);
  if (closable) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }
  document.body.appendChild(overlay);
  return overlay;
}

export function closeModal() {
  document.getElementById('modal')?.remove();
}

export function bouton(label, onClick, cls = '') {
  const b = document.createElement('button');
  b.className = `btn ${cls}`.trim();
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

export function el(tag, cls = '', text = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
