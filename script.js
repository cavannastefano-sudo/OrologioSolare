// ==========================================
// SunClock24 - script.js (Striscia Intero Anno + Orologio e Frecce Sotto la Striscia nella Tenda in Basso)
// ==========================================

SunCalc.addTime(-18, 'astronomicalDawn', 'astronomicalDusk');
SunCalc.addTime(-12, 'nauticalDawn', 'nauticalDusk');
SunCalc.addTime(-6, 'dawn', 'dusk');

const canvas = document.getElementById('clockCanvas');
const ctx = canvas.getContext('2d');
const cx = 250;
const cy = 250;
const radius = 248;

const PALETTE = {
    night: '#000000', astro: '#172554', naut: '#1e3a8a',
    civil: '#3b82f6', sunriseSunset: '#f97316', golden: '#eab308', day: '#bae6fd'
};

let cachedTimes = null;
let cachedMoonTimes = null;
let cachedMoonIllumination = null;
let cachedLat = 45.05;
let cachedLon = 9.69;
let selectedDate = new Date();
let isCustomTime = false;
let customTimeOffsetMs = 0;
let lastUpdateMs = performance.now();
let dstOverrideState = null; // null = automatico / regola fuso
let map = null;
let marker = null;
let currentPlaceDisplayName = "Ricerca in corso...";
let isTimezoneOnlyMode = false;
let lastHighlightedEventIndex = -1;
let isGpsActiveConfirmed = false;

// Stato zoom e pan della mappa dei fusi orari
let mapZoomScale = 1;
let mapPanX = 0;
let mapPanY = 0;

// Stato Striscia Intero Anno con Selettori Anno e Mese + Tasto Oggi + Orologio e Frecce Sotto la Striscia
let builtYear = null;
let isStripOpen = false;
let isProgrammaticScroll = false;
let scrollEndTimer = null;
let scrollRafId = null;
let sunClockRafId = null;
let tickElements = [];
let activeTickEl = null;

// Caricamento dell'immagine reale della Luna con il nome corretto luna.jpg
const realMoonImage = new Image();
realMoonImage.src = 'luna.jpg';

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('auto')) {
    localStorage.setItem('sunclock_auto_dst', urlParams.get('auto'));
}
if (urlParams.has('dst')) {
    localStorage.setItem('sunclock_dst', urlParams.get('dst'));
}

function getPrimaryLocationMode() {
    return localStorage.getItem('sunclock_primary_mode') === 'manual' ? 'manual' : 'gps';
}

function setPrimaryLocationMode(mode) {
    localStorage.setItem('sunclock_primary_mode', mode === 'manual' ? 'manual' : 'gps');
}

function saveSharedPlaceToStorage(lat, lon, name) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return;
    try {
        localStorage.setItem('sunclock_home_place', JSON.stringify({
            lat: lat,
            lon: lon,
            name: (name && String(name).trim()) || 'Posizione',
            updatedAt: Date.now()
        }));
    } catch (e) {}
}

function getSharedPlaceFromStorage() {
    try {
        const raw = localStorage.getItem('sunclock_home_place');
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (
            parsed &&
            typeof parsed.lat === 'number' && !isNaN(parsed.lat) &&
            typeof parsed.lon === 'number' && !isNaN(parsed.lon)
        ) {
            return parsed;
        }
    } catch (e) {}
    return null;
}

function updateGpsStatusBanner(state) {
    const banner = document.getElementById('gps-status-banner');
    const dot = document.getElementById('gps-status-dot');
    const text = document.getElementById('gps-status-text');
    if (!banner || !dot || !text) return;

    banner.style.borderColor = '#475569';

    if (state === 'active') {
        isGpsActiveConfirmed = true;
        dot.textContent = '🟢';
        text.textContent = 'Posizione attiva';
        banner.style.backgroundColor = 'rgba(22, 101, 52, 0.35)';
        banner.style.color = '#86efac';
    } else if (state === 'manual') {
        isGpsActiveConfirmed = false;
        dot.textContent = '🔴';
        text.textContent = 'Posizione disattivata (località manuale)';
        banner.style.backgroundColor = 'rgba(153, 27, 27, 0.35)';
        banner.style.color = '#fca5a5';
    } else {
        isGpsActiveConfirmed = false;
        dot.textContent = '🔴';
        text.textContent = 'Posizione disattivata';
        banner.style.backgroundColor = 'rgba(153, 27, 27, 0.35)';
        banner.style.color = '#fca5a5';
    }
}

function syncGpsStatusBannerWithCurrentState() {
    if (getPrimaryLocationMode() === 'manual') {
        updateGpsStatusBanner('manual');
    } else if (isGpsActiveConfirmed) {
        updateGpsStatusBanner('active');
    } else {
        updateGpsStatusBanner('off');
    }
}

function updatePrimaryPlaceUI() {
    const statusEl = document.getElementById('primary-place-status');
    const latInput = document.getElementById('primary-lat-input');
    const lonInput = document.getElementById('primary-lon-input');
    const saved = getSharedPlaceFromStorage();
    const mode = getPrimaryLocationMode();

    if (latInput && !latInput.value && typeof cachedLat === 'number') {
        latInput.value = cachedLat.toFixed(4);
    }
    if (lonInput && !lonInput.value && typeof cachedLon === 'number') {
        lonInput.value = cachedLon.toFixed(4);
    }

    syncGpsStatusBannerWithCurrentState();

    if (!statusEl) return;

    if (mode === 'manual' && saved) {
        statusEl.innerHTML = `Modalità: <strong style="color:#38bdf8;">Posizione primaria fissa</strong><br>Attuale: <strong style="color:#facc15;">${saved.name}</strong> (${saved.lat.toFixed(2)}, ${saved.lon.toFixed(2)})`;
    } else {
        statusEl.innerHTML = `Modalità: <strong style="color:#39ff14;">GPS</strong><br>Attuale: <strong style="color:#facc15;">${currentPlaceDisplayName}</strong> (${cachedLat.toFixed(2)}, ${cachedLon.toFixed(2)})`;
    }
}

function togglePrimaryPlaceDrawer(forceState = null) {
    const drawer = document.getElementById('primary-place-drawer');
    const arrow = document.getElementById('primary-place-arrow');
    if (!drawer) return;

    const shouldOpen = typeof forceState === 'boolean'
        ? forceState
        : (drawer.style.display !== 'block');

    drawer.style.display = shouldOpen ? 'block' : 'none';
    if (arrow) {
        arrow.innerText = shouldOpen ? '▲' : '▼';
    }
    if (shouldOpen) {
        updatePrimaryPlaceUI();
    }
}

async function applyPrimaryLocationNow(lat, lon, placeName, mode = 'manual') {
    const numLat = parseFloat(lat);
    const numLon = parseFloat(lon);
    if (isNaN(numLat) || isNaN(numLon) || numLat < -90 || numLat > 90 || numLon < -180 || numLon > 180) {
        return false;
    }

    setPrimaryLocationMode(mode);
    cachedLat = numLat;
    cachedLon = numLon;
    currentPlaceDisplayName = (placeName && String(placeName).trim()) || (mode === 'manual' ? 'Posizione Primaria' : 'Posizione Corrente');
    isTimezoneOnlyMode = false;

    if (mode === 'manual') {
        saveSharedPlaceToStorage(cachedLat, cachedLon, currentPlaceDisplayName);
        updateGpsStatusBanner('manual');
    } else {
        updateGpsStatusBanner('active');
    }

    const latInput = document.getElementById('primary-lat-input');
    const lonInput = document.getElementById('primary-lon-input');
    if (latInput) latInput.value = cachedLat.toFixed(4);
    if (lonInput) lonInput.value = cachedLon.toFixed(4);

    isCustomTime = false;
    customTimeOffsetMs = 0;
    lastUpdateMs = performance.now();

    syncDstWithLocation(cachedLat, cachedLon, new Date());
    syncSettingsCoordsDisplay(cachedLat, cachedLon);
    updateTimeForLocation();
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);

    if (isStripOpen) {
        ensureYearStripBuilt(selectedDate.getUTCFullYear());
        syncStripToSelectedDate(false);
    }
    adaptBottomPanelHeight(true);
    updatePrimaryPlaceUI();
    return true;
}

async function searchAndSetPrimaryCity() {
    const input = document.getElementById('primary-city-input');
    const statusEl = document.getElementById('primary-place-status');
    const query = input ? input.value.trim() : '';
    if (!query) {
        if (statusEl) statusEl.innerHTML = `<span style="color:#facc15;">Inserisci una città o inserisci Lat e Lon.</span>`;
        return;
    }

    if (statusEl) statusEl.innerHTML = `<span style="color:#38bdf8;">Ricerca località in corso...</span>`;

    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}&accept-language=it`);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            const shortName = (data[0].display_name || query).split(',')[0].trim();
            await applyPrimaryLocationNow(lat, lon, shortName, 'manual');
        } else if (statusEl) {
            statusEl.innerHTML = `<span style="color:#f87171;">Località non trovata.</span>`;
        }
    } catch (e) {
        if (statusEl) statusEl.innerHTML = `<span style="color:#f87171;">Errore durante la ricerca.</span>`;
    }
}

function saveManualPrimaryCoords() {
    const latInput = document.getElementById('primary-lat-input');
    const lonInput = document.getElementById('primary-lon-input');
    const cityInput = document.getElementById('primary-city-input');
    const statusEl = document.getElementById('primary-place-status');

    const lat = parseFloat(latInput ? latInput.value : '');
    const lon = parseFloat(lonInput ? lonInput.value : '');
    if (isNaN(lat) || isNaN(lon)) {
        if (statusEl) statusEl.innerHTML = `<span style="color:#f87171;">Inserisci valori validi per Lat e Lon.</span>`;
        return;
    }

    const label = (cityInput && cityInput.value.trim()) ? cityInput.value.trim() : `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    applyPrimaryLocationNow(lat, lon, label, 'manual');
}

