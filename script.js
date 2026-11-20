// ==========================================
// SunClock24 - script.js (Striscia Mensile Fluida + Selettori Anno e Mese in Alto + Senza Barra Inferiore Extra)
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

// Stato Striscia Mensile Fluida con Selettori Anno e Mese in Alto
let builtMonthKey = null;
let isStripOpen = false;
let isProgrammaticScroll = false;
let scrollEndTimer = null;

// Caricamento dell'immagine reale della Luna con il nome corretto luna.jpg
const realMoonImage = new Image();
realMoonImage.src = 'luna.jpg';

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('auto')) {
    localStorage.setItem('sunclock_auto_dst', urlParams.get('auto'));
}
if (urlParams.has('dst')) {
    localStorage.setItem('sunclock_dst', urlParams.get('dst'));
}

// Garantisce visibilità e contrasto su qualsiasi sfondo (giorno/notte)
function styleStripButtonVisibility(btn, active) {
    if (!btn) return;
    btn.style.backgroundColor = active ? '#0284c7' : '#0f172a';
    btn.style.color = active ? '#ffffff' : '#38bdf8';
    btn.style.border = active ? '1px solid #e0f2fe' : '1px solid #38bdf8';
    btn.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.55)';
    btn.style.textShadow = 'none';
    btn.style.webkitTextStroke = '0px transparent';
}

function styleStripControlsVisibility() {
    const stripBody = document.getElementById('panel-strip-body');
    if (!stripBody) return;

    stripBody.style.textShadow = 'none';
    stripBody.style.webkitTextStroke = '0px transparent';
    stripBody.style.color = '#f8fafc';

    stripBody.querySelectorAll('button, select, span, label').forEach(el => {
        el.style.textShadow = 'none';
        el.style.webkitTextStroke = '0px transparent';
    });

    stripBody.querySelectorAll('button').forEach(btn => {
        btn.style.backgroundColor = '#0f172a';
        btn.style.color = '#f8fafc';
        btn.style.border = '1px solid #475569';
    });

    stripBody.querySelectorAll('select').forEach(sel => {
        sel.style.backgroundColor = '#0f172a';
        sel.style.color = '#facc15';
        sel.style.border = '1px solid #475569';
    });
}

// Rimuove eventuali righe/etichette inferiori ridondanti (come "Anno:" o "Giallo = Oggi")
function removeBottomRedundantFooter() {
    const stripBody = document.getElementById('panel-strip-body');
    if (!stripBody) return;

    const stage = stripBody.querySelector('.strip-stage');
    if (stage) {
        let nextEl = stage.nextElementSibling;
        while (nextEl) {
            const toRemove = nextEl;
            nextEl = nextEl.nextElementSibling;
            toRemove.remove();
        }
    }

    stripBody.querySelectorAll('div, span, p, small, label').forEach(el => {
        if (
            el.id === 'timeline-viewport' ||
            el.id === 'timeline-track' ||
            el.classList.contains('strip-year-bar') ||
            el.classList.contains('strip-stage') ||
            el.classList.contains('strip-center-cursor')
        ) return;

        const txt = (el.textContent || '').trim().toLowerCase();
        if (txt.includes('giallo') || txt.includes('oggi') || txt === 'anno:' || txt === 'anno') {
            el.remove();
        }
    });
}

// Adattamento automatico dell'altezza del riquadro inferiore in base al contenuto visibile
function adaptBottomPanelHeight() {
    const container = document.getElementById('bottom-panels-container');
    const panelBox = container ? container.querySelector('.info-panel-box') : null;
    if (!container || !panelBox) return;

    container.style.height = 'auto';
    container.style.minHeight = '0px';
    container.style.maxHeight = 'none';
    panelBox.style.height = 'auto';
    panelBox.style.minHeight = '0px';
    panelBox.style.maxHeight = 'none';

    requestAnimationFrame(() => {
        const neededHeight = panelBox.offsetHeight;
        if (neededHeight > 0) {
            container.style.height = `${neededHeight}px`;
            container.style.minHeight = `${neededHeight}px`;
        }
    });
}

function getDayKey(d) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function getMonthKey(year, month) {
    return `${year}-${String(month + 1).padStart(2, '0')}`;
}

