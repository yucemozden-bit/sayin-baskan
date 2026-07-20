// tests/devasa.test.mjs — DEVASA ÇOK-SEED STRES BATARYASI (2026-07-22 "devasa test" isteği).
// maraton.test.mjs tek seed'in (4242) derin yolunu yürür; BU test GENİŞLİĞİ tarar:
// 6 farklı profil (kulüp boyu × zorluk × bot huyu) × 4'er dönem — her HAFTA hızlı invaryant
// (kadro/piyasa kimlik bütünlüğü, lig tablosu tutarlılığı, gauge/NaN), her sezon derin kontrol,
// tuhaf anlarda (sezon ortası, muhalefet) kayıt/yükleme provası.
// Çalıştır: node tests/devasa.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { TUNING } from '../src/config.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function nanAv(obj, yol = 'G', d = 0, seen = new Set()) {
  if (d > 7 || obj == null || typeof obj !== 'object' || seen.has(obj)) return null;
  seen.add(obj);
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'data') continue;
    if (typeof v === 'number' && !Number.isFinite(v)) return `${yol}.${k}`;
    if (typeof v === 'object') { const r = nanAv(v, `${yol}.${k}`, d + 1, seen); if (r) return r; }
  }
  return null;
}

// ── HAFTALIK hızlı invaryant: her hafta koşar — ilk bozulmayı HAFTASINDA yakalar ──
function haftaInv(G, et) {
  const hata = (m) => { throw new Error(`${et} · HAFTALIK İNV: ${m}`); };
  for (const [k, v] of Object.entries(G.gauges)) if (!Number.isFinite(v) || v < 0 || v > 100) hata(`gauge ${k}=${v}`);
  if (!Number.isFinite(G.economy.kasa) || !Number.isFinite(G.economy.borc)) hata('ekonomi NaN');
  // kadro kimlik bütünlüğü
  const ids = new Set();
  for (const p of G.squad) {
    if (ids.has(p.id)) hata(`kadro çift id ${p.id} (${p.name})`);
    ids.add(p.id);
    if (!p.name || typeof p.name !== 'string') hata(`isimsiz oyuncu id=${p.id}`);
  }
  // piyasa bütünlüğü: id tekil + kadro isim klonu yok + havuz makul
  if (Array.isArray(G.market)) {
    const mids = new Set(), kadroAd = new Set(G.squad.map((p) => p.name));
    for (const p of G.market) {
      if (mids.has(p.id)) hata(`piyasa çift id ${p.id} (${p.name})`);
      mids.add(p.id);
      if (kadroAd.has(p.name)) hata(`piyasada kadro klonu: ${p.name}`);
      if (!Number.isFinite(p.overall) || p.overall < 30 || p.overall > 95) hata(`piyasa güç ${p.name}=${p.overall}`);
    }
    if (G.market.length > (TUNING.TRANSFER.POOL || 80) + 20) hata(`piyasa şişti: ${G.market.length}`);
  }
  // lig tablosu tutarlılığı
  const tbl = Object.values(G.league?.table || {});
  if (tbl.length && tbl.length !== 18) hata(`lig ${tbl.length} takım`);
  for (const t of tbl) {
    if (t.P !== t.W + t.D + t.L) hata(`${t.name}: P ${t.P} ≠ ${t.W}+${t.D}+${t.L}`);
    // FFP BALYOZU (2026-07-22 bulgusu): 3. ardışık ihlalde YALNIZ benim kulübümden puan silinir —
    // bende aşağı yönlü sapmaya izin (tavan 15), AI'da katı eşitlik sürer.
    const beklenen = t.W * 3 + t.D;
    if (t.mine ? (t.Pts > beklenen || beklenen - t.Pts > 15) : t.Pts !== beklenen) hata(`${t.name}: Pts ${t.Pts} ≠ 3×${t.W}+${t.D}${t.mine ? ' (FFP sapması sınır dışı)' : ''}`);
  }
  if (G.coach && !Number.isFinite(G.coach.wage ?? 0.3)) hata('TD maaşı NaN');
}

