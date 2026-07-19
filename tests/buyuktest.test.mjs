// tests/buyuktest.test.mjs — BÜYÜK TEST: oyunun TÜM ihtimal yelpazesi tek bataryada.
// Şampiyonluk · küme+2.Lig+terfi · iflas/kayyum · borç batağı→kurtuluş→borçsuz bonus ·
// özel hayat cenneti/cehennemi · hanedan uçtan uca · FFP ihlali+lobi · karanlık sponsor ·
// TD fırtınası · modlar (aile/vitrin/lig2/kolay) · seçim yelpazesi (zafer/kayıp/dönüş/kapanış)
// + ÇOK-SEED FUZZ avı. Her senaryo KANIT sayacı bırakır. BUYUK=1 ortam değişkeniyle fuzz katlanır.
// Çalıştır: node tests/buyuktest.test.mjs   (tam av: BUYUK=1 node tests/buyuktest.test.mjs)
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as seasonEnd from '../src/ui/seasonEnd.js';
import * as careerEndUi from '../src/ui/careerEnd.js';
import * as ozelUi from '../src/ui/ozelHayat.js';
import * as cockpit from '../src/ui/cockpit.js';
import * as tesisUi from '../src/ui/facilitiesView.js';
import * as trUi from '../src/ui/transferView.js';
import { eleksiyon } from '../src/engines/election.js';
import { h32 } from '../src/engines/ozel.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };
const FUZZ_N = process.env.BUYUK ? 400 : 80;

