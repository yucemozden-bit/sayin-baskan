// tests/v43.test.mjs — v4.3 cila + audit paketi testleri.
// Çalıştır: node tests/v43.test.mjs

import { readFileSync } from 'node:fs';
import { TUNING } from '../src/config.js';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { efektifGuc, temelGuc } from '../src/engines/power.js';
import { makeReport } from '../src/engines/narrative.js';
import { generateSquad, youthIntake, uniqueName } from '../src/models/squadGen.js';
import { idealXI } from '../src/models/squad.js';
import * as promiseSelect from '../src/ui/promiseSelect.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json') };

function fresh(tier = 'orta') {
  const G = A.newGame(data, 'normal');
  A.selectClub(G, tier);
  A.startTerm(G, ['P15']);
  return G;
}

// ══ 1) MATEMATİK AUDIT ══
console.log('\n── 1) Efektif güç audit (başlangıç değerleri düzeltmesi) ──');
setSeed(42);
{
  const G = fresh();
  const t = temelGuc(A.powerCtx(G)), e = efektifGuc(A.powerCtx(G));
  check('sezon başı SAKATSIZ: Temel−Efektif farkı −5..−8 bandında', (t - e) >= 4 && (t - e) <= 8.5, `Temel ${t.toFixed(1)} → Efektif ${e.toFixed(1)} (−${(t - e).toFixed(1)})`);
  idealXI(G.squad)[3].injuryWeeks = 2;
  const e1 = efektifGuc(A.powerCtx(G)), t1 = temelGuc(A.powerCtx(G));
  check('1 sakat maliyeti makul (toplam fark ≤ −14)', (t1 - e1) <= 14, `−${(t1 - e1).toFixed(1)} (sakat payı ~${(t1 - e1 - (t - e)).toFixed(1)})`);
  check('FORM_START formül tabanının üstünde (maçsız "formsuz" cezası yok)', TUNING.PLAYER.FORM_START > 50, `${TUNING.PLAYER.FORM_START}`);
}

// ══ 2) RAPOR ŞİDDET KADEMESİ ══
console.log('\n── 2) Teknik rapor şiddet kademesi ──');
setSeed(77);
{
  // 1 sakat → HAFİF şablon + oyuncu adı; GM abartmaz
  const G = fresh();
  const inj = G.squad.find((p) => p.name);
  inj.injuryWeeks = 2;
  A.advanceWeek(G); G.pendingMatch = null;
  const rep = G.inbox.find((m) => m.cat === 'rapor');
  check('1 sakat → hafif şablon (oyuncu adı geçer, "kalabalık" DEMEZ)', !!rep && !rep.b.includes('kalabalık') && !rep.b.includes('alarmda'), rep ? rep.b.slice(0, 60) + '…' : '');
  // 5 sakat → AĞIR şablon
  setSeed(78);
  const G2 = fresh();
  G2.squad.slice(0, 5).forEach((p) => { p.injuryWeeks = 3; });
  A.advanceWeek(G2); G2.pendingMatch = null;
  const rep2 = G2.inbox.find((m) => m.cat === 'rapor');
  check('4+ sakat → ağır şablon (kalabalık/alarm)', !!rep2 && /(kalabalık|alarmda)/.test(rep2.b), rep2 ? rep2.b.slice(0, 60) + '…' : '');
  // Birim: şiddet eşikleri + hafif ASLA ağıra tırmanmaz
  const st = { reportMem: [] };
  const r1 = makeReport(st, data.media, [{ key: 'moral', deficit: 0.02 }], 1);
  const r2 = makeReport({ reportMem: [] }, data.media, [{ key: 'moral', deficit: 0.05 }], 1);
  const r3 = makeReport({ reportMem: [] }, data.media, [{ key: 'moral', deficit: 0.1 }], 1);
  check('eşikler: 0.02→hafif · 0.05→orta · 0.10→ağır', r1.sev === 'hafif' && r2.sev === 'orta' && r3.sev === 'agir', `${r1.sev}/${r2.sev}/${r3.sev}`);
  // hafif havuz tükenince orta'ya geçer ama AĞIR'a atlamaz (abartma yasağı)
  const stx = { reportMem: [] }; const sevs = [];
  for (let w = 1; w <= 4; w++) sevs.push(makeReport(stx, data.media, [{ key: 'kond', deficit: 0.02 }], w).sev);
  check('hafif tükenince ortaya kayar, ağıra ATLAMAZ', sevs.slice(0, 2).every((s) => s === 'hafif') && !sevs.includes('agir'), sevs.join(','));
  // 6-hafta tekrar hâlâ 0 (kademeli havuzlarla)
  const st6 = { reportMem: [] }; const sigs = [];
  for (let w = 1; w <= 8; w++) sigs.push(makeReport(st6, data.media, [{ key: 'moral', deficit: 0.1 }, { key: 'form', deficit: 0.06 }], w).sig);
  let viol = 0;
  for (let i = 0; i < sigs.length; i++) for (let j = i + 1; j < sigs.length && j - i < 6; j++) if (sigs[i] === sigs[j]) viol++;
  check('kademeli havuzlarda 6-hafta tekrarı = 0', viol === 0, `${viol} ihlal`);
}

