// src/config.js — AYAR TABLOSU (tuning sheet) + zorluk deltaları
// Kaynak: V6-§2 (TUNING) + V4-§13 (zorluk presetleri).
// Kural: dengeleme SADECE burada yapılır; formüller Bible'da kalır.
// Zorluk presetleri bu tablonun üstüne biner: applyDifficulty(TUNING, "zor").

export const TUNING = {
  // — Zaman —
  SEASON_WEEKS: 34, SEASONS_PER_TERM: 3, LEAGUE_TEAMS: 18,
  PRESEASON_WEEKS: 3, // sezon başı hazırlık/transfer dönemi (maç yok; kadro kurulur)
  PRESEASON_FIT: 35,  // kamp haftası başına kondisyon tazelenmesi (3 hafta ≈ bitkin → tam depo)
  // — Gauge —
  INERTIA: 0.20, INERTIA_ITIBAR: 0.08,
  THRESH: { guvenKriz: 20, taraftarBoykot: 25, maliTahta: 15 },
  // — Güç —
  W_TEMEL: { kadro: 0.44, teknik: 0.14, kimya: 0.12, taktik: 0.10, tesis: 0.08, derinlik: 0.07, altyapi: 0.05 },
  POS_W: { GK: 0.12, DEF: 0.26, MID: 0.30, FWD: 0.32 },
  CLAMP: { uygunluk: [0.65, 1], moral: [0.88, 1.12], form: [0.90, 1.10], kond: [0.82, 1.05] },
  STAR_THRESHOLD: 80, STAR_BONUS_MAX: 8, BALANCE_MIN: 0.85,
  KIMYA_WEEK: 1.5, KIMYA_TRANSFER: -1, KIMYA_TD: -10, TAKTIK_WEEK: 6, // transfer sarsıntısı −4→−3→−1 (kullanıcı: "kimyayı toplamak imkansız")
  // — Maç —
  // GÜÇ ETKİSİ (2026-07, kullanıcı isteği): takım gücü galibiyeti daha güçlü belirlesin.
  // K 1.6→3.0 (güç farkı → xG payı dikleşir), LUCK daraldı (şans gücü daha az boğar), gol sabit (2.6).
  // Ölçüm: +8 güç fazlası %44→%49, +12 güç %46→%54 galibiyet. Gösterilen oran (SIGMOID_DIV 25) zaten
  // bu dik eğriyi vaat ediyordu — artık gerçek sonuç ona UYUYOR (önce vaat fazla, sim yatıktı).
  // NOT: k'yı daha yükseltmek (4.2) seçimleri idealde %97-99'a taşıyıp determinizmi bozuyordu → 3.0 tutuldu.
  BASE_GOALS: 2.6, SHARPNESS_K: 3.0, HOME_ADV: [0.03, 0.08], LUCK: [0.95, 1.05],
  // — Kadro YÖNÜ (hücum/savunma ayrışması): tilt = 1 + (atakHat − savunmaHat) × YON.K, BANT'a kırpılır.
  // Savunma ağırlıklı kadro → düşük skorlu maçlar (az yer, az atar) · hücum ağırlıklı → açık maçlar.
  // W/M/G olasılık ORANI değişmez (xG paylaşımına dokunmaz — abartı sonuç freni BANT ±%12).
  YON: { K: 0.012, BANT: [0.88, 1.12] },
  SIGMOID_DIV: 25, DRAW_BASE: 0.28, DRAW_WIDTH: 18,
  MOTIV_UNDERDOG: 0.04, BIGMATCH_HIDDEN: 0.05,
  // — Oyuncu —
  INJURY_BASE: 0.03, FIT_DROP: 12, FIT_REST: 20,
  // KÖTÜ SERİ YUMUŞATMASI (kullanıcı 2026-07-22 "spiral yumuşasın"): efektif-güç geçişi
  // sonrası yenilgi→moral/form→güç döngüsü kendini besliyordu. Çare SADECE DİPTE: DIP_FREN —
  // eşiğin altındaki oyuncuda yenilgi kaybı YARIYA iner ("dibe vuran daha fazla düşmez").
  // NOT: L deltalarını genel hafifletmek DENENDİ ve GERİ ALINDI (autoplay: dönem-4 hayatta
  // kalma %80'e fırladı, bant %12-56 — iyi oynayanı da uçuruyor; fren dibe hedefli kalmalı).
  FORM_D: { W: 8, D: 2, L: -8 }, MORALE_D: { W: 4, D: 0, L: -5 }, RED_CARD_P: 0.08,
  DIP_FREN: { form: 40, moral: 50 },
  DEV_U24_MAX: 1.15 /*×antrenman sv — gençler DAHA HIZLI gelişsin (kullanıcı isteği: 0.8→1.15)*/, AGE_DECAY_START: 31, DEV_DECAY_RATE: 0.6,
  // Antrenman tesisi HER SEVİYEDE hissedilir (kullanıcı isteği 2026-07-20 — eski floor(sv/5) yalnız 5 ve 10'da basamaktı):
  DEV_ANT_HAFTALIK: 0.35, // sezon içi gelişim puanı = sv × bu (kesirli birikir — her yükseltme haftalık hızı artırır)
  DEV_GEL_ESIK: 20,       // +1 güç için birikmesi gereken puan
  DEV_FORM_ESIK: 65,      // formu bu eşiğin üstündeki genç haftada +1 ek gelişim puanı alır (performans→gelişim bağı; kullanıcı isteği 2026-07-21)
  // GELİŞİM SÜREKLİLİĞİ (2026-07-21, kullanıcı: "sonraki sezonlarda kimse yükselmiyor" — 4 sezon
  // teşhisi: S1'de 10 artan, S4'te 0; tavanlar 1-2 sezonda doluyordu, 22-23 yaş tümden kapalıydı):
  DEV_GEC_YAS: 27,        // sezon içi gelişim yaş sınırı (22-27 = "geç gelişimci"; kullanıcı isteği 2026-07-21: gelişim 27'ye kadar sürsün)
  DEV_GEC_CARPAN: 0.5,    // geç gelişimci haftalık puanı ×0.5 (gençten yavaş ama artık büyüyebiliyor; 0.6→0.5 temper)
  DEV_GEC_CAP: 2,         // geç gelişimci sezon içi tavanı +2 (genç +3/elit +4)
  POT_ESNEME: { yas: 27, artis: 2, kariyerCap: 4, tavan: 88 }, // tavana vuran ≤27 oyuncu: sezon sonu pot +2 (kariyerde en çok +4, mutlak tavan 88) — determinist, rand YOK
  LIG_GELISIM: 0.4,       // KARŞI AĞIRLIK: rakip güçleri sezon başına +0.4 — oyuncu kadroları artık kariyer boyu büyüyor (27 yaş sınırı); lig yerinde sayarsa uzun kariyer bedavaya döner. (0.6 denendi: transfersiz oyunu fazla eziyordu.) Determinist, rand YOK.
  DEV_CAP_ELITE_ANT: 8,   // antrenman ≥8 → sezon içi gelişim tavanı +3 yerine +4 (elit tesis farkı)
  KAHVALTI_GELISIM: 7,    // Altyapı Kahvaltısı: sofradaki gelişim çağı oyunculara _gel puanı (~2 hafta idman; kullanıcı isteği — davet genç gelişimini de beslesin)
  FIT_ANT: 0.25,          // dinlenen oyuncuya maç başına EK kondisyon = antrenman sv × bu ("kondisyon çabuk toparlar" artık gerçek; 0.4→0.25 autoplay bandı için tempered)
  // — Ekonomi —
  // TIER_SCALE: mali hedef/karne borç normalizasyonu — 5 KADEMENİN TAMAMI (dev/efsane eksikti:
  // DEV'e terfi eden kariyer maliHedef=NaN üretip güven/mali gauge'larını zehirliyordu — maraton D8 avı 2026-07-21)
  WAGE_RATIO_HEALTHY: 0.55, TIER_SCALE: { kucuk: 2, orta: 6, buyuk: 14, dev: 24, efsane: 36 },
  TV_BASE: { kucuk: 20, orta: 50, buyuk: 261, dev: 360, efsane: 480 }, TICKET_K: 0.00019, // [kalibre: gelir ölçeği; dev/efsane yalnız oyunla ulaşılır]
  // TICKET_K 0.0001→0.00022→0.00019 (2026-07-22): kapasite seviye tablosuna geçiş + kullanıcı
  // çıpaları (sv4 18.000 · sv7 35.000) gişeyi büyüttü — orta/büyük nötr akış bantlarına göre
  // yeniden kalibre edildi (ölçüm: orta +19 · büyük +7 civarı).
  // STAD_KAP (kullanıcı çıpaları 2026-07-22): sv2 9.000 · sv4 18.000 · sv7 35.000 · sv10 80.000 —
  // dört çıpa tek eğriye sığmaz → AÇIK TABLO (aralar geometrik ara değer; ileride tek sayı oynanır).
  // MEGA kompleks ×1.2 (sv10'da 96.000). Kapasiteyi SEVİYE belirler; tier yalnız başlangıç seviyesi.
  STAD_KAP: { TABLO: [5000, 6700, 9000, 12700, 18000, 22500, 28000, 35000, 46100, 60700, 80000], MEGA: 1.2 },
  // STADYUM 3D (2026-07-20): tesis panelinde seviyeye göre gerçek 3D stadyum (assets/stadiums/, gömülü three.js).
  // Seviye 0..10 → 7 model (8 görsel kademe). İlk model 2 seviye kaplar (kullanıcı: "1-2 aynı stat").
  // TEK DÜZENLEME NOKTASI: kademe eklemek/oynatmak için bu diziyi değiştir (dosya adı, uzantısız).
  STAD_3D: { DIR: 'assets/stadiums/', BY_LVL: [
    '1_mahalle_8000', '1_mahalle_8000', '2_ilce_13000', '3_modern_18000', '4_ulusal_30000',
    '5_super_55000', '6_mega_75000', 'stadyum_90000_1', 'stadyum_90000_1', 'stadyum_90000_1', 'stadyum_90000_1',
  ] },
  // ANTRENMAN 3D (2026-07-21): tesis panelinde seviyeye göre gerçek 3D antrenman tesisi (assets/antrenman/).
  // Seviye 0..10 → 8 model (8 görsel kademe). İlk model 2 seviye kaplar, son model üst seviyeleri kaplar.
  ANTRENMAN_3D: { DIR: 'assets/antrenman/', BY_LVL: [
    'antrenman_1', 'antrenman_1', 'antrenman_2', 'antrenman_3', 'antrenman_4_1',
    'antrenman_5', 'antrenman_6_2', 'antrenman_7_1', 'antrenman_8', 'antrenman_8', 'antrenman_8',
  ] },
  TICARI_3D: { DIR: 'assets/ticari/', BY_LVL: [
    'ofis_1_1', 'ofis_1_1', 'ofis_2', 'ofis_3', 'ofis_4_1',
    'ofis_5', 'ofis_6', 'ofis_7', 'ofis_8_1', 'ofis_8_1', 'ofis_8_1',
  ] },
  // KONFOR (kullanıcı tasarımı 2026-07-22: "stadyum kalitesi doluluğu etkilesin"): stadyum
  // seviyesi = konfor. Sv.5 nötr; her seviye doluluk ±%1.2 (sv0 −%6 köhne, sv10 +%6 modern).
  // Kapasite ayrı hikâye: tier + MEGA kompleks (×1.2) — kalite yüzdeyi, kompleks koltuğu büyütür.
  ATTEND: { base: 0.45, taraftarDiv: 200, sportifDiv: 300, priceSlope: 0.25, min: 0.30, KONFOR_SV: 0.012, KONFOR_NOTR: 5 },
  AUTO_DEBT_PENALTY: 0.03, INFLATION: [0.06, 0.14], RATE_DRIFT: [-0.03, 0.06],
  RATE_MAX: 0.60,          // faiz tavanı: kasa<0 cezası sınırsız tırmanmasın (kurtarılabilir kriz)
  RATE_SEASON_DECAY: 0.05, // sezon başı faiz tabana doğru geri çekilir (autoplay-nötr, rand YOK)
  FFP: { revenueMult: 0.85, appealRepMin: 60, appealChance: 0.4, appealBoost: 0.10 },
  // — Tesis —
  FAC_COST: { stadyum: 8, antrenman: 3.5, tibbi: 3, akademi: 3, scout: 2.5, ticari: 3 }, FAC_EXP: 1.5, // [kalibre: orta 3 sezonda 1 tesis +2 yapabilsin → P06/P08 tutulabilir]
  // — Sis/scout —
  FOG_BASE: 10, FOG_PER_SCOUT: 1,
  // GM kadro analizinde genç oyuncunun POTANSİYELİ bugünden kısmen sayılır (zayıf hat + "en iyimiz" için).
  // Yoksa yıldız genç kaleci alınca bile GM o mevkiyi "en zayıf" görüp üstüne oyuncu önerir. 0.5 = potansiyel farkının yarısı.
  GM_POT_W: 0.5,
  // — Vaat & seçim —
  MAX_PROMISES: 3, HOPE_MULT: 4, HOPE_DECAY: 0.20, P02_MIN_BORC: 20, // borç<20 ise P02 seçilemez
  KEPT: { soz: 3, taraftar: 5, guven: 3 }, BROKEN: { soz: 5, taraftar: 6, guven: 4, rakip: 4 },
  ELECT_W: { sportif: 0.30, taraftar: 0.20, mali: 0.20, itibar: 0.15, soz: 0.15 },
  SEASON_W: [0.20, 0.30, 0.50], RIVAL_FACTOR: 0.5, WIN_LINE: 0.55, // eşik %55 · rakip cezası dengenin taşıyıcısı (bkz. election.js)
  CUP_PTS: { lig: 40, kupa: 20, avrupaZafer: 30, avrupaKatilim: 10, cap: 50 },
  CAMPAIGN: { kpPerTick: 2, maxSwing: 6, debateMaxSwing: 6, skipDebate: -2 },
  // — Olay/anlatı —
  EVENT_P: 0.12, HEADLINE_MEMORY: 8, TAG_EVAL_EVERY: 4, SOCIAL_VIRAL_P: 0.25,
  // — Derbi —
  DERBY_TICKET: 1.8, DERBY_ELECT_SWING: 4,
  // — Staff (V5) —
  STAFF_GM_DISCOUNT: 400, STAFF_CFO_RATE: 2000, STAFF_CFO_NOISE: 0.15,
  // — Konjonktür & beklenti (zorlukla değişen tabanlar) —
  RATE_BASE: 0.32,        // sezon başı faiz tabanı (V4-§13)
  EXPECT_DELTA_K: 6,      // beklenti sertliği katsayısı (Bible-13: delta×6)

  // ─────────────────────────────────────────────────────────────────────────
  // FORMÜL SABİTLERİ — Bible-4 (oyuncu) ve Bible-5 (güç) formüllerindeki
  // katsayılar. V6-§2 tablosu bunları enumere etmemişti; motorlar hardcode
  // içermesin diye buraya alındı. Formül YAPISI Bible ile birebir; sadece
  // sayılar burada tunable. (Dengeleme kuralı korunur: sadece bu dosyaya dokun.)
  // ─────────────────────────────────────────────────────────────────────────

  // — Oyuncu değeri/maaşı (Bible-4) — base()/wage KALİBRE edildi (kadroDeger & maaş/gelir) —
  PLAYER: {
    VAL_BASE: 2.5, VAL_GROWTH: 1.075, VAL_REF_OV: 40,    // base(ov)=VAL_BASE×VAL_GROWTH^(ov−40)
    // ASİMETRİK YAŞ EĞRİSİ: genç tarafta hafif iskonto (potFactor zaten prim ekler),
    // zirve sonrası SERT düşüş — genç oyuncu iyi paraya satılır, yaş aldıkça değer erir.
    // 18y≈1.15 · 23y=1.25 (zirve) · 26y≈1.04 · 29y≈0.83 · 31y≈0.69 · 34y≈0.48
    AGE_BASE: 1.25, AGE_PEAK: 23, AGE_SLOPE_GENC: 0.02, AGE_SLOPE_YASLI: 0.07, AGE_CLAMP: [0.3, 1.25],
    POT_COEF: 0.03,                                       // potFactor = 1 + max(0,pot-ov)×0.03
    WAGE_RATIO: [0.31, 0.42],                             // wage = mv × rand(...) [yeni yaş eğrisi sonrası yeniden kalibre: maaş/gelir bandı korunur]
    // v4.3 AUDIT düzeltmesi: FORM_START=50 formül TABANINA denk geliyordu (maç oynamadan −%10
    // "formsuz" cezası); MORALE_START=65 de nötr çarpanın altındaydı (−%10). Sezon başı takım
    // hazırlık dönemi formunda + iyimser başlar: sakatsız hafta-1 Efektif ≈ Temel −7 (beklenen bant).
    MORALE_START: 70, FITNESS_START: 100, FORM_START: 58,
    HIDDEN_RANGE: [1, 20],                                // gizli nitelikler (V5-12: MVP'de kullanılmaz)
  },

  // — Kadro üretimi (squadGen; Bible-4 dağılımı) —
  SQUADGEN: {
    OVERALL_SD: 5, OVERALL_CLAMP: [35, 90],
    AGE: [18, 34], YOUTH_AGE: 24, POT_SPREAD: 10,
    STAR_MIN: 80, STAR_MAX: 88, BUYUK_STARS: [2, 3],
    CONTRACT: [1, 5],
    // GENÇLİK ALIMI KADEMESİ (kullanıcı tasarımı 2026-07-22: "her sezon 10 tane gelmesin —
    // akademi seviyesi hem SAYIYI hem KALİTEYİ belirlesin"): sv1-2 → 1 genç (42-52) ·
    // sv3-5 → 2 genç (50-60) · sv6-8 → 3 genç (58-70) · sv9-10 → 4 genç (66-80, İLKİ
    // SÜPERSTAR ADAYI: güç 74-82 + potansiyel 86-93 garantili manşet). Potansiyel TAMAMEN
    // ŞANS: güç + 0..16 (bazısı düz çıkar, bazısı cevher). Akademisiz kulüpten ocak çıkmaz.
    YOUTH_LADDER: [
      { min: 1, n: 1, band: [42, 52] },
      { min: 3, n: 2, band: [50, 60] },
      { min: 6, n: 3, band: [58, 70] },
      { min: 9, n: 4, band: [66, 80], super: true },
    ],
    YOUTH_POT_LUCK: [0, 16], YOUTH_SUPER_BAND: [74, 82], YOUTH_SUPER_POT: [86, 93],
    YOUTH_AGE_RANGE: [17, 19],
    // TIER-İÇİ AKADEMİ ÖDÜLÜ (2026-07): ladder sayı/bandı kademeli — ara seviyeler (ör. sv3→4→5)
    // aynı bandı verip ölü kalıyordu. Her tier-içi seviye gençlerin POTANSİYEL tavanını +bu kadar
    // yükseltir (post-gen additive → RNG akışı/çekiliş sayısı DEĞİŞMEZ; güç aynı, ceiling artar).
    YOUTH_LEVEL_POT: 2,
  },

  // — Takım gücü 3 katman (Bible-5) —
  POWER: {
    IDEAL_XI: { GK: 1, DEF: 4, MID: 4, FWD: 2 },  // ilk 11 hat ihtiyacı (Bible-5.1)
    MISSING_LINE: 30,                             // eksik hat cezası (o hat 30 sayılır)
    BALANCE_DIV: 200,                             // dengeCarpani böleni
    STAR_BONUS_PT: 0.15,                          // yıldız başına (ov−eşik)× katkı
    W_TEKNIK: { taktik: 0.35, oyuncuYonetimi: 0.30, otorite: 0.20, yardimciEkip: 0.15 },
    W_KIMYA: { kimya: 0.50, bigExp: 0.30, kaptan: 0.20 },
    KAPTAN_VAR: 100, KAPTAN_YOK: 60,
    ROL_UYGUNLUK: [0.85, 1.00],                   // taktik uyum rol çarpanı aralığı
    TESIS_BASE: 50, TESIS_ANTRENMAN: 5, TESIS_TIBBI: 3, FAC_REF: 5, // TesisTabani + tibbi ref sv
    DERINLIK_BASE: 18, DERINLIK_PER: 6, YEDEK_COUNT: 7, YEDEK_DIV: 2,
    ALTYAPI_MULT: 10,                             // Altyapi = akademi×10
    UYGUNLUK_TIBBI: 0.01,                         // uygunluk += (tibbi−FAC_REF)×0.01
    MORAL_REF: 60, MORAL_DIV: 220,               // moral çarpanı (base = CLAMP.moral[0])
    FORM_REF: 50, FORM_DIV: 200,                 // form çarpanı  (base = CLAMP.form[0])
    KOND_REF: 70, KOND_DIV: 150,                 // kond çarpanı  (base = CLAMP.kond[0])
    EFEKTIF_MAX: 110,                            // EfektifGüç clamp tavanı
    STAD_LEVEL_MAX: 10, TARAFTAR_MAX: 100, STAD_Q_W: 0.5, // MaçGücü ev avantajı q
  },

  // — Maç motoru & sakatlık (Bible-6; tıbbi katsayıları Bible-9) —
  MATCH: {
    POISSON_CAP: 8,             // QA-§6: Poisson λ tavanı (λ>8 kırp)
    INJURY_TIBBI_RISK: 0.03,   // risk ×(1 − tibbi×0.03)
    INJURY_FITNESS_DIV: 200,   // risk ×(1 + (100−fitness)/200)
    INJURY_DUR_BASE: 6,        // sakatlık süre tabanı (hafta)
    INJURY_TIBBI_DUR: 0.04,    // süre ×(1 − tibbi×0.04)
    INJURY_DUR_MIN: 1,
    RED_SUSP: [1, 3],          // kırmızı kart → 1..3 hafta ceza
    AI_STAD: 5, AI_TARAFTAR: 50, // lig sim'inde AI ev avantajı varsayılanı (q≈0.5)
    AI_EFEKTIF: 0.93, // SİMETRİ (2026-07-21 efektif-güç düzeltmesi): maç artık EFEKTİF güçle oynanıyor; AI'nin moral/kond katmanı yok → rakip gücüne sağlıklı kadronun tipik maç-günü oranı (ölçülen ort. 0.936) uygulanır. Nötr yönetimde denge eski kalibrasyonla aynı; iyi/kötü kadro yönetimi gerçek uç yaratır (0.64–1.11).
    PTS: { W: 3, D: 1, L: 0 }, // puanlama G3/B1/M0 (Bible-7)
  },

  // — Lig (Bible-7) —
  LEAGUE: {
    EUROPE_SPOTS: 4,           // 1-4. Avrupa
    RELEGATION_FROM: 16,       // 16-18. küme (18 takım)
    // 2. LİG sistemi: küme düşünce ertesi sezon zayıf rakipli + düşük gelirli 2. lig
    PROMOTION_TO: 3,           // 2. ligde ilk 3 → terfi
    LIG2_HEDEF: 3,             // 2. ligde hedef sıra (terfi bandı)
    LIG2_STRENGTH_DROP: 16,    // 2. lig rakip gücü bu kadar düşük (üst lige göre)
    LIG2_ECO: { tv: 0.4, sponsor: 0.6, gate: 0.72 }, // 2. lig gelir çarpanları (TV/sponsor/bilet)
    STAR_EXODUS_MIN: 70,       // küme sonrası bu güçteki yıldız üst lige gider
    STAR_EXODUS_FEE: 0.6,      // giden yıldızın değerinin bu kadarı kasaya
    // 2. LİGDEN BAŞLAYAN kulüp: küçük tier'dan bir tık daha düşük (güç/kasa/kadro)
    LIG2_START: { gucDrop: 6, kasa: 12, borc: 10, kadroMult: 0.6 },
  },

  // — Ekonomi (Bible-8) — sponsor pazarlığı & FFP MVP dışı; gelir kalemi olarak var —
  ECONOMY: {
    WEEKS_PER_YEAR: 52,
    KAR_VERGISI: 0.40,         // yıl (sezon) sonu işletme kârının EŞİK ÜSTÜ %40'ı vergi — zengin kulüp payını öder, hazine milyarlara ulaşmasın
    KAR_VERGISI_ESIK: 55,      // ilk 55mn kâr vergisiz (küçük/orta kulüp korunur; yalnız zengin fazlası vergilenir)
    KAR_VERGISI_BORC_MUAF: 20, // borç > bu ise kâr vergisi ALINMAZ ("önce borcunu öde; borçluyken zengin sayılmazsın") — Batan Dev / toparlanan kulüp korunur, yalnız borçsuz-zengin vergilenir
    BORC_KOMPOUND: 0.02,       // borç ANAPARA bileşiği: faizi ödesen bile borç ~%2/yıl büyür (öde, sürüncemede bırakma) — gentle, spiral yok
    // SERVET VERGİSİ (bakiye tavanı): kasa tier tamponunu aşarsa fazlası vergilenir → hazine milyarlarda
    // kalmaz ("yatır ya da kaybet"). Kâr vergisi AKIŞI, bu STOKU sınırlar → ikisi birlikte gerçek tavan.
    SERVET_VERGISI: { ESIK: { kucuk: 60, orta: 160, buyuk: 380, dev: 750, efsane: 1050 }, ORAN: 0.30 },
    VARLIK_VERGISI: 0.02,      // başkanın kişisel varlık değerinin %2'si/sezon (ev/araba/uçak/yat/sanat) — oz.nakit'ten (lüksün kalıcı bedeli)
    SPONSOR_BASE: { kucuk: 6, orta: 22, buyuk: 45, dev: 68, efsane: 95 }, // göğüs baz (sezonluk mn) — küçük/orta ×1.5 (daha ağır); büyük zaten devasa, net bandında kalsın
    SPONSOR_ITIBAR_BASE: 0.5, SPONSOR_ITIBAR_DIV: 100, // itibarFactor = 0.5 + itibar/100
    SPONSOR_KOL: 0.4, SPONSOR_NAMING: 0.6, NAMING_MIN_STAD: 7,
    SPONSOR_REP_DIV: 150,      // sponsor geliri ×(1 + itibar/150)
    FORMA_K: 0.0000001, FORMA_SPORTIF_DIV: 200, // [kalibre]
    UYELIK_K: 0.0000001,       // [kalibre]
    // TİCARİ OFİS geliri kaldıracı (2026-07): tesis seviyesi sponsor/forma/üyelik gelirini büyütür.
    // BAŞLANGIÇ seviyesine göre NÖTR (club.ticariBaz) → mevcut denge birebir korunur; yükseltmek ödül.
    // "sessiz ortak" — ikincil ama gerçek gelir kaldıracı (eskiden seviyesi hiçbir şey yapmıyordu).
    TICARI: { SLOPE: 0.05, LO: 0.8, HI: 1.5, BAZ_DEFAULT: 3 },
    TEKNIK_MULT: 1.4,          // teknikEkip = coach.wage/52 × 1.4
    BAKIM_K: 0.02,             // tesisBakim = Σsv × 0.02 (haftalık işletme gideri)
    // TESİS YIPRANMASI YUMUŞATMASI (2026-07): eskiden 3 sezon dokunulmayan TÜM tesisler AYNI sezon
    // birden düşüyordu → nakit-fakir kulüp (borç öderken) 4 seviye birden kaybediyordu (sıkıcı ceza).
    // Artık: sezonda EN FAZLA 1 tesis işlenir; NAKİT varsa küçük bakım ücreti (upgrade×ORAN) ödenip
    // seviye KORUNUR, gerçekten batıksa 1 seviye düşer. Baskı sürer ama şok/oynanamazlık gider.
    BAKIM: { SEZON: 3, UCRET_ORAN: 0.2, UCRET_MIN: 2 },
    IDARI_BASE: 0.15, IDARI_FAN_K: 0.00000005,
    MALI_DEFICIT_MULT: 3,      // maliHedef: açık cezası ×3
    // BORÇSUZ KULÜP: borç sıfırlanınca mali disiplin uçar + o an diğer disiplinlere coşku dalgası
    BORCSUZ_MALI_BONUS: 12,    // maliHedef: borçsuzken haftalık mali gauge hedefine flat +12 (mali "çok yükselir" ama güveni her hafta ezmesin)
    BORCSUZ: { RIPPLE_TARAFTAR: 6, RIPPLE_ITIBAR: 5, RIPPLE_GUVEN: 8, RESET_ESIK: 1 }, // borçsuza geçiş anı: bir defalık gauge dalgası (sezonda 1×); RESET_ESIK üstünde yeniden borçlanınca tekrar kutlanabilir
  },

  // — Gauge hedef sürücüleri (Bible-12) —
  GAUGE: {
    W_TARAFTAR: { beklenti: 0.6, bilet: 0.16, yildiz: 0.13, vaat: 0.11 }, // başarı DAHA ÖNEMLİ (0.5→0.6)
    W_GUVEN: { sportif: 0.5, mali: 0.25, taraftar: 0.17, vaat: 0.08 },    // sportif başarı DAHA ÖNEMLİ (0.4→0.5)
    PRICE_SATISF_SLOPE: 40,    // biletFiyatMemnuniyeti eğimi (fiyat 1.0 → 50)
    STAR_PRESENCE_K: 20,       // yıldız başına varlık puanı
    NEUTRAL: 50,               // ikincil sürücüler için nötr taban (MVP)
    ITIBAR_OVERPERF_K: 0.4,    // itibar hedefi += K×max(0, beklentiyeGoreSonuc−50) (beklenti üstü sıra)
    // BEKLENTİ-ÜSTÜ ÖDÜLÜ: takım beklenenden iyi giderse taraftar/kurul DAHA ÇOK destekler (ölçülü — cezaları boğmasın)
    TARAFTAR_OVERPERF_K: 0.16, GUVEN_OVERPERF_K: 0.16,
    // BÜYÜME ÖDÜLÜ: kadro değeri + güç artıyorsa taraftar/kurul destek artar (0-1 büyüme → +puan)
    BUYUME_TARAFTAR_K: 5, BUYUME_GUVEN_K: 6,
    ITIBAR_ANCHOR_ADD: 3,      // itibar çapası = reputation + 3 (autoplay ort. 48-55 hedefi)
  },

  // — Beklenti (Bible-13) + eskalasyon merdiveni (dönem sonu hedef yükselir/düşer) —
  EXPECT: {
    HEDEF_SIRA: { kumede_kal: 15, ust_yari: 8, sampiyonluk: 1 }, // başlangıç (tier)
    LADDER: [15, 12, 9, 6, 3, 1],  // hedefSıra merdiveni (aşağı = zorlaşır) [yumuşatıldı]
    ESCALATE_MARGIN: 4,            // dönem ort. sıra hedeften ±4 sapıyorsa kademe kayar [3→4]
    // Eskalasyonun ÖDÜL tarafı: kademe yükselince kulüp büyür ("hedef 5. sıra olan kulüp
    // artık daha büyük bir kulüptür"); kademe İNİŞİNDE simetrik geri alınır.
    GROWTH: { fan: 0.05, sponsor: 0.03, itibar: 2 }, // kademe başına: taraftar +%5, sponsor ×1.03, itibar çapası +2
  },

  // — Eşik olayları (Bible-14.1) — sadece deterministik 4 grup; rastgele havuz MVP dışı —
  EVENTS: {
    KONGRE: { budgetLockTicks: 4, taraftar: -5 },   // guven<20
    BOYKOT: { ticks: 3, ticketMult: 0.6, guvenPerTick: -4 }, // taraftar<25
    TAHTA: { banWindows: 2 },                        // mali<15
    DOMINO: { itibar: -20, taraftar: -25, tvMult: 0.5 }, // küme düştü
    ZAFER: { itibar: 15, taraftar: 20, sponsorValueMult: 1.15 }, // şampiyon
  },

  // — Transfer (Bible-11 MVP) —
  TRANSFER: {
    PREMIUM: [1.0, 1.6], DEPOSIT: 0.3, SALE: [0.8, 1.3],
    MARKET_SIZE: 10, POOL: 80, WINDOWS: [1, 17], FAC_MAX: 10, // POOL: canlı havuz hedef boyu (haftalık vitrin sonrası kırpma)
  },

  // — Transfer ONAY akışı (Başkanlık Hissi §1): oyuncu transfer yapmaz, ONAYLAR —
  APPROVAL: {
    WINDOW_SPAN: 4,           // pencere 4 hafta açık (1-4 ve 17-20)
    FILE_CHANCE: 0.9,         // pencere haftasında GM dosya getirme olasılığı (aktif dosya yoksa)
    SALE_CHANCE: 0.3,         // pencere haftasında satış teklifi gelme olasılığı
    // Şartlı pazarlık ("pahalı, %20 in"): taban oranlar; GM skill kaydırır
    SART: { IN: 0.5, DELAY: 0.3, LOST: 0.2, GM_SHIFT: 250, DISCOUNT: 0.8 },
    GM_SKILL: { kucuk: 52, orta: 62, buyuk: 76 }, // tier bazlı GM yetkinliği (±6 doğuş)
    BUDGET_PRESET: { dusuk: 0.25, orta: 0.5, yuksek: 0.9 }, // kasa oranı olarak bütçe tavanı
  },

  // — TD süreci (Başkanlık Hissi §2) —
  COACH_FIRE: {
    TAZMINAT_YIL: 0.5,        // tazminat = wage × kalanYıl × 0.5 (Bible-10)
    TARAFTAR: -3, MEDIA_TONE: -1,
    INTERIM: { taktik: 50, oyuncuYonetimi: 50, otorite: 45, yardimciEkip: 45, wage: 0.1 },
    CANDIDATES: [2, 3],       // GM 2-3 aday dosyası getirir
  },

  // — Kritik hafta (Başkanlık Hissi §5: özel prim yalnız kritik maçta) —
  CRITICAL: { RANK_DIFF: 2, LATE_WEEK: 31 }, // sıra komşusu ≤2 fark veya sezon finali

  // ═══ DELUXE KATMANI ═══
  DELUXE: {
    // D1 Canlı lig (v5-§2): AI başkan tipleri sezonluk drift + kriz + seçim
    AI: {
      DRIFT: { POPULIST: 4, MUHASEBECI: -1, MUHASEBECI3: 2, INSAATCI: 1, AVCI: 1, DEV: 1 },
      CRISIS_AFTER: 2, CRISIS_P: 0.4, CRISIS_DROP: 10, CRISIS_FEE: 0.85, // popülist AI 2 sezon sonra %40 çöker; yıldızı hafif iskontolu düşer
      EVENT_P: 0.05, TD_DROP: 5, TD_WEEKS: 4,             // tick içi AI haberleri
      ELECTION_EVERY: 3, CHANGE_P: 0.45,                  // 3 sezonda bir AI seçimi
    },
    // D2 Kurul (v4-§2.1): loyalty sürüklenmesi + sunum haftaları
    BOARD: { LOYALTY_DRIFT: 0.15, SUNUM_WEEKS: [12, 30], TAAHHUT_PLUS: 8, TAAHHUT_MINUS: 3 },
    // D4 Takvim (v4-§1)
    CAL: {
      DERBY_SWING: 0.03, INTL_WEEKS: [7, 13, 27], INTL_POWER: 0.97, INTL_INJ: 0.08,
      CUP_WEEKS: [6, 11, 15, 22, 26, 31], CUP_SPREAD: 8, CUP_RAMP: 4, // tur başına rakip +4 (finaller çetin)
      SPRINT_FROM: 28, SPRINT_MULT: 1.3, GOLDEN_P: 0.10, YOUTH_WEEK: 17,
    },
    // D5 Maç günü 3 faz (v3-H)
    MATCH3: { HL_MIN: 5, HL_MAX: 9 },
    // D6 Kampanya + münazara (v5-§5). RIVAL_CAMP: kampanya haftalarında RAKİP DE sahada —
    // her tick rakip çekiciliği artar (senin kampanyan bunu ancak dengeler; net kazanç münazarada).
    // RIVAL_CAMP: kampanya tick'i başına rakip baskısı; DECAY ile dönem büyüdükçe söner
    // ("ilk seçimde rakip iştahlı; koltuğu oturan başkana meydan okuma cesareti kırılır").
    CAMPAIGN_TICKS: 3, RIVAL_CAMP: 2.0, RIVAL_CAMP_DECAY: 0.55, // YAŞAYAN: telefon tavanı meydan-okuma baskısını seyreltti → kampanya telafisi (1.8→2.0); sönüm yavaşlatıldı (0.1→0.55): rakip iştahı geç dönemlerde de diri, dönem-1'e dokunmaz
    DEBATE: { PER_Q: 1.5, VIZYON: 0.5, SALDIRI_OK: 1.5, SALDIRI_MISS: -1, THRESH: 55, RIVAL_HIGH: 12, MAX: 6 },
    // D8 Sosyal medya (v5-§6)
    SOCIAL: { FEED: 6, VIRAL_SENT: 45, VIRAL_P: 0.25 },
  },

  // ═══ PAKET A — YÖNETİM DERİNLİĞİ ═══
  // A1 Staff katmanı (v5-§1): GM (mevcut) + 4 koltuk
  STAFF: {
    ROLES: ['cfo', 'akademi', 'basin', 'stat', 'tis'], // B2b: 6. koltuk — Taraftar İlişkileri Sorumlusu
    SKILL_BASE: 38, SKILL_REP: 0.5, SKILL_SPREAD: 12,   // aday skill ≈ 38 + itibar×0.5 ± 12
    WAGE_K: 0.012,                                       // maaş ≈ skill × 0.012 (mn/sezon)
    CFO_NOISE_MAX: 0.15,                                 // CFO yok/kötü → nakit projeksiyonu ±%15 sapar
    CFO_DEFAULT_SKILL: 40,                               // koltuk boşken varsayılan (kötü) yetkinlik
    CFO_RESTRUCT_SKILL: 70, CFO_RESTRUCT_BONUS: 0.01, BANKACI_BONUS: 0.02, // yapılandırma pazarlığı
    AKADEMI_POT_DIV: 10,                                 // genç potansiyeli += (skill−50)/10
    GOLDEN_PER_SKILL: 0.001,                             // altın çocuk şansı += skill×0.001
    BASIN_NEG_DIV: 250,                                  // negatif manşet olasılığı ×(1−skill/250)
    DOUSE_COOLDOWN: 4,                                   // manşet söndürme: 4 haftada 1 hak
    STAT_DOLULUK_DIV: 2500,                              // doluluk += skill/2500
    RESIGN_P: 0.05,                                      // sezon sonu istifa/rakip kapma taban şansı
  },
  // A2 FFP ek alanları (TUNING.FFP mevcut: revenueMult/appeal*)
  FFP_EXTRA: { CUP_BONUS: 15, TAAHHUT_CUT: 0.05, TAAHHUT_GUVEN: -5, DEFAULT_INCOME: 110 },
  // A3 Deadline day + piyasa ekonomisi (v5-§4)
  DEADLINE: { FILES: [3, 5], BUY_DISC: [0.7, 0.88], SELL_PREM: [1.1, 1.3] },
  MARKET_ECON: { INFLATION: [1.06, 1.14] },              // sezon başına piyasa çarpanı
  LOAN: { FEE_FRAC: 0.1, WAGE_SHARE: 0.5, DEV_MULT: 1.5, SEND_P: 0.4, POT_GAP: 6 },
  FREE_AGENT: { P: 0.08, AGE: [29, 34] },                // pencere dışı bonservissiz dosya

  // ═══ PAKET "YAŞAYAN KOLTUK" — interaktivite/his katmanı ═══
  YASAYAN: {
    // Y3 Maç içi müdahale: yarı payları (45/35/10 dk) + devre arası hamleleri + son 10 dk
    SEG: { H1: 0.5, H2A: 0.389, LATE: 0.111 },
    HT: {
      // Bant koruması (YAŞAYAN doğrulama): canlı müdahale NET AVANTAJ basıyordu → etkiler küçültüldü
      soyunma: { p: 0.6, mult: 1.03, morale: 1, otorite: -3 },   // %60 ateşler / %40 TD otorite −3
      tdguven: { rel: 1 },                                        // güvenli, ilişki +1
      tribun: { mult: 1.01, taraftarCeza: 2 },                    // yalnız evde; kaybedersen taraftar −2
    },
    LATE: { dok: { both: 1.5 }, koru: { total: 0.7 } },           // öne dök / kilitlen
    // Y4 Tepki zinciri: gerilim eşiği üstünde 2.-3. halka açılır
    CHAIN_TENSION: 50,
    // Y2 Telefon: sezon bandı yönetmen kontrolünde (director.phoneAllowed)
    PHONE: { MIN: 6, MAX: 10, DEFER_FEE: 1.10, DEFER_REL: -2 },
    // Y6 Masa dokunuşları
    DESK: { moralePlus: 0.35, taraftarPlus: 0.35, sponsorRep: 0.1, fogNarrow: 1, CHAT_P: 0.10, IDENTITY_AT: 5 }, // gerçekten MİKRO (bant koruması)
  },

  // — PAKET "İNSAN HİKAYELERİ": kaptan / sözleşme masası / sakatlık yayı —
  INSAN: {
    KAPTAN: {
      VETO_REL: -2,        // TD önerisini veto: ilişki −2
      SATIS_KIMYA: -8,     // kaptan giderse kimya şoku
      SATIS_MORAL: -3,     // + tüm kadroya soyunma odası şoku
      KRIZ_MORAL: 3,       // kriz telefonunda "dinle": takım morali +
      KRIZ_RED_MORAL: -8,  // "kapıyı göster": kaptan morali −
      WEIGHT: 1.4,         // moral yayılımında kaptan ağırlığı (dynamics lider ×1.4)
    },
    KONTRAT: {
      VALUE_MULT: 1.5,     // önemli oyuncu eşiği: değer > kadro ort ×1.5
      ASK_WAGE: 1.4,       // menajerin açılış istediği maaş çarpanı
      ORTA_YOL: 1.2,       // GM pazarlığı orta yol maaş çarpanı
      ORTA_P: 0.6,         // pazarlıkta orta yola gelme olasılığı
      DIRENIR: 1.35,       // direnirse son teklif çarpanı
      KABUL_MORAL: 6,      // imza morali
      BEKLET_UCUZ_FORM: 45, // form bunun altına düşerse ucuzlar
      BEKLET_UCUZ: 1.1,    // ucuzlayan istek çarpanı
      BEKLET_ZAM_FORM: 72, // form bunun üstünde kalırsa istek +%20
      BEKLET_ZAM: 1.2,
      GIDER_TARAFTAR: -4,  // anlaşmasız bedava gidiş: taraftar tepkisi
      TUR_ARASI: 2,        // pazarlık turları arası hafta
    },
    SAKAT: {
      NET_TESIS: 5,        // sağlık tesisi ≥5 → tanı NET; altı → SİSLİ
      ERKEN_NUKS_P: 0.30,  // erken dönüş nüks olasılığı
      NUKS_MULT: 2,        // nüks süresi = orijinal ×2
    },
  },

  // — PAKET "MİRAS & UZUN OYUN": muhalefet / tier / jübile / defter / kapanış —
  MIRAS: {
    OPP_SEASONS: 3,          // muhalefet süresi (sezon)
    OPP_LOSS_CAP: 2,         // üst üste seçim kaybı → kariyer kapanış
    // Dönüş seçimi: oy = 0.5 + (AI kötü yönetim cezası) + kampanya − görevdeki avantajı
    COMEBACK: { BASE: 0.50, POS_K: 0.014, BORC_K: 0.0011, INCUMBENT: 0.12, CAMP_K: 0.010, NOISE: 0.03, // görevdeki avantajı sert: dönüş mümkün ama garanti değil
      // DÖNÜŞ MANDASI: kongre seni bir OYLA geri çağırdığında kurul güveni & taraftar taze mandaya oturur
      // (3 sezon önce kaybettiğin andaki düşük değerde KALMAZ). Güç dönüş oy oranıyla ölçeklenir.
      MANDATE: { GUVEN_BASE: 52, GUVEN_MANDA_K: 0.7, GUVEN_FLOOR: 50, TARAFTAR_BASE: 55, ITIBAR_MIN: 46 } },
    ENKAZ: { STAFF_DAGILIR: true, KIMYA: -10 }, // dönüşte staff koltukları boş + kimya şoku
    // Rakip dönem borcu SINIRI: eskiden POPULIST + büyük kulüpte borç kadroDeger'e endeksli bileşik
    // büyüyüp 370-470mn'ye (400mn kredi tavanını bile aşarak) fırlıyordu → ölüm sarmalı, oynanamaz.
    // Artık: sezon başına en çok +PER_SEASON, toplam min(kadroDeger×RATIO_CAP, ABS_CAP) ile sınırlı.
    // Sonuç ~kadro değerinin %40'ı: "krizde ama kurtarılabilir" (kriz eşiği %35, tenzil %100).
    ENKAZ_BORC: { PER_SEASON: 50, RATIO_CAP: 0.42, ABS_CAP: 180 },
    // Rakip tipinin SPORTİF sapması (lig sırası, hedefSira etrafında): eskiden sıra mutlak güce
    // endeksliydi → güçlü kulüpte dört tip de tabana yapışıp 1. bitiyor, saha enkazı görünmüyordu.
    // Artık hedef etrafında tipe göre sapıyor (her kulüp boyutunda ayrışır): + = beklentinin altı.
    OPP_SPORTIF: { POPULIST: -3, AVCI: 2, INSAATCI: 3, MUHASEBECI: 6 },
    TIER: {
      UP_TERMS: 2,           // üst üste seçilmiş dönem sayısı (orta/büyük yükselişi — eski davranış birebir)
      UP_ITIBAR: 62,         // itibar eşiği
      UP_BORC_RATIO: 0.30,   // borç < kadroDeger × bu
      // 5 KADEME (Bible-20 genişleme): Küçük→Orta→Büyük→Dev→Efsane. Üst kademeler kariyer hedefi —
      // şart seti hedef kademeye göre ağırlaşır (şampiyonluk da ister). orta/buyuk eski eşiklerle aynı.
      UP: {
        orta: { terms: 2, itibar: 62, borc: 0.30, titles: 0 },
        buyuk: { terms: 2, itibar: 62, borc: 0.30, titles: 0 },
        dev: { terms: 3, itibar: 72, borc: 0.20, titles: 1 },
        efsane: { terms: 4, itibar: 82, borc: 0.10, titles: 3 },
      },
      DOWN_BORC_RATIO: 1.0,  // tenzil: borç > kadroDeger × bu (+ küme sezonu) — her kademeden 1 basamak
      BLEND: 0.5,            // 1 sezonluk geçiş: ilk adım %50 harman (şok yok)
      LADDER_BOOST: 10,       // terfi eden kulübün yeni ligi: rakip kalitesi de yükselir (Bible-20 — ödül cezasız değil)
    },
    JUBILE: { YAS: 34, YIL: 6, KASA: 0.5, TARAFTAR: 2, SESSIZ_TARAFTAR: -2, NOSTALJIK_LOYALTY: -5, KUSKUN_LOYALTY: -8, ALTIN_ITIBAR: 3 }, // tekrarlanan tören: ödül MİKRO (bant koruması)
    DEFTER: { SEZON_AN: 3, KARIYER_AN: 5, MUZE_ETKI: 8 }, // sezon sonu 3 an · kapanışta 5 · müzeye giren etki eşiği
    VIZYON: { // dönem başı tek cümle vizyon → kurul loyalty KALİBRASYONU (net-sıfır: birini sevindir, birini küstür)
      sportif: { 'Eski Futbolcu': 6, 'Nostaljik': 2, 'Hesap Adamı': -5, 'Sponsor Kralı': -3 },
      mali: { 'Hesap Adamı': 6, 'Sponsor Kralı': 3, 'Eski Futbolcu': -5, 'Nostaljik': -4 },
      altyapi: { 'Nostaljik': 6, 'Eski Futbolcu': 2, 'Politikacı': -4, 'Sponsor Kralı': -4 },
    },
    MUZE_MILESTONE_MULT: 1.5, // P19 Kulüp Mirası aktifken milestone bonusları ×1.5
  },

  // — MEGA KOŞU "BÜYÜK DÜNYA + FİNAL CİLA" —
  MEGA: {
    // B1a: dinamik kurul gündemi (münazara motorunun kurul versiyonu)
    KURUL: {
      LOOKBACK: 15,          // gündem son N haftadan kurulur
      VERI_OK: 2, VERI_MISS: -4, VIZYON: 1, KABUL_LOYALTY: -2, KABUL_GUVEN: 1, // kalibrasyon: ödül/risk asimetrik
      SAKIN_BONUS: 1,        // gündemsiz dönem: "sorunsuz sunum" küçük bonus
      BUDGET_HI: 60, BUDGET_LO: 45, BUDGET_SWING: 0.15, // ort. loyalty → transfer tavanı ±%15
    },
    // B1b: rakip başkan yüzleşmeleri
    RAKIP: {
      SAVAS_P: 0.15,         // açık dosyaya rakip girme olasılığı/hafta
      BLUF_P: { POPULIST: 0.6, MUHASEBECI: 0.5, INSAATCI: 0.4, AVCI: 0.3, DEV: 0.2 }, // "üstüne koyarım" blöf oranı
      ARTIR_MULT: 1.12,      // sen artırırsan dosya bedeli
      FED_DESTEK: 0.15, FED_DUSMAN: -0.10, FED_ITIBAR: 65, // federasyon toplantısı konuşmaları
    },
    // B1c: hakem-federasyon gizli hattı (ASLA gösterilmez; etkiler MİKRO)
    FED: {
      START: 50,
      ATESLI: -2, LOBI: -3, SAKIN: 0, CEZA_DISIPLIN: 0.5, SESSIZ: 1, // kalibrasyon: rutin demeç hattı beslemez — hat yalnız GERÇEK jestlerle oynar
      VAR_BIAS: 0.01,        // kalibrasyon: 500-sim Δ2.35 → 0.02; EFEKTİF-GÜÇ (2026-07-21) form/moral geri beslemesi küçük avantajları amplifiye ediyor (0.02'de Δ5.2!) → 0.01 ("gizli hat MİKRO kalır" ilkesi)
      CEZA_TAKDIR_HI: 70, CEZA_TAKDIR_LO: 35, // kırmızı ceza süresi ±1 hafta takdiri
      YAZI_LO: 35, YAZI_HI: 70, YAZI_MAX: 2,  // Ozan Kaptan istatistik yazısı (tek kanal)
    },
    // B1d: FFP sertleşme kademeleri
    FFP2: { CUT2_MULT: 2, BAN_WINDOW: true, PUAN_SIL: 3, PUAN_TARAFTAR: -6, AI_KELEPIR_P: 0.08 /* ONAYLI kalibrasyon: kelepir arzı Dengeli dönem-4 bandını deliyordu (0.15→0.08) */, KELEPIR_MULT: 0.7 },
    // B2a: çok boyutlu taraftar duyarlılığı (gauge hedefini ağırlıklı besler)
    BOYUT: {
      W: { sonuc: 0.5, transfer: 0.12, stil: 0.1, kimlik: 0.1 }, // kalibrasyon: sapma tavanı ±2 (bant koruması)
      DRIFT: 0.15,           // boyutlar haftalık hedefe süzülür
      STIL_KALE_CEZA: 12,    // "kalemizi koruyalım" ağırlıklı sezon = korkak futbol
    },
    // B2b: taraftar ilişkileri sorumlusu (6. koltuk) — STAFF desenine eklenir
    TIS: { BULUSMA_KASA: 0.3, BULUSMA_ONARIM: 6, BULUSMA_MAX: 2 },
    // B2c: koreografi ekonomisi
    KOREO: { KASA: 0.4, EV_AVANTAJ: 1.015, RADIKAL: 3, RET_RADIKAL: -2, KIMLIK: 3, HESAP_ESIK: 3 },
    // B2d: medya kapak teklifi
    KAPAK: { FORM_W: 4, ITIBAR_MIN: 55, ITIBAR_PLUS: 1, SPONSOR_PLUS: 0 /* kalibrasyon: rep bileşiği bantları deliyordu */, KIBIR_P: 0.25, LANET_TARAFTAR: -2, RET_RADIKAL: 1 },
    // B3a: ihtiyaç ilanı
    ILAN: { CEVAP_HAFTA: [1, 3], CEVAP_MAX: 3, MORAL_CEZA: -2, MOTIV: { normal: 1.0, nakit: 0.85, ffp: 0.7 } },
    // B3b: satış vitrini
    // PITY (2026-07-22): %35 zar + telefon-meşgul haftalar üst üste ıskalayınca vitrin haftalarca
    // sessiz kalabiliyordu ("2-4 haftada teklif" sözü çiğneniyordu) — 4. haftada teklif GARANTİ.
    VITRIN: { MORAL: -3, DONUS_MORAL: 2, TEKLIF_HAFTA: [2, 4], TEKLIF_P: 0.35, PITY: 4 },
    // B4c: koltuk modları
    MOD: { AILE_SERVET: 100, VITRIN_LOYALTY_CEZA: -20 },
    // B6c: vaat umut tavanı
    UMUT_TARAFTAR_TAVAN: 92,
  },

  // — Haftalık teknik rapor (v4.1-1): çarpan nötr değerleri + "iyi" eşiği —
  REPORT: {
    NEUTRAL: { uygunluk: 0.98, moral: 0.92, form: 0.94, kond: 0.94 }, // tipik sağlıklı değerler (v4.3 start düzeltmesiyle güncel)
    OK_EPS: 0.015,  // en kötü açık < eps → 'iyi' raporu
    SEV: { orta: 0.035, agir: 0.07 }, // v4.3: açık eşiği → hafif/orta/ağır şablon kademesi
  },

  // — Başkan telkinleri (v4.1-2) —
  TELKIN: {
    TAMKADRO: { power: 1.04, fitCost: 6, injChance: 0.08, injWeeks: [1, 2] },
    ROTASYON: { power: 0.90, recoverWeeks: 2, recoverAmt: 8 },
    GENCLER: { power: 0.92, devChance: 0.85, devCount: 3, ageMax: 22 }, // gençler daha hızlı gelişsin: şans 0.6→0.85, sayı 2→3
    KALE: { power: 1.0, goalsMult: 0.7 },
    REJECT_OTORITE: 70, REJECT_CHANCE: 0.5, REJECT_REL: -2,     // TD reddi
    SPAM_WINDOW: 4, SPAM_COUNT: 3, SPAM_UYUM: 1, SPAM_LEAK_P: 0.20, // ayda 3+ → uyum↓ + sızıntı
    KUKLA_OTORITE: 60, KUKLA_COUNT: 5, KUKLA_ITIBAR: 1,          // zayıf TD 5+ kabul → itibar kemirilir
  },

  // — Primler (v4.1-3) — hepsi kasadan, Finans'ta görünür —
  PRIM: {
    // PRİM GÜÇLENDİRME (kullanıcı isteği: "gerçekten etki etsin, etkisi fazla olsun"): power ~derbi
    // salınımı ölçeğine çıktı; galibiyette İZ kalır (moral/form/kimya kalıcı işler — izMoral/izForm/izKimya).
    MAC: {
      normal: { power: 1.025, cost: 0.3, moral: 4, form: 3, kimya: 2, izMoral: 2, izForm: 1, izKimya: 0 },
      yuksek: { power: 1.05, cost: 1.0, moral: 8, form: 6, kimya: 4, izMoral: 3, izForm: 2, izKimya: 1 },
    },
    SERI: { streak: 3, firstCost: 1.2, nextCost: 0.4, moraleBoost: 3, formBoost: 3, nextPower: 1.02, nextWeeks: 2 },
    SEZON: { floorMorale: 66, floorGain: 1, achieveCost: 4, achieveMorale: 4, failMorale: -3 },
    OZEL: { power: 1.06, cost: 2.5 },
  },

  // — Tesis ihalesi (v4.1-4) —
  TENDER: { // ŞANTİYE sistemi: her teklifin SÜRESİ var (hafta) — ucuz=yavaş+riskli, pahalı=hızlı+bonuslu
    A: { costMult: 0.75, riskP: 0.25, hafta: 5, sarkma: 3 },     // yerel: ucuz ama 5 hafta; %25 yarı yolda +3 hafta sarkar
    B: { costMult: 1.35, bonusP: 0.20, hafta: 2 },               // premium: 2 haftada teslim; %20 +1 ekstra kademe
    C: { costMult: 0.80, leakP: 0.20, leakItibar: -4, leakRival: 2, hafta: 3 }, // tanıdık: 3 hafta; %20 şantiye ortasında medyaya sızar
  },

  // — Vaat ara-ilerleme (v4.1-5) —
  MILESTONE: { taraftar: 2, guven: 2, unrestTaraftar: -2, unrestGuven: -1 },

  // — Basın/demeç (V3-F → v2 basın toplantısı) — anlık ton etkileri —
  // DENGE: her tonun artısı VE eksisi var — bedava cevap yok. Eksiler KULLANIM BAŞI
  // küçük tutulur (haftalık tekrarlanan aksiyon: sezonda ~34 kez birikir; −1 bile ezerdi).
  PRESS: {
    iddiali: { taraftar: 4, guven: -0.3 },     // tribün coşar; kurul "beklenti şişirme"yi not eder
    sakin: { mediaTone: 0.5 },                 // medya yumuşar (+fed hattı); eksisi FIRSAT MALİYETİ: tribüne hiç dokunmaz
    savunmaci: { guven: 2, taraftar: -1 },
    atesli: { taraftar: 6, kimya: 2, itibar: -2, mediaTone: -1, pfdkChance: 0.30, pfdkCost: [0.5, 2] },
  },

  // — Seçim (Bible-16, 16.1) —
  ELECTION: {
    MALI_GAUGE_W: 0.28,         // mali karne: (mali_gauge − 50) × 0.28 [nakit-biriktirme ezici olmasın]
    MALI_DEBT_CAP: 6,           // borç-kapatma delta katkısı ±6 ile sınırlı (finans ezici olmasın)
    BORCSUZ_MALI_BONUS: 8,      // seçim mali karnesi: borçsuz kulüpte flat +8 (borçsuzluk sandıkta ödüllenir)
    RIVAL_W: { zayif: 0.4, ceza: 0.3, pozisyon: 0.3 }, // rakip çekiciliği ağırlıkları
    ATTR_W: 0.5,                // rival.attractiveness birikimi (kırık vaat/sızıntı/kampanya) çekiciliğe bu ağırlıkla biner
    RIVAL_ZAYIF_REF: 68,        // zayifHane = clamp(REF − enZayıfBileşen, 0, 100). 62→68: 64-68 taramasında hedefe (kazanma %75-85) EN YAKIN değer — knob bu aralıkta zayıf, bkz. tarama raporu
    BROKEN_CEZA: 8,             // tutulmayan vaat başına rakip cezası
    POS_TITLE: 6,              // kupasız 3 sezon → şampiyonluk_vaadi gücü [kalibre]
    POS_PRICE_THRESH: 1.3, POS_PRICE_SCALE: 60, // bilet>1.3 → taraftar_dostu
  },

  // — Kongre 2.6: DELEGE BLOKLARI —
  // KRİTİK DEĞİŞMEZ: blokların pay-ağırlıklı W toplamı ELECT_W'ye BİREBİR eşittir
  // (Σ pay×W[k] = ELECT_W[k]) → tüm ilişkiler nötr 50'deyken oy oranı eski formülle
  // bit-bit aynı çıkar (autoplay/kalibrasyon bantları OYNAMAZ). W satırı değişecekse
  // bu toplam korunmak ZORUNDA (tests/delege.test.mjs bunu ispatlar).
  DELEGE: {
    ILISKI_K: 0.2,             // blok oyu: (iliski−50) × K puan; toplam etki Σ pay×(iliski−50)×K
    YEMEK: { maliyet: 1, artis: 6, hak: 3 }, // dönemde 3 blok yemeği (1mn, iliski +6)
    BLOK: {
      eski:   { ad: 'Eski Tüfekler',     kim: 'kurucu aileler, eski yöneticiler', pay: 0.25, W: { sportif: 0.20, taraftar: 0.10, mali: 0.20, itibar: 0.35, soz: 0.15 } },
      is:     { ad: 'İş Kanadı',         kim: 'sanayici ve esnaf delegeleri',     pay: 0.25, W: { sportif: 0.20, taraftar: 0.05, mali: 0.45, itibar: 0.20, soz: 0.10 } },
      tribun: { ad: 'Tribün Delegeleri', kim: 'tribünden yetişen delegeler',      pay: 0.25, W: { sportif: 0.45, taraftar: 0.40, mali: 0.00, itibar: 0.05, soz: 0.10 } },
      taban:  { ad: 'Üye Tabanı',        kim: 'mahalle ve aidat üyeleri',         pay: 0.25, W: { sportif: 0.35, taraftar: 0.25, mali: 0.15, itibar: 0.00, soz: 0.25 } },
    },
  },

  // — Kongre 2.6: ULTRAS (taraftar grupları — mevcut fanGroups üstüne iliski+talep katmanı) —
  // İhmal yolu SANDIĞA DOKUNMAZ (autoplay-nötr): protesto manşet + grup iliski'sidir;
  // blok/gauge etkisi yalnız BİLİNÇLİ cevapla (karşıla/reddet) işler.
  ULTRAS: {
    TALEP_HAFTA: [5, 29],      // talep doğabilecek hafta bandı
    TALEP_P: { radikal: 9, ilimli: 6 }, // hash yüzdesi/hafta (~sezonda 1-2 talep/grup)
    SURE: 4,                   // cevap süresi (hafta) — dolarsa protesto olayı
    CD: 8,                     // talep sonrası bekleme (hafta)
    KABUL: { iliski: 8, taraftar: 1, tribunBlok: 2 },
    RED: { iliski: -6, tribunBlok: -2 },
    PROTESTO: { iliski: -10 },
    DUVAR_ESIK: 70, DUVAR_P: 12, // iliski≥70 → sezonda 1 bedava koreografi gecesi (hash)
    TALEPLER: {                 // maliyetler mn
      koreografi: { maliyet: 2,   ad: 'Dev koreografi malzemesi' },
      deplasman:  { maliyet: 1.5, ad: 'Deplasman konvoyu otobüsleri' },
      lokal:      { maliyet: 1,   ad: 'Taraftar lokali tadilatı' },
    },
  },
};

