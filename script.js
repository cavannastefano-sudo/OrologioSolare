/*
	Sun Clock (Aggiornato con Lancette Complete e Fotorealistiche)
*/

/* jshint esversion: 6 */
/* globals $, $All, debug, App, SunCalendar, SunCalc */

const SunClock = (function() {
	'use strict';

	const tau = 2 * Math.PI;
	const radius = 130;

	let now, then, timerStart;
	let hours, minutes, seconds;
	let hourHand, minuteHand, secondHand;
	let clockIconHours, clockIconMinutes;
	let sunTimes, sunPosition, noonPosition, nadirPosition, sunAlwaysUp, sunAlwaysDown;
	let periodsTemp, currentPeriod, nextPeriodTime;
	let moonTimes, moonPosition, moonPhase, moonHand, moonIcon, moonPath;

	const periods = [
		// name:                        from:               to:                 color:		darkColor:
		['earlyMorning',                'nadir',            'nightEnd',         '#192029',	'#030303'],
		['astronomicalMorningTwilight', 'nightEnd',         'nauticalDawn',     '#213c66',	'#101d33'],
		['nauticalMorningTwilight',     'nauticalDawn',     'dawn',             '#4574bc',	'#325489'],
		['civilMorningTwilight',        'dawn',             'sunrise',          '#88a6d4',	'#677ea1'],
		['sunrise',                     'sunrise',          'sunriseEnd',       '#ff9900',	'#cc7a00'],
		['morningGoldenHour',           'sunriseEnd',       'goldenHourEnd',    '#ffe988',	'#ccba6c'],
		['morning',                     'goldenHourEnd',    'solarNoon',        '#dceaff', 	'#b0bbcc'],
		['afternoon',                   'solarNoon',        'goldenHour',       '#dceaff',	'#b0bbcc'],
		['eveningGoldenHour',           'goldenHour',       'sunsetStart',      '#ffe988',	'#ccba6c'],
		['sunset',                      'sunsetStart',      'sunset',           '#ff9900',	'#cc7a00'],
		['civilEveningTwilight',        'sunset',           'dusk',             '#88a6d4',	'#677ea1'],
		['nauticalEveningTwilight',     'dusk',             'nauticalDusk',     '#4574bc',	'#325489'],
		['astronomicalEveningTwilight', 'nauticalDusk',     'night',            '#213c66',	'#101d33'],
		['lateEvening',                 'night',            'nadir2',           '#192029',	'#030303']
	];
	const textReplacements = {
		'nadir' : 'Solar Midnight',
		'earlyMorning' : 'Early Morning',
		'nightEnd' : 'Astronomical Dawn',
		'astronomicalMorningTwilight' : 'Astronomical Morning Twilight',
		'nauticalDawn' : 'Nautical Dawn',
		'nauticalMorningTwilight' : 'Nautical Morning Twilight',
		'dawn' : 'Civil Dawn',
		'civilMorningTwilight' : 'Civil Morning Twilight',
		'sunrise' : 'Sunrise',
		'sunriseEnd' : 'End of Sunrise',
		'morningGoldenHour' : 'Morning Golden Hour',
		'goldenHourEnd' : 'End of Golden Hour',
		'morning' : 'Morning',
		'solarNoon' : ' Solar Noon',
		'afternoon' : 'Afternoon',
		'goldenHour' : 'Start of Golden Hour',
		'eveningGoldenHour' : 'Evening Golden Hour',
		'sunsetStart' : 'Beginning of Sunset',
		'sunset' : 'Sunset',
		'civilEveningTwilight' : 'Civil Evening Twilight',
		'dusk' : 'Civil Dusk',
		'nauticalEveningTwilight' : 'Nautical Evening Twilight',
		'nauticalDusk' : 'Nautical Dusk',
		'astronomicalEveningTwilight' : 'Astronomical Evening Twilight',
		'night' : 'Astronomical Dusk',
		'lateEvening' : 'Late Evening',
		'nadir2' : 'Solar Midnight'
	};

	function toDegrees(angle) {
		return (angle / tau * 360);
	}

	function convertAzimuth(angle) {
		return ((360 + 180 + toDegrees(angle)) % 360);
	}

	function getPointFromTime(date) {
		let nowOffset = now.getTimezoneOffset();
		let dateOffset = date.getTimezoneOffset();
		let direction = App.settings.direction;
		var angle = ((date.getHours() + date.getMinutes()/60 + (dateOffset-nowOffset)/60 + date.getSeconds()/3600) / 24 * tau);
		return `${Math.sin(angle) * radius * -direction}, ${Math.cos(angle) * radius}`;
	}

	function getEarlier(time) {
		return new Date(time.valueOf() - 86400000);
	}
	function getLater(time) {
		return new Date(time.valueOf() + 86400000);
	}

	function getSunTimes() {
		let location = App.settings.location;
		if (!location) { return; }

		sunTimes = null;
		sunTimes = SunCalc.getTimes(now, location.latitude, location.longitude, 0);
		sunTimes.nadir2 = SunCalc.getTimes(getLater(sunTimes.solarNoon), location.latitude, location.longitude, 0).nadir;

		while (now < sunTimes.nadir) {
			sunTimes = SunCalc.getTimes(getEarlier(sunTimes.solarNoon), location.latitude, location.longitude, 0);
			sunTimes.nadir2 = SunCalc.getTimes(getLater(sunTimes.solarNoon), location.latitude, location.longitude, 0).nadir;
		}
		while (now > sunTimes.nadir2) {
			sunTimes = SunCalc.getTimes(getLater(sunTimes.solarNoon), location.latitude, location.longitude, 0);
			sunTimes.nadir2 = SunCalc.getTimes(getLater(sunTimes.solarNoon), location.latitude, location.longitude, 0).nadir;
		}

		noonPosition  = SunCalc.getPosition(sunTimes.solarNoon, location.latitude, location.longitude);
		nadirPosition = SunCalc.getPosition(sunTimes.nadir, location.latitude, location.longitude);
		sunAlwaysUp   = (toDegrees(nadirPosition.altitude) > -0.833) ? true : false;
		sunAlwaysDown = (toDegrees(noonPosition.altitude)  < -0.833) ? true : false;

		writeMainTimes();
		writeAllTimes();
		drawTimePeriods();
		if (App.settings.colorScheme === 'dynamic') { updateDynamicTheme(); }
	}

	function clearSunTimes() {
		sunTimes = null;
		clearTimePeriods();
		if (App.settings.colorScheme === 'dynamic') { updateDynamicTheme(); }
	}

	function writeMainTimes() {
		let subset = ['sunrise', 'solarNoon', 'sunset'];
		if (!sunTimes) { return; }

		$('#mainTimes').innerHTML = '';
		for (let i=0; i<subset.length; i++) {
			$('#mainTimes').innerHTML += `${textReplacements[subset[i]]}: <span class="nobr">${App.formatTime(sunTimes[subset[i]])}</span><br>`;
		}
		$('#mainTimes').innerHTML += (sunAlwaysUp)   ? 'Sun is above horizon all day' : '';
		$('#mainTimes').innerHTML += (sunAlwaysDown) ? 'Sun is below horizon all day' : '';
	}

	function writeAllTimes() {
		let p;
		$('#allTimes table tbody').innerHTML = '';
		for (let i=0; i<periods.length; i++) {
			p = periods[i][1];
			$('#allTimes table tbody').innerHTML += `<tr><td>${textReplacements[p]}</td><td>${App.formatAllTimes(sunTimes[p])}</td></tr>`;
		}
		$('#allTimes table tbody').innerHTML += `<tr><td>${textReplacements.nadir2}</td><td>${App.formatAllTimes(sunTimes[nadir2])}</td></tr>`;
	}

	function clearTimePeriods() {
		let arcs = $('#arcs');
		while (arcs.firstChild) {
			arcs.removeChild(arcs.firstChild);
		}
		$('#noon').setAttribute('d','M 0,0 L 0,0');
		$('#midnight').setAttribute('d','M 0,0 L 0,0');
	}

	function drawTimePeriods() {
		let p, t1, t2, point1, point2, path;
		let validTimeCount = 0;
		let direction = App.settings.direction;

		if (!sunTimes) { return; }

		clearTimePeriods();
		periodsTemp = JSON.parse(JSON.stringify(periods));

		for (let i=0; i<periodsTemp.length; i++) {
			p = periodsTemp[i];
			t1 = Date.parse(sunTimes[p[1]]);
			t2 = Date.parse(sunTimes[p[2]]);
			if (!isNaN(t1)) validTimeCount++;

			if ( isNaN(t1) && isNaN(t2) ) {
				continue;
			} else if ( isNaN(t1) ) {
				if (i === 6)  continue;
				if (i === 13) continue;
				p[1] = (i <= 6) ? 'nadir' : 'solarNoon';
			} else if ( isNaN(t2) ) {
				if (i === 0) continue;
				if (i === 7) continue;
				p[2] = (i <= 6) ? 'solarNoon' : 'nadir2';
			}
		}

		if (validTimeCount <= 3) {
			let pT = periodsTemp;
			let alt1 = toDegrees(noonPosition.altitude);
			let alt2 = toDegrees(nadirPosition.altitude);
			let alt  = (alt1 + alt2) / 2;
			let pt1, pt2;

			if (alt >= 6) {
				pt1 = 6; pt2 = 7;
			} else if ((alt < 6) && (alt >= -0.3)) {
				pt1 = 5; pt2 = 8;
			} else if ((alt < -0.3) && (alt >= -0.833)) {
				pt1 = 4; pt2 = 9;
			} else if ((alt <= -0.833) && (alt > -6)) {
				pt1 = 3; pt2 = 10;
			} else if ((alt <= -6) && (alt > -12)) {
				pt1 = 2; pt2 = 11;
			} else if ((alt <= -12) && (alt > -18)) {
				pt1 = 1; pt2 = 12;
			} else if (alt <= -18) {
				pt1 = 0; pt2 = 13;
			}
			pT[pt1][1] = 'nadir';
			pT[pt1][2] = 'solarNoon';
			pT[pt2][1] = 'solarNoon';
			pT[pt2][2] = 'nadir2';
		}

		for (let i=0; i<periodsTemp.length; i++) {
			p = periodsTemp[i];
			t1 = Date.parse(sunTimes[p[1]]);
			t2 = Date.parse(sunTimes[p[2]]);

			if ( isNaN(t1) || isNaN(t2) ) {
				continue;
			} else {
				point1 = getPointFromTime(sunTimes[p[1]]);
				point2 = getPointFromTime(sunTimes[p[2]]);
				path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
				path.setAttribute('id', p[0]);
				path.setAttribute('cursor', 'crosshair');
				path.setAttribute('d',`M 0,0 L ${point1} A ${radius} ${radius} 0 0 ${(direction>0) ? 1 : 0} ${point2} z`);
				$('#arcs').appendChild(path);

				App.showInfoOnHover(path, getPeriodInfo, i);
			}
		}

		$('#noon').setAttribute('d',`M 0,0 L ${getPointFromTime(sunTimes.solarNoon)}`);
		$('#midnight').setAttribute('d',`M 0,0 L ${getPointFromTime(sunTimes.nadir2)}`);
	}

	function getCurrentTimePeriod() {
		let t0, t1, t2, p;
		t0 = now.valueOf();

		for (let i=0; i<periodsTemp.length; i++) {
			p = periodsTemp[i];
			t1 = Date.parse(sunTimes[p[1]]);
			t2 = Date.parse(sunTimes[p[2]]);

			if ((isNaN(t1)) || (isNaN(t2))) {
				continue;
			} else if ((t0 > t1) && (t0 < t2)) {
				currentPeriod = i;
				break;
			}
		}
	}

	function getPeriodInfo(i) {
		let p = periodsTemp[i];
		return `<h3>${textReplacements[p[0]]}</h3>
			<p>${textReplacements[p[1]]}<br><span class="nobr">${App.formatTime(sunTimes[p[1]])}</span></p>
			<p class="to">— to —</p>
			<p>${textReplacements[p[2]]}<br><span class="nobr">${App.formatTime(sunTimes[p[2]])}</span></p>`;
	}

	function getSunInfo() {
		let location = App.settings.location;
		let str = '';
		if (!location) { return str; }

		sunPosition = SunCalc.getPosition(now, location.latitude, location.longitude);
		if (sunPosition) {
			str = `<h3>Sun</h3>
				<p>Altitude: ${toDegrees(sunPosition.altitude).toFixed(2)}°<br>
				Azimuth:  ${convertAzimuth(sunPosition.azimuth).toFixed(2)}°</p>
				<p>Altitude at:<br>
				noon: ${toDegrees(noonPosition.altitude).toFixed(2)}°<br>
				midnight: ${toDegrees(nadirPosition.altitude).toFixed(2)}°</p>`;
		}
		return str;
	}

	function getMoonPhase() {
		moonPhase = SunCalc.getMoonIllumination(now);
		// Aggiorna l'icona SVG della luna con il design fotorealistico/ombra corretta
		if ($('#moonIcon')) {
			$('#moonIcon').innerHTML = drawRealisticMoonSVG(moonPhase);
		}
	}

	// Generazione SVG fotorealistico della fase lunare per l'icona e la lancetta
	function drawRealisticMoonSVG(illumination) {
		let r = 12; // raggio dell'icona SVG
		let phase = illumination.phase;
		let fraction = illumination.fraction;

		if (fraction < 0.01) fraction = 0;
		if (fraction > 0.99) fraction = 1;

		let svgContent = `
			<defs>
				<radialGradient id="moonGrad" cx="35%" cy="35%" r="65%">
					<stop offset="0%" stop-color="#f1f5f9" />
					<stop offset="40%" stop-color="#cbd5e1" />
					<stop offset="80%" stop-color="#64748b" />
					<stop offset="100%" stop-color="#334155" />
				</radialGradient>
			</defs>
			<circle cx="0" cy="0" r="${r}" fill="url(#moonGrad)" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" />
		`;

		if (fraction > 0 && fraction < 1) {
			let angle = phase * tau;
			let rx = r * Math.abs(Math.cos(angle));
			let sweep1 = (phase < 0.50) ? 0 : 1;
			let sweep2 = (phase < 0.50) ? 1 : 0;

			svgContent += `
				<path d="M 0 ${-r} A ${r} ${r} 0 0 ${sweep1} 0 ${r} A ${rx} ${r} 0 0 ${sweep2} 0 ${-r} Z" fill="rgba(2, 6, 23, 0.92)" />
			`;
		} else if (fraction === 0) {
			svgContent += `<circle cx="0" cy="0" r="${r}" fill="rgba(2, 6, 23, 0.98)" />`;
		}

		return svgContent;
	}

	function getMoonPhaseName(phaseVal) {
		const moons = [
			['New Moon',        '🌑'],
			['Waxing Crescent', '🌒'],
			['First Quarter',   '🌓'],
			['Waxing Gibbous',  '🌔'],
			['Full Moon',       '🌕'],
			['Waning Gibbous',  '🌖'],
			['Last Quarter',    '🌗'],
			['Waning Crescent', '🌘']
		];
		const d = 0.0167;
		let i = 0;
		if ((phaseVal > 0.0 + d) && (phaseVal < 0.25 - d)) {
			i = 1;
		} else if ((phaseVal >= 0.25 - d) && (phaseVal <= 0.25 + d)) {
			i = 2;
		} else if ((phaseVal > 0.25 + d) && (phaseVal < 0.50 - d)) {
			i = 3;
		} else if ((phaseVal >= 0.50 - d) && (phaseVal <= 0.50 + d)) {
			i = 4;
		} else if ((phaseVal > 0.50 + d) && (phaseVal < 0.75 - d)) {
			i = 5;
		} else if ((phaseVal >= 0.75 - d) && (phaseVal <= 0.75 + d)) {
			i = 6;
		} else if ((phaseVal > 0.75 + d) && (phaseVal < 1.0 - d)) {
			i = 7;
		}
		return {'index':i, 'name':moons[i][0], 'icon':moons[i][1]};
	}

	function getMoonInfo() {
		let location = App.settings.location;
		let illumination = SunCalc.getMoonIllumination(now);
		let str = `<h3>Moon</h3>
			<p>${getMoonPhaseName(illumination.phase).name} (${Math.round(illumination.fraction * 100)}% illuminated)</p>`;

		if (location) {
			moonTimes = SunCalc.getMoonTimes(now, location.latitude, location.longitude);
			moonPosition = SunCalc.getMoonPosition(now, location.latitude, location.longitude);

			if (moonTimes) {
				if ((moonTimes.rise) && (moonTimes.set)) {
					if (moonTimes.rise <= moonTimes.set) {
						str += `<p>Rises: <span class="nobr">${App.formatTime(moonTimes.rise)}</span><br>Sets: <span class="nobr">${App.formatTime(moonTimes.set)}</span></p>`;
					} else {
						str += `<p>Sets: <span class="nobr">${App.formatTime(moonTimes.set)}</span><br>Rises: <span class="nobr">${App.formatTime(moonTimes.rise)}</span></p>`;
					}
				} else if (moonTimes.rise) {
					str += `<p>Rises: <span class="nobr">${App.formatTime(moonTimes.rise)}</span></p>`;
				} else if (moonTimes.set) {
					str += `<p>Sets: <span class="nobr">${App.formatTime(moonTimes.set)}</span></p>`;
				} else if (moonTimes.alwaysUp) {
					str += '<p>Moon is up all day</p>';
				} else if (moonTimes.alwaysDown) {
					str += '<p>Moon is down all day</p>';
				}
			}
			if (moonPosition) {
				str += `
					<p>Altitude: ${toDegrees(moonPosition.altitude).toFixed(2)}°<br>
					Azimuth:  ${convertAzimuth(moonPosition.azimuth).toFixed(2)}°</p>`;
			}
		}
		return str;
	}

	function drawMarks2(parent, n, q, length) {
		var m;
		for (let i=0; i<=(n-1); i++) {
			if ((i%q === 0)) { continue; }
			m = document.createElementNS('http://www.w3.org/2000/svg', 'line');
			m.setAttribute('x1', 0);
			m.setAttribute('y1', 0);
			m.setAttribute('x2', 0);
			m.setAttribute('y2', length);
			m.setAttribute('transform', `rotate(${i * (360/n)}) translate(0,${radius})`);
			$(parent).appendChild(m);
		}
	}

	function drawMarks() {
		drawMarks2('#hourMarks',  24, 0, -4);
		drawMarks2('#hourMarks2', 24, 2, -8);
		drawMarks2('#minuteMarks', 60, 0, 6);
	}

	function pad2(n) {
		return (n < 10) ? ('0' + n) : n;
	}

	function drawNumbers2(parent, n, m, offset, startAtTop, vertical, zeroPad) {
		let g, angle, str;
		let p = $(parent);
		let h = parseInt(p.getAttribute('font-size'));
		let angleOffset = startAtTop ? 180 : 0;
		let direction = App.settings.direction;

		while (p.firstChild) {
			p.removeChild(p.firstChild);
		}

		for (let i=0; i<=n; i+=m) {
			if (i===0) { continue; }
			g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
			g.setAttribute('x', 0);
			g.setAttribute('y', 0);
			angle = ((i * direction * (360/n) + angleOffset + 360) % 360);
			g.setAttribute('transform', `rotate(${angle}) translate(0,${radius + h * offset})`);

			if ((parent === '#hourNumbers') && App.settings.hour12) {
				let j = i;
				if (i>12) { j = i-12; }
				str = zeroPad ? pad2(j) : j;
			} else {
				str = zeroPad ? pad2(i) : i;
			}

			if (vertical) {
				g.innerHTML = `<circle cx="0" cy="0" r="${(h*0.833)}" fill="rgba(255,255,255,0.33)" stroke="none" />`;
				g.innerHTML += `<text x="0" y="${(h*0.375)}" transform="rotate(${angle*-1})">${str}</text>`;
			} else {
				if ((angle >= 90) && (angle <= 270)) {
					g.innerHTML = `<text x="0" y="0" transform="rotate(180)">${str}</text>`;
				} else {
					g.innerHTML = `<text x="0" y="${(h*0.75)}" transform="rotate(0)">${str}</text>`;
				}
			}
			p.appendChild(g);
		}
	}

	function drawNumbers() {
		drawNumbers2('#hourNumbers',   24, 1, -1.5, false, true, false);
		drawNumbers2('#minuteNumbers', 60, 5, 0.25, true,  false, true);
	}

	function updateDirection() {
		drawNumbers();
		if (sunTimes) { drawTimePeriods(); }
	}

	function clearDynamicTheme() {
		document.documentElement.setAttribute("data-theme", 'light');
		document.documentElement.style.backgroundColor = '';
		document.body.style.backgroundColor = '';
		$All('section.overlay').forEach((o) => { o.style.backgroundColor = ''; });

		$('#hourNumbers').style.fill   = '';
		$('#minuteNumbers').style.fill = '';
	}

	function RGBtoRGBA(s, a) {
		let s2 = ', ' + a + ')';
		return s.replace(')', s2);
	}

	function updateDynamicTheme() {
		if (App.settings.colorScheme !== 'dynamic') { return; }

		clearDynamicTheme();

		if (sunTimes) {
			getCurrentTimePeriod();
			let p = periods[currentPeriod];
			let isDark = ((currentPeriod <= 2) || (currentPeriod >= 11)) ? true : false;

			if (isDark) {
				document.documentElement.setAttribute("data-theme", 'dark');
				document.documentElement.style.backgroundColor = p[4];
				document.body.style.backgroundColor = p[4];
				$('#hourNumbers').style.fill   = '#222';
				$('#minuteNumbers').style.fill = '#222';
			} else {
				document.documentElement.style.backgroundColor = p[3];
				document.body.style.backgroundColor = p[3];
			}

			$All('section.overlay').forEach((o) => {
				o.style.backgroundColor = RGBtoRGBA(document.body.style.backgroundColor, 0.9);
			});

			nextPeriodTime = sunTimes[p[2]];
		}
	}

	function writeDate() {
		$('#dateText').innerHTML = `${now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
	}

	function tick(timestamp) {
		let direction = App.settings.direction;
		now = new Date();

		seconds = now.getSeconds() + (now.getMilliseconds())/1000;
		if (!App.settings.sweepHand) { seconds = Math.round(seconds); }
		minutes = now.getMinutes() + seconds/60;
		hours   = now.getHours()   + minutes/60;

		// Movimento delle lancette dell'orologio riattivato e sincronizzato
		if (secondHand) secondHand.setAttribute('transform', `rotate(${ seconds * direction * 6 })`);
		if (minuteHand) minuteHand.setAttribute('transform', `rotate(${ minutes * direction * 6 })`);
		if (hourHand)   hourHand.setAttribute('transform',   `rotate(${ hours  * direction * 15 })`);

		// Lancetta e posizione della Luna sincronizzate tramite SunCalc
		if (moonHand && App.settings.location) {
			let illumination = SunCalc.getMoonIllumination(now);
			let moonPos = SunCalc.getMoonPosition(now, App.settings.location.latitude, App.settings.location.longitude);
			let sunPos = SunCalc.getPosition(now, App.settings.location.latitude, App.settings.location.longitude);
			
			let diffAzimuth = moonPos.azimuth - sunPos.azimuth;
			let moonHourOffset = (diffAzimuth / tau) * 24;
			let moonEquivalentHour = (hours + moonHourOffset) % 24;
			if (moonEquivalentHour < 0) moonEquivalentHour += 24;

			let moonDeg = (moonEquivalentHour / 24) * 360 - 180;
			moonHand.setAttribute('transform', `rotate(${moonDeg * direction})`);
		}

		if (moonIcon) moonIcon.setAttribute('transform', `translate(0 80) rotate(${90 + direction * 90})`);

		if (clockIconHours)   clockIconHours.setAttribute('transform', `rotate(${ hours * direction * 15 })`);
		if (clockIconMinutes) clockIconMinutes.setAttribute('transform', `rotate(${ minutes * direction * 6  })`);

		if (!timerStart) { timerStart = timestamp || 0; }
		if ((timestamp - timerStart) >= 60000) {
			getMoonPhase();
			timerStart = null;
		}

		if ( then && (Math.abs(now - then) > 60000) ) {
			getMoonPhase();
			getSunTimes();
			writeDate();
			SunCalendar.update();
		}

		if ( then && (now.getDate() !== then.getDate()) ) {
			getSunTimes();
			writeDate();
		}

		if ( then && sunTimes && (now >= sunTimes.nadir2) ) {
			getSunTimes();
		}

		if ( then && (now.getTimezoneOffset() !== then.getTimezoneOffset()) ) {
			drawTimePeriods();
		}

		if ( sunTimes && (App.settings.colorScheme === 'dynamic') && (now >= nextPeriodTime) ) {
			updateDynamicTheme();
		}

		if (!then) { writeDate(); }

		then = now;
		if (App.settings.sweepHand && App.settings.showSecondHand) {
			window.requestAnimationFrame(tick);
		} else {
			now = new Date();
			setTimeout(tick, 1000 - now.getMilliseconds());
		}
	}

	function init() {
		hourHand   = $('#hourHand');
		minuteHand = $('#minuteHand');
		secondHand = $('#secondHand');
		moonHand   = $('#moonHand');
		moonIcon   = $('#moonIcon');
		moonPath   = $('#moonPath');

		clockIconHours   = $('#clockIconHours');
		clockIconMinutes = $('#clockIconMinutes');

		drawMarks();
		drawNumbers();

		getMoonPhase();
		tick();

		App.showInfoOnHover(hourHand, getSunInfo);
		App.showInfoOnHover($('#centerCircle'), getSunInfo);
		App.showInfoOnHover(moonHand, getMoonInfo);
	}

	return {
		getSunTimes,
		clearSunTimes,
		writeMainTimes,
		clearDynamicTheme,
		updateDynamicTheme,
		updateDirection,
		drawNumbers,
		drawRealisticMoonSVG,
		init
	};
})();
