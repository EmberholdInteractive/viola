// Zweisprachige Oberfläche (Deutsch / English). Quelltexte sind Deutsch; bei "en" werden Texte, Platzhalter und Tooltips live übersetzt.
(function () {
  const EN = window.I18N_EN || {};
  const keys = Object.keys(EN).sort((a, b) => b.length - a.length);
  const orig = new WeakMap(); // Knoten/Attribute -> deutscher Originaltext
  let lang = 'de'; try { lang = localStorage.getItem('viola.lang') || ((navigator.language || 'de').startsWith('de') ? 'de' : 'en'); } catch {}
  const ATTRS = ['placeholder', 'title', 'aria-label'];
  const esc = k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rx = keys.map(k => [k, new RegExp('(?<![\\p{L}\\p{N}])' + esc(k) + '(?![\\p{L}\\p{N}])', 'gu')]);
  function tr(s) {
    if (lang !== 'en' || !s) return s;
    const t = s.trim(); if (!t) return s;
    if (EN[t] !== undefined) return s.replace(t, EN[t]);
    let out = s;
    for (const [k, r] of rx) if (out.includes(k)) out = out.replace(r, () => EN[k]);
    return out;
  }
  function textNode(n) {
    if (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) return;
    if (!orig.has(n)) orig.set(n, n.nodeValue);
    const o = orig.get(n); const v = lang === 'en' ? tr(o) : o;
    if (n.nodeValue !== v) { n.__i18n = true; n.nodeValue = v; }
  }
  function attrs(e) {
    for (const a of ATTRS) if (e.hasAttribute && e.hasAttribute(a)) {
      const store = orig.get(e) || {}; if (!(a in store)) store[a] = e.getAttribute(a); orig.set(e, store);
      const v = lang === 'en' ? tr(store[a]) : store[a]; if (e.getAttribute(a) !== v) e.setAttribute(a, v);
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
  function apply() { document.documentElement.lang = lang; mo.disconnect(); walk(document.body); observe(); document.title = 'Viola'; const b = document.getElementById('bLang'); if (b) b.textContent = lang === 'en' ? 'EN' : 'DE'; }
  window.I18n = {
    get lang() { return lang; },
    t: tr,
    set(l) { lang = l === 'en' ? 'en' : 'de'; try { localStorage.setItem('viola.lang', lang); } catch {} apply(); },
    toggle() { this.set(lang === 'en' ? 'de' : 'en'); }
  };
  // Dialogtexte (confirm/alert) und Toasts laufen über window.confirm/alert bzw. DOM
  const _c = window.confirm.bind(window), _a = window.alert.bind(window);
  window.confirm = m => _c(tr(String(m))); window.alert = m => _a(tr(String(m)));
  window.addEventListener('DOMContentLoaded', () => { const b = document.getElementById('bLang'); if (b) b.addEventListener('click', () => I18n.toggle()); apply(); });
})();