// ── SEZONLUK derin kontrol (maraton'dan uyarlandı) ──
function sezonInv(G, et) {
  const hata = (m) => { throw new Error(`${et} · SEZON İNV: ${m}`); };
  if (G.squad.length < 14 || G.squad.length > 50) hata(`kadro boyutu ${G.squad.length}`);
  for (const p of G.squad) {
    if (!Number.isFinite(p.overall) || p.overall < 20 || p.overall > 99) hata(`${p.name} güç ${p.overall}`);
    if (!Number.isFinite(p.age) || p.age < 15 || p.age > 45) hata(`${p.name} yaş ${p.age}`);
    for (const k of ['morale', 'form', 'fitness']) if (!Number.isFinite(p[k]) || p[k] < 0 || p[k] > 100) hata(`${p.name} ${k}=${p[k]}`);
  }
  if (G.inbox.length > 30) hata(`inbox ${G.inbox.length}`);
  if (G.economy.borc < 0 || G.economy.borc > 1200) hata(`borç ${G.economy.borc}`);
  const n = nanAv(G); if (n) hata(`NaN: ${n}`);
}

// Telefon aklı (maraton'un Dengeli çekirdeği)
function telefonCevap(G, ph) {
  if (!ph) return 0;
  if (ph.kind === 'skandal') return 0;
  if (ph.kind === 'meydan') return 1;
  if (ph.kind === 'dlsell') { const p = G.squad.find((x) => x.id === ph.playerId); return p && !p.aileOgul && p.age >= 31 && p.overall < 80 ? 0 : 1; }
  if (ph.kind === 'dlbuy' || ph.kind === 'kriz') { const i = (ph.options || []).findIndex((o) => (o.key || '').includes('beklet')); return i >= 0 ? i : Math.max(0, (ph.options || []).length - 1); }
  if (ph.kind === 'kontrat') { const i = (ph.options || []).findIndex((o) => o.key === 'pazarlik'); return i >= 0 ? i : 0; }
  return 0;
}

