// tests/finans.test.mjs — FİNANS: isteğe bağlı kredi (+ ileride sponsor anlaşmaları).
// Çalıştır: node tests/finans.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { sponsor } from '../src/engines/economy.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function fresh(tier = 'orta', mode = 'klasik', seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  G.mode = mode;
  A.selectClub(G, tier);
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  return G;
}

console.log('\n── Kredi Çekme ──');
{
  const G = fresh('orta');
  const kasa0 = G.economy.kasa, borc0 = G.economy.borc;
  const ok = A.takeLoan(G, 50);
  check('50mn kredi: kasa +50, borç +50, true döner', ok === true && Math.round(G.economy.kasa - kasa0) === 50 && Math.round(G.economy.borc - borc0) === 50, `kasa ${Math.round(G.economy.kasa)} borç ${Math.round(G.economy.borc)}`);
  check('kredi çekince mali inbox mesajı düşer', G.inbox.some((m) => m.t === 'Kredi çekildi'));
}
{
  const G = fresh('orta');
  const borc0 = G.economy.borc;
  const ok = A.takeLoan(G, 5000); // tavanı (400) aşar
  check('tavan aşan kredi reddedilir (borç değişmez, false döner)', ok === false && Math.round(G.economy.borc) === Math.round(borc0), `borç ${Math.round(G.economy.borc)}`);
}
{
  const G = fresh('orta', 'aile');
  const borc0 = G.economy.borc; // aile modunda borç 0 olmalı
  const ok = A.takeLoan(G, 50);
  check('AİLE modu: kredi çekilemez (false, borç 0 kalır)', ok === false && Math.round(G.economy.borc) === Math.round(borc0), `borç ${Math.round(G.economy.borc)}`);
}
{
  const G = fresh('orta');
  const faiz0 = G.economy.faizOrani;
  A.takeLoan(G, 20, { faizIndirim: 0.05, kaynak: 'banka teklifi' });
  check('banka teklifi (faiz indirimli) faizi düşürür', G.economy.faizOrani < faiz0, `%${Math.round(faiz0 * 100)} → %${Math.round(G.economy.faizOrani * 100)}`);
}

console.log('\n── Banka Kredi Teklifi (inbox olayı) ──');
{
  const G = fresh('orta');
  const faiz0 = G.economy.faizOrani, kasa0 = G.economy.kasa, borc0 = G.economy.borc;
  G.inbox.push({ id: 'bk1', cat: 'mali', t: 'Banka teklifi', b: '', action: 'bankLoan', loan: { amount: 30, faizIndirim: 0.05 } });
  A.resolveBankLoan(G, 'bk1', 'kabul');
  const m = G.inbox.find((x) => x.id === 'bk1');
  check('KABUL: kredi + faiz indirimi uygulanır, mesaj kapanır', m.resolved === true && Math.round(G.economy.kasa - kasa0) === 30 && Math.round(G.economy.borc - borc0) === 30 && G.economy.faizOrani < faiz0, `faiz %${Math.round(faiz0 * 100)}→%${Math.round(G.economy.faizOrani * 100)}`);
}
{
  const G = fresh('orta');
  const kasa0 = G.economy.kasa, borc0 = G.economy.borc;
  G.inbox.push({ id: 'bk2', cat: 'mali', t: 'Banka teklifi', b: '', action: 'bankLoan', loan: { amount: 30, faizIndirim: 0.05 } });
  A.resolveBankLoan(G, 'bk2', 'red');
  check('RED: ekonomi değişmez, mesaj kapanır', G.inbox.find((x) => x.id === 'bk2').resolved === true && Math.round(G.economy.kasa) === Math.round(kasa0) && Math.round(G.economy.borc) === Math.round(borc0));
}

