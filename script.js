const canvas = document.getElementById('clockCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const cx = 250;
const cy = 250;
const radius = 248;

const PALETTE = {
    night: '#000000',         
    astro: '#172554',         
    naut: '#1e3a8a',          
    civil: '#3b82f6',         
    sunriseSunset: '#f97316', 
    golden: '#eab308',        
    day: '#bae6fd'            
};

let cachedTimes = null;
let cachedLat = 45.04;
let cachedLon = 9.68;

function initClock() {
    try {
        if (typeof SunCalc !== 'undefined') {
            SunCalc.addTime(-18, 'astronomicalDawn', 'astronomicalDusk');
            SunCalc.addTime(-12, 'nauticalDawn', 'nauticalDusk');
            SunCalc.addTime(-6, 'dawn', 'dusk');
        }
    } catch (e) {}

    const savedLat = localStorage.getItem('sunclock_lat');
    const savedLon = localStorage.getItem('sunclock_lon');
    if (savedLat && savedLon) {
        cachedLat = parseFloat(savedLat);
        cachedLon = parseFloat(savedLon);
        const latInput = document.getElementById('input-lat');
        const lonInput = document.getElementById('input-lon');
        if (latInput) latInput.value = cachedLat;
        if (lonInput) lonInput.value = cachedLon;
        updateSunClock(cachedLat, cachedLon);
    } else {
        useGPSLocation();
    }
}

function useGPSLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                cachedLat = position.coords.latitude;
                cachedLon = position.coords.longitude;
                const latInput = document.getElementById('input-lat');
                const lonInput = document.getElementById('input-lon');
                if (latInput) latInput.value = cachedLat;
                if (lonInput) lonInput.value = cachedLon;
                updateSunClock(cachedLat, cachedLon);
                toggleSettingsModal(false);
            },
            (error) => {
                updateSunClock(cachedLat, cachedLon); 
                const locText = document.getElementById('location-text');
                if (locText) locText.innerText = "GPS disattivato. Coordinate predefinite (Piacenza).";
            }
        );
    } else {
        updateSunClock(cachedLat, cachedLon);
    }
}

function applyManualLocation() {
    const latInput = document.getElementById('input-lat');
    const lonInput = document.getElementById('input-lon');
    if (!latInput || !lonInput) return;
    const lat = parseFloat(latInput.value);
    const lon = parseFloat(lonInput.value);
    if (!isNaN(lat) && !isNaN(lon)) {
        cachedLat = lat;
        cachedLon = lon;
        localStorage.setItem('sunclock_lat', lat);
        localStorage.setItem('sunclock_lon', lon);
        updateSunClock(cachedLat, cachedLon);
        toggleSettingsModal(false);
    }
}

function updateSunClock(lat, lon) {
    try {
        const now = new Date();
        if (typeof SunCalc !== 'undefined') {
            cachedTimes = SunCalc.getTimes(now, lat, lon);
        }

        if (ctx) {
            ctx.clearRect(0, 0, 500, 500);
            if (cachedTimes) {
                drawSunSlices(cachedTimes);
                drawMinuteRing(cachedTimes);
                createClockNumbers(cachedTimes);
                populateTable(cachedTimes);
            }
        }

        updatePageBackground(cachedTimes);

        const locText = document.getElementById('location-text');
        if (locText) locText.innerHTML = `Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`;
        
        if (cachedTimes) {
            setElementText('txt-sunrise', formatTime(cachedTimes.sunrise));
            setElementText('txt-sunset', formatTime(cachedTimes.sunset));
            setElementText('txt-noon', formatTime(cachedTimes.solarNoon));
            setElementText('txt-midnight', formatTime(cachedTimes.nadir)); 
            setElementText('txt-mgold', formatTime(cachedTimes.goldenHourEnd));
            setElementText('txt-egold', formatTime(cachedTimes.goldenHour));
        }
    } catch (err) {
        console.error("Errore in updateSunClock:", err);
    }
}

