// ── GAYRİMENKUL OFİSİ — 50+ SENARYO: transfer cüzdanı, kalıcılık (aç/kapa portföy kaybı), ekran render, sezon ekonomisi ──
// Kullanıcı: "tekrar açılıp kapandığında portföy kayboluyor mu, ekran değişiyor mu, her senaryoyu test et."
import { readFileSync } from 'node:fs';
import { setSeed } from '../src/core/rng.js';
import * as A from '../src/actions.js';
import * as gmView from '../src/ui/gayrimenkul.js';
import * as finance from '../src/ui/finance.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const data = { teams: load('teams.json').teams, promises: load('promises.json').promises, names: load('names.json'), media: load('media.json'), firms: load('firms.json'), events: load('events.json'), social: load('social.json'), boardnames: load('boardnames.json'), scenarios: load('scenarios.json'), achievements: load('achievements.json'), sponsors: load('sponsors.json').sponsors };

let gecti = 0, kaldi = 0;
const ok = (m) => { console.log('✓ ' + m); gecti++; };
const no = (m) => { console.log('✗ ' + m); kaldi++; };
const es = (a, b, m) => (a === b ? ok(`${m}  → ${a}`) : no(`${m}  → BEKLENEN ${b}, GELEN ${a}`));
const dogru = (c, m) => (c ? ok(m) : no(m));
const yakin = (a, b, m, t = 0.05) => (Math.abs(a - b) <= t ? ok(`${m}  → ${Math.round(a * 100) / 100}`) : no(`${m}  → ~${b} beklendi, ${a} geldi`));
const nanAv = (o, y = 'G', d = 0, s = new Set()) => { if (d > 8 || o == null || typeof o !== 'object' || s.has(o)) return null; s.add(o); for (const [k, v] of Object.entries(o)) { if (k === 'data') continue; if (typeof v === 'number' && !Number.isFinite(v)) return `${y}.${k}`; if (typeof v === 'object') { const r = nanAv(v, `${y}.${k}`, d + 1, s); if (r) return r; } } return null; };
const kur = () => { const G = A.newGame(data, 'normal'); A.selectClub(G, 'orta'); A.startTerm(G, [data.promises[0].id], null); return G; };
const roundTrip = (G) => { const j = JSON.parse(JSON.stringify({ ...G, data: undefined })); j.data = G.data; A.migrateLoaded(j); return j; };

console.log('── GAYRİMENKUL OFİSİ · 50 SENARYO ──');
setSeed(2718);

// ═══ A) INIT & GÖÇ (5) ═══
{
  const G = kur();
  es(G.gayrimenkul.nakit, 0, 'A1 init: ofis nakiti 0 kurulur');
  dogru(Array.isArray(G.gayrimenkul.mulkler), 'A2 init: mulkler dizisi var');
  const eski = kur(); delete eski.gayrimenkul.nakit; const m = roundTrip(eski);
  es(m.gayrimenkul.nakit, 0, 'A3 göç: eski kayıtta nakit yoksa 0 tamamlanır');
  const dolu = kur(); dolu.gayrimenkul.nakit = 42; es(roundTrip(dolu).gayrimenkul.nakit, 42, 'A4 göç: mevcut nakit korunur');
  const port = kur(); port.gayrimenkul = { deger: 80, kira: 1, adet: 2, nakit: 5, mulkler: [{ id: 'A-1', type: 'land' }], arsaIndex: 1.1, binaIndex: 1, month: 3 };
  es(roundTrip(port).gayrimenkul.mulkler.length, 1, 'A5 göç: portföy mülk listesi korunur');
}

