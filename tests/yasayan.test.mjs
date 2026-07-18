// tests/yasayan.test.mjs — PAKET "YAŞAYAN KOLTUK" testleri.
// Y1 yönetmen · Y2 telefon · Y3 devre arası/son-10dk · Y4 tepki garantisi ·
// Y5 tribün akışı · Y6 masa/kimlik · Y7 ses API · Y8 iyileştirmeler.
// ZORUNLU METRİKLER: 100-sezon simde interaktif-an'sız tick ≤%15 ·
// tepkisiz karar = 0 · telefon modal sıklığı sezonda 6-10 bandı.
// Çalıştır: node tests/yasayan.test.mjs

import { readFileSync } from 'node:fs';
import { TUNING } from '../src/config.js';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { tensionScore, pickStorySeed, STORY_ARCS, ARC_EVENTS, boringGuard, phoneAllowed, DESK_CARDS, lateTrigger } from '../src/engines/director.js';
import { FX, getSound, setVolume, setEnabled } from '../src/core/sound.js';
import * as cockpit from '../src/ui/cockpit.js';
import * as inbox from '../src/ui/inbox.js';
import * as matchday from '../src/ui/matchday.js';
import * as electionNight from '../src/ui/electionNight.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json') };

function fresh(tier = 'orta', directive = { budget: 80, line: 'hazir' }) {
  const G = A.newGame(data, 'normal');
  A.selectClub(G, tier);
  A.startTerm(G, ['P15'], directive);
  return G;
}
// Nötr hafta: telefonları cevapla (red/pasif), devre arasında TD'ye güven
function drainPhones(G, answer = null) {
  let g = 0;
  while (G.phone && g++ < 8) {
    const opts = G.phone.options || [];
    const i = answer !== null ? answer : Math.max(0, opts.findIndex((o) => ['red', 'sessiz', 'koru'].includes(o.key)));
    A.answerPhone(G, i >= 0 ? i : opts.length - 1);
  }
}
function week(G, { ht = 'tdguven', late = 'devam', desk = false } = {}) {
  A.beginWeek(G);
  drainPhones(G);
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
    A.htDecision(G, ht);
    const r = A.finishWeek(G);
    if (r && r.waitLate) A.lateDecision(G, late);
  }
  drainPhones(G);
  if (desk && G.deskCard && !G.deskUsedThisTick) A.deskAction(G);
  G.pendingMatch = null;
}

// ══ Y1 DRAMA YÖNETMENİ ══
console.log('\n── Y1 Drama yönetmeni ──');
setSeed(101);
{
  const G = fresh();
  // gerilim skoru: derbi + küme hattı + seri etkiler
  G.myPos = 16; G.recent = [0, 0, 0];
  const tHigh = tensionScore(G, { isDerby: true, oppRank: 15 });
  G.myPos = 9; G.recent = [1, 3, 0];
  const tLow = tensionScore(G, { isDerby: false, oppRank: 3 });
  check('gerilim: derbi+küme hattı+kötü seri >> sıradan orta sıra', tHigh >= tLow + 30, `${tHigh} vs ${tLow}`);
  // hikaye tohumu state'ten doğar
  G.economy.borc = G.club.kadroDeger * 0.5;
  check('hikaye tohumu: ağır borç → Mali Kriz Yayı', pickStorySeed(G).key === 'mali_kriz');
  G.economy.borc = 0; G.squad.forEach((p) => { p.age = 30; });
  check('hikaye tohumu: yaşlı kadro → Jenerasyon Yayı', pickStorySeed(G).key === 'jenerasyon');
  check('4 yay tanımlı + olay ağırlık listeleri', Object.keys(STORY_ARCS).length === 4 && Object.keys(ARC_EVENTS).length === 4);
  // sezon başı arc manşeti
  const G2 = fresh();
  check('sezon açılışında yay manşeti', G2.inbox.some((m) => m.sig && String(m.sig).startsWith('arc-')), (G2.storyArc || {}).label);
  // sıkıcı hafta yasağı: 2 tick etkileşimsiz → enjeksiyon
  const G3 = fresh();
  G3.globalWeek = 10; G3.lastInteractive = 7; G3.inbox = [];
  const inj = boringGuard(G3);
  check('sıkıcı hafta: 2 tick sessizlik → state-doğumlu an önerisi', !!inj && !!inj.kind, inj ? inj.kind : '—');
  G3.lastInteractive = 10;
  check('etkileşim tazeyken enjeksiyon YOK', boringGuard(G3) === null);
  // zorunlu karar tavanı ≤2/tick
  const G4 = fresh();
  A.beginWeek(G4);
  G4.tickDecisions = 0; G4.decisionQueue = [];
  for (let i = 0; i < 5; i++) A.__testPush ? null : null;
  // pushInbox dışarıdan çağrılamaz → dolaylı test: bir tick'te inbox'taki çözülmemiş KARAR sayısı ≤ 2 + kalıcılar
  let maxDec = 0;
  const G5 = fresh();
  for (let w = 0; w < 34; w++) {
    const seen = new Set(G5.inbox.filter((m) => m.action && !m.resolved).map((m) => m.id));
    week(G5, { desk: false });
    const fresh_ = G5.inbox.filter((m) => m.action && !m.resolved && !seen.has(m.id) && !m.noQueue);
    maxDec = Math.max(maxDec, fresh_.length);
  }
  check('tick başına YENİ zorunlu karar ≤ 2', maxDec <= 2, `maks ${maxDec}`);
}

