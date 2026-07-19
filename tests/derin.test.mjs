// tests/derin.test.mjs — DERİN BATARYA ("tüm oyunu sağlam bir testten geçir").
// 5 bölüm: (1) KAOS BOTU × mod/zorluk matrisi — HER sistemi kullanır + derin invaryant
// taraması, (2) kayıt/yükleme ROUNDTRIP EŞİTLİĞİ (kayıt her şeyi taşıyor mu?),
// (3) determinizm parmak izi (aynı seed → aynı kariyer), (4) render fuzz (uç durumlarda
// tüm ekranlar 'undefined'/'NaN' sızdırmadan çizilir), (5) sistem KAPSAMA sayaçları
// (batarya gerçekten her sistemi tetikledi mi — sessiz atlama yok).
// Çalıştır: node tests/derin.test.mjs

import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { serialize, deserialize } from '../src/core/save.js';
import { shell } from '../src/ui/frame.js';
import * as cockpit from '../src/ui/cockpit.js';
import * as inboxV from '../src/ui/inbox.js';
import * as finance from '../src/ui/finance.js';
import * as matchday from '../src/ui/matchday.js';
import * as squadView from '../src/ui/squadView.js';
import * as transferView from '../src/ui/transferView.js';
import * as facilitiesView from '../src/ui/facilitiesView.js';
import * as media from '../src/ui/media.js';
import * as congress from '../src/ui/congress.js';
import * as dataHub from '../src/ui/dataHub.js';
import * as clubView from '../src/ui/clubView.js';
import * as electionNight from '../src/ui/electionNight.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json') };

// Yerel deterministik karar zarı (ana RNG'ye DOKUNMAZ — bot beyni ayrı akış)
function h32(s) { let h = 0; const t = String(s); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; }
const zar = (seed, n) => h32(seed) % n;

// ── DERİN İNVARYANT TARAMASI: state ağacında NaN/Infinity avı + yapısal sınırlar ──
const SKIP_KEYS = new Set(['data', '_seen']);
function scanNaN(o, path, out, depth = 0) {
  if (depth > 12 || out.length > 8) return;
  if (typeof o === 'number') { if (!Number.isFinite(o)) out.push(`${path} = ${o}`); return; }
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) { for (let i = 0; i < o.length; i++) scanNaN(o[i], `${path}[${i}]`, out, depth + 1); return; }
  for (const k of Object.keys(o)) { if (SKIP_KEYS.has(k)) continue; scanNaN(o[k], `${path}.${k}`, out, depth + 1); }
}
function invariants(G, tag) {
  const errs = [];
  scanNaN(G, 'G', errs);
  for (const k of ['guven', 'taraftar', 'mali', 'sportif', 'itibar']) {
    const v = G.gauges[k];
    if (!Number.isFinite(v) || v < 0 || v > 100) errs.push(`gauge ${k}=${v}`);
  }
  if (!Number.isFinite(G.economy.kasa) || G.economy.kasa < -2000) errs.push(`kasa=${G.economy.kasa}`);
  if (!Number.isFinite(G.economy.borc) || G.economy.borc < 0) errs.push(`borc=${G.economy.borc}`);
  const ids = new Set(G.squad.map((p) => p.id));
  if (ids.size !== G.squad.length) errs.push(`kadro id çakışması (${G.squad.length}→${ids.size})`);
  if (G.squad.length < 11 || G.squad.length > 45) errs.push(`kadro boyu ${G.squad.length}`);
  for (const p of G.squad) {
    if (!(p.overall >= 20 && p.overall <= 99)) { errs.push(`${p.name} overall=${p.overall}`); break; }
    if (!(p.age >= 14 && p.age <= 45)) { errs.push(`${p.name} age=${p.age}`); break; }
    if (!(Number.isFinite(p.wage) && p.wage >= 0)) { errs.push(`${p.name} wage=${p.wage}`); break; }
  }
  if ((G.market || []).length > 400) errs.push(`piyasa şişti ${G.market.length}`);
  if (G.inbox.length > 30) errs.push(`inbox tavan aşımı ${G.inbox.length}`);
  if ((G.mansetArsiv || []).length > 24) errs.push(`manşet arşivi ${G.mansetArsiv.length}`);
  if ((G.defter || []).length > 900) errs.push(`defter sınırsız ${G.defter.length}`);
  return errs.map((e) => `[${tag}] ${e}`);
}