// ═══ B) YATIR (kasa→ofis) (9) ═══
{
  const mk = (kasa, nakit) => { const G = kur(); G.economy.kasa = kasa; G.gayrimenkul.nakit = nakit; return G; };
  let G = mk(100, 0); const t = A.gmYatir(G, 0.5);
  es(G.economy.kasa, 50, 'B1 yatır %50: kasa 100→50'); es(G.gayrimenkul.nakit, 50, 'B2 yatır %50: nakit 0→50'); es(t, 50, 'B3 yatır: dönen tutar = aktarılan');
  G = mk(100, 0); A.gmYatir(G, 1); es(G.economy.kasa, 0, 'B4 yatır %100: kasa boşalır'); es(G.gayrimenkul.nakit, 100, 'B5 yatır %100: tümü ofise');
  G = mk(100, 20); A.gmYatir(G, 0); es(G.economy.kasa, 100, 'B6 yatır %0: no-op kasa'); es(G.gayrimenkul.nakit, 20, 'B7 yatır %0: no-op nakit');
  G = mk(100, 0); A.gmYatir(G, 5); es(G.economy.kasa, 0, 'B8 yatır oran>1: %100 gibi klemplenir');
  G = mk(100, 30); A.gmYatir(G, -0.5); es(G.gayrimenkul.nakit, 30, 'B9 yatır negatif oran: no-op');
}

// ═══ C) ÇEK (ofis→kasa) (8) ═══
{
  const mk = (kasa, nakit) => { const G = kur(); G.economy.kasa = kasa; G.gayrimenkul.nakit = nakit; return G; };
  let G = mk(40, 60); const t = A.gmCek(G, 1);
  es(G.gayrimenkul.nakit, 0, 'C1 çek %100: ofis boşalır'); es(G.economy.kasa, 100, 'C2 çek %100: tümü kasaya'); es(t, 60, 'C3 çek: dönen tutar = çekilen');
  G = mk(40, 60); A.gmCek(G, 0.5); es(G.gayrimenkul.nakit, 30, 'C4 çek %50: yarısı kalır'); es(G.economy.kasa, 70, 'C5 çek %50: yarısı kasaya');
  G = mk(40, 0); es(A.gmCek(G, 1), 0, 'C6 çek nakit 0: no-op döner 0'); es(G.economy.kasa, 40, 'C7 çek nakit 0: kasa değişmez');
  G = mk(40, 60); A.gmCek(G, -1); es(G.gayrimenkul.nakit, 60, 'C8 çek negatif oran: no-op');
}

// ═══ D) KORUNUM — para yaratılmaz/yok olmaz (5) ═══
{
  const mk = (kasa, nakit) => { const G = kur(); G.economy.kasa = kasa; G.gayrimenkul.nakit = nakit; return G; };
  let G = mk(200, 50); let top0 = G.economy.kasa + G.gayrimenkul.nakit;
  A.gmYatir(G, 0.3); yakin(G.economy.kasa + G.gayrimenkul.nakit, top0, 'D1 yatır sonrası toplam korunur');
  A.gmCek(G, 0.7); yakin(G.economy.kasa + G.gayrimenkul.nakit, top0, 'D2 çek sonrası toplam korunur');
  G = mk(120, 0); top0 = 120; A.gmYatir(G, 1); A.gmCek(G, 1); es(G.economy.kasa, 120, 'D3 tümünü yatır+çek → kasa geri gelir'); es(G.gayrimenkul.nakit, 0, 'D4 tümünü yatır+çek → ofis 0');
  G = mk(90, 40); top0 = 130; for (let i = 0; i < 6; i++) { A.gmYatir(G, 0.4); A.gmCek(G, 0.3); } yakin(G.economy.kasa + G.gayrimenkul.nakit, top0, 'D5 6 tur yatır/çek → toplam ~korunur', 0.5);
}

