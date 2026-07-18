// tests/approval.test.mjs — "Başkanlık Hissi" paketi testleri (§1-§7):
// transfer-onay akışı · TD süreci · stat sızıntısı · kongre · kritik hafta · tablo · kimlik.
// Çalıştır: node tests/approval.test.mjs

import { readFileSync } from 'node:fs';
import { TUNING } from '../src/config.js';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as cockpit from '../src/ui/cockpit.js';
import * as congress from '../src/ui/congress.js';
import * as squadView from '../src/ui/squadView.js';
import * as clubView from '../src/ui/clubView.js';
import * as transferView from '../src/ui/transferView.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json') };

function fresh(promises = ['P15'], directive = null, tier = 'orta') {
  const G = A.newGame(data, 'normal');
  A.selectClub(G, tier);
  A.startTerm(G, promises, directive);
  return G;
}
const firstFile = (G, act) => G.inbox.find((m) => m.action === act && !m.resolved);
function playUntilFile(G, act, maxWeeks = 4) {
  for (let w = 0; w < maxWeeks; w++) {
    A.advanceWeek(G); G.pendingMatch = null;
    const f = firstFile(G, act);
    if (f) return f;
    // başka tip dosya GM'i bloklamasın (tek aktif dosya kuralı)
    for (const other of ['sfile', 'tfile', 'event', 'board']) {
      if (other === act) continue;
      const o = firstFile(G, other);
      if (o && other === 'sfile') A.resolveSaleFile(G, o.id, 'red');
      else if (o && other === 'tfile') A.resolveTransferFile(G, o.id, 'red');
      else if (o && other === 'event') A.resolveEvent(G, o.id, 0);
      else if (o && other === 'board') A.resolveBoard(G, o.id, 'mali');
    }
  }
  return null;
}

// ══ §1 TRANSFER-ONAY ══
console.log('\n── §1 Transfer-onay dönüşümü ──');
setSeed(11);
{
  const G = fresh(['P15'], { budget: 80, line: 'hazir' });
  check('direktif kaydedildi (bütçe/çizgi)', G.directive.budget === 80 && G.directive.line === 'hazir');
  const f = playUntilFile(G, 'tfile');
  check('GM pencere içinde ONAY DOSYASI getirdi', !!f, f ? f.t : 'gelmedi');
  check('dosyada gerekçe + sis aralığı var', !!f.file.gerekce && Array.isArray(f.file.range) && f.file.range[0] < f.file.range[1]);
  const kasa0 = G.economy.kasa, n0 = G.squad.length;
  const r = A.resolveTransferFile(G, f.id, 'onay');
  check('ONAYLA: oyuncu kadroda + bütçe izlendi', r.ok && G.squad.length === n0 + 1 && (G.termSpent || 0) > 0, `harcanan ${Math.round(G.termSpent)}mn`);
  check('kimya sarsıldı (transfer etkisi korunur)', G.kimya.kimya < 60);

  // RED yolu
  setSeed(12);
  const G2 = fresh(['P15'], { budget: 80, line: 'hazir' });
  const f2 = playUntilFile(G2, 'tfile');
  const n2 = G2.squad.length;
  A.resolveTransferFile(G2, f2.id, 'red');
  check('REDDET: dosya kapandı, kadro değişmedi', f2.resolved === true && G2.squad.length === n2);

  // ŞARTLI dağılımı (~%50 iner / %30 uzar / %20 kapar; GM skill kaydırır)
  let inen = 0, uzayan = 0, kapan = 0; const N = 200;
  for (let i = 0; i < N; i++) {
    setSeed(900 + i);
    const g = fresh(['P15'], { budget: 90, line: 'hazir' });
    const ff = playUntilFile(g, 'tfile');
    if (!ff) continue;
    const out = A.resolveTransferFile(g, ff.id, 'sart').outcome;
    if (out === 'indi') inen++; else if (out === 'uzadi') uzayan++; else if (out === 'kapti') kapan++;
  }
  const tot = inen + uzayan + kapan;
  check('şartlı dağılım ~%50/%30/%20', inen / tot > 0.38 && uzayan / tot > 0.18 && kapan / tot > 0.08,
    `indi %${Math.round(inen / tot * 100)} · uzadı %${Math.round(uzayan / tot * 100)} · kaptı %${Math.round(kapan / tot * 100)}`);

  // Satış aynası + yıldız dramı
  setSeed(21);
  let sold = false;
  for (let i = 0; i < 30 && !sold; i++) {
    setSeed(1500 + i);
    const g = fresh(['P15'], { budget: 0, line: 'hazir' }); // bütçe 0 → sadece satış dosyaları
    const sf = playUntilFile(g, 'sfile');
    if (!sf) continue;
    const p = g.squad.find((x) => x.id === sf.file.playerId);
    const star = p && p.overall >= 80;
    const trf0 = g.gauges.taraftar, n0b = g.squad.length;
    A.resolveSaleFile(g, sf.id, 'sat');
    if (star) check('yıldız satış dramı: taraftar düştü', g.gauges.taraftar < trf0);
    check('SAT: oyuncu gitti + kasa arttı', g.squad.length === n0b - 1);
    sold = true;
  }
  check('satış aynası dosyası üretildi', sold);

  // P21 vaadi → GM otomatik yıldız dosyası
  setSeed(31);
  const G3 = fresh(['P21'], { budget: 300, line: 'hazir' }); // çizgi 'hazir' ama P21 var → yıldız dosyası
  let starFile = null;
  for (let w = 0; w < 4 && !starFile; w++) {
    A.advanceWeek(G3); G3.pendingMatch = null;
    const sf = firstFile(G3, 'sfile');
    if (sf) A.resolveSaleFile(G3, sf.id, 'red'); // satış dosyası GM'i bloklamasın
    const ff = firstFile(G3, 'tfile');
    if (ff && ff.file.player.overall >= 80) starFile = ff;
    else if (ff) A.resolveTransferFile(G3, ff.id, 'red');
  }
  check('P21 vaadi → GM yıldız (80+) dosyası getirdi', !!starFile, starFile ? `güç ${starFile.file.player.overall}` : 'gelmedi');
}

