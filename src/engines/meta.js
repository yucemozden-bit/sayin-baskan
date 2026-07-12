// src/engines/meta.js — MEGA B4: koltuk modları kuralları + başarım kontrol tablosu (DOM'suz).
// Modlar: klasik · ironman (tek yaşam, manuel kayıt yok) · vitrin (kurul zorunlu hedef dayatır)
// · aile (kurul yok, açıklar kişisel servetten; servet biterse iflas).

import { TUNING } from '../config.js';
import { randint } from '../core/rng.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export const MODES = {
  klasik: { ad: 'Klasik Başkanlık', tanitim: 'Kurul, kongre, sandık — hepsi masada. Kaydını istediğin an alırsın.' },
  // KALICI TASARIM KARARI (onaylı): Ironman = "tek yaşam + manuel kayıt kilidi".
  // Orijinal "her tick otomatik kayıt" maddesi localStorage yasağıyla (CLAUDE.md) çelişiyordu;
  // bu tanım nihaidir — ileride kayıt sistemi eklense bile Ironman'in çekirdeği tek yaşamdır.
  ironman: { ad: 'Geri Adım Yok', tanitim: 'Attığın imza geri alınmaz. Kaydın yok, bahanen de olmayacak.' },
  vitrin: { ad: 'Vitrin Başkanı', tanitim: 'Kurul her dönem 1 ZORUNLU hedef dayatır; tutturamazsan desteği çöker.' },
  aile: { ad: 'Aile Kulübü', tanitim: 'Kurul yok — kulüp senin. Açıklar CEBİNDEN (100mn servet); servet biterse iflas.' },
};

// B4c-Vitrin: kurul zorunlu hedefi — kulüp durumundan seçilir
export function pickMandate(G) {
  if (G.economy.borc > 40) return { tip: 'borc', hedef: Math.round(G.economy.borc * 0.6), metin: `Borcu ${Math.round(G.economy.borc * 0.6)}mn altına indir` };
  if (!(G.career && (G.career.cups > 0 || G.career.titles > 0))) return { tip: 'kupa', metin: 'Bu dönem en az 1 kupa/şampiyonluk kazan' };
  return { tip: 'tier', metin: 'Kulübü bir üst seviyeye taşı (tier hamlesi)' };
}
export function mandateDone(G, m) {
  if (!m) return true;
  if (m.tip === 'borc') return G.economy.borc <= m.hedef;
  if (m.tip === 'kupa') return (G.history.seasons || []).some((s) => s.champion || s.cup);
  if (m.tip === 'tier') return (G.tierHistory || []).some((t) => t.dir === 'up' && t.term >= G.meta.term);
  return true;
}

// B4a: senaryo hedef kontrolü
export function scenarioDone(G, sc) {
  if (!sc) return false;
  if (sc.hedef.tip === 'batan') return G.meta.term <= 2 && G.economy.borc <= (G.scenarioBase?.borc || 999) * 0.5 && ((G.career?.cups || 0) + (G.career?.titles || 0)) >= 1;
  if (sc.hedef.tip === 'yeni') return G.club.tier === 'buyuk' && G.meta.term <= 4;
  if (sc.hedef.tip === 'secim') return (G.career?.termsWon || 0) >= 1;
  return false;
}

