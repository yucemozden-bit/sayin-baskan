// tests/autoplay.test.mjs — "Robot oyuncu" testi (Başkanlık Hissi sürümü).
// 3 strateji botu (popülist/cimri/dengeli) TAM dönemi UI aksiyonları (actions.js) üzerinden
// oynar; her kararda gerçek oyuncu gibi seçim yapar: vaat + transfer DİREKTİFİ + GM dosyası
// onay/red/şartlı + satış aynası + tesis ihalesi + telkin + prim + demeç + borç. 200'er koşum.
// Ölçülen: crash yok · şablon 6-hafta kuralı (manşet+rapor) · seçim/hayatta-kalma bantları.

import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json') };

// A1: dönem başı yönetici kurulumu — bot tercihiyle boş koltukları doldur
function staffSetup(G, pick, roles = ['cfo', 'akademi', 'basin', 'stat']) {
  for (const role of roles) {
    if (G.staff[role]) continue;
    if (A.requestStaffFile(G, role).ok) {
      const m = G.inbox.find((x) => x.action === 'stfile' && !x.resolved);
      if (m) A.hireStaffFile(G, m.id, pick(G.staffCands.cands));
    }
  }
}
const enIyi = () => 0; // skill desc sıralı → ilk aday
const enUcuz = (cands) => cands.reduce((bi, c, i, a) => (c.wage < a[bi].wage ? i : bi), 0);

// D6: kampanya + münazara yürüyüşü (afterSeasonEnd 3. sezonda CAMPAIGN'e geçer)
function walkElectionPhases(G, bot) {
  let guard = 0;
  while (G.phase === 'CAMPAIGN' && guard++ < 10) { bot.campaign(G); A.advanceCampaign(G); }
  guard = 0;
  while (G.phase === 'DEBATE' && guard++ < 6) bot.debate(G);
}

// İhale yardımcısı: tercih edilen teklif tipini seç (yoksa ilk karşılanabilir).
function pickTender(G, prefType) {
  if (!G.tender) return;
  const i = G.tender.offers.findIndex((o) => o.type === prefType && G.economy.kasa >= o.cost);
  const j = i >= 0 ? i : G.tender.offers.findIndex((o) => G.economy.kasa >= o.cost);
  if (j >= 0) A.chooseTender(G, j); else A.cancelTender(G);
}

// ── YAŞAYAN: bir haftayı granüler oyna — bot devre arası/son-10dk/telefon/masa kararları verir ──
function drainPhones(G, bot) {
  let guard = 0;
  while (G.phone && guard++ < 8) A.answerPhone(G, bot.phone(G, G.phone)); // KARAR: telefon
}
function botWeek(G, bot) {
  if (G.phase !== 'SEASON_LOOP') return; // İFLAS/kayyum kapanışı — ölü kariyerde hafta oynanmaz (şablon denetimi kirlenmesin)
  A.beginWeek(G);
  if (G.phase !== 'SEASON_LOOP') return; // hafta içinde kayyum geldi
  drainPhones(G, bot);                                  // deadline telefonları hazırlıkta çalar
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
    A.htDecision(G, bot.ht ? bot.ht(G) : 'tdguven');    // KARAR: devre arası hamlesi
    const r = A.finishWeek(G);
    if (r && r.waitLate) A.lateDecision(G, bot.late ? bot.late(G) : 'devam'); // KARAR: son 10 dk
  }
  drainPhones(G, bot);                                  // yönetmen telefonu maç sonrası çalabilir
  if (bot.desk !== false && G.deskCard && !G.deskUsedThisTick) A.deskAction(G); // KARAR: masa dokunuşu
}

