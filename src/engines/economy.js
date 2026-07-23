// src/engines/economy.js — Ekonomi (Bible-8)
//   Gelir: bilet / yayın / sponsor / forma / üyelik
//   Gider: maaş / teknik ekip / tesis bakım / idari / faiz  (amortisman MVP=0)
//   kasa<0 → otomatik borçlanma + faiz cezası ; maliHedef formülü
// Sponsor PAZARLIĞI ve FFP MVP dışı (sponsor yalnızca gelir kalemi). Katsayılar TUNING'den.

import { TUNING } from '../config.js';
import { stadKapasite } from './facilities.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// 2. LİG gelir çarpanı: küme düşünce yayın/sponsor/bilet geliri küçülür (üst ligde 1.0)
function ligMult(state, kind) {
  if ((state.lig || 1) !== 2) return 1;
  return TUNING.LEAGUE.LIG2_ECO[kind] ?? 1;
}

// ── GELİR ──
export function bilet(state) {
  const A = TUNING.ATTEND;
  const { ticketPrice } = state.economy;
  // A1: Stat/Operasyon Müdürü doluluğu artırır (skill/2500)
  const statBonus = state.staff && state.staff.stat ? state.staff.stat.skill / TUNING.STAFF.STAT_DOLULUK_DIV : 0;
  // KONFOR (2026-07-22): stadyum seviyesi doluluğa işler — köhne stat seyirci kaçırır, modern çeker
  const konfor = ((state.facilities?.stadyum ?? A.KONFOR_NOTR) - A.KONFOR_NOTR) * A.KONFOR_SV;
  // YUMUŞAK TAVAN (2026-07-23, kullanıcı: "büyük kulüp de doluluk baskısı hissetsin"): eskiden toplam
  // 1.0'a SERT kırpılıyordu → büyük/dev kulüpte doluluk tavana yapışıyor, bilet fiyatı sahada HİÇ
  // hissedilmiyordu (ölçüldü: dev şampiyon ×1 → %100, ×2 → %93; yalnız 7 puan. Küçük kulüp aynı zamda
  // 25 puan kaybediyordu). Artık doyum YALNIZ KALİTE kısmına uygulanır — fiyat tepkisi her tier'da
  // TAM güçte kalır (ölçüldü: ×1 → ×2 arası kayıp her tier'da −32 puan). "Kaliteyle doldurursun,
  // ama zam her zaman keser." Tavan 0.98: tıklım tribün bile tam %100 değildir.
  // KONFOR de doyumun DIŞINDA (fiyat gibi): modern stat kulüp ne kadar büyük olursa olsun çeker,
  // köhne stat kaçırır. Doyumun içinde kalsaydı stadyum yatırımının etkisi büyük kulüpte %45'e
  // inerdi (kaos.test: sv0→sv10 farkı 12 puan olmalı; doyum içindeyken 5.4 puana düşüyordu).
  let kalite = A.base + state.gauges.taraftar / A.taraftarDiv + state.gauges.sportif / A.sportifDiv + statBonus;
  const knee = A.KALITE_KNEE ?? 9;
  if (kalite > knee) kalite = knee + (kalite - knee) * (A.KALITE_YUMUSAK ?? 1);
  const doluluk = clamp(kalite + konfor - (ticketPrice - 1) * A.priceSlope, A.min, A.TAVAN ?? 1.0);
  // KAPASİTE = SEVİYE EĞRİSİ (2026-07-22): stadKapasite tek kaynak — yükselen stat gişeyi büyütür
  const gelir = stadKapasite(state) * doluluk * ticketPrice * TUNING.TICKET_K * ligMult(state, 'gate');
  return { doluluk, gelir, kapasite: stadKapasite(state) };
}

export function yayin(state) {
  return TUNING.TV_BASE[state.club.tier] / TUNING.SEASON_WEEKS * ligMult(state, 'tv'); // sezona yayılmış; 2. ligde küçülür
}

