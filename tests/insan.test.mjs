// tests/insan.test.mjs — PAKET "İNSAN HİKAYELERİ + KART AUDİT" testleri.
// K1 olay kartı audit (GÖVDESİZ KART = 0) · K2 kaptan kurumu · K3 sözleşme masası ·
// K4 sakatlık hikaye yayı · K5 telkin karnesi · K6 geçiş atmosferi.
// Çalıştır: node tests/insan.test.mjs

import { readFileSync } from 'node:fs';
import { TUNING } from '../src/config.js';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { applyEventEffects } from '../src/engines/events.js';
import { upgradeCost, effectiveUpgradeCost, facilityDiscountMult } from '../src/engines/facilities.js';
import { spreadMorale } from '../src/engines/dynamics.js';
import * as squadView from '../src/ui/squadView.js';
import * as dataHub from '../src/ui/dataHub.js';
import * as inboxUI from '../src/ui/inbox.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json') };

function fresh(tier = 'orta', directive = { budget: 80, line: 'hazir' }) {
  const G = A.newGame(data, 'normal');
  A.selectClub(G, tier);
  A.startTerm(G, ['P15'], directive);
  return G;
}
function drainPhones(G, pick = null) {
  let g = 0;
  while (G.phone && g++ < 8) {
    const opts = G.phone.options || [];
    let i = pick ? pick(G.phone) : opts.findIndex((o) => ['red', 'sessiz', 'koru', 'sabir', 'beklet'].includes(o.key));
    if (i == null || i < 0) i = opts.length - 1;
    A.answerPhone(G, i);
  }
}
function week(G, { pick = null } = {}) {
  A.beginWeek(G);
  drainPhones(G, pick);
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
    A.htDecision(G, 'tdguven');
    const r = A.finishWeek(G);
    if (r && r.waitLate) A.lateDecision(G, 'devam');
  }
  drainPhones(G, pick);
  G.pendingMatch = null;
}
const captainMsg = (G) => G.inbox.find((m) => m.action === 'captain' && !m.resolved);

