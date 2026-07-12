// src/ui/cockpit.js — Kokpit "KOMUTA MASASI" (radikal yeniden tasarım):
// katmanlı derinlik + sinematik fikstür + INBOX SOLDA. 3 kolon: Inbox · Komuta · Lig.
// ui/ SADECE state okur; mutasyon actions.js üzerinden (data-act ile main yönlendirir).
// Not: yaprak bileşenler (gauge/tablo/inbox/vaat) korunur; radikallik DÜZEN + DERİNLİK katmanında.
import { TUNING } from '../config.js';
import { standings } from '../engines/league.js';
import { esc, gaugesBlock } from './frame.js';
import { isCriticalWeek, relWord, promiseStatus } from '../actions.js';
import { DESK_CARDS } from '../engines/director.js';
import { oppColor, clubPalette, rawClubColor } from './theme.js';
import { rail as inboxRail } from './inbox.js';

export function render(G) {
  const table = standings(G.league);
  const meRow = table.find((t) => t.id === 'ME');
  const next = nextMatch(G, table);
  const p = G.power || {};
  const N = TUNING.REPORT.NEUTRAL;
  const injured = G.squad.filter((x) => x.injuryWeeks > 0).length;
  const erken = G.meta.week <= 2; // sezonun ilk 2 haftası: form henüz konuşmaz
  const chipCls = (v, n) => (v != null && v < n - 0.025 ? 'cx-chip cx-chip--warn' : 'cx-chip');

  // ═══ TAKIM GÜCÜ — BAĞIRAN hero ═══
  // Harf disiplini: çip etiketi BÜYÜK mikro, değeri Büyük harfle başlar (tr-TR).
  const chip = (cls, lbl, val) => `<span class="${cls}"><i>${lbl}</i><b>${cap(val)}</b></span>`;
  const gucChips = `<div class="cx-chips">
    ${chip(injured > 2 ? 'cx-chip cx-chip--warn' : 'cx-chip', 'REVİR', injured === 0 ? 'sakin' : injured + ' kişi')}
    ${chip(chipCls(p.moral, N.moral), 'MORAL', wordOf(p.moral, N.moral, ['düşük', 'orta', 'yüksek']))}
    ${chip(erken ? 'cx-chip' : chipCls(p.form, N.form), 'FORM', erken ? 'sezon başı' : wordOf(p.form, N.form, ['formsuz', 'dalgalı', 'formda']))}
    ${chip(chipCls(p.kond, N.kond), 'KONDİSYON', wordOf(p.kond, N.kond, ['bitkin', 'yorgun', 'zinde']))}
  </div>`;
  // Rapor SÜREKLİ açık (tık gerekmez) — GM'in haftalık notu her zaman görünür.
  const report = G.lastReport
    ? `<div class="cx-report"><span class="cx-report-ic">📋</span><span>${esc(G.lastReport.text)} <i>— Genel Menajer</i></span></div>` : '';
  const dusus = (p.efektif || 0) < (p.temel || 0) - 9;
  const gucPanel = `<div class="cx-panel cx-guc">
    <div class="cx-panel-head"><span class="overline">Takım Gücü</span></div>
    <div class="cx-guc-nums">
      <span class="cx-guc-blok"><b class="cx-guc-n led">${Math.round(p.temel || 0)}</b><i>TEMEL</i></span>
      <span class="cx-guc-ar">→</span>
      <span class="cx-guc-blok"><b class="cx-guc-n led" style="color:${dusus ? 'var(--warn)' : 'var(--club-2)'}">${Math.round(p.efektif || 0)}</b><i>MAÇ GÜNÜ</i></span>
    </div>
    ${gucChips}
    ${report}
  </div>`;

  // ═══ GÖSTERGELER ═══
  const gaugesPanel = `<div class="cx-panel cx-gauges-panel">
    <div class="cx-panel-head"><span class="overline">Göstergeler</span></div>
    ${gaugesBlock(G.gauges)}
  </div>`;

  // ═══ SONRAKİ MAÇ — sinematik fikstür (kabartma armalar, ışık huzmesi) ═══
  const oc = next ? oppColor(G, next.opp) : 'var(--ink-3)';
  const myC = clubPalette(rawClubColor(G)).club;
  const hazir = (G.hazirlik || 0) > 0;
  const fixture = hazir ? `<div class="cx-panel cx-fixture cx-hazirlik-panel">
    <div class="cx-fixture-glow"></div>
    <div class="cx-panel-head"><span class="overline">Hazırlık Dönemi</span><span class="cx-derby-badge cx-kamp-badge">KAMP</span></div>
    <div class="cx-hazirlik-in">
      <span class="cx-hazirlik-ico">🏕️</span>
      <div class="cx-hazirlik-txt"><b>Sezona ${G.hazirlik} hafta</b><span>Transfer masası açık — kadronu kur, eksikleri kapat. Lig hazırlık bitince başlıyor.</span></div>
    </div>
    <div class="cx-hazirlik-adim">
      <span class="${G.transferWindow ? 'on' : ''}">⇄ Transfer masası</span>
      <span>🎙 Basın</span>
      <span>🏋 Kamp</span>
    </div>
    <div class="cx-fixture-foot">Sezon henüz başlamadı · Beklenti <b>${G.club.hedefSira}.</b> sıra</div>
  </div>` : `<div class="cx-panel cx-fixture ${next && next.isDerby ? 'cx-derby' : ''}">
    <div class="cx-fixture-glow"></div>
    <div class="cx-panel-head"><span class="overline">Sonraki Maç</span>${next && next.isDerby ? '<span class="cx-derby-badge">DERBİ</span>' : ''}</div>
    ${next ? `<div class="cx-vs">
      <div class="cx-side">
        <span class="cx-crest" style="--cc:${myC}">${esc(G.club.name[0])}</span>
        <span class="cx-team">${esc(G.club.name)}</span>
      </div>
      <div class="cx-mid">
        <span class="cx-vs-txt">VS</span>
        <span class="cx-venue">${next.isHome ? '🏟 EV' : '✈ DEPLASMAN'}</span>
      </div>
      <div class="cx-side">
        <span class="cx-crest" style="--cc:${oc}">${esc(next.opp[0])}</span>
        <span class="cx-team">${esc(next.opp)}</span>
      </div>
    </div>
    <div class="cx-odds" title="G %${next.pW} · B %${next.pD} · M %${next.pL}">
      <span class="g" style="width:${next.pW}%"></span><span class="b" style="width:${next.pD}%"></span><span class="m" style="width:${next.pL}%"></span>
    </div>
    <div class="cx-odds-lbl"><span class="pos">Galibiyet %${next.pW}</span><span>Berabere %${next.pD}</span><span class="neg">Mağlubiyet %${next.pL}</span></div>`
    : '<div class="muted" style="margin-top:10px">Sezon tamamlandı.</div>'}
    <div class="cx-fixture-foot">Lig sırası <b class="tnum">${meRow.rank}.</b> · ${G.season.W}G ${G.season.D}B ${G.season.L}M · Hedef <b>${G.club.hedefSira}.</b></div>
  </div>`;

  // ═══ MAÇ ÖNCESİ · SOYUNMA ODASI — "team talk" sekansı (ikon + etki fısıltısı) ═══
  const critical = isCriticalWeek(G);
  const oppWord = next ? (next.pW - next.pL >= 15 ? 'zayıf' : next.pL - next.pW >= 35 ? 'dev gibi' : next.pL - next.pW >= 15 ? 'güçlü' : 'denk') : '—';
  const kondW = wordOf(p.kond, N.kond, ['bitkin', 'yorgun', 'zinde']);
  // team-talk kartı: seçili = altın kabartma; her biri etkisini fısıldar (mekanikle hizalı)
  const talk = (id, icon, label, hint) => {
    const on = id === 'off' ? !G.telkin : G.telkin === id;
    return `<button class="cx-talk ${on ? 'on' : ''}" data-act="telkin" data-arg="${id}">
      <span class="cx-talk-ic">${icon}</span><span class="cx-talk-nm">${label}</span><span class="cx-talk-hint">${hint}</span>
    </button>`;
  };
  const prim = (id, label, hint) => `<button class="cx-prim ${G.matchPrim === id ? 'on' : ''}" data-act="prim" data-arg="${id}">
    <span class="cx-prim-nm">${label}</span><span class="cx-prim-hint">${hint}</span></button>`;
  const ozelBtn = G.ozelUsed
    ? '<button class="cx-prim" disabled><span class="cx-prim-nm">Özel Prim</span><span class="cx-prim-hint">kullanıldı</span></button>'
    : critical
      ? `<button class="cx-prim cx-prim--ozel ${G.ozelArmed ? 'on' : ''}" data-act="ozelPrim"><span class="cx-prim-nm">⚡ Özel Prim</span><span class="cx-prim-hint">tek atış · 1/sezon</span></button>`
      : '<button class="cx-prim" disabled title="Yalnız kritik/derbi maçta"><span class="cx-prim-nm">⚡ Özel Prim</span><span class="cx-prim-hint">derbiye sakla</span></button>';
  const prep = `<div class="cx-panel cx-prep">
    <div class="cx-panel-head"><span class="overline">Maç Öncesi · Soyunma Odası</span><span class="cx-hint">TD ilişkisi: ${relWord(G.tdRelation)}</span></div>
    <div class="cx-prep-lead">${critical ? '<b class="cx-krit">⚡ Kritik maç.</b> ' : ''}Rakip <b>${oppWord}</b>, revir <b>${injured === 0 ? 'boş' : injured + ' kişi'}</b>, bacaklar <b>${kondW}</b>. Ekibe ne diyorsun, Başkanım?</div>
    <div class="cx-talk-grid">
      ${talk('tamkadro', '💪', 'Tam Kadro', 'En güçlü 11 · güç ↑, yorgunluk riski')}
      ${talk('rotasyon', '🔄', 'Rotasyon', 'Yükü böl · kondisyon toparlar')}
      ${talk('gencler', '🌱', 'Gençlere Şans', 'Gelişim ↑ · sonuç riski')}
      ${talk('kale', '🛡️', 'Kaleyi Koruyalım', 'Az gol ye · hücum kısılır')}
      ${talk('off', '🎯', 'Karışma', "TD'ye güven · müdahale yok")}
    </div>
    <div class="cx-sub">Maç Primi</div>
    <div class="cx-prim-row">
      ${prim('yok', 'Yok', 'kasa korunur')}${prim('normal', 'Normal', 'her maç · kasa ↓')}${prim('yuksek', 'Yüksek', 'motivasyon ↑↑ · kasa ↓↓')}${ozelBtn}
    </div>
    ${G.deskCard && !G.deskUsedThisTick ? `<div class="cx-desk-row">
      <span class="cx-desk-lbl">BUGÜNÜN DOKUNUŞU</span>
      <span class="cx-desk-txt">${esc(DESK_CARDS[G.deskCard].desc)}</span>
      <button class="cx-btn" data-act="desk">${esc(DESK_CARDS[G.deskCard].label)}</button>
    </div>` : ''}
  </div>`;
  const desk = ''; // ayrı panel kaldırıldı — soyunma odasına şerit olarak gömüldü (SIĞMA garantisi)

  // ═══ PUAN TABLOSU (tam 18) — tıkla → detaylı tablo (modal) ═══
  const leaguePanel = `<div class="cx-panel cx-league" data-act="ligDetay">
    <div class="cx-panel-head"><span class="overline">Puan Tablosu</span><span class="cx-hint">${G.leagueNews ? '📰 gündem · ' : ''}detay için tıkla ⤢</span></div>
    <div class="mini-league cx-mini">${fullTable(G, table)}</div>
    ${G.leagueNews ? `<div class="cx-lig-haber">📰 ${esc(G.leagueNews)}</div>` : ''}
  </div>`;

  // ═══ VAAT ŞERİDİ ═══
  const vaatler = promiseStatus(G);
  const vaatPanel = vaatler.length ? `<div class="cx-panel cx-vaat">
    <div class="cx-panel-head"><span class="overline">Vaat Şeridi</span></div>
    ${vaatler.slice(0, 3).map((v) => {
    const baslangic = G.meta.week <= 6 && v.pct === 10;
    const renk = baslangic ? 'var(--ink-2)' : v.pct >= 55 ? 'var(--pos)' : v.pct > 0 ? 'var(--warn)' : 'var(--neg)';
    const durum = baslangic ? 'başlangıç' : v.pct >= 55 ? 'yolunda' : v.pct > 0 ? 'riskte' : 'tehlikede';
    return `<div class="cx-vaat-row"><div class="cx-vaat-top"><span>${esc(v.name)}</span><span style="color:${renk}">${durum}</span></div>
      <div class="cx-vaat-track"><div style="width:${v.pct}%;background:${renk}"></div></div></div>`;
  }).join('')}
  </div>` : '';

  // ═══ SOSYAL NABIZ — tweet akışı (kullanıcı adı + @handle + etkileşim) ═══
  const clubTag = String(G.club.name || '').replace(/\s+/g, '');
  const socialPanel = (G.socialFeed && G.socialFeed.length) ? `<div class="cx-panel cx-social">
    <div class="cx-panel-head"><span class="overline">Sosyal Nabız</span><span class="cx-hint">#${esc(clubTag)}</span></div>
    ${G.socialFeed.slice(0, 2).map((x, i) => tweet(x, i)).join('')}
  </div>` : '';

  // AÇILIŞ 5a: ilk kokpit — gauge halkaları 0→değere dolar (tek sefer)
  const ilk = G._ilkKokpit; if (ilk) G._ilkKokpit = false;

  // 3 KOLON: [Inbox SOLDA] · [Komuta masası] · [Lig]
  return `<div class="cx-desk-wrap ${ilk ? 'ilk-kokpit' : ''}">
    ${inboxRail(G)}
    <section class="cx-col cx-col-main">
      <div class="cx-hero-row">${gucPanel}${gaugesPanel}</div>
      ${fixture}
      ${prep}
      ${desk}
    </section>
    <aside class="cx-col cx-col-league">
      ${leaguePanel}
      ${vaatPanel}
      ${socialPanel}
    </aside>
    ${G.ligDetay ? ligModal(G, table) : ''}
  </div>`;
}

