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
let map = null;
let marker = null;
let currentPlaceDisplayName = "Ricerca in corso...";
let isTimezoneOnlyMode = false;

function getCurrentDstState() {
    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    if (isAuto && typeof getEffectiveDST === 'function') {
        return getEffectiveDST(cachedLat, cachedLon, selectedDate);
    }
    return localStorage.getItem('sunclock_dst') === 'true';
}

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
    if (manualBox && manualInput) {
        manualBox.style.opacity = isAuto ? "0.4" : "1.0";
        manualInput.disabled = isAuto;
    }
}

function toggleMoonDropdown() {
    const content = document.getElementById('moon-dropdown-content');
    const arrow = document.getElementById('dropdown-arrow');
    content.classList.toggle('show');
    arrow.innerText = content.classList.contains('show') ? '▲' : '▼';
}

async function fetchPlaceName(lat, lon) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
        const geoData = await res.json();
        if (geoData && geoData.address) {
            const country = geoData.address.country || '';
            const city = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.county || '';
            currentPlaceDisplayName = (country && city && city.toLowerCase() !== country.toLowerCase()) ? `${country} - ${city}` : (city || country || "Piacenza - Italia");
        }
    } catch (err) { currentPlaceDisplayName = "Piacenza - Italia"; }
}

function applyTimezonePreset() {
    isTimezoneOnlyMode = true;
    if (!isCustomTime) updateTimeForLocation();
    updateSunClock(cachedLat, cachedLon);
    toggleSettingsModal(false);
}

function getEffectiveDate() {
    const tzPresetVal = parseFloat(document.getElementById('timezone-preset').value);
    const dstOffset = getCurrentDstState() ? 1 : 0;
    return new Date(Date.now() + ((tzPresetVal + dstOffset) * 3600000));
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
    selectedDate.setUTCFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    isCustomTime = true;
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);
}

function onTimeChanged(val) {
    if (!val) return;
    const parts = val.split(':');
    selectedDate.setUTCHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
    isCustomTime = true;
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);
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
    updateTimeForLocation();
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);
}

function updateTimeForLocation() {
    if (!isCustomTime) selectedDate = getEffectiveDate();
}

function useGPSLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => { fetchAndUpdateLocation(pos.coords.latitude, pos.coords.longitude, "GPS"); toggleSettingsModal(false); },
            (err) => { updateTimeForLocation(); updateSunClock(cachedLat, cachedLon); }
        );
    }
}

async function searchCity() {
    const query = document.getElementById('input-city').value.trim();
    if (!query) return;
    document.getElementById('search-status').innerText = "Ricerca...";
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data.length > 0) window.location.href = `posizione.html?lat=${data[0].lat}&lon=${data[0].lon}&city=${encodeURIComponent(data[0].display_name.split(',')[0])}`;
        else document.getElementById('search-status').innerText = "Non trovata.";
    } catch (e) { document.getElementById('search-status').innerText = "Errore."; }
}

async function getPlaceNameAndRedirect(lat, lon) {
    await fetchPlaceName(lat, lon);
    window.location.href = `posizione.html?lat=${lat}&lon=${lon}&city=${encodeURIComponent(currentPlaceDisplayName)}`;
}

function toggleMap() {
    const mapContainer = document.getElementById('map-container');
    mapContainer.style.display = mapContainer.style.display === 'block' ? 'none' : 'block';
    if (!map) {
        map = L.map('map-container').setView([cachedLat, cachedLon], 6);
        const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '&copy; OpenStreetMap' });
        const political = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, attribution: '&copy; CARTO' });
        let savedLayer = localStorage.getItem('sunclock_map_layer') === 'political' ? political : topo;
        map.addLayer(savedLayer);
        L.control.layers({"Topografica": topo, "Politica": political}).addTo(map);

        map.on('baselayerchange', function (e) {
            localStorage.setItem('sunclock_map_layer', e.name === 'Politica' ? 'political' : 'topo');
        });

        marker = L.marker([cachedLat, cachedLon], {draggable: true}).addTo(map);
        marker.on('dragend', (e) => {
            const pos = marker.getLatLng();
            document.getElementById('input-lat').value = pos.lat.toFixed(4);
            document.getElementById('input-lon').value = pos.lng.toFixed(4);
        });
        map.on('click', (e) => {
            marker.setLatLng(e.latlng);
            document.getElementById('input-lat').value = e.latlng.lat.toFixed(4);
            document.getElementById('input-lon').value = e.latlng.lng.toFixed(4);
            getPlaceNameAndRedirect(e.latlng.lat, e.latlng.lng);
        });
    } else map.invalidateSize();
}