// ══ K1 OLAY KARTI AUDİT ══
console.log('\n── K1 Olay kartı audit ──');
{
  const all = [...data.events.random, ...data.events.threshold];
  const govdesiz = all.filter((e) => !e.body || e.body.length < 40);
  check(`GÖVDESİZ OLAY KARTI = 0 (${all.length} olay: kim/ne/bağlam)`, govdesiz.length === 0, govdesiz.map((e) => e.id).join(',') || 'hepsi dolu');
  const fisiltisiz = all.filter((e) => e.options && e.options.some((o) => !o.whisper));
  check('her seçenekte sonuç fısıltısı (yön ipucu)', fisiltisiz.length === 0, fisiltisiz.map((e) => e.id).join(',') || 'tam');
  const sayili = all.filter((e) => e.options && e.options.some((o) => /[+−-]?\d+ (puan|mn|hafta)/.test(o.whisper || '')));
  check('fısıltı YÖN verir, kesin sayı vermez', sayili.length === 0);
  check('telefon terfisi: belediye/valilik + gece skandalı + dev teklif', ['belediye-arsa', 'arsa-indirimi', 'gece-hayati', 'yildiza-dev-teklif'].every((id) => all.find((e) => e.id === id)?.phone?.caller), '4 olay arayan kimlikli');
  // motor: olay kartı body ile düşer, "1) Kabul" artığı yok
  setSeed(910);
  let kart = null, telefonluOlay = null;
  const spy = (ph) => { if (ph.kind === 'olay' && !telefonluOlay) telefonluOlay = { ...ph }; return null; };
  for (let i = 0; i < 30 && !(kart && telefonluOlay); i++) {
    setSeed(910 + i);
    const G = fresh();
    for (let w = 0; w < 30 && !(kart && telefonluOlay); w++) {
      A.beginWeek(G);
      drainPhones(G, spy);
      if (G.pendingMatch && G.pendingMatch.phase === 'pre') { A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam'); }
      drainPhones(G, spy);
      if (!kart) kart = G.inbox.find((m) => m.action === 'event' && m.t.startsWith('OLAY:'));
      // olay kartlarını çöz ki havuz akmaya devam etsin (tek-aktif-olay kuralı)
      for (const m of G.inbox) if (m.action === 'event' && !m.resolved) A.resolveEvent(G, m.id, 0);
      G.pendingMatch = null;
    }
  }
  check('inbox olay kartı: gövde metni var, "1) Kabul · 2) Red" artığı YOK', !!kart && kart.b.length >= 40 && !/\d\)\s/.test(kart.b), kart ? kart.t : 'kart gelmedi');
  check('telefonlu olay: arayan kimlikli + fısıltılı seçenekler', !!telefonluOlay && !!telefonluOlay.callerName && (telefonluOlay.options || []).every((o) => o.whisper), telefonluOlay ? `${telefonluOlay.title} (${telefonluOlay.caller})` : 'gelmedi (30 koşum)');

  // K1b: HAYALET ETKİ AUDİT — applyEventEffects'in tanımadığı effect anahtarı = sessizce yutulan vaat.
  // (belediye-arsa'nın facilityDiscount'ı bu şekilde ölü kalmıştı.) Motorun sözleşmesi:
  const MOTOR_ANAHTAR = new Set(['gauge', 'economy', 'squadMorale', 'kimya', 'mediaTone', 'player',
    'rivalAttractiveness', 'rakipCekicilik', 'servet', 'staffWageMult', 'staffLeaves', 'staffLeavesEgolu',
    'ffpMult', 'brand', 'facilityDiscount', 'chance', 'onHit', 'onMiss', 'note']);
  // BİLİNEN BORÇ: motorda henüz karşılığı olmayan anahtarlar (kullanıcı onayı bekliyor, ayrı paket).
  // Bunlar da sessizce yutuluyor — facilityDiscount ile aynı sınıf; listelenerek GÖRÜNÜR kılındı.
  const BILINEN_BORC = new Set(['revenueMult', 'coach', 'matchRevenueMult', 'board', 'gencTaban', 'radikalGrup', 'formaRevenueMult']);
  const hayalet = [], yeniHayalet = [];
  for (const e of all) for (const o of (e.options || [])) {
    for (const k of Object.keys(o.effects || {})) {
      if (!MOTOR_ANAHTAR.has(k)) { hayalet.push(`${e.id}:${k}`); if (!BILINEN_BORC.has(k)) yeniHayalet.push(`${e.id}:${k}`); }
    }
  }
  // Regresyon kapısı: facilityDiscount artık CANLI olmalı (borç listesinde OLMAMALI)
  check('facilityDiscount hayalet DEĞİL (belediye-arsa/arsa-indirimi canlı)', !hayalet.some((h) => h.endsWith(':facilityDiscount')), hayalet.filter((h) => h.endsWith(':facilityDiscount')).join(',') || 'canlı');
  // YENİ hayalet eklenmesin (bilinen borç dışında tanınmayan anahtar = 0)
  check('YENİ hayalet efekt = 0 (bilinen borç dışında tanınmayan anahtar yok)', yeniHayalet.length === 0, yeniHayalet.join(', ') || `yalnız ${hayalet.length} bilinen borç`);

  // K1c: davranışsal — belediye-arsa "Kabul" antrenman ihalesini gerçekten ucuzlatır (dönem kapsamı)
  setSeed(931);
  const Gf = fresh();
  const ham = upgradeCost('antrenman', Gf.facilities.antrenman);
  const arsa = all.find((e) => e.id === 'belediye-arsa');
  applyEventEffects(Gf, arsa.options[0].effects);
  const indirimli = effectiveUpgradeCost(Gf, 'antrenman');
  check('belediye-arsa Kabul → antrenman maliyeti −%30 (motor işliyor)', Math.abs(indirimli - ham * 0.7) < 0.01, `${ham.toFixed(1)} → ${indirimli.toFixed(1)}mn`);
  Gf.meta.term += 1;
  check('facilityDiscount kapsamı: yeni dönemde indirim biter (term scope)', facilityDiscountMult(Gf, 'antrenman') === 1, '');
}

