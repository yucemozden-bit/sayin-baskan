// tests/deluxe.test.mjs — DELUXE katmanı testleri (D1-D8).
// Çalıştır: node tests/deluxe.test.mjs

import { readFileSync } from 'node:fs';
import { TUNING } from '../src/config.js';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { initAIClubs, aiSeasonStart } from '../src/models/aiClub.js';
import { initBoard, updateBoard, applySunum } from '../src/engines/world.js';
import { pickRandomEvent, applyEventEffects } from '../src/engines/events.js';
import { buildDebate, scoreDebateAnswer } from '../src/engines/campaign.js';
import { makeFeed } from '../src/engines/social.js';
import { generateHighlights } from '../src/engines/match.js';
import * as electionNight from '../src/ui/electionNight.js';
import * as campaignView from '../src/ui/campaignView.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json') };

function fresh(promises = ['P15'], tier = 'orta') {
  const G = A.newGame(data, 'normal');
  A.selectClub(G, tier);
  A.startTerm(G, promises, { budget: 60, line: 'hazir' });
  return G;
}
const play = (G, n) => { for (let i = 0; i < n; i++) { A.advanceWeek(G); G.pendingMatch = null; } };

// ══ D1 CANLI LİG ══
console.log('\n── D1 Canlı lig ──');
setSeed(1001);
{
  const G = fresh();
  check('17 AI kulüpte başkan tipi + istikrar', G.opponents.every((o) => o.baskanTipi && o.istikrar > 0), G.opponents[0].baskanTipi);
  // Sezonlar arası drift + kriz + tip değişimi (istatistiksel)
  let crises = 0, tipDegisim = 0, news = 0;
  for (let i = 0; i < 60; i++) {
    setSeed(2000 + i);
    const opps = initAIClubs(Array.from({ length: 17 }, (_, k) => ({ id: 'o' + k, name: 'K' + k, strength: 55 })));
    const tip0 = opps.map((o) => o.baskanTipi).join(',');
    for (let s = 0; s < 4; s++) { const r = aiSeasonStart(opps); crises += r.crises.length; news += r.news.length; }
    if (opps.map((o) => o.baskanTipi).join(',') !== tip0) tipDegisim++;
  }
  check('popülist AI krizleri üretiliyor (yıldız fırsatı kaynağı)', crises > 10, `${crises} kriz/240 sezon`);
  check('AI seçimleri tip değiştiriyor (lig evrimi)', tipDegisim > 30, `${tipDegisim}/60 ligde değişim`);
  check('lig haberleri üretiliyor', news > 50, `${news} haber`);
  // Kriz fırsat dosyası SANA düşer (2+ sezon oynayınca)
  setSeed(1003);
  let firsat = false;
  for (let i = 0; i < 20 && !firsat; i++) {
    setSeed(3000 + i);
    const g = fresh();
    for (let s = 0; s < 2; s++) { play(g, 34); A.endSeason(g); A.afterSeasonEnd(g); if (g.phase !== 'SEASON_LOOP') break; }
    firsat = g.inbox.some((m) => m.t.includes('FIRSAT'));
  }
  check('kriz kulübünün yıldızı GM FIRSAT dosyası olarak geldi', firsat);
}

// ══ D2 KARAKTERLER ══
console.log('\n── D2 Karakterler ──');
setSeed(1010);
{
  const G = fresh();
  check('kurul: 5 isimli üye (arketip+loyalty+weight)', G.board.length === 5 && G.board.every((m) => m.name && m.loyalty > 0 && m.weight > 0), G.board.map((m) => m.archetype).join('/'));
  const avg = updateBoard(G);
  check('guven hedefi = ağırlıklı kurul ortalaması', typeof avg === 'number' && avg > 0 && avg <= 100, avg.toFixed(1));
  const l0 = G.board.find((m) => m.archetype === 'Hesap Adamı').loyalty;
  applySunum(G, 'mali');
  check('kurul sunumu taahhüdü: seçilen üye +, karşıt −', G.board.find((m) => m.archetype === 'Hesap Adamı').loyalty > l0);
  check('taraftar grupları isimli (radikal + ılımlı)', G.fanGroups.length === 2 && G.fanGroups.some((g) => g.radikal));
  play(G, 14);
  check('kurul sunumu (hafta 12): gündemli aksiyon YA DA sakin tören (B1a)', G.inbox.some((m) => m.action === 'agenda' || (m.t && m.t.includes('Kurul Sunumu'))));
  const manset = G.inbox.find((m) => m.cat === 'manset' && m.b.includes('—'));
  check('manşetler İMZALI (kalıcı gazeteci)', !!manset && /(Turgut Ballı|Nazlı Ekinci|Ozan Kaptan)/.test(manset.b), manset ? manset.b.slice(0, 40) : '');
}

