// src/engines/sponsorGen.js — SPONSOR PAZARI: prosedürel marka üreteci.
// Her kariyerde farklı isim + bedel: kurgusal markalar (lisans güvenli — gerçek marka YOK),
// sektöre göre tip/çarpan/risk/süre. TAMAMEN DETERMİNİSTİK — ana RNG'yi tüketmez
// (seed: kulüp adı + hafta + sıra no) → seed'li testler ve kayıt determinizmi kaymaz.

// ── Deterministik yerel RNG (mulberry32 çeşidi) ──
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }
function mkRng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ── İsim havuzları: 12 standart sektör + 5 özel tip → yüzlerce kombinasyon ──
const SEKTORLER = [
  { sektor: 'havayolu', ik: '✈', on: ['Anka', 'Mavi', 'Bulut', 'Şahin', 'Rüzgâr', 'Ufuk'], son: ['Jet', 'Air', 'Havayolları'] },
  { sektor: 'banka', ik: '🏦', on: ['Kale', 'Körfez', 'Meridyen', 'Saray', 'Liman', 'Çınar'], son: ['Bank', 'Finans', 'Yatırım'] },
  { sektor: 'enerji içeceği', ik: '⚡', on: ['Volt', 'Şimşek', 'Turbo', 'Dinamo', 'Fırtına', 'Yıldırım'], son: ['Max', 'Boost', 'Enerji'] },
  { sektor: 'telekom', ik: '📡', on: ['Sinyal', 'Kuzey', 'Delta', 'Atlas', 'Vega', 'Orbit'], son: ['Net', 'Kom', 'Cell'] },
  { sektor: 'otomotiv', ik: '🚗', on: ['Bozkır', 'Rota', 'Krom', 'Vites', 'Çelik', 'Doru'], son: ['Motor', 'Oto', 'Mobil'] },
  { sektor: 'sigorta', ik: '🛡', on: ['Güven', 'Çatı', 'Emniyet', 'Sağlam', 'Nöbet', 'Kalkan'], son: ['Sigorta', 'Güvence', 'Poliçe'] },
  { sektor: 'elektronik', ik: '📺', on: ['Kristal', 'Nokta', 'Piksel', 'Devre', 'Foton', 'İyon'], son: ['Elektronik', 'Teknoloji', 'Vizyon'] },
  { sektor: 'inşaat', ik: '🏗', on: ['Granit', 'Mermer', 'Kule', 'Temel', 'Zirve', 'Kemer'], son: ['İnşaat', 'Yapı', 'Holding'] },
  { sektor: 'giyim', ik: '👔', on: ['İpek', 'Stil', 'Dokuma', 'Keten', 'Kumaş', 'Terzi'], son: ['Tekstil', 'Giyim', 'Moda'] },
  { sektor: 'akaryakıt', ik: '⛽', on: ['Damla', 'Varil', 'Okyanus', 'Kuyu', 'Alev', 'Maden'], son: ['Petrol', 'Enerji', 'Gaz'] },
  { sektor: 'lojistik', ik: '🚚', on: ['Kervan', 'Menzil', 'Ekspres', 'Küre', 'Pusula', 'Ray'], son: ['Lojistik', 'Kargo', 'Trans'] },
  { sektor: 'gıda', ik: '🍽', on: ['Bereket', 'Sofra', 'Harman', 'Değirmen', 'Hasat', 'Çiftlik'], son: ['Gıda', 'Grup', 'Mutfak'] },
];
const OZEL = {
  fintech: { sektor: 'fintech', ik: '💳', on: ['Cep', 'Dijital', 'Hızlı', 'Akıllı', 'Genç', 'Mobil'], son: ['Pay', 'Kart', 'Cüzdan', 'Para'] },
  bahis: { sektor: 'bahis', ik: '🎲', on: ['Mega', 'Şans', 'Gol', 'Derbi', 'Kral', 'Turbo'], son: ['Bahis', 'Bet', 'Kupon', 'Oyun'] },
  kripto: { sektor: 'kripto', ik: '🪙', on: ['Kripto', 'Bit', 'Zincir', 'Nova', 'Halka', 'Sonsuz'], son: ['Coin', 'Token', 'Pay', 'X'] },
  yerel: { sektor: 'yerel esnaf', ik: '🏘', on: ['Çarşı', 'Mahalle', 'Meydan', 'İskele', 'Bakırcılar', 'Kordon'], son: ['Esnaf Birliği', 'Lokantası', 'Market', 'Fırını'] },
  naming: { sektor: 'holding', ik: '🏟', on: ['Global', 'Kıta', 'Zirve', 'Payitaht', 'Hazar', 'Meridyen'], son: ['Holding', 'Grup', 'Air', 'Enerji'] },
};