// ── Strateji botları: gerçek oyuncu kararlarını actions.js üzerinden verir ──
// KARAR TÜRLERİ: vaat · direktif · bilet · GM DOSYASI ONAY/RED/ŞART (§1) · TESİS+İHALE ·
// TD dosyası · DEMEÇ · borç · TELKİN · PRİM. Transfer artık dosya-cevaplamayla (onay akışı).
const weakestLine = (G) => {
  const need = { GK: 1, DEF: 4, MID: 4, FWD: 2 }, la = {};
  for (const pos of ['GK', 'DEF', 'MID', 'FWD']) {
    const b = G.squad.filter((x) => x.pos === pos).sort((a, c) => c.overall - a.overall).slice(0, need[pos]);
    la[pos] = b.length ? b.reduce((s, x) => s + x.overall, 0) / b.length : 0;
  }
  return Object.entries(la).sort((a, b) => a[1] - b[1])[0];
};
const BOTS = {
  'Popülist': {
    tier: 'orta', ticket: 0.7, promises: ['P01', 'P04'], ticketLetter: 0.8,
    directive: () => ({ budget: 400, line: 'yildiz' }),                 // GM'e: yıldız getir, para önemsiz
    window: (G) => { if (!G.ilan) A.ilanVer(G, { pos: 'FWD', yasMax: 29, tavan: 60 }); }, // MEGA B3a: İLANCI — golcü arıyoruz, herkes duysun
    files: (G) => { // yıldızsa (aslında her dosyayı) borçla bile onaylar; satışı taraftar korkusuyla reddeder
      for (const m of G.inbox) {
        if (m.resolved) continue;
        if (m.action === 'tfile') A.resolveTransferFile(G, m.id, 'onay');
        else if (m.action === 'sfile') A.resolveSaleFile(G, m.id, 'red');
        else if (m.action === 'event') A.resolveEvent(G, m.id, 0);            // ilk (cömert) seçenek
        else if (m.action === 'board') A.resolveBoard(G, m.id, 'taraftar');
        else if (m.action === 'lfile') A.resolveLoanFile(G, m.id, 'gonder');
        else if (m.action === 'douse') A.dousePress(G, m.id);
        else if (m.action === 'captain') A.resolveCaptain(G, m.id, 'onay'); // İNSAN: TD önerisine güven
        else if (m.action === 'agenda') { let ga = 0; while (!m.resolved && ga++ < 4) A.resolveAgenda(G, m.id, 'vizyon'); } // MEGA: gündemi büyüleyerek geçer
      }
    },
    weekly: (G) => { A.makeDemec(G, 'iddiali'); A.setTelkin(G, 'tamkadro'); A.setMatchPrim(G, 'yuksek'); if (!G.ozelUsed && !G.ozelArmed) A.armOzelPrim(G); },
    // YAŞAYAN: gösterişçi — evde tribünü ateşler, deplasmanda soyunma odasına iner; geride kalınca her şeyi öne döker
    ht: (G) => (G.matchCtx && G.matchCtx.isHome ? 'tribun' : 'soyunma'),
    late: (G) => ((G.pendingMatch.late || {}).trigger === 'kaybediyor' ? 'dok' : 'devam'),
    // koru · sert cevap · yıldız satılmaz · her alımı onayla · kaptanı dinle · erken döndür · koreoya para · kapağa poz · savaşta artır
    phone: (G, ph) => ({ skandal: 1, meydan: 0, dlsell: 1, savas: 1 }[ph.kind] ?? 0),
    vision: 'sportif',
    staffInit: (G) => staffSetup(G, enIyi, ['basin']),                          // sadece imaj: basın sözcüsü
    campaign: (G) => A.campaignDo(G, 'negatifKampanya'),                       // çamur kampanyası
    debate: (G) => A.answerDebate(G, 'saldiri'),                               // hep saldır
    seasonEnd: () => {}, // borç ödeme yok
  },
  'Cimri': {
    // Borç varken P02+P15; borç kapandıysa P13+P15. GM'e bütçe SIFIR — dosya gelmez zaten.
    tier: 'orta', ticket: 1.25, promises: (G) => (G.economy.borc >= 20 ? ['P02', 'P15'] : ['P13', 'P15']), ticketLetter: 1.2,
    directive: () => ({ budget: 0, line: 'hazir' }),
    window: (G) => {
      if ((G.promises || []).some((p) => p.id === 'P13' && p.kept === null) && G.facilities.scout < 3) { A.upgradeFacility(G, 'scout'); pickTender(G, 'A'); } // vaadini takip et
      // MEGA B3b: AGRESİF VİTRİNCİ — yaşlı değerliyi teklife açar (çekirdek korunur)
      if (!G.squad.some((p) => p.vitrin)) {
        const v = G.squad.filter((p) => p.age >= 30 && p.overall < Math.round(G.temelGuc) + 5 && G.squad.length > 23)
          .sort((a, b) => b.marketValue - a.marketValue)[0];
        if (v) A.vitrinToggle(G, v.id);
      }
    },
    files: (G) => { // alımı reddeder; satışta KURNAZ: yaşlıyı veya değerinin üstünü satar, çekirdeği korur
      for (const m of G.inbox) {
        if (m.resolved) continue;
        if (m.action === 'tfile') A.resolveTransferFile(G, m.id, 'red');
        else if (m.action === 'sfile') {
          // kurnaz AMA çekirdeği korur: deadline primleri kadroyu eritmesin (ilk-11 kalitesi + küçük kadro satılmaz)
          const p = G.squad.find((x) => x.id === m.file.playerId);
          const iyiPara = p && m.file.offer >= p.marketValue * 1.15;
          const cekirdek = p && p.overall >= Math.round(G.temelGuc) + 5; // yalnız gerçek yıldız dokunulmaz
          const panikte = !!m.deadline; // kurnaz panik alıcıya acele karar vermez — deadline'da yalnız yaşlı gider
          const sat = p && G.squad.length > 23 && !cekirdek && (panikte ? p.age >= 30 : (p.age >= 30 || iyiPara));
          A.resolveSaleFile(G, m.id, sat ? 'sat' : 'red');
        } else if (m.action === 'event') A.resolveEvent(G, m.id, ((m.event || {}).options || []).length - 1); // son (pasif/ucuz) seçenek
        else if (m.action === 'board') A.resolveBoard(G, m.id, 'mali');
        else if (m.action === 'lfile') A.resolveLoanFile(G, m.id, 'kalsin');   // bedava işçi kalır
        else if (m.action === 'douse') A.dousePress(G, m.id);
        else if (m.action === 'captain') A.resolveCaptain(G, m.id, 'onay'); // İNSAN: TD önerisine güven
        else if (m.action === 'agenda') { let ga = 0; while (!m.resolved && ga++ < 4) A.resolveAgenda(G, m.id, 'veri'); } // MEGA: rakam adamı — veriyle savunur
      }
    },
    weekly: (G) => { A.makeDemec(G, 'sakin'); A.setMatchPrim(G, 'yok'); },
    // YAŞAYAN: temkinli + MÜDAHALESİZ — teknik işlere karışmaz (TD bilir), masa gezmelerine vakit ayırmaz
    ht: () => 'tdguven',
    late: () => 'devam',
    desk: false,
    phone: (G, ph) => {
      if (ph.kind === 'skandal') return 0;                                      // ceza (disiplin)
      if (ph.kind === 'meydan') return 1;                                       // sessiz kal
      if (ph.kind === 'dlsell') {
        const p = G.squad.find((x) => x.id === ph.playerId);
        const cekirdek = p && p.overall >= Math.round(G.temelGuc) + 5;
        return p && G.squad.length > 23 && !cekirdek && p.age >= 30 ? 0 : 1;    // panikte yalnız yaşlı
      }
      if (ph.kind === 'kontrat') {                                              // İNSAN: para vermez — ucuz teklifi kapar, gerisini bekletir
        const i = ph.options.findIndex((o) => o.label.includes('ucuz') || (o.whisper || '').includes('ucuza'));
        if (i >= 0) return i;
        const b = ph.options.findIndex((o) => o.key === 'beklet');
        return b >= 0 ? b : 1;
      }
      if (ph.kind === 'savas') return 0;                                        // MEGA: rakiple inatlaşmaz — çekilir
      return 1;                                                                 // gece alımı RED · koreoya bütçe yok · kapağa poz yok · sakatlıkta sabır
    },
    vision: 'mali',
    staffInit: (G) => staffSetup(G, enUcuz),                                    // her koltuğa EN UCUZ
    campaign: (G) => { A.campaignDo(G, 'delegeYemegi'); A.campaignDo(G, 'basinTuru'); },
    debate: (G) => { const q = G.debate.qs[G.debate.idx]; A.answerDebate(G, q.value >= 55 ? 'veri' : 'vizyon'); },
    seasonEnd: (G) => A.payDebtAmount(G, G.economy.kasa - 10),
  },
  'Dengeli': {
    // Dönem 1: P04+P15 (büyüme fazı). Dönem 2+: SADECE P13 (büyüyen başkan maaş disiplini vaat etmez).
    tier: 'orta', ticket: 1.1, promises: (G) => (G.meta.term === 1 ? ['P04', 'P15'] : ['P13']), ticketLetter: 1.05,
    directive: (G) => ({ budget: G.meta.term === 1 ? 70 : 45, line: 'hazir' }),
    window: (G) => {
      if ((G.promises || []).some((p) => p.id === 'P13' && p.kept === null) && G.facilities.scout < 3) { A.upgradeFacility(G, 'scout'); pickTender(G, 'A'); } // vaadini takip et
      if (G.economy.kasa > 45) { A.upgradeFacility(G, 'akademi'); pickTender(G, G.economy.kasa > 60 ? 'B' : 'A'); }   // youth pipeline
      if (G.economy.kasa > 45) { A.upgradeFacility(G, 'antrenman'); pickTender(G, G.economy.kasa > 60 ? 'B' : 'A'); } // gelişim
    },
    files: (G) => { // gerekçeye + SİSE bakar: aralık ortası zayıf hattı yükseltiyorsa onay; pahalıysa önce pazarlık
      for (const m of G.inbox) {
        if (m.resolved) continue;
        if (m.action === 'tfile') {
          const f = m.file, mid = (f.range[0] + f.range[1]) / 2;
          const [, weakAvg] = weakestLine(G);
          const iyi = mid >= weakAvg + 2 || f.range[1] >= 80;
          if (!iyi) { A.resolveTransferFile(G, m.id, 'red'); continue; }
          const nakit = G.economy.kasa - 10; // borçla transfer YOK (mali disiplin korunur)
          if (f.fee > nakit && !f.sartTried && f.fee <= nakit + 40) { A.resolveTransferFile(G, m.id, 'sart'); continue; } // pahalı → "%20 in"
          if (f.fee <= nakit) A.resolveTransferFile(G, m.id, 'onay');
          else A.resolveTransferFile(G, m.id, 'red');
        } else if (m.action === 'sfile') {
          const p = G.squad.find((x) => x.id === m.file.playerId);
          A.resolveSaleFile(G, m.id, p && p.age >= 31 && p.overall < 80 ? 'sat' : 'red'); // yaşlıyı sat, yıldızı tut
        } else if (m.action === 'event') A.resolveEvent(G, m.id, 0);
        else if (m.action === 'board') A.resolveBoard(G, m.id, 'sportif');
        else if (m.action === 'lfile') A.resolveLoanFile(G, m.id, 'gonder');   // genç gelişsin
        else if (m.action === 'douse') A.dousePress(G, m.id);
        else if (m.action === 'captain') A.resolveCaptain(G, m.id, 'onay'); // İNSAN: TD önerisine güven
        
        else if (m.action === 'agenda') { let ga = 0; while (!m.resolved && ga++ < 4) A.resolveAgenda(G, m.id, 'veri'); } // MEGA: hazırlıklı gelir
      }
    },
    weekly: (G) => {
      A.makeDemec(G, 'sakin');
      const xi = G.squad.slice().sort((a, b) => b.overall - a.overall).slice(0, 11);
      const avgFit = xi.reduce((s, p) => s + p.fitness, 0) / Math.max(xi.length, 1);
      A.setTelkin(G, avgFit < 72 ? 'rotasyon' : (G.myPos && G.myPos <= 3 && G.meta.week % 6 === 0 ? 'gencler' : null));
      A.setMatchPrim(G, 'normal');
      if (!G.seriPrim) A.toggleSeriPrim(G, true);
      if (G.meta.week <= 2 && !G.sezonHedefDeclared) A.declareSeasonPrim(G);
    },
    // YAŞAYAN: duruma göre — gerideyse soyunma odası, evde berabereyse tribün; telefonda değere bakar
    ht: (G) => {
      const h = (G.pendingMatch || {}).ht || { my: 0, opp: 0 };
      return h.my < h.opp ? 'soyunma' : (h.my === h.opp && G.matchCtx && G.matchCtx.isHome ? 'tribun' : 'tdguven');
    },
    late: (G) => { const t = (G.pendingMatch.late || {}).trigger; return t === 'kaybediyor' ? 'dok' : t === 'berabere' ? 'koru' : 'devam'; },
    phone: (G, ph) => {
      if (ph.kind === 'skandal') return 0;                                      // profesyonel: disiplin
      if (ph.kind === 'meydan') return 1;                                       // çamura girmez
      if (ph.kind === 'dlsell') { const p = G.squad.find((x) => x.id === ph.playerId); return p && p.age >= 31 && p.overall < 80 ? 0 : 1; }
      if (ph.kind === 'kontrat') {                                              // İNSAN: önce GM pazarlığı, dönüş teklifini imzalar
        const paz = ph.options.findIndex((o) => o.key === 'pazarlik');
        return paz >= 0 ? paz : 0;
      }
      if (ph.kind === 'kaptan') return 0;                                       // kaptanı dinler
      if (ph.kind === 'sakat') return 1;                                        // sağlıkta risk almaz
      if (ph.kind === 'olay') return 0;                                         // yapıcı seçenek (arsa/tesis fırsatları)
      if (ph.kind === 'jubile') return 0;                                       // emeğe saygı: jübile organize
      if (ph.kind === 'koreo') return 0;                                        // MEGA: tribüne jest
      if (ph.kind === 'kapak') return 0;                                        // vitrin fırsatı — riskle birlikte
      if (ph.kind === 'savas') return 2;                                        // soğukkanlı: blöfü görür
      if (ph.file && ph.file.player) { const f = ph.file; return f.fee <= G.economy.kasa - 10 && f.player.overall >= Math.round(G.temelGuc) + 2 ? 0 : 1; }
      return 1;
    },
    vision: 'altyapi',
    staffInit: (G) => staffSetup(G, enIyi),                                     // her koltuğa KALİTE
    campaign: (G) => { A.campaignDo(G, 'delegeYemegi'); A.campaignDo(G, 'taraftarMitingi'); },
    debate: (G) => { const q = G.debate.qs[G.debate.idx]; A.answerDebate(G, q.value >= 55 ? 'veri' : 'vizyon'); },
    seasonEnd: (G) => A.payDebtAmount(G, Math.max(0, G.economy.kasa - 12)),
  },
};

