// tests/tahta.test.mjs — TRANSFER TAHTASI/İLAN KİLİT GÖRÜNÜRLÜĞÜ (kullanıcı raporu 2026-07-21:
// "ilan kartlarına basıyorum hareket etmiyor" + "onay dosyasını onaylayamıyorum" — FFP tahta
// cezası ve peşinat guard'ları SESSİZCE reddediyordu). Kilitler artık butonda + şeritte + mektupta.
// Çalıştır: node tests/tahta.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { TUNING } from '../src/config.js';
import { itemActions } from '../src/ui/inbox.js';
import * as transferUi from '../src/ui/transferView.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function fresh(seed = 42) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ['P15'], { budget: 60, line: 'hazir' });
  G.transferWindow = true;
  return G;
}
const tfileMail = (G, fee = 10) => {
  const m = { id: 'tst-tf', action: 'tfile', t: 'test dosyası', file: { player: { id: 'tp1', name: 'Test Oyuncu', pos: 'MID', overall: 60, potential: 62, age: 24, wage: 1, morale: 60, form: 55, fitness: 90, injuryWeeks: 0, suspensionWeeks: 0, contractYears: 2, marketValue: 10 }, fee, gerekce: 'test', range: [58, 62] } };
  G.inbox.unshift(m);
  return m;
};

console.log('\n── TAHTA CEZASI: kilit HER katmanda görünür ──');
{
  const G = fresh();
  G.flags = { ...(G.flags || {}), transferBan: 3 };
  // 1) ilan: reddedilir + mektup TEK sefer
  check('ilan verilemez (tahta kapalı)', A.ilanVer(G, { pos: 'GK', yasMax: 20, tavan: 10 }).ok === false && A.ilanVer(G, { pos: 'GK', yasMax: 20, tavan: 10 }).ok === false);
  check('"İlan verilemedi" mektubu TEK (spam yok)', G.inbox.filter((x) => (x.t || '') === 'İlan verilemedi').length === 1);
  // 2) tfile onay: reddedilir + mektup + dosya AÇIK kalır
  const m = tfileMail(G);
  check('onay reddedilir (iki denemede de)', A.resolveTransferFile(G, m.id, 'onay').ok === false && A.resolveTransferFile(G, m.id, 'onay').ok === false && !m.resolved);
  check('"TAHTA KAPALI" mektubu TEK', G.inbox.filter((x) => (x.t || '').includes('TAHTA KAPALI')).length === 1);
  // 3) inbox butonu kilitli
  const html = itemActions(G, m);
  check('ONAYLA butonu kilitli (disabled + 🔒) + FFP tooltip', html.includes('disabled') && html.includes('ONAYLA 🔒') && html.includes('FFP'));
  // 4) transfer ekranı şeridi
  G.nav = 'transfer';
  const th = transferUi.render(G);
  check('transfer ekranında TAHTA KAPALI şeridi (ilan kartları gizli)', th.includes('TRANSFER TAHTASI KAPALI') && !th.includes('data-act="ilan"'));
  // 5) RED ve ŞARTLI hâlâ serbest (tahta yalnız İMZAYI kilitler)
  check('REDDET çalışır', A.resolveTransferFile(G, m.id, 'red').ok === true && m.resolved === true);
}

console.log('\n── PEŞİNAT: kasa yetmiyorsa kilit görünür ──');
{
  const G = fresh(7);
  G.economy.kasa = 1; // fee 20 × DEPOSIT'ten az
  const m = tfileMail(G, 20);
  const html = itemActions(G, m);
  check('ONAYLA kilitli + peşinat tooltip', html.includes('disabled') && html.includes('Peşinat yetersiz'));
  check('onay reddedilir + mektup TEK', A.resolveTransferFile(G, m.id, 'onay').ok === false && A.resolveTransferFile(G, m.id, 'onay').ok === false
    && G.inbox.filter((x) => (x.t || '').includes('peşinat yetersiz')).length === 1);
  G.economy.kasa = 50;
  check('kasa dolunca onay İŞLER (oyuncu kadroda)', A.resolveTransferFile(G, m.id, 'onay').ok === true && G.squad.some((p) => p.name === 'Test Oyuncu'));
}

console.log('\n── NORMAL AKIŞ bozulmadı ──');
{
  const G = fresh(11);
  check('tahta açıkken ilan verilir', A.ilanVer(G, { pos: 'GK', yasMax: 20, tavan: 10 }).ok === true && !!G.ilan);
  check('aktif ilan varken ikincisi reddedilir + gerekçeli mektup', A.ilanVer(G, { pos: 'DEF', yasMax: 25, tavan: 20 }).ok === false && G.inbox.some((x) => (x.b || '').includes('yayında bir ilanın var')));
  G.nav = 'transfer';
  const th = transferUi.render(G);
  check('ilan yayındayken şerit İLAN YAYINDA', th.includes('İLAN YAYINDA'));
  check('transfer ekranı NaN/undefined sızdırmıyor', !/NaN|undefined/.test(th));
}

console.log(`\nSONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
