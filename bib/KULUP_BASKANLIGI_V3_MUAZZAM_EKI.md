# KULÜP BAŞKANLIĞI — v3.0 "MUAZZAM" EKİ
## FM'den Uyarlanmış Hileler · Ekran Ekran UI · Anlatı Motoru · Akıcılık

> Bu döküman v2.0 Bible'ın üstüne gelir; onu değiştirmez, **genişletir**. Referanslar `§Bible-X` şeklinde.
> Ana fikir: Football Manager'ın bağımlılık yapan döngüsü **"Devam Et" tuşu + Inbox + maç günü draması**dır. Biz bunu menajer değil **başkan** perspektifine çeviriyoruz: sahaya sen dokunmazsın, ama her şeyin hesabı sana gelir.

## İçindekiler
- A. FM'den çalınan 12 hile (başkan versiyonu)
- B. Oyun döngüsü & akıcılık (Continue mimarisi)
- C. Ekran ekran UI spec (13 ekran, wireframe + veri + etkileşim)
- D. Anlatı motoru (manşet üretimi, medya tonu, rakip başkan)
- E. Kişilik & dinamikler (sayısal model)
- F. Basın toplantısı / demeç motoru
- G. Transfer pazarlığı dansı
- H. Maç günü deneyimi (3 faz, highlight sistemi)
- I. Seçim gecesi (finalin finali — dramatik sayım)
- J. Ses/görsel juice checklist
- K. İmplementasyon modül sırası (güncellenmiş)

---

# A. FM'DEN ÇALINAN 12 HİLE (başkan versiyonuna çevrilmiş)

### A1. Inbox — oyunun kalbi
FM'de her şey gelen kutusuna düşer; oyuncu dünyayı **haber akışından** yaşar. Bizde de öyle:
- Her tick 2-6 **mesaj** üretir: maç raporu, mali özet, TD talebi, medya manşeti, taraftar grubu mektubu, kongre üyesi fısıltısı, menajer teklifi.
- Mesajların bir kısmı **aksiyonlu** (içinde 2-3 butonlu karar), kısmı bilgi.
- Okunmamış rozeti + kategori filtreleri (Maç / Finans / Transfer / Medya / Kongre).
- **Kural:** oyuncuya asla çıplak state gösterme; her değişim bir *mesajla anlatılır*. ("Mali Sağlık 42→38" değil → "CFO uyarısı: faiz yükü kombine gelirini yedi. Önümüzdeki ay nakit sıkışacak.")

### A2. Gizli özellikler + belirsizlik (FM'in scout sisi)
FM'de oyuncunun gerçek niteliği scout seviyene göre aralıkla görünür (CA/PA sisi). Bizde:
```
görünenOverall = gerçekOverall ± sis;  sis = max(0, 10 - scout×1) // scout 10 → sis 0
UI: 68-76 gibi ARALIK göster; scout raporu geldikçe daralt.
```
Gizli nitelikler (asla sayı olarak gösterilme, sadece scout raporu cümlesiyle ima edilir):
`sakatlanmaYatkınlığı(1-20) · profesyonellik(1-20) · basıncaDayanıklılık(1-20) · önemliMaçPerformansı(1-20)`
- `önemliMaçPerformansı` → derbi/final MaçGücü'ne bireysel ±%5.
- `profesyonellik` → form istikrarı + gelişim hızı çarpanı (E bölümü).

### A3. Oyuncu kişilikleri & sosyal gruplar (FM Dynamics)
FM'in Dynamics ekranı: hiyerarşi (team leaders / influencers), sosyal gruplar, mutluluk yayılımı. Bizde birebir §E'de sayısallaştırıldı. Başkan için önemi: **yıldızı sattığında sadece güç değil, soyunma odası dengesi bozulur.**

