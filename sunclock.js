SunCalc.addTime(-18, 'astronomicalDawn', 'astronomicalDusk');
SunCalc.addTime(-12, 'nauticalDawn', 'nauticalDusk');
SunCalc.addTime(-6, 'dawn', 'dusk');

const canvas = document.getElementById('clockCanvas');
const ctx = canvas.getContext('2d');
const cx = 250;
const cy = 250;
const radius = 248;

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

function getTotalOffsetHours() {
    const tzPresetVal = parseFloat(document.getElementById('timezone-preset').value);
    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    let dstShift = 0;
    
    if (isAuto && typeof getEffectiveDST === 'function') {
        dstShift = getEffectiveDST(cachedLat, cachedLon, selectedDate) ? 1 : 0;
    } else {
        dstShift = localStorage.getItem('sunclock_dst') === 'true' ? 1 : 0;
    }
    return tzPresetVal + dstShift;
}

function hoursToAngle(h) {
    // Posiziona la mezzanotte (00:00) esattamente in basso sul quadrante
    return (h / 24) * Math.PI * 2 + Math.PI / 2;
}

const PALETTE = {
    night: '#000000', astro: '#172554', naut: '#1e3a8a',
    civil: '#3b82f6', sunriseSunset: '#f97316', golden: '#eab308', day: '#bae6fd'            
};

async function initClock() {
    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    const isManualDst = localStorage.getItem('sunclock_dst') === 'true';
    
    const autoDstToggle = document.getElementById('auto-dst-toggle');
    const manualDstToggle = document.getElementById('manual-dst-toggle');
    if (autoDstToggle) autoDstToggle.checked = isAuto;
    if (manualDstToggle) manualDstToggle.checked = isManualDst;

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchAndUpdateLocation(position.coords.latitude, position.coords.longitude, "Posizione Corrente");
            },
            async (error) => {
                cachedLat = 45.05;
                cachedLon = 9.69;
                if(document.getElementById('input-lat')) document.getElementById('input-lat').value = cachedLat;
                if(document.getElementById('input-lon')) document.getElementById('input-lon').value = cachedLon;
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
        if(document.getElementById('input-lat')) document.getElementById('input-lat').value = cachedLat;
        if(document.getElementById('input-lon')) document.getElementById('input-lon').value = cachedLon;
        await fetchPlaceName(cachedLat, cachedLon);
        updateTimeForLocation();
        updateInputsVal();
        updateSunClock(cachedLat, cachedLon);
    }
}

function toggleAutoDST(checked) {
    localStorage.setItem('sunclock_auto_dst', checked ? 'true' : 'false');
    if (!isCustomTime) updateTimeForLocation();
    updateSunClock(cachedLat, cachedLon);
}

function toggleManualDST(checked) {
    localStorage.setItem('sunclock_dst', checked ? 'true' : 'false');
    if (!isCustomTime) updateTimeForLocation();
    updateSunClock(cachedLat, cachedLon);
}

function toggleMoonDropdown() {
    const content = document.getElementById('moon-dropdown-content');
    const arrow = document.getElementById('dropdown-arrow');
    if(!content || !arrow) return;
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
    } catch (err) {
        currentPlaceDisplayName = "Piacenza - Italia";
    }
}

function applyTimezonePreset() {
    isTimezoneOnlyMode = true;
    if (!isCustomTime) updateTimeForLocation();
    updateSunClock(cachedLat, cachedLon);
    toggleSettingsModal(false);
}

function getEffectiveDate() {
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const totalOffset = getTotalOffsetHours();
    return new Date(utc + (totalOffset * 3600000));
}

function updateInputsVal() {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const hours = String(selectedDate.getHours()).padStart(2, '0');
    const minutes = String(selectedDate.getMinutes()).padStart(2, '0');

    if(document.getElementById('input-date')) document.getElementById('input-date').value = `${year}-${month}-${day}`;
    if(document.getElementById('date-display-btn')) document.getElementById('date-display-btn').innerText = `${day}/${month}/${year}`;
    if(document.getElementById('input-time')) document.getElementById('input-time').value = `${hours}:${minutes}`;
}

function onDateChanged(val) {
    if (!val) return;
    const parts = val.split('-');
    selectedDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    isCustomTime = true;
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);
}

