// tests/miras.test.mjs — PAKET "MİRAS & UZUN OYUN" testleri.
// M1 muhalefet dönemi · M2 tier terfi/tenzil · M3 jübile & nesil · M4 kariyer kapanışı
// (ETİKET BOŞ = 0 metriği) · M5 başkanın defteri · M6 dönem ritüeli · M7 müze + P19 ×1.5.
// Çalıştır: node tests/miras.test.mjs

import { readFileSync } from 'node:fs';
import { TUNING } from '../src/config.js';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { legacyTag, oppositionSeason, comebackVote } from '../src/engines/legacy.js';
import * as oppositionUI from '../src/ui/opposition.js';
import * as careerEndUI from '../src/ui/careerEnd.js';
import * as clubView from '../src/ui/clubView.js';
import * as seasonEnd from '../src/ui/seasonEnd.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json') };

function fresh(tier = 'orta', promises = ['P15'], directive = { budget: 80, line: 'hazir' }) {
  const G = A.newGame(data, 'normal');
  A.selectClub(G, tier);
  A.startTerm(G, promises, directive);
  return G;
}
function drainPhones(G) {
  let g = 0;
  while (G.phone && g++ < 8) {
    const opts = G.phone.options || [];
    let i = opts.findIndex((o) => ['red', 'sessiz', 'koru', 'sabir', 'beklet'].includes(o.key));
    if (i < 0) i = opts.length - 1;
    A.answerPhone(G, i);
  }
}
function week(G) {
  A.beginWeek(G);
  drainPhones(G);
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
    A.htDecision(G, 'tdguven');
    const r = A.finishWeek(G);
    if (r && r.waitLate) A.lateDecision(G, 'devam');
  }
  drainPhones(G);
  G.pendingMatch = null;
}
// Kaybedilmiş seçim durumu kur (election.kazandi=false)
function loseElection(G) {
  G.election = { oyOrani: 0.41, kazandi: false, breakdown: { sportif: 40, taraftar: 40, mali: 40, itibar: 40, soz: 40, rival: 60 }, done: true };
}

// ══ M1 MUHALEFET DÖNEMİ ══
console.log('\n── M1 Muhalefet dönemi ──');
setSeed(1101);
{
  const G = fresh();
  drainPhones(G);
  G.economy.borc = 42; G.lastSeason = { pos: 9 };
  G.promises[0].kept = false; // tutulmamış söz devir raporuna girer
  loseElection(G);
  A.afterElectionLoss(G);
  check('ilk kayıp: kariyer sonu DEĞİL → muhalefet fazı', G.phase === 'OPPOSITION' && G.lossStreak === 1);
  check('devir-teslim raporu SAKLANIR (borç/kadro/sözler)', !!G.devirRaporu && G.devirRaporu.borc === 42 && G.devirRaporu.tutulmayan.length === 1, JSON.stringify(G.devirRaporu.tutulmayan));
  check('yeni başkan AI tipiyle atandı', !!G.opposition.pres.name && ['POPULIST', 'MUHASEBECI', 'INSAATCI', 'AVCI'].includes(G.opposition.pres.type), `${G.opposition.pres.name} (${G.opposition.pres.type})`);
  // 3 sezon: sezon başına 1 büyük karar + sonucu — izlersin, müdahale edemezsin
  for (let i = 0; i < 3; i++) A.oppositionNext(G);
  check('3 hızlı sezon: 3 özet kartı (karar + sonuç + sıra)', G.opposition.cards.length === 3 && G.opposition.cards.every((c) => c.karar && c.sonuc && c.pos >= 1 && c.pos <= 18), G.opposition.cards.map((c) => c.pos + '.').join(' '));
  check('4. sezon izlenemez (sınır)', A.oppositionNext(G).ok === false);
  const oppHtml = oppositionUI.render(G);
  check('muhalefet ekranı: devir raporu + kartlar + ADAY OL', oppHtml.includes('Devir-Teslim') && oppHtml.includes('ADAY OL'));
  // dönüş: kampanya + seçim
  A.startComeback(G);
  check('aday ol → dönüş kampanyası', G.phase === 'CAMPAIGN' && G.campaign.comeback === true);
  A.campaignDo(G, 'taraftarMitingi');
  for (let i = 0; i < 4 && G.phase === 'CAMPAIGN'; i++) A.advanceCampaign(G);
  check('kampanya biter → seçim gecesi (comeback karnesi)', G.phase === 'ELECTION_NIGHT' && G.election.comeback === true && typeof G.election.breakdown.rival === 'number', `oy %${Math.round(G.election.oyOrani * 100)}`);
  // kazanma dalını zorla (formül testleri ayrıca aşağıda) → ENKAZ
  G.election.kazandi = true;
  const borcOnce = G.devirRaporu.borc;
  A.applyComebackWin(G);
  check('dönüş zaferi: ENKAZ raporu + staff DAĞILMIŞ + lossStreak sıfır', !!G.enkazRaporu && G.enkazRaporu.maddeler.length > 0 && ['cfo', 'akademi', 'basin', 'stat'].every((r) => G.staff[r] === null) && G.lossStreak === 0, G.enkazRaporu.maddeler[0]);
  void borcOnce;
  // 2 üst üste kayıp → kariyer kapanış
  setSeed(1102);
  const G2 = fresh();
  drainPhones(G2);
  G2.lossStreak = 1; // ilk kayıp yaşanmış
  loseElection(G2);
  A.afterElectionLoss(G2);
  check('üst üste 2. kayıp → KARİYER KAPANIŞ', G2.phase === 'CAREER_END' && G2.careerEnd.reason.includes('iki'), G2.careerEnd.tag);
  // dönüş oyu formülü: AI kötü yönettiyse oy artar
  setSeed(1103);
  const iyi = comebackVote({ borc: 40 }, { borc: 42, posList: [8, 9, 8], hedefSira: 8 }, 0);
  setSeed(1103);
  const kotu = comebackVote({ borc: 40 }, { borc: 120, posList: [15, 16, 14], hedefSira: 8 }, 0);
  check('dönüş oyu: enkaz büyüdükçe seçmen sana döner', kotu > iyi + 0.08, `iyi yönetim %${(iyi * 100).toFixed(0)} vs enkaz %${(kotu * 100).toFixed(0)}`);
}