// ── KAOS BOTU: her haftada MÜMKÜN OLAN HER SİSTEME dokunur (zar h32 — deterministik) ──
const COV = { sorgu: 0, ucretliSorgu: 0, derin: 0, teklifIste: 0, onay: 0, sart: 0, tur2: 0, red: 0,
  satis: 0, kiralikDosya: 0, sponsorImza: 0, sponsorRed: 0, sponsorFesih: 0, sponsorBatma: 0,
  kredi: 0, bankaKredi: 0, yapilandirma: 0, sosyal: 0, sosyalBlok: 0, kadinTakim: 0, yurtOfis: 0,
  midPromise: 0, kurulButce: 0, ilan: 0, vitrin: 0, kiralikListe: 0, tesis: 0, ihale: 0,
  tdKovma: 0, tdImza: 0, demec: 0, telefon: 0, etkinlik: 0, kurulDosya: 0, gundem: 0, kaptan: 0,
  bilet: 0, telkin: 0, prim: 0, ozelPrim: 0, masa: 0, ffp: 0, tis: 0, kumeDusme: 0, terfi: 0,
  aileKrediRed: 0, sahaGercegi: 0 };

function kaosWeek(G, seedTag) {
  const wk = `${seedTag}|${G.meta.season}|${G.meta.week}`;
  A.beginWeek(G);
  let guard = 0;
  while (G.phone && guard++ < 8) { A.answerPhone(G, zar(wk + '|tel' + guard, Math.max(1, (G.phone.opts || [1, 2]).length))); COV.telefon++; }
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
    A.htDecision(G, ['tdguven', 'soyunma', 'tribun'][zar(wk + '|ht', 3)]);
    const r = A.finishWeek(G);
    if (r && r.waitLate) A.lateDecision(G, ['devam', 'dok'][zar(wk + '|late', 2)]);
  }
  guard = 0;
  while (G.phone && guard++ < 8) { A.answerPhone(G, zar(wk + '|tel2' + guard, Math.max(1, (G.phone.opts || [1, 2]).length))); COV.telefon++; }
  if (G.deskCard && !G.deskUsedThisTick) { A.deskAction(G); COV.masa++; }

  // ── PİYASA: sorgu → derin → teklif (gizli reyting hattı uçtan uca) ──
  const m0 = (G.market || [])[zar(wk + '|mkt', Math.max(1, (G.market || []).length))];
  if (m0 && !m0._sorgu) {
    // Ücretli sorgu hak varken de yasal (dış büro — hak harcamaz): ara sıra bilerek parayla sor
    if (G.economy.kasa > 3 && zar(wk + '|üc', 7) === 0) { if (A.sorgulaPlayer(G, m0.id, { ucretli: true })) COV.ucretliSorgu++; }
    else if ((G.sorguHak || 0) > 0) { if (A.sorgulaPlayer(G, m0.id)) COV.sorgu++; }
    else if (G.economy.kasa > 3) { if (A.sorgulaPlayer(G, m0.id, { ucretli: true })) COV.ucretliSorgu++; }
  }
  if (m0 && m0._sorgu && !m0._derin && G.economy.kasa > 6 && zar(wk + '|dr', 5) === 0) { if (A.derinRapor(G, m0.id)) COV.derin++; }
  if (G.transferWindow && m0 && zar(wk + '|to', 4) === 0) { A.requestOffer(G, m0.id); COV.teklifIste++; }
  if (G.transferWindow && !G.ilan && zar(wk + '|ilan', 6) === 0) { A.ilanVer(G, { pos: ['GK', 'DEF', 'MID', 'FWD'][zar(wk, 4)], yasMax: 29, tavan: 40 }); COV.ilan++; }

  // ── GELEN KUTUSU: her aksiyon tipine karar ──
  for (const m of [...G.inbox]) {
    if (m.resolved) continue;
    if (m.action === 'tfile') {
      const f = m.file, z = zar(wk + '|tf' + m.id, 10);
      if (z < 3 && !f.sartTried) { const r = A.resolveTransferFile(G, m.id, 'sart'); if (r.ok) { COV.sart++; if (r.outcome === 'indi' && zar(wk + '|t2', 2) === 0) { const r2 = A.resolveTransferFile(G, m.id, 'sart'); if (r2.ok) COV.tur2++; } } }
      else if (z < 7 && G.economy.kasa > f.fee * 0.3) { const r = A.resolveTransferFile(G, m.id, 'onay'); if (r.ok) { COV.onay++; const im = G.inbox.find((x) => x.t === 'İmza atıldı: ' + f.player.name); if (im && im.b.includes('İlk idman')) COV.sahaGercegi++; } }
      else { A.resolveTransferFile(G, m.id, 'red'); COV.red++; }
    } else if (m.action === 'sfile') { A.resolveSaleFile(G, m.id, zar(wk + '|sf', 2) ? 'sat' : 'red'); COV.satis++; }
    else if (m.action === 'lfile') { A.resolveLoanFile(G, m.id, zar(wk + '|lf', 2) ? 'gonder' : 'red'); COV.kiralikDosya++; }
    else if (m.action === 'bankLoan') { A.resolveBankLoan(G, m.id, zar(wk + '|bk', 2) ? 'kabul' : 'red'); COV.bankaKredi++; }
    else if (m.action === 'event') { A.resolveEvent(G, m.id, zar(wk + '|ev', (m.opts || [1, 2]).length || 2)); COV.etkinlik++; }
    else if (m.action === 'board') { A.resolveBoard(G, m.id, ['taraftar', 'kurul'][zar(wk + '|bd', 2)]); COV.kurulDosya++; }
    else if (m.action === 'agenda') { let ga = 0; while (!m.resolved && ga++ < 5) A.resolveAgenda(G, m.id, ['vizyon', 'taviz', 'rest'][zar(wk + '|ag' + ga, 3)]); COV.gundem++; }
    else if (m.action === 'captain') { A.resolveCaptain(G, m.id, zar(wk + '|cp', 2) ? 'onay' : 'red'); COV.kaptan++; }
    else if (m.action === 'douse') A.dousePress(G, m.id);
    else if (m.action === 'cfile') { if (A.hireCoachFile(G, m.id, zar(wk + '|cf', (G.coachFiles || [1]).length)).ok) COV.tdImza++; }
    else if (m.action === 'ticket') { A.resolveTicket(G, m.id, [0.8, 1.0, 1.3][zar(wk + '|tk', 3)]); COV.bilet++; }
  }

  // ── SPONSOR YAŞAYAN PAZAR: imza / red / (nadiren) fesih ──
  for (const slot of ['gogus', 'naming', 'kol']) {
    const offers = A.sponsorOffers(G, slot);
    const dolu = G.sponsorDeals && G.sponsorDeals[slot];
    if (!dolu && offers.length) {
      if (zar(wk + '|sp' + slot, 3) === 0) { if (A.signSponsor(G, slot, offers[0].id)) COV.sponsorImza++; }
      else if (offers.length > 1 && zar(wk + '|spr' + slot, 4) === 0) { if (A.rejectSponsorOffer(G, slot, offers[offers.length - 1].id)) COV.sponsorRed++; }
    } else if (dolu && zar(wk + '|fes' + slot, 120) === 0 && G.economy.kasa > 20) { if (A.cancelSponsor(G, slot)) COV.sponsorFesih++; }
  }

  // ── FİNANS: kredi / yapılandırma / borç ödeme ──
  if (G.economy.kasa < 4 && zar(wk + '|kr', 3) === 0) {
    const ok = A.takeLoan(G, 15);
    if (ok) COV.kredi++; else if (G.mode === 'aile') COV.aileKrediRed++;
  }
  if (G.economy.borc > 40 && zar(wk + '|yp', 5) === 0) {
    const once = G.yapilandirmaSezon;
    A.restructureDebt(G);
    if (G.yapilandirmaSezon === G.meta.season && once !== G.meta.season) COV.yapilandirma++;
  }
  if (G.economy.kasa > 60 && G.economy.borc > 10 && zar(wk + '|pd', 6) === 0) A.payDebtAmount(G, 10);

  // ── KONGRE/İTİBAR AKSİYONLARI ──
  if (zar(wk + '|sos', 4) === 0) { if (A.sosyalProje(G) === false) COV.sosyalBlok++; else COV.sosyal++; }
  if (!G.womensTeam && G.economy.kasa > 25 && zar(wk + '|kt', 10) === 0) { if (A.kadinTakimiKur(G)) COV.kadinTakim++; }
  if (!G.expansion && G.gauges.itibar >= 60 && G.economy.kasa > 45 && zar(wk + '|yo', 8) === 0) { if (A.yurtdisiOfisAc(G)) COV.yurtOfis++; }
  // KAPSAMA: kurulButce yalnız pencere+mali≥55 iken başarır ve dönem tek-atışlıdır (mali<55 denemesi hakkı yakar).
  // Bu yüzden kör örneklemek yerine koşul GERÇEKTEN uygunken deneriz — sistem tetiklenebiliyorsa tetiklensin.
  if (G.mode !== 'aile' && G.transferWindow && (G.gauges.mali ?? 50) >= 55) { if (A.kurulButceArtisi(G)) COV.kurulButce++; }
  const mids = A.midPromiseOptions(G);
  if (mids && mids.length && A.midPromiseCount(G) === 0 && zar(wk + '|mp', 12) === 0) { if (A.makeMidPromise(G, mids[0].id)) COV.midPromise++; }

  // ── KADRO: vitrin / kiralık liste / doğrudan satış ──
  if (!G.squad.some((p) => p.vitrin) && zar(wk + '|vt', 6) === 0) {
    const v = G.squad.filter((p) => p.age >= 29 && !p.loanIn).sort((a, b) => b.marketValue - a.marketValue)[0];
    if (v && A.vitrinToggle(G, v.id)) COV.vitrin++;
  }
  if (zar(wk + '|kl', 9) === 0) {
    const g = G.squad.find((p) => p.age <= 21 && !p.kiralikListe && !p.loanIn);
    if (g && A.toggleKiralikListe(G, g.id)) COV.kiralikListe++;
  }

  // ── TESİS + İHALE ──
  if (G.transferWindow && !G.tender && zar(wk + '|ts', 5) === 0) {
    const t = ['scout', 'academy', 'stad', 'medical'][zar(wk + '|tsx', 4)];
    if (A.upgradeFacility(G, t)) { COV.tesis++; if (G.tender) { const i = G.tender.offers.findIndex((o) => G.economy.kasa >= o.cost); if (i >= 0) { A.chooseTender(G, i); COV.ihale++; } else A.cancelTender(G); } }
  }

  // ── TD: nadiren kov → aday dosyasından yenisini al ──
  if (!G.coachSearch && zar(wk + '|tdk', 220) === 0 && G.economy.kasa > 10) { if (A.fireCoach(G).ok) COV.tdKovma++; }

  // ── MEDYA + HAFTALIK KALDIRAÇLAR ──
  A.makeDemec(G, ['iddiali', 'olculu', 'alcak'][zar(wk + '|dm', 3)]); COV.demec++;
  A.setTelkin(G, ['tamkadro', 'hucum', null][zar(wk + '|tl', 3)]); COV.telkin++;
  A.setMatchPrim(G, ['yok', 'normal', 'yuksek'][zar(wk + '|pr', 3)]); COV.prim++;
  if (!G.ozelUsed && !G.ozelArmed && A.isCriticalWeek(G)) { A.armOzelPrim(G); COV.ozelPrim++; }
  if (zar(wk + '|ffp', 40) === 0) { if (A.ffpLobi(G)) COV.ffp++; }
  if (G.staff && G.staff.tis && zar(wk + '|tis', 15) === 0) { A.tisBulusma(G, ['sportif', 'mali', 'taraftar'][zar(wk + '|tb', 3)]); COV.tis++; }

  G.pendingMatch = null;
}

