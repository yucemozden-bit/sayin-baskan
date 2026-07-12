/* ===================== YENİ KARİYER SETUP EKRANI ===================== */
const setupForm = document.getElementById("setupForm");
const characterCards = document.querySelectorAll(".character-card");
const birthCountry = document.getElementById("birthCountry");
const birthCity = document.getElementById("birthCity");
const teamGrid = document.getElementById("teamGrid");
const btnConfirmTeam = document.getElementById("btnConfirmTeam");
let selectedCharacter = "strategist";
let selectedTeam = null;
// expose careerProfile as a global so other scripts can inspect/modify it
window.careerProfile = window.careerProfile || {};
const careerProfile = window.careerProfile;

const defaultCareerProfile = {
  presidentName: "Yücem Özden",
  birthCountry: "turkey",
  birthCity: "İstanbul",
  birthDate: "1991-06-15",
  character: "strategist"
};

const cityMap = {
  turkey: ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya"]
};

const clubData = {
  turkey: [
    { id: "beykozspor", name: "Beykozspor", description: "Boğaz kıyısındaki hırslı kulüp, disiplinli orta saha karakteri.", badge: "BY", logo: "BY" },
    { id: "ankaray", name: "Ankaray SK", description: "Başkent ekibi, savaşçı ruhu ve güçlü savunmasıyla biliniyor.", badge: "AY", logo: "AY" },
    { id: "maviyildiz", name: "Mavi Yıldız", description: "Süratli hücum hattı ve parlak gençlerden oluşan kadro.", badge: "MY", logo: "MY" },
    { id: "kuzeysehirk", name: "Kuzeyşehir FK", description: "Soğukkanlı oyun planı, kontra ataklarla rakipleri zorlar.", badge: "KS", logo: "KS" },
    { id: "bogazkale", name: "Boğazkale", description: "Tarihi statta oynayan, güçlü taraftar desteğiyle öne çıkıyor.", badge: "BK", logo: "BK" },
    { id: "denizfener", name: "Denizfeneri", description: "Hızlı açık futbol, kanat varyasyonları ve dinamik hücum.", badge: "DF", logo: "DF" },
    { id: "yedigoller", name: "Yedigöller", description: "Doğayla iç içe kulüp, altyapıdan gelen yabancı yetenekler.", badge: "YG", logo: "YG" },
    { id: "simsekkar", name: "Şimşekkar", description: "Ani baskı, hızlı pres ve akıcı geçiş oyunu.", badge: "ŞK", logo: "ŞK" },
    { id: "umutspor", name: "Umutspor", description: "Yeniden doğuş hikayesi, enerjik oyun anlayışı sunuyor.", badge: "US", logo: "US" },
    { id: "altinsehir", name: "Altınşehir FK", description: "Modern yönetim, play-off hedefli finansal güç.", badge: "AF", logo: "AF" },
    { id: "poyrazspor", name: "Poyrazspor", description: "Rüzgâr gibi hızlı ataklar ve sert orta saha mücadelesi.", badge: "PS", logo: "PS" },
    { id: "kartalova", name: "Kartalova", description: "Yüksekten gelen hücumlar ve hava toplarında tehdit.", badge: "KV", logo: "KV" },
    { id: "efsane", name: "Efsane SK", description: "Köklü kulüp mirası, şampiyonluk hikayesini canlandırıyor.", badge: "ES", logo: "ES" },
    { id: "izospora", name: "İzospora", description: "Ege kıyısında teknik futbol ve hızlı pas oyunu.", badge: "İS", logo: "İS" },
    { id: "ozgurluk", name: "Özgürlükspor", description: "Bağımsız oyun aklı ve dinamik taktiklerle sahada.", badge: "ÖS", logo: "ÖS" },
    { id: "kiyitakimi", name: "Kıyı Takımı", description: "Sahil kasabasında yetişen yetenekler, tempolu oyun odaklı.", badge: "KT", logo: "KT" },
    { id: "bozkirspor", name: "Bozkırspor", description: "Zorlu savunma, dayanıklı kadro ve kıyasıya mücadele.", badge: "BS", logo: "BS" },
    { id: "ayyildiz", name: "Ay-Yıldız", description: "Milli renklerin coşkusu, güçlü taraftar atmosferi.", badge: "AY", logo: "AY" },
    { id: "sehiraktas", name: "Şehir Aktaş", description: "Şehir kulübü disiplini, kararlı ve fiziksel bir oyun.", badge: "SA", logo: "SA" },
    { id: "kervansaray", name: "Kervansaray FK", description: "Tarihsel miras ve sağlam ortaklıklarla sezonu taşıyor.", badge: "KK", logo: "KK" }
  ]
};