// Detaylı puan tablosu — tam istatistik (O G B M A Y Av P). Modal overlay; dışına/✕ tıkla → kapan.
function ligModal(G, table) {
  let rows = table;
  if (rows.every((t) => t.P === 0)) {
    rows = rows.slice().sort((a, b) => b.strength - a.strength).map((t, i) => ({ ...t, rank: i + 1 }));
  }
  const lig = G.lig || 1;
  const ligAd = lig === 2 ? '2. Lig' : (G.club.leagueName || 'Süper Lig');
  const body = rows.map((t) => {
    // 2. ligde ilk 3 = terfi (yeşil), küme yok; üst ligde Avrupa (1-4) / küme (16-18)
    const hat = lig === 2 ? (t.rank <= 3 ? 'avr' : '') : (t.rank <= 4 ? 'avr' : t.rank >= 16 ? 'kume' : '');
    const av = (t.GF - t.GA);
    return `<tr class="${t.id === 'ME' ? 'me' : ''}">
      <td class="r"><span class="lig-sira ${hat}">${t.rank}</span></td>
      <td class="nm">${esc(t.name)}</td>
      <td class="tnum">${t.P}</td>
      <td class="tnum pos-c">${t.W}</td><td class="tnum">${t.D}</td><td class="tnum neg-c">${t.L}</td>
      <td class="tnum">${t.GF}</td><td class="tnum">${t.GA}</td>
      <td class="tnum" style="color:${av > 0 ? 'var(--pos)' : av < 0 ? 'var(--neg)' : 'var(--ink-2)'}">${av >= 0 ? '+' : ''}${av}</td>
      <td class="tnum pts">${t.Pts}</td>
    </tr>`;
  }).join('');
  return `<div class="lig-modal" data-act="ligDetay">
    <div class="lig-modal-card" data-act="noop">
      <div class="lig-modal-head">
        <div><span class="overline">${esc(ligAd)} · Puan Durumu</span>
          <div class="muted" style="font-size:12px;margin-top:2px">Sezon ${G.meta.season} · Hafta ${Math.min(G.meta.week, G.SEASON_WEEKS)}</div></div>
        <button class="lig-kapat" data-act="ligDetay" aria-label="Kapat">✕</button>
      </div>
      <div class="lig-tablo-wrap">
        <table class="lig-tablo">
          <thead><tr>
            <th class="r">#</th><th class="nm">Takım</th>
            <th data-tip="Oynanan">O</th><th data-tip="Galibiyet">G</th><th data-tip="Beraberlik">B</th><th data-tip="Mağlubiyet">M</th>
            <th data-tip="Attığı gol">A</th><th data-tip="Yediği gol">Y</th><th data-tip="Averaj">Av</th><th class="pts" data-tip="Puan">P</th>
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <div class="lig-legend">
        ${(G.lig || 1) === 2
    ? '<span><i class="dot avr"></i> Terfi hattı (1–3)</span>'
    : '<span><i class="dot avr"></i> Avrupa (1–4)</span><span><i class="dot kume"></i> Küme hattı (16–18)</span>'}
        <span class="muted" style="margin-left:auto">boş alana veya ✕'e tıkla → kapat</span>
      </div>
    </div>
  </div>`;
}

