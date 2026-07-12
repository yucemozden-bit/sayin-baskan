// src/models/staff.js — Teknik direktör havuzu + atama (Bible-10 / V5-1 staff MVP)
// TD 4 niteliği (taktik/oyuncuYonetimi/otorite/yardimciEkip). Atama: TaktikUyum→0, kimya−10 (Bible-10).

import { TUNING } from '../config.js';
import { rand, randint } from '../core/rng.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const ARCHETYPES = ['motivatör', 'savunmacı', 'oyun kurucu', 'genç işçisi'];

// İtibara göre TD adayları (yüksek itibar → daha iyi TD'ler başvurur).
export function generateCoaches(reputation, { names = null, count = 4 } = {}) {
  const base = clamp(45 + reputation * 0.45, 45, 90); // itibar 25→56, 75→79
  const list = [];
  for (let i = 0; i < count; i++) {
    const lvl = clamp(Math.round(base + randint(-8, 8)), 40, 92);
    const arch = ARCHETYPES[randint(0, 3)];
    list.push({
      name: pickName(names, i),
      archetype: arch,
      taktik: statFor(arch, 'taktik', lvl),
      oyuncuYonetimi: statFor(arch, 'oyuncuYonetimi', lvl),
      otorite: statFor(arch, 'otorite', lvl),
      yardimciEkip: statFor(arch, 'yardimciEkip', lvl),
      wage: Math.round((0.15 + (lvl - 45) / 45 * 1.05) * 100) / 100, // 0.15–1.2 mn/sezon
      minReputation: Math.max(0, Math.round(lvl - 25)),
    });
  }
  return list.sort((a, b) => teknikEkipScore(b) - teknikEkipScore(a));
}

function statFor(arch, stat, lvl) {
  const emph = {
    motivatör: { oyuncuYonetimi: 8, otorite: 4 }, savunmacı: { taktik: 6, otorite: 6 },
    'oyun kurucu': { taktik: 8, yardimciEkip: 8 }, 'genç işçisi': { yardimciEkip: 8, oyuncuYonetimi: 6 },
  }[arch] || {};
  return clamp(lvl + (emph[stat] || 0) - 4 + randint(-3, 3), 40, 95);
}
export function teknikEkipScore(c) {
  const W = TUNING.POWER.W_TEKNIK;
  return W.taktik * c.taktik + W.oyuncuYonetimi * c.oyuncuYonetimi + W.otorite * c.otorite + W.yardimciEkip * c.yardimciEkip;
}

// TD ata. midSeason ise Bible-10 cezaları: TaktikUyum→0, kimya−10.
export function hireCoach(state, coach, { midSeason = false } = {}) {
  state.coach = { ...coach };
  if (midSeason) {
    if (state.taktik) state.taktik.uyumHafta = 0;
    if (state.kimya) state.kimya.kimya = clamp(state.kimya.kimya + TUNING.KIMYA_TD, 0, 100); // −10
  }
  return state.coach;
}

function pickName(names, i) {
  if (!names) return 'TD Aday ' + (i + 1);
  return `${names.first[randint(0, names.first.length - 1)]} ${names.last[randint(0, names.last.length - 1)]}`;
}

// ═══ A1: YÖNETİCİ KADROSU (v5-§1) — CFO / Akademi Dir. / Basın Sözcüsü / Stat Müdürü ═══
export const STAFF_TRAITS = [
  { key: 'bankaci', label: 'eski bankacı', desc: 'yapılandırmada faizi ekstra kırar' },
  { key: 'agzisiki', label: 'ağzı sıkı', desc: 'sızıntıları yarıya indirir' },
  { key: 'egolu', label: 'egolu', desc: 'yetenekli ama çatışma çıkarabilir' },
  { key: 'caliskan', label: 'çalışkan', desc: 'işini sessizce yapar' },
  { key: 'vizyoner', label: 'vizyoner', desc: 'uzun vadeli düşünür' },
];
export const ROLE_TR = { cfo: 'CFO', akademi: 'Akademi Direktörü', basin: 'Basın Sözcüsü', stat: 'Stat/Operasyon Müdürü', tis: 'Taraftar İlişkileri Sorumlusu' };

function shuffleSeeded(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = randint(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// İtibara bağlı aday havuzu — adaylar BİRBİRİNDEN AYRI olsun:
// benzersiz nitelik (çakışma yok) + yayılmış yetenek (ucuz-zayıf ↔ pahalı-güçlü gerçek tercih).
export function generateStaff(role, reputation, { names = null, used = null, count = 3 } = {}) {
  const S = TUNING.STAFF;
  const base = clamp(Math.round(S.SKILL_BASE + reputation * S.SKILL_REP), 40, 86);
  const traits = shuffleSeeded(STAFF_TRAITS.slice()).slice(0, count); // benzersiz karakterler
  // yetenek yelpazesi: adaylar aynı bantta kümelenmesin
  const spread = count >= 3 ? [-15, -1, 14] : count === 2 ? [-11, 12] : [0];
  const usedNames = new Set();
  const uniqName = (i) => { let n, t = 0; do { n = pickName(names, i); t++; } while (usedNames.has(n) && t < 8); usedNames.add(n); return n; };
  const out = [];
  for (let i = 0; i < count; i++) {
    const off = spread[i] != null ? spread[i] : randint(-S.SKILL_SPREAD, S.SKILL_SPREAD);
    const trait = traits[i] || STAFF_TRAITS[randint(0, STAFF_TRAITS.length - 1)];
    const egoBonus = trait.key === 'egolu' ? 5 : 0;
    const skill = clamp(Math.round(base + off + randint(-3, 3)) + egoBonus, 35, 95);
    out.push({
      role, name: uniqName(i), skill,
      wage: Math.round(skill * S.WAGE_K * 100) / 100,
      trait: trait.key,
    });
  }
  return out.sort((a, b) => b.skill - a.skill);
}

// Kalite KELİMEYLE (sayı sızıntısı yok): vasat / işinin ehli / yıldız yönetici
export function staffQualityWord(s) {
  return s.skill < 55 ? 'vasat' : s.skill < 72 ? 'işinin ehli' : 'yıldız yönetici';
}
export function describeStaff(s) {
  const t = STAFF_TRAITS.find((x) => x.key === s.trait);
  return `${staffQualityWord(s)}, ${t ? t.label : ''} — ${t ? t.desc : ''}`;
}
// CFO projeksiyon sapması: kötü/boş CFO ±%15'e kadar yanılır.
export function cfoNoiseRange(cfo) {
  const S = TUNING.STAFF;
  const skill = cfo ? cfo.skill : S.CFO_DEFAULT_SKILL;
  return S.CFO_NOISE_MAX * clamp((100 - skill) / 60, 0, 1);
}
