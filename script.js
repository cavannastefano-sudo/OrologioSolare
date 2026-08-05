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
let worker = null;

function initClock() {
    const savedLat = localStorage.getItem('sunclock_lat');
    const savedLon = localStorage.getItem('sunclock_lon');
    if (savedLat && savedLon) {
        cachedLat = parseFloat(savedLat);
        cachedLon = parseFloat(savedLon);
        const latInput = document.getElementById('input-lat');
        const lonInput = document.getElementById('input-lon');
        if (latInput) latInput.value = cachedLat;
        if (lonInput) lonInput.value = cachedLon;
    }

    if (window.Worker) {
        worker = new Worker('worker.js');
        worker.onmessage = function(e) {
            if (e.data.status === 'success') {
                drawSunSlicesFromWorker(e.data.slices);
                updateBackgroundAndClock(e.data.slices);
            }
        };
    }

    requestSunData();
    useGPSLocation(true);
}

function requestSunData() {
    if (worker) {
        worker.postMessage({ lat: cachedLat, lon: cachedLon, dateStr: new Date().toISOString() });
    }
}

function useGPSLocation(silent = false) {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                cachedLat = position.coords.latitude;
                cachedLon = position.coords.longitude;
                const latInput = document.getElementById('input-lat');
                const lonInput = document.getElementById('input-lon');
                if (latInput) latInput.value = cachedLat;
                if (lonInput) lonInput.value = cachedLon;
                requestSunData();
                toggleSettingsModal(false);
            },
            (error) => {
                if (!silent) alert("GPS disattivato o non disponibile.");
            }
        );
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
        requestSunData();
        toggleSettingsModal(false);
    }
}

function getSunElevationColor(altitudeDeg) {
    if (altitudeDeg >= 6) return PALETTE.day;
    if (altitudeDeg >= 0) return PALETTE.golden;
    if (altitudeDeg >= -0.833) return PALETTE.sunriseSunset;
    if (altitudeDeg >= -6) return PALETTE.civil;
    if (altitudeDeg >= -12) return PALETTE.naut;
    if (altitudeDeg >= -18) return PALETTE.astro;
    return PALETTE.night;
}

function drawSunSlicesFromWorker(slices) {
    if (!ctx) return;
    ctx.fillStyle = PALETTE.night;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    slices.forEach(slice => {
        const color = getSunElevationColor(slice.altitude);
        const angleDeg = slice.fraction * 360;
        const startAngle = (angleDeg * Math.PI) / 180 - Math.PI / 2;
        const endAngle = ((angleDeg + 1.2) * Math.PI) / 180 - Math.PI / 2;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    });

    drawMinuteRing(slices);
    createClockNumbers();
}

function drawMinuteRing(slices) {
    for (let i = 0; i < 60; i++) {
        const fraction = i / 60;
        const angle = (fraction * Math.PI * 2) - Math.PI / 2;
        const len = (i % 5 === 0) ? 14 : 7;

        const x1 = cx + (radius - len) * Math.cos(angle);
        const y1 = cy + (radius - len) * Math.sin(angle);
        const x2 = cx + radius * Math.cos(angle);
        const y2 = cy + radius * Math.sin(angle);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = (i % 5 === 0) ? 2 : 1;
        ctx.stroke();
    }
}

function createClockNumbers() {
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

function updateBackgroundAndClock(slices) {
    const now = new Date();
    const dayFraction = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
    
    // Trova la fascia più vicina all'ora corrente per colorare lo sfondo della pagina
    let closest = slices.reduce((prev, curr) => Math.abs(curr.fraction - dayFraction) < Math.abs(prev.fraction - dayFraction) ? curr : prev, slices[0]);
    if (closest) {
        document.body.style.backgroundColor = getSunElevationColor(closest.altitude);
    }

    const locText = document.getElementById('location-text');
    if (locText) locText.innerHTML = `Lat: ${cachedLat.toFixed(2)}, Lon: ${cachedLon.toFixed(2)}`;
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

initClock();
setInterval(updateHands, 50);
