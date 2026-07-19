// src/ui/inbox.js — Inbox (V3-C2/A1): haber akışı + aksiyonlu kararlar.
// Aksiyonlar: bilet mektubu · TRANSFER ONAY DOSYASI · SATIŞ TEKLİFİ · TD ADAY DOSYASI (§1-2).
// Y8: KARAR mesajları en üste sabitlenir + hafta gruplamaları + tıklanabilir imzalar.
import { TUNING } from '../config.js';
import { esc } from './frame.js';
import { sbShell } from './cockpit.js';

// İmza → sekme eşlemesi: gazeteci imzası Medya'ya, yönetici imzası Kulüp'e götürür
function sigLink(G, body) {
  const i = body.lastIndexOf(' — ');
  if (i < 0) return esc(body);
  const sig = body.slice(i + 3).trim();
  if (!sig || /\d/.test(sig) || sig.length > 40) return esc(body);
  const isJourno = (((G.data || {}).media || {}).journalists || []).some((j) => sig.includes(j.name));
  const staffNames = [G.gm, ...(Object.values(G.staff || {}))].filter(Boolean).map((s) => s.name);
  const isStaff = staffNames.some((n) => sig.includes(n)) || /GM|CFO|Genel Menajer|Akademi|Sözcü/i.test(sig);
  const nav = isJourno ? 'medya' : isStaff ? 'kulup' : null;
  if (!nav) return esc(body);
  return `${esc(body.slice(0, i))} — <button class="siglink" data-act="nav" data-arg="${nav}" aria-label="${esc(sig)} profiline git" style="background:none;padding:0;color:var(--club);cursor:pointer;text-decoration:underline dotted;font:inherit">${esc(sig)}</button>`;
}