characterCards.forEach(card => {
  card.addEventListener("click", () => {
    characterCards.forEach(item => item.classList.remove("active"));
    card.classList.add("active");
    selectedCharacter = card.dataset.character;
  });
});

if (birthCountry) {
  birthCountry.addEventListener("change", () => {
    const selectedCountry = birthCountry.value;
    birthCity.innerHTML = "";
    if (!selectedCountry || !cityMap[selectedCountry]) {
      birthCity.innerHTML = '<option value="">Önce ülke seç</option>';
      birthCity.disabled = true;
      return;
    }

    birthCity.disabled = false;
    birthCity.innerHTML = '<option value="">Şehir seç</option>' +
      cityMap[selectedCountry].map(city => `<option value="${city}">${city}</option>`).join("");
  });
}

function applyDefaultProfile() {
  const presidentNameInput = document.getElementById("presidentName");
  if (presidentNameInput) {
    presidentNameInput.value = defaultCareerProfile.presidentName;
  }

  if (birthCountry) {
    birthCountry.value = defaultCareerProfile.birthCountry;
    const cities = cityMap[defaultCareerProfile.birthCountry] || [];
    birthCity.disabled = false;
    birthCity.innerHTML = '<option value="">Şehir seç</option>' +
      cities.map(city => `<option value="${city}">${city}</option>`).join("");
    birthCity.value = defaultCareerProfile.birthCity;
  }

  const birthDateInput = document.getElementById("birthDate");
  if (birthDateInput) {
    birthDateInput.value = defaultCareerProfile.birthDate;
  }

  selectedCharacter = defaultCareerProfile.character;
  characterCards.forEach(card => card.classList.toggle("active", card.dataset.character === selectedCharacter));

  Object.assign(careerProfile, {
    presidentName: defaultCareerProfile.presidentName,
    birthCountry: defaultCareerProfile.birthCountry,
    birthCity: defaultCareerProfile.birthCity,
    birthDate: defaultCareerProfile.birthDate,
    character: defaultCareerProfile.character,
    createdAt: new Date().toISOString()
  });
}

function startDefaultCareer() {
  applyDefaultProfile();
  renderTeams();
  go("team");
}

function renderTeams() {
  const country = "turkey";
  teamGrid.innerHTML = clubData[country].map(club => `
    <button type="button" class="team-card" data-team="${club.id}">
      <div class="team-logo">${club.logo || club.badge}</div>
      <div class="team-info">
        <strong>${club.name}</strong>
        <span>${club.description}</span>
      </div>
    </button>
  `).join("");

  teamGrid.querySelectorAll(".team-card").forEach(card => {
    card.addEventListener("click", () => {
      teamGrid.querySelectorAll(".team-card").forEach(item => item.classList.remove("selected"));
      card.classList.add("selected");
      selectedTeam = card.dataset.team;
      btnConfirmTeam.disabled = false;
    });
  });

  btnConfirmTeam.disabled = true;
}

applyDefaultProfile();
renderTeams();

if (btnConfirmTeam) {
  btnConfirmTeam.addEventListener("click", () => {
    if (!selectedTeam) return;
    careerProfile.team = selectedTeam;
    console.log("Takım seçildi:", selectedTeam, careerProfile);
    go("election");
  });
}