function applyManualLocation() {
    const lat = parseFloat(document.getElementById('input-lat').value);
    const lon = parseFloat(document.getElementById('input-lon').value);
    if (!isNaN(lat) && !isNaN(lon)) getPlaceNameAndRedirect(lat, lon);
}

function toTargetTime(date) {
    if (!isValidDate(date)) return null;
    const tzPresetVal = parseFloat(document.getElementById('timezone-preset').value);
    const dstOffset = getCurrentDstState() ? 1 : 0;
    return new Date(date.getTime() + ((tzPresetVal + dstOffset) * 3600000));
}

function getCompleteMoonTimes(date, lat, lon) {
    let times = SunCalc.getMoonTimes(date, lat, lon);
    return { rise: times.rise, set: times.set, alwaysUp: times.alwaysUp, alwaysDown: times.alwaysDown };
}

function updateSunClock(lat, lon) {
    const tzPresetVal = parseFloat(document.getElementById('timezone-preset').value);
    const isDstActive = getCurrentDstState();
    const totalTzOffset = tzPresetVal + (isDstActive ? 1 : 0);
    let utcCalculationDate = new Date(selectedDate.getTime() - (totalTzOffset * 3600000));

    cachedTimes = SunCalc.getTimes(utcCalculationDate, lat, lon);
    cachedMoonTimes = getCompleteMoonTimes(utcCalculationDate, lat, lon);
    cachedMoonIllumination = SunCalc.getMoonIllumination(utcCalculationDate);

    updateMoonDigitalPanel(cachedMoonIllumination, cachedMoonTimes);
    ctx.clearRect(0, 0, 500, 500);
    drawSunSlicesSafe(cachedTimes);
    drawMoonVisibilityArc(cachedMoonTimes, selectedDate);
    drawSolarMeridianLines(cachedTimes);
    drawMinuteRingSafe();
    drawClockNumbers();
    updatePageBackground(cachedTimes);
    populateTable(cachedTimes, cachedMoonTimes, cachedMoonIllumination);

    const tz = document.getElementById('timezone-preset').value;
    const latFmt = parseFloat(lat).toFixed(2);
    const lonFmt = parseFloat(lon).toFixed(2);
    const dstLabel = isDstActive ? "Ora Legale Attiva (+1h)" : "Ora Solare Standard";
    
    if (isTimezoneOnlyMode) {
        document.getElementById('location-text').innerHTML = `
            <div style="font-size: 1.15rem;">Fuso UTC ${tz >= 0 ? "+" : ""}${tz}</div>
            <div style="font-size: 0.85rem; opacity: 0.85; margin-top: 2px;">${dstLabel}</div>
        `;
    } else {
        document.getElementById('location-text').innerHTML = `
            <div style="font-size: 1.15rem; margin-bottom: 2px;">${currentPlaceDisplayName}</div>
            <div style="font-size: 0.95rem; opacity: 0.9;">
                Lat: ${latFmt} | Lon: ${lonFmt}
            </div>
            <div style="font-size: 0.95rem; opacity: 0.9; margin-top: 2px;">
                Fuso: UTC ${tz >= 0 ? "+" : ""}${tz}
            </div>
            <div style="font-size: 0.85rem; opacity: 0.85; margin-top: 2px;">${dstLabel}</div>
        `;
    }
    
    document.getElementById('txt-sunrise').innerText = formatTime(cachedTimes.sunrise);
    document.getElementById('txt-sunset').innerText = formatTime(cachedTimes.sunset);
}

function timeToHours(date) {
    if (!date || !isValidDate(date)) return null;
    const targetDate = toTargetTime(date);
    return targetDate.getUTCHours() + targetDate.getUTCMinutes() / 60 + targetDate.getUTCSeconds() / 3600;
}

function hoursToAngle(h) { return (h / 24) * Math.PI * 2 + Math.PI / 2; }
function isValidDate(d) { return d instanceof Date && !isNaN(d); }

