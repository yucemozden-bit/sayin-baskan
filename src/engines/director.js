// src/engines/director.js — DRAMA YÖNETMENİ (Yaşayan Koltuk §1)
// Görevleri: tick gerilim skoru · sezon hikaye tohumu · sıkıcı-hafta yasağı ·
// telefon sıklık kapısı · masa dokunuşu seçimi · kritik son-10dk tetiği.
// İlke: her kesinti GERÇEK state'ten doğar; spam yasak.

import { TUNING } from '../config.js';
import { rand, randint } from '../core/rng.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ── Tick gerilim skoru (0-100) ──
export function tensionScore(G, { isDerby = false, oppRank = 9 } = {}) {
  let t = 0;
  const pos = G.myPos || 9;
  if (isDerby) t += 25;
  if (pos >= 15) t += 20;                                        // küme hattı
  if (pos <= 3) t += 15;                                         // zirve
  if (Math.abs(pos - oppRank) <= 2) t += 10;                     // doğrudan rakip
  const rec = G.recent || [];
  const last3 = rec.slice(-3);
  if (last3.length === 3 && last3.every((x) => x === 3)) t += 15; // 3+ galibiyet serisi
  if (last3.length === 3 && last3.every((x) => x === 0)) t += 20; // 3+ mağlubiyet
  for (const k of ['guven', 'taraftar', 'mali']) if (G.gauges[k] < 30) t += 10; // gauge kritik
  if (G.meta.season === TUNING.SEASONS_PER_TERM) t += 10;        // seçim sezonu
  if (G.meta.week >= 30) t += 10;                                // sezon finali
  if (G.transferWindow) t += 5;
  return clamp(t, 0, 100);
}

// ── Hikaye tohumu (sezon başı 1 ana gerilim hattı) ──
export const STORY_ARCS = {
  mali_kriz: { label: 'Mali Kriz Yayı', ozet: 'Bu sezonun hikayesi kasadaki delikti — her karar borcun gölgesinde alındı.' },
  jenerasyon: { label: 'Jenerasyon Yayı', ozet: 'Bu sezonun hikayesi eskiyen kadroydu — bir devir kapanırken yenisi arandı.' },
  yildiz_veda: { label: 'Kalır mı Gider mi Yayı', ozet: 'Bu sezonun hikayesi yıldızın sözleşmesiydi — her hafta aynı soru soruldu.' },
  yukselis: { label: 'Yükseliş Yayı', ozet: 'Bu sezonun hikayesi büyüme iştahıydı — kulüp sınırlarını zorladı.' },
};
export function pickStorySeed(G) {
  const yasOrt = G.squad.reduce((s, p) => s + p.age, 0) / Math.max(G.squad.length, 1);
  const star = G.squad.find((p) => p.overall >= TUNING.STAR_THRESHOLD && p.contractYears <= 1);
  let key = 'yukselis';
  if (G.economy.borc > G.club.kadroDeger * 0.35) key = 'mali_kriz';
  else if (yasOrt >= 27.5) key = 'jenerasyon';
  else if (star) key = 'yildiz_veda';
  return { key, ...STORY_ARCS[key], starName: star ? star.name : null };
}
// Hikaye hattına uyan olay id'leri (+ağırlık)
export const ARC_EVENTS = {
  mali_kriz: ['doviz-soku', 'maas-gecikmesi', 'bagis-kampanyasi', 'sponsor-firsati'],
  jenerasyon: ['genc-patladi', 'scout-cevher', 'genc-ab-kanca'],
  yildiz_veda: ['yildiza-dev-teklif', 'td-yildiz-soguk', 'gece-hayati'],
  yukselis: ['sponsor-firsati', 'dizi-cekim', 'belediye-arsa'],
};

// ── Sıkıcı hafta yasağı: son 2 tick interaktif an yoksa state'ten uygun an öner ──
// Döner: {kind, ...} enjeksiyon tarifi ya da null.
export function boringGuard(G) {
  const last = G.lastInteractive ?? -99;
  if ((G.globalWeek || 0) - last < 2) return null;
  const mutsuz = G.squad.find((p) => p.morale < 45);
  if (mutsuz) return { kind: 'gorusme', player: mutsuz.name };
  if (G.economy.borc > 50) return { kind: 'cfoToplanti' };
  const rec = (G.recent || []).slice(-2);
  if (rec.length === 2 && rec.every((x) => x === 3)) return { kind: 'medyaTeklif' };
  return { kind: 'medyaTeklif' }; // en nötr dolgu: demeç fırsatı
}

// ── Telefon sıklık kapısı: sezonda 6-10 (yönetmen bütçesi) ──
export function phoneAllowed(G, tension) {
  const count = G.phoneCount || 0;
  // Gelecek deadline günleri için REZERV (her pencere ~3 arama) — sezon tavanı 10 asla delinmez
  const dls = (TUNING.TRANSFER.WINDOWS || []).map((s) => s + TUNING.APPROVAL.WINDOW_SPAN - 1);
  const reserve = dls.filter((d) => (G.meta.week || 1) <= d).length * 3;
  if (count >= 10 - reserve) return false;                        // sezon tavanı (rezervli)
  const kalanHafta = Math.max(1, TUNING.SEASON_WEEKS - (G.meta.week || 1));
  const hedefKalan = Math.max(0, 6 - count);                      // tabana yetişme baskısı
  const p = clamp(0.10 + tension / 400 + hedefKalan / kalanHafta * 0.5, 0.05, 0.85);
  return rand(0, 1) < p;
}

// ── Masa dokunuşu seçimi (üst üste aynı gelmez) ──
export const DESK_CARDS = {
  antrenman: { label: 'Antrenman ziyareti', desc: 'Sahaya in, eli sık — moral mikro artar.' },
  dernek: { label: 'Taraftar derneği ziyareti', desc: 'Bir çay iç — tribünle bağ tazelenir.' },
  sponsor: { label: 'Sponsor yemeği', desc: 'Masada güven ver — ticari ilişki ısınır.' },
  genc: { label: 'Gençleri izle', desc: 'Altyapı maçına git — scout sisi mikro daralır.' },
};
export function pickDeskCard(G) {
  const keys = Object.keys(DESK_CARDS).filter((k) => k !== G.lastDesk);
  return keys[randint(0, keys.length - 1)];
}

// ── Kritik son-10dk tetiği (yalnız kritik maç + anlamlı skor durumu) ──
export function lateTrigger(G, { isDerby, diff }) {
  const critical = isDerby || (G.myPos || 9) >= 15 || (G.myPos || 9) <= 3 || G.meta.week >= TUNING.CRITICAL.LATE_WEEK;
  if (!critical) return null;
  if (diff < 0) return 'kaybediyor';   // "her şeyi öne dök" fırsatı
  if (diff === 0) return 'berabere';   // "koru" fırsatı
  return null;
}