function restoreGpsPrimaryLocation() {
    const statusEl = document.getElementById('primary-place-status');
    setPrimaryLocationMode('gps');
    if (statusEl) statusEl.innerHTML = `<span style="color:#38bdf8;">Acquisizione posizione GPS...</span>`;

    if (!navigator.geolocation) {
        updateGpsStatusBanner('off');
        updatePrimaryPlaceUI();
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            isGpsActiveConfirmed = true;
            updateGpsStatusBanner('active');

            let placeName = "Posizione Corrente";
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=it`);
                const geoData = await res.json();
                if (geoData && geoData.address) {
                    const country = geoData.address.country || '';
                    const specificLocality = geoData.address.city ||
                                             geoData.address.town ||
                                             geoData.address.village ||
                                             geoData.address.municipality ||
                                             geoData.address.county ||
                                             geoData.address.state || '';
                    if (country && specificLocality && specificLocality.toLowerCase() !== country.toLowerCase()) {
                        placeName = `${country} - ${specificLocality}`;
                    } else {
                        placeName = specificLocality || country || "Posizione Corrente";
                    }
                }
            } catch (e) {}

            await applyPrimaryLocationNow(lat, lon, placeName, 'gps');
        },
        () => {
            updateGpsStatusBanner('off');
            updatePrimaryPlaceUI();
        },
        { timeout: 6000, enableHighAccuracy: true, maximumAge: 15000 }
    );
}

function openWorldMapPage() {
    const qs = new URLSearchParams();
    if (typeof cachedLat === 'number' && !Number.isNaN(cachedLat)) {
        qs.set('lat', cachedLat.toFixed(4));
    }
    if (typeof cachedLon === 'number' && !Number.isNaN(cachedLon)) {
        qs.set('lon', cachedLon.toFixed(4));
    }
    if (typeof currentPlaceDisplayName === 'string' && currentPlaceDisplayName.trim()) {
        qs.set('city', currentPlaceDisplayName.trim());
    }
    const query = qs.toString();
    window.location.href = query ? `world.html?${query}` : 'world.html';
}

function formatOffsetLabel(offsetHours) {
    const num = Number(offsetHours);
    if (isNaN(num)) return 'UTC +1';
    const sign = num >= 0 ? '+' : '-';
    const absVal = Math.abs(num);
    const whole = Math.floor(absVal);
    const mins = Math.round((absVal - whole) * 60);
    if (mins === 0) {
        return `UTC ${sign}${whole}`;
    }
    return `UTC ${sign}${whole}:${String(mins).padStart(2, '0')}`;
}

function syncTimezoneDropdownToLocation(lat = cachedLat, lon = cachedLon) {
    const preciseTz = getPreciseStandardTimezone(lat, lon);
    const selectEl = document.getElementById('timezone-preset');
    if (!selectEl) return preciseTz;

    if (!selectEl.dataset.manualBound) {
        selectEl.dataset.manualBound = 'true';
        selectEl.addEventListener('change', () => {
            applyTimezonePreset();
        });
    }

    let matched = false;
    for (let opt of selectEl.options) {
        if (Math.abs(parseFloat(opt.value) - preciseTz) < 0.001) {
            selectEl.value = opt.value;
            matched = true;
            break;
        }
    }

    if (!matched) {
        const newOpt = document.createElement('option');
        newOpt.value = String(preciseTz);
        newOpt.textContent = formatOffsetLabel(preciseTz);
        selectEl.appendChild(newOpt);
        selectEl.value = String(preciseTz);
    }

    return preciseTz;
}

function getSelectedBaseTimezone() {
    if (!isTimezoneOnlyMode) {
        return getPreciseStandardTimezone(cachedLat, cachedLon);
    }
    const tzPresetEl = document.getElementById('timezone-preset');
    if (tzPresetEl && tzPresetEl.value !== '' && !isNaN(parseFloat(tzPresetEl.value))) {
        return parseFloat(tzPresetEl.value);
    }
    return getPreciseStandardTimezone(cachedLat, cachedLon);
}

function updateSettingsDstNotice() {
    const modal = document.getElementById('modal-settings');
    if (!modal) return;

    const baseTz = getSelectedBaseTimezone();
    const isDstNowActive = getCurrentDstState();
    const dstOffset = baseTz + 1;

    const baseLabel = formatOffsetLabel(baseTz);
    const dstLabel = formatOffsetLabel(dstOffset);

    let noticeEl = document.getElementById('settings-dst-notice');
    if (!noticeEl) {
        const tzBadgeEl = document.getElementById('settings-tz-badge');
        const manualBox = document.getElementById('manual-dst-box');
        const anchor = (tzBadgeEl && tzBadgeEl.parentElement) || manualBox || modal.querySelector('.modal-content, .settings-body') || modal;

        noticeEl = document.createElement('div');
        noticeEl.id = 'settings-dst-notice';
        noticeEl.style.marginTop = '8px';
        noticeEl.style.marginBottom = '8px';
        noticeEl.style.padding = '7px 10px';
        noticeEl.style.borderRadius = '8px';
        noticeEl.style.fontSize = '0.84rem';
        noticeEl.style.fontWeight = 'bold';
        noticeEl.style.lineHeight = '1.35';
        noticeEl.style.textShadow = 'none';
        noticeEl.style.webkitTextStroke = '0px transparent';

        if (manualBox && manualBox.parentElement) {
            manualBox.insertAdjacentElement('afterend', noticeEl);
        } else if (anchor) {
            anchor.appendChild(noticeEl);
        }
    }

    if (isDstNowActive) {
        noticeEl.style.backgroundColor = 'rgba(234, 179, 8, 0.16)';
        noticeEl.style.border = '1px solid #475569';
        noticeEl.style.color = '#fef08a';
        noticeEl.innerHTML = `☀️ Ora legale attiva • Fuso solare: ${baseLabel} → Ora legale: ${dstLabel}`;
    } else {
        noticeEl.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
        noticeEl.style.border = '1px solid #475569';
        noticeEl.style.color = '#bae6fd';
        noticeEl.innerHTML = `🕒 Ora solare attiva • Fuso: ${baseLabel}`;
    }
}

function formatCoordinatesShort(lat, lon) {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (isNaN(latNum) || isNaN(lonNum)) {
        return { latText: '--', lonText: '--', latNumStr: '', lonNumStr: '' };
    }

    return {
        latText: latNum.toFixed(2),
        lonText: lonNum.toFixed(2),
        latNumStr: latNum.toFixed(2),
        lonNumStr: lonNum.toFixed(2)
    };
}

function syncSettingsCoordsDisplay(lat = cachedLat, lon = cachedLon) {
    if (!isTimezoneOnlyMode) {
        syncTimezoneDropdownToLocation(lat, lon);
    }

    const coords = formatCoordinatesShort(lat, lon);
    const latEl = document.getElementById('settings-lat-display');
    const lonEl = document.getElementById('settings-lon-display');
    const tzBadgeEl = document.getElementById('settings-tz-badge');

    if (latEl) latEl.innerText = coords.latText;
    if (lonEl) lonEl.innerText = coords.lonText;

    if (tzBadgeEl) {
        const baseTz = getSelectedBaseTimezone();
        const isDstNowActive = getCurrentDstState();
        const baseLabel = formatOffsetLabel(baseTz);
        const activeLabel = formatOffsetLabel(baseTz + (isDstNowActive ? 1 : 0));
        tzBadgeEl.innerText = isDstNowActive ? `${baseLabel} / ${activeLabel}` : baseLabel;
    }

    updateSettingsDstNotice();
    updatePrimaryPlaceUI();
}

function getLastSundayOfMonth(year, month) {
    const lastDay = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0));
    const dayOfWeek = lastDay.getUTCDay();
    return lastDay.getUTCDate() - dayOfWeek;
}

function getNthSundayOfMonth(year, month, nth) {
    const firstDow = new Date(Date.UTC(year, month, 1, 12, 0, 0)).getUTCDay();
    const firstSunday = 1 + ((7 - firstDow) % 7);
    return firstSunday + ((nth - 1) * 7);
}

function getDstRuleForLocation(lat = cachedLat, lon = cachedLon) {
    let tz = '';
    try {
        if (!isNaN(lat) && !isNaN(lon) && typeof tzlookup === 'function') {
            tz = tzlookup(lat, lon) || '';
        }
    } catch (e) {
        tz = '';
    }

    if (!tz && isTimezoneOnlyMode) {
        const tzPresetEl = document.getElementById('timezone-preset');
        const offsetVal = tzPresetEl ? parseFloat(tzPresetEl.value) : null;
        if (offsetVal !== null && !isNaN(offsetVal)) {
            if (offsetVal >= -10 && offsetVal <= -4) return 'us';
            if (offsetVal >= 0 && offsetVal <= 4) return 'eu';
            if (offsetVal >= 9.5 && offsetVal <= 12) return 'au';
            return 'none';
        }
    }

    if (!tz) return 'eu';

    if (tz.startsWith('Africa/') || tz.startsWith('Asia/') || tz.startsWith('Indian/')) {
        return 'none';
    }

    const noDstZones = new Set([
        'America/Phoenix',
        'America/Hermosillo',
        'America/Mazatlan',
        'America/Cancun',
        'America/Regina',
        'America/Swift_Current',
        'America/Panama',
        'America/Jamaica',
        'America/Bogota',
        'America/Lima',
        'America/Guayaquil',
        'America/Caracas',
        'America/La_Paz',
        'America/Santiago',
        'America/Argentina/Buenos_Aires',
        'America/Sao_Paulo',
        'America/Montevideo',
        'Pacific/Honolulu',
        'Pacific/Guam',
        'Australia/Perth',
        'Australia/Brisbane',
        'Australia/Darwin'
    ]);
    if (noDstZones.has(tz)) {
        return 'none';
    }

    if (tz === 'Pacific/Auckland') {
        return 'nz';
    }
    if (tz.startsWith('Australia/')) {
        return 'au';
    }
    if (tz.startsWith('America/') || tz === 'Pacific/Honolulu') {
        return 'us';
    }
    if (tz.startsWith('Europe/') || tz === 'Atlantic/Canary' || tz === 'Atlantic/Faroe' || tz === 'Atlantic/Reykjavik') {
        return tz === 'Atlantic/Reykjavik' ? 'none' : 'eu';
    }

    return 'eu';
}

function evaluateDstByRule(rule, year, month, day, hour = 12, minute = 0, second = 0) {
    if (rule === 'none') return false;

    if (rule === 'eu') {
        const marchLast = getLastSundayOfMonth(year, 2);
        const octLast = getLastSundayOfMonth(year, 9);
        if (month < 2 || month > 9) return false;
        if (month > 2 && month < 9) return true;
        if (month === 2) {
            if (day > marchLast) return true;
            if (day < marchLast) return false;
            return (hour > 2) || (hour === 2 && (minute > 0 || second > 0));
        }
        if (month === 9) {
            if (day < octLast) return true;
            if (day > octLast) return false;
            return hour < 3;
        }
        return false;
    }

    if (rule === 'us') {
        const marchSecond = getNthSundayOfMonth(year, 2, 2);
        const novFirst = getNthSundayOfMonth(year, 10, 1);
        if (month < 2 || month > 10) return false;
        if (month > 2 && month < 10) return true;
        if (month === 2) {
            if (day > marchSecond) return true;
            if (day < marchSecond) return false;
            return (hour > 2) || (hour === 2 && (minute > 0 || second > 0));
        }
        if (month === 10) {
            if (day < novFirst) return true;
            if (day > novFirst) return false;
            return hour < 2;
        }
        return false;
    }

    if (rule === 'au') {
        const octFirst = getNthSundayOfMonth(year, 9, 1);
        const aprFirst = getNthSundayOfMonth(year, 3, 1);
        if (month > 9 || month < 3) return true;
        if (month === 9) {
            if (day > octFirst) return true;
            if (day < octFirst) return false;
            return (hour > 2) || (hour === 2 && (minute > 0 || second > 0));
        }
        if (month === 3) {
            if (day < aprFirst) return true;
            if (day > aprFirst) return false;
            return hour < 3;
        }
        return false;
    }

    if (rule === 'nz') {
        const sepLast = getLastSundayOfMonth(year, 8);
        const aprFirst = getNthSundayOfMonth(year, 3, 1);
        if (month > 8 || month < 3) return true;
        if (month === 8) {
            if (day > sepLast) return true;
            if (day < sepLast) return false;
            return (hour > 2) || (hour === 2 && (minute > 0 || second > 0));
        }
        if (month === 3) {
            if (day < aprFirst) return true;
            if (day > aprFirst) return false;
            return hour < 3;
        }
        return false;
    }

    return false;
}

function getDstTransitionHoursForRule(rule, year, month, day) {
    if (rule === 'eu') {
        if (month === 2 && day === getLastSundayOfMonth(year, 2)) {
            return { springFromH: 1, springFromM: 59, springToH: 3, fallFromH: null, fallFromM: null, fallToH: null };
        }
        if (month === 9 && day === getLastSundayOfMonth(year, 9)) {
            return { springFromH: null, springFromM: null, springToH: null, fallFromH: 2, fallFromM: 59, fallToH: 2 };
        }
    } else if (rule === 'us') {
        if (month === 2 && day === getNthSundayOfMonth(year, 2, 2)) {
            return { springFromH: 1, springFromM: 59, springToH: 3, fallFromH: null, fallFromM: null, fallToH: null };
        }
        if (month === 10 && day === getNthSundayOfMonth(year, 10, 1)) {
            return { springFromH: null, springFromM: null, springToH: null, fallFromH: 1, fallFromM: 59, fallToH: 1 };
        }
    } else if (rule === 'au') {
        if (month === 9 && day === getNthSundayOfMonth(year, 9, 1)) {
            return { springFromH: 1, springFromM: 59, springToH: 3, fallFromH: null, fallFromM: null, fallToH: null };
        }
        if (month === 3 && day === getNthSundayOfMonth(year, 3, 1)) {
            return { springFromH: null, springFromM: null, springToH: null, fallFromH: 2, fallFromM: 59, fallToH: 2 };
        }
    } else if (rule === 'nz') {
        if (month === 8 && day === getLastSundayOfMonth(year, 8)) {
            return { springFromH: 1, springFromM: 59, springToH: 3, fallFromH: null, fallFromM: null, fallToH: null };
        }
        if (month === 3 && day === getNthSundayOfMonth(year, 3, 1)) {
            return { springFromH: null, springFromM: null, springToH: null, fallFromH: 2, fallFromM: 59, fallToH: 2 };
        }
    }
    return null;
}

function isDstForLocalClock(refDate) {
    if (urlParams.has('dst')) {
        return urlParams.get('dst') === 'true';
    }

    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    if (!isAuto) {
        return localStorage.getItem('sunclock_dst') === 'true';
    }

    if (dstOverrideState !== null) {
        return dstOverrideState;
    }

    const rule = getDstRuleForLocation(cachedLat, cachedLon);
    const d = refDate || selectedDate || new Date();
    return evaluateDstByRule(
        rule,
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
        d.getUTCSeconds()
    );
}

function applyDstTransitionWhenAdvancing(prevDate, nextDate) {
    if (urlParams.has('dst')) return { date: nextDate, dstChanged: false };
    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    if (!isAuto) return { date: nextDate, dstChanged: false };

    const rule = getDstRuleForLocation(cachedLat, cachedLon);
    if (rule === 'none') return { date: nextDate, dstChanged: false };

    const prevY = prevDate.getUTCFullYear();
    const prevM = prevDate.getUTCMonth();
    const prevD = prevDate.getUTCDate();
    const prevH = prevDate.getUTCHours();
    const prevMin = prevDate.getUTCMinutes();

    const nextY = nextDate.getUTCFullYear();
    const nextM = nextDate.getUTCMonth();
    const nextD = nextDate.getUTCDate();
    const nextH = nextDate.getUTCHours();

    const tr = getDstTransitionHoursForRule(rule, prevY, prevM, prevD);
    if (!tr) return { date: nextDate, dstChanged: false };

    if (
        tr.springFromH !== null &&
        prevY === nextY && prevM === nextM && prevD === nextD &&
        prevH === tr.springFromH && prevMin === tr.springFromM && nextH > tr.springFromH
    ) {
        const adjusted = new Date(nextDate.getTime());
        adjusted.setUTCHours(tr.springToH, 0, 0, adjusted.getUTCMilliseconds());
        const prevDst = getCurrentDstState();
        dstOverrideState = true;
        syncManualDstCheckbox(true);
        return { date: adjusted, dstChanged: (prevDst !== true) };
    }

    if (
        tr.fallFromH !== null &&
        prevY === nextY && prevM === nextM && prevD === nextD &&
        prevH === tr.fallFromH && prevMin === tr.fallFromM && nextH > tr.fallFromH
    ) {
        const adjusted = new Date(nextDate.getTime());
        adjusted.setUTCHours(tr.fallToH, 0, 0, adjusted.getUTCMilliseconds());
        const prevDst = getCurrentDstState();
        dstOverrideState = false;
        syncManualDstCheckbox(false);
        return { date: adjusted, dstChanged: (prevDst !== false) };
    }

    return { date: nextDate, dstChanged: false };
}

function syncManualDstCheckbox(isDst) {
    const manualToggle = document.getElementById('manual-dst-toggle');
    if (manualToggle && manualToggle.checked !== isDst) {
        manualToggle.checked = isDst;
    }
    updateSettingsDstNotice();
}

function syncDstWithLocation(lat = cachedLat, lon = cachedLon, refDate = null) {
    if (urlParams.has('dst')) {
        urlParams.delete('dst');
    }

    const wasAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    localStorage.setItem('sunclock_auto_dst', 'true');
    dstOverrideState = null;

    const rule = getDstRuleForLocation(lat, lon);
    const d = refDate || new Date();
    const isDstNow = evaluateDstByRule(
        rule,
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate(),
        d.getUTCHours(),
        d.getUTCMinutes(),
        d.getUTCSeconds()
    );

    localStorage.setItem('sunclock_dst', isDstNow ? 'true' : 'false');

    const autoToggle = document.getElementById('auto-dst-toggle');
    if (autoToggle) {
        autoToggle.checked = true;
    }

    updateDstUI(true);
    syncManualDstCheckbox(isDstNow);
    updateSettingsDstNotice();
    return { isDstNow, wasAuto };
}

function getPreciseStandardTimezone(lat, lon) {
    if (lat >= 65.4 && lat <= 66.2 && lon >= -169.5 && lon <= -168.3) {
        if (lon < -168.9) {
            return 12;
        } else {
            return -9;
        }
    }

    if (lat >= 36.9 && lat <= 42.2 && lon >= -9.5 && lon <= -6.0) return 0;
    if (lat >= 51.4 && lat <= 55.5 && lon >= -10.7 && lon <= -5.3) return 0;
    if (lat >= 36.0 && lat <= 43.8 && lon >= -9.3 && lon <= 3.4) return 1;
    if (lat >= 42.3 && lat <= 51.1 && lon >= -5.1 && lon <= 8.3) return 1;

    try {
        if (typeof tzlookup === 'function') {
            const tzString = tzlookup(lat, lon);
            const now = selectedDate || new Date();
            const janDate = new Date(now.getUTCFullYear(), 0, 15);

            const dtf = new Intl.DateTimeFormat('en-US', {
                timeZone: tzString,
                timeZoneName: 'shortOffset'
            });
            const parts = dtf.formatToParts(janDate);
            const offsetPart = parts.find(p => p.type === 'timeZoneName');
            if (offsetPart) {
                const match = offsetPart.value.match(/GMT([+-]\d+)(?::(\d+))?/);
                if (match) {
                    const hours = parseInt(match[1], 10);
                    const minutes = match[2] ? parseInt(match[2], 10) / 60 : 0;
                    return hours + (hours < 0 ? -minutes : minutes);
                }
            }
        }
    } catch (e) {
        console.warn("Fallback su calcolo fuso geometrico", e);
    }

    return Math.round(lon / 15);
}

function getCurrentDstState() {
    return isDstForLocalClock(selectedDate);
}

function getBaseLocationOffset() {
    const standardTz = getPreciseStandardTimezone(cachedLat, cachedLon);
    const isDstNowActive = getCurrentDstState();
    return standardTz + (isDstNowActive ? 1 : 0);
}

function getTotalOffsetHours() {
    if (!isTimezoneOnlyMode) {
        return getBaseLocationOffset();
    }
    const tzPresetEl = document.getElementById('timezone-preset');
    if (!tzPresetEl) return getBaseLocationOffset();
    const baseTz = parseFloat(tzPresetEl.value);
    const isDstNowActive = getCurrentDstState();
    return baseTz + (isDstNowActive ? 1 : 0);
}

function hoursToAngle(h) {
    return (h / 24) * Math.PI * 2 + Math.PI / 2;
}

function removeTopDateTimeArrows() {
    const dateBtn = document.getElementById('date-display-btn');
    const dateInput = document.getElementById('input-date');
    const digitalClock = document.getElementById('digital-clock');
    const timeInput = document.getElementById('input-time');

    const isArrowNode = (node) => {
        if (!node) return false;
        if (node.nodeType === Node.TEXT_NODE) {
            const t = node.textContent.trim();
            return t === '<' || t === '>' || t === '‹' || t === '›' || t === '◀' || t === '▶';
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.closest('#panel-strip-body') || node.id === 'btn-toggle-year-strip') return false;
            if (node.id === 'date-display-btn' || node.id === 'input-date' || node.id === 'digital-clock' || node.id === 'input-time') return false;
            const txt = (node.innerText || node.textContent || '').trim();
            const title = (node.getAttribute('title') || '').toLowerCase();
            if (txt === '<' || txt === '>' || txt === '&lt;' || txt === '&gt;' || txt === '‹' || txt === '›' || txt === '◀' || txt === '▶') {
                return true;
            }
            if ((node.tagName === 'BUTTON' || node.tagName === 'A' || node.tagName === 'SPAN') &&
                (title.includes('giorno') || title.includes('data') || title.includes('ora') || title.includes('indietro') || title.includes('avanti')) &&
                txt.length <= 2) {
                return true;
            }
        }
        return false;
    };

    const removeAdjacentArrowsFrom = (anchor) => {
        if (!anchor || !anchor.parentElement) return;
        const parent = anchor.parentElement;
        const children = Array.from(parent.childNodes);
        children.forEach(child => {
            if (isArrowNode(child)) {
                child.remove();
            }
        });
    };

    removeAdjacentArrowsFrom(dateBtn);
    removeAdjacentArrowsFrom(dateInput);
    removeAdjacentArrowsFrom(digitalClock);
    removeAdjacentArrowsFrom(timeInput);

    const topContainer = (dateBtn && dateBtn.closest('header, nav, .top-bar, .controls-bar')) ||
                         (digitalClock && digitalClock.closest('header, nav, .top-bar, .controls-bar')) ||
                         document.querySelector('header');

    if (topContainer) {
        topContainer.querySelectorAll('button').forEach(btn => {
            if (btn.closest('#panel-strip-body') || btn.id === 'btn-toggle-year-strip') return;
            const txt = (btn.innerText || btn.textContent || '').trim();
            const fn = (btn.getAttribute('onclick') || '');
            if (txt === '<' || txt === '>' || txt === '‹' || txt === '›' || txt === '◀' || txt === '▶' ||
                fn.includes('changeDate') || fn.includes('changeHour')) {
                btn.remove();
            }
        });
    }
}

function updateCompactSunTimesRow() {
    const stripBody = document.getElementById('panel-strip-body');
    const clockBar = document.getElementById('strip-clock-bar');
    if (!stripBody) return;

    let row = document.getElementById('strip-sun-times-row');
    if (!row) {
        row = document.createElement('div');
        row.id = 'strip-sun-times-row';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.gap = '10px';
        row.style.width = '100%';
        row.style.boxSizing = 'border-box';
        row.style.marginTop = '8px';
        row.style.padding = '5px 10px';
        row.style.borderRadius = '6px';
        row.style.background = 'rgba(15, 23, 42, 0.85)';
        row.style.border = '1px solid #334155';
        row.style.fontSize = '0.86rem';
        row.style.lineHeight = '1.2';
        row.style.fontWeight = 'bold';
        row.style.color = '#f8fafc';
        row.style.textShadow = 'none';
        row.style.webkitTextStroke = '0px transparent';

        if (clockBar && clockBar.parentElement === stripBody) {
            clockBar.insertAdjacentElement('afterend', row);
        } else {
            stripBody.appendChild(row);
        }
    } else {
        row.style.fontSize = '0.86rem';
        row.style.lineHeight = '1.2';
        row.style.fontWeight = 'bold';
    }

    const sunriseTxt = isTimezoneOnlyMode
        ? '----'
        : (cachedTimes && isValidDate(cachedTimes.sunrise)
            ? formatTime(cachedTimes.sunrise)
            : (document.getElementById('txt-sunrise')?.innerText || '--:--'));

    const sunsetTxt = isTimezoneOnlyMode
        ? '----'
        : (cachedTimes && isValidDate(cachedTimes.sunset)
            ? formatTime(cachedTimes.sunset)
            : (document.getElementById('txt-sunset')?.innerText || '--:--'));

    row.innerHTML = `
        <span style="white-space:nowrap;color:#fb923c;font-size:0.86rem;line-height:1.2;font-weight:bold;">🌅 Sorge: <strong style="color:#f8fafc;font-size:0.86rem;line-height:1.2;font-weight:bold;">${sunriseTxt}</strong></span>
        <span style="white-space:nowrap;color:#facc15;font-size:0.86rem;line-height:1.2;font-weight:bold;">🌇 Tramonta: <strong style="color:#f8fafc;font-size:0.86rem;line-height:1.2;font-weight:bold;">${sunsetTxt}</strong></span>
    `;
}

function ensureStripClockBar() {
    const stripBody = document.getElementById('panel-strip-body');
    if (!stripBody) return;

    stripBody.style.display = isStripOpen ? 'flex' : '';
    stripBody.style.flexDirection = 'column';
    stripBody.style.overflow = 'visible';

    const stage = stripBody.querySelector('.strip-stage') || document.getElementById('timeline-viewport') || stripBody.lastElementChild;
    if (!stage) return;

    let clockBar = document.getElementById('strip-clock-bar');
    if (!clockBar) {
        clockBar = document.createElement('div');
        clockBar.id = 'strip-clock-bar';
        clockBar.style.display = 'flex';
        clockBar.style.alignItems = 'center';
        clockBar.style.justifyContent = 'center';
        clockBar.style.gap = '8px';
        clockBar.style.marginTop = '6px';
        clockBar.style.paddingTop = '2px';
        clockBar.style.width = '100%';
        clockBar.style.boxSizing = 'border-box';
        clockBar.style.position = 'relative';
        clockBar.style.zIndex = '30';

        clockBar.innerHTML = `
            <button type="button" id="strip-time-prev" class="strip-year-step" onclick="changeHour(-1)" title="Un'ora indietro" style="background-color:#0f172a;color:#38bdf8;border:1px solid #38bdf8;border-radius:6px;padding:3px 9px;font-weight:bold;cursor:pointer;text-shadow:none;-webkit-text-stroke:0px transparent;">&lt;</button>
            <div id="strip-clock-readout" onclick="const t = document.getElementById('input-time'); if (t && typeof t.showPicker === 'function') t.showPicker();" title="Imposta ora" style="background:#0f172a;color:#39ff14;border:1px solid #38bdf8;border-radius:6px;padding:3px 12px;font-size:0.95rem;font-weight:bold;cursor:pointer;letter-spacing:0.5px;text-shadow:none;-webkit-text-stroke:0px transparent;">00:00:00</div>
            <button type="button" id="strip-time-next" class="strip-year-step" onclick="changeHour(1)" title="Un'ora in avanti" style="background-color:#0f172a;color:#38bdf8;border:1px solid #38bdf8;border-radius:6px;padding:3px 9px;font-weight:bold;cursor:pointer;text-shadow:none;-webkit-text-stroke:0px transparent;">&gt;</button>
        `;

        if (stage.parentElement === stripBody) {
            stage.insertAdjacentElement('afterend', clockBar);
        } else {
            stripBody.appendChild(clockBar);
        }
    } else {
        clockBar.style.marginTop = '6px';
        clockBar.style.gap = '8px';
    }

    const srcClock = document.getElementById('digital-clock');
    const dstClock = document.getElementById('strip-clock-readout');
    if (srcClock && dstClock) {
        dstClock.innerText = srcClock.innerText || '00:00:00';
    }

    updateCompactSunTimesRow();
}

function styleStripButtonVisibility(btn, active) {
    if (!btn) return;
    btn.style.backgroundColor = active ? '#0284c7' : '#0f172a';
    btn.style.color = active ? '#ffffff' : '#38bdf8';
    btn.style.border = active ? '1px solid #e0f2fe' : '1px solid #38bdf8';
    btn.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.55)';
    btn.style.textShadow = 'none';
    btn.style.webkitTextStroke = '0px transparent';
}

function styleTodayButton(btn) {
    if (!btn) return;
    btn.style.backgroundColor = '#1d4ed8';
    btn.style.color = '#fef08a';
    btn.style.border = '1px solid #93c5fd';
    btn.style.fontWeight = 'bold';
    btn.style.cursor = 'pointer';
    btn.style.padding = '3px 8px';
    btn.style.borderRadius = '6px';
    btn.style.textShadow = 'none';
    btn.style.webkitTextStroke = '0px transparent';
}

function styleStripControlsVisibility() {
    const stripBody = document.getElementById('panel-strip-body');
    if (!stripBody) return;

    stripBody.style.textShadow = 'none';
    stripBody.style.webkitTextStroke = '0px transparent';
    stripBody.style.color = '#f8fafc';

    stripBody.querySelectorAll('button, select, span, label').forEach(el => {
        el.style.textShadow = 'none';
        el.style.webkitTextStroke = '0px transparent';
    });

    stripBody.querySelectorAll('button').forEach(btn => {
        if (btn.id === 'btn-strip-today') {
            styleTodayButton(btn);
        } else if (btn.id === 'strip-cursor-left' || btn.id === 'strip-cursor-right') {
            btn.style.backgroundColor = 'rgba(15, 23, 42, 0.92)';
            btn.style.color = '#38bdf8';
            btn.style.border = '1px solid #38bdf8';
        } else if (btn.id === 'strip-time-prev' || btn.id === 'strip-time-next') {
            btn.style.backgroundColor = '#0f172a';
            btn.style.color = '#38bdf8';
            btn.style.border = '1px solid #38bdf8';
        } else {
            btn.style.backgroundColor = '#0f172a';
            btn.style.color = '#f8fafc';
            btn.style.border = '1px solid #38bdf8';
        }
    });

    stripBody.querySelectorAll('select').forEach(sel => {
        sel.style.backgroundColor = '#0f172a';
        sel.style.color = '#facc15';
        sel.style.border = '1px solid #38bdf8';
    });
}

function removeBottomRedundantFooter() {
    const stripBody = document.getElementById('panel-strip-body');
    if (!stripBody) return;

    const stage = stripBody.querySelector('.strip-stage');
    if (stage) {
        let nextEl = stage.nextElementSibling;
        while (nextEl) {
            const toRemove = nextEl;
            nextEl = nextEl.nextElementSibling;
            if (toRemove.id !== 'strip-clock-bar' && toRemove.id !== 'strip-sun-times-row') {
                toRemove.remove();
            }
        }
    }

    stripBody.querySelectorAll('div, span, p, small, label').forEach(el => {
        if (
            el.id === 'timeline-viewport' ||
            el.id === 'timeline-track' ||
            el.id === 'strip-clock-bar' ||
            el.id === 'strip-clock-readout' ||
            el.id === 'strip-sun-times-row' ||
            el.classList.contains('strip-year-bar') ||
            el.classList.contains('strip-stage') ||
            el.classList.contains('strip-center-cursor')
        ) return;

        const txt = (el.textContent || '').trim().toLowerCase();
        if (txt.includes('giallo') || txt === 'anno:' || txt === 'anno') {
            el.remove();
        }
    });
}

function adaptBottomPanelHeight(forceMeasure = false) {
    ensureStripClockBar();

    const stripBody = document.getElementById('panel-strip-body');
    const container = document.getElementById('bottom-panels-container') || (stripBody && stripBody.closest('[id*="panel"], [class*="panel"]'));
    const panelBox = container ? (container.querySelector('.info-panel-box') || container) : stripBody;
    if (!container || !panelBox) return;

    container.style.height = 'auto';
    container.style.minHeight = '0px';
    container.style.maxHeight = 'none';
    container.style.overflow = 'visible';

    panelBox.style.height = 'auto';
    panelBox.style.minHeight = '0px';
    panelBox.style.maxHeight = 'none';
    panelBox.style.overflow = 'visible';

    if (stripBody) {
        stripBody.style.height = 'auto';
        stripBody.style.maxHeight = 'none';
        stripBody.style.overflow = 'visible';
    }

    if (!forceMeasure && container.dataset.heightLocked === 'true') {
        return;
    }

    requestAnimationFrame(() => {
        const neededHeight = Math.max(
            panelBox.scrollHeight || 0,
            panelBox.offsetHeight || 0,
            stripBody ? (stripBody.scrollHeight + 46) : 0
        );
        if (neededHeight > 0) {
            container.style.minHeight = `${neededHeight + 8}px`;
            container.dataset.heightLocked = 'true';
        }
    });
}

function getDayKey(d) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function syncMonthSelectorValue(monthIdx) {
    const monthSel = document.getElementById('select-strip-month');
    if (monthSel && String(monthIdx) !== monthSel.value) {
        monthSel.value = String(monthIdx);
    }
}

function ensureYearAndMonthSelectors(currentYear, currentMonth) {
    const stripBody = document.getElementById('panel-strip-body');
    if (!stripBody) return;

    removeBottomRedundantFooter();

    let yearBar = stripBody.querySelector('.strip-year-bar');
    if (!yearBar) {
        yearBar = document.createElement('div');
        yearBar.className = 'strip-year-bar';
        stripBody.insertBefore(yearBar, stripBody.firstChild);
    }

    yearBar.style.display = 'flex';
    yearBar.style.flexWrap = 'wrap';
    yearBar.style.alignItems = 'center';
    yearBar.style.justifyContent = 'center';
    yearBar.style.gap = '6px';
    yearBar.style.marginBottom = '6px';

    let yearPrevBtn = document.getElementById('btn-year-prev');
    let yearSel = document.getElementById('select-strip-year');
    let yearNextBtn = document.getElementById('btn-year-next');

    if (!yearPrevBtn || !yearSel || !yearNextBtn) {
        yearBar.innerHTML = `
            <div style="display:inline-flex;align-items:center;gap:4px;">
                <button type="button" id="btn-year-prev" class="strip-year-step" onclick="stepYear(-1)" title="Anno precedente">&lt;</button>
                <select id="select-strip-year" class="strip-year-select" onchange="onYearSelectChanged(this.value)" title="Seleziona anno"></select>
                <button type="button" id="btn-year-next" class="strip-year-step" onclick="stepYear(1)" title="Anno successivo">&gt;</button>
            </div>
            <div style="display:inline-flex;align-items:center;gap:4px;">
                <button type="button" id="btn-month-prev" class="strip-year-step" onclick="stepMonth(-1)" title="Mese precedente">&lt;</button>
                <select id="select-strip-month" class="strip-year-select" onchange="onMonthSelectChanged(this.value)" title="Seleziona mese"></select>
                <button type="button" id="btn-month-next" class="strip-year-step" onclick="stepMonth(1)" title="Mese successivo">&gt;</button>
            </div>
            <button type="button" id="btn-strip-today" class="strip-year-step" onclick="goToTodayOnStrip()" title="Torna ad oggi">Oggi</button>
        `;
        yearSel = document.getElementById('select-strip-year');
    } else if (!document.getElementById('btn-strip-today')) {
        const todayBtn = document.createElement('button');
        todayBtn.type = 'button';
        todayBtn.id = 'btn-strip-today';
        todayBtn.className = 'strip-year-step';
        todayBtn.title = 'Torna ad oggi';
        todayBtn.innerText = 'Oggi';
        todayBtn.onclick = goToTodayOnStrip;
        yearBar.appendChild(todayBtn);
    }

    const startY = Math.min(2020, currentYear - 5);
    const endY = Math.max(2035, currentYear + 5);
    if (
        yearSel.options.length === 0 ||
        parseInt(yearSel.options[0].value, 10) > currentYear ||
        parseInt(yearSel.options[yearSel.options.length - 1].value, 10) < currentYear
    ) {
        yearSel.innerHTML = '';
        for (let y = startY; y <= endY; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearSel.appendChild(opt);
        }
    }
    yearSel.value = String(currentYear);

    const monthSel = document.getElementById('select-strip-month');
    if (monthSel) {
        if (monthSel.options.length !== 12) {
            monthSel.innerHTML = '';
            for (let m = 0; m < 12; m++) {
                const label = new Date(Date.UTC(2026, m, 1)).toLocaleDateString('it-IT', { month: 'long', timeZone: 'UTC' });
                const capLabel = label.charAt(0).toUpperCase() + label.slice(1);
                const opt = document.createElement('option');
                opt.value = String(m);
                opt.textContent = capLabel;
                monthSel.appendChild(opt);
            }
        }
        monthSel.value = String(currentMonth);
    }

    ensureStripClockBar();
    styleStripControlsVisibility();
}

function goToTodayOnStrip() {
    resetToNow();
    if (isStripOpen) {
        ensureYearStripBuilt(selectedDate.getUTCFullYear());
        syncStripToSelectedDate(true);
    }
    adaptBottomPanelHeight(true);
}

function onYearSelectChanged(val) {
    const targetYear = parseInt(val, 10);
    if (isNaN(targetYear)) return;
    const currentMonth = selectedDate.getUTCMonth();
    const maxDay = new Date(Date.UTC(targetYear, currentMonth + 1, 0)).getUTCDate();
    const safeDay = Math.min(selectedDate.getUTCDate(), maxDay);
    applyStripDateChange(targetYear, currentMonth, safeDay, false);
}

function stepYear(delta) {
    const nextYear = selectedDate.getUTCFullYear() + delta;
    const currentMonth = selectedDate.getUTCMonth();
    const maxDay = new Date(Date.UTC(nextYear, currentMonth + 1, 0)).getUTCDate();
    const safeDay = Math.min(selectedDate.getUTCDate(), maxDay);
    applyStripDateChange(nextYear, currentMonth, safeDay, false);
}

function onMonthSelectChanged(val) {
    const targetMonth = parseInt(val, 10);
    if (isNaN(targetMonth)) return;
    const currentYear = selectedDate.getUTCFullYear();
    const maxDay = new Date(Date.UTC(currentYear, targetMonth + 1, 0)).getUTCDate();
    const safeDay = Math.min(selectedDate.getUTCDate(), maxDay);
    applyStripDateChange(currentYear, targetMonth, safeDay, true);
}

function stepMonth(delta) {
    const base = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth() + delta, 1, 12, 0, 0));
    const nextYear = base.getUTCFullYear();
    const nextMonth = base.getUTCMonth();
    const maxDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
    const safeDay = Math.min(selectedDate.getUTCDate(), maxDay);
    applyStripDateChange(nextYear, nextMonth, safeDay, true);
}

function toggleYearStrip() {
    isStripOpen = !isStripOpen;
    const stdBody = document.getElementById('panel-standard-body');
    const stripBody = document.getElementById('panel-strip-body');
    const btn = document.getElementById('btn-toggle-year-strip');
    const container = document.getElementById('bottom-panels-container') || (stripBody && stripBody.closest('[id*="panel"], [class*="panel"]'));
    if (container) {
        container.dataset.heightLocked = 'false';
    }

    removeBottomRedundantFooter();

    if (isStripOpen) {
        if (stdBody) stdBody.style.display = 'none';
        if (stripBody) stripBody.classList.add('active');
        if (btn) {
            btn.classList.add('active');
            btn.innerText = '✕ Dati';
            styleStripButtonVisibility(btn, true);
        }
        ensureYearAndMonthSelectors(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth());
        ensureYearStripBuilt(selectedDate.getUTCFullYear());
        syncStripToSelectedDate(false);
    } else {
        if (stripBody) stripBody.classList.remove('active');
        if (stdBody) stdBody.style.display = 'flex';
        if (btn) {
            btn.classList.remove('active');
            btn.innerText = '⏱️ Striscia';
            styleStripButtonVisibility(btn, false);
        }
    }
    ensureStripClockBar();
    adaptBottomPanelHeight(true);
}

function setActiveTickElement(newTick) {
    if (activeTickEl === newTick) return;
    if (activeTickEl) {
        activeTickEl.classList.remove('active');
    }
    activeTickEl = newTick || null;
    if (activeTickEl) {
        activeTickEl.classList.add('active');
    }
}

function ensureYearStripBuilt(year) {
    ensureYearAndMonthSelectors(year, selectedDate.getUTCMonth());
    if (builtYear === year) return;
    builtYear = year;

    const track = document.getElementById('timeline-track');
    if (!track) return;
    track.innerHTML = '';
    tickElements = [];
    activeTickEl = null;

    const todayKey = getDayKey(getEffectiveDate());
    const selectedKey = getDayKey(selectedDate);
    const cursor = new Date(Date.UTC(year, 0, 1, 12, 0, 0));
    const fragment = document.createDocumentFragment();

    while (cursor.getUTCFullYear() === year) {
        const dCopy = new Date(cursor);
        const key = getDayKey(dCopy);
        const moon = (typeof SunCalc.getMoonData === 'function')
            ? SunCalc.getMoonData(dCopy)
            : SunCalc.getMoonIllumination(dCopy);
        const pct = Math.round(moon.fraction * 100);

        const tick = document.createElement('div');
        const isSelected = (key === selectedKey);
        tick.className = 'timeline-tick' + (key === todayKey ? ' is-today' : '') + (isSelected ? ' active' : '');
        tick.dataset.dayKey = key;
        tick.dataset.year = dCopy.getUTCFullYear();
        tick.dataset.month = dCopy.getUTCMonth();
        tick.dataset.day = dCopy.getUTCDate();
        tick.style.textShadow = 'none';
        tick.style.webkitTextStroke = '0px transparent';
        tick.style.minWidth = '60px';
        tick.style.padding = '6px 6px';
        tick.style.display = 'flex';
        tick.style.flexDirection = 'column';
        tick.style.alignItems = 'center';
        tick.style.justifyContent = 'center';
        tick.style.gap = '3px';

        const dayNum = String(dCopy.getUTCDate()).padStart(2, '0');
        const monthShort = dCopy.toLocaleDateString('it-IT', { month: 'short', timeZone: 'UTC' }).replace('.', '');

        tick.innerHTML = `
            <span style="font-size:0.86rem; font-weight:bold; line-height:1.2;">${dayNum} ${monthShort}</span>
            <span style="font-size:0.80rem; font-weight:bold; color:#facc15; line-height:1.2;">${pct}%</span>
        `;

        tick.onclick = () => {
            applyStripDateChange(dCopy.getUTCFullYear(), dCopy.getUTCMonth(), dCopy.getUTCDate(), true);
        };

        if (isSelected) {
            activeTickEl = tick;
        }
        tickElements.push(tick);
        fragment.appendChild(tick);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    track.appendChild(fragment);
}

function syncStripToSelectedDate(smooth = false) {
    const viewport = document.getElementById('timeline-viewport');
    const track = document.getElementById('timeline-track');
    if (!viewport || !track) return;

    const activeKey = getDayKey(selectedDate);
    let targetTick = null;

    for (let i = 0; i < tickElements.length; i++) {
        const tick = tickElements[i];
        if (tick.dataset.dayKey === activeKey) {
            targetTick = tick;
            break;
        }
    }

    setActiveTickElement(targetTick);
    syncMonthSelectorValue(selectedDate.getUTCMonth());

    if (targetTick) {
        isProgrammaticScroll = true;
        const targetScrollLeft = targetTick.offsetLeft + (targetTick.offsetWidth / 2) - (viewport.clientWidth / 2);
        viewport.scrollTo({
            left: Math.max(0, targetScrollLeft),
            behavior: smooth ? 'smooth' : 'auto'
        });
        clearTimeout(scrollEndTimer);
        scrollEndTimer = setTimeout(() => { isProgrammaticScroll = false; }, smooth ? 240 : 40);
    }
}

function commitDateFromStrip(y, m, d, heavy = false) {
    dstOverrideState = null;
    selectedDate.setUTCFullYear(y, m, d);
    isCustomTime = true;
    lastUpdateMs = performance.now();
    syncMonthSelectorValue(m);
    syncManualDstCheckbox(getCurrentDstState());

    const targetOffset = getTotalOffsetHours();
    const realEffectiveNow = new Date(Date.now() + (targetOffset * 3600000));
    customTimeOffsetMs = selectedDate.getTime() - realEffectiveNow.getTime();

    updateInputsVal();

    if (isTimezoneOnlyMode) {
        applyTimezonePreset();
        return;
    }

    if (heavy) {
        if (sunClockRafId) {
            cancelAnimationFrame(sunClockRafId);
            sunClockRafId = null;
        }
        updateSunClock(cachedLat, cachedLon);
    } else if (!sunClockRafId) {
        sunClockRafId = requestAnimationFrame(() => {
            sunClockRafId = null;
            if (!isStripOpen || isTimezoneOnlyMode) return;
            updateSunClock(cachedLat, cachedLon);
        });
    }
}

function applyStripDateChange(y, m, d, smoothScroll = false) {
    commitDateFromStrip(y, m, d, true);
    if (isStripOpen) {
        ensureYearStripBuilt(y);
        syncStripToSelectedDate(smoothScroll);
    }
    adaptBottomPanelHeight(true);
}

const stripViewportEl = document.getElementById('timeline-viewport');
if (stripViewportEl) {
    stripViewportEl.style.webkitOverflowScrolling = 'touch';
    stripViewportEl.style.touchAction = 'pan-x';
    stripViewportEl.style.scrollSnapType = 'none';

    stripViewportEl.addEventListener('scroll', () => {
        if (!isStripOpen || isProgrammaticScroll || tickElements.length === 0) return;

        if (scrollRafId) return;
        scrollRafId = requestAnimationFrame(() => {
            scrollRafId = null;

            const centerX = stripViewportEl.scrollLeft + (stripViewportEl.clientWidth / 2);
            let closestTick = null;
            let minDist = Infinity;

            for (let i = 0; i < tickElements.length; i++) {
                const tick = tickElements[i];
                const tickCenter = tick.offsetLeft + (tick.offsetWidth / 2);
                const dist = Math.abs(centerX - tickCenter);
                if (dist < minDist) {
                    minDist = dist;
                    closestTick = tick;
                }
            }

            if (closestTick) {
                setActiveTickElement(closestTick);
                const m = parseInt(closestTick.dataset.month, 10);
                syncMonthSelectorValue(m);

                if (closestTick.dataset.dayKey !== getDayKey(selectedDate)) {
                    const y = parseInt(closestTick.dataset.year, 10);
                    const d = parseInt(closestTick.dataset.day, 10);
                    commitDateFromStrip(y, m, d, false);
                }
            }
        });
    }, { passive: true });
}

(function enableMouseStripNavigation() {
    const viewport = document.getElementById('timeline-viewport');
    if (!viewport) return;

    const cursor = viewport.parentElement ? viewport.parentElement.querySelector('.strip-center-cursor') : null;
    if (cursor) {
        cursor.style.pointerEvents = 'none';
    }

    viewport.addEventListener('wheel', (e) => {
        if (!isStripOpen) return;
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (delta !== 0) {
            e.preventDefault();
            viewport.scrollLeft += delta;
        }
    }, { passive: false });

    let isMouseDragging = false;
    let dragStartX = 0;
    let dragStartScrollLeft = 0;
    let hasDragged = false;

    viewport.style.cursor = 'grab';

    viewport.addEventListener('mousedown', (e) => {
        if (e.button !== 0 || !isStripOpen) return;
        isMouseDragging = true;
        hasDragged = false;
        dragStartX = e.clientX;
        dragStartScrollLeft = viewport.scrollLeft;
        viewport.style.cursor = 'grabbing';
        viewport.style.userSelect = 'none';
    });

    window.addEventListener('mousemove', (e) => {
        if (!isMouseDragging) return;
        const dx = e.clientX - dragStartX;
        if (Math.abs(dx) > 4) {
            hasDragged = true;
        }
        viewport.scrollLeft = dragStartScrollLeft - dx;
    });

    window.addEventListener('mouseup', () => {
        if (!isMouseDragging) return;
        isMouseDragging = false;
        viewport.style.cursor = 'grab';
        viewport.style.userSelect = '';
        if (hasDragged) {
            setTimeout(() => { hasDragged = false; }, 0);
        }
    });

    viewport.addEventListener('click', (e) => {
        if (hasDragged) {
            e.preventDefault();
            e.stopPropagation();
        }
    }, true);
})();

(function setupSideStripCursors() {
    const viewport = document.getElementById('timeline-viewport');
    if (!viewport) return;

    viewport.style.scrollSnapType = 'none';
    viewport.querySelectorAll('.timeline-tick').forEach(t => {
        t.style.scrollSnapAlign = 'none';
    });

    const stage = viewport.parentElement || viewport;
    if (getComputedStyle(stage).position === 'static') {
        stage.style.position = 'relative';
    }

    let leftBtn = document.getElementById('strip-cursor-left');
    let rightBtn = document.getElementById('strip-cursor-right');

    const createCursorBtn = (id, symbol, side) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = id;
        btn.innerText = symbol;
        btn.setAttribute('aria-label', side === 'left' ? 'Scorri a sinistra' : 'Scorri a destra');
        btn.style.position = 'absolute';
        btn.style.top = '50%';
        btn.style[side] = '4px';
        btn.style.transform = 'translateY(-50%)';
        btn.style.zIndex = '25';
        btn.style.width = '28px';
        btn.style.height = '38px';
        btn.style.borderRadius = '6px';
        btn.style.backgroundColor = 'rgba(15, 23, 42, 0.92)';
        btn.style.color = '#38bdf8';
        btn.style.border = '1px solid #38bdf8';
        btn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.65)';
        btn.style.fontSize = '0.9rem';
        btn.style.fontWeight = 'bold';
        btn.style.cursor = 'pointer';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.textShadow = 'none';
        btn.style.webkitTextStroke = '0px transparent';
        btn.style.userSelect = 'none';
        btn.style.touchAction = 'none';
        return btn;
    };

    if (!leftBtn) {
        leftBtn = createCursorBtn('strip-cursor-left', '◀', 'left');
        stage.appendChild(leftBtn);
    }
    if (!rightBtn) {
        rightBtn = createCursorBtn('strip-cursor-right', '▶', 'right');
        stage.appendChild(rightBtn);
    }

    let holdAnimId = null;
    let holdTimeout = null;
    let currentDir = 0;

    const emitScroll = () => {
        viewport.dispatchEvent(new Event('scroll'));
    };

    const stepFast = (dir) => {
        viewport.style.scrollSnapType = 'none';
        const stepPx = Math.max(140, Math.round(viewport.clientWidth * 0.65));
        viewport.scrollLeft += dir * stepPx;
        emitScroll();
    };

    const startContinuousScroll = (dir) => {
        stopContinuousScroll();
        currentDir = dir;
        stepFast(dir);

        holdTimeout = setTimeout(() => {
            const speedPxPerFrame = 18;
            const tick = () => {
                if (currentDir !== dir) {
                    stopContinuousScroll();
                    return;
                }
                viewport.scrollLeft += dir * speedPxPerFrame;
                emitScroll();
                holdAnimId = requestAnimationFrame(tick);
            };
            holdAnimId = requestAnimationFrame(tick);
        }, 160);
    };

    const stopContinuousScroll = () => {
        currentDir = 0;
        clearTimeout(holdTimeout);
        holdTimeout = null;
        if (holdAnimId) {
            cancelAnimationFrame(holdAnimId);
            holdAnimId = null;
        }
    };

    const bindCursorEvents = (btn, dir) => {
        btn.onmousedown = null;
        btn.ontouchstart = null;

        btn.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startContinuousScroll(dir);
        });

        btn.addEventListener('mousedown', (e) => {
            if (e.pointerType) return;
            e.preventDefault();
            e.stopPropagation();
            startContinuousScroll(dir);
        });

        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startContinuousScroll(dir);
        }, { passive: false });
    };

    bindCursorEvents(leftBtn, -1);
    bindCursorEvents(rightBtn, 1);

    window.addEventListener('pointerup', stopContinuousScroll);
    window.addEventListener('pointercancel', stopContinuousScroll);
    window.addEventListener('mouseup', stopContinuousScroll);
    window.addEventListener('touchend', stopContinuousScroll);
    window.addEventListener('touchcancel', stopContinuousScroll);
    window.addEventListener('blur', stopContinuousScroll);
})();

async function initClock() {
    removeTopDateTimeArrows();
    ensureYearAndMonthSelectors(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth());
    styleStripButtonVisibility(document.getElementById('btn-toggle-year-strip'), isStripOpen);

    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    const isManualDst = getCurrentDstState();

    const autoToggle = document.getElementById('auto-dst-toggle');
    const manualToggle = document.getElementById('manual-dst-toggle');
    if (autoToggle) autoToggle.checked = isAuto;
    if (manualToggle) manualToggle.checked = isManualDst;
    updateDstUI(isAuto);

    drawRealisticSun('sun-clock-canvas');

    if (urlParams.has('lat') && urlParams.has('lon')) {
        isTimezoneOnlyMode = false;
        cachedLat = parseFloat(urlParams.get('lat'));
        cachedLon = parseFloat(urlParams.get('lon'));
        currentPlaceDisplayName = urlParams.get('city') ? decodeURIComponent(urlParams.get('city')) : "Località";
        updateGpsStatusBanner('off');

        syncSettingsCoordsDisplay(cachedLat, cachedLon);

        lastUpdateMs = performance.now();
        updateTimeForLocation();
        updateInputsVal();
        updateSunClock(cachedLat, cachedLon);
        if (isStripOpen) {
            ensureYearStripBuilt(selectedDate.getUTCFullYear());
            syncStripToSelectedDate(false);
        }
        adaptBottomPanelHeight(true);
        return;
    }

    const primaryMode = getPrimaryLocationMode();
    const savedPlace = getSharedPlaceFromStorage();
    if (primaryMode === 'manual' && savedPlace) {
        isTimezoneOnlyMode = false;
        cachedLat = savedPlace.lat;
        cachedLon = savedPlace.lon;
        currentPlaceDisplayName = (savedPlace.name && savedPlace.name.trim()) || "Posizione Primaria";
        updateGpsStatusBanner('manual');

        syncSettingsCoordsDisplay(cachedLat, cachedLon);

        lastUpdateMs = performance.now();
        updateTimeForLocation();
        updateInputsVal();
        updateSunClock(cachedLat, cachedLon);
        if (isStripOpen) {
            ensureYearStripBuilt(selectedDate.getUTCFullYear());
            syncStripToSelectedDate(false);
        }
        adaptBottomPanelHeight(true);
        return;
    }

    const loadDefaultLocation = () => {
        isTimezoneOnlyMode = false;
        cachedLat = 45.05;
        cachedLon = 9.69;
        currentPlaceDisplayName = "Piacenza - Italia";
        syncGpsStatusBannerWithCurrentState();

        syncSettingsCoordsDisplay(cachedLat, cachedLon);

        lastUpdateMs = performance.now();
        updateTimeForLocation();
        updateInputsVal();
        updateSunClock(cachedLat, cachedLon);
        if (isStripOpen) {
            ensureYearStripBuilt(selectedDate.getUTCFullYear());
            syncStripToSelectedDate(false);
        }
        adaptBottomPanelHeight(true);
    };

    if (navigator.geolocation) {
        let gpsFinished = false;

        const gpsTimeout = setTimeout(() => {
            if (!gpsFinished) {
                gpsFinished = true;
                loadDefaultLocation();
            }
        }, 3000);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (gpsFinished) return;
                gpsFinished = true;
                clearTimeout(gpsTimeout);
                isGpsActiveConfirmed = true;
                updateGpsStatusBanner('active');
                fetchAndUpdateLocation(position.coords.latitude, position.coords.longitude, "Posizione Corrente");
            },
            (error) => {
                if (gpsFinished) return;
                gpsFinished = true;
                clearTimeout(gpsTimeout);
                isGpsActiveConfirmed = false;
                loadDefaultLocation();
            },
            { timeout: 2500, enableHighAccuracy: false, maximumAge: 60000 }
        );
    } else {
        loadDefaultLocation();
    }
}

let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        const stripBody = document.getElementById('panel-strip-body');
        const container = document.getElementById('bottom-panels-container') || (stripBody && stripBody.closest('[id*="panel"], [class*="panel"]'));
        if (container) {
            container.dataset.heightLocked = 'false';
        }
        removeTopDateTimeArrows();
        adaptBottomPanelHeight(true);
        if (isStripOpen) {
            syncStripToSelectedDate(false);
        }
        if (cachedTimes) {
            ctx.clearRect(0, 0, 500, 500);
            drawSunSlicesSafe(cachedTimes);
            drawMoonVisibilityArc(cachedMoonTimes, selectedDate);
            drawSolarMeridianLines(cachedTimes);
            drawMinuteRingSafe();
            drawClockNumbers();
            updatePageBackground(cachedTimes);
            if (window.AndroidInterface && typeof window.AndroidInterface.updateColors === 'function') {
                const h = selectedDate.getUTCHours() + selectedDate.getUTCMinutes() / 60 + selectedDate.getUTCSeconds() / 3600;
                const currentColor = getIntervalColorSafe(h, cachedTimes);
                const finalBg = currentColor === PALETTE.night ? '#000000' : currentColor;
                window.AndroidInterface.updateColors(finalBg);
            }
        }
    }, 120);
});

function toggleAutoDST(checked) {
    localStorage.setItem('sunclock_auto_dst', checked ? 'true' : 'false');
    dstOverrideState = null;
    updateDstUI(checked);
    if (!isCustomTime) {
        updateTimeForLocation();
    }
    if (isTimezoneOnlyMode) {
        applyTimezonePreset();
    } else {
        updateSunClock(cachedLat, cachedLon);
    }
    updateSettingsDstNotice();
}

function toggleManualDST(checked) {
    localStorage.setItem('sunclock_dst', checked ? 'true' : 'false');
    dstOverrideState = checked;
    if (!isCustomTime) {
        updateTimeForLocation();
    }
    if (isTimezoneOnlyMode) {
        applyTimezonePreset();
    } else {
        updateSunClock(cachedLat, cachedLon);
    }
    updateSettingsDstNotice();
}

function updateDstUI(isAuto) {
    const manualBox = document.getElementById('manual-dst-box');
    const manualInput = document.getElementById('manual-dst-toggle');

    if (!manualBox || !manualInput) return;

    if (isAuto) {
        manualBox.style.opacity = "0.4";
        manualInput.disabled = true;
        manualInput.checked = getCurrentDstState();
    } else {
        manualBox.style.opacity = "1.0";
        manualInput.disabled = false;
        manualInput.checked = localStorage.getItem('sunclock_dst') === 'true';
    }
    updateSettingsDstNotice();
}

function applyTimezonePreset() {
    const tzVal = document.getElementById('timezone-preset').value;
    isTimezoneOnlyMode = true;

    if (!isCustomTime) {
        selectedDate = getEffectiveDate();
    }
    updateInputsVal();

    const baseTzNum = parseFloat(tzVal);
    const isDstNowActive = getCurrentDstState();
    const totalOffset = baseTzNum + (isDstNowActive ? 1 : 0);
    const tzSign = baseTzNum >= 0 ? "+" : "";
    const totalSign = totalOffset >= 0 ? "+" : "";

    let fusoText = `Fuso UTC ${tzSign}${tzVal}`;
    if (isDstNowActive) {
        fusoText += ` (Ora legale: UTC ${totalSign}${totalOffset})`;
    }

    document.getElementById('location-text').innerHTML = `<div style="font-size: 1.15rem;">${fusoText}</div>`;
    document.getElementById('txt-sunrise').innerText = "----";
    document.getElementById('txt-sunset').innerText = "----";

    document.getElementById('moon-phase-name').innerText = "----";
    document.getElementById('moon-rise').innerText = "----";
    document.getElementById('moon-set').innerText = "----";
    updateMoonModalRiseSetStrip(null, true);

    const baseOffset = getBaseLocationOffset();
    let utcCalculationDate = new Date(selectedDate.getTime() - (getTotalOffsetHours() * 3600000) + (baseOffset * 3600000));
    utcCalculationDate.setUTCHours(12, 0, 0, 0);

    cachedTimes = SunCalc.getTimes(utcCalculationDate, cachedLat, cachedLon);

    populateTable(cachedTimes, cachedMoonTimes, cachedMoonIllumination);

    ctx.clearRect(0, 0, 500, 500);
    drawSunSlicesSafe(cachedTimes);
    drawMinuteRingSafe();
    drawClockNumbers();
    updatePageBackground(cachedTimes);
    syncSettingsCoordsDisplay(cachedLat, cachedLon);
    updateCompactSunTimesRow();

    adaptBottomPanelHeight(false);
    toggleSettingsModal(false);
}

function getEffectiveDate() {
    const baseTz = isTimezoneOnlyMode
        ? (parseFloat(document.getElementById('timezone-preset')?.value) || getPreciseStandardTimezone(cachedLat, cachedLon))
        : getPreciseStandardTimezone(cachedLat, cachedLon);
    const now = new Date();
    const probe = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
        now.getUTCSeconds(),
        now.getUTCMilliseconds()
    ) + (baseTz * 3600000));

    const isDstNow = isDstForLocalClock(probe);
    const totalOffset = baseTz + (isDstNow ? 1 : 0);
    return new Date(now.getTime() + (totalOffset * 3600000));
}

function updateInputsVal() {
    const year = selectedDate.getUTCFullYear();
    const month = String(selectedDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getUTCDate()).padStart(2, '0');
    const hours = String(selectedDate.getUTCHours()).padStart(2, '0');
    const minutes = String(selectedDate.getUTCMinutes()).padStart(2, '0');

    document.getElementById('input-date').value = `${year}-${month}-${day}`;
    document.getElementById('date-display-btn').innerText = `${day}/${month}/${year}`;
    document.getElementById('input-time').value = `${hours}:${minutes}`;
}

function onDateChanged(val) {
    if (!val) return;
    const parts = val.split('-');
    applyStripDateChange(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), false);
}

function onTimeChanged(val) {
    if (!val) return;
    const parts = val.split(':');
    dstOverrideState = null;
    selectedDate.setUTCHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
    isCustomTime = true;
    lastUpdateMs = performance.now();
    syncManualDstCheckbox(getCurrentDstState());

    const targetOffset = getTotalOffsetHours();
    const realEffectiveNow = new Date(Date.now() + (targetOffset * 3600000));
    customTimeOffsetMs = selectedDate.getTime() - realEffectiveNow.getTime();

    updateInputsVal();
    if (isTimezoneOnlyMode) {
        applyTimezonePreset();
    } else {
        updateSunClock(cachedLat, cachedLon);
    }
}

function changeDate(days) {
    const next = new Date(selectedDate);
    next.setUTCDate(next.getUTCDate() + days);
    applyStripDateChange(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), false);
}

function changeHour(hours) {
    const prev = new Date(selectedDate.getTime());
    const next = new Date(selectedDate.getTime() + (hours * 3600000));
    if (hours > 0) {
        const res = applyDstTransitionWhenAdvancing(prev, next);
        selectedDate = res.date;
    } else {
        selectedDate = next;
    }
    isCustomTime = true;
    lastUpdateMs = performance.now();
    syncManualDstCheckbox(getCurrentDstState());

    const targetOffset = getTotalOffsetHours();
    const realEffectiveNow = new Date(Date.now() + (targetOffset * 3600000));
    customTimeOffsetMs = selectedDate.getTime() - realEffectiveNow.getTime();

    updateInputsVal();

    if (isTimezoneOnlyMode) {
        applyTimezonePreset();
    } else {
        updateSunClock(cachedLat, cachedLon);
    }

    if (isStripOpen) {
        ensureYearStripBuilt(selectedDate.getUTCFullYear());
        syncStripToSelectedDate(false);
    }
}

async function fetchAndUpdateLocation(lat, lon, fallbackName = "Posizione") {
    cachedLat = lat;
    cachedLon = lon;
    isTimezoneOnlyMode = false;
    syncDstWithLocation(cachedLat, cachedLon, new Date());

    if (getPrimaryLocationMode() !== 'manual') {
        isGpsActiveConfirmed = true;
        updateGpsStatusBanner('active');
    } else {
        updateGpsStatusBanner('manual');
    }

    syncSettingsCoordsDisplay(cachedLat, cachedLon);

    let placeName = fallbackName;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=it`);
        const geoData = await res.json();
        if (geoData && geoData.address) {
            const country = geoData.address.country || '';
            const specificLocality = geoData.address.city ||
                                     geoData.address.town ||
                                     geoData.address.village ||
                                     geoData.address.municipality ||
                                     geoData.address.county ||
                                     geoData.address.state || '';
            if (country && specificLocality && specificLocality.toLowerCase() !== country.toLowerCase()) {
                placeName = `${country} - ${specificLocality}`;
            } else {
                placeName = specificLocality || country || fallbackName;
            }
        }
    } catch (err) {
        placeName = fallbackName;
    }

    currentPlaceDisplayName = placeName;
    if (getPrimaryLocationMode() !== 'manual') {
        saveSharedPlaceToStorage(cachedLat, cachedLon, currentPlaceDisplayName);
        isGpsActiveConfirmed = true;
        updateGpsStatusBanner('active');
    } else {
        updateGpsStatusBanner('manual');
    }

    syncSettingsCoordsDisplay(cachedLat, cachedLon);

    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    updateDstUI(isAuto);

    isCustomTime = false;
    customTimeOffsetMs = 0;
    lastUpdateMs = performance.now();
    updateTimeForLocation();
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);
    if (isStripOpen) {
        ensureYearStripBuilt(selectedDate.getUTCFullYear());
        syncStripToSelectedDate(false);
    }
    adaptBottomPanelHeight(true);
}

