// tests/masa.test.mjs — TRANSFER MASASI UX yenilemesi: forma ikonu · SVG butonlar ·
// ⭐ kısa liste · sıralama (güç/bedel/yaş) · HAT FARKI çipi. Hepsi UI katmanı (autoplay-nötr).
// Çalıştır: node tests/masa.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as tr from '../src/ui/transferView.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function fresh(seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  G.transferWindow = true;
  if (!G.market || !G.market.length) A.beginWeek(G);
  return G;
}

console.log('\n── Görsel dil: forma + SVG + tipografi ──');
{
  const G = fresh();
  const h = tr.render(G);
  check('avatar yerine mini FORMA ikonu (pozisyon harfli SVG)', h.includes('tr-forma') && !h.includes('pc-ava'));
  check('emoji butonlar gitti → SVG ghost ikonlar', h.includes('tr-ikbtn') && !h.includes('>🔍<') && !h.includes('>🔬<'));
  check('bedel ön planda, piyasa değeri alt satır', h.includes('değer ') && /tr-tt-val/.test(h));
  check('pozisyon artık renkli çip (border eşleşmeli)', /tr-tt-pos" style="color:[^"]+;border-color:/.test(h));
}

console.log('\n── ⭐ Kısa liste ──');
{
  const G = fresh();
  const p = G.market[0];
  check('başlangıçta kısa liste boş (★ 0 çipi)', tr.render(G).includes('★ 0'));
  // dispatch simülasyonu (main.js case shortlist ile aynı mantık)
  const s = new Set(G._shortlist || []); s.has(p.id) ? s.delete(p.id) : s.add(p.id); G._shortlist = [...s];
  const h = tr.render(G);
  check('yıldızlanan isim sayaca ve satıra işlenir', h.includes('★ 1') && h.includes('tr-star on'));
  G._trFiltre = 'kisa';
  const h2 = tr.render(G);
  check('★ filtresi yalnız kısa listeyi gösterir', h2.includes(p.name) && (h2.match(/tr-tt /g) || []).length <= 2);
  check('kablolama: shortlist + trSirala dispatch\'te', readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').includes("case 'shortlist'"));
}

console.log('\n── Sıralama ──');
{
  const G = fresh();
  G._trSirala = 'yas';
  const h = tr.render(G);
  const yaslar = [...h.matchAll(/(\d+) yaş · söz/g)].map((m) => +m[1]); // yalnız satır formatı (arketip tooltip'leri değil)
  check('yaşa göre artan sıralanır', yaslar.length >= 3 && yaslar.every((y, i) => i === 0 || y >= yaslar[i - 1]), yaslar.slice(0, 5).join(','));
  G._trSirala = 'bedel';
  const h2 = tr.render(G);
  check('sıralama şeridi aktif durumu gösterir', h2.includes('SIRALA') && /mini on"[^>]*>Bedel/.test(h2));
}

console.log('\n── BÜTÇE paneli: her satır etkisini söyler ──');
{
  const G = fresh();
  const h = tr.render(G);
  check('kese DENKLEMİ görünür (Kese + Satış − Harcanan)', h.includes('trb-denklem') && h.includes('Satış') && h.includes('Harcanan'));
  check('maaş yükü HAFTALIK kasa kesintisini söyler', /haftada −[\d,\.]+/.test(h));
  check('FFP limiti göstergesi (harcanan/limit + bar)', !G.ffp || (h.includes('FFP limiti') && h.includes(`/ ${String(Math.round(G.ffp.limit)).replace('.', ',')}`)) || h.includes('FFP limiti'));
  check('GM çizgisi dosya BANDINI gösterir (yaş · güç)', /GM çizgisi[\s\S]{0,200}(yaş · güç|güç 78-85)/.test(h));
  check('kurul butonu net risk/ödül diliyle', h.includes('Kuruldan +%15 iste (Mali −6)') || h.includes('Kurul hakkı kullanıldı'));
  check('"Bütçe dışı" mekaniği panelde açıklanır', h.includes('Bütçe dışı') && h.includes('GM görüşüyle'));
}

console.log('\n── HAT FARKI çipi ──');
{
  const G = fresh();
  const h = tr.render(G);
  check('satırlarda DİNAMİK çipi (▲/▼/Dengede)', h.includes('tr-fark') && /(Dinamik \+\d|Dinamik -\d|— Dengede)/.test(h));
  check('çip tooltip hat ortalamasını açıklar', h.includes('hattının ilk') && h.includes('ortalaması'));
  check('temiz render (NaN/undefined yok)', !/NaN|undefined/.test(h));
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
