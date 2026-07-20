// src/ui/cockpit.js — Kokpit "KOMUTA MASASI" (radikal yeniden tasarım):
// katmanlı derinlik + sinematik fikstür + INBOX SOLDA. 3 kolon: Inbox · Komuta · Lig.
// ui/ SADECE state okur; mutasyon actions.js üzerinden (data-act ile main yönlendirir).
// Not: yaprak bileşenler (gauge/tablo/inbox/vaat) korunur; radikallik DÜZEN + DERİNLİK katmanında.
import { TUNING } from '../config.js';
import { standings } from '../engines/league.js';
import { absHafta } from '../engines/ozel.js';
import { esc, gaugesBlock, fmt } from './frame.js';
import { isCriticalWeek, relWord, promiseStatus, powerCtx } from '../actions.js';
import { temelBilesenler } from '../engines/power.js';
import { DESK_CARDS } from '../engines/director.js';
import { oppColor, clubPalette, rawClubColor } from './theme.js';
import { rail as inboxRail, itemActions } from './inbox.js';

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

  return sbShell(G, {
    crumb: `KOKPİT · SEZON ${G.meta.season} · ${hazir ? 'HAZIRLIK DÖNEMİ' : 'Hafta ' + Math.min(G.meta.week, G.SEASON_WEEKS)}`,
    title: 'Başkanlık Masası',
    body: `
      ${sbPower(G, p)}
      <div class="sb-kok-grid">
        <div class="sb-kok-col">
          ${sbFixtureCard(G, next, meRow, myC, oc)}
          ${sbDecision(G)}
        </div>
        <div class="sb-kok-col">
          ${sbGauges(G)}
          ${hazir ? '' : sbTalk(G, p, next, injured)}
          ${sbAgenda(G, next, meRow, injured)}
        </div>
        <div class="sb-kok-col">
          ${sbTable(G)}
        </div>
      </div>`,
  }) + (G.ligDetay ? ligModal(G, table) : '');
}

