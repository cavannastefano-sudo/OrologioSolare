// ==========================================
// SunClock24 - script.js (Calendario Lunare Matematicamente Stabile)
// ==========================================

SunCalc.addTime(-18, 'astronomicalDawn', 'astronomicalDusk');
SunCalc.addTime(-12, 'nauticalDawn', 'nauticalDusk');
SunCalc.addTime(-6, 'dawn', 'dusk');

const canvas = document.getElementById('clockCanvas');
const ctx = canvas.getContext('2d');
const cx = 250;
const cy = 250;
const radius = 248;

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
            const janDate = new Date(now.getFullYear(), 0, 15);
            
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
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('dst')) {
        return urlParams.get('dst') === 'true';
    }
    
    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    if (isAuto && !isNaN(cachedLat) && !isNaN(cachedLon)) {
        if (typeof getEffectiveDST === 'function') {
            const effective = getEffectiveDST(cachedLat, cachedLon, selectedDate || new Date());
            if (effective !== undefined) return effective;
        }

        try {
            if (typeof tzlookup === 'function') {
                const tzString = tzlookup(cachedLat, cachedLon);
                if (tzString.startsWith('Africa/')) return false;

                const now = selectedDate || new Date();
                const dtf = new Intl.DateTimeFormat('en-US', {
                    timeZone: tzString,
                    timeZoneName: 'shortOffset'
                });
                const parts = dtf.formatToParts(now);
                const offsetPart = parts.find(p => p.type === 'timeZoneName');
                if (offsetPart) {
                    const match = offsetPart.value.match(/GMT([+-]\d+)(?::(\d+))?/);
                    if (match) {
                        const currentOffset = parseInt(match[1], 10);
                        const standardBaseOffset = getPreciseStandardTimezone(cachedLat, cachedLon);
                        return currentOffset > standardBaseOffset;
                    }
                }
            }
        } catch (e) {
            console.warn("Impossibile determinare l'ora legale tramite tzlookup", e);
        }
    }

    return localStorage.getItem('sunclock_dst') === 'true';
}

function getBaseLocationOffset() {
    const standardTz = getPreciseStandardTimezone(cachedLat, cachedLon);
    const isDstNowActive = getCurrentDstState();
    return standardTz + (isDstNowActive ? 1 : 0);
}

function getTotalOffsetHours() {
    const tzPresetEl = document.getElementById('timezone-preset');
    if (!tzPresetEl) return getBaseLocationOffset();
    const baseTz = parseFloat(tzPresetEl.value);
    const isDstNowActive = getCurrentDstState();
    return baseTz + (isDstNowActive ? 1 : 0);
}

function hoursToAngle(h) {
    return (h / 24) * Math.PI * 2 + Math.PI / 2;
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
let customTimeOffsetMs = 0; 
let map = null;
let marker = null;
let currentPlaceDisplayName = "Ricerca in corso...";
let isTimezoneOnlyMode = false;
let lastHighlightedEventIndex = -1;

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('auto')) {
    localStorage.setItem('sunclock_auto_dst', urlParams.get('auto'));
}
if (urlParams.has('dst')) {
    localStorage.setItem('sunclock_dst', urlParams.get('dst'));
}

async function initClock() {
    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    const isManualDst = getCurrentDstState();
    
    const autoToggle = document.getElementById('auto-dst-toggle');
    const manualToggle = document.getElementById('manual-dst-toggle');
    if (autoToggle) autoToggle.checked = isAuto;
    if (manualToggle) manualToggle.checked = isManualDst;
    updateDstUI(isAuto);

    drawRealisticSun('sun-clock-canvas');

    if (navigator.geolocation && !urlParams.has('lat')) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchAndUpdateLocation(position.coords.latitude, position.coords.longitude, "Posizione Corrente");
            },
            async (error) => {
                cachedLat = urlParams.get('lat') ? parseFloat(urlParams.get('lat')) : 45.05;
                cachedLon = urlParams.get('lon') ? parseFloat(urlParams.get('lon')) : 9.69;
                currentPlaceDisplayName = urlParams.get('city') ? decodeURIComponent(urlParams.get('city')) : "Piacenza - Italia";
                
                document.getElementById('input-lat').value = cachedLat;
                document.getElementById('input-lon').value = cachedLon;
                updateTimeForLocation();
                updateInputsVal();
                updateSunClock(cachedLat, cachedLon);
            },
            { timeout: 8000, enableHighAccuracy: true }
        );
    } else {
        cachedLat = urlParams.get('lat') ? parseFloat(urlParams.get('lat')) : 45.05;
        cachedLon = urlParams.get('lon') ? parseFloat(urlParams.get('lon')) : 9.69;
        currentPlaceDisplayName = urlParams.get('city') ? decodeURIComponent(urlParams.get('city')) : "Piacenza - Italia";

        document.getElementById('input-lat').value = cachedLat;
        document.getElementById('input-lon').value = cachedLon;
        updateTimeForLocation();
        updateInputsVal();
        updateSunClock(cachedLat, cachedLon);
    }
}

