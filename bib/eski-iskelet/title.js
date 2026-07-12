/* ===================== AÇILIŞ EKRANI ===================== */
const btnNew = document.getElementById("btnNew");
if (btnNew) {
	btnNew.addEventListener('click', () => {
		// Prefer a quick helper exposed by setup.js that populates internal state
		if (typeof window.quickStartAsDefault === 'function') {
			try { window.quickStartAsDefault(); return; } catch (e) { console.error('quickStartAsDefault threw', e); }
		}

		if (typeof window.startDefaultCareer === 'function') {
			try { window.startDefaultCareer(); return; } catch (e) { console.error(e); }
		}

		if (typeof go === 'function') { try { go('team'); return; } catch (e) { console.error('go("team") failed', e); } }

		console.warn('Unable to start new career.');
	});
}
// "Devam Et": localStorage kayıt sistemi eklenince aktifleşecek.
// "Ayarlar": ileride.