if (setupForm) {
  setupForm.addEventListener("submit", event => {
    event.preventDefault();

    const presidentName = document.getElementById("presidentName").value.trim();
    const birthCountryValue = document.getElementById("birthCountry").value;
    const birthCityValue = document.getElementById("birthCity").value;
    const birthDate = document.getElementById("birthDate").value;

    if (!presidentName || !birthCountryValue || !birthCityValue || !birthDate) {
      return;
    }

    Object.assign(careerProfile, {
      presidentName,
      birthCountry: birthCountryValue,
      birthCity: birthCityValue,
      birthDate,
      character: selectedCharacter,
      createdAt: new Date().toISOString()
    });

    console.log("Yeni kariyer profili:", careerProfile);
    renderTeams();
    go("team");
  });
}

/* ===================== SEÇİM VAATLERI EKRANI ===================== */
const vowData = [
  { id: "promotion", name: "Şampiyonluk Hedefi", desc: "Gelecek sezonda şampiyonluğu vaat et.", difficulty:5 },
  { id: "debt-free", name: "Borçsuz Kulüp", desc: "Finansal stabilite ve borç yönetimi vaat et.", difficulty:4 },
  { id: "stadium", name: "Stadyum Yatırımı", desc: "Tesisler için büyük yatırım yapacağını vaat et.", difficulty:3 },
  { id: "squad-boost", name: "Kadro Değeri +40%", desc: "Takım gücünü önemli ölçüde artıracağını vaat et.", difficulty:4 },
  { id: "youth-academy", name: "Altyapı Güçlendirilmesi", desc: "Genç yeteneklere yatırım ve akademi geliştirmesi vaat et.", difficulty:3 },
  { id: "training-center", name: "Antrenman Merkezi", desc: "Yeni ve modern antrenman tesisleri kuracağını vaat et.", difficulty:3 },
  { id: "fan-experience", name: "Taraftar Deneyimi", desc: "Stadyum olanakları ve taraftar hizmetlerini iyileştir.", difficulty:2 },
  { id: "medical-team", name: "Tıbbi Ekip Geliştirme", desc: "Sağlık ve fizyoterapist hizmetlerini güçlendir.", difficulty:2 },
  { id: "coaching-staff", name: "Teknik Ekip Sağlama", desc: "Dünya standartlarında antrenörler getir.", difficulty:3 },
  { id: "community-projects", name: "Toplum Programları", desc: "Sosyal sorumluluk projeleri yürüt.", difficulty:1 },
  { id: "women-team", name: "Kadın Takımı Kurma", desc: "Profesyonel kadın futbol takımı kur.", difficulty:2 },
  { id: "grassroots", name: "Tabandan Yüksele", desc: "Küçük yaş gruplarına yatırım yap.", difficulty:2 },
  { id: "scouts-network", name: "İzci Ağı Genişletme", desc: "Dünyada izci ağını kurarak yetenek avı yap.", difficulty:2 },
  { id: "marketing-brand", name: "Marka Değerini Artır", desc: "Kulüp markasını uluslararası düzeyde yükselt.", difficulty:3 },
  { id: "player-wages-control", name: "Maaş Disiplini", desc: "Futbolcu maaşlarını kontrol altında tut.", difficulty:3 },
  { id: "commercial-growth", name: "Ticari İşler Geliştir", desc: "Sponsor ve ticari gelir kaynaklarını artır.", difficulty:2 },
  { id: "match-facilities", name: "Maç Altyapısı", desc: "Oyun konsolu ve teknoloji entegrasyonu yap.", difficulty:1 },
  { id: "environmental-friendly", name: "Çevre Dostu Kulüp", desc: "Sürdürülebilir ve yeşil uygulamaları başlat.", difficulty:1 },
  { id: "legend-museum", name: "Kulüp Müzesi", desc: "Tarihi eser ve başarıları sergileyecek müze kur.", difficulty:1 },
  { id: "international-expansion", name: "Uluslararası Genişleme", desc: "Şube takımları ve iştirakları kur.", difficulty:4 }
];