// ══ K2 KAPTAN KURUMU ══
console.log('\n── K2 Kaptan kurumu ──');
setSeed(920);
{
  const G = fresh();
  const m = captainMsg(G);
  check('sezon başı TD kaptan önerisi (KARAR kartı)', !!m && m.b.includes('pazubandı'), m ? m.t : '—');
  A.resolveCaptain(G, m.id, 'onay');
  check('onay: kaptan atandı + kadroda (C) rozeti', !!G.captainId && squadView.render(G).includes('>C</b>'));
  // veto: TD ilişki −2 + alternatif aday
  setSeed(921);
  const G2 = fresh();
  const m2 = captainMsg(G2);
  const rel0 = G2.tdRelation ?? 70;
  const c1 = G2.captainCands.c1, c2 = G2.captainCands.c2;
  A.resolveCaptain(G2, m2.id, 'veto');
  check('veto: TD ilişki −2 + pazubant alternatife', G2.tdRelation === rel0 + TUNING.INSAN.KAPTAN.VETO_REL && G2.captainId === c2 && G2.captainId !== c1);
  // moral yayılım merkezi ×1.4 (dynamics)
  const sq = [{ id: 'a', morale: 90 }, { id: 'b', morale: 40 }, { id: 'c', morale: 40 }];
  const sq2 = sq.map((p) => ({ ...p }));
  spreadMorale(sq, null);
  spreadMorale(sq2, 'a', 1.4); // kaptan yüksek moralli → ağırlıklı ortalama yukarı çeker
  check('kaptan moral yayılım MERKEZİ (×1.4): takım kaptana doğru çekilir', sq2[1].morale > sq[1].morale, `${sq[1].morale.toFixed(1)} → ${sq2[1].morale.toFixed(1)}`);
  // kaptan satışı: kimya −8 + soyunma odası şoku
  setSeed(922);
  const G3 = fresh();
  A.resolveCaptain(G3, captainMsg(G3).id, 'onay');
  const kap = G3.squad.find((p) => p.id === G3.captainId);
  const kimya0 = G3.kimya.kimya;
  G3.squad = G3.squad.filter((p) => p !== kap); // satış simülasyonu
  week(G3);
  check('kaptan giderse: kimya −8 + şok mesajı + pazubant boş', G3.kimya.kimya <= kimya0 - 7 && G3.inbox.some((x) => x.t.includes('kaptan gitti')) && !G3.captainId, `kimya ${kimya0.toFixed(0)} → ${G3.kimya.kimya.toFixed(0)}`);
  // kriz telefonu: moral çöküşü / 3 mağlubiyet → kaptan arar
  setSeed(923);
  const G4 = fresh();
  A.resolveCaptain(G4, captainMsg(G4).id, 'onay');
  G4.squad.forEach((p) => { p.morale = 30; }); // soyunma odası dipte
  let kaptanAradi = null;
  const kapSpy = (ph) => { if (ph.kind === 'kaptan' && !kaptanAradi) kaptanAradi = { ...ph }; return 0; };
  for (let w = 0; w < 8 && !kaptanAradi; w++) {
    A.beginWeek(G4);
    drainPhones(G4, kapSpy);
    if (G4.pendingMatch && G4.pendingMatch.phase === 'pre') { A.htDecision(G4, 'tdguven'); const r = A.finishWeek(G4); if (r && r.waitLate) A.lateDecision(G4, 'devam'); }
    drainPhones(G4, kapSpy);
    G4.pendingMatch = null;
  }
  check('kriz haftası: kaptan telefonla gelir ("takım adına")', !!kaptanAradi && kaptanAradi.caller === 'kaptan' && kaptanAradi.body.includes('soyunma odası'), kaptanAradi ? kaptanAradi.callerName : 'aramadı');
  // yıldız satışında kaptan sözcü
  setSeed(924);
  const G5 = fresh();
  A.resolveCaptain(G5, captainMsg(G5).id, 'onay');
  const yildiz = G5.squad.filter((p) => p.id !== G5.captainId).sort((a, b) => b.overall - a.overall)[0];
  yildiz.overall = Math.max(yildiz.overall, TUNING.STAR_THRESHOLD);
  G5.inbox.push({ id: 'mS1', action: 'sfile', file: { playerId: yildiz.id, offer: 30 }, t: '', b: '' });
  A.resolveSaleFile(G5, 'mS1', 'sat');
  check('yıldız satışında kaptan SÖZCÜ', G5.inbox.some((x) => x.t.startsWith('Kaptan') && x.b.includes('açıklama bekliyor')));
}

