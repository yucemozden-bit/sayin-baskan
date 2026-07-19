// tests/uc.test.mjs — UÇ DENETİM: "hiçbir şey gözden kaçmasın" taraması.
// A) GEÇERSİZ GİRDİ FUZZ'u: ~60 aksiyon bozuk argümanlarla — hiçbiri fırlatmamalı, durum bozulmamalı.
// B) İKİLEM TAM MATRİSİ: OLAYLAR havuzundaki her ikilem × her şık (koşullular koşul sağlanarak).
// C) OLAY KARTLARI: events.json random havuzunun TAMAMI × her seçenek.
// D) UÇ DURUM EKRAN TARAMASI: 8 sınır-durum state'inde 15 ekran + modal'lar (undefined/NaN/float avı).
// E) FAZ-ORTASI KAYIT: her oyun fazında serialize→migrate→render.
// F) MOD × ZORLUK MATRİSİ: klasik/aile/vitrin/ironman + kolay/zor/efsane smoke.
// Çalıştır: node tests/uc.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { OLAYLAR, VARLIK } from '../src/engines/ozel.js';
import * as cockpit from '../src/ui/cockpit.js';
import * as squadView from '../src/ui/squadView.js';
import * as transferView from '../src/ui/transferView.js';
import * as facilitiesView from '../src/ui/facilitiesView.js';
import * as finance from '../src/ui/finance.js';
import * as media from '../src/ui/media.js';
import * as congress from '../src/ui/congress.js';
import * as dataHub from '../src/ui/dataHub.js';
import * as clubView from '../src/ui/clubView.js';
import * as inboxUi from '../src/ui/inbox.js';
import * as ozelUi from '../src/ui/ozelHayat.js';
import * as settingsUi from '../src/ui/settings.js';
import * as playerCard from '../src/ui/playerCard.js';
import * as seasonEnd from '../src/ui/seasonEnd.js';
import * as electionNight from '../src/ui/electionNight.js';
import * as oppositionUi from '../src/ui/opposition.js';
import * as careerEndUi from '../src/ui/careerEnd.js';
import { renderCampaign, renderDebate } from '../src/ui/campaignView.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function nanAv(obj, yol = 'G', d = 0, seen = new Set()) {
  if (d > 8 || obj == null || typeof obj !== 'object' || seen.has(obj)) return null;
  seen.add(obj);
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'data') continue;
    if (typeof v === 'number' && !Number.isFinite(v)) return `${yol}.${k}`;
    if (typeof v === 'object') { const r = nanAv(v, `${yol}.${k}`, d + 1, seen); if (r) return r; }
  }
  return null;
}
function fresh(seed = 42, tier = 'orta', zorluk = 'normal', mode = 'klasik') {
  setSeed(seed);
  const G = A.newGame(data, zorluk, mode);
  A.selectClub(G, tier);
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  A.initOzel(G);
  return G;
}
function hizliHafta(G) {
  A.beginWeek(G);
  let g = 0; while (G.phone && g++ < 8) A.answerPhone(G, 0);
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') { A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam'); }
  G.pendingMatch = null;
}
const EKRANLAR = { cockpit, kadro: squadView, transfer: transferView, tesis: facilitiesView, finans: finance, medya: media, kongre: congress, veri: dataHub, kulup: clubView, inbox: inboxUi, ayarlar: settingsUi };
function tamTara(G, et) {
  let html = '';
  const ciz = (ad, fn) => { try { html += fn() || ''; } catch (e) { throw new Error(`${et} · ${ad}: ${e.message}`); } };
  for (const [ad, m] of Object.entries(EKRANLAR)) { G.nav = ad; ciz(ad, () => m.render(G)); }
  for (const t of ['genel', 'servet', 'defter']) { G._ozelTab = t; ciz('ozel/' + t, () => ozelUi.render(G)); }
  if (G.squad[0]) { G._pcard = G.squad[0].id; ciz('kart', () => playerCard.render(G)); G._pcard = null; }
  const ilkTeklif = (A.sponsorOffers(G, 'gogus') || [])[0];
  if (ilkTeklif) { G._spCard = { slot: 'gogus', id: ilkTeklif.id }; ciz('spDetay', () => finance.renderSponsorCard(G)); G._spCard = null; }
  ciz('başarımDuvarı', () => clubView.renderAchModal(G));
  if (/undefined|NaN/.test(html)) {
    const i = html.search(/undefined|NaN/);
    throw new Error(`${et} · sızıntı: …${html.slice(Math.max(0, i - 70), i + 40).replace(/\s+/g, ' ')}…`);
  }
  const flo = html.match(/\d+\.\d{4,}\s*mn/); if (flo) throw new Error(`${et} · fmt'siz sayı: "${flo[0]}"`);
}

