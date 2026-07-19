// tests/maraton.test.mjs — 10 DÖNEM MARATONU (30+ sezon tam-sistem stres testi).
// "Meşgul Dengeli Başkan" GERÇEK aksiyonlarla 10 dönem oynar: vaat rotasyonu · staff · sponsor
// imzası · tesis+ihale · ilan/vitrin/sorgu/rapor · TD değişimi · kaptan vetosu · borç yönetimi ·
// kurul bütçesi · sosyal projeler · tam Özel Hayat · seçim/kampanya/münazara · kayıp→muhalefet→
// dönüş · kariyer kapanışı→yeni kariyer. Her sezon: derin invariant + ekran taraması + NaN avı.
// Çalıştır: node tests/maraton.test.mjs
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
import { renderCampaign, renderDebate } from '../src/ui/campaignView.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

// ── Derin NaN avcısı ──
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

// ── Sezon sonu derin invariant denetimi — bir tanesi bile bozulursa maraton kırılır ──
function sezonKontrol(G, et) {
  const hata = (m) => { throw new Error(`${et} · İNVARYANT: ${m}`); };
  if (G.squad.length < 14 || G.squad.length > 50) hata(`kadro boyutu ${G.squad.length}`);
  for (const p of G.squad) {
    if (!Number.isFinite(p.overall) || p.overall < 20 || p.overall > 99) hata(`${p.name} güç ${p.overall}`);
    if (!Number.isFinite(p.age) || p.age < 15 || p.age > 45) hata(`${p.name} yaş ${p.age}`);
    if (!Number.isFinite(p.wage) || p.wage < 0) hata(`${p.name} maaş ${p.wage}`);
    for (const k of ['morale', 'form', 'fitness']) if (!Number.isFinite(p[k]) || p[k] < 0 || p[k] > 100) hata(`${p.name} ${k}=${p[k]}`);
  }
  for (const [k, v] of Object.entries(G.gauges)) if (!Number.isFinite(v) || v < 0 || v > 100) hata(`gauge ${k}=${v}`);
  if (!Number.isFinite(G.economy.kasa) || G.economy.kasa < -1200) hata(`kasa ${G.economy.kasa}`);
  if (!Number.isFinite(G.economy.borc) || G.economy.borc < 0 || G.economy.borc > 1200) hata(`borç ${G.economy.borc}`);
  if (G.inbox.length > 30) hata(`inbox ${G.inbox.length}`);
  if ((G.mansetArsiv || []).length > 24) hata(`manşet arşivi ${G.mansetArsiv.length}`);
  const oz = G.ozel;
  if (oz) {
    if (oz.seviye < 1 || oz.seviye > 8) hata(`özel seviye ${oz.seviye}`);
    if (!Number.isFinite(oz.nakit) || oz.nakit < 0) hata(`özel nakit ${oz.nakit}`);
    for (const [k, v] of Object.entries(oz.g)) if (!Number.isFinite(v) || v < 0 || v > 100) hata(`özel ${k}=${v}`);
    if (oz.akis.length > 3 || oz.kullanilan.length > 8) hata('özel dizi taşması');
  }
  if (![1, 2].includes(G.lig || 1)) hata(`lig ${G.lig}`);
  const n = nanAv(G); if (n) hata(`NaN: ${n}`);
}