// Tek mesaj kartı — hem tam inbox hem sağ rail kullanır (tek doğruluk kaynağı)
// Tek item'ın aksiyon butonları (opts) — tek doğruluk kaynağı; inbox + kokpit Karar Masası paylaşır.
export function itemActions(G, m) {
    const active = m.action && !m.resolved;
    let opts = '';
    if (active && m.action === 'ticket') {
      opts = `<div class="opts">
        <button data-act="ticket" data-arg="${m.id}|0.8">İndir (0.8×)</button>
        <button data-act="ticket" data-arg="${m.id}|1.0">Koru (1.0×)</button>
        <button data-act="ticket" data-arg="${m.id}|1.2">Artır (1.2×)</button>
      </div>`;
    } else if (active && m.action === 'bankLoan') {
      opts = `<div class="opts">
        <button data-act="bankLoan" data-arg="${m.id}|kabul" style="border-color:var(--pos)">KABUL — ${m.loan.amount}mn çek</button>
        <button data-act="bankLoan" data-arg="${m.id}|red" style="border-color:var(--neg)">REDDET</button>
      </div>`;
    } else if (active && m.action === 'tfile') {
      // ONAY kilidi GÖRÜNÜR: tahta cezası / peşinat yetersizliği butonda söylenir (sessiz ret
      // "basıyorum onaylamıyor" karmaşası yaratıyordu — kullanıcı raporu 2026-07-21)
      const tBan = (G.flags?.transferBan || 0) > 0;
      const pesinatYok = m.file && (G.economy?.kasa ?? 0) < (m.file.fee || 0) * TUNING.TRANSFER.DEPOSIT;
      const onayKilit = tBan || pesinatYok;
      const kilitTip = tBan ? `Tahta kapalı — FFP cezası (kalan ${G.flags.transferBan} hafta); imza atılamaz` : pesinatYok ? `Peşinat yetersiz — en az ${Math.ceil((m.file.fee || 0) * TUNING.TRANSFER.DEPOSIT)}mn kasa gerek` : 'İmzayı at — bedel kasadan (yetmezse borçlanır)';
      opts = `<div class="opts">
        <button data-act="tfile" data-arg="${m.id}|onay" ${onayKilit ? 'disabled' : ''} data-tip="${kilitTip}" style="border-color:var(--pos)">ONAYLA${onayKilit ? ' 🔒' : ''}</button>
        <button data-act="tfile" data-arg="${m.id}|red" style="border-color:var(--neg)">REDDET</button>
        ${(m.file && (m.file.round || 0) >= 2) ? '' : `<button data-act="tfile" data-arg="${m.id}|sart">${m.file && m.file.round === 1 ? 'ŞARTLI · TUR 2 — "üsteleyelim, %10 daha" (riskli)' : 'ŞARTLI — "pahalı, %20 in"'}</button>`}
        ${m.file && m.file.player ? `<button data-act="pcard" data-arg="${m.file.player.id}" data-tip="Oyuncunun kartını aç — mevki, güç, potansiyel">🔍 Kartı aç</button>` : ''}
      </div>`;
    } else if (active && m.action === 'sfile') {
      opts = `<div class="opts">
        <button data-act="sfile" data-arg="${m.id}|sat" style="border-color:var(--pos)">SAT</button>
        <button data-act="sfile" data-arg="${m.id}|red" style="border-color:var(--neg)">REDDET</button>
        ${m.file && m.file.player ? `<button data-act="pcard" data-arg="${m.file.player.id}" data-tip="Oyuncunun kartını aç">🔍 Kartı aç</button>` : ''}
      </div>`;
    } else if (active && m.action === 'spBuyout') { // SPONSOR AVI — rakip marka fesih bedelini üstlenir
      opts = `<div class="opts">
        <button data-act="spBuyout" data-arg="${m.id}|kabul" style="border-color:var(--pos)">KABUL — cezayı ${esc(m.avTeklif?.name || 'yeni marka')} öder</button>
        <button data-act="spBuyout" data-arg="${m.id}|red" style="border-color:var(--neg)">REDDET — sözümüz söz</button>
      </div>`;
    } else if (active && m.action === 'kayyum') { // #3: kurtuluş paketi — 3 oyuncu tek kalem, bedel borca
      opts = `<div class="opts">
        <button data-act="kayyum" data-arg="${m.id}|sat" style="border-color:var(--pos)">PAKETİ SAT — ${m.tutar}mn borca</button>
        <button data-act="kayyum" data-arg="${m.id}|red" style="border-color:var(--neg)">REDDET — kadroyu koru</button>
      </div>`;
    } else if (active && m.action === 'ultras') { // 2.6: tribün talebi — karşıla/reddet (yoksayarsan süre dolunca pankart)
      const grp = (G.fanGroups || []).find((x) => x.name === m.grup);
      const maliyet = grp && grp.talep ? TUNING.ULTRAS.TALEPLER[grp.talep.tip]?.maliyet : null;
      // kasa yetmiyorsa buton KİLİTLİ + gerekçe tooltip'te (aktif buton "basıyorum onaylamıyor"
      // karmaşası + uyarı mektubu spam'i yaratıyordu — kullanıcı raporu 2026-07-21)
      const kasaYok = maliyet != null && (G.economy?.kasa ?? 0) < maliyet;
      opts = `<div class="opts">
        <button data-act="ultras" data-arg="${m.id}|kabul" ${kasaYok ? 'disabled' : ''} style="border-color:var(--pos)" data-tip="${kasaYok ? `Kasa yetmiyor — ${maliyet}mn gerek (kasa ${Math.round((G.economy?.kasa ?? 0) * 10) / 10}mn)` : 'Talebi karşıla — tribün coşar'}">KARŞILA${maliyet != null ? ` — ${maliyet}mn` : ''}${kasaYok ? ' 🔒' : ''}</button>
        <button data-act="ultras" data-arg="${m.id}|red" style="border-color:var(--neg)">REDDET — bütçe yok</button>
      </div>`;
    } else if (active && m.action === 'tdkriz') { // TD kriz dosyası — kov / arkasında dur / pazarı tara
      opts = `<div class="opts">
        <button data-act="tdkriz" data-arg="${m.id}|kov" style="border-color:var(--neg)" data-tip="Tazminat + medya fırtınası; aday süreci hemen başlar">GÖNDER — tazminatla</button>
        <button data-act="tdkriz" data-arg="${m.id}|arkasinda" style="border-color:var(--pos)" data-tip="İlişki +8, kurul −2 · 3 maçlık söz: seri kırılırsa itibar +1, sürerse taraftar −2 kurul −3">ARKASINDAYIM — söz veriyorum</button>
        <button data-act="tdkriz" data-arg="${m.id}|pazar" data-tip="1mn tarama — 3 aday gücüyle masaya gelir (sezonda 1 hak)">PAZARI TARA</button>
      </div>`;
    } else if (active && m.action === 'cfile') {
      // Adaylar GÜÇ + maaşla listelenir (kullanıcı isteği: "TD'nin gücünü görelim, kıyaslayalım")
      const WT = TUNING.POWER.W_TEKNIK; // motorla TEK KAYNAK (teknikEkip ile aynı karışım)
      const tdG = (c) => Math.round(WT.taktik * (c.taktik || 0) + WT.oyuncuYonetimi * (c.oyuncuYonetimi || 0) + WT.otorite * (c.otorite || 0) + WT.yardimciEkip * (c.yardimciEkip || 0));
      opts = `<div class="opts">${(G.coachFiles || []).map((c, i) =>
        `<button data-act="cfile" data-arg="${m.id}|${i}" data-tip="Taktik ${Math.round(c.taktik || 0)} · Oyuncu yön. ${Math.round(c.oyuncuYonetimi || 0)} · Otorite ${Math.round(c.otorite || 0)} · Yrd. ekip ${Math.round(c.yardimciEkip || 0)}">İmzala: ${esc(c.name)} · <b>GÜÇ ${tdG(c)}</b> · ${(Math.round((c.wage || 0) * 10) / 10)}mn</button>`).join('')}</div>`;
    } else if (active && m.action === 'event') { // D3+K1: olay kartı — seçenek + sonuç fısıltısı (yön, sayı değil)
      opts = `<div class="opts" style="align-items:flex-start">${(m.event.options || []).map((o, i) =>
        `<span style="display:inline-flex;flex-direction:column;gap:2px;margin:2px 6px 2px 0">
          <button data-act="event" data-arg="${m.id}|${i}">${esc(o.label)}</button>
          ${o.whisper ? `<span class="muted" style="font-size:11px;padding-left:2px">${esc(o.whisper)}</span>` : ''}
        </span>`).join('')}</div>`;
    } else if (active && m.action === 'stfile') { // A1: yönetici aday dosyası
      // Adaylar ÖNCE mesajdan (m.stCands — her dosya kendi listesini taşır); eski kayıtta global fallback.
      const cands = (m.stCands && m.stCands.length) ? m.stCands
        : ((G.staffCands && (G.staffCands.role === m.stRole || !m.stRole)) ? (G.staffCands.cands || []) : []);
      opts = `<div class="opts">${cands.map((c, i) =>
        `<button data-act="stfile" data-arg="${m.id}|${i}">İmzala: ${esc(c.name)}</button>`).join('')}</div>`;
    } else if (active && m.action === 'lfile') { // A3: kiralık gönderme
      opts = `<div class="opts">
        <button data-act="lfile" data-arg="${m.id}|gonder" style="border-color:var(--pos)">GÖNDER (gelişim ×1.5)</button>
        <button data-act="lfile" data-arg="${m.id}|kalsin">KALSIN</button>
      </div>`;
    } else if (active && m.action === 'captain') { // K2: kaptanlık önerisi — onay/veto
      opts = `<div class="opts">
        <button data-act="captain" data-arg="${m.id}|onay" style="border-color:var(--pos)">ONAYLA (C)</button>
        <button data-act="captain" data-arg="${m.id}|veto" style="border-color:var(--neg)">VETO — alternatife ver</button>
      </div>`;
    } else if (active && m.action === 'seasonBudget') { // yeni sezon transfer kesesi — onayla/kıs/aç
      opts = `<div class="opts">
        <button data-act="seasonBudget" data-arg="${m.id}|onay" style="border-color:var(--pos)">ONAYLA (${m.oneri}mn)</button>
        <button data-act="seasonBudget" data-arg="${m.id}|kis">KIS (−%25)</button>
        <button data-act="seasonBudget" data-arg="${m.id}|artir">AÇ (+%25)</button>
      </div>`;
    } else if (active && m.action === 'douse') { // A1: basın sözcüsü manşet söndürme
      opts = `<div class="opts"><button data-act="douse" data-arg="${m.id}">🧯 Manşeti söndür (sözcü devrede)</button></div>`;
    } else if (active && m.action === 'agenda') { // B1a: dinamik kurul gündemi — madde madde ton seç
      const ag = m.agenda, it = ag.items[ag.idx];
      opts = it ? `<div style="margin-top:8px;padding:8px;border:1px solid var(--line);border-radius:8px">
        <div class="overline">Madde ${ag.idx + 1}/${ag.items.length}: ${esc(it.title)}</div>
        <div class="opts">
          <button data-act="agenda" data-arg="${m.id}|veri">📊 Veriyle savun</button>
          <button data-act="agenda" data-arg="${m.id}|vizyon">🔭 Vizyonla büyüle</button>
          <button data-act="agenda" data-arg="${m.id}|kabul">🤲 Kabullen, özür dile</button>
        </div>
        <div class="muted" style="font-size:11px;margin-top:4px">veri: karnen sağlamsa işler, çürükse geri teper · vizyon: güvenli küçük · kabul: bedelli dürüstlük</div>
      </div>` : '';
    } else if (active && m.action === 'board') { // D2: kurul sunumu taahhüdü
      opts = `<div class="opts">
        <button data-act="board" data-arg="${m.id}|mali">Mali disiplin sözü</button>
        <button data-act="board" data-arg="${m.id}|sportif">Sportif yatırım sözü</button>
        <button data-act="board" data-arg="${m.id}|taraftar">Taraftar barışı sözü</button>
      </div>`;
    }
    return opts;
}

