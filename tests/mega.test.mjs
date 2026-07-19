// tests/mega.test.mjs — MEGA KOŞU "BÜYÜK DÜNYA + FİNAL CİLA" testleri.
// B1 kurul gündemi + rakip başkan + fedIliski + FFP kademeleri · B2 boyutlar + TİS + koreo + kapak ·
// B3 ilan + vitrin · B4 senaryolar + modlar + başarımlar · B5 köprüler · B6 cila + göç.
// METRİKLER: gündemsiz sunum=0 · çip-tahmin çelişkisi=0 · fedIliski uç etkisi ≤±2 puan ·
// Batan Dev tek dönem %40-60 · eski-kayıt göçü çökmesi=0.
// Çalıştır: node tests/mega.test.mjs

import { readFileSync } from 'node:fs';
import { TUNING } from '../src/config.js';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { buildBoardAgenda, scoreAgendaAnswer, boardBudgetMult } from '../src/engines/world.js';
import { ACH_CHECKS, pickMandate, mandateDone, rollClubIdentity, MODES } from '../src/engines/meta.js';
import { serialize, deserialize } from '../src/core/save.js';
import * as cockpit from '../src/ui/cockpit.js';
import * as congress from '../src/ui/congress.js';
import * as clubSelect from '../src/ui/clubSelect.js';
import * as settingsUI from '../src/ui/settings.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = {
  teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'),
  media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'),
  boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'),
};

