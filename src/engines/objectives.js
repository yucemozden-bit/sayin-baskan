// src/engines/objectives.js — HEDEF MOTORU (retention): oyuncuyu ileri çeken
// "sıradaki hamle" listesi. Spor + ekonomi + akademi + seçim + gösterge kriz +
// yaklaşan başarım. Saf hesap (DOM'suz); UI cockpit/clubView'da tüketilir.
import { standings } from './league.js';
import { promiseStatus } from '../actions.js';
import { TUNING } from '../config.js';

const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Kulübün ligdeki güncel sırası (maç oynanmadıysa güce göre tahmin — kokpit tablosuyla tutarlı).
function currentRank(G) {
  if (G.myPos) return G.myPos;
  try {
    let rows = standings(G.league);
    if (rows.every((t) => t.P === 0)) rows = rows.slice().sort((a, b) => b.strength - a.strength).map((t, i) => ({ ...t, rank: i + 1, id: t.id }));
    const me = rows.find((t) => t.id === 'ME');
    return me ? me.rank : 10;
  } catch { return 10; }
}

// Dönem içi son sezon mu? (kongre seçimi dönem sonunda) — yaklaşan seçim hedefi için.
function seasonInTerm(G) { return ((G.career && G.career.seasons) || 0) % (G.SEASONS_PER_TERM || 3); }

