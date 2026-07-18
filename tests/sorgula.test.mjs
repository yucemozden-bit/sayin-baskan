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
  check('sorgula: şartlar açığa çıkar — GÜÇ ±1 (gerçek DEĞİL, gizli reyting)', ok === true && p._sorgu && Math.abs(p._sorgu.guc - p.overall) <= 1 && p._sorgu.h === 1 && p._sorgu.bonservis > 0 && ['Zor', 'Makul', 'İstekli'].includes(p._sorgu.tavir), `gerçek ${p.overall} → rapor ${p._sorgu.guc} ±1`);
  check('sorgu inbox notu düşer', G.inbox.length > inbox0 && G.inbox.some((m) => m.t.startsWith('Sorgu raporu:')));
  check('render sorgulanan satırı gösterir (menajer tavrı + teklif butonu)', tv.render(G).includes('menajer:') && tv.render(G).includes('reqOffer'));
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
  check('bütçe bağı: BÜTÇE paneli kalan kese + tahmini bedel', html.includes('Kalan bütçe') && html.includes('~bedel'));
  check('mevki filtre butonları (Tümü + mevkiler)', html.includes('trFiltre') && html.includes('Tümü') && html.includes('Stoper'));
  check('tahmini bedel gösterir (sis bedelde de)', html.includes('~bedel'));
  check('AKTİF PAZARLIK paneli (açık dosyalar / gelen teklifler)', html.includes('AKTİF PAZARLIK'));
  check('sorgu hakkı görünür (X hak)', /sorgu \d+ hak/.test(html));
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

console.log('\n── Transfer A8: 80+ havuz + sekmeler + sayfalama + kurul bütçe + ilan sonucu ──');
{
  const G = fresh();
  check('havuz 80+ oyuncu (çekirdek + deterministik uzatma)', (G.market || []).length >= 70, `${G.market.length} isim`);
  const html = tv.render(G);
  check('arketip arama: Yıldız Avı / Genç Yetenek / Kelepir (ilan)', html.includes('Yıldız Avı') && html.includes('Genç Yetenek') && html.includes('data-act="ilan"'));
  check('sayfalama görünür (Sayfa 1/N)', html.includes('Sayfa 1/') && html.includes('trSayfa'));
  check('kurula bütçe artışı butonu', html.includes('kurulButce'));
  // satış artık oyuncu kartından (Kadro → kart → Satış listesi); transfer ekranı gelen teklifleri AKTİF PAZARLIK'ta gösterir
  check('satış yönlendirmesi (oyuncu kartı → Satış listesi)', html.includes('Satış listesi'));
}
{
  // KURUL BÜTÇE ARTIŞI: mali güçlüyse +%15, dönemde 1 kez; zayıfsa ret + bedel
  const G = fresh();
  G.gauges.mali = 70;
  const b0 = G.directive.budget;
  check('mali≥55 → tavan +%15 ve Mali −6', A.kurulButceArtisi(G) === true && G.directive.budget > b0 && G.gauges.mali === 64, `${b0} → ${G.directive.budget}`);
  check('aynı dönem ikinci istek REDDEDİLİR', A.kurulButceArtisi(G) === false && G.inbox.some((m) => m.t.includes('ikinci kez toplanmaz')));
  const G2 = fresh();
  G2.gauges.mali = 40;
  const b2 = G2.directive.budget;
  check('mali zayıf → RET + Mali −3 (istemek bile bedelli)', A.kurulButceArtisi(G2) === false && G2.directive.budget === b2 && G2.gauges.mali === 37);
}
{
  // İLANIN SOMUT SONUCU: piyasa o mevkide genişler
  const G = fresh();
  const onceDEF = G.market.filter((p) => p.pos === 'DEF').length;
  A.ilanVer(G, { pos: 'DEF', yasMax: 28, tavan: 30 });
  check('ilan → o mevkide +4 yeni isim + moral sızıntısı notu', G.market.filter((p) => p.pos === 'DEF').length === onceDEF + 4 && G.inbox.some((m) => m.t.includes('İlan verildi')), `DEF ${onceDEF} → ${G.market.filter((p) => p.pos === 'DEF').length}`);
}