console.log('\n═══ A) GEÇERSİZ GİRDİ FUZZ\'u — hiçbir aksiyon fırlatmamalı ═══');
{
  const G = fresh(101);
  A.preSeasonWeek(G);
  const BOZUK = [undefined, null, 'zzz', -1, 999999, '', 'a|b', {}, 0];
  const CAGRILAR = [
    ['ozelVarlik', 1], ['ozelDavet', 1], ['ozelKarar', 1], ['ozelBagis', 1], ['ozelProg', 1], ['ozelRoportaj', 0],
    ['playerJest', 1], ['playerSoz', 1], ['sorgulaPlayer', 1], ['derinRapor', 1],
    ['buyTarget', 1], ['sellPlayer', 1], ['renewContract', 1], ['vitrinToggle', 1],
    ['signSponsor', 2], ['cancelSponsor', 1], ['rejectSponsorOffer', 2], ['resolveSponsorBuyout', 2], ['kayyumPaket', 2],
    ['megaProjeBaslat', 0], ['upgradeFacility', 1], ['chooseTender', 1], ['cancelTender', 0],
    ['payDebtAmount', 1], ['takeLoan', 1], ['restructureDebt', 0], ['setTicketPrice', 1],
    ['setMatchPrim', 1], ['setTelkin', 1], ['toggleSeriPrim', 1], ['armOzelPrim', 0], ['declareSeasonPrim', 0],
    ['ilanVer', 1], ['requestOffer', 1], ['resolveTransferFile', 2], ['resolveSaleFile', 2], ['resolveLoanFile', 2],
    ['resolveTicket', 2], ['resolveEvent', 2], ['resolveBoard', 2], ['resolveCaptain', 2],
    ['resolveSeasonBudget', 2], ['resolveBankLoan', 2], ['resolveAgenda', 2],
    ['hireStaffFile', 2], ['hireCoachFile', 2], ['requestStaffFile', 1], ['fireCoach', 0],
    ['makeMidPromise', 1], ['makeDemec', 1], ['dousePress', 1], ['tisBulusma', 1],
    ['kadinTakimiKur', 0], ['yurtdisiOfisAc', 0], ['sosyalProje', 0], ['kurulButceArtisi', 0],
    ['answerPhone', 1], ['htDecision', 1], ['lateDecision', 1], ['gmBudgetItiraz', 1],
  ];
  const patlayan = [];
  let denenen = 0;
  for (const [ad, argSayisi] of CAGRILAR) {
    if (typeof A[ad] !== 'function') continue;
    for (const b of BOZUK) {
      const args = Array.from({ length: argSayisi }, () => b);
      denenen++;
      try { A[ad](G, ...args); } catch (e) { patlayan.push(`${ad}(${String(b)}): ${e.message}`); }
    }
  }
  check(`${denenen} bozuk-arg çağrısının hiçbiri fırlatmadı`, patlayan.length === 0, patlayan.slice(0, 4).join(' · ') || 'sağlam');
  const n = nanAv(G);
  check('fuzz sonrası durum temiz: NaN yok + gauge/oz sınırlarda', !n && Object.values(G.gauges).every((v) => v >= 0 && v <= 100) && G.ozel.nakit >= 0, n || '');
  tamTara(G, 'fuzz-sonrası');
  check('fuzz sonrası 15 ekran + modal taraması temiz', true);
}

