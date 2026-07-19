// tests/sinama.test.mjs — SON PAKET SINAMASI: bu oturumda eklenen HER ŞEY 10 sezonluk gerçek
// akışta zorlanır + ÖLÜ TUŞ DENETİMİ (data-act ↔ dispatch eşleşmesi — etki vermeyen tuş yasak).
// Kapsam: sponsor canlı pazar + SPONSOR AVI + kayyum paketi · 5 kademe seviye · boşanma yayı ·
// showroom varlıkları + imtiyazlar · moral gecesi · prim güçlendirme (alışkanlık+iz) · arketip
// ilanları · takım nabzı · ayarlar sb-kabuğu · derbi bilançosu. Çalıştır: node tests/sinama.test.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { varlikPerkleri } from '../src/engines/ozel.js';
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

// ═══ BÖLÜM 1: ÖLÜ TUŞ DENETİMİ — her data-act'in dispatch karşılığı OLMAK ZORUNDA ═══
console.log('\n═══ ÖLÜ TUŞ DENETİMİ (data-act ↔ dispatch) ═══');
{
  const uiDir = new URL('../src/ui/', import.meta.url);
  const kaynaklar = readdirSync(uiDir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(new URL(f, uiDir), 'utf8'));
  kaynaklar.push(readFileSync(new URL('../src/main.js', import.meta.url), 'utf8'));
  const actler = new Set();
  for (const src of kaynaklar) for (const m of src.matchAll(/data-act="([a-zA-Z0-9_]+)"/g)) actler.add(m[1]);
  const mainSrc = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const handled = new Set();
  for (const m of mainSrc.matchAll(/case '([a-zA-Z0-9_]+)':/g)) handled.add(m[1]);
  const BILEREK = new Set(['noop']); // tıklama-yut: modal içi alanlar (kapatmayı engeller — bilinçli)
  const olu = [...actler].filter((a) => !handled.has(a) && !BILEREK.has(a));
  check(`UI'daki ${actler.size} data-act'in TAMAMI dispatch'te karşılanıyor (ölü tuş yok)`, olu.length === 0, olu.length ? 'ÖLÜ: ' + olu.join(', ') : 'temiz');
}

// ═══ BÖLÜM 2: 10 SEZONLUK YENİ-ÖZELLİK MARATONU ═══
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
function sezonKontrol(G, et) {
  const hata = (m) => { throw new Error(`${et} · İNVARYANT: ${m}`); };
  if (G.squad.length < 14 || G.squad.length > 50) hata(`kadro ${G.squad.length}`);
  for (const [k, v] of Object.entries(G.gauges)) if (!Number.isFinite(v) || v < 0 || v > 100) hata(`gauge ${k}=${v}`);
  if (!Number.isFinite(G.economy.kasa)) hata(`kasa ${G.economy.kasa}`);
  if (!Number.isFinite(G.economy.borc) || G.economy.borc < 0) hata(`borç ${G.economy.borc}`);
  if (G.ozel && (!Number.isFinite(G.ozel.nakit) || G.ozel.nakit < 0)) hata(`özel nakit ${G.ozel.nakit}`);
  if ((G.primMacSeri || 0) < 0 || (G.magSeri || 0) < 0) hata('prim/mağlubiyet seri negatif');
  const n = nanAv(G); if (n) hata(`NaN: ${n}`);
}
function ekranTara(G, et) {
  let html = '';
  const ciz = (ad, fn) => { try { html += fn(); } catch (e) { throw new Error(`${et} · ${ad}: ${e.message}`); } };
  if (G.phase === 'SEASON_LOOP') {
    const E = { cockpit, kadro: squadView, transfer: transferView, tesis: facilitiesView, finans: finance, medya: media, kongre: congress, veri: dataHub, kulup: clubView, inbox: inboxUi, ayarlar: settingsUi };
    for (const [ad, m] of Object.entries(E)) { G.nav = ad; ciz(ad, () => m.render(G)); }
    for (const t of ['genel', 'servet', 'defter']) { G._ozelTab = t; ciz('ozel/' + t, () => ozelUi.render(G)); }
    G._pcard = G.squad[0]?.id; ciz('kart', () => playerCard.render(G)); G._pcard = null;
  } else if (G.phase === 'SEASON_END') ciz('sezonSonu', () => seasonEnd.render(G));
  else if (G.phase === 'ELECTION_NIGHT') ciz('seçim', () => electionNight.render(G));
  else if (G.phase === 'CAMPAIGN') ciz('kampanya', () => renderCampaign(G));
  else if (G.phase === 'DEBATE') ciz('münazara', () => renderDebate(G));
  else if (G.phase === 'OPPOSITION') ciz('muhalefet', () => oppositionUi.render(G));
  else if (G.phase === 'CAREER_END') ciz('kariyerSonu', () => careerEndUi.render(G));
  if (/undefined|NaN/.test(html)) {
    const i = html.search(/undefined|NaN/);
    throw new Error(`${et} · sızıntı: …${html.slice(Math.max(0, i - 70), i + 40).replace(/\s+/g, ' ')}…`);
  }
  const flo = html.match(/\d+\.\d{4,}\s*mn/); if (flo) throw new Error(`${et} · fmt'siz sayı: "${flo[0]}"`);
}
function telefonCevap(G, ph) {
  if (!ph) return 0;
  if (ph.kind === 'skandal') return 0;
  if (ph.kind === 'meydan') return 1;
  if (ph.kind === 'dlsell') { const p = G.squad.find((x) => x.id === ph.playerId); return p && !p.aileOgul && p.age >= 31 && p.overall < 80 ? 0 : 1; }
  if (ph.kind === 'dlbuy' || ph.kind === 'kriz') { const i = (ph.options || []).findIndex((o) => (o.key || '').includes('beklet')); return i >= 0 ? i : Math.max(0, (ph.options || []).length - 1); }
  return 0;
}

