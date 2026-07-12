// src/ui/frame.js — Kalıcı çerçeve (V3-C0) + paylaşılan render yardımcıları.
// ui/ SADECE state okur; mutasyon actions.js üzerinden (data-act ile main yönlendirir).

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('tr-TR');
export const stars = (d) => '★'.repeat(d) + '☆'.repeat(5 - d);

const GAUGE_LABELS = { guven: 'Güven', taraftar: 'Taraftar', mali: 'Mali', sportif: 'Sportif', itibar: 'İtibar' };
const GAUGE_KRITIK = { guven: 35, taraftar: 30, mali: 25, sportif: 30, itibar: 30 };

// Yan menü ikon seti — çizgi ikonlar (currentColor miras alır; aktif öğede altına döner).
const _svg = (p) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const NAV_ICON = {
  cockpit: _svg('<rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="1.6"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="1.6"/><rect x="13" y="13" width="7.5" height="7.5" rx="1.6"/>'),
  kadro: _svg('<circle cx="9" cy="8" r="3"/><path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"/><path d="M16.5 6.2a3 3 0 010 5.6"/><path d="M17 14.6c2.2.5 3.5 2.4 3.5 4.9"/>'),
  transfer: _svg('<path d="M4 8.5h13"/><path d="M13.5 5L17 8.5 13.5 12"/><path d="M20 15.5H7"/><path d="M10.5 12L7 15.5 10.5 19"/>'),
  tesis: _svg('<rect x="5" y="4" width="14" height="16.5" rx="1.5"/><path d="M3.5 20.5h17"/><path d="M9 8h1.5M13.5 8H15M9 12h1.5M13.5 12H15M9 16h1.5M13.5 16H15"/>'),
  finans: _svg('<path d="M4 4v16h16"/><path d="M7 15l3-3.2 2.7 2.1L18 7"/><path d="M14.6 7H18v3.4"/>'),
  medya: _svg('<circle cx="12" cy="12" r="2.2"/><path d="M8.4 8.4a5.1 5.1 0 000 7.2"/><path d="M15.6 8.4a5.1 5.1 0 010 7.2"/><path d="M5.8 5.8a8.8 8.8 0 000 12.4"/><path d="M18.2 5.8a8.8 8.8 0 010 12.4"/>'),
  kongre: _svg('<path d="M3.5 9.5L12 4.5l8.5 5"/><path d="M4 9.5h16"/><path d="M6 9.5v8M10 9.5v8M14 9.5v8M18 9.5v8"/><path d="M3.5 20h17"/>'),
  veri: _svg('<path d="M4 20h16"/><rect x="5.5" y="11" width="3.4" height="7" rx=".7"/><rect x="10.3" y="7" width="3.4" height="11" rx=".7"/><rect x="15.1" y="4" width="3.4" height="14" rx=".7"/>'),
  kulup: _svg('<path d="M12 3.2l7 2.6v5.4c0 4.7-3 7.6-7 9.6-4-2-7-4.9-7-9.6V5.8z"/><path d="M12 8.4l1 2.4 2.6.2-2 1.7.6 2.5-2.2-1.4-2.2 1.4.6-2.5-2-1.7 2.6-.2z"/>'),
  inbox: _svg('<rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M4 7l8 5.5L20 7"/>'),
};
const UI_ICON = {
  ses: _svg('<path d="M4 9.5v5h3.5l4.5 3.5v-12L7.5 9.5z"/><path d="M15.5 9.5a3.5 3.5 0 010 5"/><path d="M17.8 7a6.5 6.5 0 010 10"/>'),
  ayar: _svg('<path d="M4 7.5h9"/><path d="M17 7.5h3"/><circle cx="15" cy="7.5" r="2"/><path d="M4 16.5h3"/><path d="M11 16.5h9"/><circle cx="9" cy="16.5" r="2"/>'),
  save: _svg('<path d="M12 4v9"/><path d="M8.5 9.5L12 13l3.5-3.5"/><path d="M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3"/>'),
  load: _svg('<path d="M12 20v-9"/><path d="M8.5 14.5L12 11l3.5 3.5"/><path d="M5 9V6a2 2 0 012-2h10a2 2 0 012 2v3"/>'),
  lock: _svg('<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/>'),
};