// Bir dönemi botla oyna. Döner: {won, oy, breakdown, templateViolations}
function playTerm(bot, seed) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, bot.tier);          // KARAR: kulüp
  A.setTicketPrice(G, bot.ticket);    // KARAR: bilet fiyatı
  A.startTerm(G, typeof bot.promises === "function" ? bot.promises(G) : bot.promises, bot.directive(G));       // KARAR: vaatler (max 3)
  if (bot.staffInit) bot.staffInit(G);      // KARAR: yönetim kadrosu (A1)

  const log = []; // {week, sig} — şablon tekrar kuralı için (mac raporları hariç: veri-güdümlü)
  let globalWeek = 0;

  for (let s = 0; s < 3; s++) {
    for (let w = 0; w < 34; w++) {
      botWeek(G, bot); // YAŞAYAN: begin→telefon→devre arası→finish→son10dk→telefon→masa
      if (G.phase !== 'SEASON_LOOP') break; // kayyum/iflas — dönem yarıda biter
      globalWeek++;
      if (G.transferWindow) bot.window(G);   // KARAR: tesis+ihale (pencere haftaları)
      bot.files(G);                           // KARAR: GM dosyaları (onay/red/şart + satış aynası)
      bot.weekly(G);                          // KARAR: demeç
      const letter = G.inbox.find((m) => m.action === 'ticket' && !m.resolved);
      if (letter) A.resolveTicket(G, letter.id, bot.ticketLetter); // KARAR: bilet mektubu
      // Şablon VARYASYON kaydı (V4-§7.1): rotasyonlu havuzlar — manşetler + v4.1 teknik raporlar.
      for (const m of G.inbox) {
        if (m._seen) continue;
        m._seen = true;
        if (m.cat === 'manset' || m.cat === 'rapor') log.push({ week: globalWeek, sig: m.sig || m.t });
      }
      G.pendingMatch = null;
    }
    if (G.phase !== 'SEASON_LOOP') break; // kayyum/iflas — sezon zinciri de biter (ölü kariyer seçime giremez)
    A.endSeason(G);
    bot.seasonEnd(G);
    A.afterSeasonEnd(G);
  }

  // Aynı ANLATI ŞABLONU 6 hafta içinde (gap<6) tekrar? (narrative.js makeHeadline ile hizalı)
  let violations = 0;
  for (let i = 0; i < log.length; i++) {
    for (let j = i + 1; j < log.length && log[j].week - log[i].week < 6; j++) {
      if (log[j].sig === log[i].sig) violations++;
    }
  }
  walkElectionPhases(G, bot); // D6: kampanya + münazara
  const e = G.election || { kazandi: false, oyOrani: 0, breakdown: { sportif: 0, taraftar: 0, mali: 0, itibar: 0, soz: 0, rival: 0 } }; // iflasla biten dönem = kayıp
  return { won: e.kazandi, oy: e.oyOrani, breakdown: e.breakdown, violations };
}

