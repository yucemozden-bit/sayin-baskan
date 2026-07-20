// tests/acilis.test.mjs — PAKET "AÇILIŞ ZİNCİRİ REFORMU" doğrulaması.
// S1 kapı (bare topbar, lore 18/18, SVG ikon, sınırsız çevirme) · S2 vaat (risk hiyerarşisi,
// bedel fısıltısı, çelişki uyarısı, rakip gölgesi) · S3 direktif diyaloğu (GM 9/9, gerçek rakam) ·
// S4 mühür töreni (FX.muhur + parşömen) · S5 ilk kokpit (tavan≤92, hafta-1 riskte=0, temiz çip).
// Çalıştır: node tests/acilis.test.mjs

import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import { TUNING } from '../src/config.js';
import * as A from '../src/actions.js';
import * as clubSelect from '../src/ui/clubSelect.js';
import * as promiseSelect from '../src/ui/promiseSelect.js';
import * as cockpit from '../src/ui/cockpit.js';
import { shell } from '../src/ui/frame.js';
import { getSound, FX } from '../src/core/sound.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json') };
const css = readFileSync(new URL('../css/game.css', import.meta.url), 'utf8');
const mainSrc = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

function fresh(promises = ['P15'], tier = 'orta', seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, tier);
  A.startTerm(G, promises, { budget: 60, line: 'hazir' });
  return G;
}

// ══ SAHNE 1 — ANA GİRİŞ: kapı ══
console.log('\n── Sahne 1: Ana giriş ──');
{
  setSeed(11);
  const G = A.newGame(data, 'normal');
  const html = clubSelect.render(G);
  // AÇILIŞ sb- görsel katman (2026-07): tam-ekran sb-gate, topbar yok (kariyer öncesi)
  check('1a: açılış tam-ekran sb-gate (topbar yok — kariyer öncesi)', html.includes('sb-gate') && !html.includes('sb-topbar'), '');
  check('1a: main.js CLUB_SELECT doğrudan clubSelect render eder', /CLUB_SELECT[\s\S]{0,120}clubSelect\.render/.test(mainSrc), '');
  check('1b: gece atmosferi CSS\'te (.sb-atmo + vinyet)', css.includes('.sb-atmo') && css.includes('.sb-vignette'), '');
  const eksikLore = data.teams.filter((t) => !t.lore || t.lore.length < 20);
  // 2026-07-22: havuz 18→40 kulübe çıktı ("takım isimleri artsın") — sabit 18 yerine ≥18 + hepsi lore'lu
  check(`1c: lore alanı ${data.teams.length}/${data.teams.length} dolu (≥20 karakter)`, data.teams.length >= 18 && eksikLore.length === 0, eksikLore.map((t) => t.name).join(',') || `${data.teams.length} kulüp`);
  check('1c: kartta lore paragrafı + anlatı (sb-cc-lore ≥3)', (html.match(/sb-cc-lore/g) || []).length >= 3, '');
  check('1d: stat grid etiketleri (GÜÇ/STADYUM/BÜTÇE/BORÇ/TARAFTAR/ZORLUK)', ['GÜÇ', 'STADYUM', 'BÜTÇE', 'BORÇ', 'TARAFTAR', 'ZORLUK'].every((k) => html.includes(k)), '');
  check('1e: mod tooltip\'i — Geri Adım Yok (ironman) tek-yaşam uyarısı', html.includes('Geri Adım Yok') && html.includes('imza geri alınmaz'), '');
  check('1f: kart renk şeridi + hover (kulüp rengine boyanır)', html.includes('sb-cc-strip') && css.includes('.sb-club-card:hover'), '');
  check('1g: yeniden çevirme SINIRSIZ (hak sayacı yok)', html.includes('İstediğin kadar çevir') && !mainSrc.includes('_rerollLeft'), '');
  check('1h: önerilen kulüp "yeni başkana göre" rozeti + featured', html.includes('yeni başkana göre') && html.includes('is-featured'), '');
}

// ══ SAHNE 2 — VAAT SEÇİMİ ══
console.log('\n── Sahne 2: Vaat seçimi ──');
{
  setSeed(21);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  G.phase = 'TERM_SETUP'; G._setupStep = 1; G._sel = [];
  let html = promiseSelect.render(G);
  // sb- görsel katman (2026-07): zorluk 4-5 → BÜYÜK KUMAR rozeti (sb-gamble); zorluk noktaları (sb-dot)
  check('2a: zorluk 4-5 kart BÜYÜK KUMAR rozeti (sb-gamble)', html.includes('sb-gamble') && html.includes('BÜYÜK KUMAR'), '');
  check('2a: zorluk noktaları render (dolu + boş)', html.includes('sb-dot is-on') && /class="sb-dot "/.test(html), '');
  check('2b: risk/oy tag\'leri (+/△) + fısıltı her açık kartta', (html.match(/sb-tag-pos/g) || []).length >= 5 && html.includes('tutmazsan'), '');
  const conflictsVar = data.promises.filter((p) => p.conflicts && p.conflicts.length);
  check('2c: promises.json çelişki alanı (≥6 vaat)', conflictsVar.length >= 6, `${conflictsVar.length} vaat`);
  G._sel = ['P02', 'P04']; // Borçsuz Kulüp ↔ Kadro Değeri: çelişen ikili
  html = promiseSelect.render(G);
  check('2c: çelişen ikili seçilince GM fısıltısı yanar', html.includes('sb-conflict-note') && html.includes('Aynı kasadan iki kere para çıkmaz'), '');
  G._sel = ['P01'];
  html = promiseSelect.render(G);
  check('2c: çelişkisiz seçimde uyarı YOK (engel değil, fısıltı)', !html.includes('sb-conflict-note'), '');
  check('2d: rakip gölgesi kulis kartı sahnede', G.rakipKulis && html.includes('sb-whisper') && html.includes(G.rakipKulis), G.rakipKulis);
  check('2e: açıklama TEK cümle + detay tooltip\'te', html.includes('tutmazsan sandıkta koz') && html.includes('data-tip="Söz verdiğin yolda'), '');
}