function walkElection(G, seedTag) {
  let guard = 0;
  while (G.phase === 'CAMPAIGN' && guard++ < 10) { A.campaignDo(G, ['taraftarMitingi', 'basinTuru', 'projeLansmani'][zar(seedTag + guard, 3)]); A.advanceCampaign(G); }
  guard = 0;
  while (G.phase === 'DEBATE' && guard++ < 6) A.answerDebate(G, ['vizyon', 'savunma', 'saldiri'][zar(seedTag + '|d' + guard, 3)]);
}

// Bir kariyer: 2 döneme kadar kaos + haftalık invaryant nabzı. Dönüş: {errs, terms}
function staffKur(G, seedTag) {
  for (const role of ['cfo', 'akademi', 'basin', 'tis']) {
    if (G.staff && G.staff[role]) continue;
    if (A.requestStaffFile(G, role).ok) {
      const m = G.inbox.find((x) => x.action === 'stfile' && !x.resolved);
      if (m) A.hireStaffFile(G, m.id, zar(seedTag + role, (G.staffCands?.cands || [1]).length));
    }
  }
}
function kaosCareer(cfg, seed) {
  setSeed(seed);
  const G = A.newGame(data, cfg.zorluk, cfg.mode);
  A.selectClub(G, cfg.tier);
  A.setTicketPrice(G, 1.0);
  A.startTerm(G, ['P01', 'P02', 'P15'].slice(0, 3), { budget: 120, line: 'karma' });
  staffKur(G, cfg.mode + seed);
  const errs = [];
  let terms = 0;
  const tag = cfg.mode + cfg.zorluk + cfg.tier + seed;
  for (let d = 0; d < 2; d++) {
    for (let s = 0; s < 3; s++) {
      const ligOnce = G.lig || 1;
      for (let w = 0; w < 34; w++) {
        kaosWeek(G, tag);
        if (w % 8 === 3) errs.push(...invariants(G, `${tag} S${G.meta.season}W${w}`));
        if (G.phase === 'CAREER_END') return { errs, terms, end: true };
      }
      A.endSeason(G);
      A.afterSeasonEnd(G);
      const ligSonra = G.lig || 1;
      if (ligSonra === 2 && ligOnce === 1) COV.kumeDusme++;
      if (ligSonra === 1 && ligOnce === 2) COV.terfi++;
      if (G.phase === 'CAREER_END') return { errs, terms, end: true };
      if (G.phase === 'CAMPAIGN') break;
    }
    walkElection(G, tag + '|e' + d);
    if (G.phase !== 'ELECTION_NIGHT') return { errs, terms, end: true };
    if (G.election.kazandi) { terms++; A.startNewTerm(G); A.chooseVision(G, ['sportif', 'mali', 'taraftar'][zar(tag + d, 3)]); A.startTerm(G, ['P01', 'P04', 'P15'], { budget: 100, line: 'karma' }); }
    else { A.afterElectionLoss(G); return { errs, terms, end: true }; }
    errs.push(...invariants(G, `${tag} dönem${d + 1}-sonu`));
  }
  return { errs, terms, end: false };
}

