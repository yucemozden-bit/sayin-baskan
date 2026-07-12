// tests/sorgula.test.mjs — TRANSFER: piyasa oyuncusunu sorgula + GM'e teklif iste.
// Çalıştır: node tests/sorgula.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as tv from '../src/ui/transferView.js';
import { generateMarket } from '../src/engines/transfer.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function fresh(seed = 3) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  return G;
}

console.log('\n── Sorgula + Teklif İste ──');
{
  const G = fresh();
  check('pencere açık + piyasa dolu', G.transferWindow === true && (G.market || []).length > 0, `${(G.market || []).length} oyuncu`);
  const p = G.market[0];
  const inbox0 = G.inbox.length;
  const ok = A.sorgulaPlayer(G, p.id);
  check('sorgula: şartlar açığa çıkar (güç/maaş/bonservis/tavır)', ok === true && p._sorgu && p._sorgu.guc === p.overall && p._sorgu.bonservis > 0 && ['Zor', 'Makul', 'İstekli'].includes(p._sorgu.tavir), p._sorgu ? `${p._sorgu.tavir}` : '');
  check('sorgu inbox notu düşer (derin rapor)', G.inbox.length > inbox0 && G.inbox.some((m) => m.t.startsWith('Derin rapor:')));
  check('render sorgulanan tile\'ı gösterir (şart satırı + teklif butonu)', tv.render(G).includes('tr-sorgu') && tv.render(G).includes('reqOffer'));
  // ikinci sorgu idempotent
  const before = JSON.stringify(p._sorgu);
  A.sorgulaPlayer(G, p.id);
  check('tekrar sorgula değiştirmez (idempotent)', JSON.stringify(p._sorgu) === before);
}
{
  const G = fresh();
  const p = G.market[0];
  A.sorgulaPlayer(G, p.id);
  const ok = A.requestOffer(G, p.id);
  const file = G.inbox.find((m) => m.action === 'tfile' && m.file && m.file.player && m.file.player.id === p.id);
  check('teklif iste: GM onay dosyası (tfile) inbox\'a gelir', ok === true && !!file && file.file.fee > 0);
  check('teklif edilen oyuncu piyasadan çekilir', !(G.market || []).some((x) => x.id === p.id));
  // aynı oyuncu için ikinci istek yeni dosya açmaz
  const cnt = G.inbox.filter((m) => m.action === 'tfile' && m.file && m.file.player && m.file.player.id === p.id).length;
  check('aynı oyuncuya ikinci teklif mükerrer dosya açmaz', cnt === 1, `${cnt} dosya`);
}
{
  const G = fresh();
  G.transferWindow = false;
  const p0 = { id: 'x1', name: 'Test', pos: 'MID', overall: 60, age: 25, wage: 5, marketValue: 12 };
  G.market = [p0];
  const ok = A.requestOffer(G, 'x1');
  check('pencere kapalıyken teklif iletilmez', ok === false && !G.inbox.some((m) => m.action === 'tfile' && m.file && m.file.player.id === 'x1'));
}

