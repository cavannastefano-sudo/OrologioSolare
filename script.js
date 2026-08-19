SunCalc.addTime(-18, 'astronomicalDawn', 'astronomicalDusk');
SunCalc.addTime(-12, 'nauticalDawn', 'nauticalDusk');
SunCalc.addTime(-6, 'dawn', 'dusk');

const canvas = document.getElementById('clockCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const cx = 250;
const cy = 250;
const radius = 248;

function getCurrentDstState() {
    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    if (isAuto && typeof getEffectiveDST === 'function') {
        return getEffectiveDST(cachedLat, cachedLon, selectedDate);
    }
    return localStorage.getItem('sunclock_dst') === 'true';
}

function hoursToAngle(h) { return (h / 24) * Math.PI * 2 + Math.PI / 2; }
function sunHoursToAngle(h) { return (h / 24) * Math.PI * 2 + Math.PI / 2; }

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
let map = null;
let marker = null;
let currentPlaceDisplayName = "Piacenza - Italia";
let isTimezoneOnlyMode = false;

async function initClock() {
    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    const isManualDst = localStorage.getItem('sunclock_dst') === 'true';
    
    document.getElementById('auto-dst-toggle').checked = isAuto;
    document.getElementById('manual-dst-toggle').checked = isManualDst;
    updateDstUI(isAuto);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchAndUpdateLocation(position.coords.latitude, position.coords.longitude, "Posizione Corrente");
            },
            async (error) => {
                await setupDefaultLocation();
            },
            { timeout: 8000, enableHighAccuracy: true }
        );
    } else {
        await setupDefaultLocation();
    }
}

async function setupDefaultLocation() {
    cachedLat = 45.05; cachedLon = 9.69;
    document.getElementById('input-lat').value = cachedLat;
    document.getElementById('input-lon').value = cachedLon;
    await fetchPlaceName(cachedLat, cachedLon);
    updateTimeForLocation();
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);
}