// ══ 3) İSİM TEKİLLİĞİ ══
console.log('\n── 3) İsim tekilliği ──');
setSeed(99);
{
  // Birim: uniqueName çakışma üretmez
  const used = {};
  const seen = new Set();
  let dup = 0;
  for (let i = 0; i < 300; i++) { const n = uniqueName(data.names, used); if (seen.has(n)) dup++; seen.add(n); }
  check('uniqueName 300 çekimde çakışma 0', dup === 0, `${seen.size} tekil isim`);
  // Entegre: kadro + 3 sezon genç + GM dosyaları — kadroda çakışma 0
  setSeed(101);
  const G = fresh();
  for (let s = 0; s < 2; s++) {
    for (let w = 0; w < 34; w++) {
      A.advanceWeek(G); G.pendingMatch = null;
      const tf = G.inbox.find((m) => m.action === 'tfile' && !m.resolved);
      if (tf) A.resolveTransferFile(G, tf.id, 'onay'); // GM dosyaları kadroya karışsın
      const sf = G.inbox.find((m) => m.action === 'sfile' && !m.resolved);
      if (sf) A.resolveSaleFile(G, sf.id, 'red');
    }
    A.endSeason(G); A.afterSeasonEnd(G);
    if (G.phase !== 'SEASON_LOOP') break;
  }
  const names = G.squad.map((p) => p.name).filter(Boolean);
  check('2 sezon sonra kadroda ad+soyad çakışması 0', new Set(names).size === names.length, `${names.length} oyuncu, ${new Set(names).size} tekil`);
}

// ══ 4) DÖNEM BAŞI İKİ ADIM ══
console.log('\n── 4) Dönem başı iki adım ──');
{
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  G._sel = ['P15'];
  const s1 = promiseSelect.render(G);
  check('Adım 1/2: SADECE vaatler (direktif yok)', s1.includes('1/2 · Sandık Sözü') && s1.includes('Sözünü ver') && !s1.includes('Bütçe tavanı'));
  G._setupStep = 2;
  const s2 = promiseSelect.render(G);
  // AÇILIŞ makam odası kurgusu: "Bütçe tavanı" etiketi GM sorusuna dönüştü ("Ne kadar harcayayım?")
  check('Adım 2/2: SADECE direktif + seçilen vaat özeti + geri', s2.includes('2/2 · Makam Odası') && s2.includes('Kese ne kadar açılsın') && !s2.includes('class="vows"') && s2.includes('setupBack'));
}

// ══ 5) KİLİTLİ VAAT KARTI ══
console.log('\n── 5) Kilitli vaat kartı ──');
{
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta'); // hedef 8 → P23 kilitli
  const html = promiseSelect.render(G);
  check('kilitli kart: başlık korunur + 🔒 + neden altında', html.includes('Bu Takımı Küme Hattına Düşürmeyeceğim') && html.includes('🔒') && html.includes('Bu camia küme derdinde değil'));
}

// ══ 6) HIZLI TARAMA ══
console.log('\n── 6) Hızlı tarama (taşma/çelişki) ──');
{
  const css = readFileSync(new URL('../css/game.css', import.meta.url), 'utf8');
  check('tablolar .table-wrap ile kayar (yatay taşma yok)', css.includes('.table-wrap { overflow-x: auto; }'));
  check('dar pencere kuralları (720px) genişletildi', css.includes('.stage { padding: 12px; }'));
  const sq = readFileSync(new URL('../src/ui/squadView.js', import.meta.url), 'utf8');
  const tv = readFileSync(new URL('../src/ui/transferView.js', import.meta.url), 'utf8');
  check('kadro + pazar tabloları sarmalı', sq.includes('kad-tile') && tv.includes('tr-tile'));
}

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