// ═══ BÖLÜM 1: KAOS × MATRİS ═══
console.log('\n── BÖLÜM 1: KAOS BOTU × mod/zorluk/tier matrisi ──');
const MATRIX = [
  { mode: 'klasik', zorluk: 'normal', tier: 'orta' },
  { mode: 'klasik', zorluk: 'zor', tier: 'kucuk' },
  { mode: 'klasik', zorluk: 'efsane', tier: 'buyuk' },
  { mode: 'klasik', zorluk: 'kolay', tier: 'kucuk' },
  { mode: 'aile', zorluk: 'normal', tier: 'orta' },
  { mode: 'vitrin', zorluk: 'normal', tier: 'orta' },
  { mode: 'ironman', zorluk: 'zor', tier: 'orta' },
];
const SEEDS_PER = 4;
let crashes = 0; const allErrs = [];
for (const cfg of MATRIX) {
  for (let i = 0; i < SEEDS_PER; i++) {
    try {
      const r = kaosCareer(cfg, 9100 + MATRIX.indexOf(cfg) * 20 + i);
      allErrs.push(...r.errs);
    } catch (err) {
      crashes++;
      console.log(`  CRASH [${cfg.mode}/${cfg.zorluk}/${cfg.tier} #${i}]: ${err.message}\n    ${(err.stack || '').split('\n')[1] || ''}`);
    }
  }
}
check(`kaos matrisi: ${MATRIX.length}×${SEEDS_PER} kariyer CRASH YOK`, crashes === 0, `${crashes} crash`);
check('kaos matrisi: invaryant ihlali YOK (NaN/taşma/çakışma)', allErrs.length === 0, allErrs.slice(0, 5).join(' | '));

