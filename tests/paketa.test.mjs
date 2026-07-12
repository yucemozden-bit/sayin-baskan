// tests/paketa.test.mjs — PAKET A "Yönetim Derinliği" testleri (v5-§1/3/4).
// Çalıştır: node tests/paketa.test.mjs

import { readFileSync } from 'node:fs';
import { TUNING } from '../src/config.js';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import { generateStaff, describeStaff, cfoNoiseRange } from '../src/models/staff.js';
import { applyEventEffects } from '../src/engines/events.js';
import * as finance from '../src/ui/finance.js';
import * as clubView from '../src/ui/clubView.js';

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
const play = (G, n) => { for (let i = 0; i < n; i++) { A.advanceWeek(G); G.pendingMatch = null; } };
const hireAll = (G) => {
  for (const role of TUNING.STAFF.ROLES) {
    A.requestStaffFile(G, role);
    const m = G.inbox.find((x) => x.action === 'stfile' && !x.resolved);
    if (m) A.hireStaffFile(G, m.id, 0);
  }
};

// ══ A1 STAFF KATMANI ══
console.log('\n── A1 Staff katmanı ──');
setSeed(11);
{
  const G = fresh();
  check('5 koltuk: GM sabit + 4 boş başlar', !!G.gm && TUNING.STAFF.ROLES.every((r) => G.staff[r] === null));
  const r = A.requestStaffFile(G, 'cfo');
  const m = G.inbox.find((x) => x.action === 'stfile');
  check('aday DOSYASI deseni: 2-3 isimli aday + trait cümlesi', r.ok && G.staffCands.cands.length >= 2 && /(bankacı|ağzı sıkı|egolu|çalışkan|vizyoner)/.test(m.b));
  check('aday cümlelerinde SAYI yok (kalite kelimeyle)', G.staffCands.cands.every((c) => !/\d/.test(describeStaff(c))));
  A.hireStaffFile(G, m.id, 0);
  check('imza: koltuk doldu + maaş gidere işler', !!G.staff.cfo && G.staff.cfo.wage > 0);
  // CFO projeksiyon sisi: kötü/boş CFO ±%15'e kadar
  const noNone = cfoNoiseRange(null), noStar = cfoNoiseRange({ skill: 90 });
  check('CFO sisi: boş koltuk ±%15, yıldız CFO ~±%2-3', noNone >= 0.14 && noStar < 0.04, `boş ±${(noNone * 100).toFixed(0)}% · yıldız ±${(noStar * 100).toFixed(1)}%`);
  // finance ekranı sisli projeksiyon + güvenilirlik notu
  play(G, 1);
  const fin = finance.render(G);
  check('Finans: projeksiyon + güvenilirlik cümlesi', fin.includes('projeksiyon') && (fin.includes('sağlam') || fin.includes('sapma') || fin.includes('GÜVENİLMEZ')));
  // restructure CFO pazarlığı
  const faiz0 = G.economy.faizOrani;
  G.staff.cfo.skill = 85; G.staff.cfo.trait = 'bankaci';
  A.restructureDebt(G);
  check('yapılandırma: yetkin+bankacı CFO faizi daha çok kırar (−0.07)', Math.abs((faiz0 - G.economy.faizOrani) - 0.07) < 0.001, `−${(faiz0 - G.economy.faizOrani).toFixed(2)}`);
  // Yönetim bölümü clubView'da
  check('Kulüp ekranı: Yönetim Kadrosu 5 koltuk', clubView.render(G).includes('Yönetim Kadrosu'));
  // istifa riski: itibar düşük + çok sezon → en az bir ayrılık (istatistiksel)
  let ayrilik = 0;
  for (let i = 0; i < 30; i++) {
    setSeed(500 + i);
    const g = fresh(); hireAll(g); g.gauges.itibar = 30;
    play(g, 34); A.endSeason(g);
    if (TUNING.STAFF.ROLES.some((r2) => g.staff[r2] === null)) ayrilik++;
  }
  check('istifa/rakip kapma gerçekleşiyor (düşük itibarda ↑)', ayrilik >= 5, `${ayrilik}/30 sezonda ayrılık`);
}