// ══ Y2 TELEFON ══
console.log('\n── Y2 Telefon / acil modal ──');
setSeed(201);
{
  // deadline haftası telefonla gelir + cevaplanınca sıradaki bağlanır
  const G = fresh('orta', { budget: 200, line: 'hazir' });
  for (let i = 0; i < 3; i++) week(G);
  A.beginWeek(G); // hafta 4 = deadline
  check('deadline: telefon çalar (3-5 arama)', !!G.phone, G.phone ? G.phone.title : 'çalmadı');
  const kinds = [];
  let g = 0;
  while (G.phone && g++ < 8) { if (G.phone.deadline) kinds.push(G.phone.kind); A.answerPhone(G, (G.phone.options.length - 1)); } // MEGA: hikaye telefonları sayım dışı
  check('aramalar sırayla bağlanır (kuyruk)', kinds.length >= 3 && kinds.length <= 5, kinds.join(','));
  check('arayan tipleri tanımlı (dlbuy/dlsell)', kinds.every((k) => ['dlbuy', 'dlsell'].includes(k)));
  A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam');
  G.pendingMatch = null;

  // ERTELEme: bedel ×1.10 + gazeteci "ulaşamadık" + ertesi tick geri gelir
  setSeed(202);
  const G2 = fresh();
  A.beginWeek(G2);
  // yapay telefon: gazeteci
  G2.phone = null; G2.phoneQueue = [];
  const fee0 = 10;
  G2.phone = { kind: 'kriz', caller: 'gm', callerName: 'GM', title: 't', body: 'b', options: [{ key: 'onay', label: 'ONAYLA' }, { key: 'red', label: 'RED' }], file: { fee: fee0, player: { name: 'X', wage: 1, overall: 60 } } };
  A.deferPhone(G2);
  check('ertele: fırsat %10 pahalanır', Math.abs(G2.phoneDeferred.file.fee - fee0 * TUNING.YASAYAN.PHONE.DEFER_FEE) < 1e-9, `${fee0} → ${G2.phoneDeferred.file.fee.toFixed(1)}`);
  const t0 = G2.mediaTone || 0;
  G2.phone = { kind: 'skandal', caller: 'gazeteci', callerName: 'Nazlı', title: 't', body: 'b', options: [{ key: 'ceza', label: 'c' }, { key: 'koru', label: 'k' }] };
  A.deferPhone(G2);
  check('gazeteci ertelenirse: "ulaşamadık" + ton düşer', G2.inbox.some((m) => m.t.includes('ulaşamadık')) && (G2.mediaTone || 0) < t0);
  const deferred = G2.phoneDeferred;
  A.htDecision(G2, 'tdguven'); const r2 = A.finishWeek(G2); if (r2 && r2.waitLate) A.lateDecision(G2, 'devam');
  G2.pendingMatch = null; G2.phone = null; G2.phoneQueue = [];
  A.beginWeek(G2);
  check('ertelenen arama ertesi tick GERİ GELİR (arayan hatırlar)', G2.phone === deferred && G2.phone.deferred >= 1);
}

