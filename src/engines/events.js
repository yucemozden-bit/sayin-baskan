// src/engines/events.js — Eşik olayları (Bible-14.1)
// Sadece 4 grup deterministik olay: güven krizi(kongre), taraftar boykot,
// mali(transfer tahtası), sezon sonu küme dominosu / şampiyonluk zaferi.
// Rastgele olay havuzu MVP dışı. Katsayılar TUNING'den; engines/ DOM'a dokunmaz.

import { TUNING } from '../config.js';

const setG = (g, k, d) => { g[k] = Math.max(0, Math.min(100, g[k] + d)); };

// Her tick sonunda eşikleri kontrol et; tetiklenen olayların etkilerini uygula.
// seasonOutcome: {relegated, champion} (sezon sonu). state.flags mutasyona uğrar.
// Aktif bayrak (sayaç) varsa aynı olay tekrar tetiklenmez.
export function checkThresholdEvents(state, { relegated = false, champion = false } = {}) {
  const E = TUNING.EVENTS, TH = TUNING.THRESH, g = state.gauges;
  state.flags = state.flags || {};
  const f = state.flags;
  const ev = [];

  // Sezon sonu: şampiyonluk zaferi
  if (champion) {
    setG(g, 'itibar', E.ZAFER.itibar); setG(g, 'taraftar', E.ZAFER.taraftar);
    f.sponsorValueMult = E.ZAFER.sponsorValueMult;
    ev.push({ id: 'zafer', title: 'ŞAMPİYON!' });
  }
  // Sezon sonu: küme düşme dominosu
  if (relegated) {
    setG(g, 'itibar', E.DOMINO.itibar); setG(g, 'taraftar', E.DOMINO.taraftar);
    f.tvMult = E.DOMINO.tvMult; f.starsWantOut = true;
    ev.push({ id: 'domino', title: 'Küme düşüşü: Domino' });
  }
  // Güven krizi → kongre olağanüstü çağrı + budgetLock
  if (g.guven < TH.guvenKriz && !(f.budgetLock > 0)) {
    f.budgetLock = E.KONGRE.budgetLockTicks; setG(g, 'taraftar', E.KONGRE.taraftar);
    ev.push({ id: 'kongre', title: 'Kongre olağanüstü çağrı' });
  }
  // Taraftar boykotu
  if (g.taraftar < TH.taraftarBoykot && !(f.boykot > 0)) {
    f.boykot = E.BOYKOT.ticks;
    ev.push({ id: 'boykot', title: 'Tribün boykotu' });
  }
  // Mali kriz → transfer tahtası
  if (g.mali < TH.maliTahta && !(f.transferBan > 0)) {
    f.transferBan = E.TAHTA.banWindows;
    ev.push({ id: 'tahta', title: 'Transfer tahtası' });
  }
  return ev;
}

// ═══ D3: RASTGELE OLAY HAVUZU (Bible-14.2 + v4-§8, events.json'dan) ═══
import { rand, randint } from '../core/rng.js';