// ═══ E) KALICILIK — aç/kapa/kaydet-yükle portföy KAYBOLMAZ (9) ═══
{
  const G = kur();
  G.economy.kasa = 300; G.gayrimenkul = { deger: 150, kira: 2.5, adet: 4, nakit: 35, mulkler: [{ id: 'A-1', type: 'building', rented: true, landBase: 20, constrBase: 30 }, { id: 'B-2', type: 'land', landBase: 15 }], arsaIndex: 1.32, binaIndex: 1.18, month: 12 };
  const r = roundTrip(G);
  es(r.gayrimenkul.deger, 150, 'E1 kayıt/yükle: portföy değeri korunur');
  es(r.gayrimenkul.nakit, 35, 'E2 kayıt/yükle: ofis nakiti korunur');
  es(r.gayrimenkul.adet, 4, 'E3 kayıt/yükle: mülk adedi korunur');
  es(r.gayrimenkul.mulkler.length, 2, 'E4 kayıt/yükle: mülk listesi korunur (KAYBOLMAZ)');
  es(r.gayrimenkul.mulkler[0].rented, true, 'E5 kayıt/yükle: kirada durumu korunur');
  yakin(r.gayrimenkul.arsaIndex, 1.32, 'E6 kayıt/yükle: arsaIndex korunur');
  yakin(r.gayrimenkul.binaIndex, 1.18, 'E7 kayıt/yükle: binaIndex korunur');
  es(r.gayrimenkul.month, 12, 'E8 kayıt/yükle: piyasa ayı korunur');
  const bos = kur(); const rb = roundTrip(bos); dogru(rb.gayrimenkul.deger === 0 && Array.isArray(rb.gayrimenkul.mulkler), 'E9 boş portföy de sağ-salim yüklenir');
}

// ═══ F) EKRAN RENDER — nav aç/kapa, çökme yok, doğru içerik (10) ═══
{
  const G = kur(); G.nav = 'gayrimenkul'; G.economy.kasa = 60; G.gayrimenkul = { deger: 124, kira: 1.1, adet: 3, nakit: 15, mulkler: [], arsaIndex: 1, binaIndex: 1, month: 0 };
  const h = gmView.render(G);
  dogru(h && h.length > 500, 'F1 render: boş değil');
  dogru(h.includes('Gayrimenkul Ofisi'), 'F2 render: başlık var');
  dogru(h.includes('60'), 'F3 render: kulüp kasası görünür');
  dogru(h.includes('15'), 'F4 render: ofis nakiti görünür');
  dogru(h.includes('124'), 'F5 render: portföy değeri görünür');
  dogru(h.includes('id="gm-pct"'), 'F6 render: aktarım slider modülü var');
  dogru(h.includes('SBgmStep') && h.includes('gm-range'), 'F7 render: ± ve sürüklenebilir slider var');
  dogru(h.includes('gayrimenkulAc'), 'F8 render: Ofisi Aç butonu var');
  const bos = kur(); bos.nav = 'gayrimenkul'; const hb = gmView.render(bos);
  dogru(hb && hb.length > 500 && !hb.includes('undefined'), 'F9 render: boş portföy çökmeden render');
  const sifir = kur(); sifir.economy.kasa = 0; sifir.gayrimenkul.nakit = 0; const hs = gmView.render(sifir);
  dogru(hs.includes('Kasan boş') || hs.includes('gms-uyari'), 'F10 render: kasa+nakit 0 → aktarım yerine uyarı');
}

// ═══ G) EKRAN DEĞİŞİMİ — nav geçişinde portföy sabit kalır (4) ═══
{
  const G = kur(); G.economy.kasa = 100; G.gayrimenkul = { deger: 90, kira: 1, adet: 2, nakit: 20, mulkler: [{ id: 'A-1', type: 'land' }], arsaIndex: 1.05, binaIndex: 1, month: 2 };
  const snap = JSON.stringify(G.gayrimenkul);
  gmView.render(G); es(JSON.stringify(G.gayrimenkul), snap, 'G1 gayrimenkul render portföyü DEĞİŞTİRMEZ');
  G.nav = 'finans'; finance.render(G); es(JSON.stringify(G.gayrimenkul), snap, 'G2 finans render portföyü DEĞİŞTİRMEZ');
  G.nav = 'gayrimenkul'; gmView.render(G); es(JSON.stringify(G.gayrimenkul), snap, 'G3 finans→gayrimenkul geçişinde portföy aynı');
  dogru(nanAv(G) === null, 'G4 nav geçişlerinde NaN yok');
}