const vowsShortGrid = document.getElementById("vowsShortGrid");
const vowsLongGrid = document.getElementById("vowsLongGrid");
const btnConfirmVow = document.getElementById("btnConfirmVow");
let selectedShort = [];
let selectedLong = [];
const maxShort = 2;
const maxLong = 2;

function renderVows() {
  if (!vowsShortGrid || !vowsLongGrid) return;

  // classify: difficulty <=2 => short, else long
  const shortList = vowData.filter(v => v.difficulty <= 2);
  const longList = vowData.filter(v => v.difficulty > 2);

  vowsShortGrid.innerHTML = shortList.map((vow, idx) => `
    <button type="button" class="vow-card" data-vow="${vow.id}" data-term="short" data-diff="${vow.difficulty}">
      <div class="vow-info"><strong>${vow.name}</strong><span>${vow.desc}</span></div>
    </button>
  `).join("");

  vowsLongGrid.innerHTML = longList.map((vow, idx) => `
    <button type="button" class="vow-card" data-vow="${vow.id}" data-term="long" data-diff="${vow.difficulty}">
      <div class="vow-info"><strong>${vow.name}</strong><span>${vow.desc}</span></div>
    </button>
  `).join("");

  // attach handlers
  document.querySelectorAll('#vowsShortGrid .vow-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.vow;
      const isSel = selectedShort.includes(id);
      if (isSel) {
        selectedShort = selectedShort.filter(x => x !== id);
        card.classList.remove('active');
      } else if (selectedShort.length < maxShort) {
        selectedShort.push(id);
        card.classList.add('active');
      }
      btnConfirmVow.disabled = (selectedShort.length + selectedLong.length) === 0;
    });
  });

  document.querySelectorAll('#vowsLongGrid .vow-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.vow;
      const isSel = selectedLong.includes(id);
      if (isSel) {
        selectedLong = selectedLong.filter(x => x !== id);
        card.classList.remove('active');
      } else if (selectedLong.length < maxLong) {
        selectedLong.push(id);
        card.classList.add('active');
      }
      btnConfirmVow.disabled = (selectedShort.length + selectedLong.length) === 0;
    });
  });
}

// render when election screen opens (screens.js calls renderVows too)
if (document.getElementById("scr-election").classList.contains("on")) renderVows();

if (btnConfirmVow) {
  btnConfirmVow.addEventListener("click", () => {
    const selected = [...selectedShort, ...selectedLong];
    if (selected.length === 0) return;

    // record vows separately
    careerProfile.vows = selected;
    careerProfile.vowsShort = selectedShort.slice();
    careerProfile.vowsLong = selectedLong.slice();

    // compute commitment score (normalized)
    const sumDiff = selected.reduce((s, id) => {
      const v = vowData.find(x => x.id === id);
      return s + (v ? v.difficulty : 0);
    }, 0);
    const maxPossible = (maxShort + maxLong) * 5; // 4*5=20
    const commitmentNorm = Math.min(1, sumDiff / maxPossible);

    // ensure gauges
    if (!careerProfile.gauges) careerProfile.gauges = { G1:55, G2:60, G3:50, G4:50, G5:45 };

    // Immediate 'UmutBonusu' to Taraftar (G2) per spec: Zorluk *4 each
    const hopeBonus = sumDiff * 4; // points
    careerProfile.gauges.G2 = Math.min(100, careerProfile.gauges.G2 + hopeBonus);

    // compute projected election percent from gauges + commitment
    const g = careerProfile.gauges;
    const base = 0.30 * (g.G4/100) + 0.20 * (g.G2/100) + 0.20 * (g.G3/100) + 0.15 * (g.G5/100) + 0.15 * commitmentNorm;
    const projectedPercent = Math.round(base * 100);
    careerProfile.electionProjected = projectedPercent;

    // margin effect: adjust initial gauges slightly based on projected margin over 50%
    const margin = projectedPercent - 50; // positive or negative
    const delta = margin * 0.2; // scale
    careerProfile.gauges.G1 = Math.max(0, Math.min(100, careerProfile.gauges.G1 + delta));
    careerProfile.gauges.G2 = Math.max(0, Math.min(100, careerProfile.gauges.G2 + delta * 1.2));
    careerProfile.gauges.G4 = Math.max(0, Math.min(100, careerProfile.gauges.G4 + delta * 1.1));

    // store promiseScore for later checks
    careerProfile.promiseScore = sumDiff;

    console.log("Vaatlar seçildi (short,long):", selectedShort, selectedLong, "proj%:", projectedPercent, careerProfile);
    go("office");
  });
}