let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        if (cachedTimes) {
            ctx.clearRect(0, 0, 500, 500);
            drawSunSlicesSafe(cachedTimes);
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
    updateDstUI(checked);
    if (!isCustomTime) {
        updateTimeForLocation();
    }
    if (isTimezoneOnlyMode) {
        applyTimezonePreset();
    } else {
        updateSunClock(cachedLat, cachedLon);
    }
}

function toggleManualDST(checked) {
    localStorage.setItem('sunclock_dst', checked ? 'true' : 'false');
    if (!isCustomTime) {
        updateTimeForLocation();
    }
    if (isTimezoneOnlyMode) {
        applyTimezonePreset();
    } else {
        updateSunClock(cachedLat, cachedLon);
    }
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
}

function applyTimezonePreset() {
    const tzVal = document.getElementById('timezone-preset').value;
    isTimezoneOnlyMode = true; 
    
    selectedDate = getEffectiveDate();
    updateInputsVal();

    let isDstNowActive = getCurrentDstState();
    const totalOffset = parseFloat(tzVal) + (isDstNowActive ? 1 : 0);
    const tzSign = parseFloat(tzVal) >= 0 ? "+" : "";
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

    const baseOffset = getBaseLocationOffset();
    let utcCalculationDate = new Date(selectedDate.getTime() - (getTotalOffsetHours() * 3600000) + (baseOffset * 3600000));
    
    cachedTimes = SunCalc.getTimes(utcCalculationDate, cachedLat, cachedLon);
    cachedMoonIllumination = SunCalc.getMoonIllumination(utcCalculationDate);
    
    updateMoonDigitalPanel(cachedMoonIllumination, cachedMoonTimes);
    populateTable(cachedTimes, cachedMoonTimes, cachedMoonIllumination);

    ctx.clearRect(0, 0, 500, 500);
    drawSunSlicesSafe(cachedTimes);
    drawMinuteRingSafe();
    drawClockNumbers();
    updatePageBackground(cachedTimes);

    toggleSettingsModal(false);
}

function getEffectiveDate() {
    const targetOffset = getTotalOffsetHours();
    return new Date(Date.now() + (targetOffset * 3600000));
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
    selectedDate.setUTCFullYear(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    isCustomTime = true;
    
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

function onTimeChanged(val) {
    if (!val) return;
    const parts = val.split(':');
    selectedDate.setUTCHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
    isCustomTime = true;
    
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

async function fetchAndUpdateLocation(lat, lon, fallbackName = "Posizione") {
    cachedLat = lat;
    cachedLon = lon;
    isTimezoneOnlyMode = false;
    document.getElementById('input-lat').value = cachedLat;
    document.getElementById('input-lon').value = cachedLon;

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

    let preciseTz = getPreciseStandardTimezone(cachedLat, cachedLon);
    let selectEl = document.getElementById('timezone-preset');
    if (selectEl) {
        for(let opt of selectEl.options) {
            if(parseFloat(opt.value) === preciseTz) {
                selectEl.value = opt.value;
                break;
            }
        }
    }

    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    updateDstUI(isAuto);

    isCustomTime = false;
    customTimeOffsetMs = 0;
    updateTimeForLocation();
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);
}

function resetToNow() {
    isCustomTime = false;
    isTimezoneOnlyMode = false;
    customTimeOffsetMs = 0;

    let preciseTz = getPreciseStandardTimezone(cachedLat, cachedLon);
    let selectEl = document.getElementById('timezone-preset');
    if (selectEl) {
        for(let opt of selectEl.options) {
            if(parseFloat(opt.value) === preciseTz) {
                selectEl.value = opt.value;
                break;
            }
        }
    }

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
    isTimezoneOnlyMode = false;
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                fetchAndUpdateLocation(position.coords.latitude, position.coords.longitude, "GPS");
                toggleSettingsModal(false);
            },
            (error) => {
                updateTimeForLocation();
                updateSunClock(cachedLat, cachedLon); 
                document.getElementById('location-text').innerText = "GPS disattivato.";
            }
        );
    } else {
        updateTimeForLocation();
        updateSunClock(cachedLat, cachedLon);
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
    if (isTimezoneOnlyMode) return;

    const baseOffset = getBaseLocationOffset();
    let utcCalculationDate = new Date(selectedDate.getTime() - (getTotalOffsetHours() * 3600000) + (baseOffset * 3600000));

    cachedTimes = SunCalc.getTimes(utcCalculationDate, lat, lon);
    cachedMoonTimes = getCompleteMoonTimes(utcCalculationDate, lat, lon);
    cachedMoonIllumination = SunCalc.getMoonIllumination(utcCalculationDate);

    updateMoonDigitalPanel(cachedMoonIllumination, cachedMoonTimes);
    drawRealisticSun('sun-clock-canvas');

    ctx.clearRect(0, 0, 500, 500);

    drawSunSlicesSafe(cachedTimes);
    drawMoonVisibilityArc(cachedMoonTimes, selectedDate);
    drawSolarMeridianLines(cachedTimes);
    drawMinuteRingSafe();
    drawClockNumbers();
    updatePageBackground(cachedTimes);
    
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
    let rise = toTargetTime(moonTimes.rise);
    let set = toTargetTime(moonTimes.set);

    if (moonTimes.alwaysUp) {
        rise = new Date(refDate); rise.setUTCHours(0,0,0,0);
        set = new Date(refDate); set.setUTCHours(23,59,59,999);
    }

    if (!isValidDate(rise) || !isValidDate(set)) return;

    let startDayStart = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate()));
    let startDayEnd = new Date(Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate(), 23, 59, 59, 999));

    let startH, endH;

    if (rise < startDayStart) startH = 0;
    else startH = timeToHours(moonTimes.rise);

    if (set > startDayEnd) endH = 24;
    else endH = timeToHours(moonTimes.set);

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
    if (h >= hNautDusk && h < hAstroDusk) return PALETTE.astro;

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

