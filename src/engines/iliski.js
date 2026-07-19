// src/engines/iliski.js — ORTAK İLİŞKİ MOTORU (SEKANS-PLAN Bölüm 1).
// Tek mantık, her ilişki bunu kullanır: oyuncu (p.baskanaGuven + p.relx), TD (G.tdRelation),
// ileride rakip başkan / menajer / gazeteci de aynı motora bağlanır.
// KURALLAR (plan §0): puan yalnız SEÇİM veya DETERMİNİST OLAY ile değişir (drift YOK);
// eşikler olay tetikler (<30 kriz · >70 fırsat); iyilik defteri deterministik borç;
// autoplay-nötr: dokunmazsan puan sabit kalır. Hash — core rng'ye çekiliş YOK.
import { h32 } from './ozel.js';

// Kişilikler — hash ile atanır, puan değişimini çarpar. Oyuncu bunu kartta görür ve öğrenir:
// gururluyu kırma, sadiği besle.
export const KISILIKLER = {
  sadik: { ad: 'Sadık', poz: 1.3, neg: 0.8, not: 'iyiliği unutmaz, kolay küsmez' },
  gururlu: { ad: 'Gururlu', poz: 1.0, neg: 1.5, not: 'kırılırsa zor affeder' },
  firsatci: { ad: 'Fırsatçı', poz: 0.8, neg: 1.0, not: 'jest sever ama çabuk unutur' },
  centilmen: { ad: 'Centilmen', poz: 1.15, neg: 0.9, not: 'saygı görünce saygı verir' },
  kindar: { ad: 'Kindar', poz: 0.9, neg: 1.4, not: 'defterine yazar, silmez' },
};
const KISILIK_SIRA = Object.keys(KISILIKLER);

// Deterministik kişilik ataması — aynı kimlik hep aynı karakter
export function kisilikOf(idStr) { return KISILIK_SIRA[h32(String(idStr) + '#kisilik') % KISILIK_SIRA.length]; }

// Kişilik çarpanlı puan değişimi (yuvarlanmış) — pozitifte poz, negatifte neg çarpanı
export function relDelta(kisilik, delta) {
  const K = KISILIKLER[kisilik] || KISILIKLER.centilmen;
  return Math.round(delta * (delta >= 0 ? K.poz : K.neg));
}

// Eşik durumu — <30 kriz (tehdit kanalı açık) · >70 fırsat · arası nötr
export function esikDurum(puan) { return puan < 30 ? 'kriz' : puan > 70 ? 'firsat' : 'notr'; }

// Soyunma odası kliği — türetilmiş (yaş geçişiyle doğal değişir, ayrı state tutulmaz)
export function klikOf(p) { return (p.age ?? 25) <= 23 ? 'gencler' : 'cekirdek'; }
export const KLIK_TR = { gencler: 'Gençler kliği', cekirdek: 'Çekirdek kadro' };

// RAKİP BAŞKAN kimliği (2.3) — kulüp adından hash'le türetilir: aynı rakip hep aynı başkan.
// UI ve actions AYNI helper'ı kullanır (isim tutarlılığı tek kaynaktan).
export function bkIsim(opp, names) {
  if (!opp) return 'Rakip Başkan';
  const first = names?.first || ['Namık'], last = names?.last || ['Serter'];
  const h = h32('bk#' + (opp.id || '') + '#' + (opp.name || ''));
  return `${first[h % first.length]} ${last[(h >>> 4) % last.length]}`; // >>> işaretsiz: büyük hash'te negatif indeks → "undefined" soyad bug'ı
}
