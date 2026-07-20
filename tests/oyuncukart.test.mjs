// tests/oyuncukart.test.mjs — OYUNCU KARTI: 3D dosya kartı + SVG avatar + kiralık listesi.
// Çalıştır: node tests/oyuncukart.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as pc from '../src/ui/playerCard.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function fresh(seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  return G;
}

console.log('\n── Oyuncu Kartı ──');
{
  const G = fresh();
  const p = G.squad[0];
  G._pcard = p.id;
  const h = pc.render(G);
  check('kart render: isim + tüm kritik alanlar', h.includes(p.name) && ['TAHMİNİ BEDEL', 'MAAŞ', 'SÖZLEŞME', 'TD UYUMU', 'KULÜP AİDİYETİ', 'MUTLULUK', 'BAŞKANA GÜVEN', 'Karakter'].every((k) => h.includes(k)));
  check('SVG futbolcu avatarı kartta (forma + numara)', h.includes('<svg') && h.includes('pc-ava'));
  check('aksiyonlar: satış listesi + kiralık listesi butonları', h.includes('data-act="vitrin"') && h.includes('data-act="kiralikListe"'));
  check('kapatma: overlay + ✕ + Kapat', h.includes('pcardClose'));
  check('avatar DETERMİNİSTİK: aynı oyuncu hep aynı yüz', pc.playerAvatar(p) === pc.playerAvatar(p));
  check('farklı oyuncu → farklı avatar', pc.playerAvatar(p) !== pc.playerAvatar(G.squad[1]));
  const u = pc.tdUyum(p, G.coach);
  check('TD uyumu kararlı + hocaya bağlı', u === pc.tdUyum(p, G.coach) && (pc.tdUyum(p, { name: 'Hoca Bir' }) !== u || pc.tdUyum(p, { name: 'Hoca İki' }) !== u), `uyum ${u}`);
  check('kart yokken render boş (guard)', (G._pcard = 'olmayan-id', pc.render(G) === ''));
}
{
  const G = fresh();
  const p = G.squad.find((x) => x.id !== G.captainId && !x.loanIn);
  const m0 = p.morale;
  const r1 = A.toggleKiralikListe(G, p.id);
  check('kiralık listesine koy: bayrak + moral bedeli + inbox', r1.listede === true && p.kiralikListe === true && p.morale < m0 && G.inbox.some((m) => m.t.startsWith('Kiralık listesine kondu')));
  const r2 = A.toggleKiralikListe(G, p.id);
  check('listeden çek: bayrak iner, moral kısmen döner', r2.listede === false && !p.kiralikListe && p.morale > m0 - 3);
  p.loanIn = true;
  check('kiralık GELEN oyuncu listelenemez', A.toggleKiralikListe(G, p.id).ok === false);
  check('kiralık GELEN oyuncu satışa da çıkarılamaz', A.vitrinToggle(G, p.id).ok === false);
  p.loanIn = false;
}
{
  const G = fresh();
  const kap = G.squad.find((x) => x.id === G.captainId);
  if (kap) {
    G._pcard = kap.id;
    check('kaptan kartında C rozeti', pc.render(G).includes('data-tip="Kaptan">C<'));
  } else check('kaptan yoksa test atlanır', true);
  // Aidiyet bağlamsal: satış listesine koyunca düşer
  const p = G.squad.find((x) => x.id !== G.captainId && !x.loanIn);
  const a0 = pc.aidiyet(p, G);
  A.vitrinToggle(G, p.id);
  check('satış listesi kulüp aidiyetini düşürür', pc.aidiyet(p, G) < a0, `${a0} → ${pc.aidiyet(p, G)}`);
}