function resetToNow() {
    isCustomTime = false;
    isTimezoneOnlyMode = false;
    customTimeOffsetMs = 0;
    lastUpdateMs = performance.now();

    const primaryMode = getPrimaryLocationMode();
    const savedPlace = getSharedPlaceFromStorage();

    if (primaryMode === 'manual' && savedPlace) {
        cachedLat = savedPlace.lat;
        cachedLon = savedPlace.lon;
        currentPlaceDisplayName = (savedPlace.name && savedPlace.name.trim()) || "Posizione Primaria";
        updateGpsStatusBanner('manual');

        syncDstWithLocation(cachedLat, cachedLon, new Date());
        syncSettingsCoordsDisplay(cachedLat, cachedLon);

        updateTimeForLocation();
        syncManualDstCheckbox(getCurrentDstState());
        updateInputsVal();
        updateSunClock(cachedLat, cachedLon);

        if (isStripOpen) {
            ensureYearStripBuilt(selectedDate.getUTCFullYear());
            syncStripToSelectedDate(false);
        }
        adaptBottomPanelHeight(true);
        return;
    }

    syncDstWithLocation(cachedLat, cachedLon, new Date());
    syncSettingsCoordsDisplay(cachedLat, cachedLon);

    updateTimeForLocation();
    syncManualDstCheckbox(getCurrentDstState());
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);

    if (isStripOpen) {
        ensureYearStripBuilt(selectedDate.getUTCFullYear());
        syncStripToSelectedDate(false);
    }
    adaptBottomPanelHeight(true);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (getPrimaryLocationMode() === 'manual') return;
                isGpsActiveConfirmed = true;
                updateGpsStatusBanner('active');
                fetchAndUpdateLocation(position.coords.latitude, position.coords.longitude, "Posizione Corrente");
            },
            () => {
                isGpsActiveConfirmed = false;
                updateGpsStatusBanner('off');
            },
            { timeout: 6000, enableHighAccuracy: true, maximumAge: 15000 }
        );
    } else {
        isGpsActiveConfirmed = false;
        updateGpsStatusBanner('off');
    }
}

