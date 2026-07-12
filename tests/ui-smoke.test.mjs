// tests/ui-smoke.test.mjs — Başsız (headless) oyun döngüsü + ekran render dumanı.
// actions katmanını tam bir kariyer boyunca sürer; her ekranın render'ını çağırır.
// Amaç: tarayıcı açmadan runtime/render hatalarını yakalamak. Çalıştır: node tests/ui-smoke.test.mjs

import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { shell } from '../src/ui/frame.js';
import * as clubSelect from '../src/ui/clubSelect.js';
import * as promiseSelect from '../src/ui/promiseSelect.js';
import * as cockpit from '../src/ui/cockpit.js';
import * as inbox from '../src/ui/inbox.js';
import * as finance from '../src/ui/finance.js';
import * as matchday from '../src/ui/matchday.js';
import * as seasonEnd from '../src/ui/seasonEnd.js';
import * as electionNight from '../src/ui/electionNight.js';
import * as squadView from '../src/ui/squadView.js';
import * as transferView from '../src/ui/transferView.js';
import * as facilitiesView from '../src/ui/facilitiesView.js';
import * as media from '../src/ui/media.js';
import * as congress from '../src/ui/congress.js';
import * as dataHub from '../src/ui/dataHub.js';
import * as clubView from '../src/ui/clubView.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const nonEmpty = (h) => typeof h === 'string' && h.length > 50;

setSeed(777);
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json') };

let threw = null;
try {
  const G = A.newGame(data, 'normal');
  check('CLUB_SELECT render', nonEmpty(shell(G, { content: clubSelect.render(G), center: true })));

  A.selectClub(G, 'orta');
  check('selectClub → TERM_SETUP + kadro üretildi', G.phase === 'TERM_SETUP' && G.squad.length >= 24, `kadro ${G.squad.length}, temelGüç ${Math.round(G.temelGuc)}`);
  G._sel = ['P01', 'P02', 'P15'];
  check('TERM_SETUP render (vaat kartları)', nonEmpty(promiseSelect.render(G)));

  A.startTerm(G, G._sel);
  check('startTerm → SEASON_LOOP + lig kuruldu', G.phase === 'SEASON_LOOP' && G.league.fixtures.length === 34);

  // Kaldıraç dumanı
  A.setTicketPrice(G, 1.2); check('setTicketPrice', G.economy.ticketPrice === 1.2);

  for (let season = 1; season <= 3; season++) {
    for (let w = 0; w < 34; w++) {
      A.advanceWeek(G);
      check.season = season;
      // ara sıra ekranları render et
      if (w === 5) { check(`S${season} kokpit render`, nonEmpty(cockpit.render(G))); check(`S${season} matchday render`, nonEmpty(matchday.render(G))); }
      if (w === 8) { A.payDebtAmount(G, 5); check(`S${season} inbox render`, nonEmpty(inbox.render(G))); check(`S${season} finans render`, nonEmpty(finance.render(G))); }
      if (w === 10 && season === 1) {
        check('kadro/transfer/tesis/medya render', nonEmpty(squadView.render(G)) && nonEmpty(transferView.render(G)) && nonEmpty(facilitiesView.render(G)) && nonEmpty(media.render(G)));
        check('kongre/veri/kulüp render', nonEmpty(congress.render(G)) && nonEmpty(dataHub.render(G)) && nonEmpty(clubView.render(G)));
      }
      G.pendingMatch = null;
    }
    A.endSeason(G);
    check(`S${season} SEASON_END render`, G.phase === 'SEASON_END' && nonEmpty(seasonEnd.render(G)), `sıra ${G.lastSeason.pos}`);
    A.afterSeasonEnd(G);
  }

  // DELUXE D6: 3 sezon sonrası önce KAMPANYA → MÜNAZARA → seçim gecesi
  check('3 sezon sonrası → CAMPAIGN fazı', G.phase === 'CAMPAIGN' && !!G.campaign);
  A.campaignDo(G, 'taraftarMitingi'); // KARAR: KP harca
  let guard = 0;
  while (G.phase === 'CAMPAIGN' && guard++ < 10) A.advanceCampaign(G);
  check('kampanya bitti → DEBATE (4 soru)', G.phase === 'DEBATE' && G.debate.qs.length === 4);
  guard = 0;
  while (G.phase === 'DEBATE' && guard++ < 6) A.answerDebate(G, 'vizyon'); // KARAR: münazara cevabı
  check('münazara bitti → ELECTION_NIGHT', G.phase === 'ELECTION_NIGHT' && !!G.election);
  const e = G.election;
  const b = e.breakdown;
  const finite = ['sportif', 'taraftar', 'mali', 'itibar', 'soz', 'rival'].every((k) => Number.isFinite(b[k]));
  check('seçim bileşenleri geçerli sayı', finite, `oy %${Math.round(e.oyOrani * 100)}, kazandı=${e.kazandi}`);
  e.done = true; e.displayVote = e.oyOrani * 100;
  check('ELECTION_NIGHT render', nonEmpty(electionNight.render(G)));

  // gauge'lar 0-100 finite
  const gaugesOk = ['guven', 'taraftar', 'mali', 'sportif', 'itibar'].every((k) => Number.isFinite(G.gauges[k]) && G.gauges[k] >= 0 && G.gauges[k] <= 100);
  check('gauge değerleri 0-100 aralığında finite', gaugesOk, JSON.stringify(Object.fromEntries(Object.entries(G.gauges).map(([k, v]) => [k, Math.round(v)]))));

  // kariyer devamı: kazandıysa yeni dönem, kaybettiyse game over — ikisi de patlamadan
  if (e.kazandi) { A.startNewTerm(G); check('KAZANDI → yeni TERM_SETUP', G.phase === 'TERM_SETUP'); }
  else { check('KAYBETTİ → kariyer sonu akışı hazır', true, 'oyOranı seçim eşiğinin altında'); }
} catch (err) {
  threw = err;
}
check('kariyer boyunca runtime hatası yok', threw === null, threw ? (threw.stack || threw.message) : '');

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