// Olay uygunluk koşulları (id → predicate). events.json trigger stringleri koda bağlanır (eval yok).
const COND = {
  'doviz-soku': () => true,
  'yildiza-dev-teklif': (G) => G.squad.some((p) => p.overall >= TUNING.STAR_THRESHOLD),
  'kombine-indir': () => true,
  'genc-patladi': (G) => G.squad.some((p) => p.age < 22 && p.overall < p.potential),
  'hakem-skandal': () => true,
  'sponsor-firsati': () => true,
  'arsa-indirimi': () => true,
  'maas-gecikmesi': (G) => G.economy.kasa < 5,
  'belediye-arsa': () => true,
  'efsane-vefat': () => true,
  'gece-hayati': (G) => G.squad.some((p) => p.personality === 'Alevlenebilir'),
  'karaborsa': (G) => G.lastLedger && G.lastLedger.gelir.bilet > 0 && G.gauges.taraftar > 70,
  'td-teklif': (G) => G.coach.taktik >= 75,
  'genc-ab-kanca': (G) => G.squad.some((p) => p.age <= 21 && p.potential >= 85),
  'cati-arizasi': (G) => G.facilities.stadyum < 4 && G.meta.week >= 14 && G.meta.week <= 26,
  'sike-iddiasi': (G) => G.gauges.itibar < 40,
  'bagis-kampanyasi': (G) => G.currentTag === 'BORC_BATAGI',
  'dizi-cekim': () => true,
  'grip-salgini': (G) => G.meta.week >= 14 && G.meta.week <= 26,
  'eski-baskan-roportaj': (G) => G.meta.season === TUNING.SEASONS_PER_TERM,
  'forma-krizi': (G) => G.meta.week <= 3,
  'scout-cevher': (G) => G.facilities.scout >= 6,
  'rakip-kume-dustu': () => false, // bölgesel rakip sistemi TAM dışı
  'seyircisiz-ceza': (G) => (G.atesliCount || 0) >= 3,
  'td-yildiz-soguk': (G) => G.coach.oyuncuYonetimi < 55,
  // A4: staff olayları
  'cfo-teklif': (G) => !!(G.staff && G.staff.cfo && G.staff.cfo.skill >= 60),
  'staff-catisma': (G) => !!(G.staff && Object.values(G.staff).some((s) => s && s.trait === 'egolu')),
  'limit-revizyon': (G) => !!G.ffp,
  // ÇELİK 6b: tier/durum/mod koşullu yeni olaylar
  'yerel-derbi-daveti': (G) => G.club.tier === 'kucuk',
  'yildiz-reklam-krizi': (G) => G.club.tier === 'buyuk' && G.squad.some((p) => p.overall >= TUNING.STAR_THRESHOLD),
  'delege-listesi': (G) => G.meta.season === TUNING.SEASONS_PER_TERM && G.meta.week >= 15,
  'rakip-vaat-bombasi': (G) => G.meta.season === TUNING.SEASONS_PER_TERM && G.meta.week >= 10,
  'araci-teklifi': (G) => !!G.transferWindow,
  'yildiz-kis-huzursuz': (G) => !!G.transferWindow && G.meta.week >= 15,
  'aile-mirasi': (G) => G.mode === 'aile',
  'aile-sirket-krizi': (G) => G.mode === 'aile',
  // Transfer/scout/insider olay dalgası — "gizli cevher" ruhunda, gerçek etkili (kumar çözülür)
  'balkan-agi': (G) => G.facilities.scout >= 4,
  'menajer-yemegi': () => true,
  'serbest-yildiz': (G) => !!G.transferWindow,
  'kis-kiraligi': (G) => !!G.transferWindow && G.meta.week >= 15,
  'yangindan-mal': (G) => !!G.transferWindow,
  'casus-raporu': (G) => G.facilities.scout >= 5,
  'veri-modeli': (G) => G.facilities.scout >= 3 || !!(G.staff && G.staff.stat),
  'akademi-firari': (G) => G.facilities.akademi >= 3 && G.squad.some((p) => p.age <= 19),
};

// Anlatı etiketi olay ağırlığı: kriz etiketi kriz olaylarını öne çeker (v3-D1).
const TAG_BOOST = {
  BORC_BATAGI: ['maas-gecikmesi', 'bagis-kampanyasi', 'doviz-soku'],
  KRIZ_KULUBU: ['hakem-skandal', 'td-yildiz-soguk', 'gece-hayati'],
  SAMPIYONLUK_YARISI: ['yildiza-dev-teklif', 'sponsor-firsati', 'karaborsa'],
};

// Havuzdan uygun olay seç (anlatı etiketi + Y1 HİKAYE YAYI ağırlıklı). Döner event ya da null.
import { ARC_EVENTS } from './director.js';
export function pickRandomEvent(G, eventsData) {
  const pool = (eventsData && eventsData.random) || [];
  const eligible = pool.filter((e) => (COND[e.id] ? COND[e.id](G) : true));
  if (!eligible.length) return null;
  const boosted = TAG_BOOST[G.currentTag] || [];
  const arcBoost = (G.storyArc && ARC_EVENTS[G.storyArc.key]) || [];
  const weighted = [];
  for (const e of eligible) {
    weighted.push(e);
    if (boosted.includes(e.id)) weighted.push(e, e);      // etiket ×3
    if (arcBoost.includes(e.id)) weighted.push(e, e);     // hikaye yayı ×3 (Y1)
  }
  return weighted[randint(0, weighted.length - 1)];
}