function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function timeToHours(date) {
    if (!date || isNaN(date)) return 0;
    return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

function hoursToAngle(h) {
    return ((h - 12) / 24) * Math.PI * 2 - Math.PI / 2;
}

function isValidDate(d) {
    return d instanceof Date && !isNaN(d);
}

function getIntervalColor(h, times) {
    if (!times) return PALETTE.night;
    const hAstroDawn = isValidDate(times.astronomicalDawn) ? timeToHours(times.astronomicalDawn) : 4.11;
    const hNautDawn = isValidDate(times.nauticalDawn) ? timeToHours(times.nauticalDawn) : 4.92;
    const hDawn = isValidDate(times.dawn) ? timeToHours(times.dawn) : 5.61;
    const hSunrise = isValidDate(times.sunrise) ? timeToHours(times.sunrise) : 6.18;
    const hSunriseEnd = isValidDate(times.sunriseEnd) ? timeToHours(times.sunriseEnd) : 6.23;
    const hGoldenEnd = isValidDate(times.goldenHourEnd) ? timeToHours(times.goldenHourEnd) : 6.88;
    const hGoldenStart = isValidDate(times.goldenHour) ? timeToHours(times.goldenHour) : 20.08;
    const hSunsetStart = isValidDate(times.sunsetStart) ? timeToHours(times.sunsetStart) : 20.71;
    const hSunset = isValidDate(times.sunset) ? timeToHours(times.sunset) : 20.78;
    const hDusk = isValidDate(times.dusk) ? timeToHours(times.dusk) : 21.33;
    const hNautDusk = isValidDate(times.nauticalDusk) ? timeToHours(times.nauticalDusk) : 22.03;
    const hAstroDusk = isValidDate(times.astronomicalDusk) ? timeToHours(times.astronomicalDusk) : 22.83;

    if (h >= hAstroDawn && h < hNautDawn) return PALETTE.astro;
    if (h >= hNautDawn && h < hDawn) return PALETTE.naut;
    if (h >= hDawn && h < hSunrise) return PALETTE.civil;
    if (h >= hSunrise && h < hSunriseEnd) return PALETTE.sunriseSunset;
    if (h >= hSunriseEnd && h < hGoldenEnd) return PALETTE.golden;
    if (h >= hGoldenEnd && h < hGoldenStart) return PALETTE.day;
    if (h >= hGoldenStart && h < hSunsetStart) return PALETTE.golden;
    if (h >= hSunsetStart && h < hSunset) return PALETTE.sunriseSunset;
    if (h >= hSunset && h < hDusk) return PALETTE.civil;
    if (h >= hDusk && h < hNautDusk) return PALETTE.naut;
    if (h >= hNautDusk && h < hAstroDusk) return PALETTE.astro;
    return PALETTE.night;
}

function drawSunSlices(times) {
    if (!ctx) return;
    ctx.fillStyle = PALETTE.night;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    const intervals = [
        { start: timeToHours(times.astronomicalDawn), end: timeToHours(times.nauticalDawn), color: PALETTE.astro },
        { start: timeToHours(times.nauticalDawn), end: timeToHours(times.dawn), color: PALETTE.naut },
        { start: timeToHours(times.dawn), end: timeToHours(times.sunrise), color: PALETTE.civil },
        { start: timeToHours(times.sunrise), end: timeToHours(times.sunriseEnd), color: PALETTE.sunriseSunset },
        { start: timeToHours(times.sunriseEnd), end: timeToHours(times.goldenHourEnd), color: PALETTE.golden },
        { start: timeToHours(times.goldenHourEnd), end: timeToHours(times.goldenHour), color: PALETTE.day },
        { start: timeToHours(times.goldenHour), end: timeToHours(times.sunsetStart), color: PALETTE.golden },
        { start: timeToHours(times.sunsetStart), end: timeToHours(times.sunset), color: PALETTE.sunriseSunset },
        { start: timeToHours(times.sunset), end: timeToHours(times.dusk), color: PALETTE.civil },
        { start: timeToHours(times.dusk), end: timeToHours(times.nauticalDusk), color: PALETTE.naut },
        { start: timeToHours(times.nauticalDusk), end: timeToHours(times.astronomicalDusk), color: PALETTE.astro }
    ];

    intervals.forEach(interval => {
        if (interval.start < interval.end) {
            drawSector(interval.start, interval.end, interval.color, radius);
        }
    });
}

function drawSector(startH, endH, color, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, hoursToAngle(startH), hoursToAngle(endH));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}