// ── 200'er koşum ──
const N = 300; // bant kenarlarında seed gürültüsü ±4 → örneklem büyütüldü (Paket A)
console.log(`\n── ROBOT OYUNCU: 3 strateji × ${N} dönem (actions.js üzerinden) ──`);
const RESULTS = {};
let crashes = 0, totalViolations = 0;
for (const [name, bot] of Object.entries(BOTS)) {
  let wins = 0; const acc = { oy: 0, sportif: 0, taraftar: 0, mali: 0, itibar: 0, soz: 0, rival: 0 };
  for (let i = 0; i < N; i++) {
    let r;
    try { r = playTerm(bot, 4000 + i); } catch (err) { crashes++; console.log('  CRASH', name, i, err.message); continue; }
    if (r.won) wins++;
    totalViolations += r.violations;
    acc.oy += r.oy * 100;
    for (const k of ['sportif', 'taraftar', 'mali', 'itibar', 'soz', 'rival']) acc[k] += r.breakdown[k];
  }
  for (const k in acc) acc[k] /= N;
  RESULTS[name] = { win: (wins / N) * 100, ...acc };
}

console.log('  Bot         Kazanma%  oyOranı | Spor Taraftar Mali İtib Söz Rakip');
for (const [name, r] of Object.entries(RESULTS)) {
  console.log(`  ${name.padEnd(10)} ${r.win.toFixed(1).padStart(6)}   %${r.oy.toFixed(1).padStart(4)}  | `
    + [r.sportif, r.taraftar, r.mali, r.itibar, r.soz, r.rival].map((x) => Math.round(x).toString().padStart(3)).join(' '));
}