function onTimeChanged(val) {
    if (!val) return;
    const parts = val.split(':');
    selectedDate.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
    isCustomTime = true;
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);
}

async function fetchAndUpdateLocation(lat, lon, fallbackName = "Posizione") {
    cachedLat = lat;
    cachedLon = lon;
    isTimezoneOnlyMode = false;
    if(document.getElementById('input-lat')) document.getElementById('input-lat').value = cachedLat;
    if(document.getElementById('input-lon')) document.getElementById('input-lon').value = cachedLon;

    await fetchPlaceName(lat, lon);

    let approxOffset = Math.round(cachedLon / 15);
    let selectEl = document.getElementById('timezone-preset');
    if(selectEl) {
        for(let opt of selectEl.options) {
            if(parseFloat(opt.value) === approxOffset) {
                selectEl.value = opt.value;
                break;
            }
        }
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
    if (!isCustomTime) {
        selectedDate = getEffectiveDate();
    }
}

function useGPSLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchAndUpdateLocation(position.coords.latitude, position.coords.longitude, "GPS");
                toggleSettingsModal(false);
            },
            (error) => {
                updateTimeForLocation();
                updateSunClock(cachedLat, cachedLon); 
                if(document.getElementById('location-text')) document.getElementById('location-text').innerText = "GPS disattivato.";
            }
        );
    }
}

async function searchCity() {
    const queryEl = document.getElementById('input-city');
    const statusEl = document.getElementById('search-status');
    if(!queryEl || !statusEl) return;
    const query = queryEl.value.trim();
    if (!query) { statusEl.innerText = "Inserisci il nome di una città."; return; }
    statusEl.innerText = "Ricerca in corso...";
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data && data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);
            const cityName = encodeURIComponent(data[0].display_name.split(',')[0]);
            window.location.href = `posizione.html?lat=${lat}&lon=${lon}&city=${cityName}`;
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
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
        const geoData = await res.json();
        if (geoData && geoData.address) {
            const country = geoData.address.country || '';
            const city = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.county || '';
            placeName = (country && city && city.toLowerCase() !== country.toLowerCase()) ? `${country} - ${city}` : (city || country || "Posizione");
        }
    } catch (err) {}
    window.location.href = `posizione.html?lat=${lat}&lon=${lon}&city=${encodeURIComponent(placeName)}`;
}

function toggleMap() {
    const mapContainer = document.getElementById('map-container');
    if(!mapContainer) return;
    if (mapContainer.style.display === 'block') {
        mapContainer.style.display = 'none';
    } else {
        mapContainer.style.display = 'block';
        if (!map) {
            const currentLat = parseFloat(document.getElementById('input-lat')?.value) || cachedLat;
            const currentLon = parseFloat(document.getElementById('input-lon')?.value) || cachedLon;
            
            const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17 });
            const political = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 });

            let savedLayer = localStorage.getItem('sunclock_map_layer') === 'political' ? political : topo;

            map = L.map('map-container', { center: [currentLat, currentLon], zoom: 6, layers: [savedLayer] });
            L.control.layers({"Topografica": topo, "Politica": political}).addTo(map);

            map.on('baselayerchange', function (e) {
                localStorage.setItem('sunclock_map_layer', e.name === 'Politica' ? 'political' : 'topo');
            });

            marker = L.marker([currentLat, currentLon], {draggable: true}).addTo(map);
            marker.on('dragend', function(e) {
                const pos = marker.getLatLng();
                if(document.getElementById('input-lat')) document.getElementById('input-lat').value = pos.lat.toFixed(4);
                if(document.getElementById('input-lon')) document.getElementById('input-lon').value = pos.lng.toFixed(4);
            });

            map.on('click', function(e) {
                marker.setLatLng([e.latlng.lat, e.latlng.lng]);
                if(document.getElementById('input-lat')) document.getElementById('input-lat').value = e.latlng.lat.toFixed(4);
                if(document.getElementById('input-lon')) document.getElementById('input-lon').value = e.latlng.lng.toFixed(4);
                getPlaceNameAndRedirect(e.latlng.lat, e.latlng.lng);
            });
        } else {
            map.invalidateSize();
        }
    }
}

