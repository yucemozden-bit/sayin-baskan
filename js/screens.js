/* ===================== EKRAN YÖNETİCİSİ =====================
   Her ekran: <section class="screen" id="scr-AD">
   Geçiş: go("AD") — fade ile açılır, öncekini kapatır.
   Yeni ekran eklemek = index.html'e yeni <section> + js/AD.js dosyası. */
const Screens = {
  current: "title",
  go(name) {
    const next = document.getElementById("scr-" + name);
    if (!next || name === this.current) return;
    document.getElementById("scr-" + this.current).classList.remove("on");
    requestAnimationFrame(() => { next.classList.add("on"); });
    this.current = name;
  }
};
const go = n => Screens.go(n);