// ── B4d: BAŞARIMLAR — id → koşul (mevcut mekaniklere eşlenmiş; kancalarda kontrol) ──
export const ACH_CHECKS = {
  'koltuk-5-donem': (G) => (G.career?.termsWon || 0) >= 5,
  'koltuk-buyuk-oy': (G) => (G.career?.oyList || []).some((o) => o >= 0.70),
  'koltuk-muhalefetten': (G) => !!G.comebackWon,
  'koltuk-kil-payi': (G) => (G.career?.oyList || []).some((o) => o >= TUNING.WIN_LINE && o <= TUNING.WIN_LINE + 0.02),
  'koltuk-efsane': (G) => !!(G.careerEnd && G.careerEnd.tag === 'Efsane'),
  'saha-namaglup': (G) => (G.history.seasons || []).some((s) => s.L === 0 && (s.W + s.D) >= 30),
  'saha-3-kupa': (G) => ((G.career?.cups || 0) + (G.career?.titles || 0)) >= 3,
  'saha-derbi-5te5': (G) => (G.derbiWins || 0) >= 5,
  'saha-avrupa': (G) => (G.history.seasons || []).some((s) => s.pos <= TUNING.LEAGUE.EUROPE_SPOTS && (s.lig || 1) === 1),
  'saha-ust-uste': (G) => { const h = G.history.seasons || []; return h.some((s, i) => s.champion && h[i + 1] && h[i + 1].champion); },
  'kasa-borcsuz': (G) => G.economy.borc <= 0 && (G.career?.seasons || 0) >= 1,
  'kasa-maas-disiplini': (G) => G.term && G.term.income > 30 && (G.term.wage / G.term.income) <= 0.45,
  'kasa-transfer-kari': (G) => (G.sezonSatis || 0) - (G.sezonAlim || 0) >= 20,
  'kasa-nakit-kalesi': (G) => G.economy.kasa >= 100,
  'kasa-ffp-temiz': (G) => (G.ffpTemizSezon || 0) >= 3,
  'ocak-5-genc': (G) => G.squad.filter((p) => p.ocak).length >= 5,
  'ocak-altin-efsane': (G) => (G.museum || []).some((k) => k.t && k.t.includes('ALTIN NESİL')),
  'ocak-akademi-max': (G) => G.facilities.akademi >= TUNING.TRANSFER.FAC_MAX,
  'ocak-satis-motoru': (G) => (G.ocakSatisGelir || 0) >= 30,
  'ocak-jubile': (G) => (G.museum || []).some((k) => k.tip === 'jubile'),
  'kimlik-temiz-buyuk': (G) => G.club.tier === 'buyuk' && (G.kuskunler || []).length === 0 && (G.career?.termsWon || 0) >= 2,
  'kimlik-stad-adi': (G) => G.facilities.stadyum >= TUNING.ECONOMY.NAMING_MIN_STAD,
  'kimlik-muze': (G) => (G.museum || []).length >= 10,
  'kimlik-kadin-takim': (G) => (G.promises || []).some((p) => p.id === 'P11' && p.kept === true),
  'kimlik-uluslararasi': (G) => (G.promises || []).some((p) => p.id === 'P20' && p.kept === true) || (G.club.tier === 'buyuk' && G.gauges.itibar >= 80),
  'aci-dususten-sampiyon': (G) => G.aciKume && (G.history.seasons || []).some((s) => s.champion),
  'aci-1-fark-kaybet': (G) => (G.career?.oyList || []).some((o) => o < TUNING.WIN_LINE && o >= TUNING.WIN_LINE - 0.01),
  'aci-iflastan-sampiyon': (G) => G.aciKasaDip && (G.history.seasons || []).some((s) => s.champion),
  'aci-son-hafta': (G) => !!G.aciSonHafta,
  'aci-geri-donus': (G) => !!G.aciGeriDonus,

  // ── 8'e tamamlayan set (kategori başına +3) ──
  'koltuk-3-donem': (G) => (G.career?.termsWon || 0) >= 3,
  'koltuk-halk-adami': (G) => G.gauges.guven >= 88,
  'koltuk-sandik-ustasi': (G) => (G.career?.oyList || []).filter((o) => o >= 0.65).length >= 2,
  'saha-gol-makinesi': (G) => (G.history.seasons || []).some((s) => (s.GF || 0) >= 75),
  'saha-beton-defans': (G) => (G.history.seasons || []).some((s) => s.GA != null && s.GA <= 28),
  'saha-sampiyon': (G) => (G.history.seasons || []).some((s) => (s.pos === 1 || s.champion) && (s.lig || 1) === 1),
  'kasa-tok': (G) => G.economy.kasa >= 200,
  'kasa-imparator': (G) => G.economy.kasa >= 350,
  'kasa-saglam-bilanco': (G) => G.economy.borc <= 10 && (G.career?.seasons || 0) >= 1,
  'ocak-fidanlik': (G) => G.facilities.akademi >= 5,
  'ocak-dogan-yildiz': (G) => G.squad.some((p) => (p.age || p.yas || 99) <= 20 && (p.overall || p.guc || 0) >= 72),
  'ocak-ocak-bagi': (G) => G.squad.filter((p) => p.ocak).length >= 3,
  'kimlik-dev-stat': (G) => G.facilities.stadyum >= 8,
  'kimlik-itibarli': (G) => G.gauges.itibar >= 80,
  'kimlik-sehir-gururu': (G) => G.gauges.taraftar >= 90,
  'aci-metanet': (G) => (G.career?.seasons || 0) >= 4,
  'aci-kabuk-degisimi': (G) => { const h = G.history.seasons || []; return h.some((s, i) => s.pos >= 16 && h[i + 1] && h[i + 1].pos <= 8); },
  'aci-yilmaz-yurek': (G) => (G.history.seasons || []).some((s) => s.pos >= 16) && G.gauges.guven >= 60,
};

// Kanca: değişen G'ye göre yeni açılan başarımlar (mod: ironman → '-hc' varyant etiketi)
export function checkAchievements(G) {
  const defs = (G.data.achievements && (G.data.achievements.achievements || G.data.achievements)) || [];
  G.achUnlocked = G.achUnlocked || {};
  const yeni = [];
  for (const d of defs) {
    if (G.achUnlocked[d.id]) continue;
    const fn = ACH_CHECKS[d.id];
    if (fn && fn(G)) {
      G.achUnlocked[d.id] = { sezon: G.worldSeason || 1, hardcore: G.mode === 'ironman' };
      yeni.push(d);
    }
  }
  return yeni;
}

// B4b: KULÜP HAVUZU — her kariyer farklı koksun (kimlik satırlı aday kartı)
const FAN_CHARS = [
  { key: 'radikal', ad: 'radikal ağırlıklı tribün', etki: 'koreografi/boykot sık — sevgisi de öfkesi de büyük' },
  { key: 'sabirli', ad: 'sabırlı camia', etki: 'kötü seriyi affeder, ihaneti affetmez' },
  { key: 'hesapli', ad: 'bilet hassas taban', etki: 'kombine zammına anında tepki' },
];
export function rollClubIdentity(tier, teamsData, seedFn = randint) {
  const havuz = teamsData || [];
  const secilen = havuz.length ? havuz[seedFn(0, havuz.length - 1)] : null;
  const name = secilen ? secilen.name : null;
  const stadTip = ['Arena', 'Stadyumu', 'Parkı', 'Ocağı'][seedFn(0, 3)];
  const fanChar = FAN_CHARS[seedFn(0, FAN_CHARS.length - 1)];
  return {
    name, stadName: name ? `${name.split(' ')[0]} ${stadTip}` : null,
    founded: 1900 + seedFn(5, 85), fanChar,
    renk: (secilen && secilen.colors && secilen.colors[0]) || null, // GÖRSEL 5a: kart şeridi/arma rengi
  };
}
export const fanCharOf = (G) => FAN_CHARS.find((f) => f.key === (G.club && G.club.fanChar)) || null;

export function clampServet(x) { return clamp(x, -50, 10000); }
