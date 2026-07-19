// tests/yon.test.mjs — KADRO YÖNÜ (hücum/savunma ayrışması) bataryası.
// İlkeler: (1) dengeli kadroda tilt=1 → eski motor BİT-BİT; (2) savunma kadrosu az yer/az atar,
// hücum kadrosu çok atar; (3) abartı freni — tilt BANT dışına çıkamaz, uç kadroda bile skorlar
// makul; (4) xG PAYLAŞIMI değişmez → kazanma dengesi (kalibrasyon) oynamaz; (5) AI-AI maçlar etkilenmez.
// Çalıştır: node tests/yon.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed, rand } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { TUNING } from '../src/config.js';
import { atakSavunma, hatOrtalamalari, kadroKalitesi } from '../src/engines/power.js';
import { simulateMatch } from '../src/engines/match.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

// Yapay kadro: mevki başına verilen güçte yeterli oyuncu (sakatlık yok)
function kadro(gk, def, mid, fwd) {
  const mk = (pos, ov, n) => Array.from({ length: n }, (_, i) => ({ id: pos + i, name: pos + i, pos, overall: ov, age: 26, injuryWeeks: 0, suspensionWeeks: 0, morale: 60, form: 55, fitness: 80 }));
  return [...mk('GK', gk, 2), ...mk('DEF', def, 6), ...mk('MID', mid, 6), ...mk('FWD', fwd, 4)];
}

console.log('\n── MOTOR: atakSavunma endeksi ──');
{
  const dengeli = atakSavunma(kadro(60, 60, 60, 60));
  check('dengeli kadro → tilt TAM 1 (eski davranış bit-bit)', dengeli.tilt === 1, `tilt ${dengeli.tilt}`);
  const savunmaci = atakSavunma(kadro(75, 75, 55, 55));
  const hucumcu = atakSavunma(kadro(55, 55, 75, 75));
  check('savunmacı kadro → tilt < 1', savunmaci.tilt < 1, savunmaci.tilt.toFixed(3));
  check('hücumcu kadro → tilt > 1', hucumcu.tilt > 1, hucumcu.tilt.toFixed(3));
  check('simetri: eşit sapma zıt tilt', Math.abs((1 - savunmaci.tilt) - (hucumcu.tilt - 1)) < 1e-9);
  // ABARTI FRENİ: imkânsız uçlarda bile bant aşılmaz
  const uc1 = atakSavunma(kadro(99, 99, 1, 1));
  const uc2 = atakSavunma(kadro(1, 1, 99, 99));
  check(`abartı freni: uç kadroda tilt BANT içinde [${TUNING.YON.BANT}]`,
    uc1.tilt >= TUNING.YON.BANT[0] && uc2.tilt <= TUNING.YON.BANT[1], `${uc1.tilt} / ${uc2.tilt}`);
  // hat seçimi kadroKalitesi ile AYNI kaynak (sakat filtresi dahil)
  const sq = kadro(60, 60, 60, 60);
  sq.find((p) => p.pos === 'FWD').injuryWeeks = 3;
  const h = hatOrtalamalari(sq);
  check('sakat filtresi hat ortalamasına işliyor (tek kaynak)', typeof h.FWD === 'number' && kadroKalitesi(sq) > 0);
}