/* ===================== OFFICE RENDER ===================== */
function renderOffice() {
  const presEl = document.getElementById('officePresident');
  const teamEl = document.getElementById('officeTeam');
  const vowsList = document.getElementById('officeVowsList');

  if (!presEl || !teamEl || !vowsList) return;

  presEl.textContent = `Başkan: ${careerProfile.presidentName || '—'}`;
  const teamName = (careerProfile.team && clubData.turkey.find(c => c.id === careerProfile.team)?.name) || '—';
  teamEl.textContent = `Takım: ${teamName}`;

  // ensure gauges exist in profile
  if (!careerProfile.gauges) {
    careerProfile.gauges = { G1:55, G2:60, G3:50, G4:50, G5:45 };
  }

  // populate vows
  vowsList.innerHTML = '';
  const vows = careerProfile.vows || [];
  if (vows.length === 0) {
    vowsList.innerHTML = '<li>Vaat verilmedi.</li>';
  } else {
    vows.forEach(vId => {
      const v = vowData.find(vw => vw.id === vId);
      const li = document.createElement('li');
      li.textContent = v ? v.name : vId;
      vowsList.appendChild(li);
    });
  }

  // set gauge bars
  const setGauge = (id, val) => {
    const bar = document.getElementById(id + 'bar');
    const valEl = document.getElementById(id + 'val');
    if (bar) bar.style.width = Math.max(0, Math.min(100, val)) + '%';
    if (valEl) valEl.textContent = Math.round(val) + '%';
  };

  setGauge('g1', careerProfile.gauges.G1);
  setGauge('g2', careerProfile.gauges.G2);
  setGauge('g3', careerProfile.gauges.G3);
  setGauge('g4', careerProfile.gauges.G4);
  setGauge('g5', careerProfile.gauges.G5);

  // Save button (placeholder)
  const btnSave = document.getElementById('btnSaveGame');
  if (btnSave) {
    btnSave.onclick = () => {
      localStorage.setItem('careerProfile', JSON.stringify(careerProfile));
      btnSave.textContent = 'Kaydedildi';
      setTimeout(() => btnSave.textContent = 'Kaydet', 1200);
    };
  }
}

/* ===================== BASIT OYUN DÖNGÜSÜ (haftalık tick) ===================== */
function initGameState() {
  if (!careerProfile.gauges) careerProfile.gauges = { G1:55, G2:60, G3:50, G4:50, G5:45 };
  if (!careerProfile.finance) careerProfile.finance = { cash: 1000000, debt: 200000 };
  // team strength baseline from club index
  const teamObj = clubData.turkey.find(c => c.id === careerProfile.team);
  const idx = teamObj ? clubData.turkey.indexOf(teamObj) : 10;
  careerProfile.teamStrength = 45 + (idx % 10); // simple baseline 45-54
}

function clamp(v,a,b){return Math.max(a,Math.min(b,v));}

