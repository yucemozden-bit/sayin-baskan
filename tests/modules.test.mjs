// tests/modules.test.mjs — dynamics / social / campaign / staff birim testleri.
// Çalıştır: node tests/modules.test.mjs

import { setSeed } from '../src/core/rng.js';
import { assignPersonalities, spreadMorale, hierarchy, katman, gorusme, PERSONALITIES } from '../src/engines/dynamics.js';
import { computeSentiment } from '../src/engines/social.js';
import { voteProjection, applyCampaignAction } from '../src/engines/campaign.js';
import { generateCoaches, teknikEkipScore, hireCoach } from '../src/models/staff.js';

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? '✓' : '✗'} ${n}${d ? '  → ' + d : ''}`); ok ? pass++ : fail++; };
setSeed(11);

// ── dynamics (V4-E) ──
console.log('\n── dynamics ──');
const sq = Array.from({ length: 20 }, (_, i) => ({ id: i, overall: 55, age: 25, morale: i < 10 ? 80 : 20 }));
assignPersonalities(sq);
check('tüm oyunculara kişilik atandı', sq.every((p) => PERSONALITIES.includes(p.personality)));
const varBefore = variance(sq.map((p) => p.morale));
for (let i = 0; i < 5; i++) spreadMorale(sq);
const varAfter = variance(sq.map((p) => p.morale));
check('moral yayılımı varyansı düşürür (grup çekimi)', varAfter < varBefore, `${varBefore.toFixed(0)} → ${varAfter.toFixed(0)}`);
check('hiyerarşi/katman çalışır', ['Lider', 'Etkili', 'Çekirdek', 'Genç'].includes(katman(hierarchy({ overall: 85, age: 29, kulupteYil: 6, personality: 'Lider' }))));
const kir = { morale: 60, personality: 'Kırılgan' };
gorusme(kir, 'Sert');
check('görüşme: Kırılgan+Sert morali düşürür', kir.morale < 60, `${kir.morale}`);

// ── social (V5-6) ──
console.log('\n── social ──');
const sWin = computeSentiment({ son2puan: 6, ticketPrice: 1.0, transferHype: 60 });
const sLoss = computeSentiment({ son2puan: 0, ticketPrice: 1.6, transferHype: 40 });
check('sentiment galibiyet > mağlubiyet', sWin > sLoss, `${sWin.toFixed(0)} > ${sLoss.toFixed(0)}`);
check('sentiment [-100,100] aralığında', sWin <= 100 && sLoss >= -100);

// ── campaign (V5-5) ──
console.log('\n── campaign ──');
const st = {
  club: { tier: 'orta', reputation: 45, hedefSira: 8 }, economy: { borc: 30, ticketPrice: 1.0 }, termStartBorc: 60,
  gauges: { guven: 55, taraftar: 60, mali: 55, sportif: 55, itibar: 48 }, sozTutmaBirikim: 5,
  rival: { attractiveness: 10 }, history: { seasons: [{ pos: 6, champion: false }, { pos: 5, champion: false }, { pos: 4, champion: false }] },
  campaign: { kp: 2, swing: 0 },
};
const proj = voteProjection(st);
check('voteProjection oyOranı 0-1 + breakdown', proj.oyOrani >= 0 && proj.oyOrani <= 1 && !!proj.breakdown, `%${Math.round(proj.oyOrani * 100)}`);
const before = st.gauges.taraftar;
const r = applyCampaignAction(st, 'taraftarMitingi');
check('kampanya aksiyonu KP harcar + etki', r.ok && st.gauges.taraftar > before && st.campaign.kp === 1);

// ── staff (Bible-10) ──
console.log('\n── staff ──');
setSeed(7);
const lo = generateCoaches(25), hi = generateCoaches(75);
const avg = (a) => a.reduce((s, c) => s + teknikEkipScore(c), 0) / a.length;
check('yüksek itibar → daha iyi TD havuzu', avg(hi) > avg(lo), `${avg(lo).toFixed(0)} < ${avg(hi).toFixed(0)}`);
const gst = { coach: {}, taktik: { uyumHafta: 10 }, kimya: { kimya: 60 } };
hireCoach(gst, hi[0], { midSeason: true });
check('TD atama (sezon içi): uyum 0, kimya −10', gst.taktik.uyumHafta === 0 && gst.kimya.kimya === 50);

function variance(a) { const m = a.reduce((s, x) => s + x, 0) / a.length; return a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length; }

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