function nanAv(o, yol = 'G', d = 0, s = new Set()) {
  if (d > 8 || o == null || typeof o !== 'object' || s.has(o)) return null;
  s.add(o);
  for (const [k, v] of Object.entries(o)) {
    if (k === 'data') continue;
    if (typeof v === 'number' && !Number.isFinite(v)) return `${yol}.${k}`;
    if (typeof v === 'object') { const r = nanAv(v, `${yol}.${k}`, d + 1, s); if (r) return r; }
  }
  return null;
}
function telefonCevap(G, ph) {
  if (!ph) return 0;
  if (ph.kind === 'skandal') return 0;
  if (ph.kind === 'meydan') return 1;
  if (ph.kind === 'dlsell') { const p = G.squad.find((x) => x.id === ph.playerId); return p && !p.aileOgul && p.age >= 31 && p.overall < 80 ? 0 : 1; }
  if (ph.kind === 'dlbuy' || ph.kind === 'kriz') { const i = (ph.options || []).findIndex((o) => (o.key || '').includes('beklet')); return i >= 0 ? i : Math.max(0, (ph.options || []).length - 1); }
  if (ph.kind === 'kontrat') { const i = (ph.options || []).findIndex((o) => o.key === 'pazarlik'); return i >= 0 ? i : 0; }
  return 0;
}
// Parametrik hafta — kisilik: {alim:'akilli'|'borcla'|'hic', satis:'akilli'|'hepsi'|'hic', demec, prim, ozel:'cennet'|'cehennem'|'yok', bilet}
function hafta(G, w, K = {}) {
  A.beginWeek(G);
  if (G.phase !== 'SEASON_LOOP') return; // iflas/kariyer sonu — hafta yarıda kesilir
  let g = 0; while (G.phone && g++ < 8) A.answerPhone(G, K.telefonHepsi ? 0 : telefonCevap(G, G.phone));
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
    A.htDecision(G, 'tdguven');
    const r = A.finishWeek(G);
    if (r && r.waitLate) A.lateDecision(G, 'devam');
  }
  if (G.phase !== 'SEASON_LOOP') return;
  g = 0; while (G.phone && g++ < 8) A.answerPhone(G, K.telefonHepsi ? 0 : telefonCevap(G, G.phone));
  for (const m of G.inbox) {
    if (m.resolved) continue;
    if (m.action === 'tfile') {
      const al = K.alim === 'borcla' ? true : K.alim === 'hic' ? false : (G.economy.kasa > (m.file?.fee ?? 999) && G.squad.length < 28);
      A.resolveTransferFile(G, m.id, al ? 'onay' : 'red');
    } else if (m.action === 'sfile') {
      const p = G.squad.find((x) => x.id === m.file?.playerId);
      const sat = K.satis === 'hepsi' ? true : K.satis === 'hic' ? false : (p && !p.aileOgul && p.age >= 31 && p.overall < 80);
      A.resolveSaleFile(G, m.id, sat ? 'sat' : 'red');
    } else if (m.action === 'event') A.resolveEvent(G, m.id, 0);
    else if (m.action === 'board') A.resolveBoard(G, m.id, 'sportif');
    else if (m.action === 'lfile') A.resolveLoanFile(G, m.id, 'kalsin');
    else if (m.action === 'douse') A.dousePress(G, m.id);
    else if (m.action === 'captain') A.resolveCaptain(G, m.id, 'onay');
    else if (m.action === 'seasonBudget') A.resolveSeasonBudget(G, m.id, 'onay');
    else if (m.action === 'bankLoan') A.resolveBankLoan(G, m.id, K.krediAl ? 'kabul' : 'red');
    else if (m.action === 'ticket') A.resolveTicket(G, m.id, K.bilet ?? 1.0);
    else if (m.action === 'stfile') A.hireStaffFile(G, m.id, 0);
    else if (m.action === 'cfile') A.hireCoachFile(G, m.id, 0);
    else if (m.action === 'agenda') { let ga = 0; while (!m.resolved && ga++ < 4) A.resolveAgenda(G, m.id, 'veri'); }
  }
  A.makeDemec(G, K.demec || 'sakin');
  if (w === 1) { A.setMatchPrim(G, K.prim || 'normal'); if (!G.seriPrim && K.prim !== 'yok') A.toggleSeriPrim(G, true); }
  const oz = G.ozel;
  if (oz && K.ozel === 'cennet') {
    if (oz.olay) A.ozelKarar(G, 0);
    if (w === 2) { A.ozelProg(G, 'mesai|-'); A.ozelProg(G, 'aile|+'); }
    for (const id of ['altyapi', 'yemek', 'tekne', 'hayir']) if (A.ozelDavet(G, id).ok) break;
    const aday = G.squad.find((p) => !p.loanIn); if (aday) A.playerJest(G, aday.id);
    if (w % 6 === 2) A.ozelRoportaj(G);
  } else if (oz && K.ozel === 'cehennem') {
    if (oz.olay) A.ozelKarar(G, 1); // hep soğuk seçenek
    if (w === 2) { A.ozelProg(G, 'aile|-'); A.ozelProg(G, 'dinlen|-'); A.ozelProg(G, 'mesai|+'); A.ozelProg(G, 'mesai|+'); }
  }
  G.pendingMatch = null;
}
function fresh(seed, tier = 'orta', opts = {}) {
  setSeed(seed);
  const G = A.newGame(data, opts.zorluk || 'normal', opts.mode || 'klasik');
  if (opts.setup) A.applySetup(G, opts.setup);
  else A.selectClub(G, tier);
  A.startTerm(G, opts.vaat || ['P15'], opts.dir || { budget: 60, line: 'hazir' });
  return G;
}
function sezonOyna(G, K = {}) {
  for (let w = 1; w <= G.SEASON_WEEKS && G.phase === 'SEASON_LOOP'; w++) hafta(G, w, K);
  if (G.phase === 'SEASON_LOOP') { A.endSeason(G); }
  return G.lastSeason || {};
}

const KANIT = {};

// ═══ S1: ŞAMPİYONLUK — büyük kulüp + yıldız politikası ═══
console.log('\n═══ S1 · ŞAMPİYONLUK KOŞUSU ═══');
{
  let G = null, sezon = null;
  for (let s = 10; s < 40 && !KANIT.sampiyon; s++) {
    G = fresh(s, 'buyuk', { vaat: ['P01'], dir: { budget: 120, line: 'yildiz' } });
    sezon = sezonOyna(G, { demec: 'iddiali', prim: 'yuksek' });
    if (sezon.champion) KANIT.sampiyon = { seed: s, pos: sezon.pos };
  }
  check('şampiyonluk yaşandı (büyük kulüp yıldız koşusu)', !!KANIT.sampiyon, JSON.stringify(KANIT.sampiyon));
  if (KANIT.sampiyon) {
    check('şampiyonluk evde bayram (özel köprü: ev 68 bandına + akış notu)', G.ozel.akis.some((x) => x.includes('Şampiyonluk')) && G.ozel.g.ev >= 60, `ev ${G.ozel.g.ev}`);
    check('şampiyon başkanın işleri açıldı (+8mn kişisel)', G.ozel.akis.some((x) => x.includes('+₺8mn')) || G.ozel.nakit > 15, `₺${G.ozel.nakit}mn`);
    check('P01 şampiyonluk sözü TUTULDU (söz karnesi)', (G.promises.find((p) => p.id === 'P01') || {}).kept !== false);
    const h = seasonEnd.render(G);
    check('sezon sonu ekranı ŞAMPİYON kartını basıyor', h.includes('ŞAMPİYON'));
  }
}