function renderMsg(G, m) {
    const active = m.action && !m.resolved;
    const opts = itemActions(G, m);
    // GÖRSEL 4/5g: kart tipi ayrımı — karar/olay/tehlike; okunmamış sol nokta
    const tip = active ? 'card--decision' : m.action === 'event' || m.cat === 'olay' ? 'card--event' : m.cat === 'manset' && /BALYOZ|İFLAS|KRİZ/i.test(m.t || '') ? 'card--danger' : '';
    return `<div class="msg ${active ? 'action' : ''} ${tip}">
      <div class="t">${active ? '<span class="rozet-karar">Karar</span> ' : ''}${esc(m.t)}</div>
      <div class="b">${sigLink(G, String(m.b || ''))}</div>${opts}
    </div>`;
}

export function render(G) {
  const all = G.inbox || [];
  const pinned = all.filter((m) => m.action && !m.resolved);           // KARAR bekleyenler
  const rest = all.filter((m) => !(m.action && !m.resolved));
  // SOL — bekleyen kararlar (masadaki dosyalar)
  const kararlar = pinned.length
    ? pinned.map((m) => renderMsg(G, m)).join('')
    : `<div class="bos-durum"><div class="iko">✅</div><div class="cml">Masanda bekleyen karar yok, Başkanım.<br>Akıştaki gelişmeleri izle ya da haftayı ilerlet.</div></div>`;
  // SAĞ — haber akışı, hafta gruplamalı (yeni → eski)
  let akis = '', lastWk = null;
  for (const m of rest) {
    const wk = m.wk ?? null;
    if (wk !== lastWk) { akis += `<div class="micro inbox-grup">${wk ? `Hafta ${wk}` : 'Arşiv'}</div>`; lastWk = wk; }
    akis += renderMsg(G, m);
  }
  const crumb = `GELEN KUTUSU · ${pinned.length} BEKLEYEN KARAR · ${rest.length} HABER`;
  const body = `<div class="ib-grid">
    <div class="sb-panel ib-col ib-kararlar">
      <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">BEKLEYEN KARARLAR</span><span class="sb-panel-r">${pinned.length ? pinned.length + ' dosya' : 'sakin'}</span></div>
      <div class="ib-scroll dh-fade">${kararlar}</div>
    </div>
    <div class="sb-panel ib-col">
      <div class="sb-panel-h"><span class="sb-tick"></span><span class="sb-panel-t">HABER AKIŞI</span><span class="sb-panel-r">yeni → eski</span></div>
      <div class="ib-scroll dh-fade">${akis || '<div class="muted" style="font-size:12px;padding:10px 0">Akış sakin — henüz haber yok.</div>'}</div>
    </div>
  </div>`;
  return sbShell(G, { crumb, title: 'Gelen Kutusu', body });
}