// Zorluk presetleri (V4-§13). Değerler mutlak override'dır (okunması kolay olsun diye).
// AI_TRANSFER ileride rakip AI transfer zekâsını sürer (v5-2).
export const DIFFICULTY = {
  kolay:  { RATE_BASE: 0.24, LUCK: [0.95, 1.05], EVENT_P: 0.08, FOG_BASE: 6,  EXPECT_DELTA_K: 4,  WIN_LINE: 0.50, RIVAL_FACTOR: 0.40, AI_TRANSFER: 'pasif' },
  normal: { RATE_BASE: 0.32, LUCK: [0.92, 1.08], EVENT_P: 0.12, FOG_BASE: 10, EXPECT_DELTA_K: 6,  WIN_LINE: 0.55, RIVAL_FACTOR: 0.50, AI_TRANSFER: 'orta' },
  zor:    { RATE_BASE: 0.38, LUCK: [0.90, 1.10], EVENT_P: 0.15, FOG_BASE: 12, EXPECT_DELTA_K: 8,  WIN_LINE: 0.58, RIVAL_FACTOR: 0.55, AI_TRANSFER: 'agresif' },
  efsane: { RATE_BASE: 0.44, LUCK: [0.90, 1.10], EVENT_P: 0.18, FOG_BASE: 14, EXPECT_DELTA_K: 10, WIN_LINE: 0.60, RIVAL_FACTOR: 0.60, AI_TRANSFER: 'agresif+' },
};

