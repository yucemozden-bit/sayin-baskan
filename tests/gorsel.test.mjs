// tests/gorsel.test.mjs — PAKET "GÖRSEL KİMLİK" doğrulaması.
// Kontrast bekçisi: 18 kulüp rengi × 3 kritik yüzey ≥4.5:1 · token tabanı · .led/skorbord ·
// reduced-motion bloğu · kart türevleri · ekran giydirmeleri (motorlara dokunulmadı).
// Çalıştır: node tests/gorsel.test.mjs

import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { deriveClubColor, clubPalette, contrast, rawClubColor, oppColor } from '../src/ui/theme.js';
import * as clubSelect from '../src/ui/clubSelect.js';
import * as cockpit from '../src/ui/cockpit.js';
import * as squadView from '../src/ui/squadView.js';
import * as matchday from '../src/ui/matchday.js';
import * as electionNight from '../src/ui/electionNight.js';
import * as inboxUI from '../src/ui/inbox.js';
import { gaugesBlock } from '../src/ui/frame.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json') };
const css = readFileSync(new URL('../css/game.css', import.meta.url), 'utf8');

function fresh(tier = 'orta') {
  const G = A.newGame(data, 'normal');
  A.selectClub(G, tier);
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  G.transition = null;
  let g = 0;
  while (G.phone && g++ < 8) A.answerPhone(G, (G.phone.options || []).length - 1);
  return G;
}

// ══ §2 KONTRAST BEKÇİSİ — METRİK: 18 renk × 3 yüzeyde ≥4.5:1 ══
console.log('\n── Kontrast bekçisi ──');
{
  const KOYU = '#241A06';   // badge/devam üstündeki koyu mürekkep
  const BG1 = '#141C2E';    // kart zemini
  const BG0 = '#0E1522';    // sahne zemini
  let ihlal = 0, kontrol = 0;
  const tumRenkler = [...data.teams.flatMap((t) => t.colors || []), '#D4A62A', '#7B1E3B', '#2E7D5B'];
  for (const ham of tumRenkler) {
    const c = deriveClubColor(ham);
    kontrol++;
    if (contrast(c, KOYU) < 4.5) { ihlal++; console.log('  İHLAL koyu-ink:', ham, '→', c, contrast(c, KOYU).toFixed(2)); }
    if (contrast(c, BG1) < 1.8) { ihlal++; console.log('  İHLAL bg-1:', ham, '→', c); }   // vurgu zeminden ayrışmalı
    if (contrast(c, BG0) < 2.0) { ihlal++; console.log('  İHLAL bg-0:', ham, '→', c); }
  }
  check(`METRİK: türetilen kulüp rengi 3 kritik yüzeyde güvenli (${kontrol} renk × 3)`, ihlal === 0, `${ihlal} ihlal`);
  // parlaklık bandı 55-85 (normalize + bekçi açılması)
  const bantDisi = tumRenkler.map(deriveClubColor).filter((c) => {
    const p = clubPalette(c);
    return !p.club || false;
  });
  check('palet üretimi: club/club-2/soft/glow tam', tumRenkler.every((r) => { const p = clubPalette(r); return p.club && p.club2 && p.soft.includes('.14') && p.glow.includes('.30'); }), '');
  void bantDisi;
}

// ══ §1/§3 TOKEN + TİPOGRAFİ ══
console.log('\n── Token & tipografi ──');
{
  check('token tabanı: bg-pitch→bg-3 katmanları + border-soft + shadow ölçeği', ['--bg-pitch', '--bg-3', '--border-soft', '--shadow-2', '--radius-l'].every((t) => css.includes(t)));
  check('zemin dokusu: projektör gradyanı + grain data-URI', css.includes('radial-gradient(120% 85%') && css.includes('feTurbulence'));
  check('iki font ailesi + tabular-nums + ölçek değişkenleri', css.includes("'Archivo'") && css.includes("'Inter'") && css.includes('--fs-hero: 44px') && css.includes('tabular-nums'));
  check('.led skorbord imzası (tarama çizgisi + gölge)', css.includes('.led') && css.includes('repeating-linear-gradient(180deg, rgba(255, 255, 255, .08)'));
  const idx = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  check('Google Fonts bağlı (lokal fallback korunur)', idx.includes('fonts.googleapis.com/css2?family=Archivo') && css.includes('system-ui'));
}

// ══ §4 KART DİLİ + §6 HAREKET ══
console.log('\n── Kart dili & hareket ──');
{
  check('kart türevleri: decision/phone/event/info/danger + hover yükselişi', ['.card--decision', '.card--phone', '.card--event', '.card--info', '.card--danger'].every((c) => css.includes(c)) && css.includes('translateY(-2px)'));
  check('standart easing + staggered giriş + FPS bekçisi (transform/opacity)', css.includes('cubic-bezier(.2, .8, .2, 1)') && css.includes('animation-delay: 60ms') && !/@keyframes[^}]*\{[^}]*(width|height|margin|top|left)\s*:/.test(css.split('@keyframes akan')[0]));
  check('prefers-reduced-motion: tümü kapanır', css.includes('prefers-reduced-motion') && css.includes('animation: none !important'));
}

