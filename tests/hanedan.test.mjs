// tests/hanedan.test.mjs — SON 5 ENTEGRASYON: Hanedan (çocuklar büyür · oğul A takımda ·
// kız halef) + Aile telefonları (Y2) + Seçim gecesi aile desteği + Maç günü locası +
// Basın toplantısı özel hayat soruları. Hepsi hash-determinist + autoplay-nötr.
// Çalıştır: node tests/hanedan.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as mediaUi from '../src/ui/media.js';
import * as electionNight from '../src/ui/electionNight.js';
import * as careerEnd from '../src/ui/careerEnd.js';
import { eleksiyon } from '../src/engines/election.js';
import { h32, OLAYLAR, AILE_TEL } from '../src/engines/ozel.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };
const actSrc = readFileSync(new URL('../src/actions.js', import.meta.url), 'utf8');
const mdSrc = readFileSync(new URL('../src/ui/matchday.js', import.meta.url), 'utf8');

function fresh(seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  return G;
}

console.log('\n── HANEDAN: çocuklar büyür ──');
{
  const G = fresh();
  check('çocuk yaşları deterministik doğar (kız 19-22, oğul 13-16)', G.ozel.c1Yas >= 19 && G.ozel.c1Yas <= 22 && G.ozel.c2Yas >= 13 && G.ozel.c2Yas <= 16, `${G.ozel.c1Yas}/${G.ozel.c2Yas}`);
  const y1 = G.ozel.c1Yas, y2 = G.ozel.c2Yas;
  G.meta.season = 2; A.ozelTick(G, 'D');
  check('sezon geçişinde yaşlar +1', G.ozel.c1Yas === y1 + 1 && G.ozel.c2Yas === y2 + 1);
}

console.log('\n── HANEDAN: oğul futbolcu yolu ──');
{
  const G = fresh();
  const o = OLAYLAR.find((x) => x.id === 'ogulAkademi');
  check('akademi ikilemi koşullu: yaş ≥16 + tesis akademi ≥3', o.kosul({ c2Yas: 16, flags: {} }, { facilities: { akademi: 3 } }) === true && o.kosul({ c2Yas: 15, flags: {} }, { facilities: { akademi: 5 } }) === false);
  G.ozel.c2Yas = 16;
  G.ozel.olay = { id: 'ogulAkademi', hafta: G.meta.season * 100 + G.meta.week };
  A.ozelKarar(G, 0);
  check('"altyapıya yaz": çift bayrak + oğul bağı sıçrar', G.ozel.flags.ogulAkademide === true && G.ozel.flags.ogulKarar === true);
  // 18'inde A takım: sezon geçişi tetikler
  G.ozel.c2Yas = 17; G.meta.season = 2; A.ozelTick(G, 'D'); // → 18
  const ogul = G.squad.find((p) => p.aileOgul);
  check('oğul 18\'inde kadroda: soyadıyla, ocak+YENİ rozetli, manşetli', !!ogul && ogul.age === 18 && ogul.ocak === true && ogul.yeniHafta === 3 && G.inbox.some((m) => (m.t || '').includes('BAŞKANIN OĞLU')), ogul ? ogul.name : 'YOK');
  check('kadro değeri güncellendi + değer sonlu', Number.isFinite(ogul.marketValue) && ogul.marketValue > 0);
  // oğlunu satmak — evde deprem (satış aynası yolu)
  G.inbox.unshift({ id: 'mSat', action: 'sfile', file: { playerId: ogul.id, offer: 20 } });
  const ev0 = G.ozel.g.ev, c20 = G.ozel.iliski.c2;
  A.resolveSaleFile(G, 'mSat', 'sat');
  check('öz oğlunu satmak: ev −10 + oğul bağı −20 + manşet', G.ozel.g.ev === Math.max(0, ev0 - 10) && G.ozel.iliski.c2 === Math.max(0, c20 - 20) && G.inbox.some((m) => (m.t || '').includes('ÖZ OĞLUNU SATTI')));
}

console.log('\n── HANEDAN: kız halef yolu ──');
{
  const G = fresh();
  G.ozel.c1Yas = 22; G.ozel.flags.dugunOldu = true;
  G.ozel.olay = { id: 'kizKulup', hafta: G.meta.season * 100 + G.meta.week };
  const loy0 = G.board[0].loyalty;
  A.ozelKarar(G, 0);
  check('"işe al": halef bayrağı + kurul +2', G.ozel.flags.kizKulupte === true && G.board[0].loyalty === Math.min(100, loy0 + 2));
  const loy1 = G.board[0].loyalty;
  G.meta.season = 2; A.ozelTick(G, 'D');
  check('her sezon başı: halef masada → kurul +1 daha', G.board[0].loyalty === Math.min(100, loy1 + 1));
}

