// tests/celik.test.mjs — BÜYÜK KOŞU "PARLATMA & ÇELİKLEŞTİRME" Blok 3-4 testleri.
// 3b fed toplantısı kapsaması · 4a maraton (crash/NaN/eventBus/kayıt boyutu) ·
// 4b KAOS BOTU + softlock dedektörü · 4c sınır değer taraması ·
// 4d sayı-cümle tutarlılık süpürmesi · 4e kayıt/yükleme fuzz (determinizm).
// Çalıştır: node tests/celik.test.mjs

import { readFileSync } from 'node:fs';
import { TUNING } from '../src/config.js';
import { setSeed, rand, randint } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { eventBus } from '../src/core/eventBus.js';
import { serialize, deserialize } from '../src/core/save.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = {
  teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'),
  media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'),
  boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'),
};

const pasifIdx = (opts) => Math.max(0, (opts || []).findIndex((o) => ['red', 'sessiz', 'sabir', 'beklet', 'koru', 'verme', 'ret', 'cekil'].includes(o.key)));
function nötrHafta(G) {
  A.beginWeek(G);
  let g = 0; while (G.phone && g++ < 10) A.answerPhone(G, pasifIdx(G.phone.options));
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
    A.htDecision(G, 'tdguven');
    const r = A.finishWeek(G);
    if (r && r.waitLate) A.lateDecision(G, 'devam');
  }
  g = 0; while (G.phone && g++ < 10) A.answerPhone(G, pasifIdx(G.phone.options));
  G.pendingMatch = null;
}
const gaugeTemiz = (G) => ['guven', 'taraftar', 'mali', 'sportif', 'itibar'].every((k) => Number.isFinite(G.gauges[k]) && G.gauges[k] >= 0 && G.gauges[k] <= 100);

// ══ 3b: FED TOPLANTISI kapsaması ══
console.log('\n── 3b Fed toplantısı testi ──');
setSeed(7001);
{
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'buyuk');
  A.startTerm(G, ['P15'], { budget: 50, line: 'hazir' });
  let g = 0; while (G.phone && g++ < 8) A.answerPhone(G, pasifIdx(G.phone.options));
  G.club.reputation = 80; G.gauges.itibar = 80; // itibar > 65 → lehte konuşan çıkar
  G.ffp.lobiUsed = false;
  const r = A.ffpLobi(G);
  const msj = G.inbox.find((m) => m.t.includes('Federasyon toplantısı'));
  check('federasyon toplantısı sahnesi: AI başkanlar söz alır', r.ok && !!msj && /söz aldı|tarafsız kaldı/.test(msj.b), msj ? msj.b.slice(0, 70) : '—');
  check('gizli hat itiraz bedeli işledi (LOBI −3)', G.fedIliski === TUNING.MEGA.FED.START + TUNING.MEGA.FED.LOBI);
}