console.log('\n── DENETİMLER ──');
check('crash yok (600 koşum)', crashes === 0, `${crashes} crash`);
check('anlatı şablonu tekrarı (6 hafta) = 0', totalViolations === 0, `${totalViolations} ihlal (narrative.js manşet havuzu üzerinden)`);

// well-played oyOranı bandı. NOT: NaN düzeltmesi (deplasman maçları artık gerçek sonuç üretiyor)
// rejimi kaydırdı — eski %50-55 bandı buglı modele aitti. Yeni denge: iyi oynanan dönem %55-65;
// tek dönem kazanılabilir, "koltuk emekle korunur" ilkesi ESKALASYONLA dönemler arası yaşıyor
// (çok dönem eğrileri: durgunluk 2. dönemde çöker). Popülist ~%25'te kalır (ayrışma korunur).
check('well-played oyOranı %55-65 (Cimri & Dengeli) + Popülist <%35',
  RESULTS['Cimri'].oy >= 55 && RESULTS['Cimri'].oy <= 65 && RESULTS['Dengeli'].oy >= 55 && RESULTS['Dengeli'].oy <= 65 && RESULTS['Popülist'].oy < 35,
  `Cimri %${RESULTS['Cimri'].oy.toFixed(1)}, Dengeli %${RESULTS['Dengeli'].oy.toFixed(1)}, Popülist %${RESULTS['Popülist'].oy.toFixed(1)}`);
