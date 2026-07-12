// src/engines/world.js — Karakter katmanı (v4-§2): kurul üyeleri, taraftar grupları, gazeteciler.
// Kural (v4-§2): oyunda konuşan herkes KALICI, İSİMLİ, HAFIZALI karakterdir.

import { TUNING } from '../config.js';
import { rand, randint } from '../core/rng.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ── Kurul (v4-§2.1): 5 üye, arketip + loyalty + weight; guven hedefi ağırlıklı ortalama ──
export function initBoard(boardData) {
  const arche = (boardData && boardData.archetypes) || [];
  return arche.slice(0, 5).map((a) => ({
    name: a.names[randint(0, a.names.length - 1)],
    archetype: a.archetype,
    concern: a.concern,
    weight: a.weight,
    loyalty: randint(52, 64),
  }));
}

// Üyenin derdine karşılık gelen sürücü değeri (0-100).
function driverOf(m, G) {
  switch (m.archetype) {
    case 'Hesap Adamı': return G.gauges.mali;
    case 'Eski Futbolcu': return G.gauges.sportif;
    case 'Politikacı': return clamp(G.gauges.taraftar + (G.mediaTone || 0) * 8, 0, 100);
    case 'Sponsor Kralı': return clamp((G.gauges.itibar + G.gauges.mali) / 2, 0, 100);
    case 'Nostaljik': return clamp(G.kimya ? G.kimya.kimya : 50, 0, 100);
    default: return 50;
  }
}

// Haftalık: her üyenin loyalty'si kendi derdine doğru sürüklenir. guven hedefi = Σ(loyalty×weight).
export function updateBoard(G) {
  if (!G.board || !G.board.length) return null;
  const D = TUNING.DELUXE.BOARD.LOYALTY_DRIFT;
  let sum = 0, wsum = 0;
  for (const m of G.board) {
    m.loyalty = clamp(m.loyalty + (driverOf(m, G) - m.loyalty) * D, 0, 100);
    sum += m.loyalty * m.weight; wsum += m.weight;
  }
  return sum / Math.max(wsum, 0.001); // ağırlıklı kurul ortalaması → guven hedefi
}

// Belirli arketipin loyalty'sine olay etkisi (TD kovma → Nostaljik −15 vb.)
export function nudgeBoard(G, archetype, delta) {
  const m = (G.board || []).find((x) => x.archetype === archetype);
  if (m) m.loyalty = clamp(m.loyalty + delta, 0, 100);
}

// Kurul sunumu taahhüt seçenekleri (v3-A9): seçilen üye +, karşıt üye −.
export const SUNUM_OPTIONS = [
  { key: 'mali', label: 'Mali disiplin sözü', plus: 'Hesap Adamı', minus: 'Politikacı' },
  { key: 'sportif', label: 'Sportif yatırım sözü', plus: 'Eski Futbolcu', minus: 'Hesap Adamı' },
  { key: 'taraftar', label: 'Taraftar barışı sözü', plus: 'Politikacı', minus: 'Sponsor Kralı' },
];
export function applySunum(G, key) {
  const opt = SUNUM_OPTIONS.find((o) => o.key === key);
  if (!opt) return false;
  const B = TUNING.DELUXE.BOARD;
  nudgeBoard(G, opt.plus, B.TAAHHUT_PLUS);
  nudgeBoard(G, opt.minus, -B.TAAHHUT_MINUS);
  return true;
}