### A4. "Promises" — sözler sadece taraftara değil
FM'de oyunculara/TD'ye verilen sözler takip edilir. Bizde 3 katman:
1. **Taraftara vaatler** (§Bible-15, seçim mekaniği)
2. **Oyunculara sözler**: "Şampiyonluk kadrosu kuracağım" (yıldızı tutmak için) → pencere sonunda kontrol; tutulmazsa o oyuncu + sosyal grubu moral −12, transfer talebi.
3. **TD'ye sözler**: "İstediğin 2 transferi yapacağım" → tutulmazsa TD uyum −, medyaya sızdırma riski (otoriteye göre).

### A5. Basın toplantısı → Başkan demeci
FM'in maç öncesi/sonrası basın toplantısı bizde **haftalık demeç fırsatı** (§F). Her cevap tonu (İddialı / Sakin / Savunmacı / Ateşli) farklı gauge'lara dokunur; medya tonu hafızalıdır.

### A6. Medya anlatı etiketleri (dynamic narratives)
FM sezonu "title race", "crisis club" gibi anlatılarla renklendirir. Bizde kulüp her an bir **anlatı etiketi** taşır ve tüm haber üretimi bu etiketten beslenir (§D):
`ŞAMPİYONLUK_YARIŞI · KRİZ_KULÜBÜ · YENİDEN_DOĞUŞ · BORÇ_BATAĞI · ALTYAPI_DEVRİMİ · SEÇİM_SATHI`

### A7. Sezon önü medya tahmini & oranlar
FM sezon başında medya tahmini yayınlar ("7. bitirirsiniz"). Bizde bu **beklenti sistemine bağlanır**: medya tahmini = beklenti sırası ± küçük gürültü. Sezon sonunda "tahminin üstü/altı" manşeti → taraftar/itibar etkisi. Ucuz ama güçlü bir bağlam hilesi.

### A8. Milestone & rekor sistemi
"Kulüp tarihi en uzun galibiyet serisi", "500. golün", "borç ilk kez X altında" → inbox kutlama mesajı + küçük itibar/taraftar bonusu (+1..+3). Kaydedilen rekorlar Kulüp Müzesi vaadiyle (P19) sinerji yapar: müze varsa milestone bonusları ×1.5.

### A9. Devre arası & sezon sonu "board meeting" → tersine çevrilmiş
FM'de kurul seni değerlendirir. Bizde **sen kurula sunum yaparsın** (dönemde 6 kez, sezon ortası+sonu). Ekranda 3 slaytlık özet (sportif/mali/vaat ilerleme) + 1 taahhüt seçersin → guven hedefini etkiler. Kısa, ritüel bir sahne; oyuncuya "hesap veriyorum" hissi.

### A10. Transfer pazarlık dansı (§G)
FM'in teklif→karşı teklif→menajer→imza zinciri. Tek ekranlık ama 3-4 turlu mini müzakere; bonuslar, taksit, satış payı gibi kaldıraçlarla.

### A11. Maç günü highlight mimarisi (§H)
FM'in "sadece önemli anları izlersin" prensibi. Metin ticker + 5-9 highlight kartı; maç 30-60 saniyede yaşanır, istersen "Sonucu geç" ile atlanır.

### A12. "Continue" tuşunun kutsallığı
FM'in gerçek bağımlılık mekaniği: her zaman görünür tek bir **DEVAM** butonu; basınca zaman akar, durması gereken yerde durur (aksiyonlu mesaj, maç, pencere, seçim). Bizim master loop bunun üstüne kurulu (§B).

---

# B. OYUN DÖNGÜSÜ & AKICILIK (Continue mimarisi)