// TELEFON DOSYASI: gece yarısı fırsatı / panik alım / kiralık — kadroda OLMAYAN konu oyuncusunun kartı açılır
{
  const G = fresh();
  const teklif = { id: 'ph9001', name: 'Bruno Alencar', pos: 'FWD', age: 27, overall: 60, potential: 60, marketValue: 12, wage: 2, contractYears: 2, form: 60, fitness: 70, morale: 60 };
  G.phone = { kind: 'kriz', caller: 'gm', file: { player: teklif, fee: 12.3 } };
  check('findAnyPlayer: aktif telefon teklifindeki oyuncuyu bulur', pc.findAnyPlayer(G, 'ph9001') === teklif);
  G._pcard = 'ph9001';
  const h = pc.render(G);
  check('telefon oyuncusunun kartı render olur (kadroda olmasa da)', h.includes('Bruno Alencar') && h.includes('GÜÇ'));
  check('SİS: teklif oyuncusunun KESİN gücü sızmaz — aralık gösterilir', h.includes('GÜÇ ~') && h.includes('–'));
  // 2026-07-22: lite kart zengin kartla aynı dile geçti — ilişkisel ölçüler artık görünür-KİLİT
  // satırı (etiket + boş segment + 🔒); değişmez olan ETİKET değil DEĞERİN sızmaması.
  const kilitli = h.match(/<div class="pc-mrow pc-kilit"[\s\S]*?<em>🔒<\/em><\/div>/g) || [];
  check('SİS: ilişkisel ölçüler imzadan önce KİLİTLİ (etiket var, değer yok)',
    kilitli.length === 3 && kilitli.every((r) => !r.includes('pc-seg on')) && h.includes('imzadan sonra ölçülür'));
  check('SİS: potansiyel yıldızı (gizli yetenek) sızmaz', !h.includes('POTANSİYEL ★'));
  // kuyruk + ertelenen dosyalar da açılabilir
  const q = { id: 'ph9002', name: 'Kuyruk Oyuncu', pos: 'MID', age: 25, overall: 58, potential: 58, marketValue: 8, wage: 1, contractYears: 2, form: 60, fitness: 70, morale: 60 };
  const d = { id: 'ph9003', name: 'Ertelenen Oyuncu', pos: 'DEF', age: 26, overall: 57, potential: 57, marketValue: 7, wage: 1, contractYears: 2, form: 60, fitness: 70, morale: 60 };
  G.phoneQueue = [{ file: { player: q } }];
  G.phoneDeferred = { file: { player: d } };
  check('findAnyPlayer: telefon kuyruğundaki oyuncuyu bulur', pc.findAnyPlayer(G, 'ph9002') === q);
  check('findAnyPlayer: ertelenen telefon oyuncusunu bulur', pc.findAnyPlayer(G, 'ph9003') === d);
}

console.log('\n' + '─'.repeat(48));
console.log('\n── YABANCI OYUNCU: kart hep LITE (derin raporlu bile) ──');
{
  // BUG REGRESYONU (2026-07-21): derin rapor alınmış PİYASA oyuncusu TAM kadro kartıyla
  // açılıyordu — Jest/Söz/Satış/Sözleşme butonları benim olmayan oyuncuda görünüyordu.
  const G = fresh(9);
  G.transferWindow = true;
  if (!G.market || !G.market.length) G.market = A.makeMarket ? A.makeMarket(G) : G.market;
  const mp = (G.market || [])[0];
  check('piyasa oyuncusu var (ön koşul)', !!mp);
  if (mp) {
    G._pcard = mp.id;
    const hSis = pc.render(G);
    check('sisli yabancı: SKAUT DOSYASI + güç aralıklı + kadro aksiyonları YOK',
      hSis.includes('SKAUT DOSYASI') && !hSis.includes('data-act="vitrin"') && !hSis.includes('data-act="pJest"') && !hSis.includes('Sözleşme Yenile'));
    mp._derin = true; // derin rapor alındı — yalnız GÜÇ netleşir
    const hDerin = pc.render(G);
    check('derin raporlu yabancı: hâlâ LITE kart (KESİN RAPOR başlığı)', hDerin.includes('KESİN RAPOR'));
    check('derin raporlu yabancı: kesin güç + potansiyel görünür', hDerin.includes(`>${mp.overall}<`) || hDerin.includes(String(mp.overall)));
    // 2026-07-22: 'BAŞKANA GÜVEN' etiketi artık kilit satırında görünür (değeri yok) —
    // sızma denetimi kadro aksiyonları + SON 5 MAÇ + kilit satırının DEĞERSİZLİĞİ üzerinden.
    check('derin raporlu yabancı: kadro aksiyonları/iç profil SIZMAZ',
      !hDerin.includes('data-act="vitrin"') && !hDerin.includes('data-act="pJest"') && !hDerin.includes('Sözleşme Yenile') && !hDerin.includes('SON 5 MAÇ')
      && (hDerin.match(/<div class="pc-mrow pc-kilit"[\s\S]*?<em>🔒<\/em><\/div>/g) || []).every((r) => !r.includes('pc-seg on')));
  }
}

console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