// ── Profilli hafta botu: huy = { harcama: 0-1, rotasyon: bool, vitrinci: bool } ──
function hafta(G, w, huy, et) {
  A.beginWeek(G);
  let g = 0; while (G.phone && g++ < 8) A.answerPhone(G, telefonCevap(G, G.phone));
  if (G.pendingMatch && G.pendingMatch.phase === 'pre') {
    A.htDecision(G, ['tdguven', 'soyunma'][w % 2]);
    const r = A.finishWeek(G);
    if (r && r.waitLate) A.lateDecision(G, w % 5 === 0 ? 'dok' : 'devam');
  }
  g = 0; while (G.phone && g++ < 8) A.answerPhone(G, telefonCevap(G, G.phone));
  for (const m of G.inbox) {
    if (m.resolved) continue;
    if (m.action === 'tfile') {
      const f = m.file, nakit = G.economy.kasa - (huy.harcama > 0.6 ? 0 : 12);
      if (G.squad.length >= 28 || (f?.fee ?? 99) > nakit) A.resolveTransferFile(G, m.id, 'red');
      else A.resolveTransferFile(G, m.id, 'onay');
    } else if (m.action === 'sfile') {
      const p = G.squad.find((x) => x.id === m.file?.playerId);
      A.resolveSaleFile(G, m.id, p && !p.aileOgul && p.age >= 30 && p.overall < 78 ? 'sat' : 'red');
    } else if (m.action === 'event') A.resolveEvent(G, m.id, w % 2);
    else if (m.action === 'board') A.resolveBoard(G, m.id, 'sportif');
    else if (m.action === 'lfile') A.resolveLoanFile(G, m.id, 'kalsin');
    else if (m.action === 'douse') A.dousePress(G, m.id);
    else if (m.action === 'captain') A.resolveCaptain(G, m.id, 'onay');
    else if (m.action === 'seasonBudget') A.resolveSeasonBudget(G, m.id, 'onay');
    else if (m.action === 'bankLoan') A.resolveBankLoan(G, m.id, huy.harcama > 0.6 && G.economy.borc < 120 ? 'kabul' : 'red');
    else if (m.action === 'ticket') A.resolveTicket(G, m.id, 1.0);
    else if (m.action === 'stfile') A.hireStaffFile(G, m.id, 0);
    else if (m.action === 'cfile') A.hireCoachFile(G, m.id, 0);
    else if (m.action === 'tdkriz') A.resolveTdKriz(G, m.id, w % 3 === 0 ? 'kov' : 'arkasinda');
    else if (m.action === 'agenda') { let ga = 0; while (!m.resolved && ga++ < 4) A.resolveAgenda(G, m.id, ['vizyon', 'veri', 'taraftar'][ga % 3]); }
  }
  if (G.transferWindow) {
    const aday = (G.market || [])[w % Math.max(1, (G.market || []).length)];
    if (aday && w % 5 === 1) { A.sorgulaPlayer(G, aday.id, {}); if (w % 10 === 1 && G.economy.kasa > 5) A.requestOffer(G, aday.id); }
    if (huy.vitrinci && w % 8 === 4) { const y = G.squad.filter((p) => p.age >= 31 && !p.vitrin && !p.aileOgul)[0]; if (y && G.squad.length > 24) A.vitrinToggle(G, y.id); }
  }
  if (w === 8 && G.economy.kasa > 40 + (1 - huy.harcama) * 30) { A.upgradeFacility(G, ['antrenman', 'akademi', 'tibbi', 'scout'][w % 4]); if (G.tender) A.chooseTender(G, 0); }
  if (w === 14 && G.economy.kasa > 45 && G.economy.borc > 10) A.payDebtAmount(G, 15);
  A.makeDemec(G, 'sakin');
  if (huy.rotasyon) {
    const xi = G.squad.slice().sort((a, b) => b.overall - a.overall).slice(0, 11);
    const avgFit = xi.reduce((s, p) => s + p.fitness, 0) / Math.max(xi.length, 1);
    A.setTelkin(G, avgFit < 72 ? 'rotasyon' : null);
  }
  if (w === 1) A.setMatchPrim(G, 'normal');
  if (G.ozel) {
    if (G.ozel.olay) A.ozelKarar(G, w % 2);
    if (w % 5 === 2) for (const id of ['altyapi', 'yemek']) if (A.ozelDavet(G, id).ok) break;
  }
  G.pendingMatch = null;
  haftaInv(G, et + `W${w}`);
}

const PROFILLER = [
  { seed: 1101, kulup: 'kucuk', zorluk: 'kolay',  huy: { harcama: 0.3, rotasyon: true,  vitrinci: true } },
  { seed: 2202, kulup: 'orta',  zorluk: 'normal', huy: { harcama: 0.5, rotasyon: true,  vitrinci: false } },
  { seed: 3303, kulup: 'buyuk', zorluk: 'normal', huy: { harcama: 0.8, rotasyon: false, vitrinci: true } },
  { seed: 4404, kulup: 'orta',  zorluk: 'zor',    huy: { harcama: 0.4, rotasyon: true,  vitrinci: true } },
  { seed: 5505, kulup: 'kucuk', zorluk: 'zor',    huy: { harcama: 0.7, rotasyon: false, vitrinci: false } },
  { seed: 6606, kulup: 'buyuk', zorluk: 'zor',    huy: { harcama: 0.6, rotasyon: true,  vitrinci: false } },
];
const VAATLER = (d) => (d % 2 ? ['P15'] : ['P13', 'P15']);