// ══ K3 SÖZLEŞME MASASI DRAMI ══
console.log('\n── K3 Sözleşme masası ──');
setSeed(930);
{
  const G = fresh();
  drainPhones(G);
  week(G); // hafta 1 kapanır (masa hafta 2'den önce açılmaz)
  // hedef: yalnız BİZİM yıldız son sözleşme yılında olsun
  const star = G.squad.slice().sort((a, b) => b.overall - a.overall)[0];
  for (const p of G.squad) p.contractYears = Math.max(p.contractYears ?? 3, 3);
  star.contractYears = 1; star.overall = Math.max(star.overall, TUNING.STAR_THRESHOLD);
  G.contractSaga = null;
  let saga = null;
  A.beginWeek(G);
  saga = G.phone && G.phone.kind === 'kontrat' ? { ...G.phone } : null;
  check('menajer telefonu: son yıl yıldızı için masa açılır', !!saga && saga.caller === 'menajer' && saga.body.includes('son sözleşme yılı') && G.contractSaga.playerId === star.id, saga ? saga.title : 'gelmedi');
  check('3 seçenek: imzala / GM pazarlık / beklet (fısıltılı)', !!saga && saga.options.length === 3 && saga.options.every((o) => o.whisper));
  if (!saga) { console.log('  (saga açılmadı — kalan K3 adımları atlandı)'); process.exit(1); }
  // pazarlık yolu: tur 2 telefonu gelir
  A.answerPhone(G, saga.options.findIndex((o) => o.key === 'pazarlik'));
  drainPhones(G);
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') { A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam'); }
  G.pendingMatch = null;
  let tur2 = null;
  // 2026-07-22: kontrat telefonu o hafta kuyrukta İKİNCİ sıraya düşebilir (başka telefon önce
  // çalar) — yalnız haftanın ilk telefonuna bakmak kaçırıyordu; drain seçicisi İÇİNDE yakala.
  const yakala = (ph) => { if (ph.kind === 'kontrat' && !tur2) tur2 = { ...ph }; return ph.kind === 'kontrat' ? ph.options.findIndex((o) => o.key === 'kabul') : null; };
  for (let w = 0; w < 4 && !tur2; w++) {
    A.beginWeek(G);
    drainPhones(G, yakala);
    if (G.pendingMatch && G.pendingMatch.phase === 'pre') { A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam'); }
    drainPhones(G, yakala);
    G.pendingMatch = null;
  }
  check('pazarlık: 2. tur telefonu (orta yol ya da direniş)', !!tur2, tur2 ? tur2.title : 'gelmedi');
  const starNow = G.squad.find((p) => p.id === star.id);
  check('imza: sözleşme uzadı + maaş güncellendi', starNow && starNow.contractYears >= 2 && starNow.sagaDone === true, starNow ? `${starNow.contractYears} yıl · ${starNow.wage.toFixed(2)}mn` : '—');
  check('söylenti sızıntısı sosyal akışta', (G.socialFeed || []).some((p) => p.text.includes('istiyormuş')) || G.inbox.some((m) => m.t.includes('İMZA')), 'rakip dedikodusu / imza haberi');
  // BEKLET + sezon sonu bedava gidiş
  setSeed(931);
  const G2 = fresh();
  drainPhones(G2);
  week(G2); // hafta 1 kapanır
  const s2 = G2.squad.slice().sort((a, b) => b.overall - a.overall)[0];
  for (const p of G2.squad) p.contractYears = Math.max(p.contractYears ?? 3, 3);
  s2.contractYears = 1; s2.overall = Math.max(s2.overall, TUNING.STAR_THRESHOLD);
  G2.contractSaga = null;
  A.beginWeek(G2);
  if (G2.phone && G2.phone.kind === 'kontrat') A.answerPhone(G2, G2.phone.options.findIndex((o) => o.key === 'beklet'));
  drainPhones(G2);
  if (G2.pendingMatch && G2.pendingMatch.phase === 'pre') { A.htDecision(G2, 'tdguven'); const r = A.finishWeek(G2); if (r && r.waitLate) A.lateDecision(G2, 'devam'); }
  G2.pendingMatch = null;
  const t0 = G2.gauges.taraftar;
  for (let w = G2.meta.week; w <= 34; w++) week(G2); // sezonu bekleterek bitir
  A.endSeason(G2);
  check('bekletilen masa sezon sonunda patlar: BEDAVA gider + "yönetim uyudu" + taraftar tepkisi',
    !G2.squad.some((p) => p.id === s2.id) && G2.inbox.some((m) => m.t.includes('yönetim uyudu') || m.t.includes('Yönetim uyudu') || m.t.includes('BEDAVA')) && G2.gauges.taraftar < t0,
    `taraftar ${t0.toFixed(0)} → ${G2.gauges.taraftar.toFixed(0)}`);
}