// Tek hamlelik hedef listesi. Döner: [{ id, icon, text, pct, kind, oncelik }]
// oncelik: kriz(0) > seçim(1) > vaat(2) > spor(3) > rozet(4). pct: 0..1 tamamlanma.
export function nextObjectives(G) {
  const out = [];
  const g = G.gauges || {};
  const eco = G.economy || {};
  const rank = currentRank(G);
  const hedef = (G.club && G.club.hedefSira) || 10;
  const wk = (G.meta && G.meta.week) || 1;
  const SW = G.SEASON_WEEKS || 34;

  // ── 0) GÖSTERGE KRİZİ — en acil pull (yangın söndür) ──
  const KRIT = { guven: 20, taraftar: 25, mali: 20, sportif: 25, itibar: 25 };
  const AD = { guven: 'Güven', taraftar: 'Taraftar', mali: 'Mali', sportif: 'Sportif', itibar: 'İtibar' };
  for (const k of Object.keys(KRIT)) {
    const v = g[k]; if (v == null) continue;
    if (v < KRIT[k] + 10) {
      const acil = v < KRIT[k];
      out.push({ id: 'kriz-' + k, icon: acil ? '🚨' : '⚠️', kind: 'kriz', oncelik: 0,
        text: `${AD[k]} ${acil ? 'KRİTİK' : 'düşük'} (${Math.round(v)}) — ${acil ? 'hemen topla' : 'dikkat'}`,
        pct: clamp01((v - (KRIT[k] - 10)) / 20) });
    }
  }

  // ── 1) YAKLAŞAN SEÇİM — dönem sonu (son sezon) ──
  if (seasonInTerm(G) === (G.SEASONS_PER_TERM || 3) - 1) {
    const kalanHafta = Math.max(0, SW - wk);
    const guven = g.guven ?? 50;
    const esikAlti = guven < 55;
    out.push({ id: 'secim', icon: '🗳️', kind: 'secim', oncelik: 1,
      text: esikAlti ? `Kongre seçimi yaklaşıyor — güven %55 altında (${Math.round(guven)}), yükselt!`
        : `Kongre seçimi ~${kalanHafta} hafta — koltuk sağlam görünüyor (güven ${Math.round(guven)})`,
      pct: clamp01(guven / 70) });
  }

  // ── 2) VAATLER — çekirdek söz döngüsü (promiseStatus türetir: 10/55/90/100/0) ──
  let vaatlar = [];
  try { vaatlar = promiseStatus(G); } catch {}
  const erken = wk <= 6;
  for (const v of vaatlar) {
    if (v.pct === 100 || v.pct === 0) continue;             // sonuçlanmış vaat hedef değil
    const baslangic = erken && v.pct === 10;                 // ilk haftalar "başlangıç" nötr
    const pct = clamp01(v.pct / 100);
    out.push({ id: 'vaat-' + v.id, icon: '📜', kind: 'vaat', oncelik: baslangic ? 3.5 : 2,
      text: `Vaat: ${v.name} — ${baslangic ? 'yolun başında' : v.pct >= 90 ? 'koşul sağlanıyor ✓' : v.pct >= 55 ? 'ara adım atıldı' : 'adım bekliyor ⚠'}`, pct });
  }

  // ── 3) SPORTİF — 2. lig terfi / hedef sıra / Avrupa / küme / zirve ──
  const lig = G.lig || 1;
  const pt = TUNING.LEAGUE.PROMOTION_TO;
  if (lig === 2) {
    out.push({ id: 'terfi', icon: '⬆️', kind: 'spor', oncelik: rank <= pt ? 1.5 : 1,
      text: rank <= pt ? `2. Lig — terfi hattındasın (${rank}.), ilk ${pt} yeter!` : `2. Lig — terfiye ${rank - pt} sıra (şu an ${rank}.), ilk ${pt}'e gir!`,
      pct: clamp01(pt / rank) });
  } else if (rank >= 16) {
    out.push({ id: 'kume', icon: '🆘', kind: 'spor', oncelik: 1, text: `Küme hattındasın (${rank}.) — çıkış şart, yoksa 2. lig!`, pct: clamp01((18 - rank) / 3) });
  } else if (rank > hedef) {
    out.push({ id: 'hedef', icon: '🎯', kind: 'spor', oncelik: 3, text: `Hedef ${hedef}. sıra — şu an ${rank}., ${rank - hedef} basamak yukarı`, pct: clamp01(hedef / rank) });
  } else if (rank <= hedef && rank > 4) {
    out.push({ id: 'avrupa', icon: '🇪🇺', kind: 'spor', oncelik: 3, text: `Avrupa hattına ${rank - 4} sıra (şu an ${rank}.)`, pct: clamp01(4 / rank) });
  } else if (rank <= 4 && rank > 1) {
    out.push({ id: 'zirve', icon: '👑', kind: 'spor', oncelik: 3, text: `Zirveye ${rank - 1} sıra — şampiyonluğa oyna!`, pct: clamp01(1 / rank) });
  } else if (rank === 1) {
    out.push({ id: 'zirvekoru', icon: '👑', kind: 'spor', oncelik: 3, text: 'Liderlik sende — zirveyi koru!', pct: 0.9 });
  }

  // ── 4) YAKLAŞAN ROZETLER — completionist pull (yalnız yaklaşınca) ──
  const rozet = [];
  if (eco.borc > 0 && eco.borc <= 30) rozet.push({ id: 'r-borcsuz', icon: '💳', text: `Borçsuz Kulüp rozetine ${Math.round(eco.borc)}mn`, pct: clamp01(1 - eco.borc / 30) });
  if (eco.kasa >= 65 && eco.kasa < 100) rozet.push({ id: 'r-nakit', icon: '💰', text: `Nakit Kalesi rozetine ${Math.round(100 - eco.kasa)}mn`, pct: clamp01(eco.kasa / 100) });
  const akad = (G.facilities || {}).akademi || 0;
  if (akad >= 7 && akad < 10) rozet.push({ id: 'r-fabrika', icon: '🏭', text: `Fabrika rozetine ${10 - akad} akademi kademesi`, pct: clamp01(akad / 10) });
  const akXI = (G.squad || []).filter((p) => p.academyGraduate && p.inXI).length;
  if (akXI >= 3 && akXI < 5) rozet.push({ id: 'r-ocak', icon: '🌱', text: `Ocaktan Yetişme rozetine ${5 - akXI} ilk-11 ocaklı`, pct: clamp01(akXI / 5) });
  for (const r of rozet) out.push({ ...r, kind: 'rozet', oncelik: 4 });

  // Önceliğe, sonra yakınlığa göre sırala (en acil + en yakın önce)
  out.sort((a, b) => a.oncelik - b.oncelik || (b.pct || 0) - (a.pct || 0));
  return out;
}

// DEVAM butonu altı: tek satırlık en güçlü pull (kriz > seçim > yakın rozet > spor > vaat).
export function topNudge(G) {
  const list = nextObjectives(G);
  if (!list.length) return null;
  // Yakın rozet (pct yüksek) varsa onu öne al — "az kaldı" hissi en çok çeker
  const yakinRozet = list.find((o) => o.kind === 'rozet' && (o.pct || 0) >= 0.6);
  const pick = list.find((o) => o.kind === 'kriz') || yakinRozet || list[0];
  return { icon: pick.icon, text: pick.text, kind: pick.kind };
}
