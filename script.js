SunCalc.addTime(-18, 'astronomicalDawn', 'astronomicalDusk');
SunCalc.addTime(-12, 'nauticalDawn', 'nauticalDusk');
SunCalc.addTime(-6, 'dawn', 'dusk');

const canvas = document.getElementById('clockCanvas');
const ctx = canvas.getContext('2d');
const cx = 250;
const cy = 250;
const radius = 248;

function getCurrentDstState() {
    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    if (isAuto && typeof getEffectiveDST === 'function') {
        return getEffectiveDST(cachedLat, cachedLon, new Date());
    }
    return localStorage.getItem('sunclock_dst') === 'true';
}

function hoursToAngle(h) {
    return (h / 24) * Math.PI * 2 - Math.PI / 2;
}

function sunHoursToAngle(h) {
    return hoursToAngle(h);
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
let currentPlaceDisplayName = "Italia - Piacenza";
let isTimezoneOnlyMode = false;

async function initClock() {
    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    const isManualDst = localStorage.getItem('sunclock_dst') === 'true';
    
    document.getElementById('auto-dst-toggle').checked = isAuto;
    document.getElementById('manual-dst-toggle').checked = isManualDst;
    updateDstUI(isAuto);

    cachedLat = 45.05;
    cachedLon = 9.69;
    document.getElementById('input-lat').value = cachedLat;
    document.getElementById('input-lon').value = cachedLon;
    
    updateTimeForLocation();
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchAndUpdateLocation(position.coords.latitude, position.coords.longitude, "Posizione Corrente");
            },
            (error) => {
                console.log("GPS non disponibile, uso default.");
            },
            { timeout: 4000, enableHighAccuracy: false }
        );
    }
}

function toggleAutoDST(checked) {
    localStorage.setItem('sunclock_auto_dst', checked ? 'true' : 'false');
    updateDstUI(checked);
    if (!isCustomTime) {
        updateTimeForLocation();
    }
    updateSunClock(cachedLat, cachedLon);
}

function toggleManualDST(checked) {
    localStorage.setItem('sunclock_dst', checked ? 'true' : 'false');
    if (!isCustomTime) {
        updateTimeForLocation();
    }
    updateSunClock(cachedLat, cachedLon);
}

function updateDstUI(isAuto) {
    const manualBox = document.getElementById('manual-dst-box');
    const manualInput = document.getElementById('manual-dst-toggle');
    
    if (isAuto) {
        manualBox.style.opacity = "0.4";
        manualInput.disabled = true;
    } else {
        manualBox.style.opacity = "1.0";
        manualInput.disabled = false;
    }
}

function toggleMoonDropdown() {
    const content = document.getElementById('moon-dropdown-content');
    const arrow = document.getElementById('dropdown-arrow');
    content.classList.toggle('show');
    if (content.classList.contains('show')) {
        arrow.innerText = '▲';
    } else {
        arrow.innerText = '▼';
    }
}

async function fetchAndUpdateLocation(lat, lon, fallbackName = "Posizione") {
    cachedLat = lat;
    cachedLon = lon;
    isTimezoneOnlyMode = false;
    document.getElementById('input-lat').value = cachedLat;
    document.getElementById('input-lon').value = cachedLon;

    let placeName = fallbackName;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
        const geoData = await res.json();
        if (geoData && geoData.address) {
            const country = geoData.address.country || '';
            const city = geoData.address.city || geoData.address.town || geoData.address.village || geoData.address.county || '';
            if (country && city && city.toLowerCase() !== country.toLowerCase()) {
                placeName = `${country} - ${city}`;
            } else {
                placeName = city || country || fallbackName;
            }
        }
    } catch (err) {
        placeName = fallbackName;
    }

    currentPlaceDisplayName = placeName;

    let approxOffset = Math.round(cachedLon / 15);
    let selectEl = document.getElementById('timezone-preset');
    for(let opt of selectEl.options) {
        if(parseFloat(opt.value) === approxOffset) {
            selectEl.value = opt.value;
            break;
        }
    }

    isCustomTime = false;
    updateTimeForLocation();
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);
}

function applyTimezonePreset() {
    isTimezoneOnlyMode = true;
    if (!isCustomTime) {
        updateTimeForLocation();
    }
    updateSunClock(cachedLat, cachedLon);
    toggleSettingsModal(false);
}