const KANIT = { av: 0, avRed: 0, kayyum: 0, moralGecesi: 0, primIz: 0, ilan: 0, sponsorImza: 0, varlikAlim: 0 };

function hafta(G, w, sezon, donem) {
  A.beginWeek(G);
  let g = 0; while (G.phone && g++ < 8) A.answerPhone(G, telefonCevap(G, G.phone));
  // PRİM TAKTİĞİ (yeni mekanik): taze prim tam güç — bot bunu bilir; 3 haftada bir dinlendirir
  const taze = (G.primMacSeri || 0) === 0;
  A.setMatchPrim(G, taze ? (w % 3 === 0 ? 'yuksek' : 'normal') : 'yok');
  const w0 = G.season.W, primSecim = G.matchPrim;
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
    A.htDecision(G, ['tdguven', 'soyunma'][w % 2]);
    const r = A.finishWeek(G);
    if (r && r.waitLate) A.lateDecision(G, 'devam');
  }
  if (G.season.W > w0 && primSecim !== 'yok' && taze) KANIT.primIz++; // taze primli galibiyet → iz yolu koştu
  g = 0; while (G.phone && g++ < 8) A.answerPhone(G, telefonCevap(G, G.phone));
  if (G.deskCard && !G.deskUsedThisTick) A.deskAction(G);
  for (const m of G.inbox) {
    if (m.resolved) continue;
    if (m.action === 'tfile') {
      const f = m.file, nakit = G.economy.kasa - 10;
      if (G.squad.length >= 28 || (f?.fee ?? 99) > nakit) A.resolveTransferFile(G, m.id, 'red');
      else A.resolveTransferFile(G, m.id, 'onay');
    } else if (m.action === 'sfile') {
      const p = G.squad.find((x) => x.id === m.file?.playerId);
      A.resolveSaleFile(G, m.id, p && !p.aileOgul && p.age >= 31 && p.overall < 80 ? 'sat' : 'red');
    } else if (m.action === 'spBuyout') { // SPONSOR AVI: dönem tek→kabul, çift→sadakat
      if (donem % 2 === 1) { A.resolveSponsorBuyout(G, m.id, 'kabul'); KANIT.av++; }
      else { A.resolveSponsorBuyout(G, m.id, 'red'); KANIT.avRed++; }
    } else if (m.action === 'kayyum') { A.kayyumPaket(G, m.id, G.squad.length > 24 ? 'sat' : 'red'); KANIT.kayyum++; }
    else if (m.action === 'event') A.resolveEvent(G, m.id, 0);
    else if (m.action === 'board') A.resolveBoard(G, m.id, 'sportif');
    else if (m.action === 'lfile') A.resolveLoanFile(G, m.id, 'kalsin');
    else if (m.action === 'douse') A.dousePress(G, m.id);
    else if (m.action === 'captain') A.resolveCaptain(G, m.id, 'onay');
    else if (m.action === 'seasonBudget') A.resolveSeasonBudget(G, m.id, 'onay');
    else if (m.action === 'bankLoan') A.resolveBankLoan(G, m.id, 'red');
    else if (m.action === 'ticket') A.resolveTicket(G, m.id, 1.0);
    else if (m.action === 'stfile') A.hireStaffFile(G, m.id, 0);
    else if (m.action === 'cfile') A.hireCoachFile(G, m.id, 0);
    else if (m.action === 'agenda') { let ga = 0; while (!m.resolved && ga++ < 4) A.resolveAgenda(G, m.id, 'vizyon'); }
  }
  // ARKETİP İLANLARI (yeni kartların gerçek argümanları) — rotasyonla üçü de denenir
  if (G.transferWindow && !G.ilan && w % 8 === 2) {
    const tip = [['FWD', 20, 18], ['MID', 31, 45], ['DEF', 31, 15]][(sezon + w) % 3];
    if (A.ilanVer(G, { pos: tip[0], yasMax: tip[1], tavan: tip[2] }).ok !== false) KANIT.ilan++;
  }
  // SPONSOR: boş slota temiz teklif — av dosyalarının hedefi olsun diye erken imza
  if (w % 5 === 2) for (const slot of ['gogus', 'kol', 'naming']) {
    const secim = (G.sponsorPazari?.[slot] || []).find((o) => !o.riskProfile && !o.dezavantaj);
    if (!G.sponsorDeals?.[slot] && secim) { if (A.signSponsor(G, slot, secim.id)) KANIT.sponsorImza++; break; }
  }
  if (w === 8 && G.economy.kasa > 45) { A.upgradeFacility(G, ['antrenman', 'akademi', 'tibbi', 'ticari', 'stadyum'][sezon % 5]); if (G.tender) A.chooseTender(G, w % 3); }
  if (w === 14 && G.economy.kasa > 40 && G.economy.borc > 0) A.payDebtAmount(G, 20);
  A.makeDemec(G, w % 9 === 5 ? 'iddiali' : 'sakin');
  // ÖZEL HAYAT — yeni özellik yoğun kullanım
  const oz = G.ozel;
  if (oz) {
    if ((G.magSeri || 0) >= 2 && A.ozelDavet(G, 'moral').ok) KANIT.moralGecesi++; // KRİZ SOFRASI
    if (oz.olay) A.ozelKarar(G, w % 2);
    if (w % 6 === 5 && oz.nakit >= 2) A.ozelBagis(G, 2);
    for (const k of ['oto', 'sanat', 'tekne', 'hava', 'konut']) if (A.ozelVarlik(G, k).ok) { KANIT.varlikAlim++; break; }
    if (w % 4 === 1 && oz.nakit >= 3) for (const id of ['altyapi', 'yemek', 'tekne', 'hayir']) if (A.ozelDavet(G, id).ok) break;
    const aday = G.squad.find((p) => !p.loanIn); if (aday) A.playerJest(G, aday.id);
    if (w % 6 === 2) A.ozelRoportaj(G);
    G._vitrin = { kat: ['konut', 'oto', 'tekne', 'hava', 'sanat'][w % 5], idx: w % 4 }; // vitrin fuzz (salt UI)
  }
  if (w % 12 === 6) ekranTara(G, `S${sezon}H${w}`); // dönem içi tam süpürme (ayarlar+defter dahil)
  G.pendingMatch = null;
}

