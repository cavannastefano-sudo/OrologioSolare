Timezone manager 

/**
 * =========================================================
 * SunClock24 - Timezone & DST Manager
 * Gestisce la rilevazione automatica o manuale dell'ora legale
 * =========================================================
 */

// Inizializza o recupera le impostazioni
if (localStorage.getItem('sunclock_auto_dst') === null) {
    localStorage.setItem('sunclock_auto_dst', 'true'); // Di default è AUTOMATICO
}

/**
 * Rileva se un fuso orario specifico ha l'ora legale attiva in una determinata data
 * @param {string} timeZone - Es: "Europe/Rome"
 * @param {Date} date - La data da controllare (default: adesso)
 * @returns {boolean}
 */
function isDSTInTimeZone(timeZone, date = new Date()) {
    try {
        const getOffset = (d, tz) => {
            const formatOption = { timeZone: tz, timeZoneName: 'shortOffset' };
            const parts = new Intl.DateTimeFormat('en-US', formatOption).formatToParts(d);
            const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
            
            // Supporta correttamente anche i fusi con i minuti (es. +05:30)
            const match = tzPart.match(/GMT([+-]\d+)(?::(\d+))?/);
            if (!match) return 0;
            const hours = parseInt(match[1], 10);
            const minutes = match[2] ? parseInt(match[2], 10) / 60 : 0;
            return hours >= 0 ? hours + minutes : hours - minutes;
        };

        const currentOffset = getOffset(date, timeZone);
        const janOffset = getOffset(new Date(date.getFullYear(), 0, 1), timeZone);
        const julOffset = getOffset(new Date(date.getFullYear(), 6, 1), timeZone);

        const maxOffset = Math.max(janOffset, julOffset);
        return currentOffset === maxOffset && janOffset !== julOffset;
    } catch (e) {
        console.warn("Errore calcolo TimeZone, fallback a controllo standard:", e);
        return false;
    }
}

/**
 * Calcola se l'ora legale (+1h) deve essere applicata
 * @param {number} lat - Latitudine
 * @param {number} lon - Longitudine
 * @param {Date} currentDate - Data corrente per il calcolo
 * @returns {boolean} - True se bisogna aggiungere +1h
 */
function getEffectiveDST(lat, lon, currentDate = new Date()) {
    const isAuto = localStorage.getItem('sunclock_auto_dst') === 'true';

    // Se l'utente ha scelto MANUAL, usa il valore del checkbox manuale
    if (!isAuto) {
        return localStorage.getItem('sunclock_dst') === 'true';
    }

    // Se è AUTOMATICO, calcola in base alle coordinate
    try {
        const lookupFn = typeof tzlookup === 'function' ? tzlookup : (typeof tz === 'function' ? tz : null);
        if (lookupFn && lat !== undefined && lon !== undefined) {
            const timeZone = lookupFn(lat, lon);
            if (timeZone) {
                return isDSTInTimeZone(timeZone, currentDate);
            }
        }
    } catch (err) {
        console.error("Impossibile determinare il fuso orario automatico:", err);
    }

    // Fallback di sicurezza: se la libreria non trova il fuso, usa il flag salvato
    return localStorage.getItem('sunclock_dst') === 'true';
}
