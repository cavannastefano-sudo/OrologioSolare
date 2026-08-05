const canvas = document.getElementById('clockCanvas');
const ctx = canvas.getContext('2d');
const cx = 250;
const cy = 250;
const radius = 248;

const PALETTE = {
    night: '#050505',
    astro: '#0f172a',
    naut: '#1e3a8a',
    civil: '#2563eb',
    sunriseSunset: '#ea580c',
    golden: '#ca8a04',
    day: '#38bdf8'
};

let cachedTimes = null;
let cachedMoonTimes = null;
let cachedMoonIllumination = null;
let cachedLat = 45.04;
let cachedLon = 9.68;
let currentCityName = "Piacenza";
let map = null;
let marker = null;

if (typeof SunCalc !== 'undefined') {
    try {
        SunCalc.addTime(-18, 'astronomicalDawn', 'astronomicalDusk');
        SunCalc.addTime(-12, 'nauticalDawn', 'nauticalDusk');
        SunCalc.addTime(-6, 'dawn', 'dusk');
    } catch (e) {}
}

function initClock() {
    const savedLat = localStorage.getItem('sunclock_lat');
    const savedLon = localStorage.getItem('sunclock_lon');
    const savedName = localStorage.getItem('sunclock_name');
    
    if (savedLat && savedLon) {
        cachedLat = parseFloat(savedLat);
        cachedLon = parseFloat(savedLon);
        if (savedName) currentCityName = savedName;
    }
    
    document.getElementById('input-lat').value = cachedLat;
    document.getElementById('input-lon').value = cachedLon;
    document.getElementById('location-header-name').innerText = currentCityName;
    
    updateSunClock(cachedLat, cachedLon);
}

async function resolveCityName(lat, lon) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const data = await response.json();
        if (data && data.address) {
            currentCityName = data.address.city || data.address.town || data.address.village || data.address.municipality || data.address.county || "Posizione GPS";
        } else {
            currentCityName = "Posizione GPS";
        }
    } catch (e) {
        currentCityName = "Posizione GPS";
    }
    localStorage.setItem('sunclock_name', currentCityName);
    document.getElementById('location-header-name').innerText = currentCityName;
    document.getElementById('location-text').innerHTML = `${currentCityName} (Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)})`;
}

function useGPSLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                cachedLat = position.coords.latitude;
                cachedLon = position.coords.longitude;
                localStorage.setItem('sunclock_lat', cachedLat);
                localStorage.setItem('sunclock_lon', cachedLon);
                document.getElementById('input-lat').value = cachedLat;
                document.getElementById('input-lon').value = cachedLon;
                
                await resolveCityName(cachedLat, cachedLon);
                updateSunClock(cachedLat, cachedLon);
                toggleSettingsModal(false);
            },
            (error) => { alert("Impossibile rilevare la posizione GPS."); },
            { timeout: 10000, maximumAge: 60000 }
        );
    } else {
        alert("Geolocalizzazione non supportata.");
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
            cachedLat = parseFloat(data[0].lat);
            cachedLon = parseFloat(data[0].lon);
            currentCityName = data[0].display_name.split(',')[0];
            localStorage.setItem('sunclock_name', currentCityName);
            document.getElementById('input-lat').value = cachedLat;
            document.getElementById('input-lon').value = cachedLon;
            statusEl.innerHTML = `<b>${currentCityName}</b><br>Lat: ${cachedLat.toFixed(4)}, Lon: ${cachedLon.toFixed(4)}`;
            if (map && marker) {
                map.setView([cachedLat, cachedLon], 10);
                marker.setLatLng([cachedLat, cachedLon]);
            }
            setTimeout(() => { applyManualLocation(); }, 800);
        } else {
            statusEl.innerText = "Località non trovata.";
        }
    } catch (e) {
        statusEl.innerText = "Errore di connessione.";
    }
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
            map = L.map('map-container').setView([currentLat, currentLon], 6);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19, attribution: '© OpenStreetMap'
            }).addTo(map);
            marker = L.marker([currentLat, currentLon], {draggable: true}).addTo(map);
            marker.on('dragend', function(e) {
                const pos = marker.getLatLng();
                document.getElementById('input-lat').value = pos.lat.toFixed(4);
                document.getElementById('input-lon').value = pos.lng.toFixed(4);
            });
            map.on('click', function(e) {
                marker.setLatLng(e.latlng);
                document.getElementById('input-lat').value = e.latlng.lat.toFixed(4);
                document.getElementById('input-lon').value = e.latlng.lng.toFixed(4);
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
        cachedLat = lat; cachedLon = lon;
        localStorage.setItem('sunclock_lat', lat);
        localStorage.setItem('sunclock_lon', lon);
        localStorage.setItem('sunclock_name', currentCityName);
        document.getElementById('location-header-name').innerText = currentCityName;
        updateSunClock(cachedLat, cachedLon);
        toggleSettingsModal(false);
    }
}