// ═══ H) SEZON EKONOMİSİ — kira ofis nakitine, değerlenme, vergi (8) ═══
{
  let G = kur(); G.gayrimenkul = { deger: 100, kira: 2, adet: 2, nakit: 0, arsaIndex: 1.2, binaIndex: 1.1, month: 0, mulkler: [] };
  A.endSeason(G); const gm = G.gayrimenkul;
  es(gm.deger, 102, 'H1 endSeason: portföy %2 değerlendi');
  dogru(gm.nakit > 0, 'H2 endSeason: kira OFİS NAKİTİNE aktı (nakit arttı)');
  yakin(gm.arsaIndex, 1.224, 'H3 endSeason: arsaIndex aynı oranda taşındı');
  yakin(gm.binaIndex, 1.122, 'H4 endSeason: binaIndex aynı oranda taşındı');
  dogru((G.inbox || []).some((m) => m.t && m.t.startsWith('Gayrimenkul:')), 'H5 endSeason: kira/vergi bildirimi geldi');
  es(nanAv(G), null, 'H6 endSeason: NaN yok');
  let G2 = kur(); G2.gayrimenkul = { deger: 0, kira: 0, adet: 0, nakit: 0, mulkler: [] }; const n0 = G2.gayrimenkul.nakit;
  A.endSeason(G2); es(G2.gayrimenkul.nakit, n0, 'H7 endSeason: boş portföyde nakit değişmez, çökme yok');
  let G3 = kur(); G3.gayrimenkul = { deger: 200, kira: 4, adet: 3, nakit: 10, arsaIndex: 1, binaIndex: 1, month: 0, mulkler: [] };
  const nOnce = G3.gayrimenkul.nakit; A.endSeason(G3); dogru(G3.gayrimenkul.nakit > nOnce, 'H8 endSeason: kira mevcut nakite EKLENİR (üstüne yazmaz)');
}

// ═══ I) SERVET VERGİSİ — ofis nakiti park-kaçağı kapalı (6) ═══
{
  const mk = (kasa, nakit, deger = 0) => { const G = kur(); G.economy.kasa = kasa; G.sezonKar = 0; G.gayrimenkul = { deger, kira: 0, adet: 0, nakit, mulkler: [], arsaIndex: 1, binaIndex: 1, month: 0 }; return G; };
  // orta tier tampon 160
  let G = mk(5, 200); const n0 = G.gayrimenkul.nakit; A.endSeason(G);
  dogru(G.gayrimenkul.nakit < n0, 'I1 kasa yetersiz + nakit yüksek → vergi NAKİTTEN kesildi (kaçak kapalı)');
  dogru((G.economy.kasa + G.gayrimenkul.nakit) < (5 + n0), 'I2 toplam nakit tampona doğru indi');
  G = mk(50, 30); const top0 = 80; A.endSeason(G);
  dogru((G.economy.kasa + G.gayrimenkul.nakit) <= top0 + 0.5, 'I3 tampon altı toplam: vergi ya yok ya küçük (şişme yok)');
  G = mk(400, 0); const k0 = G.economy.kasa; A.endSeason(G);
  dogru(G.economy.kasa < k0, 'I4 yüksek kasa + nakit 0 → servet vergisi yine kasadan kesilir');
  G = mk(300, 100); A.endSeason(G);
  dogru((G.economy.kasa + G.gayrimenkul.nakit) < 400, 'I5 kasa+nakit tampon üstü → fazla vergilenir');
  G = mk(3, 3, 500); const d0 = G.gayrimenkul.deger; A.endSeason(G);
  dogru(G.gayrimenkul.deger >= d0, 'I6 mülk (portföy değeri) servet vergisinden MUAF — düşmez, değerlenir');
}

console.log('\n' + '─'.repeat(52));
console.log(`SONUÇ: ${gecti} geçti, ${kaldi} kaldı`);
if (kaldi > 0) process.exitCode = 1;