// ── Ekran taraması (faz-duyarlı) ──
function ekranTara(G, et) {
  let html = '';
  // TEŞHİS ZENGİN (2026-07-21): sızıntı hangi EKRANDA + hangi bağlamda — ekran başına ayrı tara
  const ciz = (ad, fn) => {
    let h = '';
    try { h = fn(); } catch (e) { throw new Error(`${et} · ${ad} ekranı: ${e.message}`); }
    const m = h.match(/.{0,50}(undefined|NaN).{0,30}/);
    if (m) throw new Error(`${et} · ${ad} ekranında sızıntı: "…${m[0]}…"`);
    html += h;
  };
  if (G.phase === 'SEASON_LOOP') {
    const E = { cockpit, kadro: squadView, transfer: transferView, tesis: facilitiesView, finans: finance, medya: media, kongre: congress, veri: dataHub, kulup: clubView, inbox: inboxUi };
    for (const [ad, m] of Object.entries(E)) { G.nav = ad; ciz(ad, () => m.render(G)); }
    for (const t of ['genel', 'servet']) { G._ozelTab = t; ciz('ozel/' + t, () => ozelUi.render(G)); }
    G._pcard = G.squad[0]?.id; ciz('kart', () => playerCard.render(G)); G._pcard = null;
  } else if (G.phase === 'SEASON_END') ciz('sezonSonu', () => seasonEnd.render(G));
  else if (G.phase === 'ELECTION_NIGHT') ciz('seçimGecesi', () => electionNight.render(G));
  else if (G.phase === 'CAMPAIGN') ciz('kampanya', () => renderCampaign(G));
  else if (G.phase === 'DEBATE') ciz('münazara', () => renderDebate(G));
  else if (G.phase === 'OPPOSITION') ciz('muhalefet', () => oppositionUi.render(G));
  else if (G.phase === 'CAREER_END') ciz('kariyerSonu', () => careerEndUi.render(G));
  if (/undefined|NaN/.test(html)) throw new Error(`${et} · ekranda undefined/NaN sızıntısı`);
  const flo = html.match(/\d+\.\d{4,}\s*mn/); if (flo) throw new Error(`${et} · fmt'siz sayı: "${flo[0]}"`); // 4+ hane: "2.040mn" binlik ayraç MUAF
}

// Telefon aklı (Dengeli çekirdeği): panik alıma "borçla al" DEMEZ — 0-cevap botu borcu 1920'ye şişirmişti
function telefonCevap(G, ph) {
  if (!ph) return 0;
  if (ph.kind === 'skandal') return 0;                                   // disiplin
  if (ph.kind === 'meydan') return 1;                                    // çamura girmez
  if (ph.kind === 'dlsell') { const p = G.squad.find((x) => x.id === ph.playerId); return p && !p.aileOgul && p.age >= 31 && p.overall < 80 ? 0 : 1; }
  if (ph.kind === 'dlbuy' || ph.kind === 'kriz') { const i = (ph.options || []).findIndex((o) => (o.key || '').includes('beklet')); return i >= 0 ? i : Math.max(0, (ph.options || []).length - 1); }
  if (ph.kind === 'kontrat') { const i = (ph.options || []).findIndex((o) => o.key === 'pazarlik'); return i >= 0 ? i : 0; }
  return 0;                                                              // aile dahil: sıcak seçenek
}