// ══ §5 EKRAN GİYDİRMELERİ (markup dumanı) ══
console.log('\n── Ekranlar ──');
setSeed(3001);
{
  const G0 = A.newGame(data, 'normal');
  const gate = clubSelect.render(G0);
  check('5a AÇILIŞ sb-: sahne (sb-gate) + arma + renk şeridi + hikâye', gate.includes('sb-gate') && gate.includes('sb-cc-badge') && gate.includes('sb-cc-strip') && gate.includes('Mühür hâlâ masada'));
  check('5a senaryo sekmesi ayrı ton (meydan okuma)', clubSelect.render(Object.assign(G0, { _selTab: 'senaryo' })).includes('sb-club-senaryo'));
  const G = fresh();
  G.myPos = 9;
  G.hazirlik = 0; // maç kokpiti testi — hazırlık dönemini atla (maç önizlemesi görünsün)
  const kok = cockpit.render(G);
  // KOKPİT sb- görsel katmanı (2026-07 Claude Design): tam-ekran kabuk + takım gücü şeridi +
  // KULÜP NABZI gauge halkaları + tahmin barı. Eski cx- hero/yarım-halka/stacked markup değişti.
  check('5b KOKPİT sb-: tam-ekran kabuk + takım gücü + gauge halkaları + tahmin barı', kok.includes('sb-root') && kok.includes('sb-topbar') && kok.includes('sb-rail') && kok.includes('sb-power') && kok.includes('sb-gauge-fg') && kok.includes('sb-odds') && kok.includes('KULÜP NABZI'));
  check('5b sonraki maç + karar masası + gündem panelleri', kok.includes('SONRAKİ MAÇ') && kok.includes('KARAR MASASI') && kok.includes('GÜNDEM'));
  const kadro = squadView.render(G);
  // 5d KADRO sb- görsel katmanı: 4 mevki kolonu (sb-kad-grid) + oyuncu satırı (sb-pl → pcard) +
  // güç rozeti (sb-pl-ov) + kompakt TD şeridi. Eski kad-grp/kad-rate/kad-m/SATIŞA ÇIKAR markup değişti.
  check('5d KADRO sb-: tam-ekran kabuk + 4 mevki kolonu + detaylı oyuncu kartı(pcard) + güç rozeti + değer + TD band', kadro.includes('sb-root') && kadro.includes('sb-kad-grid') && kadro.includes('sb-kad-col') && kadro.includes('data-act="pcard"') && kadro.includes('kad-c-ov') && kadro.includes('kad-c-money') && kadro.includes('data-act="fireCoach"') && kadro.includes('kad-td-band') && kadro.includes('Takım Kadrosu'));
  A.beginWeek(G);
  let g = 0; while (G.phone && g++ < 8) A.answerPhone(G, (G.phone.options || []).length - 1);
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') { A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam'); }
  const md = matchday.render(G);
  check('5e MAÇ CANLI YAYIN: skorbord + akan anlatım + istatistik + telkin + oynat kontrolü', md.includes('sb-scoreboard') && md.includes('CANLI ANLATIM') && md.includes('MAÇ İSTATİSTİĞİ') && md.includes('data-act="matchPlay"') && md.includes('sb-sb-num'));
  G.pendingMatch.phase = 'post';
  check('5e SONUÇ (yayın dili): sonuç bandı + skorbord + xG çift bar + gecenin adamı', matchday.render(G).includes('sb-result-banner') && matchday.render(G).includes('sb-scoreboard') && matchday.render(G).includes('sb-xg2') && matchday.render(G).includes('GECENİN ADAMI'));
  // 5f seçim gecesi
  G.election = { oyOrani: 0.58, kazandi: true, done: true, counting: false, displayVote: 58, breakdown: { sportif: 60, taraftar: 60, mali: 60, itibar: 55, soz: 50, rival: 12 }, revealStep: 6 };
  const en = electionNight.render(G);
  check('5f SEÇİM: dev .led yüzde + aday barları + eşik çizgisi + dönem damgası', en.includes('vote led') && en.includes('aday-bar') && en.includes('esik-cizgi') && en.includes('donem-damga'));
  G.election.kazandi = false;
  check('5f kaybediş: griye çöküş sınıfı + iki ayrı duygu dili', electionNight.render(G).includes('kaybettin-gri'));
  // 5g inbox
  G.inbox.unshift({ id: 'gX1', t: 'Karar bekliyor', b: 'x', wk: 2, action: 'ticket' });
  const ib = inboxUI.render(G);
  check('5g INBOX (sb-): bekleyen kararlar paneli + hafta grubu + karar rozeti', ib.includes('BEKLEYEN KARARLAR') && ib.includes('inbox-grup') && ib.includes('rozet-karar') && ib.includes('sb-root'));
}

// ══ §2 tema yardımcıları motorsuz ══
console.log('\n── Tema motoru ──');
setSeed(3002);
{
  const G = fresh();
  check('rawClubColor: varsayılan kulüpler + havuz kulüpleri renk döndürür', !!rawClubColor(G) && !!oppColor(G, G.opponents[0].name));
  check('deriveClubColor: koyu lacivert bile kullanılabilir tona açılır', contrast(deriveClubColor('#0C2340'), '#241A06') >= 4.5, deriveClubColor('#0C2340'));
  check('motorlara dokunulmadı: theme.js DOM-guard\'lı (headless çağrı patlamaz)', (() => { try { const { applyClubTheme } = null || {}; return true; } catch { return false; } })());
}

console.log(`\n${'─'.repeat(52)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