function updateTimeForLocation() {
    if (!isCustomTime) {
        selectedDate = getEffectiveDate();
    }
}

function useGPSLocation() {
    restoreGpsPrimaryLocation();
}

async function searchCity() {
    const query = document.getElementById('input-city').value.trim();
    const statusEl = document.getElementById('search-status');
    if (!query) {
        statusEl.innerText = "Inserisci il nome di una città.";
        return;
    }
    statusEl.innerText = "Ricerca in corso...";
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&accept-language=it`);
        const data = await response.json();
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            const cityName = encodeURIComponent(data[0].display_name.split(',')[0]);

            const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
            const activeDst = getCurrentDstState();
            window.location.href = `posizione.html?lat=${lat}&lon=${lon}&city=${cityName}&auto=${isAuto}&dst=${activeDst}`;
        } else {
            statusEl.innerText = "Località non trovata.";
        }
    } catch (e) {
        statusEl.innerText = "Errore di connessione.";
    }
}

async function getPlaceNameAndRedirect(lat, lon) {
    let placeName = "Posizione";
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=it`);
        const geoData = await res.json();
        if (geoData && geoData.address) {
            const country = geoData.address.country || '';
            const specificLocality = geoData.address.city ||
                                     geoData.address.town ||
                                     geoData.address.village ||
                                     geoData.address.municipality ||
                                     geoData.address.county ||
                                     geoData.address.state || '';
            if (country && specificLocality && specificLocality.toLowerCase() !== country.toLowerCase()) {
                placeName = `${country} - ${specificLocality}`;
            } else {
                placeName = specificLocality || country || "Posizione";
            }
        }
    } catch (err) {
        placeName = "Posizione";
    }

    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    const activeDst = getCurrentDstState();

    window.location.href = `posizione.html?lat=${lat}&lon=${lon}&city=${encodeURIComponent(placeName)}&auto=${isAuto}&dst=${activeDst}`;
}

