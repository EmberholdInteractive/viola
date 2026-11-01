// Mehrsprachige Oberfläche. Quelltexte sind Deutsch; für jede andere Sprache gibt es eine Tabelle (window.I18N_L[code]) Deutsch -> Zieltext. Texte, Platzhalter und Tooltips werden live übersetzt.
(function () {
  const LANGS = [['de', 'Deutsch'], ['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['pt', 'Português'], ['it', 'Italiano'], ['pl', 'Polski'], ['tr', 'Türkçe'], ['nl', 'Nederlands'], ['ru', 'Русский'], ['zh', '中文'], ['ja', '日本語'], ['ko', '한국어'], ['ar', 'العربية'], ['hi', 'हिन्दी']];
  const TAB = window.I18N_L = window.I18N_L || {}; TAB.en = Object.assign({}, window.I18N_EN || {}, TAB.en || {});
  const have = c => c === 'de' || !!TAB[c];
  const orig = new WeakMap(); // Knoten/Attribute -> deutscher Originaltext
  const detect = () => { try { const sv = localStorage.getItem('viola.lang'); if (sv && have(sv)) return sv; } catch {} const l = ((navigator.languages && navigator.languages[0]) || navigator.language || 'de').toLowerCase().slice(0, 2); return have(l) ? l : 'en'; };
  let lang = detect(), T = {}, rx = [];
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const esc = k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function build() { T = lang === 'de' ? {} : (TAB[lang] || {}); rx = Object.keys(T).sort((a, b) => b.length - a.length).map(k => [k, new RegExp('(?<![\\p{L}\\p{N}])' + esc(k) + '(?![\\p{L}\\p{N}])', 'gu')]); }
  function tr(s) {
    if (lang === 'de' || !s) return s;
    const t = s.trim(); if (!t) return s;
    if (T[t] !== undefined) return s.replace(t, () => T[t]);
    let out = s;
    for (const [k, r] of rx) if (out.includes(k)) out = out.replace(r, () => T[k]);
    return out;
  }
  function textNode(n) {
    if (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) return;
    if (n.parentNode && n.parentNode.closest && n.parentNode.closest('#langmenu')) return;
    if (!orig.has(n)) orig.set(n, n.nodeValue);
    const o = orig.get(n); const v = lang !== 'de' ? tr(o) : o;
    if (n.nodeValue !== v) { n.__i18n = true; n.nodeValue = v; }
  }
  function attrs(e) {
    for (const a of ATTRS) if (e.hasAttribute && e.hasAttribute(a)) {
      const store = orig.get(e) || {}; if (!(a in store)) store[a] = e.getAttribute(a); orig.set(e, store);
      const v = lang !== 'de' ? tr(store[a]) : store[a]; if (e.getAttribute(a) !== v) e.setAttribute(a, v);
    }
  }
  function walk(root) {
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1) return;
    attrs(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) n.nodeType === 3 ? textNode(n) : attrs(n);
  }
  const mo = new MutationObserver(list => {
    mo.disconnect();
    for (const m of list) {
      if (m.type === 'childList') m.addedNodes.forEach(walk);
      else if (m.type === 'characterData') { orig.delete(m.target); textNode(m.target); }
      else if (m.type === 'attributes') { const s = orig.get(m.target); if (s) delete s[m.attributeName]; attrs(m.target); }
    }
    observe();
  });
  function observe() { mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS }); }
  function apply() { build(); document.documentElement.lang = lang; mo.disconnect(); walk(document.body); observe(); document.title = 'Viola'; const b = document.getElementById('bLang'); if (b) b.textContent = lang.toUpperCase(); }
  function menu(anchor) {
    const old = document.getElementById('langmenu'); if (old) { old.remove(); return; }
    const m = document.createElement('div'); m.id = 'langmenu';
    LANGS.filter(([c]) => have(c)).forEach(([c, n]) => { const b = document.createElement('button'); b.textContent = n; b.dataset.noi18n = '1'; if (c === lang) b.className = 'on'; b.onclick = () => { m.remove(); I18n.set(c); }; m.append(b); });
    document.body.append(m);
    const r = (anchor || document.getElementById('bLang') || document.body).getBoundingClientRect(); m.style.top = Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 8) + 'px'; m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px';
    setTimeout(() => document.addEventListener('click', function f() { m.remove(); document.removeEventListener('click', f); }, { once: true }), 0);
  }
  window.I18n = {
    LANGS, get lang() { return lang; }, t: tr, menu,
    set(l) { lang = have(l) ? l : 'en'; try { localStorage.setItem('viola.lang', lang); } catch {} apply(); },
    toggle() { this.set(lang === 'de' ? 'en' : 'de'); }
  };
  // Dialogtexte (confirm/alert) und Toasts laufen über window.confirm/alert bzw. DOM
  const _c = window.confirm.bind(window), _a = window.alert.bind(window);
  window.confirm = m => _c(tr(String(m))); window.alert = m => _a(tr(String(m)));
  window.addEventListener('DOMContentLoaded', () => { const b = document.getElementById('bLang'); if (b) { b.title = 'Sprache / Language'; b.addEventListener('click', e => { e.stopPropagation(); I18n.menu(b); }); } apply(); });
})();