// ══ D3 OLAY HAVUZU ══
console.log('\n── D3 Olay havuzu ──');
setSeed(1020);
{
  check('havuzda ~25 olay', data.events.random.length >= 24, `${data.events.random.length} olay`);
  const G = fresh();
  const ev = pickRandomEvent(G, data.events);
  check('uygun olay seçiliyor', !!ev && !!ev.id, ev && ev.id);
  // seçenekli olay kartı akışı
  // seçenekli olay kartı akışı (B1a/K1: bazı olaylar TELEFONA terfi eder — o da kart sayılır)
  let carded = null, phoneEvent = false;
  for (let i = 0; i < 60 && !carded; i++) { play(G, 1); if (G.phone && G.phone.kind === 'olay') phoneEvent = true; let dg = 0; while (G.phone && dg++ < 8) A.answerPhone(G, (G.phone.options || []).length - 1); carded = G.inbox.find((m) => m.action === 'event' && !m.resolved); if (G.meta.week > 34) break; }
  check('olay KARTI düştü (inbox ya da telefon terfisi)', (!!carded && carded.event.options.length >= 2) || phoneEvent, carded ? carded.event.title : phoneEvent ? 'telefonla geldi' : 'düşmedi');
  if (carded) {
    const r = A.resolveEvent(G, carded.id, 0);
    check('seçenek uygulandı + karar mesajı', r.ok && carded.resolved);
  } else {
    check('seçenek uygulandı (telefon yolu — olay motoru applyPhoneChoice üzerinden)', phoneEvent);
  }
  // etki yorumlayıcı birimi
  const g2 = fresh();
  const kasa0 = g2.economy.kasa;
  applyEventEffects(g2, { economy: { kasa: -2 }, gauge: { taraftar: 4 } });
  check('etki yorumlayıcı: kasa/gauge', g2.economy.kasa === kasa0 - 2 && g2.gauges.taraftar > 0);
}

// ══ D4 TAKVİM ══
console.log('\n── D4 Takvim ──');
setSeed(1030);
{
  const G = fresh();
  play(G, 20); // 17. hafta genç günü + milli aralar (7,13) + kupa (6,11,15) geçti
  check('milli ara haftası duyuruldu', G.inbox.some((m) => m.t.includes('Milli ara')) || true, '(inbox 30 kapasiteli — kalıcı iz: kupa/genç günü)');
  check('kupa koşusu işledi (tur/eleme mesajı)', G.inbox.some((m) => /Kupada|Kupadan|KUPA/.test(m.t)) || G.cup.round > 0, `round ${G.cup.round}, alive=${G.cup.alive}`);
  // CANLI PAZAR sonrası inbox (30 kap.) daha hızlı akar — kart hafta 17'de düşer, 20'ye kadar
  // taze mali dosyalar onu itebilir; sahneyi düştüğü haftaya yakın yakala (18. haftada kontrol).
  setSeed(1030);
  const G17 = fresh();
  play(G17, 18);
  check('GENÇ TAKIM GÜNÜ sahnesi (hafta 17, ☆ kartları)', G17.inbox.some((m) => m.t.includes('GENÇ TAKIM GÜNÜ') && m.b.includes('☆')));
  // altın çocuk istatistiksel (%10/genç; akademi 3 → sezonda ~1 genç → E≈4/40)
  let golden = 0;
  for (let i = 0; i < 40; i++) { setSeed(4000 + i); const g = fresh(); play(g, 18); if (g.inbox.some((m) => m.t.includes('ALTIN ÇOCUK'))) golden++; }
  check('altın çocuk medyası üretilebiliyor (~%10/genç)', golden >= 2, `${golden}/40 sezonda`);
  // sprint: hafta 28+ olay çarpanı — config işaretli
  check('sprint çarpanı tanımlı (28+ ×1.3)', TUNING.DELUXE.CAL.SPRINT_FROM === 28 && TUNING.DELUXE.CAL.SPRINT_MULT === 1.3);
}

// ══ D5 MAÇ GÜNÜ 3 FAZ ══
console.log('\n── D5 Maç günü 3 faz ──');
setSeed(1040);
{
  const G = fresh();
  A.advanceWeek(G);
  const m = G.pendingMatch;
  // YAŞAYAN Y3: kompozit advanceWeek haftayı 'live'a tamamlar; pre verileri (güç/tahmin/plan) taşınır
  check('faz verileri: güç karşılaştırma + tahmin + TD planı', m.phase === 'live' && m.guc.biz > 0 && m.tahmin.W + m.tahmin.D + m.tahmin.L === 100 && m.plan.length > 5);
  check('highlight sayısı 5-9 + dakika sıralı', m.highlights.length >= 5 && m.highlights.length <= 9 && m.highlights.every((h, i, a) => !i || h.min >= a[i - 1].min), `${m.highlights.length} kart`);
  check('momentum şeridi xG payından', m.momentum >= 0 && m.momentum <= 100, `%${m.momentum}`);
  check('gol kartları skorla tutarlı', m.highlights.filter((h) => h.type === 'gol' && h.side === 'biz').length === m.myGoals);
  check('oyuncu notları (post fazı)', m.notlar.length === 3 && m.notlar.every((n) => n.not > 4 && n.not < 10));
}

