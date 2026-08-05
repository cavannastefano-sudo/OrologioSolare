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

let cachedLat = 45.04;
let cachedLon = 9.68;

function init() {
    const savedLat = localStorage.getItem('sunclock_lat');
    const savedLon = localStorage.getItem('sunclock_lon');
    if (savedLat && savedLon) {
        cachedLat = parseFloat(savedLat);
        cachedLon = parseFloat(savedLon);
        document.getElementById('input-lat').value = cachedLat;
        document.getElementById('input-lon').value = cachedLon;
    }
    renderClock();
    createNumbers();
}

function getSunColor(alt) {
    if (alt >= 6) return PALETTE.day;
    if (alt >= 0) return PALETTE.golden;
    if (alt >= -0.833) return PALETTE.sunriseSunset;
    if (alt >= -6) return PALETTE.civil;
    if (alt >= -12) return PALETTE.naut;
    if (alt >= -18) return PALETTE.astro;
    return PALETTE.night;
}

function renderClock() {
    if (!ctx || typeof Astronomy === 'undefined') return;
    ctx.clearRect(0, 0, 500, 500);

    const observer = new Astronomy.Observer(cachedLat, cachedLon, 0);
    const baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);

    // Disegno ciclico a 360 gradi basato su Astronomy Engine (come nel progetto originale)
    for (let i = 0; i < 1440; i += 2) {
        const fraction = i / 1440;
        const checkDate = new Date(baseDate.getTime() + fraction * 86400000);
        const astroTime = Astronomy.MakeTime(checkDate);
        const eq = Astronomy.Equator(Astronomy.Body.Sun, astroTime, observer, true, true);
        const hor = Astronomy.Horizon(astroTime, observer, eq.right_ascension, eq.declination, "normal");

        const color = getSunColor(hor.altitude);
        const angleDeg = fraction * 360;
        const startAngle = (angleDeg * Math.PI) / 180 - Math.PI / 2;
        const endAngle = ((angleDeg + 1.2) * Math.PI) / 180 - Math.PI / 2;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    // Tacche dei minuti
    for (let m = 0; m < 60; m++) {
        const angle = ((m / 60) * Math.PI * 2) - Math.PI / 2;
        const len = (m % 5 === 0) ? 14 : 7;
        const x1 = cx + (radius - len) * Math.cos(angle);
        const y1 = cy + (radius - len) * Math.sin(angle);
        const x2 = cx + radius * Math.cos(angle);
        const y2 = cy + radius * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = (m % 5 === 0) ? 2 : 1;
        ctx.stroke();
    }

    // Info SunCalc per alba/tramonto testuali
    if (typeof SunCalc !== 'undefined') {
        const times = SunCalc.getTimes(new Date(), cachedLat, cachedLon);
        if(times.sunrise && !isNaN(times.sunrise)) document.getElementById('txt-sunrise').innerText = times.sunrise.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        if(times.sunset && !isNaN(times.sunset)) document.getElementById('txt-sunset').innerText = times.sunset.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        if(times.solarNoon && !isNaN(times.solarNoon)) document.getElementById('txt-noon').innerText = times.solarNoon.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }
}

function createNumbers() {
    const container = document.getElementById('clock-elements-container');
    if (!container) return;
    container.innerHTML = '';
    const hRadius = radius * 0.65;
    for (let i = 1; i <= 24; i++) {
        const angleRad = ((i - 12) / 24) * Math.PI * 2 - Math.PI / 2;
        const hx = cx + hRadius * Math.cos(angleRad);
        const hy = cy + hRadius * Math.sin(angleRad);

        const div = document.createElement('div');
        div.className = 'hour-num';
        div.style.left = `${hx}px`;
        div.style.top = `${hy}px`;
        div.innerText = i;
        container.appendChild(div);
    }
}

function updateHands() {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
    const m = now.getMinutes() + now.getSeconds() / 60;
    const s = now.getSeconds() + now.getMilliseconds() / 1000;

    const hourDeg = ((h - 12) / 24) * 360;
    const minuteDeg = (m / 60) * 360;
    const secDeg = (s / 60) * 360;
    const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
    const utcDeg = ((utcHours - 12) / 24) * 360;

    const hEl = document.getElementById('hand-hour');
    const mEl = document.getElementById('hand-minute');
    const sEl = document.getElementById('hand-second');
    const uEl = document.getElementById('hand-utc');

    if (hEl) hEl.style.transform = `rotate(${hourDeg}deg)`;
    if (mEl) mEl.style.transform = `rotate(${minuteDeg}deg)`;
    if (sEl) sEl.style.transform = `rotate(${secDeg}deg)`;
    if (uEl) uEl.style.transform = `rotate(${utcDeg}deg)`;
}

function toggleSettingsModal(show) {
    document.getElementById('modal-settings').style.display = show ? 'flex' : 'none';
}

function applyManualLocation() {
    const lat = parseFloat(document.getElementById('input-lat').value);
    const lon = parseFloat(document.getElementById('input-lon').value);
    if (!isNaN(lat) && !isNaN(lon)) {
        cachedLat = lat;
        cachedLon = lon;
        localStorage.setItem('sunclock_lat', lat);
        localStorage.setItem('sunclock_lon', lon);
        renderClock();
        toggleSettingsModal(false);
    }
}

init();
setInterval(updateHands, 50);