console.log('\n── Sponsor Pazarı (prosedürel + canlı piyasa) ──');
{
  const G = fresh('orta');
  const gg = A.sponsorOffers(G, 'gogus');
  check('pazar kurulur: göğüs 4 · kol 3 · naming 3 teklif', gg.length === 4 && A.sponsorOffers(G, 'kol').length === 3 && A.sponsorOffers(G, 'naming').length === 3, gg.map((o) => o.name).join(' · '));
  check('teklifler AÇIK ŞARTLI + fesih > peşinat + süre + kalan hafta', gg.every((o) => o.pesinat > 0 && o.weekly >= 0.1 && o.years >= 1 && o.fesihCeza > o.pesinat && o.kalanHafta >= 1));
  check('göğüste en az bir RİSKLİ (bahis/kripto) teklif garantili', gg.some((o) => o.type === 'bahis' || o.type === 'kripto'));
}
{
  // ÇEŞİTLİLİK: aynı kariyer deterministik; farklı kulüp → farklı marka isimleri/bedeller
  const G1 = fresh('orta'), G2 = fresh('orta');
  const n1 = A.sponsorOffers(G1, 'gogus').map((o) => o.name).join('|');
  check('aynı kariyer → aynı pazar (determinizm)', n1 === A.sponsorOffers(G2, 'gogus').map((o) => o.name).join('|'), n1);
  const B = fresh('buyuk');
  const nb = A.sponsorOffers(B, 'gogus').map((o) => o.name).join('|');
  check('farklı kulüp → FARKLI marka isimleri', n1 !== nb, nb);
}
{
  const G = fresh('orta');
  const s0 = sponsor(G);
  const o = A.sponsorOffers(G, 'gogus')[0];
  const kasa0 = G.economy.kasa;
  check('imza: slot dolar + peşinat kasaya + diğer adaylar çekilir', A.signSponsor(G, 'gogus', o.id) === true && G.sponsorDeals.gogus.name === o.name && Math.round(G.economy.kasa - kasa0) === o.pesinat && A.sponsorOffers(G, 'gogus').length === 0);
  check('imza sonrası haftalık sponsor geliri sözleşmeye kilitlenir', Math.abs(sponsor(G) - s0) > 1e-9 || Math.abs(G.sponsorDeals.gogus.weekly) > 0, `${s0.toFixed(3)} → ${sponsor(G).toFixed(3)}`);
  A.cancelSponsor(G, 'gogus');
  check('fesih AĞIR: net zarar + piyasa hemen yeni aday sürer', G.economy.kasa < kasa0 && G.sponsorDeals.gogus === null && A.sponsorOffers(G, 'gogus').length >= 1, `kasa ${Math.round(kasa0)}→${Math.round(G.economy.kasa)}`);
}
{
  // REDDET + HAFTALIK YENİ TEKLİF (kullanıcı isteği: reddet → belki gelecek hafta yenisi)
  const G = fresh('orta');
  const ilk = A.sponsorOffers(G, 'gogus')[0];
  check('reddet: teklif masadan kalkar + inbox notu', A.rejectSponsorOffer(G, 'gogus', ilk.id) === true && !A.sponsorOffers(G, 'gogus').some((o) => o.id === ilk.id) && G.inbox.some((m) => m.t.startsWith('Teklif reddedildi')));
  let geldi = false;
  for (let i = 0; i < 8; i++) { G.meta.week++; A.sponsorMarketTick(G); if (A.sponsorOffers(G, 'gogus').length >= 4) { geldi = true; break; } }
  check('sonraki haftalarda YENİ sponsor teklifi kapıyı çalar', geldi && G.inbox.some((m) => m.t.startsWith('Yeni sponsor teklifi')), A.sponsorOffers(G, 'gogus').map((o) => o.name).join(' · '));
}
{
  // SÜRE DOLUMU: masada bekleyen teklif çekilir (beklemek de bir karar)
  const G = fresh('orta');
  const o = A.sponsorOffers(G, 'kol')[0];
  o.kalanHafta = 1;
  G.meta.week++; A.sponsorMarketTick(G);
  check('süresi dolan teklif masadan çekilir', !A.sponsorOffers(G, 'kol').some((x) => x.id === o.id) && G.inbox.some((m) => m.t.startsWith('Teklif geri çekildi')));
}
{
  const G = fresh('orta'); // orta stadyum sv=4 < 7 → naming kilitli
  const no = A.sponsorOffers(G, 'naming')[0];
  check('naming: stadyum sv<7 iken imzalanamaz', A.signSponsor(G, 'naming', no.id) === false && !G.sponsorDeals.naming);
  G.facilities.stadyum = 8;
  check('naming: stadyum sv≥7 iken imzalanır', A.signSponsor(G, 'naming', no.id) === true && G.sponsorDeals.naming.name === no.name);
}
{
  const G = fresh('orta');
  const riskli = A.sponsorOffers(G, 'gogus').find((o) => o.type === 'bahis' || o.type === 'kripto');
  const before = { rep: G.club.reputation, tar: G.gauges.taraftar };
  A.signSponsor(G, 'gogus', riskli.id);
  check('riskli sponsor dezavantaj uygular (taraftar/itibar ↓)', G.club.reputation < before.rep || G.gauges.taraftar < before.tar, `${riskli.name} · ${riskli.dezavantaj}`);
}
{
  // Süre bitişi: tickSponsors ile sözleşme azalır; sıfırda cezasız biter + pazar yeni adaylar sürer
  const G = fresh('orta');
  A.signSponsor(G, 'gogus', A.sponsorOffers(G, 'gogus')[0].id);
  const yil = G.sponsorDeals.gogus.years;
  for (let i = 0; i < yil; i++) A.tickSponsors(G);
  check('sözleşme süresi dolunca cezasız biter + masaya yeni adaylar gelir', G.sponsorDeals.gogus === null && A.sponsorOffers(G, 'gogus').length >= 1);
}