// KALICI SAĞ RAİL — kokpitte hep açık: bekleyen kararlar + son akış (inbox'a gitmeden)
export function rail(G) {
  const all = G.inbox || [];
  const pending = all.filter((m) => m.action && !m.resolved);
  const news = all.filter((m) => !(m.action && !m.resolved)).slice(0, 8);
  const govde = (pending.length || news.length)
    ? `${pending.length ? `<div class="micro" style="color:var(--club);margin-bottom:2px">Bekleyen Kararlar</div>${pending.map((m) => renderMsg(G, m)).join('')}` : ''}
       ${news.length ? `<div class="micro inbox-grup">Akış</div>${news.map((m) => renderMsg(G, m)).join('')}` : ''}`
    : '<div class="muted" style="font-size:12px;padding:8px 0">Kutu sakin. Haber yok, karar yok.</div>';
  return `<aside class="inbox-rail">
    <div class="rail-head">
      <span class="overline">📬 Gelen Kutusu</span>
      ${pending.length ? `<span class="badge">${pending.length} karar</span>` : '<span class="micro">sakin</span>'}
    </div>
    <div class="rail-body">${govde}</div>
    <button class="btn rail-full" data-act="nav" data-arg="inbox">Tüm arşiv →</button>
  </aside>`;
}
