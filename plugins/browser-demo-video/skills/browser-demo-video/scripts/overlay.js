// Recording overlay: cursor, click pulses, highlight rings, notes and title cards. Injected into the top page only.
// Theme comes from window.__ovTheme ({ accent, ink, foot, kicker, cardBg }), set by record.cjs from video.config.cjs.
(() => {
  if (window.__ov) return;
  const root = document.createElement('div');
  root.id = '__ov';
  Object.assign(root.style, { position: 'fixed', inset: '0', zIndex: '2147483647', pointerEvents: 'none', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif' });
  document.documentElement.appendChild(root);
  const T = window.__ovTheme || {};
  const TEAL = T.accent || '#00a8b6', INK = T.ink || '#172121', FOOT = T.foot || '', KICK = T.kicker || '#7fdbe3', CARD = T.cardBg || 'radial-gradient(1200px 700px at 78% 18%, #0d3b3f 0%, #121c1c 55%, #0e1515 100%)';
  const [R, G, B] = [1, 3, 5].map(i => parseInt(TEAL.slice(i, i + 2), 16));
  const tint = a => `rgba(${R},${G},${B},${a})`;
  const el = (tag, style, html) => { const e = document.createElement(tag); Object.assign(e.style, style || {}); if (html != null) e.innerHTML = html; return e; };

  // Cursor
  const cur = el('div', { position: 'absolute', left: '0', top: '0', width: '26px', height: '32px', transform: 'translate(760px, 520px)', transition: 'transform 700ms cubic-bezier(.45,.05,.2,1), opacity 300ms', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))', opacity: '0' },
    '<svg width="26" height="32" viewBox="0 0 26 32"><path d="M2 2 L2 25 L8 19.5 L12.2 29 L16.4 27.2 L12.3 18 L20.5 18 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>');
  root.appendChild(cur);
  let cx = 760, cy = 520;

  const ringLayer = el('div', { position: 'absolute', inset: '0' }); root.insertBefore(ringLayer, cur);
  const noteLayer = el('div', { position: 'absolute', inset: '0' }); root.appendChild(noteLayer);
  const cardLayer = el('div', { position: 'absolute', inset: '0' }); root.appendChild(cardLayer);

  const api = {
    showCursor(v) { cur.style.opacity = v ? '1' : '0'; },
    move(x, y, ms) {
      const d = Math.hypot(x - cx, y - cy);
      const t = ms || Math.round(Math.min(1100, Math.max(380, 260 + d * 0.9)));
      cur.style.transition = `transform ${t}ms cubic-bezier(.45,.05,.2,1), opacity 300ms`;
      cur.style.transform = `translate(${x - 2}px, ${y - 2}px)`; cx = x; cy = y; return t;
    },
    click(x, y) {
      const p = el('div', { position: 'absolute', left: `${x - 18}px`, top: `${y - 18}px`, width: '36px', height: '36px', borderRadius: '50%', border: `3px solid ${TEAL}`, background: tint(.18), transform: 'scale(.3)', opacity: '1', transition: 'transform 520ms ease-out, opacity 520ms ease-out' });
      root.insertBefore(p, cur);
      requestAnimationFrame(() => requestAnimationFrame(() => { p.style.transform = 'scale(1.5)'; p.style.opacity = '0'; }));
      cur.animate([{ transform: `translate(${x - 2}px, ${y - 2}px) scale(1)` }, { transform: `translate(${x - 2}px, ${y - 2}px) scale(.86)` }, { transform: `translate(${x - 2}px, ${y - 2}px) scale(1)` }], { duration: 240 });
      setTimeout(() => p.remove(), 700);
    },
    // Highlight ring around a rect, with an optional marker label and optional spotlight dimming.
    ring(r, opts = {}) {
      const pad = opts.pad ?? 6, id = opts.id || 'r' + Math.random().toString(36).slice(2);
      const box = el('div', { position: 'absolute', left: `${r.x - pad}px`, top: `${r.y - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px`, borderRadius: '10px', border: `3px solid ${TEAL}`, boxShadow: opts.spot ? `0 0 0 200vmax rgba(16,24,24,.42), 0 0 0 6px ${tint(.22)}` : `0 0 0 6px ${tint(.18)}`, opacity: '0', transition: 'opacity 350ms ease, transform 350ms ease', transform: 'scale(1.02)' });
      box.dataset.id = id; ringLayer.appendChild(box);
      if (opts.label) {
        const below = opts.place === 'below' || (opts.place !== 'above' && r.y < 90);
        const lab = el('div', { position: 'absolute', left: '0', [below ? 'top' : 'bottom']: `calc(100% + 10px)`, background: INK, color: '#fff', fontSize: '15px', fontWeight: '600', lineHeight: '1.3', padding: '7px 12px', borderRadius: '8px', whiteSpace: 'nowrap', boxShadow: '0 6px 18px rgba(0,0,0,.25)' }, opts.label);
        if (opts.align === 'right') { lab.style.left = 'auto'; lab.style.right = '0'; }
        box.appendChild(lab);
        // Keep the label inside the viewport.
        const lr = lab.getBoundingClientRect(), W = window.innerWidth, H = window.innerHeight;
        if (lr.left < 10) lab.style.transform = `translateX(${10 - lr.left}px)`;
        else if (lr.right > W - 10) lab.style.transform = `translateX(${W - 10 - lr.right}px)`;
        if (lr.bottom > H - 10 && below) { lab.style.top = 'auto'; lab.style.bottom = 'calc(100% + 10px)'; }
        if (lr.top < 6 && !below) { lab.style.bottom = 'auto'; lab.style.top = 'calc(100% + 10px)'; }
      }
      requestAnimationFrame(() => requestAnimationFrame(() => { box.style.opacity = '1'; box.style.transform = 'scale(1)'; }));
      return id;
    },
    unring(id) { [...ringLayer.children].filter(b => !id || b.dataset.id === id).forEach(b => { b.style.opacity = '0'; setTimeout(() => b.remove(), 400); }); },
    // Note: a short on-screen point, only where the screen needs one.
    note(html, opts = {}) {
      api.unnote();
      const n = el('div', { position: 'absolute', left: opts.right ? 'auto' : '40px', right: opts.right ? '40px' : 'auto', bottom: '40px', maxWidth: '620px', background: 'rgba(23,33,33,.94)', color: '#fff', padding: '16px 20px 16px 18px', borderRadius: '12px', borderLeft: `5px solid ${TEAL}`, fontSize: '19px', lineHeight: '1.4', boxShadow: '0 14px 40px rgba(0,0,0,.3)', opacity: '0', transform: 'translateY(12px)', transition: 'opacity 380ms ease, transform 380ms ease' },
        (opts.kicker ? `<div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${KICK};font-weight:700;margin-bottom:5px">${opts.kicker}</div>` : '') + html);
      n.className = 'note'; noteLayer.appendChild(n);
      requestAnimationFrame(() => requestAnimationFrame(() => { n.style.opacity = '1'; n.style.transform = 'none'; }));
    },
    unnote() { [...noteLayer.querySelectorAll('.note')].forEach(n => { n.style.opacity = '0'; setTimeout(() => n.remove(), 420); }); },
    // Full-screen title or chapter card.
    card(o) {
      const old = [...cardLayer.children]; setTimeout(() => old.forEach(c => c.remove()), 700);
      const bullets = o.bullets ? `<ul style="margin:30px 0 0;padding:0;list-style:none;display:grid;gap:14px;max-width:1000px">${o.bullets.map(b => `<li style="display:flex;gap:14px;font-size:24px;line-height:1.4;color:#d9e6e6"><span style="flex:none;width:10px;height:10px;border-radius:50%;background:${TEAL};margin-top:12px"></span><span>${b}</span></li>`).join('')}</ul>` : '';
      const c = el('div', { position: 'absolute', inset: '0', background: CARD, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 120px', opacity: '0', transition: 'opacity 600ms ease' },
        `<div style="font-size:16px;letter-spacing:.14em;text-transform:uppercase;color:${KICK};font-weight:700">${o.kicker || ''}</div>
         <div style="font-size:${o.big ? 64 : 54}px;font-weight:700;letter-spacing:-.02em;line-height:1.08;margin-top:16px;max-width:1150px">${o.title}</div>
         ${o.sub ? `<div style="font-size:24px;color:#b8caca;margin-top:20px;max-width:1000px;line-height:1.45">${o.sub}</div>` : ''}${bullets}
         <div style="position:absolute;left:120px;bottom:64px;display:flex;align-items:center;gap:12px;color:#8fa3a3;font-size:15px"><span style="width:28px;height:4px;border-radius:2px;background:${TEAL}"></span>${o.foot || FOOT}</div>
         ${o.step ? `<div style="position:absolute;right:120px;bottom:52px;font-size:120px;font-weight:800;color:${tint(.16)};line-height:1">${o.step}</div>` : ''}`);
      c.className = 'card'; cardLayer.appendChild(c);
      if (o.instant) c.style.opacity = '1'; else requestAnimationFrame(() => requestAnimationFrame(() => { c.style.opacity = '1'; }));
    },
    uncard(instant) { [...cardLayer.children].forEach(c => { if (instant) return c.remove(); c.style.opacity = '0'; setTimeout(() => c.remove(), 650); }); },
    badge(text) {
      const b = el('div', { position: 'absolute', right: '40px', top: '40px', background: 'rgba(23,33,33,.92)', color: '#fff', padding: '10px 16px', borderRadius: '999px', fontSize: '16px', fontWeight: '600', display: 'flex', gap: '10px', alignItems: 'center', opacity: '0', transition: 'opacity 300ms' },
        `<span style="width:9px;height:9px;border-radius:50%;background:${TEAL};box-shadow:0 0 0 4px ${tint(.3)}"></span>${text}`);
      b.className = 'badge'; noteLayer.appendChild(b); requestAnimationFrame(() => requestAnimationFrame(() => { b.style.opacity = '1'; }));
    },
    unbadge() { [...noteLayer.querySelectorAll('.badge')].forEach(b => { b.style.opacity = '0'; setTimeout(() => b.remove(), 350); }); },
    clearAll() { api.unring(); api.unnote(); }
  };
  window.__ov = api;
})();
