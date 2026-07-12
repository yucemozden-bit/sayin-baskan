// src/actions.js — TEK aksiyon katmanı. UI buradan geçer; motorları burası çağırır,
// state'i (G) burası mutasyona uğratır, eventBus'a burası yayınlar.
// ui/ modülleri yalnızca state okur; asla doğrudan motor çağırmaz/state yazmaz.

import { TUNING, TIERS, applyDifficulty } from './config.js';
import { eventBus } from './core/eventBus.js';
import { generateSquad, squadMarketValue, developSquad, youthIntake, uniqueName } from './models/squadGen.js';
import { Player } from './models/player.js';
import { temelGuc, efektifGuc, macGucu, moralMult, formMult, kondMult, computeUygunluk, teknikEkip } from './engines/power.js';
import { idealXI } from './models/squad.js';
import { simulateMatch, postMatch } from './engines/match.js';
import { createLeague, playWeek, standings, simulateLeagueMatch, applyResult } from './engines/league.js';
import { applyEconomy, payDebt, sponsorSlotWeekly } from './engines/economy.js';
import { generateSponsorOffer } from './engines/sponsorGen.js';
import { computeTargets, applyInertia } from './engines/gauges.js';
import { checkThresholdEvents, tickEventFlags } from './engines/events.js';
import { selectPromises, decayPromiseHope, judgePromises, isSelectable, addMidPromise } from './engines/promises.js';
import { eleksiyon } from './engines/election.js';
import { escalateHedef } from './engines/expectation.js';
import { assignPersonalities, spreadMorale, hierarchy, katman } from './engines/dynamics.js';
import { computeSentiment } from './engines/social.js';
import { generateCoaches, hireCoach, generateStaff, describeStaff, staffQualityWord, cfoNoiseRange, ROLE_TR } from './models/staff.js';
import { generateMarket, transferFee, saleOffer, canBuy, windowOpen } from './engines/transfer.js';
import { canUpgrade, effectiveUpgradeCost } from './engines/facilities.js';
import { selectTag, makeHeadline, updateMediaTone, makeReport } from './engines/narrative.js';
import { applyDemec } from './engines/press.js';
import { rand, randint } from './core/rng.js';
// ─ DELUXE katmanı ─
import { initAIClubs, aiSeasonStart, aiTick } from './models/aiClub.js';
import { initBoard, updateBoard, nudgeBoard, applySunum, SUNUM_OPTIONS, initFanGroups, updateFanGroups, radikalGrup, journalistFor, muhalif, buildBoardAgenda, scoreAgendaAnswer, boardBudgetMult } from './engines/world.js';
import { pickRandomEvent, applyEventEffects } from './engines/events.js';
import { generateHighlights } from './engines/match.js';
import { buildDebate, scoreDebateAnswer, CAMPAIGN_ACTIONS, applyCampaignAction } from './engines/campaign.js';
import { makeFeed } from './engines/social.js';
// ─ Yaşayan Koltuk ─
import { tensionScore, pickStorySeed, ARC_EVENTS, boringGuard, phoneAllowed, pickDeskCard, DESK_CARDS, lateTrigger } from './engines/director.js';
// ─ Miras & Uzun Oyun ─
import { OPP_TYPES, oppositionSeason, comebackVote, tierCheck, legacyTag, oppTypeTr } from './engines/legacy.js';
// ─ Mega: modlar + senaryolar + başarımlar ─
import { MODES, pickMandate, mandateDone, scenarioDone, checkAchievements, rollClubIdentity } from './engines/meta.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const flip = (r) => (r === 'W' ? 'L' : r === 'L' ? 'W' : 'D');

// Tier başlangıç profilleri (yeni kariyer setup — MVP; tesis seçimi yok).
const CLUB = {
  kucuk: { name: 'Gölköy SK', founded: 1954, stadName: 'Göl Kenarı Stadı', gmName: 'Selim Arca', coach: { name: 'Yerel Hoca', taktik: 58, oyuncuYonetimi: 58, otorite: 60, yardimciEkip: 54, wage: 0.25, contractYears: 2 }, fac: { stadyum: 2, antrenman: 2, tibbi: 2, akademi: 2, scout: 1, ticari: 2 }, bigExp: 35 },
  orta: { name: 'Yıldızspor', founded: 1931, stadName: 'Yıldız Arena', gmName: 'Ferda Koyuncu', coach: { name: 'Deneyimli TD', taktik: 68, oyuncuYonetimi: 65, otorite: 68, yardimciEkip: 60, wage: 0.6, contractYears: 2 }, fac: { stadyum: 4, antrenman: 4, tibbi: 3, akademi: 3, scout: 2, ticari: 3 }, bigExp: 50 },
  buyuk: { name: 'İmparator FK', founded: 1907, stadName: 'İmparatorluk Stadyumu', gmName: 'Namık Serter', coach: { name: 'Dünyaca Ünlü TD', taktik: 82, oyuncuYonetimi: 76, otorite: 78, yardimciEkip: 78, wage: 1.2, contractYears: 2 }, fac: { stadyum: 7, antrenman: 6, tibbi: 6, akademi: 5, scout: 5, ticari: 6 }, bigExp: 70 },
};

// TD adı — kulüp adından türeyen deterministik seçim (ana RNG'yi tüketmez → seed'li testler etkilenmez)
function coachAdi(names, seed) {
  if (!names || !names.first || !names.last) return 'Teknik Direktör';
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `${names.first[h % names.first.length]} ${names.last[Math.floor(h / 101) % names.last.length]}`;
}

const MY = 'ME';
const linspace = (a, b, n) => (n <= 1 ? (n === 1 ? [a] : []) : Array.from({ length: n }, (_, i) => a + (b - a) * (i / (n - 1))));

export function powerCtx(G) {
  return { squad: G.squad, coach: G.coach, kimya: G.kimya, taktik: G.taktik, facilities: G.facilities };
}

// Kokpitin okuyacağı güç anlık görüntüsü (UI motor çağırmasın diye burada hesaplanır).
export function refreshPower(G) {
  const ctx = powerCtx(G);
  const xi = idealXI(G.squad);
  const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
  G.power = {
    temel: temelGuc(ctx),
    efektif: efektifGuc(ctx),
    uygunluk: computeUygunluk(G.squad, G.facilities.tibbi),
    moral: moralMult(avg(xi.map((p) => p.morale))),
    form: formMult(avg(xi.map((p) => p.form))),
    kond: kondMult(avg(xi.map((p) => p.fitness))),
  };
}

// ── Kurulum ──
export function newGame(data, difficulty = 'normal', mode = 'klasik') {
  return {
    data, difficulty, cfg: applyDifficulty(TUNING, difficulty),
    SEASON_WEEKS: TUNING.SEASON_WEEKS,
    mode: MODES[mode] ? mode : 'klasik', // B4c: koltuk modu (klasik/ironman/vitrin/aile)
    stateVersion: 2, // B6h: kayıt ŞEMA sürümü (göç mantığı buna bakar)
    phase: 'CLUB_SELECT', nav: 'cockpit',
    meta: { season: 1, week: 1, term: 1, version: 'v1.0-adayi' }, // sürüm damgası (onaylı)
    inbox: [], pendingMatch: null, election: null,
  };
}

// B4b: identity — kulüp havuzundan gelen kimlik (name/stadName/founded/fanChar) varsayılanı ezer
export function selectClub(G, tier, identity = null, opts = {}) {
  const c = CLUB[tier], T = TIERS[tier];
  G.club = {
    tier,
    name: (identity && identity.name) || (opts.lig2 ? 'Demiryolu SK' : c.name),
    founded: (identity && identity.founded) || c.founded,
    stadName: (identity && identity.stadName) || (opts.lig2 ? 'Demiryolu Sahası' : c.stadName),
    fanChar: (identity && identity.fanChar && identity.fanChar.key) || null,
    fanCount: T.fan, reputation: T.reputation, stadiumCapacity: T.stad, beklenti: T.beklenti, hedefSira: TUNING.EXPECT.HEDEF_SIRA[T.beklenti], kadroDeger: 0,
  };
  // GM (genel menajer) — transfer onay akışının yürütücüsü (Başkanlık Hissi §1)
  G.gm = { name: c.gmName, skill: clamp(TUNING.APPROVAL.GM_SKILL[tier] + randint(-6, 6), 40, 95) };
  // A1: yönetici koltuları (boş başlar — işe alım dosyayla); A3: piyasa enflasyon çarpanı
  G.staff = { cfo: null, akademi: null, basin: null, stat: null, tis: null };
  G.marketMult = 1; G.douseWeek = -99;
  G.economy = { kasa: T.kasa, borc: T.borc, faizOrani: G.cfg.RATE_BASE ?? TUNING.RATE_BASE, ticketPrice: 1.0 };
  G.gauges = { ...T.gauges };
  G.coach = { ...c.coach };
  // TD gerçek bir isim taşısın (placeholder "Deneyimli TD" yerine — kulüp kimliğine göre)
  if (G.data && G.data.names) G.coach.name = coachAdi(G.data.names, (G.club.name || tier) + tier);
  G.sponsorDeals = { gogus: null, naming: null, kol: null }; // imzalı sponsor slotları (forma/saha/kol)
  G.facilities = { ...c.fac };
  G.kimya = { kimya: 60, bigMatchExp: c.bigExp, kaptanVar: true };
  G.taktik = { uyumHafta: 12, rolUygunlugu: 1.0 };
  G.usedNames = {}; // v4.3: ad+soyad tekilliği (kadro + lig üretimi genelinde)
  G.fedIliski = TUNING.MEGA.FED.START; // B1c: gizli federasyon hattı (ASLA UI'da gösterilmez)
  G.rakipKulis = ['şampiyonluk', 'borçsuz kulüp', 'stadyum yatırımı'][randint(0, 2)]; // AÇILIŞ 2d: rakip gölgesi (seçim gecesiyle tutarlı)
  G.squad = generateSquad(tier, { names: G.data.names, used: G.usedNames });
  assignPersonalities(G.squad); // V4-E kişilikler
  // 2. LİGDEN BAŞLAYAN kulüp: küçük tier'dan bir tık daha zayıf kadro + daha cılız kasa
  if (opts.lig2) {
    const D = TUNING.LEAGUE.LIG2_START;
    for (const p of G.squad) { p.overall = clamp(p.overall - D.gucDrop, 25, 99); p.potential = Math.max(p.overall, (p.potential || p.overall) - D.gucDrop); p.refreshValue && p.refreshValue(); }
    G.economy.kasa = D.kasa; G.economy.borc = D.borc;
  }
  G.career = { titles: 0, termsWon: 0, bestPos: 18, seasons: 0, cups: 0, oyList: [] };
  // MİRAS: defter/müze/tarihçeler
  G.defter = []; G.museum = []; G.borcHistory = [Math.round(G.economy.borc)]; G.altinCocuklar = [];
  G.tierHistory = []; G.lossStreak = 0; G.consecTerms = 0; G.kuskunler = [];
  G.coachCandidates = generateCoaches(T.reputation, { names: G.data.names }); // TD havuzu (Bible-10)
  G.club.kadroDeger = squadMarketValue(G.squad);
  G.temelGuc = temelGuc(powerCtx(G));
  refreshPower(G);
  initSponsorMarket(G); // canlı sponsor pazarı — her kariyerde farklı markalar/bedeller
  G.sorguHak = 1 + (G.facilities.scout || 0); // ilk haftanın sorgu hakkı
  // 1 = üst lig, 2 = 2. lig (küme düşünce VEYA 2. ligden başlama = en zor mod)
  G.lig = opts.lig2 ? 2 : 1;
  G.lig2Native = !!opts.lig2; // 2. ligden BAŞLAYAN kulüp: rakipler zayıflatılmaz (dengi lig → gerçek terfi yarışı)
  // SABİT lig merdiveni: beklentiye göre bir kez kurulur, sezonlar arası değişmez.
  // Böylece kadro gelişimi/yaşlanması kulübün SIRASINI gerçekten oynatır (yatırım meyve verir).
  buildLadder(G); // D1 canlı lig + B1b isimli rakip başkanlar (tek kaynaktan)
  G.board = G.mode === 'aile' ? [] : initBoard(G.data.boardnames); // D2 + B4c: AİLE modunda kurul YOK
  if (G.mode === 'aile') {
    G.servet = TUNING.MEGA.MOD.AILE_SERVET;   // açıklar kişisel servetten
    // Kural baştan işlesin: kulüp borçlanamaz → başlangıç borcu hemen servetten kapanır (borç 0)
    if (G.economy.borc > 0) { G.servet -= G.economy.borc; G.economy.borc = 0; }
  }
  G.fanGroups = initFanGroups();            // D2: isimli taraftar grupları
  G.worldSeason = 0;                        // D1: AI drift sayacı (ilk sezon drift yok)
  G.flags = {}; G.rival = { attractiveness: 0 }; G.sozTutmaBirikim = 0;
  G.promises = []; G.history = { seasons: [] };
  G.term = { income: 0, wage: 0, starBought: false, maxTicket: G.economy.ticketPrice };
  G.termStartBorc = G.economy.borc;
  // v4.1: TD ilişkisi + telkin/prim varsayılanları (standing tercihler)
  G.tdRelation = 70; G.telkin = null; G.matchPrim = 'yok'; G.seriPrim = false;
  G.pendingFacilities = [];
  G.meta = { season: 1, week: 1, term: 1 };
  G.globalWeek = 0; G.recent = []; G.mediaTone = 0; G.headlineMem = []; G.toneMem = [];
  G.inbox = [];
  G.phase = 'TERM_SETUP';
}

// Dönem başı: vaatler + TRANSFER DİREKTİFİ (§1: bütçe tavanı + maaş tavanı + çizgi).
// directive: { budget(mn), wageCap(mn/sezon/oyuncu), line: 'genc'|'hazir'|'yildiz' }
export function startTerm(G, promiseIds, directive = null) {
  // AÇILIŞ 5c: umut bonusu taraftarı 92 üstüne TAŞIYAMAZ (hedef tavanı vardı; doğrudan basışı kaçırıyordu).
  // Kazanılmış destek >92 ise dokunulmaz — tavan umuda vurulur, alın terine değil.
  const taraftarOnce = G.gauges.taraftar;
  selectPromises(G, promiseIds, G.data.promises);
  G.gauges.taraftar = Math.min(G.gauges.taraftar, Math.max(TUNING.MEGA.UMUT_TARAFTAR_TAVAN, taraftarOnce));
  const defBudget = Math.round(G.economy.kasa * TUNING.APPROVAL.BUDGET_PRESET.orta);
  G.directive = { budget: defBudget, wageCap: 30, line: 'hazir', ...(directive || {}) };
  G.termSpent = 0;
  // DENGE: bütçe direktifi BEDAVA DEĞİL — her seçimin artısı/eksisi oyuna işler
  // (aksi halde herkes Cömert'i seçer). UI'da açıkça yazılır (promiseSelect).
  // Kısıtlı: kurul/mali disiplin rahatlar, tribün "iddiasız" diye söylenir + hype düşük.
  // Cömert: tribün coşar + hype yüksek, ama kurul huzursuz ("hesabı sorulur").
  const bk = G.directive.budgetKey || 'orta';
  if (bk === 'dusuk') {
    G.gauges.mali = clamp(G.gauges.mali + 4, 0, 100);
    G.transferHype = 40; // soğuk açılış — taraftar bedeli sönümlenen heyecan üzerinden (kalıcı vergi yok) // sönümlenir (haftalık →50): sezon başı soğukluğu, kalıcı ceza değil
  } else if (bk === 'yuksek') {
    G.gauges.mali = clamp(G.gauges.mali - 4, 0, 100);
    G.gauges.taraftar = clamp(G.gauges.taraftar + 3, 0, 100);
    G.transferHype = 72; // sönümlenir: açılış coşkusu
  } else { G.transferHype = 50; }
  initSeason(G);
  G.phase = 'SEASON_LOOP'; G.nav = 'cockpit';
  // B4c-VİTRİN: kurul zorunlu hedef dayatır (kulüp durumundan seçilir)
  if (G.mode === 'vitrin') {
    G.mandate = pickMandate(G);
    pushInbox(G, { cat: 'kongre', t: `KURUL DAYATMASI: ${G.mandate.metin}`, b: 'Vitrin Başkanı sözleşmesi: bu dönem sonunda hedef tutmazsa kurul desteği çöker, seçim çetinleşir. İmza masada.', noQueue: true });
  }
  pushInbox(G, { cat: 'kongre', t: 'Göreve başladın', b: `${G.club.name} başkanlığı senin. Beklenti: ${beklentiTr(G.club.beklenti)}. ${promiseIds.length} vaat verildi.` });
  const bkYanki = bk === 'dusuk'
    ? ' Kurul mali disiplini alkışlıyor; tribünde "iddiasız mıyız?" mırıltısı var.'
    : bk === 'yuksek' ? ' Tribün şimdiden yıldız bekliyor; kurul koridorunda "hesabı sorulur" fısıltısı dolaşıyor.' : '';
  pushInbox(G, { cat: 'transfer', t: `${G.gm.name} (GM): Direktif alındı`, b: `Çerçeve anlaşıldı, Başkanım — bütçe tavanı ${G.directive.budget}mn, çizgi: ${lineTr(G.directive.line)}. Pencere açılınca ilk dosyalar masanızda.${bkYanki}` });
  // B6e+AÇILIŞ 4: MÜHÜR TÖRENİ — parşömenler sırayla, damgalar iner (main sahneler)
  G.transition = {
    tip: 'muhur', icon: '🖋️', title: `${G.meta.term}. Dönem Başladı`,
    vaatler: promiseIds.map((id) => (G.data.promises.find((x) => x.id === id) || {}).name || id),
    sub: `${G.gm.name}: "Tutanaklar imzalandı, Başkanım. Ben işe koyulayım."`,
  };
  // AÇILIŞ ZAFERİ: Dönem 1'in seçim gecesi YOKTUR (yeniden seçim ELECTION_NIGHT'ta sayılır) —
  // kongre zaferini törenin başına koy: BAŞKANIN adı vs rakip aday, OY ADEDİYLE.
  // ÖNEMLİ: rng AKIŞINI TÜKETME — kozmetik; kariyer-kararlı hash'ten türet (aksi halde
  // sonraki sakat/olay/telefon çekilişleri kayar, determinizm ve bantlar bozulur).
  if (G.meta.term === 1) {
    // Tohum: kadro isimleri (kariyer başına rng'den farklı) + kulüp — varsayılan kulüpte bile değişir
    const seed = `${G.club.name}|${(G.squad || []).map((p) => p.name).join('')}`;
    let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const first = G.data.names.first || [], last = G.data.names.last || [];
    const adUret = (x) => (first.length && last.length)
      ? `${first[x % first.length]} ${last[Math.floor(x / first.length) % last.length]}` : null;
    const rakipAd = adUret(h) || 'Rakip Aday';
    let baskanAd = adUret((h * 2654435761 + 97) >>> 0) || 'Sayın Başkan';
    if (baskanAd === rakipAd) baskanAd = adUret((h + 13) >>> 0) || 'Sayın Başkan';
    // Başkan kimliği kariyer boyu kalıcı (setup ekranı gelince kullanıcı girdisiyle değişecek)
    if (!G.baskan) G.baskan = { name: baskanAd };
    // MANDAT: oy = taban + VAAT İDDİASI + şans (hash — çekilişsiz, determinizm korunur).
    // Çok vaat veren kongreyi coşturur (oy ↑) ama o vaatler tutmazsa koz olur —
    // risk dengesi vaat sisteminde. Mandat OYUNA İŞLER ama seçim döngüsüne DEĞİL
    // (güven'e basmak bileşik faiz gibi kariyer bantlarını bozuyordu — autoplay kanıtı):
    // güçlü mandat → kurul transfer bütçesinde esner (+%4), kıl payı → kısar (−%4).
    const vaatIddia = (promiseIds || []).length * 2.5;        // 0-3 vaat → +0..7.5 puan
    const sans = (h % 9) - 4;                                  // ±4 şans (kariyer-kararlı)
    const sen = Math.max(51, Math.min(66, Math.round(52 + vaatIddia + sans)));
    const toplam = 550, senOy = Math.round(toplam * sen / 100); // kongre delege sayısı
    const mandat = sen >= 60 ? 'guclu' : sen >= 55 ? 'saglam' : 'kilpayi';
    G.mandat = { oran: sen, tip: mandat, esnek: mandat === 'guclu' ? 1.04 : mandat === 'kilpayi' ? 0.96 : 1 };
    pushInbox(G, {
      cat: 'kongre',
      t: mandat === 'guclu' ? `Güçlü mandat: %${sen}` : mandat === 'kilpayi' ? `Kıl payı mandat: %${sen}` : `Sağlam mandat: %${sen}`,
      b: mandat === 'guclu' ? 'Kongre net konuştu — kurul kesenin ağzını gevşetti (transfer tavanı +%4).'
        : mandat === 'kilpayi' ? 'Sandık ucu ucuna — kurul temkinli, kese kısıldı (transfer tavanı −%4).'
          : 'Rahat bir zafer — kurulla ilişkin dengeli başlıyor.',
    });
    G.transition.zafer = { sen, rakip: 100 - sen, senOy, rakOy: toplam - senOy, toplam, rakipAd, baskanAd: G.baskan.name };
    // Zafer gecesi GM kapanışı — kâğıt kokusu değil insan sesi; oy sayısı cümleye girer
    const kapanis = [
      `Sandıktan ${senOy} oy çıktı, Başkanım. Salon boşalmadan telefonlar başladı bile — yarın sabah dosyalarla kapınızdayım.`,
      `Seçimi ${senOy} oyla aldık. Tebrikler, Başkanım — şimdi lafı bırakıp sahaya bakma vakti.`,
      `${senOy} oy… Kongre net konuştu. Kararları siz verin, işçiliği bana bırakın.`,
    ];
    G.transition.sub = `${G.gm.name}: "${kapanis[h % kapanis.length]}"`;
  } else {
    // Dönem >1: mandat GERÇEK seçim sonucundan türer (aynı eşikler) — dönem-1 şansı
    // kariyer boyu bütçe çarpanı olarak YAŞAYAMAZ (autoplay d4 bandı bunu kanıtladı).
    const oy = Math.round(((G.election && G.election.oyOrani) || 0.56) * 100);
    const tip = oy >= 60 ? 'guclu' : oy >= 55 ? 'saglam' : 'kilpayi';
    G.mandat = { oran: oy, tip, esnek: tip === 'guclu' ? 1.04 : tip === 'kilpayi' ? 0.96 : 1 };
  }
  G._ilkKokpit = G.meta.term === 1 && G.worldSeason === 1; // AÇILIŞ 5a: nabız devralma animasyonu
}

function initSeason(G) {
  // 2. LİG geçişi: küme/terfi ertesi sezon başında yürürlüğe girer → merdiven yeniden kurulur
  if (G._ligChange && G._ligChange !== (G.lig || 1)) {
    const yeni = G._ligChange;
    G.lig = yeni;
    buildLadder(G); // lig-duyarlı: 2. ligde zayıf rakip + hedef terfi; üst ligde normal çıta
    pushInbox(G, { cat: 'lig', t: yeni === 2 ? 'Artık 2. LİGDESİN' : 'Üst lige DÖNDÜN',
      b: yeni === 2 ? 'Fikstür değişti: rakipler daha zayıf ama yayın/sponsor/bilet geliri de küçüldü. Tek hedef var — terfi (ilk 3).' : 'Üst lig fikstürü döndü: rakipler güçlü, gelir masası yeniden kalın. Beklenti eski çıtasına çıktı.', noQueue: true });
  }
  G._ligChange = null;
  // D1: Canlı lig — sezon başı AI başkan kararları (ilk sezonda drift yok; merdiven kalibre)
  if ((G.worldSeason = (G.worldSeason ?? 0) + 1) > 1) {
    const { news, crises } = aiSeasonStart(G.opponents);
    if (news.length) { G.leagueNews = news[0]; for (const n of news.slice(0, 2)) pushInbox(G, { cat: 'lig', t: 'Lig Gündemi', b: n }); }
    // B1d: AI FFP baskısı — aşırı harcayan AI zorunlu satışa düşer → KELEPİR dosyası (motivasyon görünür)
    if (rand(0, 1) < TUNING.MEGA.FFP2.AI_KELEPIR_P) {
      const satici = G.opponents[randint(2, G.opponents.length - 1)];
      const kp = new Player({ id: 'kf' + (G._pid = (G._pid || 1000) + 1), name: gmPickName(G), pos: ['DEF', 'MID', 'FWD'][randint(0, 2)], overall: randint(Math.round(G.temelGuc), Math.round(G.temelGuc) + 6), potential: 0, age: randint(24, 29), contractYears: 2 });
      kp.potential = kp.overall; kp.wage *= (G.marketMult || 1);
      const kfee = transferFee(kp) * (G.marketMult || 1) * TUNING.MEGA.FFP2.KELEPIR_MULT;
      const kfog = Math.max(1, TUNING.FOG_BASE - G.facilities.scout);
      pushInbox(G, {
        cat: 'transfer', t: `${G.gm.name} (GM): KELEPİR — ${satici.name} FFP baskısında`,
        b: `${satici.name} limiti aştı, federasyon ensesinde: ${kp.name} piyasanın %30 altına, ${fmt1(kfee)}mn'ye çıkarıldı. Satıcı motivasyonu net — hızlı satmalı. Görünen güç ${kp.overall - Math.ceil(kfog / 2)}-${kp.overall + Math.ceil(kfog / 2)}.`,
        action: 'tfile', file: { player: kp, fee: kfee, gerekce: 'FFP baskısı — kelepir.', range: [kp.overall - Math.ceil(kfog / 2), kp.overall + Math.ceil(kfog / 2)], sartTried: true },
      });
    }
    // Kriz kulübünün yıldızı SANA fırsat dosyası olarak düşer (panik satış ×0.6)
    for (const cr of crises.slice(0, 1)) {
      const star = new Player({ id: 'gm' + (G._pid = (G._pid || 1000) + 1), name: gmPickName(G), pos: ['DEF', 'MID', 'FWD'][randint(0, 2)], overall: randint(70, 78), potential: randint(72, 80), age: randint(24, 29), contractYears: 2 });
      const fee = transferFee(star) * TUNING.DELUXE.AI.CRISIS_FEE;
      const fog = Math.max(1, TUNING.FOG_BASE - G.facilities.scout - Math.floor(((G.gm?.skill ?? 60) - 50) / 10));
      const h = Math.ceil(fog / 2);
      pushInbox(G, {
        cat: 'transfer', t: `${G.gm.name} (GM): FIRSAT — ${cr.name} panik satıyor`,
        b: `Kriz kulübünün yıldızı ${star.name} piyasada. Normalin çok altı: ${fmt1(fee)}mn · görünen güç ${star.overall - h}-${star.overall + h}. Böyle dosya her pencere gelmez.`,
        action: 'tfile', file: { player: star, fee, gerekce: 'Kriz fırsatı — panik satışı.', range: [star.overall - h, star.overall + h], sartTried: true },
      });
    }
  }
  G.cup = { alive: true, round: 0, won: false }; // D4: kupa koşusu
  // M2: tier geçişinin ikinci yarısı — 1 sezon sonra tam TIERS değerlerine oturur (şok yok)
  if (G.tierShift && G.tierShift.kalan > 0) {
    const T = TIERS[G.tierShift.to];
    G.club.fanCount = T.fan; G.club.reputation = Math.max(G.club.reputation, T.reputation);
    G.club.stadiumCapacity = T.stad;
    G.tierShift = null;
    pushInbox(G, { cat: 'kongre', t: 'Geçiş tamamlandı', b: 'Yeni seviyenin gelir masası ve beklenti çıtası artık tam yürürlükte.' });
  }
  // A3: transfer enflasyonu (sezon başına ×1.06-1.14; eski sözleşmeler görece ucuzlar = hedge)
  if (G.worldSeason > 1) G.marketMult = (G.marketMult || 1) * rand(TUNING.MARKET_ECON.INFLATION[0], TUNING.MARKET_ECON.INFLATION[1]);
  // A2: FFP — federasyon sezon başı harcama limiti açıklar (geçen sezon geliri ×0.85 + kupa)
  const ffpIncome = G.lastSeasonIncome || TUNING.FFP_EXTRA.DEFAULT_INCOME;
  G.ffp = {
    limit: Math.round(ffpIncome * TUNING.FFP.revenueMult + ((G.ffpLastCupWon) ? TUNING.FFP_EXTRA.CUP_BONUS : 0)),
    spent: 0, taahhut: false,
    cutActive: !!(G.ffp && (G.ffp.pendingCutCarry || G.ffp.pendingCut)),
    cutMult: (G.ffp && (G.ffp.pendingCutCarry === 'x2' || G.ffp.pendingCut === 'x2')) ? TUNING.MEGA.FFP2.CUT2_MULT : 1, // B1d: 2. ihlal kesinti ×2
    pendingCut: false, lobiUsed: false,
  };
  // B1d: ardışıklık — geçen sezon ihlal YOKSA kademeler sıfırlanır; tahta cezası ilk pencerede işler
  if (!G.ffpStruckThisSeason) G.ffpStrikes = 0;
  G.ffpStruckThisSeason = false;
  if (G.ffpBanNextWindow) {
    G.ffpBanNextWindow = false;
    G.flags = G.flags || {};
    G.flags.transferBan = TUNING.APPROVAL.WINDOW_SPAN; // ilk pencere boyunca tahta kapalı
    pushInbox(G, { cat: 'mali', t: 'Tahta cezası İŞLEDİ', b: 'FFP ikinci ihlalin bedeli: bu pencere transfer tahtası kapalı — GM dosya getiremez, deadline telefonları çalmaz.', noQueue: true });
  }
  G.seasonIncome = 0;
  pushInbox(G, { cat: 'mali', t: 'Federasyon harcama limiti açıklandı', b: `Bu sezon transfer+maaş tavanı: ${G.ffp.limit}mn. Aşarsan taahhütname imzalarsın — gelecek gelirden kesilir.` });
  // Sabit rakip merdiveni (selectClub'ta kuruldu) + kulüp GÜNCEL temelGüç'üyle.
  const teams = [{ id: MY, name: G.club.name, strength: Math.round(G.temelGuc), mine: true }, ...G.opponents];
  G.league = createLeague(teams);
  G.meta.week = 1;
  G.hazirlik = TUNING.PRESEASON_WEEKS || 0; // sezon başı hazırlık dönemi (UI akışı; ilk maç bundan sonra)
  G.season = { W: 0, D: 0, L: 0, GF: 0, GA: 0 };
  G.ticketLetterDone = false;
  G.transferWindow = windowOpen(1);
  if (G.transferWindow) G.market = generateMarket(Math.round(G.temelGuc), { names: G.data.names, scout: G.facilities.scout });
  // Y1: HİKAYE TOHUMU — sezonun ana gerilim hattı (olay ağırlığı + sezon karnesi cümlesi)
  G.storyArc = pickStorySeed(G);
  pushInbox(G, { cat: 'manset', t: `Sezonun sorusu: ${G.storyArc.label}`, sig: 'arc-' + G.worldSeason, b: G.storyArc.key === 'yildiz_veda' && G.storyArc.starName ? `Herkes aynı şeyi soruyor: ${G.storyArc.starName} kalacak mı?` : 'Medya sezona bu çerçeveden bakacak.' });
  // Y2/Y6 sezon sayaçları
  G.phoneCount = 0; G.phoneQueue = []; G.deskCounts = G.deskCounts || {};
  G.fedYaziCount = 0; G.fedJestDone = false; // B1c sezon sayaçları
  G.tisBulusmaCount = 0; G.koreoCount = 0; G.kapakDone = false; G.kapakLanet = null; // B2 sezon sayaçları
  G.sezonSatis = 0; G.sezonAlim = 0; G.ilan = null; // B3/B4 sezon sayaçları
  G.windowStats = { dosya: 0, onay: 0, red: 0, pazarlik: 0 };
  // v4.1 sezon sayaçları: telkin geçmişi, prim durumları
  G.telkinWeeks = []; G.telkinSeasonCount = 0; G.kuklaWarned = false;
  G.ozelArmed = false; G.ozelUsed = false;
  G.sezonHedefDeclared = false; G.sezonPrimResult = null;
  G.winStreak = 0; G.seriBoostWeeks = 0; G.rotRecover = 0;
  G.primLedger = { mac: 0, seri: 0, ozel: 0, sezon: 0 };
  // K2: TD sezon başı kaptan önerir (onay/veto senin) · K5: telkin karnesi sıfırlanır
  G.telkinLog = [];
  G.kaptanAradiHafta = null;
  proposeCaptain(G);
}

// ── Haftalık tick ──
// ═══ YAŞAYAN KOLTUK Y3: hafta üç aşamalı — beginWeek (yarı 1) → htDecision → finishWeek ═══
// advanceWeek(G) geriye-uyumlu kompozit: nötr kararlarla üçünü zincirler (testler/eski akış).
export function advanceWeek(G) {
  beginWeek(G);
  // GERÇEK nötr: devre arası hamlesi YOK (tdguven bile ilişki+1 basar — eski akışla birebir kalmalı)
  const r = finishWeek(G);
  if (r && r.waitLate) lateDecision(G, 'devam'); // nötr son-10dk
}

// Sezon başı HAZIRLIK haftası — maç YOK: transfer/kadro kurma + basın + deadline dramı.
// SADECE UI akışında (main.js onDevam) çağrılır; testler beginWeek'i doğrudan çağırdığı için
// bu fonksiyon dengeye/RNG akışına dokunmaz (fikstür ilerlemez, G.meta.week sabit kalır).
export function preSeasonWeek(G) {
  const wk = G.meta.week; // sabit — hazırlık, fikstür haftası değildir
  G.transferWindow = true; // hazırlık dönemi = transfer masası açık
  if (!G.market) G.market = generateMarket(Math.round(G.temelGuc), { names: G.data.names, scout: G.facilities.scout });
  G.demecUsed = false;
  drainDecisionQueue(G);
  transferWarTick(G);
  ilanTick(G, wk);
  vitrinTick(G);
  contractTick(G, wk);
  freeAgentTick(G, wk);
  loanOutTick(G, wk);
  gmTick(G, wk); // GM hazırlık dönemi dosyaları (onay/satış)
  G.hazirlik = Math.max(0, (G.hazirlik || 0) - 1);
  if (G.hazirlik > 0) {
    pushInbox(G, { cat: 'lig', t: `Hazırlık dönemi — lige ${G.hazirlik} hafta`, b: 'Kamp sürüyor: hazırlık maçları oynanıyor, transfer masası açık. Kadroyu şekillendirmek için son haftalar.' });
  } else {
    pushInbox(G, { cat: 'lig', t: 'Lig başlıyor!', b: 'Hazırlık bitti — ilk düdük çalmak üzere. Kadro sahaya çıkıyor, artık puanlar konuşacak.', noQueue: true });
  }
  return { ok: true, kalan: G.hazirlik };
}

// Deterministik string hash (piyasa ilgi/süre/rapor türetimi — ana RNG'yi TÜKETMEZ)
function mh32(s) { let h = 0; const t = String(s); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; }

// Sürekli scouting: pencere açıkken her hafta bir isim başka kulübe imzalar, gözlemci ağı yenisini bulur.
// Gözlemci ağı (scout tesisi) geliştikçe bulunan oyuncunun tavanı yükselir.
export function scoutTick(G) {
  if (!G.transferWindow || !Array.isArray(G.market) || G.market.length === 0) return;
  // RAKİP İLGİSİ + SÜRE BASKISI (deterministik): her isimde ilgi sayacı + dosya kapanma
  // süresi. Süresi dolan oyuncu RAKİBE İMZA ATAR — beklemek bedellidir, piyasa canlıdır.
  const rakipler = Object.values(G.league?.table || {}).filter((t) => t && t.name && t.id !== MY);
  for (let i = G.market.length - 1; i >= 0; i--) {
    const p = G.market[i];
    if (p._ilgi == null) { const mh = mh32(String(p.id) + '|' + p.name); p._ilgi = mh % 4; p._kalan = 2 + ((mh >>> 4) % 4); continue; }
    p._kalan -= 1;
    if (p._kalan <= 0) {
      G.market.splice(i, 1);
      const rk = rakipler.length ? rakipler[mh32(p.name) % rakipler.length].name : 'bir rakip';
      pushInbox(G, { cat: 'transfer', t: `${p.name} rakibe imza attı`, b: `${rk} dosyayı kapattı — geç kaldık Başkanım. İlgi gören isim beklemez; bir dahakine erken davranalım.`, noQueue: true });
    }
  }
  if (G.market.length === 0) return;
  const CAP = (TUNING.TRANSFER.MARKET_SIZE || 12) + 1;
  G.market.sort((a, b) => b.overall - a.overall);
  if (G.market.length >= CAP) G.market.pop(); // en zayıf isim "başka kulübe gitti"
  // DETERMİNİSTİK yerel RNG (ana akışı tüketmez → seed'li testler kaymaz). Çeşitlilik: sıra no + hafta + güç.
  const seq = (G._mktSeq = (G._mktSeq || 0) + 1);
  let s = (seq * 2654435761 + (G.meta.week || 0) * 40503 + Math.round(G.temelGuc) * 97) >>> 0;
  const nx = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const dR = (lo, hi) => lo + nx() * (hi - lo);
  const dI = (lo, hi) => Math.floor(dR(lo, hi + 1));
  const POS = ['GK', 'DEF', 'MID', 'FWD'];
  const base = Math.round(G.temelGuc);
  const sb = Math.round((G.facilities.scout || 0) * 1.5); // gözlemci ağı → daha yüksek tavan
  const ov = Math.max(35, Math.min(92, base + dI(-6, 10 + sb)));
  const age = dI(18, 32);
  const nm = G.data.names;
  const name = nm ? `${nm.first[dI(0, nm.first.length - 1)]} ${nm.last[dI(0, nm.last.length - 1)]}` : 'Serbest ' + seq;
  const p = new Player({ id: 'mkt-w' + seq, name, pos: POS[dI(0, 3)], overall: ov, potential: age < 24 ? Math.min(95, ov + dI(0, 8)) : ov, age, contractYears: dI(2, 4), rng: dR });
  const pr = TUNING.TRANSFER.PREMIUM; p.fee = p.marketValue * ((pr[0] + pr[1]) / 2); // deterministik bedel (transferFee rand kullanır)
  const mhN = mh32(String(p.id) + '|' + p.name); p._ilgi = mhN % 4; p._kalan = 2 + ((mhN >>> 4) % 4); // yeni isim de ilgi/süre ile doğar
  G.market.push(p);
  G.market.sort((a, b) => b.overall - a.overall);
}