// ══ SAHNE 3 — DİREKTİF DİYALOĞU ══
console.log('\n── Sahne 3: Direktif ──');
{
  const kombolar = ['dusuk', 'orta', 'yuksek'].flatMap((b) => ['genc', 'hazir', 'yildiz'].map((l) => `${b}|${l}`));
  const gmD = (data.media.gmDirektif || {});
  const eksik = kombolar.filter((k) => !gmD[k] || gmD[k].length < 10);
  check('3a: GM cümlesi 9/9 kombinasyon (media.json gmDirektif)', eksik.length === 0, eksik.join(',') || '9/9');
  setSeed(31);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  G.phase = 'TERM_SETUP'; G._setupStep = 2; G._sel = ['P15'];
  G._dir = { budgetKey: 'yuksek', line: 'yildiz' };
  const html = promiseSelect.render(G);
  check('3a: GM kartı seçimle KONUŞUR (yuksek|yildiz cümlesi sahnede)', html.includes('sb-gm-card') && html.includes(gmD['yuksek|yildiz'].slice(0, 25)), '');
  const beklenen = Math.round(G.economy.kasa * TUNING.APPROVAL.BUDGET_PRESET.orta);
  check('3b: bütçe butonunda GERÇEK rakam (≈mn, kasadan hesaplı)', html.includes('≈') && html.includes(`${beklenen}`), `Dengeli ≈${beklenen}mn`);
  check('3c: düzen — GM kartı solda (sb-three)', html.includes('sb-three') && css.includes('.sb-three'), '');
  // MAKAM ODASI kurgusu: GM açılışı GERÇEK rakamlarla konuşur, kararlar başkan repliği, tutanak satırı
  check('3d: GM açılış repliği kasadaki gerçek parayla konuşur', html.includes('sb-brief') && html.includes('Hayırlı olsun') && html.includes('milyon borç'), '');
  check('3d: SEÇİLİ karar başkan repliğini taşır (yuksek+yildiz seçili)', html.includes('sb-opt-q') && html.includes('Gerekeni harca') && html.includes('gelişi manşet olsun'), '');
  check('3d: TAM GENİŞLİK tutanak belgesi + MÜHÜRLE CTA + mühürlü sözler', html.includes('DÖNEM SÖZLEŞMESİ') && html.includes('MÜHÜRLE') && html.includes('MÜHÜRLÜ SÖZLER') && html.includes('BASINA NE DİYEYİM'), '');
  check('3d: zafer barında başkanın ADI yazar (SEN değil)', readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').includes('z.baskanAd'), '');
}

// ══ SAHNE 4 — MÜHÜR TÖRENİ ══
console.log('\n── Sahne 4: Mühür töreni ──');
{
  check('4a: FX.muhur sentezde + miks tablosunda', typeof FX.muhur === 'function' && !!getSound().mix.muhur, `vol ${getSound().mix.muhur?.vol}`);
  const G = fresh(['P15', 'P24']);
  check('4a: startTerm töreni kurar (tip:muhur + vaat adları)', G.transition?.tip === 'muhur' && G.transition.vaatler.length === 2, G.transition.vaatler.join(' · '));
  check('4a: main töreni sahneler (parşömen + kademeli damga + ses)', mainSrc.includes('parsomen') && mainSrc.includes('i * aralik') && mainSrc.includes('damgaGecik') && mainSrc.includes('FX.muhur()'), '');
  check('4a: zafer sayımı gerilimli — pürüzsüz (rakip önde → sen geçersin) + tıkırtı', mainSrc.includes('zaferSayimi') && mainSrc.includes('easeGir') && mainSrc.includes('easeCik') && mainSrc.includes('FX.sayim()'), '');
  check('4a: parşömen/damga animasyonu CSS\'te', css.includes('.parsomen') && css.includes('@keyframes muhur') && css.includes('animation-delay: inherit'), '');
  const G2 = fresh([]);
  check('4b: vaatsiz dönem → "Laf değil, iş" tek parşömen', G2.transition?.tip === 'muhur' && G2.transition.vaatler.length === 0 && mainSrc.includes('Laf değil, iş'), '');
  // AÇILIŞ ZAFERİ: Dönem 1 kongre seçim sonucu törenin başında + zafer animasyonu
  const gz = fresh(['P15'], 'orta', 71);
  const z = gz.transition.zafer;
  check('4c: Dönem 1 töreninde seçim zaferi var (sen kazanır, toplam %100)', !!z && z.sen > 50 && z.sen + z.rakip === 100, z ? `SEN %${z.sen} vs %${z.rakip}` : 'yok');
  check('4c: rakip adayın ismi dolu + her kariyer farklı', !!z && !!z.rakipAd && z.rakipAd !== fresh(['P15'], 'orta', 72).transition.zafer.rakipAd, z ? z.rakipAd : '');
  check('4c: main zafer bloğunu + konfeti/ses animasyonunu sahneler', mainSrc.includes('secim-zafer') && mainSrc.includes('konfetiAt()') && mainSrc.includes('t._zafer') && css.includes('@keyframes zaferGir'), '');
  // yeniden seçim döneminde tören zaferi TEKRAR ETMEZ (ELECTION_NIGHT sayar)
  const gr = fresh(['P15'], 'orta', 73);
  gr.history = { seasons: [{ pos: 5 }, { pos: 5 }, { pos: 5 }] };
  A.startNewTerm(gr); A.startTerm(gr, ['P15'], { budget: 60, line: 'hazir' });
  check('4c: yeniden seçim töreninde zafer YOK (seçim gecesiyle çakışmaz)', !gr.transition.zafer && gr.meta.term >= 2, `dönem ${gr.meta.term}`);
}

// ══ SAHNE 5 — İLK KOKPİT ══
console.log('\n── Sahne 5: İlk kokpit ──');
{
  const G = fresh(['P01', 'P03', 'P04'], 'orta', 51); // 3 iddialı vaat — umut bonusu maksimum
  check('5c: UMUT TAVANI — 3 iddialı vaatle hafta-1 taraftar ≤ 92', G.gauges.taraftar <= TUNING.MEGA.UMUT_TARAFTAR_TAVAN, `taraftar ${G.gauges.taraftar}`);
  check('5a: kariyerin ilk kokpiti işaretli (G._ilkKokpit)', G._ilkKokpit === true, '');
  G.transition = null;
  const ilkHtml = cockpit.render(G);
  // KOKPİT sb- (2026-07): KULÜP NABZI gauge halkaları + dolum geçişi (stroke-dashoffset transition)
  check('5a: kokpit gauge halkaları render + dolum geçişi', ilkHtml.includes('sb-gauge-fg') && ilkHtml.includes('KULÜP NABZI') && css.includes('stroke-dashoffset'), '');
  check('5a: ilk kokpit bayrağı ilk render sonrası düşer (tek sefer)', G._ilkKokpit === false, '');
  check('5b: hafta-1 gündemde "riskte" YOK, "başlangıç" var', !ilkHtml.includes('riskte') && ilkHtml.includes('başlangıç'), '');
  check('5d: temiz başlangıçta NEGATİF çip = 0 (düşük/formsuz/bitkin yok)', !/düşük|formsuz|bitkin/.test(ilkHtml) && !ilkHtml.includes('chip--warn'), '');
  check('5d: hafta ≤2 form çipi "sezon başı" der (form henüz konuşmaz)', /sezon başı/i.test(ilkHtml), '');
  // 6d kuralı korunur: kond 0.95 (nötr .94 + tolerans içinde) "zinde" DEĞİL; 0.97 zinde
  G.meta.week = 3;
  G.power = { ...G.power, kond: 0.95 };
  const h95 = cockpit.render(G);
  check('5d: kond 0.95 → "yorgun" (6d: kelime çarpanı abartmaz)', /yorgun/i.test(h95) && !/zinde/i.test(h95), '');
  G.power = { ...G.power, kond: 0.97 };
  check('5d: kond 0.97 → "zinde" hâlâ kazanılabilir', /zinde/i.test(cockpit.render(G)), '');
}

// ══ TUTARLILIK — rakip gölgesi seçim gecesine döner ══
console.log('\n── Tutarlılık: kulis → sandık ──');
{
  const G = fresh(['P01'], 'orta', 61);
  check('2d: rakipKulis dönem başında tohumlanır', ['şampiyonluk', 'borçsuz kulüp', 'stadyum yatırımı'].includes(G.rakipKulis), G.rakipKulis);
  A.runElection(G);
  check('2d: seçim gecesi rakip AYNI sözü sahneler (sızıntı tutarlı)', G.election.rivalSpeech.includes(G.rakipKulis), '');
  // yeni döneme dönüşte kulis tazelenir (startNewTerm — davranışsal)
  A.startNewTerm(G);
  check('2d: startNewTerm kulisi yeniden tohumlar', ['şampiyonluk', 'borçsuz kulüp', 'stadyum yatırımı'].includes(G.rakipKulis) && G.phase === 'TERM_SETUP', G.rakipKulis);
}

console.log('\n' + '─'.repeat(48));
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