// -----------------------------------------------------------------
// CALENDARIO LUNARE STABILE E COERENTE (Basato direttamente su phase 0-1)
// -----------------------------------------------------------------
function drawRealisticMoon(canvasId, illumination) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    canvas.width = 32;
    canvas.height = 32;
    
    const ctxMoon = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const r = width / 2 - 2;

    ctxMoon.clearRect(0, 0, width, height);

    ctxMoon.save();
    ctxMoon.beginPath();
    ctxMoon.arc(width / 2, height / 2, r, 0, Math.PI * 2);
    ctxMoon.closePath();
    ctxMoon.clip();

    // 1. Sfondo base luminoso (Luna Piena)
    let bgGrad = ctxMoon.createRadialGradient(width / 2 - 5, height / 2 - 5, 2, width / 2, height / 2, r);
    bgGrad.addColorStop(0, '#f1f5f9');
    bgGrad.addColorStop(0.4, '#cbd5e1');
    bgGrad.addColorStop(0.8, '#64748b');
    bgGrad.addColorStop(1, '#334155');
    ctxMoon.fillStyle = bgGrad;
    ctxMoon.fillRect(0, 0, width, height);

    // Mari lunari fissi
    ctxMoon.fillStyle = 'rgba(30, 41, 59, 0.55)';
    ctxMoon.beginPath(); ctxMoon.arc(width * 0.42, height * 0.38, r * 0.32, 0, Math.PI * 2); ctxMoon.fill();
    ctxMoon.beginPath(); ctxMoon.arc(width * 0.28, height * 0.55, r * 0.28, 0, Math.PI * 2); ctxMoon.fill();
    ctxMoon.beginPath(); ctxMoon.arc(width * 0.38, height * 0.25, r * 0.22, 0, Math.PI * 2); ctxMoon.fill();
    ctxMoon.beginPath(); ctxMoon.arc(width * 0.5, height * 0.7, r * 0.2, 0, Math.PI * 2); ctxMoon.fill();
    ctxMoon.beginPath(); ctxMoon.arc(width * 0.68, height * 0.55, r * 0.25, 0, Math.PI * 2); ctxMoon.fill();

    ctxMoon.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctxMoon.beginPath(); ctxMoon.arc(width * 0.6, height * 0.75, r * 0.1, 0, Math.PI * 2); ctxMoon.fill();
    ctxMoon.beginPath(); ctxMoon.arc(width * 0.35, height * 0.45, r * 0.08, 0, Math.PI * 2); ctxMoon.fill();

    let phase = illumination.phase;       // 0.0 = Nuova, 0.25 = Primo Quarto, 0.5 = Piena, 0.75 = Ultimo Quarto
    let fraction = illumination.fraction; // Percentuale di luce (0.0 a 1.0)

    // 2. Controllo Luna Nuova (fase vicina allo 0 o all'1, o frazione minima)
    if (phase < 0.015 || phase > 0.985 || fraction <= 0.01) {
        ctxMoon.fillStyle = 'rgba(2, 6, 23, 0.98)';
        ctxMoon.fillRect(0, 0, width, height);
    } 
    // 3. Controllo Luna Piena (fase vicina a 0.5, o frazione massima)
    else if ((phase >= 0.485 && phase <= 0.515) || fraction >= 0.99) {
        // Piena al 100%, nessuna ombra applicata
    } 
    // 4. Fasi Intermedie stabili (Crescenti e Calanti)
    else {
        ctxMoon.fillStyle = 'rgba(2, 6, 23, 0.96)'; // Ombra scura
        ctxMoon.beginPath();

        let cxCenter = width / 2;
        let cyCenter = height / 2;

        // Regola fissa del ciclo lunare:
        // Da 0.0 a 0.5 = Crescente (la luce avanza da destra)
        // Da 0.5 a 1.0 = Calante (la luce si ritira verso destra)
        let isWaxing = phase < 0.5;
        let isGibbous = fraction > 0.5;
        let termRadius = r * Math.abs(2 * fraction - 1);

        if (isWaxing) {
            if (!isGibbous) {
                // Falce Crescente
                ctxMoon.arc(cxCenter, cyCenter, r, 0.5 * Math.PI, 1.5 * Math.PI, false);
                ctxMoon.ellipse(cxCenter, cyCenter, termRadius, r, 0, 1.5 * Math.PI, 0.5 * Math.PI, true);
            } else {
                // Gibbosa Crescente
                ctxMoon.arc(cxCenter, cyCenter, r, 1.5 * Math.PI, 0.5 * Math.PI, true);
                ctxMoon.ellipse(cxCenter, cyCenter, termRadius, r, 0, 0.5 * Math.PI, 1.5 * Math.PI, false);
            }
        } else {
            if (!isGibbous) {
                // Falce Calante
                ctxMoon.arc(cxCenter, cyCenter, r, 1.5 * Math.PI, 0.5 * Math.PI, false);
                ctxMoon.ellipse(cxCenter, cyCenter, termRadius, r, 0, 0.5 * Math.PI, 1.5 * Math.PI, true);
            } else {
                // Gibbosa Calante
                ctxMoon.arc(cxCenter, cyCenter, r, 0.5 * Math.PI, 1.5 * Math.PI, true);
                ctxMoon.ellipse(cxCenter, cyCenter, termRadius, r, 0, 1.5 * Math.PI, 0.5 * Math.PI, false);
            }
        }

        ctxMoon.closePath();
        ctxMoon.fill();
    }

    ctxMoon.restore();

    // Bordo esterno rifinito
    ctxMoon.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctxMoon.lineWidth = 1.5;
    ctxMoon.beginPath();
    ctxMoon.arc(width / 2, height / 2, r, 0, Math.PI * 2);
    ctxMoon.stroke();
}