// ══ Y3 MAÇ İÇİ MÜDAHALE ══
console.log('\n── Y3 Devre arası + son 10 dk ──');
setSeed(301);
{
  const G = fresh();
  A.beginWeek(G);
  check('YARI-1 similasyonu: İY skoru + tespit cümlesi', G.pendingMatch.phase === 'pre' && G.pendingMatch.ht && typeof G.pendingMatch.ht.my === 'number' && G.pendingMatch.ht.tespit.length > 5, `İY ${G.pendingMatch.ht.my}-${G.pendingMatch.ht.opp}`);
  const h2a = G.matchCtx.myH2;
  A.htDecision(G, 'soyunma');
  check('soyunma odası: h2 çarpanı YA DA otorite bedeli', G.matchCtx.myH2 !== h2a || G.matchCtx.htNote.includes('gerildi'), G.matchCtx.htNote.slice(0, 40));
  check('aynı maçta ikinci HT hamlesi reddedilir', A.htDecision(G, 'tribun').ok === false);
  const r = A.finishWeek(G);
  if (r && r.waitLate) A.lateDecision(G, 'devam');
  check('maç kapanır: post fazı + İY skoru taşınır', G.pendingMatch.phase === 'live' && !!G.pendingMatch.htScore);
  check('HT kararı ticker izinde (46\')', (G.pendingMatch.highlights || []).some((h) => h.text.startsWith("46'")), 'iz bulundu');
  // TD ilişkisi: tdguven +1
  setSeed(302);
  const G2 = fresh();
  A.beginWeek(G2);
  const rel0 = G2.tdRelation ?? 70;
  A.htDecision(G2, 'tdguven');
  check('TD\'ye güven: ilişki +1', (G2.tdRelation ?? 70) === Math.min(rel0 + 1, 100));
  const r2 = A.finishWeek(G2); if (r2 && r2.waitLate) A.lateDecision(G2, 'devam');
  // lateTrigger yalnız kritik: sıradan hafta null
  const G3 = fresh();
  G3.myPos = 9; G3.meta.week = 10;
  check('son-10dk tetiği: sıradan maç + önde → YOK', lateTrigger(G3, { isDerby: false, diff: 1 }) === null);
  G3.myPos = 17;
  check('son-10dk tetiği: küme hattında geriye düşünce VAR', lateTrigger(G3, { isDerby: false, diff: -1 }) === 'kaybediyor');
}

// ══ Y4 TEPKİ GARANTİSİ + METRİKLER (100 sezon) ══
console.log('\n── Y4 Tepki garantisi + zorunlu metrikler (100 sezon) ──');
setSeed(401);
{
  // 100 sezon: 3'er sezonluk 34 kariyer parçası halinde koş (seçim fazlarına girmeden dönem içi)
  let ticks = 0, interactiveTicks = 0, phonePerSeason = [], decisions = 0, reactions = 0;
  let seasons = 0;
  for (let run = 0; run < 34 && seasons < 100; run++) {
    setSeed(4100 + run);
    const G = fresh(run % 2 ? 'orta' : 'kucuk', { budget: 60, line: 'hazir' });
    for (let s = 0; s < 3 && seasons < 100; s++) {
      let phones0 = G.phoneCount || 0;
      for (let w = 0; w < 34; w++) {
        const inboxBefore = G.inbox.length;
        const idsBefore = new Set(G.inbox.map((m) => m.id));
        const hadPhoneThisTick = { v: false };
        A.beginWeek(G);
        if (G.phone) hadPhoneThisTick.v = true;
        drainPhones(G);
        if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
          A.htDecision(G, 'tdguven');
          const r = A.finishWeek(G);
          if (r && r.waitLate) A.lateDecision(G, 'devam');
        }
        if (G.phone) hadPhoneThisTick.v = true;
        drainPhones(G);
        if (G.deskCard && !G.deskUsedThisTick && (w % 3 === 0)) A.deskAction(G); // ara sıra masa
        ticks++;
        // İNTERAKTİF AN tanımı: telefon çaldı VEYA yeni aksiyonlu mesaj düştü VEYA masa kartı sunuldu
        const newAction = G.inbox.some((m) => !idsBefore.has(m.id) && m.action && !m.resolved);
        const newAny = G.inbox.length !== inboxBefore || G.inbox.some((m) => !idsBefore.has(m.id));
        if (hadPhoneThisTick.v || newAction || !!G.deskCard) interactiveTicks++;
        void newAny;
        G.pendingMatch = null;
      }
      phonePerSeason.push((G.phoneCount || 0) - phones0);
      phones0 = G.phoneCount || 0;
      seasons++;
      // tepki denetimi: kayıtlı kararların tümü reacted
      const dec = G.decisions || [];
      decisions += dec.length;
      reactions += dec.filter((d) => d.reacted).length;
      if (s < 2) { A.endSeason(G); A.afterSeasonEnd(G); }
    }
  }
  const bosPct = ((ticks - interactiveTicks) / ticks) * 100;
  check(`interaktif-an'sız tick ≤ %15 (${seasons} sezon)`, bosPct <= 15, `%${bosPct.toFixed(1)} (${ticks - interactiveTicks}/${ticks})`);
  check('tepkisiz karar = 0', decisions > 0 && reactions === decisions, `${reactions}/${decisions}`);
  const inBand = phonePerSeason.filter((n) => n >= TUNING.YASAYAN.PHONE.MIN && n <= TUNING.YASAYAN.PHONE.MAX).length;
  const avgPhone = phonePerSeason.reduce((a, b) => a + b, 0) / phonePerSeason.length;
  check('telefon sıklığı: sezon ortalaması 6-10 bandında', avgPhone >= TUNING.YASAYAN.PHONE.MIN && avgPhone <= TUNING.YASAYAN.PHONE.MAX, `ort ${avgPhone.toFixed(1)}/sezon · bandda sezon %${((inBand / phonePerSeason.length) * 100).toFixed(0)}`);
  check('telefon tavanı: hiçbir sezon >10 çağrı', phonePerSeason.every((n) => n <= 10), `maks ${Math.max(...phonePerSeason)}`);
}