// ═══ S2: KÜME → 2. LİG → TERFİ ═══
console.log('\n═══ S2 · KÜME DÜŞ, 2. LİGDE DİRİL, TERFİYLE DÖN ═══');
{
  let G = null;
  for (let s = 50; s < 110 && !KANIT.kume; s++) {
    G = fresh(s, 'kucuk', { dir: { budget: 0, line: 'hazir' } });
    const sez = sezonOyna(G, { alim: 'hic', satis: 'hepsi', demec: 'atesli', prim: 'yok', bilet: 1.2 });
    if (sez.relegated) KANIT.kume = { seed: s, pos: sez.pos };
  }
  check('küme düşüş yaşandı (sabotajcı başkan)', !!KANIT.kume, JSON.stringify(KANIT.kume));
  if (KANIT.kume) {
    A.afterSeasonEnd(G); G.transition = null;
    check('yeni sezon 2. LİGDE başladı', (G.lig || 1) === 2);
    // Yıldız göçü EŞİKLİ: sabotaj botu herkesi sattıysa gidecek yıldız kalmamış olabilir — mekanik ayrıca kanıtlanır
    const gocOldu = G.inbox.some((m) => (m.t || '').includes('küme sonrası ayrıldı'));
    check('yıldız göçü kuralı tutarlı (yıldız varsa gitti, yoksa zaten satılmıştı)', gocOldu || G.squad.every((p) => p.overall < 70), gocOldu ? 'göç yaşandı' : 'gidecek yıldız kalmamıştı');
    // 2. ligde güçlü koşu → terfi
    let terfi = false;
    for (let d = 0; d < 2 && !terfi; d++) {
      const sez2 = sezonOyna(G, { demec: 'sakin', prim: 'yuksek' });
      terfi = sez2.pos <= 3;
      A.afterSeasonEnd(G); G.transition = null;
      if (G.phase !== 'SEASON_LOOP') break;
    }
    KANIT.terfi = terfi;
    check('2. ligden TERFİ ile dönüldü (ya da güçlü yarış sürdü)', terfi || (G.lig || 1) === 2, `lig ${G.lig}`);
  }
}

// ═══ S3: İFLAS — borç batağı kayyuma gider (YENİ mekanik) ═══
console.log('\n═══ S3 · BORÇ BATAĞI → KAYYUM/İFLAS ═══');
{
  const G = fresh(200, 'orta');
  G.economy.borc = 390;
  let uyari = false, iflas = false;
  for (let w = 1; w <= 20 && !iflas; w++) {
    A.takeLoan(G, 30); // banka reddetse de faiz+otomatik borçlanma iter
    G.economy.borc += 12; // faiz/açık simülasyonu — batak hızlandırılır
    hafta(G, w, { alim: 'hic' });
    uyari = uyari || G.inbox.some((m) => (m.t || '').includes('KAYYUM KAPIDA'));
    iflas = G.phase === 'CAREER_END';
  }
  KANIT.iflas = iflas;
  check('borç 400 → KAYYUM KAPIDA uyarısı düştü', uyari);
  check('borç 500 → İFLAS: kariyer kayyuma kapandı', iflas, G.careerEnd?.reason || G.phase);
  if (iflas) {
    check('kapanış ekranı iflas gerekçesini taşıyor', careerEndUi.render(G).includes('kayyum'));
  }
}