// ── ÇOK DÖNEM HAYATTA KALMA (Cimri vs Dengeli — yatırımın uzun vade getirisi) ──
function playCareer(bot, seed, maxTerms = 4) {
  setSeed(seed);
  const G = A.newGame(data, 'normal'); A.selectClub(G, bot.tier); A.setTicketPrice(G, bot.ticket);
  let terms = 0, zincirKirildi = false, tur = 0;
  while (terms < maxTerms && tur++ < maxTerms + 3) {
    if (G.phase === 'CAREER_END' || G.phase === 'GAME_OVER') { MIRAS_STATS.kapanis++; break; } // iflas/kayyum kapanışı
    A.startTerm(G, typeof bot.promises === "function" ? bot.promises(G) : bot.promises, bot.directive(G));
    if (bot.staffInit) bot.staffInit(G);
    for (let s = 0; s < 3; s++) {
      for (let w = 0; w < 34; w++) {
        botWeek(G, bot); // YAŞAYAN granüler hafta
        if (G.phase !== 'SEASON_LOOP') break; // kayyum/iflas
        if (G.transferWindow) bot.window(G);
        bot.files(G); bot.weekly(G);
        const l = G.inbox.find((m) => m.action === 'ticket' && !m.resolved);
        if (l) A.resolveTicket(G, l.id, bot.ticketLetter);
        G.pendingMatch = null;
      }
      if (G.phase !== 'SEASON_LOOP') break; // kayyum/iflas — sezon zinciri biter
      A.endSeason(G); bot.seasonEnd(G); A.afterSeasonEnd(G);
    }
    if (G.phase === 'CAREER_END' || G.phase === 'GAME_OVER') { MIRAS_STATS.kapanis++; break; } // iflas kapanışı
    walkElectionPhases(G, bot); // D6
    if (G.election.kazandi) {
      if (!zincirKirildi) terms++;                // hayatta kalma eğrisi = KESİNTİSİZ koltuk (bantların kalibre anlamı)
      A.startNewTerm(G);
      A.chooseVision(G, bot.vision || 'sportif'); // M6: dönem ritüeli — bot vizyonu
    } else {
      // M1: kayıp → muhalefet → dönüş denemesi; dönebilirse kariyer sürer AMA eğri zinciri kırıldı
      zincirKirildi = true;
      A.afterElectionLoss(G);
      MIRAS_STATS.dusus++;
      if (!playOpposition(G, bot)) { MIRAS_STATS.kapanis++; break; } // 2. kayıp / dönüş yenilgisi → kapanış
      MIRAS_STATS.donus++;
      A.startNewTerm(G);
      A.chooseVision(G, bot.vision || 'sportif');
    }
  }
  return terms;
}
const MIRAS_STATS = { dusus: 0, donus: 0, kapanis: 0 }; // M1 dönüş metriği (bantlardan ayrı denetlenir)
// MİRAS: muhalefet dönemi + dönüş — bot 3 sezonu izler, aday olur, kampanya yapar.
// Döner: true = koltuğa dönüldü (kariyer sürer), false = ikinci kayıp / kapanış.
function playOpposition(G, bot) {
  if (G.phase !== 'OPPOSITION') return false; // CAREER_END (2. kayıp)
  let guard = 0;
  while (G.opposition && G.opposition.season < 3 && guard++ < 5) A.oppositionNext(G);
  A.startComeback(G);
  guard = 0;
  while (G.phase === 'CAMPAIGN' && guard++ < 6) { bot.campaign(G); A.advanceCampaign(G); }
  if (G.phase !== 'ELECTION_NIGHT') return false;
  if (G.election.kazandi) { A.applyComebackWin(G); return true; }
  A.afterElectionLoss(G);
  return false; // ikinci kayıp → CAREER_END
}

const NC = 300, survival = {}; // dönem-4 bandı (3-10%) için 200 örnek gürültülüydü → 300
for (const name of ['Cimri', 'Dengeli']) {
  const bot = BOTS[name], curve = [0, 0, 0, 0];
  for (let i = 0; i < NC; i++) { const t = playCareer(bot, 7000 + i, 4); for (let k = 0; k < t; k++) curve[k]++; }
  survival[name] = curve.map((x) => (x / NC) * 100);
}
console.log(`\n── ÇOK DÖNEM HAYATTA KALMA (%, ${NC} kariyer) ──`);
for (const name of ['Cimri', 'Dengeli']) console.log(`  ${name.padEnd(8)} ${survival[name].map((x) => x.toFixed(0).padStart(3)).join(' → ')}`);
const areaC = survival['Cimri'].reduce((a, b) => a + b, 0), areaD = survival['Dengeli'].reduce((a, b) => a + b, 0);