console.log('\n═══ B) İKİLEM TAM MATRİSİ — her OLAYLAR girdisi × her şık ═══');
{
  let cozulen = 0, sorun = [];
  for (const o of OLAYLAR) {
    for (let idx = 0; idx < o.a.length; idx++) {
      const G = fresh(200 + cozulen);
      const oz = G.ozel;
      oz.nakit = 50; oz.g.stres = 60; oz.varlik.konut = 2;
      // koşullu ikilemler: kapıyı aç
      oz.flags.elifNisan = true; oz.flags.dugunOldu = o.id === 'kizKulup';
      if (o.id === 'ayrilik') oz.flags.ayrilikTeklif = true;
      if (o.id === 'ogulAkademi') { oz.c2Yas = 16; G.facilities.akademi = 3; }
      if (o.id === 'kizKulup') oz.c1Yas = 23;
      oz.olay = { id: o.id, hafta: 999 };
      try {
        const r = A.ozelKarar(G, idx);
        if (!r.ok) { sorun.push(`${o.id}[${idx}]: ok=false`); continue; }
        const n = nanAv(G);
        if (n) { sorun.push(`${o.id}[${idx}]: NaN ${n}`); continue; }
        if (!Object.values(oz.g).every((v) => v >= 0 && v <= 100)) { sorun.push(`${o.id}[${idx}]: gösterge taştı`); continue; }
        cozulen++;
      } catch (e) { sorun.push(`${o.id}[${idx}]: ${e.message}`); }
    }
  }
  check(`ikilem matrisi: ${cozulen} şık sorunsuz çözüldü (${OLAYLAR.length} ikilem × tüm şıklar)`, sorun.length === 0, sorun.slice(0, 3).join(' · ') || 'tam');
}

console.log('\n═══ C) OLAY KARTLARI — events.json random havuzu × her seçenek ═══');
{
  const havuz = data.events.random || [];
  let cozulen = 0, sorun = [];
  for (const ev of havuz) {
    const optN = (ev.options || []).length || 1;
    for (let idx = 0; idx < optN; idx++) {
      const G = fresh(400 + cozulen % 7);
      G.inbox.unshift({ id: 'uc-ev', cat: 'olay', t: ev.title, b: '', action: 'event', event: ev });
      try {
        A.resolveEvent(G, 'uc-ev', idx);
        const n = nanAv(G);
        if (n) { sorun.push(`${ev.id}[${idx}]: NaN ${n}`); continue; }
        if (!Object.values(G.gauges).every((v) => v >= 0 && v <= 100)) { sorun.push(`${ev.id}[${idx}]: gauge taştı`); continue; }
        cozulen++;
      } catch (e) { sorun.push(`${ev.id}[${idx}]: ${e.message}`); }
    }
  }
  check(`olay matrisi: ${havuz.length} olayın tüm seçenekleri (${cozulen} çözüm) temiz`, sorun.length === 0, sorun.slice(0, 3).join(' · ') || 'tam');
}