function updateSunClock(lat, lon) {
    try {
        const now = new Date();
        if (typeof SunCalc !== 'undefined') {
            cachedTimes = SunCalc.getTimes(now, lat, lon);
            cachedMoonTimes = SunCalc.getMoonTimes(now, lat, lon);
            cachedMoonIllumination = SunCalc.getMoonIllumination(now);
            updateMoonDigitalPanel(cachedMoonIllumination, cachedMoonTimes);
            populateTable(cachedTimes);
        }

        ctx.clearRect(0, 0, 500, 500);
        drawSunSlicesClean(cachedTimes);
        drawSolarMeridianLines(cachedTimes);
        drawClockFaceCanvas(cachedTimes);
        updatePageBackground(cachedTimes);

        document.getElementById('location-header-name').innerText = currentCityName;
        document.getElementById('location-text').innerHTML = `${currentCityName} (Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)})`;
        
        if (cachedTimes) {
            document.getElementById('txt-sunrise').innerText = formatTime(cachedTimes.sunrise);
            document.getElementById('txt-sunset').innerText = formatTime(cachedTimes.sunset);
            document.getElementById('txt-noon').innerText = formatTime(cachedTimes.solarNoon);
            document.getElementById('txt-midnight').innerText = formatTime(cachedTimes.nadir); 
            document.getElementById('txt-mgold').innerText = formatTime(cachedTimes.goldenHourEnd);
            document.getElementById('txt-egold').innerText = formatTime(cachedTimes.goldenHour);
        }
    } catch (err) {}
}

function timeToHours(date) {
    if (!date || isNaN(date)) return null;
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

function hoursToAngle(h) {
    // 12 in alto (-PI/2), 24 in basso (+PI/2), senso orario pulito
    return ((h - 12) / 24) * Math.PI * 2 - Math.PI / 2;
}

function isValidDate(d) {
    return d instanceof Date && !isNaN(d);
}

function getIntervalColor(t, times) {
    if (!times) return PALETTE.night;
    const h = t.getHours() + t.getMinutes() / 60 + t.getSeconds() / 3600;
    
    const hAstro = timeToHours(times.astronomicalDawn) ?? 4;
    const hNaut = timeToHours(times.nauticalDawn) ?? 5;
    const hCivil = timeToHours(times.dawn) ?? 6;
    const hRise = timeToHours(times.sunrise) ?? 6.5;
    const hGoldEnd = timeToHours(times.goldenHourEnd) ?? 7.5;
    const hGoldStart = timeToHours(times.goldenHour) ?? 17;
    const hSet = timeToHours(times.sunset) ?? 18;
    const hCivilDusk = timeToHours(times.dusk) ?? 19;
    const hNautDusk = timeToHours(times.nauticalDusk) ?? 20;
    const hAstroDusk = timeToHours(times.astronomicalDusk) ?? 21;

    if (h >= hRise && h < hGoldEnd) return PALETTE.golden;
    if (h >= hGoldEnd && h < hGoldStart) return PALETTE.day;
    if (h >= hGoldStart && h < hSet) return PALETTE.golden;
    if (h >= hSet && h < hCivilDusk) return PALETTE.sunriseSunset;
    if (h >= hCivilDusk && h < hNautDusk) return PALETTE.civil;
    if (h >= hNautDusk && h < hAstroDusk) return PALETTE.naut;
    if (h >= hAstroDusk || h < hAstro) return PALETTE.night;
    return PALETTE.astro;
}

function drawSunSlicesClean(times) {
    ctx.fillStyle = PALETTE.night;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    if (!times) return;
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    for (let angleDeg = 0; angleDeg < 360; angleDeg += 1) {
        const startAngle = (angleDeg * Math.PI) / 180 - Math.PI / 2;
        const endAngle = ((angleDeg + 1.2) * Math.PI) / 180 - Math.PI / 2;
        
        const hourVal = ((angleDeg / 360) * 24 + 12) % 24;
        const checkDate = new Date(baseDate.getTime() + hourVal * 3600000);
        
        const color = getIntervalColor(checkDate, times);

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }
}

function drawSolarMeridianLines(times) {
    if (times && isValidDate(times.solarNoon)) {
        const noonHours = timeToHours(times.solarNoon);
        if (noonHours !== null) {
            const noonAngle = hoursToAngle(noonHours);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + radius * Math.cos(noonAngle), cy + radius * Math.sin(noonAngle));
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.stroke();
        }
    }

    if (times && isValidDate(times.nadir)) {
        const nadirHours = timeToHours(times.nadir);
        if (nadirHours !== null) {
            const nadirAngle = hoursToAngle(nadirHours);
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + radius * Math.cos(nadirAngle), cy + radius * Math.sin(nadirAngle));
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 1.5; ctx.stroke();
        }
    }
}