console.log('\n── Sponsor Batma Olayı ──');
{
  const G = fresh('orta');
  A.signSponsor(G, 'gogus', A.sponsorOffers(G, 'gogus')[0].id);
  G.sponsorDeals.gogus.riskProfile = { batmaChance: 1 }; // garanti batış (deterministik zar %100)
  const rep0 = G.club.reputation;
  A.tickSponsors(G);
  check('batan sponsor: slot boşalır + manşet + itibar −2 + pazar yeni aday sürer',
    G.sponsorDeals.gogus === null && G.inbox.some((m) => m.t.startsWith('SPONSOR BATTI')) && G.club.reputation === rep0 - 2 && A.sponsorOffers(G, 'gogus').length >= 1);
}
{
  const G = fresh('orta');
  A.signSponsor(G, 'gogus', A.sponsorOffers(G, 'gogus')[0].id);
  G.sponsorDeals.gogus.riskProfile = { batmaChance: 0 }; // risksiz → batmaz
  A.tickSponsors(G);
  check('batma riski olmayan sponsor batmaz (süre normal azalır)', G.sponsorDeals.gogus !== null && !G.inbox.some((m) => m.t.startsWith('SPONSOR BATTI')));
}

console.log('\n── SPONSOR AVI: rakip marka fesih bedelini üstlenir ──');
{
  // KABUL yolu — dosya elle kurulur (determinist), sonuç: ceza kasadan ÇIKMAZ, yeni imza + peşinat girer
  const G = fresh('orta');
  A.signSponsor(G, 'gogus', A.sponsorOffers(G, 'gogus')[0].id);
  const eski = G.sponsorDeals.gogus;
  const av = { id: 'sp-test-av', name: 'AvcıHolding', sektor: 'holding', ik: '🦅', type: 'standart', incomeMult: 1.2, weekly: Math.round(eski.weekly * 1.3 * 100) / 100, annual: Math.round(eski.weekly * 1.3 * 52 * 10) / 10, pesinat: 12, fesihCeza: 40, years: 3 };
  G.inbox.unshift({ id: 'avk', action: 'spBuyout', slot: 'gogus', avTeklif: av, avCeza: eski.fesihCeza, t: 'test', b: '' });
  const kasa0 = G.economy.kasa, rep0 = G.club.reputation;
  A.resolveSponsorBuyout(G, 'avk', 'kabul');
  check('KABUL: eski gider, yeni imzalanır — ceza kasadan çıkmaz, yalnız peşinat girer',
    G.sponsorDeals.gogus.name === 'AvcıHolding' && Math.abs(G.economy.kasa - (kasa0 + 12)) < 1e-9, `kasa ${Math.round(kasa0)} → ${Math.round(G.economy.kasa)}`);
  check('küçük imaj bedeli (itibar −1) + SPONSOR DARBESİ manşeti', G.club.reputation === rep0 - 1 && G.inbox.some((m) => (m.t || '').startsWith('SPONSOR DARBESİ')));
  // RED yolu — sadakat jesti: mevcut marka tek seferlik teşekkür öder, anlaşma yerinde kalır
  const G2 = fresh('orta');
  A.signSponsor(G2, 'gogus', A.sponsorOffers(G2, 'gogus')[0].id);
  const d2 = G2.sponsorDeals.gogus;
  G2.inbox.unshift({ id: 'avr', action: 'spBuyout', slot: 'gogus', avTeklif: { ...av }, avCeza: d2.fesihCeza, t: 'test', b: '' });
  const kasa2 = G2.economy.kasa;
  A.resolveSponsorBuyout(G2, 'avr', 'red');
  check('RED: anlaşma yerinde + sadakat jesti (haftalık×3) kasaya',
    G2.sponsorDeals.gogus.name === d2.name && Math.abs(G2.economy.kasa - (kasa2 + Math.round(d2.weekly * 3 * 10) / 10)) < 1e-9 && G2.inbox.some((m) => (m.t || '').startsWith('Sadakat jesti')));
  check('red sonrası o slota av bekleme süresi yazılır', (G2._spAvCd?.gogus || 0) > 0);
  // Pazar nabzı avı kendisi de üretebilmeli (hash) — imzalı sponsorla haftalar ilerlet
  const G3 = fresh('orta');
  A.signSponsor(G3, 'gogus', A.sponsorOffers(G3, 'gogus')[0].id);
  let dusdu = false;
  for (let w = 0; w < 80 && !dusdu; w++) {
    G3.meta.week++; A.sponsorMarketTick(G3);
    if (G3.inbox.some((m) => m.action === 'spBuyout' && !m.resolved)) dusdu = true;
  }
  check('haftalık nabız SPONSOR AVI dosyası düşürebiliyor (hash, rand yok)', dusdu);
  const kart = G3.inbox.find((m) => m.action === 'spBuyout');
  if (kart) check('av dosyası fesih bedelini ve rakip şartlarını taşır', kart.avCeza > 0 && kart.avTeklif?.annual > 0 && (kart.b || '').includes('üstleniyor'));
}