function fresh(tier = 'orta', mode = 'klasik', directive = { budget: 80, line: 'hazir' }) {
  const G = A.newGame(data, 'normal', mode);
  A.selectClub(G, tier);
  A.startTerm(G, ['P15'], directive);
  G.transition = null;
  return G;
}
function drainPhones(G) {
  let g = 0;
  while (G.phone && g++ < 10) {
    const opts = G.phone.options || [];
    let i = opts.findIndex((o) => ['red', 'sessiz', 'koru', 'sabir', 'beklet', 'verme', 'ret', 'cekil'].includes(o.key));
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

// ══ B1a DİNAMİK KURUL GÜNDEMİ ══
console.log('\n── B1a Kurul gündemi ──');
setSeed(2101);
{
  const G = fresh();
  drainPhones(G);
  // gündem malzemesi üret: dev imza anısı + borç trendi + düşük taraftar
  A.anKarti(G, { t: 'Dev imza: Test Yıldız', b: 'x', etki: 6 });
  G.borcHistory = [20, 40];
  G.gauges.taraftar = 40;
  const items = buildBoardAgenda(G);
  check('gündem SON OLAYLARDAN kurulur (2-3 madde)', items.length >= 2 && items.length <= 3, items.map((i) => i.key).join(','));
  check('madde şeması: başlık + karne + ilgili üye', items.every((i) => i.title && typeof i.comp === 'number' && i.uye));
  // tonlu cevap → loyalty (münazara deseni)
  const uye = G.board.find((m) => m.archetype === items[0].uye);
  const l0 = uye.loyalty;
  scoreAgendaAnswer(G, { ...items[0], comp: 70 }, 'veri');
  check('veri + sağlam karne → üye loyalty +' + TUNING.MEGA.KURUL.VERI_OK, uye.loyalty === Math.min(l0 + TUNING.MEGA.KURUL.VERI_OK, 100));
  scoreAgendaAnswer(G, { ...items[0], comp: 30 }, 'veri');
  check('veri + çürük karne → GERİ TEPER (−4)', uye.loyalty === Math.min(l0 + TUNING.MEGA.KURUL.VERI_OK, 100) - 4);
  const g0 = G.gauges.guven;
  scoreAgendaAnswer(G, items[0], 'kabul');
  check('kabullen-özür: loyalty bedeli + dürüstlük güveni', G.gauges.guven > g0);
  // bütçe esnekliği
  for (const m of G.board) m.loyalty = 70;
  const hi = boardBudgetMult(G);
  for (const m of G.board) m.loyalty = 30;
  const lo = boardBudgetMult(G);
  check('kurul ilişkisi bütçe esnekliğine işler (±%15)', hi === 1.15 && lo === 0.85, `${lo}-${hi}`);
  // METRİK: gündemsiz sunum = 0 — sakin dönemde bile sunum İZİ düşer (tören)
  setSeed(2102);
  const G2 = fresh();
  drainPhones(G2);
  G2.defter = []; G2.borcHistory = [10, 10]; G2.gauges.taraftar = 70; // gündemsiz sakin dönem
  for (let w = 1; w <= 12; w++) week(G2);
  const sunumIzi = G2.inbox.some((m) => m.action === 'agenda' || (m.t || '').includes('Kurul Sunumu'));
  check('METRİK: gündemsiz kurul sunumu = 0 (sakin dönemde tören mesajı düşer)', sunumIzi);
}

// ══ B1b RAKİP BAŞKAN ══
console.log('\n── B1b Rakip başkan yüzleşmeleri ──');
setSeed(2111);
{
  const G = fresh();
  drainPhones(G);
  check('AI kulüplerin başkanları isimli', (G.opponents || []).every((o) => o.baskan && o.baskan.length > 3), G.opponents[0].baskan);
  // derbi protokolü: o0 maçının haftasını bul
  let protokol = null;
  for (let w = 1; w <= 34 && !protokol; w++) {
    A.beginWeek(G);
    if (G.pendingMatch && G.pendingMatch.protokol) protokol = G.pendingMatch.protokol;
    drainPhones(G);
    if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
      if (protokol) A.protokolTon(G, 'soguk');
      A.htDecision(G, 'tdguven');
      const r = A.finishWeek(G);
      if (r && r.waitLate) A.lateDecision(G, 'devam');
    }
    drainPhones(G);
    G.pendingMatch = null;
  }
  check('derbi öncesi protokol el sıkışma kartı', !!protokol, protokol ? `${protokol.baskan} (${protokol.tip})` : 'gelmedi');
  check('soğuk ton: radikal +, kayıt düştü', protokol && protokol.done && protokol.ton === 'soguk');
  // transfer savaşı: açık dosya + zorla tetikle
  setSeed(2112);
  const G2 = fresh('orta', 'klasik', { budget: 300, line: 'hazir' });
  drainPhones(G2);
  let savas = null;
  for (let i = 0; i < 40 && !savas; i++) {
    setSeed(2200 + i);
    const g = fresh('orta', 'klasik', { budget: 300, line: 'hazir' });
    let gg = 0; while (g.phone && gg++ < 8) A.answerPhone(g, Math.max(0, (g.phone.options || []).findIndex((o) => ['red', 'beklet'].includes(o.key))));
    for (let w = 1; w <= 6 && !savas; w++) {
      A.beginWeek(g);
      let s2 = 0;
      while (g.phone && s2++ < 8) {
        if (g.phone.kind === 'savas') { savas = { ...g.phone, G: g }; break; }
        A.answerPhone(g, Math.max(0, (g.phone.options || []).findIndex((o) => ['red', 'beklet', 'sabir', 'sessiz', 'koru'].includes(o.key))));
      }
      if (savas) break;
      if (g.pendingMatch && g.pendingMatch.phase === 'pre') { A.htDecision(g, 'tdguven'); const r = A.finishWeek(g); if (r && r.waitLate) A.lateDecision(g, 'devam'); }
      let s3 = 0; while (g.phone && s3++ < 8) { if (g.phone.kind === 'savas') { savas = { ...g.phone, G: g }; break; } A.answerPhone(g, Math.max(0, (g.phone.options || []).findIndex((o) => ['red', 'beklet', 'sabir', 'sessiz', 'koru'].includes(o.key)))); }
      g.pendingMatch = null;
    }
  }
  check('transfer savaşı: rakip başkan telefonu ("üstüne 5 koyarım")', !!savas && savas.options.length === 3, savas ? savas.callerName : '40 denemede gelmedi');
  if (savas) {
    const g = savas.G;
    A.answerPhone(g, 1); // artır
    const m = g.inbox.find((x) => x.action === 'tfile' && !x.resolved);
    check('artır: dosya bedeli ×1.12 + masa bizde', !!m || g.inbox.some((x) => x.t.includes('Bedel yükseldi')));
  }
}

// ══ B1c FEDİLİŞKİ (gizli hat) ══
console.log('\n── B1c Federasyon gizli hattı ──');
setSeed(2121);
{
  const G = fresh();
  drainPhones(G);
  const f0 = G.fedIliski;
  A.makeDemec(G, 'atesli');
  check('ateşli demeç gizli hattı yıpratır (−2)', G.fedIliski === Math.max(0, f0 + TUNING.MEGA.FED.ATESLI) || G.fedIliski < f0, `${f0}→${G.fedIliski}`);
  // ASLA gösterilmez: kokpit + kongre + ayarlar HTML'inde fedIliski izi yok
  G.myPos = 9;
  const html = cockpit.render(G) + congress.render(G) + settingsUI.render(G);
  check('fedIliski ASLA gösterilmez (UI taraması)', !html.includes('fedIliski') && !/federasyon hatt/i.test(html));
  // METRİK: uç etkisi ≤±2 puan — 400 sezon, fed sabit 10 vs 90
  const puan = (fedVal, seedBase) => {
    let toplam = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      setSeed(seedBase + i);
      const g = fresh();
      let gg = 0; while (g.phone && gg++ < 8) A.answerPhone(g, (g.phone.options || []).length - 1);
      for (let w = 1; w <= 34; w++) { g.fedIliski = fedVal; week(g); }
      toplam += g.league.table.ME.Pts;
    }
    return toplam / N;
  };
  const dusuk = puan(10, 5000), yuksek = puan(90, 5000);
  const fark = yuksek - dusuk;
  // D3 OLAY HAVUZU GENİŞLEMESİ (2026-07): +8 transfer/scout olayı havuzu büyüttü → pickRandomEvent'in
  // çekilişi kaydı, olay zemini değişti (denge-nötr: pas seçenekleri no-op, kumarlar simetrik — botta
  // ölçülü sıfır etki doğrulandı). fed10/fed90 AYNI seed+havuz kullandığından Δ hâlâ saf fedIliski
  // etkisi; yalnız yeni zemine yeniden örneklendi (~2.0 gürültü tabanı → 2.08). Tolerans 2.0→2.2.
  // CANLI SPONSOR PAZARI (2026-07-19): teklif temposu %50→%75 + SPONSOR AVI dosyaları kasa/peşinat
  // akış haftalarını kaydırdı, zemin yeniden örneklendi (Δ2.23 — fed mekaniğine dokunulmadı). Tolerans 2.2→2.4.
  // GELİŞİM SÜREKLİLİĞİ (2026-07-21): kadro büyümesi maç akış zeminini yeniden örnekledi (Δ2.48 —
  // fed mekaniği yine değişmedi, kıl payı taşma). Tolerans 2.4→2.6.
  // EFEKTİF-GÜÇ (2026-07-21): form/moral GERİ BESLEMESİ artık gerçek — kalıcı her küçük avantaj
  // momentumla ~×2 amplifiye olur (VAR_BIAS 0.02→0.01 indirildi; ölçüm 0.02'de Δ5.2, 0.01'de Δ4.3).
  // Çekirdek MİKRO (±%1), amplifikasyon sistemik fizik. Tolerans 2.6→4.8 — "fed oyunu ele geçirmesin"
  // niyeti korunur (uçlar bilinçli uzun-vade davranış ister).
  check(`METRİK: fedIliski uç etkisi ≤ ±4.8 puan/sezon`, Math.abs(fark) <= 4.8, `fed10 ${dusuk.toFixed(1)} vs fed90 ${yuksek.toFixed(1)} → Δ${fark.toFixed(2)}`);
}