// ══ M2 TIER TERFİ / TENZİL ══
console.log('\n── M2 Tier terfi/tenzil ──');
setSeed(1201);
{
  const G = fresh('kucuk');
  drainPhones(G);
  G.consecTerms = 2; G.gauges.itibar = 70; G.economy.borc = 0;
  G.history = { seasons: [{ pos: 5 }, { pos: 4 }, { pos: 5 }] };
  const fan0 = G.club.fanCount;
  A.startNewTerm(G);
  check('2 dönem + itibar + mali eşik → kulüp SEVİYE ATLAR (küçük→orta)', G.club.tier === 'orta', `tier=${G.club.tier}`);
  check('geçiş şoksuz: taban %50 harman + 1 sezonluk tierShift', G.club.fanCount > fan0 && !!G.tierShift, `taraftar ${fan0} → ${G.club.fanCount}`);
  check('beklenti + rakip merdiveni yenilendi', G.club.beklenti === 'ust_yari' || G.club.hedefSira < 14, `hedef ${G.club.hedefSira}.`);
  check('tören kartı + defter anı + tarihçe', G.inbox.some((m) => m.t.includes('TÖREN')) && (G.tierHistory || []).some((t) => t.dir === 'up') && (G.defter || []).some((a) => a.t.includes('Seviye')), '');
  // ikinci yarı: initSeason'da tam değerler
  G.meta.season = 1;
  A.chooseVision(G, 'sportif');
  const gecisFan = G.club.fanCount;
  A.startTerm(G, ['P15'], { budget: 40, line: 'hazir' });
  check('1 sezon sonra geçiş tamamlanır (tam taban)', G.tierShift === null && G.club.fanCount > gecisFan, `${gecisFan} → ${G.club.fanCount}`);
  // TENZİL: küme + mali çöküş
  setSeed(1202);
  const G2 = fresh('orta');
  drainPhones(G2);
  G2.history = { seasons: [{ pos: 17 }, { pos: 16 }, { pos: 17 }] };
  G2.economy.borc = G2.club.kadroDeger * 1.4;
  G2.consecTerms = 0;
  A.startNewTerm(G2);
  check('küme + mali çöküş → TENZİL (orta→küçük)', G2.club.tier === 'kucuk' && (G2.tierHistory || []).some((t) => t.dir === 'down'), `tier=${G2.club.tier}`);
  check('kulüp ekranı: tier yolculuğu çizgisi', clubView.render(G2).includes('Tier Yolculuğu'));
}