function drawMinuteRing(times) {
    for (let i = 0; i < 60; i++) {
        let hEq = (i / 60) * 24;
        const sectorColor = getIntervalColor(hEq, times);

        const angle = ((i / 60) * 24 - 12) / 24 * Math.PI * 2 - Math.PI / 2;
        const len = (i % 5 === 0) ? 14 : 7;

        const x1 = cx + (radius - len) * Math.cos(angle);
        const y1 = cy + (radius - len) * Math.sin(angle);
        const x2 = cx + radius * Math.cos(angle);
        const y2 = cy + radius * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = (sectorColor === '#bae6fd' || sectorColor === '#eab308') ? '#0f172a' : '#ffffff';
        ctx.lineWidth = (i % 5 === 0) ? 2 : 1;
        ctx.stroke();
    }
}

function createClockNumbers(times) {
    const container = document.getElementById('clock-elements-container');
    if (!container) return;
    container.innerHTML = '';
    
    const hSunrise = timeToHours(times.sunrise);
    const hSunset = timeToHours(times.sunset);

    const hRadius = radius * 0.65;
    for (let i = 1; i <= 24; i++) {
        const hourValue = i;
        const angleRad = hoursToAngle(hourValue);
        
        const hx = cx + hRadius * Math.cos(angleRad);
        const hy = cy + hRadius * Math.sin(angleRad);

        const div = document.createElement('div');
        div.className = 'hour-num';
        div.style.left = `${hx}px`;
        div.style.top = `${hy}px`;
        div.innerText = hourValue;

        const checkHour = hourValue === 24 ? 0 : hourValue;
        if (checkHour < hSunrise || checkHour > hSunset) {
            div.style.color = '#ffffff';
        } else {
            div.style.color = '#0f172a';
        }

        container.appendChild(div);
    }

    const mRadius = radius * 0.86;
    for (let m = 0; m < 60; m += 5) {
        const angleRad = ((m / 60 * 24 - 12) / 24) * Math.PI * 2 - Math.PI / 2;
        
        const mx = cx + mRadius * Math.cos(angleRad);
        const my = cy + mRadius * Math.sin(angleRad);

        const div = document.createElement('div');
        div.className = 'min-num';
        div.style.left = `${mx}px`;
        div.style.top = `${my}px`;
        div.innerText = String(m).padStart(2, '0');

        container.appendChild(div);
    }
}

function updatePageBackground(times) {
    if (!times) return;
    const now = new Date();
    const h = timeToHours(now);
    const currentColor = getIntervalColor(h, times);
    document.body.style.backgroundColor = currentColor;
}

function formatTime(date) {
    if (!isValidDate(date)) return "--:--";
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function populateTable(times) {
    const tbody = document.getElementById('times-table-body');
    if (!tbody) return;
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
    const modal = document.getElementById('modal-times');
    if (modal) modal.style.display = show ? 'flex' : 'none';
}

function toggleSettingsModal(show) {
    const modal = document.getElementById('modal-settings');
    if (modal) modal.style.display = show ? 'flex' : 'none';
}

function updateHands() {
    try {
        const now = new Date();
        const digitalClock = document.getElementById('digital-clock');
        if (digitalClock) digitalClock.innerText = now.toLocaleTimeString();

        const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
        const m = now.getMinutes() + now.getSeconds() / 60;
        const s = now.getSeconds() + now.getMilliseconds() / 1000;

        const handHour = document.getElementById('hand-hour');
        const handMinute = document.getElementById('hand-minute');
        const handSecond = document.getElementById('hand-second');
        const handUtc = document.getElementById('hand-utc');

        if (handHour) {
            const hourDeg = ((h - 12) / 24) * 360;
            handHour.style.transform = `rotate(${hourDeg}deg)`;
        }
        if (handMinute) {
            const minuteDeg = (m / 60) * 360;
            handMinute.style.transform = `rotate(${minuteDeg}deg)`;
        }
        if (handSecond) {
            const secDeg = (s / 60) * 360;
            handSecond.style.transform = `rotate(${secDeg}deg)`;
        }
        if (handUtc) {
            const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
            const utcDeg = ((utcHours - 12) / 24) * 360;
            handUtc.style.transform = `rotate(${utcDeg}deg)`;
        }

        if (cachedTimes) {
            updatePageBackground(cachedTimes);
        }
    } catch (e) {
        console.error("Errore in updateHands:", e);
    }
}

initClock();
setInterval(updateHands, 50);