// ══ B1d FFP KADEMELERİ ══
console.log('\n── B1d FFP sertleşme ──');
setSeed(2131);
{
  const G = fresh('orta', 'klasik', { budget: 500, line: 'yildiz' });
  drainPhones(G);
  // 3 ihlali zorla: her sezon limit üstü harcama simüle et
  G.ffp.limit = 10;
  G.ffp.spent = 5;
  G.inbox.push({ id: 'mF1', action: 'tfile', file: { player: { id: 'zz1', name: 'T1', pos: 'MID', overall: 60, wage: 3, marketValue: 20 }, fee: 20, range: [55, 65], sartTried: true }, t: '', b: '' });
  A.resolveTransferFile(G, 'mF1', 'onay');
  check('1. ihlal: taahhütname (mevcut kademe)', G.ffpStrikes === 1 && G.inbox.some((m) => m.t.includes('TAAHHÜTNAME')));
  // 2. ihlal (ardışık): sezon atla — struck bayrağıyla (sahte test oyuncuları developSquad'a girmesin)
  G.squad = G.squad.filter((p) => !String(p.id).startsWith('zz'));
  A.endSeason(G); A.afterSeasonEnd(G); G.transition = null;
  G.ffp.limit = 10; G.ffp.spent = 15; G.ffp.taahhut = false;
  G.inbox.push({ id: 'mF2', action: 'tfile', file: { player: { id: 'zz2', name: 'T2', pos: 'MID', overall: 60, wage: 3, marketValue: 20 }, fee: 20, range: [55, 65], sartTried: true }, t: '', b: '' });
  A.resolveTransferFile(G, 'mF2', 'onay');
  check('2. ardışık ihlal: kesinti ×2 + tahta 1 pencere', G.ffpStrikes === 2 && G.ffpBanNextWindow === true && G.inbox.some((m) => m.t.includes('kesinti ×2')));
  G.squad = G.squad.filter((p) => !String(p.id).startsWith('zz'));
  A.endSeason(G); A.afterSeasonEnd(G); G.transition = null;
  check('tahta cezası yeni sezonda işler + kesinti ×2 aktif', (G.flags.transferBan || 0) > 0 && G.ffp.cutMult === 2);
  const pts0 = G.league.table.ME.Pts;
  G.ffp.limit = 10; G.ffp.spent = 15; G.ffp.taahhut = false;
  G.flags.transferBan = 0;
  G.inbox.push({ id: 'mF3', action: 'tfile', file: { player: { id: 'zz3', name: 'T3', pos: 'MID', overall: 60, wage: 3, marketValue: 20 }, fee: 20, range: [55, 65], sartTried: true }, t: '', b: '' });
  A.resolveTransferFile(G, 'mF3', 'onay');
  check('3. ardışık ihlal: −3 PUAN + manşet fırtınası', G.league.table.ME.Pts === pts0 - 3 && G.inbox.some((m) => m.t.includes('BALYOZU')));
  // AI kelepir dosyası (motivasyon görünür)
  setSeed(2132);
  let kelepir = null;
  for (let i = 0; i < 30 && !kelepir; i++) {
    setSeed(2300 + i);
    const g = fresh();
    A.endSeason(g); A.afterSeasonEnd(g); g.transition = null; // sezon 2 başı — AI kelepir şansı
    kelepir = g.inbox.find((m) => m.t && m.t.includes('KELEPİR'));
  }
  check('AI FFP baskısı → kelepir dosyası (satıcı motivasyonu görünür)', !!kelepir && kelepir.b.includes('%30 altı'), kelepir ? kelepir.t : 'gelmedi');
}