// ══ A2 FFP ══
console.log('\n── A2 FFP / harcama limiti ──');
setSeed(21);
{
  const G = fresh('orta', { budget: 300, line: 'hazir' });
  check('sezon başı limit açıklandı', G.ffp && G.ffp.limit > 0 && G.inbox.some((m) => m.t.includes('limit')), `limit ${G.ffp.limit}mn`);
  // limit aşımı → taahhütname + guven −5
  G.ffp.limit = 10; G.economy.kasa = 500;
  const guven0 = G.gauges.guven;
  let approved = false;
  for (let w = 0; w < 4 && !approved; w++) {
    play(G, 1);
    const tf = G.inbox.find((m) => m.action === 'tfile' && !m.resolved);
    if (tf) { A.resolveTransferFile(G, tf.id, 'onay'); approved = true; }
    const sf = G.inbox.find((m) => m.action === 'sfile' && !m.resolved);
    if (sf) A.resolveSaleFile(G, sf.id, 'red');
  }
  check('aşım → TAAHHÜTNAME + güven −5', approved && G.ffp.taahhut && G.gauges.guven < guven0, `güven ${guven0.toFixed(0)}→${G.gauges.guven.toFixed(0)}`);
  check('taahhüt → GELECEK sezon gelir kesintisi kuyruğa', G.ffp.pendingCut === true);
  // GM gerekçesi limit uyarısı
  setSeed(22);
  const G2 = fresh('orta', { budget: 300, line: 'hazir' });
  G2.ffp.limit = 5;
  let uyarili = false;
  for (let w = 0; w < 4 && !uyarili; w++) {
    play(G2, 1);
    const tf = G2.inbox.find((m) => m.action === 'tfile' && !m.resolved);
    if (tf) { uyarili = tf.b.includes('taahhütname gerektirir'); A.resolveTransferFile(G2, tf.id, 'red'); }
    const sf = G2.inbox.find((m) => m.action === 'sfile' && !m.resolved);
    if (sf) A.resolveSaleFile(G2, sf.id, 'red');
  }
  check('GM dosya gerekçesi limit durumunu söylüyor', uyarili);
  // lobi: itibar>60 → %40 (istatistiksel)
  let lobiOk = 0;
  for (let i = 0; i < 60; i++) {
    setSeed(700 + i);
    const g = fresh(); g.club.reputation = 75;
    const r = A.ffpLobi(g);
    if (r.ok && r.success) lobiOk++;
  }
  check('lobi ~%40 tutuyor (itibar>60)', lobiOk > 14 && lobiOk < 34, `${lobiOk}/60`);
  check('itibar ≤60 lobi yapamaz', A.ffpLobi(fresh()).ok === false);
  // Finans limit çubuğu
  const fin = finance.render(G);
  check('Finans: FFP çubuğu + taahhüt rozeti', fin.includes('Harcama Limiti · FFP') && fin.includes('TAAHHÜTNAME'));
}