// ═══ BÖLÜM 2: KAYIT/YÜKLEME ROUNDTRIP EŞİTLİĞİ ═══
console.log('\n── BÖLÜM 2: kayıt→yükleme→devam == kesintisiz devam ──');
function fingerprint(G) {
  return JSON.stringify({
    w: G.meta.week, s: G.meta.season, kasa: Math.round(G.economy.kasa * 1000), borc: Math.round(G.economy.borc * 1000),
    g: Object.fromEntries(Object.entries(G.gauges).map(([k, v]) => [k, Math.round(v * 100)])),
    squad: G.squad.map((p) => [p.id, p.overall, p.age, Math.round(p.wage * 100)]),
    tablo: Object.values(G.league.table || {}).map((t) => [t.name, t.pts]),
    guc: Math.round(G.temelGuc * 100), mkt: (G.market || []).length,
    spon: Object.entries(G.sponsorDeals || {}).map(([k, v]) => [k, v && v.name, v && v.remainingSeasons]),
    vaat: (G.promises || []).map((p) => [p.id, p.kept]),
  });
}
function rtRitual(G, tag) { kaosWeek(G, tag); } // aynı deterministik ritüel iki kolda da
{
  const RT_SEED = 5150, TAG = 'rt';
  // KOL A: kesintisiz 34 hafta
  setSeed(RT_SEED);
  const GA = A.newGame(data, 'normal', 'klasik'); A.selectClub(GA, 'orta'); A.setTicketPrice(GA, 1.0); A.startTerm(GA, ['P01', 'P02', 'P15'], { budget: 120, line: 'karma' });
  for (let w = 0; w < 20; w++) rtRitual(GA, TAG);
  setSeed(777); // RNG'yi bilinen noktaya sabitle (kayıt RNG durumunu taşımaz — tasarım gereği)
  for (let w = 0; w < 14; w++) rtRitual(GA, TAG);
  const fpA = fingerprint(GA);
  // KOL B: 20 haftada kaydet → yükle → 14 hafta devam
  setSeed(RT_SEED);
  const GB0 = A.newGame(data, 'normal', 'klasik'); A.selectClub(GB0, 'orta'); A.setTicketPrice(GB0, 1.0); A.startTerm(GB0, ['P01', 'P02', 'P15'], { budget: 120, line: 'karma' });
  for (let w = 0; w < 20; w++) rtRitual(GB0, TAG);
  const snap = serialize({ ...GB0, data: undefined });
  const GB = A.migrateLoaded(Object.assign(deserialize(snap), { data }));
  setSeed(777);
  for (let w = 0; w < 14; w++) rtRitual(GB, TAG);
  const fpB = fingerprint(GB);
  check('roundtrip: kayıt SİM-İLGİLİ her durumu taşıyor (parmak izi eşit)', fpA === fpB, fpA === fpB ? '' : 'FARK VAR — kayıt eksik alan taşıyor!');
  check('roundtrip: yüklenen kayıtla invaryantlar sağlam', invariants(GB, 'rt').length === 0);
  // REHİDRASYON: yüklenen oyuncular Player metotlarını geri kazanmalı (Devam Et → sezon
  // sonu developSquad crash'i bu kontrol yüzünden bir daha dönemez)
  const plainler = GB.squad.filter((p) => typeof p.refreshValue !== 'function');
  check('roundtrip: yüklenen kadro rehidre (refreshValue çalışır)', plainler.length === 0,
    plainler.map((p) => `${p.name} [${p.pos} ${p.age}] ocak:${!!p.ocak} aileOgul:${!!p.aileOgul} loanIn:${!!p.loanIn}`).join(' · '));
  // SEZON SINIRI: yükleme sonrası sezon sonu + yeni sezon patlamadan geçmeli
  let rtErr = null;
  try {
    while ((GB.meta.week || 0) < 34 && GB.phase === 'SEASON_LOOP') rtRitual(GB, TAG);
    A.endSeason(GB); A.afterSeasonEnd(GB);
  } catch (e) { rtErr = e; }
  check('roundtrip: yükleme sonrası SEZON SONU geçişi crash\'sız', rtErr === null && invariants(GB, 'rt-s2').length === 0, rtErr ? rtErr.message : '');
}