function applyManualLocation() {
    const lat = parseFloat(document.getElementById('input-lat')?.value);
    const lon = parseFloat(document.getElementById('input-lon')?.value);
    if (!isNaN(lat) && !isNaN(lon)) getPlaceNameAndRedirect(lat, lon);
    else alert("Inserisci coordinate valide.");
}

function getCompleteMoonTimes(date, lat, lon) {
    let times = SunCalc.getMoonTimes(date, lat, lon);
    let rise = times.rise, set = times.set;

    if (!rise || !set || times.alwaysUp || times.alwaysDown) {
        let dPrev = new Date(date); dPrev.setDate(date.getDate() - 1);
        let pTimes = SunCalc.getMoonTimes(dPrev, lat, lon);
        let dNext = new Date(date); dNext.setDate(date.getDate() + 1);
        let nTimes = SunCalc.getMoonTimes(dNext, lat, lon);

        if (!rise) rise = (pTimes.rise && pTimes.rise > dPrev) ? pTimes.rise : nTimes.rise;
        if (!set) set = (pTimes.set && pTimes.set > dPrev) ? pTimes.set : nTimes.set;
    }
    return { rise: rise, set: set, alwaysUp: times.alwaysUp, alwaysDown: times.alwaysDown };
}

function updateSunClock(lat, lon) {
    const totalOffset = getTotalOffsetHours();
    const utcDate = new Date(selectedDate.getTime() - (totalOffset * 3600000));

    cachedTimes = SunCalc.getTimes(utcDate, lat, lon);
    cachedMoonTimes = getCompleteMoonTimes(utcDate, lat, lon);
    cachedMoonIllumination = SunCalc.getMoonIllumination(utcDate);

    updateMoonDigitalPanel(cachedMoonIllumination, cachedMoonTimes);

    ctx.clearRect(0, 0, 500, 500);

    drawSunSlicesSafe(cachedTimes);
    drawMoonVisibilityArc(cachedMoonTimes, selectedDate);
    drawSolarMeridianLines(cachedTimes);
    drawMinuteRingSafe();
    drawClockNumbers();
    updatePageBackground(cachedTimes);
    populateTable(cachedTimes, cachedMoonTimes, cachedMoonIllumination);

    const tz = document.getElementById('timezone-preset')?.value || "1";
    const latFmt = parseFloat(lat).toFixed(2);
    const lonFmt = parseFloat(lon).toFixed(2);
    
    const locationTextEl = document.getElementById('location-text');
    if(locationTextEl) {
        locationTextEl.innerHTML = isTimezoneOnlyMode ? 
            `<div style="font-size: 1.15rem;">Fuso UTC ${tz >= 0 ? "+" : ""}${tz}</div>` :
            `<div style="font-size: 1.15rem; margin-bottom: 4px;">${currentPlaceDisplayName}</div>
             <div style="font-size: 0.95rem; opacity: 0.9;">Lat: ${latFmt} | Lon: ${lonFmt}</div>
             <div style="font-size: 0.95rem; opacity: 0.9; margin-top: 2px;">Fuso: UTC ${tz >= 0 ? "+" : ""}${tz}</div>`;
    }

    if(document.getElementById('txt-sunrise')) document.getElementById('txt-sunrise').innerText = formatTime(cachedTimes.sunrise);
    if(document.getElementById('txt-sunset')) document.getElementById('txt-sunset').innerText = formatTime(cachedTimes.sunset);
}

function timeToHours(date) {
    if (!date || !isValidDate(date)) return null;
    const totalOffset = getTotalOffsetHours();
    const localDate = new Date(date.getTime() + (totalOffset * 3600000));
    let hours = localDate.getUTCHours() + localDate.getUTCMinutes() / 60 + localDate.getUTCSeconds() / 3600;
    return (hours + 24) % 24;
}

function isValidDate(d) {
    return d instanceof Date && !isNaN(d.getTime());
}

