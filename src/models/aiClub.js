// src/models/aiClub.js — Canlı lig: 17 AI kulüp hafif başkan simülasyonu (v5-§2)
// Her kulüp: baskanTipi + istikrar + sezonluk kural kararı + kriz + 3 sezonda bir seçim.
// Maliyet: kulüp başına birkaç sayı; etki: lig 10 sezonda gerçekten evrilir.

import { TUNING } from '../config.js';
import { rand, randint } from '../core/rng.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const AI_TYPES = ['POPULIST', 'MUHASEBECI', 'INSAATCI', 'AVCI', 'DEV'];
const TYPE_TR = { POPULIST: 'popülist', MUHASEBECI: 'muhasebeci', INSAATCI: 'inşaatçı', AVCI: 'avcı', DEV: 'dev' };

// Kuruluş: rakiplere başkan tipi ata (en güçlü 2'si DEV eğilimli — şampiyonluk baskısı kaynağı).
export function initAIClubs(opponents) {
  return opponents.map((o, i) => ({
    ...o,
    baskanTipi: i < 2 ? 'DEV' : AI_TYPES[randint(0, 4)],
    istikrar: randint(45, 75),
    tipYasi: 0,        // bu başkan tipiyle geçen sezon
    seasonCount: 0,    // AI seçim sayacı
    tdShock: 0,        // TD kovma geçici güç düşüşü (hafta sayacı)
  }));
}

// Sezon başı AI kararları (v5-§2 kural seti). opponents MUTASYONA uğrar; haber listesi döner.
// Kriz çıktısı: {club, star:true} — kriz kulübünün yıldızı SANA fırsat dosyası olur.
export function aiSeasonStart(opponents) {
  const A = TUNING.DELUXE.AI;
  const news = []; const crises = [];
  for (const o of opponents) {
    o.tipYasi++; o.seasonCount++;
    switch (o.baskanTipi) {
      case 'POPULIST':
        if (o.tipYasi >= A.CRISIS_AFTER && rand(0, 1) < A.CRISIS_P) { // "2 sezon sonra %40 çöküş"
          o.strength = clamp(o.strength - A.CRISIS_DROP, 30, 92);
          o.istikrar = clamp(o.istikrar - 20, 10, 100);
          o.tipYasi = 0;
          news.push(`${o.name}'da kriz derinleşiyor: popülist borç balonu patladı, yıldızlar kapıda.`);
          crises.push(o);
        } else {
          o.strength = clamp(o.strength + A.DRIFT.POPULIST, 30, 92);
          news.push(`${o.name} yine borçla şov yapıyor — kadroya para saçıldı.`);
        }
        break;
      case 'MUHASEBECI':
        o.strength = clamp(o.strength + (o.tipYasi % 3 === 0 ? A.DRIFT.MUHASEBECI3 : A.DRIFT.MUHASEBECI), 30, 92);
        break;
      case 'INSAATCI': o.strength = clamp(o.strength + A.DRIFT.INSAATCI, 30, 92); break;
      case 'AVCI': o.strength = clamp(o.strength + (o.tipYasi % 2 === 0 ? -1 : A.DRIFT.AVCI + 1), 30, 92); break;
      case 'DEV': o.strength = clamp(o.strength + A.DRIFT.DEV, 30, 92); break;
    }
    // 3 sezonda bir AI seçimi → tip değişebilir (lig evrimi)
    if (o.seasonCount % A.ELECTION_EVERY === 0 && rand(0, 1) < A.CHANGE_P) {
      const eski = o.baskanTipi;
      o.baskanTipi = AI_TYPES[randint(0, 4)];
      o.tipYasi = 0;
      if (o.baskanTipi !== eski) news.push(`${o.name} kongresinde devir: ${TYPE_TR[eski]} gitti, ${TYPE_TR[o.baskanTipi]} başkan geldi.`);
    }
  }
  return { news, crises };
}

// Tick içi AI olayı (v5-§2): TD kovma / başkan istifası → haber + geçici güç kaybı.
export function aiTick(opponents, leagueTable) {
  const A = TUNING.DELUXE.AI;
  // süregelen TD şoklarını çöz
  for (const o of opponents) {
    if (o.tdShock > 0) { o.tdShock--; if (o.tdShock === 0 && leagueTable[o.id]) leagueTable[o.id].strength += A.TD_DROP; }
  }
  if (rand(0, 1) >= A.EVENT_P) return null;
  const o = opponents[randint(0, opponents.length - 1)];
  if (o.tdShock > 0) return null;
  if (rand(0, 1) < 0.6) {
    o.tdShock = A.TD_WEEKS;
    if (leagueTable[o.id]) leagueTable[o.id].strength -= A.TD_DROP;
    return `${o.name} teknik direktörünü kovdu — takım ${A.TD_WEEKS} hafta bocalayacak.`;
  }
  o.istikrar = clamp(o.istikrar - 10, 10, 100);
  return `${o.name} başkanı istifa etti; kulüpte kaos havası.`;
}