// GÖRSEL 5b + T2-1c: YARIM HALKA gauge (%25 büyük) — kritik eşik altında neg + nabız
export function gaugeRow(key, val) {
  const v = Math.max(0, Math.min(100, Math.round(val)));
  const esik = GAUGE_KRITIK[key] ?? 30;
  const kritik = v < esik;
  const dikkat = !kritik && v < esik + 12; // sarı bant: kritiğe yaklaşıyor
  const R = 33, C = Math.PI * R;
  const dolu = (v / 100) * C;
  const renk = kritik ? 'var(--neg)' : dikkat ? 'var(--warn)' : 'var(--club)';
  return `<div class="gauge-arc ${kritik ? 'kritik' : ''}" data-tip="${GAUGE_LABELS[key]}: ${v}/100${kritik ? ' — KRİTİK' : ''}">
    <svg width="80" height="47" viewBox="0 0 80 47">
      <path d="M 7 43 A ${R} ${R} 0 0 1 73 43" fill="none" stroke="var(--bg-3)" stroke-width="8" stroke-linecap="round"/>
      <path class="dolu" d="M 7 43 A ${R} ${R} 0 0 1 73 43" fill="none" stroke="${renk}" stroke-width="8" stroke-linecap="round"
        stroke-dasharray="${dolu.toFixed(1)} ${C.toFixed(1)}" style="transition:stroke-dasharray .5s var(--ease)"/>
      <text x="40" y="41" text-anchor="middle" class="v" fill="${kritik ? 'var(--neg)' : 'var(--ink-1)'}"
        style="font-family:var(--font-display);font-weight:800;font-size:18px">${v}</text>
    </svg>
    <div class="lbl">${GAUGE_LABELS[key]}</div>
  </div>`;
}

export function gaugesBlock(g) {
  return `<div class="gauges">${['guven', 'taraftar', 'mali', 'sportif', 'itibar'].map((k) => gaugeRow(k, g[k])).join('')}</div>`;
}