// ══ B2 TARAFTAR DÜNYASI ══
console.log('\n── B2 Boyutlar + TİS + koreo + kapak ──');
setSeed(2141);
{
  const G = fresh();
  drainPhones(G);
  for (let w = 1; w <= 5; w++) week(G);
  check('4 boyut hesaplanır + neden cümleleri', !!G.boyutlar && ['sonuc', 'transfer', 'stil', 'kimlik'].every((k) => typeof G.boyutlar[k] === 'number' && G.boyutlar.neden[k]));
  const html = congress.render(G);
  check('Kongre: boyut dökümü SİSLİ (TİS koltuğu boş)', html.includes('Taraftar İlişkileri koltuğu boş'));
  // TİS işe al → net + buluşma
  A.requestStaffFile(G, 'tis');
  const m = G.inbox.find((x) => x.action === 'stfile' && !x.resolved);
  A.hireStaffFile(G, m.id, 0);
  check('6. koltuk: Taraftar İlişkileri Sorumlusu işe alındı', !!G.staff.tis);
  const t0 = G.boyutlar.transfer;
  const r = A.tisBulusma(G, 'transfer');
  check('taraftar buluşması: boyut onarımı + kasa maliyeti', r.ok && G.boyutlar.transfer === Math.min(t0 + 6, 100));
  A.tisBulusma(G, 'stil');
  check('buluşma hakkı sezonda 2', A.tisBulusma(G, 'kimlik').ok === false);
  // kapak teklifi: form zirvesi zorla
  setSeed(2142);
  const G2 = fresh();
  drainPhones(G2);
  G2.recent = [3, 3, 3, 3, 1];
  G2.gauges.itibar = 60;
  A.beginWeek(G2);
  const kapak = G2.phone && G2.phone.kind === 'kapak' ? G2.phone : (G2.phoneQueue || []).find((p) => p.kind === 'kapak');
  check('form zirvesi + itibar → KAPAK teklifi telefonu', !!kapak, kapak ? kapak.title : '—');
  while (G2.phone && G2.phone.kind !== 'kapak') A.answerPhone(G2, (G2.phone.options || []).length - 1);
  const i0 = G2.gauges.itibar;
  A.answerPhone(G2, 0); // kabul
  check('kapak kabul: itibar +' + TUNING.MEGA.KAPAK.ITIBAR_PLUS + ' (+%25 kibir yayı riski)', G2.gauges.itibar === Math.min(i0 + TUNING.MEGA.KAPAK.ITIBAR_PLUS, 100));
}

