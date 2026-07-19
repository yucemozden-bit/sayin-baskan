// tests/secim.test.mjs — SEÇİM GECESİ OY SAYIM SİSTEMİ doğrulaması.
// Kullanıcı şikâyeti: (1) barlar aynı anda hareket etmiyor, (2) oyu ÇOK olanın barı daha KISA.
// Kök sebep: CSS width-transition + interval → hızlı büyüyen (önde) bar geriden takip edilip kısa çiziliyordu.
// Çözüm: requestAnimationFrame + tek çizim noktası (ciz) + transition:none.
// Bu batarya hem KAYNAĞI (rAF/transition yok) hem de MANTIK değişmezlerini (oy↑ → bar↑) kilitler.
// Çalıştır: node tests/secim.test.mjs

import { readFileSync } from 'node:fs';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const mainSrc = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/game.css', import.meta.url), 'utf8');

// ── 1) KAYNAK: sayım rAF ile, transition/lag olmadan ──
console.log('\n── Kaynak: sayım motoru ──');
check('rAF ile sürülüyor (interval-kovalama değil)', mainSrc.includes('requestAnimationFrame(adim)'), '');
check('tek çizim noktası: ciz(senV, rakV)', /const ciz = \(senV, rakV\)/.test(mainSrc), '');
check('genişlik oyla ORANTILI: (senV / TOPLAM * 100)', mainSrc.includes('(senV / TOPLAM * 100)') && mainSrc.includes('(rakV / TOPLAM * 100)'), '');
check('zafer sayımında setInterval YOK (kovalama kaynağı kaldırıldı)',
  !/const iv = setInterval[\s\S]*?zg-lbl-sen/.test(mainSrc), '');
check('bitir() de tek çizim noktasını kullanır (final = ciz(senF, rakF))', mainSrc.includes('ciz(senF, rakF)'), '');

// ── 1b) DOM SEÇİCİ ÇAKIŞMASI (gerçek bug buydu): "önde" rozeti bar seçicisini çalmamalı ──
console.log('\n── DOM seçici çakışması ──');
// Bar SADECE .aday-bar içinden seçilmeli; çıplak '.secim-zafer .sen/.rakip' rozetle çakışır.
check('bar seçici .aday-bar ile kapsanmış (.secim-zafer .aday-bar .sen/.rakip)',
  mainSrc.includes(".secim-zafer .aday-bar .sen'") && mainSrc.includes(".secim-zafer .aday-bar .rakip'"), '');
check('ciz() çıplak .secim-zafer .sen/.rakip ile bar SEÇMİYOR (rozet çakışması yok)',
  !/q\('\.secim-zafer \.(sen|rakip)'\)/.test(mainSrc), '');