const OZET = [];
for (const prof of PROFILLER) {
  const et0 = `[${prof.kulup}/${prof.zorluk}/${prof.seed}]`;
  let hataMsg = null; const ist = { donem: 0, sezon: 0, kariyer: 1, lig2: 0 };
  try {
    setSeed(prof.seed);
    let G = A.newGame(data, prof.zorluk);
    A.selectClub(G, prof.kulup);
    let tur = 0;
    while (ist.donem < 4 && tur++ < 8) {
      const d = ist.donem + 1;
      A.startTerm(G, VAATLER(d), { budget: 40 + Math.round(prof.huy.harcama * 40), line: 'hazir' });
      for (let s = 1; s <= 3; s++) {
        const et = `${et0}D${d}S${s}`;
        for (let w = 1; w <= G.SEASON_WEEKS; w++) {
          hafta(G, w, prof.huy, et);
          // KAYIT PROVASI tuhaf anda: sezon ORTASI (hafta 19), 2. dönem 2. sezon
          if (d === 2 && s === 2 && w === 19) {
            const raw = JSON.stringify({ ...G, data: undefined });
            G = A.migrateLoaded(Object.assign(JSON.parse(raw), { data }));
            haftaInv(G, et + '-yükleme-sonrası');
          }
        }
        A.endSeason(G);
        sezonInv(G, et);
        A.afterSeasonEnd(G);
        G.transition = null;
        ist.sezon++;
        if ((G.lig || 1) === 2) ist.lig2++;
      }
      let g = 0;
      while (G.phase === 'CAMPAIGN' && g++ < 10) { A.campaignDo(G, 'taraftarMitingi'); A.advanceCampaign(G); }
      g = 0;
      while (G.phase === 'DEBATE' && g++ < 6) A.answerDebate(G, 'vizyon');
      if (G.phase === 'ELECTION_NIGHT') {
        ist.donem++;
        if (G.election.kazandi) { A.startNewTerm(G); A.chooseVision(G, 'sportif'); }
        else {
          A.afterElectionLoss(G);
          if (G.phase === 'OPPOSITION') {
            // KAYIT PROVASI: MUHALEFETTE yükleme (nadir yol)
            const raw = JSON.stringify({ ...G, data: undefined });
            G = A.migrateLoaded(Object.assign(JSON.parse(raw), { data }));
            let og = 0; while (G.opposition && G.opposition.season < 3 && og++ < 5) A.oppositionNext(G);
            A.startComeback(G);
            og = 0; while (G.phase === 'CAMPAIGN' && og++ < 6) { A.campaignDo(G, 'taraftarMitingi'); A.advanceCampaign(G); }
            if (G.phase === 'ELECTION_NIGHT' && G.election.kazandi) { A.applyComebackWin(G); A.startNewTerm(G); A.chooseVision(G, 'sportif'); }
            else if (G.phase === 'ELECTION_NIGHT') A.afterElectionLoss(G);
          }
          if (G.phase === 'CAREER_END') { ist.kariyer++; setSeed(prof.seed + 77); G = A.newGame(data, prof.zorluk); A.selectClub(G, prof.kulup); }
        }
      } else if (G.phase === 'CAREER_END' || G.phase === 'GAME_OVER') {
        ist.donem++; ist.kariyer++;
        setSeed(prof.seed + 77); G = A.newGame(data, prof.zorluk); A.selectClub(G, prof.kulup);
      }
    }
  } catch (e) { hataMsg = String(e.message || e); }
  OZET.push({ ...prof, ist, hataMsg });
  check(`${et0} 4 dönem kesintisiz + her hafta invaryant temiz`, !hataMsg && ist.donem >= 4, hataMsg || `${ist.sezon} sezon · ${ist.kariyer} kariyer · 2.lig sezonu ${ist.lig2}`);
}

const lig2Toplam = OZET.reduce((a, o) => a + o.ist.lig2, 0);
check('en az bir profil 2. Lig yolunu yaşadı (küme düş/terfi kodu sahalandı)', lig2Toplam >= 1, `toplam 2.lig sezonu: ${lig2Toplam}`);
check('tüm profillerde toplam ≥60 sezon oynandı', OZET.reduce((a, o) => a + o.ist.sezon, 0) >= 60, `${OZET.reduce((a, o) => a + o.ist.sezon, 0)} sezon`);

console.log('\n────────────────────────────────────────────────');
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
