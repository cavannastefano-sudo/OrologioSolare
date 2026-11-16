// Funzione avanzata per disegnare la Luna con fasi corrette e realistiche (32x32)
function drawRealisticMoon(canvasId, illumination) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    canvas.width = 32;
    canvas.height = 32;
    
    const ctxMoon = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const r = width / 2 - 2;

    ctxMoon.clearRect(0, 0, width, height);

    ctxMoon.save();
    ctxMoon.beginPath();
    ctxMoon.arc(width / 2, height / 2, r, 0, Math.PI * 2);
    ctxMoon.closePath();
    ctxMoon.clip();

    // Sfondo di base luminoso della luna piena
    let bgGrad = ctxMoon.createRadialGradient(width / 2 - 5, height / 2 - 5, 2, width / 2, height / 2, r);
    bgGrad.addColorStop(0, '#f1f5f9');
    bgGrad.addColorStop(0.4, '#cbd5e1');
    bgGrad.addColorStop(0.8, '#64748b');
    bgGrad.addColorStop(1, '#334155');
    ctxMoon.fillStyle = bgGrad;
    ctxMoon.fillRect(0, 0, width, height);

    // Mari lunari
    ctxMoon.fillStyle = 'rgba(30, 41, 59, 0.55)';
    ctxMoon.beginPath(); ctxMoon.arc(width * 0.42, height * 0.38, r * 0.32, 0, Math.PI * 2); ctxMoon.fill();
    ctxMoon.beginPath(); ctxMoon.arc(width * 0.28, height * 0.55, r * 0.28, 0, Math.PI * 2); ctxMoon.fill();
    ctxMoon.beginPath(); ctxMoon.arc(width * 0.38, height * 0.25, r * 0.22, 0, Math.PI * 2); ctxMoon.fill();
    ctxMoon.beginPath(); ctxMoon.arc(width * 0.5, height * 0.7, r * 0.2, 0, Math.PI * 2); ctxMoon.fill();
    ctxMoon.beginPath(); ctxMoon.arc(width * 0.68, height * 0.55, r * 0.25, 0, Math.PI * 2); ctxMoon.fill();

    ctxMoon.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctxMoon.beginPath(); ctxMoon.arc(width * 0.6, height * 0.75, r * 0.1, 0, Math.PI * 2); ctxMoon.fill();
    ctxMoon.beginPath(); ctxMoon.arc(width * 0.35, height * 0.45, r * 0.08, 0, Math.PI * 2); ctxMoon.fill();

    let phase = illumination.phase; // 0 = Nuova, 0.25 = Primo Quarto, 0.5 = Piena, 0.75 = Ultimo Quarto
    let cosineValue = Math.cos(2 * Math.PI * phase);
    let isWaxing = phase < 0.5; // Crescente vs Calante

    ctxMoon.save();
    ctxMoon.fillStyle = 'rgba(2, 6, 23, 0.95)'; // Ombra scura
    ctxMoon.beginPath();
    
    if (phase > 0.02 && phase < 0.98) {
        // Invertiamo il senso dell'arco d'ombra per raddrizzare la fase
        if (isWaxing) {
            ctxMoon.arc(width / 2, height / 2, r, 1.5 * Math.PI, 0.5 * Math.PI, false);
            let ellipseRadius = Math.abs(r * cosineValue);
            ctxMoon.ellipse(width / 2, height / 2, ellipseRadius, r, 0, 0.5 * Math.PI, 1.5 * Math.PI, phase > 0.25);
        } else {
            ctxMoon.arc(width / 2, height / 2, r, 0.5 * Math.PI, 1.5 * Math.PI, false);
            let ellipseRadius = Math.abs(r * cosineValue);
            ctxMoon.ellipse(width / 2, height / 2, ellipseRadius, r, 0, 1.5 * Math.PI, 0.5 * Math.PI, phase > 0.75);
        }
    } else if (phase >= 0.98 || phase <= 0.02) {
        // Luna Nuova (completamente scura)
        ctxMoon.arc(width / 2, height / 2, r + 1, 0, Math.PI * 2);
    } else {
        // Luna Piena (nessuna ombra, resta lo sfondo chiaro)
        ctxMoon.clearRect(width, height, 0, 0);
    }
    
    ctxMoon.closePath();
    ctxMoon.fill();
    ctxMoon.restore();

    ctxMoon.restore();

    ctxMoon.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctxMoon.lineWidth = 1.5;
    ctxMoon.beginPath();
    ctxMoon.arc(width / 2, height / 2, r, 0, Math.PI * 2);
    ctxMoon.stroke();
}