check("'önde' rozeti çakışmayan class kullanır (lead-sen/lead-rakip, 'sen'/'rakip' değil)",
  mainSrc.includes("toggle('lead-sen'") && mainSrc.includes("toggle('lead-rakip'")
  && !/toggle\('(sen|rakip)'/.test(mainSrc), '');
check('CSS önde rozeti lead-sen/lead-rakip ile eşleşir', css.includes('.zg-onde-ad.lead-sen') && css.includes('.zg-onde-ad.lead-rakip'), '');

// ── 2) CSS: bar genişliğinde transition/transform YOK → ne hesaplanırsa o çizilir ──
console.log('\n── CSS: bar render ──');
{
  const blok = css.slice(css.indexOf('.secim-zafer .aday-bar .sen, .secim-zafer .aday-bar .rakip'));
  const kural = blok.slice(0, blok.indexOf('}') + 1);
  check('zafer barlarında transition: none (lag yok)', /transition:\s*none/.test(kural), kural.match(/transition:[^;]*/)?.[0] || '');
  check('zafer barlarında transform: none (ölçek yok)', /transform:\s*none/.test(kural), '');
}

// ── 3) MANTIK: sistemin çizim formülünü BİREBİR taklit et, değişmezleri kanıtla ──
console.log('\n── Mantık: oy↑ ⟺ bar↑, senkron, monoton ──');
const easeGir = (x) => Math.pow(x, 1.25);   // main.js ile aynı
const easeCik = (x) => Math.pow(x, 0.8);
function frame(senF, rakF, TOPLAM, p) {
  const senV = p >= 1 ? senF : Math.round(senF * easeGir(p));
  const rakV = p >= 1 ? rakF : Math.round(rakF * easeCik(p));
  return { senV, rakV, senW: senV / TOPLAM * 100, rakW: rakV / TOPLAM * 100 };
}

const TOPLAM = 550;
let ihlalUzunluk = 0, ihlalMonoton = 0, ihlalFinal = 0, kazananKisa = 0;
// Gerçek aralık: sen %51–66 (actions.js). Her senaryoda p'yi ince tara.
for (let senYuzde = 51; senYuzde <= 66; senYuzde++) {
  const senF = Math.round(TOPLAM * senYuzde / 100), rakF = TOPLAM - senF;
  let prevSen = -1, prevRak = -1;
  for (let i = 0; i <= 200; i++) {
    const p = i / 200;
    const f = frame(senF, rakF, TOPLAM, p);
    // (a) DEĞİŞMEZ: oyu çok olanın barı daha uzun (asla ters dönmez)
    if (Math.sign(f.senV - f.rakV) !== Math.sign(f.senW - f.rakW)) ihlalUzunluk++;
    // (b) monoton: iki sayaç da geri düşmez (donma/sıçrama yok)
    if (f.senV < prevSen || f.rakV < prevRak) ihlalMonoton++;
    prevSen = f.senV; prevRak = f.rakV;
  }
  // (c) final tam tutar
  const son = frame(senF, rakF, TOPLAM, 1);
  if (son.senV !== senF || son.rakV !== rakF || son.senV + son.rakV !== TOPLAM) ihlalFinal++;
  // (d) kazanan (sen) finalde daha uzun bar
  if (son.senW <= son.rakW) kazananKisa++;
}
check('DEĞİŞMEZ: her karede oyu çok olanın barı ≥ (ters dönmüyor)', ihlalUzunluk === 0, `${ihlalUzunluk} ihlal`);
check('iki sayaç da monoton (donma/sıçrama yok)', ihlalMonoton === 0, `${ihlalMonoton} ihlal`);
check('final oylar tam tutar (sen+rak = 550)', ihlalFinal === 0, `${ihlalFinal} ihlal`);
check('kazananın barı finalde daha uzun', kazananKisa === 0, `${kazananKisa} ihlal`);

// ── 4) SENKRON + EKRAN GÖRÜNTÜSÜ VAKALARI: aynı p, aynı kare; inversiyon yok ──
console.log('\n── Ekran görüntüsü vakaları ──');
{
  // Vaka A (son ekran görüntüsü finali): senF=281, rakF=269 → sen %51 > rak %49
  const son = frame(281, 269, 550, 1);
  check('final 281/269: kazanan %51 barı > kaybeden %49 barı',
    Math.round(son.senW) === 51 && Math.round(son.rakW) === 49 && son.senW > son.rakW,
    `sen %${son.senW.toFixed(0)} (${son.senV}) > rak %${son.rakW.toFixed(0)} (${son.rakV})`);
  // Vaka B (aynı seçimin ara karesi ~%64 sayıldı): rakip önde → RAKİP barı UZUN olmalı
  // (ekranda rakip 190 oy iken barı minik görünüyordu — burada tersi kanıtlanır)
  let araP = 0;
  for (let i = 0; i <= 1000; i++) { const p = i / 1000; if (frame(281, 269, 550, p).senV + frame(281, 269, 550, p).rakV >= 353) { araP = p; break; } }
  const ara = frame(281, 269, 550, araP);
  check('ara kare ~353 oy: rakip önde (190) → rakip barı sen barından UZUN',
    ara.rakV > ara.senV && ara.rakW > ara.senW,
    `sen ${ara.senV} (%${ara.senW.toFixed(0)}) · rak ${ara.rakV} (%${ara.rakW.toFixed(0)})`);
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
