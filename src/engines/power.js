// src/engines/power.js — Takım Gücü, 3 katman (Bible-5)
//   Katman 1: TemelGüç  (kadro/teknik/kimya/taktik/tesis/derinlik/altyapı)
//   Katman 2: EfektifGüç (TemelGüç × uygunluk × moral × form × kondisyon)
//   Katman 3: MaçGücü    (EfektifGüç × ev avantajı ± motivasyon × şans)
// TÜM katsayılar config TUNING'den okunur — hardcode yok. engines/ DOM'a dokunmaz.

import { TUNING } from '../config.js';
import { rand } from '../core/rng.js';
import { POSITIONS, idealXI, benchBest, isAvailable } from '../models/squad.js';

// — saf matematik yardımcıları (katsayı değil) —
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const sum = (a) => a.reduce((s, x) => s + x, 0);
const avg = (a) => (a.length ? sum(a) / a.length : 0);
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);

// ═══════════════════════ KATMAN 1 — TemelGüç ═══════════════════════

// Denge çarpanı: hatlar arası uçurum güçü kırpar (Bible-5.1).
export function dengeCarpani(mevkiOrt, enZayif) {
  return clamp(1 - (mevkiOrt - enZayif) / TUNING.POWER.BALANCE_DIV, TUNING.BALANCE_MIN, 1.0);
}

// Yıldız bonusu: en iyi 3 yıldızın eşik üstü katkısı (Bible-5.1).
export function yildizBonus(squad) {
  const { STAR_THRESHOLD, STAR_BONUS_MAX } = TUNING;
  const pt = TUNING.POWER.STAR_BONUS_PT;
  const stars = squad
    .filter((p) => p.overall >= STAR_THRESHOLD)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 3);
  return clamp(sum(stars.map((s) => (s.overall - STAR_THRESHOLD) * pt)), 0, STAR_BONUS_MAX);
}

// Hat ortalamaları (tek kaynak): kadroKalitesi ve atakSavunma AYNI seçimi kullanır
// (sakat+cezalı filtreli, mevki başına ideal-XI kadar en iyi oyuncu).
export function hatOrtalamalari(squad) {
  const { IDEAL_XI, MISSING_LINE } = TUNING.POWER;
  const hatOrt = {};
  for (const pos of POSITIONS) {
    const best = squad
      .filter((x) => x.pos === pos && x.injuryWeeks === 0 && x.suspensionWeeks === 0)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, IDEAL_XI[pos]);
    hatOrt[pos] = best.length ? avg(best.map((x) => x.overall)) : MISSING_LINE;
  }
  return hatOrt;
}

// KadroKalitesi (Bible-5.1). Hat seçimi injury+suspension filtreler (milli görev HARİÇ değil).
export function kadroKalitesi(squad) {
  const W = TUNING.POS_W;
  const hatOrt = hatOrtalamalari(squad);
  const mevkiOrt = W.GK * hatOrt.GK + W.DEF * hatOrt.DEF + W.MID * hatOrt.MID + W.FWD * hatOrt.FWD;
  const enZayif = Math.min(hatOrt.GK, hatOrt.DEF, hatOrt.MID, hatOrt.FWD);
  return clamp(mevkiOrt * dengeCarpani(mevkiOrt, enZayif) + yildizBonus(squad), 0, 100);
}

// ── KADRO YÖNÜ (hücum/savunma ayrışması) ──
// atakHat = MID+FWD (POS_W oranlı) · savunmaHat = GK+DEF (POS_W oranlı).
// tilt = 1 + (atak − savunma) × MATCH.YON.K, BANT'a kırpılır (abartı freni).
// Maçta: attığın xG × tilt, yediğin xG × tilt → savunma kadrosu az yer/az atar (kapalı maç),
// hücum kadrosu çok atar/biraz açık verir. xG PAYLAŞIMI değişmez → kazanma oranı bantları oynamaz.
// Dengeli kadroda (atak≈savunma) tilt≈1 → eski davranış. Determinist — rand YOK.
export function atakSavunma(squad) {
  const W = TUNING.POS_W, Y = TUNING.YON;
  const h = hatOrtalamalari(squad);
  const savW = W.GK + W.DEF, atkW = W.MID + W.FWD;
  const savunma = (W.GK * h.GK + W.DEF * h.DEF) / savW;
  const atak = (W.MID * h.MID + W.FWD * h.FWD) / atkW;
  const tilt = clamp(1 + (atak - savunma) * Y.K, Y.BANT[0], Y.BANT[1]);
  return { atak, savunma, tilt };
}

// TeknikEkip skoru (Bible-5.1). coach: {taktik, oyuncuYonetimi, otorite, yardimciEkip} 0-100.
export function teknikEkip(coach) {
  const W = TUNING.POWER.W_TEKNIK;
  return W.taktik * coach.taktik + W.oyuncuYonetimi * coach.oyuncuYonetimi
    + W.otorite * coach.otorite + W.yardimciEkip * coach.yardimciEkip;
}

