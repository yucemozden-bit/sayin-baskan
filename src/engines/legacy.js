// src/engines/legacy.js — MİRAS & UZUN OYUN motoru (saf, DOM'suz).
// Muhalefet sezonu simülasyonu · dönüş seçimi oyu · tier terfi/tenzil kararı ·
// kariyer kapanış etiketi. Tüm sabitler TUNING.MIRAS'tan.

import { TUNING } from '../config.js';
import { rand, randint } from '../core/rng.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ── Muhalefetteki AI başkanın bir sezonu: tipe göre 1 büyük karar + sonuç ──
// state: {borc, kadroDeger, tesisOrt, hedefSira} MUTASYONA uğrar; döner: kart {karar, sonuc, pos}
export const OPP_TYPES = ['POPULIST', 'MUHASEBECI', 'INSAATCI', 'AVCI'];
const OPP_TR = { POPULIST: 'Popülist', MUHASEBECI: 'Muhasebeci', INSAATCI: 'İnşaatçı', AVCI: 'Avcı' };
export const oppTypeTr = (t) => OPP_TR[t] || t;

export function oppositionSeason(type, st) {
  let karar = '', sonuc = '';
  switch (type) {
    case 'POPULIST': {
      const harcama = st.kadroDeger * rand(0.15, 0.30);
      st.borc += harcama; st.kadroDeger *= rand(1.06, 1.14); st.guc += randint(1, 3);
      karar = `Borçla iki yıldız transferi (${harcama.toFixed(0)}mn)`;
      sonuc = 'Tribün coştu, kasa kan ağlıyor — faiz kalemi kabardı.';
      break;
    }
    case 'MUHASEBECI': {
      const satis = st.kadroDeger * rand(0.12, 0.22);
      st.borc = Math.max(0, st.borc - satis); st.kadroDeger *= rand(0.85, 0.93); st.guc -= randint(1, 3);
      karar = `Kadronun omurgası satıldı (+${satis.toFixed(0)}mn borca)`;
      sonuc = 'Bilanço parladı, saha soldu — taraftar "hedefsiz kulüp" diyor.';
      break;
    }
    case 'INSAATCI': {
      const insaat = rand(15, 30);
      st.borc += insaat * 0.6; st.tesisOrt += 0.5; st.guc -= randint(0, 2);
      karar = `Dev tesis ihalesi (${insaat.toFixed(0)}mn)`;
      sonuc = 'Vinçler yükseliyor; kadroya kuruş kalmadı, sonuçlar dalgalı.';
      break;
    }
    default: { // AVCI
      st.kadroDeger *= rand(0.90, 0.97); st.borc = Math.max(0, st.borc - st.kadroDeger * 0.05); st.guc -= randint(0, 2);
      karar = 'Genç yetenekler kâr amaçlı satıldı';
      sonuc = 'Komisyoncular kazandı; altyapı hocaları istifa sınırında.';
    }
  }
  // sezon sırası: güç kaymasına göre kabaca (hedef etrafında gürültü)
  const pos = clamp(Math.round(st.hedefSira + (58 - st.guc) * 0.4 + rand(-2.5, 2.5)), 1, 18);
  st.posList.push(pos);
  return { karar, sonuc, pos };
}

// ── Dönüş seçimi: mevcut başkanın karnesi senin kozun ──
// devir: {borc} (senin bıraktığın) · st: muhalefet sonrası durum · campSwing: kampanya puanı
export function comebackVote(devir, st, campSwing) {
  const C = TUNING.MIRAS.COMEBACK;
  const posOrt = st.posList.reduce((a, b) => a + b, 0) / Math.max(st.posList.length, 1);
  const posCeza = (posOrt - st.hedefSira) * C.POS_K;          // hedeften saptıysa sana oy
  const borcCeza = (st.borc - devir.borc) * C.BORC_K;         // borcu büyüttüyse sana oy
  const oy = C.BASE + posCeza + borcCeza + campSwing * C.CAMP_K - C.INCUMBENT + rand(-C.NOISE, C.NOISE);
  return clamp(oy, 0.05, 0.95);
}

// ── Tier terfi/tenzil kararı (Bible-20) ──
export function tierCheck(G) {
  const T = TUNING.MIRAS.TIER;
  const tier = G.club.tier;
  const kd = Math.max(G.club.kadroDeger, 1);
  const kume = (G.history.seasons || []).some((s) => s.pos >= TUNING.LEAGUE.RELEGATION_FROM);
  if (tier !== 'buyuk'
    && (G.consecTerms || 0) >= T.UP_TERMS
    && G.gauges.itibar >= T.UP_ITIBAR
    && G.economy.borc < kd * T.UP_BORC_RATIO
    && (G.tierShift == null)) return { dir: 'up', to: tier === 'kucuk' ? 'orta' : 'buyuk' };
  if (tier !== 'kucuk' && kume && G.economy.borc > kd * T.DOWN_BORC_RATIO) return { dir: 'down', to: tier === 'buyuk' ? 'orta' : 'kucuk' };
  return null;
}

// ── Kariyer kapanış etiketi — HER karnede bir etiket çıkar (boş etiket = 0) ──
export function legacyTag(G) {
  const c = G.career || { titles: 0, termsWon: 0, seasons: 0 };
  const kupa = (c.titles || 0) + (c.cups || 0);
  const oyOrt = c.oyList && c.oyList.length ? c.oyList.reduce((a, b) => a + b, 0) / c.oyList.length : 0.5;
  const borcIlk = (G.borcHistory && G.borcHistory[0]) ?? G.economy.borc;
  const borcSon = G.economy.borc;
  const kimlik = G.identityTag;
  if ((c.termsWon || 0) >= 3 && kupa >= 2) return 'Efsane';
  if (kupa >= 2) return 'Şampiyonlar Çağının Mimarı';
  if ((G.tierHistory || []).some((t) => t.dir === 'up')) return 'Kulübü Büyüten Adam';
  if (borcIlk >= 30 && borcSon <= borcIlk * 0.3) return 'Kurtarıcı';
  if (kimlik === 'Sahada Başkan' || kimlik === 'Ocak Bekçisi') return kimlik;
  if (borcSon <= borcIlk && oyOrt >= 0.5) return 'Muhasebeci';
  if (oyOrt >= 0.55) return 'Halkın Başkanı';
  if (borcSon > borcIlk * 1.5) return 'Popülist';
  return 'Emektar';
}