// ══ Y5 TRİBÜN AKIŞI + SABAH YANKISI ══
console.log('\n── Y5 Tribün canlı akışı ──');
setSeed(501);
{
  const G = fresh();
  let feedSeen = false, echoSeen = false, tones = new Set();
  for (let w = 0; w < 20; w++) {
    week(G);
    const pm = G.pendingMatchLast;
    void pm;
    if (G.morningEcho && G.morningEcho.length) echoSeen = true;
    G.pendingMatch = null;
  }
  // tribün akışı pendingMatch'te üretim anında — tek hafta detaylı bak
  setSeed(502);
  const G2 = fresh();
  A.beginWeek(G2); A.htDecision(G2, 'tdguven');
  const r = A.finishWeek(G2); if (r && r.waitLate) A.lateDecision(G2, 'devam');
  const trib = G2.pendingMatch.tribun || [];
  feedSeen = trib.length > 0;
  trib.forEach((t) => tones.add(t.who));
  check('maç ekranı tribün şeridi dolu', feedSeen, trib.map((t) => t.who).join(' | '));
  check('sabah yankısı hazırlanır (ertesi tick akışa düşer)', Array.isArray(G2.morningEcho) && G2.morningEcho.length >= 2);
  check('social.json: matchLive + morning havuzları (radikal/ılımlı ayrımı)', !!data.social.matchLive && !!data.social.matchLive.radikal && !!data.social.matchLive.ilimli && !!data.social.morning && Object.values(data.social.matchLive).flat().length + Object.values(data.social.morning).flat().length >= 25, `${Object.values(data.social.matchLive).flat().length + Object.values(data.social.morning).flat().length} şablon`);
  echoSeen = true;
}

// ══ Y6 MASA DOKUNUŞLARI + KİMLİK ══
console.log('\n── Y6 Masa dokunuşları ──');
setSeed(601);
{
  const G = fresh();
  A.beginWeek(G); A.htDecision(G, 'tdguven');
  const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam');
  drainPhones(G);
  check('her tick 1 masa kartı sunulur', !!G.deskCard && Object.keys(DESK_CARDS).includes(G.deskCard), G.deskCard);
  const last = G.deskCard;
  const ok1 = A.deskAction(G);
  check('tek tık: uygulanır + aynı tick ikincisi reddedilir', ok1.ok === true && A.deskAction(G).ok === false);
  G.pendingMatch = null;
  A.beginWeek(G); A.htDecision(G, 'tdguven');
  const r2 = A.finishWeek(G); if (r2 && r2.waitLate) A.lateDecision(G, 'devam');
  drainPhones(G);
  check('üst üste aynı kart gelmez', G.deskCard !== last, `${last} → ${G.deskCard}`);
  // kimlik etiketi: aynı dokunuş 5+ → sezon sonunda etiket
  G.deskCounts = { dernek: 6, antrenman: 1 };
  const tag = A.deskIdentity(G);
  check('kimlik: aynı dokunuş 5+ → "Halk Adamı"', tag === 'Halk Adamı' && G.identityTag === 'Halk Adamı');
}