// KimyaTecrube (Bible-5.1). {kimya, bigMatchExp, kaptanVar}
export function kimyaTecrube({ kimya = 0, bigMatchExp = 0, kaptanVar = false } = {}) {
  const W = TUNING.POWER.W_KIMYA;
  const { KAPTAN_VAR, KAPTAN_YOK } = TUNING.POWER;
  return W.kimya * kimya + W.bigExp * bigMatchExp + W.kaptan * (kaptanVar ? KAPTAN_VAR : KAPTAN_YOK);
}

// TaktikUyum (Bible-5.1). min(100, uyumHafta×TAKTIK_WEEK) × rolUygunlugu
export function taktikUyum({ uyumHafta = 0, rolUygunlugu = 1.0 } = {}) {
  const [lo, hi] = TUNING.POWER.ROL_UYGUNLUK;
  const rol = clamp(rolUygunlugu, lo, hi);
  return Math.min(100, uyumHafta * TUNING.TAKTIK_WEEK) * rol;
}

// TesisTabani (Bible-5.1). 50 + (antrenman-5)×5 + (tibbi-5)×3
export function tesisTabani({ antrenman = 0, tibbi = 0 } = {}) {
  const P = TUNING.POWER;
  return clamp(P.TESIS_BASE + (antrenman - P.FAC_REF) * P.TESIS_ANTRENMAN + (tibbi - P.FAC_REF) * P.TESIS_TIBBI, 0, 100);
}

// Derinlik (Bible-5.1). (kadroSayısı-18)×6 + yedekOrt/2
export function derinlik(squad) {
  const P = TUNING.POWER;
  const yedek = benchBest(squad);
  const yedekOrt = avg(yedek.map((p) => p.overall));
  return clamp((squad.length - P.DERINLIK_BASE) * P.DERINLIK_PER + yedekOrt / P.YEDEK_DIV, 0, 100);
}

// Altyapi (Bible-5.1). akademi×10
export function altyapi(akademi = 0) {
  return clamp(akademi * TUNING.POWER.ALTYAPI_MULT, 0, 100);
}

// TemelGüç ağırlıklı toplam (Bible-5.1). ctx: {squad, coach, kimya, taktik, facilities}
export function temelGuc(ctx) {
  const W = TUNING.W_TEMEL;
  const f = ctx.facilities || {};
  return clamp(
    W.kadro * kadroKalitesi(ctx.squad)
    + W.teknik * teknikEkip(ctx.coach)
    + W.kimya * kimyaTecrube(ctx.kimya)
    + W.taktik * taktikUyum(ctx.taktik)
    + W.tesis * tesisTabani(f)
    + W.derinlik * derinlik(ctx.squad)
    + W.altyapi * altyapi(f.akademi),
    0, 100,
  );
}

// TEMEL GÜÇ KIRILIMI (kullanıcı bulgusu 2026-07-21: "kadromu 80'lere taşıdım, hâlâ 10.'yum —
// neden?"): her bileşenin HAM değeri + ağırlığı — UI "gücünü ne tutuyor" cevabını buradan verir.
// temelGuc ile AYNI hesap (tek kaynak); değişirse ikisi birlikte değişmeli.
export function temelBilesenler(ctx) {
  const W = TUNING.W_TEMEL;
  const f = ctx.facilities || {};
  return [
    { k: 'kadro', ad: 'Kadro', w: W.kadro, v: kadroKalitesi(ctx.squad) },
    { k: 'teknik', ad: 'Teknik ekip', w: W.teknik, v: teknikEkip(ctx.coach) },
    { k: 'kimya', ad: 'Kimya', w: W.kimya, v: kimyaTecrube(ctx.kimya) },
    { k: 'taktik', ad: 'Taktik uyum', w: W.taktik, v: taktikUyum(ctx.taktik) },
    { k: 'tesis', ad: 'Tesisler', w: W.tesis, v: tesisTabani(f) },
    { k: 'derinlik', ad: 'Derinlik', w: W.derinlik, v: derinlik(ctx.squad) },
    { k: 'altyapi', ad: 'Altyapı', w: W.altyapi, v: altyapi(f.akademi) },
  ];
}

// ═══════════════════════ KATMAN 2 — EfektifGüç ═══════════════════════

// Uygunluk saf çekirdeği (Bible-5.2). tibbi düzeltmesi clamp DIŞINDA eklenir
// (efektifCombine tekrar clamp'ler — Bible ile birebir).
export function uygunlukFromSums(tamKadro, mevcut, tibbi) {
  const [lo, hi] = TUNING.CLAMP.uygunluk;
  const P = TUNING.POWER;
  const base = clamp(mevcut / Math.max(tamKadro, 1), lo, hi);
  return base + (tibbi - P.FAC_REF) * P.UYGUNLUK_TIBBI;
}