// ═══ BÖLÜM 3: DETERMİNİZM — aynı seed aynı kariyer ═══
console.log('\n── BÖLÜM 3: determinizm parmak izi ──');
{
  function run(seed) {
    setSeed(seed);
    const G = A.newGame(data, 'zor', 'klasik'); A.selectClub(G, 'kucuk'); A.setTicketPrice(G, 1.1); A.startTerm(G, ['P02', 'P15'], { budget: 60, line: 'hazir' });
    for (let w = 0; w < 34; w++) kaosWeek(G, 'det' + seed);
    return fingerprint(G);
  }
  check('aynı seed × 2 koşum → bire bir aynı sezon', run(4242) === run(4242));
  check('farklı seed → farklı kariyer (sabit kalıp yok)', run(4242) !== run(4243));
}

// ═══ BÖLÜM 4: RENDER FUZZ — uç durumlarda ekranlar sızdırmaz ═══
console.log('\n── BÖLÜM 4: render fuzz (uç durumlar) ──');
const VIEWS = { cockpit, inbox: inboxV, finance, matchday, squad: squadView, transfer: transferView, facilities: facilitiesView, media, congress, dataHub, club: clubView };
function fuzzRender(G, tag) {
  const bad = [];
  for (const [name, v] of Object.entries(VIEWS)) {
    try {
      const html = shell(G, { content: v.render(G) });
      if (!(typeof html === 'string' && html.length > 50)) bad.push(`${name}: boş`);
      else if (/\bundefined\b/.test(html)) bad.push(`${name}: 'undefined' sızdı`);
      else if (/\bNaN\b/.test(html)) bad.push(`${name}: 'NaN' sızdı`);
    } catch (err) { bad.push(`${name}: THROW ${err.message}`); }
  }
  check(`fuzz [${tag}]: 11 ekran temiz`, bad.length === 0, bad.slice(0, 3).join(' | '));
}
{
  setSeed(31337);
  const G = A.newGame(data, 'normal', 'klasik'); A.selectClub(G, 'orta'); A.setTicketPrice(G, 1.0); A.startTerm(G, ['P01', 'P02', 'P15'], { budget: 120, line: 'karma' });
  for (let w = 0; w < 12; w++) kaosWeek(G, 'fz');
  fuzzRender(G, 'normal akış W12');
  // UÇ 1: eksi kasa + dolu inbox + vitrin + kiralık liste
  G.economy.kasa = -0.7;
  for (let i = 0; i < 40; i++) G.inbox.unshift({ id: 'fz' + i, cat: 'mali', t: 'Dolu kutu ' + i, b: 'test', wk: 1 });
  G.inbox.length = 30;
  fuzzRender(G, 'eksi kasa + dolu inbox');
  // UÇ 2: 2. Lig görünümü
  G.lig = 2;
  fuzzRender(G, '2. Lig');
  G.lig = 1;
  // UÇ 3: piyasa boş
  const eskiMarket = G.market; G.market = [];
  fuzzRender(G, 'boş piyasa');
  G.market = eskiMarket;
  // UÇ 4: seçim gecesi
  setSeed(41414);
  const GE = A.newGame(data, 'normal', 'klasik'); A.selectClub(GE, 'orta'); A.setTicketPrice(GE, 1.0); A.startTerm(GE, ['P01', 'P02', 'P15'], { budget: 100, line: 'karma' });
  for (let s = 0; s < 3; s++) { for (let w = 0; w < 34; w++) { A.advanceWeek(GE); GE.pendingMatch = null; } A.endSeason(GE); A.afterSeasonEnd(GE); }
  walkElection(GE, 'fz-e');
  if (GE.phase === 'ELECTION_NIGHT') {
    GE.election.done = true; GE.election.displayVote = GE.election.oyOrani * 100;
    const html = electionNight.render(GE);
    check('fuzz [seçim gecesi]: render temiz', typeof html === 'string' && html.length > 50 && !/\bNaN\b/.test(html) && !/\bundefined\b/.test(html));
  } else check('fuzz [seçim gecesi]: faz yürüyüşü ELECTION_NIGHT üretti', false, GE.phase);
}