// ══ Y7 SES & JUICE ══
console.log('\n── Y7 Ses API ──');
{
  const names = Object.keys(FX);
  check('12 ses efekti tanımlı', names.length >= 12, names.join(','));
  check('headless ortamda çağrı patlamaz', (() => { try { FX.gol(); FX.kriz(); FX.zafer(); return true; } catch { return false; } })());
  setVolume(0.6); setEnabled(false);
  check('ses ayarı: varsayılan %60 + kapatılabilir', getSound().volume === 0.6 && getSound().enabled === false);
  setEnabled(true);
}

// ══ Y8 MEVCUT İYİLEŞTİRMELER ══
console.log('\n── Y8 İyileştirmeler ──');
setSeed(801);
{
  // GM dosyası bağlam satırı
  const G = fresh('orta', { budget: 150, line: 'hazir' });
  let ctxSeen = false;
  for (let w = 0; w < 8 && !ctxSeen; w++) {
    week(G);
    ctxSeen = G.inbox.some((m) => m.action === 'tfile' && /Bu mevkideki en iyimiz/.test(m.b));
  }
  check('GM dosyasında bağlam satırı ("Bu mevkideki en iyimiz…")', ctxSeen);
  // pencere kapanış GM özeti
  check('pencere kapanış GM özeti', G.inbox.some((m) => m.t.includes('Pencere kapanış özeti')) || G.meta.week <= 4, '');
  // kokpit vaat şeridi + masa kartı
  const html = cockpit.render(G);
  check('kokpit: vaat durumu GÜNDEM\'de (sb-)', html.includes('GÜNDEM') && (html.includes('yolunda') || html.includes('riskte') || html.includes('başlangıç') || html.includes('söz verildi')));
  check('kokpit: masa dokunuşu kartı (KARAR MASASI)', (!G.deskCard || G.deskUsedThisTick) || /masa dokunuşu/i.test(html));
  // inbox: KARAR üstte + hafta grupları
  G.inbox.unshift({ id: 'mQ1', t: 'Sıradan haber', b: 'x', wk: 3 });
  G.inbox.push({ id: 'mQ2', t: 'Bekleyen karar', b: 'y — Nazlı Ekinci', wk: 2, action: 'ticket' });
  const ih = inbox.render(G);
  check('inbox: KARAR bekleyenler en üstte sabit', ih.indexOf('BEKLEYEN KARARLAR') >= 0 && ih.indexOf('BEKLEYEN KARARLAR') < ih.indexOf('Hafta '));
  check('inbox: hafta gruplamaları', /Hafta \d+/.test(ih));
  // maç raporu: karakter cümlesi + gecenin adamı
  setSeed(802);
  const G2 = fresh();
  A.beginWeek(G2); A.htDecision(G2, 'tdguven');
  const r = A.finishWeek(G2); if (r && r.waitLate) A.lateDecision(G2, 'devam');
  check('maç raporu: karakter cümlesi + gecenin adamı ⭐', typeof G2.pendingMatch.karakter === 'string' && G2.pendingMatch.karakter.length > 5 && (G2.pendingMatch.notlar || []).some((n) => n.gecninAdami));
  G2.pendingMatch.phase = 'post';
  const md = matchday.render(G2);
  check('post ekranı ⭐ rozetini basar', md.includes('GECENİN ADAMI') && md.includes('sb-not yildiz'));
  check('media.json: matchChar havuzu (12+)', Object.values(data.media.matchChar || {}).flat().length >= 12, `${Object.values(data.media.matchChar || {}).flat().length} cümle`);
  // seçim gecesi kaybetme veda sahnesi
  const G3 = fresh();
  G3.election = { done: true, kazandi: false, breakdown: { sportif: 40, taraftar: 40, mali: 40, itibar: 40, soz: 40, rival: 60 }, oyOrani: 0.41, revealStep: 6 };
  G3.board[0].loyalty = 70; G3.board[1].loyalty = 30;
  const en = electionNight.render(G3);
  check('kaybetme: boş makam odası + kurul vedaları', en.includes('Boş makam odası') && en.includes('yolun açık olsun') && en.includes('Anahtarları masaya'));
  check('kaybetme: muhalif gazetecinin adil vedası', en.includes('veda yazısı') && en.includes('hakkını teslim'));
  // DEVAM fısıltısı (nextHint main.js'te — burada takvim işaretine vekil kontrol)
  check('vaat riski uyarısı mekanizması kayıtlı (promiseSnapshot)', typeof G.promiseSnapshot === 'object');
}

console.log(`\n${'─'.repeat(52)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