console.log('\n═══ D) UÇ DURUM EKRAN TARAMASI — 8 sınır-durum state ═══');
{
  const durumlar = [];
  // 1: meteliksiz + borç kayyum sınırının 1 altında
  durumlar.push(['meteliksiz-eşik', (G) => { G.economy.kasa = 0; G.ozel.nakit = 0; G.economy.borc = A.iflasEsigi(G) - 1; }]);
  // 2: minimum kadro
  durumlar.push(['kadro-14', (G) => { G.squad = G.squad.slice(0, 14); }]);
  // 3: revir dolu — herkes sakat
  durumlar.push(['hepsi-sakat', (G) => { for (const p of G.squad) p.injuryWeeks = 3; }]);
  // 4: gösterge uçları
  durumlar.push(['gauge-uçları', (G) => { G.gauges.guven = 0; G.gauges.itibar = 0; G.gauges.mali = 0; G.gauges.taraftar = 100; G.gauges.sportif = 100; }]);
  // 5: özel hayat tavan — tüm varlıklar zirve + rozetler + sv8
  durumlar.push(['özel-tavan', (G) => {
    const oz = G.ozel; oz.nakit = 999;
    for (const k of Object.keys(VARLIK)) oz.varlik[k] = VARLIK[k].adlar.length;
    for (const r of ['aile', 'comert', 'medya', 'gece']) oz.rozet[r] = true;
    oz.xp = 999; oz.seviye = 8;
  }]);
  // 6: sponsor imparatorluğu + aktif av kartı
  durumlar.push(['sponsor-dolu-av', (G) => {
    for (const slot of ['gogus', 'kol']) { const o = (A.sponsorOffers(G, slot) || [])[0]; if (o) A.signSponsor(G, slot, o.id); }
    G.inbox.unshift({ id: 'uc-av', action: 'spBuyout', slot: 'gogus', avCeza: 12, t: 'AV', b: 'test', avTeklif: { id: 'x', name: 'UçHolding', sektor: 'holding', ik: '🦅', type: 'standart', incomeMult: 1.2, weekly: 1, annual: 52, pesinat: 9, fesihCeza: 30, years: 2 } });
  }]);
  // 7: 2. lig + mega stad + naming açık (çapraz özellik)
  durumlar.push(['lig2-mega', (G) => { G.lig = 2; G.megaStad = true; G.facilities.stadyum = 10; G.club.stadiumCapacity = 62000; }]);
  // 8: hanedan tam + boşanmış başkan
  durumlar.push(['hanedan-boşanmış', (G) => {
    const oz = G.ozel; oz.flags.bosandi = true; oz.flags.kizKulupte = true; oz.flags.ogulKadroda = true; oz.iliski.es = 15;
    G.derbi = { W: 9, D: 3, L: 4 }; G.magSeri = 2;
  }]);
  let temiz = 0; const dertli = [];
  for (const [ad, kur] of durumlar) {
    const G = fresh(500 + temiz);
    for (let w = 0; w < 3; w++) hizliHafta(G); // biraz doğal akış — inbox/piyasa dolsun
    try { kur(G); tamTara(G, ad); temiz++; } catch (e) { dertli.push(`${ad}: ${e.message}`); }
  }
  check('8 uç-durum state\'inde 15 ekran + modallar temiz', dertli.length === 0, dertli.slice(0, 2).join(' · ') || `${temiz}/8`);
}

