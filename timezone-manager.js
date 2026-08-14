/* =========================================================
   SunClock24 - Timezone & DST Manager
   Gestisce la rilevazione automatica o manuale dell'ora legale
   ========================================================= */

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
        // Ottiene l'offset in minuti per la data attuale e per Gennaio (ora solare nell'emisfero Nord)
        const getOffset = (d, tz) => {
            const jan = new Date(d.getFullYear(), 0, 1);
            const jul = new Date(d.getFullYear(), 6, 1);
            
            const formatOption = { timeZone: tz, timeZoneName: 'shortOffset' };
            const parts = new Intl.DateTimeFormat('en-US', formatOption).formatToParts(d);
            const tzPart = parts.find(p => p.type === 'timeZoneName')?.value || '';
            
            // Estrae le ore di offset (es. GMT+2 -> 2)
            const match = tzPart.match(/GMT([+-]\d+)?/);
            if (!match || !match[1]) return 0;
            return parseInt(match[1], 10);
        };

        const currentOffset = getOffset(date, timeZone);
        const janOffset = getOffset(new Date(date.getFullYear(), 0, 1), timeZone);
        const julOffset = getOffset(new Date(date.getFullYear(), 6, 1), timeZone);

        // Se l'offset estivo/invernale differisce, c'è l'ora legale ed è attiva quando l'offset è maggiore
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

    // Se l'utente ha scelto MANUAL, usa il valore del vecchio checkbox
    if (!isAuto) {
        return localStorage.getItem('sunclock_dst') === 'true';
    }

    // Se è AUTOMATICO, calcola in base alle coordinate
    try {
        if (typeof tzlookup !== 'undefined' && lat !== undefined && lon !== undefined) {
            const timeZone = tzlookup(lat, lon);
            return isDSTInTimeZone(timeZone, currentDate);
        }
    } catch (err) {
        console.error("Impossibile determinare il fuso orario automatico:", err);
    }

    // Fallback: se la libreria non trova il fuso, usa il flag salvato
    return localStorage.getItem('sunclock_dst') === 'true';
}