function ensureYearAndMonthSelectors(currentYear, currentMonth) {
    const stripBody = document.getElementById('panel-strip-body');
    if (!stripBody) return;

    removeBottomRedundantFooter();

    let yearBar = stripBody.querySelector('.strip-year-bar');
    if (!yearBar) {
        yearBar = document.createElement('div');
        yearBar.className = 'strip-year-bar';
        stripBody.insertBefore(yearBar, stripBody.firstChild);
    }

    yearBar.style.display = 'flex';
    yearBar.style.flexWrap = 'wrap';
    yearBar.style.alignItems = 'center';
    yearBar.style.justifyContent = 'center';
    yearBar.style.gap = '6px';

    let yearPrevBtn = document.getElementById('btn-year-prev');
    let yearSel = document.getElementById('select-strip-year');
    let yearNextBtn = document.getElementById('btn-year-next');

    if (!yearPrevBtn || !yearSel || !yearNextBtn) {
        yearBar.innerHTML = `
            <div style="display:inline-flex;align-items:center;gap:4px;">
                <button type="button" id="btn-year-prev" class="strip-year-step" onclick="stepYear(-1)" title="Anno precedente">&lt;</button>
                <select id="select-strip-year" class="strip-year-select" onchange="onYearSelectChanged(this.value)" title="Seleziona anno"></select>
                <button type="button" id="btn-year-next" class="strip-year-step" onclick="stepYear(1)" title="Anno successivo">&gt;</button>
            </div>
            <div style="display:inline-flex;align-items:center;gap:4px;">
                <button type="button" id="btn-month-prev" class="strip-year-step" onclick="stepMonth(-1)" title="Mese precedente">&lt;</button>
                <select id="select-strip-month" class="strip-year-select" onchange="onMonthSelectChanged(this.value)" title="Seleziona mese"></select>
                <button type="button" id="btn-month-next" class="strip-year-step" onclick="stepMonth(1)" title="Mese successivo">&gt;</button>
            </div>
        `;
        yearSel = document.getElementById('select-strip-year');
    }

    const startY = Math.min(2020, currentYear - 5);
    const endY = Math.max(2035, currentYear + 5);
    if (
        yearSel.options.length === 0 ||
        parseInt(yearSel.options[0].value, 10) > currentYear ||
        parseInt(yearSel.options[yearSel.options.length - 1].value, 10) < currentYear
    ) {
        yearSel.innerHTML = '';
        for (let y = startY; y <= endY; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            yearSel.appendChild(opt);
        }
    }
    yearSel.value = String(currentYear);

    const monthSel = document.getElementById('select-strip-month');
    if (monthSel) {
        if (monthSel.options.length !== 12) {
            monthSel.innerHTML = '';
            for (let m = 0; m < 12; m++) {
                const label = new Date(Date.UTC(2026, m, 1)).toLocaleDateString('it-IT', { month: 'long', timeZone: 'UTC' });
                const capLabel = label.charAt(0).toUpperCase() + label.slice(1);
                const opt = document.createElement('option');
                opt.value = String(m);
                opt.textContent = capLabel;
                monthSel.appendChild(opt);
            }
        }
        monthSel.value = String(currentMonth);
    }

    styleStripControlsVisibility();
}

function onYearSelectChanged(val) {
    const targetYear = parseInt(val, 10);
    if (isNaN(targetYear)) return;
    const currentMonth = selectedDate.getUTCMonth();
    const maxDay = new Date(Date.UTC(targetYear, currentMonth + 1, 0)).getUTCDate();
    const safeDay = Math.min(selectedDate.getUTCDate(), maxDay);
    applyStripDateChange(targetYear, currentMonth, safeDay, false);
}

function stepYear(delta) {
    const nextYear = selectedDate.getUTCFullYear() + delta;
    const currentMonth = selectedDate.getUTCMonth();
    const maxDay = new Date(Date.UTC(nextYear, currentMonth + 1, 0)).getUTCDate();
    const safeDay = Math.min(selectedDate.getUTCDate(), maxDay);
    applyStripDateChange(nextYear, currentMonth, safeDay, false);
}

function onMonthSelectChanged(val) {
    const targetMonth = parseInt(val, 10);
    if (isNaN(targetMonth)) return;
    const currentYear = selectedDate.getUTCFullYear();
    const maxDay = new Date(Date.UTC(currentYear, targetMonth + 1, 0)).getUTCDate();
    const safeDay = Math.min(selectedDate.getUTCDate(), maxDay);
    applyStripDateChange(currentYear, targetMonth, safeDay, false);
}