console.log('\n── Transfer v3: bütçe bağı + sorgu hakkı + ilgi/süre + açık dosyalar ──');
{
  const G = fresh();
  const html = tv.render(G);
  check('bütçe-piyasa bağı: ✔/⚠/✖ işaretleri + filtre barı', html.includes('bütçe içi') || html.includes('bütçe dışı'), '');
  check('filtre butonları (Bütçeme uyanlar / İhtiyaç / Hepsi)', html.includes('Bütçeme uyanlar') && html.includes('İhtiyacım:') && html.includes('trFiltre'));
  check('bedel ARALIK gösterir (sis bedelde de)', html.includes('tr-aralik'));
  check('Açık Dosyalar paneli alt yarıda', html.includes('Açık Dosyalar'));
  check('sorgu hakkı görünür (X hak)', /Sorgula \(\d+ hak\)/.test(html));
}
{
  // SORGU HAKKI: haftalık limit — hak bitince sorgu reddedilir
  const G = fresh();
  G.sorguHak = 1;
  const [p1, p2] = G.market;
  check('hak varken sorgu çalışır + DERİN RAPOR (karakter/sakatlık/ilgi)', A.sorgulaPlayer(G, p1.id) === true && p1._sorgu.karakter && ['temiz', 'riskli'].includes(p1._sorgu.sakatlik) && p1._sorgu.ilgi != null, p1._sorgu.karakter);
  check('hak bitince sorgu REDDEDİLİR + inbox notu', A.sorgulaPlayer(G, p2.id) === false && !p2._sorgu && G.inbox.some((m) => m.t === 'Sorgu hakkı bitti'));
}
{
  // RAKİP İLGİSİ + SÜRE: scoutTick ilgi/süre işler; süresi dolan RAKİBE gider
  const G = fresh();
  A.scoutTick(G); // ilk tick: _ilgi/_kalan tohumlanır
  check('piyasada ilgi + kalan hafta tohumlandı', G.market.every((p) => p._ilgi != null && p._kalan >= 1));
  const kurban = G.market[0];
  kurban._kalan = 1;
  A.scoutTick(G); // süre düşer → 0 → kaçar
  check('süresi dolan oyuncu RAKİBE İMZA ATAR (piyasadan çıkar + inbox)', !G.market.some((x) => x.id === kurban.id) && G.inbox.some((m) => m.t.includes('rakibe imza attı')), kurban.name);
}
{
  // BÜTÇE DIŞI → GM İTİRAZI (satışı öne çıkarır)
  const G = fresh();
  const pahali = G.market.slice().sort((a, b) => (b.fee || 0) - (a.fee || 0))[0];
  check('GM itirazı: kurul kapıyı kapatır + satışı işaret eder', A.gmBudgetItiraz(G, pahali.id) === true && G.inbox.some((m) => m.b.includes('Kurul kapıyı') && m.b.includes('satın')));
}

console.log('\n── Teklif: Beklet (%20 kalır / %80 kaçar) ──');
{
  const G = fresh();
  let kaldi = 0, kacti = 0;
  for (let i = 0; i < 60; i++) {
    const p = { id: 't' + i, name: 'T' + i, pos: 'MID', overall: 70, age: 25, wage: 5, marketValue: 20 };
    G.phone = { kind: 'kriz', options: [{ key: 'onay' }, { key: 'red' }, { key: 'beklet' }], file: { player: p, fee: 15 } };
    const b = G.inbox.filter((m) => m.action === 'tfile').length;
    A.answerPhone(G, 2);
    if (G.inbox.filter((m) => m.action === 'tfile').length > b) kaldi++; else kacti++;
  }
  check('Beklet riskli: bazı dosyalar inbox\'ta kalır, çoğu kaçar', kaldi >= 1 && kacti > kaldi, `kaldı ${kaldi} · kaçtı ${kacti}`);
}

console.log('\n── Sürekli Scouting ──');
{
  const G = fresh();
  for (let i = 0; i < 5 && G.meta.week <= G.SEASON_WEEKS; i++) A.advanceWeek(G);
  const yeni = (G.market || []).filter((p) => String(p.id).startsWith('mkt-w'));
  check('piyasa haftalık tazelenir (yeni isimler gelir)', yeni.length >= 1, `${yeni.length} yeni isim`);
}
{
  setSeed(50); const low = generateMarket(70, { names: data.names, scout: 1 });
  setSeed(50); const high = generateMarket(70, { names: data.names, scout: 6 });
  const avgL = low.reduce((a, b) => a + b.overall, 0) / low.length;
  const avgH = high.reduce((a, b) => a + b.overall, 0) / high.length;
  check('gözlemci ağı geliştikçe daha iyi oyuncu (scout↑ → ort güç↑)', avgH >= avgL, `${avgL.toFixed(1)} → ${avgH.toFixed(1)}`);
}

console.log('\n' + '─'.repeat(48));
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