console.log('\n═══ 10 SEZONLUK YENİ-ÖZELLİK MARATONU ═══');
let hata = null, sezonSay = 0, G = null;
const VAATLER = (d) => (d === 1 ? ['P04', 'P15'] : d % 2 ? ['P10', 'P15'] : ['P13']);
try {
  setSeed(7171);
  G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  let donem = 0, tur = 0;
  while (sezonSay < 10 && tur++ < 8) {
    donem++;
    A.startTerm(G, VAATLER(donem), { budget: donem === 1 ? 70 : 45, line: 'hazir' });
    if (donem === 2) { // kayıt/yükleme provası — yeni alanlar (derbi, magSeri, _spAvCd, vitrin...) göçe dayanıklı mı
      const raw = JSON.stringify({ ...G, data: undefined, _vitrin: undefined });
      G = A.migrateLoaded(Object.assign(JSON.parse(raw), { data }));
    }
    for (let s = 1; s <= 3 && sezonSay < 10; s++) {
      for (let w = 1; w <= G.SEASON_WEEKS && G.phase === 'SEASON_LOOP'; w++) hafta(G, w, sezonSay + 1, donem);
      if (G.phase !== 'SEASON_LOOP') break;
      A.endSeason(G);
      sezonSay++;
      // KARİYER SIFIRLANABİLİR (seçim kaybı) — kanıtlar koşu boyu ZİRVEDEN izlenir, final-G'den değil
      KANIT.maxPerk = Math.max(KANIT.maxPerk || 0, varlikPerkleri(G.ozel || { varlik: {} }).length);
      const dd = G.derbi || { W: 0, D: 0, L: 0 };
      KANIT.maxDerbi = Math.max(KANIT.maxDerbi || 0, dd.W + dd.D + dd.L);
      ekranTara(G, `S${sezonSay}-son`);
      sezonKontrol(G, `S${sezonSay}`);
      A.afterSeasonEnd(G);
      G.transition = null;
      if (G.phase === 'SEASON_LOOP') ekranTara(G, `S${sezonSay}-yeni`);
    }
    let g = 0;
    while (G.phase === 'CAMPAIGN' && g++ < 10) { A.campaignDo(G, (G.campaign?.kp ?? 0) >= 2 ? 'projeLansmani' : 'taraftarMitingi'); A.advanceCampaign(G); }
    g = 0;
    while (G.phase === 'DEBATE' && g++ < 6) A.answerDebate(G, 'vizyon');
    if (G.phase === 'ELECTION_NIGHT') {
      G.election.revealStep = 7; ekranTara(G, `D${donem}-seçim`);
      if (G.election.kazandi) { A.startNewTerm(G); A.chooseVision(G, 'sportif'); }
      else {
        A.afterElectionLoss(G);
        if (G.phase === 'OPPOSITION') {
          let og = 0; while (G.opposition && G.opposition.season < 3 && og++ < 5) A.oppositionNext(G);
          A.startComeback(G);
          og = 0; while (G.phase === 'CAMPAIGN' && og++ < 6) { A.campaignDo(G, 'taraftarMitingi'); A.advanceCampaign(G); }
          if (G.phase === 'ELECTION_NIGHT' && G.election.kazandi) { A.applyComebackWin(G); A.startNewTerm(G); A.chooseVision(G, 'sportif'); }
          else if (G.phase === 'ELECTION_NIGHT') A.afterElectionLoss(G);
        }
        if (G.phase === 'CAREER_END') { setSeed(8000 + donem); G = A.newGame(data, 'normal'); A.selectClub(G, 'orta'); }
      }
    } else if (G.phase === 'CAREER_END' || G.phase === 'GAME_OVER') {
      setSeed(8000 + donem); G = A.newGame(data, 'normal'); A.selectClub(G, 'orta');
    }
  }
} catch (e) { hata = e; }

