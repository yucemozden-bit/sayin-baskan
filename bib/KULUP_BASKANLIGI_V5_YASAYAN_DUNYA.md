# KULÜP BAŞKANLIĞI — v5.0 "YAŞAYAN DÜNYA & POLİTİKA" KATMANI
## Yönetici Kadrosu · Canlı Lig · Harcama Limiti · Kampanya Mini-Oyunu · Sosyal Medya · Senaryolar · MVP Yol Haritası

> Katman zinciri: **v2 Bible** (motorlar) → **v3** (FM hileleri+UI) → **v4** (içerik+karakterler) → **v5 (bu)** = dünyayı *senden bağımsız yaşatan* sistemler + politik finali derinleştiren mekanikler + **kapsam kontrolü (MVP planı)**.
> Bu dosyanın sonundaki §12 MVP kesimi, hangi katmanın hangi sürümde kodlanacağını söyler — solo geliştirme için en kritik bölüm.

## İçindekiler
1. Yönetici kadrosu (staff layer) — TD'nin ötesi
2. Canlı lig ekosistemi (17 kulüp de yaşıyor)
3. Harcama limiti / FFP (Türk ligi realizmi)
4. Transfer piyasası ekonomisi (enflasyon + son gün draması)
5. Seçim kampanyası mini-fazı + münazara sahnesi
6. Sosyal medya simülasyonu
7. Oyuncuyla birebir görüşme (interaction)
8. Maç günü operasyonları + hava/zemin
9. Veri Merkezi ekranı (analytics)
10. Senaryo modları + Ironman
11. Vaat modülleri: Kadın Takımı & Uluslararası Genişleme (oynanır hale gelir)
12. **MVP → Tam → Deluxe kesim planı** (yol haritası)

---

# 1. YÖNETİCİ KADROSU (staff layer)

Başkanın gerçek işi doğru insanları işe almaktır. TD dışında 5 yönetici pozisyonu; her biri bir motoru **iyileştiren çarpan** + inbox'taki *sesin kalitesi*.

```js
Staff = { role, name, skill:40-95, wage(mn/sezon), trait }
```
| Rol | Etkilediği sistem | skill etkisi (örnek) | Kötü/boşsa |
|---|---|---|---|
| **Genel Menajer (GM)** | transfer pazarlığı | karşı taraf isteği ×(1.25−skill/400); pencere başına 1 "otomatik fırsat" bulur | pazarlıkları sen tek başına yürütürsün, fırsat akışı yok |
| **CFO** | ekonomi | faiz pazarlığı −(skill/2000); nakit projeksiyon isabeti; kötü CFO projeksiyonda ±%15 yanılır (!) | projeksiyonlar güvenilmez → kararlar sisli |
| **Akademi Direktörü** | genç üretim | potansiyel dağılımı +skill/20; altın çocuk şansı %10→%10+skill/10 | intake kalitesi taban |
| **Basın Sözcüsü** | medya | negatif manşet olasılığı ×(1−skill/250); kriz iletişiminde 1 "manşet söndürme" hakkı/ay | her kriz tam şiddetle vurur |
| **Stat/Operasyon Müdürü** | maç günü | doluluk +skill/25 puan; operasyon olayları (§8) riski ↓ | çatı arızası tipi olaylar ×1.5 |

- İşe alım havuzu itibara bağlı (yüksek itibar → yıldız yöneticiler başvurur). Maaşlar gider kalemine eklenir (`idari` satırı detaylanır).
- **Trait örnekleri:** "Eski bankacı" (CFO: yeniden yapılandırmada ekstra −0.02 faiz) · "Ağzı sıkı" (sızıntı olayları −%50) · "Egolu" (skill yüksek ama 2 yöneticiyle çatışma riski → inbox draması).
- Yöneticiler de **karakter** (v4-§2 kuralı): istifa edebilir, rakip kulüp kapabilir, seçim kaybedersen yeni başkan hepsini değiştirebilir (muhalefet dönüşünde kadroyu yeniden kurmak = gerçek maliyet).

---

# 2. CANLI LİG EKOSİSTEMİ

Şu ana kadar rakipler `strength` sayısıydı. v5'te her kulüp **hafif başkan simülasyonu** çalıştırır:

```js
AIClub = { strength, kasaSeviyesi:1-5, borcSeviyesi:1-5, baskanTipi, istikrar:0-100 }
baskanTipi ∈ { POPULIST, MUHASEBECI, INSAATCI(tesisçi), AVCI(genç toplar), DEV(para basar) }
```
**Sezon başı AI kararları (basit kural seti):**
- POPULIST: strength +6 ama borcSeviyesi+1; 2 sezon sonra %40 kriz (strength −10, yıldızlarını ucuza satar → **senin fırsat pencerene** düşer)
- MUHASEBECI: strength −2, borc −1; 3 sezonda istikrarlı +4
- DEV: her sezon +4, borç umursamaz (ligin şampiyonluk baskısı kaynağı)
**Tick içi:** AI kulüplerde de olay olur (TD kovma → 4 hafta strength −5; başkan istifası → yarı sezon kaos). Bunlar **haber olarak sana düşer** ve fırsattır: kriz kulübünün yıldızı satılıktır (GM fırsat mesajı).
**AI seçimleri:** her AI kulüp 3 sezonda bir kendi seçimini yaşar; başkan değişirse tip değişir → lig 10 sezonda gerçekten evrilir (dev çöker, avcı yükselir). Kokpit'teki anlatı kartı bazen ligin hikayesini anlatır: "Kartalspor'da kriz derinleşiyor".

Maliyet: kulüp başına 6 sayı + sezonda 1-2 kural kararı. Ucuz, etkisi büyük — ligin "kağıttan rakipler" hissi tamamen kaybolur.

---

# 3. HARCAMA LİMİTİ / FFP (Türk ligi realizmi)

Federasyon her sezon **harcama limiti** açıklar (gerçek TFF mekanizması):
```
limit = geçenSezonGeliri × 0.85 + kupaGelirleri  (transfer+maaş toplam tavanı)
```
- Limit aşımı seçenekleri: **taahhütname** (gelecek gelirden kesinti + guven −5) veya kadro tescil edilmez (yeni transferler oynayamaz — felaket).
- İtiraz/lobi aksiyonu: itibar>60 ise %40 şansla limit +%10 (inbox: federasyon görüşmesi).
- FFP, popülist stratejinin **ikinci freni** olur (birincisi seçim mali karnesi): parayı bulsan bile *harcayamayabilirsin*. Büyük kulüp başlangıcının (yüksek borç) zorluğu artık iki katmanlı.
- UI: Finans ekranına "Limit çubuğu" — sezonluk harcamanın limite oranı; %90'da sarı, aşımda kırmızı + tescil uyarısı.

---

# 4. TRANSFER PİYASASI EKONOMİSİ

- **Enflasyon:** her sezon `piyasaÇarpanı ×= 1+rand(0.06,0.14)` → 10. sezonda fiyatlar ~2-3×. Maaşlar da şişer; eski sözleşmeler *ucuzlar* (uzun sözleşme = enflasyon hedge'i — gerçek strateji).
- **Pencere kapanış günü (deadline day):** pencerenin son tick'i özel sahne — 3-5 hızlı teklif art arda düşer (AI kriz kulüpleri panik satar, DEV'ler panik alır), süreli kararlar (30sn sayaç hissi; gerçek zaman değil, "bu tur cevapla yoksa kaçar"). FM'in en sevilen kaos günü.
- **Bonservissiz piyasa:** sözleşmesi biten oyuncular havuza düşer; kumar alanı (ucuz ama formsuz/yaşlı ağırlıklı).
- **Kiralama:** `kirala(bedel=değer×0.1, maaşPayı%, satınAlmaOpsiyonu)` — genç geliştirme (gönder) ve kadro yaması (al) iki yönlü.

---

# 5. SEÇİM KAMPANYASI MİNİ-FAZI + MÜNAZARA

Seçimden önceki **son 3 tick** artık "kampanya fazı"dır (lig devam eder — kampanya *dikkat kaynağını* böler, tema bu):

**Kampanya kaynağı:** her kampanya tick'inde 2 **Kampanya Puanı (KP)**. Harcama seçenekleri:
| Aksiyon | KP | Etki |
|---|---|---|
| Delege yemeği | 1 | bir kurul üyesi loyalty +6 |
| Taraftar mitingi | 1 | taraftar +3, ama maç haftasıysa takım odağı −(Moral −0.01 o maç) |
| Basın turu | 1 | medya tonu +0.5, muhalif gazeteci nötrlenir 2 tick |
| Proje lansmanı (render+maket!) | 2 | vaat inandırıcılığı: gelecek dönem vaat umut bonusu ×1.3 |
| Negatif kampanya (rakibin geçmişi) | 2 | rakip çekicilik −8, AMA %35 geri teper (+5 rakibe, itibar −3) |

**Delege fraksiyonları:** kongre oyu artık 3 blok: `Tribün delegeleri (taraftar bileşeni) · İş dünyası (mali+itibar) · Eski yönetimler (guven+gelenek)`. Oy formülü (§Bible-16) aynı kalır ama bileşen→blok eşlemesiyle **nerede zayıfsan orayı kampanyayla yamarsın**. Kampanya toplam etkisi maks ±6 puan — karneyi yenemez, sadece kıl payını çevirir (tasarım ilkesi: 3 sezonluk emek > 3 haftalık şov).