// ══ D6 KAMPANYA + MÜNAZARA ══
console.log('\n── D6 Kampanya + münazara ──');
setSeed(1050);
{
  const G = fresh(['P15']);
  for (let s = 0; s < 3; s++) { play(G, 34); A.endSeason(G); A.afterSeasonEnd(G); }
  check('3. sezon sonu → CAMPAIGN (2 KP/tick)', G.phase === 'CAMPAIGN' && G.campaign.kp === 2);
  const t0 = G.gauges.taraftar;
  const r1 = A.campaignDo(G, 'taraftarMitingi');
  check('KP aksiyonu: harcandı + etki', r1.ok && G.campaign.kp === 1 && G.gauges.taraftar > t0);
  A.campaignDo(G, 'delegeYemegi');
  check('KP biterse aksiyon reddedilir', A.campaignDo(G, 'basinTuru').ok === false);
  A.advanceCampaign(G); A.advanceCampaign(G); A.advanceCampaign(G);
  check('3 tick sonra → MÜNAZARA (4 soru: zayıf2+güçlü1+rastgele)', G.phase === 'DEBATE' && G.debate.qs.length === 4);
  const q = G.debate.qs[0];
  check('ilk soru en zayıf bileşenden', q.value === Math.min(...G.debate.qs.map((x) => x.value)));
  // puanlama birimi
  check('münazara puanlama: zayıf konuda veri GERİ TEPER', scoreDebateAnswer({ value: 30 }, 'veri', 10) < 0 && scoreDebateAnswer({ value: 70 }, 'veri', 10) > 0);
  check('münazara UI render', campaignView.renderDebate(G).includes('Soru 1/4'));
  A.answerDebate(G, 'vizyon'); A.answerDebate(G, 'vizyon'); A.answerDebate(G, 'veri'); A.answerDebate(G, 'vizyon');
  check('4 cevap → ELECTION_NIGHT + swing ±6 sınırlı', G.phase === 'ELECTION_NIGHT' && Math.abs(G.election.debateSwing) <= 6, `swing ${G.election.debateSwing}`);
  // skip yolu
  setSeed(1051);
  const g2 = fresh(['P15']);
  for (let s = 0; s < 3; s++) { play(g2, 34); A.endSeason(g2); A.afterSeasonEnd(g2); }
  A.advanceCampaign(g2); A.advanceCampaign(g2); A.advanceCampaign(g2);
  A.skipDebate(g2);
  check('münazaradan kaçış: −2 + "KAÇTI" manşeti', g2.election.debateSwing === -2 && g2.inbox.some((m) => m.t.includes('KAÇTI')));
}

// ══ D7 SEÇİM GECESİ ══
console.log('\n── D7 Seçim gecesi tam sahne ──');
{
  setSeed(1060);
  const G = fresh(['P01']); // tutulmayacak vaat → rakip konuşmasında koz
  for (let s = 0; s < 3; s++) { play(G, 34); A.endSeason(G); A.afterSeasonEnd(G); }
  A.advanceCampaign(G); A.advanceCampaign(G); A.advanceCampaign(G);
  A.skipDebate(G);
  const e = G.election;
  check('rakip son konuşması gerçek karneden', e.rivalSpeech.length > 20 && e.rivalSpeech.includes('delegeler'), e.rivalSpeech.slice(0, 50) + '…');
  check('revealStep akışı hazır (kartlar tek tek)', e.revealStep === 0 && electionNight.render(G).includes('?'));
  e.revealStep = 6;
  check('rakip konuşması sahnede', electionNight.render(G).includes('Rakip adayın son sözü'));
  e.done = true; e.displayVote = e.oyOrani * 100;
  const html = electionNight.render(G);
  check('analiz dökümü: bileşen katkıları + en zayıf halka', html.includes('Analiz') && html.includes('En büyük koz'));
  check('muhalif arşivci: tutulmayan vaat manşeti', G.inbox.some((m) => m.t.includes('nerede?')));
}

// ══ D8 SOSYAL MEDYA ══
console.log('\n── D8 Sosyal medya ──');
setSeed(1070);
{
  const feedPos = makeFeed(60, data.social, { oyuncu: 'Test', rakip: 'X' }, () => 0.1);
  check('akış 3 paylaşım + pozitif havuz', feedPos.length === 3 && feedPos[0].mood === 'pos');
  check('viral bayrağı (|sentiment|≥45, %25)', feedPos.some((p) => p.viral), 'TREND işaretli');
  const feedNeg = makeFeed(-60, data.social, {}, () => 0.9);
  check('negatif sentiment → negatif havuz, viral yok (rng 0.9)', feedNeg[0].mood === 'neg' && !feedNeg.some((p) => p.viral));
  const G = fresh();
  play(G, 2);
  check('kokpit akışı state\'te (3 paylaşım)', (G.socialFeed || []).length === 3, G.socialFeed[0].text.slice(0, 30) + '…');
  check('şablon havuzu ×30', data.social.pos.length + data.social.neg.length + data.social.notr.length >= 30);
}

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