function getEffectiveDate() {
    const tzPresetVal = parseFloat(document.getElementById('timezone-preset').value);
    const now = new Date();
    
    let isDstNowActive = getCurrentDstState();
    const dstOffset = isDstNowActive ? 1 : 0;
    const targetTotalOffsetHours = tzPresetVal + dstOffset;

    const utcTimeMs = now.getTime() + (now.getTimezoneOffset() * 60000);
    return new Date(utcTimeMs + (targetTotalOffsetHours * 3600000));
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
                alert("Impossibile recuperare la posizione GPS.");
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    }
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
            if (country && city && city.toLowerCase() !== country.toLowerCase()) {
                placeName = `${country} - ${city}`;
            } else {
                placeName = city || country || "Posizione";
            }
        }
    } catch (err) {
        placeName = "Posizione";
    }
    window.location.href = `posizione.html?lat=${lat}&lon=${lon}&city=${encodeURIComponent(placeName)}`;
}

function toggleMap() {
    const mapContainer = document.getElementById('map-container');
    if (mapContainer.style.display === 'block') {
        mapContainer.style.display = 'none';
    } else {
        mapContainer.style.display = 'block';
        if (!map) {
            const currentLat = parseFloat(document.getElementById('input-lat').value) || cachedLat;
            const currentLon = parseFloat(document.getElementById('input-lon').value) || cachedLon;
            
            const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                maxZoom: 17,
                attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM'
            });

            const political = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                maxZoom: 19,
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
            });

            let savedLayer = localStorage.getItem('sunclock_map_layer') === 'political' ? political : topo;

            map = L.map('map-container', {
                center: [currentLat, currentLon],
                zoom: 6,
                layers: [savedLayer]
            });

            const baseMaps = { "Topografica": topo, "Politica": political };
            L.control.layers(baseMaps).addTo(map);

            marker = L.marker([currentLat, currentLon], {draggable: true}).addTo(map);

            marker.on('dragend', function(e) {
                const pos = marker.getLatLng();
                document.getElementById('input-lat').value = pos.lat.toFixed(4);
                document.getElementById('input-lon').value = pos.lng.toFixed(4);
            });

            map.on('click', function(e) {
                const lat = e.latlng.lat;
                const lon = e.latlng.lng;
                marker.setLatLng([lat, lon]);
                document.getElementById('input-lat').value = lat.toFixed(4);
                document.getElementById('input-lon').value = lon.toFixed(4);
                getPlaceNameAndRedirect(lat, lon);
            });
        } else {
            map.invalidateSize();
        }
    }
}

function applyManualLocation() {
    const lat = parseFloat(document.getElementById('input-lat').value);
    const lon = parseFloat(document.getElementById('input-lon').value);
    if (!isNaN(lat) && !isNaN(lon)) {
        getPlaceNameAndRedirect(lat, lon);
    } else {
        alert("Inserisci coordinate valide.");
    }
}

function getCompleteMoonTimes(date, lat, lon) {
    let times = SunCalc.getMoonTimes(date, lat, lon);
    let rise = times.rise;
    let set = times.set;

    if (!rise || !set || times.alwaysUp || times.alwaysDown) {
        let dPrev = new Date(date);
        dPrev.setDate(date.getDate() - 1);
        let pTimes = SunCalc.getMoonTimes(dPrev, lat, lon);

        let dNext = new Date(date);
        dNext.setDate(date.getDate() + 1);
        let nTimes = SunCalc.getMoonTimes(dNext, lat, lon);

        if (!rise) {
            if (pTimes.rise && pTimes.rise > dPrev) rise = pTimes.rise;
            else if (nTimes.rise) rise = nTimes.rise;
        }
        if (!set) {
            if (pTimes.set && pTimes.set > dPrev) set = pTimes.set;
            else if (nTimes.set) set = nTimes.set;
        }
    }
    return { rise: rise, set: set, alwaysUp: times.alwaysUp, alwaysDown: times.alwaysDown };
}

function updateSunClock(lat, lon) {
    const refDate = selectedDate;

    cachedTimes = SunCalc.getTimes(refDate, lat, lon);
    cachedMoonTimes = getCompleteMoonTimes(refDate, lat, lon);
    cachedMoonIllumination = SunCalc.getMoonIllumination(refDate);

    updateMoonDigitalPanel(cachedMoonIllumination, cachedMoonTimes);

    ctx.clearRect(0, 0, 500, 500);

    drawSunSlicesSafe(cachedTimes);
    drawMoonVisibilityArc(cachedMoonTimes, refDate);
    drawSolarMeridianLines(cachedTimes);
    drawMinuteRingSafe();
    drawClockNumbers();
    updatePageBackground(cachedTimes);
    populateTable(cachedTimes, cachedMoonTimes, cachedMoonIllumination);

    const tz = document.getElementById('timezone-preset').value;
    const latFmt = parseFloat(lat).toFixed(2);
    const lonFmt = parseFloat(lon).toFixed(2);
    
    if (isTimezoneOnlyMode) {
        document.getElementById('location-text').innerHTML = `
            <div style="font-size: 1.15rem;">Fuso UTC ${tz >= 0 ? "+" : ""}${tz}</div>
        `;
    } else {
        document.getElementById('location-text').innerHTML = `
            <div style="font-size: 1.15rem; margin-bottom: 4px;">${currentPlaceDisplayName}</div>
            <div style="font-size: 0.95rem; opacity: 0.9;">
                Lat: ${latFmt} | Lon: ${lonFmt}
            </div>
            <div style="font-size: 0.95rem; opacity: 0.9; margin-top: 2px;">
                Fuso: UTC ${tz >= 0 ? "+" : ""}${tz}
            </div>
        `;
    }

    document.getElementById('txt-sunrise').innerText = formatTime(cachedTimes.sunrise);
    document.getElementById('txt-sunset').innerText = formatTime(cachedTimes.sunset);
}