// ══ K4 SAKATLIK HİKAYE YAYI ══
console.log('\n── K4 Sakatlık hikaye yayı ──');
setSeed(940);
{
  // sisli / net rapor: tıbbi tesise göre
  const G = fresh('kucuk'); // tibbi 2 → SİSLİ
  drainPhones(G);
  const star = G.squad.slice().sort((a, b) => b.overall - a.overall)[0];
  star.overall = Math.max(star.overall, TUNING.STAR_THRESHOLD);
  star.injuryWeeks = 4;
  G.injurySaga = { playerId: star.id, realWeeks: 4, reported: false, asked: false };
  A.beginWeek(G);
  const rapor = G.inbox.find((m) => m.t.startsWith('Sağlık raporu'));
  check('kötü tesis: rapor SİSLİ ("MR sonucu bekleniyor", aralık verir)', !!rapor && rapor.b.includes('MR') && /\d-\d/.test(rapor.b), rapor ? rapor.b.slice(0, 60) : '—');
  drainPhones(G);
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') { A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam'); }
  G.pendingMatch = null;
  const G2 = fresh(); // orta: tibbi 3 → hâlâ sisli; net için tesisi yükselt
  drainPhones(G2);
  G2.facilities.tibbi = 5;
  const s2 = G2.squad.slice().sort((a, b) => b.overall - a.overall)[0];
  s2.overall = Math.max(s2.overall, TUNING.STAR_THRESHOLD);
  s2.injuryWeeks = 3;
  G2.injurySaga = { playerId: s2.id, realWeeks: 3, reported: false, asked: false };
  A.beginWeek(G2);
  const rapor2 = G2.inbox.find((m) => m.t.startsWith('Sağlık raporu'));
  check('iyi tesis (≥5): rapor NET (kesin hafta)', !!rapor2 && rapor2.b.includes('tanı kesin') && rapor2.b.includes('3 hafta'), rapor2 ? rapor2.b.slice(0, 50) : '—');
  drainPhones(G2);
  if (G2.pendingMatch && G2.pendingMatch.phase === 'pre') { A.htDecision(G2, 'tdguven'); const r = A.finishWeek(G2); if (r && r.waitLate) A.lateDecision(G2, 'devam'); }
  G2.pendingMatch = null;
  // dönüş kararı telefonu (injuryWeeks==2) + erken dönüş + nüks istatistiği
  let erkenOk = 0, nuks = 0, temiz = 0, telefonGeldi = 0;
  for (let i = 0; i < 30; i++) {
    setSeed(9400 + i);
    const g = fresh();
    // sezon başı telefonlarını temizle (kontrat vs.)
    let gg = 0; while (g.phone && gg++ < 8) A.answerPhone(g, (g.phone.options || []).length - 1);
    const st = g.squad.slice().sort((a, b) => b.overall - a.overall)[0];
    st.overall = Math.max(st.overall, TUNING.STAR_THRESHOLD);
    st.injuryWeeks = 2;
    g.injurySaga = { playerId: st.id, realWeeks: 4, reported: true, asked: false };
    g.contractSaga = { playerId: 'yok', round: 9, state: 'kapali', startWk: 1, rumor: true, ask: { wage: 1, years: 1 } }; // kontrat telefonu karışmasın
    A.beginWeek(g);
    // sıradaki telefonlar arasında 'sakat' olanı bul
    let guard = 0, sakTel = false;
    while (g.phone && guard++ < 8) {
      if (g.phone.kind === 'sakat') {
        sakTel = true; telefonGeldi++;
        A.answerPhone(g, g.phone.options.findIndex((o) => o.key === 'erken'));
        if (st.injuryWeeks === 0) erkenOk++;
        if (g.injurySaga && g.injurySaga.nuks) nuks++; else temiz++;
      } else A.answerPhone(g, (g.phone.options || []).length - 1);
    }
    void sakTel;
  }
  check('dönüş haftası: TD ortak-karar telefonu gelir', telefonGeldi >= 25, `${telefonGeldi}/30`);
  check('erken dönüş: oyuncu hemen sahada', erkenOk === telefonGeldi, `${erkenOk}/${telefonGeldi}`);
  check('erken dönüş kumarı: nüks ~%30 (hem nüks hem temiz vaka görüldü)', nuks >= 3 && temiz >= 10, `nüks ${nuks} · temiz ${temiz}`);
  // sıradan oyuncu: saga tetiklenmez (eski kuru akış)
  setSeed(941);
  const G6 = fresh();
  drainPhones(G6);
  G6.captainId = null;
  const vasat = G6.squad.slice().sort((a, b) => a.overall - b.overall)[0];
  const once = new Set();
  vasat.injuryWeeks = 3;
  // injuryStoryCheck yalnız finishWeekTail içinde — vasat oyuncu önemli değil → saga oluşmamalı
  week(G6);
  check('sıradan oyuncu sakatlığı hikaye yayı AÇMAZ', !G6.injurySaga || G6.injurySaga.playerId !== vasat.id);
  void once;
}

