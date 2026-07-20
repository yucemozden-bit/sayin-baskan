// tests/sahne.test.mjs — SAHNE TARAMASI (2026-07-22 "devasa test"): her ekran modülü × TUHAF
// durumlar. maraton normal akışı tarar; BU test uç durumları kurar: dev/efsane tier, 2. Lig,
// muhalefet, seçim gecesi tüm perde adımları, şampiyon/küme sezon sonu, kart varyantları
// (sakat+cezalı+kiralık+vitrin+kaptan), transfer filtre/sayfa kombinleri, arşivler dolu medya.
// Beklenti: hiçbir render fırlatmaz, çıktıda undefined/NaN sızmaz.
// Çalıştır: node tests/sahne.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
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
import * as playerCard from '../src/ui/playerCard.js';
import * as seasonEnd from '../src/ui/seasonEnd.js';
import * as electionNight from '../src/ui/electionNight.js';
import * as oppositionUi from '../src/ui/opposition.js';
import * as careerEndUi from '../src/ui/careerEnd.js';
import * as matchday from '../src/ui/matchday.js';
import * as settingsUi from '../src/ui/settings.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function fresh(seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  return G;
}
function oynat(G, hafta) {
  while ((G.hazirlik || 0) > 0) A.preSeasonWeek(G);
  for (let i = 0; i < hafta; i++) { A.advanceWeek(G); G.pendingMatch = null; }
}
// tek render denetimi: fırlatmaz + sızıntı yok
function sahne(ad, fn) {
  let h = '', err = null;
  try { h = fn() || ''; } catch (e) { err = e; }
  const m = err ? null : String(h).match(/.{0,40}(undefined|NaN).{0,25}/);
  check(`sahne: ${ad}`, !err && !m, err ? String(err.message || err).slice(0, 90) : m ? `sızıntı "…${m[0]}…"` : '');
}

console.log('\n── NAV EKRANLARI × TIER/LİG UÇLARI ──');
{
  const G = fresh();
  oynat(G, 6);
  const NAVLAR = { cockpit, kadro: squadView, transfer: transferView, tesis: facilitiesView, finans: finance, medya: media, kongre: congress, veri: dataHub, kulup: clubView, inbox: inboxUi, ayarlar: settingsUi };
  for (const tier of ['kucuk', 'orta', 'buyuk', 'dev', 'efsane']) {
    G.club.tier = tier;
    for (const [ad, mod] of Object.entries(NAVLAR)) { G.nav = ad; sahne(`${tier} tier · ${ad}`, () => mod.render(G)); }
  }
  G.club.tier = 'orta';
  // 2. Lig görünümü
  G.lig = 2;
  for (const [ad, mod] of Object.entries(NAVLAR)) { G.nav = ad; sahne(`2.lig · ${ad}`, () => mod.render(G)); }
  G.lig = 1;
  // özel hayat tüm sekmeler
  for (const t of ['genel', 'aile', 'servet', 'sohbet']) { G._ozelTab = t; sahne(`özel/${t}`, () => ozelUi.render(G)); }
}

console.log('\n── OYUNCU KARTI VARYANTLARI ──');
{
  const G = fresh(7);
  oynat(G, 3);
  const p = G.squad[0];
  p.injuryWeeks = 3; p.suspensionWeeks = 1; p.vitrin = true; p.kiralikListe = true;
  G.captainId = p.id;
  G._pcard = p.id;
  sahne('kart: sakat+cezalı+vitrin+kiralıkListe+kaptan', () => playerCard.render(G));
  const kira = G.squad[1]; kira.loanIn = true; G._pcard = kira.id;
  sahne('kart: kiralık gelen', () => playerCard.render(G));
  const mp = (G.market || [])[0];
  if (mp) {
    G._pcard = mp.id;
    sahne('kart: sisli piyasa', () => playerCard.render(G));
    mp._sorgu = { guc: mp.overall, h: 1, maas: 2, tavir: 'katı', karakter: 'Hırslı', sakatlik: 'temiz', ilgi: 2 };
    sahne('kart: sorgulu piyasa', () => playerCard.render(G));
    mp._derin = true;
    sahne('kart: derin raporlu piyasa', () => playerCard.render(G));
  }
  G._pcard = 'olmayan-id';
  sahne('kart: hayalet id (boş dönmeli)', () => playerCard.render(G));
}