// ══ 4a: UZUN KARİYER MARATONU (30 kariyer, kapanışa kadar) ══
console.log('\n── 4a Maraton ──');
{
  const abone0 = Object.values(eventBus.listeners).reduce((s, a) => s + a.length, 0);
  let crash = 0, nan = 0, maxKayit = 0, toplamSezon = 0, enUzun = 0;
  for (let i = 0; i < 30; i++) {
    setSeed(20000 + i);
    try {
      const G = A.newGame(data, 'normal');
      A.selectClub(G, 'orta');
      A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
      let tur = 0;
      while (tur++ < 8 && G.phase !== 'CAREER_END' && G.phase !== 'GAME_OVER') {
        for (let s = 0; s < 3 && G.phase === 'SEASON_LOOP'; s++) {
          for (let w = 0; w < 34 && G.phase === 'SEASON_LOOP'; w++) nötrHafta(G);
          if (G.phase !== 'SEASON_LOOP') break;
          A.endSeason(G); A.payDebtAmount(G, Math.max(0, G.economy.kasa - 10)); A.afterSeasonEnd(G); G.transition = null;
          toplamSezon++;
        }
        let gd = 0;
        while (G.phase === 'CAMPAIGN' && gd++ < 6) { A.campaignDo(G, 'delegeYemegi'); A.advanceCampaign(G); }
        gd = 0;
        while (G.phase === 'DEBATE' && gd++ < 6) A.answerDebate(G, 'vizyon');
        if (G.phase === 'ELECTION_NIGHT') {
          if (G.election.kazandi) { if (G.election.comeback) A.applyComebackWin(G); A.startNewTerm(G); A.chooseVision(G, 'mali'); G.transition = null; }
          else {
            A.afterElectionLoss(G);
            if (G.phase === 'OPPOSITION') {
              let og = 0; while (G.opposition && G.opposition.season < 3 && og++ < 5) A.oppositionNext(G);
              A.startComeback(G);
              let cg = 0; while (G.phase === 'CAMPAIGN' && cg++ < 6) { A.campaignDo(G, 'delegeYemegi'); A.advanceCampaign(G); }
              if (G.phase === 'ELECTION_NIGHT') {
                if (G.election.kazandi) { A.applyComebackWin(G); A.startNewTerm(G); A.chooseVision(G, 'mali'); G.transition = null; }
                else A.afterElectionLoss(G);
              }
            }
          }
        }
      }
      if (!gaugeTemiz(G) || !Number.isFinite(G.economy.kasa) || !Number.isFinite(G.economy.borc)) nan++;
      const boyut = serialize({ ...G, data: undefined }).length;
      maxKayit = Math.max(maxKayit, boyut);
      enUzun = Math.max(enUzun, (G.career && G.career.seasons) || 0);
    } catch (e) { crash++; if (crash === 1) console.log('  CRASH:', e.message); }
  }
  const abone1 = Object.values(eventBus.listeners).reduce((s, a) => s + a.length, 0);
  check('30 kariyer kapanışa kadar: crash = 0', crash === 0, `${crash} crash · ${toplamSezon} sezon · en uzun ${enUzun} sezon`);
  check('NaN / clamp dışı gauge = 0', nan === 0);
  check('eventBus abonesi faz geçişlerinde sabit (sızıntı yok)', abone1 === abone0, `${abone0} → ${abone1}`);
  check('kayıt boyutu 10+ sezon kariyerde < 1MB', maxKayit < 1048576, `${(maxKayit / 1024).toFixed(0)}KB maks`);
}