// ═══════════════════════════════════════════════════════════════════
// SB KABUK — Claude Design görsel katmanı (tam-ekran; #app'i doldurur)
// topbar + sol nav rayı + ana içerik + alt aksiyon şeridi. nav/io/devam
// mevcut data-act dispatch'ine bağlı (main.js). Diğer ekranlar hâlâ eski
// shell()'i kullanır; ekran ekran göç.
// ═══════════════════════════════════════════════════════════════════
const NAV_SB = [
  ['cockpit', 'Kokpit', '<rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/>'],
  ['kadro', 'Kadro', '<circle cx="7" cy="7" r="3"/><path d="M2 17c0-3 2.3-5 5-5s5 2 5 5"/><path d="M13 4.4a3 3 0 010 5.2"/><path d="M14 12.2c2 .5 3.4 2.3 3.4 4.8"/>'],
  ['transfer', 'Transfer', '<path d="M4 8h11l-3.2-3.2"/><path d="M16 12H5l3.2 3.2"/>'],
  ['tesis', 'Tesisler', '<rect x="4" y="3" width="12" height="14" rx="1.2"/><path d="M8 6.5h.5M11.5 6.5h.5M8 9.5h.5M11.5 9.5h.5M8 12.5h.5M11.5 12.5h.5"/>'],
  ['finans', 'Finans', '<path d="M3 3v14h14"/><path d="M6 14l3.2-3.4 2.6 1.8L17 6.5"/>'],
  ['medya', 'Medya', '<circle cx="10" cy="13.5" r="1.6"/><path d="M10 11.4V4"/><path d="M6.4 6.4a6 6 0 000 8M13.6 6.4a6 6 0 010 8"/>'],
  ['kongre', 'Kongre', '<path d="M3 7l7-4 7 4"/><path d="M4.5 7.5v7M8 7.5v7M12 7.5v7M15.5 7.5v7"/><path d="M3 16.5h14"/>'],
  ['veri', 'Veri', '<rect x="3" y="10" width="3" height="7" rx=".6"/><rect x="8.5" y="4.5" width="3" height="12.5" rx=".6"/><rect x="14" y="8" width="3" height="9" rx=".6"/>'],
  ['kulup', 'Kulüp', '<path d="M10 3l6 2v5c0 4-3 6.2-6 7-3-.8-6-3-6-7V5z"/>'],
  ['ozel', 'Özel Hayat', '<path d="M10 16.6s-5.6-3.5-7.4-6.9C1.3 7.2 3 4.6 5.6 4.6c1.8 0 3 1 4.4 2.5 1.4-1.5 2.6-2.5 4.4-2.5 2.6 0 4.3 2.6 3 5.1-1.8 3.4-7.4 6.9-7.4 6.9z"/>'],
  ['inbox', 'Inbox', '<rect x="3" y="4" width="14" height="12" rx="1.6"/><path d="M3 7l7 4 7-4"/>'],
];
const SVG_IC = (inner) => `<svg class="sb-ic" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

// ARMA — kulüp kresti (kalkan/daire/klasik) + baş harf. color: runtime tema için 'var(--club)', önizleme için hex.
export function crestSvg(style = 'kalkan', size = 'md', color = 'var(--club)', initial = 'K') {
  const txt = `<text x="10" y="13.4" text-anchor="middle" font-family="Archivo,system-ui,sans-serif" font-weight="900" font-size="9" fill="#12100a">${esc(initial)}</text>`;
  const shape = style === 'daire' ? `<circle cx="10" cy="10" r="8.6" fill="${color}"/>`
    : style === 'klasik' ? `<rect x="1.6" y="1.6" width="16.8" height="16.8" rx="3.6" fill="${color}"/>`
      : `<path d="M10 1.8l7.2 2.2v5.4c0 4.5-3.1 7.2-7.2 8.4-4.1-1.2-7.2-3.9-7.2-8.4V4z" fill="${color}"/>`;
  return `<svg class="sb-crest-svg sb-crest-${size}" viewBox="0 0 20 20" aria-hidden="true">${shape}${txt}</svg>`;
}

// Ortak sb- TOPBAR — arma + kulüp + faz çipi + kasa/borç + başkan. back: {label, act, arg?} (setup ekranları için).
// Kokpit + Sözünü Ver + göç edecek tüm ekranlar bunu paylaşır (tek doğruluk kaynağı).
// TAKIM GÜCÜ KIRILIMI (kullanıcı bulgusu 2026-07-21: "kadromu 80'lere taşıdım, hâlâ 10.'yum —
// neden?"): güç tek sayı değil, 7 bileşenli karışım. EN ZAYIF 2 halka vurgulanır ("yatırım buraya"),
// tooltip'te tam tablo — motorla TEK KAYNAK (temelBilesenler).
function gucKirilim(G) {
  let b;
  try { b = temelBilesenler(powerCtx(G)); } catch { return ''; }
  const zayif = b.slice().sort((x, y) => x.v - y.v).slice(0, 2);
  const tip = b.map((x) => `${x.ad} ${Math.round(x.v)} (pay %${Math.round(x.w * 100)})`).join(' · ');
  return `<div class="cx-guc-kirilim" data-tip="Takım gücü karışımı: ${tip}. Kadro en büyük pay ama tek başına yetmez — hoca, kimya, taktik uyumu ve tesisler de sahaya çıkar. Maç günü bu TEMELİN üstüne form, kondisyon, moral ve sakat/cezalı eksikleri ÇARPAN olarak biner (yorgun kadro sahada bedel öder, formda kadro üstüne koyar).">
    <i>GÜCÜNÜ TUTAN</i> ${zayif.map((x) => `<b>${x.ad} ${Math.round(x.v)}</b>`).join(' · ')} <span>— yatırım buraya</span>
  </div>`;
}

// Oyun içi GÜNCEL TARİH — sezon Ağustos'ta (2024+sezon) başlar, hazırlık Temmuz'da,
// 30.06.(2025+sezon)'de kapanır. Sözleşme bitişi "30.06.YYYY" ile aynı takvime oturur,
// böylece güncel gün ile sözleşme bitiş günü aynı ölçekte kıyaslanır. (Salt gösterim; RNG'ye dokunmaz.)
const SB_AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export function sbTarih(G) {
  const m = G.meta || {};
  const S = G.worldSeason ?? m.season ?? 1;
  const agustosYil = 2025 + S - 1; // sezon Ağustos'unun yılı (kapanış 30.06.(2025+S))
  let d;
  if ((G.hazirlik || 0) > 0) {
    d = new Date(Date.UTC(agustosYil, 6, 12)); // hazırlık: 12 Temmuz
  } else {
    const w = Math.min(Math.max(m.week || 1, 1), G.SEASON_WEEKS || 34);
    d = new Date(Date.UTC(agustosYil, 7, 10)); // 1. hafta = 10 Ağustos
    d.setUTCDate(d.getUTCDate() + (w - 1) * 7); // her hafta +7 gün
  }
  return `${d.getUTCDate()} ${SB_AYLAR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function sbTopbar(G, { phaseChip = null, back = null } = {}) {
  const m = G.meta || {};
  const hazir = (G.hazirlik || 0) > 0;
  const lig = (G.lig || 1) === 2 ? '2. Lig' : '1. Lig';
  const chip = phaseChip || (hazir ? `HAZIRLIK · LİGE ${G.hazirlik} HAFTA` : `HAFTA ${Math.min(m.week, G.SEASON_WEEKS)} · ${lig}`);
  const backBtn = back ? `<button class="sb-back" data-act="${back.act}"${back.arg ? ` data-arg="${esc(back.arg)}"` : ''}>${esc(back.label)}</button>` : '';
  return `<header class="sb-topbar">
    ${backBtn}
    ${crestSvg(G.club?.arma, 'md', 'var(--club)', (G.club?.name || 'S')[0])}
    <div class="sb-brand"><span class="sb-brand-name">${esc(G.club?.name || 'SAYIN BAŞKAN')}${(G.career?.titles || 0) > 0 ? `<span class="sb-yildizlar" data-tip="Senin dönemindeki şampiyonluklar: ${G.career.titles}">${'⭐'.repeat(Math.min(3, G.career.titles))}${G.career.titles > 3 ? '×' + G.career.titles : ''}</span>` : ''}</span><span class="sb-brand-sub">${lig}${G.club?.city ? ' · ' + esc(G.club.city) : ''}</span></div>
    <span class="sb-divider"></span>
    <span class="sb-chip sb-chip-club"><i class="sb-dot-live"></i>${chip}</span>
    <span class="sb-chip sb-chip-tarih" data-tip="Oyun içi güncel tarih — sözleşme bitişleri (30.06.YYYY) bu takvime göredir"><svg viewBox="0 0 20 20" class="sb-cal-svg" width="12" height="12" aria-hidden="true"><rect x="3" y="4.5" width="14" height="12.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 8.5h14M7 2.5v3.4M13 2.5v3.4" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>${sbTarih(G)}</span>
    <span class="sb-spacer"></span>
    <span class="sb-pill sb-pill-pos"><b>KASA</b><span>${fmt(G.economy.kasa)}mn</span></span>
    <span class="sb-pill sb-pill-neg"><b>BORÇ</b><span>${fmt(G.economy.borc)}mn</span></span>
    ${G.mode === 'aile' ? `<span class="sb-pill sb-pill-pos" title="Aile serveti"><b>SERVET</b><span>${fmt(G.servet ?? 0)}mn</span></span>` : ''}
    <span class="sb-divider"></span>
    <span class="sb-avatar"></span>
    <div class="sb-brand"><span class="sb-brand-name sb-fs-body">${esc(G.baskan?.name || 'Sayın Başkan')}</span><span class="sb-brand-sub">Kulüp Başkanı · ${m.term}. Dönem</span></div>
  </header>`;
}

export function sbShell(G, { crumb, title, body }) {
  const hazir = (G.hazirlik || 0) > 0;
  const inboxN = (G.inbox || []).filter((x) => x.action && !x.resolved).length;
  // ÖZEL HAYAT sinyali: ikilem bekliyor VEYA bir davetin takvimi BU HAFTA açıldı (cd tam bitti)
  const ozAbs = absHafta(G);
  const ozSinyal = !!(G.ozel?.olay || Object.values(G.ozel?.davetCd || {}).some((v) => v === ozAbs));
  const navItems = NAV_SB.map(([id, label, ic]) => {
    const active = (G.nav || 'cockpit') === id;
    const badge = id === 'inbox' && inboxN ? `<span class="sb-nav-badge">${inboxN}</span>`
      : id === 'transfer' && G.transferWindow ? '<span class="sb-nav-dot"></span>'
        : id === 'ozel' && ozSinyal ? '<span class="sb-nav-dot"></span>' : ''; // ikilem bekliyor / davet takvimi açıldı
    return `<button class="sb-nav ${active ? 'is-active' : ''}" data-act="nav" data-arg="${id}">${SVG_IC(ic)}<span>${label}</span>${badge}</button>`;
  }).join('');
  const io = G.mode === 'ironman'
    ? `<button class="sb-io" data-act="sndToggle">${SVG_IC('<path d="M4 8v4h3l4 3V5L7 8H4z"/>')}<span>Ses</span></button><button class="sb-io" data-act="ayarlar">${SVG_IC('<circle cx="10" cy="10" r="2.4"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2"/>')}<span>Ayarlar</span></button>`
    : `<button class="sb-io" data-act="sndToggle">${SVG_IC('<path d="M4 8v4h3l4 3V5L7 8H4z"/>')}<span>Ses</span></button>
       <button class="sb-io" data-act="ayarlar">${SVG_IC('<circle cx="10" cy="10" r="2.4"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2"/>')}<span>Ayarlar</span></button>
       <button class="sb-io" data-act="save">${SVG_IC('<path d="M4 4h9l3 3v9H4z"/><path d="M7 4v4h6"/>')}<span>Kaydet</span></button>
       <button class="sb-io" data-act="load">${SVG_IC('<path d="M3 6h5l2 2h7v8H3z"/>')}<span>Yükle</span></button>`;
  const goalPct = Math.max(4, Math.min(100, Math.round((19 - (G.myPos ?? G.club.hedefSira)) / 18 * 100)));
  const devamLbl = hazir ? (G.hazirlik === 1 ? 'Sezonu Başlat' : `Hazırlık Haftası`) : 'Sonraki Maç';
  const bbNote = hazir ? 'Transfer dönemi — kadronu kur, maçlar sonra' : `Lig ${G.myPos ? G.myPos + '.' : '—'} · hedef ${G.club.hedefSira}. · güven %${Math.round(G.gauges.guven)}`;
  const bbBadge = hazir ? `<b class="sb-btn-badge">LİGE ${G.hazirlik}</b>` : '';
  return `<div class="sb-root">
    <div class="sb-atmo"></div><div class="sb-vignette"></div>
    ${sbTopbar(G)}
    <div class="sb-body">
      <nav class="sb-rail">
        <div class="sb-nav-list">${navItems}</div>
        <div class="sb-rail-io">${io}</div>
        <div class="sb-goal">
          <div class="sb-goal-k">SEZON HEDEFİ</div>
          <div class="sb-goal-t">${esc(hedefMetni(G.club.hedefSira))}</div>
          <div class="sb-bar"><span class="sb-bar-fill" style="width:${goalPct}%"></span></div>
          <div class="sb-goal-m">Beklenti: <b>${G.club.hedefSira}. sıra</b></div>
        </div>
      </nav>
      <main class="sb-main">
        <div class="sb-crumb">${esc(crumb)}</div>
        <div class="sb-h1row"><h1 class="sb-h1">${esc(title)}</h1><span class="sb-h1-underline"></span></div>
        ${body}
      </main>
    </div>
    <footer class="sb-bottombar">
      <div class="sb-bb-l"><span class="sb-bb-k">${hazir ? 'HAZIRLIK' : 'SEZON'}</span><span class="sb-bb-note">${esc(bbNote)}</span></div>
      <button class="sb-btn sb-btn-primary" data-act="devam">${devamLbl} ▸ ${bbBadge}</button>
    </footer>
  </div>`;
}
function hedefMetni(h) { return h <= 1 ? 'Şampiyonluk' : h <= 4 ? 'Avrupa hattı' : h <= 9 ? 'Üst yarıda bitir' : h <= 13 ? 'Ligde kal, geliş' : 'Küme hattından uzak dur'; }

// Takım gücü kompakt şeridi (hero yerine — akıllı yerleşim)
function sbPower(G, p) {
  const N = TUNING.REPORT.NEUTRAL;
  const dusus = (p.efektif || 0) < (p.temel || 0) - 9;
  const injured = G.squad.filter((x) => x.injuryWeeks > 0).length;
  const erken = G.meta.week <= 2;
  const pc = (lbl, val, warn) => `<span class="sb-pchip ${warn ? 'warn' : ''}"><i>${lbl}</i>${cap(val)}</span>`;
  return `<div class="sb-panel sb-power">
    <span class="sb-power-lbl">TAKIM GÜCÜ</span>
    <div class="sb-power-nums"><b class="sb-power-n">${Math.round(p.temel || 0)}</b><span class="sb-power-ar">→</span><b class="sb-power-n" style="color:${dusus ? 'var(--warn)' : 'var(--club)'}">${Math.round(p.efektif || 0)}</b><span class="sb-power-lbl">MAÇ GÜNÜ</span></div>
    <div class="sb-power-chips">
      ${pc('REVİR', injured === 0 ? 'sakin' : injured + ' kişi', injured > 2)}
      ${pc('MORAL', wordOf(p.moral, N.moral, ['düşük', 'orta', 'yüksek']), p.moral != null && p.moral < N.moral - 0.025)}
      ${pc('FORM', erken ? 'sezon başı' : wordOf(p.form, N.form, ['formsuz', 'dalgalı', 'formda']), !erken && p.form != null && p.form < N.form - 0.025)}
      ${pc('KONDİSYON', wordOf(p.kond, N.kond, ['bitkin', 'yorgun', 'zinde']), p.kond != null && p.kond < N.kond - 0.025)}
    </div>
    ${gucKirilim(G)}
  </div>`;
}

// Kulüp Nabzı — 4 gauge halkası (Design)
function sbGauges(G) {
  const C = 2 * Math.PI * 28; // 175.9
  const ring = (v, lbl, word) => {
    const off = (C * (1 - Math.max(0, Math.min(100, v)) / 100)).toFixed(1);
    return `<div class="sb-gauge"><div class="sb-gauge-ring"><svg viewBox="0 0 72 72"><circle class="sb-gauge-bg" cx="36" cy="36" r="28"/><circle class="sb-gauge-fg" cx="36" cy="36" r="28" transform="rotate(-90 36 36)" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off}"/></svg><span class="sb-gauge-val">${Math.round(v)}</span></div><div class="sb-gauge-l">${lbl}</div><div class="sb-gauge-n">${word}</div></div>`;
  };
  const g = G.gauges;
  const w = (v, lo, mid, hi) => (v < 40 ? lo : v < 60 ? mid : hi);
  return `<div class="sb-panel sb-gauges">
    <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">KULÜP NABZI</span></div>
    <div class="sb-gauge-row">
      ${ring(g.guven, 'GÜVEN', w(g.guven, 'kırılgan', 'temkinli', 'sağlam'))}
      ${ring(g.taraftar, 'TARAFTAR', w(g.taraftar, 'küskün', 'umutlu', 'coşkulu'))}
      ${ring(g.mali, 'MALİ', w(g.mali, 'sıkışık', 'dengede', 'rahat'))}
      ${ring(g.sportif, 'SPORTİF', w(g.sportif, 'zayıf', 'orta', 'güçlü'))}
    </div>
  </div>`;
}

// Karar Masası — GM masa kartı varsa onu, yoksa bekleyen inbox kararını, yoksa sakin durum
function sbDecision(G) {
  const gmName = G.gm?.name || 'Ferda Koyuncu';
  const desk = G.deskCard && !G.deskUsedThisTick ? DESK_CARDS[G.deskCard] : null;
  if (desk) {
    return `<div class="sb-panel sb-decision">
      <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">KARAR MASASI</span></div>
      <div class="sb-dec-role"><span class="sb-gm-av">${esc(gmName[0])}</span><div><div class="sb-gm-name">${esc(gmName)} · GM</div><div class="sb-gm-role">Masa dokunuşu</div></div></div>
      <p class="sb-dec-text">${esc(desk.desc)}</p>
      <div class="sb-dec-actions"><button class="sb-btn sb-btn-neg" data-act="desk" data-arg="gec">Geç</button><button class="sb-btn sb-btn-primary" data-act="desk" data-arg="katil">${esc(desk.label)}</button></div>
    </div>`;
  }
  const pendCount = (G.inbox || []).filter((x) => x.action && !x.resolved).length;
  const pend = (G.inbox || []).find((x) => x.action && !x.resolved);
  if (pend) {
    // Gerçek aksiyon butonları burada (Onayla/Reddet/Sat/... — inbox ile aynı) + detay için İncele.
    return `<div class="sb-panel sb-decision">
      <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">KARAR MASASI</span><span class="sb-panel-r">${pendCount > 1 ? pendCount + ' bekliyor' : 'masanda'}</span></div>
      <div class="sb-dec-role"><span class="sb-gm-av">${esc(gmName[0])}</span><div><div class="sb-gm-name">${esc(pend.t || 'Bekleyen karar')}</div><div class="sb-gm-role">imza bekliyor</div></div></div>
      <p class="sb-dec-text">${esc((pend.b || '').slice(0, 160))}</p>
      <div class="sb-dec-body">${itemActions(G, pend)}</div>
      <div class="sb-dec-foot"><button class="sb-back sb-btn-sm" data-act="nav" data-arg="inbox" style="padding:.4em .8em">İncele ▸ tam dosya${pendCount > 1 ? ` (+${pendCount - 1})` : ''}</button></div>
    </div>`;
  }
  return `<div class="sb-panel sb-decision">
    <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">KARAR MASASI</span></div>
    <div class="sb-dec-role"><span class="sb-gm-av">${esc(gmName[0])}</span><div><div class="sb-gm-name">${esc(gmName)} · GM</div><div class="sb-gm-role">masa sakin</div></div></div>
    <p class="sb-dec-text">Bekleyen imza yok, Başkanım. Dosyalar sabah masanızda olur — bu arada kulübün nabzına göz atın.</p>
  </div>`;
}

// Sonraki Maç kartı (yatay) — hazırlıkta kamp bilgisi
function sbFixtureCard(G, next, meRow, myC, oc) {
  const hazir = (G.hazirlik || 0) > 0;
  if (hazir) {
    return `<div class="sb-panel sb-fixture">
      <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">HAZIRLIK DÖNEMİ</span><span class="sb-panel-r">kamp</span></div>
      <div class="sb-fx"><div class="sb-fx-team"><span class="sb-fx-badge">${esc(G.club.name[0])}</span>${esc(G.club.name)}</div><span class="sb-fx-vs">sezona ${G.hazirlik} hafta</span><div class="sb-fx-team sb-fx-away">Transfer masası açık</div><button class="sb-btn sb-btn-primary sb-btn-sm" data-act="nav" data-arg="transfer">TRANSFER ▸</button></div>
      <div class="sb-fixture-foot">Lig hazırlık bitince başlıyor · Beklenti <b>${G.club.hedefSira}.</b> sıra</div>
    </div>`;
  }
  if (!next) {
    return `<div class="sb-panel sb-fixture"><div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">SONRAKİ MAÇ</span></div><div class="sb-dec-text">Sezon tamamlandı.</div></div>`;
  }
  return `<div class="sb-panel sb-fixture">
    <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">SONRAKİ MAÇ</span>${next.isDerby ? '<span class="sb-panel-r" style="color:var(--warn)">DERBİ</span>' : ''}</div>
    <div class="sb-fx">
      <div class="sb-fx-team"><span class="sb-fx-badge">${esc(G.club.name[0])}</span>${esc(G.club.name)}</div>
      <span class="sb-fx-vs">${next.isHome ? '🏟 EV' : '✈ DEP'}</span>
      <div class="sb-fx-team sb-fx-away">${esc(next.opp)}<span class="sb-fx-badge sb-fx-badge-2">${esc(next.opp[0])}</span></div>
    </div>
    <div class="sb-odds"><span class="g" style="width:${next.pW}%"></span><span class="b" style="width:${next.pD}%"></span><span class="m" style="width:${next.pL}%"></span></div>
    <div class="sb-odds-lbl"><span class="pos">Galibiyet %${next.pW}</span><span>Berabere %${next.pD}</span><span class="neg">Mağlubiyet %${next.pL}</span></div>
    <div class="sb-fixture-foot">Lig sırası <b>${meRow.rank}.</b> · ${G.season.W}G ${G.season.D}B ${G.season.L}M · hedef <b>${G.club.hedefSira}.</b>${(G.winStreak || 0) >= 2 ? ` · <b class="sb-seri" data-tip="Galibiyet serisi — kariyer rekorun: ${G.rekor?.seri || G.winStreak} maç">🔥 ${G.winStreak} maç seri${(G.winStreak >= 4 && G.winStreak === (G.rekor?.seri || 0)) ? ' — REKOR' : ''}</b>` : ''}</div>
  </div>`;
}

// Maç öncesi soyunma odası — kompakt team-talk + prim (sb-)
function sbTalk(G, p, next, injured) {
  const N = TUNING.REPORT.NEUTRAL;
  const critical = isCriticalWeek(G);
  const oppWord = next ? (next.pW - next.pL >= 15 ? 'zayıf' : next.pL - next.pW >= 35 ? 'dev gibi' : next.pL - next.pW >= 15 ? 'güçlü' : 'denk') : '—';
  const kondW = wordOf(p.kond, N.kond, ['bitkin', 'yorgun', 'zinde']);
  const tb = (id, ic, lbl) => { const on = id === 'off' ? !G.telkin : G.telkin === id; return `<button class="sb-talk-btn ${on ? 'on' : ''}" data-act="telkin" data-arg="${id}"><span class="sb-talk-ic">${ic}</span>${lbl}</button>`; };
  const PM = TUNING.PRIM.MAC;
  const primTip = { yok: 'Prim yok — kasa korunur', normal: `Bu maç: moral +${PM.normal.moral} · form +${PM.normal.form} · kimya +${PM.normal.kimya} (−${PM.normal.cost}mn) — kazanırsan izi kalır`, yuksek: `Bu maç: moral +${PM.yuksek.moral} · form +${PM.yuksek.form} · kimya +${PM.yuksek.kimya} (−${PM.yuksek.cost}mn) — kazanırsan izi BÜYÜK kalır` };
  const pb = (id, lbl, cls = '') => `<button class="sb-prim-btn ${cls} ${G.matchPrim === id ? 'on' : ''}" data-act="prim" data-arg="${id}" data-tip="${primTip[id] || ''}">${lbl}</button>`;
  const ozel = G.ozelUsed ? '<button class="sb-prim-btn" disabled>⚡ kullanıldı</button>'
    : critical ? `<button class="sb-prim-btn ozel ${G.ozelArmed ? 'on' : ''}" data-act="ozelPrim">⚡ Özel</button>`
      : '<button class="sb-prim-btn" disabled title="Yalnız kritik/derbi">⚡ Özel</button>';
  const MPsec = PM[G.matchPrim];
  const aliskan = (G.primMacSeri || 0) > 0;
  const primEtki = MPsec
    ? `<div class="micro sb-prim-etki">💰 Prim masada: bu maç moral +${MPsec.moral} · form +${MPsec.form} · kimya +${MPsec.kimya} — galibiyette kalıcı işler${aliskan ? ' · <b style="color:var(--warn)">⚠ alışkanlık: üst üste prim etkiyi yarılıyor, arada dinlendir</b>' : ''}</div>`
    : '';
  return `<div class="sb-panel sb-talk">
    <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">MAÇ ÖNCESİ · SOYUNMA ODASI</span><span class="sb-panel-r">TD: ${relWord(G.tdRelation)}</span></div>
    <div class="sb-talk-lead">${critical ? '<b>⚡ Kritik maç.</b> ' : ''}Rakip <b>${oppWord}</b>, revir <b>${injured === 0 ? 'boş' : injured + ' kişi'}</b>, bacaklar <b>${kondW}</b>. Ne diyorsun?</div>
    <div class="sb-talk-grid">
      ${tb('tamkadro', '💪', 'Tam Kadro')}${tb('rotasyon', '🔄', 'Rotasyon')}${tb('gencler', '🌱', 'Gençler')}${tb('kale', '🛡️', 'Kaleyi Koru')}${tb('off', '🎯', 'Karışma')}
    </div>
    <div class="sb-prim-row">${pb('yok', 'Prim Yok')}${pb('normal', 'Normal')}${pb('yuksek', 'Yüksek')}${ozel}</div>
    ${primEtki}
  </div>`;
}

// Gündem — gerçek durum satırları + vaat ilerlemesi
function sbAgenda(G, next, meRow, injured) {
  const items = [];
  if ((G.hazirlik || 0) > 0) items.push(['warn', `Transfer dönemi açık — sezona ${G.hazirlik} hafta`]);
  else if (G.transferWindow) items.push(['warn', 'Transfer penceresi açık — dosyalar masada']);
  const secimSezon = TUNING.SEASONS_PER_TERM - ((G.meta.season - 1) % TUNING.SEASONS_PER_TERM);
  items.push(['info', secimSezon <= 1 ? 'Kongre bu sezon — sandık yaklaşıyor' : `Kongre ${secimSezon} sezon sonra`]);
  if (injured > 0) items.push(['neg', `Revirde ${injured} oyuncu — rotasyon düşün`]);
  // Vaat durumu — hafta ≤6'da hepsi taban (pct 10) ise "başlangıç" (riskte diye alarma geçme)
  const erkenVaat = G.meta.week <= 6;
  const vs = promiseStatus(G);
  if (vs.length && erkenVaat && vs.every((v) => v.pct <= 10)) {
    items.push(['club', `${vs.length} söz verildi — başlangıç, iş sahada`]);
  } else {
    const riskli = vs.filter((v) => v.pct > 0 && v.pct < 55 && !(erkenVaat && v.pct === 10));
    if (riskli.length) items.push(['warn', `${riskli.length} vaat riskte — "${riskli[0].name}"`]);
    const iyi = vs.filter((v) => v.pct >= 55);
    if (iyi.length) items.push(['pos', `${iyi.length} vaat yolunda`]);
  }
  if (G.ozel?.olay) items.push(['warn', 'Özel gündem bekliyor — ailede bir karar var (Özel Hayat)']); // 💗 köprü: ikilem kaçmadan
  else { // davet takvimi bu hafta açıldıysa hatırlat (nokta + gündem çifti — geri çağırma döngüsü)
    const _abs = absHafta(G);
    if (Object.values(G.ozel?.davetCd || {}).some((v) => v === _abs)) items.push(['club', 'Davet takvimi açıldı — yeni bir gece düzenlenebilir (Özel Hayat)']);
  }
  if (!next && (G.hazirlik || 0) === 0) items.push(['club', 'Sezon tamam — kongre defterini kapat']);
  while (items.length < 3) items.push(['club', 'Kulüp sakin — ibre senin elinde']);
  // #4 GELECEK 5 MAÇ ŞERİDİ — fikstür önden görünür; DERBİ haftası işaretli (hazırlık anlam kazanır)
  const besMac = (() => {
    if (!G.league?.fixtures || (G.hazirlik || 0) > 0) return '';
    const oppAd = (id) => (G.opponents || []).find((o) => o.id === id)?.name || '?';
    const seritler = [];
    for (let w = G.meta.week; w < Math.min(G.meta.week + 5, G.SEASON_WEEKS + 1); w++) {
      const round = G.league.fixtures[w - 1]; if (!round) break;
      const pair = round.find((p2) => p2.home === 'ME' || p2.away === 'ME'); if (!pair) continue;
      const ev = pair.home === 'ME', rakip = ev ? pair.away : pair.home;
      seritler.push(`<span class="sb-fx ${rakip === 'o0' ? 'derbi' : ''}" data-tip="Hafta ${w} · ${esc(oppAd(rakip))} · ${ev ? 'İÇ SAHA' : 'DEPLASMAN'}${rakip === 'o0' ? ' · DERBİ HAFTASI!' : ''}">${ev ? '🏠' : '✈'} ${esc(oppAd(rakip).split(' ')[0])}${rakip === 'o0' ? ' ⚔' : ''}</span>`);
    }
    return seritler.length ? `<div class="sb-fx-serit" data-tip="Önündeki 5 maç — ⚔ derbi">${seritler.join('<i>›</i>')}</div>` : '';
  })();
  // #7 TERFİ YARIŞI (2. Lig) — ilk 3 çizgisine uzaklık canlı
  let terfiSatir = '';
  if ((G.lig || 1) === 2 && G.league) {
    const tb = standings(G.league);
    const ben = tb.findIndex((r) => r.id === 'ME') + 1;
    const benP = tb.find((r) => r.id === 'ME')?.Pts ?? 0;
    const ucP = tb[2]?.Pts ?? 0;
    terfiSatir = `<div class="sb-terfi" data-tip="2. Lig tek hedef: ilk 3 = TERFİ. Çizgideki takım: ${esc(tb[2]?.name || '?')}">⬆ TERFİ YARIŞI · ${ben}. sıradasın · çizgiye ${ben <= 3 ? `<b class="pos">+${benP - (tb[3]?.Pts ?? 0)} puan önde</b>` : `<b class="neg">${Math.max(0, ucP - benP)} puan</b>`}</div>`;
  }
  // 🎯 SIRADAKİ HEDEF (motivasyon): en yakın kilitli başarım hep gözde — tıkla → başarım duvarı
  let hedefSatir = '';
  const achDefs = (G.data?.achievements && (G.data.achievements.achievements || G.data.achievements)) || [];
  const achU = G.achUnlocked || {};
  const siradaki = achDefs.find((d) => !achU[d.id]);
  if (siradaki) hedefSatir = `<div class="sb-agenda-i sb-hedef" data-act="nav" data-arg="kulup" data-tip="Başarım duvarına git — ${achDefs.filter((d) => achU[d.id]).length}/${achDefs.length} açık">🎯 SIRADAKİ HEDEF: <b>${esc(siradaki.name)}</b></div>`;
  // UYARLANABİLİR KAPASİTE (taşma dersi — kullanıcı raporu 2026-07-21): şerit/terfi/hedef satırları
  // yer kapladıkça madde sayısı KISILIR — panel sabit hücresinde son satır asla yarım kesilmez.
  const ekSatir = (besMac ? 1 : 0) + (terfiSatir ? 1 : 0) + (hedefSatir ? 1 : 0);
  const kap = Math.max(1, 4 - ekSatir); // 4-bazlı: şerit+hedef varken 2 madde — panel hücresi asla taşmaz
  return `<div class="sb-panel sb-agenda">
    <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">GÜNDEM</span></div>
    ${besMac}${terfiSatir}${hedefSatir}
    ${items.slice(0, kap).map(([c, t]) => `<div class="sb-agenda-i"><span class="sb-adot sb-adot-${c}"></span>${esc(t)}</div>`).join('')}
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

// Puan Durumu — kokpitte HER ZAMAN açık (18 satır flex:1 ile sığar). Terfi/küme hattı renkli.
function sbTable(G) {
  let rows = standings(G.league);
  if (rows.every((t) => t.P === 0)) rows = rows.slice().sort((a, b) => b.strength - a.strength).map((t, i) => ({ ...t, rank: i + 1 }));
  const lig = G.lig || 1;
  const body = rows.map((t) => {
    const cls = lig === 2 ? (t.rank <= 3 ? 'avr' : '') : (t.rank <= 4 ? 'avr' : t.rank >= 16 ? 'kume' : '');
    const av = (t.GD ?? (t.GF - t.GA));
    return `<div class="sb-lig-row ${t.id === 'ME' ? 'is-us' : ''}"><span class="sb-lig-pos ${cls}">${t.rank}</span><span class="sb-lig-name">${esc(t.name)}</span><span class="sb-lig-num" style="color:${av > 0 ? 'var(--pos)' : av < 0 ? 'var(--neg)' : 'var(--ink-3)'}">${av >= 0 ? '+' : ''}${av}</span><span class="sb-lig-num sb-lig-pts">${t.Pts}</span></div>`;
  }).join('');
  return `<div class="sb-panel sb-stand">
    <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">PUAN DURUMU</span><button class="sb-back sb-btn-sm" data-act="ligDetay" style="padding:.2em .6em;margin-left:auto">detay ▸</button></div>
    <div class="sb-lig-head"><span>#</span><span>Takım</span><span>AV</span><span>P</span></div>
    <div class="sb-lig-list">${body}</div>
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