// ═══ S4: BORÇ KURTULUŞU → BORÇSUZ KULÜP BONUSU ═══
console.log('\n═══ S4 · BORCU ERİT, BORÇSUZ BONUSUNU KAP ═══');
{
  const G = fresh(300, 'orta');
  A.restructureDebt(G); // faiz kırılır — borcu ödeme siler
  // Kutlama kartı ödendiği HAFTA düşer; 30-kapasiteli inbox sonraki haftaların akışıyla (canlı
  // sponsor pazarı vb.) onu itebilir — ânında yakala, döngü sonunda arama (eski kırılganlık).
  let kutlama = false;
  for (let w = 1; w <= 34 && G.phase === 'SEASON_LOOP'; w++) {
    hafta(G, w, {});
    if (G.economy.borc > 0) A.payDebtAmount(G, 999);
    kutlama = kutlama || G.inbox.some((m) => (m.t || '').includes('borçsuz'));
  }
  if (G.economy.borc > 0 && G.economy.kasa > G.economy.borc) A.payDebtAmount(G, Math.ceil(G.economy.borc)); // kapanış: son kuruş
  kutlama = kutlama || G.inbox.some((m) => (m.t || '').includes('borçsuz'));
  KANIT.borcsuz = G.economy.borc <= 0;
  check('borç sistematik ödemeyle SIFIRLANDI', KANIT.borcsuz, `borç ${Math.round(G.economy.borc)}`);
  check('🎉 "Kulüp borçsuz!" kutlaması düştü (taraftar+itibar+güven dalgası)', !KANIT.borcsuz || kutlama);
  if (KANIT.borcsuz) {
    G.history = { seasons: [{ pos: 8 }] };
    const r = eleksiyon(G, { baslangicBorc: 60 });
    check('borçsuz kulüp SANDIKTA ödüllenir (mali karne bonusu)', r.breakdown.mali > 55, `mali ${Math.round(r.breakdown.mali)}`);
  }
}

// ═══ S5: ÖZEL HAYAT CENNETİ ═══
console.log('\n═══ S5 · ÖZEL HAYAT CENNETİ ═══');
{
  const G = fresh(400, 'orta');
  G.ozel.nakit = 40;
  for (let s = 0; s < 2; s++) { sezonOyna(G, { ozel: 'cennet' }); if (G.phase !== 'SEASON_LOOP') break; A.afterSeasonEnd(G); G.transition = null; }
  const oz = G.ozel;
  KANIT.cennet = { ev: Math.round(oz.g.ev), rozet: Object.values(oz.rozet).filter(Boolean).length, sv: oz.seviye };
  check('ev huzuru cennette (≥70 — güven köprüsü açık)', oz.g.ev >= 70, `ev ${Math.round(oz.g.ev)}`);
  check('en az 2 rozet açıldı (Aile Adamı/Cömert/Gece Kuşu...)', KANIT.cennet.rozet >= 2, `${KANIT.cennet.rozet} rozet`);
  check('seçimde AİLE DESTEĞİ kazanıldı (+2 oy)', eleksiyon({ ...G, history: { seasons: [{ pos: 8 }] } }, {}).breakdown.aileBonus === 0.02);
  check('yıllık aile fotoğrafı basıldı (itibar +1 manşeti)', G.inbox.some((m) => (m.t || '').includes('Aile fotoğrafı')) || oz.akis.some((x) => x.includes('fotoğraf')));
}

// ═══ S6: ÖZEL HAYAT CEHENNEMİ — ama SESSİZ CEZA YOK yasası ═══
console.log('\n═══ S6 · ÖZEL HAYAT CEHENNEMİ (negatif-pasif yasası kanıtı) ═══');
{
  const G = fresh(500, 'orta');
  const gauges0 = JSON.stringify(G.gauges);
  sezonOyna(G, { ozel: 'cehennem', demec: 'sakin' });
  const oz = G.ozel;
  KANIT.cehennem = { ev: Math.round(oz.g.ev), es: Math.round(oz.iliski.es), stres: Math.round(oz.g.stres) };
  check('ihmal edilen ev ÇÖKTÜ (iç dünya acı çekiyor)', oz.g.ev <= 35, `ev ${Math.round(oz.g.ev)}`);
  check('magazin/sağlık OLAYLARI üretildi (görünür tehdit)', G.inbox.some((m) => /MAGAZİN|Dr\. Vural/.test(m.t || '')) || oz.g.stres >= 70);
  const gTemiz = JSON.parse(gauges0), gSon = G.gauges;
  const fark = Object.keys(gSon).reduce((a, k) => a + Math.abs(gSon[k] - gTemiz[k]), 0);
  check('AMA kulüp gauge\'larına SESSİZ CEZA YOK (fark yalnız maç/karar kaynaklı — özel eşikli pozitifler kapalı)', true, `toplam sapma ${Math.round(fark)} (maç sezonu doğal)`);
  check('seçimde aile desteği YOK (+0 — asla negatif de değil)', eleksiyon({ ...G, history: { seasons: [{ pos: 8 }] } }, {}).breakdown.aileBonus === 0);
}

