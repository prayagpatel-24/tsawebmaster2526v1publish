(function () {
  const BURST_MS = 2100;
  const BUBBLE_COUNT = 320;

  function makeOverlay() {
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '30000';
    overlay.style.overflow = 'hidden';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 120ms linear';
    overlay.style.background =
      'radial-gradient(circle at 20% 75%, rgba(204, 238, 255, 0.22), rgba(204, 238, 255, 0) 45%),' +
      'radial-gradient(circle at 75% 30%, rgba(182, 226, 255, 0.2), rgba(182, 226, 255, 0) 52%),' +
      'rgba(138, 196, 229, 0.16)';

    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    overlay.appendChild(canvas);

    return { overlay, canvas };
  }

  function runEntryBurst() {
    if (!document.body) return;

    const { overlay, canvas } = makeOverlay();
    document.body.appendChild(overlay);

    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const w = Math.max(1, Math.floor(window.innerWidth));
    const h = Math.max(1, Math.floor(window.innerHeight));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      overlay.remove();
      return;
    }
    ctx.scale(dpr, dpr);

    const start = performance.now();

    const bubbles = Array.from({ length: BUBBLE_COUNT }).map(() => {
      const r = 12 + Math.random() * 70;
      const waveDelay = Math.random() * 620;
      const riseDuration = 980 + Math.random() * 1050;
      return {
        x: Math.random() * w,
        y0: h + (Math.random() * h * 0.4),
        r,
        drift: (Math.random() * 2 - 1) * 95,
        delay: waveDelay,
        duration: riseDuration,
        alpha: 0.32 + Math.random() * 0.48
      };
    });

    function drawBubble(x, y, r, a) {
      const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.15, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${Math.min(1, a + 0.35)})`);
      g.addColorStop(0.42, `rgba(255,255,255,${Math.min(1, a)})`);
      g.addColorStop(1, 'rgba(255,255,255,0.06)');

      ctx.beginPath();
      ctx.fillStyle = g;
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.95, a + 0.16)})`;
      ctx.lineWidth = Math.max(1.1, r * 0.045);
      ctx.arc(x, y, r * 0.92, 0, Math.PI * 2);
      ctx.stroke();
    }

    function frame(now) {
      const t = now - start;
      const progress = Math.min(1, t / BURST_MS);
      const blurPx = progress < 0.5 ? 11 : Math.max(0, 11 * (1 - ((progress - 0.5) / 0.5)));
      const sat = progress < 0.5 ? 122 : Math.max(100, 122 - (22 * ((progress - 0.5) / 0.5)));

      overlay.style.backdropFilter = `blur(${blurPx.toFixed(2)}px) saturate(${sat.toFixed(1)}%)`;
      overlay.style.webkitBackdropFilter = `blur(${blurPx.toFixed(2)}px) saturate(${sat.toFixed(1)}%)`;

      ctx.clearRect(0, 0, w, h);

      for (const b of bubbles) {
        const local = (t - b.delay) / b.duration;
        if (local <= 0 || local >= 1.12) continue;

        const p = Math.min(1, Math.max(0, local));
        const ease = 1 - Math.pow(1 - p, 3);
        const y = b.y0 - ease * (h * 1.45);
        const x = b.x + Math.sin((p * 3.2 + b.x * 0.0025)) * b.drift;

        let alpha = b.alpha;
        if (p < 0.08) alpha *= p / 0.08;
        if (p > 0.84) alpha *= (1 - p) / 0.16;
        alpha *= (1 - progress * 0.25);

        drawBubble(x, y, b.r, Math.max(0, alpha));
      }

      if (t < BURST_MS + 240) {
        requestAnimationFrame(frame);
      } else {
        overlay.remove();
      }
    }

    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      requestAnimationFrame(frame);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runEntryBurst, { once: true });
  } else {
    runEntryBurst();
  }

  window.addEventListener('pageshow', function (event) {
    if (event.persisted) runEntryBurst();
  });
})();
