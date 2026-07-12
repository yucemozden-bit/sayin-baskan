// tests/setup.test.mjs — SETUP ekranı (kariyer kuruluşu): başkan adı + kulüp adı/renk +
// şehir + zorluk kilidi + Devam Et banner'ı. Çalıştır: node tests/setup.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as setupUi from '../src/ui/setup.js';
import * as clubSelect from '../src/ui/clubSelect.js';
import { rawClubColor } from '../src/ui/theme.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

console.log('\n── SETUP ekranı (render) ──');
{
  setSeed(42);
  const G = A.newGame(data, 'normal');
  G.phase = 'SETUP';
  G._setup = { tier: 'orta', identity: null, mode: 'klasik', zorluk: 'normal' };
  const h = setupUi.render(G);
  check('form alanları: başkan adı + kulüp adı + şehir', h.includes('su-baskan') && h.includes('su-kulup') && h.includes('su-sehir'));
  check('renk paleti + zorluk seçimi + başlat', h.includes('setupRenk') && h.includes('setupZorluk') && h.includes('setupStart') && h.includes('Kariyeri Başlat'));
  check('geri dönüş var', h.includes('setupGeri'));
}
console.log('\n── applySetup (mekanik) ──');
{
  setSeed(42);
  const G = A.newGame(data, 'normal');
  A.applySetup(G, { tier: 'orta', identity: null, mode: 'klasik', zorluk: 'kolay', baskanAd: 'Yücem Özden', kulupAd: 'Efsane FK', sehir: 'İzmir', renk: '#C0392B' });
  check('başkan adı işlendi (seçim zaferi bu adı kullanır)', G.baskan && G.baskan.name === 'Yücem Özden');
  check('kulüp adı + şehir + renk işlendi', G.club.name === 'Efsane FK' && G.club.sehir === 'İzmir' && G.club.renk === '#C0392B');
  check('tema özel rengi okur', rawClubColor(G) === '#C0392B');
  check('zorluk KİLİTLENDİ (kolay → WIN_LINE %50)', G.difficulty === 'kolay' && Math.abs(G.cfg.WIN_LINE - 0.50) < 1e-9, `WIN_LINE ${G.cfg.WIN_LINE}`);
  check('kariyer başladı (TERM_SETUP fazına düştü)', G.phase === 'TERM_SETUP');
}
{
  // Boş bırakılanlar varsayılana düşer + lig2 yolu
  setSeed(7);
  const G = A.newGame(data, 'normal');
  A.applySetup(G, { tier: 'lig2', identity: null, zorluk: 'zor' });
  check('lig2 kuruluşu: 2. lig + varsayılan ad', G.lig === 2 && G.club.name === 'Demiryolu SK' && G.difficulty === 'zor');
  check('başkan adı zorunlu değil (zafer sahnesi kendi üretir)', !G.baskan || !!G.baskan.name);
}
console.log('\n── Devam Et banner\'ı ──');
{
  setSeed(42);
  const G = A.newGame(data, 'normal');
  G._devamVar = { season: 2, week: 14, club: 'Yıldızspor' };
  const h = clubSelect.render(G);
  check('kayıt varsa açılışta Devam Et sunulur', h.includes('Devam Et') && h.includes('contSave') && h.includes('Sezon 2, Hafta 14'));
  G._devamVar = null;
  check('kayıt yoksa banner yok', !clubSelect.render(G).includes('contSave'));
}

console.log('\n' + '─'.repeat(48));
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
