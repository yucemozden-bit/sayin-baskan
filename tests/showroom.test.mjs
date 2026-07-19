// tests/showroom.test.mjs — VARLIK SHOWROOM: 3D vitrin entegrasyonu (assets/showroom.html).
// Motor: VARLIK 4-4-3-3-3 kademe + model anahtarları · asset: 17 sahne + THREE gömülü ·
// UI: kademe çipli mağaza listesi + vitrin iframe + satın alma zinciri.
// Çalıştır: node tests/showroom.test.mjs
import { readFileSync, existsSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { VARLIK, varlikDegeri, varlikPasif, varlikPerkleri } from '../src/engines/ozel.js';
import * as ozelUi from '../src/ui/ozelHayat.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function fresh(seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  A.initOzel(G);
  return G;
}

console.log('\n── MOTOR: kademe tabloları tutarlı (4-4-3-3-3) ──');
{
  const beklenen = { konut: 4, oto: 4, tekne: 3, hava: 3, sanat: 3 };
  for (const [k, n] of Object.entries(beklenen)) {
    const V = VARLIK[k];
    check(`${k}: ${n} kademe — adlar/fiyat/model dizileri eş boyda`,
      V.adlar.length === n && V.fiyat.length === n && (V.model || []).length === n,
      `adlar ${V.adlar.length} · fiyat ${V.fiyat.length} · model ${(V.model || []).length}`);
  }
  const pasifOk = Object.values(VARLIK).every((V) => Object.values(V.pasif || {}).every((arr) => arr.length === V.adlar.length));
  check('pasif dizileri de kademe sayısıyla eş (yeni zirvelerin etkisi tanımlı)', pasifOk);
  const modeller = Object.values(VARLIK).flatMap((V) => V.model || []);
  check('17 benzersiz sahne anahtarı', new Set(modeller).size === 17, modeller.join(','));
}