function updateMoonDigitalPanel(illumination, moonTimes) {
    if (isTimezoneOnlyMode) return;

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

    phaseNameEl.innerText = `${phaseName} (${Math.round(illumination.fraction * 100)}%)`;
    riseEl.innerText = isValidDate(moonTimes.rise) ? formatTime(moonTimes.rise) : "--:--";
    setEl.innerText = isValidDate(moonTimes.set) ? formatTime(moonTimes.set) : "--:--";

    drawRealisticMoon('moon-canvas', illumination);
    drawRealisticMoon('moon-clock-canvas', illumination);
    drawRealisticSun('sun-clock-canvas');
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

    if (isTimezoneOnlyMode) {
        tbody.innerHTML = `
            <tr style="background: rgba(113, 63, 18, 0.8); color: #facc15;"><td colspan="2"><b>☀️ Dati Solari e Crepuscoli</b></td></tr>
            <tr style="background: rgba(30, 41, 59, 0.5);"><td>Mezzanotte solare</td><td>----</td></tr>
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
            
            <tr style="background: rgba(30, 41, 59, 0.9); color: #38bdf8;"><td colspan="2"><b>🌙 Dati Lunari</b></td></tr>
            <tr style="background: rgba(15, 23, 42, 0.6);"><td>Fase Lunare</td><td>----</td></tr>
            <tr style="background: rgba(15, 23, 42, 0.6);"><td>Sorge la Luna</td><td>----</td></tr>
            <tr style="background: rgba(15, 23, 42, 0.6);"><td>Tramonta la Luna</td><td>----</td></tr>
        `;
        return;
    }

    const phasePct = illumination ? Math.round(illumination.fraction * 100) : 0;
    
    const events = [
        { name: "Mezzanotte solare", date: times.nadir, bg: "rgba(30, 41, 59, 0.5)" },
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
        <tr style="background: rgba(113, 63, 18, 0.8); color: #facc15;"><td colspan="2"><b>☀️ Dati Solari e Crepuscoli</b></td></tr>
        ${solarRowsHtml}

        <tr style="background: rgba(30, 41, 59, 0.9); color: #38bdf8;"><td colspan="2"><b>🌙 Dati Lunari</b></td></tr>
        <tr style="background: rgba(15, 23, 42, 0.6);"><td>Fase Lunare</td><td>${phasePct}% illuminata</td></tr>
        <tr style="background: rgba(15, 23, 42, 0.6);"><td>Sorge la Luna</td><td>${moonTimes ? formatTime(moonTimes.rise) : '----'}</td></tr>
        <tr style="background: rgba(15, 23, 42, 0.6);"><td>Tramonta la Luna</td><td>${moonTimes ? formatTime(moonTimes.set) : '----'}</td></tr>
    `;
}

function toggleTimesModal(show) {
    document.getElementById('modal-times').style.display = show ? 'flex' : 'none';
}

function toggleSettingsModal(show) {
    document.getElementById('modal-settings').style.display = show ? 'flex' : 'none';
}

function updateHands() {
    const targetOffset = getTotalOffsetHours();

    if (!isCustomTime) {
        selectedDate = getEffectiveDate();
        updateInputsVal();
    } else {
        const realEffectiveNow = new Date(Date.now() + (targetOffset * 3600000));
        selectedDate = new Date(realEffectiveNow.getTime() + customTimeOffsetMs);
    }
    
    document.getElementById('digital-clock').innerText = selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' });

    const h = selectedDate.getUTCHours() + selectedDate.getUTCMinutes() / 60 + selectedDate.getUTCSeconds() / 3600;
    const m = selectedDate.getUTCMinutes() + selectedDate.getUTCSeconds() / 60;
    const s = selectedDate.getUTCSeconds() + selectedDate.getUTCMilliseconds() / 1000;

    const hourDeg = (h / 24) * 360 - 180;
    document.getElementById('hand-hour').style.transform = `rotate(${hourDeg}deg)`;

    const minuteDeg = (m / 60) * 360;
    document.getElementById('hand-minute').style.transform = `rotate(${minuteDeg}deg)`;

    const secDeg = (s / 60) * 360;
    document.getElementById('hand-second').style.transform = `rotate(${secDeg}deg)`;

    const baseOffset = getBaseLocationOffset();
    let utcCalculationDate = new Date(selectedDate.getTime() - (getTotalOffsetHours() * 3600000) + (baseOffset * 3600000));

    const moonPos = SunCalc.getMoonPosition(utcCalculationDate, cachedLat, cachedLon);
    const sunPos = SunCalc.getPosition(utcCalculationDate, cachedLat, cachedLon);
    
    const diffAzimuth = moonPos.azimuth - sunPos.azimuth;
    let moonHourOffset = (diffAzimuth / (2 * Math.PI)) * 24;
    
    let moonEquivalentHour = (h + moonHourOffset) % 24;
    if (moonEquivalentHour < 0) moonEquivalentHour += 24;

    const moonDeg = (moonEquivalentHour / 24) * 360 - 180;
    document.getElementById('hand-moon').style.transform = `rotate(${moonDeg}deg)`;

    const currentIllumination = SunCalc.getMoonIllumination(utcCalculationDate);
    const currentMoonTimes = getCompleteMoonTimes(utcCalculationDate, cachedLat, cachedLon);
    updateMoonDigitalPanel(currentIllumination, currentMoonTimes);

    if (cachedTimes && cachedMoonTimes) {
        updatePageBackground(cachedTimes);
        
        const currentHighlight = getNextEventIndex(cachedTimes, selectedDate);
        if (currentHighlight !== lastHighlightedEventIndex) {
            lastHighlightedEventIndex = currentHighlight;
            populateTable(cachedTimes, cachedMoonTimes, cachedMoonIllumination);
        }
    }
}

initClock();
setInterval(updateHands, 50);

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.service.worker.js');
}