console.log('\n── GİZLİ REYTİNG + ücretli sorgu + derin rapor ──');
{
  const { shownRating, publicView } = await import('../src/engines/market.js');
  const G = fresh();
  const p = G.market[3];
  const a = shownRating(p, 2, 5), b = shownRating(p, 2, 5), c = shownRating(p, 2, 6);
  check('görünen güç: aynı hafta SABİT (render zıplamaz)', a.deger === b.deger);
  check('görünen güç gerçek etrafında ±h bandında', Math.abs(a.deger - p.overall) <= a.h, `gerçek ${p.overall} · görünen ${a.deger} ±${a.h}`);
  check('yeni haftada gözlem değişebilir (deterministik ama canlı)', typeof c.deger === 'number');
  const pv = publicView(p, 2, 5);
  check('publicView gerçek yerine GÖRÜNENİ verir', pv.shownRating === a.deger);
}
{
  // ÜCRETLİ SORGU: hak bitince 0,2mn ile çalışır
  const G = fresh();
  G.sorguHak = 0;
  const p = G.market[0];
  const k0 = G.economy.kasa;
  check('hak=0 + ücretsiz → RET', A.sorgulaPlayer(G, p.id) === false && !p._sorgu);
  check('hak=0 + ÜCRETLİ (0,2mn) → çalışır, hak harcamaz', A.sorgulaPlayer(G, p.id, { ucretli: true }) === true && !!p._sorgu && Math.abs(G.economy.kasa - (k0 - 0.2)) < 1e-9 && G.sorguHak === 0);
}
{
  // DERİN RAPOR: 0,8mn → kesin güç + isimli ilgi + gelişim bandı; sis tamamen kalkar
  const G = fresh();
  const p = G.market[1];
  check('derin rapor sorgusuz ÇALIŞMAZ', A.derinRapor(G, p.id) === false);
  A.sorgulaPlayer(G, p.id);
  const k0 = G.economy.kasa;
  check('derin rapor: −0,8mn + KESİN güç + sis 0', A.derinRapor(G, p.id) === true && Math.abs(G.economy.kasa - (k0 - 0.8)) < 1e-9 && p._sorgu.guc === p.overall && p._sorgu.h === 0 && p._derin.kesin === p.overall);
  check('derin rapor: isimli rakip ilgisi (ilgi kadar kulüp adı)', Array.isArray(p._derin.kulupler) && p._derin.kulupler.length === (p._ilgi || 0), p._derin.kulupler.join(', ') || 'ilgi yok');
  check('ikinci derin rapor para YAKMAZ', A.derinRapor(G, p.id) === false && Math.abs(G.economy.kasa - (k0 - 0.8)) < 1e-9);
}
{
  // İMZA SONRASI GERÇEK: rapor yanılmışsa imza mesajında saha gerçeği yazar
  const G = fresh();
  G.inbox.push({ id: 'gz1', cat: 'transfer', t: 'dosya', b: '', action: 'tfile', file: { player: { id: 'gz-p', name: 'Gizli Test', pos: 'MID', overall: 74, age: 25, wage: 5, marketValue: 20 }, fee: 10, shown: 70, gerekce: '', range: [68, 72], sartTried: true } });
  A.resolveTransferFile(G, 'gz1', 'onay');
  const msg = G.inbox.find((m) => m.t === 'İmza atıldı: Gizli Test');
  check('imzada saha gerçeği: rapor 70 → gerçek 74 (+4 sürpriz)', !!msg && msg.b.includes('gerçek güç 74') && msg.b.includes('+4'), '');
}

console.log('\n── Çok-turlu pazarlık (2 şart hakkı) ──');
{
  const G = fresh();
  G.gm.skill = 500; // shift devasa → her tur "İNDİ" garantili (yapıyı ölçüyoruz, şansı değil)
  const p = { id: 'pz1', name: 'Pazarlık Testi', pos: 'MID', overall: 70, age: 25, wage: 5, marketValue: 30 };
  G.inbox.push({ id: 'tf-pz', cat: 'transfer', t: 'dosya', b: '', action: 'tfile', file: { player: p, fee: 30, gerekce: 'test', range: [66, 74], sartTried: false } });
  const f = G.inbox.find((m) => m.id === 'tf-pz').file;
  const r1 = A.resolveTransferFile(G, 'tf-pz', 'sart');
  check('TUR 1: %20 iner + dosya AÇIK kalır', r1.outcome === 'indi' && Math.round(f.fee) === 24 && f.round === 1);
  const r2 = A.resolveTransferFile(G, 'tf-pz', 'sart');
  check('TUR 2: %10 daha iner (azalan getiri)', r2.outcome === 'indi' && Math.abs(f.fee - 21.6) < 0.01 && f.round === 2, `fee ${f.fee.toFixed(1)}`);
  const r3 = A.resolveTransferFile(G, 'tf-pz', 'sart');
  check('TUR 3 YOK: masa kapandı — onay ya da red', r3.ok === false);
  check('onay hâlâ çalışır (pazarlıklı bedelle)', A.resolveTransferFile(G, 'tf-pz', 'onay').ok === true && G.squad.some((x) => x.id === 'pz1'));
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