function drawClockFaceCanvas(times) {
    const hSunrise = times && isValidDate(times.sunrise) ? timeToHours(times.sunrise) : 6.0;
    const hSunset = times && isValidDate(times.sunset) ? timeToHours(times.sunset) : 18.0;

    for (let m = 0; m < 60; m += 5) {
        const angleRad = ((m / 60 * 24 - 12) / 24) * Math.PI * 2 - Math.PI / 2;
        const len = (m === 0 || m === 15 || m === 30 || m === 45) ? 10 : 5;
        const x1 = cx + (radius - len) * Math.cos(angleRad);
        const y1 = cy + (radius - len) * Math.sin(angleRad);
        const x2 = cx + radius * Math.cos(angleRad);
        const y2 = cy + radius * Math.sin(angleRad);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    ctx.font = 'bold 14px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    const hRadius = radius * 0.72;
    for (let i = 1; i <= 24; i++) {
        const angleRad = hoursToAngle(i);
        const hx = cx + hRadius * Math.cos(angleRad);
        const hy = cy + hRadius * Math.sin(angleRad);
        const checkHour = i === 24 ? 0 : i;
        ctx.fillStyle = (checkHour < hSunrise || checkHour > hSunset) ? '#ffffff' : '#0f172a';
        ctx.fillText(i, hx, hy);
    }
}

function updatePageBackground(times) {
    const currentColor = getIntervalColor(new Date(), times);
    document.body.style.backgroundColor = currentColor === PALETTE.night ? '#000000' : currentColor;
}

function formatTime(date) {
    if (!isValidDate(date)) return "--:--";
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function updateMoonDigitalPanel(illumination, moonTimes) {
    const iconEl = document.getElementById('moon-digital-icon');
    const phaseNameEl = document.getElementById('moon-phase-name');
    const riseEl = document.getElementById('moon-rise');
    const setEl = document.getElementById('moon-set');
    
    if (!illumination) return;
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
    riseEl.innerText = moonTimes && isValidDate(moonTimes.rise) ? formatTime(moonTimes.rise) : "--:--";
    setEl.innerText = moonTimes && isValidDate(moonTimes.set) ? formatTime(moonTimes.set) : "--:--";
}

function populateTable(times) {
    if (!times) return;
    const tbody = document.getElementById('times-table-body');
    tbody.innerHTML = `
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
    try {
        const now = new Date();
        document.getElementById('digital-clock').innerText = now.toLocaleTimeString();

        const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
        const m = now.getMinutes() + now.getSeconds() / 60;
        const s = now.getSeconds() + now.getMilliseconds() / 1000;

        const hourDeg = ((h - 12) / 24) * 360;
        document.getElementById('hand-hour').style.transform = `rotate(${hourDeg}deg)`;

        const minuteDeg = (m / 60) * 360;
        document.getElementById('hand-minute').style.transform = `rotate(${minuteDeg}deg)`;

        const secDeg = (s / 60) * 360;
        document.getElementById('hand-second').style.transform = `rotate(${secDeg}deg)`;
    } catch (e) {}
}

initClock();
setInterval(updateHands, 50);