### B1. Haftalık ritim
```
[DEVAM] → tick işler → inbox'a 2-6 mesaj düşer
   ├─ Aksiyonlu mesaj varsa → DEVAM kilitlenir, karar bekler
   ├─ Maç haftasıysa → Maç Günü sahnesi (H) araya girer
   ├─ Pencere açıksa → Transfer Merkezi bandı görünür (zorunlu değil)
   └─ Kritik olay (§Bible-14) → tam ekran olay kartı
```
**Akıcılık kuralları:**
- Bir tick'te oyuncunun önüne **en fazla 2 zorunlu karar** çıkar (fazlası kuyruğa alınır, ertesi tick).
- Sıradan haftalar 5-10 saniyede geçmeli; yoğun haftalar (derbi + pencere + kriz) 2-3 dakika sürebilir. Tempoyu **olay yoğunluğu** belirler, suni bekleme asla.
- **Hızlı simülasyon**: "Sezonu hızlı oynat" modu — sadece aksiyonlu duraklarda durur (FM'in holiday modu, ama kararlar sana kalır).

### B2. Durak noktaları (DEVAM'ın durduğu yerler)
1. Aksiyonlu inbox mesajı · 2. Maç günü · 3. Transfer penceresi ilk günü · 4. Kurul sunumu (A9) · 5. Devre arası özeti · 6. Sezon sonu töreni · 7. Vaat seçimi · 8. SEÇİM GECESİ

### B3. Geri bildirim gecikmesi ilkesi
Kararın etkisi **hemen sayı olarak gösterilmez**; 1-3 tick sonra inbox mesajı olarak *hikayeyle* döner. ("Kombine zammı → 2 hafta sonra: 'Tribün doluluk %71'e düştü, taraftar grubu pankart hazırlıyor.'") Bu, FM'in "dünya yaşıyor" hissinin sırrıdır.

---

# C. EKRAN EKRAN UI SPEC (13 ekran)

> Genel dil: koyu zemin, tek vurgu rengi kulüp renginden türetilir. Sol sabit nav, üstte kalıcı durum şeridi, sağ altta her zaman **DEVAM**. Tüm sayılar animasyonlu sayar (count-up). Ekran geçişi 150ms fade+slide.

### C0. Kalıcı çerçeve
```
┌──────────────────────────────────────────────────────────────┐
│ ⚽ KULÜP ADI      S2 · Hafta 14      Kasa 38mn  Borç 71mn  ▲▼ │ ← durum şeridi
├──────┬───────────────────────────────────────────────────────┤
│ NAV  │                                                       │
│ Kokpit│                 AKTİF EKRAN                          │
│ Inbox3│                                                      │
│ Kadro │                                                      │
│ Maç   │                                                      │
│ Transfer                                                     │
│ Tesis │                                                      │
│ Finans│                                                      │
│ Kongre│                                                      │
│ Medya │                                              ┌─────┐ │
│ Kulüp │                                              │DEVAM│ │
└──────┴──────────────────────────────────────────────┴─────┴─┘
```
Durum şeridindeki kasa/borç, değişince 1sn renkli yanıp söner (yeşil/kırmızı).

### C1. KOKPİT (ana dashboard)
```
┌─ 5 GAUGE (yarım halka göstergeler) ────────────────────────────┐
│  Güven 55   Taraftar 61▲  Mali 42▼  Sportif 58▲  İtibar 45    │
├─ SOL: SONRAKİ MAÇ ─────────────┬─ SAĞ: ANLATI KARTI ───────────┤
│  vs Rakip FK (D) · 4. sıra     │  "KRİZ KULÜBÜ" etiketi        │
│  Güç: Biz 62 ▸ Onlar 66        │  Medya tonu: Sert 🔴          │
│  Tahmin: %34 G %29 B %37 M     │  Manşet: "...":              │
├─ TAKIM GÜCÜ ŞERİDİ ────────────┴───────────────────────────────┤
│  Temel 57 → Efektif 49  [Uygunluk .89·Moral .91·Form .96·Kond .93]│
│  ⚠ 2 sakat, yıldızın morali düşük                              │
├─ MİNİ LİG (5 satır: üstüm/altım) ─┬─ VAAT İLERLEME (3 bar) ────┤
└────────────────────────────────────┴────────────────────────────┘
```
- Efektif gücün **neden** düştüğü çarpan çipleriyle her an görünür — v8'deki "niye kaybediyorum" sorusunun cevabı hep ekranda.
- Gauge'lara tıkla → ilgili detay ekranına gider.

### C2. INBOX
```
┌ Filtre: Tümü | Maç | Finans | Transfer | Medya | Kongre ┐
│ ● [KARAR] CFO: Faiz yükü — yeniden yapılandıralım mı?   │ ← aksiyonlu, altın çerçeve
│ ○ Maç Raporu: 2-1 Galibiyet vs ...                      │
│ ○ Menajer DM: "Müvekkilim ayrılmak istiyor"             │
│ ○ Taraftar Der.: Kombine fiyatı mektubu                 │
└──────────────────────────────────────────────────────────┘
Sağ panel: seçili mesajın gövdesi + (varsa) 2-3 karar butonu + etki ipucu (soluk ikonlar: 👥▼ 💰▲)
```
Etki ipuçları **yön gösterir, sayı göstermez** (belirsizlik = tekrar oynanabilirlik).

### C3. KADRO
Tablo: Ad · Poz · Yaş · Güç(aralıklı, sis) · Form sparkline · Moral emoji · Kondisyon bar · Değer · Maaş · Sözleşme · Durum(🩹/🟥/🌍).
Üst şerit: hiyerarşi grafiği (Liderler → Etkililer → Çekirdek → Gençler) — E bölümü verisinden.
Satır tıkla → oyuncu kartı (kişilik cümlesi, sosyal grubu, sana bakışı: "Başkana güveni: Yüksek").

### C4. MAÇ GÜNÜ (3 faz — detay §H)
### C5. TRANSFER MERKEZİ
Sol: hedef listesi (scout raporlarıyla, sis aralıklı). Orta: pazarlık paneli (§G — teklif kompozisyonu kaydırıcıları). Sağ: gelen teklifler + kadro satılabilirlik listesi. Üstte pencere geri sayımı: "Pencere kapanmasına 3 hafta".

### C6. TESİSLER
6 kart (stadyum/antrenman/tıbbi/akademi/scout/ticari): seviye noktaları (●●●●○○○○○○), yükseltme maliyeti+süresi, **etki cümlesi** ("Tıbbi +1: sakatlıklar ~%4 kısalır"). İnşaat sürüyorsa kartta vinç ikonu + kalan hafta.

### C7. FİNANS
Üst: 12 haftalık nakit akışı çizgisi (projeksiyon kesikli devam eder — FM hilesi: geleceği göster, panik erken gelsin).
Orta: gelir/gider kalemleri yatay barlar. Alt: borç kartı (faiz, vade, yeniden yapılandırma butonu) + maaş/gelir oranı göstergesi (%55 çizgisi işaretli — P15 vaadiyle bağlı).

### C8. KONGRE & SEÇİM PANELİ
- Oy projeksiyonu (canlı): §Bible-16 formülü her tick hesaplanıp **trend çizgisi** olarak gösterilir ("Bugün seçim olsa: %47").
- 5 bileşen katkı barları (sportif/taraftar/mali/itibar/söz) + rakip çekiciliği kırmızı negatif bar.
- Rakip aday kartı: adı, pozisyonu ("Mali Kurtarıcı"), son demeci.
- Lobicilik aksiyonu (dönem son 3 tick'i).

### C9. MEDYA
Manşet arşivi + medya tonu göstergesi (Dostane↔Düşmanca) + haftalık demeç butonu (§F).

### C10. KULÜP (kimlik ekranı)
Tarihçe, müze (rekorlar A8), taraftar sayısı büyüme grafiği, marka değeri, anlatı etiketi geçmişi ("Bu kulüp 3 sezon önce BORÇ_BATAĞI'ndaydı"). Oyuncunun uzun vadeli gururu bu ekranda birikir.

### C11. VAAT SEÇİMİ (senin ekranın, geliştirilmiş)
Mevcut 20 kart korunur; eklenenler:
- Her kartta **zorluk yıldızı (1-5)** + "tahmini başarı şansı" (mevcut duruma göre hesaplanır: örn. P02 Borçsuz Kulüp, borç/gelir oranından %38 gibi).
- Seçilen 3 kart alta "SEÇİM SÖZLEŞMESİ" şeridine iner, imza animasyonu → dramatik taahhüt hissi.
- 0 vaat seçme butonu: "Söz yok, iş var" (temkinli strateji meşrulaşır).

### C12. SEZON SONU TÖRENİ
Tam ekran karne: sıra, kupa, gelir-gider özeti, sezonun oyuncusu, medya tahmini vs gerçek ("Tahmin 7. — Bitirdin 4. ▲"). Vaat ilerlemeleri güncellenir. 15 saniyelik ödül sahnesi.

### C13. SEÇİM GECESİ → §I (ayrı sahne, finalin finali)

---

# D. ANLATI MOTORU

### D1. Anlatı etiketi seçimi (her 4 tick'te değerlendir)
```
if (myPos<=2 && week>10)            tag = ŞAMPİYONLUK_YARIŞI
else if (mali<25 || borçTrend>+%15) tag = BORÇ_BATAĞI
else if (son5maç puan<=2)           tag = KRİZ_KULÜBÜ
else if (gençOyunSüresi>%25)        tag = ALTYAPI_DEVRİMİ
else if (geçenSezonKümeHattı && şimdi üst yarı) tag = YENİDEN_DOĞUŞ
else if (seçime<=10 tick)           tag = SEÇİM_SATHI
else                                tag = NORMAL
```
Etiket → manşet şablon havuzunu, olay ağırlıklarını (§Bible-14 rastgele havuz) ve rakip başkanın söylemini seçer.

### D2. Manşet üretimi (şablon + slot)
```
şablon örnekleri (KRİZ_KULÜBÜ): 
 "Soyunma odası karışık: {yıldız} yönetime kırgın"
 "{n}. haftada {puan} puan: Başkan {ad} için alarm"
şablon örnekleri (SEÇİM_SATHI):
 "{rakip}: '{vaadin} nerede?'"  ← tutulmayan vaat otomatik koz olur
```
Her manşetin `ton ∈ {-2..+2}` değeri var; **medya tonu** = son 8 manşetin hareketli ortalaması → taraftar hedefine küçük katsayı (±3) + basın toplantısı zorluğu.

### D3. Rakip başkan (canlı karakter)
Seçime son sezon girildiğinde rakip **konuşmaya başlar**: 2 tick'te bir demeç (inbox+medya). Demeçleri senin en zayıf hanenden otomatik üretilir (§Bible-16.1 pozisyon). Cevap hakkın var (§F) — cevaplamak riskli/ödüllü.

---

# E. KİŞİLİK & DİNAMİKLER (sayısal)

### E1. Kişilik tipleri (oyuncuya doğuşta atanır)
| Tip | Etki |
|---|---|
| **Profesyonel** | form volatilitesi ×0.6, gelişim ×1.2, moral olaylarından az etkilenir |
| **Hırslı** | büyük kulüp teklifinde ayrılma isteği ×1.5; başarısız sezonda moral −ekstra |
| **Sadık** | satış tekliflerine direnç, taraftar onu satarsan −ekstra |
| **Alevlenebilir** | kırmızı kart riski ×1.6, derbi performansı ±%8 |
| **Lider** | hiyerarşi puanı +20, takım moraline yayılım ×1.4 |
| **Kırılgan** | eleştiri/kulübe moral −ekstra, basıncaDayanıklılık düşük |

### E2. Hiyerarşi & sosyal grup
```
hiyerarşiPuanı = 0.4·overall + 0.3·kulüpteYıl×8 + 0.3·yaşFaktörü + liderBonus
katman: Lider(>75) / Etkili(60-75) / Çekirdek(40-60) / Genç(<40)
sosyalGrup: rastgele 3-5 kümeye ayrılır (aynı transfer dönemi + yaş yakınlığı)
```
**Moral yayılımı (her tick):** her oyuncu, grubunun ortalamasına %10 çekilir; Lider'in morali **tüm takıma** %5 yayılır. → Lideri mutsuz etmek = takımı zehirlemek; lideri satmak = kimya −ekstra 6.

### E3. Başkana güven (oyuncu-başına, 0-100)
Sözler (A4), yıldız satışları, maaş ödemelerinin aksaması (kasa<0 tick'leri maaş gecikmesi sayılır: tüm kadro −3 moral + başkana güven −5) bunu oynatır. Düşükse: sözleşme yenileme zorlaşır, medyaya sızıntı olasılığı artar.

---

# F. BASIN TOPLANTISI / DEMEÇ MOTORU

Haftada en fazla 1 demeç fırsatı (medya ekranı) + zorunlu anlar (derbi öncesi, kriz, rakip demecine cevap). Her fırsatta 4 ton:
| Ton | Anlık etki | Risk |
|---|---|---|
| **İddialı** ("Şampiyon olacağız") | taraftar +4, beklenti +1 kademe (geçici) | sonuç gelmezse taraftar −6, medya tonu −1 |
| **Sakin** | medya tonu +0.5 | etki küçük |
| **Savunmacı** | guven +2 | taraftar −1 ("heyecansız başkan") |
| **Ateşli** (hakem/rakip hedefli) | taraftar +6, kimya +2 | %30 PFDK cezası (para) + medya tonu −1, itibar −2 |
Demeçler **hafızalıdır**: iddialı demecin üstüne kötü seri gelirse manşet motoru bunu sana geri fırlatır ("'Şampiyon olacağız' demişti — 3 maçta 1 puan").

---

# G. TRANSFER PAZARLIĞI DANSI (3-4 tur)

```
TUR 1: Teklifini kur → [peşinat % | taksit | bonus (gol/maç) | gelecek satış payı %]
        efektifDeğer = peşinat + taksit×0.85 + bonus×0.5 + satışPayı×beklenenDeğer×0.6
TUR 2: Kulüp cevabı = ister(fiyat×rand(1.1,1.5)) — kabul / karşı teklif / kapı kapama(%15)
TUR 3: Menajer devreye girer: imza parası + maaş isteği; scout raporu kişilik uyarısı verir
TUR 4: İmza VEYA çekil. Her tur 1 gün yer (pencere takvimi baskısı).
```
- **Satış payı ve bonus** kasayı bugün korur, geleceği ipoteklendirir — mali stratejiyle birleşir.
- Rakip kulüp araya girme olasılığı: hedef yıldızsa %20 → fiyat +%15 (aciliyet draması).
- Satış tarafında ayna mekanik: gelen teklife karşı-teklif yapabilir, açık artırma tetikleyebilirsin (2+ talip varsa).

---

# H. MAÇ GÜNÜ DENEYİMİ (3 faz)

### H1. Öncesi (10 sn)
Kadro karşılaştırma kartı, tahmin yüzdeleri, TD'nin tek cümlelik planı, (derbiyse) atmosfer bandı: tribün uğultusu + "Ev avantajı bu maç +%7".
Başkan mini kararı (opsiyonel, maçta tek): **Prim vaadi** [Yok / Normal / Yüksek] → Yüksek: bu maç Moral çarpanı +0.03, kasadan galibiyette prim ödenir.

### H2. Canlı (30-60 sn, atlanabilir)
- Skor + dakika sayacı hızlandırılmış akar (90 dk = ~40 sn).
- **Highlight kartları** (5-9 adet): xG anlarından üretilir — "23' — {oyuncu} direkten döndü!" Ticker metni pozisyon şablon havuzundan.
- Momentum şeridi: iki takımın anlık baskısını gösteren yatay dalga (xG paylaşımından).
- Gol anı: 1sn ekran flaşı + skor büyür (juice).
- Sağ üst: "Sonucu geç ⏭" her an aktif.

### H3. Sonrası (10 sn)
Maç raporu kartı: skor, xG karşılaştırma ("2-1 kazandın ama xG 0.9-1.8 — şanslıydın" → dürüst geri bildirim FM hilesi), oyuncu notları (6.1-8.5), form/moral değişim özet ikonları. Rapor inbox'a da düşer.

---

# I. SEÇİM GECESİ (finalin finali)

Tam ekran sahne, 60-90 saniye:
```
1. AÇILIŞ: "Kongre üyeleri oy kullanıyor..." — dönem karnesi 5 kart halinde tek tek açılır
   (sportif → taraftar → mali → itibar → söz tutma; her kartta katkı puanı sayarak dolar)
2. RAKİP KONUŞMASI: rakip son kozunu oynar (en zayıf hanen + tutulmayan vaat) — çekicilik barı kırmızı dolar
3. SAYIM: oy yüzdesi 0'dan sayar; %35-65 arasında YAVAŞLAR (gerilim), son 3 puan tek tek düşer
   (sayım animasyonu gerçek oyOranı'na yakınsar ama ±4 sahte salınım yapar — dramatik belirsizlik)
4. SONUÇ: 
   KAZANDIN → konfeti, taraftar tezahürat bandı, "4. dönem" rozeti, yeni dönem kurulum akışı
   KAYBETTİN → sessiz sahne, boş makam odası görseli, "Muhalefet" modu açıklaması, 
               devir-teslim raporu (yeni başkana ne bıraktın — bu rapor 3 sezon sonra sana geri okunacak)
5. ANALİZ (opsiyonel): 5 bileşenin katkı dökümü — "Seni mali karne seçtirdi/kaybettirdi"
```
Muhalefet dönemi ekranı: 3 sezon **hızlı özet şeritleri** halinde akar (sezon başına 3 kart: yeni başkanın 1 büyük kararı + sonucu). Oyuncu izler, müdahale edemez; dönem sonunda "Aday ol" butonu.

---

# J. JUICE CHECKLIST (akıcılık hissinin somut listesi)

- [ ] Tüm sayılar count-up/count-down animasyonlu (300ms)
- [ ] Gauge değişimleri ok + renk izi bırakır (▲ yeşil 2sn)
- [ ] DEVAM butonu bekleyen aksiyon varsa titrer/rozetlenir
- [ ] Ekran geçişi 150ms, asla beyaz flaş yok
- [ ] Gol/şampiyonluk/seçim: ekran sarsıntısı 200ms + partikül
- [ ] Inbox mesajı düşerken üstten kayar + hafif "tık" sesi
- [ ] Kriz olayları tam ekran kart + kırmızı vinyet
- [ ] Boş durumlar yönlendirir ("Transfer listen boş — scout'a hedef ver")
- [ ] Uzun listelerde iskelet yükleme yok: her şey anlık (yerel state)
- [ ] Haptik/ses opsiyonel, ayarlardan kapatılabilir

---

# K. GÜNCELLENMİŞ MODÜL SIRASI (VS'de kurulum)

```
1. config + rng + eventBus
2. player(kişilik+gizli) → squad → dynamics(E)
3. takımGücü(3 katman) → maçMotoru(xG+highlight üretimi)
4. lig/fikstür → ekonomi → tesis → TD → transfer(pazarlık G)
5. gauge/atalet + beklenti + anlatıMotoru(D) + inbox üretici(A1)
6. olay motoru → vaat → basınToplantısı(F) → seçim motoru + seçimGecesi sahnesi(I)
7. UI: çerçeve(C0) → kokpit → inbox → maç günü(H) → kalan ekranlar
8. tickLoop(Continue mimarisi B) → hızlı simülasyon → kayıt/yükleme
9. juice geçişi (J checklist) → dengeleme testleri (§Bible-20)
```

Her modül tek dosya, `eventBus` üzerinden konuşur (`emit("MATCH_PLAYED", res)` → inbox, gauge, anlatı ayrı ayrı dinler). Bu mimari Godot'a taşırken de birebir çevrilir (sinyaller).
