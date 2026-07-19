// tests/kopru.test.mjs — KÖPRÜLER YAMASI: kulüp↔özel çift yön + dekor dişleri.
// BANT YASASI kanıtı: maç kaynaklı ev değişimi [35,68] dışına ASLA taşamaz — eşikleri
// (≤28 manşet · ≥72 güven) yalnız PROGRAM/İKİLEM aşar → autoplay-nötrlük matematiksel korunur.
// Çalıştır: node tests/kopru.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as ozelUi from '../src/ui/ozelHayat.js';
import * as seasonEnd from '../src/ui/seasonEnd.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };
const actSrc = readFileSync(new URL('../src/actions.js', import.meta.url), 'utf8');
const cockpitSrc = readFileSync(new URL('../src/ui/cockpit.js', import.meta.url), 'utf8');

function fresh(seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  return G;
}

console.log('\n── BANT YASASI: maç sonucu eve yansır ama eşik AŞAMAZ ──');
{
  const G = fresh();
  const gauges0 = JSON.stringify(G.gauges);
  for (let i = 0; i < 30; i++) { A.ozelTick(G, 'L'); G.meta.week++; }       // 30 hafta hep kayıp
  check('30×L → ev tabana iner ama 35 ALTINA İNMEZ (manşet eşiği 28 korunur)', G.ozel.g.ev === 35, `ev ${G.ozel.g.ev}`);
  check('30×L → kulüp gauge BİT BİT AYNI (sessiz ceza yok)', JSON.stringify(G.gauges) === gauges0);
  const G2 = fresh();
  const guven0 = G2.gauges.guven;
  for (let i = 0; i < 30; i++) { A.ozelTick(G2, 'W'); G2.meta.week++; }     // 30 hafta hep galibiyet
  check('30×W → ev tavana çıkar ama 68 ÜSTÜNE ÇIKMAZ (güven eşiği 72 aşılamaz)', G2.ozel.g.ev === 68, `ev ${G2.ozel.g.ev}`);
  check('30×W → güven AYNEN (eşik yalnız bilinçli aile yatırımıyla aşılır)', G2.gauges.guven === guven0);
}

console.log('\n── Derbi + sezon finali evde yankılanır ──');
{
  const G = fresh();
  const ev0 = G.ozel.g.ev, es0 = G.ozel.iliski.es;
  A.ozelTick(G, 'L', { derbi: true });
  check('derbi kaybı: ev −3 (bantlı) + eş kırgın + akışta replik', G.ozel.g.ev === Math.max(35, ev0 - 3) && G.ozel.iliski.es === es0 - 1 && G.ozel.akis.some((s) => s.includes(G.ozel.aile.es)));
  G.meta.week++;
  A.ozelTick(G, 'W', { derbi: true });
  check('derbi zaferi: akışta kutlama repliği', G.ozel.akis.some((s) => s.includes('Şehir bizim')));
  // sezon finali: şampiyonluk evi tavana (68) taşır, küme düşüşü sarsar
  const GS = fresh();
  GS.meta.week = GS.SEASON_WEEKS; GS.myPos = 1;
  A.ozelTick(GS, 'W');
  check('şampiyonluk finali: ev 68 (bant tavanı) + akışta bayram', GS.ozel.g.ev === 68 && GS.ozel.akis.some((s) => s.includes('Şampiyonluk')));
  const GK = fresh();
  GK.meta.week = GK.SEASON_WEEKS; GK.myPos = 17;
  const evK = GK.ozel.g.ev;
  A.ozelTick(GK, 'L');
  check('küme hattı finali: ev sarsılır ama 35 tabanı korunur', GK.ozel.g.ev >= 35 && GK.ozel.g.ev < evK);
}

console.log('\n── Yıllık aile fotoğrafı (çocuk barlarının dişi) ──');
{
  const G = fresh();
  G.meta.week = G.SEASON_WEEKS; G.myPos = 8;
  G.ozel.iliski.c1 = 78; G.ozel.iliski.c2 = 74;          // bilinçli aile yatırımı
  const it0 = G.gauges.itibar;
  A.ozelTick(G, 'D');
  check('çocuk bağı ort ≥70 → sezon sonu itibar +1 + manşet', G.gauges.itibar === Math.min(100, it0 + 1) && G.inbox.some((m) => (m.t || '').includes('Aile fotoğrafı')));
  const G2 = fresh();
  G2.meta.week = G2.SEASON_WEEKS; G2.myPos = 8;          // varsayılan çocuk bağı 65 — tetiklenmez
  const it2 = G2.gauges.itibar;
  A.ozelTick(G2, 'D');
  check('varsayılan bağda (65) foto YOK → autoplay-nötr korunur', G2.gauges.itibar === it2);
}