// ── Meşgul Dengeli Başkan: bir oyun haftası (tüm karar kanalları) ──
function hafta(G, w, sezon, donem) {
  const nanIzi = (et) => { for (const k of ['guven', 'taraftar', 'mali', 'itibar', 'sportif']) if (!Number.isFinite(G.gauges[k])) throw new Error(`GAUGE NaN İLK DOĞUŞ: ${k} @ D${donem}S${sezon}W${w} ${et} · myPos=${G.myPos} · maliHedef=${G.lastLedger?.maliHedef} · hedefSira=${G.club?.hedefSira} · beklenti=${G.club?.beklenti}`); };
  A.beginWeek(G);
  nanIzi('beginWeek');
  let g = 0; while (G.phone && g++ < 8) A.answerPhone(G, telefonCevap(G, G.phone));
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
    A.htDecision(G, ['tdguven', 'soyunma'][w % 2]); // tribün kumarı yok — kayıpta taraftar cezası birikiyor
    const r = A.finishWeek(G);
    if (r && r.waitLate) A.lateDecision(G, w % 6 === 0 ? 'dok' : 'devam');
  }
  nanIzi('finishWeek');
  g = 0; while (G.phone && g++ < 8) A.answerPhone(G, telefonCevap(G, G.phone));
  if (G.deskCard && !G.deskUsedThisTick) A.deskAction(G);
  // GM dosyaları + tüm inbox kararları — DENGELİ insan mantığı (körü körüne onay YOK:
  // teşhis koşumu her-dosyaya-onay botunun kulübü 839mn borca sürdüğünü gösterdi)
  for (const m of G.inbox) {
    if (m.resolved) continue;
    if (m.action === 'tfile') { // Dengeli mantığı: zayıf hattı yükselten dosya + BORÇLA TRANSFER YOK
      const f = m.file, mid = ((f?.range?.[0] ?? 60) + (f?.range?.[1] ?? 60)) / 2;
      const need = { GK: 1, DEF: 4, MID: 4, FWD: 2 }; let weakAvg = 99;
      for (const pos of ['GK', 'DEF', 'MID', 'FWD']) {
        const b = G.squad.filter((x) => x.pos === pos).sort((a, c) => c.overall - a.overall).slice(0, need[pos]);
        const avg = b.length ? b.reduce((s, x) => s + x.overall, 0) / b.length : 0;
        if (avg < weakAvg) weakAvg = avg;
      }
      const iyi = mid >= weakAvg + 2 || (f?.range?.[1] ?? 0) >= 80;
      const nakit = G.economy.kasa - 10;
      if (!iyi || G.squad.length >= 28) A.resolveTransferFile(G, m.id, 'red');
      else if (f.fee > nakit && !f.sartTried && f.fee <= nakit + 40) A.resolveTransferFile(G, m.id, 'sart');
      else A.resolveTransferFile(G, m.id, f.fee <= nakit ? 'onay' : 'red');
    } else if (m.action === 'sfile') {
      const p = G.squad.find((x) => x.id === m.file?.playerId);
      A.resolveSaleFile(G, m.id, p && !p.aileOgul && p.age >= 31 && p.overall < 80 ? 'sat' : 'red');
    } else if (m.action === 'event') A.resolveEvent(G, m.id, 0); // ilk seçenek: cömert/taraftar dostu
    else if (m.action === 'board') A.resolveBoard(G, m.id, 'sportif');
    else if (m.action === 'lfile') A.resolveLoanFile(G, m.id, w % 2 ? 'gonder' : 'kalsin');
    else if (m.action === 'douse') A.dousePress(G, m.id);
    else if (m.action === 'captain') A.resolveCaptain(G, m.id, donem % 3 === 2 ? 'veto' : 'onay');
    else if (m.action === 'seasonBudget') A.resolveSeasonBudget(G, m.id, 'onay');
    else if (m.action === 'bankLoan') A.resolveBankLoan(G, m.id, G.economy.borc < 100 && donem % 3 === 1 ? 'kabul' : 'red');
    else if (m.action === 'ticket') A.resolveTicket(G, m.id, donem % 2 ? 1.0 : 0.8); // zam yok — tribün küstürülmez
    else if (m.action === 'stfile') A.hireStaffFile(G, m.id, 0);
    else if (m.action === 'cfile') A.hireCoachFile(G, m.id, 0);
    else if (m.action === 'agenda') { let ga = 0; while (!m.resolved && ga++ < 4) A.resolveAgenda(G, m.id, ['vizyon', 'veri', 'taraftar'][ga % 3]); }
  }
  // pencere işleri
  if (G.transferWindow) {
    if (!G.ilan && w % 9 === 2) A.ilanVer(G, { pos: ['FWD', 'MID', 'DEF'][donem % 3], yasMax: 29, tavan: 30 });
    const aday = (G.market || [])[w % Math.max(1, (G.market || []).length)];
    if (aday && w % 6 === 1) { A.sorgulaPlayer(G, aday.id, {}); if (G.economy.kasa > 1) A.derinRapor(G, aday.id); if (w % 12 === 1) A.requestOffer(G, aday.id); }
    if (w % 10 === 4) { const y = G.squad.filter((p) => p.age >= 31 && !p.vitrin && !p.aileOgul)[0]; if (y && G.squad.length > 24) A.vitrinToggle(G, y.id); }
  }
  // sponsor: boş slota TEMİZ teklif (bahis/kripto her imzada taraftar/itibar yakıyordu — 0-zafer avı);
  // riskli markayı yalnız 6. dönemde bilinçli dener (2.7 batma mekaniği de sahada test edilir)
  if (w % 7 === 3) for (const slot of ['gogus', 'kol', 'naming']) {
    const adaylar = G.sponsorPazari?.[slot] || [];
    const secim = donem === 6 ? adaylar[0] : (adaylar.find((o) => !o.riskProfile && !o.dezavantaj) || null);
    if (!G.sponsorDeals?.[slot] && secim) { A.signSponsor(G, slot, secim.id); break; }
  }
  // tesis + ihale + borç + kurul — VAAT TAKİBİ önce (P13 scout sözü tutulur)
  if (G.transferWindow && (G.promises || []).some((p) => p.id === 'P13' && p.kept === null) && G.facilities.scout < 3) { A.upgradeFacility(G, 'scout'); if (G.tender) A.chooseTender(G, 0); }
  if (w === 8 && G.economy.kasa > 45) { A.upgradeFacility(G, ['antrenman', 'akademi', 'tibbi', 'ticari'][donem % 4]); if (G.tender) A.chooseTender(G, 0); }
  if (w === 14 && G.economy.kasa > 40) A.payDebtAmount(G, Math.min(30, Math.round(G.economy.kasa - 15)));
  if (w === 26 && G.economy.kasa > 50 && G.economy.borc > 0) A.payDebtAmount(G, 20);
  if (w === 5 && sezon === 1 && donem % 3 === 1) A.kurulButceArtisi(G); // her dönem değil — Mali −6 bedeli birikiyordu
  if (w === 12) { const p = G.squad.find((x) => (x.baskanaGuven ?? 50) >= 55 && !x.loanIn && (x.contractYears ?? 0) < 4); if (p) A.renewContract(G, p.id); }
  // sosyal vaat TAKİBİ: P10 → dönemde 3 proje, P11 → kadın takımı, P20 → ofis (guard'lı)
  if ([6, 13, 20].includes(w) && sezon === 1) A.sosyalProje(G);
  if (w === 7 && sezon === 1) { A.kadinTakimiKur(G); A.yurtdisiOfisAc(G); }
  if (w === 20 && donem === 5 && sezon === 1) A.fireCoach(G); // TD değişimi stres testi
  // basın + telkin + prim — Dengeli çekirdeği: sakin dil, fitness'a göre telkin, prim sürekli
  A.makeDemec(G, w % 9 === 5 ? 'iddiali' : 'sakin');
  const xi = G.squad.slice().sort((a, b) => b.overall - a.overall).slice(0, 11);
  const avgFit = xi.reduce((s, p) => s + p.fitness, 0) / Math.max(xi.length, 1);
  A.setTelkin(G, avgFit < 72 ? 'rotasyon' : null); // mantıksız telkin spamı yok (sızıntı/kukla cezaları)
  if (w === 1) { A.setMatchPrim(G, 'normal'); if (!G.seriPrim) A.toggleSeriPrim(G, true); A.declareSeasonPrim(G); }
  if (w === 9) A.tisBulusma(G, 'samimi'); // taraftar ilişkileri dokunuşu (guard'lı)
  // ÖZEL HAYAT tam kullanım
  const oz = G.ozel;
  if (oz) {
    if (oz.olay) A.ozelKarar(G, w % 2);
    if (sezon === 1 && w % 6 === 5 && oz.nakit >= 2) A.ozelBagis(G, 2);
    for (const k of ['oto', 'sanat', 'tekne', 'hava', 'konut']) if (A.ozelVarlik(G, k).ok) break;
    if (w % 4 === 1 && oz.nakit >= 3) for (const id of ['altyapi', 'yemek', 'tekne', 'hayir']) if (A.ozelDavet(G, id).ok) break;
    const aday = G.squad.find((p) => !p.loanIn); if (aday) A.playerJest(G, aday.id);
    if (donem === 1 && sezon === 1 && w === 3) A.playerSoz(G, G.squad.find((p) => !p.loanIn && !p.relx?.soz)?.id);
    if (w % 6 === 2) A.ozelRoportaj(G);
    if (sezon === 1 && w === 2) { A.ozelProg(G, 'sosyal|-'); A.ozelProg(G, 'mesai|+'); }
  }
  G.pendingMatch = null;
}