function timeToHours(date) {
    if (!date || !isValidDate(date)) return null;
    const tzPresetVal = parseFloat(document.getElementById('timezone-preset').value) || 0;
    const dstOffset = getCurrentDstState() ? 1 : 0;
    const totalOffset = tzPresetVal + dstOffset;
    const shifted = new Date(date.getTime() + (totalOffset * 3600000));
    return shifted.getUTCHours() + shifted.getUTCMinutes() / 60 + shifted.getUTCSeconds() / 3600;
}

function isValidDate(d) {
    return d instanceof Date && !isNaN(d);
}

function drawMoonVisibilityArc(moonTimes, refDate) {
    let rise = moonTimes.rise;
    let set = moonTimes.set;

    if (moonTimes.alwaysUp) {
        rise = new Date(refDate); rise.setHours(0,0,0,0);
        set = new Date(refDate); set.setHours(23,59,59,999);
    }

    if (!isValidDate(rise) || !isValidDate(set)) return;

    let startDayStart = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    let startDayEnd = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);

    let startH, endH;

    if (rise < startDayStart) startH = 0;
    else startH = timeToHours(rise);

    if (set > startDayEnd) endH = 24;
    else endH = timeToHours(set);

    if (startH === null || endH === null) return;

    ctx.save();
    ctx.beginPath();
    let arcRadius = radius - 7;
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#64748b';

    if (endH < startH) {
        ctx.arc(cx, cy, arcRadius, sunHoursToAngle(startH), sunHoursToAngle(24));
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, cy, arcRadius, sunHoursToAngle(0), sunHoursToAngle(endH));
        ctx.stroke();
    } else {
        ctx.arc(cx, cy, arcRadius, sunHoursToAngle(startH), sunHoursToAngle(endH));
        ctx.stroke();
    }
    ctx.restore();
}