// ═══ BÖLÜM 5: KAPSAMA — batarya her sistemi GERÇEKTEN tetikledi mi ═══
console.log('\n── BÖLÜM 5: sistem kapsama sayaçları ──');
console.log('  ' + Object.entries(COV).map(([k, v]) => `${k}:${v}`).join(' '));
const ZORUNLU = ['sorgu', 'ucretliSorgu', 'derin', 'teklifIste', 'onay', 'sart', 'red', 'satis',
  'sponsorImza', 'sponsorRed', 'kredi', 'sosyal', 'sosyalBlok', 'vitrin', 'kiralikListe',
  'tesis', 'demec', 'telefon', 'etkinlik', 'bilet', 'telkin', 'prim', 'kurulButce', 'ilan', 'masa'];
const eksik = ZORUNLU.filter((k) => COV[k] === 0);
check(`zorunlu ${ZORUNLU.length} sistemin tamamı tetiklendi`, eksik.length === 0, eksik.length ? 'EKSİK: ' + eksik.join(', ') : 'tam kapsama');
const OPSIYONEL = ['tur2', 'kiralikDosya', 'bankaKredi', 'yapilandirma', 'kadinTakim', 'yurtOfis', 'midPromise', 'sponsorFesih', 'ihale', 'tdKovma', 'tdImza', 'kaptan', 'gundem', 'kurulDosya', 'ozelPrim', 'sahaGercegi', 'aileKrediRed', 'kumeDusme'];
const opsEksik = OPSIYONEL.filter((k) => COV[k] === 0);
check('nadir sistemler: en az %70 kapsandı', opsEksik.length <= Math.floor(OPSIYONEL.length * 0.3), opsEksik.length ? 'görülmedi: ' + opsEksik.join(', ') : 'hepsi görüldü');

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