// Tam ekran çerçevesi. opts: {content, nav, navActive, devam, bare}
// AÇILIŞ 1a: bare=true → TOPBAR YOK (kariyer henüz yok; takvim/kasa göstermek yalan olur)
export function shell(G, opts) {
  const { content, nav = false, navActive = 'cockpit', devam = null, bare = false } = opts;
  if (bare) return `<div class="layout"><main class="stage center">${content}</main></div>`;
  const m = G.meta;
  // T2-2e: kasa/borç değişimi mini delta rozeti (2sn görünür) + hafta pulse
  let kasaD = '', borcD = '';
  if (G.economy) {
    const pk = G._uiPrevKasa, pb = G._uiPrevBorc;
    if (pk != null && Math.abs(G.economy.kasa - pk) >= 0.5) {
      const d = G.economy.kasa - pk;
      kasaD = `<span class="delta-rozet ${d > 0 ? 'arti' : 'eksi'}">${d > 0 ? '+' : ''}${fmt(d)}mn</span>`;
    }
    if (pb != null && Math.abs(G.economy.borc - pb) >= 0.5) {
      const d = G.economy.borc - pb;
      borcD = `<span class="delta-rozet ${d < 0 ? 'arti' : 'eksi'}">${d > 0 ? '+' : ''}${fmt(d)}mn</span>`;
    }
    G._uiPrevKasa = G.economy.kasa; G._uiPrevBorc = G.economy.borc;
  }
  const haftaPulse = G._uiPrevWeek != null && G._uiPrevWeek !== m.week ? 'hafta-pulse' : '';
  G._uiPrevWeek = m.week;
  // Topbar = 3B yayın bandı: arma jetonu + kulüp adı, LED sezon plakası, kasa/borç plakaları
  const money = G.economy ? `<div class="money">
      <span class="tb-plate kasa"><i>KASA</i><b class="tnum">${fmt(G.economy.kasa)}mn${kasaD}</b></span>
      <span class="tb-plate borc"><i>BORÇ</i><b class="tnum">${fmt(G.economy.borc)}mn${borcD}</b></span>
      ${G.mode === 'aile' ? `<span class="tb-plate servet" title="Aile serveti — kulüp açıkları buradan kapanır; biterse iflas"><i>SERVET</i><b class="tnum">${fmt(G.servet ?? 0)}mn</b></span>` : ''}
    </div>` : '';
  const top = `<div class="topbar">
    <span class="crest tb-crest"><i class="tb-arma">${esc((G.club?.name || 'S')[0])}</i><b>${esc(G.club?.name || 'SAYIN BAŞKAN')}</b></span>
    <span class="meta tnum tb-sezon ${haftaPulse}">Sezon ${m.season} · ${(G.hazirlik || 0) > 0 ? 'Hazırlık' : 'Hafta ' + Math.min(m.week, G.SEASON_WEEKS)} · Dönem ${m.term}</span>
    ${(G.lig || 1) === 2 ? '<span class="tb-lig2">2. LİG</span>' : ''}
    ${money}
  </div>`;

  const navBtn = (id, label) => `<button data-act="nav" data-arg="${id}" class="${navActive === id ? 'on' : ''}"><span class="ic">${NAV_ICON[id] || ''}</span><span class="lb">${label}</span></button>`;
  const ioBtn = (act, icon, label, extra = '') => `<button data-act="${act}" class="io" ${extra}><span class="ic">${icon}</span><span class="lb">${label}</span></button>`;
  const navHtml = nav ? `<nav class="nav">
    ${navBtn('cockpit', 'Kokpit')}
    ${navBtn('kadro', 'Kadro')}
    ${navBtn('transfer', 'Transfer' + (G.transferWindow ? ' <span class="badge">•</span>' : ''))}
    ${navBtn('tesis', 'Tesisler')}
    ${navBtn('finans', 'Finans')}
    ${navBtn('medya', 'Medya')}
    ${navBtn('kongre', 'Kongre')}
    ${navBtn('veri', 'Veri')}
    ${navBtn('kulup', 'Kulüp')}
    ${navBtn('inbox', 'Inbox' + inboxBadge(G))}
    <span class="sp"></span>
    <div class="nav-foot">
      ${ioBtn('sndToggle', UI_ICON.ses, 'Ses', 'aria-label="Sesi aç/kapat"')}
      ${ioBtn('ayarlar', UI_ICON.ayar, 'Ayarlar', 'aria-label="Ayarlar"')}
      ${G.mode === 'ironman'
    ? `<span class="io" style="opacity:.6" title="Geri Adım Yok: tek yaşam — manuel kayıt/yükleme kapalı"><span class="ic">${UI_ICON.lock}</span><span class="lb">Geri Adım Yok</span></span>`
    : `${ioBtn('save', UI_ICON.save, 'Kaydet')}${ioBtn('load', UI_ICON.load, 'Yükle')}`}
    </div>
  </nav>` : '';

  // SABİT ALT AKSİYON ŞERİDİ: sol = hafta bilgisi + fısıltı/uyarı, sağ = CTA (havada durmaz)
  const devamHtml = devam ? `<div class="devam-wrap">
    <div class="devam-info">
      ${G.meta ? `<span class="devam-hafta tnum">Sezon ${G.meta.season} · ${(G.hazirlik || 0) > 0 ? 'Hazırlık' : 'Hafta ' + Math.min(G.meta.week, G.SEASON_WEEKS || 34)} · Dönem ${G.meta.term}</span>` : ''}
      ${devam.sub ? `<span class="muted devam-sub">${esc(devam.sub)}</span>` : ''}
    </div>
    <button class="devam ${devam.pulse ? 'pulse' : ''}" data-act="devam" ${devam.disabled ? 'disabled' : ''}>${devam.label || 'DEVAM ►'}</button>
  </div>` : '';

  return `${top}<div class="layout">${navHtml}<main class="stage ${opts.center ? 'center' : ''}">${content}</main></div>${devamHtml}`;
}

function inboxBadge(G) {
  const n = (G.inbox || []).filter((x) => x.action && !x.resolved).length;
  return n ? ` <span class="badge">${n}</span>` : '';
}