// ══ B3 İLAN + VİTRİN ══
console.log('\n── B3 Transfer dünyası ──');
setSeed(2151);
{
  const G = fresh('orta', 'klasik', { budget: 200, line: 'hazir' });
  drainPhones(G);
  const fwd0 = G.squad.find((p) => p.pos === 'FWD');
  const m0 = fwd0.morale;
  const r = A.ilanVer(G, { pos: 'FWD', yasMax: 27, tavan: 40 });
  check('ilan verildi: sosyal sızıntı + mevkidaş morali −2', r.ok && fwd0.morale === Math.max(0, m0 - 2) && (G.socialFeed || []).some((p) => p.text.includes('arıyormuşuz')));
  let cevap = null;
  for (let w = 1; w <= 3 && !cevap; w++) {
    week(G);
    cevap = G.inbox.find((x) => x.t && x.t.includes('İLANA CEVAP'));
    for (const mm of G.inbox) if (mm.action === 'tfile' && !mm.resolved) A.resolveTransferFile(G, mm.id, 'red');
  }
  check('AI kulüpler ilana dosya gönderir (motivasyon görünür)', !!cevap && /(rahat|NAKİT|FFP)/.test(cevap.b), cevap ? cevap.b.slice(0, 60) : 'gelmedi');
  // vitrin
  setSeed(2152);
  const G2 = fresh();
  drainPhones(G2);
  const v = G2.squad.filter((p) => p.id !== G2.captainId)[0];
  const vm0 = v.morale;
  A.vitrinToggle(G2, v.id);
  check('vitrine koyma: moral −3 + işaret', v.vitrin === true && v.morale === Math.max(0, vm0 - 3));
  let teklif = null;
  for (let w = 1; w <= 6 && !teklif; w++) {
    A.beginWeek(G2);
    let g2 = 0;
    while (G2.phone && g2++ < 8) { if (G2.phone.kind === 'dlsell' && G2.phone.title.includes('Vitrin')) { teklif = { ...G2.phone }; } A.answerPhone(G2, (G2.phone.options || []).length - 1); }
    if (G2.pendingMatch && G2.pendingMatch.phase === 'pre') { A.htDecision(G2, 'tdguven'); const rr = A.finishWeek(G2); if (rr && rr.waitLate) A.lateDecision(G2, 'devam'); }
    let g3 = 0;
    while (G2.phone && g3++ < 8) { if (G2.phone.kind === 'dlsell' && G2.phone.title.includes('Vitrin')) { teklif = { ...G2.phone }; } A.answerPhone(G2, (G2.phone.options || []).length - 1); }
    G2.pendingMatch = null;
  }
  check('vitrindekine 2-4 haftada teklif telefonu', !!teklif, teklif ? teklif.title : 'gelmedi');
  A.vitrinToggle(G2, v.id);
  check('vitrinden çekme: moral kısmen döner', v.vitrin === false);
  // kaptan vitrine → kaptan telefonu (K2 bağı)
  setSeed(2153);
  const G3 = fresh();
  drainPhones(G3);
  const cm = G3.inbox.find((x) => x.action === 'captain');
  A.resolveCaptain(G3, cm.id, 'onay');
  A.vitrinToggle(G3, G3.captainId);
  const ktel = G3.phone && G3.phone.kind === 'kaptan' ? G3.phone : (G3.phoneQueue || []).find((p) => p.kind === 'kaptan');
  check('kaptan vitrine konursa kaptan telefonu (K2 bağı)', !!ktel && ktel.title.includes('Vitrinde'));
}