// Zorluk presetini TUNING üstüne uygular; YENİ bir config nesnesi döndürür.
// TUNING'i mutasyona uğratmaz (saf yardımcı — motor kodu değil).
export function applyDifficulty(tuning, level = 'normal') {
  const preset = DIFFICULTY[level] || DIFFICULTY.normal;
  return { ...tuning, ...preset, difficulty: level };
}

// Kulüp seviye tabloları (Bible-3, birebir). Yeni kariyer başlangıç state'i buradan kurulur.
export const TIERS = {
  kucuk: {
    kasa: 20, borc: 15, kadroDeger: 80, reputation: 25, fan: 250000, temelGuc: 40,
    gauges: { guven: 50, taraftar: 45, mali: 55, sportif: 35, itibar: 25 }, beklenti: 'kumede_kal', stad: 24000,
  },
  orta: {
    kasa: 50, borc: 60, kadroDeger: 210, reputation: 45, fan: 800000, temelGuc: 55, // kadroDeger 250→210: üretim gerçeği (200 sezon ort ~199; Bible-3 orijinali 250 — motor bu alanı OKUMAZ, salt kalibrasyon referansı)
    gauges: { guven: 55, taraftar: 60, mali: 50, sportif: 50, itibar: 45 }, beklenti: 'ust_yari', stad: 32000,
  },
  buyuk: {
    kasa: 120, borc: 400, kadroDeger: 1200, reputation: 75, fan: 3500000, temelGuc: 78,
    gauges: { guven: 60, taraftar: 75, mali: 35, sportif: 70, itibar: 75 }, beklenti: 'sampiyonluk', stad: 52000,
  },
  // 5 KADEME: Dev ve Efsane — kariyer BAŞLANGICI DEĞİL, yalnız oyun içi yükselişle ulaşılır
  // (applyTier fan/reputation/stad/beklenti okur; diğer alanlar tablo bütünlüğü için).
  dev: {
    kasa: 250, borc: 700, kadroDeger: 2400, reputation: 88, fan: 7000000, temelGuc: 86,
    gauges: { guven: 62, taraftar: 80, mali: 32, sportif: 78, itibar: 85 }, beklenti: 'sampiyonluk', stad: 68000,
  },
  efsane: {
    kasa: 400, borc: 1000, kadroDeger: 4000, reputation: 96, fan: 12000000, temelGuc: 92,
    gauges: { guven: 65, taraftar: 85, mali: 30, sportif: 84, itibar: 92 }, beklenti: 'sampiyonluk', stad: 84000,
  },
};
