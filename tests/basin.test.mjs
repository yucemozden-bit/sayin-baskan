// tests/basin.test.mjs — BASIN TOPLANTISI v3: kupür + arşiv + sayısal etki + iddia bedeli +
// söz sorusu + hava şeridi + canlı akış + haftalık sayaç. Çalıştır: node tests/basin.test.mjs
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as media from '../src/ui/media.js';
import { MUHABIRLER } from '../src/data/pressPool.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

function fresh(seed = 42, ids = ['P03']) {
  setSeed(seed);
  const G = A.newGame(data, 'normal');
  A.selectClub(G, 'orta');
  A.startTerm(G, ids, { budget: 60, line: 'hazir' });
  return G;
}

console.log('\n── Kapanış sahnesi: kupür + sayısal etki ──');
{
  const G = fresh();
  const h0 = G.club.hedefSira;
  const r = A.makeDemec(G, 'iddiali');
  check('demeç işledi + YARININ MANŞETİ arşive düştü', r.ok === true && (G.mansetArsiv || []).length === 1 && G.mansetArsiv[0].t.length > 8, G.mansetArsiv[0].t);
  check('kupürde muhabir kimliği + hafta damgası', !!G.mansetArsiv[0].kim && G.mansetArsiv[0].hafta === 1);
  check('İDDİA BEDELİ: kurul hedefi yükseldi (sezonda 1 kez)', G.club.hedefSira === Math.max(1, h0 - 1) && G.lastDemecFx.hedef === -1, `${h0}. → ${G.club.hedefSira}.`);
  check('etki paketi ÖNCE→SONRA verisi taşır (snap)', !!G.lastDemecFx.snap && typeof G.lastDemecFx.snap.taraftar === 'number');
  check('sosyal akış CEVABA TEPKİ verdi', (G.socialFeed || []).some((p) => p.text.includes('böyle konuşur')));
  const html = media.render(G);
  check('ekranda kupür + KULLANILDI sayacı + arşiv', html.includes('med-kupur') && html.includes('KULLANILDI') && html.includes('Manşet Arşivi'));
}
{
  // iddia bedeli SEZONDA 1: ikinci hafta ikinci iddialı demeç çıtayı OYNATMAZ
  const G = fresh();
  A.makeDemec(G, 'iddiali');
  const h1 = G.club.hedefSira;
  G.demecUsed = false; G.meta.week = 2;
  A.makeDemec(G, 'iddiali');
  check('ikinci iddialı demeç hedefi TEKRAR yükseltmez', G.club.hedefSira === h1 && G.lastDemecFx.hedef === 0);
  check('arşiv kronolojik birikiyor (2 kupür)', G.mansetArsiv.length === 2);
}
console.log('\n── Muhabir rotasyonu + söz sorusu + hava/akış ──');
{
  const G = fresh();
  const m1 = media.render(G);
  check('muhabir kadrodan (rotasyon)', MUHABIRLER.some((m) => m1.includes(m.ad)));
  check('hava şeridi 5 kademe', ['Düşman', 'Soğuk', 'Nötr', 'Ilık', 'Dost'].every((k) => m1.includes(k)));
  check('KULLANILMADI sayacı + haftada TEK', m1.includes('KULLANILMADI') && m1.includes('TEK hak'));
  G.socialFeed = [];
  check('sosyal akış boşken bile yaşar (fallback gönderiler)', media.render(G).includes('🐦'));
  check('sağ rayda Mühürlü Sözler hatırlatması', m1.includes('Mühürlü Sözler'));
}
{
  // SÖZÜN HESABI: (wk+salt)%4===2 haftasında muhabir doğrudan sözü sorar
  const G = fresh();
  let bulundu = false;
  for (let w = 1; w <= 8 && !bulundu; w++) {
    G.meta.week = w; G.demecUsed = false;
    const h = media.render(G);
    if (h.includes('SÖZÜN HESABI')) {
      bulundu = true;
      check('söz sorusu: söz adı + iddialı kartta kongre uyarısı', h.includes('sözü verdiniz') && h.includes('tutmazsan kongrede karşına çıkar'), `hafta ${w}`);
    }
  }
  check('söz sorusu 8 haftada en az bir kez sahneye çıkar', bulundu);
}

console.log('\n' + '─'.repeat(48));
console.log(`SONUÇ: ${pass} geçti, ${fail} kaldı`);
process.exit(fail ? 1 : 0);