// ══ K5 TELKİN KARNESİ ══
console.log('\n── K5 Telkin karnesi ──');
setSeed(950);
{
  const G = fresh();
  drainPhones(G);
  for (let w = 0; w < 6; w++) {
    A.setTelkin(G, w % 2 === 0 ? 'rotasyon' : null);
    G.squad.forEach((p) => { p.fitness = 60; }); // rotasyon mantıklı kalsın (ret olmasın)
    A.beginWeek(G);
    drainPhones(G);
    if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
      A.htDecision(G, w === 0 ? 'soyunma' : 'tdguven');
      const r = A.finishWeek(G);
      if (r && r.waitLate) A.lateDecision(G, 'devam');
    }
    drainPhones(G);
    G.pendingMatch = null;
  }
  const log = G.telkinLog || [];
  check('karne kayıtları: telkin + devre arası birlikte', log.some((e) => e.type === 'rotasyon') && log.some((e) => e.type === 'ht:soyunma') && log.some((e) => e.type === 'ht:tdguven'), `${log.length} kayıt`);
  check('her kayda maç sonucu işlendi', log.every((e) => ['W', 'D', 'L'].includes(e.res)), log.map((e) => e.res).join(''));
  const karne = A.telkinKarne(log);
  const rot = karne['rotasyon'];
  check('karne özeti: sayım + G/B/M dökümü tutarlı', rot && rot.n === rot.W + rot.D + rot.L && rot.n >= 2, rot ? `rotasyon ${rot.n} (${rot.W}G ${rot.D}B ${rot.L}M)` : '—');
  check('Veri ekranı: Telkin Karnesi kartı', dataHub.render(G).includes('Telkin Karnesi'));
  // sezon sonu arşivi
  for (let w = G.meta.week; w <= 34; w++) week(G);
  A.endSeason(G);
  check('sezon kapanışı: karne lastSeason arşivine yazılır', !!G.lastSeason.telkinKarne && Object.keys(G.lastSeason.telkinKarne).length > 0);
}

// ══ K6 GEÇİŞ ATMOSFERİ ══
console.log('\n── K6 Geçiş atmosferi ──');
setSeed(960);
{
  const G = fresh();
  drainPhones(G);
  for (let w = 0; w < 34; w++) week(G);
  A.endSeason(G);
  A.afterSeasonEnd(G);
  check('sezon → yeni sezon: yaz kampı atmosfer kartı', !!G.transition && G.transition.title.includes('Yaz Kampı') && G.transition.sub.includes(G.club.stadName), G.transition ? G.transition.title : '—');
  G.transition = null;
  // dönem geçişi — MİRAS M6: atmosfer kartının yerini DÖNEM RİTÜELİ aldı (defter + vizyon töreni)
  const G2 = fresh();
  G2.history = { seasons: [{ pos: 5 }, { pos: 5 }, { pos: 5 }] };
  A.startNewTerm(G2);
  check('seçim zaferi → dönem açılış töreni (ritüel)', !!G2.ritual && !G2.ritual.done && G2.ritual.title.includes('Dönem'), G2.ritual ? G2.ritual.title : '—');
}

// ══ ENTEGRASYON: inbox kaptan kartı UI ══
console.log('\n── UI entegrasyonu ──');
setSeed(970);
{
  const G = fresh();
  const html = inboxUI.render(G);
  check('inbox: kaptanlık kartında ONAYLA/VETO butonları', html.includes('ONAYLA (C)') && html.includes('VETO'));
}

console.log(`\n${'─'.repeat(52)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