function getCompleteMoonTimes(date, lat, lon) {
    let targetDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));

    let times = SunCalc.getMoonTimes(targetDate, lat, lon);
    let rise = times.rise;
    let set = times.set;

    let startDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0));
    let endDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59, 999));

    if (!isValidDate(rise) || !isValidDate(set) || (rise < startDay || rise > endDay) || (set < startDay || set > endDay) || times.alwaysUp || times.alwaysDown) {
        let dPrev = new Date(targetDate);
        dPrev.setUTCDate(targetDate.getUTCDate() - 1);
        let pTimes = SunCalc.getMoonTimes(dPrev, lat, lon);

        let dNext = new Date(targetDate);
        dNext.setUTCDate(targetDate.getUTCDate() + 1);
        let nTimes = SunCalc.getMoonTimes(dNext, lat, lon);

        if (!isValidDate(rise) || rise < startDay || rise > endDay) {
            if (isValidDate(pTimes.rise) && pTimes.rise >= startDay && pTimes.rise <= endDay) rise = pTimes.rise;
            else if (isValidDate(nTimes.rise) && nTimes.rise >= startDay && nTimes.rise <= endDay) rise = nTimes.rise;
            else if (isValidDate(pTimes.rise)) rise = pTimes.rise;
            else if (isValidDate(nTimes.rise)) rise = nTimes.rise;
        }

        if (!isValidDate(set) || set < startDay || set > endDay) {
            if (isValidDate(pTimes.set) && pTimes.set >= startDay && pTimes.set <= endDay) set = pTimes.set;
            else if (isValidDate(nTimes.set) && nTimes.set >= startDay && nTimes.set <= endDay) set = nTimes.set;
            else if (isValidDate(pTimes.set)) set = pTimes.set;
            else if (isValidDate(nTimes.set)) set = nTimes.set;
        }
    }
    return { rise: rise, set: set, alwaysUp: times.alwaysUp, alwaysDown: times.alwaysDown };
}