console.log('\n── CANLI PAZAR: teklifler her hafta tazelenir ──');
{
  const G = fresh('orta');
  // gogus'u boşalt → bomboş slota İLK haftada garanti yeni marka gelir
  for (const o of [...A.sponsorOffers(G, 'gogus')]) A.rejectSponsorOffer(G, 'gogus', o.id);
  G.meta.week++; A.sponsorMarketTick(G);
  check('bomboş masaya İLK haftada garanti teklif gelir', A.sponsorOffers(G, 'gogus').length >= 1, A.sponsorOffers(G, 'gogus').map((o) => o.name).join(' · '));
  // 6 haftada birden çok yeni dosya (canlılık): sayaç
  let yeni = 0;
  for (let w = 0; w < 6; w++) { const n0 = G.inbox.filter((m) => (m.t || '').startsWith('Yeni sponsor teklifi')).length; G.meta.week++; A.sponsorMarketTick(G); yeni += G.inbox.filter((m) => (m.t || '').startsWith('Yeni sponsor teklifi')).length - n0; }
  check('pazar diri: 6 haftada ≥3 yeni dosya', yeni >= 3, `${yeni} yeni teklif`);
  // UI: vitrin bileşenleri
  const fin = await import('../src/ui/finance.js');
  G.nav = 'finans';
  const h = fin.render(G);
  check('vitrin: CANLI PİYASA nabzı + yıldız plaka + süre sayaçları', h.includes('CANLI PİYASA') && h.includes('EN GÜÇLÜ TEKLİF') && h.includes('⏳'));
  check('hızlı imza butonu plakada', h.includes('signSponsor') && h.includes('İMZALA'));
  A.signSponsor(G, 'gogus', A.sponsorOffers(G, 'gogus')[0].id);
  const h2 = fin.render(G);
  check('imzalı anlaşma altın levhada: haftalık + fesih + sözleşme yılı noktaları', h2.includes('spo-card signed') && h2.includes('FESİH CEZASI') && h2.includes('spo-dots'));
}

console.log('\n── Prim → Finans ──');
{
  const G = fresh('orta');
  for (let i = 0; i < 5 && G.meta.week <= G.SEASON_WEEKS; i++) { A.setMatchPrim(G, 'yuksek'); A.advanceWeek(G); }
  check('maç primi her maç finansı etkiler (primLedger.mac > 0)', G.primLedger.mac > 0, `${G.primLedger.mac.toFixed(1)}mn ödendi`);
}

console.log('\n' + '─'.repeat(48));
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