check('10 sezon kesintisiz — sıfır çökme, her 12 haftada 15-ekran süpürmesi temiz', !hata && sezonSay >= 10, hata ? String(hata.message || hata) : `${sezonSay} sezon`);
if (!hata && G) {
  check('KANIT · prim izi yolu koştu (taze primli galibiyetler)', KANIT.primIz >= 5, `${KANIT.primIz} taze-prim galibiyeti`);
  check('KANIT · kriz sofrası kuruldu (moral gecesi ≥1)', KANIT.moralGecesi >= 1, `${KANIT.moralGecesi} sofra`);
  check('KANIT · sponsor pazarı yaşadı: imza + av dosyası', KANIT.sponsorImza >= 3 && (KANIT.av + KANIT.avRed) >= 1, `${KANIT.sponsorImza} imza · ${KANIT.av} av-kabul · ${KANIT.avRed} av-red`);
  check('KANIT · arketip ilanları verildi', KANIT.ilan >= 3, `${KANIT.ilan} ilan`);
  check('KANIT · showroom varlıkları alındı + imtiyazlar aktifleşti (koşu zirvesi)', KANIT.varlikAlim >= 6 && (KANIT.maxPerk || 0) >= 3, `${KANIT.varlikAlim} alım · zirvede ${KANIT.maxPerk} imtiyaz`);
  check('KANIT · derbi bilançosu işledi (koşu zirvesi)', (KANIT.maxDerbi || 0) >= 2, `zirvede ${KANIT.maxDerbi} derbi`);
  check('prim alışkanlık sayacı sağlıklı (negatif değil, sonlu)', Number.isFinite(G.primMacSeri || 0) && (G.primMacSeri || 0) >= 0);
  const son = nanAv(G);
  check('final derin NaN taraması temiz', !son, son || '');
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