console.log('\n── AİLE TELEFONLARI (Y2) ──');
{
  const G = fresh();
  check('havuz: 4 arama, hepsi 2 seçenekli + fx\'li', AILE_TEL.length === 4 && AILE_TEL.every((t) => t.opts.length === 2 && t.opts.every((o) => o.fx)));
  check('havuzdaki her aramanın başlığı + metni dolu (UI title/body okur — "undefined" regresyonu)', AILE_TEL.every((t) => t.t && t.text));
  // hash haftasını bul → telefon düşer
  let hafta = 0;
  for (let w = 1; w <= 60; w++) if (h32(`${G.club.name}#oz#1#${w}#tel`) % 100 < 8) { hafta = w; break; }
  check('telefon hash haftası bulunur', hafta > 0, `hafta ${hafta}`);
  G.meta.week = hafta; G.ozel.olay = null; G.phone = null;
  A.ozelTick(G, 'D'); // telefon önceliği: bu haftada ikilem beklemede kalır, telefon düşer
  check('aile telefonu düştü (kind: aile, isimli arayan)', G.phone?.kind === 'aile' && !!G.phone.callerName, G.phone?.callerName || '—');
  check('telefon kartı dolu: title + body tanımlı ("undefined" ekranı bitti)', !!G.phone?.title && !!G.phone?.body, G.phone?.title || '—');
  if (G.phone) {
    const gauges0 = JSON.stringify(G.gauges);
    A.answerPhone(G, 0);
    check('cevap: etki iç dünyaya işler, kulüp gauge\'ları AYNEN (autoplay-nötr) + hat kapanır', JSON.stringify(G.gauges) === gauges0 && !G.phone);
  } else check('cevap testi atlandı — telefon yok', false);
  check('telefon UI kimliği: AİLE arayan rengi/etiketi main\'de', readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').includes("aile: '💗 AİLE'"));
}

console.log('\n── SEÇİM GECESİ: aile desteği bileşeni ──');
{
  const G = fresh();
  G.history = { seasons: [{ pos: 8 }, { pos: 7 }, { pos: 6 }] };
  const r1 = eleksiyon(G, { baslangicBorc: G.economy.borc });
  check('varsayılan aile bağında (ort ~67) bonus SIFIR — autoplay/denge korunur', r1.breakdown.aileBonus === 0 && r1.breakdown.aile < 70, `aile ${r1.breakdown.aile}`);
  G.ozel.iliski.es = 85; G.ozel.iliski.c1 = 80; G.ozel.iliski.c2 = 78;
  const r2 = eleksiyon(G, { baslangicBorc: G.economy.borc });
  check('aile bağı ≥70 → +2 oy puanı (kazanılmış)', r2.breakdown.aileBonus === 0.02 && Math.abs(r2.oyOrani - r1.oyOrani - 0.02) < 1e-9, `oy ${(r1.oyOrani * 100).toFixed(1)}→${(r2.oyOrani * 100).toFixed(1)}`);
  // UI: 6. karne kartı + analiz satırı
  G.election = { revealStep: 6, counting: false, done: true, kazandi: true, displayVote: 56, breakdown: { ...r2.breakdown } };
  G.meta.term = 1;
  const h = electionNight.render(G);
  check('seçim gecesi karnesinde AİLE kartı + analiz satırı', h.includes('>Aile<') && (h.includes('ön sıradaydılar') || h.includes('sandığa uzak')));
}

console.log('\n── MAÇ GÜNÜ LOCASI + BASIN ÖZEL SORULARI ──');
{
  check('canlı yayında aile locası şeridi (ev ≥60 dolu · <40 boş)', mdSrc.includes('md-loca') && mdSrc.includes('LOCADA') && mdSrc.includes('boş bu akşam'));
  const G = fresh();
  let bulundu = '';
  for (let w = 1; w <= 45 && !bulundu; w++) {
    G.meta.week = w;
    const h = mediaUi.render(G);
    for (const t of ['AİLE CEPHESİ', 'BAŞKANIN ÇOCUKLARI', 'YALIDA HAYAT', 'SERVET SORUSU', 'EVDEKİ SKOR', 'KIZININ DÜĞÜNÜ']) if (h.includes(t)) { bulundu = t; if (h.includes('%ES%') || h.includes('%C1%') || h.includes('%C2%')) bulundu = 'ŞABLON-SIZINTI'; break; }
  }
  check('basın toplantısına özel hayat sorusu düşer + isimler doldurulur', !!bulundu && bulundu !== 'ŞABLON-SIZINTI', bulundu || 'hiç düşmedi');
}

console.log('\n── KARİYER SONU: hanedan mirası ──');
{
  const G = fresh();
  G.ozel.flags.kizKulupte = true; G.ozel.flags.ogulKadroda = true;
  G.careerEnd = { reason: 'test', termsWon: 2, seasons: 6, titles: 1, cups: 0, anlar: [], borcHistory: [60, 40], yildizlar: [], telkinProfil: {}, tag: 'Efsane', oyOrt: 0.6 };
  const h = careerEnd.render(G);
  check('kapanışta Hanedan bloğu: halef kız + formalı oğul', h.includes('Hanedan') && h.includes('geleceğin başkanı') && h.includes('senin armanla sahada'));
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