function stepMonth(delta) {
    const base = new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth() + delta, 1, 12, 0, 0));
    const nextYear = base.getUTCFullYear();
    const nextMonth = base.getUTCMonth();
    const maxDay = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
    const safeDay = Math.min(selectedDate.getUTCDate(), maxDay);
    applyStripDateChange(nextYear, nextMonth, safeDay, false);
}

function toggleYearStrip() {
    isStripOpen = !isStripOpen;
    const stdBody = document.getElementById('panel-standard-body');
    const stripBody = document.getElementById('panel-strip-body');
    const btn = document.getElementById('btn-toggle-year-strip');

    removeBottomRedundantFooter();

    if (isStripOpen) {
        if (stdBody) stdBody.style.display = 'none';
        if (stripBody) stripBody.classList.add('active');
        if (btn) {
            btn.classList.add('active');
            btn.innerText = '✕ Dati';
            styleStripButtonVisibility(btn, true);
        }
        ensureYearAndMonthSelectors(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth());
        ensureMonthStripBuilt(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth());
        syncStripToSelectedDate(false);
    } else {
        if (stripBody) stripBody.classList.remove('active');
        if (stdBody) stdBody.style.display = 'flex';
        if (btn) {
            btn.classList.remove('active');
            btn.innerText = '⏱️ Striscia';
            styleStripButtonVisibility(btn, false);
        }
    }
    adaptBottomPanelHeight();
}

// Costruisce solo i giorni del mese selezionato (massimo 31 giorni) per uno scorrimento fluido
function ensureMonthStripBuilt(year, month) {
    ensureYearAndMonthSelectors(year, month);
    const keyMonth = getMonthKey(year, month);
    if (builtMonthKey === keyMonth) return;
    builtMonthKey = keyMonth;

    const track = document.getElementById('timeline-track');
    if (!track) return;
    track.innerHTML = '';

    const todayKey = getDayKey(getEffectiveDate());
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const fragment = document.createDocumentFragment();

    for (let day = 1; day <= daysInMonth; day++) {
        const dCopy = new Date(Date.UTC(year, month, day, 12, 0, 0));
        const key = getDayKey(dCopy);
        const moon = (typeof SunCalc.getMoonData === 'function')
            ? SunCalc.getMoonData(dCopy)
            : SunCalc.getMoonIllumination(dCopy);
        const pct = Math.round(moon.fraction * 100);

        const tick = document.createElement('div');
        tick.className = 'timeline-tick' + (key === todayKey ? ' is-today' : '');
        tick.dataset.dayKey = key;
        tick.dataset.year = year;
        tick.dataset.month = month;
        tick.dataset.day = day;
        tick.style.textShadow = 'none';
        tick.style.webkitTextStroke = '0px transparent';

        const dayNum = String(day).padStart(2, '0');
        const monthShort = dCopy.toLocaleDateString('it-IT', { month: 'short', timeZone: 'UTC' }).replace('.', '');

        tick.innerHTML = `
            <span>${dayNum} ${monthShort}</span>
            <span style="font-size:0.64rem; color:#facc15;">🌙 ${pct}%</span>
        `;

        tick.onclick = () => {
            applyStripDateChange(year, month, day, true);
        };

        fragment.appendChild(tick);
    }

    track.appendChild(fragment);
}

function syncStripToSelectedDate(smooth = true) {
    const viewport = document.getElementById('timeline-viewport');
    const track = document.getElementById('timeline-track');
    if (!viewport || !track) return;

    const activeKey = getDayKey(selectedDate);
    let targetTick = null;

    track.querySelectorAll('.timeline-tick').forEach(tick => {
        const isMatch = tick.dataset.dayKey === activeKey;
        tick.classList.toggle('active', isMatch);
        if (isMatch) targetTick = tick;
    });

    if (targetTick) {
        isProgrammaticScroll = true;
        const targetScrollLeft = targetTick.offsetLeft + (targetTick.offsetWidth / 2) - (viewport.clientWidth / 2);
        viewport.scrollTo({
            left: Math.max(0, targetScrollLeft),
            behavior: smooth ? 'smooth' : 'auto'
        });
        clearTimeout(scrollEndTimer);
        scrollEndTimer = setTimeout(() => { isProgrammaticScroll = false; }, smooth ? 250 : 50);
    }
}

