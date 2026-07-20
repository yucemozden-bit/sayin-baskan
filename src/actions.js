// src/actions.js — TEK aksiyon katmanı. UI buradan geçer; motorları burası çağırır,
// state'i (G) burası mutasyona uğratır, eventBus'a burası yayınlar.
// ui/ modülleri yalnızca state okur; asla doğrudan motor çağırmaz/state yazmaz.

import { TUNING, TIERS, applyDifficulty, DIFFICULTY } from './config.js';
import { eventBus } from './core/eventBus.js';
import { generateSquad, squadMarketValue, developSquad, youthIntake, uniqueName } from './models/squadGen.js';
import { Player } from './models/player.js';
import { temelGuc, efektifGuc, macGucu, moralMult, formMult, kondMult, computeUygunluk, teknikEkip, atakSavunma } from './engines/power.js';
import { idealXI } from './models/squad.js';
import { simulateMatch, postMatch } from './engines/match.js';
import { createLeague, playWeek, standings, simulateLeagueMatch, applyResult } from './engines/league.js';
import { applyEconomy, payDebt, sponsorSlotWeekly } from './engines/economy.js';
import { generateSponsorOffer } from './engines/sponsorGen.js';
import { extendMarketDet, shownRating } from './engines/market.js';
import { MUHABIRLER } from './data/pressPool.js';
import { computeTargets, applyInertia } from './engines/gauges.js';
import { checkThresholdEvents, tickEventFlags } from './engines/events.js';
import { selectPromises, decayPromiseHope, judgePromises, isSelectable, addMidPromise } from './engines/promises.js';
import { eleksiyon } from './engines/election.js';
import { h32 as ozH32, absHafta, KADIN_AD, UNVANLAR, seviyeOf, haftalikGelir, VARLIK, DAVETLER, OLAYLAR, ROZETLER, AILE_TEL, varlikPasif } from './engines/ozel.js';
import { marketValue as pMarketValue } from './models/player.js';
import { KISILIKLER, kisilikOf, relDelta, esikDurum, klikOf, KLIK_TR, bkIsim } from './engines/iliski.js';
import { escalateHedef } from './engines/expectation.js';
import { assignPersonalities, spreadMorale, hierarchy, katman } from './engines/dynamics.js';
import { computeSentiment } from './engines/social.js';
import { generateCoaches, hireCoach, generateStaff, describeStaff, staffQualityWord, cfoNoiseRange, ROLE_TR, STAFF_TRAITS } from './models/staff.js';
import { generateMarket, transferFee, saleOffer, canBuy, windowOpen } from './engines/transfer.js';
import { canUpgrade, effectiveUpgradeCost, stadKapasite } from './engines/facilities.js';
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

// KAPI ZIRHI: kadroya DIŞ kaynaktan (AI kulübü fırsat/panik dosyası) gelen düz oyuncu objesini
// Player prototipine çevirir — kayıt yükleme (canlandir) ile aynı norm; refreshValue SAF (rand yok).
// Hanedan oğlu bu kapılardan geçmez, bilerek plain kalır (ozelTick — determinizm).
const asPlayer = (p) => { if (p && typeof p === 'object' && !(p instanceof Player)) Object.setPrototypeOf(p, Player.prototype); return p; };