console.log('\n═══ E) FAZ-ORTASI KAYIT/YÜKLEME — her fazda göç + render ═══');
{
  const gorulen = {}; const dertli = [];
  const kaydet = (G, faz) => {
    if (gorulen[faz]) return G;
    gorulen[faz] = true;
    try {
      const g2 = A.migrateLoaded(Object.assign(JSON.parse(JSON.stringify({ ...G, data: undefined })), { data }));
      const cizici = { SEASON_END: () => seasonEnd.render(g2), CAMPAIGN: () => renderCampaign(g2), DEBATE: () => renderDebate(g2), ELECTION_NIGHT: () => { g2.election.revealStep = 7; return electionNight.render(g2); }, OPPOSITION: () => oppositionUi.render(g2), CAREER_END: () => careerEndUi.render(g2), SEASON_LOOP: () => cockpit.render(g2) }[faz];
      const html = cizici ? cizici() : '';
      if (/undefined|NaN/.test(html)) throw new Error('sızıntı');
      return g2;
    } catch (e) { dertli.push(`${faz}: ${e.message}`); return G; }
  };
  setSeed(9911);
  let G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  let emniyet = 0;
  while (Object.keys(gorulen).length < 6 && emniyet++ < 14) {
    for (let s = 0; s < 3 && G.phase === 'SEASON_LOOP'; s++) {
      for (let w = 1; w <= G.SEASON_WEEKS && G.phase === 'SEASON_LOOP'; w++) hizliHafta(G);
      if (G.phase !== 'SEASON_LOOP') break;
      A.endSeason(G); G = kaydet(G, 'SEASON_END');
      A.afterSeasonEnd(G); G.transition = null;
      if (G.phase === 'SEASON_LOOP') G = kaydet(G, 'SEASON_LOOP');
    }
    // seçimi KAYBETTİR: uç senaryo — muhalefet + kariyer kapanışı fazları da görülsün
    if (G.phase === 'CAMPAIGN') { G.gauges.guven = 4; G.gauges.taraftar = 6; G.economy.borc = 350; }
    let g = 0;
    while (G.phase === 'CAMPAIGN' && g++ < 10) { G = kaydet(G, 'CAMPAIGN'); A.campaignDo(G, 'taraftarMitingi'); A.advanceCampaign(G); }
    g = 0;
    while (G.phase === 'DEBATE' && g++ < 6) { G = kaydet(G, 'DEBATE'); A.answerDebate(G, 'vizyon'); }
    if (G.phase === 'ELECTION_NIGHT') {
      G = kaydet(G, 'ELECTION_NIGHT');
      if (G.election.kazandi) { A.startNewTerm(G); A.chooseVision(G, 'sportif'); continue; }
      A.afterElectionLoss(G);
      if (G.phase === 'OPPOSITION') {
        G = kaydet(G, 'OPPOSITION');
        let og = 0; while (G.opposition && G.opposition.season < 3 && og++ < 5) A.oppositionNext(G);
        A.startComeback(G);
        og = 0; while (G.phase === 'CAMPAIGN' && og++ < 6) { A.campaignDo(G, 'taraftarMitingi'); A.advanceCampaign(G); }
        if (G.phase === 'ELECTION_NIGHT') { if (G.election.kazandi) { A.applyComebackWin(G); A.startNewTerm(G); A.chooseVision(G, 'sportif'); } else A.afterElectionLoss(G); }
      }
      if (G.phase === 'CAREER_END') { G = kaydet(G, 'CAREER_END'); setSeed(9922); G = A.newGame(data, 'normal'); A.selectClub(G, 'orta'); A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' }); }
    } else if (G.phase === 'CAREER_END' || G.phase === 'GAME_OVER') {
      G = kaydet(G, 'CAREER_END'); setSeed(9922); G = A.newGame(data, 'normal'); A.selectClub(G, 'orta'); A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
    }
  }
  const fazlar = ['SEASON_END', 'SEASON_LOOP', 'CAMPAIGN', 'DEBATE', 'ELECTION_NIGHT', 'CAREER_END'];
  const eksik = fazlar.filter((f) => !gorulen[f]);
  check('6 kritik fazın her birinde kayıt→göç→render turu atıldı', eksik.length === 0 && dertli.length === 0, dertli.slice(0, 2).join(' · ') || (eksik.length ? 'görülmedi: ' + eksik.join(',') : Object.keys(gorulen).join(' ')));
}

console.log('\n═══ F) MOD × ZORLUK MATRİSİ — 4 hafta smoke + ekran ═══');
{
  const matris = [['klasik', 'normal'], ['aile', 'normal'], ['vitrin', 'normal'], ['ironman', 'normal'], ['klasik', 'kolay'], ['klasik', 'zor'], ['klasik', 'efsane']];
  const dertli = [];
  for (const [mode, zorluk] of matris) {
    try {
      const G = fresh(700 + matris.indexOf([mode, zorluk]), 'orta', zorluk, mode);
      G.mode = mode;
      for (let w = 0; w < 4 && G.phase === 'SEASON_LOOP'; w++) hizliHafta(G);
      tamTara(G, `${mode}/${zorluk}`);
      const n = nanAv(G); if (n) throw new Error('NaN ' + n);
    } catch (e) { dertli.push(`${mode}/${zorluk}: ${e.message}`); }
  }
  check('7 mod/zorluk kombinasyonu: 4 hafta + tam tarama temiz', dertli.length === 0, dertli.slice(0, 2).join(' · ') || '7/7');
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