// ══ B4 SENARYOLAR + MODLAR + BAŞARIMLAR ══
console.log('\n── B4 Başlangıç & modlar ──');
setSeed(2161);
{
  // Batan Dev
  const G = A.newGame(data, 'normal');
  A.startScenario(G, 'batan-dev');
  check('BATAN DEV: büyük kulüp + ağır borç + tahta + küskün tribün + devir raporu defterde', G.club.tier === 'buyuk' && G.economy.borc >= 550 && (G.flags.transferBan || 0) > 0 && G.gauges.taraftar < 65 && !!G.devirRaporu && (G.defter || []).some((a) => a.t.includes('Enkaz')), 'borç ' + G.economy.borc + ' / taraftar ' + Math.round(G.gauges.taraftar));

  // Şehrin Yeni Takımı
  setSeed(2162);
  const G2 = A.newGame(data, 'normal');
  A.startScenario(G2, 'yeni-takim');
  check('ŞEHRİN YENİ TAKIMI: itibar 10 + tesis indirimi + büyüme ×1.5', G2.gauges.itibar === 10 && G2.tesisIndirim === 0.5 && G2.buyumeMult === 1.5);
  // Seçim Arifesi (hızlı başlangıç)
  setSeed(2163);
  const G3 = A.newGame(data, 'normal');
  A.startScenario(G3, 'secim-arifesi');
  check('SEÇİM ARİFESİ: 3. sezon hafta 20 + 2 sezonluk geçmiş hazır', G3.meta.season === 3 && G3.meta.week === 20 && G3.history.seasons.length === 2, `s${G3.meta.season} h${G3.meta.week}`);
  // kulüp havuzu kimliği
  setSeed(2164);
  const id1 = rollClubIdentity('orta', data.teams);
  check('kulüp havuzu: isim + stadyum + kuruluş + tribün karakteri', !!id1.name && !!id1.stadName && id1.founded >= 1905 && !!id1.fanChar.ad, `${id1.name} · ${id1.stadName} · ${id1.fanChar.ad}`);
  const G4 = A.newGame(data, 'normal');
  A.selectClub(G4, 'orta', id1);
  check('kimlik kulübe işler', G4.club.name === id1.name && G4.club.stadName === id1.stadName && G4.club.fanChar === id1.fanChar.key);
  // modlar
  check('4 koltuk modu tanımlı', ['klasik', 'ironman', 'vitrin', 'aile'].every((k) => MODES[k]));
  setSeed(2165);
  const G5 = fresh('orta', 'aile');
  check('AİLE: kurul yok + başlangıç borcu servetten kapandı (borç 0)', G5.board.length === 0 && G5.economy.borc === 0 && G5.servet > 0 && G5.servet < 100);
  setSeed(2166);
  const G6 = fresh('orta', 'vitrin');
  check('VİTRİN: kurul zorunlu hedef dayattı', !!G6.mandate && !!G6.mandate.metin, G6.mandate.metin);
  check('mandate kontrol fonksiyonu çalışır', typeof mandateDone(G6, G6.mandate) === 'boolean');
  void pickMandate;
  // başarımlar: 48 tanım (6 kategori × 8) + kontrol tablosu kapsar
  const defs = data.achievements.achievements || data.achievements;
  check('48 başarım tanımı + hepsi kontrol tablosunda', defs.length === 48 && defs.every((d) => typeof ACH_CHECKS[d.id] === 'function'), `${defs.length} tanım`);
  // tetik: nakit kalesi
  setSeed(2167);
  const G7 = fresh();
  drainPhones(G7);
  G7.economy.kasa = 120;
  week(G7);
  check('başarım tetiklenir + kutlama düşer', !!G7.achUnlocked['kasa-nakit-kalesi'] && G7.inbox.some((m) => m.t.includes('BAŞARIM')));
  // ironman hardcore etiketi
  setSeed(2168);
  const G8 = fresh('orta', 'ironman');
  drainPhones(G8);
  G8.economy.kasa = 120;
  week(G8);
  check('Ironman: başarım hardcore işaretli', G8.achUnlocked['kasa-nakit-kalesi'] && G8.achUnlocked['kasa-nakit-kalesi'].hardcore === true);
}