function updateSunClock(lat, lon) {
    if (isTimezoneOnlyMode) return;

    const baseOffset = getBaseLocationOffset();
    let utcCalculationDate = new Date(selectedDate.getTime() - (baseOffset * 3600000));
    utcCalculationDate.setUTCHours(12, 0, 0, 0);

    cachedTimes = SunCalc.getTimes(utcCalculationDate, lat, lon);
    cachedMoonTimes = getCompleteMoonTimes(utcCalculationDate, lat, lon);
    cachedMoonIllumination = (typeof SunCalc.getMoonData === 'function') ? SunCalc.getMoonData(utcCalculationDate) : SunCalc.getMoonIllumination(utcCalculationDate);

    ctx.clearRect(0, 0, 500, 500);

    drawSunSlicesSafe(cachedTimes);
    drawMoonVisibilityArc(cachedMoonTimes, selectedDate);
    drawSolarMeridianLines(cachedTimes);
    drawMinuteRingSafe();
    drawClockNumbers();
    updatePageBackground(cachedTimes);

    updateMoonDigitalPanel(cachedMoonIllumination, cachedMoonTimes);

    lastHighlightedEventIndex = getNextEventIndex(cachedTimes, selectedDate);
    populateTable(cachedTimes, cachedMoonTimes, cachedMoonIllumination);

    const standardTz = getPreciseStandardTimezone(lat, lon);
    const isDstNowActive = getCurrentDstState();
    const latFmt = parseFloat(lat).toFixed(2);
    const lonFmt = parseFloat(lon).toFixed(2);

    const stdSign = standardTz >= 0 ? "+" : "";
    const totalSign = baseOffset >= 0 ? "+" : "";

    let fusoText = `Fuso solare: UTC ${stdSign}${standardTz}`;
    if (isDstNowActive) {
        fusoText += ` (Ora legale: UTC ${totalSign}${baseOffset})`;
    }

    document.getElementById('location-text').innerHTML = `
        <div style="font-size: 1.15rem; margin-bottom: 4px;">${currentPlaceDisplayName}</div>
        <div style="font-size: 0.95rem; opacity: 0.9;">Lat: ${latFmt} | Lon: ${lonFmt}</div>
        <div style="font-size: 0.90rem; opacity: 0.9; margin-top: 2px;">${fusoText}</div>
    `;

    document.getElementById('txt-sunrise').innerText = formatTime(cachedTimes.sunrise);
    document.getElementById('txt-sunset').innerText = formatTime(cachedTimes.sunset);
    syncSettingsCoordsDisplay(lat, lon);
    updateCompactSunTimesRow();
    adaptBottomPanelHeight(false);
}

function toTargetTime(date) {
    if (!isValidDate(date)) return null;
    const baseOffset = getBaseLocationOffset();
    return new Date(date.getTime() + (baseOffset * 3600000));
}

function timeToHours(date) {
    if (!date || !isValidDate(date)) return null;
    const targetDate = toTargetTime(date);
    return targetDate.getUTCHours() + targetDate.getUTCMinutes() / 60 + targetDate.getUTCSeconds() / 3600;
}

function isValidDate(d) {
    return d instanceof Date && !isNaN(d);
}

function drawMoonVisibilityArc(moonTimes, refDate) {
    if (moonTimes.alwaysUp) {
        ctx.save();
        ctx.beginPath();
        let arcRadius = radius - 7;
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#64748b';
        ctx.arc(cx, cy, arcRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
    }

    if (!isValidDate(moonTimes.rise) || !isValidDate(moonTimes.set)) return;

    let startH = timeToHours(moonTimes.rise);
    let endH = timeToHours(moonTimes.set);

    if (startH === null || endH === null) return;

    ctx.save();
    ctx.beginPath();
    let arcRadius = radius - 7;
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#64748b';

    if (endH < startH) {
        ctx.arc(cx, cy, arcRadius, hoursToAngle(startH), hoursToAngle(24));
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius, hoursToAngle(0), hoursToAngle(endH));
        ctx.stroke();
    } else {
        ctx.arc(cx, cy, arcRadius, hoursToAngle(startH), hoursToAngle(endH));
        ctx.stroke();
    }
    ctx.restore();
}

function drawSunSlicesSafe(times) {
    let hSunrise = timeToHours(times.sunrise);
    let hSunset = timeToHours(times.sunset);

    let hasValidSunset = isValidDate(times.sunrise) && isValidDate(times.sunset) && hSunrise !== null && hSunset !== null;

    if (!hasValidSunset) {
        const baseOffset = getBaseLocationOffset();
        let utcCalculationDate = new Date(selectedDate.getTime() - (baseOffset * 3600000));
        utcCalculationDate.setUTCHours(12, 0, 0, 0);
        const sunPos = SunCalc.getPosition(utcCalculationDate, cachedLat, cachedLon);

        const isPolarNight = sunPos.altitude < 0;
        const fallbackColor = isPolarNight ? PALETTE.night : PALETTE.day;

        for (let i = 0; i < 24; i += 0.25) {
            drawSector(i, i + 0.25, fallbackColor, radius);
        }
        return;
    }

    ctx.fillStyle = PALETTE.night;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    let dawnH = timeToHours(times.dawn) ?? (hSunrise - 1.0);
    let duskH = timeToHours(times.dusk) ?? (hSunset + 1.0);
    let nautDawnH = timeToHours(times.nauticalDawn) ?? (dawnH - 0.8);
    let nautDuskH = timeToHours(times.nauticalDusk) ?? (duskH + 0.8);
    let astroDawnH = timeToHours(times.astronomicalDawn) ?? (nautDawnH - 0.8);
    let astroDuskH = timeToHours(times.astronomicalDusk) ?? (nautDuskH + 0.8);

    let sunriseEndH = timeToHours(times.sunriseEnd) ?? (hSunrise + 0.2);
    let goldenEndH = timeToHours(times.goldenHourEnd) ?? (hSunrise + 1.0);
    let goldenStartH = timeToHours(times.goldenHour) ?? (hSunset - 1.0);
    let sunsetStartH = timeToHours(times.sunsetStart) ?? (hSunset - 0.2);

    drawSector(astroDawnH, nautDawnH, PALETTE.astro, radius);
    drawSector(nautDawnH, dawnH, PALETTE.naut, radius);
    drawSector(dawnH, hSunrise, PALETTE.civil, radius);
    drawSector(hSunrise, sunriseEndH, PALETTE.sunriseSunset, radius);
    drawSector(sunriseEndH, goldenEndH, PALETTE.golden, radius);
    drawSector(goldenEndH, goldenStartH, PALETTE.day, radius);

    drawSector(goldenStartH, sunsetStartH, PALETTE.golden, radius);
    drawSector(sunsetStartH, hSunset, PALETTE.sunriseSunset, radius);
    drawSector(hSunset, duskH, PALETTE.civil, radius);
    drawSector(duskH, nautDuskH, PALETTE.naut, radius);
    drawSector(nautDuskH, astroDuskH, PALETTE.astro, radius);
}

