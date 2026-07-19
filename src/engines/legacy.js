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
  const E = TUNING.MIRAS.ENKAZ_BORC;
  let karar = '', sonuc = '';
  switch (type) {
    case 'POPULIST': {
      // Borçla transfer — ama sezon başına en çok E.PER_SEASON şişer (eskiden kadroDeger'e
      // endeksli sınırsızdı → büyük kulüpte 3 sezonda 300mn+ bileşik borç).
      const harcama = Math.min(st.kadroDeger * rand(0.08, 0.15), E.PER_SEASON);
      st.borc += harcama; st.kadroDeger *= rand(1.04, 1.09); st.guc += randint(1, 3);
      karar = `Borçla yıldız transferi (${harcama.toFixed(0)}mn)`;
      sonuc = 'Tribün coştu, kasa zorlandı — faiz kalemi kabardı.';
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
  // BORÇ TAVANI: rakip dönemi borcu kadro değerinin makul bir oranını ve mutlak tavanı aşamaz —
  // "krizde ama kurtarılabilir" enkaz (kredi tavanı 400mn'ye asla yaklaşmaz). RNG akışını tüketmez.
  st.borc = clamp(st.borc, 0, Math.min(st.kadroDeger * E.RATIO_CAP, E.ABS_CAP));
  // sezon sırası: kulübün BEKLENEN yeri (hedefSira) + rakip tipinin SPORTİF sapması.
  // (Eskiden mutlak güce (58-guc) endeksliydi → güçlü kulüpte hep 1. bitip tip farkı sıraya
  //  yansımıyordu; artık hedef etrafında tipe göre sapar → her boyutta ayrışır. rand yine 1 çekiş.)
  const drift = TUNING.MIRAS.OPP_SPORTIF[type] ?? 0;
  const pos = clamp(Math.round(st.hedefSira + drift + rand(-1.6, 1.6)), 1, 18);
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

// ── Tier terfi/tenzil kararı (Bible-20 · 5 KADEME genişleme) ──
// Küçük → Orta → Büyük → Dev → Efsane. Şartlar hedef kademeye göre ağırlaşır (config UP tablosu);
// orta/buyuk eşikleri ESKİ davranışla birebir. Tenzil her kademeden 1 basamak (küme + borç sarmalı).
export const TIER_SIRA = ['kucuk', 'orta', 'buyuk', 'dev', 'efsane'];
export const TIER_TR = { kucuk: 'Küçük', orta: 'Orta', buyuk: 'Büyük', dev: 'Dev', efsane: 'Efsane' };
function tierUpReq(hedef) {
  const T = TUNING.MIRAS.TIER;
  return (T.UP && T.UP[hedef]) || { terms: T.UP_TERMS, itibar: T.UP_ITIBAR, borc: T.UP_BORC_RATIO, titles: 0 };
}
export function tierCheck(G) {
  const T = TUNING.MIRAS.TIER;
  const idx = TIER_SIRA.indexOf(G.club.tier);
  const kd = Math.max(G.club.kadroDeger, 1);
  const kume = (G.history.seasons || []).some((s) => s.pos >= TUNING.LEAGUE.RELEGATION_FROM);
  if (idx >= 0 && idx < TIER_SIRA.length - 1 && G.tierShift == null) {
    const hedef = TIER_SIRA[idx + 1];
    const R = tierUpReq(hedef);
    if ((G.consecTerms || 0) >= R.terms
      && G.gauges.itibar >= R.itibar
      && G.economy.borc < kd * R.borc
      && (G.career?.titles || 0) >= (R.titles || 0)) return { dir: 'up', to: hedef };
  }
  if (idx > 0 && kume && G.economy.borc > kd * T.DOWN_BORC_RATIO) return { dir: 'down', to: TIER_SIRA[idx - 1] };
  return null;
}

// Sonraki kademenin CANLI şart listesi — UI "Kulüp Seviyesi" paneli tek kaynaktan okur.
// null → zirvedesin (Efsane). ters:true → değer eşiğin ALTINDA kalmalı (borç oranı).
export function tierGorev(G) {
  const idx = TIER_SIRA.indexOf(G.club.tier);
  if (idx < 0 || idx >= TIER_SIRA.length - 1) return null;
  const hedef = TIER_SIRA[idx + 1];
  const R = tierUpReq(hedef);
  const kd = Math.max(G.club.kadroDeger, 1);
  const borcPct = Math.round((G.economy.borc / kd) * 100);
  const reqs = [
    { ad: 'Üst üste dönem', val: G.consecTerms || 0, esik: R.terms, ok: (G.consecTerms || 0) >= R.terms },
    { ad: 'İtibar', val: Math.round(G.gauges.itibar), esik: R.itibar, ok: G.gauges.itibar >= R.itibar },
    { ad: 'Borç / kadro değeri', val: borcPct, esik: Math.round(R.borc * 100), ok: G.economy.borc < kd * R.borc, ters: true, yuzde: true },
  ];
  if (R.titles) reqs.push({ ad: 'Şampiyonluk', val: G.career?.titles || 0, esik: R.titles, ok: (G.career?.titles || 0) >= R.titles });
  return { hedef, hedefTr: TIER_TR[hedef], reqs, hazir: reqs.every((r) => r.ok) };
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
