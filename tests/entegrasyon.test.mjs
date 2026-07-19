// tests/entegrasyon.test.mjs — "MEŞGUL BAŞKAN" UÇTAN UCA SİMÜLASYONU.
// Kullanıcının 2 sezonluk canlı testinin provası: gerçek oyun akışı (beginWeek→maç→finishWeek)
// + ÖZEL HAYAT AKTİF kullanım (program·ikilem·davet·bağış·varlık·jest·söz·röportaj) +
// her hafta TÜM ekran render taraması (NaN/undefined sızıntısı avı) + ortada GERÇEK
// kayıt/yükleme turu (migrateLoaded). Amaç: kullanıcı oynamadan önce kırılacak her şey burada kırılsın.
// Çalıştır: node tests/entegrasyon.test.mjs
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

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

// ── NaN avcısı: state ağacında sonlu olmayan sayı arar (derin) ──
function nanAv(obj, yol = 'G', derinlik = 0, gorulen = new Set()) {
  if (derinlik > 8 || obj == null || typeof obj !== 'object' || gorulen.has(obj)) return null;
  gorulen.add(obj);
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'data') continue;
    if (typeof v === 'number' && !Number.isFinite(v)) return `${yol}.${k}`;
    if (typeof v === 'object') { const r = nanAv(v, `${yol}.${k}`, derinlik + 1, gorulen); if (r) return r; }
  }
  return null;
}

// ── Tüm ekranları çiz — patlarsa hangi ekran olduğunu söyle; NaN/undefined sızıntısı ara ──
function ekranTara(G, etiket) {
  const ekranlar = { cockpit, kadro: squadView, transfer: transferView, tesis: facilitiesView, finans: finance, medya: media, kongre: congress, veri: dataHub, kulup: clubView, inbox: inboxUi };
  let html = '';
  for (const [ad, mod] of Object.entries(ekranlar)) {
    G.nav = ad;
    try { html += mod.render(G); } catch (e) { throw new Error(`${etiket} · ${ad} ekranı patladı: ${e.message}`); }
  }
  for (const tab of ['genel', 'servet']) {
    G._ozelTab = tab;
    try { html += ozelUi.render(G); } catch (e) { throw new Error(`${etiket} · ozel/${tab} patladı: ${e.message}`); }
  }
  G._pcard = G.squad[0]?.id;
  try { html += playerCard.render(G); } catch (e) { throw new Error(`${etiket} · oyuncu kartı patladı: ${e.message}`); }
  G._pcard = null;
  const uIdx = html.indexOf('undefined');
  if (uIdx >= 0) throw new Error(`${etiket} · ekranda "undefined" sızıntısı: …${html.slice(Math.max(0, uIdx - 80), uIdx + 60).replace(/\s+/g, ' ')}…`);
  if (/NaN/.test(html)) throw new Error(`${etiket} · ekranda "NaN" sızıntısı`);
  // ÇIPLAK FLOAT AVCISI: "71.1228976715736mn" sınıfı — 3+ ondalık basamak + mn = fmt'siz sızıntı
  const flo = html.match(/\d+\.\d{4,}\s*mn/); // 4+ hane: binlik ayraç ("2.040mn") muaf
  if (flo) throw new Error(`${etiket} · fmt'siz sayı sızıntısı: "${flo[0]}"`);
}

// ── Bir oyun haftası (autoplay ile aynı akış) ──
function hafta(G) {
  A.beginWeek(G);
  let guard = 0;
  while (G.phone && guard++ < 8) A.answerPhone(G, 0);
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
    A.htDecision(G, 'tdguven');
    const r = A.finishWeek(G);
    if (r && r.waitLate) A.lateDecision(G, 'devam');
  }
  guard = 0;
  while (G.phone && guard++ < 8) A.answerPhone(G, 0);
  if (G.deskCard && !G.deskUsedThisTick) A.deskAction(G);
  // GM dosyaları — dengeli başkan
  for (const m of G.inbox) {
    if (m.resolved) continue;
    if (m.action === 'tfile') A.resolveTransferFile(G, m.id, 'onay');
    else if (m.action === 'sfile') A.resolveSaleFile(G, m.id, 'red');
    else if (m.action === 'event') A.resolveEvent(G, m.id, 0);
    else if (m.action === 'board') A.resolveBoard(G, m.id, 'mali');
    else if (m.action === 'lfile') A.resolveLoanFile(G, m.id, 'kalsin');
    else if (m.action === 'douse') A.dousePress(G, m.id);
    else if (m.action === 'captain') A.resolveCaptain(G, m.id, 'onay');
    else if (m.action === 'seasonBudget') A.resolveSeasonBudget(G, m.id, 'onay');
    else if (m.action === 'agenda') { let ga = 0; while (!m.resolved && ga++ < 4) A.resolveAgenda(G, m.id, 'vizyon'); }
  }
  G.pendingMatch = null;
}