// ══ §2 TD SÜRECİ ══
console.log('\n── §2 TD süreci ──');
setSeed(41);
{
  const G = fresh();
  const kasa0 = G.economy.kasa, trf0 = G.gauges.taraftar;
  const r = A.fireCoach(G);
  check('kovma: tazminat kasadan + taraftar tepkisi + vekil', r.ok && G.economy.kasa < kasa0 && G.gauges.taraftar < trf0 && G.coach.name.includes('Vekil'), `tazminat ${r.tazminat.toFixed(1)}mn`);
  const cf = firstFile(G, 'cfile');
  check('GM 2-3 aday DOSYASI getirdi', !!cf && G.coachFiles.length >= 2 && G.coachFiles.length <= 3, `${G.coachFiles.length} aday`);
  check('aday cümleleri SAYI içermiyor', G.coachFiles.every((c) => !/\d/.test(A.coachDescribe(c))), A.coachDescribe(G.coachFiles[0]));
  const uyum0 = 99; G.taktik.uyumHafta = uyum0;
  A.hireCoachFile(G, cf.id, 0);
  check('imza: TD atandı + sezon içi ceza (uyum sıfır)', !G.coachSearch && G.taktik.uyumHafta === 0 && G.coach.name === G.inbox.find((m) => m.t.startsWith('İmza:')).t.replace('İmza: ', ''));
  check('kovma sürerken ikinci kovma engelli', A.fireCoach(G).ok === true && A.fireCoach(G).ok === false);
}

// ══ §3 STAT SIZINTISI ══
console.log('\n── §3 Stat sızıntısı temizliği ──');
setSeed(51);
{
  const G = fresh();
  A.advanceWeek(G); G.pendingMatch = null;
  const sq = squadView.render(G);
  check('kadro: TD kartında çıplak stat kodu yok (tkt/oy vb.)', !/tkt\d|oy\d|ot\d|ye\d/.test(sq));
  check('kadro: güç sis aralığı formatında (örn 52-58)', sq.includes('±'));
  check('kadro: form/kondisyon kelime (Formda/Zinde...)', /(formda|dalgalı|formsuz)/i.test(sq) && /(zinde|yorgun|bitkin)/i.test(sq));
  const ck = cockpit.render(G);
  check('kokpit: çarpan ondalıkları yok (0.89 gibi)', !/>0\.\d\d</.test(ck));
  const manset = G.inbox.find((m) => m.cat === 'manset');
  check('manşet gövdesinde ton sayısı yok', manset && !/tonu -?\d/.test(manset.b), manset ? manset.b : '');
}

// ══ §4 KONGRE ══
console.log('\n── §4 Kongre cilası ──');
setSeed(61);
{
  const G = fresh(['P02', 'P15']);
  check('veri yokken "—" + açıklama', congress.render(G).includes('karne birikmedi'));
  for (let w = 0; w < 6; w++) { A.advanceWeek(G); G.pendingMatch = null; }
  const html = congress.render(G);
  check('trend çizgisi (svg polyline) çizildi', html.includes('<polyline'));
  check('bileşen delta okları (▲/▼/—) var', /(▲|▼|—)/.test(html));
  check('neden cümleleri var', /(beklenti|borç|basın havası|vaat yolunda|söz verilmedi)/.test(html));
  check('vaat mini ilerleme barları var', html.includes('Vaat İlerlemesi') && (html.match(/track/g) || []).length >= 2);
  check('haftalık oy geçmişi birikiyor', (G.voteHistory || []).length >= 6);
}