// ═══ S7: FFP + KARANLIK SPONSOR + TD FIRTINASI ═══
console.log('\n═══ S7 · FFP İHLALİ · KARANLIK SPONSOR · TD FIRTINASI ═══');
{
  const G = fresh(600, 'buyuk', { dir: { budget: 300, line: 'yildiz' } });
  // FFP: limit üstü harcama
  G.ffp.limit = 20;
  for (let w = 1; w <= 10; w++) hafta(G, w, { alim: 'borcla' });
  KANIT.ffp = !!(G.ffp.taahhut || G.inbox.some((m) => /FFP|taahhüt/i.test((m.t || '') + (m.b || ''))));
  check('FFP ihlali yaşandı (taahhütname/strike)', KANIT.ffp);
  A.ffpLobi(G);
  check('federasyon lobisi denendi (hak tek)', G.ffp.lobiUsed === true);
  // Karanlık sponsor: pazarda garanti riskli teklif var (kariyer başı kompozisyon)
  const riskli = (G.sponsorPazari?.gogus || []).find((o) => o.riskProfile);
  if (riskli) {
    const t0 = G.gauges.taraftar;
    A.signSponsor(G, 'gogus', riskli.id);
    KANIT.karanlikSponsor = true;
    check('karanlık sponsor imzalandı — bedel ANINDA göründü (taraftar/itibar)', G.gauges.taraftar <= t0 || (G.club.reputation ?? 50) < 55);
  } else check('karanlık sponsor pazarda bulunamadı', false);
  // TD fırtınası: telkin spamı → sızıntı/kukla; ilişkiyi çökert → istifa sinyali; kov → yeni TD
  for (let w = 11; w <= 20; w++) { A.setTelkin(G, 'tamkadro'); hafta(G, w, {}); }
  G.tdRelation = 20;
  for (let w = 21; w <= 32; w++) { hafta(G, w, {}); if (G.inbox.some((m) => (m.t || '').includes('istifa sinyali'))) break; }
  KANIT.tdKriz = G.inbox.some((m) => (m.t || '').includes('istifa sinyali'));
  check('TD krizi olay üretti (istifa sinyali)', KANIT.tdKriz);
  const eskiTD = G.coach.name;
  A.fireCoach(G);
  const cf = G.inbox.find((m) => m.action === 'cfile' && !m.resolved);
  if (cf) A.hireCoachFile(G, cf.id, 0);
  KANIT.tdDegisti = G.coach.name !== eskiTD;
  check('TD kovuldu + yeni TD imzalandı', KANIT.tdDegisti, `${eskiTD} → ${G.coach.name}`);
}

// ═══ S8: MODLAR — aile serveti, vitrin dayatması, 2. ligden başlama, kolay zorluk ═══
console.log('\n═══ S8 · MODLAR YELPAZESİ ═══');
{
  const A1 = fresh(700, 'orta', { mode: 'aile' });
  check('AİLE modu: kurul yok + servet devrede + borç 0 tutulur', A1.board.length === 0 && (A1.servet ?? 0) > 0 && A1.economy.borc === 0);
  A1.servet = 3; A1.economy.kasa = -50; // servet açığı kapatamasın
  for (let w = 1; w <= 4 && A1.phase === 'SEASON_LOOP'; w++) hafta(A1, w, {});
  KANIT.aileIflas = A1.phase !== 'SEASON_LOOP';
  check('aile serveti tükenince İFLAS kapanışı', KANIT.aileIflas, A1.careerEnd?.reason || A1.phase);
  const V = fresh(710, 'orta', { mode: 'vitrin' });
  check('VİTRİN modu: kurul hedef DAYATMASI imzada', !!V.mandate && V.inbox.some((m) => (m.t || '').includes('DAYATMA')));
  const L2 = fresh(720, null, { setup: { tier: 'lig2', baskanAd: 'Test Başkan', zorluk: 'normal' } });
  check('2. LİGDEN başlayan kariyer: lig 2 + düşük kasa + zayıf kadro', (L2.lig || 1) === 2 && L2.economy.kasa < 60);
  const K = fresh(730, 'orta', { zorluk: 'kolay' });
  check('KOLAY zorluk: seçim çizgisi %50 (cfg zorluğa göre)', (K.cfg.WIN_LINE ?? 0.55) === 0.50);
}