function drawMoonVisibilityArc(moonTimes, refDate) {
    let rise = moonTimes.rise, set = moonTimes.set;
    if (moonTimes.alwaysUp) {
        rise = new Date(refDate); rise.setHours(0,0,0,0);
        set = new Date(refDate); set.setHours(23,59,59,999);
    }
    if (!isValidDate(rise) || !isValidDate(set)) return;

    let startH = (rise < new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate())) ? 0 : timeToHours(rise);
    let endH = (set > new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59)) ? 24 : timeToHours(set);

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
        const totalOffset = getTotalOffsetHours();
        let utcDate = new Date(selectedDate.getTime() - (totalOffset * 3600000));
        utcDate.setUTCHours(12, 0, 0, 0);
        const sunPos = SunCalc.getPosition(utcDate, cachedLat, cachedLon);
        const fallbackColor = sunPos.altitude < 0 ? PALETTE.night : PALETTE.day;

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
        const noonH = timeToHours(times.solarNoon);
        if (noonH !== null) {
            const angle = hoursToAngle(noonH);
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.stroke();
        }
    }
    if (isValidDate(times.nadir)) {
        const nadirH = timeToHours(times.nadir);
        if (nadirH !== null) {
            const angle = hoursToAngle(nadirH);
            ctx.beginPath(); ctx.moveTo(cx, cy);
            ctx.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.stroke();
        }
    }
}

function drawMinuteRingSafe() {
    for (let i = 0; i < 60; i++) {
        const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const len = (i % 5 === 0) ? 18 : 10;
        const x1 = cx + (radius - len) * Math.cos(angle), y1 = cy + (radius - len) * Math.sin(angle);
        const x2 = cx + radius * Math.cos(angle), y2 = cy + radius * Math.sin(angle);

        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#facc15'; ctx.lineWidth = (i % 5 === 0) ? 4.5 : 3; ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#ff0000'; ctx.lineWidth = (i % 5 === 0) ? 2 : 1.2; ctx.stroke();
    }
}

function drawClockNumbers() {
    ctx.font = 'bold 26px sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
    const hRadius = radius * 0.65;
    for (let i = 1; i <= 24; i++) {
        const angle = hoursToAngle(i);
        const hx = cx + hRadius * Math.cos(angle), hy = cy + hRadius * Math.sin(angle);
        ctx.lineWidth = 4; ctx.strokeStyle = '#ff0000'; ctx.strokeText(i, hx, hy);
        ctx.fillStyle = '#39ff14'; ctx.fillText(i, hx, hy);
    }
    const mRadius = radius * 0.86;
    for (let m = 0; m < 60; m += 5) {
        const angle = (m / 60) * Math.PI * 2 - Math.PI / 2;
        const mx = cx + mRadius * Math.cos(angle), my = cy + mRadius * Math.sin(angle);
        const text = String(m).padStart(2, '0');
        ctx.lineWidth = 4; ctx.strokeStyle = '#ff0000'; ctx.strokeText(text, mx, my);
        ctx.fillStyle = '#39ff14'; ctx.fillText(text, mx, my);
    }
}

function updatePageBackground(times) {
    if (!times) return;
    const h = selectedDate.getHours() + selectedDate.getMinutes() / 60 + selectedDate.getSeconds() / 3600;
    const color = getIntervalColorSafe(h, times);
    const finalBg = color === PALETTE.night ? '#000000' : color;
    document.documentElement.style.backgroundColor = finalBg;
    document.body.style.backgroundColor = finalBg;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', finalBg);
}