**MÜNAZARA SAHNESİ (seçim gecesinden önceki akşam):** 4 soruluk seçmeli düello:
```
Her soru: moderatör konuyu açar (senin dönemin gerçek verisinden seçilir: en zayıf 2 + en güçlü 1 + rastgele 1)
→ 3 cevap tonu: Veriyle savun / Vizyonla büyüle / Rakibe saldır
→ sonuç = ton × konudaki gerçek karnen (zayıf konuda "veriyle savun" geri teper!)
→ her soru ±1.5 oy puanı; toplam ±6. Münazara atlanabilir (katılmamak: −2, "kaçtı" manşeti)
```
Münazara, oyuncunun kendi karnesiyle yüzleştiği sahnedir — final boss senin geçmiş kararların.

---

# 6. SOSYAL MEDYA SİMÜLASYONU

Medya (gazeteciler) = resmi anlatı; sosyal medya = **anlık duygu nabzı**. Kokpit'e mini "akış" widget'ı (3 kayan paylaşım) + Medya ekranına tam sekme.

```
sentiment(-100..+100) = 0.5·son2maçSonucu + 0.2·biletFiyatAlgısı + 0.2·transferHeyecanı + 0.1·gündem
```
- **Viral an üretici:** |etki|>eşik olaylar %25 şansla "trend" olur: gol klibi (+), tribün küfür pankartı (−), başkan gafı (Ateşli demeç %15 şansla kırpılıp viral −).
- Sentiment, taraftar gauge'ından **hızlı ve oynak** (atalet yok) — gauge'ın öncü göstergesi. Oyuncu öğrenir: sosyal medya çıldırdıysa 2 hafta sonra gauge düşecek → erken müdahale penceresi.
- Paylaşım şablonları data/social.json (×30): "adam gibi stoper alın yeter", "başkan {vaat} demişti, gülüyorum", "{genç} bu takımın geleceği 🔥"...
- **Tuzak:** sentiment'e göre yönetmek (her tepkiye boyun eğmek) uzun vadede mali karneyi bozar — oyun bunu vaaz vermeden, sonuçla öğretir.

---

# 7. OYUNCUYLA BİREBİR GÖRÜŞME

Ayda 1 hak (fazlası: "başkan soyunma odasına iniyor" — TD otoritesi −2/görüşme). Görüşme konuları: moral düşük yıldız · sözleşme · satış söylentisi · disiplin.
```
Akış: konu → 3 yaklaşım (Babacan / Profesyonel / Sert) × oyuncu kişiliği (v4-E1) = sonuç matrisi
örn. Kırılgan+Sert → moral −10, sızıntı riski; Hırslı+Profesyonel("projemin merkezisin"+söz) → +8 ama söz kaydedilir (v3-A4)
```
Sonuç asla kesin gösterilmez; oyuncu kişilik *cümlesinden* tahmin eder (scout raporu değerlenir). TD'nin oyuncuYonetimi yüksekse görüşme ihtiyacı zaten azalır — sistemler birbirini iter.

---

# 8. MAÇ GÜNÜ OPERASYONLARI + HAVA/ZEMİN

- **Hava:** kış haftalarında %20 yağış/kar → toplam gol beklentisi ×0.85, sakatlık riski ×1.2, doluluk −5 puan. Zemin kalitesi = stadyum seviyesi (sv<4 + yağış → "tarla" manşeti, teknik takımlar −%3 güç: DEV rakibi çamura gömmek küçük kulüp klasiği).
- **Operasyon kararları (sezonda 2-3 kez, Stat Müdürü mesajıyla):** deplasman taraftarı kotası (gelir + ama olay riski) · bilet promosyonu (kritik maçta doluluk garantisi, gelir −) · güvenlik seviyesi (olaylı derbi → seyircisiz ceza riskine karşı sigorta, maliyetli).
- Passolig-vari sistem olayı (v4-§8/5 karaborsa ile bağlı): elektronik bilet yatırımı yapıldıysa karaborsa olayları biter + doluluk verisi netleşir (CFO projeksiyonu iyileşir — sistemler zinciri).

---

# 9. VERİ MERKEZİ EKRANI (analytics)

FM'in Data Hub'ı. Sekmeler:
- **Takım:** xG-puan grafiği ("şanslı mıyız iyi miyiz" — puan>xPuan ise regresyon uyarısı: dürüst oyun), form ısı haritası, gol dakika dağılımı.
- **Ekonomi:** 3 sezonluk gelir kompozisyonu (alan grafiği), borç projeksiyonu (CFO skill'ine göre güven aralığı bandı — kötü CFO'da band geniş!).
- **Politika:** oy projeksiyonu trendi + bileşen katkı değişimi (hangi ay neyi kaybettin), sentiment vs gauge overlay.
Bu ekran hardcore oyuncunun evi; casual hiç açmasa da oyun oynanır (bilgi hiyerarşisi ilkesi).