// Vaat disiplini (autoplay-Dengeli dersi): TUTULABİLİR sözler ver, sonra window'da TAKİP ET —
// P01/P04 gibi tutulamazlar söz karnesini ve rakip çekiciliğini patlatıyordu (0-zafer teşhisi).
const VAATLER = (d) => (d === 1 ? ['P04', 'P15'] : d % 4 === 3 ? ['P10', 'P15'] : d % 4 === 1 ? ['P11', 'P15'] : ['P13']);
const DIREKTIF = (d) => ({ budget: d === 1 ? 70 : 45, line: 'hazir' }); // sabit tavan — borçla kese şişirme yok

function staffKur(G) {
  for (const role of ['cfo', 'akademi', 'basin', 'stat']) {
    if (G.staff[role]) continue;
    if (A.requestStaffFile(G, role).ok) { const m = G.inbox.find((x) => x.action === 'stfile' && !x.resolved); if (m) A.hireStaffFile(G, m.id, 0); }
  }
}

console.log('\n── 10 DÖNEM MARATONU (Meşgul Dengeli Başkan) ──');
const IST = { donem: 0, kazanilan: 0, dusus: 0, donus: 0, kariyer: 1, ligDegisim: 0, yasOrtSon: 0, kadroSon: 0 };
let hata = null;
try {
  setSeed(4242);
  let G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  let tur = 0;
  while (IST.donem < 10 && tur++ < 16) {
    const d = IST.donem + 1;
    A.startTerm(G, VAATLER(d), DIREKTIF(d));
    staffKur(G);
    // kayıt/yükleme provası: 4. ve 8. dönem başında
    if (d === 4 || d === 8) {
      const raw = JSON.stringify({ ...G, data: undefined });
      G = A.migrateLoaded(Object.assign(JSON.parse(raw), { data }));
    }
    for (let s = 1; s <= 3; s++) {
      const lig0 = G.lig || 1;
      for (let w = 1; w <= G.SEASON_WEEKS; w++) hafta(G, w, s, d);
      A.endSeason(G);
      ekranTara(G, `D${d}S${s}-son`);       // SEASON_END ekranı
      sezonKontrol(G, `D${d}S${s}`);
      A.afterSeasonEnd(G);
      G.transition = null;
      if ((G.lig || 1) !== lig0) IST.ligDegisim++;
      if (G.phase === 'SEASON_LOOP') ekranTara(G, `D${d}S${s}-yeni`); // 13 ekran taraması
    }
    // seçim fazları
    let g = 0;
    while (G.phase === 'CAMPAIGN' && g++ < 10) { ekranTara(G, `D${d}-kampanya`); A.campaignDo(G, (G.campaign?.kp ?? 0) >= 2 ? 'projeLansmani' : 'taraftarMitingi'); A.advanceCampaign(G); }
    g = 0;
    while (G.phase === 'DEBATE' && g++ < 6) { ekranTara(G, `D${d}-münazara`); A.answerDebate(G, 'vizyon'); }
    if (G.phase === 'ELECTION_NIGHT') {
      G.election.revealStep = 7; ekranTara(G, `D${d}-seçim`);
      if (G.ozel) IST.sonOzel = { sv: G.ozel.seviye, nakit: G.ozel.nakit }; // kariyer resetlerine dayanıklı rapor
      const _b = G.election.breakdown;
      console.log(`  D${d}: oy %${Math.round(G.election.oyOrani * 100)} ${G.election.kazandi ? 'ZAFER' : 'düşüş'} · sportif ${Math.round(_b.sportif)} taraftar ${Math.round(_b.taraftar)} mali ${Math.round(_b.mali)} itibar ${Math.round(_b.itibar)} söz ${Math.round(_b.soz)} rakip ${Math.round(_b.rival)} aile ${Math.round(_b.aile)} · swing ${G.election.debateSwing || 0} · pos ${G.myPos}`);
      IST.donem++;
      if (G.election.kazandi) {
        IST.kazanilan++;
        A.startNewTerm(G); A.chooseVision(G, ['sportif', 'mali', 'altyapi'][d % 3]);
      } else {
        IST.dusus++;
        A.afterElectionLoss(G);
        if (G.phase === 'OPPOSITION') {
          ekranTara(G, `D${d}-muhalefet`);
          let og = 0; while (G.opposition && G.opposition.season < 3 && og++ < 5) A.oppositionNext(G);
          A.startComeback(G);
          og = 0; while (G.phase === 'CAMPAIGN' && og++ < 6) { A.campaignDo(G, (G.campaign?.kp ?? 0) >= 2 ? 'projeLansmani' : 'taraftarMitingi'); A.advanceCampaign(G); }
          if (G.phase === 'ELECTION_NIGHT' && G.election.kazandi) { IST.donus++; A.applyComebackWin(G); A.startNewTerm(G); A.chooseVision(G, 'sportif'); }
          else { if (G.phase === 'ELECTION_NIGHT') A.afterElectionLoss(G); }
        }
        if (G.phase === 'CAREER_END') {
          ekranTara(G, `D${d}-kariyerSonu`);
          IST.kariyer++;
          setSeed(5000 + d);
          G = A.newGame(data, 'normal'); A.selectClub(G, 'orta');
        }
      }
    } else if (G.phase === 'CAREER_END' || G.phase === 'GAME_OVER') {
      if (G.ozel) IST.sonOzel = { sv: G.ozel.seviye, nakit: G.ozel.nakit };
      IST.donem++; IST.kariyer++;
      setSeed(5000 + d);
      G = A.newGame(data, 'normal'); A.selectClub(G, 'orta');
    }
  }
  IST.yasOrtSon = Math.round(G.squad.reduce((a, p) => a + p.age, 0) / G.squad.length * 10) / 10;
  IST.kadroSon = G.squad.length;
  globalThis.SON_G = G;
} catch (e) { hata = e; }