function getIntervalColorSafe(h, times) {
    const hSunrise = timeToHours(times.sunrise);
    const hSunset = timeToHours(times.sunset);
    if (!isValidDate(times.sunrise) || !isValidDate(times.sunset) || hSunrise === null || hSunset === null) {
        const totalOffset = getTotalOffsetHours();
        let utcDate = new Date(selectedDate.getTime() - (totalOffset * 3600000));
        utcDate.setUTCHours(12, 0, 0, 0);
        return SunCalc.getPosition(utcDate, cachedLat, cachedLon).altitude < 0 ? PALETTE.night : PALETTE.day;
    }

    const hDawn = timeToHours(times.dawn) ?? (hSunrise - 1.0);
    const hDusk = timeToHours(times.dusk) ?? (hSunset + 1.0);
    const hNautDawn = timeToHours(times.nauticalDawn) ?? (hDawn - 0.8);
    const hNautDusk = timeToHours(times.nauticalDusk) ?? (hDusk + 0.8);
    const hAstroDawn = timeToHours(times.astronomicalDawn) ?? (hNautDawn - 0.8);
    const hAstroDusk = timeToHours(times.astronomicalDusk) ?? (hNautDusk + 0.8);
    const hSunriseEnd = timeToHours(times.sunriseEnd) ?? (hSunrise + 0.2);
    const hGoldenEnd = timeToHours(times.goldenHourEnd) ?? (hSunrise + 1.0);
    const hGoldenStart = timeToHours(times.goldenHour) ?? (hSunset - 1.0);
    const hSunsetStart = timeToHours(times.sunsetStart) ?? (hSunset - 0.2);

    if (h >= hSunrise && h < hSunriseEnd) return PALETTE.sunriseSunset;
    if (h >= hSunriseEnd && h < hGoldenEnd) return PALETTE.golden;
    if (h >= hGoldenEnd && h < hGoldenStart) return PALETTE.day;
    if (h >= hGoldenStart && h < hSunsetStart) return PALETTE.golden;
    if (h >= hSunsetStart && h < hSunset) return PALETTE.sunriseSunset;
    if (h >= hSunset && h < hDusk) return PALETTE.civil;
    if (h >= hDawn && h < hSunrise) return PALETTE.civil;
    if (h >= hNautDawn && h < hDawn) return PALETTE.naut;
    if (h >= hDusk && h < hNautDusk) return PALETTE.naut;
    if (h >= hAstroDawn && h < hNautDawn) return PALETTE.astro;
    if (h >= hNautDusk && h < hAstroDusk) return PALETTE.astro;
    return PALETTE.night;
}

function formatTime(date) {
    if (!isValidDate(date)) return "--:--";
    const totalOffset = getTotalOffsetHours();
    const localDate = new Date(date.getTime() + (totalOffset * 3600000));
    return String(localDate.getUTCHours()).padStart(2, '0') + ":" + 
           String(localDate.getUTCMinutes()).padStart(2, '0') + ":" + 
           String(localDate.getUTCSeconds()).padStart(2, '0');
}

function updateMoonDigitalPanel(illumination, moonTimes) {
    const phase = illumination.phase;
    let phaseName = "", iconSymbol = "🌕";
    if (phase < 0.03 || phase > 0.97) { iconSymbol = "🌑"; phaseName = "Luna Nuova"; }
    else if (phase < 0.22) { iconSymbol = "🌒"; phaseName = "Crescente"; }
    else if (phase < 0.28) { iconSymbol = "🌓"; phaseName = "Primo Quarto"; }
    else if (phase < 0.47) { iconSymbol = "🌔"; phaseName = "Gibbosa Crescente"; }
    else if (phase < 0.53) { iconSymbol = "🌕"; phaseName = "Luna Piena"; }
    else if (phase < 0.72) { iconSymbol = "🌖"; phaseName = "Gibbosa Calante"; }
    else if (phase < 0.78) { iconSymbol = "🌗"; phaseName = "Ultimo Quarto"; }
    else { iconSymbol = "🌘"; phaseName = "Calante"; }

    const iconEl = document.getElementById('moon-digital-icon');
    const nameEl = document.getElementById('moon-phase-name');
    const riseEl = document.getElementById('moon-rise');
    const setEl = document.getElementById('moon-set');

    if(iconEl) iconEl.innerText = iconSymbol;
    if(nameEl) nameEl.innerText = phaseName;
    if(riseEl) riseEl.innerText = isValidDate(moonTimes.rise) ? formatTime(moonTimes.rise) : "--:--";
    if(setEl) setEl.innerText = isValidDate(moonTimes.set) ? formatTime(moonTimes.set) : "--:--";
}

