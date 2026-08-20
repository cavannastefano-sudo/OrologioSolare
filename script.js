SunCalc.addTime(-18, 'astronomicalDawn', 'astronomicalDusk');
SunCalc.addTime(-12, 'nauticalDawn', 'nauticalDusk');
SunCalc.addTime(-6, 'dawn', 'dusk');

const canvas = document.getElementById('clockCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const cx = 250;
const cy = 250;
const radius = 248;

// Funzione centrale per gestire l'Ora Legale
function getCurrentDstState() {
    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    if (isAuto && typeof getEffectiveDST === 'function') {
        const autoResult = getEffectiveDST(cachedLat, cachedLon, selectedDate);
        if (autoResult !== undefined) return autoResult;
    }
    return localStorage.getItem('sunclock_dst') === 'true';
}

function hoursToAngle(h) {
    return (h / 24) * Math.PI * 2 + Math.PI / 2;
}

function sunHoursToAngle(h) {
    // Correzione: lo shift dell'ora legale sposta le fasce sul grafico
    const dstShift = getCurrentDstState() ? 1 : 0;
    return ((h - dstShift) / 24) * Math.PI * 2 + Math.PI / 2;
}

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
                cachedLat = 45.05;
                cachedLon = 9.69;
                document.getElementById('input-lat').value = cachedLat;
                document.getElementById('input-lon').value = cachedLon;
                await fetchPlaceName(cachedLat, cachedLon);
                updateTimeForLocation();
                updateInputsVal();
                updateSunClock(cachedLat, cachedLon);
            },
            { timeout: 8000, enableHighAccuracy: true }
        );
    } else {
        cachedLat = 45.05;
        cachedLon = 9.69;
        document.getElementById('input-lat').value = cachedLat;
        document.getElementById('input-lon').value = cachedLon;
        await fetchPlaceName(cachedLat, cachedLon);
        updateTimeForLocation();
        updateInputsVal();
        updateSunClock(cachedLat, cachedLon);
    }
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

// Funzione corretta per calcolare l'ora (include DST)
function timeToHours(date) {
    if (!date || !isValidDate(date)) return null;
    const tzPresetVal = parseFloat(document.getElementById('timezone-preset').value);
    const dstOffset = getCurrentDstState() ? 1 : 0;
    const totalOffsetHours = tzPresetVal + dstOffset;
    
    const shifted = new Date(date.getTime() + (totalOffsetHours * 3600000));
    return shifted.getUTCHours() + shifted.getUTCMinutes() / 60 + shifted.getUTCSeconds() / 3600;
}

// Funzione corretta per visualizzare l'ora (include DST)
function formatTime(date) {
    if (!isValidDate(date)) return "--:--";
    const tzPresetVal = parseFloat(document.getElementById('timezone-preset').value);
    const dstOffset = getCurrentDstState() ? 1 : 0;
    const totalOffsetHours = tzPresetVal + dstOffset;
    
    const shifted = new Date(date.getTime() + (totalOffsetHours * 3600000));
    return String(shifted.getUTCHours()).padStart(2, '0') + ":" + 
           String(shifted.getUTCMinutes()).padStart(2, '0') + ":" + 
           String(shifted.getUTCSeconds()).padStart(2, '0');
}

// [Resto delle funzioni rimangono invariate, assicurati di copiare tutto fino alla fine]

function getEffectiveDate() {
    const tzPresetVal = parseFloat(document.getElementById('timezone-preset').value);
    const now = new Date();
    const dstOffset = getCurrentDstState() ? 1 : 0;
    const targetTotalOffsetHours = tzPresetVal + dstOffset;
    const utcTimeMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utcTimeMs + (targetTotalOffsetHours * 3600000));
}

// Funzioni di utilità (invariate)
function isValidDate(d) { return d instanceof Date && !isNaN(d); }
function updateTimeForLocation() { if (!isCustomTime) selectedDate = getEffectiveDate(); }
function updateInputsVal() {
    const y = selectedDate.getFullYear(), m = String(selectedDate.getMonth() + 1).padStart(2,'0'), d = String(selectedDate.getDate()).padStart(2,'0');
    const hh = String(selectedDate.getHours()).padStart(2,'0'), mm = String(selectedDate.getMinutes()).padStart(2,'0');
    document.getElementById('input-date').value = `${y}-${m}-${d}`;
    document.getElementById('date-display-btn').innerText = `${d}/${m}/${y}`;
    document.getElementById('input-time').value = `${hh}:${mm}`;
}

// Inizializzazione
initClock();
setInterval(updateHands, 50);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.service.worker.js');

// [Inserisci qui tutte le altre funzioni che hai nel tuo script originale (drawSunSlicesSafe, updateSunClock, etc.)]