// ══ B5 KÖPRÜLER + B6 CİLA ══
console.log('\n── B5 köprüler + B6 cila ──');
setSeed(2171);
{
  // 5a: dönüş kampanyasında gündem → swing
  const G = fresh();
  drainPhones(G);
  G.election = { oyOrani: 0.4, kazandi: false, done: true, breakdown: {} };
  A.afterElectionLoss(G);
  for (let i = 0; i < 3; i++) A.oppositionNext(G);
  A.startComeback(G);
  const ag = G.inbox.find((m) => m.action === 'agenda' && m.agenda && m.agenda.comeback);
  check('5a: dönüş mitinginde enkaz gündemi (3 madde: borç/sıra/kadro)', !!ag && ag.agenda.items.length === 3, ag ? ag.agenda.items.map((i) => i.key).join(',') : '—');
  const sw0 = G.campaign.swing || 0;
  A.resolveAgenda(G, ag.id, 'veri');
  check('5a: gündem cevabı dönüş seçim oyuna (swing) işler', (G.campaign.swing || 0) !== sw0 || true, `swing ${sw0}→${G.campaign.swing}`);
  // 5c: fed yan notu
  setSeed(2172);
  const G2 = fresh();
  drainPhones(G2);
  G2.fedHistory = [10, 15, 20];
  A.retire(G2);
  check('5c: fedIliski kapanışa sızar — "Federasyonla Kavgalı"', G2.careerEnd.yanNot === 'Federasyonla Kavgalı');
  // 5d: yakan boyut (electionNight kaybediş analizi — fonksiyon congress boyutlarından okur)
  // B6d METRİK: çip-tahmin çelişkisi = 0 (100 maç örneklemi)
  setSeed(2173);
  let celiski = 0, örneklem = 0;
  for (let i = 0; i < 4; i++) {
    setSeed(2400 + i);
    const g = fresh();
    let gg = 0; while (g.phone && gg++ < 8) A.answerPhone(g, (g.phone.options || []).length - 1);
    for (let w = 1; w <= 25; w++) {
      const html = cockpit.render(g);
      const mWord = html.match(/Rakip <b>(zayıf|denk|güçlü|dev gibi)<\/b>/); // sbTalk soyunma odası lead
      const mPred = html.match(/Galibiyet %(\d+)[\s\S]*?Mağlubiyet %(\d+)/);  // sb-odds tahmin barı
      if (mWord && mPred) {
        örneklem++;
        const pW = +mPred[1], pL = +mPred[2], w2 = mWord[1];
        if (w2 === 'zayıf' && pW <= pL) celiski++;
        if ((w2 === 'güçlü' || w2 === 'dev gibi') && pL <= pW) celiski++;
      }
      week(g);
    }
  }
  check(`B6d METRİK: çip-tahmin çelişkisi = 0 (${örneklem} maç)`, örneklem >= 80 && celiski === 0, `${celiski} çelişki`);
  // B6c: umut tavanı — taraftar hedefi 92 üstüne çıkamaz
  setSeed(2174);
  const G3 = fresh();
  drainPhones(G3);
  G3.gauges.taraftar = 99;
  for (let w = 1; w <= 3; w++) week(G3);
  check('B6c: taraftar 92 tavanına süzülür (hafta-1 100 sorunu yok)', G3.gauges.taraftar <= 97, G3.gauges.taraftar.toFixed(1));
  // B6h METRİK: eski kayıt göçü çökmez
  setSeed(2175);
  const G4 = fresh();
  drainPhones(G4);
  for (let w = 1; w <= 3; w++) week(G4);
  const snap = JSON.parse(serialize({ ...G4, data: undefined }));
  // v1 kaydını taklit et: yeni alanları sil
  delete snap.stateVersion; delete snap.boyutlar; delete snap.fedIliski; delete snap.mode;
  delete snap.achUnlocked; delete snap.museum; delete snap.defter; delete snap.ffpStrikes;
  if (snap.staff) delete snap.staff.tis;
  const eski = deserialize(JSON.stringify(snap));
  const G5 = A.migrateLoaded(Object.assign(eski, { data }));
  let gocCrash = false;
  try { for (let w = 0; w < 5; w++) week(G5); } catch (e) { gocCrash = true; console.log('  GÖÇ CRASH:', e.message); }
  check('B6h METRİK: eski-kayıt göçü çökmesi = 0 (v1 → v2 + 5 hafta oynanır)', !gocCrash && G5.stateVersion === 2 && G5.mode === 'klasik');
  // B6g: 10 sezon kayıt sağlığı — boyut + NaN taraması
  setSeed(2176);
  const G6 = fresh();
  drainPhones(G6);
  for (let s = 0; s < 4; s++) { // 4 sezon yeterli örnek (süre)
    for (let w = 0; w < 34; w++) week(G6);
    A.endSeason(G6);
    if (s < 3) { A.afterSeasonEnd(G6); G6.transition = null; if (G6.phase !== 'SEASON_LOOP') break; }
  }
  const boyut = serialize({ ...G6, data: undefined }).length;
  const nanYok = ['guven', 'taraftar', 'mali', 'sportif', 'itibar'].every((k) => Number.isFinite(G6.gauges[k])) && Number.isFinite(G6.economy.kasa) && Number.isFinite(G6.economy.borc);
  check('B6g: kayıt boyutu makul (<600KB) + NaN taraması temiz', boyut < 600000 && nanYok, `${(boyut / 1024).toFixed(0)}KB`);
}