// Bir sponsor slotunun ANLAŞMASIZ haftalık baz geliri (mn/hafta) — teklif fiyatlaması buradan türer.
export function sponsorSlotWeekly(state, slot) {
  const E = TUNING.ECONOMY;
  const itibarFactor = E.SPONSOR_ITIBAR_BASE + state.club.reputation / E.SPONSOR_ITIBAR_DIV;
  const base = E.SPONSOR_BASE[state.club.tier] * itibarFactor;
  // sponsorMult: eskalasyon büyüme çarpanı; ligMult: 2. ligde küçülme
  const mult = (1 + state.club.reputation / E.SPONSOR_REP_DIV) * (state.club.sponsorMult ?? 1) * ligMult(state, 'sponsor') / E.WEEKS_PER_YEAR;
  if (slot === 'gogus') return base * mult;
  if (slot === 'kol') return base * E.SPONSOR_KOL * mult;
  if (slot === 'naming') return (state.facilities.stadyum >= E.NAMING_MIN_STAD ? base * E.SPONSOR_NAMING : 0) * mult;
  return 0;
}
// TİCARİ OFİS ÇARPANI: tesis seviyesi ticari geliri büyütür. BAŞLANGIÇ seviyesine (club.ticariBaz)
// göre NÖTR → mevcut denge korunur, yükseltmek ödüllendirir (kartın "sponsor/forma geliri büyür" vaadi).
export function ticariMult(state) {
  const T = TUNING.ECONOMY.TICARI || {};
  const lvl = state.facilities?.ticari ?? T.BAZ_DEFAULT ?? 3;
  // ticariBaz yoksa (manuel kurulmuş durum) MEVCUT seviyeye düş → çarpan ×1.00 (nötr). Gerçek oyunda
  // ticariBaz selectClub + migrateLoaded'da HEP set edilir → başlangıç seviyesine göre ödül işler.
  const baz = state.club?.ticariBaz ?? lvl;
  return clamp(1 + (lvl - baz) * (T.SLOPE ?? 0.05), T.LO ?? 0.8, T.HI ?? 1.5);
}

export function sponsor(state) {
  // İmzalı anlaşma varsa o slotun SABİT haftalık geliri (sözleşmede kilitli) kullanılır; yoksa baz gelir.
  // Anlaşma yokken toplam = baz formülle birebir aynı (geriye uyum). Ticari ofis seviyesi çarpar.
  const d = state.sponsorDeals || {};
  let total = 0;
  for (const slot of ['gogus', 'kol', 'naming']) {
    total += (d[slot] && d[slot].weekly != null) ? d[slot].weekly : sponsorSlotWeekly(state, slot);
  }
  return total * ticariMult(state);
}

export function forma(state) {
  const E = TUNING.ECONOMY;
  return state.club.fanCount * E.FORMA_K * (1 + state.gauges.sportif / E.FORMA_SPORTIF_DIV) * ticariMult(state);
}

export function uyelik(state) {
  return state.club.fanCount * TUNING.ECONOMY.UYELIK_K * ticariMult(state);
}

// Haftalık toplam gelir. isHomeMatch değilse bilet 0; isSeasonWeek false ise (sezon dışı)
// yayın geliri 0 (TV geliri sadece 34 maç haftasında akar). Maaş/faiz gibi giderler
// 52 hafta sürdüğü için yıl 52 tick sürer (34 maç + 18 sezon dışı).
export function haftalikGelir(state, { isHomeMatch = false, isSeasonWeek = true, ticketMult = 1 } = {}) {
  const b = isHomeMatch ? bilet(state).gelir * ticketMult : 0; // derbi haftası ×1.8 (v4-§3)
  const y = isSeasonWeek ? yayin(state) : 0;
  const s = sponsor(state), f = forma(state), u = uyelik(state);
  // A2: FFP taahhütnamesi — bu sezon gelirden kesinti (gelecek gelirin ipoteklenmesi)
  const cut = state.ffp && state.ffp.cutActive ? 1 - TUNING.FFP_EXTRA.TAAHHUT_CUT * (state.ffp.cutMult || 1) : 1; // B1d: 2. ihlal ×2
  return { bilet: b * cut, yayin: y * cut, sponsor: s * cut, forma: f * cut, uyelik: u * cut, toplam: (b + y + s + f + u) * cut };
}

// ── GİDER ──
export function haftalikGider(state) {
  const E = TUNING.ECONOMY;
  const maas = state.squad.reduce((s, p) => s + (p.wage || 0), 0) / E.WEEKS_PER_YEAR;
  const teknik = (state.coach?.wage || 0) / E.WEEKS_PER_YEAR * E.TEKNIK_MULT;
  const bakim = Object.values(state.facilities).reduce((s, lv) => s + lv, 0) * E.BAKIM_K;
  // A1: yönetici maaşları idari kaleme işler (gerçek maliyet)
  const staffWages = state.staff ? Object.values(state.staff).reduce((s, m) => s + (m ? m.wage : 0), 0) : 0;
  const kadinTakim = state.womensTeam && state.womensTeam.active ? 0.06 : 0; // kadın şubesi bakımı (mn/hafta)
  const idari = E.IDARI_BASE + state.club.fanCount * E.IDARI_FAN_K + staffWages / E.WEEKS_PER_YEAR + kadinTakim;
  const faiz = state.economy.borc * state.economy.faizOrani / E.WEEKS_PER_YEAR;
  const amortisman = 0; // MVP: transfer yok
  return { maas, teknik, bakim, idari, faiz, amortisman, toplam: maas + teknik + bakim + idari + faiz + amortisman };
}

