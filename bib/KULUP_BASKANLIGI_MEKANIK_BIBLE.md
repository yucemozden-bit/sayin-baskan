# KULÜP BAŞKANLIĞI — Tam Mekanik & İmplementasyon Bible'ı (v2.0)

> **Amaç:** Bu döküman geliştiriciye (veya LLM'e) hiçbir açık uç bırakmadan oyunu kurdurmak için yazıldı. Her parametrenin **aralığı + başlangıç + tick kuralı**, her formülün **kesin katsayısı**, her sistemin **pseudo-kodu** ve **işlenmiş örneği** var.
>
> **Para birimi:** her yerde **milyon TL (mn)**. Zaman birimi: **1 hafta = 1 tick = 1 lig maçı**.
>
> **Tasarım aksiyomu:** Kağıt üstü güç ≠ sahadaki güç · Kovulma yok, hesap seçimde görülür · Acı kararı dönem başında al · Beklenti göreceli.

## İçindekiler
1. Genel akış & zaman
2. Veri modeli (state şeması)
3. Sabitler (config bloğu)
4. Oyuncu modeli
5. Takım Gücü (3 katman) — tam algoritma
6. Maç motoru (xG + simülasyon + maç sonrası)
7. Lig, fikstür, sıralama
8. Ekonomi (gelir/gider/borç)
9. Tesisler (6 tesis, seviye/maliyet/etki)
10. Teknik direktör & teknik ekip
11. Transfer & altyapı & scout
12. Ana gauge'lar + atalet + hedef sürücüleri
13. Beklenti sistemi (göreceli başarı)
14. Olay/kriz motoru
15. Vaat sistemi (20 vaat tam tablo)
16. Seçim motoru (tam matematik + örnek)
17. Seçim sonrası (kovulma yok akışı)
18. Kaldıraçlar (oyuncu aksiyonları) + panel UI
19. Tick sırası (master loop pseudo)
20. Dengeleme & zorluk
21. Kayıt/yükleme şeması
22. İşlenmiş tam örnek (bir tick baştan sona)

---

## 1. Genel akış & zaman

```
Yeni Oyun
  → Kulüp seç (Küçük / Orta / Büyük)
  → Dönem başı: Teknik direktör seç + Transfer penceresi + Vaat seç (max 3)
  → SEZON DÖNGÜSÜ (×34 tick) { maç → güncelle → araya olay/karar }
  → Sezon sonu (özet, prim, sıralama)
  → 3 sezon tamamlanınca → SEÇİM
      → Kazandın → yeni dönem (transfer + vaat yenile)
      → Kaybettin → 1 dönem "muhalefet" (kulüp simüle edilir) → tekrar aday
  → Ana hedef: sürekliliği koru + kulübü seviye atlat (bkz. §20 zafer koşulu)
```

- **Sezon:** 34 lig maçı (18 takım, çift devre) + kupa + (kalifiye olduysa) Avrupa.
- **Dönem:** 3 sezon.
- **Transfer pencereleri:** sezon başı (tick 0) ve devre arası (tick 17). Sadece bu tick'lerde alım/satım.

---

## 2. Veri modeli (state şeması)

```js
const state = {
  meta: { tick: 0, season: 1, seasonWeek: 0, termYear: 1, termNo: 1, mode: "in_office" }, // in_office | opposition
  club: {
    id, name, tier,                    // "kucuk" | "orta" | "buyuk"
    reputation: 45,                    // İtibar G5, 0-100
    fanCount: 800000,                  // taraftar/üye sayısı
    brandValue: 40,                    // marka değeri (mn ölçek)
  },
  gauges: { guven:55, taraftar:60, mali:50, sportif:50, itibar:45 }, // G1..G5, 0-100
  economy: {
    kasa: 50, borc: 60, faizOrani: 0.32, borcVadeHafta: 156,        // mn TL, yıllık faiz
    ticketPrice: 1.0,                  // fiyat çarpanı (0.5 ucuz .. 2.0 pahalı)
    ledger: []                         // haftalık gelir/gider kaydı
  },
  facilities: { stadyum:4, antrenman:4, tibbi:3, akademi:3, scout:2, ticari:3 }, // 1-10
  stadiumCapacity: 32000,
  coach: { name, taktik:70, oyuncuYonetimi:65, otorite:68, yardimciEkip:60, wage:0.15, uyumHafta:0 },
  squad: [ /* Player[] bkz §4 */ ],
  academy: [ /* genç Player[] */ ],
  league: { teams:[ {id,name,strength,W,D,L,GF,GA,pts} ], fixtures:[], myPos:0 },
  season: { W:0, D:0, L:0, GF:0, GA:0, cupRun:"", europeRun:"" },
  promises: [ /* {id, difficulty, baselineSnapshot, kept:null} bkz §15 */ ],
  history: { seasons:[ /* sezon karneleri */ ] },
  rival: { positioning:"", attractiveness:0 },
  flags: { transferBan:false, budgetLock:false }
};
```

---

## 3. Sabitler (config bloğu)

```js
const CFG = {
  INERTIA: 0.20,                 // gauge hedefe yaklaşma hızı
  LEAGUE_TEAMS: 18,
  SEASON_WEEKS: 34,
  SEASON_PER_TERM: 3,
  BASE_GOALS_TOTAL: 2.6,         // maç başı beklenen toplam gol
  GOALS_SHARPNESS_K: 1.3,        // güç farkını gole çevirme keskinliği
  HOME_ADV: [0.03, 0.08],        // ev avantajı aralığı (stadyum+taraftara göre)
  LUCK: [0.92, 1.08],            // maç günü şans çarpanı
  INJURY_BASE: 0.03,             // maç başı oyuncu sakatlanma tabanı
  FITNESS_DROP_MATCH: 12,        // maç başına kondisyon düşüşü
  FITNESS_RECOVER_REST: 20,      // maçsız/dinlenme haftası toparlanma
  FORM_WIN:+8, FORM_DRAW:+2, FORM_LOSS:-8,
  MORALE_WIN:+4, MORALE_DRAW:0, MORALE_LOSS:-5,
  WAGE_TO_INCOME_TARGET: 0.55,   // sağlıklı maaş/gelir oranı
  MAX_PROMISES: 3,
};

const TIERS = {
  kucuk: { kasa:20, borc:15, kadroDeger:80,  reputation:25, fan:250000,  temelGuc:40,
           gauges:{guven:50,taraftar:45,mali:55,sportif:35,itibar:25}, beklenti:"kumede_kal", stad:24000 },
  orta:  { kasa:50, borc:60, kadroDeger:250, reputation:45, fan:800000,  temelGuc:55,
           gauges:{guven:55,taraftar:60,mali:50,sportif:50,itibar:45}, beklenti:"ust_yari",  stad:32000 },
  buyuk: { kasa:120,borc:400,kadroDeger:1200,reputation:75, fan:3500000, temelGuc:78,
           gauges:{guven:60,taraftar:75,mali:35,sportif:70,itibar:75}, beklenti:"sampiyonluk",stad:52000 },
};
```

> **Not (Türk futbolu realizmi):** büyük kulüp yüksek borçla başlar (`mali:35`), beklenti şampiyonluk → başarısızlık cezası ağır. Küçük kulüp mali olarak rahat ama gücü düşük.

---

## 4. Oyuncu modeli

```js
class Player {
  id; name; pos;         // "GK" | "DEF" | "MID" | "FWD"
  overall;               // 30-95 mevcut güç
  potential;             // overall..95 tavan
  age;                   // 16-38
  morale = 65;           // 0-100
  fitness = 100;         // kondisyon 0-100
  form = 50;             // 0-100
  injuryWeeks = 0;
  suspensionWeeks = 0;
  onIntlDuty = false;
  marketValue;           // §11 formülü
  wage;                  // mn/hafta değil → mn/sezon; haftalık = wage/52
  contractYears;
  isStar;                // overall >= 80
}
```

**Kadro büyüklüğü:** 22–28 oyuncu. Mevki dağılımı hedefi: GK 3, DEF 8, MID 8, FWD 6.

**Piyasa değeri formülü:**
```
marketValue = base(overall) × ageFactor × potFactor
base(ov) = 0.02 × 1.11^(ov-40)        // mn TL; ov=40→0.02, ov=80→~1.4, ov=90→~4.0
ageFactor = clamp(1.25 - |age-24|×0.035, 0.35, 1.25)   // zirve 24 yaş
potFactor = 1 + max(0, potential-overall)×0.03
```

**Maaş (sezonluk, mn):** `wage = marketValue × rand(0.28, 0.42)`

---

## 5. TAKIM GÜCÜ — tam algoritma (3 katman)

### 5.1 Katman 1 — TemelGüç (0–100)

```
TemelGüç = 0.44·KadroKalitesi
         + 0.14·TeknikEkip
         + 0.12·KimyaTecrube
         + 0.10·TaktikUyum
         + 0.08·TesisTabani
         + 0.07·Derinlik
         + 0.05·Altyapi
```

**KadroKalitesi:**
```js
POS_W = { GK:0.12, DEF:0.26, MID:0.30, FWD:0.32 };
function kadroKalitesi(squad){
  // her mevkinin en iyi N'lik ilk 11 katkısı (GK1, DEF4, MID4, FWD2 = 11)
  const need = { GK:1, DEF:4, MID:4, FWD:2 };
  let hatOrt = {};
  for (const p of ["GK","DEF","MID","FWD"]){
    const best = squad.filter(x=>x.pos===p && x.injuryWeeks===0 && x.suspensionWeeks===0)
                      .sort((a,b)=>b.overall-a.overall).slice(0, need[p]);
    hatOrt[p] = best.length ? avg(best.map(x=>x.overall)) : 30; // eksik hat = 30 cezası
  }
  const mevkiOrt = POS_W.GK*hatOrt.GK + POS_W.DEF*hatOrt.DEF + POS_W.MID*hatOrt.MID + POS_W.FWD*hatOrt.FWD;
  const enZayif = Math.min(hatOrt.GK,hatOrt.DEF,hatOrt.MID,hatOrt.FWD);
  const dengeCarpani = clamp(1 - (mevkiOrt - enZayif)/200, 0.85, 1.00);
  const stars = squad.filter(x=>x.overall>=80).sort((a,b)=>b.overall-a.overall).slice(0,3);
  const yildizBonus = clamp(sum(stars.map(s=>(s.overall-80)*0.15)), 0, 8);
  return clamp(mevkiOrt*dengeCarpani + yildizBonus, 0, 100);
}
```

**TeknikEkip:** `0.35·taktik + 0.30·oyuncuYonetimi + 0.20·otorite + 0.15·yardimciEkip` (hepsi 0-100).

**KimyaTecrube:** `0.50·kimya + 0.30·bigMatchExp + 0.20·(kaptanVar?100:60)`
- `kimya`: haftada `+1.5` artar (tavan 100); her transferde alınan oyuncu başına `-4`, TD değişiminde `-10`.
- `bigMatchExp`: kadrodaki 30+ yaş ve Avrupa oynamış oyuncu oranından türetilir (0-100).

**TaktikUyum:** `min(100, uyumHafta×6) × rolUygunlugu`
- `uyumHafta`: aynı TD+sistemle geçen hafta; TD değişimi veya sistem değişimi → `0`.
- `rolUygunlugu` (0.85-1.00): ilk 11'in tercih ettiği mevkide oynayanlar oranı.

**TesisTabani:** `50 + (antrenman-5)×5 + (tibbi-5)×3` → clamp 0-100.

**Derinlik:** `clamp( (kadroSayısı-18)×6 + yedekOrt/2 , 0, 100)`; `yedekOrt` = ilk 11 dışı en iyi 7 oyuncunun overall ort.

**Altyapi:** `akademi×10` (0-100 ölçek), maça küçük katkı; asıl etki §11 genç üretimde.

### 5.2 Katman 2 — EfektifGüç (çarpansal)

```
EfektifGüç = TemelGüç × Uygunluk × Moral × Form × Kondisyon
```
```js
function efektifGuc(state){
  const s = state.squad;
  // Uygunluk: kaliteyle ağırlıklı eksik oyuncu
  const tamKadro = sum(idealXI(s).map(p=>p.overall));
  const mevcut   = sum(idealXI(s).filter(p=>p.injuryWeeks===0&&p.suspensionWeeks===0&&!p.onIntlDuty).map(p=>p.overall));
  let uygunluk = clamp(mevcut/Math.max(tamKadro,1), 0.65, 1.00);
  uygunluk = uygunluk + (state.facilities.tibbi-5)*0.01;           // tıbbi yumuşatır
  const xi = idealXI(s);
  const moral = clamp(0.88 + (avg(xi.map(p=>p.morale))-60)/220, 0.88, 1.12);
  const form  = clamp(0.90 + (avg(xi.map(p=>p.form))-50)/200,   0.90, 1.10);
  const kond  = clamp(0.82 + (avg(xi.map(p=>p.fitness))-70)/150, 0.82, 1.05);
  return clamp(temelGuc(state)*clamp(uygunluk,0.65,1.0)*moral*form*kond, 0, 110);
}
```

### 5.3 Katman 3 — MaçGücü

```
MaçGücü = EfektifGüç × (1 + EvAvantajı ± Motivasyon) × Şans
```
```js
function macGucu(state, isHome, isDerby, relegationBattle){
  let mg = efektifGuc(state);
  if (isHome){
    const q = (state.facilities.stadyum/10)*0.5 + (state.gauges.taraftar/100)*0.5;
    mg *= 1 + lerp(CFG.HOME_ADV[0], CFG.HOME_ADV[1], q);
  }
  // Motivasyon: alt takıma derbi/küme hattında sürpriz gücü (uygulama: zayıf tarafa +%4)
  const motiv = (isDerby||relegationBattle) ? 0.04 : 0;
  mg *= 1 + (amIUnderdog(state)? motiv : 0);
  mg *= rand(CFG.LUCK[0], CFG.LUCK[1]);
  return mg;
}
```

---

## 6. Maç motoru (xG + simülasyon + maç sonrası)

```js
function simulateMatch(homeMG, awayMG){
  const k = CFG.GOALS_SHARPNESS_K, T = CFG.BASE_GOALS_TOTAL;
  const hShare = Math.pow(homeMG,k) / (Math.pow(homeMG,k)+Math.pow(awayMG,k));
  const xgH = T*hShare, xgA = T*(1-hShare);
  const gH = poisson(xgH), gA = poisson(xgA);
  return { gH, gA, xgH, xgA, result: gH>gA?"W":gH<gA?"L":"D" };
}
function poisson(lambda){ // Knuth
  let L=Math.exp(-lambda), k=0, p=1;
  do { k++; p*=Math.random(); } while(p>L);
  return k-1;
}
```

**Maç sonrası (oyuncu güncellemesi):**
```js
function postMatch(state, res){ // res: "W"/"D"/"L", myXI oynadıysa
  for (const p of state.squad){
    const played = idealXI(state).includes(p);
    if (played){
      p.fitness = clamp(p.fitness - CFG.FITNESS_DROP_MATCH, 0, 100);
      p.form    = clamp(p.form + (res==="W"?8:res==="D"?2:-8), 0, 100);
      p.morale  = clamp(p.morale + (res==="W"?4:res==="D"?0:-5), 0, 100);
      // sakatlık riski
      const risk = CFG.INJURY_BASE*(1-(state.facilities.tibbi*0.03))*(1+(100-p.fitness)/200);
      if (Math.random()<risk) p.injuryWeeks = 1+Math.floor(Math.random()*6*(1-state.facilities.tibbi*0.04));
    } else {
      p.fitness = clamp(p.fitness + CFG.FITNESS_RECOVER_REST, 0, 100);
    }
    if (p.injuryWeeks>0) p.injuryWeeks--;
    if (p.suspensionWeeks>0) p.suspensionWeeks--;
  }
}
```

**Kart/ceza:** her maç %8 ihtimalle bir oyuncuya kırmızı → `suspensionWeeks = 1..3`.

**Fallback (Poisson istemezsen) — kazanma olasılığı sigmoid:**
```
Δ = homeMG - awayMG
P(kazan) = 1 / (1 + 10^(-Δ/25));  P(beraberlik) = 0.28·exp(-(Δ/18)^2)
```

---

## 7. Lig, fikstür, sıralama

- 18 takım, çift devreli (34 maç). Rakip güçleri: kendi TemelGüç'üne göre `strength ∈ [temel-25, temel+25]` dağıtılır; 2-3 takım "dev" (büyük kulüpsen sana yakın), 3-4 takım "küme adayı".
- Rakip takımlar her hafta kendi aralarında `simulateMatch(rakipStr, rakipStr)` ile oynatılır (basit; oyuncu modeli yok, sadece `strength`).
- Puanlama: G3 / B1 / M0. Sıralama: puan → averaj → attığı gol.
- Sezon sonu: **Şampiyon (1.)**, Avrupa (1-4.), Küme (16-18.).

**Kupa:** tek eleme, 6 tur; her tur `simulateMatch`. **Avrupa:** kalifiye olduysa grup + eleme, ayrı prim.

---

## 8. Ekonomi

### 8.1 Haftalık gelir
```
bilet      = stadiumCapacity × dolulukOrani × ticketPrice × 0.00025   // mn/maç
   dolulukOrani = clamp(0.45 + taraftar/200 + sportif/300 - (ticketPrice-1)×0.25, 0.30, 1.00)
yayinPrimi = tierBase[tier] / 34                                       // sezona yayılmış
sponsor    = (gogus+kol+naming) × (1 + itibar/150) / 52                // §8.3
formaMagaza= fanCount × 0.0000004 × (1 + sportif/200)                  // mn/hafta
uyelik     = fanCount × 0.0000002
avrupaPrim = europeRun aktifse tur başına ek
```
`tierBase = { kucuk: 120, orta: 350, buyuk: 900 }` (sezonluk yayın, mn).

### 8.2 Haftalık gider
```
oyuncuMaas   = sum(squad.wage)/52
teknikEkip   = coach.wage/52 × 1.4          // TD + ekip
tesisBakim   = sum(facilities levels)×0.02
idari        = 0.15 + fanCount×0.00000005
amortisman   = aktifTransferAmortismani/52
faiz         = borc × faizOrani / 52
```

### 8.3 Sponsorluk
Sözleşmeler dönemlik. Teklif değeri:
```
gogusBase = tier × itibarFactor;  itibarFactor = 0.5 + itibar/100
   { kucuk: 8, orta: 30, buyuk: 120 } × itibarFactor  (sezonluk, mn)
kol = gogus×0.4;  naming = gogus×0.6 (stadyum sv≥7 gerekli)
```
Kabul → gelir; red → sonraki teklif için itibar beklenir.

### 8.4 Borç & yeniden yapılandırma
- Faiz her tick kasadan düşer. Kasa < 0 → **otomatik borçlanma** (kasa 0'a çekilir, borç artar, faiz +0.03 ceza).
- Yeniden yapılandırma aksiyonu: vade uzat (faiz +0.04) veya kısmi kapat (kasa→borç).
- **Mali Sağlık hedefi:**
```
maliHedef = clamp(50 + (kasa - borc×1.0)/ (tierScale) - max(0,(giderHafta-gelirHafta))×3, 0, 100)
tierScale = { kucuk:2, orta:6, buyuk:14 }
```

### 8.5 Konjonktür
Her sezon başı: `faizOrani += rand(-0.03, 0.06)` (enflasyon baskısı), maaşlar `×(1+rand(0.05,0.20))` (yenilemede). Döviz şoku olayı §14.

---

## 9. Tesisler (6 tesis · seviye 1-10)

**Yükseltme maliyeti:** `cost(L→L+1) = baseCost[tesis] × L^1.6` (mn). Süre: 4-12 hafta (seviyeye göre), bitene kadar etki gelmez.

| Tesis | baseCost | Etki (seviye L) |
|---|---|---|
| **Stadyum** | 12 | Kapasite = `12000 + L×4000`; EvAvantajı + maç-günü deneyim + naming (L≥7) |
| **Antrenman** | 6 | TesisTabani + gelişim hızı `+L×0.4 ov/sezon`; kondisyon toparlama `+L×0.5` |
| **Tıbbi** | 5 | Uygunluk `+(L-5)×0.01`; sakatlık süresi `×(1-L×0.04)`; risk `×(1-L×0.03)` |
| **Akademi** | 5 | Genç üretim: sezonda `floor(L/2)` genç, kalite `35+L×3±rand` |
| **Scout** | 4 | Transfer hedef isabeti + gizli overall görme + hedef kalite tavanı `55+L×4` |
| **Ticari** | 4 | Sponsor & forma geliri çarpanı `×(1+L×0.04)`; marka değeri artış hızı |

**Gelişim (antrenman + akademi):** her sezon her oyuncu için
```
if (age<24 && overall<potential) overall += min(potential-overall, rand(0, antrenman×0.4))
if (age>31) overall -= rand(0, (age-31)×0.6)   // yaşlanma
```

---

## 10. Teknik direktör & teknik ekip

**TD nitelikleri (0-100):** `taktik, oyuncuYonetimi, otorite, yardimciEkip`.
- **TeknikEkip skoru** §5.1 formülünden.
- **oyuncuYonetimi** → Moral çarpanını yukarı iter (mutsuz oyuncu daha az).
- **otorite** → yıldız isyanı ihtimalini düşürür.

**TD değişimi:** işten çıkarma tazminatı = `coach.wage × kalanYıl × 0.5`. Yeni TD gelince:
- `TaktikUyum → 0` (uyumHafta=0), `KimyaTecrube kimya −10`.
- İlk 6 hafta "uyum dönemi" → güç beklenenin altında (bu istenen risk).

**TD havuzu:** her seviye kulübe uygun aday listesi; itibar yüksekse dünya çapında TD ikna edilebilir (Vaat #9 "Teknik Ekip Sağlama" bununla bağlı).

---

## 11. Transfer, altyapı, scout

**Sadece pencere tick'lerinde (0 ve 17).**

**Alım:**
```
transferBedeli = marketValue × premium;  premium = rand(1.0, 1.6) × (satıcıİstekliliği)
maaşYükü = wage (piyasa formülü)
şart: kasa ≥ bedel × 0.3 (peşinat), transferBan=false, budgetLock=false
etki: kimya −4, KadroKalitesi anında güncellenir ama TaktikUyum düşer
```

**Satış:** gelen teklif `= marketValue × rand(0.8, 1.3)`; yıldız satışı → Taraftar `−`, Moral `−` (soyunma odası). Satış geliri kasaya + Mali Sağlık'a olumlu.

**Genç çıkışı (akademi):** sezon sonu `floor(akademi/2)` genç üretilir; en iyisi A takıma alınabilir (bedava, düşük maaş, yüksek potansiyel) → ucuz güç + satış kârı motoru.

**Scout:** scout seviyesi düşükse alınan oyuncunun gerçek overall'ı ±8 gürültüyle görünür ("kör alım riski"). Yüksek scout → net görüş + daha iyi hedefler.

---

## 12. Ana gauge'lar + atalet

Her tick sonunda 5 gauge, hesaplanan **hedefe** yaklaşır:
```js
for (g of ["guven","taraftar","mali","sportif","itibar"])
   state.gauges[g] += (hedef[g] - state.gauges[g]) * CFG.INERTIA;
```

**Hedef sürücüleri (her tick yeniden hesap):**
```
sportif_hedef  = ligSıraSkoru(0..100) + kupaBonus (ani, sönümlenir)
                 ligSıraSkoru = 100 × (LEAGUE_TEAMS - myPos) / (LEAGUE_TEAMS-1)
taraftar_hedef = 0.5·beklentiyeGöreSonuç + 0.2·biletFiyatMemnuniyeti
                 + 0.15·yıldızVarlığı + 0.15·vaatUmudu − boykotCezası
mali_hedef     = §8.4
itibar_hedef   = yavaş: itibar += (kupa/Avrupa/şampiyonluk olaylarından) − (küme/skandal)
                 (İtibar ataleti daha düşük: INERTIA_ITIBAR=0.08 → yavaş seviye)
guven_hedef    = 0.4·sportif + 0.3·mali + 0.2·taraftar + 0.1·vaatİlerleme
```

---

## 13. Beklenti sistemi (göreceli başarı)

`beklentiyeGöreSonuç` sezon içi sürekli, hedef sıraya göre:
```
hedefSıra = { kumede_kal: 15, ust_yari: 8, sampiyonluk: 1 }[club.beklenti]
delta = hedefSıra - myPos                     // + ise beklentiyi aşıyorsun
beklentiyeGöreSonuç = clamp(50 + delta×6, 0, 100)
```
→ Küçük kulüpte 12. olmak (delta=+3) taraftarı sevindirir; büyük kulüpte 4. olmak (delta=−3) küstürür. **Beklenti dönem sonunda başarıya göre yükselir** (küçük kulüp üst yarıya oynadıysa ertesi dönem beklenti "ust_yari"ya çıkar → merdiven).

---

## 14. Olay/kriz motoru

Her tick sonunda kontrol edilir. **Eşik olayları** (deterministik) + **rastgele olaylar** (olasılıksal, oyuncuya seçim sunar).

### 14.1 Eşik olayları
| Koşul | Olay | Etki |
|---|---|---|
| guven < 20 | Kongre olağanüstü çağrı | `budgetLock=true` 4 tick; medya baskısı taraftar −5 |
| taraftar < 25 | Boykot | 3 tick bilet geliri ×0.6; guven −4/tick |
| mali < 15 | Transfer tahtası | `transferBan=true` 2 pencere |
| küme düştü | Domino | itibar −20, yayınPrimi ×0.5, tüm yıldızlar transfer talep eder, taraftar −25 |
| şampiyon | Zafer | itibar +15 (ani), taraftar +20, prim + sponsor değeri +%15 |
| kupa kazandı | itibar +8, taraftar +10, prim | |
| yıldız morale<30 | Sızıntı | taraftar −6, o oyuncu transfer talebi, otorite<70 ise soyunma odası moral −5 |
| Uygunluk<0.75 (2 tick) | Sakatlık dalgası | form/moral kısır döngü uyarısı; tıbbi tesis freni |

### 14.2 Rastgele olaylar (örnek havuz, tick başına ~%12)
```
- "Döviz şoku": faizOrani +0.05, borc mn +%8  [Kabul et / Yeniden yapılandır(faiz+0.04)]
- "Yıldıza dev teklif": [Sat (kasa++, taraftar−) / Reddet (oyuncu morali++, taraftar+)]
- "Taraftar grubu talebi (kombine indir)": [İndir (taraftar+, gelir−) / Reddet (taraftar−)]
- "Genç yetenek patladı": akademiden overall+5 sıçrama
- "Hakem/skandal": itibar −5, medya tonu sertleşir
- "Sponsor fırsatı": +%20 gelir ama isim hakkı çatışması (taraftar −3)
- "Yerel yönetim stadyum arsası": stadyum yükseltme %40 indirim (bu sezon)
```
Her olay 2-3 seçenekli; seçim gauge'lara ve ekonomiye yansır.

---

## 15. Vaat sistemi (20 vaat — ekrandaki tam liste)

**Kural:** dönem başında **max 3 vaat**. Vaat *anında* umut bonusu; dönem *sonunda* kontrol.

```
UmutBonusu(anlık, taraftar'a) = Zorluk × 4      // sezon boyu %20/tick söner
Tutuldu:   sozTutma += Zorluk×3 ; taraftar += Zorluk×5 ; guven += Zorluk×3
Tutulmadı: sozTutma −= Zorluk×5 ; taraftar −= Zorluk×6 ; guven −= Zorluk×4 ; rival.attr += Zorluk×4
```
`baselineSnapshot`: vaat seçilirken ilgili metrik kaydedilir (ör. borç, kadro değeri) → dönem sonu karşılaştırma.

| id | Vaat | Ölçülen | Başarı koşulu (dönem sonu, 3 sezon) | Zorluk |
|---|---|---|---|---|
| P01 | Şampiyonluk Hedefi | sportif | ≥1 lig şampiyonluğu | **5** |
| P02 | Borçsuz Kulüp | borc | borc ≤ baseline×0.5 | 4 |
| P03 | Stadyum Yatırımı | stadyum | stadyum +2 sv | 3 |
| P04 | Kadro Değeri +40% | kadroDeger | toplam piyasa +%40 vs baseline | 4 |
| P05 | Altyapı Güçlendirilmesi | akademi | akademi +2 sv & ≥2 genç A takımda | 3 |
| P06 | Antrenman Merkezi | antrenman | antrenman +2 sv | 3 |
| P07 | Taraftar Deneyimi | stadyum kalite | maç-günü deneyim skoru +%25 | 2 |
| P08 | Tıbbi Ekip Geliştirme | tibbi | tibbi +2 sv | 2 |
| P09 | Teknik Ekip Sağlama | coach | TeknikEkip skoru ≥ 75 | 3 |
| P10 | Toplum Programları | marka | ≥3 sosyal proje/sezon | 1 |
| P11 | Kadın Takımı Kurma | marka/tesis | kadın takımı kurulmuş+ligde | 2 |
| P12 | Tabandan Yüksele | akademi | alt yaş yatırımı + 1 A takım çıkışı | 2 |
| P13 | İzci Ağı Genişletme | scout | scout ≥ 3 sv (bölge) | 2 |
| P14 | Marka Değerini Artır | brandValue | marka değeri +%30 | 3 |
| P15 | Maaş Disiplini | maaş/gelir | maaş/gelir ≤ %55 (sezon ort) | 3 |
| P16 | Ticari İşler Geliştir | ticari gelir | ticari gelir +%25 | 2 |
| P17 | Maç Altyapısı (teknoloji) | stadyum tekno | teknoloji upgrade tamam | 1 |
| P18 | Çevre Dostu Kulüp | marka/itibar | yeşil sertifika tamam | 1 |
| P19 | Kulüp Müzesi | itibar | müze açık | 1 |
| P20 | Uluslararası Genişleme | marka/itibar | ≥1 şube/iştirak aktif | 4 |

> **Strateji dengesi:** Zorluk 1-2 = güvenli seçmen avı (kolay, küçük etki). Zorluk 4-5 = yüksek risk/getiri. 3 vaatin de Zorluk 5 seçilmesi büyük ön patlama ama seçimde felaket riski. 0 vaat = umut bonusu yok ama sıfır ceza (temkinli oyun).

---

## 16. Seçim motoru (dönem sonu, tam matematik)

```js
function eleksiyon(state){
  const H = state.history.seasons.slice(-3); // 3 sezon
  const W = [0.20, 0.30, 0.50];              // son sezon ağırlıklı
  // 1) Sportif karne (sıralama + kupalar), sezon-ağırlıklı
  const sportif = wsum(H.map(s=> ligSkor(s.pos)+kupaSkor(s)), W);      // 0-100
  // 2) Taraftar hissiyatı = şu anki gauge
  const taraftar = state.gauges.taraftar;
  // 3) Mali karne = dönem başı vs sonu FARKI (borç azaldı mı)
  const mali = clamp(50 + (baslangicBorc - state.economy.borc)/tierScale + (state.gauges.mali-50)*0.5, 0, 100);
  // 4) İtibar
  const itibar = state.gauges.itibar;
  // 5) Söz tutma
  const soz = clamp(50 + state.sozTutmaBirikim, 0, 100);
  // Rakip çekiciliği
  const rival = rakipCekiciligi(state); // §16.1, 0-100
  const oyOrani = clamp(
     0.30*sportif + 0.20*taraftar + 0.20*mali + 0.15*itibar + 0.15*soz - rival*0.5
  , 0, 100) / 100;
  return { oyOrani, kazandi: oyOrani > 0.50, breakdown:{sportif,taraftar,mali,itibar,soz,rival} };
}
ligSkor(pos) = 100*(18-pos)/17;
kupaSkor(s)  = (s.champion?40:0)+(s.cup?20:0)+(s.europeWin?30:0)+(s.europeQual?10:0); // capped +50 katkı
```

### 16.1 Rakip çekiciliği
```
zayifHane = 100 - min(mali, taraftar, sportif)          // en zayıf yanın
tutulmayanCeza = tutulmayanVaatSayısı × 8
if (borc yüksek) pozisyon="mali_kurtarici", bonus + zayifHane odaklı
if (kupasız 3 sezon) pozisyon="sampiyonluk_vaadi"
if (biletFiyat>1.3) pozisyon="taraftar_dostu"
rakipCekiciligi = clamp(0.4×zayifHane + 0.3×tutulmayanCeza + 0.3×pozisyonGücü, 0, 100)
```

### 16.2 İşlenmiş örnek
```
3 sezon lig: 5. , 3. , 2.  → ligSkor: 76.5, 88.2, 94.1
kupa: son sezon kupa (+20) → sportif = 0.2×76.5+0.3×88.2+0.5×(94.1+20) = 15.3+26.5+57.0 = 98.8→cap 100
taraftar (gauge) = 68
mali: başlangıç borç 60 → şu an 45, tierScale=6 → 50+(60-45)/6+(52-50)×0.5 ≈ 53.5
itibar = 58 ; soz: 2 tuttun(zorluk 4,3) 1 tutmadın(zorluk3) → +21-15=+6 → 56
rival: kupasız değil, borç orta, fiyat normal → ~35
oyOrani = 0.30×100+0.20×68+0.20×53.5+0.15×58+0.15×56 − 35×0.5
        = 30+13.6+10.7+8.7+8.4 − 17.5 = 53.9 → %53.9 → KAZANDI
```

---

## 17. Seçim sonrası (kovulma yok)

**Kazandın:** `termNo++`, transfer penceresi + yeni vaat seçimi + beklenti güncellenir.

**Kaybettin:** `mode="opposition"`, 1 dönem (3 sezon) kulüp **AI tarafından simüle edilir**:
```
AI başkan: rastgele-popülist → yıldız alır (borç +%X), fiyat düşürür (taraftar+), TD değiştirir
→ 1 dönem sonra kulüp değişmiş halde sana geri döner (enkazı devral):
   miras kalan borç, mutsuz kadro, senin tutmadığın sözlerin izi (taraftar hafızası)
→ tekrar aday olursun.
Üst üste 2 seçim kaybı → kariyer kapanır (yeni kulüple baştan opsiyonu).
```

---

## 18. Kaldıraçlar (oyuncu aksiyonları) + panel UI

| Panel | Aksiyon | Sınır |
|---|---|---|
| **Finans** | Borç yeniden yapılandır, bütçe planla | budgetLock varsa kilitli |
| **Transfer** | Al / Sat / Sözleşme yenile | sadece pencere |
| **Tesisler** | 6 tesisi yükselt | kasa + süre |
| **Teknik Direktör** | Ata / kov / sistem seç | tazminat |
| **Bilet & Fiyat** | ticketPrice 0.5–2.0 | taraftar tepkisi |
| **Kongre/Lobicilik** | Seçim öncesi guven kampanyası | dönem sonu 3 tick |
| **Taraftar/Demeç** | Söz ver / açıklama yap | vaat sistemi |

**Ekran akışı:** Ana Dashboard (5 gauge + TemelGüç + sıra + kasa/borç + sonraki maç) → panele gir/çık → "Sonraki Maç" ile tick ilerlet. Vaat ekranı (paylaştığın tasarım) dönem başında açılır.

---

## 19. Tick sırası (master loop)

```js
function onTick(state){
  // 1. Sezon başıysa: konjonktür, gelişim/yaşlanma, transfer penceresi flag, beklenti güncelle
  if (state.meta.seasonWeek===0) startSeason(state);
  // 2. Ekonomi: gelir - gider, faiz, kasa/borç → mali hedef
  applyEconomy(state);
  // 3. Tesis inşaat ilerlet; biten tesis etkisini aç
  advanceFacilities(state);
  // 4. Milli takım/sakatlık/ceza güncelle → Uygunluk
  // 5. TemelGüç → EfektifGüç → MaçGücü (bu hafta maç varsa)
  if (hasMatch(state)){
    const me = macGucu(state, isHome, isDerby, releg);
    const opp = macGucu(rakip,...);
    const res = simulateMatch(isHome?me:opp, isHome?opp:me);
    postMatch(state, myResult(res));
    updateLeagueTable(state, res);
  } else { restRecovery(state); }
  // 6. Sonuç → sportif/taraftar/itibar hedefleri
  computeGaugeTargets(state);
  // 7. Vaat umudu sönümle
  decayPromiseHope(state);
  // 8. Atalet: tüm gauge'lar hedefe yaklaş
  applyInertia(state);
  // 9. Eşik olayları + rastgele olay
  checkEvents(state);
  // 10. seasonWeek++; sezon bittiyse endSeason(); dönem bittiyse eleksiyon()
  advanceCalendar(state);
}
```

---

## 20. Dengeleme & zorluk & zafer koşulu

- **Zorluk seviyeleri:** rakip güç dağılımı, faiz tabanı, şans genişliği, olay sıklığı ile ayarlanır.
  - Kolay: faiz −0.05, şans ±0.05, olay %8.
  - Zor: faiz +0.05, şans ±0.10, olay %15, beklenti daha sert.
- **Zafer koşulu (opsiyonel hedef):** kulübü seviye atlatmak — Küçük → Orta → Büyük. Seviye atlama koşulu: 2 dönem üst üste seçilmek + itibar ve mali eşiği aşmak. Böylece "koltukta kal" + "kulübü büyüt" iki katmanlı hedef.
- **Denge testleri:** popülist oyun (fiyat düşür + yıldız al) 1-2 sezon oyu yükseltmeli ama 3. sezon mali çöküşle cezalanmalı → seçimi kaybettirmeli. Sağduyulu oyun (borç azalt) ilk sezon taraftarı üzmeli ama son sezon ağırlığıyla seçimi kazandırabilmeli.

---

## 21. Kayıt/yükleme

Tüm `state` JSON serileştirilebilir. `saveGame() → JSON.stringify(state)`, `loadGame(json) → Object.assign(state, JSON.parse(json))`. Versiyon alanı ekle (`state.meta.version`) ki şema değişince migrate edilebilsin. (Not: tarayıcı `localStorage` kullanma; dosya/IndexedDB veya Godot'ta `FileAccess`.)

---

## 22. İşlenmiş tam örnek (tek tick, Orta kulüp, sezon 2 hafta 9)

```
Girdi: TemelGüç=57, ilk11 ort morale=62 form=54 fitness=71, 1 yıldız sakat (ov 84)
Uygunluk = (tamXI 858 - mevcut 774)/858 = 0.902 + (tibbi4-5)×0.01 = 0.892 → clamp 0.892
Moral = 0.88+(62-60)/220 = 0.889
Form  = 0.90+(54-50)/200 = 0.920
Kond  = 0.82+(71-70)/150 = 0.827
EfektifGüç = 57 × 0.892 × 0.889 × 0.920 × 0.827 = 34.4  ← "kadro iyi ama saha zayıf"
Maç: ev sahibi, stadyum6/taraftar63 → EvAvantajı = lerp(.03,.08, .55)=.0575
MaçGücü(ben) = 34.4 × 1.0575 × şans(1.02) = 37.1
Rakip MaçGücü = 33.0
hShare = 37.1^1.3/(37.1^1.3+33^1.3) = 0.537 → xgH=1.40, xgA=1.20
Poisson → gH=2, gA=1 → GALİBİYET
postMatch: oynayanlar form+8, morale+4, fitness-12; %risk ile sakatlık
Gauge hedefleri: sportif↑ (sıra iyileşti), taraftar↑ (beklenti aşıldı)
Atalet: her gauge hedefe %20 yaklaştı. Olay kontrolü: eşik yok, rastgele %12 → tetiklenmedi.
Takvim: seasonWeek 9→10.
```

---

### Bu döküman geliştiriciye ne veriyor
Tüm sistemler birbirine bağlı, sabitler kesin, formüller kopyala-çalıştır seviyesinde. VS'de "bu spec'e göre modülleri kur" dediğinde sıralama şu olmalı:
`config → player/squad → takımGücü → maçMotoru → lig → ekonomi → tesis/TD/transfer → gauge/atalet → olaylar → vaat → seçim → UI paneller → tickLoop → kayıt`.

Açık bıraktığım tek şey **isim/görsel içerik** (takım isimleri, oyuncu isim havuzu, TD havuzu) — bunları istersen ayrı bir veri dosyası (`data.json`) olarak üretebilirim.