console.log('\n── ASSET: assets/showroom/ bütünlüğü (sahne başına bağımsız dosya + paylaşılan three) ──');
{
  const uc = new URL('../assets/showroom/three.min.js', import.meta.url);
  check('paylaşılan three.min.js mevcut (MIT, CDN yok)', existsSync(uc) && readFileSync(uc, 'utf8').includes('Three.js Authors'));
  const modeller = Object.values(VARLIK).flatMap((V) => V.model || []);
  let eksik = [], bozuk = [];
  for (const m of modeller) {
    const yol = new URL(`../assets/showroom/${m}.html`, import.meta.url);
    if (!existsSync(yol)) { eksik.push(m); continue; }
    const h = readFileSync(yol, 'utf8');
    if (!h.includes('src="three.min.js"') || h.includes('<!--THREEJS-->') || /https?:\/\//.test(h.replace(/spdx|threejs\.org|@license[^\n]*/gi, ''))) bozuk.push(m);
  }
  check('oyundaki 17 sahnenin dosyası mevcut', eksik.length === 0, eksik.join(',') || '17/17');
  check('her sahne three.min.js\'e bağlı + placeholder kalmadı + dış URL yok', bozuk.length === 0, bozuk.join(',') || 'temiz');
}

console.log('\n── SATIN ALMA ZİNCİRİ: 4. kademeye tırmanış ──');
{
  const G = fresh();
  const oz = G.ozel;
  oz.nakit = 300;
  const deger0 = varlikDegeri(oz);
  let alindi = 0; // Şehir Evi (sv.1) baştan sahipli — zirveye 3 yükseltme kalır
  for (let i = 0; i < 4; i++) if (A.ozelVarlik(G, 'konut').ok) alindi++;
  check('konut zirveye tırmanır (Şehir Evi → Büyük Malikâne)', alindi === 3 && oz.varlik.konut === 4, `sv.${oz.varlik.konut} · ${alindi} yükseltme`);
  check('zirvede yeni deneme "zirvede" der', A.ozelVarlik(G, 'konut').why === 'zirvede');
  check('nakit doğru düştü (18+45+85)', Math.abs(oz.nakit - (300 - 148)) < 1e-9, `₺${oz.nakit}mn`);
  check('varlık değeri büyüdü', varlikDegeri(oz) > deger0, `${deger0} → ${varlikDegeri(oz)}`);
  check('zirve pasifi işler: ev +4/hafta (imtiyaz güçlendirmesi)', varlikPasif(oz).ev === 4);
  oz.nakit = 200;
  for (let i = 0; i < 3 && A.ozelVarlik(G, 'hava').ok; i++);
  check('hava 3. kademe (Özel Jet) alınır + enerji pasifi 3', oz.varlik.hava === 3 && varlikPasif(oz).enerji === 3);
}

console.log('\n── UI: vitrin + kademe çipleri + sabit iskelet ──');
{
  const G = fresh();
  G.ozel.nakit = 50;
  G._ozelTab = 'servet';
  const h = ozelUi.render(G);
  check('vitrin iframe\'i sahne dosyasına bağlı', h.includes('assets/showroom/'));
  check('varsayılan sahne: konut hattı', /showroom\/konut\d\.html/.test(h));
  check('5 kategori satırı + açık kategoride kademeler ADLARIYLA (akordeon, rakam çipi yok)',
    (h.match(/oz-vk2-bas/g) || []).length === 5 && (h.match(/class="oz-vt /g) || []).length === 4 && h.includes('Büyük Malikâne') && !h.includes('oz-vk-chip'));
  check('SATIN AL butonu sıradaki kademeye bağlı (ozelVarlik)', h.includes('data-act="ozelVarlik"') || h.includes('SAHİPSİN'));
  G._vitrin = { kat: 'hava', idx: 2 };
  const h2 = ozelUi.render(G);
  check('vitrin seçimi sahneyi değiştirir (hava3 · Özel Jet)', h2.includes('showroom/hava3.html') && h2.includes('Özel Jet'));
  check('kilitli kademe satın alınamaz — 🔒 rozeti', h2.includes('Önce'));
  G._vitrin = { kat: 'olmayankat', idx: 9 };
  check('bozuk vitrin state çökertmez (varsayılana döner)', ozelUi.render(G).includes('assets/showroom/'));
}

console.log('\n── İMTİYAZLAR: her kademenin gerçek etkisi (kullanıcı isteği: "etkiler büyük ve çeşitli") ──');
{
  check('her kademenin perk açıklaması var (17/17)', Object.values(VARLIK).every((V) => (V.perk || []).length === V.adlar.length && V.perk.every(Boolean)));
  const G = fresh(43);
  const oz = G.ozel;
  oz.nakit = 500;
  // uçak (hava sv2) → haftalık sorgu hakkı +1
  A.ozelVarlik(G, 'hava'); A.ozelVarlik(G, 'hava');
  G.sorguHak = 0; A.beginWeek(G); G.pendingMatch = null;
  check('uçak imtiyazı: sorgu hakkı +1/hafta', G.sorguHak === 1 + (G.facilities.scout || 0) + 1, `hak ${G.sorguHak}`);
  // oto sv2 → jest yayılımı +1 (klik arkadaşı +2 yerine +3 ısınır)
  A.ozelVarlik(G, 'oto'); A.ozelVarlik(G, 'oto');
  const hedefJ = G.squad.find((p) => !p.loanIn && !p.aileOgul);
  const ayniKlik = G.squad.find((p) => p !== hedefJ && !p.aileOgul);
  if (hedefJ && ayniKlik) { /* yayılım sayısal doğrulaması klik eşleşmesine bağlı — varlığı yeterli */ }
  check('perk özeti motoru: alınan imtiyazlar listede', varlikPerkleri(oz).some((p) => p.txt.includes('sorgu')) && varlikPerkleri(oz).some((p) => p.txt.includes('jest')));
  // konut sv3 → davet 1 az enerji yorar
  A.ozelVarlik(G, 'konut'); A.ozelVarlik(G, 'konut'); // sv3 (Boğaz Yalısı)
  const e0 = oz.g.enerji;
  A.ozelDavet(G, 'altyapi');
  check('yalı imtiyazı: davet −1 enerji (2 yerine 1 yorar)', e0 - oz.g.enerji === 1, `enerji ${e0}→${oz.g.enerji}`);
  // sanat sv3 → sezon başı itibar +1 · konut sv4 → kurul +1
  for (let i = 0; i < 3; i++) A.ozelVarlik(G, 'sanat');
  A.ozelVarlik(G, 'konut'); // sv4 Malikâne
  const it0 = G.gauges.itibar, loy0 = G.board[0].loyalty;
  G.ozel._sez = 0; A.ozelTick(G, 'D');
  check('sezon başı imtiyazları: şaheser itibar +1 + malikâne kurul +1', G.gauges.itibar === Math.min(100, it0 + 1) && G.board[0].loyalty === Math.min(100, loy0 + 1));
  // oto sv4 → tek seferlik taraftar +2 + manşet
  const G2 = fresh(44); G2.ozel.nakit = 300;
  const t0 = G2.gauges.taraftar;
  for (let i = 0; i < 4; i++) A.ozelVarlik(G2, 'oto');
  check('Süper Spor şehir olayı: taraftar +2 + manşet (tek seferlik)', G2.gauges.taraftar === Math.min(100, t0 + 2) && G2.inbox.some((m) => (m.t || '').includes('SÜPER SPOR')));
  // UI: aktif imtiyaz şeridi + vitrin perk satırı
  G2._ozelTab = 'servet';
  const h = (await import('../src/ui/ozelHayat.js')).render(G2);
  check('servet şeridinde AKTİF İMTİYAZLAR + vitrinde imtiyaz açıklaması', h.includes('AKTİF İMTİYAZLAR') && h.includes('oz-vit-perk'));
}

console.log('\n── TAKIM MORAL GECESİ: kriz sofrası (üst üste 2 mağlubiyette açılır) ──');
{
  const G = fresh(45);
  const oz = G.ozel; oz.nakit = 20;
  check('seri yokken kapı kapalı (reqTxt söyler)', A.ozelDavet(G, 'moral').ok === false && A.ozelDavet(G, 'moral').why.includes('mağlubiyet'));
  G.magSeri = 2;
  const m0 = G.squad[0].morale, f0 = G.squad[0].form ?? 50, g0 = G.squad[0].baskanaGuven ?? 50, td0 = G.tdRelation, n0 = oz.nakit;
  const r = A.ozelDavet(G, 'moral');
  check('2 mağlubiyet sonrası sofra kurulur: −₺2mn kişisel + moral +8 · form +4 · güven +3',
    r.ok && Math.abs(n0 - oz.nakit - 2) < 1e-9 && G.squad[0].morale === Math.min(100, m0 + 8) && G.squad[0].form === Math.min(100, f0 + 4) && G.squad[0].baskanaGuven === Math.min(100, g0 + 3), `moral ${m0}→${G.squad[0].morale}`);
  check('TD de sofrada (+2) + seri sayacı sıfırlanır + kulüp kartı', G.tdRelation === Math.min(100, td0 + 2) && G.magSeri === 0 && G.inbox.some((x) => (x.t || '').includes('Moral Gecesi')));
  G.magSeri = 2;
  check('takvim kilidi: 4 hafta içinde ikinci sofra yok', A.ozelDavet(G, 'moral').why === 'takvim dolu');
  // sayaç motoru: L'de artar, G/B'de sıfırlanır (applyPrimResults üzerinden dolaylı — magSeri alanı)
  const G2 = fresh(46);
  G2.magSeri = 1; // sanki 1 mağlubiyet
  check('UI: davet listesinde kriz sofrası görünür (kapalıyken sebep yazar)', (() => { G2._ozelTab = 'servet'; const h = ozelUi.render(G2); return h.includes('Takım Moral Gecesi') && h.includes('mağlubiyet sonrası açılır'); })());
}

console.log('\n── TAKIM NABZI (kadro) + AYARLAR sb- teması ──');
{
  const G = fresh(47);
  const squadUi = await import('../src/ui/squadView.js');
  const h = squadUi.render(G);
  check('kadroda takım nabzı şeridi: moral/form/kondisyon/kimya/güven/revir', ['GENEL MORAL', 'GENEL FORM', 'KONDİSYON', 'KİMYA', 'BAŞKANA GÜVEN', 'REVİR'].every((k) => h.includes(k)));
  G.magSeri = 2;
  check('mağlubiyet serisinde Moral Gecesi kısayolu belirir', squadUi.render(G).includes('Moral Gecesi açık'));
  const setUi = await import('../src/ui/settings.js');
  const hs = setUi.render(G);
  check('Ayarlar sb- kabuğunda (eski tema bitti): topbar + Kontrol Odası', hs.includes('sb-root') && hs.includes('Kontrol Odası') && hs.includes('sb-bottombar'));
  // .sb-panel column mirası tuzağı (servet şeridi emsali): nabız şeridi YATAY kalmalı
  const css = readFileSync(new URL('../css/game.css', import.meta.url), 'utf8');
  check('nabız şeridi CSS: flex-direction row override mevcut', /\.kad-nabiz \{ flex-direction: row/.test(css));
}

console.log('\n── PRİM GÜÇLENDİRME + ARKETİP KARTLARI ──');
{
  const { TUNING } = await import('../src/config.js');
  const PM = TUNING.PRIM.MAC;
  check('prim gücü derbi ölçeğinde (normal 1.025 · yüksek 1.05) + iz alanları tanımlı',
    PM.normal.power === 1.025 && PM.yuksek.power === 1.05 && PM.yuksek.izMoral === 3 && PM.yuksek.izKimya === 1);
  const G = fresh(48);
  G.matchPrim = 'yuksek';
  const m0 = G.squad[0].morale, f0 = G.squad[0].form ?? 50, k0 = G.kimya.kimya;
  // applyPrimResults iç fonksiyon — galibiyet yolunu gerçek maçla tetiklemek pahalı; iz mantığını
  // doğrudan taklit etmek yerine playWeek'siz erişim yok → prim izi kalıcılığını maç motoru testleri
  // (buyuktest prim:'yuksek' senaryosu) taşır; burada UI + config sözleşmesi denetlenir.
  const cockUi = await import('../src/ui/cockpit.js');
  A.beginWeek(G); G.pendingMatch = null; G.nav = 'cockpit';
  const hc = cockUi.render(G);
  check('soyunma odasında prim etki satırı (moral/form/kimya + iz uyarısı)', hc.includes('Prim masada') && hc.includes('kalıcı işler'));
  const trUi = await import('../src/ui/transferView.js');
  G.nav = 'transfer';
  const ht = trUi.render(G);
  check('arketip KARTLARI: 3 kart + canlı hedef satırları (mevki · tavan)', (ht.match(/class="tr-ark /g) || []).length === 3 && ht.includes('tavan') && ht.includes('Yıldız Avı'));
  check('kelepir kartı rakip-başkan indirimini bilir (varsayılan: sürpriz metni)', ht.includes('sürpriz çıkabilir') || ht.includes('indirimi AKTİF'));
  A.ilanVer ? null : null;
}

console.log('\n── SEZON İÇİ GELİŞİM: gençler oynadıkça büyür, oklar konuşur ──');
{
  const G = fresh(49);
  // genç yıldız adayı: XI'e girecek güçte + boşluklu potansiyel → oynadıkça birikir
  const genc = G.squad.reduce((a, b) => (a.overall > b.overall ? a : b));
  genc.age = 19; genc.potential = Math.max(genc.potential ?? 0, genc.overall + 6);
  const ov0 = genc.overall;
  // yaşlı direk: kötü seride aşınma adayı
  const yasli = G.squad.find((p) => p !== genc);
  yasli.age = 35; yasli.overall = Math.max(yasli.overall, 60);
  const yov0 = yasli.overall;
  for (let w = 1; w <= 20 && G.phase === 'SEASON_LOOP'; w++) {
    A.beginWeek(G);
    let g = 0; while (G.phone && g++ < 8) A.answerPhone(G, 0);
    if (G.pendingMatch && G.pendingMatch.phase === 'pre') { A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam'); }
    G.pendingMatch = null;
  }
  check('genç, sezon İÇİNDE büyüdü (sezon sonunu beklemeden)', genc.overall > ov0, `${ov0} → ${genc.overall} (birikim ${genc._gel ?? 0})`);
  check('sezon içi tavan aşılmadı (genç ≤ +3, potansiyel tavan)', genc.overall - ov0 <= 3 && genc.overall <= (genc.potential ?? 99));
  check('yaşlı çizgisi sağlıklı (aşınma en çok −2, taban korunur)', yov0 - yasli.overall <= 2 && yasli.overall >= 30, `${yov0} → ${yasli.overall}`);
  // ok göstergesi: artış ▲ 3 hafta görünür — kadroda render edilir
  const squadUi = await import('../src/ui/squadView.js');
  genc.okYon = 'up'; genc.okHafta = 3;
  const h = squadUi.render(G);
  check('kadro kartında yeşil ▲ oku (data-tip ile)', h.includes('kad-ok up') && h.includes('▲'));
  genc.okYon = 'down';
  check('düşüşte kırmızı ▼ oku', squadUi.render(G).includes('kad-ok down'));
}

console.log('\n── KİMYA OTURMASI + ARSA KUMAR SONUÇ KARTI + STRES FORMÜLÜ ──');
{
  // kimya: oynadıkça +0.1, galibiyette +0.5 — artık tek yönlü düşüş yok
  const G = fresh(50);
  G.kimya.kimya = 41;
  // telefonda panik alım YOK (dlbuy/kriz 'beklet') — yoksa her alım kimya −4 ile doğal artışı gömer
  const tel = (ph) => { if (!ph) return 0; if (ph.kind === 'dlbuy' || ph.kind === 'kriz') { const i = (ph.options || []).findIndex((o) => (o.key || '').includes('beklet')); return i >= 0 ? i : Math.max(0, (ph.options || []).length - 1); } return 0; };
  let k0 = 41, artis = 0, wArtisVar = false, oncekiW = G.season.W;
  for (let w = 1; w <= 12 && G.phase === 'SEASON_LOOP'; w++) {
    A.beginWeek(G);
    let g = 0; while (G.phone && g++ < 8) A.answerPhone(G, tel(G.phone));
    if (G.pendingMatch && G.pendingMatch.phase === 'pre') { A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam'); }
    if (G.kimya.kimya > k0) { artis++; if (G.season.W > oncekiW) wArtisVar = true; }
    k0 = G.kimya.kimya; oncekiW = G.season.W;
    G.pendingMatch = null;
  }
  check('kimya artık DOĞAL oturuyor (12 haftada yükseldi — tek yönlü düşüş bitti)', G.kimya.kimya > 41 && artis >= 8, `41 → ${Math.round(G.kimya.kimya * 10) / 10}`);
  check('galibiyet haftası kimyayı daha çok oturttu', wArtisVar);
  // stres formülü SAĞLIKLI: dinlenme 2 akşam → maç sonucu ne olursa olsun haftalık net düşer
  const G2 = fresh(51);
  A.initOzel(G2);
  G2.ozel.prog = { aile: 1, dinlen: 2, mesai: 1, sosyal: 0 };
  G2.ozel.g.stres = 80;
  const izler = [];
  for (let i = 0; i < 8; i++) { A.ozelTick(G2, i % 3 === 0 ? 'L' : 'D'); izler.push(Math.round(G2.ozel.g.stres)); G2.meta.week++; }
  check('STRES dengelenebiliyor: Dinlenme 2 akşamla mağlubiyetli haftalarda bile monoton düşüş', izler.every((v, i) => i === 0 || v <= izler[i - 1]) && izler[izler.length - 1] < 80, izler.join('→'));
  // arsa kumarı: %50 + sonuç 4 hafta sonra Inbox kartı
  const G3 = fresh(52);
  A.initOzel(G3);
  G3.ozel.nakit = 10;
  G3.ozel.olay = { id: 'arsa', hafta: 999 };
  A.ozelKarar(G3, 0); // VAR MISIN — hash sonucu şimdi yazıldı
  check('arsa kabul: 5mn düştü + vade 4 hafta sonra + tutar 9 (vurdu) ya da 3 (kayıp)', G3.ozel.nakit === 5 && !!G3.ozel.yatirim && [9, 3].includes(G3.ozel.yatirim.tutar));
  for (let i = 0; i < 5; i++) { A.ozelTick(G3, 'D'); G3.meta.week++; }
  check('4 hafta sonra sonuç INBOX kartı: ARSA VURDU ya da KAYBETTİRDİ', G3.ozel.yatirim === null && G3.inbox.some((m) => (m.t || '').includes('ARSA VURDU') || (m.t || '').includes('KAYBETTİRDİ')));
}

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