function drawSunSlicesSafe(times) {
    let hSunrise = timeToHours(times.sunrise);
    let hSunset = timeToHours(times.sunset);

    let hasValidSunset = isValidDate(times.sunrise) && isValidDate(times.sunset) && hSunrise !== null && hSunset !== null;
    
    if (!hasValidSunset) {
        const testDate = new Date(selectedDate);
        testDate.setHours(12, 0, 0, 0);
        const sunPos = SunCalc.getPosition(testDate, cachedLat, cachedLon);
        
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
        ctx.arc(cx, cy, r, sunHoursToAngle(startH), sunHoursToAngle(24));
        ctx.arc(cx, cy, r, sunHoursToAngle(0), sunHoursToAngle(endH));
    } else {
        ctx.arc(cx, cy, r, sunHoursToAngle(startH), sunHoursToAngle(endH));
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

function drawSolarMeridianLines(times) {
    if (isValidDate(times.solarNoon)) {
        const noonHours = timeToHours(times.solarNoon);
        if (noonHours !== null) {
            const noonAngle = sunHoursToAngle(noonHours);
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
            const nadirAngle = sunHoursToAngle(nadirHours);
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
    const h = timeToHours(selectedDate);
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
}

function getIntervalColorSafe(h, times) {
    const hSunrise = timeToHours(times.sunrise);
    const hSunset = timeToHours(times.sunset);

    if (!isValidDate(times.sunrise) || !isValidDate(times.sunset) || hSunrise === null || hSunset === null) {
        const testDate = new Date(selectedDate);
        testDate.setHours(12, 0, 0, 0);
        const sunPos = SunCalc.getPosition(testDate, cachedLat, cachedLon);
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
    if (h >= hNautDusk && h < hAstroDusk) return PALETTE.astro;

    return PALETTE.night;
}

function formatTime(date) {
    if (!isValidDate(date)) return "--:--";
    const tzPresetVal = parseFloat(document.getElementById('timezone-preset').value) || 0;
    const dstOffset = getCurrentDstState() ? 1 : 0;
    const totalOffset = tzPresetVal + dstOffset;
    const shifted = new Date(date.getTime() + (totalOffset * 3600000));
    return String(shifted.getUTCHours()).padStart(2, '0') + ":" + 
           String(shifted.getUTCMinutes()).padStart(2, '0') + ":" + 
           String(shifted.getUTCSeconds()).padStart(2, '0');
}

function updateMoonDigitalPanel(illumination, moonTimes) {
    const iconEl = document.getElementById('moon-digital-icon');
    const phaseNameEl = document.getElementById('moon-phase-name');
    const riseEl = document.getElementById('moon-rise');
    const setEl = document.getElementById('moon-set');
    const phase = illumination.phase;

    let phaseName = "";
    let iconSymbol = "🌕";

    if (phase < 0.03 || phase > 0.97) { iconSymbol = "🌑"; phaseName = "Luna Nuova"; }
    else if (phase < 0.22) { iconSymbol = "🌒"; phaseName = "Crescente"; }
    else if (phase < 0.28) { iconSymbol = "🌓"; phaseName = "Primo Quarto"; }
    else if (phase < 0.47) { iconSymbol = "🌔"; phaseName = "Gibbosa Crescente"; }
    else if (phase < 0.53) { iconSymbol = "🌕"; phaseName = "Luna Piena"; }
    else if (phase < 0.72) { iconSymbol = "🌖"; phaseName = "Gibbosa Calante"; }
    else if (phase < 0.78) { iconSymbol = "🌗"; phaseName = "Ultimo Quarto"; }
    else { iconSymbol = "🌘"; phaseName = "Calante"; }

    iconEl.innerText = iconSymbol;
    phaseNameEl.innerText = phaseName;
    riseEl.innerText = isValidDate(moonTimes.rise) ? formatTime(moonTimes.rise) : "--:--";
    setEl.innerText = isValidDate(moonTimes.set) ? formatTime(moonTimes.set) : "--:--";
}

function populateTable(times, moonTimes, illumination) {
    const tbody = document.getElementById('times-table-body');
    const phasePct = Math.round(illumination.fraction * 100);
    
    tbody.innerHTML = `
        <tr style="background: rgba(56, 189, 248, 0.1);"><td colspan="2"><b>🌙 Dati Lunari</b></td></tr>
        <tr><td>Fase Lunare</td><td>${phasePct}% illuminata</td></tr>
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
        <tr><td>Crepuscolo astronomico</td><td>${formatTime(times.astronomicalDusk)}</td></tr>
    `;
}

function toggleTimesModal(show) {
    document.getElementById('modal-times').style.display = show ? 'flex' : 'none';
}

function toggleSettingsModal(show) {
    document.getElementById('modal-settings').style.display = show ? 'flex' : 'none';
}

function updateHands() {
    if (!isCustomTime) {
        selectedDate = getEffectiveDate();
        updateInputsVal();
    }
    
    document.getElementById('digital-clock').innerText = selectedDate.toLocaleTimeString();

    const h = selectedDate.getHours() + selectedDate.getMinutes() / 60 + selectedDate.getSeconds() / 3600;
    const m = selectedDate.getMinutes() + selectedDate.getSeconds() / 60;
    const s = selectedDate.getSeconds() + selectedDate.getMilliseconds() / 1000;

    const hourDeg = (h / 24) * 360;
    document.getElementById('hand-hour').style.transform = `rotate(${hourDeg}deg)`;

    const minuteDeg = (m / 60) * 360;
    document.getElementById('hand-minute').style.transform = `rotate(${minuteDeg}deg)`;

    const secDeg = (s / 60) * 360;
    document.getElementById('hand-second').style.transform = `rotate(${secDeg}deg)`;

    const moonPos = SunCalc.getMoonPosition(selectedDate, cachedLat, cachedLon);
    const sunPos = SunCalc.getPosition(selectedDate, cachedLat, cachedLon);
    
    const diffAzimuth = moonPos.azimuth - sunPos.azimuth;
    let moonHourOffset = (diffAzimuth / (2 * Math.PI)) * 24;
    
    let moonEquivalentHour = (h + moonHourOffset) % 24;
    if (moonEquivalentHour < 0) moonEquivalentHour += 24;

    const moonDeg = (moonEquivalentHour / 24) * 360;
    document.getElementById('hand-moon').style.transform = `rotate(${moonDeg}deg)`;

    if (cachedTimes) {
        updatePageBackground(cachedTimes);
    }
}

initClock();
setInterval(updateHands, 50);

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.service.worker.js');
}