function applyStripDateChange(y, m, d, smoothScroll = true) {
    selectedDate.setUTCFullYear(y, m, d);
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
    if (isStripOpen) {
        ensureMonthStripBuilt(y, m);
        syncStripToSelectedDate(smoothScroll);
    }
    adaptBottomPanelHeight();
}

const stripViewportEl = document.getElementById('timeline-viewport');
if (stripViewportEl) {
    stripViewportEl.addEventListener('scroll', () => {
        if (!isStripOpen || isProgrammaticScroll) return;

        const track = document.getElementById('timeline-track');
        if (!track) return;
        const centerX = stripViewportEl.scrollLeft + (stripViewportEl.clientWidth / 2);

        let closestTick = null;
        let minDist = Infinity;

        track.querySelectorAll('.timeline-tick').forEach(tick => {
            const tickCenter = tick.offsetLeft + (tick.offsetWidth / 2);
            const dist = Math.abs(centerX - tickCenter);
            if (dist < minDist) {
                minDist = dist;
                closestTick = tick;
            }
        });

        if (closestTick && closestTick.dataset.dayKey !== getDayKey(selectedDate)) {
            track.querySelectorAll('.timeline-tick.active').forEach(el => el.classList.remove('active'));
            closestTick.classList.add('active');

            const y = parseInt(closestTick.dataset.year, 10);
            const m = parseInt(closestTick.dataset.month, 10);
            const d = parseInt(closestTick.dataset.day, 10);

            selectedDate.setUTCFullYear(y, m, d);
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
    }, { passive: true });
}

async function initClock() {
    ensureYearAndMonthSelectors(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth());
    styleStripButtonVisibility(document.getElementById('btn-toggle-year-strip'), isStripOpen);

    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    const isManualDst = getCurrentDstState();

    const autoToggle = document.getElementById('auto-dst-toggle');
    const manualToggle = document.getElementById('manual-dst-toggle');
    if (autoToggle) autoToggle.checked = isAuto;
    if (manualToggle) manualToggle.checked = isManualDst;
    updateDstUI(isAuto);

    drawRealisticSun('sun-clock-canvas');

    if (urlParams.has('lat') && urlParams.has('lon')) {
        cachedLat = parseFloat(urlParams.get('lat'));
        cachedLon = parseFloat(urlParams.get('lon'));
        currentPlaceDisplayName = urlParams.get('city') ? decodeURIComponent(urlParams.get('city')) : "Località";

        document.getElementById('input-lat').value = cachedLat;
        document.getElementById('input-lon').value = cachedLon;
        updateTimeForLocation();
        updateInputsVal();
        updateSunClock(cachedLat, cachedLon);
        if (isStripOpen) {
            ensureMonthStripBuilt(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth());
            syncStripToSelectedDate(false);
        }
        adaptBottomPanelHeight();
        return;
    }

    const loadDefaultLocation = () => {
        cachedLat = 45.05;
        cachedLon = 9.69;
        currentPlaceDisplayName = "Piacenza - Italia";

        const latInput = document.getElementById('input-lat');
        const lonInput = document.getElementById('input-lon');
        if (latInput) latInput.value = cachedLat;
        if (lonInput) lonInput.value = cachedLon;

        updateTimeForLocation();
        updateInputsVal();
        updateSunClock(cachedLat, cachedLon);
        if (isStripOpen) {
            ensureMonthStripBuilt(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth());
            syncStripToSelectedDate(false);
        }
        adaptBottomPanelHeight();
    };

    if (navigator.geolocation) {
        let gpsFinished = false;

        const gpsTimeout = setTimeout(() => {
            if (!gpsFinished) {
                gpsFinished = true;
                loadDefaultLocation();
            }
        }, 3000);

        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (gpsFinished) return;
                gpsFinished = true;
                clearTimeout(gpsTimeout);
                fetchAndUpdateLocation(position.coords.latitude, position.coords.longitude, "Posizione Corrente");
            },
            (error) => {
                if (gpsFinished) return;
                gpsFinished = true;
                clearTimeout(gpsTimeout);
                loadDefaultLocation();
            },
            { timeout: 2500, enableHighAccuracy: false, maximumAge: 60000 }
        );
    } else {
        loadDefaultLocation();
    }
}