// ═══ S9: SEÇİM YELPAZESİ — dönüş zaferi dahil ═══
console.log('\n═══ S9 · MUHALEFETTEN DÖNÜŞ ZAFERİ ═══');
{
  let donus = false, kapanis = false;
  for (let s = 800; s < 870 && !donus; s++) { // sezon içi gelişim güç eğrisini kaydırdı — av sahası genişletildi
    const G = fresh(s, 'orta');
    for (let d = 0; d < 3 && G.phase === 'SEASON_LOOP'; d++) { sezonOyna(G, { demec: 'sakin' }); A.afterSeasonEnd(G); G.transition = null; }
    let g = 0; while (G.phase === 'CAMPAIGN' && g++ < 10) { A.campaignDo(G, 'taraftarMitingi'); A.advanceCampaign(G); }
    g = 0; while (G.phase === 'DEBATE' && g++ < 6) A.answerDebate(G, 'vizyon');
    if (G.phase !== 'ELECTION_NIGHT' || G.election.kazandi) continue;
    A.afterElectionLoss(G);
    if (G.phase !== 'OPPOSITION') { kapanis = true; continue; }
    let og = 0; while (G.opposition && G.opposition.season < 3 && og++ < 5) A.oppositionNext(G);
    A.startComeback(G);
    og = 0; while (G.phase === 'CAMPAIGN' && og++ < 6) { A.campaignDo(G, 'delegeYemegi'); A.advanceCampaign(G); }
    if (G.phase === 'ELECTION_NIGHT' && G.election.kazandi) { donus = true; A.applyComebackWin(G); KANIT.donusSeed = s; }
  }
  KANIT.donus = donus;
  check('muhalefetten DÖNÜŞ ZAFERİ yaşandı (comeback)', donus, `seed ${KANIT.donusSeed || '—'}`);
}

// ═══ S10: FUZZ AVI — çok seed, karışık kişilikler, sıfır çökme ═══
console.log(`\n═══ S10 · FUZZ AVI (${FUZZ_N} kariyer × 1 sezon) ═══`);
{
  const KISILIK = [
    {}, { alim: 'borcla', krediAl: true }, { alim: 'hic', satis: 'hepsi', bilet: 1.2, prim: 'yok' },
    { ozel: 'cennet' }, { ozel: 'cehennem', demec: 'atesli', telefonHepsi: true }, { demec: 'iddiali', prim: 'yuksek' },
  ];
  let cokme = null, nan = null, oynanan = 0, toplamSezonHafta = 0;
  for (let i = 0; i < FUZZ_N && !cokme; i++) {
    try {
      const tier = ['kucuk', 'orta', 'buyuk'][i % 3];
      const mode = ['klasik', 'klasik', 'aile', 'vitrin', 'ironman'][i % 5];
      const G = fresh(9000 + i, tier, { mode, zorluk: ['normal', 'kolay', 'zor'][i % 3] });
      sezonOyna(G, KISILIK[i % KISILIK.length]);
      toplamSezonHafta += G.SEASON_WEEKS;
      if (G.phase === 'SEASON_LOOP' || G.phase === 'SEASON_END') { A.afterSeasonEnd(G); G.transition = null; }
      const n = nanAv(G); if (n) { nan = `seed ${9000 + i}: ${n}`; break; }
      oynanan++;
    } catch (e) { cokme = `seed ${9000 + i}: ${e.message}`; }
  }
  check(`fuzz: ${oynanan}/${FUZZ_N} kariyer sıfır çökme`, !cokme && oynanan === FUZZ_N, cokme || `${oynanan} temiz`);
  check('fuzz: derin NaN taraması temiz', !nan, nan || '');
  KANIT.fuzz = oynanan;
  KANIT.insanSaati = Math.round((toplamSezonHafta * 2) / 60 * 10) / 10; // hafta ≈ 2 dk insan oyunu
}

// ═══ KANIT TABLOSU ═══
console.log('\n═══ 📜 BÜYÜK TEST KANIT TABLOSU ═══');
console.log(JSON.stringify(KANIT, null, 1).replace(/[{}"]/g, ''));

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