// ── B1a: DİNAMİK KURUL GÜNDEMİ — sunum son olaylardan kurulur (münazara motorunun kurul versiyonu) ──
// Döner: [{key, title, comp(0-100 karne), uye(ilgili arketip)}] — en fazla 3 madde.
export function buildBoardAgenda(G) {
  const M = TUNING.MEGA.KURUL;
  const wk = (G.globalWeek || 0);
  const son = (G.defter || []).filter((a) => a.sezon === G.worldSeason && wk - ((a.hafta || 0) + (G.globalWeek - (G.meta ? G.meta.week : 0))) <= M.LOOKBACK);
  const items = [];
  // 1) Tartışmalı transfer: son haftalarda dev imza ya da yıldız satışı
  const tr = (G.defter || []).slice(-8).find((a) => /Dev imza|Yıldız satışı/.test(a.t));
  if (tr) items.push({ key: 'transfer', title: `Tartışmalı hamle: ${tr.t}`, comp: clamp(G.gauges.mali, 0, 100), uye: 'Hesap Adamı' });
  // 2) Riskte/kırık vaat hesabı
  const riskte = (G.promises || []).find((p) => p.kept === false || (p.kept === null && !p.milestone));
  if (riskte) items.push({ key: 'vaat', title: 'Vaat hesabı: söz nerede?', comp: clamp((G.sozTutmaBirikim || 0) * 10 + 40, 0, 100), uye: 'Politikacı' });
  // 3) Taraftar huzursuzluğu
  if (G.gauges.taraftar < 45) items.push({ key: 'taraftar', title: 'Tribün huzursuz: kopuş mu var?', comp: clamp(G.gauges.taraftar, 0, 100), uye: 'Politikacı' });
  // 4) Borç trendi
  const bh = G.borcHistory || [];
  if (bh.length >= 2 && bh[bh.length - 1] > bh[bh.length - 2] * 1.2 && bh[bh.length - 1] > 20) {
    items.push({ key: 'borc', title: `Borç trendi: ${bh[bh.length - 2]}→${bh[bh.length - 1]}mn`, comp: clamp(G.gauges.mali, 0, 100), uye: 'Hesap Adamı' });
  }
  // 5) İhale sızıntısı (tanıdık firma — tender geçmişinden)
  if (G.tenderLeak) items.push({ key: 'ihale', title: 'İhale sızıntısı: tanıdık firma iddiası', comp: clamp(G.gauges.itibar, 0, 100), uye: 'Sponsor Kralı' });
  // 6) B2c: koreografi harcamaları (sezonda 3+ destek → Hesap Adamı gündeme taşır)
  if ((G.koreoCount || 0) >= TUNING.MEGA.KOREO.HESAP_ESIK) items.push({ key: 'koreo', title: 'Tribüne bütçe mi ayırıyoruz? (koreografi kalemleri)', comp: clamp(G.gauges.mali, 0, 100), uye: 'Hesap Adamı' });
  void son;
  return items.slice(0, 3);
}
// Gündem maddesine tonlu cevap → ilgili üyenin loyalty'si (münazara puanlama deseni)
export function scoreAgendaAnswer(G, item, ton) {
  const M = TUNING.MEGA.KURUL;
  let delta = 0, guven = 0;
  if (ton === 'veri') delta = item.comp >= 55 ? M.VERI_OK : M.VERI_MISS;   // veriyle savun: karne sağlamsa işler
  else if (ton === 'vizyon') delta = M.VIZYON;                              // güvenli küçük
  else { delta = M.KABUL_LOYALTY; guven = M.KABUL_GUVEN; }                  // kabullen-özür: dürüstlük küçük güven
  nudgeBoard(G, item.uye, delta);
  if (guven) G.gauges.guven = clamp(G.gauges.guven + guven, 0, 100);
  return { delta, uye: item.uye };
}
// Kurul ortalama loyalty → bütçe esnekliği çarpanı (transfer tavanı ±%15)
export function boardBudgetMult(G) {
  const M = TUNING.MEGA.KURUL;
  const b = G.board || [];
  if (!b.length) return 1;
  const avg = b.reduce((s, m) => s + m.loyalty, 0) / b.length;
  return avg >= M.BUDGET_HI ? 1 + M.BUDGET_SWING : avg < M.BUDGET_LO ? 1 - M.BUDGET_SWING : 1;
}

// ── Taraftar grupları (v4-§2.3): radikal + ılımlı, isimli, memnuniyetli ──
export function initFanGroups() {
  return [
    { name: 'Kapalı Kale', radikal: true, memnuniyet: 60 },
    { name: 'Doğu Tribünü', radikal: false, memnuniyet: 60 },
  ];
}
export function updateFanGroups(G) {
  for (const g of G.fanGroups || []) {
    // radikal: sonuç + bilet fiyatına duyarlı; ılımlı: mali disiplin + tesise duyarlı
    const hedef = g.radikal
      ? clamp(G.gauges.taraftar - (G.economy.ticketPrice - 1) * 30, 0, 100)
      : clamp((G.gauges.mali + G.gauges.taraftar) / 2, 0, 100);
    g.memnuniyet = clamp(g.memnuniyet + (hedef - g.memnuniyet) * 0.15, 0, 100);
  }
}
export const radikalGrup = (G) => (G.fanGroups || []).find((g) => g.radikal);

// ── Gazeteciler (v4-§2.4): manşet imzası tona göre seçilir ──
export function journalistFor(media, tone) {
  const js = (media && media.journalists) || [];
  if (!js.length) return null;
  if (tone > 0) return js.find((j) => j.stance === 'yandaş') || js[0];
  if (tone < 0) return js.find((j) => j.stance === 'muhalif') || js[0];
  return js.find((j) => j.stance === 'analist') || js[0];
}
export function muhalif(media) {
  return ((media && media.journalists) || []).find((j) => j.stance === 'muhalif') || null;
}