console.log('\n── MAÇ GÜNÜ PERDELERİ ──');
{
  const G = fresh(11);
  while ((G.hazirlik || 0) > 0) A.preSeasonWeek(G);
  A.advanceWeek(G);
  if (G.pendingMatch) {
    sahne('maç: pre', () => matchday.render(G));
    A.htDecision(G, 'tdguven');
    if (G.pendingMatch) {
      for (const ph of ['live', 'post']) {
        if (G.pendingMatch.phase !== ph && ['live', 'post'].includes(G.pendingMatch.phase)) { /* akış kendisi taşır */ }
        if (G.pendingMatch.phase === 'live' && G.pendingMatch._clock === undefined) { G.pendingMatch._clock = 0; G.pendingMatch._playing = false; G.pendingMatch._speed = 1; }
        sahne(`maç: ${G.pendingMatch.phase}`, () => matchday.render(G));
        if (G.pendingMatch.phase === 'live') G.pendingMatch.phase = 'post';
        else break;
      }
    }
  } else check('sahne: maç perdeleri (ön koşul)', true, 'ilk hafta maç yok — atlandı');
  G.pendingMatch = null;
}

console.log('\n── TRANSFER FİLTRE/SAYFA/SIRALAMA KOMBİNLERİ ──');
{
  const G = fresh(13);
  oynat(G, 2);
  G.nav = 'transfer';
  for (const f of ['tumu', 'GK', 'DEF', 'MID', 'FWD', 'yildiz']) { G.trFiltre = f; sahne(`transfer filtre=${f}`, () => transferView.render(G)); }
  G.trFiltre = 'tumu';
  for (const s of ['guc', 'bedel', 'yas']) { G.trSirala = s; sahne(`transfer sırala=${s}`, () => transferView.render(G)); }
  G.trSayfa = 99; sahne('transfer sayfa=99 (taşma kelepçesi)', () => transferView.render(G));
  G.trSayfa = 0;
}

console.log('\n── SEZON SONU / SEÇİM / MUHALEFET / KAPANIŞ ──');
{
  // şampiyon sezon sonu
  const G = fresh(17);
  oynat(G, 1);
  while (G.meta.week < G.SEASON_WEEKS && G.phase === 'SEASON_LOOP') { A.advanceWeek(G); G.pendingMatch = null; }
  if (G.phase === 'SEASON_LOOP') A.endSeason(G);
  const s = G.lastSeason || {};
  sahne('sezon sonu: doğal', () => seasonEnd.render(G));
  s.champion = true; s.relegated = false;
  sahne('sezon sonu: ŞAMPİYON', () => seasonEnd.render(G));
  s.champion = false; s.relegated = true;
  sahne('sezon sonu: KÜME', () => seasonEnd.render(G));
}
{
  // seçim gecesi tüm perde adımları + iki sonuç
  const G = fresh(19);
  G.election = { oyOrani: 0.58, kazandi: true, revealStep: 0, counting: false, displayVote: 58, breakdown: { sportif: 10, taraftar: 8, mali: 6, itibar: 5, soz: 4, rival: -3, aile: 2, dEtki: 1, bloklar: [] } };
  G.phase = 'ELECTION_NIGHT';
  for (let r = 0; r <= 7; r++) { G.election.revealStep = r; sahne(`seçim gecesi adım ${r} (zafer)`, () => electionNight.render(G)); }
  G.election.kazandi = false; G.election.oyOrani = 0.41;
  G.election.revealStep = 7;
  sahne('seçim gecesi: kayıp + vedalar', () => electionNight.render(G));
}
{
  // muhalefet + kariyer sonu
  const G = fresh(23);
  oynat(G, 2);
  A.enterOpposition(G);
  sahne('muhalefet: giriş', () => oppositionUi.render(G));
  A.oppositionNext(G);
  sahne('muhalefet: 1. sezon sonrası', () => oppositionUi.render(G));
  A.endCareer(G, 'iki üst üste seçim kaybı');
  sahne('kariyer sonu: seçim kaybı', () => careerEndUi.render(G));
}
{
  const G = fresh(29);
  oynat(G, 2);
  A.endCareer(G, 'kulüp iflası — kayyum atandı');
  sahne('kariyer sonu: iflas/kayyum', () => careerEndUi.render(G));
  const G2 = fresh(31);
  oynat(G2, 2);
  A.retire(G2);
  sahne('kariyer sonu: emeklilik', () => careerEndUi.render(G2));
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