export function beginWeek(G) {
  G.hazirlik = 0; // maç haftası başladıysa hazırlık dönemi bitmiştir (gerçek oyunda zaten 0)
  const wk = G.meta.week;
  G.transferWindow = windowOpen(wk);
  if (wk === 17) G.market = generateMarket(Math.round(G.temelGuc), { names: G.data.names, scout: G.facilities.scout });
  scoutTick(G); // sürekli scouting: piyasa her hafta tazelenir + ilgi/süre nabzı
  sponsorMarketTick(G); // sponsor pazarı: eski teklifler çekilir, yeni markalar kapıyı çalar
  G.sorguHak = 1 + (G.facilities.scout || 0); // haftalık sorgu hakkı — scout ağı büyüdükçe artar
  G.demecUsed = false;
  G.tickDecisions = 0; // Y1: tick başına zorunlu karar sayacı (≤2)
  drainDecisionQueue(G); // kuyruğa alınmış kararlar önce
  fireReactions(G);      // Y4: vadesi gelen tepki zinciri halkaları
  // Ertesi sabah yankısı (Y5): önceki maçın sosyal artçıları
  if (G.morningEcho && G.morningEcho.length) {
    G.socialFeed = [...G.morningEcho, ...(G.socialFeed || [])].slice(0, 4);
    G.morningEcho = null;
  }
  // Ertelenen telefon geri gelir (Y2): arayan HATIRLAR
  if (G.phoneDeferred) { ringPhone(G, G.phoneDeferred); G.phoneDeferred = null; }
  // A3: DEADLINE dosyalarının süresi geçen hafta doldu → kaçtı
  for (const m of G.inbox) {
    if (m.deadline && !m.resolved && (m.action === 'tfile' || m.action === 'sfile')) {
      m.resolved = true;
      pushInbox(G, { cat: 'transfer', t: 'Süre doldu — fırsat kaçtı', b: `${m.file?.player?.name || 'Dosyadaki isim'} beklemedi; deadline treni kalktı.` });
    }
  }
  // Y2: geçen haftanın cevaplanmamış deadline ARAMALARI da kaçar (ertelenen hariç — arayan hatırlar)
  const kacti = (p) => pushInbox(G, { cat: 'transfer', t: 'Süre doldu — fırsat kaçtı', b: `${p.file?.player?.name || (p.title || '').replace('⏱ ', '') || 'Hattaki isim'} beklemedi; deadline treni kalktı.`, noQueue: true });
  if (G.phoneQueue && G.phoneQueue.length) G.phoneQueue = G.phoneQueue.filter((p) => (p.deadline && !p.deferred ? (kacti(p), false) : true));
  while (G.phone && G.phone.deadline && !G.phone.deferred) { kacti(G.phone); nextPhone(G); }
  transferWarTick(G);    // B1b: açık dosyaya rakip başkan girer ("üstüne 5 koyarım")
  fedTick(G, wk);        // B1c: Ozan Kaptan istatistik yazısı + fikstür jesti (gizli hat tek kanalı)
  tisTick(G);            // B2b: taraftar ilişkileri erken uyarısı
  koreoTick(G, wk);      // B2c: kritik ev maçı öncesi koreografi telefonu
  kapakTick(G);          // B2d: form zirvesinde medya kapak teklifi
  ilanTick(G, wk);       // B3a: ilana AI kulüp cevapları
  vitrinTick(G);         // B3b: vitrindeki oyunculara teklif telefonları
  captainWatch(G);       // K2: kaptan kadrodan ayrıldıysa soyunma odası şoku
  contractTick(G, wk);   // K3: sözleşme masası dramı (menajer/GM telefonları + söylenti)
  injuryStoryTick(G);    // K4: sağlık raporu (net/sisli) + dönüş kararı telefonu
  jubileTick(G, wk);     // M3: emekliliğe yaklaşan efsane için jübile telefonu (hafta 30)
  gmTick(G, wk); // §1: GM dosyaları (onay/satış) + geciken pazarlık dönüşleri
  deadlineTick(G, wk); // A3+Y2: pencerenin son haftası — panik TELEFONLARI
  freeAgentTick(G, wk); // A3: pencere dışı bonservissiz kumar dosyası
  loanOutTick(G, wk);   // A3: genç kiralık gönderme önerisi
  // A1: CFO projeksiyon sisi — bu haftanın sapması (kötü/boş CFO ±%15'e kadar)
  { const n = cfoNoiseRange(G.staff?.cfo); G.cfoWobble = rand(-n, n); }
  const round = G.league.fixtures[wk - 1];
  const my = round.find((m) => m.home === MY || m.away === MY);
  const isHome = my.home === MY;
  const oppId = isHome ? my.away : my.home;

  // ── D4 Takvim bağlamı: derbi / milli ara / sprint ──
  const CAL = TUNING.DELUXE.CAL;
  const isDerby = oppId === 'o0';
  const isIntl = CAL.INTL_WEEKS.includes(wk);
  if (isIntl) pushInbox(G, { cat: 'lig', t: 'Milli ara haftası', b: 'Yıldızlar milli takımda — kadro bu hafta eksik güçle sahada. Sakat dönme riski GM\'in uykusunu kaçırıyor.' });

  // ── Telkin (v4.1-2): TD tepkisi + maç etkisi ──
  const telkinFx = applyTelkin(G, oppId, wk);
  // ── Prim (v4.1-3): maç gücü çarpanı, bedeli galibiyette kasadan ──
  let primPower = 1, primWinCost = 0;
  const MP = TUNING.PRIM.MAC[G.matchPrim];
  if (MP) { primPower *= MP.power; primWinCost += MP.cost; }
  if (G.ozelArmed) primPower *= TUNING.PRIM.OZEL.power;
  if (G.seriBoostWeeks > 0) primPower *= TUNING.PRIM.SERI.nextPower;

  // Maç gücü TemelGüç'ten; telkin+prim+takvim çarpanları maça biner.
  const derbySwing = isDerby ? 1 + rand(-CAL.DERBY_SWING, CAL.DERBY_SWING) : 1;
  const myStrength = temelGuc(powerCtx(G)) * telkinFx.power * primPower * derbySwing * (isIntl ? CAL.INTL_POWER : 1);
  const myMG = macGucu(myStrength, { isHome, stadyum: G.facilities.stadyum, taraftar: G.gauges.taraftar });
  const oppMG = macGucu(G.league.table[oppId].strength, { isHome: !isHome, stadyum: TUNING.MATCH.AI_STAD, taraftar: TUNING.MATCH.AI_TARAFTAR });
  // Y3: YARI 1 (45dk) simülasyonu — devre arası kararı 2. yarıyı ETKİLEYECEK
  const SEG = TUNING.YASAYAN.SEG;
  const T = TUNING.BASE_GOALS * telkinFx.goalsMult;
  // B1c: tartışmalı VAR kararlarının yönü — gizli federasyon hattı, ±%3 tavanlı MİKRO etki
  const fedBias = 1 + clamp(((G.fedIliski ?? 50) - 50) / 50, -1, 1) * TUNING.MEGA.FED.VAR_BIAS;
  // B2c: koreografi gecesi — o EV maçında tribün duvar (+%1.5)
  const koreoMult = (G.koreoPending && isHome) ? TUNING.MEGA.KOREO.EV_AVANTAJ : 1;
  if (G.koreoPending && isHome) G.koreoPending = false;
  const myMGf = myMG * fedBias * koreoMult;
  const h1 = simulateMatch(isHome ? myMGf : oppMG, isHome ? oppMG : myMGf, undefined, { baseGoals: T * SEG.H1 });
  G.matchCtx = {
    wk, isHome, oppId, isDerby, isIntl, telkinType: telkinFx.type, primWinCost,
    myMG: myMGf, oppMG, T, h1, myH2: 1, oppH2: 1, htMove: null, htNote: '', trace: [],
    oppName: G.league.table[oppId].name,
  };
  // HT ekranı verisi: skor + durum tespiti (xG dürüstlüğü)
  const hMy = isHome ? h1.gH : h1.gA, hOpp = isHome ? h1.gA : h1.gH;
  const hxMy = isHome ? h1.xgH : h1.xgA, hxOpp = isHome ? h1.xgA : h1.xgH;
  G.pendingMatch = {
    phase: 'pre', oppName: G.matchCtx.oppName, isHome, isDerby,
    guc: { biz: Math.round(myMG), onlar: Math.round(oppMG) },
    tahmin: predictLine(myMG, oppMG),
    plan: tdPlan(G, telkinFx.type),
    ht: { my: hMy, opp: hOpp, tespit: htTespit(hMy, hOpp, hxMy, hxOpp) },
  };
  // B1b: derbi öncesi PROTOKOL EL SIKIŞMA — rakip başkanla mini kart (opsiyonel, DEVAM ile geçilir)
  if (isDerby) {
    const opp = (G.opponents || []).find((o) => o.id === oppId);
    if (opp) G.pendingMatch.protokol = { baskan: opp.baskan || 'Rakip Başkan', tip: opp.baskanTipi, done: false };
  }
  return G.pendingMatch;
}

// B1b: protokol tonu — rakip başkanın tipi cevabını belirler
export function protokolTon(G, ton) {
  const pm = G.pendingMatch;
  if (!pm || !pm.protokol || pm.protokol.done) return { ok: false };
  const p = pm.protokol;
  p.done = true; p.ton = ton;
  registerDecision(G, 'protokol:' + ton);
  const rg = radikalGrup(G);
  if (ton === 'soguk') {
    if (rg) rg.memnuniyet = clamp(rg.memnuniyet + 2, 0, 100);
    if (p.tip === 'POPULIST') { // popülist soğuğa soğuk döner → manşet
      updateMediaTone(G, -1);
      pushInbox(G, { cat: 'medya', t: `Protokolde buz: ${p.baskan} eli havada kaldı`, sig: 'protokol-soguk', b: 'İki başkan bakışmadı bile. Muhabirler kare kare çekti — derbi sahadan önce tribünde başladı.', noQueue: true });
      p.cevap = 'soguk';
    } else p.cevap = 'mesafeli';
  } else if (ton === 'samimi') {
    const ig = (G.fanGroups || []).find((g) => !g.radikal);
    if (ig) ig.memnuniyet = clamp(ig.memnuniyet + 2, 0, 100);
    if (rg) rg.memnuniyet = clamp(rg.memnuniyet - 1, 0, 100); // "fazla yakın"
    p.cevap = 'sicak';
  } else { // diplomatik
    G.gauges.itibar = clamp(G.gauges.itibar + 0.5, 0, 100);
    p.cevap = 'nazik';
  }
  return { ok: true };
}

function predictLine(myMG, oppMG) {
  // GERÇEKÇİ 3-sonuç modeli (cockpit.nextMatch ile aynı): beraberlik dengede yüksek,
  // uçlarda taban korur; mağlubiyet kalandan ölçeklenir (favoride %3 beraberlik saçmalığı yok).
  const d = myMG - oppMG;
  const e = 1 / (1 + Math.pow(10, -d / TUNING.SIGMOID_DIV));
  const pD = Math.round(19 + 13 * (1 - Math.abs(2 * e - 1)));
  const pW = Math.round((100 - pD) * e);
  return { W: pW, D: pD, L: Math.max(0, 100 - pD - pW) };
}
// Devre arası tek cümle DURUM TESPİTİ (xG dürüstlüğü)
function htTespit(gMy, gOpp, xMy, xOpp) {
  if (gMy > gOpp) return xMy < xOpp ? 'Öndesin ama kurtaran kaleci — oyun rakipte.' : 'Öndesin ve eziyorsun.';
  if (gMy < gOpp) return xMy > xOpp ? 'Geridesin ama üretiyorsun — bu skor haksız.' : 'Geridesin ve oyun da kayıp.';
  return xMy > xOpp ? 'Berabere ama üstün taraf sensin.' : xMy < xOpp ? 'Berabere — kaleci tutuyor.' : 'Kıran kırana bir denge.';
}

// Y3: DEVRE ARASI başkan hamlesi. move: 'soyunma' | 'tdguven' | 'tribun' | (TD ret kuralları telkinle aynı)
export function htDecision(G, move) {
  const ctx = G.matchCtx;
  if (!ctx || ctx.htMove) return { ok: false };
  const HT = TUNING.YASAYAN.HT;
  ctx.htMove = move;
  registerDecision(G, 'ht:' + move);
  karneKaydet(G, 'ht:' + move); // K5: devre arası kararları karneye işler
  if (move === 'soyunma') {
    if (rand(0, 1) < HT.soyunma.p) {
      ctx.myH2 *= HT.soyunma.mult;
      for (const p of G.squad) p.morale = clamp(p.morale + HT.soyunma.morale, 0, 100);
      ctx.htNote = 'Başkan soyunma odasına indi — takım ikinci yarıya fırtına gibi başladı.';
    } else {
      G.coach.otorite = clamp(G.coach.otorite + HT.soyunma.otorite, 0, 100);
      ctx.htNote = 'Başkanın soyunma odası ziyareti TD\'nin alanına girdi; hava gerildi.';
    }
  } else if (move === 'tribun') {
    if (ctx.isHome) { ctx.myH2 *= HT.tribun.mult; ctx.tribunRisk = true; ctx.htNote = 'Başkan tribüne el salladı; uğultu ikinci yarıda sahaya indi.'; }
    else ctx.htNote = 'Deplasmanda tribün kartı işlemez — sessiz bir koridor konuşması.';
  } else { // tdguven
    G.tdRelation = clamp((G.tdRelation ?? 70) + HT.tdguven.rel, 0, 100);
    ctx.htNote = 'Başkan teknik ekibe güvendi; dokunulmadı.';
  }
  return { ok: true };
}

// Y3: 2. yarı + (kritikse) SON 10 DK. waitLate dönerse lateDecision beklenir.
export function finishWeek(G) {
  const ctx = G.matchCtx;
  if (!ctx) return { ok: false };
  const SEG = TUNING.YASAYAN.SEG;
  const { isHome } = ctx;
  // 2. yarı (35dk)
  const h2 = simulateMatch(
    (isHome ? ctx.myMG * ctx.myH2 : ctx.oppMG * ctx.oppH2),
    (isHome ? ctx.oppMG * ctx.oppH2 : ctx.myMG * ctx.myH2),
    undefined, { baseGoals: ctx.T * SEG.H2A },
  );
  ctx.h2 = h2;
  const curMy = (isHome ? ctx.h1.gH + h2.gH : ctx.h1.gA + h2.gA);
  const curOpp = (isHome ? ctx.h1.gA + h2.gA : ctx.h1.gH + h2.gH);
  const trigger = lateTrigger(G, { isDerby: ctx.isDerby, diff: curMy - curOpp });
  if (trigger && !ctx.lateAsked) {
    ctx.lateAsked = true;
    G.pendingMatch = { ...G.pendingMatch, phase: 'late', late: { my: curMy, opp: curOpp, trigger } };
    return { waitLate: true };
  }
  return finishWeekTail(G, 'devam');
}

// Y3: son 10 dk kararı. move: 'dok' (kaybediyorken) | 'koru' (beraberken) | 'devam' (nötr)
export function lateDecision(G, move) {
  const ctx = G.matchCtx;
  if (!ctx) return { ok: false };
  if (move !== 'devam') { registerDecision(G, 'late:' + move); karneKaydet(G, 'late:' + move); } // K5
  return finishWeekTail(G, move || 'devam');
}

function finishWeekTail(G, lateMove) {
  const ctx = G.matchCtx;
  const SEG = TUNING.YASAYAN.SEG, L = TUNING.YASAYAN.LATE;
  const { isHome } = ctx;
  let lateT = ctx.T * SEG.LATE, lateMyMult = 1, lateOppMult = 1;
  if (lateMove === 'dok') { lateT *= L.dok.both; lateMyMult = 1.1; lateOppMult = 1.05; ctx.htNote += ' Son dakikalarda her şey öne döküldü.'; }
  else if (lateMove === 'koru') { lateT *= L.koru.total; ctx.htNote += ' Son dakikalar kilitlendi.'; }
  const lt = simulateMatch(
    (isHome ? ctx.myMG * ctx.myH2 * lateMyMult : ctx.oppMG * lateOppMult),
    (isHome ? ctx.oppMG * lateOppMult : ctx.myMG * ctx.myH2 * lateMyMult),
    undefined, { baseGoals: lateT },
  );
  // Segmentleri birleştir
  const res = {
    gH: ctx.h1.gH + ctx.h2.gH + lt.gH, gA: ctx.h1.gA + ctx.h2.gA + lt.gA,
    xgH: ctx.h1.xgH + ctx.h2.xgH + lt.xgH, xgA: ctx.h1.xgA + ctx.h2.xgA + lt.xgA,
  };
  res.result = res.gH > res.gA ? 'W' : res.gH < res.gA ? 'L' : 'D';
  const wk = ctx.wk, my = { home: isHome ? MY : ctx.oppId, away: isHome ? ctx.oppId : MY };
  const oppId = ctx.oppId, isDerby = ctx.isDerby, isIntl = ctx.isIntl;
  const telkinFx = { type: ctx.telkinType };
  const primWinCost = ctx.primWinCost;
  applyResult(G.league.table[my.home], G.league.table[my.away], res.gH, res.gA);

  const myRes = isHome ? res.result : flip(res.result);
  const myGoals = isHome ? res.gH : res.gA, oppGoals = isHome ? res.gA : res.gH;
  const xgFor = isHome ? res.xgH : res.xgA, xgAgn = isHome ? res.xgA : res.xgH;
  // Y3: tribün kartının riski — kaybedersen taraftar bedeli
  if (ctx.tribunRisk && myRes === 'L') G.gauges.taraftar = clamp(G.gauges.taraftar - TUNING.YASAYAN.HT.tribun.taraftarCeza, 0, 100);
  const oncekiSakatlar = new Set(G.squad.filter((p) => p.injuryWeeks > 0).map((p) => p.id)); // K4: yeni sakat tespiti için
  const oncekiCezalar = new Set(G.squad.filter((p) => p.suspensionWeeks > 0).map((p) => p.id)); // B1c: takdir için
  postMatch(G.squad, myRes, G.facilities);
  // B1c: disiplin ceza süresi TAKDİRİ — gizli hat ±1 hafta (mikro)
  {
    const F = TUNING.MEGA.FED, fed = G.fedIliski ?? F.START;
    for (const p of G.squad) {
      if (p.suspensionWeeks > 0 && !oncekiCezalar.has(p.id)) {
        if (fed >= F.CEZA_TAKDIR_HI) p.suspensionWeeks = Math.max(1, p.suspensionWeeks - 1);
        else if (fed <= F.CEZA_TAKDIR_LO) p.suspensionWeeks += 1;
      }
    }
  }
  // K4: erken dönüş kumarının faturası — nüks işaretliyse maç sonrası patlar
  if (G.injurySaga && G.injurySaga.nuks) {
    const ip = G.squad.find((x) => x.id === G.injurySaga.playerId);
    if (ip) {
      ip.injuryWeeks = Math.max(ip.injuryWeeks, G.injurySaga.realWeeks * TUNING.INSAN.SAKAT.NUKS_MULT);
      pushInbox(G, { cat: 'saglik', t: `NÜKS: ${ip.name} yine yerde`, b: `Erken dönüş kumarı kaybedildi — aynı bölge, bu kez ${ip.injuryWeeks} hafta. Sağlık ekibi "demiştik" diyor ama yüksek sesle değil.`, noQueue: true });
      anKarti(G, { t: `Erken dönüş nüksü: ${ip.name}`, b: 'Kumar kaybedildi — sakatlık iki katına döndü.', etki: -5 }); // M5
    }
    G.injurySaga = null;
  }
  // K5: bu haftanın telkin/HT/son-10dk kararlarına sonuç yazılır (karne)
  for (const e of G.telkinLog || []) if (e.wk === wk && e.res == null) e.res = myRes;
  if (isDerby && myRes === 'W') G.derbiWins = (G.derbiWins || 0) + 1; // B4d sayaç
  // B2d: kapak laneti izleme — kabulden sonraki 3 maçta 2 kayıp = "kapak laneti"
  if (G.kapakLanet) {
    G.kapakLanet.maclar++;
    if (myRes === 'L') G.kapakLanet.kayip++;
    if (G.kapakLanet.kayip >= 2) {
      G.gauges.taraftar = clamp(G.gauges.taraftar + TUNING.MEGA.KAPAK.LANET_TARAFTAR, 0, 100);
      pushInbox(G, { cat: 'manset', t: 'KAPAK LANETİ mi?', sig: 'kapak-lanet-' + G.worldSeason, b: 'Dergi kapağından sonra üst üste kayıplar — sosyal medyada alay konusu: "Stüdyoda kazandık, sahada kaybettik."', noQueue: true });
      G.socialFeed = [{ text: 'Kapakta poz, sahada hüsran. Işıklar mı çarptı başkanım? 📸😂', mood: 'neg', viral: true }, ...(G.socialFeed || [])].slice(0, 4);
      G.kapakLanet = null;
    } else if (G.kapakLanet.maclar >= 3) G.kapakLanet = null;
  }
  // MVP: kadro rotasyonu yok → maçlar arası haftalık dinlenme kondisyonu toparlar
  // (net yıpranma ~0). Form/moral ve sakatlıklar hâlâ efektif gücü oynatır.
  for (const pl of G.squad) pl.fitness = clamp(pl.fitness + TUNING.FIT_DROP, 0, 100);
  if (G.rotRecover > 0) { for (const pl of G.squad) pl.fitness = clamp(pl.fitness + TUNING.TELKIN.ROTASYON.recoverAmt, 0, 100); G.rotRecover--; }
  postTelkin(G, telkinFx);
  spreadMorale(G.squad, G.captainId, TUNING.INSAN.KAPTAN.WEIGHT); // V4-E + K2: kaptan yayılım merkezi (×1.4)
  if (G.sezonHedefDeclared) { // sezon hedef primi: moral tabanı +1 (düşükleri kaldırır)
    const P = TUNING.PRIM.SEZON;
    for (const pl of G.squad) if (pl.morale < P.floorMorale) pl.morale = clamp(pl.morale + P.floorGain, 0, 100);
  }
  G.season[myRes]++; G.season.GF += myGoals; G.season.GA += oppGoals;
  applyPrimResults(G, myRes, primWinCost);

  const round = G.league.fixtures[wk - 1];
  const CAL = TUNING.DELUXE.CAL;
  for (const m of round) {
    if (m.home === MY || m.away === MY) continue; // benim maçım segmentli oynandı
    const h = G.league.table[m.home], a = G.league.table[m.away];
    const r = simulateLeagueMatch(h.strength, a.strength);
    applyResult(h, a, r.gH, r.gA);
  }

  const table = standings(G.league);
  G.myPos = table.find((t) => t.id === MY).rank;

  const led = applyEconomy(G, { isHomeMatch: isHome, isSeasonWeek: true, ticketMult: isDerby && isHome ? TUNING.DERBY_TICKET : 1 });
  G.term.income += led.gelir.toplam; G.term.wage += led.gider.maas;
  G.seasonIncome = (G.seasonIncome || 0) + led.gelir.toplam; // A2: FFP gelecek sezon limiti için
  G.lastLedger = led;
  const targets = computeTargets(G, { myPos: G.myPos, maliHedef: led.maliHedef });
  // B2a: 4 boyut hesaplanır ve taraftar hedefini SAPMA olarak besler (nötrde 0 — bant dostu)
  updateBoyutlar(G, { myRes });
  targets.taraftar = clamp(targets.taraftar + boyutSapma(G), 0, 100);
  // B6c: vaat umut tavanı — umut bonusu taraftar hedefini 92 üstüne taşıyamaz
  if (targets.taraftar > TUNING.MEGA.UMUT_TARAFTAR_TAVAN) targets.taraftar = TUNING.MEGA.UMUT_TARAFTAR_TAVAN;
  // D2: guven hedefi = ağırlıklı KURUL ortalaması (v4-§2.1) — kurul mini-politikası
  const boardAvg = updateBoard(G);
  if (boardAvg != null) targets.guven = boardAvg;
  updateFanGroups(G);
  applyInertia(G.gauges, targets);
  decayPromiseHope(G);

  // D4: milli aradan sakat dönme (%8, en iyi oyunculardan biri)
  if (isIntl && rand(0, 1) < CAL.INTL_INJ) {
    const star = G.squad.slice().sort((a, b) => b.overall - a.overall)[randint(0, 2)];
    if (star) { star.injuryWeeks = Math.max(star.injuryWeeks, randint(1, 3)); pushInbox(G, { cat: 'saglik', t: 'Milli takımdan kötü haber', b: `${star.name || 'Yıldızımız'} sakat döndü — GM: "Her milli arada aynı korku."` }); }
  }

  // D4: kupa turu (tek maç eleme; hafta 31 finali → kupa ZAFERİ)
  if (CAL.CUP_WEEKS.includes(wk) && G.cup && G.cup.alive) {
    const cupOpp = clamp(Math.round(G.temelGuc + rand(-CAL.CUP_SPREAD, CAL.CUP_SPREAD) + G.cup.round * CAL.CUP_RAMP), 30, 92);
    const cres = simulateMatch(macGucu(Math.round(G.temelGuc), { isHome: true, stadyum: G.facilities.stadyum, taraftar: G.gauges.taraftar }), macGucu(cupOpp, { isHome: false }));
    G.cup.round++;
    if (cres.result === 'L' || (cres.result === 'D' && rand(0, 1) < 0.5)) {
      G.cup.alive = false;
      pushInbox(G, { cat: 'mac', t: `Kupadan elendik (${G.cup.round}. tur)`, b: `${cres.gH}-${cres.gA + 1} — kupa macerası bitti; lig yoğunluğu hafifledi.` });
    } else if (G.cup.round >= CAL.CUP_WEEKS.length) {
      G.cup.alive = false; G.cup.won = true;
      G.gauges.itibar = clamp(G.gauges.itibar + 8, 0, 100); G.gauges.taraftar = clamp(G.gauges.taraftar + 10, 0, 100);
      pushInbox(G, { cat: 'mac', t: '🏆 KUPA BİZİM!', b: `Finalde ${cres.gH}-${cres.gA} — müzeye yeni kupa, tribüne bayram.` });
    } else {
      pushInbox(G, { cat: 'mac', t: `Kupada tur atladık (${G.cup.round}. tur)`, b: `${cres.gH}-${cres.gA} — yola devam.` });
    }
  }

  // D4: Genç Takım Günü SAHNESİ (hafta 17) — kart açma + ☆ potansiyel + %10 altın çocuk
  if (wk === CAL.YOUTH_WEEK) {
    const youths = youthIntake(G.facilities, { names: G.data.names, used: G.usedNames });
    for (const y of youths) y.ocak = true; // B4d: ocak çocuğu izi
    // A1: Akademi Direktörü — potansiyel dağılımı + altın çocuk şansı çarpanı
    const akDir = G.staff?.akademi;
    const goldenP = CAL.GOLDEN_P + (akDir ? akDir.skill * TUNING.STAFF.GOLDEN_PER_SKILL : 0);
    let golden = null;
    for (const y of youths) {
      if (akDir) y.potential = Math.min(95, y.potential + Math.round((akDir.skill - 50) / TUNING.STAFF.AKADEMI_POT_DIV));
      if (rand(0, 1) < goldenP) { y.potential = Math.max(y.potential, randint(85, 92)); golden = y; }
      y.id = 'sq' + (G._pid = (G._pid || 1000) + 1);
      G.squad.push(y);
    }
    if (youths.length) {
      const kart = youths.map((y) => `${y.name || 'genç'} (${y.pos}) ${'☆'.repeat(clamp(Math.round((y.potential - 40) / 12), 1, 5))}`).join(' · ');
      pushInbox(G, { cat: 'akademi', t: `GENÇ TAKIM GÜNÜ — bu yılın mahsulü (${youths.length})`, b: `Akademi direktörü kartları tek tek açtı: ${kart}.` });
      if (golden) {
        pushInbox(G, { cat: 'manset', t: `ALTIN ÇOCUK: ${golden.name || 'genç yetenek'}`, sig: 'altin-cocuk-' + G.meta.season, b: 'Akademiden cevher fışkırdı — menajerler şimdiden kapıda, medya yazdıkça yazıyor.' });
        (G.altinCocuklar = G.altinCocuklar || []).push(golden.name); // M4: "yetiştirilen yıldızlar" vitrini
        anKarti(G, { t: `Altın çocuk: ${golden.name}`, b: 'Akademiden bir cevher parladı.', etki: 5 });
      }
    }
  }

  // D1: canlı lig tick haberi (AI TD kovma / istifa)
  const aiNews = aiTick(G.opponents, G.league.table);
  if (aiNews) { G.leagueNews = aiNews; pushInbox(G, { cat: 'lig', t: 'Lig Gündemi', b: aiNews }); }

  // D2+B1a: kurul sunumu haftaları — gündem SON OLAYLARDAN kurulur (sabit taahhüt seçimi bitti)
  // B4c-AİLE: kurul yok → sunum yok
  if ((G.board || []).length && TUNING.DELUXE.BOARD.SUNUM_WEEKS.includes(wk) && !G.inbox.some((m) => (m.action === 'board' || m.action === 'agenda') && !m.resolved)) {
    const gundem = buildBoardAgenda(G);
    if (gundem.length) {
      pushInbox(G, {
        cat: 'kongre', t: `Kurul Sunumu — gündemde ${gundem.length} madde`,
        b: 'Kurul son haftaların dosyasını önüne koydu. Her maddeye tonunu seç: veriyle savun (karne sağlamsa işler, çürükse geri teper) · vizyonla büyüle (güvenli, küçük) · kabullen-özür (loyalty bedeli, dürüstlük güveni).',
        action: 'agenda', agenda: { items: gundem, idx: 0, sonuc: [] },
      });
    } else {
      // Sakin dönem: kısa tören + küçük bonus
      for (const m of G.board || []) m.loyalty = clamp(m.loyalty + TUNING.MEGA.KURUL.SAKIN_BONUS, 0, 100);
      pushInbox(G, { cat: 'kongre', t: 'Kurul Sunumu: sorunsuz geçti', b: 'Gündemde çetrefilli madde yoktu; rakamlar akıcı, sorular kibar. Üyeler memnun ayrıldı (küçük güven tazelenmesi).', noQueue: true });
    }
  }

  // D3: rastgele olay kartı (etiket ağırlıklı; sprint haftaları ×1.3; tek aktif olay)
  const sprintMult = wk >= CAL.SPRINT_FROM ? CAL.SPRINT_MULT : 1;
  if (!G.inbox.some((m) => m.action === 'event' && !m.resolved) && rand(0, 1) < TUNING.EVENT_P * sprintMult) {
    const ev = pickRandomEvent(G, G.data.events);
    if (ev && ev.auto) {
      applyEventEffects(G, ev.effects || {});
      pushInbox(G, { cat: 'olay', t: ev.title, b: ev.body || (ev.effects && ev.effects.note) || 'Olay kendiliğinden gelişti.' });
    } else if (ev && ev.phone) {
      // K1: uygun olaylar TELEFONLA gelir (belediye/valilik, gece skandalı, dev teklif) — arayan kimlikli
      ringPhone(G, {
        kind: 'olay', story: true, caller: ev.phone.caller, callerName: ev.phone.callerName,
        title: ev.title, body: ev.body || '',
        options: (ev.options || []).map((o, i) => ({ key: 'ev' + i, label: o.label, whisper: o.whisper })),
        event: ev,
      });
    } else if (ev) {
      // K1 AUDİT: gövde metni zorunlu — "1) Kabul · 2) Red" artığı yok; seçenekler butonda, fısıltı altında
      pushInbox(G, { cat: 'olay', t: 'OLAY: ' + ev.title, b: ev.body || 'Masana yeni bir dosya kondu.', action: 'event', event: ev });
    }
  }

  // Banka düşük faizli kredi teklifi — arada bir (deterministik hafta tetiği; ana RNG'yi tüketmez → seed'li testler etkilenmez)
  if (G.mode !== 'aile' && wk >= 4 && wk % 13 === 6
    && !G.inbox.some((m) => m.action === 'bankLoan' && !m.resolved)
    && G.economy.borc + 20 <= 400) {
    const amount = [20, 30, 50][wk % 3];
    const faizIndirim = 0.03 + (wk % 4) * 0.01; // %3-6 indirim
    pushInbox(G, {
      cat: 'mali', t: 'Banka teklifi: düşük faizli kredi',
      b: `Bir banka kapıyı çaldı: ${amount}mn krediyi piyasa altı faizle veriyor. Kabul edersen kasaya ${amount}mn girer, borç o kadar büyür ama faiz oranın da düşer (−%${Math.round(faizIndirim * 100)}). İstersen geri çevir.`,
      action: 'bankLoan', loan: { amount, faizIndirim },
    });
  }

  const evs = checkThresholdEvents(G, {});
  tickEventFlags(G);

  // Anlatı manşeti (V3-D + V4-7): etiket → şablon (6 hafta tekrar yok) → inbox 'manset'
  G.globalWeek = (G.globalWeek || 0) + 1;
  G.recent = G.recent || [];
  G.recent.push(myRes === 'W' ? 3 : myRes === 'D' ? 1 : 0);
  if (G.recent.length > 5) G.recent.shift();
  // Sosyal medya nabzı (V5-6): taraftar gauge'ının hızlı öncü göstergesi.
  // Transfer heyecanı SEZON BAŞI DALGASIDIR — haftalık nötre söner (direktif kalıcı damga olmasın)
  if (G.transferHype != null) G.transferHype += (50 - G.transferHype) * 0.12;
  G.sentiment = computeSentiment({ son2puan: G.recent.slice(-2).reduce((a, b) => a + b, 0), ticketPrice: G.economy.ticketPrice, transferHype: G.transferHype ?? 50, gundem: (G.mediaTone || 0) * 20 });
  if (G.data.media) {
    const son5 = G.recent.reduce((a, b) => a + b, 0);
    const tag = selectTag({ myPos: G.myPos, gauges: G.gauges, son5puan: son5, week: wk });
    const hl = makeHeadline(G, G.data.media, tag, G.globalWeek, {
      ad: G.club.name, rakip: G.league.table[oppId].name, n: G.season.W, g: G.season.GF,
      'sıra': G.myPos, kalan: 34 - wk, x: Math.round(G.lastLedger.gider.faiz), p: 50, d: 78,
      oyuncu: 'yıldızımız', genç: 'genç yıldız', 'yaş': 19, td: G.coach.name,
    });
    // A1: Basın Sözcüsü negatif manşet olasılığını düşürür ×(1−skill/250)
    if (hl.tone < 0 && G.staff?.basin && rand(0, 1) < G.staff.basin.skill / TUNING.STAFF.BASIN_NEG_DIV) {
      hl.tone = 0; hl.softened = true;
    }
    updateMediaTone(G, hl.tone);
    G.currentTag = tag; // §7: kimlik kartındaki anlatı rozeti
    const jr = journalistFor(G.data.media, hl.tone); // D2: manşetler imzalı (kalıcı gazeteciler)
    const douseable = hl.tone < 0 && G.staff?.basin && (G.globalWeek - (G.douseWeek || -99)) >= TUNING.STAFF.DOUSE_COOLDOWN;
    pushInbox(G, {
      cat: 'manset', t: hl.text, sig: hl.sig, noQueue: true, // haber anında düşer — karar kuyruğuna girmez (6-hafta kuralı kayar yoksa)
      b: `${jr ? `— ${jr.name} (${jr.outlet}) · ` : ''}Basın havası: ${toneWord(G.mediaTone)}${hl.softened ? ' · (sözcü yumuşattı)' : ''}`,
      ...(douseable ? { action: 'douse' } : {}),
    });
  }

  // D8: sosyal medya akışı — ataletsiz öncü nabız + viral (%25)
  if (G.data.social) {
    const stTop = G.squad.slice().sort((a, b) => b.overall - a.overall)[0];
    G.socialFeed = makeFeed(G.sentiment || 0, G.data.social, {
      oyuncu: (stTop && stTop.name) || 'yıldızımız',
      'genç': (G.squad.filter((p) => p.age <= 21)[0] || {}).name || 'gençlerimiz',
      vaat: (promiseStatus(G)[0] || {}).name || 'sözler',
      'sıra': G.myPos, rakip: G.club.rivalName,
    });
  }

  // §4: Kongre trend verisi — haftalık oy projeksiyonu (mevcut sezon geçici karneyle)
  {
    const savedH = G.history;
    G.history = { seasons: [...savedH.seasons, { pos: G.myPos, champion: false }] };
    const proj = eleksiyon(G, { baslangicBorc: G.termStartBorc, tutulmayanVaat: 0 });
    G.history = savedH;
    G.prevBreakdown = G.lastProj ? G.lastProj.breakdown : null;
    G.lastProj = proj;
    G.voteHistory = G.voteHistory || [];
    G.voteHistory.push({ w: G.globalWeek, oy: proj.oyOrani * 100 });
    if (G.voteHistory.length > 40) G.voteHistory.shift();
  }

  const oppName = G.league.table[oppId].name;
  pushInbox(G, {
    cat: 'mac',
    t: `Maç Raporu: ${myGoals}-${oppGoals} ${resTr(myRes)}`,
    b: `${isHome ? 'Ev' : 'Deplasman'} · ${oppName} · xG ${xgFor.toFixed(1)}-${xgAgn.toFixed(1)}. ${matchSentence(myRes, xgFor, xgAgn)}${telkinIzi(telkinFx.type, myRes)} (Sıra: ${G.myPos}.)`,
  });
  for (const e of evs) {
    // D2: boykotu RADİKAL grup başlatır — mesaj imzalıdır (v4-§2.3)
    const rg = e.id === 'boykot' ? radikalGrup(G) : null;
    pushInbox(G, { cat: 'olay', t: rg ? `${rg.name} boykot çağrısı yaptı` : e.title, b: eventBody(e.id) + (rg ? ` — imza: ${rg.name}.` : '') });
  }
  if (!G.ticketLetterDone && wk === 4) {
    pushInbox(G, { cat: 'karar', t: 'Taraftar Derneği: Kombine fiyatı', b: 'Tribünler bilet fiyatından şikâyetçi. Ne yapalım?', action: 'ticket' });
    G.ticketLetterDone = true;
  }

  refreshPower(G);

  // D5+Y3+Y5: maç verisi zenginleştirme — canlı faz (ticker + tribün şeridi) + sonrası
  {
    const xi = idealXI(G.squad);
    const highlights = generateHighlights(myRes, { myGoals, oppGoals, xgFor, xgAgn }, G.data.media, xi.map((p) => ({ name: p.name })));
    if (ctx.htNote) { // HT kararı ticker'a iz bırakır — dakika SIRASINA göre yerleşir
      const at = highlights.findIndex((h) => h.min > 46);
      highlights.splice(at < 0 ? highlights.length : at, 0, { min: 46, side: '-', type: 'tansiyon', text: "46' " + ctx.htNote });
    }
    injuryStoryCheck(G, oncekiSakatlar, highlights); // K4: önemli oyuncu sakatlandıysa sakatlık ANI ticker'da
    const notlar = xi.slice(0, 3).map((p) => ({ name: p.name || 'oyuncu', not: (myRes === 'W' ? 7 : myRes === 'D' ? 6.4 : 5.6) + rand(-0.4, 1.0) }));
    const adam = notlar.slice().sort((a, b) => b.not - a.not)[0];
    if (adam) adam.gecninAdami = true;
    G.pendingMatch = {
      ...(G.pendingMatch || {}), phase: 'live',
      oppName, isHome, isDerby, myGoals, oppGoals, xgFor, xgAgn, myRes, myPos: G.myPos,
      htScore: G.pendingMatch?.ht, htNote: ctx.htNote,
      highlights,
      tribun: makeMatchFeed(G, { myGoals, oppGoals, myRes, isDerby }),   // Y5: tribün canlı şeridi
      karakter: matchCharSentence(G, { myRes, myGoals, oppGoals, isDerby, adam: adam?.name }), // Y8: karakter cümlesi
      momentum: Math.round((xgFor / Math.max(xgFor + xgAgn, 0.01)) * 100),
      notlar,
    };
    // Y5: ertesi sabah yankısı — bir sonraki tick başında akışa düşer
    G.morningEcho = makeMorningEcho(G, myRes, isDerby);
  }
  G.matchCtx = null; // hafta maçı kapandı

  // ── Haftalık teknik rapor (v4.1-1): en zayıf çarpan → GM teşhisi (sayı yok) ──
  if (G.data.media?.reports) {
    const N = TUNING.REPORT.NEUTRAL, p = G.power;
    // v4.3: uygunluk şiddeti sakat SAYISINDAN (1→hafif, 2-3→orta, 4+→ağır) — sayıyla cümle çelişmez
    const injList = G.squad.filter((x) => x.injuryWeeks > 0);
    const injSev = injList.length >= 4 ? 'agir' : injList.length >= 2 ? 'orta' : 'hafif';
    const deficits = [
      { key: 'uygunluk', deficit: N.uygunluk - Math.min(p.uygunluk, 1.0), sev: injSev, slots: { oyuncu: (injList[0] && injList[0].name) || 'oyuncumuz' } },
      { key: 'moral', deficit: N.moral - p.moral },
      { key: 'form', deficit: N.form - p.form },
      { key: 'kond', deficit: N.kond - p.kond },
    ];
    const rep = makeReport(G, G.data.media, deficits, G.globalWeek);
    G.lastReport = { ...rep, week: wk };
    // A4: imza konuya göre ilgili staff'tan; kasa darsa CFO cümlesi eklenir
    const imza = rep.topic === 'uygunluk' ? 'Sağlık Ekibi' : rep.topic === 'kond' ? 'Performans Ekibi' : G.gm.name + ' (GM)';
    const cfoEk = G.economy.kasa < 10 && G.staff?.cfo ? ` · ${G.staff.cfo.name} (CFO): "Kasa dar, Başkanım — bu hafta cömertlik yok."` : '';
    pushInbox(G, { cat: 'rapor', t: 'Haftalık Teknik Rapor', sig: rep.sig, b: rep.text + ' — ' + imza + cfoEk });
  }

  // ── Vaat ara-ilerleme (v4.1-5): pencere kapanışında kontrol ──
  if (wk === 17) checkMilestones(G, { seasonEnd: false });

  // ═══ YAŞAYAN KOLTUK yönetmen halkası ═══
  const tension = tensionScore(G, { isDerby, oppRank: (standings(G.league).find((t) => t.id === oppId) || {}).rank || 9 });
  G.lastTension = tension;
  // Y8: vaat şeridi risk uyarısı — durum kötüleşince ilgili staff yazar
  promiseRiskWatch(G);
  // Y8: pencere kapanış GM özeti
  if (TUNING.TRANSFER.WINDOWS.some((s) => wk === s + TUNING.APPROVAL.WINDOW_SPAN - 1)) {
    const st = G.windowStats || { dosya: 0, onay: 0, red: 0, pazarlik: 0 };
    pushInbox(G, { cat: 'transfer', t: `${G.gm.name} (GM): Pencere kapanış özeti`, b: `Bu pencere ${st.dosya} dosya getirdim: ${st.onay} imza, ${st.red} ret, ${st.pazarlik} pazarlık. ${st.onay === 0 ? 'Eli boş kapattık — direktif mi dar, ben mi bulamadım?' : 'Fena bir pencere değildi.'}` });
    G.windowStats = { dosya: 0, onay: 0, red: 0, pazarlik: 0 };
  }
  // Y2: yönetmen telefonu (sezonda 6-10; gerçek state'ten doğar)
  maybePhone(G, tension);
  // Y1: sıkıcı hafta yasağı — son 2 tick interaktif an yoksa state'ten an enjekte et
  if (!G.phone) {
    const hadAction = G.inbox.some((m) => m.action && !m.resolved);
    if (hadAction || G.phone) G.lastInteractive = G.globalWeek;
    else {
      const inject = boringGuard(G);
      if (inject) { injectMoment(G, inject); G.lastInteractive = G.globalWeek; }
    }
  } else G.lastInteractive = G.globalWeek;
  // Y6: masa dokunuşu kartı (opsiyonel tek-tık; üst üste aynı gelmez)
  G.deskCard = pickDeskCard(G);
  G.deskUsedThisTick = false;

  // B4c-AİLE: açıklar CEBİNDEN — kulüp BORÇLANAMAZ (her borç anında servetten kapanır) + negatif kasa servetten
  if (G.mode === 'aile' && G.economy.borc > 0) { G.servet = (G.servet ?? TUNING.MEGA.MOD.AILE_SERVET) - G.economy.borc; G.economy.borc = 0; }
  if (G.mode === 'aile' && (G.servet ?? 100) <= 0 && G.phase !== 'CAREER_END') {
    pushInbox(G, { cat: 'manset', t: 'AİLE SERVETİ TÜKENDİ — İFLAS', sig: 'aile-iflas', b: 'Aile meclisi son çeki de imzaladı; cepte kuruş kalmadı. Kulüp kayyuma, koltuk tarihe.', noQueue: true });
    endCareer(G, 'aile serveti tükendi — iflas');
  }
  if (G.mode === 'aile' && G.economy.kasa < 0) {
    G.servet = (G.servet ?? TUNING.MEGA.MOD.AILE_SERVET) + G.economy.kasa;
    G.economy.kasa = 0;
    if (G.servet <= 0) {
      pushInbox(G, { cat: 'manset', t: 'AİLE SERVETİ TÜKENDİ — İFLAS', sig: 'aile-iflas', b: 'Aile meclisi son çeki de imzaladı; kasada ve cepte kuruş kalmadı. Kulüp kayyuma, koltuk tarihe.', noQueue: true });
      endCareer(G, 'aile serveti tükendi — iflas');
    }
  }
  // B4d: başarım kancası (tick) — aci bayrakları + kontrol
  if (G.economy.kasa < 0 || (G.mode === 'aile' && (G.servet ?? 100) < 30)) G.aciKasaDip = true;
  if (wk === G.SEASON_WEEKS - 1) G.wk33Pos = G.myPos;
  for (const d of checkAchievements(G)) {
    pushInbox(G, { cat: 'manset', t: `🏅 BAŞARIM: ${d.name}`, sig: 'ach-' + d.id, b: `${d.category} kategorisinde yeni rozet${G.mode === 'ironman' ? ' (IRONMAN — hardcore varyant)' : ''}. Profil vitrinine işlendi.`, noQueue: true });
    G.achToast = d.name;
  }
  G.meta.week++;
  eventBus.emit('TICK_END', { week: wk, res: myRes });
  return { ok: true };
}