// Tier başlangıç profilleri (yeni kariyer setup — MVP; tesis seçimi yok).
const CLUB = {
  kucuk: { name: 'Gölköy SK', founded: 1954, stadName: 'Göl Kenarı Stadı', gmName: 'Selim Arca', coach: { name: 'Yerel Hoca', taktik: 58, oyuncuYonetimi: 58, otorite: 60, yardimciEkip: 54, wage: 0.25, contractYears: 2 }, fac: { stadyum: 2, antrenman: 2, tibbi: 2, akademi: 2, scout: 1, ticari: 2 }, bigExp: 35 },
  orta: { name: 'Yıldızspor', founded: 1931, stadName: 'Yıldız Arena', gmName: 'Ferda Koyuncu', coach: { name: 'Deneyimli TD', taktik: 68, oyuncuYonetimi: 65, otorite: 68, yardimciEkip: 60, wage: 0.6, contractYears: 2 }, fac: { stadyum: 4, antrenman: 4, tibbi: 3, akademi: 3, scout: 2, ticari: 3 }, bigExp: 50 },
  buyuk: { name: 'İmparator FK', founded: 1907, stadName: 'İmparatorluk Stadyumu', gmName: 'Namık Serter', coach: { name: 'Dünyaca Ünlü TD', taktik: 82, oyuncuYonetimi: 76, otorite: 78, yardimciEkip: 78, wage: 1.2, contractYears: 2 }, fac: { stadyum: 7, antrenman: 6, tibbi: 6, akademi: 5, scout: 5, ticari: 6 }, bigExp: 70 },
  // 5 KADEME üst basamakları — kariyer başlangıcı DEĞİL (setup kartlarında yok); applyTier bigExp okur
  dev: { bigExp: 80 },
  efsane: { bigExp: 88 },
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

// SETUP ekranı (kariyer kuruluşu): başkan adı + kulüp adı/renk + şehir + zorluk uygular,
// sonra selectClub'ı çağırır. Zorluk kariyer başında KİLİTLENİR (cfg yeniden türetilir).
export function applySetup(G, o = {}) {
  if (o.zorluk && DIFFICULTY[o.zorluk]) { G.difficulty = o.zorluk; G.cfg = applyDifficulty(TUNING, o.zorluk); }
  if (o.mode) G.mode = o.mode;
  if (o.baskanAd && String(o.baskanAd).trim()) G.baskan = { name: String(o.baskanAd).trim().slice(0, 26) };
  const id = o.identity ? { ...o.identity } : {};
  if (o.kulupAd && String(o.kulupAd).trim()) id.name = String(o.kulupAd).trim().slice(0, 28);
  const identity = (id.name || id.stadName || id.founded) ? id : null;
  const lig2 = o.tier === 'lig2';
  selectClub(G, lig2 ? 'kucuk' : (o.tier || 'orta'), identity, { lig2 });
  if (o.renk) G.club.renk = o.renk;       // özel renk — tema bunu her şeyin üstünde okur
  if (o.sehir && String(o.sehir).trim()) G.club.sehir = String(o.sehir).trim().slice(0, 24);
  if (o.arma) G.club.arma = o.arma;       // arma stili (kalkan/daire/klasik) — krest her yerde bu şekilde çizilir
  if (o.lakap && String(o.lakap).trim()) G.club.lakap = String(o.lakap).trim().slice(0, 20);
  // BAŞKAN GEÇMİŞİ — pasif yetenek (kuruluşta bir defalık başlangıç etkisi; selectClub sonrası uygulanır)
  G.baskanGecmisi = o.baskanGecmisi || 'isadami';
  if (G.baskanGecmisi === 'isadami') {
    G.economy.kasa = Math.round(G.economy.kasa * 1.2 * 10) / 10; // +%20 başlangıç sermayesi
  } else if (G.baskanGecmisi === 'efsane') {
    G.tdRelation = clamp((G.tdRelation ?? 70) + 15, 0, 100);      // soyunma odası uyumu
    for (const p of G.squad) p.morale = clamp(p.morale + 6, 0, 100);
  } else if (G.baskanGecmisi === 'halk') {
    G.gauges.taraftar = clamp(G.gauges.taraftar + 8, 0, 100);     // taraftar sabrı (yüksek destekle başla)
  }
  return G;
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
  ultrasInit(G);                            // KONGRE 2.6: gruplara iliski+talep katmanı
  G.delege = delegeInit();                  // KONGRE 2.6: 4 seçmen bloku (nötr 50)
  G.worldSeason = 0;                        // D1: AI drift sayacı (ilk sezon drift yok)
  G.tesisBakim = {}; for (const t of TESIS_BAKIM) G.tesisBakim[t] = 0; // bakım saati kariyer başında kurulur
  G.flags = {}; G.rival = { attractiveness: 0 }; G.sozTutmaBirikim = 0;
  G.promises = []; G.history = { seasons: [] };
  G.term = { income: 0, wage: 0, starBought: false, maxTicket: G.economy.ticketPrice, weeks: 0, ticari: 0, academyGraduates: 0, socialProjects: 0 };
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
  if (G.delege) G.delege.yemekHak = TUNING.DELEGE.YEMEK.hak; // 2.6: dönem başı blok sofraları tazelenir
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
  // 3. KARAR — BASIN HATTI (beklenti yönetimi): iddia kurulun hedef çıtasını GERÇEKTEN oynatır
  const pk = G.directive.press || 'sessiz';
  if (pk === 'iddiali') {
    G.club.hedefSira = Math.max(1, G.club.hedefSira - 1);
    G.gauges.taraftar = clamp(G.gauges.taraftar + 2, 0, 100);
    G.transferHype = Math.max(G.transferHype ?? 50, 68);
    pushInbox(G, { cat: 'medya', t: 'Manşet: "Eyvallahımız yok!"', b: `İddialı çıkışın kurul beklentisini yükseltti — hedef artık ${G.club.hedefSira}. sıra. Tribün coştu; tutturamazsan bu manşet kongrede karşına çıkar.`, noQueue: true });
  } else if (pk === 'alcak') {
    G.club.hedefSira = Math.min(17, G.club.hedefSira + 1);
    G.transferHype = Math.min(G.transferHype ?? 50, 44);
    pushInbox(G, { cat: 'medya', t: 'Basın notu: alçakgönüllü açılış', b: `Beklenti yönetimi: kurul çıtayı ${G.club.hedefSira}. sıraya çekti, tribün "iddiasız mıyız?" diye söylendi. Sessiz başla, sonunda konuş.`, noQueue: true });
  } else {
    G.mediaTone = (G.mediaTone || 0) - 0.15;
    pushInbox(G, { cat: 'medya', t: '"Başkan konuşmadı"', b: 'Sezon açılışında basına tek cümle yok. Köşe yazarları bunu not etti — sorular sahada cevap bekleyecek.', noQueue: true });
  }
  initSeason(G, { termStart: true }); // dönem başı: kese Makam Odası'nda kuruldu, sorma
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
  if (!G.ozel) initOzel(G); // ÖZEL HAYAT — aile/servet katmanı (dönem geçişinde korunur)
  G.iflasTaban ??= Math.round(G.economy.borc); // İFLAS eşiği tabanı: kariyer başı borcu (senaryo çarpanı DAHİL — miras suç değil)
  G._ilkKokpit = G.meta.term === 1 && G.worldSeason === 1; // AÇILIŞ 5a: nabız devralma animasyonu
}

function initSeason(G, opts = {}) {
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
    // LİG DE GELİŞİR (2026-07-21, gelişim-27 karşı ağırlığı): rakip kadrolar da her sezon olgunlaşır —
    // oyuncu kadrosu kariyer boyu büyürken lig yerinde sayarsa uzun kariyer gerilimi ölür.
    // Determinist (rand YOK); merdivenin GÖRELİ sırası korunur, senin fazladan büyümen yine sıra oynatır.
    for (const o of G.opponents || []) o.strength = Math.min(92, o.strength + TUNING.LIG_GELISIM);
    const { news, crises } = aiSeasonStart(G.opponents);
    if (news.length) { G.leagueNews = news[0]; for (const n of news.slice(0, 2)) pushInbox(G, { cat: 'lig', t: 'Lig Gündemi', b: n }); }
    // B1d: AI FFP baskısı — aşırı harcayan AI zorunlu satışa düşer → KELEPİR dosyası (motivasyon görünür)
    if (rand(0, 1) < TUNING.MEGA.FFP2.AI_KELEPIR_P) {
      const satici = G.opponents[randint(2, G.opponents.length - 1)];
      const kp = new Player({ id: 'kf' + (G._pid = (G._pid || 1000) + 1), name: gmPickName(G), pos: ['DEF', 'MID', 'FWD'][randint(0, 2)], overall: randint(Math.round(G.temelGuc), Math.round(G.temelGuc) + 6), potential: 0, age: randint(24, 29), contractYears: 2 });
      kp.potential = kp.overall; kp.wage *= (G.marketMult || 1);
      // BAŞKAN İLİŞKİSİ (2.3): satıcı başkanla aran iyiyse kelepir önce sana + kırık fiyat;
      // küsseniz fiyat şişer. Efsane Başkan (sv.8) her masada ekstra saygı görür.
      const bkr = (G.bkRel || {})[satici.id] ?? 50;
      const bkMult = bkr >= 70 ? ((G.ozel?.seviye ?? 1) >= 8 ? 0.85 : 0.9) : bkr < 30 ? 1.15 : 1;
      const kfee = transferFee(kp) * (G.marketMult || 1) * TUNING.MEGA.FFP2.KELEPIR_MULT * bkMult;
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
    G.club.stadiumCapacity = G.megaStad ? Math.round(T.stad * 1.2) : T.stad; // #8: kompleks tier geçişinde kaybolmaz
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
  // VARLIK → TAKIM köprüsü (kullanıcı isteği 2026-07-21): yat sahibi başkan sezonu TAKIM TEKNE
  // GÜNÜYLE açar — kişisel yatırım soyunma odasına döner. Bilinçli alım şartı (autoplay varlık
  // almaz → kalibrasyon bantları nötr); determinist, rand YOK.
  {
    const tekneLv = G.ozel?.varlik?.tekne || 0;
    if (tekneLv >= 2 && (G.squad || []).length) {
      const mBonus = tekneLv >= 3 ? 6 : 4;
      for (const p of G.squad) { p.morale = clamp(p.morale + mBonus, 0, 100); if (tekneLv >= 3) p.form = clamp(p.form + 3, 0, 100); }
      pushInbox(G, { cat: 'kulup', t: tekneLv >= 3 ? '🛥️ MEGA YATTA TAKIM GÜNÜ' : '🛥️ Takım tekne günü', sig: 'tekne-gun-' + G.worldSeason, b: `Kamp, başkanın ${tekneLv >= 3 ? 'mega yatında' : 'yatında'} açıldı — soyunma odası güldü (moral +${mBonus}${tekneLv >= 3 ? ' · form +3' : ''}). "Böyle başkanla oynanır" fısıltısı köpüğe karıştı.`, noQueue: true });
    }
  }
  G.ticketLetterDone = false;
  G.transferWindow = windowOpen(1);
  if (G.transferWindow) G.market = makeMarket(G);
  // BASIN REHBERİ (sezon açılışı — deterministik, RNG'siz): favoriler + SENİN tahmini yerin
  // + küme adayları. Oyuncuya sezonun hikâyesini baştan verir — beklenti çıtası somutlaşır.
  {
    const guclu = [...G.opponents].sort((a, b) => b.strength - a.strength);
    const benim = Math.round(G.temelGuc);
    const tahmin = 1 + guclu.filter((o) => o.strength > benim).length; // güç sıralamasındaki yerin
    const fav = guclu.slice(0, 3).map((o, i) => `${i + 1}) ${o.name}`).join(' · ');
    const kume = guclu.slice(-2).map((o) => o.name).join(', ');
    const yorum = tahmin <= 3 ? 'Basın seni şampiyonluk atına yazdı — beklenti yükü sırtında.'
      : tahmin <= Math.max(3, G.club.hedefSira) ? `Kurul hedefi (${G.club.hedefSira}.) ulaşılabilir görünüyor — ama kâğıt üstünde maç kazanılmıyor.`
        : `Kâğıt üstünde hedefin (${G.club.hedefSira}.) ALTINDASIN — bu sezon fazlasını koşacaksın.`;
    pushInbox(G, {
      cat: 'manset', t: `📰 SEZON REHBERİ ${G.worldSeason}. YIL — basın tahminleri`, sig: 'rehber-' + G.worldSeason,
      b: `Favoriler: ${fav}. Küme adayları: ${kume}. ${G.club.name} için tahmin: ${tahmin}. sıra. ${yorum}`, noQueue: true,
    });
  }
  // Y1: HİKAYE TOHUMU — sezonun ana gerilim hattı (olay ağırlığı + sezon karnesi cümlesi)
  G.storyArc = pickStorySeed(G);
  pushInbox(G, { cat: 'manset', t: `Sezonun sorusu: ${G.storyArc.label}`, sig: 'arc-' + G.worldSeason, b: G.storyArc.key === 'yildiz_veda' && G.storyArc.starName ? `Herkes aynı şeyi soruyor: ${G.storyArc.starName} kalacak mı?` : 'Medya sezona bu çerçeveden bakacak.' });
  // Y2/Y6 sezon sayaçları
  G.phoneCount = 0; G.phoneQueue = []; G.deskCounts = G.deskCounts || {};
  G.fedYaziCount = 0; G.fedJestDone = false; // B1c sezon sayaçları
  G.tisBulusmaCount = 0; G.koreoCount = 0; G.kapakDone = false; G.kapakLanet = null; // B2 sezon sayaçları
  G.sezonSatis = 0; G.sezonAlim = 0; G.ilan = null; // B3/B4 sezon sayaçları
  // İLİŞKİ (2.1): "satmam sözü" sezonu tamamladı → tutuldu; güven + iyilik defteri işler, söz düşer
  for (const p of G.squad) if (p.relx?.soz?.tip === 'satmam') {
    p.baskanaGuven = clamp((p.baskanaGuven ?? 50) + relDelta(p.relx.kisilik, 6), 0, 100);
    p.relx.iyilik = (p.relx.iyilik || 0) + 1; p.relx.soz = null;
  }
  G.termSpent = 0; G.termSale = 0; // TRANSFER KESESİ her sezon sıfırlanır (harcama + satış geliri)
  G.club.kadroDegerBaz = G.club.kadroDeger; G.temelGucBaz = G.temelGuc; // BÜYÜME tabanı: sezon boyu değer/güç artışı taraftar/kurul desteğini artırır
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
  // Dönem-İÇİ sezonlarda (2./3. sezon) GM güncel kasaya göre yeni transfer kesesi önerir → başkan onaylar/kısar/açar
  if (!opts.termStart) proposeSeasonBudget(G);
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
  santiyeTick(G); // şantiye kampta da çalışır — işçiler maç beklemez
  // KAMP TAZELEMESİ (bug fix 2026-07-20): kondisyon sezonlar arası TAŞINIYORDU — yoğun oynatılan
  // on bir yeni sezona "bitkin" başlıyordu. Kamp haftası herkesi dinlendirir (3 hafta ≈ tam depo).
  for (const p of G.squad) p.fitness = clamp(p.fitness + TUNING.PRESEASON_FIT, 0, 100);
  G.transferWindow = true; // hazırlık dönemi = transfer masası açık
  if (!G.market) G.market = makeMarket(G);
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

// PİYASA REFERANSI: havuz tavanı yalnız BENİM gücüme kilitlenmez — lig zirvesine doğru
// YARI YOLDA, en fazla +10 (kullanıcı 2026-07-22: "72'den büyük adam yok" ama abartı da yok:
// zirve 85'lik dev diye hafta 2'de 92'lik isim doğmasın). Lig geliştikçe (LIG_GELISIM) piyasa
// da büyür; 2. Lig'de zirve senin altındaysa ref = kendi gücün (doğal zayıf pazar).
function marketRef(G) {
  const temel = Math.round(G.temelGuc || 50);
  const rakipMax = Math.max(0, ...Object.values(G.league?.table || {}).filter((t) => t && !t.mine).map((t) => t.strength || 0));
  return temel + Math.min(10, Math.max(0, Math.round((rakipMax - temel) / 2)));
}

// PİYASA KURULUMU: seed'li çekirdek (RNG akışı aynı kalır) + deterministik +70 isim
// (A8: 80+ oyunculuk havuz — ekran sayfalama/filtreyle gösterir).
function makeMarket(G) {
  // TEK isim seti: kadro + dosyalar + üretilen her isim — hiçbir katman klon üretemez
  // (devasa bulguları 2026-07-22: foreign klonu + dosyada bekleyen adayın klonu)
  const used = aktifIsimler(G);
  const core = generateMarket(marketRef(G), { names: G.data.names, scout: G.facilities.scout, exclude: used });
  const ek = extendMarketDet(marketRef(G), {
    names: G.data.names, scout: G.facilities.scout, count: 70, exclude: used,
    salt: (G.meta?.season || 1) * 100 + ((G.meta?.week || 1) >= 17 ? 1 : 0),
  });
  return core.concat(ek);
}

// Sürekli scouting: pencere açıkken her hafta bir isim başka kulübe imzalar, gözlemci ağı yenisini bulur.
// Gözlemci ağı (scout tesisi) geliştikçe bulunan oyuncunun tavanı yükselir.
export function scoutTick(G) {
  if (!G.transferWindow || !Array.isArray(G.market) || G.market.length === 0) return;
  // RAKİP İLGİSİ + SÜRE BASKISI (deterministik): her isimde ilgi sayacı + dosya kapanma
  // süresi. Süresi dolan RAKİBE İMZA ATAR; yerine YENİ isim gelir (havuz canlı + sabit ~80).
  // İsimli haber yalnız sorguladıkların/yıldızlar için — gerisi TEK özet satırı (inbox taşmaz).
  const rakipler = Object.values(G.league?.table || {}).filter((t) => t && t.name && t.id !== MY);
  const gidenler = [];
  for (let i = G.market.length - 1; i >= 0; i--) {
    const p = G.market[i];
    if (p._ilgi == null) { const mh = mh32(String(p.id) + '|' + p.name); p._ilgi = mh % 4; p._kalan = 2 + ((mh >>> 4) % 4); continue; }
    p._kalan -= 1;
    if (p._kalan <= 0) gidenler.push(G.market.splice(i, 1)[0]);
  }
  // KİMLİK ZIRHI: aynı hafta İKİNCİ tick (test/çift çağrı) aynı salt'la AYNI oyuncuyu yeniden
  // üretebilir — "rakibe imzalayan" adam aynı kimlikle geri gelemez (bu tick gidenler + havuz yasak).
  const gidenId = new Set(gidenler.map((x) => x.id));
  const havuzdaYok = (p) => !gidenId.has(p.id) && !G.market.some((x) => x.id === p.id);
  // TEK isim seti (2026-07-22): kadro + havuz + DOSYADA BEKLEYENLER — bu tick'in tüm üretimleri klonsuz
  const usedAd = aktifIsimler(G);
  if (gidenler.length) {
    // Kaçanların yerine taze isimler — piyasa döner ama boşalmaz
    const yerine = extendMarketDet(marketRef(G), { names: G.data.names, scout: G.facilities.scout, count: gidenler.length, exclude: usedAd, salt: 50000 + (G.meta?.week || 0) + (G.meta?.season || 1) * 53 }).filter(havuzdaYok);
    for (const p of yerine) p._yeniW = G.meta?.week || 0; // listede YENİ rozeti — dönüş görünür olsun
    G.market.push(...yerine);
    const onemli = gidenler.filter((p) => p._sorgu || p.overall >= Math.round(G.temelGuc) + 12).slice(0, 2);
    for (const p of onemli) {
      // Yabancı isimli oyuncu YURTDIŞINA gider (2026-07-22): "Wesley Damasceno Bozkırspor'a imzaladı"
      // tuhaf kaçıyordu — foreignClubs havuzundan hash'le kulüp seçilir (rand'sız).
      const yb = yabanciKulup(G, p.name);
      if (yb) {
        pushInbox(G, { cat: 'transfer', t: `${p.name} yurtdışına imza attı`, b: `${yb} dosyayı kapattı — menajeri Avrupa hattını hiç kapatmamış. Geç kaldık Başkanım.`, noQueue: true });
      } else {
        const rk = rakipler.length ? rakipler[mh32(p.name) % rakipler.length].name : 'bir rakip';
        pushInbox(G, { cat: 'transfer', t: `${p.name} rakibe imza attı`, b: `${rk} dosyayı kapattı — geç kaldık Başkanım. İlgi gören isim beklemez.`, noQueue: true });
      }
    }
    const sessiz = gidenler.length - onemli.length;
    if (sessiz > 0) pushInbox(G, { cat: 'transfer', t: `Piyasa döndü: ${sessiz} isim başka kulüplere gitti`, b: 'Scout ağı listeyi tazeledi — yeni isimler raporda.', noQueue: true, sig: 'piyasa-donus' });
  }
  if (G.market.length === 0) return;
  G.market.sort((a, b) => b.overall - a.overall);
  // DETERMİNİSTİK yerel RNG (ana akışı tüketmez → seed'li testler kaymaz). Çeşitlilik: sıra no + hafta + güç.
  const seq = (G._mktSeq = (G._mktSeq || 0) + 1);
  let s = (seq * 2654435761 + (G.meta.week || 0) * 40503 + Math.round(G.temelGuc) * 97) >>> 0;
  const nx = () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const dR = (lo, hi) => lo + nx() * (hi - lo);
  const dI = (lo, hi) => Math.floor(dR(lo, hi + 1));
  const POS = ['GK', 'DEF', 'MID', 'FWD'];
  const base = marketRef(G); // lig-zirvesi referansı — tavan kendi gücüne kilitlenmez
  const sb = Math.round((G.facilities.scout || 0) * 1.5); // gözlemci ağı → daha yüksek tavan
  const ov = Math.max(35, Math.min(92, base + dI(-6, 10 + sb)));
  const age = dI(18, 32);
  const nm = G.data.names;
  // İSİM ÇAKIŞMA ENGELİ: kadro + havuzdaki biriyle aynı isim üretme (soyadı determinist kaydır)
  let name = 'Serbest ' + seq;
  if (nm) {
    const fi = dI(0, nm.first.length - 1); let li = dI(0, nm.last.length - 1);
    name = `${nm.first[fi]} ${nm.last[li]}`;
    for (let k = 0; usedAd.has(name) && k < nm.last.length; k++) { li = (li + 1) % nm.last.length; name = `${nm.first[fi]} ${nm.last[li]}`; }
    usedAd.add(name);
  }
  const p = new Player({ id: 'mkt-w' + seq, name, pos: POS[dI(0, 3)], overall: ov, potential: age < 24 ? Math.min(95, ov + dI(0, 8)) : ov, age, contractYears: dI(2, 4), rng: dR });
  const pr = TUNING.TRANSFER.PREMIUM; p.fee = p.marketValue * ((pr[0] + pr[1]) / 2); // deterministik bedel (transferFee rand kullanır)
  const mhN = mh32(String(p.id) + '|' + p.name); p._ilgi = mhN % 4; p._kalan = 2 + ((mhN >>> 4) % 4); // yeni isim de ilgi/süre ile doğar
  p._yeniW = G.meta?.week || 0;
  G.market.push(p);
  // HAFTALIK VİTRİN (kullanıcı 2026-07-22: "sürekli güncellenmeli, her hafta yeni isimler"):
  // her pencere haftası +2 taze isim daha — İLKİ YÜKSEK BANTTAN (lig zirvesi +4..+12+scout:
  // "yıldız adayı"). Hepsi YENİ rozetiyle listeye düşer; hash-salt determinist, ana RNG'yi tüketmez.
  const wkV = G.meta?.week || 0, sezV = G.meta?.season || 1;
  const bandLi = extendMarketDet(base, { names: nm, scout: G.facilities.scout, count: 1, salt: 70000 + sezV * 911 + wkV * 7, exclude: usedAd, band: [4, 12] });
  for (const v of bandLi) v._vitrinYildiz = true; // listede ★ VİTRİN rozeti — haftanın öne çıkanı görünür
  const vitrin = [
    ...bandLi,
    ...extendMarketDet(base, { names: nm, scout: G.facilities.scout, count: 1, salt: 80000 + sezV * 911 + wkV * 7, exclude: usedAd }),
  ].filter(havuzdaYok); // kimlik zırhı: aynı hafta ikinci tick'te vitrin klonu doğmaz
  for (const v of vitrin) v._yeniW = wkV;
  G.market.push(...vitrin);
  // Havuz boyu SABİT (~POOL): en zayıflar sessizce başka kulüplere — sorgu/derin dosyalı
  // ve bu hafta gelen isimler korunur (oyuncunun emeği/yeniliği silinmez).
  const POOL = TUNING.TRANSFER.POOL || 80;
  G.market.sort((a, b) => b.overall - a.overall);
  for (let i = G.market.length - 1; G.market.length > POOL && i >= 0; i--) {
    const z = G.market[i];
    if (z._sorgu || z._derin || z._yeniW === wkV) continue;
    G.market.splice(i, 1);
  }
}

// GÜVENLİK AĞI — kadro bütünlüğü. Nadir yollardan (piyasa id tekrarı hafta 17, kiralık dönüşü…)
// oluşabilecek ÇİFT ID'yi tekilleştirir (oyuncu KAYBOLMAZ, id düzelir) + patolojik tavan aşımını kırpar.
// beginWeek'te her hafta çağrılır → "kadro id çakışması" ve "kadro boyu" invaryantları asla tripleyemez.
const SQUAD_HARD_MAX = 40; // hedef 22-28, sezon sonu 30'a iner; 40 yalnız patolojik durumda tetiklenir
function normalizeSquad(G) {
  if (!Array.isArray(G.squad) || !G.squad.length) return;
  const seen = new Set();
  for (const p of G.squad) {
    if (seen.has(p.id)) p.id = 'sq' + (G._pid = (G._pid || 1000) + 1); // çift id → yeni kimlik
    seen.add(p.id);
  }
  if (G.squad.length > SQUAD_HARD_MAX) {
    G.squad.sort((a, b) => b.overall - a.overall);
    const atilan = G.squad.slice(SQUAD_HARD_MAX);
    G.squad.length = SQUAD_HARD_MAX;
    pushInbox(G, { cat: 'transfer', t: 'Kadro taştı — liste boşaltıldı', b: `Kadro tavanı aşılmıştı; en zayıf ${atilan.length} isim serbest bırakıldı.`, noQueue: true });
  }
}

export function beginWeek(G) {
  G.hazirlik = 0; // maç haftası başladıysa hazırlık dönemi bitmiştir (gerçek oyunda zaten 0)
  santiyeTick(G); // ŞANTİYE: ihale işi hafta hafta ilerler (kurdele kesilince kademe devreye girer)
  normalizeSquad(G); // güvenlik ağı: çift id / tavan aşımı öz-onarımı (invaryant garantisi)
  const wk = G.meta.week;
  G.transferWindow = windowOpen(wk);
  if (wk === 17) G.market = makeMarket(G);
  scoutTick(G); // sürekli scouting: piyasa her hafta tazelenir + ilgi/süre nabzı
  sponsorMarketTick(G); // sponsor pazarı: eski teklifler çekilir, yeni markalar kapıyı çalar
  // Haftalık sorgu hakkı: scout ağı + başkan mesaisi (mesai ≥2 VE takat ≥30 → +1)
  // + DEVİR: geçen haftadan kullanılmayan hak +2'ye kadar taşınır (istifçilik değil, birikim)
  const sorguDevir = Math.min(2, Math.max(0, G.sorguHak ?? 0));
  const scoutUcus = (G.ozel?.varlik?.hava || 0) >= 2 ? 1 : 0; // VARLIK İMTİYAZI: uçak — scout uçuşları hızlanır
  G.sorguHak = 1 + (G.facilities.scout || 0) + ((G.ozel?.prog?.mesai || 0) >= 2 && (G.ozel?.g?.enerji ?? 100) >= 30 ? 1 : 0) + sorguDevir + scoutUcus;
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
  // ALIŞKANLIK: üst üste prim etkisini YARILAR (2^n) — taktik kullanım (derbi öncesi) tam güç,
  // her maç basmak para israfı olur. Kalibrasyon bandını da korur (bot spam'i sönümlenir).
  if (MP) {
    G.primMacSeri = (G.primMacSeri || 0) + 1;
    primPower *= 1 + (MP.power - 1) / Math.pow(2, Math.min(4, G.primMacSeri - 1));
    primWinCost += MP.cost;
  } else G.primMacSeri = 0;
  if (G.ozelArmed) primPower *= TUNING.PRIM.OZEL.power;
  if (G.seriBoostWeeks > 0) primPower *= TUNING.PRIM.SERI.nextPower;

  // Maç gücü TemelGüç'ten; telkin+prim+takvim çarpanları maça biner.
  const derbySwing = isDerby ? 1 + rand(-CAL.DERBY_SWING, CAL.DERBY_SWING) : 1;
  // BÜYÜK BUG DÜZELTMESİ (kullanıcı bulgusu 2026-07-21: "kokpit 63→38 MAÇ GÜNÜ diyor, maç 65 oynuyor"):
  // sim TEMELGÜÇ kullanıyordu — moral/form/KONDİSYON/sakatlık-uygunluk çarpanları (Katman 2) maça
  // HİÇ girmiyordu; "MAÇ GÜNÜ" göstergesi kozmetikti. Bible-5.3: MaçGücü = EFEKTİF × saha çarpanları.
  // Artık bitkin kadro sahada gerçekten bedel öder; rotasyon/moral yönetimi gerçek karşılık bulur.
  const myStrength = efektifGuc(powerCtx(G)) * telkinFx.power * primPower * derbySwing * (isIntl ? CAL.INTL_POWER : 1);
  const myMG = macGucu(myStrength, { isHome, stadyum: G.facilities.stadyum, taraftar: G.gauges.taraftar });
  const oppMG = macGucu(G.league.table[oppId].strength * TUNING.MATCH.AI_EFEKTIF, { isHome: !isHome, stadyum: TUNING.MATCH.AI_STAD, taraftar: TUNING.MATCH.AI_TARAFTAR });
  // Y3: YARI 1 (45dk) simülasyonu — devre arası kararı 2. yarıyı ETKİLEYECEK
  const SEG = TUNING.YASAYAN.SEG;
  const T = TUNING.BASE_GOALS * telkinFx.goalsMult;
  // B1c: tartışmalı VAR kararlarının yönü — gizli federasyon hattı, ±%3 tavanlı MİKRO etki
  const fedBias = 1 + clamp(((G.fedIliski ?? 50) - 50) / 50, -1, 1) * TUNING.MEGA.FED.VAR_BIAS;
  // B2c: koreografi gecesi — o EV maçında tribün duvar (+%1.5)
  const koreoMult = (G.koreoPending && isHome) ? TUNING.MEGA.KOREO.EV_AVANTAJ : 1;
  if (G.koreoPending && isHome) G.koreoPending = false;
  const myMGf = myMG * fedBias * koreoMult;
  // KADRO YÖNÜ: hücum/savunma dengesi maçın AÇIKLIĞINI belirler — iki tarafın xG'si de bizim
  // tilt'le çarpılır (savunma kadrosu → kapalı maç: az yer/az atar · hücum kadrosu → açık maç).
  // xG paylaşım ORANI değişmez → kim kazanır dengesi (kalibrasyon) yerinde kalır.
  const yonT = atakSavunma(G.squad).tilt;
  const h1 = simulateMatch(isHome ? myMGf : oppMG, isHome ? oppMG : myMGf, undefined, { baseGoals: T * SEG.H1, tiltH: yonT, tiltA: yonT });
  G.matchCtx = {
    wk, isHome, oppId, isDerby, isIntl, telkinType: telkinFx.type, primWinCost,
    myMG: myMGf, oppMG, T, h1, myH2: 1, oppH2: 1, htMove: null, htNote: '', trace: [],
    oppName: G.league.table[oppId].name, yonT,
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
    undefined, { baseGoals: ctx.T * SEG.H2A, tiltH: ctx.yonT || 1, tiltA: ctx.yonT || 1 },
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
    undefined, { baseGoals: lateT, tiltH: ctx.yonT || 1, tiltA: ctx.yonT || 1 },
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
  // VARLIK → TAKIM köprüsü: hava aracı (sv2+) deplasman dönüşünü konfora çevirir — tüm kadro
  // (yedekler de uçakta) kondisyon toparlar. Bilinçli alım şartı; determinist, rand YOK.
  if (!isHome && (G.ozel?.varlik?.hava || 0) >= 2) {
    const fB = (G.ozel.varlik.hava >= 3 ? 2 : 1);
    for (const p of G.squad) p.fitness = clamp(p.fitness + fB, 0, 100);
  }
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
  G.term.weeks = (G.term.weeks || 0) + 1; // P16 haftalık ortalama için
  G.term.ticari = (G.term.ticari || 0) + led.gelir.sponsor + led.gelir.forma + led.gelir.uyelik; // ticari gelir izi
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
  checkBorcsuz(G); // borçsuza geçiş anı: mali uçar + diğer disiplinlere coşku dalgası
  decayPromiseHope(G);

  // D4: milli aradan sakat dönme (%8, en iyi oyunculardan biri)
  if (isIntl && rand(0, 1) < CAL.INTL_INJ) {
    const star = G.squad.slice().sort((a, b) => b.overall - a.overall)[randint(0, 2)];
    if (star) { star.injuryWeeks = Math.max(star.injuryWeeks, randint(1, 3)); pushInbox(G, { cat: 'saglik', t: 'Milli takımdan kötü haber', b: `${star.name || 'Yıldızımız'} sakat döndü — GM: "Her milli arada aynı korku."` }); }
  }

  // D4: kupa turu (tek maç eleme; hafta 31 finali → kupa ZAFERİ)
  if (CAL.CUP_WEEKS.includes(wk) && G.cup && G.cup.alive) {
    const cupOpp = clamp(Math.round(G.temelGuc + rand(-CAL.CUP_SPREAD, CAL.CUP_SPREAD) + G.cup.round * CAL.CUP_RAMP), 30, 92);
    const cupYon = atakSavunma(G.squad).tilt; // kupa maçı da kadro yönünü hisseder
    const cres = simulateMatch(macGucu(efektifGuc(powerCtx(G)), { isHome: true, stadyum: G.facilities.stadyum, taraftar: G.gauges.taraftar }), macGucu(cupOpp * TUNING.MATCH.AI_EFEKTIF, { isHome: false }), undefined, { tiltH: cupYon, tiltA: cupYon }); // kupada da EFEKTİF (bitkin kadro kupada da bedel öder; AI simetri oranı)
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
    for (const y of youths) { y.ocak = true; y.name = klonKir(G, y.name); } // B4d ocak izi + piyasa klonu kırıcı
    G.term.academyGraduates = (G.term.academyGraduates || 0) + youths.length; // P05/P12: akademi mezunu sayacı
    // A1: Akademi Direktörü — potansiyel dağılımı + altın çocuk şansı çarpanı
    const akDir = G.staff?.akademi;
    const goldenP = CAL.GOLDEN_P + (akDir ? akDir.skill * TUNING.STAFF.GOLDEN_PER_SKILL : 0);
    let golden = null;
    for (const y of youths) {
      if (akDir) y.potential = Math.min(95, y.potential + Math.round((akDir.skill - 50) / TUNING.STAFF.AKADEMI_POT_DIV));
      // NOT: rand HER gençte çekilir (zar sayısı sabit); _super (sv9-10 süperstar adayı) zarsız manşete gider
      const sansli = rand(0, 1) < goldenP;
      if (y._super || sansli) { if (sansli && !y._super) y.potential = Math.max(y.potential, randint(85, 92)); golden = golden || y; }
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
    const ev0 = pickRandomEvent(G, G.data.events);
    const ev = ev0 ? olayKisisellestir(G, ev0) : ev0;
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
    G.history = { seasons: [...savedH.seasons, { pos: G.myPos ?? G.club.hedefSira, champion: false }] }; // maç öncesi myPos yok → hedef sıra (nötr)
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
  // İFLAS / KAYYUM — CLAUDE.md çekirdek kuralı (büyük test bulgusu: GAME_OVER hiç tetiklenmiyordu).
  // Ekonomide kasa<0 otomatik borca döndüğünden iflas BORÇ dayanılmazlığıdır. Eşik GÖRELİ:
  // mirasla devraldığın borç suç değildir (Batan Dev 760'la doğar!) — SENİN yönetiminde
  // taban×1.25+150 aşılırsa kayyum gelir (normal kulüp 60 → eşik 500; Batan Dev 760 → 1100).
  const iflasEsik = iflasEsigi(G);
  if (G.phase === 'SEASON_LOOP' && G.economy.borc >= iflasEsik - 100 && G._kayyumUyari !== G.meta.season) {
    G._kayyumUyari = G.meta.season;
    // #3 KAYYUM KURTULUŞ PAKETİ — GM masaya acil satış dosyası koyar: en değerli 3 satılabilir oyuncu
    // (başkan oğlu hariç), piyasanın %70'ine TEK KALEMDE. Bedelin tamamı borca. Determinist: sıralama, rand yok.
    const satilabilir = G.squad.filter((p) => !p.aileOgul).sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0)).slice(0, 3);
    const tutar = Math.round(satilabilir.reduce((s, p) => s + (p.marketValue || 0), 0) * 0.7);
    const isim = satilabilir.map((p) => `${p.name} (${fmt1(p.marketValue || 0)}mn)`).join(' · ');
    if (satilabilir.length >= 2 && tutar > 0) {
      pushInbox(G, { cat: 'mali', t: `KAYYUM KAPIDA — borç ${Math.round(G.economy.borc)}mn`, b: `Bankalar dosyayı federasyona taşıdı; ${iflasEsik}mn sınırı aşılırsa yönetim kayyuma devredilir. ${G.gm?.name || 'GM'}'in KURTULUŞ PAKETİ: ${isim}. Konsorsiyum paket için ${tutar}mn'ye hazır (piyasanın %70'i) — bedelin TAMAMI borca gider. Acı reçete ama koltuğu kurtarır.`, action: 'kayyum', paket: satilabilir.map((p) => p.id), tutar, noQueue: true });
    } else {
      pushInbox(G, { cat: 'mali', t: `KAYYUM KAPIDA — borç ${Math.round(G.economy.borc)}mn`, b: `Bankalar dosyayı federasyona taşıdı. ${iflasEsik}mn sınırı aşılırsa yönetim kayyuma devredilir. Sat, kes, kurtar — zaman daralıyor.`, noQueue: true });
    }
  }
  if (G.phase === 'SEASON_LOOP' && G.economy.borc >= iflasEsik) {
    pushInbox(G, { cat: 'mali', t: `İFLAS — kayyum atandı (borç ${Math.round(G.economy.borc)}mn)`, b: 'Borç dayanılmaz noktaya dayandı; federasyon yönetimi aldı. Koltuk tarihe karıştı.', noQueue: true });
    endCareer(G, 'kulüp iflası — kayyum atandı');
    return { ok: true };
  }
  // DERBİ BİLANÇOSU — kariyer boyu G/B/M sayacı (Kulüp Kimliği "Ezeli Rekabet" paneli okur; RNG yok)
  if (isDerby && myRes) { G.derbi = G.derbi || { W: 0, D: 0, L: 0 }; G.derbi[myRes] = (G.derbi[myRes] || 0) + 1; }
  // KİMYA DOĞAL OTURMA (kullanıcı isteği): birlikte oynadıkça hafif (+0.1/maç), kazandıkça daha çok
  // (+0.5 toplam) oturur — transfer sarsıntısının (−4) doğal panzehiri. Deterministik, rand yok.
  if (G.kimya && myRes) G.kimya.kimya = clamp(G.kimya.kimya + 0.1 + (myRes === 'W' ? 0.4 : 0), 0, 100);
  // 🏁 KİLOMETRE TAŞLARI (motivasyon): kariyerin büyük sayıları TEK SEFERLİK kutlanır — "bir sonraki
  // taşa az kaldı" çekimi. Değer taşları kariyer başı BAZA göre (büyük kulüpte anında patlamasın).
  if (myRes) {
    const ist = (G.istatistik = G.istatistik || { mac: 0, W: 0 });
    ist.mac++; if (myRes === 'W') ist.W++;
    G._tasBaz = G._tasBaz || { deger: Math.max(1, G.club.kadroDeger || 1) };
    G._taslar = G._taslar || {};
    const tas = (id, kosul, t, b) => {
      if (G._taslar[id] || !kosul) return;
      G._taslar[id] = true;
      pushInbox(G, { cat: 'manset', t: `🏁 KİLOMETRE TAŞI: ${t}`, sig: 'tas-' + id, b, noQueue: true });
      anKarti(G, { t, b: 'Kilometre taşı geçildi — defterde yerini aldı.', etki: 4 });
    };
    tas('mac50', ist.mac >= 50, 'Koltukta 50. maç', 'Elli maçlık başkan — artık bu koltuğun eskisi sensin. Tribün adını ezberledi.');
    tas('mac100', ist.mac >= 100, 'Koltukta 100. maç', 'Yüz maç. Kulüp tarihi seni artık "dönem" olarak anıyor.');
    tas('mac250', ist.mac >= 250, 'Koltukta 250. maç', 'Çeyrek binlik başkan — bu arma seninle yaşlandı, sen onunla büyüdün.');
    tas('g25', ist.W >= 25, '25. galibiyet', 'Yirmi beş zafer gecesi — şehrin sokakları bu geceleri sayıyor.');
    tas('g100', ist.W >= 100, '100. galibiyet', 'Üç haneli zafer hanesi. İstatistikçiler senin sayfanı ayrı tutuyor.');
    tas('deger15', (G.club.kadroDeger || 0) >= G._tasBaz.deger * 1.5, 'Kadro değeri 1.5 katına çıktı', `Devraldığın kadro ${fmt1(G._tasBaz.deger)}mn'di — bugün ${fmt1(G.club.kadroDeger)}mn. İnşa eden başkan.`);
    tas('deger2x', (G.club.kadroDeger || 0) >= G._tasBaz.deger * 2, 'Kadro değeri İKİYE katlandı', 'Değeri ikiye katlanmış bir kadro — kongre kulisi "bu masa altın yumurtluyor" diyor.');
  }
  ozelTick(G, myRes, { derbi: isDerby }); // ÖZEL HAYAT haftalık nabız + kulüp→özel köprüsü (derbi eve yansır)
  iliskiTick(G); // İLİŞKİ nabzı (2.1/2.2) — eşikli bağlar + kriz olayları (autoplay-nötr, hash-tabanlı)
  // ── SEZON İÇİ GELİŞİM (kullanıcı isteği): gençler OYNADIKÇA ve TAKIM KAZANDIKÇA sezon sonunu
  // beklemeden büyür; kaybeden takımda yaşlı bacaklar aşınır. rand YOK — birikim eşiği (determinist).
  // Tavanlar: genç sezon içi en çok +3, yaşlı en çok −2 (asıl büyük sıçrama yine sezon sonunda).
  // Değişim ▲/▼ okuyla 3 hafta kadroda görünür (okYon/okHafta).
  const xiIds = new Set(G.squad.slice().sort((a, b) => b.overall - a.overall).slice(0, 11).map((p) => p.id));
  let gelisimOldu = false;
  for (const p of G.squad) {
    if (G.meta.week === 1) p._gelSezon = 0;
    if (p.yeniHafta > 0) p.yeniHafta--; // "YENİ" rozeti 3 hafta sonra kalkar
    if (p.okHafta > 0 && --p.okHafta === 0) p.okYon = null;
    const pot = p.potential ?? p.overall;
    // Sezon içi tavan: +3; ELİT antrenman tesisi (sv≥8) tavanı +4'e açar (tesis yatırımı görünür).
    // 22-23 yaş = GEÇ GELİŞİMCİ: yarı hız + tavan +2 (eskiden ≤21 sınırı bu grubu tümden kapatıyordu
    // → kadro 2 sezonda "bitmiş ürün"e dönüyordu; 4 sezon teşhisi S4'te SIFIR artan gösterdi)
    const gec = p.age >= 22;
    const gelCap = gec ? TUNING.DEV_GEC_CAP : ((G.facilities.antrenman || 0) >= TUNING.DEV_CAP_ELITE_ANT ? 4 : 3);
    if (p.age <= TUNING.DEV_GEC_YAS && p.overall < pot && (p._gelSezon ?? 0) < gelCap) {
      let puan = 1;                                                 // gençlik kendi başına filizlenir
      // sahada pişen hızlanır (+2); KULÜBEDEKİ genç de idmanda pişer (+1 — kaybeden sezonda
      // yedek genç tamamen AÇ kalmasın: eskiden haftada 1 puanla sezon boyu ~sabit görünüyordu)
      puan += (xiIds.has(p.id) || G.telkin === 'gencler') ? 2 : 1;
      if (myRes === 'W') puan += 1;                                 // kazanan soyunma odasında özgüven
      if ((p.form ?? 50) >= TUNING.DEV_FORM_ESIK) puan += 1;        // PERFORMANS BAĞI (kullanıcı isteği 2026-07-21): formda parlayan genç ATEŞLENİR — gelişim artık oyuncunun kendi sahadaki haline de bağlı
      // antrenman altyapısı: HER seviye haftalık hızı artırır (kesirli birikir; eski floor(sv/5)
      // yalnız 5 ve 10'da basamak yapıyordu — 5→6→7 yükseltmeleri boşa gidiyordu)
      puan += (G.facilities.antrenman || 0) * TUNING.DEV_ANT_HAFTALIK;
      if (gec) puan *= TUNING.DEV_GEC_CARPAN;                       // geç gelişimci: gençten yavaş
      p._gel = (p._gel || 0) + puan;
      if (p._gel >= TUNING.DEV_GEL_ESIK) {
        p._gel -= TUNING.DEV_GEL_ESIK; p.overall = Math.min(pot, p.overall + 1); p._gelSezon = (p._gelSezon || 0) + 1;
        p.okYon = 'up'; p.okHafta = 3; gelisimOldu = true;
        if (p.refreshValue) p.refreshValue(); else p.marketValue = pMarketValue(p.overall, p.age, pot);
      }
    } else if (p.age >= 34 && p.overall > 52 && myRes === 'L' && (p._gelSezon ?? 0) > -2) {
      p._gel = (p._gel || 0) - 1;
      if (p._gel <= -10) {
        p._gel += 10; p.overall -= 1; p._gelSezon = (p._gelSezon || 0) - 1;
        p.okYon = 'down'; p.okHafta = 3; gelisimOldu = true;
        if (p.refreshValue) p.refreshValue(); else p.marketValue = pMarketValue(p.overall, p.age, pot);
      }
    }
  }
  if (gelisimOldu) { G.club.kadroDeger = squadMarketValue(G.squad); G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G); }
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
  // İLİŞKİ BAĞI (2.2): TD ile aran iyiyse mantıksızı bile dinler (≥80 → ret yok), soğuksa (<40) daha dik kafalı.
  // rand() çağrı sayısı DEĞİŞMEZ — determinizm dizisi kaymaz, yalnız eşik oynar.
  const _tdr = G.tdRelation ?? 70;
  const rejP = _tdr >= 80 ? 0 : TK.REJECT_CHANCE * (_tdr < 40 ? 1.5 : 1);
  if (mantiksiz && G.coach.otorite >= TK.REJECT_OTORITE && rand(0, 1) < rejP) {
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
    // PRİM İZİ: prim verilen maç KAZANILDIYSA soyunma odasında kalıcı karşılık bulur (determinist).
    // Yalnız TAZE primde (alışkanlık serisinin ilk maçı) — spam iz bırakmaz.
    const MPw = TUNING.PRIM.MAC[G.matchPrim];
    if (MPw && MPw.izMoral && (G.primMacSeri || 0) === 1) {
      for (const pl of G.squad) { pl.morale = clamp(pl.morale + MPw.izMoral, 0, 100); pl.form = clamp((pl.form ?? 50) + MPw.izForm, 0, 100); }
      if (MPw.izKimya && G.kimya) G.kimya.kimya = clamp(G.kimya.kimya + MPw.izKimya, 0, 100);
    }
    G.winStreak = (G.winStreak || 0) + 1;
    // 🔥 SERİ REKORU (motivasyon): kariyerin en uzun galibiyet serisi izlenir; 4+ yeni rekor MANŞET olur
    G.rekor = G.rekor || {};
    if (G.winStreak > (G.rekor.seri || 0)) {
      G.rekor.seri = G.winStreak;
      if (G.winStreak >= 4) pushInbox(G, { cat: 'manset', t: `🔥 KARİYER REKORU: ${G.winStreak} maçlık galibiyet serisi`, sig: 'rekor-seri-' + G.winStreak, b: 'Takım durdurulamıyor — şehirde başka konu yok. Bu seri kulüp tarihine not düşüldü; kokpitteki ateş rozetini söndürmemek artık bir gurur meselesi.', noQueue: true });
    }
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
  // MAĞLUBİYET SERİSİ — Takım Moral Gecesi davetinin kapısı (üst üste 2 L'de açılır; G/B sıfırlar)
  G.magSeri = myRes === 'L' ? (G.magSeri || 0) + 1 : 0;
  // DİP FRENİ GERİ BİLDİRİMİ (2026-07-22 "spiral yumuşasın"): mekanik görünür olsun —
  // 3. üst üste yenilgide sezonda 1 kez, determinist (rand yok), sig'li tek mektup.
  if (G.magSeri === 3) pushInbox(G, {
    cat: 'mac', t: 'Soyunma odası dibe vurdu — ama dağılmıyor', noQueue: true, sig: 'dip-freni-' + (G.meta?.season || 1),
    b: 'Üst üste yenilgiler morali törpüledi; ama çekirdek kadro kenetlendi — düşüş bundan sonra yavaşlar (dibe vuran daha fazla düşmez). Tek bir galibiyet havayı çevirir Başkanım.',
  });
  // TD KRİZ BASKISI (kullanıcı isteği 2026-07-21: "sonuçlar kötü gelirse TD'yi kovma durumları"):
  // 4 maçlık kayıp serisinde kurul hocanın dosyasını masaya koyar — KOV / ARKASINDA DUR / PAZARI TARA.
  // Sezonda 1 kez; determinist (rand YOK); karar oyuncunun — pasif ceza değil, OLAY.
  if ((G.magSeri || 0) >= 4 && G.meta.week > 5 && !G.coachSearch
    && G._tdKrizSezon !== G.meta.season && !G.inbox.some((x) => x.action === 'tdkriz' && !x.resolved)) {
    G._tdKrizSezon = G.meta.season;
    pushInbox(G, {
      cat: 'td', t: `KURUL: ${G.coach?.name || 'Hoca'} dosyası masada`, action: 'tdkriz', noQueue: true,
      b: `${G.magSeri} maçlık kayıp serisi — kurul kapalı toplantıda hocanın dosyasını açtı (mevcut GÜÇ ${tdGuc(G.coach)}). "Ya gönder, ya arkasında durduğunu açıkla." Arkasında durur da seri sürerse fatura sana yazar; pazar taraması üçüncü yol.`,
    });
  }
  // "Arkasındayım" sözünün takibi: sonraki 3 maçta 2+ kayıp → inat faturası; seri kırılırsa otorite ödülü
  if (G._tdDestek && myRes) {
    G._tdDestek.mac--; if (myRes === 'L') G._tdDestek.kayip++;
    if (G._tdDestek.kayip >= 2) {
      G.gauges.taraftar = clamp(G.gauges.taraftar - 2, 0, 100);
      for (const bm of G.board || []) bm.loyalty = clamp((bm.loyalty || 50) - 3, 0, 100);
      pushInbox(G, { cat: 'td', t: 'İnat faturası: "hocamın arkasındayım" demiştin', b: 'Destek açıklamasından sonra kayıplar sürdü — kurul koridorunda "başkan inatlaşıyor" fısıltısı, tribünde homurtu (taraftar −2 · kurul sadakati −3).', noQueue: true });
      G._tdDestek = null;
    } else if (G._tdDestek.mac <= 0) {
      G.gauges.itibar = clamp(G.gauges.itibar + 1, 0, 100);
      pushInbox(G, { cat: 'td', t: 'Desteğin doğru çıktı', b: 'Hocanın arkasında durdun, gemi yüzdü — kurul sustu, otorite artık sende (itibar +1).', noQueue: true });
      G._tdDestek = null;
    }
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
  price = Number(price);
  if (!Number.isFinite(price)) return; // ZIRH (uç fuzz): NaN çarpan → bilet geliri → kasa NaN kaskadı
  G.economy.ticketPrice = clamp(price, 0.5, 2.0);
  if (G.term) G.term.maxTicket = Math.max(G.term.maxTicket ?? 0, G.economy.ticketPrice); // P24 izi
}
export function payDebtAmount(G, amount) {
  amount = Number(amount);
  if (!Number.isFinite(amount) || amount <= 0) return; // ZIRH: sayı değilse sessiz ret
  const p = payDebt(G, amount); pushInbox(G, { cat: 'mali', t: 'Borç ödemesi', b: `${fmt1(p)}mn borç kapatıldı.` }); checkBorcsuz(G);
}

// BORÇSUZ MİLESTONE: kulüp borçsuz duruma GEÇTİĞİ AN mali disiplin uçar (maliHedef/maliKarne'de flat bonus),
// ayrıca o an diğer disiplinlere — taraftar, itibar, kurul güveni — bir defalık coşku dalgası yayılır.
// Sezonda 1 kez tetiklenir (kredi-al/öde döngüsüyle istismar edilemesin); RESET_ESIK üstünde yeniden
// borçlanılırsa bayrak sıfırlanır ve gelecek gerçek kapanış yeniden kutlanabilir.
export function checkBorcsuz(G) {
  const borcsuz = G.economy.borc <= 0;
  if (borcsuz && !G._borcsuzActive) {
    G._borcsuzActive = true;
    const sezon = G.meta?.season ?? 0;
    if (G._borcsuzSeason !== sezon) {
      G._borcsuzSeason = sezon;
      const R = TUNING.ECONOMY.BORCSUZ;
      G.gauges.taraftar = clamp(G.gauges.taraftar + R.RIPPLE_TARAFTAR, 0, 100);
      G.gauges.itibar = clamp(G.gauges.itibar + R.RIPPLE_ITIBAR, 0, 100);
      G.gauges.guven = clamp(G.gauges.guven + R.RIPPLE_GUVEN, 0, 100);
      pushInbox(G, { cat: 'mali', t: '🎉 Kulüp borçsuz!', b: 'Son kuruş borç kapandı — kongre ayakta alkışlıyor. Mali tablo tertemiz; taraftar, itibar ve kurul güveni birden yükseldi. "Borçsuz kulüp" artık laf değil, tabela gerçeği.' });
    }
  } else if (!borcsuz && G._borcsuzActive && G.economy.borc > (TUNING.ECONOMY.BORCSUZ.RESET_ESIK ?? 1)) {
    G._borcsuzActive = false; // yeniden borçlanıldı — gelecek kapanış tekrar kutlanabilir
  }
}
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
const SPONSOR_CAP = { gogus: 4, naming: 3, kol: 3 };

function spUret(G, slot, forceType = null) {
  G._spSeq = (G._spSeq || 0) + 1;
  G._spAdlar = G._spAdlar || [];
  const o = generateSponsorOffer({
    clubName: G.club?.name || 'kulup', week: G.meta?.week || 0, seq: G._spSeq,
    weeklyBase: sponsorSlotWeekly(G, slot), usedNames: G._spAdlar, salt: G._spSalt || 0,
  }, slot, forceType);
  G._spAdlar.push(o.name);
  return o;
}
// Pazarı kur (kariyer başı): garanti kompozisyon — güvenli + fintech + EN AZ BİR riskli seçenek
export function initSponsorMarket(G) {
  G.sponsorPazari = { gogus: [], naming: [], kol: [] };
  G._spSeq = 0; G._spAdlar = []; G._spSonGelis = 0;
  // Kariyer-salt: kulüp KİMLİĞİNDEN deterministik (başkan adı/lakap/arma/kuruluş) → her kariyerde
  // FARKLI firma isimleri (aynı kulüp bile), ama aynı kariyer içinde sabit (kayıt/test determinizmi korunur).
  const idStr = `${G.club?.name || ''}|${G.baskan?.name || ''}|${G.club?.lakap || ''}|${G.club?.arma || ''}|${G.club?.founded || ''}`;
  let hs = 0; for (let i = 0; i < idStr.length; i++) hs = (hs * 31 + idStr.charCodeAt(i)) >>> 0;
  G._spSalt = hs;
  const riskli = ((G.club?.name || '').length % 2) ? 'kripto' : 'bahis';
  // Zengin masa: 4 göğüs (2 kurumsal + fintech + riskli), 3 kol (yerel + 2 kurumsal), 3 naming
  G.sponsorPazari.gogus = [spUret(G, 'gogus', 'standart'), spUret(G, 'gogus', 'standart'), spUret(G, 'gogus', 'fintech'), spUret(G, 'gogus', riskli)];
  G.sponsorPazari.kol = [spUret(G, 'kol', 'yerel'), spUret(G, 'kol', 'standart'), spUret(G, 'kol', 'standart')];
  G.sponsorPazari.naming = [spUret(G, 'naming', 'naming'), spUret(G, 'naming', 'naming'), spUret(G, 'naming', 'naming')];
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
  // CANLI PİYASA: haftada EN FAZLA 1 yeni teklif (inbox gürültüsü olmasın) ama pazar diri —
  // %75 gelir, 2 haftadır gelmediyse garanti; BOMBOŞ slot varsa öncelik onda ve kesin gelir.
  const needy = ['gogus', 'naming', 'kol'].filter((s) => !(G.sponsorDeals && G.sponsorDeals[s]) && G.sponsorPazari[s].length < SPONSOR_CAP[s]);
  if (needy.length) {
    const bos = needy.filter((s) => !G.sponsorPazari[s].length);
    const slot = bos.length ? bos[wk % bos.length] : needy[wk % needy.length];
    let h = (Math.imul(wk + 3, 2654435761) + Math.imul((G._spSeq || 0) + 7, 97)) >>> 0;
    h = (Math.imul(h ^ (h >>> 13), 1274126177)) >>> 0;
    const zorunlu = wk - (G._spSonGelis || 0) >= 2;
    if ((h % 100) < 75 || zorunlu || bos.length) {
      const o = spUret(G, slot);
      G.sponsorPazari[slot].push(o);
      G._spSonGelis = wk;
      pushInbox(G, { cat: 'mali', t: `Yeni sponsor teklifi: ${o.name}`, b: `${SPONSOR_SLOT_TR[slot]} için masada yeni dosya — peşinat ${fmt1(o.pesinat)}mn · haftalık ${fmt1(o.weekly)}mn · ${o.years} yıl.${o.dezavantaj ? ' Dezavantaj: ' + o.dezavantaj + '.' : ''} Finans ekranında bekliyor.`, noQueue: true });
    }
  }
  // ── SPONSOR AVI: rakip marka İMZALI sponsorunun FESİH BEDELİNİ ÜSTLENİR (kullanıcı isteği) ──
  // "Fesih bedeliniz Xmn — biz karşılayacağız." Hash-determinist (~%9/hafta/slot), global tek aktif
  // dosya + slot başına bekleme; teklif ancak masadakinden belirgin iyiyse gelir (yıllık ≥ ×1.05).
  const abs = absHafta(G); // MONOTONİK — dönem geçişinde av bekleme süresi şaşmasın
  G._spAvCd = G._spAvCd || {};
  const aktifAv = (G.inbox || []).some((m) => m.action === 'spBuyout' && !m.resolved);
  if (aktifAv) return;
  for (const slot of ['gogus', 'naming', 'kol']) {
    const d = G.sponsorDeals?.[slot];
    if (!d || (G._spAvCd[slot] || 0) > abs) continue;
    let h2 = 0; const s2 = `${G.club?.name || ''}|av|${slot}|${abs}`;
    for (let i = 0; i < s2.length; i++) h2 = (h2 * 31 + s2.charCodeAt(i)) >>> 0;
    if (h2 % 100 >= 9) continue;
    const rakip = spUret(G, slot);
    const dAnnual = Math.round((d.annual ?? d.weekly * 52) * 10) / 10;
    if ((rakip.annual || 0) < dAnnual * 1.05) { G._spAvCd[slot] = abs + 4; continue; } // cazip değil — av düşmedi
    G._spAvCd[slot] = abs + 10;
    const ceza = d.fesihCeza != null ? d.fesihCeza : Math.round((d.pesinat || 0) + (d.annual || 0) * 0.25);
    pushInbox(G, {
      cat: 'mali', t: `SPONSOR AVI: ${rakip.name} formayı istiyor`,
      b: `${SPONSOR_SLOT_TR[slot]} göğsündeki ${d.name} ile fesih bedeliniz ${fmt1(ceza)}mn — "${rakip.name}" bunu TAMAMEN üstleniyor. Masadaki dosya: peşinat ${fmt1(rakip.pesinat)}mn · yıllık ${fmt1(rakip.annual)}mn (mevcut ${fmt1(dAnnual)}mn) · ${rakip.years} yıl.${rakip.dezavantaj ? ' Dezavantaj: ' + rakip.dezavantaj + '.' : ''} Kabul edersen cezayı onlar öder; reddedersen ${d.name} sadakatini unutmaz.`,
      action: 'spBuyout', slot, avTeklif: rakip, avCeza: ceza, noQueue: true,
    });
    break; // haftada tek av dosyası
  }
}

// SPONSOR AVI kararı — kabul: ceza rakip markadan (kasadan kuruş çıkmaz), eski gider yenisi imzalar.
// red: mevcut marka sadakat jesti yapar (tek seferlik) ve o slot bir süre av görmez.
export function resolveSponsorBuyout(G, msgId, choice) {
  const m = (G.inbox || []).find((x) => x.id === msgId && x.action === 'spBuyout');
  if (!m || m.resolved) return { ok: false };
  m.resolved = true;
  const slot = m.slot, d = G.sponsorDeals?.[slot], o = m.avTeklif;
  G._spAvCd = G._spAvCd || {};
  const abs = absHafta(G); // MONOTONİK
  if (!d || !o) { pushInbox(G, { cat: 'mali', t: 'Av dosyası kapandı', b: 'Slot bu arada boşalmış — dosyanın konusu kalmadı.', noQueue: true }); return { ok: true }; }
  if (choice === 'kabul') {
    G.sponsorDeals[slot] = { id: o.id, name: o.name, sector: o.sektor, type: o.type, incomeMult: o.incomeMult, weekly: o.weekly, annual: o.annual, pesinat: o.pesinat, fesihCeza: o.fesihCeza, years: o.years, remainingSeasons: o.years, riskProfile: o.riskProfile || null, ik: o.ik };
    G.economy.kasa += o.pesinat; // ceza rakip markadan — kasaya yalnız YENİ peşinat girer
    G.club.reputation = clamp((G.club.reputation ?? 50) - 1, 0, 100); // "para konuşur" — küçük imaj bedeli
    const rp = o.riskProfile; let ek = '';
    if (rp) {
      if (rp.taraftar) { G.gauges.taraftar = clamp((G.gauges.taraftar ?? 50) + rp.taraftar, 0, 100); ek += ` Taraftar ${rp.taraftar > 0 ? '+' : ''}${rp.taraftar}.`; }
      if (rp.gencTaban) { G.gauges.taraftar = clamp((G.gauges.taraftar ?? 50) + rp.gencTaban, 0, 100); ek += ` Genç taban +${rp.gencTaban}.`; }
      if (rp.itibar) { G.club.reputation = clamp((G.club.reputation ?? 50) + rp.itibar, 0, 100); ek += ` İtibar ${rp.itibar > 0 ? '+' : ''}${rp.itibar}.`; }
    }
    if (G.sponsorPazari) G.sponsorPazari[slot] = [];
    G._spAvCd[slot] = abs + 10;
    pushInbox(G, { cat: 'manset', t: `SPONSOR DARBESİ: ${o.name} bedeli ödedi, forma değişti`, sig: `sp-av-${slot}-${abs}`, b: `${d.name} ile yollar ayrıldı — ${fmt1(m.avCeza)}mn fesih bedelini yeni sponsor üstlendi, kulüp kasasından kuruş çıkmadı. Üstüne ${fmt1(o.pesinat)}mn peşinat geldi; haftalık gelir ${fmt1(d.weekly)}mn → ${fmt1(o.weekly)}mn. Eski marka cephesi buruk: "Futbolda vefa kalmadı." (itibar −1)${ek}`, noQueue: true });
  } else {
    const jest = Math.round(d.weekly * 3 * 10) / 10;
    G.economy.kasa += jest;
    G._spAvCd[slot] = abs + 12; // sadakat duyuldu — o kapı bir süre çalınmaz
    pushInbox(G, { cat: 'mali', t: `Sadakat jesti: ${d.name}`, b: `Av teklifini masada bıraktın; ${d.name} yönetimi bunu duydu ve sözleşmeye tek seferlik ${fmt1(jest)}mn "teşekkür jesti" ekledi. "Bu camiayla yola devam." Piyasada adın: sözünün eri başkan.`, noQueue: true });
  }
  return { ok: true };
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
  G.sponsorDeals[slot] = { id: o.id, name: o.name, sector: o.sektor, type: o.type, incomeMult: o.incomeMult, weekly: o.weekly, annual: o.annual, pesinat: o.pesinat, fesihCeza: o.fesihCeza, years: o.years, remainingSeasons: o.years, riskProfile: o.riskProfile || null, ik: o.ik };
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
  blokNudge(G, 'taban', 1); // 2.6: kürsü sözü aidat üyesinin dilinde — Üye Tabanı ısınır (bilinçli hamle)
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
  price = Number(price);
  if (!Number.isFinite(price)) return; // ZIRH (uç fuzz): geçersiz çarpan dosyayı çözmez
  const m = G.inbox.find((x) => x.id === msgId);
  if (m) m.resolved = true;
  setTicketPrice(G, price);
  // 2.6: dernek talebine verilen bilet kararı Tribün Delegeleri'nin defterine yazar (bilinçli seçim).
  // MUTLAK eşik, önceki fiyata GÖRE DEĞİL — yoksa "önce zamla, sonra 'indir'" manipülasyonu
  // blok ısıtırdı (autoplay Cimri botu bunu yakaladı: 1.25→1.2 cevabı 'indirim' sayılıyordu).
  if (G.economy.ticketPrice <= 1.0) blokNudge(G, 'tribun', 2);
  else if (G.economy.ticketPrice >= 1.2) blokNudge(G, 'tribun', -2);
  pushInbox(G, { cat: 'mali', t: 'Bilet fiyatı güncellendi', b: `Yeni fiyat çarpanı: ${G.economy.ticketPrice.toFixed(1)}×.` });
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
  if (G._shortlist) G._shortlist = G._shortlist.filter((x) => x !== p.id); // ★ kısa liste: alınan isim düşer
  p.id = 'sq' + (G._pid = (G._pid || 1000) + 1);
  p.yeniHafta = 3; // "YENİ" rozeti — 3 maç haftası görünür, sonra kalkar
  G.squad.push(asPlayer(p));
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
  G.termSale = (G.termSale || 0) + offer; // satış geliri bu sezonun transfer kesesine eklenir
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
  const budgetLeft = (G.directive?.budget ?? 0) * boardBudgetMult(G) * (G.mandat?.esnek ?? 1) + (G.termSale || 0) - (G.termSpent || 0); // B1a kurul ±%15 · mandat ±%6 · satışlar keseyi büyütür
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
  // GİZLİ REYTİNG: GM dosyası da GÖRÜNENİ yazar (gözlem hatası dosyaya işler) — imza sonrası saha konuşur
  const gmShown = shownRating(p, G.facilities.scout, G.meta.week).deger;
  return { player: p, fee, gerekce, range: [gmShown - h, gmShown + h], shown: gmShown, sartTried: false };
}

// ── SORGULA: haftalık HAK ile sınırlı (scout Lv → hak); hak bitince ÜCRETLİ (0,2mn).
// Sorgu sisi ±1'e DARALTIR (kesin değil!): gözlemci yakından bakar ama saha başka konuşabilir.
export function sorgulaPlayer(G, id, { ucretli = false } = {}) {
  const p = (G.market || []).find((x) => x.id === id);
  if (!p) return false;
  if (p._sorgu) return true;
  if (!ucretli && (G.sorguHak ?? 1) <= 0) {
    pushInbox(G, { cat: 'transfer', t: 'Sorgu hakkı bitti', b: `Gözlemci ağının haftalık kapasitesi doldu (hak: ${1 + (G.facilities.scout || 0)}/hafta). Ücretli sorgu (0,2mn) hâlâ açık — ya da scout tesisini büyüt.`, noQueue: true });
    return false;
  }
  if (ucretli) {
    if (G.economy.kasa < 0.2) return false;
    G.economy.kasa -= 0.2; // dış büro faturası — hak harcamaz
  } else {
    G.sorguHak = (G.sorguHak ?? 1) - 1;
  }
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
  // GİZLİ REYTİNG: sorgu GERÇEĞİ vermez — sisi ±1'e daraltır (guc = gerçek ±1, deterministik)
  const guc = Math.max(30, Math.min(99, p.overall + (((mh >>> 6) % 3) - 1)));
  p._sorgu = { guc, h: 1, maas: Math.round((p.wage || 0) * 10) / 10, bonservis, tavir, whisper, karakter, sakatlik, ilgi };
  pushInbox(G, { cat: 'transfer', t: `Sorgu raporu: ${p.name}`, b: `Güç ${guc} ±1 · maaş talebi ${fmt1(p.wage || 0)}mn/sezon · bonservis ~${fmt1(bonservis)}mn. Karakter: ${karakter}. Sakatlık geçmişi: ${sakatlik}. Menajer: ${tavir} — ${whisper} İlgilenen kulüp: ${ilgi}.${ucretli ? ' (Ücretli sorgu: −0,2mn)' : ''}`, noQueue: true });
  return true;
}
// DERİN RAPOR (0,8mn): dış istihbarat bürosu — KESİN güç, potansiyel bandı, İSİMLİ rakip ilgisi.
export function derinRapor(G, id) {
  const p = (G.market || []).find((x) => x.id === id);
  if (!p || !p._sorgu || p._derin) return false;
  if (G.economy.kasa < 0.8) { pushInbox(G, { cat: 'transfer', t: 'Derin rapor bekliyor', b: 'Büro 0,8mn istiyor — kasa yetmiyor.', noQueue: true }); return false; }
  G.economy.kasa -= 0.8;
  const rakipler = Object.values(G.league?.table || {}).filter((t) => t && t.name && t.id !== MY);
  const ilgi = p._ilgi || 0;
  const isimler = Array.from({ length: ilgi }, (_, i) => rakipler.length ? rakipler[(mh32(p.name) + i * 7) % rakipler.length].name : 'bir kulüp');
  const potBand = p.age < 24 && (p.potential || p.overall) > p.overall
    ? `${p.overall + 1}-${p.potential}` : 'tavanına yakın';
  p._derin = { kesin: p.overall, pot: potBand, kulupler: isimler };
  p._sorgu.guc = p.overall; p._sorgu.h = 0; // sis tamamen kalkar
  pushInbox(G, { cat: 'transfer', t: `DERİN RAPOR: ${p.name}`, b: `Büro kesin konuştu: gerçek güç ${p.overall}. Gelişim bandı: ${potBand}. İlgilenenler: ${isimler.length ? isimler.join(', ') : 'yok — masada yalnızsın'}. (−0,8mn)`, noQueue: true });
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
  // GİZLİ REYTİNG: dosya SORGUNUN gördüğünü yazar (gerçeği değil) — imzadan sonra saha konuşur
  const sGuc = p._sorgu ? p._sorgu.guc : shownRating(p, G.facilities.scout, G.meta.week).deger;
  const sH = p._sorgu ? (p._sorgu.h ?? 1) : shownRating(p, G.facilities.scout, G.meta.week).h;
  const file = { player: p, fee, gerekce: `Başkanım, sorguladığınız ${p.name} için dosyayı hazırladım.`, range: [sGuc - sH, sGuc + sH], shown: sGuc, sartTried: false, direct: true };
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
    // ÇOK-TURLU PAZARLIK: 2 şart hakkı. 2. turda indirim KÜÇÜLÜR, kaçma riski BÜYÜR —
    // ısrar gerçek bir kumar (karşı-teklif durum makinesi: İNDİ / UZADI / RAKİP KAPTI).
    const tur = (f.round || 0) + 1;
    if (tur > 2) return { ok: false, why: 'Pazarlık masası kapandı' };
    f.round = tur; f.sartTried = true;
    registerDecision(G, 'sart');
    if (G.windowStats) G.windowStats.pazarlik++;
    const shift = (G.gm.skill - 60) / TUNING.APPROVAL.SART.GM_SHIFT; // iyi GM oranları lehine oynatır
    const sosyalB = (G.ozel?.g?.sosyal ?? 50) >= 65 ? 0.06 : 0; // MENAJER BAĞI (2.4): cemiyette adın varsa menajer köprüyü atmaz
    const jetB = (G.ozel?.varlik?.hava || 0) >= 3 ? 0.04 : 0; // VARLIK İMTİYAZI: Özel Jet — masaya erken oturursun (rand SAYISI sabit)
    const inP = tur === 1 ? AP.IN + shift + sosyalB + jetB : (AP.IN + shift + sosyalB + jetB) * 0.55;
    const delayP = tur === 1 ? AP.DELAY : AP.DELAY * 0.6;
    const disc = tur === 1 ? AP.DISCOUNT : 0.9;
    const r = rand(0, 1);
    if (r < inP) {
      f.fee *= disc;
      m.b = `Pazarlık tuttu (tur ${tur})! Yeni bedel ${fmt1(f.fee)}mn. ${tur < 2 ? 'GM: "Bir tur daha üsteleyebiliriz ama menajer sabırsız."' : 'Masa kapandı — ya onay ya red.'} ${f.gerekce}`;
      return { ok: true, outcome: 'indi' };
    } else if (r < inP + delayP) {
      m.resolved = true;
      G.delayedFile = f; // gelecek pencere haftası geri döner
      pushInbox(G, { cat: 'transfer', t: `${G.gm.name} (GM): Tur uzadı`, b: `${f.player.name} pazarlığı (tur ${tur}) bir hafta daha sürecek; masaya karşı teklifle döneriz.` });
      return { ok: true, outcome: 'uzadi' };
    }
    m.resolved = true;
    pushInbox(G, { cat: 'transfer', t: 'Rakip kaptı!', b: `${f.player.name} pazarlık sürerken başka kulüple anlaştı.${tur === 2 ? ' İkinci tur ısrarı pahalıya patladı —' : ''} GM: "Bir dahakine hızlı davranalım."` });
    return { ok: true, outcome: 'kapti' };
  }
  // ONAY: bedel öde (nakit yoksa borç), kadroya kat.
  // Kilit gerekçeleri ARTIK SESSİZ DEĞİL (buton zaten kilitli — bu son savunma hattı, sig'li teksefer)
  if (G.flags && G.flags.transferBan > 0) {
    const sig = 'tfile-ban-' + (G.meta?.season || 1);
    if (!G.inbox.some((x) => x.sig === sig)) pushInbox(G, { cat: 'transfer', t: 'İmza atılamadı: TAHTA KAPALI', sig, b: `FFP cezası işliyor (kalan ${G.flags.transferBan} hafta) — bu pencere onay dosyası imzalanamaz. Dosya masada bekler.`, noQueue: true });
    return { ok: false, why: 'Transfer tahtası kapalı' };
  }
  if (G.economy.kasa < f.fee * TUNING.TRANSFER.DEPOSIT) {
    const sig = 'tfile-pesinat-' + m.id;
    if (!G.inbox.some((x) => x.sig === sig)) pushInbox(G, { cat: 'transfer', t: 'İmza atılamadı: peşinat yetersiz', sig, b: `${f.player.name} için masaya en az ${Math.ceil(f.fee * TUNING.TRANSFER.DEPOSIT)}mn peşinat konmalı — kasa ${fmt1(G.economy.kasa)}mn. Nakit topla, dosya bekler.`, noQueue: true });
    return { ok: false, why: 'Peşinat yetersiz' };
  }
  if (G.economy.kasa >= f.fee) G.economy.kasa -= f.fee;
  else { G.economy.borc += f.fee - G.economy.kasa; G.economy.kasa = 0; }
  G.termSpent = (G.termSpent || 0) + f.fee;
  G.sezonAlim = (G.sezonAlim || 0) + f.fee; // B4d
  // A2+B1d: FFP — harcama kaydı; limit aşımı = KADEMELİ ihlal (taahhüt → ×2 kesinti+tahta → puan silme)
  if (G.ffp) {
    G.ffp.spent += f.fee + f.player.wage;
    if (G.ffp.spent > G.ffp.limit && !G.ffp.taahhut) ffpStrike(G);
  }
  // Piyasa id'leri ('mkt4' gibi) her pencere YENİDEN üretilir — kadrodaki biriyle çakışırsa
  // (sezonlar arası aynı id'yi ikinci kez satın alma) kart/satış/sorgu yanlış oyuncuyu bulur.
  // YALNIZ çakışmada yeni kimlik: normal akışta id sabit kalır (deterministik içerik kaymaz).
  if (G.squad.some((x) => x.id === f.player.id)) f.player.id = 'sq' + (G._pid = (G._pid || 1000) + 1);
  if (G._shortlist) G._shortlist = G._shortlist.filter((x) => x !== f.player.id); // ★ kısa liste düşer
  f.player.yeniHafta = 3; // "YENİ" rozeti (3 maç haftası)
  G.squad.push(asPlayer(f.player));
  if (f.loan) { f.player.loanIn = true; f.player.contractYears = 1; } // A3: kiralık — sezon sonu döner
  G.kimya.kimya = clamp(G.kimya.kimya + TUNING.KIMYA_TRANSFER, 0, 100);
  if (f.player.overall >= TUNING.STAR_THRESHOLD && G.term) G.term.starBought = true;
  G.club.kadroDeger = squadMarketValue(G.squad);
  G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
  m.resolved = true;
  // DOSYA HİJYENİ: aynı oyuncuya açık BAŞKA alım dosyası kaldıysa kapat (çift-dosya karmaşası)
  for (const mm of G.inbox) if (mm !== m && mm.action === 'tfile' && !mm.resolved && mm.file?.player?.id === f.player.id) mm.resolved = true;
  registerDecision(G, 'onay');
  if (G.windowStats) G.windowStats.onay++;
  // GİZLİ REYTİNG: saha gerçeği konuşur — rapor yanıldıysa imza mesajının İÇİNDE açığa çıkar
  // (ayrı push DEĞİL: inbox sayısı/tahliye ritmi değişirse olay zamanlaması kayar — determinizm)
  let sahaGercek = '';
  if (f.shown != null && Math.abs(f.player.overall - f.shown) >= 2) {
    const fark = f.player.overall - f.shown;
    sahaGercek = fark > 0
      ? ` ⚡ İlk idman SÜRPRİZİ: gerçek güç ${f.player.overall} — rapor ${f.shown} demişti (+${fark}), cevheri ucuza yakaladık!`
      : ` 🩹 İlk idman GERÇEĞİ: güç ${f.player.overall} — rapor ${f.shown} demişti (${fark}). Derin Rapor olsaydı görürdün.`;
  }
  pushInbox(G, { cat: 'transfer', t: 'İmza atıldı: ' + f.player.name, b: `${posTr(f.player.pos)} · ${fmt1(f.fee)}mn. GM: "Hayırlı olsun Başkanım." Kimya bir süre sarsılacak.${sahaGercek}` });
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
    sozIhlal(G, p); // "satmam sözü" ihlali — aktif seçim bedeli (manşet + klik güven sarsıntısı)
    G.squad = G.squad.filter((x) => x !== p);
    G.economy.kasa += m.file.offer;
    G.sezonSatis = (G.sezonSatis || 0) + m.file.offer; if (p.ocak) G.ocakSatisGelir = (G.ocakSatisGelir || 0) + m.file.offer; // B4d
    G.termSale = (G.termSale || 0) + m.file.offer; // satış → transfer kesesi büyür
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

// #3 KAYYUM KURTULUŞ PAKETİ — acil satış: 3 oyuncu tek kalemde %70'e, bedelin tamamı borca.
// Acı reçete: tribün ve soyunma odası sarsılır ama kayyum eşiğinden uzaklaşılır. Determinist (rand yok).
export function kayyumPaket(G, msgId, choice) {
  const m = (G.inbox || []).find((x) => x.id === msgId && x.action === 'kayyum');
  if (!m || m.resolved) return { ok: false };
  m.resolved = true;
  if (choice !== 'sat') {
    pushInbox(G, { cat: 'mali', t: 'Kurtuluş paketi reddedildi', b: `${G.gm?.name || 'GM'}: "Karar sizin Başkanım. Ama banka faiz işletmeye devam ediyor — başka bir yol bulmamız gerek."`, noQueue: true });
    return { ok: true, outcome: 'red' };
  }
  const giden = G.squad.filter((p) => (m.paket || []).includes(p.id));
  if (!giden.length) { pushInbox(G, { cat: 'mali', t: 'Paket dağıldı', b: 'Listedeki oyuncular kadroda değil — dosya kapandı.', noQueue: true }); return { ok: true }; }
  const tutar = m.tutar ?? Math.round(giden.reduce((s, p) => s + (p.marketValue || 0), 0) * 0.7);
  for (const p of giden) { sozIhlal(G, p); efsaneSatisKontrol(G, p); } // "satmam sözü" + jübilesiz efsane bedeli işler
  G.squad = G.squad.filter((p) => !giden.includes(p));
  const borcOdeme = Math.min(G.economy.borc, tutar);
  G.economy.borc = Math.round((G.economy.borc - borcOdeme) * 10) / 10;
  if (tutar > borcOdeme) G.economy.kasa += tutar - borcOdeme; // borç kapandıysa artan kasaya
  G.sezonSatis = (G.sezonSatis || 0) + tutar;
  G.gauges.taraftar = clamp(G.gauges.taraftar - 3, 0, 100); // yangından mal kaçırma — tribün buruk
  blokNudge(G, 'tribun', -2); // 2.6: "takım soyuldu" — Tribün Delegeleri sandıkta hatırlar (bilinçli karar)
  for (const q of G.squad) q.morale = clamp(q.morale - 3, 0, 100);
  G.club.kadroDeger = squadMarketValue(G.squad);
  G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
  pushInbox(G, { cat: 'manset', t: 'YANGINDAN MAL KAÇIRMA: 3 oyuncu tek kalemde gitti', sig: 'kayyum-paket-' + (G.meta?.season || 0), b: `${giden.map((p) => p.name).join(', ')} — paket ${tutar}mn'ye satıldı, tamamı borca kapatıldı. Tribün buruk: "Kulüp kurtuldu ama takım soyuldu." Kalan borç: ${Math.round(G.economy.borc)}mn.`, noQueue: true });
  anKarti(G, { t: 'Kurtuluş paketi imzalandı', b: `${tutar}mn borca kapandı — kadro küçüldü, koltuk kurtuldu.`, etki: -4 });
  return { ok: true, outcome: 'sat' };
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
        body: (() => { const s = shownRating(p, G.facilities.scout, G.meta.week); return `Kriz kulübü BUGÜN nakit istiyor — ${fmt1(fee)}mn (piyasa altı). Güç ${s.deger - s.h}-${s.deger + s.h} · ${posTrPhone(p.pos)} · ${p.age} yaş. Hat açık, karar senin.`; })(),
        options: [{ key: 'onay', label: `ONAYLA (${fmt1(fee)}mn)` }, { key: 'red', label: 'REDDET' }, { key: 'beklet', label: '⏳ Beklet (%20 dosya kalır, %80 kaçar)' }],
        file: { player: p, fee, shown: shownRating(p, G.facilities.scout, G.meta.week).deger },
      });
    } else if (r < 0.75) { // DEV panik alıcı → TELEFON (menajer çerçevesi)
      const cands = G.squad.filter((p) => p.overall >= 55);
      if (!cands.length) continue;
      const p = cands[randint(0, cands.length - 1)];
      const offer = saleOffer(p) * (G.marketMult || 1) * rand(D.SELL_PREM[0], D.SELL_PREM[1]);
      // ALICININ ADI VAR (2026-07-22): anonim "dev kulüp" yerine hash'le isim — yarısı ligin
      // zirvesinden, yarısı yurtdışından (rand'sız; determinist)
      const zirve = Object.values(G.league?.table || {}).filter((t) => t && !t.mine && t.name).sort((a, b) => (b.strength || 0) - (a.strength || 0)).slice(0, 3);
      const alici = (mh32('alici|' + p.name) % 2 === 0 && zirve.length)
        ? zirve[mh32('alici2|' + p.name) % zirve.length].name
        : YABANCI_KULUPLER[mh32('alici3|' + p.name) % YABANCI_KULUPLER.length];
      ringPhone(G, {
        kind: 'dlsell', caller: 'menajer', callerName: 'Menajer hattı', deadline: true,
        title: `⏱ DEV panik alıyor: ${p.name}`,
        body: `Şampiyonluk baskısındaki ${alici} ${fmt1(offer)}mn sayıyor — piyasanın ÜSTÜ. Bu akşam kapanır.`,
        options: [{ key: 'sat', label: `SAT (+${fmt1(offer)}mn)` }, { key: 'red', label: 'REDDET' }],
        playerId: p.id, offer, alici,
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
  // Aynı KOLTUK için açık dosya varsa engelle (farklı koltuklar aynı anda açılabilir — enkaz sonrası
  // birden çok boş koltuğu paralel doldurmak meşru). Adaylar artık MESAJDA taşınır → çoklu dosya güvenli.
  if (G.inbox.some((m) => m.action === 'stfile' && !m.resolved && (m.stRole || null) === role)) return { ok: false, why: 'Bu koltuk için aday süreci sürüyor' };
  const cands = generateStaff(role, G.club.reputation, { names: G.data.names, count: randint(2, 3) });
  G.staffCands = { role, cands }; // geriye dönük uyum (okuyucular önce mesajı kullanır)
  pushInbox(G, {
    cat: 'kongre', t: `${G.gm.name} (GM): ${ROLE_TR[role]} aday dosyası`,
    b: cands.map((c, i) => `${i + 1}) ${c.name} — ${describeStaff(c)} (${fmt1(c.wage)}mn/sezon)`).join(' · '),
    action: 'stfile', stRole: role, stCands: cands,
  });
  return { ok: true };
}

export function hireStaffFile(G, msgId, idx) {
  const m = G.inbox.find((x) => x.id === msgId && x.action === 'stfile');
  if (!m || m.resolved) return { ok: false };
  // Adaylar ÖNCE mesajdan (m.stCands) — eski kayıtlarda global G.staffCands'e düşer.
  const cands = (m.stCands && m.stCands.length ? m.stCands : (G.staffCands || {}).cands) || [];
  const role = m.stRole || (G.staffCands || {}).role;
  const c = cands[Number(idx)];
  if (!c || !role) return { ok: false };
  G.staff[role] = c;
  m.resolved = true;
  if ((G.staffCands || {}).role === role) G.staffCands = null;
  pushInbox(G, { cat: 'kongre', t: `İmza: ${c.name} (${ROLE_TR[c.role] || ROLE_TR[role]})`, b: `${describeStaff(c)}. Maaşı gider kalemine işledi.` });
  return { ok: true };
}

// stfile onarımı: adayları mesaj gövdesinden RNG'siz geri kur (isimler korunur). wage = skill×WAGE_K
// olduğundan skill birebir geri gelir; trait de "label" ile eşleşir. Eski çoklu-dosya kayıtlarını kurtarır.
function roleFromStaffTitle(t) {
  const s = String(t || '');
  for (const [r, tr] of Object.entries(ROLE_TR)) if (s.includes(tr)) return r;
  return null;
}
function parseStaffBody(role, body) {
  const S = TUNING.STAFF;
  return String(body || '').split(' · ').map((seg) => {
    const nameM = seg.match(/^\s*\d+\)\s*(.+?)\s+—\s+/);
    const wageM = seg.match(/\(([\d.]+)\s*mn\/sezon\)/);
    if (!nameM || !wageM) return null;
    const wage = parseFloat(wageM[1]);
    // Maaş gövdede fmt1 ile tek ondalığa yuvarlı → skill kaba gelir. Kalite kelimesiyle BANDA kelepçele
    // (staffQualityWord eşiği: <55 vasat · <72 ehli · else yıldız) → gösterilen kaliteyle birebir tutar.
    const qual = (seg.match(/—\s*([^,]+?)\s*,/) || [])[1] || '';
    const band = qual.includes('yıldız') ? [72, 95] : qual.includes('ehli') ? [55, 71] : [35, 54];
    const skill = Math.max(band[0], Math.min(band[1], Math.round(wage / S.WAGE_K)));
    const labelM = seg.match(/—\s*[^,]+,\s*(.+?)\s+—/); // "— kalite, LABEL —"
    const trait = (labelM && STAFF_TRAITS.find((t) => t.label === labelM[1].trim())) || null;
    return { role, name: nameM[1].trim(), skill, wage, trait: trait ? trait.key : 'caliskan' };
  }).filter(Boolean);
}

// Basın Sözcüsü: negatif manşeti söndür (4 haftada 1 hak)
export function dousePress(G, msgId) {
  const m = G.inbox.find((x) => x.id === msgId && x.action === 'douse');
  if (!m || m.resolved || !G.staff?.basin) return { ok: false };
  if ((G.globalWeek - (G.douseWeek || -99)) < TUNING.STAFF.DOUSE_COOLDOWN) return { ok: false, why: 'Hak yok' };
  m.resolved = true; G.douseWeek = G.globalWeek;
  // MEDYA İLİŞKİSİ (2.5): dost kalem varsa (≥70) sözcünün telefonu daha hızlı açılır
  const dostKalem = Object.values(G.pressRel || {}).some((v) => v >= 70);
  G.mediaTone = (G.mediaTone || 0) + 0.7 + (dostKalem ? 0.3 : 0);
  pushInbox(G, { cat: 'medya', t: 'Manşet söndürüldü', b: `${G.staff.basin.name} arka kanalları çalıştırdı; hikâye ikinci sayfaya düştü.${dostKalem ? ' Dost kalem de köşesinde konuyu kapattı.' : ''}` });
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
  // TD PAZARI yolu (kovulmadan imza): mevcut hoca görevdeyse tazminatı imza ANINDA kesilir
  // (fireCoach ile aynı formül — bedava hoca değişimi exploit'i kapalı)
  if (!G.coachSearch && G.coach && (G.coach.contractYears ?? 0) > 0) {
    const tazminat = (G.coach.wage || 0.3) * (G.coach.contractYears ?? 2) * TUNING.COACH_FIRE.TAZMINAT_YIL;
    G.economy.kasa -= tazminat;
    pushInbox(G, { cat: 'td', t: `${G.coach.name} tazminatla gönderildi`, b: `Pazardan imza geldi; eski hocanın sözleşmesi ${fmt1(tazminat)}mn'ye feshedildi.`, noQueue: true });
  }
  hireCoach(G, cand, { midSeason: G.phase === 'SEASON_LOOP' });
  G.coach.contractYears = 2;
  G.coachSearch = false; G.coachFiles = null; m.resolved = true;
  G.tdRelation = 70; G.lastTelkinReplied = null;
  G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
  pushInbox(G, { cat: 'td', t: 'İmza: ' + cand.name, b: `${coachDescribe(cand)}. Uyum süreci sıfırdan başlıyor.` });
  return { ok: true };
}

// TD GÜCÜ — oyuncu güç rozetiyle AYNI dil (kullanıcı isteği 2026-07-21: "TD'nin gücünü
// anlamıyorum, oyuncu gibi görünsün"). Motorla tek kaynak: teknikEkip (W_TEKNIK karışımı).
// Eski "TD'de sayı yok" sis kuralı bilinçli emekli edildi — netlik kazandı.
export function tdGuc(c) { return Math.round(teknikEkip(c || {})); }

// TD PAZARI — kovmadan aday tarat, kıyasla, teklif et (sezonda 1 tarama, 1mn menajer masrafı).
// İmzalarsan mevcut hoca TAZMİNATLA gider (hireCoachFile keser). Görünür-kilit deseni: buton
// kilidi UI'da, sig'li teksefer mektup son savunma. rand kullanır — KULLANICI aksiyonu (autoplay değmez).
export function tdPazar(G) {
  const ret = G.coachSearch ? 'Aday süreci zaten sürüyor — önce onu karara bağla.'
    : (G.inbox || []).some((m) => m.action === 'cfile' && !m.resolved) ? 'Masada açık bir TD dosyası var.'
      : G._tdPazarSezon === (G.meta?.season || 1) ? 'Bu sezonki pazar taraması yapıldı — menajerler aynı listeyi döndürür.'
        : G.economy.kasa < 1 ? 'Kasa 1mn tarama masrafını kaldırmıyor.' : null;
  if (ret) {
    const sig = 'tdpazar-ret-' + (G.meta?.season || 1) + '-' + (G.meta?.week || 1);
    if (!G.inbox.some((x) => x.sig === sig)) pushInbox(G, { cat: 'td', t: 'TD pazarı taranamadı', sig, b: ret, noQueue: true });
    return { ok: false, why: ret };
  }
  G.economy.kasa -= 1;
  G._tdPazarSezon = G.meta?.season || 1;
  const cands = generateCoaches(G.club.reputation, { names: G.data.names, count: 3 }).map((c) => ({ ...c, contractYears: 2 }));
  G.coachFiles = cands;
  const mevcut = tdGuc(G.coach);
  pushInbox(G, {
    cat: 'td', t: `TD PAZARI: 3 aday masada (mevcut hoca GÜÇ ${mevcut})`,
    b: `Menajer ağı tarandı (1mn). Adaylar: ${cands.map((c) => `${c.name} — GÜÇ ${tdGuc(c)} · ${fmt1(c.wage)}mn/sezon`).join(' · ')}. İmzalarsan ${G.coach?.name || 'mevcut hoca'} tazminatla gönderilir; dosyayı kapatırsan kimse kırılmaz.`,
    action: 'cfile',
  });
  return { ok: true };
}

// TD kriz dosyası cevabı: kov / arkasında dur (3 maçlık söz — tutmazsa fatura) / pazarı tara
export function resolveTdKriz(G, msgId, secim) {
  const m = G.inbox.find((x) => x.id === msgId && x.action === 'tdkriz');
  if (!m || m.resolved) return { ok: false };
  m.resolved = true;
  if (secim === 'kov') return fireCoach(G);
  if (secim === 'pazar') { tdPazar(G); return { ok: true }; }
  // arkasında dur: ilişki sıçrar, kurul homurdanır; 3 maçlık söz sayacı kurulur
  G.tdRelation = clamp((G.tdRelation ?? 70) + 8, 0, 100);
  for (const bm of G.board || []) bm.loyalty = clamp((bm.loyalty || 50) - 2, 0, 100);
  G._tdDestek = { mac: 3, kayip: 0 };
  pushInbox(G, { cat: 'td', t: `"${G.coach?.name || 'Hocam'}ın arkasındayım"`, b: 'Kameralar önünde net konuştun — hoca duygulandı (ilişki +8), kurul homurdandı (sadakat −2). Önümüzdeki 3 maç bu sözün sınavı: seri kırılırsa otorite senin, sürerse fatura sana.', noQueue: true });
  return { ok: true };
}

// TD karakter cümlesi (kart altı tek cümle — sayılar artık ayrıca GÜÇ rozetinde)
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
  if (G.santiye) return { ok: false, why: `Şantiye sürüyor: ${G.santiye.tesis} (${G.santiye.kalan} hafta kaldı)` }; // tek şantiye kuralı
  if (!canUpgrade(G, tesis)) return { ok: false };
  const base = effectiveUpgradeCost(G, tesis); // B4a senaryo + K1 olay indirimi (facilities.js tek kaynak)
  const F = G.data.firms || { A: ['Yerel Müteahhit'], B: ['Prestij Yapı'], C: ['Tanıdık Firma'] };
  const T = TUNING.TENDER;
  G.tender = {
    tesis,
    offers: [ // her teklifte SÜRE açık yazılır — ucuz/yavaş/riskli ↔ pahalı/hızlı/bonuslu üçgeni
      { type: 'A', firm: pickFrom(F.A), cost: base * T.A.costMult, hafta: T.A.hafta, desc: `Ucuz ama aceleye gelmez — %25 ihtimalle iş yarı yolda +${T.A.sarkma} hafta sarkar.` },
      { type: 'B', firm: pickFrom(F.B), cost: base * T.B.costMult, hafta: T.B.hafta, desc: 'Pahalı ama garantili ve hızlı; bazen beklenenin üstünde iş çıkarır (+1 kademe şansı).' },
      { type: 'C', firm: pickFrom(F.C), cost: base * T.C.costMult, hafta: T.C.hafta, desc: 'Kurul bağlantılı "tanıdık firma" — makul süre ama şantiye medyaya sızarsa itibar yara alır.' },
    ],
  };
  return { ok: true, tender: true };
}

const TESIS_TR = { stadyum: 'Stadyum', antrenman: 'Antrenman Tesisi', tibbi: 'Tıbbi Merkez', akademi: 'Akademi', scout: 'Gözlemci Ağı', ticari: 'Ticari Ofis', mega: 'Stadyum Kompleksi (MEGA)' };

// TESİS BAKIMI (kullanıcı tasarımı 2026-07-22): STADYUM HARİÇ tesisler 3 sezon boyunca hiç
// dokunulmazsa (dokunmak = kurdele/teslimle yükseltme) sezon sonunda 1 seviye YIPRANIR.
// Görünür sistem: tesis ekranı 2. sezondan itibaren ⚠ sayaç gösterir, düşüş isim isim mektupla
// gelir (sessiz ceza yok — kadro tavanı dersinden). Determinist: rand yok.
export const TESIS_BAKIM = ['antrenman', 'tibbi', 'akademi', 'scout', 'ticari'];
function tesisBakimTouch(G, tesis) {
  if (!TESIS_BAKIM.includes(tesis)) return;
  (G.tesisBakim = G.tesisBakim || {})[tesis] = G.worldSeason ?? 1;
}

// İFLAS EŞİĞİ — tek kaynak (finishWeekTail + Finans UI çizgisi aynı sayıyı okur)
export function iflasEsigi(G) { return Math.max(500, Math.round((G.iflasTaban ?? 60) * 1.25) + 150); }

// ŞANTİYE SİSTEMİ: ihale seçimi işi BAŞLATIR — kademe, süre dolunca gelir (santiyeTick).
// Zarlar SEÇİM ANINDA atılır (oyuncu aksiyonu; tip başına 1 rand — ESKİ yapıyla birebir aynı
// sayıda çekiliş → determinizm dizisi kaymaz). Sonuçlar plana gizli yazılır, vakti gelince patlar.
export function chooseTender(G, idx) {
  const t = G.tender;
  if (!t) return { ok: false };
  const o = t.offers[Number(idx)];
  if (!o) return { ok: false };
  if (G.economy.kasa < o.cost) return { ok: false, why: 'Nakit yetersiz' };
  const T = TUNING.TENDER;
  G.economy.kasa -= o.cost;
  const hafta = o.hafta || T[o.type]?.hafta || 3;
  const plan = { tesis: t.tesis, firm: o.firm, type: o.type, toplam: hafta, kalan: hafta, bonus: false, sarkmaHafta: 0, sizintiHafta: 0 };
  if (o.type === 'A' && rand(0, 1) < T.A.riskP) plan.sarkmaHafta = Math.max(1, Math.ceil(hafta / 2));      // yarı yolda tökezler → +sarkma hafta
  else if (o.type === 'B' && rand(0, 1) < T.B.bonusP) plan.bonus = true;                                    // teslimatta sürpriz +1 kademe
  else if (o.type === 'C' && rand(0, 1) < T.C.leakP) plan.sizintiHafta = Math.max(1, Math.ceil(hafta / 2)); // şantiye ortasında medyaya sızar
  G.santiye = plan;
  pushInbox(G, { cat: 'tesis', t: `Kazma vuruldu: ${TESIS_TR[t.tesis] || t.tesis} (${o.firm})`, b: `−${fmt1(o.cost)}mn peşin ödendi · planlanan süre ${hafta} hafta. Saha panolarla çevrildi — ilerleme Tesisler ekranında.` });
  G.tender = null;
  return { ok: true, hafta };
}

// Haftalık şantiye ilerlemesi — hem hazırlık hem maç haftalarında işler. RNG YOK (determinist):
// sürprizler seçim anında yazıldı, burada yalnız vakti gelince sahnelenir.
export function santiyeTick(G) {
  const s = G.santiye;
  if (!s) return;
  s.kalan -= 1;
  const gecen = s.toplam - s.kalan;
  const T = TUNING.TENDER;
  if (s.sarkmaHafta && gecen >= s.sarkmaHafta) { // yerel firma tökezledi — süre uzar (seçerken %25 yazıyordu)
    s.kalan += T.A.sarkma; s.toplam += T.A.sarkma; s.sarkmaHafta = 0;
    pushInbox(G, { cat: 'tesis', t: `Şantiyede aksama: ${TESIS_TR[s.tesis] || s.tesis}`, b: `${s.firm} malzeme ve hava bahaneleriyle geldi — teslim +${T.A.sarkma} hafta sarktı. Ucuz etin yahnisi.`, noQueue: true });
  }
  if (s.sizintiHafta && gecen >= s.sizintiHafta) { // tanıdık firma dedikodusu inşaat ortasında patlar
    s.sizintiHafta = 0;
    G.gauges.itibar = clamp(G.gauges.itibar + T.C.leakItibar, 0, 100);
    G.rival = G.rival || { attractiveness: 0 };
    G.rival.attractiveness += T.C.leakRival;
    G.mediaTone = (G.mediaTone || 0) - 1;
    pushInbox(G, { cat: 'medya', t: 'İhale medyaya sızdı', b: `Muhalif kalem şantiye fotoğraflarıyla "tanıdık firma" ihalesini manşete taşıdı. İtibar sarsıldı, rakibe koz gitti — iş yine de sürüyor.`, noQueue: true });
  }
  if (s.kalan <= 0 && s.tesis === 'mega') { // #8 MEGA AÇILIŞ — kademe değil: kapasite %20 + itibar sıçraması (KALICI)
    G.megaStad = true;
    G.club.stadiumCapacity = Math.round(G.club.stadiumCapacity * 1.2);
    G.gauges.itibar = clamp(G.gauges.itibar + 5, 0, 100);
    G.gauges.taraftar = clamp(G.gauges.taraftar + 3, 0, 100);
    pushInbox(G, { cat: 'manset', t: '🏟️ ŞEHRİN YENİ SİMGESİ: Stadyum Kompleksi açıldı', sig: 'mega-acilis', b: `${s.toplam} haftalık dev şantiye bitti: müze, mağaza caddesi, loca katı, kapalı çatı. Kapasite ${stadKapasite(G).toLocaleString('tr-TR')} koltuğa çıktı — Avrupa basını "örnek yatırım" yazdı. Bilet geliri kalıcı büyüdü.`, noQueue: true });
    anKarti(G, { t: 'Stadyum Kompleksi açıldı', b: 'Kapasite +%20 · itibar +5 · taraftar +3 — şehrin simgesi.', etki: 8 });
    G.santiye = null;
    return;
  }
  if (s.kalan <= 0) { // KURDELE KESİMİ — kademe şimdi devreye girer
    G.facilities[s.tesis] = Math.min(TUNING.TRANSFER.FAC_MAX, (G.facilities[s.tesis] || 0) + 1);
    tesisBakimTouch(G, s.tesis); // bakım sayacı sıfırlanır
    let ek = '';
    if (s.bonus && G.facilities[s.tesis] < TUNING.TRANSFER.FAC_MAX) { G.facilities[s.tesis] += 1; ek = ' Premium iş: firma beklenenin üstüne çıktı — +1 EKSTRA kademe!'; }
    G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
    pushInbox(G, { cat: 'tesis', t: `🎀 Kurdele kesildi: ${TESIS_TR[s.tesis] || s.tesis} Sv.${G.facilities[s.tesis]}`, b: `${s.firm} anahtarı teslim etti (${s.toplam} haftada). Etki bugünden devrede.${ek}`, noQueue: true });
    G.santiye = null;
  }
}

export function cancelTender(G) { G.tender = null; }

// #8 STADYUM MEGA PROJESİ — geç oyun hedefi: stadyum zirvedeyse (Sv.10) 250mn'lik kompleks.
// 8 haftalık şantiye; kurdelede kapasite ×1.2 (KALICI), itibar +5, taraftar +3. Tek seferlik. RNG YOK.
export const MEGA = { maliyet: 250, hafta: 8, esik: 300 };
export function megaProjeBaslat(G) {
  if (G.megaStad) return { ok: false, why: 'kompleks zaten açık' };
  if (G.santiye) return { ok: false, why: 'şantiye dolu — önce mevcut iş bitsin' };
  if ((G.facilities.stadyum || 0) < TUNING.TRANSFER.FAC_MAX) return { ok: false, why: 'stadyum zirvede değil' };
  if (G.flags && G.flags.budgetLock > 0) return { ok: false, why: 'bütçe kilidi aktif' };
  if (G.economy.kasa < MEGA.maliyet) return { ok: false, why: 'kasa yetersiz' };
  G.economy.kasa -= MEGA.maliyet;
  G.santiye = { tesis: 'mega', firm: 'Konsorsiyum (3 firma)', type: 'MEGA', toplam: MEGA.hafta, kalan: MEGA.hafta, bonus: false, sarkmaHafta: 0, sizintiHafta: 0 };
  pushInbox(G, { cat: 'tesis', t: 'MEGA PROJE: Stadyum Kompleksi temeli atıldı', b: `−${MEGA.maliyet}mn peşin ödendi · ${MEGA.hafta} haftalık dev şantiye başladı: müze, mağaza caddesi, loca katı, kapalı çatı. Kurdelede kapasite %20 büyür — şehir şimdiden konuşuyor.`, noQueue: true });
  return { ok: true };
}

// ── Demeç (V3-F) — haftada 1 ──
// YARININ MANŞETİ: ton × muhabir stili × hafta varyantı → gazete kupürü (deterministik; rng tüketmez)
function mansetUret(G, tone, muhabir) {
  const K = (G.club.name || '').toUpperCase();
  const S = {
    sert: {
      iddiali: [`BAŞKANDAN GÖZDAĞI: "BU KADRO FAZLASINA LAYIK"`, `BAŞKAN ÇITAYI KOYDU: "HEDEFİ HERKES GÖRECEK"`, `${K}'DA MEYDAN OKUMA: "KİMSE RAHAT UYUMASIN"`],
      sakin: [`${K} CEPHESİNDE SOĞUKKANLI MESAJ`, `BAŞKAN FIRTINAYI DİNDİRDİ: "İŞİMİZE BAKIYORUZ"`, `SESSİZ VE DERİNDEN: ${K} PLANINDAN ŞAŞMIYOR`],
      savunmaci: [`BAŞKAN SAVUNMADA: "SÜREÇ İŞLİYOR"`, `${K}'DA HESAP GÜNÜ ERTELENDİ`, `BAŞKAN KALKANI KALDIRDI: "SABIR İSTİYORUZ"`],
      atesli: [`KÜRSÜDE YANGIN! BAŞKAN AĞZINDAKİ BAKLAYI ÇIKARDI`, `BAŞKAN KÜPLERE BİNDİ — SALON BUZ KESTİ`, `SERT ÇIKIŞ: "BU DÜZENİN HESABINI SORACAĞIZ"`],
    },
    babacan: {
      iddiali: [`BAŞKAN İDDİALI: "BU ŞEHİR DAHA İYİSİNİ GÖRECEK"`, `"BU ARMANIN ALTINDA YATANLAR UTANACAK" — BAŞKAN UMUT DAĞITTI`, `ŞEHRİN BAŞKANI KONUŞTU: "GÜZEL GÜNLER YAKIN"`],
      sakin: [`SAĞDUYU KONUŞTU: "SABIR VE İŞ"`, `BAŞKANDAN BABA NASİHATİ: "PANİK YOK"`, `${K}'DA HUZUR İKLİMİ — BAŞKAN GÜVEN TAZELEDİ`],
      savunmaci: [`BAŞKAN: "ELEŞTİRİYİ DİNLERİZ, YOLUMUZA BAKARIZ"`, `"KİMSE BİZDEN ÇOK ÜZÜLEMEZ" — BAŞKAN DERTLİ`, `BAŞKAN MAZERET DEĞİL MÜHLET İSTEDİ`],
      atesli: [`BAŞKAN CELALLENDİ — TRİBÜN BUNU KONUŞUYOR`, `KÜRSÜDE ŞİMŞEKLER: "ARTIK YETER!"`, `BABACAN BAŞKANIN SABRI TAŞTI`],
    },
    magazin: {
      iddiali: [`BOMBA SÖZLER! ${K} BAŞKANI RESTİ ÇEKTİ 💣`, `BÜYÜK KONUŞTU! BU SÖZLER EKRAN KAYDI OLDU 📸`, `BAŞKANDAN KAPAK: "NOT ALIN, GÜLECEĞİZ" 😎`],
      sakin: [`${K} BAŞKANINDAN "SAKİN OLUN" POZU 😌`, `BAŞKAN MODU: ZEN 🧘 SALON ŞAŞKIN`, `TIK YOK! BAŞKAN POLEMİĞE GİRMEDİ 🙅`],
      savunmaci: [`BAŞKAN TOPU TAÇA ATTI 🙈`, `KAÇAK DÖVÜŞ! SORULAR CEVAPSIZ KALDI 🤐`, `BAŞKAN "SÜREÇ" DEDİ, SALON GÜLDÜ 😬`],
      atesli: [`OLAY ÇIKIŞ! PFDK BU SÖZLERE BAKACAK 🔥`, `KÜRSÜ ALEV ALDI! VİRAL OLDU BİLE 🚨`, `BAŞKAN PATLADI! YÖNETMELİK EKİBİ İZLEMEDE 👀`],
    },
  };
  const varyant = (S[muhabir.stil] || S.sert)[tone] || [`${K} BAŞKANI KONUŞTU`];
  return varyant[((G.meta?.season || 1) * 7 + (G.meta?.week || 1)) % varyant.length];
}

export function makeDemec(G, tone) {
  if (G.demecUsed) return { ok: false };
  // Basın toplantısı UI: verilen cevabın GERÇEK +/- etkisini göstermek için delta yakala
  const snap = { taraftar: G.gauges.taraftar, guven: G.gauges.guven, itibar: G.gauges.itibar, medya: (G.mediaTone || 0), kimya: (G.kimya ? G.kimya.kimya : null), hedef: G.club.hedefSira };
  const r = applyDemec(G, tone);
  if (!r.ok && r.ok !== undefined) return r;
  G.demecUsed = true;
  G.lastDemecTone = tone;
  // İDDİANIN GİZLİ MALİYETİ: kurul beklentiyi yükseltir (sezonda 1 kez) — kongre gerilimi beslenir
  if (tone === 'iddiali' && G._demecIddiaSezon !== G.meta.season) {
    G._demecIddiaSezon = G.meta.season;
    G.club.hedefSira = Math.max(1, G.club.hedefSira - 1);
  }
  G.lastDemecFx = {
    taraftar: G.gauges.taraftar - snap.taraftar,
    guven: G.gauges.guven - snap.guven,
    itibar: G.gauges.itibar - snap.itibar,
    medya: (G.mediaTone || 0) - snap.medya,
    kimya: snap.kimya != null ? (G.kimya.kimya - snap.kimya) : 0,
    hedef: G.club.hedefSira - snap.hedef, // −1 = çıta yükseldi
    ceza: r.pfdk ? r.ceza : 0,
    snap, // "önce → sonra" gösterimi için
  };
  // YARININ MANŞETİ: muhabir rotasyonuna göre kupür üret → arşive + inbox'a düşer
  const muhabir = MUHABIRLER[(G.meta.week || 1) % MUHABIRLER.length];
  // MEDYA İLİŞKİSİ (2.5): cevap tonu kalemin damarına dokunur — sert kalem cesaret sever,
  // babacan sükûnet, magazinci ateş. İlişki yalnız SEÇİMLE değişir (drift yok — plan §1).
  const PRESS_TON = { sert: { iddiali: 2, atesli: 1, sakin: 0, savunmaci: -2 }, babacan: { sakin: 2, savunmaci: 1, iddiali: 0, atesli: -2 }, magazin: { atesli: 2, iddiali: 1, savunmaci: 0, sakin: -2 } };
  G.pressRel = G.pressRel || {};
  const pr0 = G.pressRel[muhabir.ad] ?? 50;
  G.pressRel[muhabir.ad] = clamp(pr0 + ((PRESS_TON[muhabir.stil] || {})[tone] || 0), 0, 100);
  // Eşik kanalları: dost kalem (≥70) manşeti yumuşatır, küskün kalem (<30) sivriltir
  let kalemNot = '';
  if (G.pressRel[muhabir.ad] >= 70) { G.mediaTone = (G.mediaTone || 0) + 0.2; kalemNot = ' · kalemi sana sıcak'; }
  else if (G.pressRel[muhabir.ad] < 30) { G.mediaTone = (G.mediaTone || 0) - 0.2; kalemNot = ' · kalemi keskin'; }
  const manset = mansetUret(G, tone, muhabir);
  (G.mansetArsiv = G.mansetArsiv || []).unshift({ t: manset, kim: muhabir.ad, kimlik: muhabir.kimlik, sezon: G.meta.season, hafta: G.meta.week, ton: tone });
  if (G.mansetArsiv.length > 24) G.mansetArsiv.pop();
  // Sosyal akış CEVABA TEPKİ verir (deterministik havuz) — asıl ödül tribünün sesi
  const tepki = {
    iddiali: ['İşte başkan böyle konuşur! ❤ 1,2b — KapalıTribün', 'Sözün arkası gelsin de… — SkeptikTaraftar'],
    atesli: ['KÜRSÜ YANDI 🔥 helal olsun — GüneyYakası', 'PFDK dosyayı açmıştır bile 🙄 — LigRadarı'],
    sakin: ['Sakin ama net. Beyefendi başkan. — YıldızlıYıllar34', 'Biraz heyecan da fena olmazdı hocam… — TribünSesi'],
    savunmaci: ['Yine topu taca attı… — MuhalifKöşe', 'Süreç süreç süreç. Bıktık. — SabırsızFanatik'],
  }[tone] || [];
  G.socialFeed = [...tepki.map((t, i) => ({ text: t, mood: i === 0 && (tone === 'iddiali' || tone === 'atesli') ? 'pos' : 'notr', viral: tone === 'atesli' && i === 0 })), ...(G.socialFeed || [])].slice(0, 4);
  // B1c: GİZLİ federasyon hattı — ateşli çıkış yıpratır, sakin diplomasi onarır (asla gösterilmez)
  const F = TUNING.MEGA.FED;
  if (tone === 'atesli') G.fedIliski = clamp((G.fedIliski ?? F.START) + F.ATESLI, 0, 100);
  else if (tone === 'sakin') G.fedIliski = clamp((G.fedIliski ?? F.START) + F.SAKIN, 0, 100);
  pushInbox(G, { cat: 'manset', t: manset, sig: `kupur-${G.meta.season}-${G.meta.week}`, b: `${muhabir.ad} · ${muhabir.kimlik}${kalemNot}${r.pfdk ? ` — PFDK cezası −${fmt1(r.ceza)}mn.` : ''}`, noQueue: true });
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
  // ZORUNLU EMEKLİLİK — determinist kural, rng yok (maraton bulgusu: 47 yaşında oyuncu kalıyordu;
  // jübile yalnız telefon+kulupteYil şartlıydı, transferle gelen yaşlılar kapsam dışıydı):
  // 38+ herkes kramponları asar; 35+ ve gücü ≤50 kalanlar da "artık olmuyor" der.
  const emekliler = G.squad.filter((p) => p.age >= 38 || (p.age >= 35 && p.overall <= 50));
  if (emekliler.length) {
    G.squad = G.squad.filter((p) => !emekliler.includes(p));
    const adlar = emekliler.map((p) => `${p.name} (${p.age})`).join(', ');
    pushInbox(G, { cat: 'karar', t: emekliler.length === 1 ? `${emekliler[0].name} kramponları astı` : `${emekliler.length} isim kramponları astı`, b: `${adlar} — yılların yorgunluğu sözleşme masasına oturmadı; kulüp teşekkür ilanıyla uğurladı.`, noQueue: true });
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
    tesisBakimTouch(G, tesis); // teslim = bakım sayacı sıfırlanır
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
    if (G.squad.some((x) => x.id === p.id)) p.id = 'sq' + (G._pid = (G._pid || 1000) + 1); // dönen oyuncunun id'si kadroyla çakışırsa yeni kimlik (buy akışıyla aynı koruma)
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
  // POTANSİYEL ESNEMESİ (gelişim sürekliliği): tavana vuran ≤23 genç durmaz — "bir sonraki eşiği
  // gördü": sezon sonu pot +2 (kariyerde en çok +4, mutlak 88). DETERMİNİST — rand YOK; developSquad
  // ÖNCESİ çalışır ki açılan tavan bu sezonun sıçramasında da kullanılabilsin.
  {
    const PE = TUNING.POT_ESNEME;
    for (const p of G.squad) {
      const pot = p.potential ?? p.overall;
      if (p.age <= PE.yas && p.overall >= pot && (p._potEsneme || 0) < PE.kariyerCap && pot < PE.tavan) {
        p.potential = Math.min(PE.tavan, pot + PE.artis);
        p._potEsneme = (p._potEsneme || 0) + PE.artis;
      }
    }
  }
  // TESİS YIPRANMASI (kullanıcı kuralı 2026-07-22): stadyum hariç, 3 sezondur dokunulmayan
  // tesis 1 seviye düşer. Sayaç düşüşte sıfırlanır (3 sezon daha ihmal → yine düşer).
  {
    const ws = G.worldSeason ?? 1;
    G.tesisBakim = G.tesisBakim || {};
    const yipranan = [];
    for (const t of TESIS_BAKIM) {
      if ((G.facilities[t] || 0) <= 0) { G.tesisBakim[t] = ws; continue; } // sv0'ın yıpranacağı yok — sayaç boşa işlemesin
      if (ws - (G.tesisBakim[t] ?? ws) >= 3) {
        G.facilities[t] -= 1;
        G.tesisBakim[t] = ws;
        yipranan.push(`${TESIS_TR[t]} Sv.${G.facilities[t] + 1} → ${G.facilities[t]}`);
      }
    }
    if (yipranan.length) pushInbox(G, { cat: 'tesis', t: `⚠ Tesis yıpranması: ${yipranan.length} tesis seviye kaybetti`, b: `${yipranan.join(' · ')} — 3 sezondur çivi çakılmadı; beton da ekip de yaşlanır. Bakımın yolu yeni ihale.`, noQueue: true });
  }
  // Sezon sonu gelişim (Bible-9). Gençlik alımı D4 ile 17. haftaya (Genç Takım Günü sahnesi) taşındı.
  developSquad(G.squad, G.facilities);
  // KADRO TAVANI 30 — SESSİZ KESME BUG'I DÜZELTİLDİ (kullanıcı raporu 2026-07-22: "sözleşmesi
  // süren oyuncularım yeni sezonda yok oldu"): eskiden güç sırasına göre dipten mektupsuz
  // siliniyordu (ocak gençleri ilk kurbandı — "gençleşme" yorumunun tam tersi). Artık:
  // ocak genci (≤23) / kaptan / aile oğlu KORUNUR; yaşlı + zayıf + kısa sözleşmeli önce gider;
  // kim gittiği İSİM İSİM mektupla bildirilir. Determinist — rand yok.
  if (G.squad.length > 30) {
    const korunan = (p) => (p.ocak && p.age <= 23) || p.aileOgul || p.id === G.captainId;
    const skor = (p) => p.overall * 1.5 - p.age * 1.2 + (p.contractYears || 0) * 2; // düşük skor önce gider
    const giden = G.squad.filter((p) => !korunan(p)).sort((a, b) => skor(a) - skor(b)).slice(0, G.squad.length - 30);
    if (giden.length) {
      const gidenSet = new Set(giden);
      G.squad = G.squad.filter((p) => !gidenSet.has(p));
      pushInbox(G, { cat: 'transfer', t: `Sezon sonu kadro düzenlemesi: ${giden.length} isimle yollar ayrıldı`, b: `Kadro 30 kişilik tavana indirildi — ${giden.map((p) => `${p.name} (${p.age})`).join(', ')} serbest bırakıldı. GM: "Yeni sezona yalın kadro, Başkanım."`, noQueue: true });
    }
    // korumalılar tek başına tavanı aşıyorsa (patolojik) kadro invariantı yine de önde
    if (G.squad.length > 30) { G.squad.sort((a, b) => b.overall - a.overall); G.squad.length = 30; }
  }
  G.squad.sort((a, b) => b.overall - a.overall);
  G.club.kadroDeger = squadMarketValue(G.squad);
  G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
  // #1 ŞAMPİYONLUK SAHNESİ — kupa gecesi sinematiği (karneden ÖNCE tam ekran; DEVAM ile geçilir).
  // Yalnız üst lig şampiyonluğu (terfi kendi töreniyle konuşur). Salt görsel katman — denge/RNG'ye dokunmaz.
  if (champion && lig === 1) {
    G.transition = { tip: 'kupa', title: 'ŞAMPİYON', sezon: G.worldSeason, kupaNo: G.career?.titles || 1, sub: `${G.coach?.name || 'Teknik direktör'} kupayı başkana uzattı: "Bu şehrin gecesi, Başkanım."` };
  }
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
  const notes = applyEventEffects(G, opt.effects || {});
  // Sonuç kartı: seçimin özeti + GERÇEKLEŞEN sonuç (kumar tuttu mu, ne oldu). "detaylı bilgi" bunu kapsar.
  const base = (opt.effects && opt.effects.note) || '';
  const gercek = notes.filter(Boolean).join(' · ');
  const body = [...new Set([base, gercek].filter(Boolean))].join(' — ') || 'Kararın etkileri sahaya ve kasaya yansıdı.';
  pushInbox(G, { cat: 'olay', t: `${m.event.title} → ${opt.label}`, b: body });
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
    // ── HER SÖZ OYNANABİLİR (tuzak vaat yok — her koşulun gerçek mekaniği var) ──
    case 'P05': return G.facilities.akademi >= (b.akademi || 0) + 2 && (G.term.academyGraduates || 0) >= 2; // altyapı: tesis+2 & 2 mezun
    case 'P07': return G.facilities.stadyum >= (b.stadyum || 0) + 1 && (G.term.maxTicket ?? 1) <= 1.2;      // taraftar deneyimi: stad+1 & makul bilet
    case 'P09': return teknikEkip(G.coach) >= 75;                                                            // teknik ekip tam kadro (P22 ölçütü)
    case 'P10': return (G.term.socialProjects || 0) >= 3;                                                    // 3 sosyal proje (Kongre ekranından)
    case 'P11': return !!(G.womensTeam && G.womensTeam.active);                                              // kadın takımı (Tesisler'den kurulur)
    case 'P12': return (G.term.academyGraduates || 0) >= 1;                                                  // en az 1 akademi mezunu
    case 'P14': return G.club.fanCount >= (b.fanCount || G.club.fanCount) * 1.15;                            // marka: taraftar tabanı +%15
    case 'P16': return (G.term.weeks || 0) > 0 && (G.term.ticari / G.term.weeks) >= (b.ticariHaft || 0.01) * 1.25; // ticari haftalık ort +%25
    case 'P19': return (G.museum || []).length >= 1 || (G.defter || []).length >= 6;                          // miras: müze kaydı ya da dolu defter
    case 'P20': return ((G.expansion && G.expansion.officeCount) || 0) >= 1;                                  // yurt dışı ofis (Finans'tan açılır)
    default: return false;
  }
}

// ── VAAT MEKANİĞİ AKSİYONLARI: sosyal proje / kadın takımı / yurt dışı ofisi ──
export function sosyalProje(G) {
  const BEDEL = 2;
  // SPAM KORUMASI: dönemde en fazla 3 proje (hedef zaten 3) + haftada 1 (program zaman alır)
  if ((G.term.socialProjects || 0) >= 3) {
    pushInbox(G, { cat: 'kongre', t: 'Sosyal program TAMAM', b: 'Bu dönemki 3 proje yürüyor — mahalle daha fazlasını kaldırmaz, samimiyetsiz görünür. Söz zaten yolunda.', noQueue: true });
    return false;
  }
  const haftaKey = (G.meta?.season || 1) + '|' + (G.meta?.week || 1);
  if (G._sosyalHafta === haftaKey) {
    pushInbox(G, { cat: 'kongre', t: 'Ekip zaten sahada', b: 'Bu hafta bir proje yürüyor — üst üste basınç şov gibi durur. Gelecek hafta devam.', noQueue: true });
    return false;
  }
  if (G.economy.kasa < BEDEL) { pushInbox(G, { cat: 'kongre', t: 'Sosyal proje ertelendi', b: 'Kasa 2mn bile kaldıramıyor — önce nakit.', noQueue: true }); return false; }
  G._sosyalHafta = haftaKey;
  G.economy.kasa -= BEDEL;
  G.term.socialProjects = (G.term.socialProjects || 0) + 1;
  G.gauges.taraftar = clamp(G.gauges.taraftar + 1, 0, 100);
  blokNudge(G, 'taban', 1); // 2.6: mahalleye inen kulüp — Üye Tabanı bloku ısınır
  const N = G.term.socialProjects;
  pushInbox(G, { cat: 'kongre', t: `Sosyal proje #${N}: kulüp mahalleye indi`, b: `${BEDEL}mn ile semt sahaları/okul ziyaretleri programı. Taraftar +1.${N >= 3 ? ' "Kulüp Mahalleye İnecek" sözü YOLUNDA.' : ` (Söz için ${3 - N} proje daha; haftada 1.)`}`, noQueue: true });
  return true;
}
export function kadinTakimiKur(G) {
  const BEDEL = 8;
  if (G.womensTeam && G.womensTeam.active) return false;
  if (G.economy.kasa < BEDEL) { pushInbox(G, { cat: 'kongre', t: 'Kadın takımı bekliyor', b: `Kuruluş ${BEDEL}mn ister — kasa yetmiyor.`, noQueue: true }); return false; }
  G.economy.kasa -= BEDEL;
  G.womensTeam = { active: true, kurulusSezon: G.meta.season };
  G.gauges.taraftar = clamp(G.gauges.taraftar + 3, 0, 100);
  G.club.reputation = clamp((G.club.reputation ?? 50) + 2, 0, 100);
  pushInbox(G, { cat: 'kongre', t: '⚽ KADIN TAKIMI KURULDU', b: `${BEDEL}mn kuruluş bütçesiyle kulübün kadın futbol şubesi açıldı. Taraftar +3, itibar +2; bakım gideri haftalık işler. Camia gurur duyuyor.` });
  anKarti(G, { t: 'Kadın takımı kuruldu', b: 'Kulüp tarihine yeni bir şube yazıldı.', etki: 5 });
  return true;
}
export function yurtdisiOfisAc(G) {
  const BEDEL = 25;
  if (G.expansion && G.expansion.officeCount >= 1) return false;
  if ((G.club.reputation ?? 50) < 60) { pushInbox(G, { cat: 'mali', t: 'Yurt dışı ofisi reddedildi', b: 'İtibar 60 altında — yabancı pazar bu armayı henüz tanımıyor. Önce itibar.', noQueue: true }); return false; }
  if (G.economy.kasa < BEDEL) { pushInbox(G, { cat: 'mali', t: 'Yurt dışı ofisi bekliyor', b: `Açılış ${BEDEL}mn ister — kasa yetmiyor.`, noQueue: true }); return false; }
  G.economy.kasa -= BEDEL;
  G.expansion = { officeCount: 1, sezon: G.meta.season };
  G.club.sponsorMult = (G.club.sponsorMult ?? 1) * 1.06; // yabancı pazar sponsor gelirini kalıcı besler
  pushInbox(G, { cat: 'mali', t: '🌍 YURT DIŞI OFİSİ AÇILDI', b: `${BEDEL}mn ile ilk uluslararası ofis. Sponsor geliri kalıcı +%6 — arma artık sınırın ötesinde konuşuluyor.` });
  anKarti(G, { t: 'Uluslararası genişleme', b: 'Kulübün adı yurt dışında bir kapıya yazıldı.', etki: 6 });
  return true;
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
  G.term = { income: 0, wage: 0, starBought: false, maxTicket: G.economy.ticketPrice, weeks: 0, ticari: 0, academyGraduates: 0, socialProjects: 0 };
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
// OLAY KİŞİSELLEŞTİRME (kullanıcı: "kimin olduğu, ne kadarı belli değil — saçma"): yıldız-satış
// tipli olaylarda (economy.kasaGain string = en değerli oyuncu satılır) gövdeye İSİM + YAŞ + GÜÇ +
// BEDEL yazılır, "Sat" etiketi bedelli olur. Yalnız SUNUM katmanı — çözüm mantığı ve rand akışı aynı;
// şablon objesi klonlanır (G.data.events kirletilmez).
export function olayKisisellestir(G, ev) {
  const satisMi = (o) => typeof o?.effects?.economy?.kasaGain === 'string' && o.effects.economy.kasaGain !== '2..5';
  if (!(ev.options || []).some(satisMi)) return ev;
  const star = (G.squad || []).slice().sort((a, b) => (b.marketValue || 0) - (a.marketValue || 0))[0];
  if (!star) return ev;
  const bedel = fmt1(star.marketValue);
  // Teklifin sahibi de İSİMLİ (2026-07-22): yıldıza gelen dev teklif hep yurtdışından — hash'le seç
  const alici = YABANCI_KULUPLER[mh32('devTeklif|' + star.name) % YABANCI_KULUPLER.length];
  return {
    ...ev,
    body: `${ev.body || ''} Masadaki isim: ${star.name} (${posTrPhone(star.pos)}, ${star.age} yaş, güç ${star.overall}) — ${alici} ${bedel}mn teklif ediyor.`,
    options: (ev.options || []).map((o) => satisMi(o) ? { ...o, label: `${o.label} — ${star.name}, ${bedel}mn kasaya` } : o),
  };
}

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
  if (ph.kind === 'aile') { ozelFx(G, opt.fx || {}); return; } // aile araması: etkiler ozel iç dünyaya (2.8)
  switch (ph.kind + ':' + opt.key) {
    case 'dlbuy:onay': case 'kriz:onay': {
      const f = ph.file;
      if (G.economy.kasa >= f.fee) G.economy.kasa -= f.fee; else { G.economy.borc += f.fee - G.economy.kasa; G.economy.kasa = 0; }
      G.termSpent = (G.termSpent || 0) + f.fee;
      G.sezonAlim = (G.sezonAlim || 0) + f.fee; // B4d
      if (G.ffp) { G.ffp.spent += f.fee + f.player.wage; if (G.ffp.spent > G.ffp.limit && !G.ffp.taahhut) ffpStrike(G); } // B1d
      if (G.squad.some((x) => x.id === f.player.id)) f.player.id = 'sq' + (G._pid = (G._pid || 1000) + 1); // id çakışması → yeni kimlik (bkz. resolveTransferFile)
      if (G._shortlist) G._shortlist = G._shortlist.filter((x) => x !== f.player.id); // ★ kısa liste düşer
      f.player.yeniHafta = 3; // "YENİ" rozeti (3 maç haftası)
      G.squad.push(asPlayer(f.player));
      if (f.loan) { f.player.loanIn = true; f.player.contractYears = 1; }
      G.kimya.kimya = clamp(G.kimya.kimya + TUNING.KIMYA_TRANSFER, 0, 100);
      if (f.player.overall >= TUNING.STAR_THRESHOLD && G.term) G.term.starBought = true;
      G.club.kadroDeger = squadMarketValue(G.squad);
      G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
      if (G.windowStats) G.windowStats.onay++;
      { let gy = '';
        if (f.shown != null && Math.abs(f.player.overall - f.shown) >= 2) {
          const fark = f.player.overall - f.shown;
          gy = fark > 0 ? ` ⚡ Sürpriz: gerçek güç ${f.player.overall} (telefonda ${f.shown}, +${fark}).` : ` 🩹 Acelenin faturası: gerçek güç ${f.player.overall} (telefonda ${f.shown}, ${fark}).`;
        }
        pushInbox(G, { cat: 'transfer', t: 'Gece yarısı imza: ' + f.player.name, b: `Telefon kapanmadan el sıkışıldı — ${fmt1(f.fee)}mn.${gy}` }); }
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
        sozIhlal(G, p); // "satmam sözü" — panik satışta da bedel öder
        G.squad = G.squad.filter((x) => x !== p);
        G.economy.kasa += ph.offer;
        G.sezonSatis = (G.sezonSatis || 0) + ph.offer; if (p.ocak) G.ocakSatisGelir = (G.ocakSatisGelir || 0) + ph.offer; // B4d
        G.termSale = (G.termSale || 0) + ph.offer; // satış → transfer kesesi büyür
        if (p.overall >= TUNING.STAR_THRESHOLD) { G.gauges.taraftar = clamp(G.gauges.taraftar - 4, 0, 100); for (const q of G.squad) q.morale = clamp(q.morale - 2, 0, 100); }
        G.club.kadroDeger = squadMarketValue(G.squad);
        G.temelGuc = temelGuc(powerCtx(G)); refreshPower(G);
        pushInbox(G, { cat: 'transfer', t: 'Panik alıcıya satış: ' + p.name, b: `+${fmt1(ph.offer)}mn — ${ph.alici || 'dev kulüp'} gece yarısı ödedi.` });
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
    ringPhone(G, { kind: 'kriz', caller: 'gm', callerName: `${G.gm.name} (GM)`, title: 'GECE YARISI FIRSATI', body: (() => { const s = shownRating(p, G.facilities.scout, G.meta.week); return `Kriz kulübü nakit sıkışmış — ${p.name} (${posTrPhone(p.pos)}, ${p.age} yaş, güç ${s.deger - s.h}-${s.deger + s.h}) piyasa altına verilir: ${fmt1(fee)}mn. Sabaha kadar geçerli.`; })(), options: [{ key: 'onay', label: `ONAYLA (${fmt1(fee)}mn)` }, { key: 'red', label: 'REDDET' }, { key: 'beklet', label: '⏳ Beklet (%20 dosya kalır, %80 kaçar)' }], file: { player: p, fee, shown: shownRating(p, G.facilities.scout, G.meta.week).deger } });
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
export function deskAction(G, karar = 'katil') {
  if (!G.deskCard || G.deskUsedThisTick) return { ok: false };
  const D = TUNING.YASAYAN.DESK;
  const key = G.deskCard;
  G.deskUsedThisTick = true;
  G.lastDesk = key;
  // VETO / GEÇ — masaya oturmadın: etki uygulanmaz, küçük fırsat kaçar (kasa/gündem korunur)
  if (karar === 'gec' || karar === 'veto') {
    registerDecision(G, 'desk:gec');
    pushInbox(G, { cat: 'kongre', t: 'Masaya oturmadın', b: `${DESK_CARDS[key].label} — bu haftalık geçildi. Küçük dokunuş kaçtı ama ne kasa ne gündem yıprandı; sıradaki fırsata bakarsın.`, noQueue: true });
    return { ok: true, gec: true };
  }
  G.deskCounts = G.deskCounts || {};
  G.deskCounts[key] = (G.deskCounts[key] || 0) + 1;
  registerDecision(G, 'desk:' + key);
  if (key === 'antrenman') { for (const p of G.squad) p.morale = clamp(p.morale + D.moralePlus, 0, 100); }
  else if (key === 'dernek') { G.gauges.taraftar = clamp(G.gauges.taraftar + D.taraftarPlus, 0, 100); }
  else if (key === 'sponsor') { G.club.reputation = clamp(G.club.reputation + D.sponsorRep, 0, 100); }
  else if (key === 'genc') { G.fogNarrow = clamp((G.fogNarrow || 0) + D.fogNarrow, 0, 3); } // scout sisi kalıcı MİKRO daralır (piyasa ±aralığı, tavan 3)
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
  if (o.pres.type === 'MUHASEBECI') {
    // Bilançoyu düzeltmek için kadronun OMURGASI (en değerli 2) satıldı → ilk 11 çöker
    const satilan = G.squad.slice().sort((a, b) => b.marketValue - a.marketValue).slice(0, 2);
    G.squad = G.squad.filter((p) => !satilan.includes(p));
    enkaz.push(`Kadronun iki direği satılmış: ${satilan.map((p) => p.name).join(', ')}`);
  } else if (o.pres.type === 'AVCI') {
    // Kâr avcısı: en değerli GENÇ yetenekler flip edildi (omurga değil, GELECEK satıldı) —
    // ilk 11'e etkisi daha az ama altyapı boşalır. Genç yoksa en değerliye düşer (güvence).
    const genc = G.squad.filter((p) => p.age <= 23).sort((a, b) => b.marketValue - a.marketValue);
    const satilan = (genc.length >= 1 ? genc : G.squad.slice().sort((a, b) => b.marketValue - a.marketValue)).slice(0, 2);
    G.squad = G.squad.filter((p) => !satilan.includes(p));
    enkaz.push(`En parlak genç${satilan.length > 1 ? 'ler' : ''} elden çıkarılmış: ${satilan.map((p) => p.name).join(', ')} — komisyon cebe, gelecek gitti`);
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
  // DÖNÜŞ MANDASI: kongre seni bir OYLA geri çağırdı — kurul güveni & taraftar TAZE MANDAYA oturur,
  // 3 sezon önce kaybettiğin andaki düşük değerde KALMAZ. Enkazın (borç/kadro) zorluğu ekonomiden gelir,
  // kurul güveninden değil. Güç, dönüş oy oranıyla ölçeklenir (güçlü çağrı → güçlü başlangıç).
  const M = TUNING.MIRAS.COMEBACK.MANDATE;
  const oy = clamp(G.election?.oyOrani ?? 0.5, 0, 1);
  const manda = Math.max(0, (oy - 0.5) * 100); // 0.5→0, 0.65→15, 0.8→30
  G.gauges.guven = clamp(Math.round(M.GUVEN_BASE + manda * M.GUVEN_MANDA_K), M.GUVEN_FLOOR, 100);
  G.gauges.taraftar = clamp(Math.max(Math.round(G.gauges.taraftar), M.TARAFTAR_BASE + Math.round(manda * 0.2)), 0, 100);
  G.gauges.itibar = clamp(Math.max(Math.round(G.gauges.itibar), M.ITIBAR_MIN), 0, 100);
  G.comebackWon = true; // B4d başarım
  G.opposition = null;
  anKarti(G, { t: 'Koltuğa dönüş', b: `${o.pres.name} yenildi; kongre eski başkanını geri çağırdı — kurul güveni tazelendi (%${Math.round(G.gauges.guven)}).`, etki: 10 });
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
  'Sarıkaya Belediye', 'Kuşluca SK', 'Yoncalı FK', 'Dereboyu Gençlik', 'Kestanelik SK',
  'Çakıltepe Belediye', 'Yamaçköy FK', 'Söğütyolu SK', 'Ilgınlı Belediyespor', 'Kızılçam Gençlik',
];
// YABANCI KULÜP HAVUZU (2026-07-22): anlatı katmanı — yabancı oyuncu yurtdışına imzalar,
// "dev kulüp" alıcılar isimlenir. Tümü KURGUSAL (gerçek kulüp adı/benzerliği yok — Steam kuralı).
const YABANCI_KULUPLER = [
  'Estrela do Vale', 'Maré Azul FC', 'Atlético Ribeira', 'Porto das Dunas', 'Cruz do Sertão', 'Ipanema Norte',
  'Valmora SC', 'Nordhaven FC', 'Weißbach 04', 'Rosendal IF', 'Montclair FC', 'Fiorvento Calcio',
  'Beranovice FK', 'Girondelle SC', 'Kolsberg BK', 'Loch Craigen FC', 'Eastmoor City', 'Sierra Blanca CF',
  'Al-Sarab FC', 'Marjan SC', 'Wahat Club', 'El-Minar SC', 'Kasbah United', 'Zaytun FC',
];
// Yabancı isimli oyuncuya hash'le yurtdışı kulübü seç (rand'sız); Türk isimliye null döner
function yabanciKulup(G, isim) {
  const f = G.data?.names?.foreign;
  if (!f || !isim) return null;
  const yabanci = Object.values(f).some((pool) => pool.includes(isim));
  return yabanci ? YABANCI_KULUPLER[mh32('yk|' + isim) % YABANCI_KULUPLER.length] : null;
}
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
  // Lig-duyarlı isim havuzu: üst lig teams.json (40 kulüp), 2. lig kendi taşra kulüpleri.
  // ROTASYON (2026-07-22 "takım isimleri artsın"): her kariyer havuzdan FARKLI 17'liyi görür —
  // kaydırma kulüp adının hash'i (rand'sız → determinist, aynı kariyerde her sezon aynı lig).
  // Kendi kulüp adıyla çakışan isim elenir (oyuncu "Kartalspor" yazarsa ligde ikizi olmasın).
  const havuz = (lig === 2 ? LIG2_TEAM_NAMES : (G.data.teams || []).map((t) => t.name)).filter((n) => n !== G.club.name);
  // Anahtar KARİYERE özgü olmalı ama merdiven kurulurken elde olmalı: kulüp adı setup'ta SONRA
  // yazılır → ilk oyuncunun adı (seed'e göre değişir) + kulüp adı karışımı. rand'sız.
  const rot = havuz.length ? mh32('lig|' + (G.squad?.[0]?.name || '') + '|' + (G.club.name || '')) % havuz.length : 0;
  const names = [...havuz.slice(rot), ...havuz.slice(0, rot)];
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
  G.club.stadiumCapacity = Math.round(G.club.stadiumCapacity + ((G.megaStad ? Math.round(T.stad * 1.2) : T.stad) - G.club.stadiumCapacity) * B); // #8: mega korunur
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
  // KONGRE 2.6 GÖÇÜ (her yüklemede): eski kayıtlarda delege/ultras alanları yok — nötr kur
  // (nötr 50 sandığı OYNATMAZ; delegeEtki tam 0 döner, eski kayıt dengesi bozulmaz).
  if (!G.delege) G.delege = delegeInit();
  ultrasInit(G);
  // TESİS BAKIM GÖÇÜ (2026-07-22): eski kayıtta sayaç yok — şimdiki sezondan başlat
  // (eski kariyer ANINDA yıpranmaz; kural yüklemeden itibaren 3 sezon sayar).
  if (!G.tesisBakim) { G.tesisBakim = {}; for (const t of TESIS_BAKIM) G.tesisBakim[t] = G.worldSeason ?? 1; }
  // TD ZIRHI (kaos bulgusu 2026-07-22): coach alanı düşmüş/bozuk kayıt ilk haftada
  // teknikEkip(c.taktik) okurken çöküyordu — vekil antrenörle aç, oyun kayıpsız sürer.
  if (!G.coach || typeof G.coach !== 'object' || !Number.isFinite(G.coach.taktik)) {
    G.coach = { name: 'Vekil Antrenör', ...TUNING.COACH_FIRE.INTERIM, contractYears: 0 };
    pushInbox(G, { cat: 'kulup', t: 'Teknik ekip dosyası onarıldı', b: 'Kayıtta teknik direktör kaydı eksikti — vekil antrenör göreve çağrıldı. Yeni TD için pazar açık.', noQueue: true, sig: 'coach-onarim' });
  }
  // REHİDRASYON (her yüklemede): JSON, Player metotlarını (refreshValue) düşürür —
  // prototip geri takılmazsa sezon sonu developSquad'da oyun ÇÖKER (Devam Et bug'ı).
  const canlandir = (p) => { if (p && typeof p === 'object' && !(p instanceof Player)) Object.setPrototypeOf(p, Player.prototype); };
  (G.squad || []).forEach(canlandir);
  (G.market || []).forEach(canlandir);
  (G.loanedOut || []).forEach(canlandir);
  for (const m of G.inbox || []) if (m.file && m.file.player) canlandir(m.file.player);
  if (G.delayedFile && G.delayedFile.player) canlandir(G.delayedFile.player);
  // stfile ONARIMI: adaylar eskiden global G.staffCands'te (tek role) tutuluyordu → çoklu açık dosyada
  // butonlar boş kalıp seçim yapılamıyordu. Her dosyanın adaylarını gövdeden geri kur (mesaja bağla).
  for (const m of G.inbox || []) {
    if (m.action !== 'stfile' || m.resolved || (m.stCands && m.stCands.length)) continue;
    const role = m.stRole || roleFromStaffTitle(m.t);
    if (!role) continue;
    const glob = (G.staffCands && G.staffCands.role === role && G.staffCands.cands) || null;
    const cands = (glob && glob.length) ? glob : parseStaffBody(role, m.b);
    if (cands && cands.length) { m.stRole = role; m.stCands = cands; }
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
  // ENKAZ STADI (2026-07-22): kapasite seviye tablosuna geçince Batan Dev gişe zengini olmuştu
  // (%88 kurtuluş, bant 40-72) — enkazın stadı da enkaz: düşük seviye + bakımsız sayaç
  // (yıpranma uyarıları 1. sezondan düşer; kurtuluş yine emek ister).
  if (M.stadyumSv != null) G.facilities.stadyum = M.stadyumSv;
  if (M.tesisBakimEski) { G.tesisBakim = G.tesisBakim || {}; for (const t of TESIS_BAKIM) G.tesisBakim[t] = (G.worldSeason ?? 0) - M.tesisBakimEski; }
  if (M.buyumeMult) G.buyumeMult = M.buyumeMult;              // taban büyüme hızı ×1.5
  if (M.transferBan) { G.flags = G.flags || {}; G.flags.transferBan = TUNING.APPROVAL.WINDOW_SPAN; }
  G.scenario = { id: sc.id, ad: sc.ad, hedef: sc.hedef, done: false };
  G.scenarioBase = { borc: G.economy.borc };
  if (M.devir) { // B5b: "Batan Dev" devir-teslim altyapısını kullanır (M1 rapor formatı)
    G.devirRaporu = { borc: Math.round(G.economy.borc), kasa: Math.round(G.economy.kasa), kadroDeger: Math.round(G.club.kadroDeger), pos: 9, tutulmayan: ['Kupayı Vitrine Koyacağım', 'Kulübün Sırtındaki Yükü İndireceğim'], term: 0 };
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
export function ilanVer(G, opts) {
  const { pos, yasMax, tavan } = opts || {}; // ZIRH (uç fuzz): argümansız çağrı fırlatmasın
  if (!['GK', 'DEF', 'MID', 'FWD'].includes(pos) || !Number.isFinite(Number(yasMax)) || !Number.isFinite(Number(tavan))) return { ok: false, why: 'Geçersiz ilan' };
  // Ret gerekçeleri ARTIK SESSİZ DEĞİL (UI şeritleri de var — bu son savunma hattı, sig'li teksefer)
  const ilanRet = !G.transferWindow ? 'Pencere kapalı — ilan menajerlere ancak pencere açıkken gider.'
    : G.ilan ? `Zaten yayında bir ilanın var (${G.ilan.pos} · ${G.ilan.kalan} cevap hakkı) — biri kapanmadan yenisi verilmez.`
      : (G.flags && G.flags.transferBan > 0) ? `Tahta kapalı — FFP cezası (kalan ${G.flags.transferBan} hafta), ilan verilemez.` : null;
  if (ilanRet) {
    const sig = 'ilan-ret-' + (G.meta?.season || 1) + '-' + (G.meta?.week || 1);
    if (!G.inbox.some((x) => x.sig === sig)) pushInbox(G, { cat: 'transfer', t: 'İlan verilemedi', sig, b: ilanRet, noQueue: true });
    return { ok: false, why: ilanRet };
  }
  G.ilan = { pos, yasMax, tavan, kalan: TUNING.MEGA.ILAN.CEVAP_MAX, wk: G.meta.week };
  registerDecision(G, 'ilan:' + pos);
  // İlan tepki üretir: sosyal sızıntı + o mevkideki oyuncuların morali ("yerime mi?")
  const posTrIlan = { GK: 'kaleci', DEF: 'stoper', MID: 'orta saha', FWD: 'forvet' }[pos] || pos;
  G.socialFeed = [{ text: `Kulis: ${posTrIlan} arıyormuşuz — menajerlere ilan gitmiş 👀`, mood: 'notr', viral: false }, ...(G.socialFeed || [])].slice(0, 4);
  for (const p of G.squad.filter((x) => x.pos === pos)) p.morale = clamp(p.morale + TUNING.MEGA.ILAN.MORAL_CEZA, 0, 100);
  // İLANIN SOMUT SONUCU: piyasa o mevkide GENİŞLER — menajerler ellerindeki isimleri getirir
  if (Array.isArray(G.market)) {
    const gelenler = extendMarketDet(marketRef(G), { names: G.data.names, scout: G.facilities.scout, count: 4, exclude: aktifIsimler(G), salt: 9000 + (G.meta?.week || 0), pos });
    for (const p of gelenler) p._ilan = true; // listede "İLAN" rozetiyle ayrışır — "hangileri benim ilanımdan geldi?" sorusu biter
    G.market.push(...gelenler);
    G.market.sort((a, b) => b.overall - a.overall);
  }
  // NETLİK (kullanıcı bulgusu: "ne yaptığımı anlamıyorum"): kart adım adım NE OLACAĞINI söyler
  pushInbox(G, { cat: 'transfer', t: `İlan verildi: ${posTrIlan} aranıyor`, b: `${G.gm.name} ağları saldı (yaş ≤${yasMax} · tavan ${tavan}mn). ŞİMDİ NE OLACAK: 1) Transfer listesine o mevkide "İLAN" rozetli 4 yeni isim eklendi — istersen hemen sorgula/teklif ver. 2) Kulüpler 1-3 hafta içinde sana ONAY DOSYASI yollar: Inbox'a "İLANA CEVAP" olarak düşer, ONAYLA/ŞARTLI/REDDET senin kararın. 3) Cevap hakkın ${G.ilan.kalan} dosya — pencere kapanırsa ilan düşer.`, noQueue: true });
  return { ok: true };
}

// KURULA BÜTÇE ARTIŞI İSTE — dönem başına 1 hak. Kurulun mali güveni yüksekse tavan +%15
// (karşılığı Mali −6: "hesabını soracağız"); zayıfsa RET + istemek bile bedel (Mali −3).
export function kurulButceArtisi(G) {
  if (!G.transferWindow) { pushInbox(G, { cat: 'kongre', t: 'Kurul toplanmadı', b: 'Pencere kapalıyken bütçe gündemi açılmaz.', noQueue: true }); return false; }
  if (G.mode === 'aile') { pushInbox(G, { cat: 'kongre', t: 'Kurul yok', b: 'Aile Kulübü — bütçeyi soracağın kurul yok; kasa da kese de senin.', noQueue: true }); return false; }
  const donem = G.meta?.term || 1;
  if (G._kurulButceDonem === donem) { pushInbox(G, { cat: 'kongre', t: 'Kurul ikinci kez toplanmaz', b: 'Bu dönem bütçe artışını zaten sordun. "Aynı dönemde iki kere olmaz Başkanım."', noQueue: true }); return false; }
  G._kurulButceDonem = donem;
  if ((G.gauges.mali ?? 50) >= 55) {
    const artis = Math.max(5, Math.round((G.directive?.budget || 0) * 0.15));
    G.directive.budget = (G.directive?.budget || 0) + artis;
    G.gauges.mali = clamp(G.gauges.mali - 6, 0, 100);
    pushInbox(G, { cat: 'kongre', t: `Kurul bütçeyi büyüttü: +${fmt1(artis)}mn`, b: `Mali disiplinin karşılığı: transfer tavanı ${fmt1(G.directive.budget)}mn'a çıktı. Kurul notu: "Hesabını dönem sonunda soracağız." (Mali −6)` });
    return true;
  }
  G.gauges.mali = clamp(G.gauges.mali - 3, 0, 100);
  pushInbox(G, { cat: 'kongre', t: 'Kurul bütçe artışını REDDETTİ', b: 'Mali güven zayıf — "Önce kasayı toparlayın Başkanım." Üstelik istemek bile puan kaybettirdi (Mali −3).' });
  return false;
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
  const posTrC = { GK: 'kaleci', DEF: 'stoper', MID: 'orta saha', FWD: 'forvet' }[il.pos] || il.pos;
  pushInbox(G, {
    cat: 'transfer', t: `İLANA CEVAP: ${p.name} — kararın bekleniyor`,
    b: `SENİN İLANINA (${posTrC} · yaş ≤${il.yasMax} · tavan ${fmt1(il.tavan)}mn) ${satici ? satici.name : 'bir kulüp'} dosya yolladı: ${p.name} (${p.age}), bedel ${fmt1(fee)}mn, görünen güç ${p.overall - h}-${p.overall + h}. Satıcı: ${motivTr}. NE YAPMALISIN: ONAYLA → transfer biter · ŞARTLI → ${G.gm.name} pazarlığa oturur · REDDET → dosya kapanır (kalan cevap: ${Math.max(0, il.kalan)}).`,
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
    p._vitrinHafta = 0; // pity sayacı sıfırdan başlar
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
// Sözleşme yenile — oyuncuyu bağla: dönemde 1 kez, süre uzar, moral+başkana güven yükselir,
// maaş biraz artar (gerçek bedel: gelecekteki maaş yükü). Kiralık gelen yenilenemez.
export function renewContract(G, playerId) {
  const p = G.squad.find((x) => String(x.id) === String(playerId));
  if (!p) return { ok: false };
  if (p.loanIn) { pushInbox(G, { cat: 'transfer', t: 'Olmaz Başkanım', b: `${p.name} kiralık geldi — sözleşmesi asıl kulübünde, yenilenemez.`, noQueue: true }); return { ok: false }; }
  const term = G.meta?.term ?? 1;
  if ((p.contractYears ?? 0) >= 5) { pushInbox(G, { cat: 'transfer', t: 'Sözleşme zaten uzun', b: `${p.name} zaten uzun sözleşmeli — daha fazla uzatmak menajerini bile şaşırtır.`, noQueue: true }); return { ok: false }; }
  if (p._renewTerm === term) { pushInbox(G, { cat: 'transfer', t: 'Bu dönem yenilendi', b: `${p.name} ile bu dönem zaten masaya oturuldu. Bir dönem sonra tekrar konuşulur.`, noQueue: true }); return { ok: false }; }
  // İLİŞKİ BAĞI (2.1): güven <30 → masaya oturmaz (kriz kanalı); ≥70 → zam yarıya iner (fırsat kanalı)
  const bg = p.baskanaGuven ?? 50;
  if (bg < 30) { pushInbox(G, { cat: 'transfer', t: `${p.name} masaya oturmadı`, b: 'Menajeri kapıdan çevirdi: "Başkanla aramız buzlu." Önce ilişkiyi düzelt (kişisel jest), sonra imza konuş.', noQueue: true }); return { ok: false }; }
  p.contractYears = Math.min(5, (p.contractYears ?? 2) + 2);
  p.morale = clamp(p.morale + 4, 0, 100);
  p.baskanaGuven = clamp((p.baskanaGuven ?? 50) + 4, 0, 100);
  const zam = Math.round(p.wage * (bg >= 70 ? 0.04 : 0.08) * 100) / 100; // güven yüksekse indirimli zam (%8→%4)
  p.wage = Math.round((p.wage + zam) * 100) / 100;
  p.refreshValue && p.refreshValue();
  p._renewTerm = term;
  pushInbox(G, { cat: 'transfer', t: `Sözleşme yenilendi: ${p.name}`, b: `${p.name} ${p.contractYears} yıllık yeni sözleşmeye imza attı. Soyunma odasında "başkan bana güveniyor" havası — moral ve bağlılık yükseldi. Maaş ${fmt1(zam)}mn arttı (yıllık ${fmt1(p.wage)}mn).`, noQueue: true });
  return { ok: true, contractYears: p.contractYears };
}
function vitrinTick(G) {
  const V = TUNING.MEGA.VITRIN;
  for (const p of G.squad.filter((x) => x.vitrin)) {
    p.form = clamp(p.form - 1, 0, 100); // küskünlük form riski
    p._vitrinHafta = (p._vitrinHafta || 0) + 1; // pity sayacı — kaçıncı hafta vitrinde
    // NOT: rand() ÖNCE, pity SONRA (|| kısa devre) → zar çağrı sayısı değişmez, akış kaymaz
    if (!G.phone && (rand(0, 1) < V.TEKLIF_P || p._vitrinHafta >= (V.PITY || 4))) {
      p._vitrinHafta = 0;
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
    // İLİŞKİ BAĞI (2.1): veto edilen aday kırılır, senin adayın bağlanır (kişilik çarpanlı)
    const red = G.squad.find((x) => x.id === G.captainCands.c1);
    if (red) red.baskanaGuven = clamp((red.baskanaGuven ?? 50) + relDelta(relx(G, red).kisilik, -6), 0, 100);
    const sec = G.squad.find((x) => x.id === G.captainCands.c2);
    if (sec) sec.baskanaGuven = clamp((sec.baskanaGuven ?? 50) + relDelta(relx(G, sec).kisilik, 6), 0, 100);
    const c = captain(G);
    pushInbox(G, { cat: 'td', t: 'Kaptanlık: başkan vetosu', b: `TD önerisi geri çevrildi; pazubant ${c ? c.name : '—'}'a verildi. ${G.coach.name} not etti — ilişki hafif gerildi.`, noQueue: true });
  } else {
    G.captainId = G.captainCands.c1;
    const onay = G.squad.find((x) => x.id === G.captainCands.c1);
    if (onay) onay.baskanaGuven = clamp((onay.baskanaGuven ?? 50) + relDelta(relx(G, onay).kisilik, 6), 0, 100); // güvenin karşılığı
    const c = captain(G);
    pushInbox(G, { cat: 'td', t: `Kaptan: ${c ? c.name : '—'} (C)`, b: 'TD önerisi onaylandı. Soyunma odasının sesi artık resmî.', noQueue: true });
  }
  registerDecision(G, 'captain:' + choice);
  G.captainCands = null;
  return { ok: true };
}

// ── YENİ SEZON TRANSFER KESESİ (dönem-içi sezon başı) ──
// Kese her sezon sıfırlanır; GM güncel kasaya + başkanın cömertlik çizgisine (budgetKey) göre
// bir tavan önerir ve İLK olarak onu uygular (provizyon). Başkan inbox'tan onaylar/kısar/açar.
// Bayat karta yer yok: yeni öneri gelince önceki çözülmemiş kese kartı sessizce kapanır.
export function proposeSeasonBudget(G) {
  if (!G.directive) return;
  for (const x of G.inbox) if (x.action === 'seasonBudget' && !x.resolved) x.resolved = true; // önceki sezonun kartı bayatladı
  // budgetKey = başkanın cömertlik çizgisi (Makam'da seçilir). Varsa yeni kese güncel kasadan türer;
  // yoksa (programatik direktif) mevcut taban KORUNUR — yalnız harcama sıfırlanmış olur.
  const bk = G.directive.budgetKey;
  const oneri = bk
    ? Math.max(0, Math.round(G.economy.kasa * (TUNING.APPROVAL.BUDGET_PRESET[bk] ?? 0.5)))
    : (G.directive.budget || 0);
  G.directive.budget = oneri; // SIFIRLA: yeni sezon kesesi (provizyon) — başkan onaylayınca netleşir
  pushInbox(G, {
    cat: 'karar', t: `${G.gm?.name || 'GM'}: yeni sezon kesesi`,
    b: `Yeni sezon Başkanım — kese sıfırlandı. Kasada ${fmt1(G.economy.kasa)}mn var; ben ${fmt1(oneri)}mn'lik transfer tavanı öneriyorum. Onaylıyor musunuz, yoksa kısıp mı açayım?`,
    action: 'seasonBudget', oneri,
  });
}
export function resolveSeasonBudget(G, msgId, choice) {
  const m = G.inbox.find((x) => x.id === msgId && x.action === 'seasonBudget');
  if (!m || m.resolved) return { ok: false };
  m.resolved = true;
  const oneri = m.oneri ?? (G.directive?.budget || 0);
  let yeni = oneri, etiket = 'onaylandı';
  if (choice === 'kis') { yeni = Math.max(0, Math.round(oneri * 0.75)); etiket = 'kısıldı'; }
  else if (choice === 'artir') { yeni = Math.round(oneri * 1.25); etiket = 'açıldı'; }
  if (G.directive) G.directive.budget = yeni;
  pushInbox(G, { cat: 'transfer', t: `Sezon kesesi ${etiket}: ${fmt1(yeni)}mn`, b: `Transfer tavanı bu sezon ${fmt1(yeni)}mn. Pencere açılınca dosyalar bu çerçeveden gelir.`, noQueue: true });
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
// AKTİF İSİM EVRENİ (devasa bulgusu 2 · 2026-07-22): klon yalnız kadro+havuzdan değil, DOSYADA
// BEKLEYEN oyuncudan da doğar — tfile/telefon dosyasındaki aday haftalarca bekler, piyasa o arada
// aynı ismi üretir, dosya onaylanınca kadroda klon. Üretim exclude setleri BU evreni okur.
function aktifIsimler(G) {
  const s = new Set([...(G.squad || []).map((p) => p.name), ...(G.market || []).map((p) => p.name)]);
  for (const m of G.inbox || []) if (m.file?.player?.name && !m.resolved) s.add(m.file.player.name);
  for (const ph of [G.phone, G.phoneDeferred, ...(G.phoneQueue || [])]) if (ph?.file?.player?.name) s.add(ph.file.player.name);
  if (G.delayedFile?.player?.name) s.add(G.delayedFile.player.name);
  for (const p of G.loanedOut || []) if (p?.name) s.add(p.name);
  return s;
}
// PİYASA KLONU KIRICI (devasa bulgusu 2026-07-22): hash-üretimli piyasa isimleri usedNames
// kaydına GİRMEZ — kadroya giren üretilmiş isim (GM dosyası, genç takım, panik alım...) piyasadaki
// adaşla çakışırsa soyadı RAND'SIZ kaydırılır (çekiliş sayısı sabit — seed'li akış kaymaz).
function klonKir(G, name) {
  const nm = G.data.names;
  const piyasa = new Set((G.market || []).map((p) => p.name));
  if (!nm || !name || !piyasa.has(name)) return name;
  const parca = name.split(' '), ilk = parca[0];
  const li0 = Math.max(0, nm.last.indexOf(parca.slice(1).join(' ')));
  let li = li0;
  do { li = (li + 1) % nm.last.length; name = `${ilk} ${nm.last[li]}`; }
  while ((piyasa.has(name) || (G.usedNames || {})[name]) && li !== li0);
  (G.usedNames = G.usedNames || (G.usedNames = {}))[name] = 1;
  return name;
}
function gmPickName(G) {
  // v4.3: GM dosyaları + kriz yıldızları da TEKİL isim havuzundan (usedNames'e kaydolur)
  return klonKir(G, uniqueName(G.data.names, G.usedNames || (G.usedNames = {})) || 'Aday Oyuncu');
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

// ═══════════════════════════════════════════════════════════════════════
// ÖZEL HAYAT — başkanın insan tarafı. Az vakit, gerçek etki:
// mesai→sorgu hakkı · ev huzuru→güven · sosyal→kurul sadakati · nakit→bağış ·
// davet→itibar/mali algı. AUTOPLAY-NÖTR: varsayılan program net sıfır sürükler,
// kulüp-yönlü eşikler (ev≥72, sosyal≥68) bilinçli yatırım olmadan aşılmaz.
// ═══════════════════════════════════════════════════════════════════════

export function initOzel(G) {
  if (G.ozel) return;
  const h = ozH32((G.club?.name || 'kulup') + '#' + (G.baskan?.name || 'baskan') + '#aile');
  const first = (G.data?.names?.first) || ['Kaan'];
  const esAd = KADIN_AD[h % KADIN_AD.length];
  let kizAd = KADIN_AD[(h >> 3) % KADIN_AD.length];
  if (kizAd === esAd) kizAd = KADIN_AD[(h + 7) % KADIN_AD.length];
  G.ozel = {
    yas: 48 + (h % 14), evlilikYil: 18 + (h % 15),
    aile: { es: esAd, c1: kizAd, c2: first[(h >> 5) % first.length] },
    c1Yas: 19 + (h % 4), c2Yas: 13 + ((h >> 2) % 4), // HANEDAN: çocuklar sezonlarla büyür
    g: { ev: 65, enerji: 60, stres: 40, sosyal: 50 },
    prog: { aile: 1, dinlen: 1, mesai: 1, sosyal: 1 },   // 4 akşam — her hafta otomatik uygulanır
    iliski: { es: 70, c1: 65, c2: 65, dost: 50, muhabir: 35 },
    nakit: 12 + (h % 5), xp: 0, seviye: 1,
    varlik: { konut: 1, oto: 0, tekne: 0, hava: 0, sanat: 0 },
    bagisToplam: 0, bagisSezon: 0, davetToplam: 0, davetCd: {},
    olay: null, olayCoz: 0, kullanilan: [],
    rozet: { aile: false, comert: false, medya: false, gece: false },
    flags: {}, yatirim: null, aileSeri: 0, stresSeri: 0, akis: [], _sez: G.meta?.season || 1,
    sezon: { ikilem: 0, kacan: 0, davet: 0, bagis: 0 }, // sezon sonu AİLE KARNESİ sayaçları
  };
}
// sezon karne sayacı — eski kayıtta tembel doğar (plan §0.5)
function ozSezon(oz) { if (!oz.sezon) oz.sezon = { ikilem: 0, kacan: 0, davet: 0, bagis: 0 }; return oz.sezon; }

// fx sözlüğü → iç göstergeler / ilişkiler / kulüp gauge'ları / para
function ozelFx(G, fx = {}) {
  const oz = G.ozel, g = oz.g, R = oz.iliski;
  for (const [k, v] of Object.entries(fx)) {
    if (k in g) g[k] = clamp(g[k] + v, 0, 100);
    else if (k in R) R[k] = clamp(R[k] + v, 0, 100);
    else if (k === 'nakit') oz.nakit = Math.max(0, Math.round((oz.nakit + v) * 10) / 10);
    else if (k === 'kasa') G.economy.kasa += v;
    else if (k === 'xp') oz.xp += v;
    else if (['guven', 'taraftar', 'itibar', 'mali', 'sportif'].includes(k)) G.gauges[k] = clamp(G.gauges[k] + v, 0, 100);
  }
  if (oz.flags?.bosandi) g.ev = Math.min(g.ev, 60); // #6: boşanmış evde huzur tavanı — fx anında da uygulanır
}

// Haftalık nabız — finishWeekTail'den (maç haftası başına 1 kez). Hash-tabanlı; core rng'ye dokunmaz.
// ctx: { derbi } — kulüp→özel köprüsü için maç bağlamı (plan §3: her ok çift yönlü).
export function ozelTick(G, myRes, ctx = {}) {
  if (!G.ozel) initOzel(G);
  const oz = G.ozel, g = oz.g, P = oz.prog, R = oz.iliski;
  // ONARIM (plan 2.8): eski/eksik kayıtta aile isimleri hash'le tamamlanır — "undefined · Kızı" biter
  if (!oz.aile || !oz.aile.es || !oz.aile.c1 || !oz.aile.c2) {
    const hh = ozH32((G.club?.name || 'k') + '#aile-onar');
    const first = (G.data?.names?.first) || ['Kaan'];
    oz.aile = oz.aile || {};
    if (!oz.aile.es) oz.aile.es = KADIN_AD[hh % KADIN_AD.length];
    if (!oz.aile.c1) oz.aile.c1 = KADIN_AD[(hh >> 3) % KADIN_AD.length] === oz.aile.es ? KADIN_AD[(hh + 7) % KADIN_AD.length] : KADIN_AD[(hh >> 3) % KADIN_AD.length];
    if (!oz.aile.c2) oz.aile.c2 = first[(hh >> 5) % first.length];
  }
  const abs = absHafta(G); // MONOTONİK — dönem geçişinde sıfırlanmaz (219-hafta cd bug'ı)
  const H = (tag) => ozH32(`${G.club?.name}#oz#${G.meta.season}#${G.meta.week}#${tag}`);
  if (oz._sez !== G.meta.season) {
    oz._sez = G.meta.season; oz.bagisSezon = 0; oz.sezon = { ikilem: 0, kacan: 0, davet: 0, bagis: 0 };
    // ── HANEDAN (2.8): çocuklar sezonla büyür ──
    oz.c1Yas = (oz.c1Yas || 20) + 1; oz.c2Yas = (oz.c2Yas || 14) + 1;
    if (oz.flags.kizKulupte) { for (const m of G.board || []) m.loyalty = clamp((m.loyalty || 50) + 1, 0, 100); blokNudge(G, 'eski', 1); } // halef masada — kurul + Eski Tüfekler ısınır
    // VARLIK İMTİYAZLARI (sezon başı, determinist): malikâne resepsiyonu kurulu ısıtır; şaheser basında yankılanır
    // (not() henüz tanımsız — akışa doğrudan yazılır)
    if ((oz.varlik?.konut || 0) >= 4) { for (const m of G.board || []) m.loyalty = clamp((m.loyalty || 50) + 1, 0, 100); oz.akis.unshift('Malikâne sezon resepsiyonu — kurul ağırlandı.'); }
    if ((oz.varlik?.sanat || 0) >= 3) { G.gauges.itibar = clamp(G.gauges.itibar + 1, 0, 100); oz.akis.unshift('Şaheserin sezon sergisinde — "sanatsever başkan" manşeti.'); }
    oz.akis = oz.akis.slice(0, 3);
    // Oğul akademideyse 18'inde A takıma çıkar — başkan oğlu formayla (hash-determinist üretim, rand YOK)
    if (oz.flags.ogulAkademide && oz.c2Yas >= 18 && !oz.flags.ogulKadroda) {
      oz.flags.ogulKadroda = true;
      const hh = ozH32(`${G.club?.name}#ogul`);
      const soyad = (G.baskan?.name || 'Başkan').split(' ').slice(-1)[0];
      const ov = 52 + (hh % 6), pot = 74 + ((hh >> 3) % 9);
      const ogul = {
        id: 'sq' + (G._pid = (G._pid || 1000) + 1), name: `${oz.aile.c2} ${soyad}`,
        pos: ['MID', 'FWD', 'DEF'][hh % 3], age: oz.c2Yas, overall: ov, potential: pot,
        wage: 0.25, marketValue: pMarketValue(ov, oz.c2Yas, pot),
        morale: 75, form: 55, fitness: 85, injuryWeeks: 0, suspensionWeeks: 0, contractYears: 3,
        baskanaGuven: 85, ocak: true, aileOgul: true, yeniHafta: 3,
      };
      G.squad.push(ogul);
      G.club.kadroDeger = squadMarketValue(G.squad);
      pushInbox(G, { cat: 'manset', t: `BAŞKANIN OĞLU A TAKIMDA: ${ogul.name}`, sig: 'ogul-a-takim', b: `Akademiden yetişen ${oz.aile.c2} (${oz.c2Yas}) profesyonel imzayı attı. Tribün bölündü: "torpil mi, yetenek mi?" Cevap sahada — soyadın yükü ağır.`, noQueue: true });
    }
  }
  const not = (s) => { oz.akis.unshift(s); oz.akis = oz.akis.slice(0, 3); };
  const evli = !oz.flags.bosandi; // #6 BOŞANMA YAYI — ayrılık sonrası eş kanalı kapalı, ev tavanı düşük

  // 0) KULÜP→ÖZEL KÖPRÜSÜ — sonuç eve taşınır ama BANT YASASI: maç kaynaklı ev değişimi
  // [35,68] dışına ASLA taşamaz. Eşikleri (≤28 manşet · ≥72 güven) yalnız PROGRAM ve İKİLEM
  // seçimleri aşabilir → autoplay-nötrlük matematiksel garanti kalır.
  const BANT = { alt: 35, ust: 68 };
  if (myRes === 'L') {
    if (g.ev > BANT.alt) g.ev = Math.max(BANT.alt, g.ev - (ctx.derbi ? 3 : 1));
    if (ctx.derbi && evli) { R.es = clamp(R.es - 1, 0, 100); not(`${oz.aile.es}: "Bu akşam maç konuşmayalım."`); }
  } else if (myRes === 'W') {
    if (g.ev < BANT.ust) g.ev = Math.min(BANT.ust, g.ev + (ctx.derbi ? 2 : 1));
    if (ctx.derbi) not(evli ? `${oz.aile.es}: "Şehir bizim! Akşam kutlama var."` : 'Çocuklar aradı: "Şehir bizim baba!"');
  }
  // Sezon finali: şampiyonluk/küme evde yankılanır (bant içi) + YILLIK AİLE FOTOĞRAFI —
  // çocuklarla bağ ≥70 ise basın sever (itibar +1, yılda 1; bilinçli aile yatırımı ödülü)
  if (G.meta.week === G.SEASON_WEEKS) {
    // Kulüp başarısı iş dünyasına yansır: şampiyon/Avrupa başkanının şirketleri parlar (kişisel gelir bonusu)
    if (G.myPos === 1) { g.ev = Math.min(BANT.ust, g.ev + 8); if (evli) R.es = clamp(R.es + 6, 0, 100); oz.nakit = Math.round((oz.nakit + 8) * 10) / 10; not('Şampiyonluk gecesi — evde bayram; iş çevresi kapını aşındırıyor (+₺8mn).'); }
    else if ((G.myPos || 10) <= 4) { oz.nakit = Math.round((oz.nakit + 4) * 10) / 10; not('Avrupa vitrini işleri açtı (+₺4mn).'); }
    else if ((G.myPos || 10) >= 16) { g.ev = Math.max(BANT.alt, g.ev - 4); not('Zor sezonun faturası eve de uğradı.'); }
    if ((R.c1 + R.c2) / 2 >= 70) {
      G.gauges.itibar = clamp(G.gauges.itibar + 1, 0, 100);
      not('Yıllık aile fotoğrafı basında: "Örnek başkan."');
      pushInbox(G, { cat: 'manset', t: 'Aile fotoğrafı gündem oldu', sig: 'oz-foto-' + G.meta.season, b: 'Başkan sezonu ailesiyle kapattı; kupür köşelere "önce insan" başlığıyla girdi. İtibar hanesine +1.', noQueue: true });
    }
  }

  // 1) PROGRAM + doğal aşınma (varsayılan 1/1/1/1 → net ~0: autoplay-nötr denge)
  // Hava aracı dişi: mesai akşamı yarı yorar (2→1) — "helikopterle vakit senin"
  const vp = varlikPasif(oz);
  const mesaiMaliyet = (oz.varlik.hava || 0) >= 1 ? 1 : 2;
  g.ev = clamp(g.ev + P.aile * 3 - (oz.rozet.aile ? 2 : 3) + vp.ev, 0, 100);
  g.enerji = clamp(g.enerji + P.dinlen * 5 + 2 - 3 - P.mesai * mesaiMaliyet - P.sosyal + vp.enerji, 0, 100);
  g.stres = clamp(g.stres + 4 - P.dinlen * 4 - P.aile + (myRes === 'L' ? 2 : myRes === 'W' ? -2 : 0), 0, 100);
  g.sosyal = clamp(g.sosyal + P.sosyal * 4 - 4 + vp.sosyal, 0, 100);
  if (evli) R.es = clamp(R.es + P.aile * 1.5 - 1.5, 0, 100); // boşanma sonrası eş kanalı donuk kalır
  R.c1 = clamp(R.c1 + P.aile - 1, 0, 100);
  R.c2 = clamp(R.c2 + P.aile - 1, 0, 100);
  R.dost = clamp(R.dost + P.sosyal - 1, 0, 100);
  R.muhabir = clamp(R.muhabir - 0.5, 0, 100);
  if (evli && R.es < 35) g.ev = clamp(g.ev - 2, 0, 100); // evde soğuk rüzgâr
  if (!evli) g.ev = Math.min(g.ev, 60); // KALICI İZ: boşanmış evde huzur tavanı 60 (güven eşiği 72'ye ulaşılamaz)

  // 2) KİŞİSEL GELİR + XP + seviye (iş imparatorluğu unvanla büyür)
  oz.nakit = Math.round((oz.nakit + haftalikGelir(oz)) * 10) / 10;
  oz.xp += 1 + (g.ev >= 60 && g.stres <= 55 && g.enerji >= 45 ? 1 : 0); // dengeli hafta bonusu
  const sv = seviyeOf(oz.xp);
  if (sv > oz.seviye) {
    oz.seviye = sv;
    pushInbox(G, { cat: 'kulup', t: `Başkanlık tecrübesi: ${UNVANLAR[sv - 1]}`, b: 'Cemiyette adın büyüdü — iş çevren genişledi, haftalık kişisel gelirin arttı.', noQueue: true });
  }

  // 3) VADELİ YATIRIM (Rıfat'ın arsası) — sonuç karar anında hash'le yazıldı, vadesinde açılır.
  // Sonuç INBOX'a kart olarak düşer (kullanıcı kuralı: "kazandım mı kaybettim mi göreyim").
  if (oz.yatirim && abs >= oz.yatirim.vade) {
    const kazandi = oz.yatirim.tutar >= 8;
    oz.nakit = Math.round((oz.nakit + oz.yatirim.tutar) * 10) / 10;
    not(kazandi ? `Arsa ikiye katladı: +₺${oz.yatirim.tutar}mn` : `Arsa bekleneni vermedi: +₺${oz.yatirim.tutar}mn döndü`);
    pushInbox(G, kazandi
      ? { cat: 'kulup', t: `💰 ARSA VURDU: +₺${oz.yatirim.tutar}mn`, sig: 'oz-arsa-' + abs, b: `Rıfat haklı çıktı — imar çıktı, körfezdeki arsa ikiye katladı. Yatırdığın 5mn, ${oz.yatirim.tutar}mn olarak kişisel kasana döndü. "Demiştim Başkanım!"`, noQueue: true }
      : { cat: 'kulup', t: `📉 Arsa KAYBETTİRDİ: ₺${oz.yatirim.tutar}mn döndü`, sig: 'oz-arsa-' + abs, b: `İmar başka parselden geçti — körfez kumarı tutmadı. Yatırdığın 5mn'den elinde ${oz.yatirim.tutar}mn kaldı (−${Math.round((5 - oz.yatirim.tutar) * 10) / 10}mn). Rıfat mahcup: "Bu işler malum Başkanım..."`, noQueue: true });
    oz.yatirim = null;
  }

  // 4) EŞİKLİ KULÜP ETKİLERİ — yalnız pozitif; bilinçli program yatırımı ister (autoplay aşamaz)
  if (g.ev >= 72) G.gauges.guven = clamp(G.gauges.guven + 0.4, 0, 100);           // huzurlu başkan → kongre sakin
  if (g.sosyal >= 68) for (const m of G.board || []) m.loyalty = clamp((m.loyalty || 50) + 0.3, 0, 100); // cemiyet → kurul

  // 5a) #6 BOŞANMA YAYI — eş ilişkisi 4 hafta üst üste dipte (<20) kalırsa kriz kapıyı SERT çalar.
  // Negatif-pasif yasak: sessiz erime yok — zorunlu ikilem olarak gündeme oturur ve cevaplanana dek kalır.
  if (evli && R.es < 20) oz.esSeri = (oz.esSeri || 0) + 1; else oz.esSeri = 0;
  if (oz.esSeri >= 4 && evli && !oz.flags.ayrilikTeklif && !oz.olay) {
    oz.flags.ayrilikTeklif = true; oz.esSeri = 0;
    oz.olay = { id: 'ayrilik', hafta: abs };
    pushInbox(G, { cat: 'saglik', t: `${oz.aile.es} valizleri hazırladı`, sig: 'oz-ayrilik-' + abs, b: 'Uzun süredir ihmal edilen evde ipler koptu. Özel Hayat gündeminde SON karar bekliyor: yuva mı, yol ayrımı mı? Bu gündem cevaplanmadan düşmez.', noQueue: true });
  }
  // 5) SAĞLIK + MAGAZİN (atmosfer — gauge cezası yok; olay/manşet üzerinden konuşur)
  if (g.stres >= 80) oz.stresSeri = (oz.stresSeri || 0) + 1; else oz.stresSeri = 0;
  if (oz.stresSeri >= 3 && !oz.olay) {
    oz.olay = { id: 'checkup', hafta: abs }; oz.stresSeri = 0;
    pushInbox(G, { cat: 'saglik', t: 'Dr. Vural aradı', b: 'Uyku 5 saate düştü, tansiyon takipte — Özel Hayat gündeminde randevu bekliyor.', noQueue: true });
  }
  if (g.ev <= 28 && !oz.rozet.medya && H('mgz') % 100 < 35) {
    pushInbox(G, { cat: 'manset', t: 'MAGAZİN: "Başkanın evinde işler karışık"', sig: `oz-mgz-${abs}`, b: 'Kaynak belirsiz kulis: aile cephesi soğuk. Camia dedikoduyu sevmez ama okur.', noQueue: true });
  }

  // 6) ROZETLER — kalıcı unlock
  oz.aileSeri = g.ev >= 70 ? (oz.aileSeri || 0) + 1 : 0;
  const ac = (k) => { if (!oz.rozet[k]) { oz.rozet[k] = true; pushInbox(G, { cat: 'kulup', t: `🏅 Rozet: ${ROZETLER[k].ad}`, b: ROZETLER[k].pasifTxt + '.', noQueue: true }); } };
  if (oz.aileSeri >= 6) ac('aile');
  if (oz.bagisToplam >= 10) ac('comert');
  if (R.muhabir >= 70) ac('medya');
  if (oz.davetToplam >= 6) ac('gece');

  // 7) AİLE TELEFONU (Y2 kesmesi) — ~%8 hafta: ev cebinde çalar. İKİLEMDEN ÖNCE karar verilir
  // ki telefon haftası gündem yığılmasın (telefon da bir gündemdir). Etkiler yalnız iç
  // göstergeler (autoplay-nötr); hash'le seçilir, rand tüketmez.
  const aileTelHafta = !G.phone && H('tel') % 100 < 8;
  if (aileTelHafta && !oz.olay) {
    const havuz = evli ? AILE_TEL : AILE_TEL.filter((x) => x.kim !== 'es'); // boşanınca eş aramaz
    const t = havuz[H('telSec') % havuz.length];
    const ad = t.kim === 'es' ? oz.aile.es : t.kim === 'c1' ? oz.aile.c1 : oz.aile.c2;
    G.phone = {
      kind: 'aile', caller: 'aile', callerName: ad,
      title: t.t || 'Aile arıyor', body: t.text, // phoneModal title+body okur ("undefined" bulgusu)
      options: t.opts.map((o) => ({ key: o.key, label: o.label, whisper: o.whisper, fx: o.fx })),
    };
  }
  // 8) ÖZEL GÜNDEM — cevaplanmayan sessizce düşer (ceza yok), yenisi hash'le gelir (~%45 hafta).
  // İSTİSNA (#6): 'ayrilik' zorunlu ikilemdir — düşmez, cevaplanana dek gündeme çakılı kalır.
  if (oz.olay && oz.olay.hafta < abs) {
    if (oz.olay.id === 'ayrilik') { oz.olay.hafta = abs; not(`${oz.aile.es} hâlâ cevap bekliyor — valizler kapıda.`); }
    else { not('Gündem cevapsız kaldı — fırsat geçti.'); ozSezon(oz).kacan++; oz.olay = null; }
  }
  if (!oz.olay && !aileTelHafta && H('olay') % 100 < 45) { // telefon haftası ikilem beklesin
    const uygun = OLAYLAR.filter((o) => {
      if (o.kosul && !o.kosul(oz, G)) return false;
      if (oz.kullanilan.slice(-5).includes(o.id)) return false;
      if (o.id === 'dugun' && oz.flags.dugunOldu) return false;
      return true;
    });
    if (uygun.length) oz.olay = { id: uygun[H('sec') % uygun.length].id, hafta: abs };
  }
}

// Haftalık program: 4 akşam havuzu — '+' boş akşam varsa, '−' kendi >0 ise
export function ozelProg(G, arg) {
  const oz = G.ozel; if (!oz) return;
  const [k, d] = String(arg).split('|');
  if (!(k in oz.prog)) return;
  const toplam = Object.values(oz.prog).reduce((a, b) => a + b, 0);
  if (d === '+' && toplam < 4) oz.prog[k]++;
  else if (d === '-' && oz.prog[k] > 0) oz.prog[k]--;
}

// İkilem kararı — fx uygula, zincir bayrakları + vadeli yatırım kur
export function ozelKarar(G, idx) {
  const oz = G.ozel; if (!oz || !oz.olay) return { ok: false };
  const o = OLAYLAR.find((x) => x.id === oz.olay.id);
  if (!o) { oz.olay = null; return { ok: false }; }
  const a = o.a[idx] || o.a[0];
  ozelFx(G, a.fx);
  if (a.flag) for (const f of (Array.isArray(a.flag) ? a.flag : [a.flag])) oz.flags[f] = true;
  if (a.kurul) for (const m of G.board || []) m.loyalty = clamp((m.loyalty || 50) + a.kurul, 0, 100); // hanedan: kurul ısınır
  if (a.bk && G.opponents?.[0]) { // RAKİP BAŞKAN kanalı (2.3): atışma küstürür, centilmenlik kapı açar
    G.bkRel = G.bkRel || {};
    const id0 = G.opponents[0].id;
    G.bkRel[id0] = clamp((G.bkRel[id0] ?? 50) + a.bk, 0, 100);
  }
  if (o.id === 'dugun') oz.flags.dugunOldu = true;
  if (o.id === 'ayrilik') { // #6 BOŞANMA YAYI — kriz kapandı: iki yoldan biri, ikisi de tarihe geçer
    delete oz.flags.ayrilikTeklif; oz.esSeri = 0;
    if (oz.flags.bosandi) {
      oz.iliski.es = 15; // ayrı yaşarlar — kanal donuk; program/jest artık işlemez
      pushInbox(G, { cat: 'manset', t: 'BAŞKANIN EVLİLİĞİ BİTTİ', sig: 'oz-bosanma', b: `${oz.aile.es} Hanım ile yollar resmen ayrıldı. Magazin günlerce yazacak; bundan sonra evin direği çocuklarla bağ. Ev huzuru tavanı kalıcı düştü — sandıkta "aile desteği" artık çocuklardan geçer.`, noQueue: true });
    } else {
      pushInbox(G, { cat: 'saglik', t: 'Yuva kurtuldu', sig: 'oz-krizatlatildi', b: `Telafi tatili işe yaradı — ${oz.aile.es} Hanım valizleri geri açtı. Söz verildi: bundan sonra aile önce. Bu sözü program tutturur, laf değil.`, noQueue: true });
    }
  }
  if (a.arsa) { // sonuç ŞİMDİ hash'le yazılır (determinist) — 4 hafta sonra açılır. YAZI TURA: %50 (kullanıcı kuralı)
    const abs = absHafta(G); // MONOTONİK — dönem geçişinde sıfırlanmaz (219-hafta cd bug'ı)
    oz.yatirim = { vade: abs + 4, tutar: ozH32(`${G.club?.name}#arsa#${abs}`) % 100 < 50 ? 9 : 3 };
  }
  oz.kullanilan.push(o.id); oz.kullanilan = oz.kullanilan.slice(-8);
  // #12 KARAR DEFTERİ — verdiğin her karar tarihe geçer (son 20; hikâyeni geriye okursun)
  (oz.defter = oz.defter || []).unshift({ s: G.meta.season, h: G.meta.week, t: o.t, secim: a.l, kisi: o.kisi });
  oz.defter = oz.defter.slice(0, 20);
  oz.olayCoz++; ozSezon(oz).ikilem++; oz.xp += 2; oz.olay = null;
  oz.akis.unshift(`${o.t} → ${a.l}`); oz.akis = oz.akis.slice(0, 3);
  return { ok: true };
}

// Varlık yükseltme — kişisel nakitle, tek yönlü
export function ozelVarlik(G, kat) {
  const oz = G.ozel, V = VARLIK[kat]; if (!oz || !V) return { ok: false };
  const lv = oz.varlik[kat] || 0;
  if (lv >= V.adlar.length) return { ok: false, why: 'zirvede' };
  if (oz.nakit < V.fiyat[lv]) return { ok: false, why: 'nakit yetersiz' };
  oz.nakit = Math.round((oz.nakit - V.fiyat[lv]) * 10) / 10;
  oz.varlik[kat] = lv + 1; oz.xp += 1;
  // VARLIK İMTİYAZI: Süper Spor şehirde olay olur — tek seferlik taraftar coşkusu (bilinçli alım → kulüp etkisi meşru)
  if (kat === 'oto' && oz.varlik.oto === 4) {
    G.gauges.taraftar = clamp(G.gauges.taraftar + 2, 0, 100);
    pushInbox(G, { cat: 'manset', t: 'BAŞKANIN SÜPER SPORU ŞEHRİ AYAĞA KALDIRDI', sig: 'oz-supersp', b: 'Antrenman tesisine gelişi sosyal medyayı salladı; gençler kapıda poz kuyruğunda. Tribün "başkanımız yaşıyor yaşatıyor" pankartı hazırlıyor (taraftar +2).', noQueue: true });
  }
  oz.akis.unshift(`Yeni varlık: ${V.adlar[lv]}`); oz.akis = oz.akis.slice(0, 3);
  return { ok: true };
}

// Davet — kişisel para + enerji → kulüp-yönlü tek seferlik etki (cooldown'lu)
export function ozelDavet(G, id) {
  const oz = G.ozel, D = DAVETLER[id]; if (!oz || !D) return { ok: false };
  const abs = absHafta(G); // MONOTONİK — dönem geçişinde sıfırlanmaz (219-hafta cd bug'ı)
  if (!D.req(oz, G)) return { ok: false, why: D.reqTxt };
  if ((oz.davetCd[id] || 0) > abs) return { ok: false, why: 'takvim dolu' };
  if (oz.nakit < D.maliyet) return { ok: false, why: 'nakit yetersiz' };
  if (oz.g.enerji < 15) return { ok: false, why: 'takat yok' };
  oz.nakit = Math.round((oz.nakit - D.maliyet) * 10) / 10;
  oz.g.enerji = clamp(oz.g.enerji - Math.max(1, D.enerji - (oz.rozet.gece ? 1 : 0) - (oz.seviye >= 4 ? 1 : 0) - ((oz.varlik.konut || 0) >= 3 ? 1 : 0)), 0, 100); // Cemiyet İnsanı (sv.4+) + VARLIK: Boğaz Yalısı ağırlamaya alışkın
  oz.davetCd[id] = abs + (id === 'hayir' && (oz.varlik.sanat || 0) >= 3 ? D.cd - 2 : id === 'tekne' && (oz.varlik.tekne || 0) >= 3 ? D.cd - 2 : D.cd); // VARLIK: Mega Yat takvimi erken açar
  oz.davetToplam++; ozSezon(oz).davet++;
  if (id === 'moral') {
    // KRİZ SOFRASI: başkan mağlubiyet serisinde takımı cebinden ağırlar — soyunma odası toparlar.
    // Bilinçli + bedelli aksiyon → kadro etkisi meşru (seri prim emsali); rand YOK, determinist.
    for (const q of G.squad) {
      q.morale = clamp(q.morale + 8, 0, 100);
      q.form = clamp((q.form ?? 50) + 4, 0, 100);
      q.baskanaGuven = clamp((q.baskanaGuven ?? 50) + 3, 0, 100);
    }
    if (G.tdRelation != null) G.tdRelation = clamp(G.tdRelation + 2, 0, 100); // TD de sofrada — "arkamda duruyor"
    G.magSeri = 0; // sofra seriyi zihinlerde kapattı — kapı yeni bir seride tekrar açılır
    ozelFx(G, { stres: -2, xp: 2 });
    pushInbox(G, { cat: 'kulup', t: 'Takım Moral Gecesi — başkan sofra kurdu', b: 'Üst üste yenilgilerin ardından başkan tüm kadroyu cebinden ağırladı: "Bu masada kimse yalnız yürümez." Soyunma odası nefes aldı — moral ve form toparladı, gözler yeniden parlıyor.', noQueue: true });
  } else if (id === 'altyapi') {
    // KÖPRÜ: Özel Hayat ↔ Oyuncu İlişkileri — ocak çocuklarıyla kahvaltı, güven kalıcı işler.
    // + GELİŞİM ATEŞİ (kullanıcı isteği 2026-07-21): başkanın ilgisi genci hızlandırır — gelişim
    // çağındaki (≤DEV_GEC_YAS) sofradakilere _gel puanı eklenir (determinist; ~2 hafta idman değeri;
    // sezon tavanları aynen işler → abartı freni hazır). Autoplay davet düzenlemez → bantlar nötr.
    const ocaklar = G.squad.filter((x) => x.ocak);
    const grup = ocaklar.length ? ocaklar : G.squad.filter((x) => klikOf(x) === 'gencler');
    const babaBonus = (oz.seviye >= 7 ? 2 : 0); // Camianın Babası (sv.7+): gençler onu ağabey bilir
    let atesli = 0;
    for (const q of grup) {
      q.baskanaGuven = clamp((q.baskanaGuven ?? 50) + relDelta(relx(G, q).kisilik, (ocaklar.length ? 6 : 3) + babaBonus), 0, 100);
      q.morale = clamp(q.morale + 3, 0, 100);
      if (q.age <= TUNING.DEV_GEC_YAS && q.overall < (q.potential ?? q.overall)) { q._gel = (q._gel || 0) + TUNING.KAHVALTI_GELISIM; atesli++; }
    }
    ozelFx(G, { xp: 2 });
    pushInbox(G, { cat: 'kulup', t: 'Altyapıda kahvaltı sofrası', b: `${ocaklar.length ? 'Başkan ocak çocuklarıyla aynı masada — "Bu arma sizin evladım." Gençlerin gözünde büyüdün.' : 'Akademi sofrası kuruldu; gençler kliği başkanı yakından gördü — güven filizlendi.'}${atesli ? ` Hocalar not etti: ${atesli} gencin idman ateşi yükseldi (gelişim ▲).` : ''}`, noQueue: true });
  } else if (id === 'yemek') {
    for (const m of G.board || []) m.loyalty = clamp((m.loyalty || 50) + 2, 0, 100);
    ozelFx(G, { ev: 4, es: 4, xp: 2 });
    pushInbox(G, { cat: 'kongre', t: 'Yalıda akşam yemeği', b: 'Kurul üyeleri eşleriyle ağırlandı — masada kulüp değil, insan konuşuldu. Sadakat tazelendi.', noQueue: true });
  } else if (id === 'tekne') {
    const yatB = (oz.varlik.tekne || 0) >= 2 ? 1 : 0; // VARLIK: Flybridge Yat — mali algı ikiye katlanır
    ozelFx(G, { mali: 1 + yatB, dost: 6, sosyal: 6, xp: 2 });
    pushInbox(G, { cat: 'mali', t: 'Tekne turu — iş çevresi', b: yatB ? 'Yatırımcılar flybridge güvertesinde ağırlandı — körfezde konuşulan tek şey kulübün vizyonu. Mali itibara çifte cila.' : 'Rıfat Bey ve yatırımcılar körfezde ağırlandı. Kulübün mali itibarına cila.', noQueue: true });
  } else if (id === 'hayir') {
    // Sanat dişi: koleksiyoner başkan imajı (sv.2+) — gece daha çok konuşulur
    const sanatVar = (oz.varlik.sanat || 0) >= 2 ? 1 : 0;
    ozelFx(G, { itibar: 2 + (oz.rozet.medya ? 1 : 0) + sanatVar, taraftar: 1 + sanatVar, muhabir: 5, xp: 3 });
    pushInbox(G, { cat: 'manset', t: 'HAYIR GECESİ ŞEHRİN GÜNDEMİNDE', sig: `oz-hayir-${abs}`, b: 'Başkanın hayır gecesi salonu doldurdu; dernekler teşekkür ilanı verdi. İtibar hanesine yazıldı.', noQueue: true });
  }
  oz.akis.unshift(`${D.ad} düzenlendi`); oz.akis = oz.akis.slice(0, 3);
  return { ok: true };
}

// Kulübe kişisel destek — nakit → kulüp kasası (sezonda 3 kez; Cömert Patron coşkuyu büyütür)
export function ozelBagis(G, mn) {
  const oz = G.ozel; if (!oz) return { ok: false };
  mn = Number(mn);
  if (!Number.isFinite(mn)) return { ok: false }; // ZIRH: NaN bağış nakiti zehirlemesin
  mn = Math.max(1, Math.round(mn));
  const bagisLimit = oz.seviye >= 3 ? 4 : 3; // İş İnsanı (sv.3+): kulübe destek hakkı sezonda 4
  if (oz.bagisSezon >= bagisLimit) return { ok: false, why: `sezon limiti (${bagisLimit})` };
  if (oz.nakit < mn) return { ok: false, why: 'nakit yetersiz' };
  oz.nakit = Math.round((oz.nakit - mn) * 10) / 10;
  G.economy.kasa += mn;
  oz.bagisToplam += mn; oz.bagisSezon++; ozSezon(oz).bagis += mn; oz.xp += 1;
  G.gauges.taraftar = clamp(G.gauges.taraftar + (oz.rozet.comert ? 1.5 : 0.5), 0, 100);
  G.gauges.itibar = clamp(G.gauges.itibar + 0.5, 0, 100);
  pushInbox(G, { cat: 'mali', t: `Başkandan kulübe ${mn}mn kişisel destek`, b: oz.rozet.comert ? 'Cömert Patron yine sahnede — tribün pankart hazırlıyor.' : 'Kongre kulisi not etti: başkan cebinden koydu.', noQueue: true });
  oz.akis.unshift(`Kulübe ₺${mn}mn destek`); oz.akis = oz.akis.slice(0, 3);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════
// İLİŞKİ SEKANSLARI (SEKANS-PLAN Faz 1) — ortak motor: engines/iliski.js
// 2.1 Oyuncularla İlişki: p.baskanaGuven (mevcut alan) canlanır — jest, söz,
// klik, kişilik, iyilik defteri. 2.2 TD temeli: tdRelation telkine bağlandı.
// AUTOPLAY-NÖTR: baz 50 sabittir; eşikler (≥70 bağ / <30 kriz) yalnız oyuncu
// seçimleriyle aşılır. Kriz = sessiz ceza DEĞİL, görünür olay (plan §0.3).
// ═══════════════════════════════════════════════════════════════════════

// Oyuncu ilişki eki — lazy + hash-determinist (eski kayıtta nötr doğar; plan §0.5)
export function relx(G, p) {
  if (!p.relx) p.relx = { kisilik: kisilikOf(p.id + '#' + (p.name || '')), iyilik: 0, soz: null };
  return p.relx;
}

// KİŞİSEL JEST — haftada 1 (tüm kadro için tek hak): sakat ziyareti / başkanla yemek.
// Aynı klik olumlu etkilenir; YILDIZA kıyak karşı kliği hafif küstürür (plan 2.1 klik yönetimi).
export function playerJest(G, playerId) {
  const p = G.squad.find((x) => String(x.id) === String(playerId));
  if (!p) return { ok: false };
  const abs = absHafta(G); // MONOTONİK — dönem geçişinde sıfırlanmaz (219-hafta cd bug'ı)
  // UNVAN PASİFİ (2.9): Halkın Adamı (sv.5+) haftada 2 jest hakkı
  const jestHak = (G.ozel?.seviye ?? 1) >= 5 ? 2 : 1;
  if (G.jestH?.hafta === abs && G.jestH.n >= jestHak) return { ok: false, why: jestHak > 1 ? 'Bu haftanın 2 jest hakkı doldu' : 'Bu hafta bir jest yapıldı — haftada bir' };
  if ((G.ozel?.g?.enerji ?? 100) < 30) return { ok: false, why: 'Takatin yok — programda dinlenme akşamı ayır' }; // enerji dişi: kapasite gerçek
  G.jestH = { hafta: abs, n: (G.jestH?.hafta === abs ? G.jestH.n : 0) + 1 };
  const rx = relx(G, p);
  p.baskanaGuven = clamp((p.baskanaGuven ?? 50) + relDelta(rx.kisilik, 6), 0, 100);
  p.morale = clamp(p.morale + 4, 0, 100);
  rx.iyilik = (rx.iyilik || 0) + 1;
  const klik = klikOf(p);
  const yayilim = ((G.ozel?.seviye ?? 1) >= 2 ? 2 : 1) + ((G.ozel?.varlik?.oto || 0) >= 2 ? 1 : 0); // Mahallenin Başkanı (sv.2+) + VARLIK: Spor Coupé — kulübe gelişin olay olur
  for (const q of G.squad) {
    if (q === p) continue;
    if (klikOf(q) === klik) q.baskanaGuven = clamp((q.baskanaGuven ?? 50) + yayilim, 0, 100);     // "başkan bizden"
    else if (p.isStar) q.baskanaGuven = clamp((q.baskanaGuven ?? 50) - 1, 0, 100);                // yıldıza kıyak → öbür klik söylenir
  }
  const sakat = p.injuryWeeks > 0;
  pushInbox(G, {
    cat: 'kulup', noQueue: true,
    t: sakat ? `Hastane ziyareti: ${p.name}` : `Başkanla yemek: ${p.name}`,
    b: sakat ? `Çiçek, forma, iki saat sohbet. ${p.name} kapıya kadar uğurladı — ${KLIK_TR[klik]} bunu konuşuyor.`
      : `Makam katında baş başa yemek. ${p.name} çıkışta gülümsüyordu — ${KLIK_TR[klik]} not etti: "başkan bizi görüyor."${p.isStar ? ' Öbür masada hafif bir söylenme var ama.' : ''}`,
  });
  registerDecision(G, 'jest');
  return { ok: true };
}

// SATMAM SÖZÜ — oyuncu başına aktif 1 söz. Sezon sonuna kadar tutarsan güven + iyilik;
// satarsan sozIhlal bedeli (manşet + klik sarsıntısı + taraftar). Plan 2.1 "söz ver".
export function playerSoz(G, playerId) {
  const p = G.squad.find((x) => String(x.id) === String(playerId));
  if (!p) return { ok: false };
  const rx = relx(G, p);
  if (rx.soz) return { ok: false, why: 'Söz zaten verildi' };
  if (p.vitrin) return { ok: false, why: 'Satış listesindeyken söz verilmez — önce listeden çek' };
  rx.soz = { tip: 'satmam', sezon: G.meta.season };
  p.baskanaGuven = clamp((p.baskanaGuven ?? 50) + relDelta(rx.kisilik, 8), 0, 100);
  p.morale = clamp(p.morale + 5, 0, 100);
  pushInbox(G, { cat: 'kulup', t: `Başkan sözü: ${p.name} satılmayacak`, b: `Kameraların önünde değil ama soyunma odası duydu: "${p.name} bu armanın oyuncusu, pazarlık kapalı." Söz defterde — tutulursa güven büyür, bozulursa manşet olur.`, noQueue: true });
  registerDecision(G, 'soz:satmam');
  return { ok: true };
}

// Söz ihlali — satış anında çağrılır (aktif seçim bedeli; sessiz ceza değil, görünür fatura)
function sozIhlal(G, p) {
  // HANEDAN: kendi oğlunu satmak — evde deprem (aktif seçim; kulüp gauge'ına değil, eve vurur)
  if (p.aileOgul && G.ozel) {
    G.ozel.g.ev = clamp(G.ozel.g.ev - 10, 0, 100);
    G.ozel.iliski.es = clamp(G.ozel.iliski.es - 10, 0, 100);
    G.ozel.iliski.c2 = clamp(G.ozel.iliski.c2 - 20, 0, 100);
    pushInbox(G, { cat: 'manset', t: `BAŞKAN ÖZ OĞLUNU SATTI: ${p.name}`, sig: 'ogul-satis', b: `Kasaya para girdi ama eve girmek zor: ${G.ozel.aile.es} Hanım konuşmuyor, ${G.ozel.aile.c2} telefon açmıyor. Camia da böldü: "iş iştir" diyen de var, "evladını satan bizi de satar" diyen de.`, noQueue: true });
  }
  const rx = p.relx;
  if (!rx || !rx.soz || rx.soz.tip !== 'satmam') return;
  G.gauges.taraftar = clamp(G.gauges.taraftar - 1, 0, 100);
  const klik = klikOf(p);
  for (const q of G.squad) if (q !== p && klikOf(q) === klik) {
    const qx = relx(G, q);
    q.baskanaGuven = clamp((q.baskanaGuven ?? 50) + relDelta(qx.kisilik, -4), 0, 100); // "sıra bize de gelir"
  }
  rx.soz = null;
  pushInbox(G, { cat: 'manset', t: `SÖZ TUTULMADI: ${p.name} satıldı`, sig: 'soz-ihlal-' + p.id, b: `"Satılmayacak" denmişti — imza atıldı. ${KLIK_TR[klik]} soyunma odasında sessiz; tribün pankartı hazır: "Sözler sandıkta kalmasın."`, noQueue: true });
}

// HAFTALIK İLİŞKİ NABZI — finishWeekTail'den. Eşikli bağlar + kriz olayları.
// Autoplay-nötr: baz 50/70 değerlerde hiçbir dal çalışmaz; core rng'ye çekiliş YOK (hash).
export function iliskiTick(G) {
  const H = (tag) => ozH32(`${G.club?.name}#rel#${G.meta.season}#${G.meta.week}#${tag}`);
  // 2.1: güven ≥70 → sahaya döner (moral); <30 → huzursuzluk OLAYI (haftada en çok 1 manşet)
  let olayVar = false;
  for (const p of G.squad) {
    const bg = p.baskanaGuven ?? 50;
    if (bg >= 70) p.morale = clamp(p.morale + 1, 0, 100); // "başkan arkamda" — form motoruna akar
    else if (bg < 30 && !olayVar && H('huzursuz' + p.id) % 100 < 25) {
      olayVar = true;
      pushInbox(G, { cat: 'transfer', t: `${p.name} huzursuz`, sig: `huzursuz-${p.id}-${G.meta.season}`, b: `Menajeri kulübü aradı: "Oyuncum başkana kırgın, satış düşünürüz." İlişkiyi düzelt (jest/söz) ya da vitrine koy — görmezden gelirsen basına taşır.`, noQueue: true });
    }
  }
  // 2.2: TD ilişkisi — o hafta telkin kabul edildiyse sonuç ilişkiye işler (determinist olay)
  const wk = G.meta.week;
  if ((G.telkinWeeks || []).includes(wk)) {
    const res = (G.telkinLog || []).find((e) => e.wk === wk)?.res;
    if (res === 'W') G.tdRelation = clamp((G.tdRelation ?? 70) + 1, 0, 100);       // "başkan haklıydı"
    else if (res === 'L') G.tdRelation = clamp((G.tdRelation ?? 70) - 1, 0, 100);  // "karışmasaydınız"
  }
  // TD kriz kanalı: ilişki <30 → istifa sinyali OLAYI (gauge cezası yok — görünür tehdit)
  if ((G.tdRelation ?? 70) < 30 && H('tdkriz') % 100 < 20) {
    pushInbox(G, { cat: 'td', t: `${G.coach?.name || 'TD'} istifa sinyali veriyor`, sig: 'td-kriz-' + G.meta.season, b: 'Yardımcı antrenör kulise fısıldadı: "Hoca valizini topluyor." İlişki dibe vurdu — ya telkinleri kes, ya sonuç gelsin, ya da yolları ayır.', noQueue: true });
  }
  // 2.3 FIRSAT kanalı: derbi rakibi başkanla centilmenlik (≥70) → sezonda 1 ortak hasılat gecesi (+1,5mn)
  const o0 = G.opponents?.[0];
  if (o0 && ((G.bkRel || {})[o0.id] ?? 50) >= 70 && G.hasilatSezon !== G.meta.season && H('hasilat') % 100 < 12) {
    G.hasilatSezon = G.meta.season; G.economy.kasa += 1.5;
    pushInbox(G, { cat: 'mali', t: 'Dostluk gecesi hasılatı: +1,5mn', b: `${bkIsim(o0, G.data?.names)} ile ortak hasılat maçı — iki camia aynı tribünü doldurdu, gişe ikiye bölündü. Centilmenlik kazandırıyor.`, noQueue: true });
  }
  // 2.7 KARANLIK SPONSOR bedeli: kripto imzaladıysan her sezonun 8. haftasında zar döner —
  // batmaChance imzada AÇIKÇA yazıyordu (bilinçli risk); batarsa gelir kesilir + manşet.
  if (G.meta.week === 8) {
    for (const [slot, d] of Object.entries(G.sponsorDeals || {})) {
      if (d?.riskProfile?.batmaChance && ozH32(`${G.club?.name}#bat#${G.meta.season}#${slot}`) % 100 < d.riskProfile.batmaChance * 100) {
        G.sponsorDeals[slot] = null;
        G.club.reputation = clamp((G.club.reputation ?? 50) - 2, 0, 100);
        pushInbox(G, { cat: 'manset', t: `SPONSOR BATTI: ${d.name}`, sig: `bat-${slot}-${G.meta.season}`, b: 'Kripto piyasası çöktü; formadaki logo bir gecede hükümsüz. Gelir kesildi, "ucuz parlak para" diyenler haklı çıktı. Slot yeniden pazara açık.', noQueue: true });
      }
    }
  }
  ultrasTick(G); // KONGRE 2.6: tribün gruplarının nabzı (talep/protesto/duvar gecesi — hash, rand YOK)
}

// ═══ KONGRE 2.6: DELEGE BLOKLARI + ULTRAS ═══
// Delege blokları: 4 seçmen kütlesi (config DELEGE.BLOK), iliski nötr 50 başlar.
// KURAL (autoplay-nötr): blok iliski'si YALNIZ bilinçli oyunla oynar (yemek, ultras cevabı,
// bilet kararı, sosyal proje, hanedan) — kendiliğinden drift YOK; nötrde sandık bit-bit eski formül.
export function delegeInit() {
  const bloklar = {};
  for (const k of Object.keys(TUNING.DELEGE.BLOK)) bloklar[k] = 50;
  return { bloklar, yemekHak: TUNING.DELEGE.YEMEK.hak };
}
export function blokNudge(G, key, delta) {
  if (!G.delege) G.delege = delegeInit();
  if (G.delege.bloklar[key] == null) return;
  G.delege.bloklar[key] = clamp(G.delege.bloklar[key] + delta, 0, 100);
}
// Blok yemeği: dönemde sınırlı sayıda, temsilcilerle sofra kur — iliski ısınır (determinist, rand yok)
export function delegeYemek(G, blokKey) {
  const Y = TUNING.DELEGE.YEMEK, B = TUNING.DELEGE.BLOK[blokKey];
  if (!B) return false;
  if (!G.delege) G.delege = delegeInit();
  if ((G.delege.yemekHak ?? 0) <= 0) { pushInbox(G, { cat: 'kongre', t: 'Yemek takvimi dolu', b: 'Bu dönemki blok sofraları tamamlandı — daha fazlası "oy pazarlığı" manşeti olur. Sandığa kadar icraat konuşsun.', noQueue: true }); return false; }
  if (G.economy.kasa < Y.maliyet) { pushInbox(G, { cat: 'kongre', t: 'Sofra ertelendi', b: 'Kasa yemek bütçesini bile kaldırmıyor — önce nakit.', noQueue: true }); return false; }
  G.economy.kasa -= Y.maliyet; G.delege.yemekHak--;
  blokNudge(G, blokKey, Y.artis);
  pushInbox(G, { cat: 'kongre', t: `${B.ad} ile yemek`, b: `${B.kim} sofrada ağırlandı (${Y.maliyet}mn). Uzun masada dertler dinlendi, blok ısındı (ilişki ${Math.round(G.delege.bloklar[blokKey])}). Kalan sofra hakkı: ${G.delege.yemekHak}.`, noQueue: true });
  return true;
}

// Ultras katmanı: mevcut fanGroups üstüne iliski (seçim-oyunlu) + talep (olay kanalı) alanları
export function ultrasInit(G) {
  for (const g of G.fanGroups || []) {
    if (g.iliski == null) g.iliski = 50;
    if (g.talep === undefined) g.talep = null;
    if (g.talepCd == null) g.talepCd = 0;
    if (g.duvarSezon == null) g.duvarSezon = 0;
  }
}
// Haftalık nabız (iliskiTick sonundan çağrılır): süre dolan talep → PROTESTO OLAYI (manşet;
// gauge/blok DOKUNMAZ — ihmal yolu sandığa işlemez, autoplay-nötr) · hash'le yeni talep doğar ·
// iliski ≥70 → sezonda 1 "duvar gecesi" (bedava koreografi). Core rng'ye ÇEKİLİŞ YOK.
export function ultrasTick(G) {
  const U = TUNING.ULTRAS;
  const abs = G.globalWeek || 0, wk = G.meta.week;
  ultrasInit(G); // eski kayıt zırhı — alanlar her tickte garanti
  for (const g of G.fanGroups || []) {
    const H = (tag) => ozH32(`${G.club?.name}#ultras#${g.name}#${G.meta.season}#${wk}#${tag}`);
    // 1) cevapsız talep süresi doldu → protesto
    if (g.talep && abs >= g.talep.sonAbs) {
      const m = G.inbox.find((x) => x.action === 'ultras' && x.grup === g.name && !x.resolved);
      if (m) m.resolved = true;
      g.talep = null; g.talepCd = abs + U.CD;
      g.iliski = clamp(g.iliski + U.PROTESTO.iliski, 0, 100);
      pushInbox(G, { cat: 'kongre', t: `${g.name} pankart açtı: "SES VER BAŞKAN"`, sig: `ultras-prot-${g.name}-${G.meta.season}-${wk}`, b: `Talepleri ${U.SURE} hafta cevapsız kaldı — maçın ilk 10 dakikası tribün sustu, sonra pankart indi. Liderler kırgın (ilişki ${Math.round(g.iliski)}). Kırgın tribün duvar örmez: koreografi/konvoy destekleri buzda.`, noQueue: true });
      continue;
    }
    // 2) yeni talep doğumu (hafta bandı + cooldown + hash)
    if (!g.talep && abs >= (g.talepCd || 0) && wk >= U.TALEP_HAFTA[0] && wk <= U.TALEP_HAFTA[1]
      && H('talep') % 100 < (g.radikal ? U.TALEP_P.radikal : U.TALEP_P.ilimli)) {
      const tipler = Object.keys(U.TALEPLER);
      const tip = tipler[H('tip') % tipler.length];
      const T = U.TALEPLER[tip];
      g.talep = { tip, sonAbs: abs + U.SURE };
      pushInbox(G, {
        cat: 'kongre', t: `${g.name} talebi: ${T.ad}`, action: 'ultras', grup: g.name, noQueue: true,
        b: `Tribün liderleri lokalde masaya oturdu: "${T.ad} için desteğini istiyoruz Başkanım — ${T.maliyet}mn." Karşılarsan tribün coşar${tip === 'koreografi' ? ', ilk EV maçında duvar örülür' : ''}; ${U.SURE} hafta içinde cevap gelmezse pankart iner.`,
      });
      continue;
    }
    // 3) FIRSAT kanalı: sıcak tribün sezonda 1 kez kendi cebinden duvar örer
    if (g.iliski >= U.DUVAR_ESIK && g.duvarSezon !== G.meta.season && !G.koreoPending && H('duvar') % 100 < U.DUVAR_P) {
      g.duvarSezon = G.meta.season; G.koreoPending = true;
      pushInbox(G, { cat: 'kongre', t: `${g.name} duvar örüyor — masrafı bizden deme, onlardan`, sig: `ultras-duvar-${g.name}-${G.meta.season}`, b: 'Tribün lideri aradı: "Bu hafta koreografi bizden Başkanım — sen sahaya bak." İlişki sıcak; ilk EV maçında tribün duvar (+%1.5).', noQueue: true });
    }
  }
}
// Talep cevabı (inbox butonları): karşıla → maliyet + coşku + tribün bloku; reddet → kırgınlık (bilinçli seçim)
export function resolveUltras(G, msgId, cevap) {
  const U = TUNING.ULTRAS;
  const m = G.inbox.find((x) => x.id === msgId);
  if (!m || m.resolved) return false;
  const g = (G.fanGroups || []).find((x) => x.name === m.grup);
  if (!g || !g.talep) { m.resolved = true; return false; }
  const T = U.TALEPLER[g.talep.tip] || { maliyet: 1, ad: 'destek' };
  if (cevap === 'kabul') {
    if (G.economy.kasa < T.maliyet) {
      // TEKRARSIZ uyarı: aynı talep için ikinci kez basılmaz (buton zaten kilitli — bu son savunma hattı)
      const sig = `ultras-kasa-${g.name}-${g.talep.tip}`;
      if (!G.inbox.some((x) => x.sig === sig)) pushInbox(G, { cat: 'kongre', t: 'Kasa bu jesti kaldırmıyor', sig, b: `${T.ad} için ${T.maliyet}mn gerek — dosya masada bekliyor; kasa dolunca KARŞILA açılır.`, noQueue: true });
      return false;
    }
    m.resolved = true;
    G.economy.kasa -= T.maliyet;
    g.iliski = clamp(g.iliski + U.KABUL.iliski, 0, 100);
    g.talepCd = (G.globalWeek || 0) + U.CD;
    G.gauges.taraftar = clamp(G.gauges.taraftar + U.KABUL.taraftar, 0, 100);
    blokNudge(G, 'tribun', U.KABUL.tribunBlok);
    if (g.talep.tip === 'koreografi') G.koreoPending = true;
    pushInbox(G, { cat: 'kongre', t: `${g.name} coştu: talep karşılandı`, b: `${T.ad} (${T.maliyet}mn) tamam — lokalde adın marşa girdi (ilişki ${Math.round(g.iliski)}, taraftar +${U.KABUL.taraftar}).${g.talep.tip === 'koreografi' ? ' İlk EV maçında tribün duvar (+%1.5).' : ''} Tribün Delegeleri bunu sandıkta hatırlar.`, noQueue: true });
    g.talep = null;
  } else {
    m.resolved = true;
    g.iliski = clamp(g.iliski + U.RED.iliski, 0, 100);
    g.talep = null; g.talepCd = (G.globalWeek || 0) + U.CD;
    blokNudge(G, 'tribun', U.RED.tribunBlok);
    pushInbox(G, { cat: 'kongre', t: `${g.name} masadan kalktı`, b: `Talep açıkça reddedildi — liderler "not ettik başkanım" deyip çıktı (ilişki ${Math.round(g.iliski)}). Tribün Delegeleri kulisi de duydu.`, noQueue: true });
  }
  return true;
}

// ÖZEL RÖPORTAJ (2.5) — bu haftaki rotasyon muhabirine kapını aç: ilişki sıçrar, hava yumuşar.
// Sezonda muhabir başına 1; enerji ister (Özel Hayat köprüsü). Şehrin Yüzü (sv.6+) etkiyi büyütür.
export function ozelRoportaj(G) {
  const muhabir = MUHABIRLER[(G.meta.week || 1) % MUHABIRLER.length];
  const key = `${G.meta.season}#${muhabir.ad}`;
  G.roportajLog = G.roportajLog || {};
  if (G.roportajLog[key]) return { ok: false, why: 'Bu sezon bu kaleme röportaj verildi' };
  if ((G.ozel?.g?.enerji ?? 100) < 15) return { ok: false, why: 'Takat yok' };
  G.roportajLog[key] = 1;
  G.pressRel = G.pressRel || {};
  G.pressRel[muhabir.ad] = clamp((G.pressRel[muhabir.ad] ?? 50) + 10, 0, 100);
  G.mediaTone = (G.mediaTone || 0) + 0.3 + ((G.ozel?.seviye ?? 1) >= 6 ? 0.1 : 0);
  if (G.ozel) { G.ozel.g.enerji = clamp(G.ozel.g.enerji - 2, 0, 100); G.ozel.xp += 2; }
  if (muhabir.stil === 'magazin' && G.ozel) G.ozel.iliski.muhabir = clamp(G.ozel.iliski.muhabir + 4, 0, 100); // magazin cephesi de yumuşar
  pushInbox(G, { cat: 'medya', t: `Özel röportaj: ${muhabir.ad} sordu, başkan anlattı`, sig: `rop-${key}`, b: `${muhabir.kimlik} — bir saatlik samimi sohbet tam sayfa oldu. Kalem ısındı, basın havası yumuşadı.`, noQueue: true });
  return { ok: true };
}
