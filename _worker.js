importScripts('https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.min.js');

self.onmessage = function(e) {
    const { lat, lon, dateStr } = e.data;
    try {
        const observer = new Astronomy.Observer(lat, lon, 0);
        const baseDate = new Date(dateStr);
        baseDate.setHours(0, 0, 0, 0);

        let slices = [];
        for (let i = 0; i < 1440; i += 2) {
            const fraction = i / 1440;
            const checkDate = new Date(baseDate.getTime() + fraction * 86400000);
            const astroTime = Astronomy.MakeTime(checkDate);
            const eq = Astronomy.Equator(Astronomy.Body.Sun, astroTime, observer, true, true);
            const hor = Astronomy.Horizon(astroTime, observer, eq.right_ascension, eq.declination, "normal");

            slices.push({ fraction, altitude: hor.altitude });
        }

        // Calcola anche eventi chiave
        const sunTimes = {
            solarNoon: Astronomy.SearchSunEvent(Astronomy.SunEvent.Noon, baseDate).time.date,
            midnight: Astronomy.SearchSunEvent(Astronomy.SunEvent.Midnight, baseDate).time.date
        };

        self.postMessage({ status: 'success', slices, sunTimes });
    } catch (err) {
        self.postMessage({ status: 'error', message: err.toString() });
    }
};