// ── Telkin yardımcıları (v4.1-2) ──
function applyTelkin(G, oppId, wk) {
  const none = { power: 1, goalsMult: 1, type: null };
  if (!G.telkin) return none;
  const t = G.telkin, TK = TUNING.TELKIN;
  const xi = idealXI(G.squad);
  const avgFit = xi.length ? xi.reduce((s, p) => s + p.fitness, 0) / xi.length : 100;
  const oppStr = G.league.table[oppId].strength;
  // "Mantıksız" telkin: bariz duruma aykırı istek — otoriter TD reddedebilir
  const mantiksiz = (t === 'rotasyon' && avgFit > 85) || (t === 'tamkadro' && avgFit < 65)
    || (t === 'gencler' && (G.myPos || 10) >= 15) || (t === 'kale' && G.temelGuc - oppStr >= 10);
  if (mantiksiz && G.coach.otorite >= TK.REJECT_OTORITE && rand(0, 1) < TK.REJECT_CHANCE) {
    G.tdRelation = clamp((G.tdRelation ?? 70) + TK.REJECT_REL, 0, 100);
    G.lastTelkinReplied = null; // reddedildi → tekrar kabulde yeni cevap gelsin
    pushInbox(G, { cat: 'td', t: 'TD telkini geri çevirdi', b: `${G.coach.name} bu haftaki isteğinizi saha gerçekleriyle bağdaştıramadı. (İlişki hafif gerildi.)` });
    return none;
  }
  // Kabul: TD cevabı (yalnız telkin DEĞİŞTİĞİNDE — spam yok) + sayaçlar + yan etkiler
  if (G.lastTelkinReplied !== t) {
    G.lastTelkinReplied = t;
    pushInbox(G, { cat: 'td', t: `${G.coach.name}: telkin kabul`, b: telkinKabulSozu(t) });
  }
  G.telkinSeasonCount = (G.telkinSeasonCount || 0) + 1;
  karneKaydet(G, t); // K5: kabul edilen telkin karneye işlenir
  G.telkinWeeks = G.telkinWeeks || []; G.telkinWeeks.push(wk);
  const recent = G.telkinWeeks.filter((w) => wk - w < TK.SPAM_WINDOW).length;
  if (recent >= TK.SPAM_COUNT) {
    G.taktik.uyumHafta = Math.max(0, G.taktik.uyumHafta - TK.SPAM_UYUM); // kadroya karışma uyumu törpüler
    if (rand(0, 1) < TK.SPAM_LEAK_P) {
      G.mediaTone = (G.mediaTone || 0) - 1;
      G.leakCount = (G.leakCount || 0) + 1; // analitik izi (inbox 30 mesajla sınırlı)
      pushInbox(G, { cat: 'medya', t: 'Sızıntı: "Başkan kadroya karışıyor"', b: 'Soyunma odasından basına taşan telkinler manşette. Medya tonu sertleşti.' });
    }
  }
  if (G.coach.otorite < TK.KUKLA_OTORITE && G.telkinSeasonCount > TK.KUKLA_COUNT) {
    G.gauges.itibar = clamp(G.gauges.itibar - TK.KUKLA_ITIBAR, 0, 100); // "kukla hoca" algısı
    if (!G.kuklaWarned) { G.kuklaWarned = true; pushInbox(G, { cat: 'medya', t: '"Kukla hoca" tartışması', b: 'Kamuoyu teknik kararların makam odasından çıktığını konuşuyor; itibar yavaş yavaş kemiriliyor.' }); }
  }
  const fx = { tamkadro: { power: TK.TAMKADRO.power, goalsMult: 1 }, rotasyon: { power: TK.ROTASYON.power, goalsMult: 1 },
    gencler: { power: TK.GENCLER.power, goalsMult: 1 }, kale: { power: TK.KALE.power, goalsMult: TK.KALE.goalsMult } }[t];
  return { ...(fx || none), type: t };
}

function postTelkin(G, telkinFx) {
  const TK = TUNING.TELKIN;
  if (telkinFx.type === 'tamkadro') {
    const xi = idealXI(G.squad);
    for (const p of xi) p.fitness = clamp(p.fitness - TK.TAMKADRO.fitCost, 0, 100); // ekstra yıpranma
    if (xi.length && rand(0, 1) < TK.TAMKADRO.injChance) {
      const v = xi[Math.floor(rand(0, 1) * xi.length)];
      v.injuryWeeks = Math.max(v.injuryWeeks, randint(TK.TAMKADRO.injWeeks[0], TK.TAMKADRO.injWeeks[1]));
      pushInbox(G, { cat: 'saglik', t: 'Zorlama faturası: sakatlık', b: `${v.name || 'Bir oyuncu'} tam kadro baskısının bedelini ödedi.` });
    }
  } else if (telkinFx.type === 'rotasyon') {
    G.rotRecover = TK.ROTASYON.recoverWeeks; // sonraki 2 hafta kondisyon toparlar
  } else if (telkinFx.type === 'gencler') {
    // Genç gelişimi ×2: genç oyunculara anında gelişim şansı + akademi vaatleri ilerler
    const youths = G.squad.filter((p) => p.age <= TK.GENCLER.ageMax && p.overall < p.potential).slice(0, TK.GENCLER.devCount);
    for (const y of youths) if (rand(0, 1) < TK.GENCLER.devChance) { y.overall += 1; y.refreshValue?.(); }
    for (const pr of G.promises || []) if ((pr.id === 'P05' || pr.id === 'P12') && !pr.milestone) hitMilestone(G, pr, 'Gençlere şans verildi');
  }
}

// ── Prim yardımcıları (v4.1-3) ──
function applyPrimResults(G, myRes, primWinCost) {
  const S = TUNING.PRIM.SERI;
  // Maç primi bedeli maç OYNANINCA ödenir (motivasyon bedeli — galibiyet şartı yok; "kasa ↓" hint'iyle tutarlı)
  if (primWinCost > 0) { G.economy.kasa -= primWinCost; G.primLedger.mac += primWinCost; }
  // Özel prim: tek atış tüketilince ödenir (kazan/kaybet fark etmez — koz oynandı)
  if (G.ozelArmed) { G.economy.kasa -= TUNING.PRIM.OZEL.cost; G.primLedger.ozel += TUNING.PRIM.OZEL.cost; pushInbox(G, { cat: 'mali', t: 'Özel maç primi ödendi', b: 'Büyük koz oynandı; prim kasadan çıktı.' }); }
  if (myRes === 'W') {
    G.winStreak = (G.winStreak || 0) + 1;
    if (G.seriPrim && G.winStreak === S.streak) {
      G.economy.kasa -= S.firstCost; G.primLedger.seri += S.firstCost;
      for (const p of G.squad) { p.morale = clamp(p.morale + S.moraleBoost, 0, 100); p.form = clamp(p.form + S.formBoost, 0, 100); }
      G.seriBoostWeeks = S.nextWeeks;
      pushInbox(G, { cat: 'mali', t: 'Seri primi devrede', b: `${S.streak} maçlık galibiyet serisi! Prim dağıtıldı, momentum tribüne taştı.` });
    } else if (G.seriPrim && G.winStreak > S.streak) {
      G.economy.kasa -= S.nextCost; G.primLedger.seri += S.nextCost;
      for (const p of G.squad) { p.morale = clamp(p.morale + 1, 0, 100); p.form = clamp(p.form + 1, 0, 100); }
      G.seriBoostWeeks = Math.max(G.seriBoostWeeks, 1);
    }
  } else {
    G.winStreak = 0;
  }
  if (G.ozelArmed) { G.ozelArmed = false; G.ozelUsed = true; } // tek maçlık koz tüketildi
  if (G.seriBoostWeeks > 0 && myRes !== 'W') G.seriBoostWeeks--;
}

// ── Eskalasyon büyümesi (v4.2): kademe başına taraftar +%6, sponsor ×1.04, itibar çapası +2 ──
// dir=+1 yükseliş (uygula), dir=−1 iniş (simetrik geri al).
function applyGrowth(G, dir) {
  const R = TUNING.EXPECT.GROWTH;
  const bm = dir > 0 ? (G.buyumeMult || 1) : 1; // B4a: "Şehrin Yeni Takımı" büyüme hızı ×1.5
  G.club.fanCount = Math.round(G.club.fanCount * Math.pow(1 + R.fan * bm, dir));
  G.club.sponsorMult = (G.club.sponsorMult ?? 1) * Math.pow(1 + R.sponsor, dir);
  G.club.reputation = clamp(G.club.reputation + R.itibar * dir, 0, 100);
  pushInbox(G, dir > 0
    ? { cat: 'kongre', t: 'Kulüp büyüyor', b: `Beklenti yükseldi (yeni hedef: ${G.club.hedefSira}. sıra). Taraftar tabanı genişledi, sponsor masası büyüdü, itibar çıtası yükseldi — artık daha büyük bir kulübüz.` }
    : { cat: 'kongre', t: 'Beklenti geriledi', b: `Hedef ${G.club.hedefSira}. sıraya çekildi. Büyüme bonusları geri alındı — kulüp küçülme sancısında.` });
}

// ── Vaat ara-ilerleme (v4.1-5) ──
function hitMilestone(G, pr, note) {
  const M = TUNING.MILESTONE;
  pr.milestone = true;
  // M7: "Kulüp Mirası" (P19) aktifken milestone bonusları ×1.5 (müze canlanması, v3-A8)
  const mult = (G.promises || []).some((x) => x.id === 'P19' && x.kept === null) ? TUNING.MIRAS.MUZE_MILESTONE_MULT : 1;
  G.gauges.taraftar = clamp(G.gauges.taraftar + M.taraftar * mult, 0, 100);
  G.gauges.guven = clamp(G.gauges.guven + M.guven * mult, 0, 100);
  const name = (G.data.promises.find((x) => x.id === pr.id) || {}).name || pr.id;
  pushInbox(G, { cat: 'vaat', t: `Vaat yolunda: ${name}`, b: `${note}. Taraftar somut adımı gördü — güven tazelendi.` });
}

function milestoneProgress(pr, G) {
  const b = pr.baselineSnapshot || {};
  switch (pr.id) {
    case 'P01': return G.history.seasons.some((s) => s.pos <= 3) && 'Zirve yarışına ortak olundu';
    case 'P02': return G.economy.borc <= (b.borc || 0) * 0.75 && 'Borç dörtte bir eridi';
    case 'P03': return G.facilities.stadyum >= (b.stadyum || 0) + 1 && 'Stadyumda temel atıldı';
    case 'P04': return G.club.kadroDeger >= (b.kadroDeger || 0) * 1.125 && 'Kadro değeri gözle görülür büyüdü';
    case 'P06': return G.facilities.antrenman >= (b.antrenman || 0) + 1 && 'Antrenman merkezinde ilk etap bitti';
    case 'P08': return G.facilities.tibbi >= (b.tibbi || 0) + 1 && 'Tıbbi ekipte ilk takviye yapıldı';
    case 'P13': return G.facilities.scout >= 3 && 'İzci ağı genişledi';
    case 'P15': return G.term.income > 0 && (G.term.wage / G.term.income) <= 0.55 && 'Maaş dengesi rayında';
    case 'P21': return G.term.starBought && 'Yıldız transferi tamamlandı';
    case 'P19': return (G.museum || []).length >= 2 && 'Müze canlandı — vitrindeki her kart bir hatıra';
    case 'P22': return teknikEkip(G.coach) >= 75 && 'Yıldız teknik direktör görevde';
    case 'P23': return G.history.seasons.length > 0 && G.history.seasons.every((s) => s.pos < TUNING.LEAGUE.RELEGATION_FROM) && 'Küme hattından uzak duruldu';
    case 'P24': return (G.term.maxTicket ?? 1) <= 1.0 && G.history.seasons.length > 0 && 'Kombine sözü tutuluyor';
    default: return false;
  }
}

export function checkMilestones(G, { seasonEnd = false } = {}) {
  const M = TUNING.MILESTONE;
  for (const pr of G.promises || []) {
    if (pr.kept !== null) continue;
    if (!pr.milestone) {
      const note = milestoneProgress(pr, G);
      if (note) { hitMilestone(G, pr, note); continue; }
      if (seasonEnd && pr.unrestSeason !== G.meta.season) {
        pr.unrestSeason = G.meta.season;
        G.gauges.taraftar = clamp(G.gauges.taraftar + M.unrestTaraftar, 0, 100);
        G.gauges.guven = clamp(G.gauges.guven + M.unrestGuven, 0, 100);
        const name = (G.data.promises.find((x) => x.id === pr.id) || {}).name || pr.id;
        pushInbox(G, { cat: 'vaat', t: `Huzursuzluk: ${name}`, b: 'Bir sezon geçti, vaat yolunda somut adım görünmedi. Tribün sormaya başladı.' });
      }
    }
  }
}

// ── Kaldıraçlar ──
export function setTicketPrice(G, price) {
  G.economy.ticketPrice = clamp(price, 0.5, 2.0);
  if (G.term) G.term.maxTicket = Math.max(G.term.maxTicket ?? 0, G.economy.ticketPrice); // P24 izi
}
export function payDebtAmount(G, amount) { const p = payDebt(G, amount); pushInbox(G, { cat: 'mali', t: 'Borç ödemesi', b: `${fmt1(p)}mn borç kapatıldı.` }); }
export function restructureDebt(G) {
  if (G.economy.borc <= 0) return;
  // SPAM KORUMASI: bankalar aynı sezon İKİNCİ kez masaya oturmaz; faiz tabandaysa anlamı yok
  if (G.yapilandirmaSezon === G.meta.season) {
    pushInbox(G, { cat: 'mali', t: 'Bankalar masaya oturmadı', b: 'Bu sezon zaten yapılandırdın — "Aynı yıl ikinci kez olmaz Başkanım." Gelecek sezon tekrar dene.', noQueue: true });
    return;
  }
  if (G.economy.faizOrani <= 0.15 + 1e-9) {
    pushInbox(G, { cat: 'mali', t: 'Yapılandırmanın anlamı yok', b: 'Faiz zaten taban seviyede (%15) — yapılandırma sadece anaparayı şişirir. CFO: "Yapmayın Başkanım."', noQueue: true });
    return;
  }
  // A1: CFO pazarlığı — yetkin CFO (+eski bankacı trait) faizi daha çok kırar
  const cfo = G.staff?.cfo;
  let indirim = 0.04;
  if (cfo && cfo.skill >= TUNING.STAFF.CFO_RESTRUCT_SKILL) indirim += TUNING.STAFF.CFO_RESTRUCT_BONUS;
  if (cfo && cfo.trait === 'bankaci') indirim += TUNING.STAFF.BANKACI_BONUS;
  G.economy.faizOrani = Math.max(0.15, G.economy.faizOrani - indirim);
  G.economy.borc *= 1.05;
  G.yapilandirmaSezon = G.meta.season;
  pushInbox(G, { cat: 'mali', t: 'Borç yapılandırıldı', b: `Faiz düşürüldü (%${Math.round(G.economy.faizOrani * 100)})${cfo ? ` — ${cfo.name} masada ter döktü` : ''}, anapara %5 arttı. Bu sezonluk hak bu kadar.` });
}
// İSTEĞE BAĞLI KREDİ: kasaya nakit girer, borç artar (mevcut faizle — otomatik borçlanma cezası YOK).
// Aile modunda kulüp borçlanamaz. Toplam borç tavanı aşılamaz.
export function takeLoan(G, amount, { faizIndirim = 0, kaynak = '' } = {}) {
  amount = Math.round(Number(amount) || 0);
  if (amount <= 0) return false;
  if (G.mode === 'aile') { pushInbox(G, { cat: 'mali', t: 'Kredi reddedildi', b: 'Aile Kulübü modunda kulüp borçlanamaz — açıklar cebinden kapanır.' }); return false; }
  const CAP = 400; // toplam borç tavanı (mn)
  if (G.economy.borc + amount > CAP) { pushInbox(G, { cat: 'mali', t: 'Kredi reddedildi', b: `Bankalar daha fazla borca "dur" dedi (borç tavanı ${CAP}mn).` }); return false; }
  G.economy.kasa += amount;
  G.economy.borc += amount;
  // Banka teklifi düşük faizli gelebilir: kabul edilirse global faizi de aşağı çeker (yapılandırma etkisi)
  if (faizIndirim > 0) G.economy.faizOrani = Math.max(0.12, G.economy.faizOrani - faizIndirim);
  pushInbox(G, { cat: 'mali', t: 'Kredi çekildi', b: `${fmt1(amount)}mn kasaya girdi${kaynak ? ` (${kaynak})` : ''}. Borç ${fmt1(G.economy.borc)}mn, faiz %${Math.round(G.economy.faizOrani * 100)} — faturası her hafta işler.` });
  return true;
}
// ── SPONSOR PAZARI (forma göğüs / stadyum ismi / forma kol) — CANLI PİYASA ──
// Teklifler PROSEDÜREL (sponsorGen): her kariyerde farklı marka + bedel. Reddedebilirsin;
// süresi dolan teklif çekilir, yeni markalar haftalarca kapıyı çalar (sponsorMarketTick).
// Fesih AĞIR: ceza peşinatı aşar → imzala-boz para hilesi imkânsız.
const SPONSOR_SLOT_TR = { gogus: 'Forma Göğüs', naming: 'Stadyum İsmi', kol: 'Forma Kol' };
const SPONSOR_CAP = { gogus: 3, naming: 2, kol: 2 };

