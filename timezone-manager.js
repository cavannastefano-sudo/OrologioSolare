/**
 * =========================================================
 * SunClock24 - Timezone & DST Manager (Protetto e Sicuro)
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
        const getOffsetMinutes = (d, tz) => {
            const utcDate = new Date(d.toLocaleString('en-US', { timeZone: 'UTC' }));
            const tzDate = new Date(d.toLocaleString('en-US', { timeZone: tz }));
            return (tzDate - utcDate) / 60000;
        };

        const currentOffset = getOffsetMinutes(date, timeZone);
        const janOffset = getOffsetMinutes(new Date(date.getFullYear(), 0, 1), timeZone);
        const julOffset = getOffsetMinutes(new Date(date.getFullYear(), 6, 1), timeZone);

        const maxOffset = Math.max(janOffset, julOffset);
        return currentOffset === maxOffset && janOffset !== julOffset;
    } catch (e) {
        console.warn("Errore calcolo TimeZone DST, fallback a manuale:", e);
        return localStorage.getItem('sunclock_dst') === 'true';
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
    try {
        const isAuto = localStorage.getItem('sunclock_auto_dst') === 'true';

        // Se l'utente ha scelto MANUAL, usa il valore del checkbox manuale
        if (!isAuto) {
            return localStorage.getItem('sunclock_dst') === 'true';
        }

        // Validazione preventiva delle coordinate per evitare blocchi
        if (lat === undefined || lon === undefined || isNaN(lat) || isNaN(lon)) {
            return localStorage.getItem('sunclock_dst') === 'true';
        }

        // Se è AUTOMATICO, prova a calcolare in base alle coordinate
        const lookupFn = typeof tzlookup === 'function' ? tzlookup : (typeof tz === 'function' ? tz : null);
        if (lookupFn) {
            const timeZone = lookupFn(lat, lon);
            if (timeZone) {
                return isDSTInTimeZone(timeZone, currentDate);
            }
        }
    } catch (err) {
        console.warn("Impossibile determinare il fuso orario automatico in sicurezza:", err);
    }

    // Fallback di sicurezza definitivo: se qualcosa fallisce, usa il flag manuale salvato
    return localStorage.getItem('sunclock_dst') === 'true';
}
