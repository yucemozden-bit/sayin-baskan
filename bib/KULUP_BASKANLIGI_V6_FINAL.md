# KULÜP BAŞKANLIĞI — v6.0 FİNAL KAPANIŞ DOSYASI
## Master İndeks · Ayar Tablosu · Mimari · QA · Tohum Verisi

> Bu, tasarım setinin **son** dosyasıdır. Yeni sistem eklemez; 5 dosyayı tek projeye kilitler:
> tüm sabitler tek tabloda, mimari sözleşmeler net, uç durumlar kapatılmış, başlangıç verisi gömülü.
> Bundan sonrası tasarım değil **üretim**dir.

## İçindekiler
1. Master indeks (hangi sistem hangi dosyada)
2. AYAR TABLOSU — tüm sabitler tek yerde (tuning sheet)
3. Proje dosya yapısı (VS klasör ağacı)
4. EventBus sözleşmeleri (olay adları + payload)
5. Durum makinesi (oyun fazları)
6. Uç durumlar & QA kontrol listesi
7. Modül başına "Bitti" tanımı (Definition of Done)
8. Tohum verisi (gömülü: takımlar, TD'ler, sponsorlar, kurul, menajerler)
9. Sözlük (terimler tek anlamda)
10. VS'ye verilecek nihai talimat

---

# 1. MASTER İNDEKS

| Sistem | Dosya-Bölüm |
|---|---|
| Zaman/takvim/dönem | Bible-1, v4-1 |
| State şeması | Bible-2 (+v5 staff/aiClubs alanları) |
| Oyuncu modeli/değer/maaş | Bible-4 |
| Takım Gücü 3 katman | Bible-5 |
| Maç motoru (xG/Poisson/sigmoid) | Bible-6 · highlight: v3-H |
| Lig/fikstür/kupa/Avrupa | Bible-7 · canlı lig: v5-2 |
| Ekonomi/borç/sponsor | Bible-8 · markalar: v4-6 · FFP: v5-3 |
| Tesisler | Bible-9 |
| TD & teknik ekip | Bible-10 · staff: v5-1 |
| Transfer | Bible-11 · pazarlık: v3-G · piyasa eko: v5-4 |
| Gauge/atalet/beklenti | Bible-12,13 |
| Olay motoru | Bible-14 + v4-8 |
| Vaatler (20) | Bible-15 · UI: v3-C11 · modüller: v5-11 |
| Seçim matematiği | Bible-16 · kampanya/münazara: v5-5 · sahne: v3-I |
| Muhalefet dönemi | Bible-17 |
| Inbox/Continue | v3-A1, v3-B |
| Kişilik/dynamics/görüşme | v4-E(v3 dosyasında E) → v4-2 karakterler · görüşme: v5-7 |
| Anlatı/manşet/sosyal medya | v3-D · şablonlar: v4-7 · sosyal: v5-6 |
| Basın toplantısı | v3-F · hakem/VAR: v4-5 |
| UI 13 ekran + stil | v3-C · stil token: v4-10 · veri merkezi: v5-9 |
| Ses/juice | v4-11 · v3-J |
| Onboarding | v4-12 |
| Zorluk/denge testleri | v4-13 |
| Başarımlar/uzun oyun | v4-9, v4-15 |
| Senaryolar/Ironman | v5-10 |
| **Yol haritası (MVP kesimi)** | **v5-12** |

---

# 2. AYAR TABLOSU (tuning sheet — tek dosyada değiştir: `src/config.js`)

> Dengeleme yaparken SADECE bu tabloya dokun. Formül değiştirme; katsayı değiştir.

```js
export const TUNING = {
  // — Zaman —
  SEASON_WEEKS:34, SEASONS_PER_TERM:3, LEAGUE_TEAMS:18,
  // — Gauge —
  INERTIA:0.20, INERTIA_ITIBAR:0.08,
  THRESH:{ guvenKriz:20, taraftarBoykot:25, maliTahta:15 },
  // — Güç —
  W_TEMEL:{ kadro:.44, teknik:.14, kimya:.12, taktik:.10, tesis:.08, derinlik:.07, altyapi:.05 },
  POS_W:{ GK:.12, DEF:.26, MID:.30, FWD:.32 },
  CLAMP:{ uygunluk:[.65,1], moral:[.88,1.12], form:[.90,1.10], kond:[.82,1.05] },
  STAR_THRESHOLD:80, STAR_BONUS_MAX:8, BALANCE_MIN:0.85,
  KIMYA_WEEK:+1.5, KIMYA_TRANSFER:-4, KIMYA_TD:-10, TAKTIK_WEEK:6,
  // — Maç —
  BASE_GOALS:2.6, SHARPNESS_K:1.3, HOME_ADV:[.03,.08], LUCK:[.92,1.08],
  SIGMOID_DIV:25, DRAW_BASE:0.28, DRAW_WIDTH:18,
  MOTIV_UNDERDOG:0.04, BIGMATCH_HIDDEN:0.05,
  // — Oyuncu —
  INJURY_BASE:.03, FIT_DROP:12, FIT_REST:20,
  FORM_D:{W:8,D:2,L:-8}, MORALE_D:{W:4,D:0,L:-5}, RED_CARD_P:.08,
  DEV_U24_MAX:0.4 /*×antrenman sv*/, AGE_DECAY_START:31,
  // — Ekonomi —
  WAGE_RATIO_HEALTHY:.55, TIER_SCALE:{kucuk:2,orta:6,buyuk:14},
  TV_BASE:{kucuk:120,orta:350,buyuk:900}, TICKET_K:0.00025,
  ATTEND:{base:.45, taraftarDiv:200, sportifDiv:300, priceSlope:.25, min:.30},
  AUTO_DEBT_PENALTY:.03, INFLATION:[.06,.14], RATE_DRIFT:[-.03,.06],
  FFP:{ revenueMult:.85, appealRepMin:60, appealChance:.4, appealBoost:.10 },
  // — Tesis —
  FAC_COST:{stadyum:12,antrenman:6,tibbi:5,akademi:5,scout:4,ticari:4}, FAC_EXP:1.6,
  // — Sis/scout —
  FOG_BASE:10, FOG_PER_SCOUT:1,
  // — Vaat & seçim —
  MAX_PROMISES:3, HOPE_MULT:4, HOPE_DECAY:.20,
  KEPT:{soz:3,taraftar:5,guven:3}, BROKEN:{soz:5,taraftar:6,guven:4,rakip:4},
  ELECT_W:{sportif:.30,taraftar:.20,mali:.20,itibar:.15,soz:.15},
  SEASON_W:[.20,.30,.50], RIVAL_FACTOR:.5, WIN_LINE:.50,
  CUP_PTS:{lig:40,kupa:20,avrupaZafer:30,avrupaKatilim:10,cap:50},
  CAMPAIGN:{ kpPerTick:2, maxSwing:6, debateMaxSwing:6, skipDebate:-2 },
  // — Olay/anlatı —
  EVENT_P:.12, HEADLINE_MEMORY:8, TAG_EVAL_EVERY:4, SOCIAL_VIRAL_P:.25,
  // — Derbi —
  DERBY_TICKET:1.8, DERBY_ELECT_SWING:4,
  // — Staff (v5) —
  STAFF_GM_DISCOUNT:400, STAFF_CFO_RATE:2000, STAFF_CFO_NOISE:.15,
};
```
Zorluk presetleri (v4-13) bu tablonun üstüne **delta** olarak biner: `applyDifficulty(TUNING, "zor")`.

---

# 3. PROJE DOSYA YAPISI

```
kulup-baskanligi/
├─ src/
│  ├─ config.js            (TUNING + zorluk deltaları)
│  ├─ core/ rng.js eventBus.js clock.js save.js
│  ├─ models/ player.js squad.js staff.js club.js aiClub.js
│  ├─ engines/
│  │   power.js match.js league.js economy.js facilities.js transfer.js
│  │   gauges.js expectation.js events.js promises.js election.js
│  │   narrative.js social.js dynamics.js press.js campaign.js
│  ├─ ui/
│  │   frame.js cockpit.js inbox.js squadView.js matchday.js transferView.js
│  │   facilitiesView.js finance.js congress.js media.js clubView.js
│  │   promiseSelect.js seasonEnd.js electionNight.js dataHub.js
│  ├─ data/ (v4-14 şeması; tohum: bu dosya §8)
│  └─ main.js              (tickLoop + durum makinesi §5)
└─ tests/ balance.test.js  (v4-13 senaryoları, 500 sim)
```
Kural: `engines/` UI bilmez, `ui/` state'i doğrudan yazmaz — her şey eventBus (§4).

---

# 4. EVENTBUS SÖZLEŞMELERİ (çekirdek 20 olay)

| Olay | Payload | Dinleyenler |
|---|---|---|
| TICK_START / TICK_END | {week,season,term} | hepsi / save,ui |
| MATCH_PLAYED | {res, xg, ratings, highlights[]} | gauges, narrative, inbox, dynamics |
| GOAL_SCORED | {min, player, side} | matchday ui (canlı) |
| MONEY_CHANGED | {delta, reason} | finance ui, statusbar |
| DEBT_RESTRUCTURED | {newRate, newTerm} | inbox, gauges |
| TRANSFER_* (OFFER/AGREED/FAILED) | {player, terms, round} | transferView, narrative, dynamics |
| PLAYER_* (INJURED/UNHAPPY/PROMISE_DUE) | {player, detail} | inbox, power |
| FACILITY_DONE | {type, level} | inbox, power, economy |
| COACH_CHANGED | {old, new} | power(taktik reset), narrative |
| EVENT_TRIGGERED / EVENT_RESOLVED | {eventId, choice} | tümü (etki uygulayıcı) |
| PROMISE_MADE / PROMISE_JUDGED | {id, kept} | election, narrative, gauges |
| HEADLINE / SOCIAL_POST | {text, tone, author} | media ui, cockpit widget |
| PRESSER_ANSWERED | {tone, context} | narrative, gauges |
| SEASON_END / TERM_END | {report} | seasonEnd ui / election |
| ELECTION_RESULT | {won, breakdown} | electionNight, mode switch |
| NARRATIVE_TAG_CHANGED | {tag} | events(ağırlık), media |
| MILESTONE | {id} | inbox, achievements |

Sözleşme kuralı: payload'a alan **eklenebilir**, alan adı **değişmez** (geri uyumluluk).

---

# 5. DURUM MAKİNESİ (oyun fazları)

```
BOOT → CLUB_SELECT → TERM_SETUP(TD+transfer+vaat) → SEASON_LOOP
SEASON_LOOP: WEEK_IDLE ⇄ [INBOX_DECISION | MATCHDAY(pre→live→post) | WINDOW | BOARD_MEETING | EVENT_MODAL]
  → SEASON_END → (dönem bitmediyse) SEASON_LOOP
  → (dönem bittiyse) CAMPAIGN(3 tick, lig devam) → DEBATE? → ELECTION_NIGHT
ELECTION_NIGHT → WON → TERM_SETUP
              → LOST → OPPOSITION(3 sezon hızlı özet) → RE_RUN? → TERM_SETUP | GAME_OVER
GAME_OVER → CAREER_REPORT (v4-15)
```
Her faz tek ekrana sahiptir; DEVAM butonu fazın "ileri" eylemidir. Faz dışı ekranlar (Kadro, Finans...) her fazdan açılabilir ama fazı değiştirmez.

---

# 6. UÇ DURUMLAR & QA KONTROL LİSTESİ

**Matematik güvenliği:** tüm gauge/çarpan yazımları clamp'li tek `setGauge()` fonksiyonundan geçer · Poisson λ>8 kırp · bölme öncesi `max(x,1)` · NaN bekçisi tick sonunda state'i tarar (dev modda hata fırlat).
**Kadro uçları:** 11'den az sağlam oyuncu → gençlerden otomatik tamamla, Uygunluk tabanı 0.65'te kilitli, inbox "kadro kırıldı" mesajı · tüm GK'lar sakat → en iyi saha oyuncusu kaleye (overall×0.4, komik ama kurallı).
**Ekonomi uçları:** kasa<0 iki pencere üst üste → zorunlu yıldız satışı olayı (en değerliye otomatik teklif, reddedersen guven −10) · borç > kadroDeğeri×2 → "kayyum" senaryosu: seçimsiz oyun sonu (tek istisna — anlatılır, sürpriz olmaz: Finans ekranında kırmızı çizgi görünür).
**Seçim uçları:** oyOranı tam .500 → 1 haftalık ikinci tur mini-fazı (kampanya aksiyonları ×1) · rakip çekiciliği 0'ın altına inmez · 0 vaat seçildiyse SözTutma bileşeni nötr 50 sayılır.
**Takvim uçları:** kupadan erken elenme → boş haftalar dinlenme (kondisyon avantajı — kupa/lig trade-off'u kendiliğinden doğar) · Avrupa + kupa + lig çakışması haftada max 2 maç, 3.sü ertelenir (fikstür sıkışması ilerki haftalara biner).
**Kayıt:** her tick sonunda otomatik kayıt (Ironman'de tek slot) · versiyon migrate iskeleti (state.meta.version) · yükleme sonrası NaN taraması.
**QA smoke (her sürümde):** 500-sim T1/T2/T3 bantları (v4-13) + "10 sezon otomatik oyna, crash yok" + inbox'ta aynı şablonun 6 hafta kuralı ihlali sayacı = 0.

---

# 7. MODÜL BAŞINA "BİTTİ" TANIMI

Bir motor şu 4'ü sağlamadan bitmiş sayılmaz:
1. **Birim test**: formül örnek girdiyle Bible'daki işlenmiş örneği tutturuyor (Bible-22, Bible-16.2 sabit test vektörleridir).
2. **Event sözleşmesi**: yaydığı/dinlediği olaylar §4 tablosuyla birebir.
3. **Uç durum**: §6'daki ilgili maddeler kapalı.
4. **Hissiyat**: ilgili inbox/manşet çıktısı çıplak sayı değil cümle (v3-A1 kuralı).

---

# 8. TOHUM VERİSİ (gömülü — data/ dosyalarına kopyala)

**teams.json (18 — kurgusal, TR dokulu):**
Kartalspor · Boğaziçi FK · Anadolu Gücü 1923 · Liman SK · Bozkırspor · Yıldız Ovası FK · Demirşehir SK · Kuzey Yakası · Ege Birlik · Sahil FK · Toros Gençlik · Vadi 1905 · Payitaht SK · Çelikkale FK · Rüzgarlı SK · Doğu Şimşekleri · Akarsu Birliği · Taşköprü FK
(rakip ataması: aynı şehir dokusundaki ilk eşleşme ezeli rakip; renkler kulüp seçiminde çakışmayacak paletten atanır.)

**coaches.json (12 TD, arketip/skill bandı):**
Kemal Aydoğan(motivatör 74) · Serdar Kılınç(savunmacı 71) · Doğan Erkul(oyun kurucu 78, minRep 55) · Bülent Karaca(genç işçisi 69) · Faruk Demirel(savunmacı 62) · Metin Soylu(motivatör 66) · Vittorio Ranzetti(oyun kurucu 83, minRep 70) · Jorge Valdes(genç işçisi 76, minRep 60) · Ali Osman Peker(savunmacı 58) · Hakan Yücesoy(oyun kurucu 65) · Tarık Bozan(motivatör 60) · Sven Larsen(savunmacı 79, minRep 65)

**sponsors.json (14):** AeroTürk(havayolu,std) · Bankamatik+(banka,std) · VoltEnerji(enerji içeceği,std) · MegaBahis(bahis,risk:imaj) · KriptoNova(kripto,risk:batma%25) · Demirtaş Holding(inşaat,std) · Anadolu Sigorta Grubu(std) · TeleNet(telekom,std) · Lezzet Grup(gıda,yerel+) · Otomax(otomotiv,std) · GençKart(fintech,genç taban+) · Yerli Esnaf Birliği(yerel paket) · GlobalAir(naming aday) · PetroMar(enerji,std)

**boardnames.json (arketip:isim):** Hesap Adamı: Nedim Ersoylu / Politikacı: Suzan Karataş / Eski Futbolcu: "Efsane" Cengiz Toprak / Sponsor Kralı: Halil Menteşe / Nostaljik: Rıfat Boyner

**agents.json (6):** Şeref Kaya(köpekbalığı) · Ayla Durmaz(beyefendi) · Baba Yılmaz(aile) · Marco Ferran(portföycü) · Kadir Öz(köpekbalığı) · Elif Sancak(portföycü)

**Gazeteciler:** Yandaş: Turgut Ballı ("Tribün Gözü") · Muhalif: Nazlı Ekinci ("Bilanço") · Analist: Ozan Kaptan ("xG Raporu")

İsim havuzları (names.json 200+200) LLM'e tek satır talimatla ürettirilir: "Türkçe erkek ad/soyad havuzu, gerçek kişi çağrışımı yapan ünlü futbolcu adlarından kaçın."

---

# 9. SÖZLÜK

**Tick** = 1 hafta · **Gauge** = 5 ana ibre (G1-G5) · **TemelGüç/EfektifGüç/MaçGücü** = 3 güç katmanı · **Sis** = scout belirsizlik aralığı · **Anlatı etiketi** = kulübün medya durumu · **Karne** = sezon sonu ölçüm seti · **Dönem** = 3 sezon, seçimle biter · **KP** = kampanya puanı · **Umut bonusu** = vaat anlık taraftar etkisi · **Tahta** = transfer yasağı · **Sözleşme (event)** = eventBus payload sabitliği.

---

# 10. VS'YE NİHAİ TALİMAT (kopyala-yapıştır)

> "6 tasarım dosyasını sırayla oku: v2 Bible (motor matematiği), v3 (FM hileleri+UI+akış), v4 (içerik+karakter+veri şemaları), v5 (yaşayan dünya+politika+YOL HARİTASI), v6 (bu dosya: sabitler, mimari, QA, tohum verisi).
> Kurallar: (1) v5-§12 MVP kesimiyle başla; T2/T3 denge testleri geçmeden TAM katmana geçme. (2) Tüm sabitler v6-§2 TUNING'den okunur, formüller Bible'dan — dengeleme sadece TUNING'de yapılır. (3) Mimari v6-§3/4/5: engines UI bilmez, iletişim eventBus, faz makinesi main.js. (4) Bible-22 ve Bible-16.2 işlenmiş örnekleri birim test vektörüdür. (5) data/ dosyalarını v4-§14 şemasıyla, v6-§8 tohum içeriğiyle üret. (6) Her modül v6-§7 'Bitti' tanımını sağlamadan sonrakine geçme."

---

**Set tamam.** Bible = fizik · v3 = his · v4 = ruh · v5 = dünya · v6 = disiplin. Bol şans, Başkan.