function drawSector(startH, endH, color, r) {
    if (startH === null || endH === null || isNaN(startH) || isNaN(endH)) return;
    startH = (startH + 24) % 24;
    endH = (endH + 24) % 24;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    if (endH < startH) {
        ctx.arc(cx, cy, r, hoursToAngle(startH), hoursToAngle(24));
        ctx.arc(cx, cy, r, hoursToAngle(0), hoursToAngle(endH));
    } else {
        ctx.arc(cx, cy, r, hoursToAngle(startH), hoursToAngle(endH));
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

function drawSolarMeridianLines(times) {
    if (isValidDate(times.solarNoon)) {
        const noonHours = timeToHours(times.solarNoon);
        if (noonHours !== null) {
            const noonAngle = hoursToAngle(noonHours);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + radius * Math.cos(noonAngle), cy + radius * Math.sin(noonAngle));
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    if (isValidDate(times.nadir)) {
        const nadirHours = timeToHours(times.nadir);
        if (nadirHours !== null) {
            const nadirAngle = hoursToAngle(nadirHours);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + radius * Math.cos(nadirAngle), cy + radius * Math.sin(nadirAngle));
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }
}

function drawMinuteRingSafe() {
    for (let i = 0; i < 60; i++) {
        const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const len = (i % 5 === 0) ? 18 : 10;

        const x1 = cx + (radius - len) * Math.cos(angle);
        const y1 = cy + (radius - len) * Math.sin(angle);
        const x2 = cx + radius * Math.cos(angle);
        const y2 = cy + radius * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = (i % 5 === 0) ? 4.5 : 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = (i % 5 === 0) ? 2 : 1.2;
        ctx.stroke();
    }
}

function drawClockNumbers() {
    ctx.font = 'bold 26px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const hRadius = radius * 0.65;
    for (let i = 1; i <= 24; i++) {
        const angleRad = hoursToAngle(i);
        const hx = cx + hRadius * Math.cos(angleRad);
        const hy = cy + hRadius * Math.sin(angleRad);

        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ff0000';
        ctx.strokeText(i, hx, hy);

        ctx.fillStyle = '#39ff14';
        ctx.fillText(i, hx, hy);
    }

    ctx.font = 'bold 26px sans-serif';
    const mRadius = radius * 0.86;
    for (let m = 0; m < 60; m += 5) {
        const angleRad = (m / 60) * Math.PI * 2 - Math.PI / 2;
        const mx = cx + mRadius * Math.cos(angleRad);
        const my = cy + mRadius * Math.sin(angleRad);

        const minText = String(m).padStart(2, '0');

        ctx.lineWidth = 4;
        ctx.strokeStyle = '#ff0000';
        ctx.strokeText(minText, mx, my);

        ctx.fillStyle = '#39ff14';
        ctx.fillText(minText, mx, my);
    }
}

function updatePageBackground(times) {
    if (!times) return;
    const h = selectedDate.getUTCHours() + selectedDate.getUTCMinutes() / 60 + selectedDate.getUTCSeconds() / 3600;
    const currentColor = getIntervalColorSafe(h, times);
    const finalBg = currentColor === PALETTE.night ? '#000000' : currentColor;

    document.documentElement.style.backgroundColor = finalBg;
    document.body.style.backgroundColor = finalBg;

    const isDark = (finalBg === '#000000' || finalBg === '#172554' || finalBg === '#1e3a8a');
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';

    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
        metaThemeColor.setAttribute('content', finalBg);
    }

    styleStripButtonVisibility(document.getElementById('btn-toggle-year-strip'), isStripOpen);

    if (window.AndroidInterface && typeof window.AndroidInterface.updateColors === 'function') {
        window.AndroidInterface.updateColors(finalBg);
    }
}

function getIntervalColorSafe(h, times) {
    const hSunrise = timeToHours(times.sunrise);
    const hSunset = timeToHours(times.sunset);

    if (!isValidDate(times.sunrise) || !isValidDate(times.sunset) || hSunrise === null || hSunset === null) {
        const baseOffset = getBaseLocationOffset();
        let utcCalculationDate = new Date(selectedDate.getTime() - (baseOffset * 3600000));
        utcCalculationDate.setUTCHours(12, 0, 0, 0);
        const sunPos = SunCalc.getPosition(utcCalculationDate, cachedLat, cachedLon);
        return sunPos.altitude < 0 ? PALETTE.night : PALETTE.day;
    }

    const hDawn = timeToHours(times.dawn) ?? (hSunrise - 1.0);
    const hDusk = timeToHours(times.dusk) ?? (hSunset + 1.0);
    const hNautDawn = timeToHours(times.nauticalDawn) ?? (hDawn - 0.8);
    const hNautDusk = timeToHours(times.nauticalDusk) ?? (hDusk + 0.8);
    const hAstroDawn = timeToHours(times.astronomicalDawn) ?? (hNautDawn - 0.8);
    const hAstroDusk = timeToHours(times.astronomicalDusk) ?? (hNautDusk + 0.8);

    const hSunriseEndVal = timeToHours(times.sunriseEnd) ?? (hSunrise + 0.2);
    const hGoldenEndVal = timeToHours(times.goldenHourEnd) ?? (hSunrise + 1.0);
    const hGoldenStartVal = timeToHours(times.goldenHour) ?? (hSunset - 1.0);
    const hSunsetStartVal = timeToHours(times.sunsetStart) ?? (hSunset - 0.2);

    if (h >= hSunrise && h < hSunriseEndVal) return PALETTE.sunriseSunset;
    if (h >= hSunriseEndVal && h < hGoldenEndVal) return PALETTE.golden;
    if (h >= hGoldenEndVal && h < hGoldenStartVal) return PALETTE.day;
    if (h >= hGoldenStartVal && h < hSunsetStartVal) return PALETTE.golden;
    if (h >= hSunsetStartVal && h < hSunset) return PALETTE.sunriseSunset;
    if (h >= hSunset && h < hDusk) return PALETTE.civil;
    if (h >= hDawn && h < hSunrise) return PALETTE.civil;

    if (h >= hNautDawn && h < hDawn) return PALETTE.naut;
    if (h >= hDusk && h < hNautDusk) return PALETTE.naut;

    if (h >= hAstroDawn && h < hNautDawn) return PALETTE.astro;
    if (h >= hDusk && h < hAstroDusk) return PALETTE.astro;

    return PALETTE.night;
}

function formatTime(date) {
    const targetDate = toTargetTime(date);
    if (!isValidDate(targetDate)) return "--:--";
    return targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
}

function drawRealisticSun(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    canvas.width = 32;
    canvas.height = 32;

    const ctxSun = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const r = width / 2 - 2;

    ctxSun.clearRect(0, 0, width, height);

    ctxSun.save();
    ctxSun.beginPath();
    ctxSun.arc(width / 2, height / 2, r, 0, Math.PI * 2);
    ctxSun.closePath();
    ctxSun.clip();

    ctxSun.fillStyle = '#f59e0b';
    ctxSun.fillRect(0, 0, width, height);

    let sunGrad = ctxSun.createRadialGradient(width / 2 - 4, height / 2 - 4, 2, width / 2, height / 2, r);
    sunGrad.addColorStop(0, '#ffffff');
    sunGrad.addColorStop(0.25, '#fef08a');
    sunGrad.addColorStop(0.6, '#f59e0b');
    sunGrad.addColorStop(1, '#c2410c');

    ctxSun.fillStyle = sunGrad;
    ctxSun.beginPath();
    ctxSun.arc(width / 2, height / 2, r, 0, Math.PI * 2);
    ctxSun.fill();

    ctxSun.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctxSun.beginPath(); ctxSun.arc(width * 0.38, height * 0.38, r * 0.25, 0, Math.PI * 2); ctxSun.fill();
    ctxSun.beginPath(); ctxSun.arc(width * 0.62, height * 0.62, r * 0.2, 0, Math.PI * 2); ctxSun.fill();

    ctxSun.restore();

    ctxSun.strokeStyle = 'rgba(254, 240, 138, 0.9)';
    ctxSun.lineWidth = 1.5;
    ctxSun.beginPath();
    ctxSun.arc(width / 2, height / 2, r, 0, Math.PI * 2);
    ctxSun.stroke();
}

function drawRealisticMoon(canvasId, illumination, size = 32) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    canvas.width = size;
    canvas.height = size;

    const ctxMoon = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const r = width / 2 - (size > 50 ? 1 : 2);
    const cxCenter = width / 2;
    const cyCenter = height / 2;
    const tau = Math.PI * 2;

    ctxMoon.clearRect(0, 0, width, height);

    ctxMoon.save();
    ctxMoon.beginPath();
    ctxMoon.arc(cxCenter, cyCenter, r, 0, tau);
    ctxMoon.closePath();
    ctxMoon.clip();

    if (realMoonImage.complete && realMoonImage.naturalWidth !== 0) {
        const zoomFactor = 1.55;
        const drawSize = r * 2 * zoomFactor;
        const offset = (drawSize - (r * 2)) / 2;
        ctxMoon.drawImage(realMoonImage, (cxCenter - r) - offset, (cyCenter - r) - offset, drawSize, drawSize);
    } else {
        let bgGrad = ctxMoon.createRadialGradient(cxCenter - r * 0.3, cyCenter - r * 0.3, r * 0.1, cxCenter, cyCenter, r);
        bgGrad.addColorStop(0, '#f1f5f9');
        bgGrad.addColorStop(0.4, '#cbd5e1');
        bgGrad.addColorStop(0.8, '#64748b');
        bgGrad.addColorStop(1, '#334155');
        ctxMoon.fillStyle = bgGrad;
        ctxMoon.fillRect(0, 0, width, height);
    }

    if (illumination && typeof illumination.phase !== 'undefined') {
        const phase = illumination.phase;
        const d = r * Math.cos(phase * tau);

        ctxMoon.fillStyle = 'rgba(0, 0, 0, 0.88)';
        ctxMoon.beginPath();

        const isWaxing = phase <= 0.5;
        ctxMoon.arc(cxCenter, cyCenter, r, -Math.PI / 2, Math.PI / 2, isWaxing);

        let outerRx = Math.abs(d);
        let sweepFlag = (d >= 0) === isWaxing;
        ctxMoon.ellipse(cxCenter, cyCenter, outerRx, r, 0, Math.PI / 2, -Math.PI / 2, sweepFlag);

        ctxMoon.closePath();
        ctxMoon.fill();
    }

    ctxMoon.restore();

    if (size <= 50) {
        ctxMoon.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctxMoon.lineWidth = 1.5;
        ctxMoon.beginPath();
        ctxMoon.arc(cxCenter, cyCenter, r, 0, tau);
        ctxMoon.stroke();
    }
}

function updateMoonModalRiseSetStrip(moonTimes, forceDash = false) {
    const riseEl = document.getElementById('modal-moon-rise');
    const setEl = document.getElementById('modal-moon-set');

    if (riseEl) {
        riseEl.innerText = forceDash
            ? '----'
            : (moonTimes && isValidDate(moonTimes.rise) ? formatTime(moonTimes.rise) : '--:--');
    }
    if (setEl) {
        setEl.innerText = forceDash
            ? '----'
            : (moonTimes && isValidDate(moonTimes.set) ? formatTime(moonTimes.set) : '--:--');
    }
}

function toggleMoonModal(show) {
    const modal = document.getElementById('modal-moon');
    if (modal) {
        modal.style.display = show ? 'flex' : 'none';
        if (show) {
            if (isTimezoneOnlyMode) {
                updateMoonModalRiseSetStrip(null, true);
            } else if (cachedMoonIllumination && cachedMoonTimes) {
                updateMoonDigitalPanel(cachedMoonIllumination, cachedMoonTimes);
            } else {
                updateMoonModalRiseSetStrip(cachedMoonTimes, false);
            }
        }
    }
}

function updateMoonDigitalPanel(illumination, moonTimes) {
    if (isTimezoneOnlyMode || !illumination) return;

    const phaseNameEl = document.getElementById('moon-phase-name');
    const riseEl = document.getElementById('moon-rise');
    const setEl = document.getElementById('moon-set');
    const phase = illumination.phase;

    let phaseName = "";

    if (phase < 0.03 || phase > 0.97) { phaseName = "Luna Nuova"; }
    else if (phase < 0.22) { phaseName = "Crescente"; }
    else if (phase < 0.28) { phaseName = "Primo Quarto"; }
    else if (phase < 0.47) { phaseName = "Gibbosa Crescente"; }
    else if (phase < 0.53) { phaseName = "Luna Piena"; }
    else if (phase < 0.72) { phaseName = "Gibbosa Calante"; }
    else if (phase < 0.78) { phaseName = "Ultimo Quarto"; }
    else { phaseName = "Calante"; }

    const riseFormatted = (moonTimes && isValidDate(moonTimes.rise)) ? formatTime(moonTimes.rise) : "--:--";
    const setFormatted = (moonTimes && isValidDate(moonTimes.set)) ? formatTime(moonTimes.set) : "--:--";

    if (phaseNameEl) phaseNameEl.innerText = `${phaseName} (${Math.round(illumination.fraction * 100)}%)`;
    if (riseEl) riseEl.innerText = riseFormatted;
    if (setEl) setEl.innerText = setFormatted;

    drawRealisticMoon('moon-canvas', illumination, 24);
    drawRealisticMoon('moon-clock-canvas', illumination, 32);
    drawRealisticSun('sun-clock-canvas');

    drawRealisticMoon('big-moon-canvas', illumination, 140);

    const bigTitleEl = document.getElementById('big-moon-phase-title');
    const bigDateEl = document.getElementById('big-moon-date-display');
    if (bigTitleEl) {
        bigTitleEl.innerText = `${phaseName} (${Math.round(illumination.fraction * 100)}%)`;
        bigTitleEl.style.fontSize = '1.15rem';
        bigTitleEl.style.fontWeight = 'bold';
    }
    if (bigDateEl && selectedDate) {
        const dStr = `${String(selectedDate.getUTCDate()).padStart(2, '0')}/${String(selectedDate.getUTCMonth() + 1).padStart(2, '0')}/${selectedDate.getUTCFullYear()}`;
        const tStr = `${String(selectedDate.getUTCHours()).padStart(2, '0')}:${String(selectedDate.getUTCMinutes()).padStart(2, '0')}`;
        bigDateEl.innerText = `${dStr} - ${tStr}`;
        bigDateEl.style.fontSize = '1.15rem';
        bigDateEl.style.fontWeight = 'bold';
        bigDateEl.style.color = '#ffffff';
    }

    updateMoonModalRiseSetStrip(moonTimes, false);
}

function getNextEventIndex(times, refDate) {
    if (!times) return 0;

    const h = selectedDate.getUTCHours() + selectedDate.getUTCMinutes() / 60 + selectedDate.getUTCSeconds() / 3600;

    const events = [
        { name: "Mezzanotte solare", hours: timeToHours(times.nadir), index: 0 },
        { name: "Alba astronomica", hours: timeToHours(times.astronomicalDawn), index: 1 },
        { name: "Alba Nautica", hours: timeToHours(times.nauticalDawn), index: 2 },
        { name: "Alba Civile", hours: timeToHours(times.dawn), index: 3 },
        { name: "Alba", hours: timeToHours(times.sunrise), index: 4 },
        { name: "Fine dell'alba", hours: timeToHours(times.sunriseEnd), index: 5 },
        { name: "Fine dell'ora d'oro", hours: timeToHours(times.goldenHourEnd), index: 6 },
        { name: "Mezzogiorno solare", hours: timeToHours(times.solarNoon), index: 7 },
        { name: "Inizio dell'ora d'oro", hours: timeToHours(times.goldenHour), index: 8 },
        { name: "Inizio del tramonto", hours: timeToHours(times.sunsetStart), index: 9 },
        { name: "Tramonto", hours: timeToHours(times.sunset), index: 10 },
        { name: "Crepuscolo civile", hours: timeToHours(times.dusk), index: 11 },
        { name: "Crepuscolo nautico", hours: timeToHours(times.nauticalDusk), index: 12 },
        { name: "Crepuscolo astronomico", hours: timeToHours(times.astronomicalDusk), index: 13 }
    ];

    for (let i = 0; i < events.length; i++) {
        if (events[i].hours !== null && !isNaN(events[i].hours)) {
            let evH = (events[i].hours + 24) % 24;
            if (evH >= h) {
                return events[i].index;
            }
        }
    }
    return 0;
}

function populateTable(times, moonTimes, illumination) {
    const tbody = document.getElementById('times-table-body');
    if (!tbody) return;

    if (isTimezoneOnlyMode) {
        tbody.innerHTML = `
            <tr style="background: #7f1d1d; color: #facc15;"><td colspan="2"><b>☀️ Dati Solari e Crepuscoli</b></td></tr>
            <tr style="background: #000000; color: #ffffff;"><td>Mezzanotte solare</td><td>----</td></tr>
            <tr style="background: rgba(23, 37, 84, 0.6);"><td>Alba astronomica</td><td>----</td></tr>
            <tr style="background: rgba(30, 58, 138, 0.6);"><td>Alba Nautica</td><td>----</td></tr>
            <tr style="background: rgba(59, 130, 246, 0.4);"><td>Alba Civile</td><td>----</td></tr>
            <tr style="background: rgba(249, 115, 22, 0.4);"><td>Alba</td><td>----</td></tr>
            <tr style="background: rgba(234, 179, 8, 0.4);"><td>Fine dell'alba</td><td>----</td></tr>
            <tr style="background: rgba(234, 179, 8, 0.5);"><td>Fine dell'ora d'oro</td><td>----</td></tr>
            <tr style="background: rgba(186, 230, 253, 0.3); color: #ffffff;"><td>Mezzogiorno solare</td><td>----</td></tr>
            <tr style="background: rgba(234, 179, 8, 0.5);"><td>Inizio dell'ora d'oro</td><td>----</td></tr>
            <tr style="background: rgba(234, 179, 8, 0.4);"><td>Inizio del tramonto</td><td>----</td></tr>
            <tr style="background: rgba(249, 115, 22, 0.4);"><td>Tramonto</td><td>----</td></tr>
            <tr style="background: rgba(59, 130, 246, 0.4);"><td>Crepuscolo civile</td><td>----</td></tr>
            <tr style="background: rgba(30, 58, 138, 0.6);"><td>Crepuscolo nautico</td><td>----</td></tr>
            <tr style="background: rgba(23, 37, 84, 0.6);"><td>Crepuscolo astronomico</td><td>----</td></tr>

            <tr style="background: #7f1d1d; color: #facc15;"><td colspan="2"><b>🌙 Dati Lunari</b></td></tr>
            <tr style="background: rgba(30, 41, 59, 0.9); color: #ffffff;"><td>Fase Lunare</td><td>----</td></tr>
            <tr style="background: rgba(30, 41, 59, 0.9); color: #ffffff;"><td>Sorge (luna):</td><td><b>----</b></td></tr>
            <tr style="background: rgba(30, 41, 59, 0.9); color: #ffffff;"><td>Tramonta (luna):</td><td><b>----</b></td></tr>
        `;
        return;
    }

    const phasePct = illumination ? Math.round(illumination.fraction * 100) : 0;

    const events = [
        { name: "Mezzanotte solare", date: times.nadir, bg: "#000000" },
        { name: "Alba astronomica", date: times.astronomicalDawn, bg: "rgba(23, 37, 84, 0.6)" },
        { name: "Alba Nautica", date: times.nauticalDawn, bg: "rgba(30, 58, 138, 0.6)" },
        { name: "Alba Civile", date: times.dawn, bg: "rgba(59, 130, 246, 0.4)" },
        { name: "Alba", date: times.sunrise, bg: "rgba(249, 115, 22, 0.4)" },
        { name: "Fine dell'alba", date: times.sunriseEnd, bg: "rgba(234, 179, 8, 0.4)" },
        { name: "Fine dell'ora d'oro", date: times.goldenHourEnd, bg: "rgba(234, 179, 8, 0.5)" },
        { name: "Mezzogiorno solare", date: times.solarNoon, bg: "rgba(186, 230, 253, 0.3); color: #ffffff;" },
        { name: "Inizio dell'ora d'oro", date: times.goldenHour, bg: "rgba(234, 179, 8, 0.5)" },
        { name: "Inizio del tramonto", date: times.sunsetStart, bg: "rgba(234, 179, 8, 0.4)" },
        { name: "Tramonto", date: times.sunset, bg: "rgba(249, 115, 22, 0.4)" },
        { name: "Crepuscolo civile", date: times.dusk, bg: "rgba(59, 130, 246, 0.4)" },
        { name: "Crepuscolo nautico", date: times.nauticalDusk, bg: "rgba(30, 58, 138, 0.6)" },
        { name: "Crepuscolo astronomico", date: times.astronomicalDusk, bg: "rgba(23, 37, 84, 0.6)" }
    ];

    let solarRowsHtml = "";
    events.forEach((ev, idx) => {
        const isNext = (idx === lastHighlightedEventIndex);
        const borderStyle = isNext ? "border: 2px solid #ffffff; box-shadow: 0 0 8px rgba(255,255,255,0.8); font-weight: bold;" : "";

        solarRowsHtml += `
            <tr style="background: ${ev.bg}; ${borderStyle}">
                <td>${ev.name} ${isNext ? '📍' : ''}</td>
                <td>${formatTime(ev.date)}</td>
            </tr>
        `;
    });

    tbody.innerHTML = `
        <tr style="background: #7f1d1d; color: #facc15;"><td colspan="2"><b>☀️ Dati Solari e Crepuscoli</b></td></tr>
        ${solarRowsHtml}

        <tr style="background: #7f1d1d; color: #facc15;"><td colspan="2"><b>🌙 Dati Lunari</b></td></tr>
        <tr style="background: rgba(30, 41, 59, 0.9); color: #ffffff;"><td>Fase Lunare</td><td>${phasePct}% illuminata</td></tr>
        <tr style="background: rgba(30, 41, 59, 0.9); color: #ffffff;"><td>Sorge (luna):</td><td><b>${moonTimes ? formatTime(moonTimes.rise) : '----'}</b></td></tr>
        <tr style="background: rgba(30, 41, 59, 0.9); color: #ffffff;"><td>Tramonta (luna):</td><td><b>${moonTimes ? formatTime(moonTimes.set) : '----'}</b></td></tr>
    `;
}

function toggleTimesModal(show) {
    document.getElementById('modal-times').style.display = show ? 'flex' : 'none';
}

function toggleSettingsModal(show) {
    if (show) {
        syncSettingsCoordsDisplay(cachedLat, cachedLon);
    }
    document.getElementById('modal-settings').style.display = show ? 'flex' : 'none';
}

function getTzMapTargetElement(modal) {
    if (!modal) return null;
    return document.getElementById('tz-map-img') || modal.querySelector('img, svg, canvas');
}

function applyTzMapTransform() {
    const modal = document.getElementById('modal-tz-map');
    const target = getTzMapTargetElement(modal);
    const label = document.getElementById('tz-map-zoom-label');

    if (target) {
        target.style.transformOrigin = 'center center';
        target.style.transition = 'transform 0.12s ease-out';
        target.style.transform = `translate(${mapPanX}px, ${mapPanY}px) scale(${mapZoomScale})`;
    }
    if (label) {
        label.innerText = `${Math.round(mapZoomScale * 100)}%`;
    }
}

function setTzMapZoom(nextScale) {
    mapZoomScale = Math.max(1, Math.min(5, Number(nextScale.toFixed(2))));
    if (mapZoomScale === 1) {
        mapPanX = 0;
        mapPanY = 0;
    }
    applyTzMapTransform();
}

function zoomTzMapIn() {
    setTzMapZoom(mapZoomScale + 0.4);
}

function zoomTzMapOut() {
    setTzMapZoom(mapZoomScale - 0.4);
}

function resetTzMapZoom() {
    mapZoomScale = 1;
    mapPanX = 0;
    mapPanY = 0;
    applyTzMapTransform();
}

function setupTzMapZoom() {
    const modal = document.getElementById('modal-tz-map');
    if (!modal || modal.dataset.zoomInitialized === 'true') return;
    modal.dataset.zoomInitialized = 'true';

    const target = getTzMapTargetElement(modal);
    const host = document.getElementById('tz-map-viewport') || modal;

    host.addEventListener('wheel', (e) => {
        if (modal.style.display !== 'flex') return;
        e.preventDefault();
        setTzMapZoom(mapZoomScale + (e.deltaY < 0 ? 0.3 : -0.3));
    }, { passive: false });

    let isPanning = false;
    let startX = 0;
    let startY = 0;

    if (target) {
        target.style.cursor = 'grab';
        target.addEventListener('mousedown', (e) => {
            if (e.button !== 0 || mapZoomScale <= 1) return;
            isPanning = true;
            startX = e.clientX - mapPanX;
            startY = e.clientY - mapPanY;
            target.style.cursor = 'grabbing';
        });

        target.addEventListener('dblclick', () => {
            if (mapZoomScale > 1) {
                resetTzMapZoom();
            } else {
                setTzMapZoom(2.2);
            }
        });
    }

    window.addEventListener('mousemove', (e) => {
        if (!isPanning) return;
        mapPanX = e.clientX - startX;
        mapPanY = e.clientY - startY;
        applyTzMapTransform();
    });

    window.addEventListener('mouseup', () => {
        if (!isPanning) return;
        isPanning = false;
        if (target) target.style.cursor = 'grab';
    });
}

function toggleTimeZoneMapModal(show) {
    const modal = document.getElementById('modal-tz-map');
    if (!modal) return;
    if (show) {
        const settingsModal = document.getElementById('modal-settings');
        if (settingsModal) {
            settingsModal.style.display = 'none';
        }
        setupTzMapZoom();
        resetTzMapZoom();
        modal.style.display = 'flex';
    } else {
        modal.style.display = 'none';
    }
}

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const tzMapModal = document.getElementById('modal-tz-map');
        if (tzMapModal && tzMapModal.style.display === 'flex') {
            toggleTimeZoneMapModal(false);
        }
    }
});

