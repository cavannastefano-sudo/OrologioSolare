/**
 * =========================================================
 * SunClock24 - Timezone & DST Manager
 * Gestisce la rilevazione automatica o manuale dell'ora legale
 * =========================================================
 */

if (localStorage.getItem('sunclock_auto_dst') === null) {
    localStorage.setItem('sunclock_auto_dst', 'true');
}

/**
 * Rileva se un fuso orario specifico ha l'ora legale attiva in una determinata data
 * @param {string} timeZone - Es: "Europe/Rome"
 * @param {Date} date - La data da controllare
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
        console.warn("Errore calcolo TimeZone DST:", e);
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

    if (!isAuto) {
        return localStorage.getItem('sunclock_dst') === 'true';
    }

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

    return localStorage.getItem('sunclock_dst') === 'true';
}