// B6d+AÇILIŞ 5d: kelime eşiği metriğin NÖTR değerine (REPORT.NEUTRAL) hizalı.
function wordOf(v, neutral, [low, mid, high]) {
  if (v == null) return '—';
  return v < neutral - 0.025 ? low : v > neutral + 0.025 ? high : mid;
}

// Türkçe baş harf büyütme (i→İ doğru) — çip değerleri "Büyük harfle" başlar
function cap(s) {
  s = String(s ?? '');
  return s ? s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1) : s;
}

// ── Sosyal nabız: tweet kimliği metinden türetilir (deterministik → render-güvenli) ──
const TW_PERSONA = [
  { n: 'Tribün Sesi', h: 'tribunsesi' }, { n: '12. Adam', h: 'onikinci_adam' },
  { n: 'Kombine Delisi', h: 'kombine11' }, { n: 'Kale Arkası', h: 'kalearkasi' },
  { n: 'Maraton Üst', h: 'maraton_ust' }, { n: 'Saha Kenarı', h: 'sahakenari_' },
  { n: 'Forma Aşkı', h: 'forma_aski' }, { n: 'Amigo Reis', h: 'amigoreis' },
  { n: 'Sadece Futbol', h: 'sadecefutbol' }, { n: 'Statçı Baba', h: 'statci_baba' },
];
const TW_AVA = ['var(--club)', 'var(--info)', 'var(--pos)', '#8a7fd0', '#d0808f', '#5bb6c7'];
function _hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }
function tweet(post, i) {
  const clean = String(post.text || '').replace(/\s*\[TREND\]\s*/g, '').trim();
  const hh = _hash(clean + '#' + i);
  const who = TW_PERSONA[hh % TW_PERSONA.length];
  const col = TW_AVA[(hh >>> 4) % TW_AVA.length]; // >>> işaretsiz: hash 2^31 üstündeyse >> negatif indeks üretir → undefined renk
  const likes = 8 + (hh % 620), rt = hh % 120, rep = hh % 45;
  const zaman = ['az önce', '2 dk', '6 dk', '14 dk', '31 dk'][i % 5];
  const kfmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'B' : String(n));
  return `<div class="tweet ${post.viral ? 'tweet--viral' : ''}">
    <div class="tw-ava" style="--tc:${col}">${esc(who.n[0])}</div>
    <div class="tw-body">
      <div class="tw-head"><span class="tw-name">${esc(who.n)}</span><span class="tw-handle">@${esc(who.h)}</span><span class="tw-dot">·</span><span class="tw-time">${zaman}</span>${post.viral ? '<span class="tw-trend">🔥 Trend</span>' : ''}</div>
      <div class="tw-text">${esc(clean)}</div>
      <div class="tw-acts"><span>💬 ${kfmt(rep)}</span><span>🔁 ${kfmt(rt)}</span><span class="tw-like">♥ ${kfmt(likes)}</span></div>
    </div>
  </div>`;
}

