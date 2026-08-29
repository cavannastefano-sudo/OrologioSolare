// ==========================================
// SunClock24 - script.js (Senza Mappa - Con Selezione Diretta del Fuso/Paese)
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

// Coordinate fisse orientative per il calcolo astronomico del sole/luna della nazione scelta
let cachedLat = 41.9028; // Default Roma (Italia)
let cachedLon = 12.4964; 
let currentPlaceDisplayName = "Italia (Roma)";

let selectedDate = new Date();
let isCustomTime = false;

// Sincronizzazione parametri dall'URL se presenti
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('dst')) {
    localStorage.setItem('sunclock_dst', urlParams.get('dst'));
}

function getCurrentDstState() {
    const manualInput = document.getElementById('manual-dst-toggle');
    if (manualInput) {
        return manualInput.checked;
    }
    return localStorage.getItem('sunclock_dst') === 'true';
}

function hoursToAngle(h) {
    return (h / 24) * Math.PI * 2 + Math.PI / 2;
}

function sunHoursToAngle(h) {
    const dstShift = !getCurrentDstState() ? 1 : 0;
    return ((h - dstShift) / 24) * Math.PI * 2 + Math.PI / 2;
}

function initClock() {
    const isManualDst = localStorage.getItem('sunclock_dst') === 'true';
    const manualToggle = document.getElementById('manual-dst-toggle');
    if (manualToggle) manualToggle.checked = isManualDst;

    // Se l'URL passa un fuso o una nazione predefinita, la impostiamo
    if (urlParams.has('tz')) {
        const tzPreset = urlParams.get('tz');
        const selectEl = document.getElementById('timezone-preset');
        if (selectEl) selectEl.value = tzPreset;
    }
    if (urlParams.has('city')) {
        currentPlaceDisplayName = decodeURIComponent(urlParams.get('city'));
    }

    updateTimeForLocation();
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);
}

// Quando l'utente cambia nazione/fuso dal menu a tendina
function onCountryPresetChanged() {
    const selectEl = document.getElementById('timezone-preset');
    const selectedOption = selectEl.options[selectEl.selectedIndex];
    
    currentPlaceDisplayName = selectedOption.text;
    
    // Aggiorna le coordinate orientative in base alla scelta per calcolare alba/tramonto corretti
    const val = selectEl.value;
    if (val === "0") { // Portogallo / UK
        cachedLat = 38.72; cachedLon = -9.13; // Lisbona
    } else if (val === "1") { // Italia / Francia / Spagna
        cachedLat = 41.90; cachedLon = 12.49; // Roma
    } else if (val === "2") { // Grecia
        cachedLat = 37.98; cachedLon = 23.72; // Atene
    } else {
        cachedLat = 45.05; cachedLon = 9.69;
    }

    if (!isCustomTime) {
        updateTimeForLocation();
    }
    updateInputsVal();
    updateSunClock(cachedLat, cachedLon);
    toggleSettingsModal(false);
}

function toggleManualDST(checked) {
    localStorage.setItem('sunclock_dst', checked ? 'true' : 'false');
    if (!isCustomTime) {
        updateTimeForLocation();
    }
    updateSunClock(cachedLat, cachedLon);
}

function toggleMoonDropdown() {
    const content = document.getElementById('moon-dropdown-content');
    const arrow = document.getElementById('dropdown-arrow');
    content.classList.toggle('show');
    arrow.innerText = content.classList.contains('show') ? '▲' : '▼';
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
    let isDstNowActive = getCurrentDstState();
    const totalOffset = parseFloat(tz) + (isDstNowActive ? 1 : 0);

    document.getElementById('location-text').innerHTML = `
        <div style="font-size: 1.15rem; margin-bottom: 4px;">${currentPlaceDisplayName}</div>
        <div style="font-size: 0.95rem; opacity: 0.9; margin-top: 2px;">
            Fuso: UTC ${tz >= 0 ? "+" : ""}${tz}${isDstNowActive ? ` (Ora legale: UTC ${totalOffset >= 0 ? "+" : ""}${totalOffset})` : ""}
        </div>
    `;

    document.getElementById('txt-sunrise').innerText = formatTime(cachedTimes.sunrise);
    document.getElementById('txt-sunset').innerText = formatTime(cachedTimes.sunset);
}

function timeToHours(date) {
    if (!date || !isValidDate(date)) return null;
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
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
    let h = timeToHours(selectedDate);
    
    const dstShift = !getCurrentDstState() ? 1 : 0;
    h = (h + dstShift) % 24;

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
    const tzPresetVal = parseFloat(document.getElementById('timezone-preset').value);
    let isDstNowActive = getCurrentDstState();
    const dstOffset = isDstNowActive ? 1 : 0;
    const totalOffsetHours = tzPresetVal + dstOffset;
    
    const shifted = new Date(date.getTime() + (totalOffsetHours * 3600000));
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

    const hourDeg = (h / 24) * 360 - 180;
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

    const moonDeg = (moonEquivalentHour / 24) * 360 - 180;
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