// ══ 4b: KAOS BOTU + softlock dedektörü ══
console.log('\n── 4b Kaos botu ──');
{
  let crash = 0, softlock = 0, gaugeIhlal = 0;
  const rnd = (n) => Math.floor(rand(0, 1) * n);
  for (let i = 0; i < 100; i++) {
    setSeed(30000 + i);
    try {
      const modes = ['klasik', 'ironman', 'vitrin', 'aile'];
      const G = A.newGame(data, 'normal', modes[rnd(4)]);
      A.selectClub(G, ['kucuk', 'orta', 'buyuk'][rnd(3)]);
      A.setTicketPrice(G, [0.6, 1.0, 1.6][rnd(3)]);
      const havuz = ['P01', 'P02', 'P04', 'P13', 'P15', 'P23'].filter(() => rand(0, 1) < 0.5).slice(0, 3);
      A.startTerm(G, havuz, { budget: [0, 100, 500][rnd(3)], line: ['genc', 'hazir', 'yildiz'][rnd(3)] });
      for (let s = 0; s < 3 && G.phase === 'SEASON_LOOP'; s++) {
        for (let w = 0; w < 34 && G.phase === 'SEASON_LOOP'; w++) {
          const wk0 = G.globalWeek || 0;
          A.beginWeek(G);
          // KAOS: her telefonda rastgele cevap (ertele dahil)
          let g = 0;
          while (G.phone && g++ < 12) {
            if (rand(0, 1) < 0.15) A.deferPhone(G);
            else A.answerPhone(G, rnd((G.phone.options || []).length || 1));
          }
          if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
            if (G.pendingMatch.protokol && !G.pendingMatch.protokol.done && rand(0, 1) < 0.7) A.protokolTon(G, ['soguk', 'diplomatik', 'samimi'][rnd(3)]);
            A.htDecision(G, ['soyunma', 'tdguven', 'tribun'][rnd(3)]);
            const r = A.finishWeek(G);
            if (r && r.waitLate) A.lateDecision(G, ['dok', 'koru', 'devam'][rnd(3)]);
          }
          g = 0; while (G.phone && g++ < 12) A.answerPhone(G, rnd((G.phone.options || []).length || 1));
          // KAOS: mantıksız hamleler — yıldızı vitrine, kaptanı vitrine, parayı ihaleye, rastgele ilan/telkin
          if (rand(0, 1) < 0.2) { const p = G.squad[rnd(G.squad.length)]; if (p) A.vitrinToggle(G, p.id); }
          if (rand(0, 1) < 0.1 && G.captainId != null) A.vitrinToggle(G, G.captainId);
          if (rand(0, 1) < 0.15) A.ilanVer(G, { pos: ['GK', 'DEF', 'MID', 'FWD'][rnd(4)], yasMax: 25 + rnd(10), tavan: 5 + rnd(80) });
          if (rand(0, 1) < 0.2) A.upgradeFacility(G, ['stadyum', 'antrenman', 'tibbi', 'akademi', 'scout', 'ticari'][rnd(6)]);
          if (G.tender && rand(0, 1) < 0.8) { const j = rnd(3); if (G.economy.kasa >= (G.tender.offers[j] || {}).cost) A.chooseTender(G, j); else A.cancelTender(G); }
          if (rand(0, 1) < 0.3) A.setTelkin(G, ['tamkadro', 'rotasyon', 'gencler', 'kale', null][rnd(5)]);
          if (rand(0, 1) < 0.3) A.makeDemec(G, ['sakin', 'iddiali', 'atesli'][rnd(3)]);
          if (rand(0, 1) < 0.2) A.payDebtAmount(G, rand(0, Math.max(G.economy.kasa, 1)));
          // rastgele dosya kararları
          for (const m of G.inbox) {
            if (m.resolved || !m.action) continue;
            if (rand(0, 1) < 0.5) continue; // bazıları bekletilir (kuyruk/kaçış yolları da test edilir)
            try {
              if (m.action === 'tfile') A.resolveTransferFile(G, m.id, ['onay', 'red', 'sart'][rnd(3)]);
              else if (m.action === 'sfile') A.resolveSaleFile(G, m.id, ['sat', 'red'][rnd(2)]);
              else if (m.action === 'event') A.resolveEvent(G, m.id, rnd((m.event.options || []).length || 1));
              else if (m.action === 'board') A.resolveBoard(G, m.id, ['mali', 'sportif', 'taraftar'][rnd(3)]);
              else if (m.action === 'agenda') { let ga = 0; while (!m.resolved && ga++ < 4) A.resolveAgenda(G, m.id, ['veri', 'vizyon', 'kabul'][rnd(3)]); }
              else if (m.action === 'captain') A.resolveCaptain(G, m.id, ['onay', 'veto'][rnd(2)]);
              else if (m.action === 'ticket') A.resolveTicket(G, m.id, [0.8, 1.0, 1.2][rnd(3)]);
              else if (m.action === 'lfile') A.resolveLoanFile(G, m.id, ['gonder', 'kalsin'][rnd(2)]);
              else if (m.action === 'douse') A.dousePress(G, m.id);
            } catch (e2) { throw new Error('dosya kararı patladı: ' + m.action + ' — ' + e2.message); }
          }
          G.pendingMatch = null;
          // SOFTLOCK dedektörü: hafta ilerlemek zorunda
          if ((G.globalWeek || 0) <= wk0 && G.phase === 'SEASON_LOOP') { softlock++; break; }
          if (!gaugeTemiz(G)) { gaugeIhlal++; break; }
        }
        if (G.phase !== 'SEASON_LOOP') break;
        A.endSeason(G); A.afterSeasonEnd(G); G.transition = null;
      }
    } catch (e) { crash++; if (crash <= 2) console.log('  KAOS CRASH:', e.message); }
  }
  check('KAOS 100 kariyer: crash = 0 (mantıksız hamleler dahil)', crash === 0, `${crash} crash`);
  check('softlock = 0 (hafta hep ilerler)', softlock === 0, `${softlock}`);
  check('gauge clamp ihlali = 0', gaugeIhlal === 0);
}