function nextMatch(G, table) {
  const wk = G.meta.week;
  if (wk > G.SEASON_WEEKS) return null;
  const round = G.league.fixtures[wk - 1];
  const m = round.find((x) => x.home === 'ME' || x.away === 'ME');
  const isHome = m.home === 'ME';
  const oppId = isHome ? m.away : m.home;
  const oppStr = G.league.table[oppId].strength;
  const eff = G.power?.temel || G.temelGuc;
  const d = (eff * (isHome ? 1.05 : 1)) - oppStr;
  // GERÇEKÇİ 3-sonuç modeli: galibiyet payı e; beraberlik dengede yüksek (~%32),
  // tek-yönlü maçta bile taban (~%19) korur; mağlubiyet kalandan düzgün ölçeklenir.
  const e = 1 / (1 + Math.pow(10, -d / 26));               // galibiyet payı 0..1
  const pD = Math.round(19 + 13 * (1 - Math.abs(2 * e - 1))); // beraberlik: 32 (denge) → 19 (uçlar)
  const pW = Math.round((100 - pD) * e);
  const pL = Math.max(0, 100 - pD - pW);
  return { opp: G.league.table[oppId].name, isHome, oppStr, pW, pD, pL, isDerby: oppId === 'o0' };
}

// §6: TAM 18 satırlık tablo — kendi satır vurgulu, 4 altı altın ayraç, 16 üstü kırmızı ayraç.
function fullTable(G, table) {
  let rows = table;
  if (rows.every((t) => t.P === 0)) {
    rows = rows.slice().sort((a, b) => b.strength - a.strength).map((t, i) => ({ ...t, rank: i + 1 }));
  }
  return rows.map((t) => {
    const satir = `<div class="row ${t.id === 'ME' ? 'me' : ''}">
      <span class="r tnum">${t.rank}</span><span>${esc(t.name)}</span>
      <span class="r tnum">${t.GD >= 0 ? '+' : ''}${t.GD}</span><span class="tnum">${t.Pts}</span>
    </div>`;
    if ((G.lig || 1) === 2) return t.rank === 3 ? satir + '<div class="hat-etiket avrupa">Terfi hattı ⬆️</div>' : satir;
    if (t.rank === 4) return satir + '<div class="hat-etiket avrupa">Avrupa hattı</div>';
    if (t.rank === 15) return satir + '<div class="hat-etiket kume">Küme hattı</div>';
    return satir;
  }).join('');
}