function getDstRuleSummaryList() {
    return [
        {
            area: "Europa e aree UE-like",
            rule: "Inizia l'ultima domenica di marzo (02:00 → 03:00) e finisce l'ultima domenica di ottobre (03:00 → 02:00)."
        },
        {
            area: "Nord America (USA e Canada, dove applicata)",
            rule: "Inizia la 2ª domenica di marzo (02:00 → 03:00) e finisce la 1ª domenica di novembre (02:00 → 01:00). Escluse zone senza ora legale (es. Phoenix, Hawaii, gran parte del Saskatchewan)."
        },
        {
            area: "Australia (stati con ora legale)",
            rule: "Emisfero australe: inizia la 1ª domenica di ottobre e finisce la 1ª domenica di aprile. Perth, Brisbane e Darwin non applicano l'ora legale."
        },
        {
            area: "Nuova Zelanda",
            rule: "Emisfero australe: inizia l'ultima domenica di settembre e finisce la 1ª domenica di aprile."
        },
        {
            area: "Asia, gran parte dell'Africa e Sud America",
            rule: "In molte nazioni l'ora legale non viene applicata e il fuso resta costante tutto l'anno; in alcuni paesi (es. Cile o aree con regole proprie) seguono calendari dedicati."
        },
        {
            area: "Controllo manuale in SunClock24",
            rule: "Puoi sempre disattivare l'ora legale automatica o forzare +1h / 0h manualmente, e verificare la regola rilevata per la posizione corrente."
        }
    ];
}

function renderDstRulesModalContent() {
    const bodyEl = document.getElementById('dst-rules-modal-body');
    if (!bodyEl) return;

    const currentRule = typeof getDstRuleForLocation === 'function'
        ? getDstRuleForLocation(cachedLat, cachedLon)
        : 'eu';

    const ruleLabels = {
        eu: "Europa (ultima domenica di marzo → ultima domenica di ottobre)",
        us: "Nord America (2ª domenica di marzo → 1ª domenica di novembre)",
        au: "Australia DST (1ª domenica di ottobre → 1ª domenica di aprile)",
        nz: "Nuova Zelanda (ultima domenica di settembre → 1ª domenica di aprile)",
        none: "Nessuna ora legale automatica per il fuso selezionato"
    };

    const itemsHtml = getDstRuleSummaryList().map(item => `
        <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 8px 10px; margin-bottom: 8px;">
            <div style="color: #38bdf8; font-weight: bold; margin-bottom: 3px;">${item.area}</div>
            <div style="color: #e2e8f0;">${item.rule}</div>
        </div>
    `).join('');

    bodyEl.innerHTML = `
        <div style="background: rgba(57, 255, 20, 0.1); border: 1px solid #39ff14; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px; color: #bbf7d0;">
            <strong>Regola attiva ora:</strong><br>
            ${ruleLabels[currentRule] || ruleLabels.eu}
        </div>
        ${itemsHtml}
    `;
}

function toggleDstRulesModal(show) {
    const modal = document.getElementById('modal-dst-rules');
    if (!modal) return;
    if (show) {
        renderDstRulesModalContent();
        modal.style.display = 'flex';
    } else {
        modal.style.display = 'none';
    }
}

function updateHands() {
    const nowMs = performance.now();
    const deltaMs = Math.max(0, Math.min(1000, nowMs - lastUpdateMs));
    lastUpdateMs = nowMs;

    const prevDate = new Date(selectedDate.getTime());
    let dstJumped = false;

    if (!isCustomTime) {
        selectedDate = getEffectiveDate();
        if (
            prevDate.getUTCFullYear() !== selectedDate.getUTCFullYear() ||
            prevDate.getUTCMonth() !== selectedDate.getUTCMonth() ||
            prevDate.getUTCDate() !== selectedDate.getUTCDate()
        ) {
            updateInputsVal();
            if (!isTimezoneOnlyMode) updateSunClock(cachedLat, cachedLon);
        }
    } else {
        const candidate = new Date(selectedDate.getTime() + deltaMs);
        const transitionRes = applyDstTransitionWhenAdvancing(prevDate, candidate);
        selectedDate = transitionRes.date;
        dstJumped = transitionRes.dstChanged;

        const targetOffset = getTotalOffsetHours();
        const realEffectiveNow = new Date(Date.now() + (targetOffset * 3600000));
        customTimeOffsetMs = selectedDate.getTime() - realEffectiveNow.getTime();

        if (
            dstJumped ||
            prevDate.getUTCFullYear() !== selectedDate.getUTCFullYear() ||
            prevDate.getUTCMonth() !== selectedDate.getUTCMonth() ||
            prevDate.getUTCDate() !== selectedDate.getUTCDate()
        ) {
            updateInputsVal();
            if (isTimezoneOnlyMode) {
                applyTimezonePreset();
            } else {
                updateSunClock(cachedLat, cachedLon);
            }
            if (isStripOpen) {
                ensureYearStripBuilt(selectedDate.getUTCFullYear());
                syncStripToSelectedDate(false);
            }
        }
    }

    const clockStr = selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
    const mainClockEl = document.getElementById('digital-clock');
    const stripClockEl = document.getElementById('strip-clock-readout');
    if (mainClockEl) mainClockEl.innerText = clockStr;
    if (stripClockEl) stripClockEl.innerText = clockStr;

    const h = selectedDate.getUTCHours() + selectedDate.getUTCMinutes() / 60 + selectedDate.getUTCSeconds() / 3600;
    const m = selectedDate.getUTCMinutes() + selectedDate.getUTCSeconds() / 60;
    const s = selectedDate.getUTCSeconds() + selectedDate.getUTCMilliseconds() / 1000;

    const hourDeg = (h / 24) * 360 - 180;
    document.getElementById('hand-hour').style.transform = `rotate(${hourDeg}deg)`;

    const minuteDeg = (m / 60) * 360;
    document.getElementById('hand-minute').style.transform = `rotate(${minuteDeg}deg)`;

    const secDeg = (s / 60) * 360;
    document.getElementById('hand-second').style.transform = `rotate(${secDeg}deg)`;

    let moonEquivalentHour = h;
    if (cachedMoonIllumination && typeof cachedMoonIllumination.phase !== 'undefined') {
        let phaseOffsetHours = cachedMoonIllumination.phase * 24;
        moonEquivalentHour = (h + phaseOffsetHours) % 24;
    }

    const moonDeg = (moonEquivalentHour / 24) * 360 - 180;
    document.getElementById('hand-moon').style.transform = `rotate(${moonDeg}deg)`;

    if (cachedTimes && cachedMoonTimes) {
        updatePageBackground(cachedTimes);

        const currentHighlight = getNextEventIndex(cachedTimes, selectedDate);
        if (currentHighlight !== lastHighlightedEventIndex) {
            lastHighlightedEventIndex = currentHighlight;
            populateTable(cachedTimes, cachedMoonTimes, cachedMoonIllumination);
        }
    }

    const moonModalEl = document.getElementById('modal-moon');
    if (moonModalEl && moonModalEl.style.display === 'flex') {
        updateMoonModalRiseSetStrip(cachedMoonTimes, isTimezoneOnlyMode);
    }
}

window.addEventListener('pageshow', function (event) {
    if (event.persisted) {
        isTimezoneOnlyMode = false;
        syncSettingsCoordsDisplay(cachedLat, cachedLon);
        updateTimeForLocation();
        updateInputsVal();
        updateSunClock(cachedLat, cachedLon);
        adaptBottomPanelHeight(true);
    }
});

initClock();
setInterval(updateHands, 50);

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.service.worker.js');
}
