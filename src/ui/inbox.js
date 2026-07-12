// src/ui/inbox.js — Inbox (V3-C2/A1): haber akışı + aksiyonlu kararlar.
// Aksiyonlar: bilet mektubu · TRANSFER ONAY DOSYASI · SATIŞ TEKLİFİ · TD ADAY DOSYASI (§1-2).
// Y8: KARAR mesajları en üste sabitlenir + hafta gruplamaları + tıklanabilir imzalar.
import { esc } from './frame.js';

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
function renderMsg(G, m) {
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
      opts = `<div class="opts">
        <button data-act="tfile" data-arg="${m.id}|onay" style="border-color:var(--pos)">ONAYLA</button>
        <button data-act="tfile" data-arg="${m.id}|red" style="border-color:var(--neg)">REDDET</button>
        ${(m.file && (m.file.round || 0) >= 2) ? '' : `<button data-act="tfile" data-arg="${m.id}|sart">${m.file && m.file.round === 1 ? 'ŞARTLI · TUR 2 — "üsteleyelim, %10 daha" (riskli)' : 'ŞARTLI — "pahalı, %20 in"'}</button>`}
      </div>`;
    } else if (active && m.action === 'sfile') {
      opts = `<div class="opts">
        <button data-act="sfile" data-arg="${m.id}|sat" style="border-color:var(--pos)">SAT</button>
        <button data-act="sfile" data-arg="${m.id}|red" style="border-color:var(--neg)">REDDET</button>
      </div>`;
    } else if (active && m.action === 'cfile') {
      opts = `<div class="opts">${(G.coachFiles || []).map((c, i) =>
        `<button data-act="cfile" data-arg="${m.id}|${i}">İmzala: ${esc(c.name)}</button>`).join('')}</div>`;
    } else if (active && m.action === 'event') { // D3+K1: olay kartı — seçenek + sonuç fısıltısı (yön, sayı değil)
      opts = `<div class="opts" style="align-items:flex-start">${(m.event.options || []).map((o, i) =>
        `<span style="display:inline-flex;flex-direction:column;gap:2px;margin:2px 6px 2px 0">
          <button data-act="event" data-arg="${m.id}|${i}">${esc(o.label)}</button>
          ${o.whisper ? `<span class="muted" style="font-size:11px;padding-left:2px">${esc(o.whisper)}</span>` : ''}
        </span>`).join('')}</div>`;
    } else if (active && m.action === 'stfile') { // A1: yönetici aday dosyası
      opts = `<div class="opts">${((G.staffCands || {}).cands || []).map((c, i) =>
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
  return `<div class="ib-wrap">
    <div class="tr-head">
      <div><div class="overline">Gelen Kutusu</div><h2 style="margin:2px 0 0">Inbox</h2></div>
      <div class="ib-stat">
        <span class="tesis-kasa" style="border-color:${pinned.length ? 'var(--club-glow)' : 'var(--line)'}"><i>BEKLEYEN</i><b style="color:${pinned.length ? 'var(--club-2)' : 'var(--ink-1)'};font-size:15px">${pinned.length} karar</b></span>
        <span class="tesis-kasa" style="border-color:var(--line)"><i>AKIŞ</i><b style="color:var(--ink-1);font-size:15px">${rest.length} haber</b></span>
      </div>
    </div>
    <div class="ib-grid">
      <div class="ib-col ib-kararlar">
        <div class="ib-col-head"><span class="overline" style="color:var(--club)">Bekleyen Kararlar</span>${pinned.length ? `<span class="badge">${pinned.length}</span>` : '<span class="micro">sakin</span>'}</div>
        <div class="ib-scroll dh-fade">${kararlar}</div>
      </div>
      <div class="ib-col">
        <div class="ib-col-head"><span class="overline">Haber Akışı</span><span class="micro">yeni → eski</span></div>
        <div class="ib-scroll dh-fade">${akis || '<div class="muted" style="font-size:12px;padding:10px 0">Akış sakin — henüz haber yok.</div>'}</div>
      </div>
    </div>
  </div>`;
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