function drawMoonVisibilityArc(moonTimes, refDate) {
    let rise = toTargetTime(moonTimes.rise);
    let set = toTargetTime(moonTimes.set);
    if (!isValidDate(rise) || !isValidDate(set)) return;
    let startH = timeToHours(moonTimes.rise), endH = timeToHours(moonTimes.set);
    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#64748b';
    ctx.arc(cx, cy, radius - 7, hoursToAngle(startH), hoursToAngle(endH));
    ctx.stroke();
    ctx.restore();
}

function drawSector(startH, endH, color, r) {
    startH = (startH + 24) % 24; endH = (endH + 24) % 24;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    if (endH < startH) { ctx.arc(cx, cy, r, hoursToAngle(startH), hoursToAngle(24)); ctx.arc(cx, cy, r, hoursToAngle(0), hoursToAngle(endH)); }
    else ctx.arc(cx, cy, r, hoursToAngle(startH), hoursToAngle(endH));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
}

function drawSolarMeridianLines(times) {
    [times.solarNoon, times.nadir].forEach(t => {
        const h = timeToHours(t);
        if (h !== null) {
            const angle = hoursToAngle(h);
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
            ctx.strokeStyle = '#ef4444'; ctx.stroke();
        }
    });
}

function drawMinuteRingSafe() {
    for (let i = 0; i < 60; i++) {
        const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const len = (i % 5 === 0) ? 18 : 10;
        ctx.beginPath(); ctx.moveTo(cx + (radius - len) * Math.cos(angle), cy + (radius - len) * Math.sin(angle));
        ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = (i % 5 === 0) ? 4.5 : 3; ctx.stroke();
    }
}

function drawClockNumbers() {
    ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
    for (let i = 1; i <= 24; i++) {
        const ang = hoursToAngle(i);
        ctx.fillStyle = '#39ff14'; ctx.fillText(i, cx + (radius * 0.65) * Math.cos(ang), cy + (radius * 0.65) * Math.sin(ang));
    }
}

function updatePageBackground(times) {
    if (!times) return;
    const h = selectedDate.getUTCHours() + selectedDate.getUTCMinutes() / 60;
    const color = getIntervalColorSafe(h, times);
    document.body.style.backgroundColor = color === PALETTE.night ? '#000000' : color;
}

function getIntervalColorSafe(h, times) {
    const hSunrise = timeToHours(times.sunrise);
    const hSunset = timeToHours(times.sunset);
    if (!isValidDate(times.sunrise) || !isValidDate(times.sunset) || hSunrise === null || hSunset === null) {
        return PALETTE.day;
    }
    if (h >= hSunrise && h < hSunset) return PALETTE.day;
    return PALETTE.night;
}

function formatTime(date) {
    const t = toTargetTime(date);
    return isValidDate(t) ? t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }) : "--:--";
}

function updateMoonDigitalPanel(illumination, moonTimes) {
    document.getElementById('moon-rise').innerText = formatTime(moonTimes.rise);
    document.getElementById('moon-set').innerText = formatTime(moonTimes.set);
}

function populateTable(times, moonTimes, illumination) {
    const tbody = document.getElementById('times-table-body');
    tbody.innerHTML = `<tr><td>Alba</td><td>${formatTime(times.sunrise)}</td></tr><tr><td>Tramonto</td><td>${formatTime(times.sunset)}</td></tr>`;
}

function toggleTimesModal(show) { document.getElementById('modal-times').style.display = show ? 'flex' : 'none'; }
function toggleSettingsModal(show) { document.getElementById('modal-settings').style.display = show ? 'flex' : 'none'; }

function updateHands() {
    if (!isCustomTime) { selectedDate = getEffectiveDate(); updateInputsVal(); }
    document.getElementById('digital-clock').innerText = selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });
    const h = selectedDate.getUTCHours() + selectedDate.getUTCMinutes() / 60 + selectedDate.getUTCSeconds() / 3600;
    document.getElementById('hand-hour').style.transform = `rotate(${(h / 24) * 360 - 180}deg)`;
    document.getElementById('hand-minute').style.transform = `rotate(${(selectedDate.getUTCMinutes() / 60) * 360}deg)`;
    document.getElementById('hand-second').style.transform = `rotate(${(selectedDate.getUTCSeconds() / 60) * 360}deg)`;
}

initClock();
setInterval(updateHands, 50);
