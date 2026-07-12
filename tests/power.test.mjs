// tests/power.test.mjs — Güç motoru birim testleri (Bible-5 / Bible-22 vektörü)
// Çalıştır: node tests/power.test.mjs
// Motorlar konsoldan test edilebilir olmalı (V6 kuralı) — bu dosya onu doğrular.

import { TUNING } from '../src/config.js';
import {
  efektifCombine, uygunlukFromSums, moralMult, formMult, kondMult,
  dengeCarpani, yildizBonus, kadroKalitesi, temelGuc, efektifGuc,
} from '../src/engines/power.js';
import { marketValue, baseValue, ageFactor } from '../src/models/player.js';

// — küçük test koşucusu —
let pass = 0, fail = 0;
const fmt = (x) => (typeof x === 'number' ? x.toFixed(4) : String(x));
function approx(name, got, exp, tol) {
  const ok = Math.abs(got - exp) <= tol;
  console.log(`${ok ? '✓' : '✗'} ${name}  → ${fmt(got)} (beklenen ${fmt(exp)} ±${tol})`);
  ok ? pass++ : fail++;
}
function eq(name, got, exp) {
  const ok = got === exp;
  console.log(`${ok ? '✓' : '✗'} ${name}  → ${fmt(got)} (beklenen ${fmt(exp)})`);
  ok ? pass++ : fail++;
}

console.log('\n── BIBLE-22 işlenmiş örnek (EfektifGüç vektörü) ──');
// Girdi (Bible-22): TemelGüç=57, ilk11 ort morale=62 form=54 fitness=71,
// 1 yıldız sakat (ov 84): tamXI=858, mevcut=774, tibbi=4.
const uyg = uygunlukFromSums(858, 774, 4);
const m = moralMult(62);
const f = formMult(54);
const k = kondMult(71);
approx('Uygunluk = 774/858 + (tibbi4−5)×.01', uyg, 0.892, 0.001);
approx('Moral çarpanı (avg 62)', m, 0.889, 0.002);
approx('Form çarpanı  (avg 54)', f, 0.920, 0.002);
approx('Kond çarpanı  (avg 71)', k, 0.827, 0.002);
const eff = efektifCombine(57, uyg, m, f, k);
approx('EfektifGüç ≈ 34.4  (TOLERANS ±0.5)', eff, 34.4, 0.5);

console.log('\n── KadroKalitesi bileşenleri ──');
// DengeÇarpanı: 1 − (mevkiOrt − enZayif)/BALANCE_DIV, clamp [BALANCE_MIN, 1]
approx('DengeÇarpanı (mevkiOrt 70, enZayif 50 → 20 fark)', dengeCarpani(70, 50), 0.90, 1e-9);
approx('DengeÇarpanı clamp → BALANCE_MIN (40 fark)', dengeCarpani(90, 50), TUNING.BALANCE_MIN, 1e-9);
// YıldızBonusu: en iyi 3 yıldızın (ov−80)×0.15 toplamı, clamp [0, STAR_BONUS_MAX]
approx('YıldızBonusu [84,82] → (4+2)×.15', yildizBonus([{ overall: 84 }, { overall: 82 }, { overall: 70 }]), 0.90, 1e-9);
eq('YıldızBonusu yıldızsız (78,79) → 0', yildizBonus([{ overall: 78 }, { overall: 79 }]), 0);
approx('YıldızBonusu sadece en iyi 3 [84,83,82,81]', yildizBonus([{ overall: 84 }, { overall: 83 }, { overall: 82 }, { overall: 81 }]), 1.35, 1e-9);

console.log('\n── Entegrasyon dumanı (motor uçtan uca çalışıyor mu) ──');
// Basit dengeli kadro: her hat eşit → dengeÇarpanı=1, yıldızsız → kadroKalitesi≈60
const flat = [
  ...Array(3).fill({ pos: 'GK', overall: 60, injuryWeeks: 0, suspensionWeeks: 0 }),
  ...Array(8).fill({ pos: 'DEF', overall: 60, injuryWeeks: 0, suspensionWeeks: 0 }),
  ...Array(8).fill({ pos: 'MID', overall: 60, injuryWeeks: 0, suspensionWeeks: 0 }),
  ...Array(6).fill({ pos: 'FWD', overall: 60, injuryWeeks: 0, suspensionWeeks: 0 }),
].map((p, i) => ({ ...p, morale: 65, form: 50, fitness: 100, onIntlDuty: false, id: i }));
approx('KadroKalitesi düz-60 kadro → 60', kadroKalitesi(flat), 60, 1e-6);
const ctx = {
  squad: flat,
  coach: { taktik: 70, oyuncuYonetimi: 65, otorite: 68, yardimciEkip: 60 },
  kimya: { kimya: 70, bigMatchExp: 50, kaptanVar: true },
  taktik: { uyumHafta: 10, rolUygunlugu: 1.0 },
  facilities: { antrenman: 5, tibbi: 5, akademi: 4 },
};
const tg = temelGuc(ctx);
const eg = efektifGuc(ctx);
approx('temelGuc(ctx) makul aralıkta [40,80]', tg, 60, 20);
approx('efektifGuc(ctx) ≤ temelGuc (çarpanlar ≤1 civarı)', eg, tg * 0.95, tg * 0.2);

console.log('\n── Bible-4 piyasa değeri (kalibre, yapısal) ──');
// base() katsayıları kadroDeger'e göre kalibre edildi; testler config'ten okur (mutlak sabit yok).
approx('base(40) = VAL_BASE', baseValue(40), TUNING.PLAYER.VAL_BASE, 1e-9);
approx('base(80) = VAL_BASE×GROWTH^40', baseValue(80), TUNING.PLAYER.VAL_BASE * Math.pow(TUNING.PLAYER.VAL_GROWTH, 40), 1e-6);
// ASİMETRİK yaş eğrisi: zirve 23 → genç hafif iskonto, yaş SERT erime (kullanıcı tasarımı)
approx('ageFactor(23) = 1.25 (zirve)', ageFactor(23), 1.25, 1e-9);
approx('ageFactor(18) genç primi korur (~1.15)', ageFactor(18), 1.25 - 5 * TUNING.PLAYER.AGE_SLOPE_GENC, 1e-9);
approx('ageFactor(31) SERT düşer (~0.69)', ageFactor(31), 1.25 - 8 * TUNING.PLAYER.AGE_SLOPE_YASLI, 1e-9);
eq('genç (21) aynı güçte yaşlıdan (30) PAHALI satılır', marketValue(70, 21, 70) > marketValue(70, 30, 70) * 1.4, true);
approx('marketValue(ov80,yaş23) = base×1.25', marketValue(80, 23, 80), baseValue(80) * 1.25, 1e-9);

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