---

# 10. SENARYO MODLARI + IRONMAN

**Senaryolar** (ana menüden, hazır başlangıç state'leri — data/scenarios.json):
1. **"Batan Dev"** — Büyük kulüp, borç ×2, transfer tahtası aktif, taraftar 40. Hedef: 2 dönemde borcu yarıla + 1 kupa.
2. **"Şehrin Yeni Takımı"** — Küçük, sıfır itibar, ama belediye desteği (tesis −%50). Hedef: 4 dönemde Büyük statüsü.
3. **"Son Dans"** — Efsane ama 34 yaş üstü kadro; 1 dönemde nesli yenile, kümeye düşme.
4. **"Seçim Arifesi"** — Oyuna seçime 1 sezon kala, %41 oyla başlarsın. Saf politika sprint'i (kısa oyun modu, 60-90dk — mobil dostu).
**Ironman:** tek kayıt, geri alma yok, sayım ekranında yeniden yükleme kapalı. Başarımların "hardcore" varyantları sadece burada açılır.

---

# 11. VAAT MODÜLLERİ OYNANIR HALE GELİR

- **P11 Kadın Takımı:** kur (kuruluş 3mn + sezonluk 1.5mn) → basit ayrı tablo (strength + sezon sonucu 1 satır). Getiri: marka +%4/sezon, yeni sponsor kategorisi, Toplum vaatleriyle (P10) sinerji, 3. sezondan itibaren kendi geliri. Erken sezonlar saf gider — vaat zorluk 2 olmasının sebebi maliyet cesareti.
- **P20 Uluslararası Genişleme:** pazar seç (Balkanlar/Orta Doğu/Orta Asya) → satış ofisi (2mn) → forma geliri +%X pazar büyüklüğüne göre; %20 şans yerel krizle ofis kapanır. Ayrıca o pazardan scout erişimi açılır (isim havuzu genişler) — ticari vaat sportif kanala sızar.

---

# 12. MVP → TAM → DELUXE KESİM PLANI (yol haritası)

> Solo geliştirici gerçeği: her şeyi aynı anda kurma. Her kesim **kendi başına eğlenceli** olmalı.

### MVP (oynanabilir çekirdek — hedef: "bir dönem oyna, seçimi hisset")
```
Bible: config, oyuncu(kişiliksiz), TakımGücü 3 katman, maç motoru(sigmoid fallback yeter),
       lig tablosu, ekonomi(temel gelir/gider/faiz), 5 gauge+atalet, beklenti, 
       eşik olayları(4 adet), vaat(20 kart, kontrol), seçim motoru
v3:    çerçeve+kokpit+inbox(şablonsuz düz metin)+DEVAM döngüsü, maç günü TEK faz(sonuç kartı)
v4/v5: YOK
Test:  T2/T3 senaryoları elle
```
### TAM (oyunun vaadi — "FM hissi")
```
+ xG/Poisson + highlight ticker + 3 fazlı maç günü
+ scout sisi, kişilikler, dynamics, sözler(3 katman)
+ tesisler tam, TD uyum, transfer pazarlık dansı
+ anlatı motoru + şablon kütüphaneleri(v4-7) + karakterler(kurul/gazeteci/taraftar grubu)
+ takvim/özel haftalar, genç takım günü, basın toplantısı
+ seçim gecesi sahnesi + rakip aday + kampanya fazı(§5, münazarasız)
+ stil rehberi + juice checklist + kayıt
```
### DELUXE (yaşayan dünya)
```
+ staff layer(§1) + canlı lig(§2) + FFP(§3) + deadline day(§4)
+ münazara(§5) + sosyal medya(§6) + birebir görüşme(§7)
+ operasyon/hava(§8) + veri merkezi(§9) + senaryolar/ironman(§10) + P11/P20 modülleri(§11)
+ uzun oyun/miras(v4-15) + başarımlar + ses
```
**Kural:** bir alt kesim %100 dengelenmeden üst kesime geçme. MVP'de seçim gecesi "kağıt üstünde" bile heyecanlıysa temel doğru demektir; değilse üstüne ne koyarsan koy kurtarmaz.

---

## Dört dosyanın VS talimatı (güncel)
> "Sırayla oku: Bible(v2)=motor, v3=UI/akış, v4=içerik/veri, v5=dünya/politika+**yol haritası**. §v5-12 MVP kesimiyle başla; MVP bitip T2/T3 testleri geçmeden TAM katmana modül ekleme. Veri dosyalarını v4-§14 şemasıyla üret."