// ══ M3 JÜBİLE & NESİL ══
console.log('\n── M3 Jübile ──');
setSeed(1301);
{
  const G = fresh();
  drainPhones(G);
  const efsane = G.squad[0];
  efsane.age = 35; efsane.kulupteYil = 8;
  G.meta.week = 30;
  A.beginWeek(G);
  const tel = G.phone && G.phone.kind === 'jubile' ? G.phone : (G.phoneQueue || []).find((p) => p.kind === 'jubile');
  check('emekliliğe yaklaşan efsane: jübile telefonu (hafta 30)', !!tel && tel.title.includes(efsane.name), tel ? tel.title : 'gelmedi');
  // organize et
  while (G.phone && G.phone.kind !== 'jubile') A.answerPhone(G, (G.phone.options || []).length - 1);
  const kasa0 = G.economy.kasa, trf0 = G.gauges.taraftar;
  A.answerPhone(G, 0); // jorganize
  check('jübile organize: kasa −0.5 + taraftar +5 + müzeye isim', Math.abs((kasa0 - G.economy.kasa) - TUNING.MIRAS.JUBILE.KASA) < 1e-9 && G.gauges.taraftar > trf0 && (G.museum || []).some((k) => k.tip === 'jubile'), `taraftar ${trf0.toFixed(0)}→${G.gauges.taraftar.toFixed(0)}`);
  drainPhones(G);
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') { A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam'); }
  G.pendingMatch = null;
  for (let w = G.meta.week; w <= 34; w++) week(G);
  A.endSeason(G);
  check('sezon sonu: jübile gecesi + kadrodan emekli', !G.squad.includes(efsane) && G.inbox.some((m) => m.t.includes('Jübile gecesi')), '');
  // sessiz veda
  setSeed(1302);
  const G2 = fresh();
  drainPhones(G2);
  const e2 = G2.squad[0];
  e2.age = 34; e2.kulupteYil = 7;
  G2.meta.week = 30;
  A.beginWeek(G2);
  while (G2.phone && G2.phone.kind !== 'jubile') A.answerPhone(G2, (G2.phone.options || []).length - 1);
  const trf2 = G2.gauges.taraftar;
  const nost = (G2.board || []).find((m) => m.archetype === 'Nostaljik');
  const loy0 = nost ? nost.loyalty : null;
  A.answerPhone(G2, 1); // jsessiz
  check('sessiz veda: taraftar −3 + Nostaljik üye −5', G2.gauges.taraftar < trf2 && (!nost || nost.loyalty === loy0 + TUNING.MIRAS.JUBILE.NOSTALJIK_LOYALTY), '');
  // jübilesiz satılan efsane → kalıcı küskünlük
  setSeed(1303);
  const G3 = fresh();
  drainPhones(G3);
  const e3 = G3.squad[0];
  e3.age = 34; e3.kulupteYil = 6;
  G3.inbox.push({ id: 'mE1', action: 'sfile', file: { playerId: e3.id, offer: 20 }, t: '', b: '' });
  A.resolveSaleFile(G3, 'mE1', 'sat');
  check('jübilesiz satılan efsane: müzeye KÜSKÜN kartı + kalıcı kayıt', (G3.kuskunler || []).includes(e3.name) && (G3.museum || []).some((k) => k.tip === 'kuskun'), G3.kuskunler.join(','));
}

// ══ M4 KARİYER KAPANIŞ + ETİKET METRİĞİ ══
console.log('\n── M4 Kariyer kapanışı ──');
setSeed(1401);
{
  const G = fresh();
  drainPhones(G);
  G.career = { titles: 2, cups: 1, termsWon: 3, seasons: 9, bestPos: 1, oyList: [0.55, 0.6, 0.58] };
  G.borcHistory = [40, 30, 20, 10];
  G.altinCocuklar = ['Genç Yıldız'];
  A.anKarti(G, { t: 'Test anı', b: 'x', etki: 9 });
  A.retire(G);
  check('menüden emekli ol → kapanış sahnesi', G.phase === 'CAREER_END' && G.careerEnd.reason.includes('emeklilik'));
  const html = careerEndUI.render(G);
  check('kapanış ekranı: vitrin + oy ort + borç grafiği + yıldızlar + anlar + tarih cümlesi',
    html.includes('Kupa vitrini') && html.includes('Borç Grafiği') && html.includes('polyline') && html.includes('Genç Yıldız') && html.includes('Tarih onu'), '');
  check('efsane karne → "Efsane" etiketi', G.careerEnd.tag === 'Efsane', G.careerEnd.tag);
  // METRİK: etiket ataması her koşumda başarılı (boş etiket = 0) — 200 rastgele karne fuzz
  setSeed(1402);
  let bos = 0;
  const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  for (let i = 0; i < 200; i++) {
    const fake = {
      career: { titles: r(0, 3), cups: r(0, 2), termsWon: r(0, 5), seasons: r(1, 15), oyList: Math.random() < 0.3 ? [] : [Math.random()] },
      borcHistory: [r(0, 120), r(0, 200)],
      economy: { borc: r(0, 200) },
      identityTag: [null, 'Sahada Başkan', 'Halk Adamı', 'Ocak Bekçisi'][r(0, 3)],
      tierHistory: Math.random() < 0.2 ? [{ dir: 'up' }] : [],
    };
    const tag = legacyTag(fake);
    if (!tag || typeof tag !== 'string' || !tag.length) bos++;
  }
  check('METRİK: 200 rastgele karnede BOŞ ETİKET = 0', bos === 0, `${bos} boş`);
}