console.log('\n── Enerji dişi: kapasite gerçek ──');
{
  const G = fresh();
  G.ozel.g.enerji = 20;
  check('takatsizken jest yapılamaz', A.playerJest(G, G.squad[0].id).ok === false);
  check('takatsizken mesai sorgu bonusu da yanar (kaynak koşulu)', actSrc.includes("(G.ozel?.g?.enerji ?? 100) >= 30 ? 1 : 0"));
  G.ozel.g.enerji = 80;
  check('takat varken jest çalışır', A.playerJest(G, G.squad[0].id).ok === true);
}

console.log('\n── Altyapı Kahvaltısı (Özel Hayat ↔ Oyuncu İlişkisi köprüsü) ──');
{
  const G = fresh();
  const ocak = G.squad[0]; ocak.ocak = true;
  const bg0 = ocak.baskanaGuven ?? 50, mo0 = ocak.morale;
  check('kahvaltı: ocak çocuğunun başkana güveni ▲ + moral ▲', A.ozelDavet(G, 'altyapi').ok && (ocak.baskanaGuven > bg0) && ocak.morale === Math.min(100, mo0 + 3));
  check('cooldown: hemen tekrar verilemez', A.ozelDavet(G, 'altyapi').ok === false);
}

console.log('\n── Varlık dişleri: hava (mesai yarı yorar) + sanat (hayır gecesi büyür) ──');
{
  const G1 = fresh(), G2 = fresh();
  for (const g of [G1, G2]) g.ozel.prog = { aile: 0, dinlen: 1, mesai: 2, sosyal: 1 };
  G2.ozel.varlik.hava = 1;
  A.ozelTick(G1, 'D'); A.ozelTick(G2, 'D');
  check('hava aracı: aynı programda enerji belirgin daha yüksek (maliyet 2→1 + pasif)', G2.ozel.g.enerji - G1.ozel.g.enerji === 3, `+${G2.ozel.g.enerji - G1.ozel.g.enerji}`);
  const S1 = fresh(), S2 = fresh();
  S1.ozel.nakit = 20; S2.ozel.nakit = 20; S2.ozel.varlik.sanat = 2;
  A.ozelDavet(S1, 'hayir'); A.ozelDavet(S2, 'hayir');
  check('sanat sv.2: hayır gecesi itibarı +1 fazla işler', S2.gauges.itibar - S1.gauges.itibar === 1);
}

console.log('\n── Aile karnesi + sinyaller ──');
{
  const G = fresh();
  const abs = G.meta.season * 100 + G.meta.week;
  G.ozel.olay = { id: 'nisan', hafta: abs };
  A.ozelKarar(G, 0);
  G.ozel.nakit = 20; A.ozelDavet(G, 'altyapi'); A.ozelBagis(G, 3);
  G.ozel.olay = { id: 'karne', hafta: abs - 1 };  // geçen haftadan cevapsız
  G.meta.week++; A.ozelTick(G, 'D');
  const S = G.ozel.sezon;
  check('sezon sayaçları işler: ikilem/davet/bağış/kaçan', S.ikilem === 1 && S.davet === 1 && S.bagis === 3 && S.kacan === 1, JSON.stringify(S));
  G.lastSeason = { pos: 8, W: 12, D: 10, L: 12, GF: 34, GA: 30 };
  const h = seasonEnd.render(G);
  check('sezon sonunda AİLE KARNESİ bloğu', h.includes('Aile Karnesi') && h.includes('Çözülen ikilem'));
  check('nav sinyali: ikilem VEYA davet-takvimi-açıldı (ozSinyal)', cockpitSrc.includes('ozSinyal') && cockpitSrc.includes('Davet takvimi açıldı'));
  // UI: canlı program önizleme çipleri motor formülüyle
  const ui = ozelUi.render(fresh());
  check('program paneli canlı net-etki çipleri (NaN yok)', ui.includes('oz-net-cips') && !/NaN|undefined/.test(ui));
}

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