// idealXI'dan uygunluk: tamKadro = tüm ideal XI, mevcut = uygun olanlar.
export function computeUygunluk(squad, tibbi) {
  const xi = idealXI(squad);
  const tam = sum(xi.map((p) => p.overall));
  const mevcut = sum(xi.filter(isAvailable).map((p) => p.overall));
  return uygunlukFromSums(tam, mevcut, tibbi);
}

function multFromRef(value, ref, div, clampKey) {
  const [lo, hi] = TUNING.CLAMP[clampKey]; // base = clamp min (Bible-5.2)
  return clamp(lo + (value - ref) / div, lo, hi);
}
export function moralMult(avgMorale) {
  return multFromRef(avgMorale, TUNING.POWER.MORAL_REF, TUNING.POWER.MORAL_DIV, 'moral');
}
export function formMult(avgForm) {
  return multFromRef(avgForm, TUNING.POWER.FORM_REF, TUNING.POWER.FORM_DIV, 'form');
}
export function kondMult(avgFitness) {
  return multFromRef(avgFitness, TUNING.POWER.KOND_REF, TUNING.POWER.KOND_DIV, 'kond');
}

// EfektifGüç birleştirici (Bible-5.2). Test vektörü buradan doğrulanır (Bible-22).
export function efektifCombine(temel, uygunluk, moral, form, kond) {
  const [lo, hi] = TUNING.CLAMP.uygunluk;
  return clamp(temel * clamp(uygunluk, lo, hi) * moral * form * kond, 0, TUNING.POWER.EFEKTIF_MAX);
}

// EfektifGüç tam hesap (Bible-5.2). ctx §temelGuc + facilities.tibbi
export function efektifGuc(ctx) {
  const temel = temelGuc(ctx);
  const xi = idealXI(ctx.squad);
  const uyg = computeUygunluk(ctx.squad, (ctx.facilities || {}).tibbi ?? TUNING.POWER.FAC_REF);
  const m = moralMult(avg(xi.map((p) => p.morale)));
  const f = formMult(avg(xi.map((p) => p.form)));
  const k = kondMult(avg(xi.map((p) => p.fitness)));
  return efektifCombine(temel, uyg, m, f, k);
}

// ═══════════════════════ KATMAN 3 — MaçGücü ═══════════════════════

// MaçGücü (Bible-5.3). opts: {isHome, stadyum, taraftar, isDerby, relegationBattle, isUnderdog, luck}
// luck verilmezse rand(LUCK) — test için enjekte edilebilir (deterministik).
export function macGucu(efektif, opts = {}) {
  const P = TUNING.POWER;
  let mg = efektif;
  if (opts.isHome) {
    // İÇ SAHA = GERÇEK KOZ (2026-07-23, kullanıcı: "iç saha avantajı önemli bir koz olmalı DOLULUK
    // ORANIYLA birlikte"). Eskiden avantaj yalnız stadyum SEVİYESİ + taraftar GÖSTERGESİ gibi vekil
    // verilerden geliyordu ve %3–8'de kalıyordu (neredeyse görünmez). Artık varsa GERÇEK DOLULUK
    // kullanılır: dolu tribün = ev kalesi. Bilet fiyatı böylece SPORTİF bir karara dönüşür —
    // ucuz bilet → dolu stat → sahada avantaj. Küçük kulübün stadı küçüktür ama DOLDURABİLİR.
    let q;
    if (TUNING.DOLULUK_EV && opts.doluluk != null && Number.isFinite(opts.doluluk)) {
      const dMin = TUNING.ATTEND?.min ?? 0.30;                       // taban doluluk → q=0
      q = clamp((opts.doluluk - dMin) / Math.max(1e-6, 1 - dMin), 0, 1);
    } else {
      // doluluk yoksa (AI kulüp / eski çağrı) eski vekil hesap — NaN bekçisi korunur (QA §6)
      const stad = opts.stadyum ?? P.STAD_LEVEL_MAX / 2;
      const trf = opts.taraftar ?? P.TARAFTAR_MAX / 2;
      q = (stad / P.STAD_LEVEL_MAX) * P.STAD_Q_W + (trf / P.TARAFTAR_MAX) * P.STAD_Q_W;
    }
    mg *= 1 + lerp(TUNING.HOME_ADV[0], TUNING.HOME_ADV[1], q);
  }
  const motiv = opts.isDerby || opts.relegationBattle ? TUNING.MOTIV_UNDERDOG : 0;
  mg *= 1 + (opts.isUnderdog ? motiv : 0);
  const luck = opts.luck ?? rand(TUNING.LUCK[0], TUNING.LUCK[1]);
  return mg * luck;
}