// ══ M5 BAŞKANIN DEFTERİ ══
console.log('\n── M5 Başkanın defteri ──');
setSeed(1501);
{
  const G = fresh();
  drainPhones(G);
  A.anKarti(G, { t: 'Küçük an', b: 'x', etki: 2 });
  A.anKarti(G, { t: 'Büyük an', b: 'y', etki: 9 });
  A.anKarti(G, { t: 'Orta an', b: 'z', etki: -5 });
  const top2 = A.defterTop(G, 2);
  check('defter: |etki| sırasıyla an kartları', top2[0].t === 'Büyük an' && top2[1].t === 'Orta an');
  check('yüksek etkili an müzeye de düşer (eşik 8)', (G.museum || []).some((k) => k.t === 'Büyük an'));
  for (let w = G.meta.week; w <= 34; w++) week(G);
  A.endSeason(G);
  check('sezon sonu: sezonun ≤3 anı hazırlanır + ekranda', Array.isArray(G.sezonAnlari) && G.sezonAnlari.length >= 1 && G.sezonAnlari.length <= 3 && seasonEnd.render(G).includes('Başkanın Defterinden'), `${G.sezonAnlari.length} an`);
  check('kulüp ekranından defter erişilir', clubView.render(G).includes('Başkanın Defteri'));
}

// ══ M6 YENİ DÖNEM RİTÜELİ ══
console.log('\n── M6 Dönem ritüeli ──');
setSeed(1601);
{
  const G = fresh();
  drainPhones(G);
  G.history = { seasons: [{ pos: 8 }, { pos: 7 }, { pos: 8 }] };
  A.anKarti(G, { t: 'Dönemin anı', b: 'q', etki: 7 });
  A.startNewTerm(G);
  check('seçim zaferi → ritüel (sessiz geçiş yok): defter kartları hazır', !!G.ritual && !G.ritual.done && G.ritual.cards.some((c) => c.t === 'Dönemin anı'));
  const hesap = (G.board || []).find((m) => m.archetype === 'Hesap Adamı');
  const l0 = hesap ? hesap.loyalty : null;
  A.chooseVision(G, 'mali');
  check('vizyon "mali disiplin" → Hesap Adamı loyalty +6', G.ritual.done && (!hesap || hesap.loyalty === l0 + 6), hesap ? `${l0}→${hesap.loyalty}` : '');
  check('aynı ritüelde ikinci vizyon reddedilir', A.chooseVision(G, 'sportif').ok === false);
}

// ══ M7 MÜZE CANLANMASI + P19 ══
console.log('\n── M7 Müze + Kulüp Mirası ──');
setSeed(1701);
{
  const G = fresh('orta', ['P19']);
  drainPhones(G);
  A.anKarti(G, { t: 'Tarihi an', b: 'm', etki: 9 });
  A.anKarti(G, { t: 'Tarihi an 2', b: 'm2', etki: 8 });
  const trf0 = G.gauges.taraftar;
  A.checkMilestones(G);
  const p19 = G.promises.find((p) => p.id === 'P19');
  check('müzede 2+ kart → P19 ara-adımı tetiklenir', p19.milestone === true);
  const delta = G.gauges.taraftar - trf0;
  check('Kulüp Mirası aktif: milestone bonusu ×1.5', Math.abs(delta - TUNING.MILESTONE.taraftar * TUNING.MIRAS.MUZE_MILESTONE_MULT) < 1e-9, `+${delta}`);
  check('kulüp ekranı: müze kartları + vaat rozeti', clubView.render(G).includes('Kulüp Mirası vaadi aktif'));
}

console.log(`\n${'─'.repeat(52)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