function populateTable(times, moonTimes, illumination) {
    const bodyEl = document.getElementById('times-table-body');
    if(!bodyEl) return;
    bodyEl.innerHTML = `
        <tr style="background: rgba(56, 189, 248, 0.1);"><td colspan="2"><b>🌙 Dati Lunari</b></td></tr>
        <tr><td>Fase Lunare</td><td>${Math.round(illumination.fraction * 100)}% illuminata</td></tr>
        <tr><td>Sorge la Luna</td><td>${formatTime(moonTimes.rise)}</td></tr>
        <tr><td>Tramonta la Luna</td><td>${formatTime(moonTimes.set)}</td></tr>
        <tr style="background: rgba(250, 204, 21, 0.1);"><td colspan="2"><b>☀️ Dati Solari e Crepuscoli</b></td></tr>
        <tr><td>Mezzanotte solare</td><td>${formatTime(times.nadir)}</td></tr>
        <tr><td>Alba astronomica</td><td>${formatTime(times.astronomicalDawn)}</td></tr>
        <tr><td>Alba Nautica</td><td>${formatTime(times.nauticalDawn)}</td></tr>
        <tr><td>Alba Civile</td><td>${formatTime(times.dawn)}</td></tr>
        <tr><td>Alba</td><td>${formatTime(times.sunrise)}</td></tr>
        <tr><td>Fine dell'alba</td><td>${formatTime(times.sunriseEnd)}</td></tr>
        <tr><td>Fine dell'ora d'oro</td><td>${formatTime(times.goldenHourEnd)}</td></tr>
        <tr><td>Mezzogiorno solare</td><td>${formatTime(times.solarNoon)}</td></tr>
        <tr><td>Inizio dell'ora d'oro</td><td>${formatTime(times.goldenHour)}</td></tr>
        <tr><td>Inizio del tramonto</td><td>${formatTime(times.sunsetStart)}</td></tr>
        <tr><td>Tramonto</td><td>${formatTime(times.sunset)}</td></tr>
        <tr><td>Crepuscolo civile</td><td>${formatTime(times.dusk)}</td></tr>
        <tr><td>Crepuscolo nautico</td><td>${formatTime(times.nauticalDusk)}</td></tr>
        <tr><td>Crepuscolo astronomico</td><td>${formatTime(times.astronomicalDusk)}</td></tr>`;
}

function toggleTimesModal(show) { 
    const modal = document.getElementById('modal-times');
    if(modal) modal.style.display = show ? 'flex' : 'none'; 
}

function toggleSettingsModal(show) { 
    const modal = document.getElementById('modal-settings');
    if(modal) modal.style.display = show ? 'flex' : 'none'; 
}

function updateHands() {
    if (!isCustomTime) {
        selectedDate = getEffectiveDate();
        updateInputsVal();
    }
    
    const digitalClock = document.getElementById('digital-clock');
    if(digitalClock) {
        digitalClock.innerText = 
            String(selectedDate.getHours()).padStart(2, '0') + ":" + 
            String(selectedDate.getMinutes()).padStart(2, '0') + ":" + 
            String(selectedDate.getSeconds()).padStart(2, '0');
    }

    const h = selectedDate.getHours() + selectedDate.getMinutes() / 60 + selectedDate.getSeconds() / 3600;
    const m = selectedDate.getMinutes() + selectedDate.getSeconds() / 60;
    const s = selectedDate.getSeconds() + selectedDate.getMilliseconds() / 1000;

    const handHour = document.getElementById('hand-hour');
    const handMinute = document.getElementById('hand-minute');
    const handSecond = document.getElementById('hand-second');
    const handMoon = document.getElementById('hand-moon');

    if(handHour) handHour.style.transform = `rotate(${(h / 24) * 360 - 180}deg)`;
    if(handMinute) handMinute.style.transform = `rotate(${(m / 60) * 360}deg)`;
    if(handSecond) handSecond.style.transform = `rotate(${(s / 60) * 360}deg)`;

    const totalOffset = getTotalOffsetHours();
    const utcDate = new Date(selectedDate.getTime() - (totalOffset * 3600000));

    const moonPos = SunCalc.getMoonPosition(utcDate, cachedLat, cachedLon);
    const sunPos = SunCalc.getPosition(utcDate, cachedLat, cachedLon);
    
    let moonEquivalentHour = (h + (((moonPos.azimuth - sunPos.azimuth) / (2 * Math.PI)) * 24)) % 24;
    if (moonEquivalentHour < 0) moonEquivalentHour += 24;
    if(handMoon) handMoon.style.transform = `rotate(${(moonEquivalentHour / 24) * 360 - 180}deg)`;

    if (cachedTimes) updatePageBackground(cachedTimes);
}

initClock();
setInterval(updateHands, 50);

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.service.worker.js');
}