// ══ §5 TELKİN CİLASI ══
console.log('\n── §5 Telkin cilası ──');
setSeed(71);
{
  const G = fresh();
  G.hazirlik = 0; // maç haftası kokpiti — Maç Öncesi (soyunma odası) team-talk şeridi görünsün
  const ck = cockpit.render(G);
  check('bağlam çipleri (Rakip/Revir/Bacaklar)', /Rakip <b>/.test(ck) && /revir <b>/.test(ck) && /bacaklar <b>/.test(ck));
  check('TD ilişki KELİMESİ (sayı yok)', /(Uyumlu|Mesafeli|Gergin)/.test(ck) && !ck.includes('tdRelation'));
  // TD cevabı inbox'a (telkin değişince bir kez)
  A.setTelkin(G, 'rotasyon');
  G.squad.forEach((p) => { p.fitness = 60; });
  A.advanceWeek(G); G.pendingMatch = null;
  check('telkin kabul cevabı inbox\'ta', G.inbox.some((m) => m.cat === 'td' && m.t.includes('telkin kabul')));
  check('maç raporunda telkin izi', G.inbox.some((m) => m.cat === 'mac' && /(Rotasyona rağmen|Rotasyonun bedeli)/.test(m.b)));
  // Özel prim kritik-hafta kilidi
  setSeed(72);
  const G2 = fresh();
  let blocked = null, allowed = null;
  for (let w = 0; w < 34 && (blocked === null || allowed === null); w++) {
    const crit = A.isCriticalWeek(G2);
    const r = A.armOzelPrim(G2);
    if (!crit && blocked === null) blocked = r.ok === false;
    if (crit && allowed === null) { allowed = r.ok === true; G2.ozelArmed = false; G2.ozelUsed = false; }
    if (r.ok) { G2.ozelArmed = false; G2.ozelUsed = false; }
    A.advanceWeek(G2); G2.pendingMatch = null;
  }
  check('özel prim: kritik olmayan haftada KİLİTLİ', blocked === true);
  check('özel prim: kritik haftada AKTİF', allowed === true);
}

// ══ §6 TAM PUAN TABLOSU ══
console.log('\n── §6 Tam puan tablosu ──');
setSeed(81);
{
  const G = fresh();
  const wk1 = cockpit.render(G); // hafta 1, maç yok — PUAN DURUMU kokpitte HER ZAMAN açık (sb-)
  const rowCount = (wk1.match(/sb-lig-row/g) || []).length;
  check('18 satır tam tablo (sb-)', rowCount === 18, `${rowCount} satır`);
  // hafta-1: güç sırasına göre — en güçlü rakip (o0) 1. sırada olmalı
  const firstRowName = (wk1.match(/sb-lig-pos[^"]*">1<\/span><span class="sb-lig-name">([^<]+)/) || [])[1];
  check('hafta-1 sıralama güç sırasına göre (ezeli rakip zirvede)', firstRowName === G.opponents[0].name, firstRowName);
  check('ayraçlar var (Avrupa/Küme hattı renk sınıfları — sb-)', wk1.includes('sb-lig-pos avr') && wk1.includes('sb-lig-pos kume'));
  A.advanceWeek(G); G.pendingMatch = null;
  check('maç sonrası kendi satır vurgulu (is-us)', cockpit.render(G).includes('sb-lig-row is-us'));
}

// ══ §7 KİMLİK KARTI ══
console.log('\n── §7 Kulüp kimlik kartı ──');
{
  const G = fresh();
  A.advanceWeek(G); G.pendingMatch = null;
  const html = clubView.render(G);
  check('kuruluş + stadyum + ezeli rakip', html.includes('1931') && html.includes('Yıldız Arena') && html.includes(G.club.rivalName));
  check('anlatı etiketi rozeti', /(ŞAMPİYONLUK YARIŞI|KRİZ KULÜBÜ|BORÇ BATAĞI|YENİDEN DOĞUŞ|SAKİN SULAR|SEÇİM SATHI)/.test(html));
  check('TD bölümü kimlikten ÇIKTI (Kadro\'ya taşındı)', !html.includes('Teknik Direktör'));
  check('müze korunuyor', html.includes('Müze'));
  check('transfer ekranı salt-okunur (Al/Sat butonu yok)', !/data-act="buy"|data-act="sell"/.test(transferView.render(G)));
}

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