// ── ÖZEL HAYAT aktif kullanım — meşgul ama gerçekçi başkan ──
const iz = { ikilem: 0, davet: 0, bagis: 0, varlik: 0, jest: 0, roportaj: 0, sorguBonus: 0, evMin: 100, evMax: 0 };
function ozelYasa(G, w, sezon) {
  const oz = G.ozel;
  if (oz.olay && A.ozelKarar(G, w % 2).ok) iz.ikilem++;
  // gerçekçi başkan: önce camia (bağış), sonra varlık merdiveni, davetler ölçülü —
  // parayı hem yaşar hem biriktirir (aksiyonlar nakit yetmezse zaten reddeder)
  if (sezon === 1 && w % 6 === 5 && oz.nakit >= 2 && A.ozelBagis(G, 2).ok) iz.bagis++;
  for (const k of ['oto', 'sanat', 'tekne']) if (A.ozelVarlik(G, k).ok) { iz.varlik++; break; }
  if (w % 4 === 1 && oz.nakit >= 3) for (const id of ['altyapi', 'yemek', 'tekne', 'hayir']) if (A.ozelDavet(G, id).ok) { iz.davet++; break; }
  const aday = G.squad.find((p) => !p.loanIn);
  if (aday && A.playerJest(G, aday.id).ok) iz.jest++;
  if (sezon === 1 && w === 3) A.playerSoz(G, G.squad.find((p) => !p.loanIn && !p.relx?.soz)?.id);
  if (w % 6 === 2 && A.ozelRoportaj(G).ok) iz.roportaj++;
  A.makeDemec(G, ['sakin', 'iddiali', 'savunmaci'][w % 3]); // basın rutini → pressRel canlı
  if (w % 5 === 0) A.setTelkin(G, 'tamkadro');
  // mesai bonusu gözlendi — #9 devir sonrası doygun hak: 1+scout+devir(2)=3+scout; 4+scout'a YALNIZ mesai köprüsü çıkarır
  if (G.sorguHak >= 4 + (G.facilities.scout || 0)) iz.sorguBonus++;
  iz.evMin = Math.min(iz.evMin, oz.g.ev); iz.evMax = Math.max(iz.evMax, oz.g.ev);
}

console.log('\n── MEŞGUL BAŞKAN: 2 tam sezon + kayıt/yükleme + 3. sezona giriş ──');
let G;
let hata = null;
try {
  setSeed(42);
  G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  // sezon 1 programı: mesai-ağır (sorgu bonusu köprüsünü kanıtla)
  A.ozelProg(G, 'sosyal|-'); A.ozelProg(G, 'mesai|+');
  for (let s = 1; s <= 2; s++) {
    for (let w = 1; w <= G.SEASON_WEEKS; w++) {
      hafta(G);
      ozelYasa(G, w, s);
      if (w % 6 === 0) ekranTara(G, `S${s}H${w}`);
      if (w % 8 === 0) { const n = nanAv(G); if (n) throw new Error(`S${s}H${w} · state'te NaN: ${n}`); }
      // GERÇEK KAYIT/YÜKLEME TURU — sezon 1 hafta 20'de otokayıt provası
      if (s === 1 && w === 20) {
        const nakitOnce = G.ozel.nakit, prOnce = JSON.stringify(G.pressRel || {});
        const raw = JSON.stringify({ ...G, data: undefined });
        G = A.migrateLoaded(Object.assign(JSON.parse(raw), { data }));
        check('kayıt/yükleme: özel hayat + basın ilişkileri birebir korunur',
          G.ozel.nakit === nakitOnce && JSON.stringify(G.pressRel || {}) === prOnce && !!G.ozel.aile.es);
        check('kayıt/yükleme: oyuncu ilişki eki (relx) korunur', G.squad.some((p) => p.relx?.kisilik));
      }
    }
    // sezon kapanışı
    const karne = { ...G.ozel.sezon };
    A.endSeason(G);
    try { const h = seasonEnd.render(G); if (/undefined|NaN/.test(h)) throw new Error('sızıntı'); } catch (e) { throw new Error(`S${s} sezon sonu ekranı: ${e.message}`); }
    if (s === 1) check('sezon 1 aile karnesi dolu (ikilem+davet işlendi)', karne.ikilem >= 1 && karne.davet >= 1, JSON.stringify(karne));
    A.afterSeasonEnd(G);
    G.transition = null;
    // sezon 2 programı: sosyal-ağır (pazarlık/kurul köprüleri)
    if (s === 1) { A.ozelProg(G, 'mesai|-'); A.ozelProg(G, 'sosyal|+'); A.ozelProg(G, 'aile|-'); A.ozelProg(G, 'sosyal|+'); }
  }
  // 3. sezona köprü: 6 hafta daha (sezon geçişi + yeni sezon sayaçları sahada)
  for (let w = 1; w <= 6; w++) { hafta(G); ozelYasa(G, w, 3); }
  ekranTara(G, 'S3H6');
} catch (e) { hata = e; }