// Tip profilleri: gelir çarpanı aralığı, sözleşme yılı, risk şablonu
const TIP_PROFIL = {
  standart: { mult: [0.95, 1.2], yil: [2, 3] },
  fintech: { mult: [1.05, 1.25], yil: [2, 2] },
  bahis: { mult: [1.35, 1.6], yil: [1, 1] },
  kripto: { mult: [1.5, 1.85], yil: [1, 1] },
  yerel: { mult: [0.55, 0.75], yil: [2, 2] },
  naming: { mult: [1.35, 1.65], yil: [3, 3] },
};

// Slot başına gelebilecek tipler (arrival çekilişi bu havuzdan)
export const SLOT_TIPLERI = {
  gogus: ['standart', 'standart', 'standart', 'fintech', 'bahis', 'kripto'],
  kol: ['yerel', 'yerel', 'standart'],
  naming: ['naming'],
};

// Tek teklif üret. ctx: { clubName, week, seq, weeklyBase, usedNames[] } · forceType init kompozisyonu için.
export function generateSponsorOffer(ctx, slot, forceType = null) {
  const rng = mkRng(hashStr(ctx.clubName || 'kulup') ^ Math.imul((ctx.week || 0) + 7, 40503) ^ Math.imul((ctx.seq || 0) + 13, 2654435761));
  const ri = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
  const rr = (lo, hi) => lo + rng() * (hi - lo);
  const tipler = SLOT_TIPLERI[slot] || ['standart'];
  const tip = forceType || tipler[ri(0, tipler.length - 1)];
  const havuz = OZEL[tip] || SEKTORLER[ri(0, SEKTORLER.length - 1)];
  // Benzersiz isim: kombinasyon dener, çakışırsa kaydırır
  const used = ctx.usedNames || [];
  let name = '';
  for (let d = 0; d < 12; d++) {
    const on = havuz.on[(ri(0, 99) + d) % havuz.on.length];
    const son = havuz.son[(ri(0, 99) + d) % havuz.son.length];
    name = tip === 'yerel' ? `${on} ${son}` : `${on}${son}`;
    if (!used.includes(name)) break;
    name = '';
  }
  if (!name) name = `${havuz.on[0]}${havuz.son[0]} ${(ctx.seq || 0) + 1}`;
  const prof = TIP_PROFIL[tip];
  const incomeMult = Math.round(rr(prof.mult[0], prof.mult[1]) * 100) / 100;
  const weekly = Math.max(0.1, Math.round((ctx.weeklyBase || 0.3) * incomeMult * rr(0.92, 1.12) * 100) / 100);
  const annual = Math.round(weekly * 52 * 10) / 10;
  const pesinat = Math.max(1, Math.round(annual * rr(0.12, 0.2)));
  const fesihCeza = Math.round(pesinat + annual * 0.25); // fesih HER ZAMAN peşinatı aşar → imzala-boz hilesi imkânsız
  const years = ri(prof.yil[0], prof.yil[1]);
  // Risk/dezavantaj — tipe göre, hafif sayısal varyans
  let riskProfile = null, dezavantaj = '', note = '';
  if (tip === 'bahis') { riskProfile = { taraftar: -ri(2, 4), itibar: -ri(1, 3) }; note = 'Ilımlı taraftar mektup yazar — "aile kulübü" imajı zedelenir.'; }
  else if (tip === 'kripto') { riskProfile = { itibar: -ri(3, 6), batmaChance: 0.25 }; note = 'Parlak para ama %25 batma riski — batarsa gelir kesilir, manşet olur.'; }
  else if (tip === 'yerel') { riskProfile = { taraftar: ri(2, 4) }; note = '"Bizim kulüp" havası — tribün sever.'; }
  else if (tip === 'fintech') { riskProfile = { gencTaban: ri(2, 3) }; note = 'Genç taban memnun; dijital kampanyalar.'; }
  else if (tip === 'naming') { riskProfile = { taraftar: -ri(1, 3) }; note = '"Stadın adı satılmaz" diyen nostaljikler homurdanır.'; }
  if (riskProfile) {
    const parts = [];
    if (riskProfile.taraftar) parts.push(`taraftar ${riskProfile.taraftar > 0 ? '+' : ''}${riskProfile.taraftar}`);
    if (riskProfile.itibar) parts.push(`itibar ${riskProfile.itibar}`);
    if (riskProfile.gencTaban) parts.push(`genç taban +${riskProfile.gencTaban}`);
    if (riskProfile.batmaChance) parts.push(`%${Math.round(riskProfile.batmaChance * 100)} batma riski`);
    dezavantaj = parts.join(', ');
  }
  return {
    id: `sp-${slot}-${ctx.seq || 0}`, name, sektor: havuz.sektor, ik: havuz.ik || '🤝', type: tip,
    slot, incomeMult, weekly, annual, pesinat, fesihCeza, years,
    kalanHafta: ri(6, 11), riskProfile, dezavantaj, note,
  };
}