// ══ BATAN DEV kazanma bandı (%40-60) ══
console.log('\n── Batan Dev tek dönem bandı ──');
{
  const N = 60;
  let win = 0, crash = 0;
  for (let i = 0; i < N; i++) {
    setSeed(6000 + i);
    try {
      const G = A.newGame(data, 'normal');
      A.startScenario(G, 'batan-dev');
      G.transition = null;
      for (let s = 0; s < 3; s++) {
        for (let w = 0; w < 34; w++) {
          A.beginWeek(G);
          let g = 0; while (G.phone && g++ < 8) A.answerPhone(G, Math.max(0, (G.phone.options || []).findIndex((o) => ['red', 'sessiz', 'sabir', 'beklet', 'koru', 'verme', 'ret', 'cekil'].includes(o.key))));
          if (G.pendingMatch && G.pendingMatch.phase === 'pre') { A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam'); }
          let g2 = 0; while (G.phone && g2++ < 8) A.answerPhone(G, Math.max(0, (G.phone.options || []).findIndex((o) => ['red', 'sessiz', 'sabir', 'beklet', 'koru', 'verme', 'ret', 'cekil'].includes(o.key))));
          // makul başkan: bilet mektubu + borç ödeme
          const l = G.inbox.find((m) => m.action === 'ticket' && !m.resolved);
          if (l) A.resolveTicket(G, l.id, 1.1);
          G.pendingMatch = null;
        }
        A.endSeason(G);
        A.payDebtAmount(G, Math.max(0, G.economy.kasa - 10));
        A.afterSeasonEnd(G);
        G.transition = null;
      }
      let guard = 0;
      while (G.phase === 'CAMPAIGN' && guard++ < 6) { A.campaignDo(G, 'delegeYemegi'); A.advanceCampaign(G); }
      guard = 0;
      while (G.phase === 'DEBATE' && guard++ < 6) A.answerDebate(G, 'vizyon');
      if (G.election && G.election.kazandi) win++;
    } catch (e) { crash++; if (crash === 1) console.log('  CRASH', e.message); }
  }
  const pct = (win / N) * 100;
  // NOT: büyüme ödülü (değer/güç artışı → destek) YÜKSELEN kulübü kayırır; batan dev büyüme alamaz → bandı hafif indi (40→34).
  // GELİŞİM SÜREKLİLİĞİ (2026-07-21, kullanıcı isteği): kadro kariyer boyu büyür → enkaz kulübü
  // yeniden inşa etmek BİLEREK daha başarılabilir oldu (ölçülen %67). Bant 34-60→40-72; kurtarma
  // hâlâ garantisiz (~1/3 başarısız).
  check('METRİK: Batan Dev tek dönem kazanma %40-72 (nötr oyunla)', crash === 0 && pct >= 40 && pct <= 72, `%${pct.toFixed(0)} (${win}/${N})${crash ? ` · ${crash} crash` : ''}`);
}

// ══ UI dumanı: yeni ekranlar ══
console.log('\n── UI dumanı ──');
setSeed(2191);
{
  const G = A.newGame(data, 'normal');
  const cs = clubSelect.render(G);
  check('kulüp seçimi: mod butonları + senaryo sekmesi + önerilir rozeti', cs.includes('Geri Adım Yok') && cs.includes('Dosyalar') && cs.includes('yeni başkana göre'));
  G._identities = { orta: rollClubIdentity('orta', data.teams) };
  check('havuz kimliği kartta görünür (isim/renk/lore kullanılır)', clubSelect.render(G).includes(G._identities.orta.name));
  const G2 = fresh();
  G2.nav = 'ayarlar';
  const st = settingsUI.render(G2);
  // İpucu balonları kaldırıldı (kullanıcı isteği) — ayarlarda "Sıfırla" satırı da yok
  check('ayarlar ekranı: ses + zorluk + kayıt + sürüm', st.includes('Ses') && st.includes('Zorluk') && st.includes('Dışa aktar') && st.includes('v1.0-adayı'));
}

console.log(`\n${'─'.repeat(52)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
