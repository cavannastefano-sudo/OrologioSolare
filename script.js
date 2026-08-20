/**
 * =========================================================
 * SunClock24 - Core Script (Definitivo con Ora Legale)
 * =========================================================
 */

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
        const manualInput = document.getElementById('manual-dst-toggle');
        if (manualInput) manualInput.checked = false;
    }
    updateDstUI(checked);
    if (!isCustomTime) {
        selectedDate = getEffectiveDate();
        updateInputsVal();
    }
    updateSunClock(cachedLat, cachedLon);
}

function toggleManualDST(checked) {
    localStorage.setItem('sunclock_dst', checked ? 'true' : 'false');
    if (!isCustomTime) {
        selectedDate = getEffectiveDate();
        updateInputsVal();
    }
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
    document.getElementById('txt-sunrise').innerText = "----";
    document.getElementById('txt-sunset').innerText = "----";
    
    document.getElementById('moon-digital-icon').innerText = "🌕";
    document.getElementById('moon-phase-name').innerText = "----";
    document.getElementById('moon-rise').innerText = "----";
    document.getElementById('moon-set').innerText = "----";

    const tbody = document.getElementById('times-table-body');
    tbody.innerHTML = `
        <tr><td>Fase Lunare</td><td>----</td></tr>
        <tr><td>Sorge la Luna</td><td>----</td></tr>
        <tr><td>Tramonta la Luna</td><td>----</td></tr>
        <tr><td>Mezzanotte solare</td><td>----</td></tr>
        <tr><td>Alba astronomica</td><td>----</td></tr>
        <tr><td>Alba Nautica</td><td>----</td></tr>
        <tr><td>Alba Civile</td><td>----</td></tr>
        <tr><td>Alba</td><td>----</td></tr>
        <tr><td>Fine dell'alba</td><td>----</td></tr>
        <tr><td>Fine dell'ora d'oro</td><td>----</td></tr>
        <tr><td>Mezzogiorno solare</td><td>----</td></tr>
        <tr><td>Inizio dell'ora d'oro</td><td>----</td></tr>
        <tr><td>Inizio del tramonto</td><td>----</td></tr>
        <tr><td>Tramonto</td><td>----</td></tr>
        <tr><td>Crepuscolo civile</td><td>----</td></tr>
        <tr><td>Crepuscolo nautico</td><td>----</td></tr>
        <tr><td>Crepuscolo astronomico</td><td>----</td></tr>
    `;

    const refDate = selectedDate;
    let baseDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0);
    cachedTimes = SunCalc.getTimes(baseDate, cachedLat, cachedLon);
    
    if (ctx && cachedTimes) {
        ctx.clearRect(0, 0, 500, 500);
        drawSunSlicesSafe(cachedTimes);
        drawMoonVisibilityArc(cachedMoonTimes, refDate);
        drawSolarMeridianLines(cachedTimes);
        drawMinuteRingSafe();
        drawClockNumbers();
    }

    if (cachedTimes) {
        updatePageBackground(cachedTimes);
    }

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
        const currentLat = parseFloat(document.getElementById('input-lat').value) || cachedLat;
        const currentLon = parseFloat(document.getElementById('input-lon').value) || cachedLon;
        
        const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            maxZoom: 17,
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM'
        });

        const political = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://carto.com/attributions">CARTO</a>'
        });

        let savedLayer = localStorage.getItem('sunclock_map_layer') === 'political' ? political : topo;

        map = L.map('map-container', {
            center: [currentLat, currentLon],
            zoom: 6,
            layers: [savedLayer]
        });

        const baseMaps = { "