function simulateMatch() {
  const team = careerProfile.teamStrength || 50;
  const opponent = 45 + Math.floor(Math.random()*21); // 45-65
  const delta = team - opponent;
  const pWin = 1 / (1 + Math.pow(10, -delta/25));
  const roll = Math.random();
  let outcome = 'draw';
  if (roll < pWin - 0.12) outcome = 'win';
  else if (roll > pWin + 0.12) outcome = 'loss';

  const g = careerProfile.gauges;
  if (outcome === 'win') {
    g.G4 = clamp(g.G4 + 3, 0, 100);
    g.G2 = clamp(g.G2 + 2, 0, 100);
    careerProfile.finance.cash += 50000;
  } else if (outcome === 'loss') {
    g.G4 = clamp(g.G4 - 4, 0, 100);
    g.G2 = clamp(g.G2 - 3, 0, 100);
    careerProfile.finance.cash -= 10000;
  } else {
    g.G4 = clamp(g.G4 + 0, 0, 100);
    careerProfile.finance.cash += 5000;
  }

  return { outcome, team, opponent, pWin: Math.round(pWin*100) };
}

function onTick() {
  if (!careerProfile.team) return;
  if (!careerProfile.gauges || !careerProfile.finance) initGameState();

  const logEl = document.getElementById('gameLog');

  // 1. konjonktür: tiny fluctuation
  careerProfile.finance.cash += Math.round((Math.random()-0.5)*20000);

  // 2. gelir/gider -> set G3 target
  const cash = careerProfile.finance.cash;
  const debt = careerProfile.finance.debt || 0;
  const targetG3 = clamp(50 + (cash - debt)/100000, 0, 100);

  // 3..7 simulate match week
  const match = simulateMatch();

  // 9. hareket: tüm gauge'ları hedefe %20 yaklaşacak şekilde güncelle
  const g = careerProfile.gauges;
  const targets = {
    G1: g.G1, // trust baseline unchanged except margin
    G2: g.G2,
    G3: targetG3,
    G4: g.G4,
    G5: g.G5
  };

  Object.keys(g).forEach(k => {
    const t = targets[k] || g[k];
    g[k] = clamp(g[k] + (t - g[k]) * 0.20, 0, 100);
  });

  // 10. check thresholds (simple)
  if (g.G1 < 20) {
    // kongre baskısı
    careerProfile.finance.cash = Math.max(0, careerProfile.finance.cash - 20000);
    if (logEl) logEl.innerHTML = `<div>Kongre baskısı başladı: bütçe kısıtlandı.</div>` + (logEl.innerHTML || '');
  }

  const entry = `Hafta tamamlandı — Maç: ${match.outcome.toUpperCase()} (Siz:${match.team} Rakip:${match.opponent} Pwin:${match.pWin}%)`; 
  if (logEl) { logEl.innerHTML = `<div>${entry}</div>` + (logEl.innerHTML || ''); logEl.scrollTop = 0; }

  // persist short
  localStorage.setItem('careerProfile', JSON.stringify(careerProfile));

  // update office UI
  renderOffice();
}

// bind button when available
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'btnNextWeek') {
    onTick();
  }
});

// Expose key functions to the global/window scope to ensure other scripts
// (like `title.js`) can call them regardless of execution order or bundling.
try {
  if (typeof window !== 'undefined') {
    window.startDefaultCareer = typeof startDefaultCareer === 'function' ? startDefaultCareer : window.startDefaultCareer;
    window.renderVows = typeof renderVows === 'function' ? renderVows : window.renderVows;
    window.renderOffice = typeof renderOffice === 'function' ? renderOffice : window.renderOffice;
    window.onTick = typeof onTick === 'function' ? onTick : window.onTick;
  }
} catch (e) {
  console.warn('Could not expose globals from setup.js', e);
}

// Quick helper to start with default profile and jump to team selection.
try {
  if (typeof window !== 'undefined') {
    window.quickStartAsDefault = function() {
      try { applyDefaultProfile(); renderTeams(); go('team'); }
      catch (e) { console.warn('quickStartAsDefault failed', e); }
    };
  }
} catch (e) {
  console.warn('Could not add quickStartAsDefault', e);
}