let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        adaptBottomPanelHeight();
        if (isStripOpen) {
            syncStripToSelectedDate(false);
        }
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
    utcCalculationDate.setUTCHours(12, 0, 0, 0);

    cachedTimes = SunCalc.getTimes(utcCalculationDate, cachedLat, cachedLon);

    populateTable(cachedTimes, cachedMoonTimes, cachedMoonIllumination);

    ctx.clearRect(0, 0, 500, 500);
    drawSunSlicesSafe(cachedTimes);
    drawMinuteRingSafe();
    drawClockNumbers();
    updatePageBackground(cachedTimes);

    adaptBottomPanelHeight();
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
    applyStripDateChange(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), true);
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

function changeDate(days) {
    const next = new Date(selectedDate);
    next.setUTCDate(next.getUTCDate() + days);
    applyStripDateChange(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate(), true);
}

function changeHour(hours) {
    selectedDate.setUTCHours(selectedDate.getUTCHours() + hours);
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

    if (isStripOpen) {
        ensureMonthStripBuilt(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth());
        syncStripToSelectedDate(true);
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
    if (isStripOpen) {
        ensureMonthStripBuilt(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth());
        syncStripToSelectedDate(true);
    }
    adaptBottomPanelHeight();
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

    if (isStripOpen) {
        ensureMonthStripBuilt(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth());
        syncStripToSelectedDate(true);
    }
    adaptBottomPanelHeight();
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

async function getPlaceNameAndRedirect(lat, lon) {
    let placeName = "Posizione";
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
                placeName = specificLocality || country || "Posizione";
            }
        }
    } catch (err) {
        placeName = "Posizione";
    }

    const isAuto = localStorage.getItem('sunclock_auto_dst') !== 'false';
    const activeDst = getCurrentDstState();

    window.location.href = `posizione.html?lat=${lat}&lon=${lon}&city=${encodeURIComponent(placeName)}&auto=${isAuto}&dst=${activeDst}`;
}

function getCompleteMoonTimes(date, lat, lon) {
    let targetDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0));

    let times = SunCalc.getMoonTimes(targetDate, lat, lon);
    let rise = times.rise;
    let set = times.set;

    let startDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0));
    let endDay = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 23, 59, 59, 999));

    if (!isValidDate(rise) || !isValidDate(set) || (rise < startDay || rise > endDay) || (set < startDay || set > endDay) || times.alwaysUp || times.alwaysDown) {
        let dPrev = new Date(targetDate);
        dPrev.setUTCDate(targetDate.getUTCDate() - 1);
        let pTimes = SunCalc.getMoonTimes(dPrev, lat, lon);

        let dNext = new Date(targetDate);
        dNext.setUTCDate(targetDate.getUTCDate() + 1);
        let nTimes = SunCalc.getMoonTimes(dNext, lat, lon);

        if (!isValidDate(rise) || rise < startDay || rise > endDay) {
            if (isValidDate(pTimes.rise) && pTimes.rise >= startDay && pTimes.rise <= endDay) rise = pTimes.rise;
            else if (isValidDate(nTimes.rise) && nTimes.rise >= startDay && nTimes.rise <= endDay) rise = nTimes.rise;
            else if (isValidDate(pTimes.rise)) rise = pTimes.rise;
            else if (isValidDate(nTimes.rise)) rise = nTimes.rise;
        }

        if (!isValidDate(set) || set < startDay || set > endDay) {
            if (isValidDate(pTimes.set) && pTimes.set >= startDay && pTimes.set <= endDay) set = pTimes.set;
            else if (isValidDate(nTimes.set) && nTimes.set >= startDay && nTimes.set <= endDay) set = nTimes.set;
            else if (isValidDate(pTimes.set)) set = pTimes.set;
            else if (isValidDate(nTimes.set)) set = nTimes.set;
        }
    }
    return { rise: rise, set: set, alwaysUp: times.alwaysUp, alwaysDown: times.alwaysDown };
}