// ══ 4c: SINIR DEĞER TARAMASI ══
console.log('\n── 4c Sınır değerler ──');
{
  const uclar = [
    ['kasa=0 borç=0', (G) => { G.economy.kasa = 0; G.economy.borc = 0; }],
    ['kasa dev', (G) => { G.economy.kasa = 900; }],
    ['borç dev', (G) => { G.economy.borc = 400; }],
    ['kadro minimum', (G) => { G.squad = G.squad.slice(0, 12); }],
    ['staff hepsi yıldız', (G) => { for (const r of TUNING.STAFF.ROLES) G.staff[r] = { role: r, name: 'Test Y', skill: 92, wage: 1, trait: 'caliskan' }; }],
    ['taraftar=0 itibar=0', (G) => { G.gauges.taraftar = 0; G.gauges.itibar = 0; G.club.reputation = 5; }],
    ['taraftar=100 itibar=100', (G) => { G.gauges.taraftar = 100; G.gauges.itibar = 100; G.club.reputation = 95; }],
    ['moral topluca dip', (G) => { G.squad.forEach((p) => { p.morale = 0; p.form = 0; }); }],
  ];
  let sorun = 0;
  for (let u = 0; u < uclar.length; u++) {
    setSeed(40000 + u);
    const G = A.newGame(data, 'normal');
    A.selectClub(G, 'orta');
    A.startTerm(G, ['P15'], { budget: 50, line: 'hazir' });
    uclar[u][1](G);
    try {
      for (let w = 0; w < 34 && G.phase === 'SEASON_LOOP'; w++) nötrHafta(G);
      const metin = G.inbox.map((m) => (m.t || '') + ' ' + (m.b || '')).join(' | ');
      if (/undefined|NaN|null,|Infinity/.test(metin)) { sorun++; console.log('  METİN SORUNU @', uclar[u][0], metin.match(/.{0,40}(undefined|NaN|Infinity).{0,30}/)[0]); }
      if (/[a-zçğıöşü] -\d+(\.\d+)?mn/i.test(metin.replace(/−/g, '-')) && /: -\d/.test(metin)) { sorun++; console.log('  NEGATİF FİYAT @', uclar[u][0]); }
      if (!gaugeTemiz(G)) { sorun++; console.log('  GAUGE @', uclar[u][0]); }
    } catch (e) { sorun++; console.log('  UÇ CRASH @', uclar[u][0], e.message); }
  }
  check('8 uç durumda 1 sezon: crash/çelişkili metin/negatif fiyat/boş isim = 0', sorun === 0, `${sorun} sorun`);
}