check('2+ sezon kesintisiz oynandı — sıfır çökme', !hata, hata ? String(hata.message || hata) : 'temiz');
if (!hata) {
  check('ekran taramaları temiz (13 ekran × ~12 tarama: NaN/undefined yok)', true);
  const son = nanAv(G);
  check('final state derin NaN taraması temiz', !son, son || '');
  console.log('\n── Entegrasyon kanıtları (köprüler sahada ateşlendi) ──');
  check('ikilemler yaşandı ve çözüldü', iz.ikilem >= 4, `${iz.ikilem} ikilem`);
  check('davetler düzenlendi', iz.davet >= 3, `${iz.davet} davet`);
  check('kulübe kişisel bağış aktı', iz.bagis >= 2, `${iz.bagis} bağış`);
  check('kişisel servet varlığa döndü (bağışla birlikte — ikisi de akıyor)', iz.varlik >= 1, `${iz.varlik} varlık`);
  check('jestler soyunma odasına dokundu', iz.jest >= 20, `${iz.jest} jest`);
  check('röportajlar basına açıldı', iz.roportaj >= 2, `${iz.roportaj} röportaj`);
  check('mesai→sorgu hakkı köprüsü ateşlendi (sezon 1)', iz.sorguBonus >= 5, `${iz.sorguBonus} hafta`);
  check('ev huzuru yaşadı (maç sonuçları + program bandı oynattı)', iz.evMax > 65 || iz.evMin < 65, `bant ${iz.evMin}-${iz.evMax}`);
  check('başkanlık tecrübesi büyüdü (sv≥3 — pasifler açıldı)', G.ozel.seviye >= 3, `sv.${G.ozel.seviye} · xp ${G.ozel.xp}`);
  check('basın ilişkileri hareket etti (3 kalem)', Object.values(G.pressRel || {}).some((v) => v !== 50), JSON.stringify(G.pressRel));
  check('kişisel gelir/harcama döngüsü sağlıklı (nakit ≥0)', G.ozel.nakit >= 0, `₺${G.ozel.nakit}mn`);
  check('oyun 3. sezonda ayakta (faz + lig + kadro tutarlı)', G.meta.season === 3 && G.squad.length >= 18 && ['SEASON_LOOP'].includes(G.phase), `sezon ${G.meta.season} · ${G.squad.length} oyuncu · ${G.phase}`);
}

// ── İkinci koşum: farklı seed, ozel'e HİÇ dokunmadan (ihmalkar başkan) — yine sıfır çökme ──
console.log('\n── İhmalkâr başkan: seed 7, özel hayata hiç girmeden 2 sezon ──');
let hata2 = null;
try {
  setSeed(7);
  const H = A.newGame(data, 'normal');
  A.selectClub(H, 'kucuk');
  A.startTerm(H, ['P15'], { budget: 40, line: 'hazir' });
  for (let s = 1; s <= 2; s++) {
    for (let w = 1; w <= H.SEASON_WEEKS; w++) hafta(H);
    A.endSeason(H); A.afterSeasonEnd(H); H.transition = null;
  }
  const n2 = nanAv(H);
  if (n2) throw new Error('NaN: ' + n2);
  ekranTara(H, 'ihmalkar-final');
} catch (e) { hata2 = e; }
check('özel hayatı hiç açmayan oyuncu için de sıfır çökme + temiz ekranlar', !hata2, hata2 ? String(hata2.message || hata2) : 'temiz');

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