// Migliorata per cercare dettagli città/paese
async function fetchPlaceName(lat, lon) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`);
        const data = await res.json();
        if (data && data.address) {
            const addr = data.address;
            const city = addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || addr.county || "";
            const country = addr.country || "";
            currentPlaceDisplayName = (city && country) ? `${city}, ${country}` : (city || country || "Località");
        }
    } catch (err) { currentPlaceDisplayName = "Località"; }
}

function toggleAutoDST(checked) {
    localStorage.setItem('sunclock_auto_dst', checked ? 'true' : 'false');
    if (checked) {
        localStorage.setItem('sunclock_dst', 'false');
        document.getElementById('manual-dst-toggle').checked = false;
    }
    updateDstUI(checked);
    if (!isCustomTime) updateTimeForLocation();
    updateSunClock(cachedLat, cachedLon);
}

function toggleManualDST(checked) {
    localStorage.setItem('sunclock_dst', checked ? 'true' : 'false');
    if (!isCustomTime) updateTimeForLocation();
    updateSunClock(cachedLat, cachedLon);
}

function updateDstUI(isAuto) {
    const manualBox = document.getElementById('manual-dst-box');
    const manualInput = document.getElementById('manual-dst-toggle');
    manualBox.style.opacity = isAuto ? "0.4" : "1.0";
    manualInput.disabled = isAuto;
}

function toggleMoonDropdown() {
    const content = document.getElementById('moon-dropdown-content');
    const arrow = document.getElementById('dropdown-arrow');
    content.classList.toggle('show');
    arrow.innerText = content.classList.contains('show') ? '▲' : '▼';
}

function applyTimezonePreset() {
    isTimezoneOnlyMode = true; 
    if (!isCustomTime) updateTimeForLocation();
    
    const tz = document.getElementById('timezone-preset').value;
    document.getElementById('location-text').innerHTML = `<div style="font-size: 1.15rem; margin-bottom: 4px;">Fuso UTC ${tz >= 0 ? "+" : ""}${tz}</div>`;
    
    // Resetta pannelli... (codice esistente invariato)
    toggleSettingsModal(false);
}

function getEffectiveDate() {
    const tzPresetVal = parseFloat(document.getElementById('timezone-preset').value);
    const now = new Date();
    let isDstNowActive = getCurrentDstState();
    const dstOffset = isDstNowActive ? 1 : 0;
    const utcTimeMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utcTimeMs + ((tzPresetVal + dstOffset) * 3600000));
}

function updateInputsVal() {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const hours = String(selectedDate.getHours()).padStart(2, '0');
    const minutes = String(selectedDate.getMinutes()).padStart(2, '0');
    document.getElementById('input-date').value = `${year}-${month}-${day}`;
    document.getElementById('date-display-btn').innerText = `${day}/${month}/${year}`;
    document.getElementById('input-time').value = `${hours}:${minutes}`;
}

function onDateChanged(val) {
    if (!val) return;
    const parts = val.split('-');
    selectedDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    isCustomTime = true;
    updateInputsVal();
    if (!isTimezoneOnlyMode) updateSunClock(cachedLat, cachedLon);
}

function onTimeChanged(val) {
    if (!val) return;
    const parts = val.split(':');
    selectedDate.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
    isCustomTime = true;
    updateInputsVal();
    if (!isTimezoneOnlyMode) updateSunClock(cachedLat, cachedLon);
}

async function fetchAndUpdateLocation(lat, lon, fallbackName = "Posizione") {
    cachedLat = lat; cachedLon = lon;
    isTimezoneOnlyMode = false; 
    document.getElementById('input-lat').value = cachedLat;
    document.getElementById('input-lon').value = cachedLon;

    await fetchPlaceName(lat, lon);

    let approxOffset = Math.round(cachedLon / 15);
    let selectEl = document.getElementById('timezone-preset');
    for(let opt of selectEl.options) {
        if(parseFloat(opt.value) === approxOffset) { selectEl.value = opt.value; break; }
    }

    isCustomTime = false;
    updateTimeForLocation();
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);
}

function resetToNow() {
    isCustomTime = false;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => fetchAndUpdateLocation(pos.coords.latitude, pos.coords.longitude, "Posizione Corrente"),
            () => { updateTimeForLocation(); updateInputsVal(); updateSunClock(cachedLat, cachedLon); },
            { timeout: 10000, enableHighAccuracy: true }
        );
    } else {
        updateTimeForLocation(); updateInputsVal(); updateSunClock(cachedLat, cachedLon);
    }
}

function updateTimeForLocation() { if (!isCustomTime) selectedDate = getEffectiveDate(); }

function useGPSLocation() {
    isTimezoneOnlyMode = false;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => { fetchAndUpdateLocation(pos.coords.latitude, pos.coords.longitude, "GPS"); toggleSettingsModal(false); },
            () => { updateTimeForLocation(); updateSunClock(cachedLat, cachedLon); }
        );
    }
}

async function searchCity() {
    const query = document.getElementById('input-city').value.trim();
    if (!query) return;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data && data.length > 0) window.location.href = `posizione.html?lat=${data[0].lat}&lon=${data[0].lon}&city=${encodeURIComponent(data[0].display_name.split(',')[0])}`;
    } catch (e) {}
}

async function getPlaceNameAndRedirect(lat, lon) {
    await fetchPlaceName(lat, lon);
    window.location.href = `posizione.html?lat=${lat}&lon=${lon}&city=${encodeURIComponent(currentPlaceDisplayName)}`;
}

function toggleMap() {
    const mapContainer = document.getElementById('map-container');
    mapContainer.style.display = (mapContainer.style.display === 'block') ? 'none' : 'block';
    if (mapContainer.style.display === 'block' && !map) {
        // ... (Logica Mappa esistente invariata) ...
    }
}

function applyManualLocation() {
    const lat = parseFloat(document.getElementById('input-lat').value);
    const lon = parseFloat(document.getElementById('input-lon').value);
    if (!isNaN(lat) && !isNaN(lon)) getPlaceNameAndRedirect(lat, lon);
}

function getCompleteMoonTimes(date, lat, lon) {
    let baseDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
    let times = SunCalc.getMoonTimes(baseDate, lat, lon);
    let rise = times.rise, set = times.set;
    if (!rise || !set || times.alwaysUp || times.alwaysDown) {
        let dPrev = new Date(baseDate); dPrev.setDate(baseDate.getDate() - 1);
        let pTimes = SunCalc.getMoonTimes(dPrev, lat, lon);
        let dNext = new Date(baseDate); dNext.setDate(baseDate.getDate() + 1);
        let nTimes = SunCalc.getMoonTimes(dNext, lat, lon);
        if (!rise) rise = (pTimes.rise && pTimes.rise > dPrev) ? pTimes.rise : nTimes.rise;
        if (!set) set = (pTimes.set && pTimes.set > dPrev) ? pTimes.set : nTimes.set;
    }
    return { rise, set, alwaysUp: times.alwaysUp, alwaysDown: times.alwaysDown };
}

function updateSunClock(lat, lon) {
    const refDate = selectedDate;
    let baseDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0);

    cachedTimes = SunCalc.getTimes(baseDate, lat, lon);
    cachedMoonTimes = getCompleteMoonTimes(baseDate, lat, lon);
    cachedMoonIllumination = SunCalc.getMoonIllumination(baseDate);

    updateMoonDigitalPanel(cachedMoonIllumination, cachedMoonTimes);

    if (ctx) {
        ctx.clearRect(0, 0, 500, 500);
        drawSunSlicesSafe(cachedTimes);
        drawMoonVisibilityArc(cachedMoonTimes, refDate);
        drawSolarMeridianLines(cachedTimes);
        drawMinuteRingSafe();
        drawClockNumbers();
    }
    
    updatePageBackground(cachedTimes);
    
    if (!isTimezoneOnlyMode) {
        populateTable(cachedTimes, cachedMoonTimes, cachedMoonIllumination);
        
        const standardTz = Math.round(lon / 15);
        const isDstNowActive = getCurrentDstState();
        const totalTzOffset = standardTz + (isDstNowActive ? 1 : 0);
        
        const stdSign = standardTz >= 0 ? "+" : "";
        const totalSign = totalTzOffset >= 0 ? "+" : "";
        
        let fusoText = `Fuso solare: UTC ${stdSign}${standardTz}`;
        if (isDstNowActive) {
            fusoText += ` (Ora legale: UTC ${totalSign}${totalTzOffset})`;
        }
        
        document.getElementById('location-text').innerHTML = `
            <div style="font-size: 1.15rem; margin-bottom: 4px;">${currentPlaceDisplayName}</div>
            <div style="font-size: 0.95rem; opacity: 0.9;">Lat: ${parseFloat(lat).toFixed(2)} | Lon: ${parseFloat(lon).toFixed(2)}</div>
            <div style="font-size: 0.90rem; opacity: 0.9; margin-top: 2px;">${fusoText}</div>
        `;
        document.getElementById('txt-sunrise').innerText = formatTime(cachedTimes.sunrise);
        document.getElementById('txt-sunset').innerText = formatTime(cachedTimes.sunset);
    }
}

// ... (Resto delle funzioni grafiche: timeToHours, isValidDate, etc. invariate)