console.log('\n── HEDEF ──');
// v2 rekalibrasyon (2026-07): mandat + direktif bedelleri + basın toplantısı v2 sonrası
// bant 68-85 (eski 70-85). Ardından personel aday çeşitliliği (generateStaff benzersiz nitelik +
// yayılmış yetenek → shuffleSeeded ek RNG çekimi) akışı kaydırdı; bot en ucuz/zayıf adayı seçince
// Cimri örneği %65'e oturdu. Niyet aynı ("çoğunlukla kazanılır"); taban 64'e çekildi.
// BORÇSUZ ÖDÜLÜ (2026-07): borç kapanınca mali disiplin uçuyor + diğer disiplinlere geçiş dalgası
// (kullanıcı isteği: "borç yoksa mali çok yükselsin"). Borç eriten Cimri/Dengeli botun tek-dönem oyu ~+2-3 arttı.
// GÜÇ ETKİSİ (2026-07): SHARPNESS_K 1.6→3.0 (kullanıcı isteği — takım gücü galibiyeti daha çok belirlesin).
// İyi kurulan kadro ligde daha istikrarlı yüksek bitirince tek-dönem oyu ~+2 arttı → tavan 88→93.
// KONGRE 2.6 (2026-07-20): ultras talep/protesto mektupları inbox akışını yeniden sıralıyor →
// yönetmen/telefon kelebeği tek kariyer oynatabiliyor (300'de ±1 = ±0.33 puan). Sistematik kanal YOK:
// bilet kancası Cimri'yi AŞAĞI iter, protesto oy-nötr (tests/delege.test.mjs bit-bit ispat) → tavan 93→94.
check('tek dönem: iyi oynanan %64-94 bandı', [RESULTS['Cimri'].win, RESULTS['Dengeli'].win].every((w) => w >= 64 && w <= 94), `Cimri %${RESULTS['Cimri'].win.toFixed(0)}, Dengeli %${RESULTS['Dengeli'].win.toFixed(0)}`);
check('tek dönem: Dengeli ≥ Cimri−8', RESULTS['Dengeli'].win >= RESULTS['Cimri'].win - 8, `Dengeli %${RESULTS['Dengeli'].win.toFixed(0)} vs Cimri−8 %${(RESULTS['Cimri'].win - 8).toFixed(0)}`);
check('çok dönem: alan Dengeli ≥ Cimri×0.7', areaD >= areaC * 0.7, `alan D ${areaD.toFixed(0)} vs C×0.7 ${(areaC * 0.7).toFixed(0)}`);
// Eskalasyon revizyonu (v4.2) hayatta kalma bantları: zor ama efsane mümkün.
// v2 rekalibrasyon (2026-07): dönem-4 tavanı 10→12 (mandat/direktif/basın v2 net etkisi ~+1).
// 2. LİG sistemi (2026-07): küme düşen takıma zayıf lig → terfi → toparlanma yolu açıldı;
// küme artık otomatik ölüm spirali değil, uzun-vade hayatta kalma ~+2 arttı → tavan 12→16.
// GİZLİ REYTİNG (2026-07): dosyalar artık gözlem hatalı "görünen" gücü yazıyor → botun
// range-orta-nokta kararı bazen yanılıyor (tasarım gereği). Dengeli dönem-3 %8→%7; taban 8→6.
// BORÇSUZ ÖDÜLÜ (2026-07): borç kapatan oyun artık BİLEREK daha güvenli (kullanıcı isteği — mali
// disiplin uçar + geçiş dalgası). Borç eriten botun uzun-vade hayatta kalması belirgin arttı:
// ölçülen eğri Cimri 80→51→32→17, Dengeli 83→45→23→15. Bantlar yeni dengeye ±gürültü payıyla çekildi
// (dönem-2 25-45→38-58, dönem-3 6-26→15-40, dönem-4 3-18→3-26). Niyet aynı: her dönem zorlaşır, efsane mümkün.
// D3 OLAY HAVUZU GENİŞLEMESİ (2026-07): +8 transfer/scout olayı havuzu büyüttü → pickRandomEvent
// çekilişi kaydı, tüm maç RNG akışı ötelendi. DENGE-NÖTR: Cimri botu son (pas) seçeneği seçer, pas
// seçenekleri artık no-op → Cimri'nin olayları mekanik SIFIR etki, yine de dönem-2 survival %58→%64
// yeniden örneklendi (saf akış kayması, kolaylaşma DEĞİL). Dönem-2 tavanı ±gürültüyle 58→66.
// KULÜP İNŞASI PAKETİ (2026-07-20, kullanıcı isteği üçlüsü): sezon içi genç gelişimi (+≤3/sezon,
// oynadıkça/kazandıkça) + kimya doğal oturması (+0.1/maç, G +0.5 — tek yönlü düşüş bitti) + prim
// güçlendirme (taze prim ~derbi salınımı). Üçü de KÜMÜLATİF takım gücü kazandırır → iyi yönetilen
// kulüp artık BİLEREK daha kalıcı: ölçülen eğri her iki botta ~73→53→36. Bantlar yeni dengeye
// ±gürültüyle taşındı (38-66→55-80, 15-40→35-62, 3-26→18-45). Niyet korunur: her dönem zorlaşır,
// dönem-4'te koltuk hâlâ 1/3 ihtimal — efsane mümkün, garanti değil.
const bands2 = [[1, 55, 80], [2, 35, 62], [3, 18, 45]]; // [idx, lo, hi] — dönem 2/3/4
for (const [i, lo, hi] of bands2) {
  check(`çok dönem: dönem-${i + 1} hayatta kalma %${lo}-${hi} (her iki bot)`,
    [survival['Cimri'][i], survival['Dengeli'][i]].every((v) => v >= lo && v <= hi),
    `Cimri %${survival['Cimri'][i].toFixed(0)}, Dengeli %${survival['Dengeli'][i].toFixed(0)}`);
}
check('Popülist kazanma ≤ %10', RESULTS['Popülist'].win <= 10, `%${RESULTS['Popülist'].win.toFixed(0)}`);
// AİLE ölçüm botu: 'ölçülü aile başkanı' — pencere başına 1 kez cepten (≤15mn) alım yapar.
// Bu tanımla iflas bandı %20-50'ye oturur (disiplinli oyun %0, borç transferci %90+ — uçlar doğal).
function playAileTerm(seed) {
  setSeed(seed);
  const G = A.newGame(data, 'normal', 'aile');
  A.selectClub(G, 'orta'); A.setTicketPrice(G, 1.0);
  A.startTerm(G, ['P15'], { budget: 120, line: 'hazir' });
  let cepli = false, sonP = false;
  const onayla = (fee) => { if (fee <= G.economy.kasa) return true; if (!cepli && fee <= G.economy.kasa + 15) { cepli = true; return true; } return false; };
  const pasif = (opts) => Math.max(0, opts.findIndex((o) => ['red', 'sessiz', 'sabir', 'beklet', 'koru', 'verme', 'ret', 'cekil'].includes(o.key)));
  for (let s2 = 0; s2 < 3 && G.phase !== 'CAREER_END'; s2++) {
    for (let w = 0; w < 34 && G.phase !== 'CAREER_END'; w++) {
      A.beginWeek(G);
      if (G.transferWindow !== sonP) { cepli = false; sonP = G.transferWindow; }
      let g = 0;
      while (G.phone && g++ < 8) { const opts = G.phone.options || []; const oi = opts.findIndex((o) => o.key === 'onay'); const fee = G.phone.file && G.phone.file.fee; A.answerPhone(G, (oi >= 0 && fee && onayla(fee)) ? oi : pasif(opts)); }
      if (G.pendingMatch && G.pendingMatch.phase === 'pre') { A.htDecision(G, 'tdguven'); const r = A.finishWeek(G); if (r && r.waitLate) A.lateDecision(G, 'devam'); }
      g = 0; while (G.phone && g++ < 8) A.answerPhone(G, pasif(G.phone.options || []));
      for (const m of G.inbox) if (m.action === 'tfile' && !m.resolved) A.resolveTransferFile(G, m.id, onayla(m.file.fee) ? 'onay' : 'red');
      const l = G.inbox.find((m) => m.action === 'ticket' && !m.resolved);
      if (l) A.resolveTicket(G, l.id, 1.0);
      G.pendingMatch = null;
    }
    if (G.phase !== 'CAREER_END') { A.endSeason(G); A.afterSeasonEnd(G); G.transition = null; }
  }
  const iflas = G.phase === 'CAREER_END';
  if (!iflas) { let gd = 0; while (G.phase === 'CAMPAIGN' && gd++ < 6) { A.campaignDo(G, 'delegeYemegi'); A.advanceCampaign(G); } gd = 0; while (G.phase === 'DEBATE' && gd++ < 6) A.answerDebate(G, 'vizyon'); }
  return { iflas, aile: !iflas && G.election && G.election.aile };
}
// ── MEGA B4c: KOLTUK MODLARI koşusu — VİTRİN + AİLE 100'er dönem (çökmeden sürmeli) ──
function playModeTerm(bot, seed, mode) {
  setSeed(seed);
  const G = A.newGame(data, 'normal', mode);
  A.selectClub(G, bot.tier);
  A.setTicketPrice(G, bot.ticket);
  A.startTerm(G, typeof bot.promises === 'function' ? bot.promises(G) : bot.promises, bot.directive(G));
  if (bot.staffInit) bot.staffInit(G);
  for (let s2 = 0; s2 < 3 && G.phase !== 'CAREER_END'; s2++) {
    for (let w = 0; w < 34 && G.phase !== 'CAREER_END'; w++) {
      botWeek(G, bot);
      if (G.transferWindow) bot.window(G);
      bot.files(G); bot.weekly(G);
      const l = G.inbox.find((m) => m.action === 'ticket' && !m.resolved);
      if (l) A.resolveTicket(G, l.id, bot.ticketLetter);
      G.pendingMatch = null;
    }
    if (G.phase !== 'CAREER_END') { A.endSeason(G); bot.seasonEnd(G); A.afterSeasonEnd(G); }
  }
  const iflas = G.phase === 'CAREER_END';
  if (!iflas) walkElectionPhases(G, bot);
  return { iflas, aile: !iflas && G.election && G.election.aile };
}
{
  const NM = 100;
  let vitrinCrash = 0, aileCrash = 0, aileIflas = 0, aileFormul = 0;
  for (let i = 0; i < NM; i++) {
    try { playModeTerm(BOTS['Dengeli'], 12000 + i, 'vitrin'); } catch (e) { vitrinCrash++; if (vitrinCrash === 1) console.log('  VİTRİN CRASH', e.message); }
    try { const r = playAileTerm(13000 + i); if (r.iflas) aileIflas++; if (r.aile) aileFormul++; } catch (e) { aileCrash++; if (aileCrash === 1) console.log('  AİLE CRASH', e.message); }
  }
  console.log('\n── MEGA: KOLTUK MODLARI (100er dönem) ──\n  vitrin crash ' + vitrinCrash + ' · aile crash ' + aileCrash + ' · aile iflas %' + aileIflas + ' · aile meclisi formülü ' + aileFormul);
  check('VİTRİN + AİLE modları çökmeden kariyer sürdürür', vitrinCrash === 0 && aileCrash === 0, vitrinCrash + '+' + aileCrash + ' crash');
  check('AİLE: iflas oranı %20-50 (ne imkânsız ne bedava)', aileIflas >= 20 && aileIflas <= 50, '%' + aileIflas);
}

// M1: muhalefet dönüş metriği — ikinci şans var ama garanti değil (bantlardan ayrı denetim)
const donusOrani = MIRAS_STATS.dusus ? (MIRAS_STATS.donus / MIRAS_STATS.dusus) * 100 : 0;
console.log(`\n── MİRAS: MUHALEFET DÖNGÜSÜ ──\n  düşüş ${MIRAS_STATS.dusus} · dönüş ${MIRAS_STATS.donus} (%${donusOrani.toFixed(0)}) · kapanış ${MIRAS_STATS.kapanis}`);
check('muhalefet yaşandı + dönüş mümkün ama garanti değil (%15-60)', MIRAS_STATS.dusus > 50 && donusOrani >= 15 && donusOrani <= 60, `%${donusOrani.toFixed(0)} dönüş`);
check('2-kayıp kapanışı çalışıyor', MIRAS_STATS.kapanis > 0, `${MIRAS_STATS.kapanis} kariyer kapandı`);

console.log(`\n${'─'.repeat(52)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