// Seçenek etkilerini uygula (events.json şema yorumlayıcısı — bilinen alanlar).
export function applyEventEffects(G, effects = {}) {
  const notes = [];
  const doApply = (fx) => {
    if (!fx) return;
    if (fx.gauge) for (const [k, d] of Object.entries(fx.gauge)) { if (typeof d === 'number') G.gauges[k] = Math.max(0, Math.min(100, G.gauges[k] + d)); }
    if (fx.economy) {
      const e = fx.economy;
      if (typeof e.kasa === 'number') G.economy.kasa += e.kasa;
      if (typeof e.faiz === 'number') G.economy.faizOrani += e.faiz;
      if (typeof e.borcMult === 'number') G.economy.borc *= e.borcMult;
      if (e.kasaGain === '2..5') G.economy.kasa += rand(2, 5);
      else if (typeof e.kasaGain === 'string') { // yıldız satışı vb. — en değerliyi sat
        const star = G.squad.slice().sort((a, b) => b.marketValue - a.marketValue)[0];
        if (star) { G.squad = G.squad.filter((x) => x !== star); G.economy.kasa += star.marketValue; notes.push(star.name + ' satıldı'); }
      }
    }
    if (typeof fx.squadMorale === 'number') for (const p of G.squad) p.morale = Math.max(0, Math.min(100, p.morale + fx.squadMorale));
    if (typeof fx.kimya === 'number' && G.kimya) G.kimya.kimya = Math.max(0, Math.min(100, G.kimya.kimya + fx.kimya));
    if (typeof fx.mediaTone === 'number') G.mediaTone = (G.mediaTone || 0) + fx.mediaTone;
    if (fx.player) { // rastgele ilgili oyuncuya
      const p = G.squad[randint(0, Math.max(0, G.squad.length - 1))];
      if (p) {
        if (typeof fx.player.morale === 'number') p.morale = Math.max(0, Math.min(100, p.morale + fx.player.morale));
        if (typeof fx.player.overall === 'number') { p.overall = Math.min(p.potential || 95, p.overall + fx.player.overall); if (p.refreshValue) p.refreshValue(); }
        if (fx.player.wageMult) p.wage *= fx.player.wageMult;
      }
    }
    if (typeof fx.rivalAttractiveness === 'number' && G.rival) G.rival.attractiveness += fx.rivalAttractiveness;
    if (typeof fx.rakipCekicilik === 'number' && G.rival) G.rival.attractiveness = Math.max(0, G.rival.attractiveness + fx.rakipCekicilik); // ÇELİK 6b
    if (typeof fx.servet === 'number' && G.mode === 'aile') G.servet = (G.servet ?? 100) + fx.servet; // ÇELİK 6b: aile servet olayları
    // A4: staff etkileri
    if (fx.staffWageMult && G.staff && G.staff[fx.staffWageMult.role]) G.staff[fx.staffWageMult.role].wage *= fx.staffWageMult.mult;
    if (fx.staffLeaves && G.staff) G.staff[fx.staffLeaves] = null;
    if (fx.staffLeavesEgolu && G.staff) { for (const r of Object.keys(G.staff)) if (G.staff[r] && G.staff[r].trait === 'egolu') { G.staff[r] = null; break; } }
    if (typeof fx.ffpMult === 'number' && G.ffp) G.ffp.limit = Math.round(G.ffp.limit * fx.ffpMult);
    if (typeof fx.brand === 'number') { /* marka TAM dışı — itibar kırıntısı */ G.gauges.itibar = Math.min(100, G.gauges.itibar + 1); }
    // K1: tesis indirimi (belediye-arsa / arsa-indirimi kartları) — kapsam süreli, ihale bazına iner
    if (fx.facilityDiscount) {
      const { scope = 'term', ...tesisler } = fx.facilityDiscount;
      G.facilityDisc = G.facilityDisc || {};
      const term = (G.meta && G.meta.term) || 1, season = (G.meta && G.meta.season) || 1;
      for (const [tesis, disc] of Object.entries(tesisler)) {
        if (typeof disc === 'number') { G.facilityDisc[tesis] = { disc, scope, term, season }; notes.push(tesis + ' indirimi'); }
      }
    }
  };
  doApply(effects);
  if (typeof effects.chance === 'number') {
    // GERÇEKLEŞEN sonuç: onHit/onMiss'in kendi notu öncelikli (sonuç kartında oyuncuya gösterilir).
    if (rand(0, 1) < effects.chance) { doApply(effects.onHit); notes.push((effects.onHit && effects.onHit.note) || 'şans tuttu'); }
    else if (effects.onMiss) { doApply(effects.onMiss); notes.push((effects.onMiss && effects.onMiss.note) || 'ters tepti'); }
  }
  return notes;
}

// Tick sonu bayrak sayaçlarını ilerlet + süregelen etkileri uygula (boykot güven kaybı).
export function tickEventFlags(state) {
  const f = state.flags || (state.flags = {});
  if (f.budgetLock > 0) f.budgetLock--;
  if (f.transferBan > 0) f.transferBan--;
  if (f.boykot > 0) {
    state.gauges.guven = Math.max(0, Math.min(100, state.gauges.guven + TUNING.EVENTS.BOYKOT.guvenPerTick));
    f.boykot--;
  }
}