function spUret(G, slot, forceType = null) {
  G._spSeq = (G._spSeq || 0) + 1;
  G._spAdlar = G._spAdlar || [];
  const o = generateSponsorOffer({
    clubName: G.club?.name || 'kulup', week: G.meta?.week || 0, seq: G._spSeq,
    weeklyBase: sponsorSlotWeekly(G, slot), usedNames: G._spAdlar,
  }, slot, forceType);
  G._spAdlar.push(o.name);
  return o;
}
// Pazarı kur (kariyer başı): garanti kompozisyon — güvenli + fintech + EN AZ BİR riskli seçenek
export function initSponsorMarket(G) {
  G.sponsorPazari = { gogus: [], naming: [], kol: [] };
  G._spSeq = 0; G._spAdlar = []; G._spSonGelis = 0;
  const riskli = ((G.club?.name || '').length % 2) ? 'kripto' : 'bahis';
  G.sponsorPazari.gogus = [spUret(G, 'gogus', 'standart'), spUret(G, 'gogus', 'fintech'), spUret(G, 'gogus', riskli)];
  G.sponsorPazari.kol = [spUret(G, 'kol', 'yerel'), spUret(G, 'kol', 'standart')];
  G.sponsorPazari.naming = [spUret(G, 'naming', 'naming'), spUret(G, 'naming', 'naming')];
}
export function sponsorOffers(G, slot) {
  if (!G.sponsorPazari) initSponsorMarket(G);
  return G.sponsorPazari[slot] || [];
}
// Teklifi REDDET — kapıyı göster; piyasaya haber gider, yeni markalar sonraki haftalarda gelir
export function rejectSponsorOffer(G, slot, offerId) {
  if (!G.sponsorPazari) initSponsorMarket(G);
  const pool = G.sponsorPazari[slot] || [];
  const i = pool.findIndex((o) => o.id === offerId);
  if (i < 0) return false;
  const [o] = pool.splice(i, 1);
  pushInbox(G, { cat: 'mali', t: `Teklif reddedildi: ${o.name}`, b: `${SPONSOR_SLOT_TR[slot]} teklifine kapıyı gösterdin. Piyasaya haber saldık — yeni markalar önümüzdeki haftalarda kapıyı çalar.`, noQueue: true });
  return true;
}
// Haftalık pazar nabzı: bekleyen teklifler eskir (süre dolunca çekilir), boş masaya yeni marka gelir.
// TAMAMEN DETERMİNİSTİK (hash) — ana RNG'yi tüketmez, seed'li testler/kayıtlar kaymaz.
export function sponsorMarketTick(G) {
  if (!G.sponsorPazari) initSponsorMarket(G);
  const wk = G.meta?.week || 0;
  for (const slot of ['gogus', 'naming', 'kol']) {
    const pool = G.sponsorPazari[slot];
    for (let i = pool.length - 1; i >= 0; i--) {
      pool[i].kalanHafta -= 1;
      if (pool[i].kalanHafta <= 0) {
        const cekilen = pool.splice(i, 1)[0];
        pushInbox(G, { cat: 'mali', t: `Teklif geri çekildi: ${cekilen.name}`, b: `${SPONSOR_SLOT_TR[slot]} masasında bekleyen teklif süresini doldurdu — marka başka kulüple anlaştı. Beklemek de bir karardır.`, noQueue: true });
      }
    }
  }
  // Haftada EN FAZLA 1 yeni teklif (inbox gürültüsü olmasın); 3 haftadır gelmediyse garanti gelir
  const needy = ['gogus', 'naming', 'kol'].filter((s) => !(G.sponsorDeals && G.sponsorDeals[s]) && G.sponsorPazari[s].length < SPONSOR_CAP[s]);
  if (!needy.length) return;
  const slot = needy[wk % needy.length];
  let h = (Math.imul(wk + 3, 2654435761) + Math.imul((G._spSeq || 0) + 7, 97)) >>> 0;
  h = (Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0;
  const zorunlu = wk - (G._spSonGelis || 0) >= 3;
  if ((h % 100) < 50 || zorunlu) {
    const o = spUret(G, slot);
    G.sponsorPazari[slot].push(o);
    G._spSonGelis = wk;
    pushInbox(G, { cat: 'mali', t: `Yeni sponsor teklifi: ${o.name}`, b: `${SPONSOR_SLOT_TR[slot]} için masada yeni dosya — peşinat ${fmt1(o.pesinat)}mn · haftalık ${fmt1(o.weekly)}mn · ${o.years} yıl.${o.dezavantaj ? ' Dezavantaj: ' + o.dezavantaj + '.' : ''} Finans ekranında bekliyor.`, noQueue: true });
  }
}
export function signSponsor(G, slot, offerId) {
  if (!SPONSOR_SLOT_TR[slot]) return false;
  if (!G.sponsorPazari) initSponsorMarket(G);
  const o = (G.sponsorPazari[slot] || []).find((x) => x.id === offerId);
  if (!o) return false;
  if (slot === 'naming' && G.facilities.stadyum < TUNING.ECONOMY.NAMING_MIN_STAD) {
    pushInbox(G, { cat: 'mali', t: 'Naming anlaşması olmadı', b: `Stadın adını satmak için stadyum en az ${TUNING.ECONOMY.NAMING_MIN_STAD}. kademede olmalı — önce stadı büyüt.` });
    return false;
  }
  G.sponsorDeals = G.sponsorDeals || { gogus: null, naming: null, kol: null };
  if (G.sponsorDeals[slot]) { pushInbox(G, { cat: 'mali', t: 'Slot dolu', b: `${SPONSOR_SLOT_TR[slot]} slotunda anlaşma var. Yeni marka için önce feshet (ağır bedeli var).`, noQueue: true }); return false; }
  G.sponsorDeals[slot] = { id: o.id, name: o.name, sector: o.sektor, type: o.type, incomeMult: o.incomeMult, weekly: o.weekly, annual: o.annual, pesinat: o.pesinat, fesihCeza: o.fesihCeza, years: o.years, remainingSeasons: o.years, riskProfile: o.riskProfile || null };
  G.economy.kasa += o.pesinat;
  G.sponsorPazari[slot] = []; // imza atıldı — masadaki diğer adaylar dosyalarını toplar
  const rp = o.riskProfile; let ek = '';
  if (rp) {
    if (rp.taraftar) { G.gauges.taraftar = clamp((G.gauges.taraftar ?? 50) + rp.taraftar, 0, 100); ek += ` Taraftar ${rp.taraftar > 0 ? '+' : ''}${rp.taraftar}.`; }
    if (rp.gencTaban) { G.gauges.taraftar = clamp((G.gauges.taraftar ?? 50) + rp.gencTaban, 0, 100); ek += ` Genç taban +${rp.gencTaban}.`; }
    if (rp.itibar) { G.club.reputation = clamp((G.club.reputation ?? 50) + rp.itibar, 0, 100); ek += ` İtibar ${rp.itibar > 0 ? '+' : ''}${rp.itibar}.`; }
  }
  pushInbox(G, { cat: 'mali', t: `Sponsor imzalandı: ${o.name}`, b: `${SPONSOR_SLOT_TR[slot]} · ${o.years} yıl. Peşinat ${fmt1(o.pesinat)}mn kasaya, haftalık ${fmt1(o.weekly)}mn gelir. Erken fesih cezası ${fmt1(o.fesihCeza)}mn.${ek}${o.note ? ' — ' + o.note : ''}` });
  return true;
}
export function cancelSponsor(G, slot) {
  if (!G.sponsorDeals || !G.sponsorDeals[slot]) return false;
  const b = G.sponsorDeals[slot];
  const ceza = b.fesihCeza != null ? b.fesihCeza : Math.round((b.pesinat || 0) + (b.annual || 0) * 0.25);
  if (G.economy.kasa >= ceza) G.economy.kasa -= ceza; else { G.economy.borc += ceza - G.economy.kasa; G.economy.kasa = 0; } // yetmezse borç
  G.club.reputation = clamp((G.club.reputation ?? 50) - 3, 0, 100); // sözünde durmadın
  G.sponsorDeals[slot] = null;
  if (G.sponsorPazari) G.sponsorPazari[slot] = [spUret(G, slot)]; // piyasa boş kalmaz — hemen bir aday masaya oturur
  pushInbox(G, { cat: 'mali', t: `Sponsor feshedildi: ${b.name}`, b: `${SPONSOR_SLOT_TR[slot]} sözleşmesi erken bozuldu — fesih cezası ${fmt1(ceza)}mn ödendi, itibar −3. Marka bir daha kolay masaya oturmaz.` });
  return true;
}
// Sezon sonu: sponsor sözleşme süreleri bir azalır; biten anlaşma slotu boşaltır (yenile ya da yeni marka bul).
export function tickSponsors(G) {
  if (!G.sponsorDeals) return;
  for (const slot of ['gogus', 'naming', 'kol']) {
    const d = G.sponsorDeals[slot];
    if (!d || d.remainingSeasons == null) continue;
    // BATMA RİSKİ (kripto vb.): sezon sonunda zar — batarsa gelir kesilir, manşet patlar, itibar yara alır
    if (d.riskProfile && d.riskProfile.batmaChance) {
      let bh = 0; const seedStr = (G.club?.name || '') + '|' + (G.meta?.season || 0) + '|' + d.id;
      for (let i = 0; i < seedStr.length; i++) bh = (bh * 31 + seedStr.charCodeAt(i)) >>> 0;
      if ((bh % 100) < Math.round(d.riskProfile.batmaChance * 100)) {
        G.sponsorDeals[slot] = null;
        G.club.reputation = clamp((G.club.reputation ?? 50) - 2, 0, 100);
        if (G.sponsorPazari) G.sponsorPazari[slot] = [spUret(G, slot)];
        pushInbox(G, { cat: 'manset', t: `SPONSOR BATTI: ${d.name}`, b: `${SPONSOR_SLOT_TR[slot]} sponsorumuz iflas etti — haftalık ${fmt1(d.weekly)}mn gelir bir gecede kesildi, formadaki logo karartıldı. Muhalif basın "Bu riski görmediler mi?" diye soruyor (itibar −2). Parlak para, acı fatura.` });
        continue;
      }
    }
    d.remainingSeasons -= 1;
    if (d.remainingSeasons <= 0) {
      G.sponsorDeals[slot] = null;
      if (G.sponsorPazari) G.sponsorPazari[slot] = [spUret(G, slot), spUret(G, slot)]; // sözleşme bitti → piyasa yeni sezona iki adayla girer
      pushInbox(G, { cat: 'mali', t: `Sponsor sözleşmesi bitti: ${d.name}`, b: `${SPONSOR_SLOT_TR[slot]} anlaşması süresini (${d.years} yıl) doldurdu, slot boşaldı. Fesih cezası YOK — masada yeni adaylar var.`, noQueue: true });
    }
  }
}

// ── OYUN-İÇİ VAAT: sezon ortasında yeni söz ver (kongrede el güçlenir; tutulmazsa dönem sonu yaptırım) ──
const MID_PROMISE_CAP = 2; // dönem başına en fazla 2 yeni söz
export function midPromiseOptions(G) {
  const aktif = new Set((G.promises || []).filter((pr) => pr.kept === null).map((pr) => pr.id));
  return (G.data.promises || []).filter((p) => !aktif.has(p.id) && isSelectable(G, p.id));
}
export function midPromiseCount(G) { return (G.promises || []).filter((pr) => pr.midTerm && pr.kept === null).length; }
export function makeMidPromise(G, id) {
  if (G.phase !== 'SEASON_LOOP') return false; // sadece sezon aktifken
  if (midPromiseCount(G) >= MID_PROMISE_CAP) { pushInbox(G, { cat: 'kongre', t: 'Söz verilemedi', b: `Bu dönem çok yeni söz verdin (${MID_PROMISE_CAP}/${MID_PROMISE_CAP}). Kurul "önce bunları tut" diyor.`, noQueue: true }); return false; }
  const before = G.gauges.taraftar;
  if (!addMidPromise(G, id, G.data.promises)) { pushInbox(G, { cat: 'kongre', t: 'Söz verilemedi', b: 'Bu söz şu an verilemez (zaten aktif ya da şartlar uygun değil).', noQueue: true }); return false; }
  const p = G.data.promises.find((x) => x.id === id);
  const bump = Math.round(G.gauges.taraftar - before);
  pushInbox(G, { cat: 'kongre', t: `Kürsüde yeni söz: ${p.name}`, b: `Kongreye söz verdin. Tribün coştu (taraftar +${bump}), sandıktaki elin güçlendi. Ama tutmazsan dönem sonunda hesabı ağır olur — sicilinde leke, rakibe koz.` });
  return true;
}
// Banka düşük faizli kredi teklifini çöz (inbox olayı: kabul → kredi + faiz indirimi; red → temiz kal)
export function resolveBankLoan(G, msgId, choice) {
  const m = G.inbox.find((x) => x.id === msgId);
  if (!m || m.resolved) return;
  m.resolved = true;
  if (choice === 'kabul' && m.loan) {
    takeLoan(G, m.loan.amount, { faizIndirim: m.loan.faizIndirim, kaynak: 'banka teklifi' });
  } else {
    pushInbox(G, { cat: 'mali', t: 'Banka teklifi geri çevrildi', b: 'Krediyi almadın — kasa dursun, borç büyümesin.', noQueue: true });
  }
}
export function resolveTicket(G, msgId, price) {
  const m = G.inbox.find((x) => x.id === msgId);
  if (m) m.resolved = true;
  setTicketPrice(G, price);
  pushInbox(G, { cat: 'mali', t: 'Bilet fiyatı güncellendi', b: `Yeni fiyat çarpanı: ${price.toFixed(1)}×.` });
}

// ── Telkin & prim aksiyonları (v4.1-2/3) — haftalık standing tercihler ──
export function setTelkin(G, type) { G.telkin = type || null; }
export function setMatchPrim(G, level) { G.matchPrim = ['yok', 'normal', 'yuksek'].includes(level) ? level : 'yok'; }
export function toggleSeriPrim(G, on) { G.seriPrim = on ?? !G.seriPrim; }
// Kritik hafta mı? (§5: özel prim yalnız derbi/kritik maçta) — sıra komşusu rakip,
// ezeli rakip (en güçlü hasım) veya sezon finali haftaları.
export function isCriticalWeek(G) {
  if (G.meta.week >= TUNING.CRITICAL.LATE_WEEK) return true;
  if (!G.league || G.meta.week > G.SEASON_WEEKS) return false;
  const round = G.league.fixtures[G.meta.week - 1];
  const my = round.find((m) => m.home === MY || m.away === MY);
  if (!my) return false;
  const oppId = my.home === MY ? my.away : my.home;
  if (oppId === 'o0') return true; // ezeli rakip (derbi)
  const table = standings(G.league);
  const meR = table.find((t) => t.id === MY).rank, opR = table.find((t) => t.id === oppId).rank;
  return Math.abs(meR - opR) <= TUNING.CRITICAL.RANK_DIFF;
}

export function armOzelPrim(G) {
  if (G.ozelUsed || G.ozelArmed) return { ok: false };
  if (!isCriticalWeek(G)) return { ok: false, why: 'Kritik maç değil — derbiye sakla' };
  G.ozelArmed = true;
  pushInbox(G, { cat: 'mali', t: 'Özel maç primi ilan edildi', b: 'Kritik maç için kadroya büyük koz kondu.' });
  return { ok: true };
}
export function declareSeasonPrim(G) {
  if (G.sezonHedefDeclared || G.meta.week > 2) return { ok: false }; // sezon başında ilan
  G.sezonHedefDeclared = true;
  pushInbox(G, { cat: 'mali', t: 'Sezon hedef primi ilan edildi', b: `Hedef: ${G.club.hedefSira}. sıra ve üstü. Kadroya sezon boyu moral tabanı sözü verildi.` });
  return { ok: true };
}

// ── Transfer (Bible-11) — sadece pencere açıkken ──
export function buyTarget(G, id) {
  if (!G.transferWindow || !G.market) return { ok: false, why: 'Pencere kapalı' };
  const p = G.market.find((x) => x.id === id);
  if (!p) return { ok: false };
  const fee = p.fee ?? transferFee(p);
  if (!canBuy(G, fee)) return { ok: false, why: 'Peşinat yetersiz / transfer tahtası' };
  // Finansman: kasa yeterse nakit; değilse kalan borca eklenir (borçla transfer — mali bedelli).
  if (G.economy.kasa >= fee) G.economy.kasa -= fee;
  else { G.economy.borc += fee - G.economy.kasa; G.economy.kasa = 0; }
  G.market = G.market.filter((x) => x !== p);
  p.id = 'sq' + (G._pid = (G._pid || 1000) + 1);
  G.squad.push(p);
  G.kimya.kimya = clamp(G.kimya.kimya + TUNING.KIMYA_TRANSFER, 0, 100); // kimya −4
  if (p.overall >= TUNING.STAR_THRESHOLD && G.term) G.term.starBought = true; // P21 izi
  G.club.kadroDeger = squadMarketValue(G.squad);
  G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
  pushInbox(G, { cat: 'transfer', t: 'Transfer: ' + p.name, b: `${p.pos} ${p.overall} güç · ${fmt1(fee)}mn. Kimya sarsıldı.` });
  return { ok: true };
}
export function sellPlayer(G, id) {
  if (!G.transferWindow) return { ok: false, why: 'Pencere kapalı' };
  const p = G.squad.find((x) => x.id === id);
  if (!p) return { ok: false };
  const offer = saleOffer(p);
  G.squad = G.squad.filter((x) => x !== p);
  G.economy.kasa += offer;
  if (p.isStar) G.gauges.taraftar = clamp(G.gauges.taraftar - 4, 0, 100); // yıldız satışı taraftar−
  G.club.kadroDeger = squadMarketValue(G.squad);
  G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
  pushInbox(G, { cat: 'transfer', t: 'Satış: ' + p.name, b: `+${fmt1(offer)}mn kasaya.` });
  return { ok: true, offer };
}

// ═══════════ TRANSFER ONAY AKIŞI (Başkanlık Hissi §1) ═══════════
// Oyuncu transfer YAPMAZ, ONAYLAR: GM pencere boyunca dosya getirir.

// GM'in haftalık işi: geciken pazarlık dönüşü + yeni onay dosyası + satış teklifi.
function gmTick(G, wk) {
  if (!G.transferWindow) return;
  // Geciken şartlı pazarlık dönüşü ("tur uzadı")
  if (G.delayedFile) {
    const f = G.delayedFile; G.delayedFile = null;
    pushInbox(G, { cat: 'transfer', t: `${G.gm.name} (GM): Pazarlık dönüşü — ${f.player.name}`, b: `Karşı taraf masaya döndü. Bedel: ${fmt1(f.fee)}mn. ${f.gerekce}`, action: 'tfile', file: f });
  }
  const hasActive = G.inbox.some((m) => (m.action === 'tfile' || m.action === 'sfile') && !m.resolved);
  if (hasActive) return; // GM aynı anda tek dosya yürütür
  const AP = TUNING.APPROVAL;
  const budgetLeft = (G.directive?.budget ?? 0) * boardBudgetMult(G) * (G.mandat?.esnek ?? 1) - (G.termSpent || 0); // B1a kurul ±%15 · mandat ±%6
  // Satış aynası: gelen teklif dosyası
  if (rand(0, 1) < AP.SALE_CHANCE) {
    const cands = G.squad.filter((p) => p.overall >= 55).sort((a, b) => b.marketValue - a.marketValue).slice(0, 8);
    if (cands.length) {
      const p = cands[Math.floor(rand(0, 1) * cands.length)];
      const offer = saleOffer(p);
      const alici = (G.data.teams || [])[randint(0, Math.min(5, (G.data.teams || []).length - 1))]?.name || 'Bir kulüp';
      pushInbox(G, { cat: 'transfer', t: `Satış teklifi: ${p.name}`, b: `${alici} ${fmt1(offer)}mn veriyor. ${p.isStar ? 'Yıldızımız — tribün satışı affetmez.' : 'GM notu: kabul edilebilir bir rakam.'} Satalım mı?`, action: 'sfile', file: { playerId: p.id, offer } });
      return;
    }
  }
  // Onay dosyası: direktife (ve P21 vaadine) göre aday
  if (budgetLeft <= 5 || rand(0, 1) > AP.FILE_CHANCE) return;
  const file = gmMakeFile(G, budgetLeft);
  if (!file) return;
  pushInbox(G, { cat: 'transfer', t: `${G.gm.name} (GM): Onay dosyası — ${file.player.name}`, b: `${file.gerekce} Bedel ${fmt1(file.fee)}mn · maaş ${fmt1(file.player.wage)}mn/sezon · görünen güç ${file.range[0]}-${file.range[1]}.`, action: 'tfile', file });
}

// Direktif + zayıf hat + GM skill → aday dosyası üret.
function gmMakeFile(G, budgetLeft) {
  const line = G.directive?.line || 'hazir';
  const base = Math.round(G.temelGuc);
  const wantStar = line === 'yildiz' || (G.promises || []).some((p) => p.id === 'P21' && p.kept === null && !G.term.starBought);
  const need = { GK: 1, DEF: 4, MID: 4, FWD: 2 }, la = {};
  for (const pos of ['GK', 'DEF', 'MID', 'FWD']) {
    const b = G.squad.filter((x) => x.pos === pos).sort((a, c) => c.overall - a.overall).slice(0, need[pos]);
    la[pos] = b.length ? b.reduce((s, x) => s + x.overall, 0) / b.length : 0;
  }
  const weakest = Object.entries(la).sort((a, b) => a[1] - b[1])[0][0];
  // Y8: bağlam satırı — o mevkideki en iyimizle kıyas (aralıklı, yaşıyla)
  const enIyi = G.squad.filter((x) => x.pos === weakest).sort((a, b) => b.overall - a.overall)[0];
  const fogB = Math.max(1, Math.ceil((TUNING.FOG_BASE - G.facilities.scout) / 3));
  const baglam = enIyi ? ` Bu mevkideki en iyimiz: ${enIyi.name || '—'} (${enIyi.overall - fogB}-${enIyi.overall + fogB}), ${enIyi.age} yaşında.` : '';
  let ov, age, pos = weakest, gerekce;
  if (wantStar) {
    ov = randint(80, 85); age = randint(24, 29);
    gerekce = 'İstediğin yıldız bu: ligin dengesini değiştirir, tribünü doldurur.';
  } else if (line === 'genc') {
    ov = clamp(base + randint(-4, 2), 40, 78); age = randint(18, 21);
    gerekce = `Direktifin gereği genç bir cevher; en zayıf hattımız ${posTr(weakest)} için yarının yatırımı.`;
  } else {
    ov = clamp(base + randint(2, 9), 40, 79); age = randint(23, 29);
    gerekce = `En zayıf hattımız ${posTr(weakest)} — bu isim ilk on bire doğrudan oturur.`;
  }
  const p = new Player({ id: 'gm' + (G._pid = (G._pid || 1000) + 1), name: gmPickName(G), pos, overall: ov, potential: age < 24 ? Math.min(95, ov + randint(4, 12)) : ov, age, contractYears: randint(2, 4) });
  p.wage *= (G.marketMult || 1); // A3: enflasyon yeni sözleşmelere işler
  if (p.wage > (G.directive?.wageCap ?? 99)) p.wage = G.directive.wageCap; // GM maaş tavanına pazarlıkla uyar
  let fee = transferFee(p) * (G.marketMult || 1);
  if (!wantStar && fee > budgetLeft) fee = budgetLeft * (0.7 + rand(0, 0.3)); // GM bütçeye sığdırır
  gerekce += baglam; // Y8: kıyas bağlamı
  // A2: FFP durumu gerekçeye işlenir — GM abartmadan uyarır
  if (G.ffp && (G.ffp.spent + fee + p.wage) > G.ffp.limit) gerekce += ' Limitimiz dar — bu dosya taahhütname gerektirir, Başkanım.';
  if (G.windowStats) G.windowStats.dosya++;
  // Scout sisi: iyi GM daha dar aralıklı dosya getirir
  const fog = Math.max(1, TUNING.FOG_BASE - G.facilities.scout * TUNING.FOG_PER_SCOUT - Math.floor((G.gm.skill - 50) / 10));
  const h = Math.ceil(fog / 2);
  return { player: p, fee, gerekce, range: [p.overall - h, p.overall + h], sartTried: false };
}

// ── SORGULA: haftalık HAK ile sınırlı (scout Lv → hak) — kaynak yönetimi kararı.
// Sorgu DERİN RAPOR açar: net güç, maaş, bonservis, menajer tavrı, karakter, sakatlık, rakip ilgisi.
export function sorgulaPlayer(G, id) {
  const p = (G.market || []).find((x) => x.id === id);
  if (!p) return false;
  if (p._sorgu) return true;
  if ((G.sorguHak ?? 1) <= 0) {
    pushInbox(G, { cat: 'transfer', t: 'Sorgu hakkı bitti', b: `Gözlemci ağının haftalık kapasitesi doldu (hak: ${1 + (G.facilities.scout || 0)}/hafta). Scout tesisini büyüt ya da gelecek haftayı bekle — kimi sorgulayacağın da bir karar.`, noQueue: true });
    return false;
  }
  G.sorguHak = (G.sorguHak ?? 1) - 1;
  const bonservis = Math.round((p.fee || p.marketValue || 0) * (0.95 + (p.overall % 10) / 100));
  const tavir = (p.overall >= 75 && p.age <= 28) ? 'Zor' : (p.age >= 30 || p.overall < 58) ? 'İstekli' : 'Makul';
  const whisper = tavir === 'Zor' ? 'Menajeri masaya geç oturur, rakamı yukarı çeker.'
    : tavir === 'İstekli' ? 'Oyuncu taşınmaya hevesli — pazarlık payı var.'
      : 'Standart bir görüşme; sürpriz beklenmez.';
  const mh = mh32(String(p.id) + p.name);
  const K = ['Lider ruhlu', 'Sakin', 'Hırslı', 'Alevlenebilir', 'Profesyonel', 'Mahalle çocuğu', 'Sessiz ama derin'];
  const karakter = K[mh % K.length];
  const sakatlik = ((mh >>> 3) % 10) < 2 ? 'riskli' : 'temiz';
  const ilgi = p._ilgi ?? (mh % 4);
  p._sorgu = { guc: p.overall, maas: Math.round((p.wage || 0) * 10) / 10, bonservis, tavir, whisper, karakter, sakatlik, ilgi };
  pushInbox(G, { cat: 'transfer', t: `Derin rapor: ${p.name}`, b: `Net güç ${p.overall} · maaş talebi ${fmt1(p.wage || 0)}mn/sezon · bonservis ~${fmt1(bonservis)}mn. Karakter: ${karakter}. Sakatlık geçmişi: ${sakatlik}. Menajer: ${tavir} — ${whisper} İlgilenen kulüp: ${ilgi}.`, noQueue: true });
  return true;
}
// Bütçe dışı isme tıklanınca GM İTİRAZ EDER — satış mekaniğini doğal öne çıkarır
export function gmBudgetItiraz(G, id) {
  const p = (G.market || []).find((x) => x.id === id);
  if (!p) return false;
  const ask = Math.round((p.fee || p.marketValue || 0) * (1 + (p._ilgi || 0) * 0.12));
  pushInbox(G, { cat: 'transfer', t: `${G.gm?.name || 'GM'} (GM): ${p.name} dosyası`, b: `"${fmt1(ask)} milyon Başkanım. Kurul kapıyı yüzümüze kapatır. Ya bütçeyi büyütün ya birini satın — Kadro ekranından satış listesine oyuncu koyabilirsiniz."`, noQueue: true });
  return true;
}
// Teklif iste: GM sorgulanan oyuncu için onay dosyasını inbox'a getirir (mevcut tfile akışı)
export function requestOffer(G, id) {
  const p = (G.market || []).find((x) => x.id === id);
  if (!p) return false;
  if (!G.transferWindow) { pushInbox(G, { cat: 'transfer', t: 'Pencere kapalı', b: 'Transfer penceresi kapalıyken teklif iletilemez.' }); return false; }
  if (G.inbox.some((m) => m.action === 'tfile' && !m.resolved && m.file && m.file.player && m.file.player.id === p.id)) return false; // zaten açık dosya
  // İlgi arttıkça bedel yükselir (rakip baskısı): fee = taban × (1 + ilgi×0.12)
  const fee = Math.round((p._sorgu ? p._sorgu.bonservis : (p.fee || p.marketValue || 0)) * (1 + (p._ilgi || 0) * 0.12));
  const fog = Math.max(1, TUNING.FOG_BASE - G.facilities.scout * TUNING.FOG_PER_SCOUT);
  const h = Math.ceil(fog / 2);
  const file = { player: p, fee, gerekce: `Başkanım, sorguladığınız ${p.name} için dosyayı hazırladım.`, range: [p.overall - h, p.overall + h], sartTried: false, direct: true };
  G.market = G.market.filter((x) => x !== p);
  pushInbox(G, { cat: 'transfer', t: `${G.gm?.name || 'GM'} (GM): Onay dosyası — ${p.name}`, b: `${file.gerekce} Bedel ${fmt1(fee)}mn · maaş ${fmt1(p.wage || 0)}mn/sezon · görünen güç ${file.range[0]}-${file.range[1]}.`, action: 'tfile', file });
  return true;
}
// Onay dosyası kararı: 'onay' | 'red' | 'sart'
export function resolveTransferFile(G, msgId, choice) {
  const m = G.inbox.find((x) => x.id === msgId && x.action === 'tfile');
  if (!m || m.resolved) return { ok: false };
  const f = m.file, AP = TUNING.APPROVAL.SART;
  if (choice === 'red') {
    m.resolved = true;
    registerDecision(G, 'red');
    if (G.windowStats) G.windowStats.red++;
    // Y8: RET mikro-maliyeti — bu pencere haftası GM'in mesaisi bu dosyaya gitti
    pushInbox(G, { cat: 'transfer', t: `${G.gm.name} (GM): Anlaşıldı`, b: `${f.player.name} dosyası kapandı. Bu haftalık mesai buna gitti — yeni dosya gelecek pencere haftası.` });
    return { ok: true, outcome: 'red' };
  }
  if (choice === 'sart') {
    if (f.sartTried) return { ok: false, why: 'Pazarlık hakkı kullanıldı' };
    f.sartTried = true;
    registerDecision(G, 'sart');
    if (G.windowStats) G.windowStats.pazarlik++;
    const shift = (G.gm.skill - 60) / TUNING.APPROVAL.SART.GM_SHIFT; // iyi GM oranları lehine oynatır
    const r = rand(0, 1);
    if (r < AP.IN + shift) {
      f.fee *= AP.DISCOUNT;
      m.b = `Pazarlık tuttu! Yeni bedel ${fmt1(f.fee)}mn (%20 indi). ${f.gerekce}`;
      return { ok: true, outcome: 'indi' };
    } else if (r < AP.IN + shift + AP.DELAY) {
      m.resolved = true;
      G.delayedFile = f; // gelecek pencere haftası geri döner
      pushInbox(G, { cat: 'transfer', t: `${G.gm.name} (GM): Tur uzadı`, b: `${f.player.name} pazarlığı bir tur daha sürecek; önümüzdeki hafta masaya döneriz.` });
      return { ok: true, outcome: 'uzadi' };
    }
    m.resolved = true;
    pushInbox(G, { cat: 'transfer', t: 'Rakip kaptı!', b: `${f.player.name} pazarlık sürerken başka kulüple anlaştı. GM: "Bir dahakine hızlı davranalım."` });
    return { ok: true, outcome: 'kapti' };
  }
  // ONAY: bedel öde (nakit yoksa borç), kadroya kat
  if (G.flags && G.flags.transferBan > 0) return { ok: false, why: 'Transfer tahtası kapalı' };
  if (G.economy.kasa < f.fee * TUNING.TRANSFER.DEPOSIT) return { ok: false, why: 'Peşinat yetersiz' };
  if (G.economy.kasa >= f.fee) G.economy.kasa -= f.fee;
  else { G.economy.borc += f.fee - G.economy.kasa; G.economy.kasa = 0; }
  G.termSpent = (G.termSpent || 0) + f.fee;
  G.sezonAlim = (G.sezonAlim || 0) + f.fee; // B4d
  // A2+B1d: FFP — harcama kaydı; limit aşımı = KADEMELİ ihlal (taahhüt → ×2 kesinti+tahta → puan silme)
  if (G.ffp) {
    G.ffp.spent += f.fee + f.player.wage;
    if (G.ffp.spent > G.ffp.limit && !G.ffp.taahhut) ffpStrike(G);
  }
  G.squad.push(f.player);
  if (f.loan) { f.player.loanIn = true; f.player.contractYears = 1; } // A3: kiralık — sezon sonu döner
  G.kimya.kimya = clamp(G.kimya.kimya + TUNING.KIMYA_TRANSFER, 0, 100);
  if (f.player.overall >= TUNING.STAR_THRESHOLD && G.term) G.term.starBought = true;
  G.club.kadroDeger = squadMarketValue(G.squad);
  G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
  m.resolved = true;
  registerDecision(G, 'onay');
  if (G.windowStats) G.windowStats.onay++;
  pushInbox(G, { cat: 'transfer', t: 'İmza atıldı: ' + f.player.name, b: `${posTr(f.player.pos)} · ${fmt1(f.fee)}mn. GM: "Hayırlı olsun Başkanım." Kimya bir süre sarsılacak.` });
  if (f.fee >= 25) anKarti(G, { t: `Dev imza: ${f.player.name}`, b: `${fmt1(f.fee)}mn — kulüp tarihinin büyük çeklerinden.`, etki: 6 }); // M5
  if (f.player.overall >= TUNING.STAR_THRESHOLD) nudgeBoyut(G, 'yildizGeldi', 3); // B2a
  return { ok: true, outcome: 'onay' };
}

// Satış teklifi kararı: 'sat' | 'red'
export function resolveSaleFile(G, msgId, choice) {
  const m = G.inbox.find((x) => x.id === msgId && x.action === 'sfile');
  if (!m || m.resolved) return { ok: false };
  m.resolved = true;
  const p = G.squad.find((x) => x.id === m.file.playerId);
  if (!p) return { ok: true, outcome: 'gitti' };
  if (choice === 'sat') {
    G.squad = G.squad.filter((x) => x !== p);
    G.economy.kasa += m.file.offer;
    G.sezonSatis = (G.sezonSatis || 0) + m.file.offer; if (p.ocak) G.ocakSatisGelir = (G.ocakSatisGelir || 0) + m.file.offer; // B4d
    if (p.overall >= TUNING.STAR_THRESHOLD) { // yıldız satış dramı korunur
      G.gauges.taraftar = clamp(G.gauges.taraftar - 4, 0, 100);
      for (const q of G.squad) q.morale = clamp(q.morale - 2, 0, 100);
      pushInbox(G, { cat: 'transfer', t: 'Yıldız gitti: ' + p.name, b: `+${fmt1(m.file.offer)}mn kasada ama tribün küskün, soyunma odası sessiz.` });
      captainVoice(G, p); // K2: kaptan soyunma odası adına konuşur
      nudgeBoyut(G, 'yildizGitti', 3); // B2a: transfer boyutu darbesi
      anKarti(G, { t: `Yıldız satışı: ${p.name}`, b: `+${fmt1(m.file.offer)}mn — tribün bedelini sordu.`, etki: -6 }); // M5
    } else {
      pushInbox(G, { cat: 'transfer', t: 'Satış: ' + p.name, b: `+${fmt1(m.file.offer)}mn. GM: "İyi para, doğru karar."` });
    }
    efsaneSatisKontrol(G, p); // M3: jübilesiz satılan efsane → kalıcı küskünlük
    G.club.kadroDeger = squadMarketValue(G.squad);
    G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
    return { ok: true, outcome: 'sat' };
  }
  pushInbox(G, { cat: 'transfer', t: 'Teklif reddedildi', b: `${p.name} kalıyor. Oyuncu kulübün güvenini hissetti.` });
  p.morale = clamp(p.morale + 2, 0, 100);
  return { ok: true, outcome: 'red' };
}

export function setDirective(G, patch) { G.directive = { ...(G.directive || {}), ...patch }; }

// ═══ A3: DEADLINE DAY + piyasa ekonomisi ═══
// Pencerenin SON haftası: 3-5 hızlı dosya art arda — "bu tur cevapla yoksa kaçar".
function deadlineTick(G, wk) {
  const isDeadline = TUNING.TRANSFER.WINDOWS.some((s) => wk === s + TUNING.APPROVAL.WINDOW_SPAN - 1);
  if (!isDeadline || G.deadlineDone === wk) return;
  G.deadlineDone = wk;
  const D = TUNING.DEADLINE;
  // Y2: sezon telefon tavanı (10) deadline'la da delinmez — kalan bütçeye kelepçe
  const n = Math.max(1, Math.min(randint(D.FILES[0], D.FILES[1]), 10 - (G.phoneCount || 0)));
  pushInbox(G, { cat: 'transfer', t: '⏱ DEADLINE DAY', b: `Pencerenin son günü — telefonlar susmuyor. ${n} arama sırada; her biri BU TUR cevaplanmalı yoksa kaçar (ertelersen arayan hatırlar).` });
  for (let i = 0; i < n; i++) {
    const r = rand(0, 1);
    if (r < 0.45) { // panik SATIŞ yapan kriz kulübünden iskontolu alım → TELEFON (Y2)
      const p = new Player({ id: 'dl' + (G._pid = (G._pid || 1000) + 1), name: gmPickName(G), pos: ['DEF', 'MID', 'FWD'][randint(0, 2)], overall: randint(Math.round(G.temelGuc) - 2, Math.round(G.temelGuc) + 8), potential: 0, age: randint(23, 30), contractYears: 2 });
      p.potential = p.overall; p.wage *= (G.marketMult || 1);
      const fee = transferFee(p) * (G.marketMult || 1) * rand(D.BUY_DISC[0], D.BUY_DISC[1]);
      const fog = Math.max(1, TUNING.FOG_BASE - G.facilities.scout);
      ringPhone(G, {
        kind: 'dlbuy', caller: 'gm', callerName: `${G.gm.name} (GM)`, deadline: true,
        title: `⏱ Panik satış: ${p.name}`,
        body: `Kriz kulübü BUGÜN nakit istiyor — ${fmt1(fee)}mn (piyasa altı). Güç ${p.overall - Math.ceil(fog / 2)}-${p.overall + Math.ceil(fog / 2)} · ${posTrPhone(p.pos)} · ${p.age} yaş. Hat açık, karar senin.`,
        options: [{ key: 'onay', label: `ONAYLA (${fmt1(fee)}mn)` }, { key: 'red', label: 'REDDET' }, { key: 'beklet', label: '⏳ Beklet (%20 dosya kalır, %80 kaçar)' }],
        file: { player: p, fee },
      });
    } else if (r < 0.75) { // DEV panik alıcı → TELEFON (menajer çerçevesi)
      const cands = G.squad.filter((p) => p.overall >= 55);
      if (!cands.length) continue;
      const p = cands[randint(0, cands.length - 1)];
      const offer = saleOffer(p) * (G.marketMult || 1) * rand(D.SELL_PREM[0], D.SELL_PREM[1]);
      ringPhone(G, {
        kind: 'dlsell', caller: 'menajer', callerName: 'Menajer hattı', deadline: true,
        title: `⏱ DEV panik alıyor: ${p.name}`,
        body: `Şampiyonluk baskısındaki dev kulüp ${fmt1(offer)}mn sayıyor — piyasanın ÜSTÜ. Bu akşam kapanır.`,
        options: [{ key: 'sat', label: `SAT (+${fmt1(offer)}mn)` }, { key: 'red', label: 'REDDET' }],
        playerId: p.id, offer,
      });
    } else { // kiralık takviye → TELEFON
      const p = new Player({ id: 'ln' + (G._pid = (G._pid || 1000) + 1), name: gmPickName(G), pos: ['DEF', 'MID', 'FWD'][randint(0, 2)], overall: randint(Math.round(G.temelGuc), Math.round(G.temelGuc) + 6), potential: 0, age: randint(22, 28), contractYears: 1 });
      p.potential = p.overall; p.wage *= (G.marketMult || 1) * TUNING.LOAN.WAGE_SHARE;
      const fee = p.marketValue * TUNING.LOAN.FEE_FRAC * (G.marketMult || 1);
      const fogL = Math.max(1, TUNING.FOG_BASE - G.facilities.scout);
      ringPhone(G, {
        kind: 'dlbuy', caller: 'gm', callerName: `${G.gm.name} (GM)`, deadline: true,
        title: `⏱ Kiralık fırsatı: ${p.name}`,
        body: `Sezonluk kiralık — bedel ${fmt1(fee)}mn + maaşın yarısı bizde. Güç ${p.overall - Math.ceil(fogL / 2)}-${p.overall + Math.ceil(fogL / 2)} · ${posTrPhone(p.pos)} · ${p.age} yaş. Sezon sonu döner; kadro yaması için ideal.`,
        options: [{ key: 'onay', label: `KİRALA (${fmt1(fee)}mn)` }, { key: 'red', label: 'REDDET' }, { key: 'beklet', label: '⏳ Beklet (%20 dosya kalır, %80 kaçar)' }],
        file: { player: p, fee, loan: true },
      });
    }
  }
}

// Pencere DIŞI bonservissiz kumar dosyası (yaşlı/formsuz ağırlıklı, bedava).
function freeAgentTick(G, wk) {
  if (G.transferWindow || rand(0, 1) > TUNING.FREE_AGENT.P) return;
  if (G.inbox.some((m) => m.action === 'tfile' && !m.resolved)) return;
  const F = TUNING.FREE_AGENT;
  const p = new Player({ id: 'fa' + (G._pid = (G._pid || 1000) + 1), name: gmPickName(G), pos: ['DEF', 'MID', 'FWD'][randint(0, 2)], overall: randint(Math.round(G.temelGuc) - 6, Math.round(G.temelGuc) + 4), potential: 0, age: randint(F.AGE[0], F.AGE[1]), contractYears: 1 });
  p.potential = p.overall; p.form = 38; p.wage *= (G.marketMult || 1);
  const fog = Math.max(2, TUNING.FOG_BASE - G.facilities.scout + 2); // formsuz belirsizlik yüksek
  pushInbox(G, { cat: 'transfer', t: `Bonservissiz: ${p.name} (${p.age})`, b: `Kulübü yok, bedavaya imza atar — ama aylardır maç oynamamış. Görünen güç ${p.overall - Math.ceil(fog / 2)}-${p.overall + Math.ceil(fog / 2)}. Kumar mı, kelepir mi?`, action: 'tfile', file: { player: p, fee: 0, gerekce: 'Bonservissiz kumar.', range: [p.overall - Math.ceil(fog / 2), p.overall + Math.ceil(fog / 2)], sartTried: true } });
}

// Genç kiralık GÖNDERME önerisi (gelişim ×1.5 başka kulüpte).
function loanOutTick(G, wk) {
  if (!G.transferWindow || rand(0, 1) > TUNING.LOAN.SEND_P) return;
  if (G.inbox.some((m) => m.action === 'lfile' && !m.resolved)) return;
  // Başkanın kiralık listesi ÖNCELİKLİ; liste boşsa klasik genç-gelişim adayı
  const listeli = G.squad.find((p) => p.kiralikListe && !p.loanIn && p.id !== G.captainId);
  const cand = listeli || G.squad.find((p) => p.age <= 21 && (p.potential - p.overall) >= TUNING.LOAN.POT_GAP && !p.loanIn);
  if (!cand) return;
  const govde = listeli
    ? `Listeye koyduğun isim için telefon geldi: alt sıralardan bir kulüp ${cand.name}'i sezonluk istiyor. GM: "İstediğin gibi Başkanım — maaş yükü hafifler."`
    : `Alt sıralardan bir kulüp ${cand.name}'i sezonluk istiyor. GM: "Orada her hafta oynar, gelişimi hızlanır — ama bu sezon bizde yok."`;
  pushInbox(G, { cat: 'transfer', t: `Kiralık teklifi: ${cand.name} gitsin mi?`, b: govde, action: 'lfile', file: { playerId: cand.id } });
}

// Kiralık gönderme kararı
export function resolveLoanFile(G, msgId, choice) {
  const m = G.inbox.find((x) => x.id === msgId && x.action === 'lfile');
  if (!m || m.resolved) return { ok: false };
  m.resolved = true;
  const p = G.squad.find((x) => x.id === m.file.playerId);
  if (!p) return { ok: true };
  if (choice === 'gonder') {
    G.squad = G.squad.filter((x) => x !== p);
    G.loanedOut = G.loanedOut || [];
    G.loanedOut.push(p);
    G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
    pushInbox(G, { cat: 'transfer', t: `${p.name} kiralık gitti`, b: 'Sezon sonu gelişmiş dönecek — sabır yatırımı.' });
  } else {
    pushInbox(G, { cat: 'transfer', t: `${p.name} kalıyor`, b: 'GM notu: "Peki, burada pişer."' });
  }
  return { ok: true };
}

// ═══ A1: YÖNETİCİ İŞE ALIM (dosya deseni) + manşet söndürme + FFP lobi ═══
export function requestStaffFile(G, role) {
  if (!TUNING.STAFF.ROLES.includes(role)) return { ok: false };
  if (G.staff[role]) return { ok: false, why: 'Koltuk dolu' };
  if (G.inbox.some((m) => m.action === 'stfile' && !m.resolved)) return { ok: false, why: 'Aday süreci sürüyor' };
  const cands = generateStaff(role, G.club.reputation, { names: G.data.names, count: randint(2, 3) });
  G.staffCands = { role, cands };
  pushInbox(G, {
    cat: 'kongre', t: `${G.gm.name} (GM): ${ROLE_TR[role]} aday dosyası`,
    b: cands.map((c, i) => `${i + 1}) ${c.name} — ${describeStaff(c)} (${fmt1(c.wage)}mn/sezon)`).join(' · '),
    action: 'stfile',
  });
  return { ok: true };
}

export function hireStaffFile(G, msgId, idx) {
  const m = G.inbox.find((x) => x.id === msgId && x.action === 'stfile');
  if (!m || m.resolved || !G.staffCands) return { ok: false };
  const c = G.staffCands.cands[Number(idx)];
  if (!c) return { ok: false };
  G.staff[G.staffCands.role] = c;
  m.resolved = true; G.staffCands = null;
  pushInbox(G, { cat: 'kongre', t: `İmza: ${c.name} (${ROLE_TR[c.role]})`, b: `${describeStaff(c)}. Maaşı gider kalemine işledi.` });
  return { ok: true };
}

// Basın Sözcüsü: negatif manşeti söndür (4 haftada 1 hak)
export function dousePress(G, msgId) {
  const m = G.inbox.find((x) => x.id === msgId && x.action === 'douse');
  if (!m || m.resolved || !G.staff?.basin) return { ok: false };
  if ((G.globalWeek - (G.douseWeek || -99)) < TUNING.STAFF.DOUSE_COOLDOWN) return { ok: false, why: 'Hak yok' };
  m.resolved = true; G.douseWeek = G.globalWeek;
  G.mediaTone = (G.mediaTone || 0) + 0.7;
  pushInbox(G, { cat: 'medya', t: 'Manşet söndürüldü', b: `${G.staff.basin.name} arka kanalları çalıştırdı; hikâye ikinci sayfaya düştü.` });
  return { ok: true };
}

// A2+B1b: FFP itiraz/lobi — FEDERASYON TOPLANTISI sahnesi: AI başkanlar söz alır
export function ffpLobi(G) {
  if (!G.ffp || G.ffp.lobiUsed) return { ok: false };
  if (G.club.reputation <= TUNING.FFP.appealRepMin) return { ok: false, why: 'İtibar yetersiz' };
  G.ffp.lobiUsed = true;
  const R = TUNING.MEGA.RAKIP;
  // B1c: itiraz federasyonu yorar (gizli hat)
  G.fedIliski = clamp((G.fedIliski ?? 50) + TUNING.MEGA.FED.LOBI, 0, 100);
  // B1b: toplantıda 2-3 AI başkan söz alır — itibar yüksekse lehte, düşükse aleyhte konuşan çıkar
  let chance = TUNING.FFP.appealChance;
  const sozler = [];
  const opps = (G.opponents || []).slice(0, 3);
  if (G.gauges.itibar > R.FED_ITIBAR && opps[1]) {
    chance += R.FED_DESTEK;
    sozler.push(`${opps[1].baskan} (${opps[1].name}) söz aldı: "Bu kulüp ligin itibarıdır — dosyaya esneklik hakkaniyettir."`);
  } else if (G.gauges.itibar < 40 && opps[2]) {
    chance += R.FED_DUSMAN;
    sozler.push(`${opps[2].baskan} (${opps[2].name}) aleyhte konuştu: "Kural kuraldır; kimseye özel terzi limiti dikilmez."`);
  }
  if (opps[0]) sozler.push(`${opps[0].baskan} (${opps[0].name}) tarafsız kaldı, notlarına gömüldü.`);
  const sahne = sozler.length ? ' Toplantı salonundan: ' + sozler.join(' ') : '';
  if (rand(0, 1) < chance) {
    G.ffp.limit = Math.round(G.ffp.limit * (1 + TUNING.FFP.appealBoost));
    pushInbox(G, { cat: 'mali', t: 'Federasyon toplantısı: itiraz TUTTU', b: `Limit %10 esnedi → ${G.ffp.limit}mn.${sahne}` });
    return { ok: true, success: true };
  }
  pushInbox(G, { cat: 'mali', t: 'Federasyon toplantısı: itiraz reddedildi', b: `Dosya masada kaldı; limit aynı.${sahne}` });
  return { ok: true, success: false };
}

// ═══════════ TD SÜRECİ (Başkanlık Hissi §2) ═══════════
// Kovma kararı → tazminat + medya fırtınası → GM aday DOSYALARI (sayısız cümleler) → imza.

export function fireCoach(G) {
  if (G.coachSearch) return { ok: false, why: 'Aday süreci zaten sürüyor' };
  const C = TUNING.COACH_FIRE;
  const tazminat = (G.coach.wage || 0.3) * (G.coach.contractYears ?? 2) * C.TAZMINAT_YIL;
  G.economy.kasa -= tazminat;
  G.gauges.taraftar = clamp(G.gauges.taraftar + C.TARAFTAR, 0, 100);
  G.mediaTone = (G.mediaTone || 0) + C.MEDIA_TONE;
  const eski = G.coach.name;
  G.coach = { name: 'Vekil Antrenör', ...C.INTERIM, contractYears: 0 };
  G.taktik.uyumHafta = 0;
  G.coachSearch = true;
  G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
  pushInbox(G, { cat: 'medya', t: `${eski} gönderildi — medya fırtınası`, b: `Tazminat ${fmt1(tazminat)}mn kasadan çıktı. Taraftar bölündü, basın sert. Vekil antrenör idareten başında.` });
  // GM aday dosyası hemen hazırlanır (bir sonraki karar oyuncunun)
  const n = randint(TUNING.COACH_FIRE.CANDIDATES[0], TUNING.COACH_FIRE.CANDIDATES[1]);
  const cands = generateCoaches(G.club.reputation, { names: G.data.names, count: n + 1 }).slice(0, n)
    .map((c) => ({ ...c, contractYears: 2 }));
  G.coachFiles = cands;
  pushInbox(G, {
    cat: 'td', t: `${G.gm.name} (GM): TD aday dosyası (${n} isim)`,
    b: cands.map((c, i) => `${i + 1}) ${c.name} — ${coachDescribe(c)}`).join(' · '),
    action: 'cfile',
  });
  return { ok: true, tazminat };
}

export function hireCoachFile(G, msgId, idx) {
  const m = G.inbox.find((x) => x.id === msgId && x.action === 'cfile');
  if (!m || m.resolved || !G.coachFiles) return { ok: false };
  const cand = G.coachFiles[Number(idx)];
  if (!cand) return { ok: false };
  hireCoach(G, cand, { midSeason: G.phase === 'SEASON_LOOP' });
  G.coach.contractYears = 2;
  G.coachSearch = false; G.coachFiles = null; m.resolved = true;
  G.tdRelation = 70; G.lastTelkinReplied = null;
  G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
  pushInbox(G, { cat: 'td', t: 'İmza: ' + cand.name, b: `${coachDescribe(cand)}. Uyum süreci sıfırdan başlıyor.` });
  return { ok: true };
}

// TD karakter cümlesi (SAYI YOK — §2/§3)
export function coachDescribe(c) {
  const okul = { 'motivatör': 'motivasyon ustası', 'savunmacı': 'savunmacı ekol', 'oyun kurucu': 'hücum futbolunu sever', 'genç işçisi': 'gençlerin hocası' }[c.archetype] || 'dengeli bir profil';
  const parts = [okul];
  if (c.otorite >= 74) parts.push('otoritesi yüksek');
  else if (c.otorite <= 55) parts.push('otoritesi tartışılır');
  if (c.taktik >= 80) parts.push('taktik zekâsı parlak');
  if (c.oyuncuYonetimi >= 74) parts.push('soyunma odasını iyi yönetir');
  if (c.archetype !== 'genç işçisi' && c.yardimciEkip < 60) parts.push('gençlere mesafeli');
  else if (c.yardimciEkip >= 78) parts.push('ekibi güçlü');
  return parts.slice(0, 3).join(', ');
}

// ── Tesisler (Bible-9) + İHALE (v4.1-4) ──
// Yükseltme kararı ihale açar: 3 firma teklifi → chooseTender ile tamamlanır.
const pickFrom = (arr) => arr[Math.floor(rand(0, 1) * arr.length)];

export function upgradeFacility(G, tesis) {
  if (G.tender) return { ok: false, why: 'İhale zaten sürüyor' };
  if (!canUpgrade(G, tesis)) return { ok: false };
  const base = effectiveUpgradeCost(G, tesis); // B4a senaryo + K1 olay indirimi (facilities.js tek kaynak)
  const F = G.data.firms || { A: ['Yerel Müteahhit'], B: ['Prestij Yapı'], C: ['Tanıdık Firma'] };
  const T = TUNING.TENDER;
  G.tender = {
    tesis,
    offers: [
      { type: 'A', firm: pickFrom(F.A), cost: base * T.A.costMult, desc: 'Ucuz ve hızlı; tecrübesiz — %25 iş sezon sonuna sarkabilir.' },
      { type: 'B', firm: pickFrom(F.B), cost: base * T.B.costMult, desc: 'Pahalı ama garantili; bazen beklenenden iyi iş çıkarır.' },
      { type: 'C', firm: pickFrom(F.C), cost: base * T.C.costMult, desc: 'Kurul üyesi bağlantılı "tanıdık firma" — ucuz ama medyaya sızarsa itibar yara alır.' },
    ],
  };
  return { ok: true, tender: true };
}

export function chooseTender(G, idx) {
  const t = G.tender;
  if (!t) return { ok: false };
  const o = t.offers[Number(idx)];
  if (!o) return { ok: false };
  if (G.economy.kasa < o.cost) return { ok: false, why: 'Nakit yetersiz' };
  const T = TUNING.TENDER;
  G.economy.kasa -= o.cost;
  let note = 'İş planlandığı gibi tamamlandı.';
  if (o.type === 'A' && rand(0, 1) < T.A.riskP) {
    G.pendingFacilities = G.pendingFacilities || [];
    G.pendingFacilities.push(t.tesis);
    note = 'Firma tökezledi: iş sezon sonuna sarktı (etki gecikecek).';
  } else {
    G.facilities[t.tesis] += 1;
    if (o.type === 'B' && rand(0, 1) < T.B.bonusP && G.facilities[t.tesis] < TUNING.TRANSFER.FAC_MAX) {
      G.facilities[t.tesis] += 1;
      note = 'Premium iş: firma beklenenin üstüne çıktı — +1 ekstra kademe!';
    }
    if (o.type === 'C' && rand(0, 1) < T.C.leakP) {
      G.gauges.itibar = clamp(G.gauges.itibar + T.C.leakItibar, 0, 100);
      G.rival = G.rival || { attractiveness: 0 };
      G.rival.attractiveness += T.C.leakRival;
      G.mediaTone = (G.mediaTone || 0) - 1;
      pushInbox(G, { cat: 'medya', t: 'İhale medyaya sızdı', b: 'Muhalif kalem "tanıdık firma" ihalesini manşete taşıdı. İtibar sarsıldı, rakibe koz gitti.' });
      note = 'İş bitti ama ihale dedikodusu ortalığı karıştırdı.';
    }
  }
  G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
  pushInbox(G, { cat: 'tesis', t: `İhale sonuçlandı: ${t.tesis} (${o.firm})`, b: `−${fmt1(o.cost)}mn. ${note}` });
  G.tender = null;
  return { ok: true };
}

export function cancelTender(G) { G.tender = null; }

// ── Demeç (V3-F) — haftada 1 ──
export function makeDemec(G, tone) {
  if (G.demecUsed) return { ok: false };
  // Basın toplantısı UI: verilen cevabın GERÇEK +/- etkisini göstermek için delta yakala
  const snap = { taraftar: G.gauges.taraftar, guven: G.gauges.guven, itibar: G.gauges.itibar, medya: (G.mediaTone || 0), kimya: (G.kimya ? G.kimya.kimya : null) };
  const r = applyDemec(G, tone);
  if (!r.ok && r.ok !== undefined) return r;
  G.demecUsed = true;
  G.lastDemecTone = tone;
  G.lastDemecFx = {
    taraftar: G.gauges.taraftar - snap.taraftar,
    guven: G.gauges.guven - snap.guven,
    itibar: G.gauges.itibar - snap.itibar,
    medya: (G.mediaTone || 0) - snap.medya,
    kimya: snap.kimya != null ? (G.kimya.kimya - snap.kimya) : 0,
    ceza: r.pfdk ? r.ceza : 0,
  };
  // B1c: GİZLİ federasyon hattı — ateşli çıkış yıpratır, sakin diplomasi onarır (asla gösterilmez)
  const F = TUNING.MEGA.FED;
  if (tone === 'atesli') G.fedIliski = clamp((G.fedIliski ?? F.START) + F.ATESLI, 0, 100);
  else if (tone === 'sakin') G.fedIliski = clamp((G.fedIliski ?? F.START) + F.SAKIN, 0, 100);
  pushInbox(G, { cat: 'demec', t: 'Başkan demeci: ' + tone, b: r.pfdk ? `PFDK cezası −${fmt1(r.ceza)}mn.` : 'Ton medyaya yansıdı.' });
  return { ok: true, ...r };
}

// ── Teknik Direktör (Bible-10 / staff) ──
export function hireCoachAction(G, index) {
  const cand = (G.coachCandidates || [])[Number(index)];
  if (!cand) return { ok: false };
  const midSeason = G.phase === 'SEASON_LOOP';
  hireCoach(G, cand, { midSeason });
  G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
  pushInbox(G, { cat: 'td', t: 'Yeni TD: ' + cand.name, b: `${cand.archetype} · ${midSeason ? 'Taktik uyum sıfırlandı, kimya −10' : 'Dönem başı atama'}.` });
  return { ok: true };
}

// ── Sezon / dönem geçişi ──
export function endSeason(G) {
  tickSponsors(G); // sponsor sözleşme süreleri bir sezon azalır; bitenler slotu boşaltır
  const table = standings(G.league);
  const pos = table.find((t) => t.id === MY).rank;
  const L = TUNING.LEAGUE, lig = G.lig || 1;
  const champion = pos === 1;
  const relegated = lig === 1 && pos >= L.RELEGATION_FROM;   // sadece üst ligden küme
  const promoted = lig === 2 && pos <= L.PROMOTION_TO;       // 2. ligde ilk 3 → terfi
  // 2. lig şampiyonluğu üst-lig zafer dominosu vermez (o bir terfi hikâyesi)
  checkThresholdEvents(G, { relegated, champion: champion && lig === 1 });
  G.history.seasons.push({ pos, champion, cup: !!(G.cup && G.cup.won), W: G.season.W, D: G.season.D, L: G.season.L, GF: G.season.GF, GA: G.season.GA, lig });
  // MİRAS: tarihçe + defter anları + jübile törenleri
  (G.borcHistory = G.borcHistory || []).push(Math.round(G.economy.borc));
  if (G.cup && G.cup.won) {
    G.career.cups = (G.career.cups || 0) + 1;
    pushMuze(G, { tip: 'kupa', t: `🏆 Kupa (${G.worldSeason}. sezon)`, b: 'Final gecesi müzeye altın bir sayfa ekledi.' });
    anKarti(G, { t: 'Kupa kazanıldı', b: 'Finalden zaferle dönüldü — vitrine yeni kupa.', etki: 8 });
  }
  if (champion && lig === 1) {
    pushMuze(G, { tip: 'kupa', t: `⭐ ŞAMPİYONLUK (${G.worldSeason}. sezon)`, b: 'Lig tarihine altın harflerle yazıldı.' });
    anKarti(G, { t: 'ŞAMPİYONLUK', b: 'Sezon zirvede kapandı — şehir bayramda.', etki: 10 });
  }
  if (relegated) {
    anKarti(G, { t: 'Küme düşüldü', b: 'Kara sezon — tabela affetmedi. Gelecek sezon 2. lig.', etki: -9 });
    G.aciKume = true; G._ligChange = 2;
    // YILDIZ GÖÇÜ: en değerli oyuncu 2. ligde kalmaz — üst lig kulübü kapar (kasaya nakit, sahaya boşluk)
    const star = [...G.squad].sort((a, b) => b.overall - a.overall)[0];
    if (star && star.overall >= L.STAR_EXODUS_MIN) {
      G.squad = G.squad.filter((p) => p !== star);
      const fee = Math.max(1, Math.round((star.value || star.overall * 0.8) * L.STAR_EXODUS_FEE));
      G.economy.kasa += fee; G.sezonSatis = (G.sezonSatis || 0) + fee;
      pushInbox(G, { cat: 'transfer', t: `${star.name} küme sonrası ayrıldı`, b: `Üst lig kulübü ${fmt1(fee)}mn ödedi — yıldız 2. ligde kalmadı. Kasaya nakit girdi ama kadro zayıfladı.`, noQueue: true });
      anKarti(G, { t: 'Yıldız göçü', b: `${star.name} küme düşünce takımdan ayrıldı.`, etki: -5 });
    }
  }
  if (promoted) {
    G._ligChange = 1; G.lig2Native = false; // artık üst-lig deneyimli: sonra düşerse gerçek küme
    pushMuze(G, { tip: 'kupa', t: `⬆ TERFİ (${G.worldSeason}. sezon)`, b: `2. lig ${champion ? 'şampiyonu' : pos + '.'} — takım üst lige döndü.` });
    anKarti(G, { t: 'TERFİ!', b: '2. ligden üst lige dönüldü — şehir bayram ediyor.', etki: 9 });
    pushInbox(G, { cat: 'manset', t: champion ? '2. LİG ŞAMPİYONU — TERFİ!' : 'TERFİ — üst lige dönüş', sig: 'terfi', b: 'Bir yıllık çölden dönüş: takım yeniden büyük ligde. Yayın masası kalınlaşacak, sponsorlar döndü, taraftar sokakta.', noQueue: true });
    G.gauges.taraftar = clamp(G.gauges.taraftar + 12, 0, 100);
    G.gauges.itibar = clamp(G.gauges.itibar + 8, 0, 100);
  }
  (G.fedHistory = G.fedHistory || []).push(G.fedIliski ?? 50); // B5c: kariyer fed ortalaması (kapanış yan notu)
  // B6g: kayıt sağlığı — defter şişmesin (|etki| küçükler kırpılır; müze/kupa kalıcı)
  if ((G.defter || []).length > 300) {
    G.defter = G.defter.slice().sort((a, b) => Math.abs(b.etki) - Math.abs(a.etki)).slice(0, 250)
      .sort((a, b) => (a.sezon - b.sezon) || (a.hafta - b.hafta));
  }
  // B4d: sezon başarım bayrakları
  if ((G.wk33Pos || 0) > G.club.hedefSira && pos <= G.club.hedefSira) G.aciSonHafta = true; // hedef son haftada döndü
  if (!G.ffpStruckThisSeason) G.ffpTemizSezon = (G.ffpTemizSezon || 0) + 1; else G.ffpTemizSezon = 0;
  for (const d of checkAchievements(G)) { pushInbox(G, { cat: 'manset', t: `🏅 BAŞARIM: ${d.name}`, sig: 'ach-' + d.id, b: `${d.category} rozetlerine yenisi eklendi.`, noQueue: true }); G.achToast = d.name; }
  // B4a: senaryo hedefi kontrolü
  if (G.scenario && !G.scenario.done && scenarioDone(G, G.scenario)) {
    G.scenario.done = true;
    pushInbox(G, { cat: 'manset', t: `SENARYO HEDEFİ BAŞARILDI: ${G.scenario.ad}`, sig: 'sc-done', b: G.scenario.hedef.metin + ' — sözünü tuttun. Kapanış etiketine işlenecek.', noQueue: true });
    anKarti(G, { t: 'Senaryo hedefi başarıldı', b: G.scenario.hedef.metin, etki: 10 });
  }
  for (const p of G.squad.filter((x) => x.jubilePlanned || x.jubileSilent)) {
    G.squad = G.squad.filter((x) => x !== p);
    if (p.jubilePlanned) pushInbox(G, { cat: 'karar', t: `Jübile gecesi: ${p.name}`, b: `Stadyum dolu, gözler nemli. ${p.kulupteYil} yılın ardından formayı çimlere bıraktı — müzedeki yerini aldı.`, noQueue: true });
    else pushInbox(G, { cat: 'karar', t: `${p.name} sessizce ayrıldı`, b: 'Ne tören ne pankart. Radikal grup unutmadı.', noQueue: true });
  }
  // M5: bu sezonun 3 anı — sezon kapanış ekranında gösterilir
  G.lastSeason = G.lastSeason || {};
  G.sezonAnlari = defterTop(G, TUNING.MIRAS.DEFTER.SEZON_AN, (a) => a.sezon === G.worldSeason);
  // Y1: "bu sezonun hikayesi" — sezon karnesine tek cümle; Y6: kimlik etiketi kontrolü
  const kimlik = deskIdentity(G);
  if (kimlik && !G.kimlikDuyuruldu) { G.kimlikDuyuruldu = true; pushInbox(G, { cat: 'manset', t: `Kimlik oturdu: "${kimlik}"`, sig: 'kimlik-' + kimlik, b: 'Kamuoyu başkanı artık böyle tanıyor — küçük ama kalıcı bir sermaye.' }); G.gauges.itibar = clamp(G.gauges.itibar + 2, 0, 100); }
  G.lastSeason = { pos, champion, relegated, hikaye: G.storyArc ? G.storyArc.ozet : '', kimlik: G.identityTag || null, telkinKarne: telkinKarne(G.telkinLog), ...G.season };
  // K3: sözleşme masası çözülmediyse önemli oyuncu BEDAVA gider ("yönetim uyudu")
  contractSeasonEnd(G);
  if (G.career) { G.career.seasons++; if (champion && lig === 1) G.career.titles++; G.career.bestPos = Math.min(G.career.bestPos, pos); }

  // v4.1-4: sezon sonuna sarkan ihale işleri tamamlanır
  for (const tesis of G.pendingFacilities || []) {
    if (G.facilities[tesis] < TUNING.TRANSFER.FAC_MAX) G.facilities[tesis] += 1;
    pushInbox(G, { cat: 'tesis', t: `Geciken iş tamamlandı: ${tesis}`, b: 'Sarkan ihale nihayet teslim edildi; etki devrede.' });
  }
  G.pendingFacilities = [];

  // v4.1-3: sezon hedef primi hesabı (ilan edildiyse)
  if (G.sezonHedefDeclared) {
    const P = TUNING.PRIM.SEZON;
    if (pos <= G.club.hedefSira) {
      G.economy.kasa -= P.achieveCost; G.primLedger.sezon += P.achieveCost;
      for (const p of G.squad) p.morale = clamp(p.morale + P.achieveMorale, 0, 100);
      G.sezonPrimResult = 'paid';
      pushInbox(G, { cat: 'mali', t: 'Sezon hedef primi ödendi', b: `Hedef tutturuldu (${pos}. ≤ ${G.club.hedefSira}.). Söz yerine getirildi, moral tavan.` });
    } else {
      for (const p of G.squad) p.morale = clamp(p.morale + P.failMorale, 0, 100);
      G.sezonPrimResult = 'fail';
      pushInbox(G, { cat: 'mali', t: 'Sezon hedefi tutmadı', b: 'İlan edilen prim havada kaldı; soyunma odasında hafif buruk bir hava var.' });
    }
  }

  // v4.1-5: vaat ara-ilerleme (sezon sonu — huzursuzluk kontrolü dahil)
  checkMilestones(G, { seasonEnd: true });

  // A2: FFP kayıtları — gelecek sezonun limiti bu sezonun gelirinden
  G.lastSeasonIncome = G.seasonIncome || G.lastSeasonIncome;
  G.ffpLastCupWon = !!(G.cup && G.cup.won);
  if (G.ffp) G.ffp.pendingCutCarry = G.ffp.pendingCut; // initSeason cutActive'e taşır
  // A3: kiralık DÖNÜŞLER — giden gençler ×1.5 gelişimle döner; gelen kiralıklar evine gider
  for (const p of G.loanedOut || []) {
    const dev = Math.round(rand(0, G.facilities.antrenman * TUNING.DEV_U24_MAX * TUNING.LOAN.DEV_MULT));
    p.overall = Math.min(p.potential, p.overall + dev); p.age += 1; p.refreshValue?.();
    G.squad.push(p);
    pushInbox(G, { cat: 'transfer', t: `${p.name} kiralıktan döndü`, b: `Her hafta oynadı, gözle görülür gelişti. GM: "Yatırım karşılığını verdi."` });
  }
  G.loanedOut = [];
  for (const p of G.squad.filter((x) => x.loanIn)) {
    G.squad = G.squad.filter((x) => x !== p);
    pushInbox(G, { cat: 'transfer', t: `${p.name} kulübüne döndü`, b: `Kiralık süresi bitti. İstersen bonservisini sor — GM opsiyon dosyası hazırlar.` });
  }
  // A1: sezon sonu istifa/rakip kapma riski (itibar düşükse artar)
  for (const role of TUNING.STAFF.ROLES) {
    const s = G.staff && G.staff[role];
    if (!s) continue;
    const p = TUNING.STAFF.RESIGN_P * (G.gauges.itibar < 45 ? 2 : 1) * (s.trait === 'egolu' ? 1.5 : 1);
    if (rand(0, 1) < p) {
      G.staff[role] = null;
      pushInbox(G, { cat: 'kongre', t: `${s.name} ayrıldı (${ROLE_TR[role]})`, b: s.trait === 'egolu' ? 'Egosu kapıya sığmadı — rakip kulüp kaptı. Koltuk boş.' : 'Daha iyi bir teklif aldı. Koltuk boş; yeni aday dosyası isteyebilirsin.' });
    }
  }
  // Sezon sonu gelişim (Bible-9). Gençlik alımı D4 ile 17. haftaya (Genç Takım Günü sahnesi) taşındı.
  developSquad(G.squad, G.facilities);
  // Akademi pipeline: kadro 30'u aşarsa en zayıflar bırakılır (gençleşme)
  G.squad.sort((a, b) => b.overall - a.overall);
  if (G.squad.length > 30) G.squad.length = 30;
  G.club.kadroDeger = squadMarketValue(G.squad);
  G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
  G.phase = 'SEASON_END';
}

export function afterSeasonEnd(G) {
  if (G.meta.season < TUNING.SEASONS_PER_TERM) {
    G.meta.season++;
    initSeason(G);
    G.phase = 'SEASON_LOOP'; G.nav = 'cockpit';
    // K6: ölü geçiş kalmasın — yaz kampı atmosfer kartı
    G.transition = {
      icon: '☀️', title: `${G.meta.season}. Sezon — Yaz Kampı`,
      sub: `${G.club.stadName || 'Tesisler'}'de hazırlıklar başladı: yeni sezon planı masada, çim biçildi, ${G.coach.name} düdüğü taktı.`,
    };
  } else {
    // D6: seçimden önce KAMPANYA FAZI (3 tick, 2 KP/tick) → MÜNAZARA → seçim gecesi
    // B4c-VİTRİN: dönem hedefi tutmadıysa kurul desteği ÇÖKER (seçim çetinleşir)
    if (G.mode === 'vitrin' && G.mandate && !mandateDone(G, G.mandate)) {
      for (const m of G.board || []) m.loyalty = clamp(m.loyalty + TUNING.MEGA.MOD.VITRIN_LOYALTY_CEZA, 0, 100);
      pushInbox(G, { cat: 'manset', t: 'KURUL DESTEĞİNİ ÇEKTİ', sig: 'mandate-fail', b: 'Dayatılan hedef (' + G.mandate.metin + ') tutmadı. Vitrin Başkanı sözleşmesi gereği kurul kampanyada eli taşın altına koymuyor.', noQueue: true });
    } else if (G.mode === 'vitrin' && G.mandate) {
      pushInbox(G, { cat: 'kongre', t: 'Kurul hedefi BAŞARILDI', b: G.mandate.metin + ' — söz tutuldu; kurul kampanyada tam destek verecek.', noQueue: true });
    }
    G.campaign = { tick: 1, kp: TUNING.CAMPAIGN.kpPerTick, swing: 0 };
    G.debateSwing = 0;
    G.phase = 'CAMPAIGN';
    pushInbox(G, { cat: 'kongre', t: 'Kampanya dönemi açıldı', b: 'Seçime 3 hafta. Kampanya puanlarını akıllıca harca — karneyi yenemez ama kıl payını çevirir.' });
  }
}

// ═══ D6: KAMPANYA + MÜNAZARA aksiyonları ═══
export function campaignDo(G, key) {
  if (G.phase !== 'CAMPAIGN' || !G.campaign) return { ok: false };
  const r = applyCampaignAction(G, key);
  if (r.ok) {
    const a = CAMPAIGN_ACTIONS[key];
    pushInbox(G, { cat: 'kongre', t: 'Kampanya: ' + a.label, b: G._negBackfire === true && key === 'negatifKampanya' ? 'Geri tepti! Çamur atana bulaştı — itibar zedelendi.' : a.desc + '.' });
    delete G._negBackfire;
  }
  return r;
}

export function advanceCampaign(G) {
  if (G.phase !== 'CAMPAIGN' || !G.campaign) return { ok: false };
  // M1: dönüş kampanyası — münazara yok (karnen yok), 3 tick sonra doğrudan sandık
  if (G.campaign.comeback) {
    G.campaign.tick++;
    G.campaign.kp = TUNING.CAMPAIGN.kpPerTick;
    if (G.campaign.tick > TUNING.DELUXE.CAMPAIGN_TICKS) comebackElection(G);
    return { ok: true };
  }
  // Rakip aday da sahada (v3-D3): baskı ilk seçimde tam, dönem büyüdükçe söner
  G.rival.attractiveness += TUNING.DELUXE.RIVAL_CAMP * Math.pow(TUNING.DELUXE.RIVAL_CAMP_DECAY, G.meta.term - 1);
  G.campaign.tick++;
  G.campaign.kp = TUNING.CAMPAIGN.kpPerTick;
  if (G.campaign.tick > TUNING.DELUXE.CAMPAIGN_TICKS) {
    // Münazara kurulumu: gerçek karneden 4 soru (en zayıf 2 + en güçlü 1 + rastgele 1)
    const b = (G.lastProj && G.lastProj.breakdown) || { sportif: 50, taraftar: 50, mali: 50, itibar: 50, soz: 50, rival: 10 };
    G.debate = { qs: buildDebate(b), idx: 0, swing: 0, answers: [], rival: b.rival };
    G.phase = 'DEBATE';
  }
  return { ok: true };
}

export function answerDebate(G, ton) {
  if (G.phase !== 'DEBATE' || !G.debate) return { ok: false };
  const q = G.debate.qs[G.debate.idx];
  const puan = scoreDebateAnswer(q, ton, G.debate.rival);
  G.debate.swing += puan;
  G.debate.answers.push({ comp: q.comp, ton, puan });
  G.debate.idx++;
  if (G.debate.idx >= G.debate.qs.length) finishDebate(G);
  return { ok: true, puan };
}

export function skipDebate(G) {
  if (G.phase !== 'DEBATE' || !G.debate) return { ok: false };
  G.debate.swing = TUNING.CAMPAIGN.skipDebate; // katılmamak: −2
  G.debate.skipped = true;
  const mj = muhalif(G.data.media);
  pushInbox(G, { cat: 'manset', t: 'Başkan münazaradan KAÇTI', sig: 'debate-kacti-' + G.meta.term, b: `${mj ? `— ${mj.name} (${mj.outlet})` : ''} Sandık öncesi sahneye çıkmadı; kulisler bunu konuşuyor.` });
  finishDebate(G);
  return { ok: true };
}

function finishDebate(G) {
  const D = TUNING.DELUXE.DEBATE;
  G.debateSwing = clamp(G.debate.swing, -D.MAX, D.MAX);
  runElection(G);
  // B4c-AİLE: kongre değil AİLE MECLİSİ — taraftar+mali ağırlıklı basit formül
  if (G.mode === 'aile') {
    const oy = clamp((0.40 * G.gauges.taraftar + 0.35 * G.gauges.mali + 0.25 * G.gauges.sportif) / 100, 0.05, 0.95);
    G.election.oyOrani = oy;
    G.election.kazandi = oy >= TUNING.WIN_LINE;
    G.election.aile = true;
  }
  // B4d: geri dönüş başarımı — projeksiyon dipteyken kazanmak
  if (G.election.kazandi && (G.voteHistory || []).some((v) => v.oy < 40)) G.aciGeriDonus = true;
  for (const d of checkAchievements(G)) { pushInbox(G, { cat: 'manset', t: '🏅 BAŞARIM: ' + d.name, sig: 'ach-' + d.id, b: d.category + ' rozeti açıldı.', noQueue: true }); G.achToast = d.name; }
  // MİRAS: kariyer oy geçmişi + seçim anı deftere
  (G.career.oyList = G.career.oyList || []).push(G.election.oyOrani);
  anKarti(G, {
    t: G.election.kazandi ? `Seçim kazanıldı (%${Math.round(G.election.oyOrani * 100)})` : `Seçim kaybedildi (%${Math.round(G.election.oyOrani * 100)})`,
    b: G.election.kazandi ? 'Kongre güven tazeledi.' : 'Kongre yön değiştirdi; koltuk el değiştiriyor.',
    etki: 9,
  });
  G.phase = 'ELECTION_NIGHT';
}

// ═══ D3: olay kartı kararı ═══
export function resolveEvent(G, msgId, optIdx) {
  const m = G.inbox.find((x) => x.id === msgId && x.action === 'event');
  if (!m || m.resolved) return { ok: false };
  const opt = (m.event.options || [])[Number(optIdx)];
  if (!opt) return { ok: false };
  m.resolved = true;
  applyEventEffects(G, opt.effects || {});
  pushInbox(G, { cat: 'olay', t: `${m.event.title} → ${opt.label}`, b: (opt.effects && opt.effects.note) || 'Kararın etkileri sahaya ve kasaya yansıdı.' });
  return { ok: true };
}

// ═══ D2: kurul sunumu taahhüdü ═══
export function resolveBoard(G, msgId, key) {
  const m = G.inbox.find((x) => x.id === msgId && x.action === 'board');
  if (!m || m.resolved) return { ok: false };
  if (!applySunum(G, key)) return { ok: false };
  m.resolved = true;
  const opt = SUNUM_OPTIONS.find((o) => o.key === key);
  pushInbox(G, { cat: 'kongre', t: 'Kurul sunumu tamamlandı', b: `Taahhüt: ${opt.label}. ${opt.plus} memnun ayrıldı; ${opt.minus} not etti.` });
  return { ok: true };
}

// B1a: gündem maddesine tonlu cevap — tüm maddeler bitince sunum kapanır + özet
export function resolveAgenda(G, msgId, ton) {
  const m = G.inbox.find((x) => x.id === msgId && x.action === 'agenda');
  if (!m || m.resolved || !m.agenda) return { ok: false };
  const ag = m.agenda;
  const item = ag.items[ag.idx];
  if (!item) return { ok: false };
  const r = scoreAgendaAnswer(G, item, ton);
  // B5a: dönüş kampanyası gündemi — cevaplar loyalty yerine SEÇİM OYUNA (swing) yazar
  if (ag.comeback && G.campaign) G.campaign.swing = clamp((G.campaign.swing || 0) + (r.delta > 0 ? 1 : r.delta < -2 ? -1 : 0), -6, 6);
  ag.sonuc.push({ key: item.key, ton, delta: r.delta, uye: r.uye });
  ag.idx++;
  registerDecision(G, 'agenda:' + ton);
  if (ag.idx >= ag.items.length) {
    m.resolved = true;
    const arti = ag.sonuc.filter((s) => s.delta > 0).length, eksi = ag.sonuc.filter((s) => s.delta < 0).length;
    pushInbox(G, {
      cat: 'kongre', t: 'Kurul sunumu kapandı',
      b: `${ag.items.length} madde işlendi: ${arti} cevap alkış aldı, ${eksi} cevap not edildi. ${eksi > arti ? 'Koridorda fısıltılar var — bütçe masasında hissedersin.' : 'Kurulun eli omzunda — masada elin güçlendi.'}`,
      noQueue: true,
    });
  }
  return { ok: true, kalan: ag.items.length - ag.idx };
}

function evaluatePromise(pr, G) {
  const b = pr.baselineSnapshot || {};
  switch (pr.id) {
    case 'P01': return G.history.seasons.some((s) => s.champion);          // şampiyonluk
    case 'P02': return G.economy.borc <= (b.borc || 0) * 0.5;              // borç yarıya
    case 'P03': return G.facilities.stadyum >= (b.stadyum || 0) + 2;       // stadyum +2
    case 'P04': return G.club.kadroDeger >= (b.kadroDeger || 0) * 1.25;    // kadro değeri +%25
    case 'P06': return G.facilities.antrenman >= (b.antrenman || 0) + 2;   // antrenman +2
    case 'P08': return G.facilities.tibbi >= (b.tibbi || 0) + 2;           // tıbbi +2
    case 'P13': return G.facilities.scout >= 3;                            // scout ≥3
    case 'P15': return G.term.income > 0 && (G.term.wage / G.term.income) <= 0.55; // maaş disiplini
    case 'P21': return !!G.term.starBought;                                 // yıldız transferi (80+)
    case 'P22': return teknikEkip(G.coach) >= 75;                           // yıldız TD
    case 'P23': return G.history.seasons.every((s) => s.pos < TUNING.LEAGUE.RELEGATION_FROM); // ligde kalma
    case 'P24': return (G.term.maxTicket ?? 1) <= 1.0;                      // kombine zammı yok
    default: return false; // marka/akademi-genç/kadın takımı vb. henüz MVP dışı
  }
}

export function runElection(G) {
  const keptMap = {};
  for (const pr of G.promises) keptMap[pr.id] = evaluatePromise(pr, G);
  const j = judgePromises(G, keptMap);
  // D2: muhalif gazeteci tutulmayan vaatlerin ARŞİVCİSİDİR — seçim arifesinde koz yapar
  const mj = muhalif(G.data.media);
  for (const pr of G.promises) {
    if (pr.kept === false) {
      const meta = G.data.promises.find((x) => x.id === pr.id) || {};
      pushInbox(G, { cat: 'manset', t: `"${meta.name || pr.id}" nerede?`, sig: 'arsiv-' + pr.id + '-' + G.meta.term, b: `${mj ? `— ${mj.name} (${mj.outlet})` : ''} Verilmiş sözün arşivi unutmaz.` });
    }
  }
  const r = eleksiyon(G, { baslangicBorc: G.termStartBorc, tutulmayanVaat: j.tutulmayan });
  // D6: münazara/kampanya kayması (±6) oy oranına biner
  const oy = clamp(r.oyOrani + (G.debateSwing || 0) / 100, 0, 1);
  // D7: rakip son konuşması — en zayıf bileşen + tutulmayan vaat
  const b = r.breakdown;
  const weakest = ['sportif', 'taraftar', 'mali', 'itibar', 'soz'].sort((a, c) => b[a] - b[c])[0];
  const weakTr = { sportif: 'sahadaki tablo', taraftar: 'tribünlerin hali', mali: 'kasadaki delik', itibar: 'kulübün itibarı', soz: 'tutulmayan sözler' }[weakest];
  const brokenName = (G.promises.find((p) => p.kept === false) || {}).id;
  const brokenMeta = brokenName ? (G.data.promises.find((x) => x.id === brokenName) || {}).name : null;
  // AÇILIŞ 2d: dönem başında sızan kulis vaadi seçim gecesinde AYNEN geri döner (tutarlılık)
  const kulisEk = G.rakipKulis ? ` Ben ${G.rakipKulis} sözü veriyorum —` : '';
  const rivalSpeech = `"Sayın delegeler — ${weakTr} ortada.${brokenMeta ? ` '${brokenMeta}' sözü ne oldu?` : ''}${kulisEk} Bu kulüp daha iyisini hak ediyor!"`;
  G.election = {
    ...r, oyOrani: oy, kazandi: oy > TUNING.WIN_LINE,
    revealed: false, revealStep: 0, kept: G.promises.map((p) => ({ id: p.id, kept: p.kept })),
    rivalSpeech, debateSwing: G.debateSwing || 0, debateAnswers: (G.debate && G.debate.answers) || [], debateSkipped: !!(G.debate && G.debate.skipped),
  };
  G.debate = null;
}

// D5: TD'nin tek cümlelik maç planı (telkine ve rakibe göre)
function tdPlan(G, telkinType) {
  if (telkinType === 'kale') return '"Kapanıp kontra bekleyeceğiz — sıfır bizim için altın."';
  if (telkinType === 'gencler') return '"Gençlere güveniyorum; cesur oynayacağız."';
  if (telkinType === 'rotasyon') return '"Taze bacaklarla tempo yapacağız."';
  if (telkinType === 'tamkadro') return '"En güçlü on bir sahada — baskıyla boğacağız."';
  return '"Oyun planımız hazır; sahada karşılığını göreceksiniz."';
}

export function startNewTerm(G) {
  // Beklenti eskalasyonu (Bible-13 merdiveni): biten dönemin ort. sırasına göre hedef kayar.
  // Kademe YÜKSELİŞİ kulübü büyütür (taraftar/sponsor/itibar); İNİŞTE simetrik geri alınır.
  const H = G.history.seasons.slice(-TUNING.SEASONS_PER_TERM);
  if (H.length) {
    const avg = H.reduce((s, x) => s + x.pos, 0) / H.length;
    const oldHedef = G.club.hedefSira;
    G.club.hedefSira = escalateHedef(oldHedef, avg);
    const dir = Math.sign(oldHedef - G.club.hedefSira); // +1: hedef küçüldü (yükseliş), −1: iniş
    if (dir !== 0) applyGrowth(G, dir);
  }
  if (G.career) G.career.termsWon++;
  // M2: tier terfi/tenzil — HISTORY sıfırlanmadan önce (küme sezonları kanıt)
  G.consecTerms = (G.consecTerms || 0) + 1;
  G.lossStreak = 0;
  const tierMove = tierCheck(G);
  if (tierMove) { applyTier(G, tierMove); G.consecTerms = 0; }
  G.meta.term++; G.meta.season = 1;
  G.termStartBorc = G.economy.borc;
  G.term = { income: 0, wage: 0, starBought: false, maxTicket: G.economy.ticketPrice };
  G.promises = []; G.sozTutmaBirikim = 0; G.rival = { attractiveness: 0 };
  G.history = { seasons: [] };
  G.coachCandidates = generateCoaches(G.club.reputation, { names: G.data.names }); // yeni dönem TD havuzu
  G.rakipKulis = ['şampiyonluk', 'borçsuz kulüp', 'stadyum yatırımı'][randint(0, 2)]; // AÇILIŞ 2d
  G.election = null;
  G.phase = 'TERM_SETUP';
  if (G.mode === 'vitrin') { G.mandate = pickMandate(G); pushInbox(G, { cat: 'kongre', t: 'KURUL DAYATMASI: ' + G.mandate.metin, b: 'Yeni dönemin zorunlu hedefi masada.', noQueue: true }); }
  // M6: YENİ DÖNEM RİTÜELİ — sessiz geçiş yok: geçen dönemin defter kartları + kurul önünde vizyon
  const oncekiTerm = G.meta.term - 1;
  G.ritual = {
    done: false,
    cards: defterTop(G, 3, (a) => a.term === oncekiTerm),
    title: `${G.meta.term}. Dönem Töreni`,
  };
  G.transition = null; // ritüel atmosfer kartının yerini alır
}

// ── Inbox & metin yardımcıları ──
// Y1: tick başına zorunlu karar ≤2 — fazlası kuyruğa (spam yasağı)
function pushInbox(G, msg) {
  if (msg.action && !msg.noQueue) {
    G.tickDecisions = (G.tickDecisions || 0) + 1;
    if (G.tickDecisions > 2) { (G.decisionQueue = G.decisionQueue || []).push(msg); return; }
  }
  G.inbox.unshift({ id: 'm' + (G._mid = (G._mid || 0) + 1), wk: G.meta ? G.meta.week : 0, ...msg });
  if (G.inbox.length > 30) G.inbox.length = 30;
  eventBus.emit('INBOX', msg);
}
function drainDecisionQueue(G) {
  const q = G.decisionQueue || [];
  G.decisionQueue = [];
  for (const msg of q.slice(0, 2)) pushInbox(G, msg);
  for (const msg of q.slice(2)) (G.decisionQueue = G.decisionQueue || []).push(msg);
}

// ═══ Y4: TEPKİ GARANTİSİ + ZİNCİRLER ═══
// Her karar kaydedilir; anında görünür tepki (inbox) + gerilim yüksekse 2.-3. halka.
export function registerDecision(G, kind) {
  (G.decisions = G.decisions || []).push({ week: G.globalWeek || 0, kind, reacted: true }); // resolver'lar anında inbox basar → 1. halka garantili
  const tension = G.lastTension || 0;
  if (tension >= TUNING.YASAYAN.CHAIN_TENSION) scheduleChain(G, kind);
}
function scheduleChain(G, kind) {
  const q = (G.pendingReactions = G.pendingReactions || []);
  const w = (G.globalWeek || 0);
  if (kind.startsWith('prim') || kind === 'onay') {
    q.push({ due: w + 1, kind: 'tesekkur', src: kind });
    if (rand(0, 1) < 0.3) q.push({ due: w + 1, kind: 'haber', src: kind });
    if (G.economy.borc > 60) q.push({ due: w + 2, kind: 'kurulRahatsiz', src: kind });
  } else if (kind.startsWith('ht:') || kind.startsWith('late:')) {
    if (rand(0, 1) < 0.4) q.push({ due: w + 1, kind: 'haber', src: kind });
  } else {
    q.push({ due: w + 1, kind: 'yanki', src: kind });
  }
}
function fireReactions(G) {
  const q = G.pendingReactions || [];
  const w = G.globalWeek || 0;
  G.pendingReactions = q.filter((r) => {
    if (r.due > w) return true;
    switch (r.kind) {
      case 'tesekkur': {
        const p = G.squad[randint(0, Math.max(0, G.squad.length - 1))];
        G.socialFeed = [{ text: `${(p && p.name) || 'kaptan'}: "başkanımız arkamızda, sahada karşılığını vereceğiz" 🙏`, mood: 'pos', viral: false }, ...(G.socialFeed || [])].slice(0, 4);
        break;
      }
      case 'haber': pushInbox(G, { cat: 'medya', t: 'Kulis: kararın yankısı', b: 'Geçen haftaki hamlen basında dosya oldu — küçük ama olumlu bir yankı.' }); break;
      case 'kurulRahatsiz': pushInbox(G, { cat: 'kongre', t: 'Kurul fısıltısı', b: 'Hesap Adamı: "Borç bu seviyedeyken cömertlik... Kongre bunu unutmaz." (2 hafta önceki kararın gölgesi.)' }); break;
      case 'yanki': G.socialFeed = [{ text: 'tribün konuşuyor: başkanın son kararı bölünme yarattı 👀', mood: 'notr', viral: false }, ...(G.socialFeed || [])].slice(0, 4); break;
    }
    return false;
  });
}

// ═══ Y2: TELEFON / ACİL MODAL ═══
// caller: gm | gazeteci | kurul | menajer — her birinin UI çerçeve rengi farklı.
function countPhone(G, phone) { // her arama BİR kez sayılır (ertelenen geri gelince tekrar sayılmaz)
  // İNSAN: hikaye telefonları (kontrat/sakat/kaptan/olay terfisi) yönetmen bütçesine (6-10) SAYILMAZ
  if (!phone._counted) { phone._counted = true; if (!phone.story) G.phoneCount = (G.phoneCount || 0) + 1; }
}
function ringPhone(G, phone) {
  if (G.phone) { (G.phoneQueue = G.phoneQueue || []).push(phone); return; }
  G.phone = phone;
  countPhone(G, phone);
  G.lastInteractive = G.globalWeek;
}
function nextPhone(G) {
  G.phone = null;
  const q = G.phoneQueue || [];
  if (q.length) { G.phone = q.shift(); countPhone(G, G.phone); }
}
export function answerPhone(G, idx) {
  const ph = G.phone;
  if (!ph) return { ok: false };
  const opt = (ph.options || [])[Number(idx)];
  if (!opt) return { ok: false };
  registerDecision(G, 'phone:' + ph.kind);
  applyPhoneChoice(G, ph, opt);
  nextPhone(G);
  return { ok: true };
}
export function deferPhone(G) {
  const ph = G.phone;
  if (!ph) return { ok: false };
  const Y = TUNING.YASAYAN.PHONE;
  ph.deferred = (ph.deferred || 0) + 1;
  if (ph.file && ph.file.fee) ph.file.fee *= Y.DEFER_FEE;      // fırsat pahalanır
  if (ph.caller === 'menajer' || ph.caller === 'gm') G.tdRelation = clamp((G.tdRelation ?? 70) + 0, 0, 100);
  if (ph.caller === 'gazeteci') { G.mediaTone = (G.mediaTone || 0) - 0.3; pushInbox(G, { cat: 'medya', t: '"Başkana ulaşamadık"', b: 'Ertelediğin arama köşe yazısına döndü — küçük bir iğne.' }); }
  else pushInbox(G, { cat: 'kongre', t: 'Arayan hatırlayacak', b: `${ph.callerName || 'Arayan'} beklemeye alındı; ilişki hafif soğudu, fırsat %10 pahalandı.` });
  G.phoneDeferred = ph;
  nextPhone(G); if (G.phone === ph) G.phone = null; // ertelenen sıradan çıkar
  return { ok: true };
}
function applyPhoneChoice(G, ph, opt) {
  switch (ph.kind + ':' + opt.key) {
    case 'dlbuy:onay': case 'kriz:onay': {
      const f = ph.file;
      if (G.economy.kasa >= f.fee) G.economy.kasa -= f.fee; else { G.economy.borc += f.fee - G.economy.kasa; G.economy.kasa = 0; }
      G.termSpent = (G.termSpent || 0) + f.fee;
      G.sezonAlim = (G.sezonAlim || 0) + f.fee; // B4d
  G.sezonAlim = (G.sezonAlim || 0) + f.fee; // B4d
      if (G.ffp) { G.ffp.spent += f.fee + f.player.wage; if (G.ffp.spent > G.ffp.limit && !G.ffp.taahhut) ffpStrike(G); } // B1d
      G.squad.push(f.player);
      if (f.loan) { f.player.loanIn = true; f.player.contractYears = 1; }
      G.kimya.kimya = clamp(G.kimya.kimya + TUNING.KIMYA_TRANSFER, 0, 100);
      if (f.player.overall >= TUNING.STAR_THRESHOLD && G.term) G.term.starBought = true;
      G.club.kadroDeger = squadMarketValue(G.squad);
      G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
      if (G.windowStats) G.windowStats.onay++;
      pushInbox(G, { cat: 'transfer', t: 'Gece yarısı imza: ' + f.player.name, b: `Telefon kapanmadan el sıkışıldı — ${fmt1(f.fee)}mn.` });
      break;
    }
    case 'dlbuy:beklet': case 'kriz:beklet': { // riskli bekletme: %20 dosya inbox'ta kalır, %80 kaçar
      const f = ph.file;
      const fog = Math.max(1, TUNING.FOG_BASE - G.facilities.scout), h = Math.ceil(fog / 2);
      if (rand(0, 1) < 0.20) {
        pushInbox(G, { cat: 'transfer', t: `${G.gm?.name || 'GM'} (GM): Dosya masada kaldı — ${f.player.name}`, b: `Beklettin, şansın vardı: dosya elimizde. Bedel ${fmt1(f.fee)}mn · ${posTr(f.player.pos)} · ${f.player.age} yaş · güç ${f.player.overall - h}-${f.player.overall + h}. Karar senin.`, action: 'tfile', file: { player: f.player, fee: f.fee, gerekce: 'Beklettiğin fırsat masada kaldı.', range: [f.player.overall - h, f.player.overall + h], sartTried: false, loan: f.loan } });
      } else {
        pushInbox(G, { cat: 'transfer', t: 'Fırsat kaçtı', b: `${f.player.name} beklemedi — başka kapıya gitti. Bekletmek kumardı, bu sefer tutmadı.`, noQueue: true });
      }
      break;
    }
    case 'dlsell:sat': {
      const p = G.squad.find((x) => x.id === ph.playerId);
      if (p) {
        G.squad = G.squad.filter((x) => x !== p);
        G.economy.kasa += ph.offer;
        G.sezonSatis = (G.sezonSatis || 0) + ph.offer; if (p.ocak) G.ocakSatisGelir = (G.ocakSatisGelir || 0) + ph.offer; // B4d
        if (p.overall >= TUNING.STAR_THRESHOLD) { G.gauges.taraftar = clamp(G.gauges.taraftar - 4, 0, 100); for (const q of G.squad) q.morale = clamp(q.morale - 2, 0, 100); }
        G.club.kadroDeger = squadMarketValue(G.squad);
        G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
        pushInbox(G, { cat: 'transfer', t: 'Panik alıcıya satış: ' + p.name, b: `+${fmt1(ph.offer)}mn — dev kulüp gece yarısı ödedi.` });
        captainVoice(G, p); // K2: yıldızsa kaptan sözcülük yapar
        efsaneSatisKontrol(G, p); // M3: efsane küskünlüğü
      }
      break;
    }
    case 'skandal:ceza':
      applyEventEffects(G, { kimya: 2, player: { morale: -8 } });
      G.fedIliski = clamp((G.fedIliski ?? 50) + TUNING.MEGA.FED.CEZA_DISIPLIN, 0, 100); // B1c: disiplinli kulüp imajı
      pushInbox(G, { cat: 'medya', t: 'Disiplin: ceza kesildi', b: 'Gece hayatı haberine sert cevap — soyunma odası mesajı aldı.' });
      break;
    case 'skandal:koru':
      applyEventEffects(G, { player: { morale: 5 }, mediaTone: -1 });
      pushInbox(G, { cat: 'medya', t: 'Başkan oyuncusuna kol kanat gerdi', b: 'Medya sevmedi ama oyuncu bunu unutmaz.' });
      break;
    case 'meydan:cevap': {
      const r = applyDemec(G, 'atesli');
      pushInbox(G, { cat: 'medya', t: 'Rakip adaya sert cevap', b: r.pfdk ? `Ateşli çıkış PFDK'ya takıldı (−${fmt1(r.ceza)}mn) ama tribün ayakta.` : 'Meydan okumaya meydan okumayla cevap — tribün ayakta.' });
      break;
    }
    case 'meydan:sessiz':
      G.rival.attractiveness += 1;
      G.fedIliski = clamp((G.fedIliski ?? 50) + TUNING.MEGA.FED.SESSIZ, 0, 100); // B1c: sessiz diplomasi
      pushInbox(G, { cat: 'medya', t: 'Meydan okuma cevapsız kaldı', b: 'Sükût ikrardan mı sayılır? Kulis öyle okudu.' });
      break;
    // ── B2c: koreografi kararı ──
    case 'koreo:ver': {
      const K = TUNING.MEGA.KOREO;
      G.economy.kasa -= K.KASA;
      G.koreoPending = true; // sonraki EV maçında ev avantajı +%1.5
      G.koreoCount = (G.koreoCount || 0) + 1;
      const rg = radikalGrup(G);
      if (rg) rg.memnuniyet = clamp(rg.memnuniyet + K.RADIKAL, 0, 100);
      nudgeBoyut(G, 'kimlik', K.KIMLIK);
      G.socialFeed = [{ text: 'Koreografi provası sızdı — tribün bu hafta TARİH yazacak 🔥🎨', mood: 'pos', viral: true }, ...(G.socialFeed || [])].slice(0, 4);
      pushInbox(G, { cat: 'karar', t: 'Koreografiye destek verildi', b: 'Kumaşlar kesildi, boyalar hazır. Tribün lideri: "Bu gece unutulmaz olacak Başkanım."', noQueue: true });
      break;
    }
    case 'koreo:verme': {
      const rg = radikalGrup(G);
      if (rg) rg.memnuniyet = clamp(rg.memnuniyet + TUNING.MEGA.KOREO.RET_RADIKAL, 0, 100);
      G.socialFeed = [{ text: 'Koreografi masrafına "bütçe yok" denmiş. Kombine paramız nereye gidiyor? 🤨', mood: 'neg', viral: false }, ...(G.socialFeed || [])].slice(0, 4);
      break;
    }
    // ── B2d: kapak kararı ──
    case 'kapak:kabul': {
      const K = TUNING.MEGA.KAPAK;
      G.gauges.itibar = clamp(G.gauges.itibar + K.ITIBAR_PLUS, 0, 100);
      G.club.reputation = clamp(G.club.reputation * (1 + K.SPONSOR_PLUS), 0, 100);
      if (rand(0, 1) < K.KIBIR_P) G.kapakLanet = { maclar: 0, kayip: 0 }; // kibir yayı: 3 maç izlenir
      pushInbox(G, { cat: 'medya', t: 'KAPAK: "Yılın Başkanı"', b: 'Stüdyo ışıkları, dev manşet, sponsor telefonları... Vitrin parlıyor — şimdi tek görev: sahada da parlamak.', noQueue: true });
      anKarti(G, { t: 'Dergi kapağı', b: '"Yılın Başkanı" dosyası yayında.', etki: 5 });
      break;
    }
    case 'kapak:ret': {
      const rg = radikalGrup(G);
      if (rg) rg.memnuniyet = clamp(rg.memnuniyet + TUNING.MEGA.KAPAK.RET_RADIKAL, 0, 100);
      G.socialFeed = [{ text: 'Başkan kapak teklifini reddetmiş: "Övgü sahaya." İşte BİZDEN biri. 👏', mood: 'pos', viral: rand(0, 1) < 0.3 }, ...(G.socialFeed || [])].slice(0, 4);
      break;
    }
    // ── B1b: transfer savaşı cevabı ──
    case 'savas:cekil': case 'savas:artir': case 'savas:blof': {
      const w = G.transferWar; G.transferWar = null;
      const m = w && G.inbox.find((x) => x.id === w.msgId && !x.resolved);
      if (!m) break;
      if (opt.key === 'cekil') {
        m.resolved = true;
        if (G.windowStats) G.windowStats.red++;
        pushInbox(G, { cat: 'transfer', t: `Dosya kapandı: ${m.file.player.name}`, b: `${w.opp} masaya oturdu, biz kalktık. GM: "Yıpranmadık Başkanım — ama tribün sormasın."`, noQueue: true });
      } else if (opt.key === 'artir') {
        m.file.fee = Math.round(m.file.fee * TUNING.MEGA.RAKIP.ARTIR_MULT * 10) / 10;
        pushInbox(G, { cat: 'transfer', t: `Bedel yükseldi: ${m.file.player.name}`, b: `Rakibe geri adım yok — dosya ${fmt1(m.file.fee)}mn'ye çıktı ama masa bizim.`, noQueue: true });
      } else if (w.bluf) {
        pushInbox(G, { cat: 'transfer', t: `BLÖF ÇÖKTÜ: ${w.opp} çekildi`, b: 'Menajer güldü: "Teklifleri yokmuş bile." Dosya aynı bedelle masada — soğukkanlılık kazandı.', noQueue: true });
        anKarti(G, { t: 'Blöf görüldü', b: `${w.opp} başkanının restini gördün; masa bize kaldı.`, etki: 5 });
      } else {
        m.resolved = true;
        pushInbox(G, { cat: 'transfer', t: `Oyuncu rakibe gitti: ${m.file.player.name}`, b: `${w.opp} sözünü tuttu, üstüne koydu, imzayı aldı. GM: "Rest çekilirken kasaya bakılır Başkanım."`, noQueue: true });
        anKarti(G, { t: `Transfer savaşı kaybedildi: ${m.file.player.name}`, b: 'Blöf sanılan teklif gerçekti.', etki: -5 });
      }
      break;
    }
    // ── K2: kaptan kriz araması ──
    case 'kaptan:dinle': {
      const K = TUNING.INSAN.KAPTAN;
      // B3b: vitrin bağlamındaysa "yanlış anlaşılma" — kaptan vitrinden çekilir
      if (G.vitrinKaptanId != null) {
        const kp = G.squad.find((x) => x.id === G.vitrinKaptanId);
        if (kp && kp.vitrin) { kp.vitrin = false; kp.morale = clamp(kp.morale + 4, 0, 100); }
        G.vitrinKaptanId = null;
        pushInbox(G, { cat: 'transfer', t: 'Kaptan vitrinden çekildi', b: '"Yanlış anlaşılma" dendi, el sıkışıldı. Pazubant yerinde — ama kaptan bu telefonu unutmaz.', noQueue: true });
        break;
      }
      for (const p of G.squad) p.morale = clamp(p.morale + K.KRIZ_MORAL, 0, 100);
      pushInbox(G, { cat: 'karar', t: 'Kaptanla kapalı kapı görüşmesi', b: 'Kaptan odadan başı dik çıktı; mesaj soyunma odasına taşındı: "Başkan arkamızda." Hava yumuşadı.', noQueue: true });
      break;
    }
    case 'kaptan:kes': {
      const K = TUNING.INSAN.KAPTAN;
      const kp = G.squad.find((x) => x.id === ph.options.find((o) => o.key === 'kes')?.playerId) || captain(G);
      if (kp) kp.morale = clamp(kp.morale + K.KRIZ_RED_MORAL, 0, 100);
      pushInbox(G, { cat: 'karar', t: 'Kaptan eli boş döndü', b: '"Sahaya baksınlar" cevabı koridorda yankılandı. Kaptan sustu — ama unutmadı.', noQueue: true });
      break;
    }
    // ── K3: sözleşme masası ──
    case 'kontrat:kabul': {
      const saga = G.contractSaga;
      const p = saga && G.squad.find((x) => x.id === saga.playerId);
      if (p && saga.ask) {
        p.wage = saga.ask.wage; p.contractYears = saga.ask.years; p.morale = clamp(p.morale + TUNING.INSAN.KONTRAT.KABUL_MORAL, 0, 100);
        p.sagaDone = true; saga.signed = true; G.contractSaga = null;
        if (G.ffp) G.ffp.spent += p.wage * 0.5; // maaş artışı limite yazılır (yarı ağırlık)
        pushInbox(G, { cat: 'transfer', t: `İMZA: ${p.name} ${saga.ask.years} yıl daha`, b: `Masa kapandı: ${fmt1(saga.ask.wage)}mn maaşla sözleşme uzatıldı. Tribün rahatladı, menajer memnun, oyuncu sahaya borçlu.`, noQueue: true });
        G.socialFeed = [{ text: `${p.name} imzayı attı! Söylentilere son 🖊️`, mood: 'pos', viral: rand(0, 1) < 0.25 }, ...(G.socialFeed || [])].slice(0, 4);
      }
      break;
    }
    case 'kontrat:pazarlik': {
      const saga = G.contractSaga;
      if (saga) { saga.state = 'pazarlik'; saga.nextWk = G.meta.week + TUNING.INSAN.KONTRAT.TUR_ARASI; }
      pushInbox(G, { cat: 'transfer', t: `${G.gm.name} (GM) masaya oturdu`, b: 'Talimat net: "Orta yolu bul, kulübü yakma." Birkaç hafta içinde dönüş yapar.', noQueue: true });
      break;
    }
    case 'kontrat:beklet': {
      const saga = G.contractSaga;
      if (saga) saga.state = 'beklet';
      pushInbox(G, { cat: 'transfer', t: 'Sözleşme masası bekletiliyor', b: 'Kumar açık: form düşerse rakam düşer, patlarsa menajer bileği bükülmez olur. Sezon sonuna dikkat — bedava gider.', noQueue: true });
      break;
    }
    // ── K4: erken dönüş kararı ──
    case 'sakat:erken': {
      const saga = G.injurySaga;
      const p = saga && G.squad.find((x) => x.id === saga.playerId);
      if (p) {
        p.injuryWeeks = 0;
        if (rand(0, 1) < TUNING.INSAN.SAKAT.ERKEN_NUKS_P) saga.nuks = true; // fatura maç sonrası kesilir
        else G.injurySaga = null;
        pushInbox(G, { cat: 'saglik', t: `${p.name} erken dönüyor`, b: 'Bandajlandı, sahada. TD memnun, sağlık ekibi dudak büküyor — kumar oynandı.', noQueue: true });
      }
      break;
    }
    // ── M3: jübile kararı ──
    case 'jubile:jorganize': case 'jubile:jsessiz': {
      const oid = (ph.options.find((o) => o.playerId != null) || {}).playerId; // dikkat: id 0 geçerli
      const p = G.squad.find((x) => x.id === oid);
      if (p) jubileResolve(G, p, opt.key === 'jorganize');
      break;
    }
    case 'sakat:sabir': {
      const p = G.injurySaga && G.squad.find((x) => x.id === G.injurySaga.playerId);
      pushInbox(G, { cat: 'saglik', t: 'Dönüş programı korunuyor', b: `${p ? p.name : 'Oyuncu'} bir hafta daha revirde. "Acele eden, iki kez sakatlanır." — Sağlık Ekibi`, noQueue: true });
      if (G.injurySaga) G.injurySaga.sabir = true;
      break;
    }
    default:
      // K1: telefonla gelen OLAY kartı — seçenek etkileri aynı olay motorundan uygulanır
      if (ph.kind === 'olay' && ph.event && opt.key.startsWith('ev')) {
        const evOpt = (ph.event.options || [])[Number(opt.key.slice(2))];
        if (evOpt) {
          applyEventEffects(G, evOpt.effects || {});
          pushInbox(G, { cat: 'olay', t: `${ph.title} — ${evOpt.label}`, b: (evOpt.effects && evOpt.effects.note) || `${ph.callerName || 'Arayan'} cevabını aldı; konu kapandı.`, noQueue: true });
        }
        break;
      }
      if (opt.key === 'red') { if (G.windowStats) G.windowStats.red++; pushInbox(G, { cat: 'transfer', t: 'Telefon kapandı: ret', b: `${ph.callerName || 'Arayan'} cevabı aldı; dosya kapandı.` }); }
      break;
  }
}
// Yönetmen telefon üretimi: state'ten doğan anlar (skandal / rakip meydan okuma / kriz fırsatı)
// K2: kriz haftasında KAPTAN arar — içeriden ses; yönetmen bütçesinden bağımsız
// (kriz anı kaçmaz) ama sezon tavanına (10) saygılıdır. Sezonda 1 kez.
function maybeCaptainCall(G) {
  if (G.phone && G.phone.kind !== 'kaptan') { /* kuyruk yine de alır */ }
  const kap = captain(G);
  const son3 = (G.recent || []).slice(-3);
  const seriKriz = son3.length === 3 && son3.every((x) => x === 0);          // 3 üst üste mağlubiyet
  const moralKriz = G.squad.length && G.squad.reduce((s, p) => s + p.morale, 0) / G.squad.length < 45; // soyunma odası dipte
  if (!kap || !(seriKriz || moralKriz) || G.kaptanAradiHafta || (G.phoneCount || 0) >= 10) return;
  G.kaptanAradiHafta = G.meta.week;
  ringPhone(G, {
    kind: 'kaptan', story: true, caller: 'kaptan', callerName: `${kap.name} (Kaptan)`,
    title: 'Kaptan hattında: "Takım adına konuşmam gerek"',
    body: `"Başkanım, soyunma odası ağır. Üç maçtır tünelde ışık göremiyoruz; arkadaşlarım kulübün arkalarında olduğunu duymak istiyor. Beş dakikanızı istiyorum."`,
    options: [
      { key: 'dinle', label: 'Dinle + arkalarında ol', whisper: 'takım morali ısınır · söz senedi doğar', playerId: kap.id },
      { key: 'kes', label: '"Sahaya baksınlar"', whisper: 'otorite mesajı · kaptan kırılır', playerId: kap.id },
    ],
  });
}
function maybePhone(G, tension) {
  maybeCaptainCall(G);
  if (G.phone || !phoneAllowed(G, tension)) return;
  const alev = G.squad.find((p) => p.personality === 'Alevlenebilir' && p.morale < 60);
  const secim = G.meta.season === TUNING.SEASONS_PER_TERM && G.meta.week >= 20;
  if (alev && rand(0, 1) < 0.4) {
    ringPhone(G, { kind: 'skandal', caller: 'gazeteci', callerName: 'Nazlı Ekinci (Bilanço)', title: 'GECE YARISI: skandal haberi', body: `${alev.name} gece kulübünde görüntülenmiş — sabah manşete çıkıyor. Ne diyorsun Başkan?`, options: [{ key: 'ceza', label: 'Ceza kes (disiplin)' }, { key: 'koru', label: 'Kol kanat ger' }] });
  } else if (secim) {
    ringPhone(G, { kind: 'meydan', caller: 'kurul', callerName: 'Kurul kulisi', title: 'Rakip aday meydan okudu', body: 'Rakip başkan adayı canlı yayında seni hedef aldı: "Bu yönetim yoruldu." Cevap verecek misin?', options: [{ key: 'cevap', label: 'Sert cevap ver (ateşli)' }, { key: 'sessiz', label: 'Sessiz kal' }] });
  } else {
    const p = new Player({ id: 'ph' + (G._pid = (G._pid || 1000) + 1), name: gmPickName(G), pos: ['DEF', 'MID', 'FWD'][randint(0, 2)], overall: randint(Math.round(G.temelGuc), Math.round(G.temelGuc) + 7), potential: 0, age: randint(23, 29), contractYears: 2 });
    p.potential = p.overall; p.wage *= (G.marketMult || 1);
    const fee = transferFee(p) * (G.marketMult || 1) * 0.85;
    const fogK = Math.max(1, TUNING.FOG_BASE - G.facilities.scout), hK = Math.ceil(fogK / 2);
    ringPhone(G, { kind: 'kriz', caller: 'gm', callerName: `${G.gm.name} (GM)`, title: 'GECE YARISI FIRSATI', body: `Kriz kulübü nakit sıkışmış — ${p.name} (${posTrPhone(p.pos)}, ${p.age} yaş, güç ${p.overall - hK}-${p.overall + hK}) piyasa altına verilir: ${fmt1(fee)}mn. Sabaha kadar geçerli.`, options: [{ key: 'onay', label: `ONAYLA (${fmt1(fee)}mn)` }, { key: 'red', label: 'REDDET' }, { key: 'beklet', label: '⏳ Beklet (%20 dosya kalır, %80 kaçar)' }], file: { player: p, fee } });
  }
}
const posTrPhone = (p) => ({ GK: 'kaleci', DEF: 'stoper', MID: 'orta saha', FWD: 'forvet' }[p] || p);

// Y1: sıkıcı hafta enjeksiyonu — state'ten doğan an
function injectMoment(G, inject) {
  if (inject.kind === 'gorusme') {
    pushInbox(G, { cat: 'karar', t: `${inject.player} görüşme istiyor`, b: `${inject.player} kapını çaldı: morali dipte, gözü yerde. "Beş dakikanızı istiyorum Başkanım" dedi — yaklaşımını sen seçeceksin.`, action: 'event', event: { title: 'Birebir görüşme', options: [{ label: 'Babacan yaklaş', whisper: 'gönül alınır · moral ısınır', effects: { player: { morale: 5 } } }, { label: 'Profesyonel konuş', whisper: 'mesafeli ama net · çoğu karaktere iyi gelir', effects: { player: { morale: 4 } } }, { label: 'Sert uyar', whisper: 'disiplin mesajı · kırılgansa ters teper', effects: { player: { morale: -4 }, kimya: 2 } }] } });
  } else if (inject.kind === 'cfoToplanti') {
    pushInbox(G, { cat: 'karar', t: (G.staff?.cfo ? G.staff.cfo.name + ' (CFO)' : 'Mali müşavir') + ': acil toplantı', b: 'Mali masa borç tablosunu önüne serdi: faiz kalemi büyüyor, nakit akışı gergin. Rota kararı senden.', action: 'event', event: { title: 'Mali yol haritası', options: [{ label: 'Kemer sıkma (2 hafta)', whisper: 'kasa nefes alır · tribün inceden homurdanır', effects: { economy: { kasa: 3 }, gauge: { taraftar: -1 } } }, { label: 'Rotayı koru', whisper: 'değişiklik yok · risk sürer', effects: {} }] } });
  } else {
    pushInbox(G, { cat: 'karar', t: 'Medyadan söyleşi teklifi', b: 'Popüler spor programı canlı yayına davet ediyor: takım formda, herkes başkanı duymak istiyor. Tonu sen belirleyeceksin.', action: 'event', event: { title: 'Söyleşi', options: [{ label: 'İddialı konuş', whisper: 'tribün coşar · beklenti şişer', effects: { gauge: { taraftar: 3 } } }, { label: 'Ayakları yere bas', whisper: 'medya tonu yumuşar', effects: { mediaTone: 0.5 } }] } });
  }
}

// Y8: vaat şeridi risk uyarısı — pct düşüşünde ilgili staff yazar (tek sefer)
function promiseRiskWatch(G) {
  const st = promiseStatus(G);
  G.promiseSnapshot = G.promiseSnapshot || {};
  for (const v of st) {
    const prev = G.promiseSnapshot[v.id];
    if (prev != null && prev >= 55 && v.pct < 55) {
      const meta = G.data.promises.find((x) => x.id === v.id) || {};
      const kim = meta.metric === 'borc' || meta.metric === 'wageRatio' ? (G.staff?.cfo ? G.staff.cfo.name + ' (CFO)' : 'Mali masa') : meta.metric === 'akademi' ? (G.staff?.akademi ? G.staff.akademi.name : 'Akademi') : G.gm.name + ' (GM)';
      pushInbox(G, { cat: 'vaat', t: `RİSKTE: ${v.name}`, b: `${kim}: "Bu vaat rotadan çıkıyor Başkanım — müdahale şart, yoksa seçim sandığında karşımıza çıkar."` });
    }
    G.promiseSnapshot[v.id] = v.pct;
  }
}

// Y5: tribün canlı şeridi (maç ekranı) — radikal/ılımlı tonları ayrışır
function makeMatchFeed(G, { myGoals, oppGoals, myRes, isDerby }) {
  const pool = (G.data.social && G.data.social.matchLive) || null;
  if (!pool) return [];
  const pick = (arr) => arr[randint(0, Math.max(0, arr.length - 1))] || '';
  const out = [];
  const rg = radikalGrup(G);
  for (let i = 0; i < Math.min(myGoals, 3); i++) out.push({ who: rg ? rg.name : 'Tribün', text: pick(isDerby ? pool.golDerbi : pool.golPatlama), mood: 'pos' });
  if (myGoals > 0) out.push({ who: 'Doğu Tribünü', text: pick(pool.ilimli), mood: 'pos' });
  if (oppGoals - myGoals >= 3) out.push({ who: rg ? rg.name : 'Tribün', text: pick(pool.hezimet), mood: 'neg' });
  else if (myRes === 'L') out.push({ who: rg ? rg.name : 'Tribün', text: pick(pool.radikal), mood: 'neg' });
  if (!out.length) out.push({ who: 'Doğu Tribünü', text: pick(pool.ilimli), mood: 'notr' });
  return out.slice(0, 5);
}
// Y5: ertesi sabah yankısı
function makeMorningEcho(G, myRes, isDerby) {
  const pool = (G.data.social && G.data.social.morning) || null;
  if (!pool) return null;
  const arr = myRes === 'W' ? pool.galibiyet : myRes === 'L' ? pool.maglubiyet : pool.beraberlik;
  const pick = () => ({ text: arr[randint(0, arr.length - 1)], mood: myRes === 'W' ? 'pos' : myRes === 'L' ? 'neg' : 'notr', viral: isDerby && rand(0, 1) < 0.3 });
  return [pick(), pick()];
}
// Y8: maç raporu karakter cümlesi
function matchCharSentence(G, { myRes, myGoals, oppGoals, isDerby, adam }) {
  const pool = (G.data.media && G.data.media.matchChar) || null;
  if (!pool) return '';
  const key = isDerby ? 'derbi' : (oppGoals - myGoals >= 3) ? 'hezimet' : (myGoals - oppGoals >= 3) ? 'gosteri' : myRes === 'W' ? 'galibiyet' : myRes === 'L' ? 'maglubiyet' : 'beraberlik';
  const arr = pool[key] || pool.galibiyet;
  return (arr[randint(0, arr.length - 1)] || '').replace('{oyuncu}', adam || 'kaptan').replace('{dk}', 85 + randint(0, 8));
}

// ═══ Y6: MASA DOKUNUŞLARI ═══
export function deskAction(G) {
  if (!G.deskCard || G.deskUsedThisTick) return { ok: false };
  const D = TUNING.YASAYAN.DESK;
  const key = G.deskCard;
  G.deskUsedThisTick = true;
  G.lastDesk = key;
  G.deskCounts = G.deskCounts || {};
  G.deskCounts[key] = (G.deskCounts[key] || 0) + 1;
  registerDecision(G, 'desk:' + key);
  if (key === 'antrenman') { for (const p of G.squad) p.morale = clamp(p.morale + D.moralePlus, 0, 100); }
  else if (key === 'dernek') { G.gauges.taraftar = clamp(G.gauges.taraftar + D.taraftarPlus, 0, 100); }
  else if (key === 'sponsor') { G.club.reputation = clamp(G.club.reputation + D.sponsorRep, 0, 100); }
  else if (key === 'genc') { G.fogNarrow = (G.fogNarrow || 0) + 0; } // sis mikro (görsel/scout hissi)
  if (rand(0, 1) < D.CHAT_P) pushInbox(G, { cat: 'kongre', t: 'Kısa sohbet', b: deskChat(key) });
  else pushInbox(G, { cat: 'kongre', t: DESK_CARDS[key].label, b: DESK_CARDS[key].desc + ' Küçük ama görünür bir dokunuş.' });
  return { ok: true };
}
const deskChat = (k) => ({
  antrenman: 'Kaptan yanına geldi: "Başkanım, sahada görmek iyi geliyor." Küçük şeyler büyük.',
  dernek: 'Dernek başkanı kulağına eğildi: "Tribün seni konuşuyor — iyi anlamda."',
  sponsor: 'Sponsor CEO\'su memnun: "Bu masada uzun vadeli düşünen biri var."',
  genc: 'Akademi hocası fısıldadı: "Şu sağ açığa bir bakın derim — özel bir çocuk."',
}[k] || '');
// ═══ PAKET MİRAS & UZUN OYUN ═══
// ── M5 BAŞKANIN DEFTERİ: |etki|si yüksek kararlar otomatik "an kartı" ──
export function anKarti(G, { t, b, etki }) {
  (G.defter = G.defter || []).push({ t, b, etki, sezon: G.worldSeason || 1, hafta: Math.min(G.meta.week, G.SEASON_WEEKS), term: G.meta.term });
  if (Math.abs(etki) >= TUNING.MIRAS.DEFTER.MUZE_ETKI) pushMuze(G, { tip: 'an', t, b });
}
export function defterTop(G, n, filtre = null) {
  let list = G.defter || [];
  if (filtre) list = list.filter(filtre);
  return list.slice().sort((a, b) => Math.abs(b.etki) - Math.abs(a.etki)).slice(0, n);
}
// ── M7 MÜZE: kupa/rekor/jübile/an kartları birikir ──
function pushMuze(G, kart) {
  (G.museum = G.museum || []).push({ ...kart, sezon: G.worldSeason || 1 });
}

// ── M1 MUHALEFET DÖNEMİ (Bible-17) ──
export function afterElectionLoss(G) {
  G.lossStreak = (G.lossStreak || 0) + 1;
  G.consecTerms = 0;
  if (G.lossStreak >= TUNING.MIRAS.OPP_LOSS_CAP) { endCareer(G, 'iki üst üste seçim kaybı'); return; }
  enterOpposition(G);
}
export function enterOpposition(G) {
  // Devir-teslim raporu: ne bıraktın — SAKLANIR (dönüş kozun / yükün)
  const tutulmayan = (G.promises || []).filter((p) => p.kept === false)
    .map((p) => (G.data.promises.find((x) => x.id === p.id) || {}).name || p.id);
  G.devirRaporu = {
    borc: Math.round(G.economy.borc), kasa: Math.round(G.economy.kasa),
    kadroDeger: Math.round(G.club.kadroDeger), pos: G.lastSeason ? G.lastSeason.pos : G.myPos,
    tutulmayan, term: G.meta.term,
  };
  const adSoyad = uniqueName(G.data.names, G.usedNames || (G.usedNames = {})) || 'Yeni Başkan';
  G.opposition = {
    season: 0, cards: [],
    pres: { name: adSoyad, type: OPP_TYPES[randint(0, OPP_TYPES.length - 1)] },
    st: { borc: G.economy.borc, kadroDeger: G.club.kadroDeger, tesisOrt: 3, hedefSira: G.club.hedefSira, guc: Math.round(G.temelGuc), posList: [] },
  };
  G.phase = 'OPPOSITION';
}
// Bir muhalefet sezonu izlenir (müdahale yok): 1 büyük karar + sonucu
export function oppositionNext(G) {
  const o = G.opposition;
  if (!o || o.season >= TUNING.MIRAS.OPP_SEASONS) return { ok: false };
  o.season++;
  const kart = oppositionSeason(o.pres.type, o.st);
  o.cards.push({ sezon: o.season, ...kart });
  return { ok: true, done: o.season >= TUNING.MIRAS.OPP_SEASONS };
}
// "Aday ol" → kampanya fazı (rakip: görevdeki başkan; onun karnesi senin kozun)
export function startComeback(G) {
  if (!G.opposition || G.opposition.season < TUNING.MIRAS.OPP_SEASONS) return { ok: false };
  G.campaign = { tick: 1, kp: TUNING.CAMPAIGN.kpPerTick, swing: 0, comeback: true };
  G.rival = { attractiveness: 0 };
  G.phase = 'CAMPAIGN';
  // B5a: dönüş kampanyasında ENKAZ, kurul gündemi sistemiyle (B1a) madde madde işlenir —
  // her cevap dönüş seçimi oyuna (campaign.swing) yazar.
  const o = G.opposition, D = G.devirRaporu || {};
  const posOrt = o.st.posList.reduce((a, b) => a + b, 0) / Math.max(o.st.posList.length, 1);
  const items = [
    { key: 'borc', title: `Borç hesabı: sen ${D.borc}mn bıraktın, o ${Math.round(o.st.borc)}mn'ye taşıdı`, comp: o.st.borc > D.borc ? 70 : 40, uye: 'Hesap Adamı' },
    { key: 'sira', title: `Üç sezonun sıra ortalaması: ${posOrt.toFixed(0)}. (hedef ${o.st.hedefSira}.)`, comp: posOrt > o.st.hedefSira ? 70 : 40, uye: 'Eski Futbolcu' },
    { key: 'kadro', title: 'Satılan direkler: kadronun omurgasına ne oldu?', comp: o.st.kadroDeger < D.kadroDeger ? 70 : 40, uye: 'Nostaljik' },
  ];
  pushInbox(G, {
    cat: 'kongre', t: 'Dönüş mitingi: enkazı kurul önünde işle',
    b: 'Delege salonu dolu. Görevdeki başkanın karnesi elinde — her maddeyi nasıl işleyeceğin sandığa yazacak (veri: enkaz gerçekse vurucu · vizyon: güvenli · kabul: alçakgönüllü).',
    action: 'agenda', agenda: { items, idx: 0, sonuc: [], comeback: true }, noQueue: true,
  });
  return { ok: true };
}
function comebackElection(G) {
  const o = G.opposition;
  const oy = comebackVote(G.devirRaporu, o.st, G.campaign.swing || 0);
  const posOrt = o.st.posList.reduce((a, b) => a + b, 0) / Math.max(o.st.posList.length, 1);
  // ELECTION_NIGHT sahnesi için karşılaştırmalı karne (0-100)
  const breakdown = {
    sportif: clamp(Math.round(100 - posOrt * 5), 0, 100),
    taraftar: clamp(Math.round(G.gauges.taraftar), 0, 100),
    mali: clamp(Math.round(100 - (o.st.borc - G.devirRaporu.borc) * 0.8), 0, 100),
    itibar: clamp(Math.round(G.gauges.itibar), 0, 100),
    soz: 50,
    rival: clamp(Math.round(50 + (G.devirRaporu.borc - o.st.borc) * 0.5), 5, 95),
  };
  G.election = {
    oyOrani: oy, kazandi: oy >= 0.5, comeback: true, breakdown, revealStep: 0,
    rivalSpeech: `"${G.opposition.pres.name} dönemi daha yeni başladı — eski başkanın enkazını hâlâ temizliyoruz!"`,
  };
  G.career = G.career || {}; (G.career.oyList = G.career.oyList || []).push(oy);
  G.phase = 'ELECTION_NIGHT';
}
// Dönüş zaferi: ENKAZ raporu + staff dağılmış (Paket A bağlantısı) — yeniden kur
export function applyComebackWin(G) {
  const o = G.opposition, D = G.devirRaporu;
  const enkaz = [];
  // 3 muhalefet sezonu kadroya işler: yaşlanma + AI tipinin satışları
  for (let i = 0; i < TUNING.MIRAS.OPP_SEASONS; i++) developSquad(G.squad, G.facilities);
  if (o.pres.type === 'AVCI' || o.pres.type === 'MUHASEBECI') {
    const satilan = G.squad.slice().sort((a, b) => b.marketValue - a.marketValue).slice(0, 2);
    G.squad = G.squad.filter((p) => !satilan.includes(p));
    enkaz.push(`Kadronun iki direği satılmış: ${satilan.map((p) => p.name).join(', ')}`);
  }
  G.economy.borc = Math.max(0, Math.round(o.st.borc));
  if (G.economy.borc > D.borc + 5) enkaz.push(`Borç ${D.borc}mn'den ${G.economy.borc}mn'ye şişmiş`);
  if (G.economy.borc < D.borc - 5) enkaz.push(`Borç ${D.borc}mn'den ${G.economy.borc}mn'ye inmiş — ama sahada karşılığı yok`);
  const posOrt = o.st.posList.reduce((a, b) => a + b, 0) / Math.max(o.st.posList.length, 1);
  if (posOrt > o.st.hedefSira + 2) enkaz.push(`Üç sezonun sıra ortalaması ${posOrt.toFixed(0)}. — beklentinin altı`);
  if (TUNING.MIRAS.ENKAZ.STAFF_DAGILIR) {
    G.staff = { cfo: null, akademi: null, basin: null, stat: null, tis: null };
    enkaz.push('Yönetim kadrosu dağılmış — dört koltuk boş (yeniden kur: gerçek maliyet)');
  }
  G.kimya.kimya = clamp(G.kimya.kimya + TUNING.MIRAS.ENKAZ.KIMYA, 0, 100);
  G.captainId = G.squad.some((p) => p.id === G.captainId) ? G.captainId : null;
  G.club.kadroDeger = squadMarketValue(G.squad);
  G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
  G.enkazRaporu = { maddeler: enkaz.length ? enkaz : ['Devraldığın kulüp beklediğinden az yıpranmış — şanslısın.'], pres: o.pres };
  G.lossStreak = 0;
  G.comebackWon = true; // B4d başarım
  G.opposition = null;
  anKarti(G, { t: 'Koltuğa dönüş', b: `${o.pres.name} yenildi; kongre eski başkanını geri çağırdı.`, etki: 10 });
  pushInbox(G, { cat: 'kongre', t: 'ENKAZ RAPORU masanda', b: G.enkazRaporu.maddeler.join(' · '), noQueue: true });
}
// ── M4 KARİYER KAPANIŞ ──
export function endCareer(G, reason) {
  const tag = legacyTag(G);
  G.careerEnd = {
    reason, tag,
    termsWon: (G.career && G.career.termsWon) || 0,
    seasons: (G.career && G.career.seasons) || 0,
    titles: (G.career && G.career.titles) || 0,
    cups: (G.career && G.career.cups) || 0,
    oyOrt: G.career && G.career.oyList && G.career.oyList.length
      ? G.career.oyList.reduce((a, b) => a + b, 0) / G.career.oyList.length : null,
    borcHistory: (G.borcHistory || []).slice(),
    yildizlar: (G.altinCocuklar || []).slice(),
    kimlik: G.identityTag || null,
    telkinProfil: telkinKarne((G.telkinLog || [])),
    anlar: defterTop(G, TUNING.MIRAS.DEFTER.KARIYER_AN),
  };
  // B5c: gizli federasyon hattı kapanışa SIZAR (tek yer burası)
  const fh = G.fedHistory || [];
  const fedOrt = fh.length ? fh.reduce((a, b) => a + b, 0) / fh.length : 50;
  if (fedOrt < 30) G.careerEnd.yanNot = 'Federasyonla Kavgalı';
  else if (fedOrt > 75) G.careerEnd.yanNot = 'Koridorların Adamı';
  // B4a: senaryo hedefi kapanış etiketine yansır
  if (G.scenario && G.scenario.done) G.careerEnd.senaryoNotu = `Senaryo hedefi başarıldı: ${G.scenario.ad}`;
  G.phase = 'CAREER_END';
}
export function retire(G) { endCareer(G, 'kendi kararıyla emeklilik'); }

// ── M2 TIER TERFİ/TENZİL (Bible-20) ──
// 2. LİG takım havuzu — üst ligden AYRI, taşra/alt-lig havası (mantık: farklı ligde farklı rakipler)
const LIG2_TEAM_NAMES = [
  'Yeşilova Belediyespor', 'Karabük Demir', 'Ovaçay SK', 'Gölbaşı Gençlik', 'Taşpınar Belediye',
  'Kavaklıdere SK', 'Değirmenlik FK', 'İncesu Birliği', 'Poyraz SK', 'Karlıtepe Gençlik',
  'Selimpaşa SK', 'Doğanşehir Belediye', 'Menteşe FK', 'Ardıçlı SK', 'Bereketli Gençlik',
  'Çamlıca SK', 'Söğütlü Belediyespor', 'Kayalık FK',
];
function buildLadder(G, boost = 0) {
  const L = TUNING.LEAGUE, lig = G.lig || 1;
  // Küme düşen (üst-lig kaliteli) kulüp 2. ligde ezer → toparlanma; 2. ligden BAŞLAYAN kulüp dengi rakiplerle yarışır
  const ligDrop = (lig === 2 && !G.lig2Native) ? L.LIG2_STRENGTH_DROP : 0;
  const base = Math.round(G.temelGuc) + boost - ligDrop;
  // 2. ligde hedef = terfi bandı (ilk 3); üst ligde kulüp beklentisi
  const hedef = lig === 2 ? L.LIG2_HEDEF : TUNING.EXPECT.HEDEF_SIRA[G.club.beklenti];
  G.club.hedefSira = hedef;
  const stronger = clamp(hedef - 1, 0, 17), weaker = 17 - stronger;
  const offsets = [...linspace(25, 8, stronger), ...linspace(-2, -25, weaker)];
  // Lig-duyarlı isim havuzu: üst lig teams.json, 2. lig kendi taşra kulüpleri
  const names = lig === 2 ? LIG2_TEAM_NAMES : (G.data.teams || []).map((t) => t.name);
  G.opponents = initAIClubs(offsets.map((off, i) => ({ id: 'o' + i, name: names[i] || ('Rakip ' + i), strength: clamp(Math.round(base + off), 25, 92) })));
  // B1b: AI kulüplerin başkanları isimli kişilerdir — yüzleşmeler onlarla yaşanır
  for (const o of G.opponents) o.baskan = uniqueName(G.data.names, G.usedNames || (G.usedNames = {})) || 'Rakip Başkan';
  G.club.rivalName = G.opponents[0].name;
}
function applyTier(G, { dir, to }) {
  const T = TIERS[to], B = TUNING.MIRAS.TIER.BLEND;
  const from = G.club.tier;
  G.club.tier = to;
  // 1 sezonluk geçiş: ilk adım %50 harman (şok yok) — kalan yarım initSeason'da tamamlanır
  G.club.fanCount = Math.round(G.club.fanCount + (T.fan - G.club.fanCount) * B);
  G.club.reputation = Math.round(G.club.reputation + (T.reputation - G.club.reputation) * B);
  G.club.stadiumCapacity = Math.round(G.club.stadiumCapacity + (T.stad - G.club.stadiumCapacity) * B);
  G.club.beklenti = T.beklenti;
  G.club.hedefSira = TUNING.EXPECT.HEDEF_SIRA[T.beklenti];
  G.kimya.bigMatchExp = CLUB[to] ? CLUB[to].bigExp : G.kimya.bigMatchExp;
  G.tierShift = { to, kalan: 1 };
  buildLadder(G, dir === 'up' ? TUNING.MIRAS.TIER.LADDER_BOOST : -TUNING.MIRAS.TIER.LADDER_BOOST); // rakip kalitesi de seviyeyle oynar
  (G.tierHistory = G.tierHistory || []).push({ dir, from, to, term: G.meta.term });
  if (dir === 'up') {
    pushInbox(G, { cat: 'manset', t: `TÖREN: kulüp seviye atladı — artık "${to.toUpperCase()}" kulüp`, sig: 'tier-' + to, b: 'Kongre salonunda tarihi gece: taban büyüdü, yayın masası kalınlaştı, beklenti çıtası yükseldi. Bu rozet kolay taşınmaz.', noQueue: true });
    anKarti(G, { t: 'Seviye atlandı: ' + to, b: 'İki dönemlik istikrar + sağlam kasa + itibar — kulüp büyüdü.', etki: 10 });
  } else {
    pushInbox(G, { cat: 'manset', t: 'Kulüp küçülüyor: seviye düştü', sig: 'tier-dus-' + to, b: 'Küme sancısı + mali çöküş faturayı kesti: kulüp bir kademe aşağıda yeniden kuruluyor.', noQueue: true });
    anKarti(G, { t: 'Seviye kaybı: ' + to, b: 'Küme + borç sarmalı kulübü küçülttü.', etki: -10 });
  }
}

// ── M3 JÜBİLE & NESİL ──
function jubileTick(G, wk) {
  if (wk !== 30) return;
  const J = TUNING.MIRAS.JUBILE;
  const aday = G.squad.find((p) => p.age >= J.YAS && (p.kulupteYil || 1) >= J.YIL && !p.jubileAsked);
  if (!aday) return;
  aday.jubileAsked = true;
  ringPhone(G, {
    kind: 'jubile', story: true, caller: 'gm', callerName: `${G.gm.name} (GM)`,
    title: `Bir devir kapanıyor: ${aday.name}`,
    body: `"${aday.name} sezon sonunda bırakıyor Başkanım — ${aday.kulupteYil} yıllık emek. Menajeri aradı: kulüp bir jübile düşünür mü? Tribün de soruyor."`,
    options: [
      { key: 'jorganize', label: 'Jübile organize et', whisper: 'küçük masraf · tribün duygulanır · müzeye isim', playerId: aday.id },
      { key: 'jsessiz', label: 'Sessiz veda', whisper: 'masrafsız · radikaller ve Nostaljik üye kırılır', playerId: aday.id },
    ],
  });
}
function jubileResolve(G, aday, organize) {
  const J = TUNING.MIRAS.JUBILE;
  const altin = (G.altinCocuklar || []).includes(aday.name) && aday.overall >= 88;
  if (organize) {
    G.economy.kasa -= J.KASA;
    G.gauges.taraftar = clamp(G.gauges.taraftar + J.TARAFTAR, 0, 100);
    aday.jubilePlanned = true;
    nudgeBoyut(G, 'kimlik', 8); // B2a: kimlik boyutu ısınır
    pushMuze(G, { tip: 'jubile', t: `Jübile: ${aday.name}`, b: `${aday.kulupteYil} yıl, tek forma. Stadyum ayakta uğurladı.` });
    pushInbox(G, { cat: 'karar', t: `Jübile sözü: ${aday.name}`, b: `Sezon kapanışında tören var. ${aday.name}: "Bu formaya veda etmenin tek güzel yolu buydu."`, noQueue: true });
    anKarti(G, { t: `Jübile: ${aday.name}`, b: 'Bir devir alkışla kapandı; müzeye bir isim daha.', etki: 6 });
    if (altin) {
      G.gauges.itibar = clamp(G.gauges.itibar + J.ALTIN_ITIBAR, 0, 100);
      pushMuze(G, { tip: 'jubile', t: `ALTIN NESİL TÖRENİ: ${aday.name}`, b: 'Akademiden çıkıp zirveye tırmanan çocuk — kulüp tarihinin en büyük gurur gecesi.' });
    }
  } else {
    aday.jubileSilent = true;
    G.gauges.taraftar = clamp(G.gauges.taraftar + J.SESSIZ_TARAFTAR, 0, 100);
    const nost = (G.board || []).find((m) => m.archetype === 'Nostaljik');
    if (nost) nost.loyalty = clamp(nost.loyalty + J.NOSTALJIK_LOYALTY, 0, 100);
    pushInbox(G, { cat: 'karar', t: `Sessiz veda: ${aday.name}`, b: 'Tören yok, tek bir teşekkür tweeti. Radikal grup pankart hazırlıyor: "Emeğe saygı."', noQueue: true });
  }
}
// Jübilesiz satılan efsane → KALICI küskünlük
function efsaneSatisKontrol(G, p) {
  const J = TUNING.MIRAS.JUBILE;
  if (!p || p.age < J.YAS || (p.kulupteYil || 1) < J.YIL) return;
  const nost = (G.board || []).find((m) => m.archetype === 'Nostaljik');
  if (nost) nost.loyalty = clamp(nost.loyalty + J.KUSKUN_LOYALTY, 0, 100);
  (G.kuskunler = G.kuskunler || []).push(p.name);
  pushMuze(G, { tip: 'kuskun', t: `Küskün efsane: ${p.name}`, b: `${p.kulupteYil} yıl verdi, jübilesiz satıldı. Röportajlarında kulübün adını anmıyor.` });
  anKarti(G, { t: `Efsane küstürüldü: ${p.name}`, b: 'Jübilesiz satış — tribünün hafızası uzundur.', etki: -6 });
}

// ── M6 YENİ DÖNEM RİTÜELİ: vizyon → kurul loyalty kalibrasyonu ──
export function chooseVision(G, key) {
  const V = TUNING.MIRAS.VIZYON[key];
  if (!V || !G.ritual || G.ritual.done) return { ok: false };
  for (const m of G.board || []) if (V[m.archetype] != null) m.loyalty = clamp(m.loyalty + V[m.archetype], 0, 100);
  G.termVision = key;
  G.ritual.done = true;
  const tr = { sportif: 'sportif zafer', mali: 'mali disiplin', altyapi: 'altyapı devrimi' }[key];
  pushInbox(G, { cat: 'kongre', t: `Dönem vizyonu: ${tr}`, b: `Kurul önünde tek cümle: rota "${tr}". Kimi üye başını salladı, kimi not aldı.`, noQueue: true });
  return { ok: true };
}

// ── B2a: ÇOK BOYUTLU TARAFTAR DUYARLILIĞI ──
// Gauge tek sayı kalır (seçim formülü değişmez); 4 boyut hedefi SAPMA olarak besler (nötr 55 → etki 0).
export function updateBoyutlar(G, { myRes } = {}) {
  const B = TUNING.MEGA.BOYUT;
  const b = (G.boyutlar = G.boyutlar || { sonuc: 55, transfer: 55, stil: 55, kimlik: 55, neden: {} });
  // SONUÇLAR: beklentiye göre (mevcut sürücünün aynası — görüntüleme için)
  const hedefSira = G.club.hedefSira || 9;
  b.sonuc = clamp(55 + (hedefSira - (G.myPos || 9)) * 4, 0, 100);
  b.neden.sonuc = (G.myPos || 9) <= hedefSira ? 'Takım beklentinin üstünde — tribün sonuçlardan memnun.' : 'Sıra beklentinin altında; her hafta aynı soru: "nereye?"';
  // TRANSFERLER: pencere hareketliliği + yıldız geliş/gidiş (anlık olaylar nudge basar, hedefe süzülür)
  const trHedef = clamp(55 + ((G.windowStats && G.windowStats.onay) || 0) * 6 - (G.boyutNudge?.yildizGitti || 0) * 8 + (G.boyutNudge?.yildizGeldi || 0) * 8, 0, 100);
  b.transfer = clamp(b.transfer + (trHedef - b.transfer) * B.DRIFT, 0, 100);
  b.neden.transfer = b.transfer < 45 ? 'Pencere sessiz geçti; tribün "hamle yok mu?" diye soruyor.' : b.transfer > 65 ? 'Vitrin hareketli — transferler heyecan yarattı.' : 'Transfer gündemi ılık; ne coşku ne isyan.';
  // OYUN STİLİ: gol üretimi + telkin profili ("kalemizi koruyalım" ağırlığı = korkak futbol riski)
  const maclar = (G.season.W + G.season.D + G.season.L) || 1;
  const golOrt = G.season.GF / maclar;
  const kaleOran = (G.telkinLog || []).filter((e) => e.type === 'kale').length / Math.max((G.telkinLog || []).filter((e) => !e.type.includes(':')).length, 1);
  const stilHedef = clamp(40 + golOrt * 14 - (kaleOran > 0.4 ? B.STIL_KALE_CEZA : 0), 0, 100);
  b.stil = clamp(b.stil + (stilHedef - b.stil) * B.DRIFT, 0, 100);
  b.neden.stil = kaleOran > 0.4 ? '"Korkak futbol" homurtusu: kapanma talimatları tribünün gözünden kaçmıyor.' : golOrt >= 1.6 ? 'Gol yağmuru — bu takım seyri zevkli.' : golOrt < 1.0 ? 'Gol kısırlığı canları sıkıyor.' : 'Oyun idare eder; ne büyülüyor ne bunaltıyor.';
  // KİMLİK: altyapı sahada + jübile/koreografi + küskün efsaneler
  const gencXI = idealXI(G.squad).filter((p) => p.age <= 21).length;
  const kimlikHedef = clamp(50 + gencXI * 5 + (G.boyutNudge?.kimlik || 0) - (G.kuskunler || []).length * 4, 0, 100);
  b.kimlik = clamp(b.kimlik + (kimlikHedef - b.kimlik) * B.DRIFT, 0, 100);
  b.neden.kimlik = (G.kuskunler || []).length ? 'Küskün efsaneler unutulmadı — kimlik yarası açık.' : gencXI ? 'Sahada ocağın çocukları var; tribün kendini görüyor.' : 'Kulüp kimliği vitrinde az; bağ zayıflıyor.';
  // anlık nudge'lar yumuşak söner
  if (G.boyutNudge) for (const k of Object.keys(G.boyutNudge)) G.boyutNudge[k] = Math.max(0, (G.boyutNudge[k] || 0) - 1);
  // Boyutlar sosyal akışı da yönlendirir: en düşük boyut sitem üretir
  const dusuk = Object.entries({ transfer: b.transfer, stil: b.stil, kimlik: b.kimlik }).sort((x, y) => x[1] - y[1])[0];
  if (dusuk && dusuk[1] < 42 && rand(0, 1) < 0.25) {
    const sitem = {
      transfer: 'Pencere kapanıyor, tahtada tık yok. Yönetim uyuyor mu? 😤',
      stil: 'Bu futbolu izlemek eziyet — otobüsü çek, anahtarı at. 🚌',
      kimlik: 'Formayı giyen çocukların kaçı bizden? Kulüp ruhunu arıyorum. 🔍',
    }[dusuk[0]];
    G.socialFeed = [{ text: sitem, mood: 'neg', viral: rand(0, 1) < 0.2 }, ...(G.socialFeed || [])].slice(0, 4);
  }
  void myRes;
  return b;
}
const nudgeBoyut = (G, k, v) => { (G.boyutNudge = G.boyutNudge || {})[k] = ((G.boyutNudge || {})[k] || 0) + v; };

// B4b: UI için kimlik çevirici (rng motoru saf kalsın diye buradan köprü)
export function rollIdentity(G, tier) { return rollClubIdentity(tier, G.data.teams); }

// ── B6h: KAYIT SÜRÜM GÖÇÜ — eski kayıt yeni alanlarla güvenli varsayılanlara tamamlanır ──
export function migrateLoaded(G) {
  const v = G.stateVersion || 1;
  if (v < 2) {
    G.mode = G.mode || 'klasik';
    G.fedIliski = G.fedIliski ?? TUNING.MEGA.FED.START;
    G.boyutlar = G.boyutlar || null; // ilk finishWeek'te kurulur
    G.achUnlocked = G.achUnlocked || {};
    G.museum = G.museum || []; G.defter = G.defter || [];
    G.borcHistory = G.borcHistory || [Math.round(G.economy ? G.economy.borc : 0)];
    G.tierHistory = G.tierHistory || []; G.kuskunler = G.kuskunler || [];
    G.altinCocuklar = G.altinCocuklar || []; G.lossStreak = G.lossStreak || 0;
    G.consecTerms = G.consecTerms || 0; G.telkinLog = G.telkinLog || [];
    G.career = { titles: 0, termsWon: 0, bestPos: 18, seasons: 0, cups: 0, oyList: [], ...(G.career || {}) };
    if (G.staff && G.staff.tis === undefined) G.staff.tis = null;
    G.ffpStrikes = G.ffpStrikes || 0; G.fedHistory = G.fedHistory || [];
    if (G.meta && !G.meta.version) G.meta.version = 'v1.0-adayi';
    G.stateVersion = 2;
  }
  return G;
}

// ── B4a: SENARYO BAŞLANGIÇLARI — scenarios.json'dan özel kuruluş ──
export function startScenario(G, scId) {
  const sc = ((G.data.scenarios && G.data.scenarios.scenarios) || []).find((x) => x.id === scId);
  if (!sc) return { ok: false };
  const identity = rollClubIdentity(sc.tier, G.data.teams);
  selectClub(G, sc.tier, identity);
  const M = sc.mods || {};
  if (M.borcMult) G.economy.borc = Math.round(G.economy.borc * M.borcMult);
  if (M.taraftar) G.gauges.taraftar = M.taraftar;
  if (M.itibar != null) { G.gauges.itibar = M.itibar; G.club.reputation = M.itibar; }
  if (M.fanMult) G.club.fanCount = Math.round(G.club.fanCount * M.fanMult);
  if (M.tesisIndirim) G.tesisIndirim = M.tesisIndirim;        // belediye desteği: tesis −%50 bu dönem
  if (M.buyumeMult) G.buyumeMult = M.buyumeMult;              // taban büyüme hızı ×1.5
  if (M.transferBan) { G.flags = G.flags || {}; G.flags.transferBan = TUNING.APPROVAL.WINDOW_SPAN; }
  G.scenario = { id: sc.id, ad: sc.ad, hedef: sc.hedef, done: false };
  G.scenarioBase = { borc: G.economy.borc };
  if (M.devir) { // B5b: "Batan Dev" devir-teslim altyapısını kullanır (M1 rapor formatı)
    G.devirRaporu = { borc: G.economy.borc, kasa: Math.round(G.economy.kasa), kadroDeger: Math.round(G.club.kadroDeger), pos: 9, tutulmayan: ['Kupayı Vitrine Koyacağım', 'Kulübün Sırtındaki Yükü İndireceğim'], term: 0 };
    anKarti(G, { t: 'Enkaz devralındı', b: 'Önceki başkanın devir-teslim raporu: şişmiş borç, kapalı tahta, küskün tribün.', etki: -8 });
  }
  // Kuruluşu tamamla: senaryoya uygun vaat + direktifle göreve başla
  startTerm(G, sc.id === 'batan-dev' ? ['P02'] : ['P15'], { budget: sc.id === 'batan-dev' ? 0 : 50, line: 'hazir' });
  // SEÇİM ARİFESİ: 3. sezon hafta 20'den başla (kısa mod — saf politika sprinti)
  if (M.fastStart) {
    G.history = { seasons: [{ pos: 9, champion: false, cup: false, W: 12, D: 10, L: 12 }, { pos: 10, champion: false, cup: false, W: 11, D: 10, L: 13 }] };
    G.meta.season = M.fastStart.season;
    initSeason(G);
    while (G.meta.week < M.fastStart.week) { advanceWeek(G); G.pendingMatch = null; drainAllPhones(G); }
    if (M.oyHedef) { // anket kalibrasyonu: %41 civarına çek
      G.gauges.taraftar = clamp(G.gauges.taraftar - 8, 0, 100);
      G.gauges.guven = clamp(G.gauges.guven - 8, 0, 100);
      for (const mm of G.board || []) mm.loyalty = clamp(mm.loyalty - 8, 0, 100);
    }
    pushInbox(G, { cat: 'kongre', t: 'SEÇİM ARİFESİ', b: `Anketler %${M.oyHedef || 41} diyor; seçime ${G.SEASON_WEEKS - G.meta.week} hafta. Her karar sandığa yazar.`, noQueue: true });
  }
  return { ok: true };
}
function drainAllPhones(G) { let g = 0; while (G.phone && g++ < 12) answerPhone(G, Math.max(0, (G.phone.options || []).findIndex((o) => ['red', 'sessiz', 'sabir', 'beklet', 'koru'].includes(o.key)))); }

// ── B3a: İHTİYAÇ İLANI — pozisyon + yaş bandı + tavan; AI kulüpler dosya GÖNDERİR ──
export function ilanVer(G, { pos, yasMax, tavan }) {
  if (!G.transferWindow) return { ok: false, why: 'Pencere kapalı' };
  if (G.ilan) return { ok: false, why: 'Aktif ilan var' };
  if (G.flags && G.flags.transferBan > 0) return { ok: false, why: 'Tahta kapalı' };
  G.ilan = { pos, yasMax, tavan, kalan: TUNING.MEGA.ILAN.CEVAP_MAX, wk: G.meta.week };
  registerDecision(G, 'ilan:' + pos);
  // İlan tepki üretir: sosyal sızıntı + o mevkideki oyuncuların morali ("yerime mi?")
  const posTrIlan = { GK: 'kaleci', DEF: 'stoper', MID: 'orta saha', FWD: 'forvet' }[pos] || pos;
  G.socialFeed = [{ text: `Kulis: ${posTrIlan} arıyormuşuz — menajerlere ilan gitmiş 👀`, mood: 'notr', viral: false }, ...(G.socialFeed || [])].slice(0, 4);
  for (const p of G.squad.filter((x) => x.pos === pos)) p.morale = clamp(p.morale + TUNING.MEGA.ILAN.MORAL_CEZA, 0, 100);
  pushInbox(G, { cat: 'transfer', t: `İlan verildi: ${posTrIlan} aranıyor`, b: `${G.gm.name} ağları saldı: yaş ≤${yasMax}, bütçe tavanı ${tavan}mn. Uygun kulüpler 1-3 hafta içinde dosya gönderir; deadline'da cevaplar yoğunlaşır.`, noQueue: true });
  return { ok: true };
}
function ilanTick(G, wk) {
  const I = TUNING.MEGA.ILAN;
  const il = G.ilan;
  if (!il) return;
  if (!G.transferWindow) { G.ilan = null; return; } // pencere kapandı — ilan düştü
  const isDeadline = TUNING.TRANSFER.WINDOWS.some((s) => wk === s + TUNING.APPROVAL.WINDOW_SPAN - 1);
  if (il.kalan <= 0) { G.ilan = null; return; }
  if (!isDeadline && rand(0, 1) > 0.5) return;
  if (G.inbox.some((m) => m.action === 'tfile' && !m.resolved)) return; // GM tek dosya yürütür
  // AI kulüp cevap dosyası: satıcı motivasyonu fiyata işler ve GÖRÜNÜR
  const motivKey = ['normal', 'nakit', 'ffp'][randint(0, 2)];
  const mult = I.MOTIV[motivKey];
  const satici = (G.opponents || [])[randint(0, (G.opponents || []).length - 1)];
  const p = new Player({ id: 'il' + (G._pid = (G._pid || 1000) + 1), name: gmPickName(G), pos: il.pos, overall: randint(Math.round(G.temelGuc) - 2, Math.round(G.temelGuc) + 7), potential: 0, age: randint(20, il.yasMax), contractYears: 2 });
  p.potential = p.overall; p.wage *= (G.marketMult || 1);
  const fee = Math.min(il.tavan, transferFee(p) * (G.marketMult || 1) * mult);
  const fog = Math.max(1, TUNING.FOG_BASE - G.facilities.scout);
  const h = Math.ceil(fog / 2);
  const motivTr = { normal: 'satıcı rahat — pazarlık payı az', nakit: 'kulüp NAKİT arıyor — indirimli', ffp: 'FFP baskısında, hızlı satmalı — piyasanın %30 altı' }[motivKey];
  il.kalan--;
  pushInbox(G, {
    cat: 'transfer', t: `${G.gm.name} (GM): İLANA CEVAP — ${satici ? satici.name : 'bir kulüp'}`,
    b: `İlanına dosya geldi: ${p.name} (${p.age}), ${fmt1(fee)}mn. Satıcı motivasyonu: ${motivTr}. Görünen güç ${p.overall - h}-${p.overall + h}.`,
    action: 'tfile', file: { player: p, fee, gerekce: `İlan cevabı — ${motivTr}.`, range: [p.overall - h, p.overall + h], sartTried: motivKey !== 'normal' },
  });
  if (il.kalan <= 0) G.ilan = null;
}

// ── B3b: SATIŞ VİTRİNİ — oyuncuyu teklife aç; küskünlük + teklif telefonları ──
export function vitrinToggle(G, playerId) {
  const p = G.squad.find((x) => String(x.id) === String(playerId));
  if (!p) return { ok: false };
  // Kiralık oyuncu bizim malımız değil — satışa çıkarılamaz (sezon sonu asıl kulübüne döner)
  if (p.loanIn && !p.vitrin) {
    pushInbox(G, { cat: 'transfer', t: 'Kiralık oyuncu satılamaz', b: `${p.name} kiralık geldi — bizim malımız değil. Sezon sonu asıl kulübüne döner; satışa çıkaramayız.`, noQueue: true });
    return { ok: false };
  }
  const V = TUNING.MEGA.VITRIN;
  if (!p.vitrin) {
    p.vitrin = true;
    p.morale = clamp(p.morale + V.MORAL, 0, 100);
    registerDecision(G, 'vitrin:' + p.name);
    if (p.id === G.captainId) { // K2 bağı: kaptan vitrine konursa telefon
      ringPhone(G, {
        kind: 'kaptan', story: true, caller: 'kaptan', callerName: `${p.name} (Kaptan)`,
        title: 'Kaptan hattında: "Vitrinde miyim?"',
        body: '"Başkanım... listede adımı görmüşler. Pazubandı taşıyan adamı satılığa çıkarmak nasıl bir mesaj? Konuşmamız lazım."',
        options: [
          { key: 'dinle', label: 'Yanlış anlaşılma de + vitrinden çek', whisper: 'kaptan yatışır · vitrin kapanır', playerId: p.id },
          { key: 'kes', label: '"Kulüp menfaati önde"', whisper: 'kaptan kırılır · vitrin sürer', playerId: p.id },
        ],
      });
      G.vitrinKaptanId = p.id;
    }
    if (p.overall >= TUNING.STAR_THRESHOLD) nudgeBoyut(G, 'yildizGitti', 2); // tribün huzursuzluğu
    pushInbox(G, { cat: 'transfer', t: `Vitrine kondu: ${p.name}`, b: 'Menajerlere sinyal gitti. Oyuncu duydu — morali bozuk, formu risk altında. Teklifler 2-4 hafta içinde gelir.', noQueue: true });
  } else {
    p.vitrin = false;
    p.morale = clamp(p.morale + V.DONUS_MORAL, 0, 100);
    pushInbox(G, { cat: 'transfer', t: `Vitrinden çekildi: ${p.name}`, b: 'GM listeden düşürdü; oyuncuya "sana güveniyoruz" mesajı gitti. Moral kısmen döndü.', noQueue: true });
  }
  return { ok: true, vitrin: p.vitrin };
}

// Kiralık listesine koy/çek — pencere açıkken alt sıralardan dosya ihtimalini artırır (loanOutTick önceliği).
export function toggleKiralikListe(G, playerId) {
  const p = G.squad.find((x) => String(x.id) === String(playerId));
  if (!p) return { ok: false };
  if (p.loanIn) { pushInbox(G, { cat: 'transfer', t: 'Olmaz Başkanım', b: `${p.name} zaten kiralık geldi — kiralık oyuncu tekrar kiralanamaz.`, noQueue: true }); return { ok: false }; }
  if (!p.kiralikListe) {
    p.kiralikListe = true;
    p.morale = clamp(p.morale - 3, 0, 100);
    pushInbox(G, { cat: 'transfer', t: `Kiralık listesine kondu: ${p.name}`, b: `Menajerlere sinyal gitti — pencere açıkken alt sıralardan dosya gelebilir. Oyuncu duydu, hafif buruk.${p.id === G.captainId ? ' (Kaptanı listelemek soyunma odasında konuşulur.)' : ''}`, noQueue: true });
  } else {
    p.kiralikListe = false;
    p.morale = clamp(p.morale + 2, 0, 100);
    pushInbox(G, { cat: 'transfer', t: `Listeden çekildi: ${p.name}`, b: 'GM oyuncuya "plan değişti, buradasın" dedi — moral kısmen döndü.', noQueue: true });
  }
  return { ok: true, listede: p.kiralikListe };
}
function vitrinTick(G) {
  const V = TUNING.MEGA.VITRIN;
  for (const p of G.squad.filter((x) => x.vitrin)) {
    p.form = clamp(p.form - 1, 0, 100); // küskünlük form riski
    if (!G.phone && rand(0, 1) < V.TEKLIF_P) {
      const offer = saleOffer(p) * (G.marketMult || 1) * rand(0.9, 1.1);
      ringPhone(G, {
        kind: 'dlsell', story: true, caller: 'menajer', callerName: 'Menajer hattı',
        title: `Vitrin teklifi: ${p.name}`,
        body: `Vitrindeki oyuncuna talip çıktı: ${fmt1(offer)}mn. Menajer "makul rakam, oyuncu da sıcak" diyor.`,
        options: [{ key: 'sat', label: `SAT (+${fmt1(offer)}mn)`, whisper: 'kasa dolar · kadro inceliyor' }, { key: 'red', label: 'REDDET', whisper: 'bekleyiş sürer · moral erimeye devam' }],
        playerId: p.id, offer,
      });
      break;
    }
  }
}

// ── B2b: TARAFTAR İLİŞKİLERİ SORUMLUSU — erken uyarı + buluşma aksiyonu ──
function tisTick(G) {
  if (!G.staff || !G.staff.tis || !G.boyutlar) return;
  const b = G.boyutlar;
  const dusuk = Object.entries({ transfer: b.transfer, stil: b.stil, kimlik: b.kimlik }).sort((x, y) => x[1] - y[1])[0];
  if (dusuk && dusuk[1] < 45 && (G.globalWeek - (G.tisUyariWk || -99)) >= 5) {
    G.tisUyariWk = G.globalWeek;
    const oneri = { transfer: 'pencere kapanmadan bir hamle iyi gelir', stil: 'TD ile hücum vitesi konuşulmalı', kimlik: 'bir altyapı jesti ya da tribün buluşması yarayı sarar' }[dusuk[0]];
    pushInbox(G, { cat: 'kongre', t: `${G.staff.tis.name} (Taraftar İlişkileri): erken uyarı`, b: `"Başkanım, tribün ${dusuk[0]} tarafında huzursuz — ${oneri}."`, noQueue: true });
  }
}
// Taraftar buluşması: seçilen boyuta onarım (sezonda 2, küçük kasa maliyeti)
export function tisBulusma(G, boyut) {
  const T = TUNING.MEGA.TIS;
  if (!G.staff || !G.staff.tis) return { ok: false, why: 'Koltuk boş' };
  if ((G.tisBulusmaCount || 0) >= T.BULUSMA_MAX) return { ok: false, why: 'Sezon hakkı doldu' };
  if (!G.boyutlar || G.boyutlar[boyut] == null || boyut === 'sonuc') return { ok: false };
  G.tisBulusmaCount = (G.tisBulusmaCount || 0) + 1;
  G.economy.kasa -= T.BULUSMA_KASA;
  G.boyutlar[boyut] = clamp(G.boyutlar[boyut] + T.BULUSMA_ONARIM, 0, 100);
  registerDecision(G, 'tis:' + boyut);
  pushInbox(G, { cat: 'kongre', t: `Taraftar buluşması (${boyut})`, b: `${G.staff.tis.name} salonu doldurdu: sorular sert başladı, samimi bitti. O boyuttaki kırgınlık gözle görülür onarıldı.`, noQueue: true });
  return { ok: true };
}

// ── B2c: KOREOGRAFİ EKONOMİSİ — kritik EV maçından bir hafta önce radikal grup arar ──
function koreoTick(G, wk) {
  if (wk + 1 > G.SEASON_WEEKS || G.koreoAskedWk === wk) return;
  const round = G.league.fixtures[wk]; // gelecek haftanın maçı
  if (!round) return;
  const my = round.find((x) => x.home === MY || x.away === MY);
  if (!my || my.home !== MY) return;
  const oppId = my.away;
  const kritik = oppId === 'o0' || (G.myPos || 9) <= 3 || wk + 1 >= TUNING.CRITICAL.LATE_WEEK;
  if (!kritik || G.koreoPending) return;
  const rg = radikalGrup(G);
  if (!rg || rand(0, 1) > 0.5) return;
  G.koreoAskedWk = wk;
  const K = TUNING.MEGA.KOREO;
  ringPhone(G, {
    kind: 'koreo', story: true, caller: 'kurul', callerName: `${rg.name} (tribün lideri)`,
    title: 'Koreografi için destek',
    body: `"Başkanım, ${G.league.table[oppId].name} maçı bizim gecemiz olsun istiyoruz — dev koreografi hazır, kumaş+boya ${K.KASA}mn tutuyor. Tribün senden bir jest bekliyor."`,
    options: [
      { key: 'ver', label: `Destekle (${K.KASA}mn)`, whisper: 'o maç tribün duvar olur · kimlik ısınır · Hesap Adamı not eder' },
      { key: 'verme', label: 'Bütçe yok', whisper: 'radikaller kırılır · tek sitem paylaşımı' },
    ],
  });
}

// ── B2d: MEDYA KAPAK TEKLİFİ — form zirvesinde yönetmen tetikler ──
function kapakTick(G) {
  const K = TUNING.MEGA.KAPAK;
  if (G.kapakDone || (G.recent || []).length < 5) return;
  const son5 = G.recent.slice(-5).filter((x) => x === 3).length;
  if (son5 < K.FORM_W || G.gauges.itibar <= K.ITIBAR_MIN) return;
  G.kapakDone = true;
  ringPhone(G, {
    kind: 'kapak', story: true, caller: 'gazeteci', callerName: 'Turgut Ballı (Tribün Gözü)',
    title: 'KAPAK TEKLİFİ: "Yılın Başkanı" dosyası',
    body: '"Başkanım, dergimiz kapak yapmak istiyor: stüdyo çekimi, uzun röportaj, prime-time program turu. Formunuz zirvede — ışıklar sizi istiyor."',
    options: [
      { key: 'kabul', label: 'Kabul et', whisper: 'itibar + sponsor değeri · %25 "kibir yayı" riski' },
      { key: 'ret', label: 'Zarafetle reddet', whisper: 'radikaller sever ("bizden biri") · fırsat kaçar' },
    ],
  });
}

// Gauge hedefine boyut sapması (bant koruması: nötrde sıfır)
export function boyutSapma(G) {
  const B = TUNING.MEGA.BOYUT, b = G.boyutlar;
  if (!b) return 0;
  return B.W.transfer * (b.transfer - 55) + B.W.stil * (b.stil - 55) + B.W.kimlik * (b.kimlik - 55);
}

// ── B1d: FFP SERTLEŞME — ardışık ihlal kademeleri ──
// 1. ihlal: taahhütname (mevcut) · 2.: kesinti ×2 + tahta 1 pencere · 3.: −3 PUAN + manşet fırtınası
function ffpStrike(G) {
  const F2 = TUNING.MEGA.FFP2;
  G.ffp.taahhut = true; G.ffp.pendingCut = true;
  G.ffpStrikes = (G.ffpStrikes || 0) + 1;
  G.ffpStruckThisSeason = true;
  G.gauges.guven = clamp(G.gauges.guven + TUNING.FFP_EXTRA.TAAHHUT_GUVEN, 0, 100);
  if (G.ffpStrikes >= 3) {
    // −3 PUAN silme: tabela cezası + taraftar şoku + manşet fırtınası
    const me = G.league && G.league.table && G.league.table.ME;
    if (me) me.Pts = (me.Pts || 0) - F2.PUAN_SIL;
    G.gauges.taraftar = clamp(G.gauges.taraftar + F2.PUAN_TARAFTAR, 0, 100);
    pushInbox(G, { cat: 'manset', t: `FEDERASYON BALYOZU: −${F2.PUAN_SIL} PUAN`, sig: 'ffp-puan-' + G.worldSeason, b: 'Üçüncü ardışık FFP ihlali affedilmedi: puan silme cezası tabelaya işledi. Tribün şokta, manşetler yangın yerinde.', noQueue: true });
    anKarti(G, { t: 'FFP puan silme cezası', b: `Ardışık ihlaller −${F2.PUAN_SIL} puana mal oldu.`, etki: -9 });
  } else if (G.ffpStrikes === 2) {
    G.ffp.pendingCut = 'x2'; // initSeason'da kesinti ×2 uygulanır
    G.flags = G.flags || {};
    G.ffpBanNextWindow = true; // sonraki pencere tahta kapalı
    pushInbox(G, { cat: 'manset', t: 'FFP SERTLEŞTİ: kesinti ×2 + tahta cezası', sig: 'ffp-2-' + G.worldSeason, b: 'İkinci ardışık ihlal: federasyon gelir kesintisini ikiye katladı ve bir sonraki pencere transfer tahtasını kapattı.', noQueue: true });
    anKarti(G, { t: 'FFP ikinci ihlal', b: 'Kesinti ×2 + bir pencere tahta kapalı.', etki: -7 });
  } else {
    pushInbox(G, { cat: 'mali', t: 'TAAHHÜTNAME imzalandı', b: `Harcama limiti aşıldı (${Math.round(G.ffp.spent)}/${G.ffp.limit}mn). Federasyona gelecek gelirden kesinti taahhüdü verildi; kurul rahatsız (güven −5). Dikkat: ardışık ihlaller sertleşir.` });
  }
}

// ── B1c: GİZLİ FEDERASYON HATTI — tek iletişim kanalı analist Ozan Kaptan'ın istatistik yazısı ──
function fedTick(G, wk) {
  const F = TUNING.MEGA.FED, fed = G.fedIliski ?? F.START;
  // Ozan Kaptan yazısı: yalnız uçlarda, sezonda en fazla 2 kez
  if ((fed < F.YAZI_LO || fed > F.YAZI_HI) && (G.fedYaziCount || 0) < F.YAZI_MAX && wk >= 6 && rand(0, 1) < 0.15) {
    G.fedYaziCount = (G.fedYaziCount || 0) + 1;
    pushInbox(G, {
      cat: 'medya', sig: 'fed-yazi-' + G.worldSeason + '-' + G.fedYaziCount, noQueue: true,
      t: fed < F.YAZI_LO ? 'Ozan Kaptan yazdı: "Rakamlar tuhaf"' : 'Ozan Kaptan yazdı: "İstatistik gülümsüyor"',
      b: fed < F.YAZI_LO
        ? 'Son 10 maçta lehimize tek VAR kararı yok; kritik pozisyonlarda düdük hep geç öttü. Komplo demem, rakam derim. — Ozan Kaptan (analist)'
        : 'Son haftalarda gri pozisyonların çoğu bizden yana yorumlandı; disiplin sevkleri de nazik. Rakamların dili tatlı. — Ozan Kaptan (analist)',
    });
  }
  // Fikstür jesti: revir doluyken erteleme talebinin kaderi gizli hatta bağlı (sezonda 1 kez)
  const sakat = G.squad.filter((p) => p.injuryWeeks > 0).length;
  if (sakat >= 4 && !G.fedJestDone) {
    G.fedJestDone = true;
    if (fed >= 60) {
      for (const p of G.squad) p.fitness = clamp(p.fitness + 4, 0, 100);
      pushInbox(G, { cat: 'saglik', t: 'Federasyondan fikstür jesti', b: 'Erteleme talebimiz "program elvermese de" yarı kabul gördü: maç saati kaydırıldı, ekstra dinlenme günü çıktı.', noQueue: true });
    } else if (fed <= 40) {
      pushInbox(G, { cat: 'saglik', t: 'Erteleme talebi REDDEDİLDİ', b: 'Federasyon iki satırlık cevap yazdı: "Takvim uygundur." Kulis notu: geçmiş polemikler unutulmamış.', noQueue: true });
    }
  }
}

// ── B1b: TRANSFER SAVAŞI — açık onay dosyana rakip başkan girer ──
function transferWarTick(G) {
  const R = TUNING.MEGA.RAKIP;
  if (G.phone || G.transferWar) return;
  const m = G.inbox.find((x) => x.action === 'tfile' && !x.resolved && x.file && x.file.fee > 8);
  if (!m || rand(0, 1) >= R.SAVAS_P) return;
  const opp = (G.opponents || [])[randint(0, (G.opponents || []).length - 1)];
  if (!opp) return;
  const bluf = rand(0, 1) < (R.BLUF_P[opp.baskanTipi] ?? 0.4);
  G.transferWar = { msgId: m.id, bluf, opp: opp.name };
  ringPhone(G, {
    kind: 'savas', story: true, caller: 'kurul', callerName: `${opp.baskan} (${opp.name})`,
    title: `Transfer savaşı: ${m.file.player.name}`,
    body: `"Sayın Başkan, kibarca söyleyeyim: ${m.file.player.name} dosyasına biz de girdik. Üstüne 5 koyarım, çekilin — iki kulüp de yıpranmasın."`,
    options: [
      { key: 'cekil', label: 'Geri çekil', whisper: 'dosya kapanır · yıpranma yok' },
      { key: 'artir', label: `Artır (${fmt1(m.file.fee * R.ARTIR_MULT)}mn)`, whisper: 'bedel yükselir · dosya sende kalır' },
      { key: 'blof', label: 'Blöfü gör', whisper: 'blöfse bedava zafer · değilse oyuncu rakibe gider' },
    ],
  });
}

// ═══ PAKET İNSAN HİKAYELERİ ═══
// ── K2 KAPTAN KURUMU ──
export function captain(G) { return G.captainId ? G.squad.find((p) => p.id === G.captainId) || null : null; }

// Sezon başı: TD kaptan önerir (hiyerarşi lideri) — onay/veto oyuncunun
export function proposeCaptain(G) {
  const sirali = G.squad.slice().sort((a, b) => hierarchy(b) - hierarchy(a));
  if (!sirali.length) return;
  const mevcut = captain(G);
  const c1 = mevcut && sirali.slice(0, 3).includes(mevcut) ? mevcut : sirali[0];
  const c2 = sirali.find((p) => p !== c1);
  G.captainCands = { c1: c1.id, c2: c2 ? c2.id : null };
  pushInbox(G, {
    cat: 'karar', t: `${G.coach.name}: kaptanlık önerisi`,
    b: `"Bu sezon pazubandı ${c1.name} taşımalı Başkanım — soyunma odası onu dinliyor (${katman(hierarchy(c1))} katmanı, ${c1.age} yaş, ${c1.kulupteYil || 1} yıldır kulüpte). Onayınızı bekliyorum."${c2 ? ` Veto edersen alternatifim ${c2.name}.` : ''}`,
    action: 'captain',
  });
}
export function resolveCaptain(G, msgId, choice) {
  const m = G.inbox.find((x) => x.id === msgId && x.action === 'captain');
  if (!m || m.resolved || !G.captainCands) return { ok: false };
  m.resolved = true;
  const K = TUNING.INSAN.KAPTAN;
  if (choice === 'veto' && G.captainCands.c2) {
    G.captainId = G.captainCands.c2;
    G.tdRelation = clamp((G.tdRelation ?? 70) + K.VETO_REL, 0, 100);
    const c = captain(G);
    pushInbox(G, { cat: 'td', t: 'Kaptanlık: başkan vetosu', b: `TD önerisi geri çevrildi; pazubant ${c ? c.name : '—'}'a verildi. ${G.coach.name} not etti — ilişki hafif gerildi.`, noQueue: true });
  } else {
    G.captainId = G.captainCands.c1;
    const c = captain(G);
    pushInbox(G, { cat: 'td', t: `Kaptan: ${c ? c.name : '—'} (C)`, b: 'TD önerisi onaylandı. Soyunma odasının sesi artık resmî.', noQueue: true });
  }
  registerDecision(G, 'captain:' + choice);
  G.captainCands = null;
  return { ok: true };
}
// Kaptan kadrodan ayrıldıysa: kimya −8 + soyunma odası şoku (beginWeek'te tek noktadan denetlenir)
function captainWatch(G) {
  if (!G.captainId) return;
  if (G.squad.some((p) => p.id === G.captainId)) return;
  const K = TUNING.INSAN.KAPTAN;
  G.kimya.kimya = clamp(G.kimya.kimya + K.SATIS_KIMYA, 0, 100);
  for (const p of G.squad) p.morale = clamp(p.morale + K.SATIS_MORAL, 0, 100);
  pushInbox(G, { cat: 'karar', t: 'Soyunma odası şoku: kaptan gitti', b: 'Pazubandın sahibi artık kulüpte değil. Dolap başlarında fısıltılar, gözler yerde — kimya sarsıldı. TD yeni kaptanı sezon başında önerecek.', noQueue: true });
  anKarti(G, { t: 'Kaptan kulüpten ayrıldı', b: 'Pazubant sahipsiz kaldı; kimya sarsıldı.', etki: -7 }); // M5
  G.captainId = null;
}
// Yıldız satışında kaptan SÖZCÜdür (satılan kaptan değilse)
function captainVoice(G, sold) {
  const c = captain(G);
  if (!c || !sold || c.id === sold.id) return;
  if ((sold.overall || 0) < TUNING.STAR_THRESHOLD) return;
  pushInbox(G, { cat: 'karar', t: `Kaptan ${c.name} konuştu`, b: `"${sold.name} bu odanın direğiydi. Takım arkadaşlarım açıklama bekliyor Başkanım — kapınız açık mı?"`, noQueue: true });
}

// ── K3 SÖZLEŞME MASASI DRAMI ──
// Son sözleşme yılındaki ÖNEMLİ oyuncu (değer > ort ×1.5 / kaptan / yıldız) → menajer telefonu, 2-3 tur.
function contractTick(G, wk) {
  const KT = TUNING.INSAN.KONTRAT;
  const saga = G.contractSaga;
  if (!saga) {
    if (wk < 2) return;
    const avgMV = G.squad.reduce((s, p) => s + p.marketValue, 0) / Math.max(G.squad.length, 1);
    const aday = G.squad.find((p) => (p.contractYears ?? 3) <= 1 && !p.loanIn && !p.sagaDone
      && (p.marketValue > avgMV * KT.VALUE_MULT || p.id === G.captainId || p.overall >= TUNING.STAR_THRESHOLD));
    if (!aday) return;
    const ask = { wage: Math.round(aday.wage * KT.ASK_WAGE * 100) / 100, years: 3 };
    G.contractSaga = { playerId: aday.id, round: 1, ask, state: 'acik', startWk: wk, rumor: false };
    ringPhone(G, {
      kind: 'kontrat', story: true, caller: 'menajer', callerName: `${aday.name}'in menajeri`,
      title: `Sözleşme masası: ${aday.name}`,
      body: `"Başkanım, açık konuşayım: son sözleşme yılı. İstediğimiz net — ${fmt1(ask.wage)}mn maaş, 3 yıl, oynama garantisi. Kulüpler kapıda, biz burada mutluyuz ama piyasa piyasadır."`,
      options: [
        { key: 'kabul', label: `İmzala (${fmt1(ask.wage)}mn × 3 yıl)`, whisper: 'yıldız bağlanır · maaş bütçesi şişer' },
        { key: 'pazarlik', label: 'GM pazarlık etsin', whisper: 'orta yol aranır · birkaç hafta sürer' },
        { key: 'beklet', label: 'Beklet', whisper: 'form düşerse ucuzlar · patlarsa +%20 · sezon sonu bedava riski' },
      ],
    });
    return;
  }
  const p = G.squad.find((x) => x.id === saga.playerId);
  if (!p) { G.contractSaga = null; return; } // oyuncu satıldı — masa dağıldı
  // Söylenti sızıntısı (bir kez): sosyal akışa rakip dedikodusu
  if (!saga.rumor && wk >= saga.startWk + 1) {
    saga.rumor = true;
    const rakip = G.opponents && G.opponents.length ? G.opponents[randint(0, G.opponents.length - 1)].name : 'Kartalspor';
    G.socialFeed = [{ text: `${p.name}'i ${rakip} istiyormuş — menajeri dün gece oradaymış diyorlar… 👀`, mood: 'neg', viral: rand(0, 1) < 0.3 }, ...(G.socialFeed || [])].slice(0, 4);
  }
  if (saga.state === 'pazarlik' && wk >= saga.nextWk) {
    const KT2 = TUNING.INSAN.KONTRAT;
    if (rand(0, 1) < KT2.ORTA_P) {
      const orta = Math.round(p.wage * KT2.ORTA_YOL * 100) / 100;
      ringPhone(G, {
        kind: 'kontrat', story: true, caller: 'gm', callerName: `${G.gm.name} (GM)`,
        title: `Pazarlık dönüşü: ${p.name}`,
        body: `"Masadan orta yolla kalktık Başkanım: ${fmt1(orta)}mn maaş, 3 yıl. Menajer 'bugün imzalarız' diyor — kaçarsa bir daha bu rakama oturmaz."`,
        options: [
          { key: 'kabul', label: `İmzala (${fmt1(orta)}mn × 3 yıl)`, whisper: 'makul orta yol · dosya kapanır' },
          { key: 'beklet', label: 'Yine de beklet', whisper: 'kumar sürer · bedava gidiş riski' },
        ],
      });
      saga.ask = { wage: orta, years: 3 }; saga.round++;
    } else {
      ringPhone(G, {
        kind: 'kontrat', story: true, caller: 'menajer', callerName: `${p.name}'in menajeri`,
        title: `Masa gerildi: ${p.name}`,
        body: `"Rakamımızın arkasındayız — hatta piyasa yükseldi: ${fmt1(saga.ask.wage * 1.05)}mn. Son sözümüz. Kulübünüzü seviyoruz ama kimse enayi değil."`,
        options: [
          { key: 'kabul', label: `Son teklifi kabul et (${fmt1(saga.ask.wage * 1.05)}mn)`, whisper: 'pahalı ama kesin' },
          { key: 'beklet', label: 'Masadan kalk', whisper: 'ipler gerilir · sezon sonu bedava riski büyür' },
        ],
      });
      saga.ask = { wage: Math.round(saga.ask.wage * 1.05 * 100) / 100, years: 3 }; saga.round++;
    }
    saga.state = 'acik';
    return;
  }
  if (saga.state === 'beklet') {
    if (p.form < KT.BEKLET_UCUZ_FORM && !saga.ucuzGeldi) {
      saga.ucuzGeldi = true;
      const ucuz = Math.round(p.wage * KT.BEKLET_UCUZ * 100) / 100;
      saga.ask = { wage: ucuz, years: 2 };
      ringPhone(G, {
        kind: 'kontrat', story: true, caller: 'menajer', callerName: `${p.name}'in menajeri`,
        title: `Menajer yumuşadı: ${p.name}`,
        body: `"Formsuzluk bizi de düşündürdü. ${fmt1(ucuz)}mn'e 2 yıl — bugün el sıkışalım, konu kapansın."`,
        options: [
          { key: 'kabul', label: `İmzala (${fmt1(ucuz)}mn × 2 yıl)`, whisper: 'bekletme taktiği tuttu — ucuza bağlanır' },
          { key: 'beklet', label: 'Daha da beklet', whisper: 'ya toparlarsa? risk büyür' },
        ],
      });
    } else if (p.form > KT.BEKLET_ZAM_FORM && wk >= saga.startWk + 4 && !saga.zamGeldi) {
      saga.zamGeldi = true;
      saga.ask = { wage: Math.round(saga.ask.wage * KT.BEKLET_ZAM * 100) / 100, years: 3 };
      pushInbox(G, { cat: 'transfer', t: `${G.gm.name} (GM): bekletme pahalıya patlıyor`, b: `${p.name} form tepesinde — menajer istekleri %20 artırdı (${fmt1(saga.ask.wage)}mn). "Beklet" kumarında masa aleyhimize döndü.`, noQueue: true });
    }
  }
}
// Sezon sonu: masa çözülmediyse önemli oyuncu BEDAVA gider + taraftar tepkisi
function contractSeasonEnd(G) {
  const saga = G.contractSaga;
  if (!saga) return;
  const p = G.squad.find((x) => x.id === saga.playerId);
  G.contractSaga = null;
  if (!p) return;
  if (saga.signed) return;
  G.squad = G.squad.filter((x) => x !== p);
  G.club.kadroDeger = squadMarketValue(G.squad);
  G.gauges.taraftar = clamp(G.gauges.taraftar + TUNING.INSAN.KONTRAT.GIDER_TARAFTAR, 0, 100);
  pushInbox(G, { cat: 'manset', t: `"Yönetim uyudu": ${p.name} BEDAVA gitti`, sig: 'bedava-' + p.id, b: `Sözleşmesi bitti, masada anlaşma sağlanamadı — bonservissiz ayrıldı. Taraftar öfkeli: koca değer sıfır bedelle uçtu.`, noQueue: true });
  anKarti(G, { t: `Bedava gidiş: ${p.name}`, b: 'Sözleşme masası bekletildi, fatura ağır kesildi.', etki: -7 }); // M5
  efsaneSatisKontrol(G, p); // M3: efsaneyse üstüne küskünlük
  captainWatch(G);
}

// ── K4 SAKATLIK HİKAYE YAYI (yıldız / kaptan / altın çocuk) ──
const onemliMi = (G, p) => p.id === G.captainId || p.overall >= TUNING.STAR_THRESHOLD || (p.potential >= 85 && p.age <= 21);
// Maç sonrası: yeni sakatlanan önemli oyuncu → ticker anı + saga başlat
function injuryStoryCheck(G, oncekiSakatlar, highlights) {
  if (G.injurySaga) return;
  const yeni = G.squad.find((p) => p.injuryWeeks > 0 && !oncekiSakatlar.has(p.id) && onemliMi(G, p));
  if (!yeni) return;
  G.injurySaga = { playerId: yeni.id, realWeeks: yeni.injuryWeeks, reported: false, asked: false };
  if (highlights) {
    const min = randint(15, 80);
    const at = highlights.findIndex((h) => h.min > min);
    highlights.splice(at < 0 ? highlights.length : at, 0, { min, side: '-', type: 'sakatlik', text: `${min}' ${yeni.name} yerde kaldı — sedyeyle çıkıyor, tribün alkışlıyor.` });
  }
}
// Ertesi gün sağlık raporu: tıbbi tesise göre NET ya da SİSLİ; dönüş haftası TD ortak-karar telefonu
function injuryStoryTick(G) {
  const saga = G.injurySaga;
  if (!saga) return;
  const p = G.squad.find((x) => x.id === saga.playerId);
  if (!p || (p.injuryWeeks <= 0 && saga.reported)) { G.injurySaga = null; return; }
  const S = TUNING.INSAN.SAKAT;
  if (!saga.reported) {
    saga.reported = true;
    const net = (G.facilities.tibbi || 0) >= S.NET_TESIS;
    pushInbox(G, {
      cat: 'saglik', t: `Sağlık raporu: ${p.name}`,
      b: net
        ? `Görüntüleme temiz çıktı, tanı kesin: ${p.injuryWeeks} hafta yok. Sağlık ekibi dönüş programını şimdiden yazdı. — Sağlık Ekibi`
        : `MR sonucu hâlâ yorumlanamadı — cihaz eski, görüntü sisli. Tahmin: ${Math.max(1, p.injuryWeeks - 1)}-${p.injuryWeeks + 2} hafta arası. Kesin süreyi kimse söyleyemiyor. — Sağlık Ekibi`,
      noQueue: true,
    });
    return;
  }
  if (p.injuryWeeks === 2 && !saga.asked) {
    saga.asked = true;
    ringPhone(G, {
      kind: 'sakat', story: true, caller: 'gm', callerName: `${G.coach.name} (TD) + Sağlık Ekibi`,
      title: `Dönüş kararı: ${p.name}`,
      body: `"Başkanım, ${p.name} idmana çıktı — bir hafta erken dönebilir. Sağlıkçılar temkinli, ben sahada isterim. Ortak karar: zorlayalım mı?"`,
      options: [
        { key: 'erken', label: 'Erken döndür', whisper: 'önümüzdeki maç sahada · %30 nüks — iki katı süre', playerId: p.id },
        { key: 'sabir', label: 'Acele etme', whisper: 'program neyse o · risk yok', playerId: p.id },
      ],
    });
  }
}

// ── K5 TELKİN KARNESİ ──
function karneKaydet(G, type) {
  (G.telkinLog = G.telkinLog || []).push({ type, wk: G.meta.week, res: null });
}
export function telkinKarne(log) {
  const gruplar = {};
  for (const e of log || []) {
    const g = (gruplar[e.type] = gruplar[e.type] || { n: 0, W: 0, D: 0, L: 0 });
    g.n++; if (e.res) g[e.res]++;
  }
  return gruplar;
}

// Sezon sonu kimlik etiketi (Y6)
export function deskIdentity(G) {
  const c = G.deskCounts || {};
  const [top, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0] || [null, 0];
  if (!top || n < TUNING.YASAYAN.DESK.IDENTITY_AT) return null;
  const tag = { antrenman: 'Sahada Başkan', dernek: 'Halk Adamı', sponsor: 'Salon Adamı', genc: 'Ocak Bekçisi' }[top];
  G.identityTag = tag;
  return tag;
}
const fmt1 = (n) => Math.round(n * 10) / 10;
const resTr = (r) => (r === 'W' ? 'Galibiyet' : r === 'D' ? 'Beraberlik' : 'Mağlubiyet');
const beklentiTr = (b) => ({ kumede_kal: 'Kümede kal', ust_yari: 'Üst yarı', sampiyonluk: 'Şampiyonluk' }[b] || b);
const lineTr = (l) => ({ genc: 'gençlere yatır', hazir: 'hazır oyuncu', yildiz: 'yıldız istiyorum' }[l] || l);
const posTr = (p) => ({ GK: 'kaleci', DEF: 'savunma', MID: 'orta saha', FWD: 'hücum' }[p] || p);
export const toneWord = (t) => ((t || 0) > 0.5 ? 'Dostane' : (t || 0) < -0.5 ? 'Düşmanca' : 'Nötr');
export const relWord = (r) => ((r ?? 70) >= 70 ? 'Uyumlu' : (r ?? 70) >= 50 ? 'Mesafeli' : 'Gergin');
function telkinIzi(type, res) {
  if (!type) return '';
  const won = res === 'W';
  return ' ' + ({
    tamkadro: won ? 'Tam kadro riski karşılığını verdi.' : 'Tam kadro zorlaması yetmedi.',
    rotasyon: won ? 'Rotasyona rağmen kazandık.' : 'Rotasyonun bedeli sahaya yansıdı.',
    gencler: won ? 'Gençler sınavı geçti.' : 'Gençler ders çıkararak öğreniyor.',
    kale: res === 'D' ? 'Kapanma planı puanı kurtardı.' : won ? 'Sağlam savunma, üç puan.' : 'Kapanmak da yetmedi.',
  }[type] || '');
}
function telkinKabulSozu(t) {
  return ({
    tamkadro: '"Anlaşıldı Başkanım, en güçlü on birle çıkıyoruz — ama bacakların faturasını hafta sonu konuşuruz."',
    rotasyon: '"Doğru karar; birkaç isme nefes aldırıp taze döneriz."',
    gencler: '"Gençlere şans vereceğiz — sabırlı olun, hata da yapacaklar."',
    kale: '"Kapanıp kontra bekleyeceğiz. Gol yemeden dönersek kârdayız."',
  }[t] || '"Talimat alındı."');
}
function gmPickName(G) {
  // v4.3: GM dosyaları + kriz yıldızları da TEKİL isim havuzundan (usedNames'e kaydolur)
  return uniqueName(G.data.names, G.usedNames || (G.usedNames = {})) || 'Aday Oyuncu';
}
// §4: vaat ilerleme özeti (kongre mini barları) — 10: adım yok, 55: ara-adım, 90: koşul şu an sağlanıyor, 100: karara bağlandı
export function promiseStatus(G) {
  return (G.promises || []).map((pr) => {
    const meta = G.data.promises.find((x) => x.id === pr.id) || {};
    let pct = 10, label = 'adım bekleniyor';
    if (pr.kept === true) { pct = 100; label = 'tutuldu'; }
    else if (pr.kept === false) { pct = 0; label = 'tutulamadı'; }
    else if (evaluatePromise(pr, G)) { pct = 90; label = 'yolunda — koşul sağlanıyor'; }
    else if (pr.milestone) { pct = 55; label = 'ara adım atıldı'; }
    return { id: pr.id, name: meta.name || pr.id, difficulty: pr.difficulty, pct, label };
  });
}
function matchSentence(r, xf, xa) {
  if (r === 'W' && xf < xa) return 'Şanslı bir galibiyet — oyun rakibindi.';
  if (r === 'W') return 'Hak edilmiş üç puan.';
  if (r === 'L' && xf > xa) return 'Talihsiz mağlubiyet; üretim vardı.';
  if (r === 'L') return 'Sahada geriden gelen taraf bizdik.';
  return 'Paylaşılan puanlar.';
}
function eventBody(id) {
  return ({
    kongre: 'Güven dibe vurdu; kongre olağanüstü toplandı, bütçe kilitlendi.',
    boykot: 'Tribünler boykota gitti; gelir ve moral baskı altında.',
    tahta: 'Mali tablo bozuldu; transfer tahtası kapandı.',
    domino: 'Küme düşüşü! İtibar ve taraftar çöktü, yıldızlar kapıda.',
    zafer: 'ŞAMPİYONLUK! İtibar ve coşku tavan yaptı.',
  }[id] || '');
}