// ══ A3 DEADLINE DAY + PİYASA ══
console.log('\n── A3 Deadline day + piyasa ekonomisi ──');
setSeed(31);
{
  const G = fresh('orta', { budget: 200, line: 'hazir' });
  play(G, 3);
  // hikaye telefonlarını (kontrat vs.) temizle — deadline sayımına karışmasın
  let hg = 0;
  while (G.phone && hg++ < 8) A.answerPhone(G, Math.max(0, (G.phone.options || []).findIndex((o) => ['red', 'beklet', 'sabir'].includes(o.key))));
  play(G, 1); // hafta 4 = pencerenin son günü — Y2: dosyalar artık TELEFONLA gelir
  const dlCalls = [G.phone, ...(G.phoneQueue || [])].filter((p) => p && p.deadline);
  check('DEADLINE DAY: 3-5 hızlı TELEFON', dlCalls.length >= 3 && dlCalls.length <= 5, `${dlCalls.length} arama`);
  check('deadline sahne duyurusu (⏱)', G.inbox.some((m) => m.t.includes('DEADLINE DAY')));
  check('arayan kimliği: GM ya da menajer çerçevesi', dlCalls.every((p) => ['gm', 'menajer'].includes(p.caller)), dlCalls.map((p) => p.caller).join(','));
  // deadline aramasına gel + cevapla (red) → sıradaki bağlanır
  let dg = 0;
  while (G.phone && !G.phone.deadline && dg++ < 8) A.answerPhone(G, Math.max(0, (G.phone.options || []).findIndex((o) => ['red', 'beklet', 'sabir'].includes(o.key))));
  const t0 = G.phone && G.phone.title;
  A.answerPhone(G, (G.phone.options || []).findIndex((o) => o.key === 'red'));
  check('cevap → sıradaki arama bağlanır', dlCalls.length === 1 ? !G.phone : (!!G.phone && G.phone.title !== t0));
  play(G, 1); // kalan aramalar cevaplanmadan hafta geçer → kaçar
  check('cevaplanmayan deadline araması KAÇAR', G.inbox.some((m) => m.t.includes('kaçtı')));
  // enflasyon: sezonlar ilerledikçe piyasa çarpanı ↑
  setSeed(32);
  const G2 = fresh();
  const m1 = G2.marketMult;
  play(G2, 34); A.endSeason(G2); A.afterSeasonEnd(G2);
  play(G2, 1);
  check('transfer enflasyonu: sezon 2 piyasa çarpanı ×1.06-1.14', G2.marketMult > m1 && G2.marketMult >= 1.06 && G2.marketMult <= 1.14, `×${G2.marketMult.toFixed(3)}`);
  // kiralama: gönder → sezon sonu ×1.5 gelişimle döner
  setSeed(33);
  const G3 = fresh();
  const genc = G3.squad.find((p) => p.age <= 21) || G3.squad[0];
  genc.age = 19; genc.potential = genc.overall + 10;
  G3.inbox.push({ id: 'mL', action: 'lfile', file: { playerId: genc.id }, t: '', b: '' });
  const ov0 = genc.overall, n0 = G3.squad.length;
  A.resolveLoanFile(G3, 'mL', 'gonder');
  check('kiralık GÖNDER: kadrodan çıkar', G3.squad.length === n0 - 1 && G3.loanedOut.length === 1);
  play(G3, 34); A.endSeason(G3);
  check('sezon sonu ×1.5 gelişimle döner', G3.squad.includes(genc) && genc.overall > ov0, `${ov0} → ${genc.overall}`);
  // bonservissiz: pencere dışı dosya (fee 0, yaşlı)
  setSeed(34);
  let freeSeen = null;
  for (let i = 0; i < 10 && !freeSeen; i++) {
    setSeed(900 + i);
    const g = fresh();
    for (let w = 0; w < 12 && !freeSeen; w++) {
      play(g, 1);
      const f = g.inbox.find((m) => m.action === 'tfile' && !m.resolved && m.file.fee === 0);
      if (f) freeSeen = f;
      const any = g.inbox.find((m) => (m.action === 'tfile' || m.action === 'sfile') && !m.resolved);
      if (any) (any.action === 'tfile' ? A.resolveTransferFile(g, any.id, 'red') : A.resolveSaleFile(g, any.id, 'red'));
    }
  }
  check('bonservissiz kumar dosyası (bedava, pencere dışı)', !!freeSeen && freeSeen.file.player.age >= 29, freeSeen ? `${freeSeen.file.player.name} (${freeSeen.file.player.age})` : 'gelmedi');
}

// ══ A4 ENTEGRASYON ══
console.log('\n── A4 Entegrasyon ──');
setSeed(41);
{
  // rapor imzası konuya göre
  const G = fresh();
  G.squad.slice(0, 5).forEach((p) => { p.injuryWeeks = 3; });
  play(G, 1);
  const rep = G.inbox.find((m) => m.cat === 'rapor');
  check('revir raporu SAĞLIK EKİBİ imzalı', !!rep && rep.b.includes('Sağlık Ekibi'), rep ? rep.b.slice(-40) : '');
  // yeni olaylar: etki yorumlayıcı staff anahtarları
  const g2 = fresh(); hireAll(g2);
  const w0 = g2.staff.cfo.wage;
  applyEventEffects(g2, { staffWageMult: { role: 'cfo', mult: 1.35 } });
  check('olay etkisi: CFO zam ×1.35', Math.abs(g2.staff.cfo.wage - w0 * 1.35) < 0.001);
  applyEventEffects(g2, { staffLeaves: 'basin' });
  check('olay etkisi: yönetici ayrılır', g2.staff.basin === null);
  const lim0 = g2.ffp.limit;
  applyEventEffects(g2, { ffpMult: 0.95 });
  check('olay etkisi: federasyon limit revizyonu ×0.95', g2.ffp.limit === Math.round(lim0 * 0.95));
  check('events.json: 3 yeni olay', ['cfo-teklif', 'staff-catisma', 'limit-revizyon'].every((id) => data.events.random.some((e) => e.id === id)));
}

console.log(`\n${'─'.repeat(48)}\nSONUÇ: ${pass} geçti, ${fail} kaldı\n`);
process.exit(fail ? 1 : 0);