function updateSunClock(lat, lon) {
    if (isTimezoneOnlyMode) return;

    const baseOffset = getBaseLocationOffset();
    let utcCalculationDate = new Date(selectedDate.getTime() - (baseOffset * 3600000));
    utcCalculationDate.setUTCHours(12, 0, 0, 0);

    cachedTimes = SunCalc.getTimes(utcCalculationDate, lat, lon);
    cachedMoonTimes = getCompleteMoonTimes(utcCalculationDate, lat, lon);
    cachedMoonIllumination = (typeof SunCalc.getMoonData === 'function') ? SunCalc.getMoonData(utcCalculationDate) : SunCalc.getMoonIllumination(utcCalculationDate);

    ctx.clearRect(0, 0, 500, 500);

    drawSunSlicesSafe(cachedTimes);
    drawMoonVisibilityArc(cachedMoonTimes, selectedDate);
    drawSolarMeridianLines(cachedTimes);
    drawMinuteRingSafe();
    drawClockNumbers();
    updatePageBackground(cachedTimes);

    updateMoonDigitalPanel(cachedMoonIllumination, cachedMoonTimes);

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
    adaptBottomPanelHeight();
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
    if (moonTimes.alwaysUp) {
        ctx.save();
        ctx.beginPath();
        let arcRadius = radius - 7;
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#64748b';
        ctx.arc(cx, cy, arcRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return;
    }

    if (!isValidDate(moonTimes.rise) || !isValidDate(moonTimes.set)) return;

    let startH = timeToHours(moonTimes.rise);
    let endH = timeToHours(moonTimes.set);

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
        utcCalculationDate.setUTCHours(12, 0, 0, 0);
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

    styleStripButtonVisibility(document.getElementById('btn-toggle-year-strip'), isStripOpen);

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
        utcCalculationDate.setUTCHours(12, 0, 0, 0);
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

function drawRealisticMoon(canvasId, illumination, size = 32) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    canvas.width = size;
    canvas.height = size;

    const ctxMoon = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const r = width / 2 - (size > 50 ? 1 : 2);
    const cxCenter = width / 2;
    const cyCenter = height / 2;
    const tau = Math.PI * 2;

    ctxMoon.clearRect(0, 0, width, height);

    ctxMoon.save();
    ctxMoon.beginPath();
    ctxMoon.arc(cxCenter, cyCenter, r, 0, tau);
    ctxMoon.closePath();
    ctxMoon.clip();

    if (realMoonImage.complete && realMoonImage.naturalWidth !== 0) {
        const zoomFactor = 1.55;
        const drawSize = r * 2 * zoomFactor;
        const offset = (drawSize - (r * 2)) / 2;
        ctxMoon.drawImage(realMoonImage, (cxCenter - r) - offset, (cyCenter - r) - offset, drawSize, drawSize);
    } else {
        let bgGrad = ctxMoon.createRadialGradient(cxCenter - r * 0.3, cyCenter - r * 0.3, r * 0.1, cxCenter, cyCenter, r);
        bgGrad.addColorStop(0, '#f1f5f9');
        bgGrad.addColorStop(0.4, '#cbd5e1');
        bgGrad.addColorStop(0.8, '#64748b');
        bgGrad.addColorStop(1, '#334155');
        ctxMoon.fillStyle = bgGrad;
        ctxMoon.fillRect(0, 0, width, height);
    }

    if (illumination && typeof illumination.phase !== 'undefined') {
        const phase = illumination.phase;
        const d = r * Math.cos(phase * tau);

        ctxMoon.fillStyle = 'rgba(0, 0, 0, 0.88)';
        ctxMoon.beginPath();

        const isWaxing = phase <= 0.5;
        ctxMoon.arc(cxCenter, cyCenter, r, -Math.PI / 2, Math.PI / 2, isWaxing);

        let outerRx = Math.abs(d);
        let sweepFlag = (d >= 0) === isWaxing;
        ctxMoon.ellipse(cxCenter, cyCenter, outerRx, r, 0, Math.PI / 2, -Math.PI / 2, sweepFlag);

        ctxMoon.closePath();
        ctxMoon.fill();
    }

    ctxMoon.restore();

    if (size <= 50) {
        ctxMoon.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctxMoon.lineWidth = 1.5;
        ctxMoon.beginPath();
        ctxMoon.arc(cxCenter, cyCenter, r, 0, tau);
        ctxMoon.stroke();
    }
}

function toggleMoonModal(show) {
    const modal = document.getElementById('modal-moon');
    if (modal) {
        modal.style.display = show ? 'flex' : 'none';
        if (show && cachedMoonIllumination && cachedMoonTimes) {
            updateMoonDigitalPanel(cachedMoonIllumination, cachedMoonTimes);
        }
    }
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

    if (phaseNameEl) phaseNameEl.innerText = `${phaseName} (${Math.round(illumination.fraction * 100)}%)`;
    if (riseEl) riseEl.innerText = isValidDate(moonTimes.rise) ? formatTime(moonTimes.rise) : "--:--";
    if (setEl) setEl.innerText = isValidDate(moonTimes.set) ? formatTime(moonTimes.set) : "--:--";

    drawRealisticMoon('moon-canvas', illumination, 24);
    drawRealisticMoon('moon-clock-canvas', illumination, 32);
    drawRealisticSun('sun-clock-canvas');

    drawRealisticMoon('big-moon-canvas', illumination, 140);

    const bigTitleEl = document.getElementById('big-moon-phase-title');
    const bigDateEl = document.getElementById('big-moon-date-display');
    if (bigTitleEl) {
        bigTitleEl.innerText = `${phaseName} (${Math.round(illumination.fraction * 100)}%)`;
        bigTitleEl.style.fontSize = '1.15rem';
        bigTitleEl.style.fontWeight = 'bold';
    }
    if (bigDateEl && selectedDate) {
        const dStr = `${String(selectedDate.getUTCDate()).padStart(2, '0')}/${String(selectedDate.getUTCMonth() + 1).padStart(2, '0')}/${selectedDate.getUTCFullYear()}`;
        const tStr = `${String(selectedDate.getUTCHours()).padStart(2, '0')}:${String(selectedDate.getUTCMinutes()).padStart(2, '0')}`;
        bigDateEl.innerText = `${dStr} - ${tStr}`;
        bigDateEl.style.fontSize = '1.15rem';
        bigDateEl.style.fontWeight = 'bold';
        bigDateEl.style.color = '#f8fafc';
    }
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
    if (!tbody) return;

    if (isTimezoneOnlyMode) {
        tbody.innerHTML = `
            <tr style="background: #7f1d1d; color: #facc15;"><td colspan="2"><b>☀️ Dati Solari e Crepuscoli</b></td></tr>
            <tr style="background: #000000; color: #ffffff;"><td>Mezzanotte solare</td><td>----</td></tr>
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

            <tr style="background: #7f1d1d; color: #facc15;"><td colspan="2"><b>🌙 Dati Lunari</b></td></tr>
            <tr style="background: rgba(30, 41, 59, 0.9); color: #ffffff;"><td>Fase Lunare</td><td>----</td></tr>
            <tr style="background: rgba(30, 41, 59, 0.9); color: #ffffff;"><td>Sorge (luna):</td><td><b>----</b></td></tr>
            <tr style="background: rgba(30, 41, 59, 0.9); color: #ffffff;"><td>Tramonta (luna):</td><td><b>----</b></td></tr>
        `;
        return;
    }

    const phasePct = illumination ? Math.round(illumination.fraction * 100) : 0;

    const events = [
        { name: "Mezzanotte solare", date: times.nadir, bg: "#000000" },
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
        <tr style="background: #7f1d1d; color: #facc15;"><td colspan="2"><b>☀️ Dati Solari e Crepuscoli</b></td></tr>
        ${solarRowsHtml}

        <tr style="background: #7f1d1d; color: #facc15;"><td colspan="2"><b>🌙 Dati Lunari</b></td></tr>
        <tr style="background: rgba(30, 41, 59, 0.9); color: #ffffff;"><td>Fase Lunare</td><td>${phasePct}% illuminata</td></tr>
        <tr style="background: rgba(30, 41, 59, 0.9); color: #ffffff;"><td>Sorge (luna):</td><td><b>${moonTimes ? formatTime(moonTimes.rise) : '----'}</b></td></tr>
        <tr style="background: rgba(30, 41, 59, 0.9); color: #ffffff;"><td>Tramonta (luna):</td><td><b>${moonTimes ? formatTime(moonTimes.set) : '----'}</b></td></tr>
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

    let moonEquivalentHour = h;
    if (cachedMoonIllumination && typeof cachedMoonIllumination.phase !== 'undefined') {
        let phaseOffsetHours = cachedMoonIllumination.phase * 24;
        moonEquivalentHour = (h + phaseOffsetHours) % 24;
    }

    const moonDeg = (moonEquivalentHour / 24) * 360 - 180;
    document.getElementById('hand-moon').style.transform = `rotate(${moonDeg}deg)`;

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