// Mali sağlık hedefi (Bible-8.4)
export function maliHedef(state, gelirHafta, giderHafta) {
  const tierScale = TUNING.TIER_SCALE[state.club.tier];
  const { kasa, borc } = state.economy;
  const borcsuzBonus = borc <= 0 ? (TUNING.ECONOMY.BORCSUZ_MALI_BONUS || 0) : 0; // borçsuz kulüp mali tabloyu uçurur
  return clamp(
    TUNING.GAUGE.NEUTRAL + (kasa - borc) / tierScale - Math.max(0, giderHafta - gelirHafta) * TUNING.ECONOMY.MALI_DEFICIT_MULT + borcsuzBonus,
    0, 100,
  );
}

// Bir haftalık ekonomiyi uygula. state.economy'yi MUTASYONA uğratır; ledger döner.
// kasa<0 → otomatik borçlanma (kasa 0'a çekilir, borç artar, faiz +AUTO_DEBT_PENALTY ceza).
export function applyEconomy(state, { isHomeMatch = false, isSeasonWeek = true, ticketMult = 1, maliKriz = false } = {}) {
  const gelir = haftalikGelir(state, { isHomeMatch, isSeasonWeek, ticketMult });
  const gider = haftalikGider(state);
  const net = gelir.toplam - gider.toplam; // P&L (faiz gider olarak dahil) — yıllık kâr vergisi bunu izler
  state.economy.kasa += net;

  // BORÇ ANAPARA BİLEŞİĞİ (kullanıcı kuralı 2026-07): ağır faiz giderini ödesen BİLE anapara her hafta
  // hafifçe büyür → borcu sürüncemede bırakma, öde. Gentle oran (BORC_KOMPOUND ~%3/yıl) — spiral YOK;
  // faiz zaten ayrıca nakit yakar (asıl ceza orada). Borçsuz kulüpte etki 0.
  if (state.economy.borc > 0) state.economy.borc += state.economy.borc * (TUNING.ECONOMY.BORC_KOMPOUND ?? 0.03) / TUNING.ECONOMY.WEEKS_PER_YEAR;
  state.sezonKar = (state.sezonKar || 0) + net; // sezon (yıl) işletme kârı → endSeason'da eşik üstü %40 vergi

  let autoBorrow = 0, penalty = false;
  if (state.economy.kasa < 0) {
    autoBorrow = -state.economy.kasa;
    state.economy.borc += autoBorrow;
    state.economy.kasa = 0;
    // TAVAN (2026-07-20): ceza sınırsız tırmanmasın — geçici nakit sıkışması faizi kalıcı
    // uçurmasın; "krizde ama kurtarılabilir" felsefesi. Sezon başı sönümleme (initSeason) tabana çeker.
    // MALİ KRİZ YAPILANDIRMASI (2026-07-23): kriz modunda ceza ratchet'i DONAR — alacaklılar kulübü
    // kayyuma göndermektense faizi dondurur (gerçek standstill). Böylece harcaması dondurulan kulüp
    // faiz sarmalına yenilmeden operasyonel fazla + satışla borcu eritebilir. İyi kulüp bu moda GİRMEZ.
    if (!maliKriz) { state.economy.faizOrani = Math.min(TUNING.RATE_MAX, state.economy.faizOrani + TUNING.AUTO_DEBT_PENALTY); }
    penalty = true;
  }
  // Kriz modunda faiz oranı yapılandırma tabanına doğru HAFİF geri çekilir (standstill anlaşması) —
  // sarmalı kırar ama borcu silmez; çıkış hâlâ satış/ödeme ister.
  if (maliKriz && state.economy.borc > 0) state.economy.faizOrani = Math.max(TUNING.RATE_BASE ?? 0.32, state.economy.faizOrani - (TUNING.RATE_SEASON_DECAY ?? 0.02));

  const hedef = maliHedef(state, gelir.toplam, gider.toplam);
  return { gelir, gider, net, autoBorrow, penalty, kasa: state.economy.kasa, borc: state.economy.borc, maliHedef: hedef };
}

// Borç kısmi kapatma (Bible-8.4: kasa→borç). Kasadan borcu düşürür; ödenen tutarı döner.
export function payDebt(state, amount) {
  const pay = Math.max(0, Math.min(amount, state.economy.kasa, state.economy.borc));
  state.economy.kasa -= pay;
  state.economy.borc -= pay;
  return pay;
}