check('10 dönem kesintisiz oynandı — SIFIR çökme', !hata && IST.donem >= 10, hata ? String(hata.message || hata) : `${IST.donem} dönem · ${IST.kariyer} kariyer`);
if (!hata) {
  const G = globalThis.SON_G;
  check('her sezon derin invariant + 13 ekran taraması temiz (30+ sezon)', true);
  // EFEKTİF-GÜÇ + progresyon buff'ları (2026-07-21): maraton botu güçlendi — düşüş nadirleşti
  // (ölçülen 9 zafer · 1 düşüş · 1 dönüş). Amaç YOLLARIN SAHNELENMESİ: her yol ≥1 yeterli.
  check('seçim döngüsü yaşadı: zafer + düşüş + DÖNÜŞ yolları hepsi sahnelendi', IST.kazanilan >= 2 && IST.dusus >= 1 && IST.donus >= 1, `${IST.kazanilan} zafer · ${IST.dusus} düşüş · ${IST.donus} dönüş · lig değişimi ${IST.ligDegisim}`);
  check('uzun vadede kadro sağlıklı: boyut 18-40, yaş ort 23-31', IST.kadroSon >= 18 && IST.kadroSon <= 40 && IST.yasOrtSon >= 23 && IST.yasOrtSon <= 31, `${IST.kadroSon} oyuncu · yaş ort ${IST.yasOrtSon}`);
  const so = IST.sonOzel || (G.ozel && { sv: G.ozel.seviye, nakit: G.ozel.nakit });
  check('özel hayat 10 dönemde tavana oturmadı (sv ≤ 8, nakit sonlu)', so && so.sv >= 1 && so.sv <= 8 && Number.isFinite(so.nakit), so ? `sv.${so.sv} · ₺${so.nakit}mn` : 'veri yok');
  check('ekonomi 30 sezonda raydan çıkmadı', Number.isFinite(G.economy.kasa) && G.economy.borc <= 1200, `kasa ${Math.round(G.economy.kasa)} · borç ${Math.round(G.economy.borc)}`);
  const son = nanAv(G);
  check('final derin NaN taraması temiz', !son, son || '');
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