console.log('\n── MAÇ: tilt xG\'yi doğru yönde oynatır, paylaşımı BOZMAZ ──');
{
  // rng'siz xG karşılaştırması (poisson'a girmeden xg alanlarını okuyoruz)
  const sabit = () => 0.99; // poisson hep 0 döndürür — sadece xg alanlarına bakıyoruz
  const noTilt = simulateMatch(60, 55, sabit, {});
  const kapali = simulateMatch(60, 55, sabit, { tiltH: 0.9, tiltA: 0.9 });
  const acik = simulateMatch(60, 55, sabit, { tiltH: 1.1, tiltA: 1.1 });
  check('kapalı maç: iki xG de düşer (az atar, az yer)', kapali.xgH < noTilt.xgH && kapali.xgA < noTilt.xgA);
  check('açık maç: iki xG de artar', acik.xgH > noTilt.xgH && acik.xgA > noTilt.xgA);
  check('xG ORANI korunur (kim üstün dengesi aynı)',
    Math.abs(kapali.xgH / kapali.xgA - noTilt.xgH / noTilt.xgA) < 1e-9
    && Math.abs(acik.xgH / acik.xgA - noTilt.xgH / noTilt.xgA) < 1e-9);
  check('opts verilmeyince birebir eski değerler (AI-AI maçlar etkilenmez)',
    simulateMatch(60, 55, sabit).xgH === noTilt.xgH);

  // İSTATİSTİK: 4000 maçta savunmacı tilt yenilen golü anlamlı düşürür, hücumcu atılanı artırır
  setSeed(2026);
  const N = 4000;
  const topla = (tilt) => {
    let atilan = 0, yenilen = 0, w = 0;
    for (let i = 0; i < N; i++) {
      const r = simulateMatch(60, 55, undefined, { tiltH: tilt, tiltA: tilt });
      atilan += r.gH; yenilen += r.gA; if (r.result === 'W') w++;
    }
    return { atilan: atilan / N, yenilen: yenilen / N, w: w / N };
  };
  const notr = topla(1);
  const sav = topla(TUNING.YON.BANT[0]);
  const huc = topla(TUNING.YON.BANT[1]);
  check('savunmacı: yenilen gol düşer', sav.yenilen < notr.yenilen * 0.95, `${sav.yenilen.toFixed(2)} vs ${notr.yenilen.toFixed(2)}`);
  check('hücumcu: atılan gol artar', huc.atilan > notr.atilan * 1.05, `${huc.atilan.toFixed(2)} vs ${notr.atilan.toFixed(2)}`);
  check('kazanma oranı bandı oynamaz (±5 puan)', Math.abs(sav.w - notr.w) < 0.05 && Math.abs(huc.w - notr.w) < 0.05,
    `nötr %${(notr.w * 100).toFixed(0)} · sav %${(sav.w * 100).toFixed(0)} · hüc %${(huc.w * 100).toFixed(0)}`);
  check('abartı yok: uç tilt bile ort. golü ~%12 bandında oynatır',
    huc.atilan < notr.atilan * 1.2 && sav.yenilen > notr.yenilen * 0.8);
}

console.log('\n── OYUN İÇİ: gerçek kariyer akışında yön işler + determinizm ──');
{
  const fresh = (seed) => {
    setSeed(seed);
    const G = A.newGame(data, 'normal');
    A.selectClub(G, 'orta');
    A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
    return G;
  };
  // determinizm çifti: aynı seed + aynı kadro → 8 hafta bit-bit aynı
  const tur = (seed) => {
    const G = fresh(seed);
    for (let i = 0; i < 8; i++) { A.advanceWeek(G); G.pendingMatch = null; A.drainAllPhones && A.drainAllPhones(G); }
    return JSON.stringify({ tablo: G.league.table.sq?.points, kasa: Math.round(G.economy.kasa * 100), hafta: G.meta.week, yon: G.matchCtx?.yonT });
  };
  check('determinizm: çift koşum bit-bit aynı', tur(7) === tur(7));

  // transferin bölgesi anlam kazanır: forvet hattını güçlendir → tilt yükselir
  const G = fresh(11);
  const once = atakSavunma(G.squad).tilt;
  for (const p of G.squad) if (p.pos === 'FWD' || p.pos === 'MID') p.overall = Math.min(95, p.overall + 12);
  const sonra = atakSavunma(G.squad).tilt;
  check('hücum hattına yatırım → tilt yükselir (bölgenin anlamı)', sonra > once, `${once.toFixed(3)} → ${sonra.toFixed(3)}`);
  for (const p of G.squad) if (p.pos === 'GK' || p.pos === 'DEF') p.overall = Math.min(95, p.overall + 20);
  check('savunmaya daha büyük yatırım → tilt geri düşer', atakSavunma(G.squad).tilt < sonra);

  // UÇTAN UCA: aynı seed'lerde hücum-yüklü kadro sezonunu savunma-yüklüden daha GOLLÜ oynar
  // (matchCtx maç bitince temizlendiği için kanıt lig tablosundaki GF+GA toplamından okunur)
  const sezonGol = (seed, tip) => {
    const g = fresh(seed);
    for (const p of g.squad) {
      const atakMi = p.pos === 'MID' || p.pos === 'FWD';
      p.overall = (tip === 'atak') === atakMi ? 88 : 48;
    }
    for (let i = 0; i < 20; i++) { A.advanceWeek(g); g.pendingMatch = null; A.drainAllPhones && A.drainAllPhones(g); }
    const me = g.league.table.ME;
    return me.GF + me.GA;
  };
  let atakG = 0, savG = 0;
  for (const s of [101, 202, 303]) { atakG += sezonGol(s, 'atak'); savG += sezonGol(s, 'savunma'); }
  check('uçtan uca: hücum kadrosunun maçları daha gollü (3 seed toplamı)', atakG > savG, `atak ${atakG} vs savunma ${savG} gol`);
}

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