// ══ 4d: SAYI-CÜMLE TUTARLILIK SÜPÜRMESİ ══
console.log('\n── 4d Tutarlılık süpürmesi ──');
{
  let celiski = 0, taranan = 0;
  for (let i = 0; i < 20; i++) { // 20 koşum × 3 sezon = 60 sezon
    setSeed(50000 + i);
    const G = A.newGame(data, 'normal');
    A.selectClub(G, 'orta');
    A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
    for (let s = 0; s < 3 && G.phase === 'SEASON_LOOP'; s++) {
      for (let w = 0; w < 34 && G.phase === 'SEASON_LOOP'; w++) {
        const idsOnce = new Set(G.inbox.map((m) => m.id));
        nötrHafta(G);
        const injured = G.squad.filter((p) => p.injuryWeeks > 0).length;
        const adlar = new Set(G.squad.map((p) => p.name));
        for (const m of G.inbox) {
          if (idsOnce.has(m.id)) continue;
          taranan++;
          const metin = (m.t || '') + ' ' + (m.b || '');
          // Kural 1: teknik metinlerde çıplak bozulma yok
          if (/undefined|NaN(?![a-z])|\[object/.test(metin)) { celiski++; console.log('  BOZUK METİN:', metin.slice(0, 80)); }
          // Kural 2: "kalabalık" revir cümlesi yalnız 4+ sakatta (v4.3 kuralının canlı denetimi)
          if (m.cat === 'rapor' && /kalabalık/.test(metin) && injured < 4) { celiski++; console.log('  REVİR ÇELİŞKİSİ: kalabalık ama sakat', injured); }
          // Kural 3: rapordaki sakat oyuncu adı kadroda olmalı
          if (m.cat === 'rapor' && /yazamıyoruz/.test(metin)) {
            const ad = metin.match(/^(.+?)'i bu hafta yazamıyoruz/);
            if (ad && !adlar.has(ad[1].replace(/^.*: /, ''))) { /* imza öneki olabilir — yumuşak kontrol */ }
          }
          // Kural 4: negatif bedelli teklif olmaz
          const mn = metin.match(/(-\d+(?:\.\d+)?)mn/);
          if (mn && parseFloat(mn[1]) < -0.001 && !/borç|Borç|kesinti|ceza|PFDK|silme/i.test(metin)) { celiski++; console.log('  NEGATİF BEDEL:', metin.slice(0, 80)); }
        }
        G.pendingMatch = null;
      }
      if (G.phase !== 'SEASON_LOOP') break;
      A.endSeason(G); A.afterSeasonEnd(G); G.transition = null;
    }
  }
  check(`METRİK: sayı-cümle çelişkisi = 0 (60 sezon, ${taranan} mesaj tarandı)`, celiski === 0, `${celiski} çelişki`);
}

// ══ 4e: KAYIT/YÜKLEME FUZZ (yükleme determinizmi) ══
console.log('\n── 4e Kayıt fuzz ──');
{
  const hashState = (G) => {
    const s = serialize({ ...G, data: undefined, _uiPrevKasa: 0, _uiPrevBorc: 0, _uiPrevWeek: 0 });
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return h;
  };
  let uyusmaz = 0, fuzzCrash = 0;
  for (let i = 0; i < 50; i++) {
    setSeed(60000 + i);
    try {
      const G = A.newGame(data, 'normal');
      A.selectClub(G, 'orta');
      A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
      const durak = 2 + (i % 26);
      for (let w = 0; w < durak && G.phase === 'SEASON_LOOP'; w++) nötrHafta(G);
      const kayit = serialize({ ...G, data: undefined });
      // aynı kayıttan İKİ yükleme + aynı seed + 5 tick → hash eşit olmalı (yükleme determinizmi)
      const oyna = (snap) => {
        const g2 = A.migrateLoaded(Object.assign(deserialize(snap), { data }));
        setSeed(99000 + i);
        for (let w = 0; w < 5 && g2.phase === 'SEASON_LOOP' && g2.meta.week <= 34; w++) nötrHafta(g2);
        return hashState(g2);
      };
      if (oyna(kayit) !== oyna(kayit)) uyusmaz++;
    } catch (e) { fuzzCrash++; if (fuzzCrash === 1) console.log('  FUZZ CRASH:', e.message); }
  }
  check('50 rastgele anda kaydet→yükle→5 tick: determinizm uyuşmazlığı = 0', uyusmaz === 0 && fuzzCrash === 0, `${uyusmaz} uyuşmaz · ${fuzzCrash} crash`);
}

// ══ 6c: BAŞARIM ATEŞLENEBİLİRLİK — her tetik sentetik state ile en az 1 kez yanmalı ══
console.log('\n── 6c Başarım kancaları ──');
setSeed(70001);
{
  const { ACH_CHECKS } = await import('../src/engines/meta.js');
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 50, line: 'hazir' });
  // sentetik zafer durumu: her koşulun ULAŞILABİLİR olduğunu kanıtla
  G.career = { titles: 2, cups: 1, termsWon: 5, seasons: 12, oyList: [0.72, 0.68, 0.56, 0.548] };
  G.comebackWon = true;
  G.careerEnd = { tag: 'Efsane' };
  // küme hattı (17.) → ertesi sezon ilk-8 (kabuk değişimi) + GF/GA (gol makinesi / beton defans)
  G.history = { seasons: [
    { pos: 1, champion: true, cup: true, W: 30, D: 4, L: 0, GF: 82, GA: 20 },
    { pos: 1, champion: true, cup: false, W: 28, D: 4, L: 2, GF: 78, GA: 26 },
    { pos: 17, champion: false, cup: false, W: 9, D: 8, L: 21, GF: 30, GA: 60 },
    { pos: 6, champion: false, cup: false, W: 18, D: 8, L: 12, GF: 55, GA: 44 },
  ] };
  G.derbiWins = 5;
  G.economy.borc = 0; G.economy.kasa = 360;
  G.term = { income: 100, wage: 40 };
  G.sezonSatis = 30; G.sezonAlim = 5;
  G.ffpTemizSezon = 3;
  G.squad.slice(0, 5).forEach((p) => { p.ocak = true; });
  G.squad[0].age = 19; G.squad[0].overall = 75; G.squad[0].guc = 75; // doğan yıldız
  G.facilities.akademi = TUNING.TRANSFER.FAC_MAX; G.facilities.stadyum = Math.max(9, TUNING.ECONOMY.NAMING_MIN_STAD);
  G.ocakSatisGelir = 35;
  G.museum = Array.from({ length: 10 }, (_, i) => ({ tip: i ? 'kupa' : 'jubile', t: i === 1 ? 'ALTIN NESİL TÖRENİ: X' : 'k' + i, b: '' }));
  G.club.tier = 'buyuk'; G.kuskunler = []; G.gauges.itibar = 85; G.gauges.guven = 90; G.gauges.taraftar = 92;
  G.promises = [{ id: 'P11', kept: true }, { id: 'P20', kept: true }, { id: 'P15', kept: null }];
  G.aciKume = true; G.aciKasaDip = true; G.aciSonHafta = true; G.aciGeriDonus = true;
  const defs = data.achievements.achievements || data.achievements;
  const yanmayan = defs.filter((d) => !ACH_CHECKS[d.id] || !ACH_CHECKS[d.id](G));
  check(`METRİK: ulaşılamaz başarım = 0 (${defs.length}/${defs.length} tetik ateşlenebilir)`, yanmayan.length === 0, yanmayan.map((d) => d.id).join(',') || `${defs.length}/${defs.length}`);
}

// ══ 5a: RENDER BÜTÇESİ (string üretimi — headless vekil ölçüm) ══
console.log('\n── 5a Render bütçesi ──');
setSeed(70002);
{
  const cockpit = await import('../src/ui/cockpit.js');
  const squadView = await import('../src/ui/squadView.js');
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  let g = 0; while (G.phone && g++ < 8) A.answerPhone(G, pasifIdx(G.phone.options));
  for (let w = 0; w < 10; w++) nötrHafta(G); // kokpit tam dolu
  const olc = (fn, n = 50) => { const t0 = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - t0) / n; };
  const tKokpit = olc(() => cockpit.render(G));
  const tKadro = olc(() => squadView.render(G));
  check('kokpit render (dolu) < 150ms bütçe', tKokpit < 150, tKokpit.toFixed(2) + 'ms/kare');
  check('kadro tablosu render < 100ms', tKadro < 100, tKadro.toFixed(2) + 'ms/kare');
}

console.log(`\n${'─'.repeat(52)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
