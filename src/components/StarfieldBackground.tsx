import React, { useEffect, useRef } from 'react';

interface StarDot {
  nx: number;
  ny: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  phase: number;
  color: string;
  glint: boolean;
}

const STAR_COLORS = ['#FFFFFF', '#FFFFFF', '#E6F0FF', '#FFF5DF', '#D9E8FF'];

function createStars(count: number): StarDot[] {
  const stars: StarDot[] = [];
  let seed = 42197;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  for (let i = 0; i < count; i++) {
    const magnitude = rand();
    const isBright = magnitude > 0.88;
    stars.push({
      nx: rand(),
      ny: rand(),
      radius: isBright ? 1.05 + rand() * 0.45 : 0.42 + rand() * 0.58,
      baseAlpha: isBright ? 0.72 + rand() * 0.28 : 0.24 + rand() * 0.46,
      twinkleSpeed: 0.7 + rand() * 2.2,
      phase: rand() * Math.PI * 2,
      color: STAR_COLORS[Math.floor(rand() * STAR_COLORS.length)],
      glint: magnitude > 0.94,
    });
  }
  return stars;
}

export const StarfieldBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const stars = createStars(240);
    let reducedMotion = false;
    try {
      reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      reducedMotion = false;
    }
    let width = 0;
    let height = 0;
    let rafId = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawFrame = (timeMs: number) => {
      const t = timeMs * 0.001;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        const x = star.nx * width;
        const y = star.ny * height;
        const pulse = reducedMotion
          ? 0.85
          : 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(t * star.twinkleSpeed + star.phase));
        const alpha = star.baseAlpha * pulse;

        ctx.globalAlpha = alpha;
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(x, y, star.radius, 0, Math.PI * 2);
        ctx.fill();

        if (star.glint && alpha > 0.65) {
          ctx.globalAlpha = (alpha - 0.55) * 0.6;
          ctx.fillRect(x - star.radius * 2.2, y - 0.35, star.radius * 4.4, 0.7);
          ctx.fillRect(x - 0.35, y - star.radius * 2.2, 0.7, star.radius * 4.4);
        }
      }
      ctx.globalAlpha = 1;
    };

    resize();
    window.addEventListener('resize', resize);

    if (reducedMotion) {
      drawFrame(0);
    } else {
      const animate = (now: number) => {
        drawFrame(now);
        rafId = window.requestAnimationFrame(animate);
      };
      rafId = window.requestAnimationFrame(animate);
    }

    return () => {
      window.removeEventListener('resize', resize);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none select-none bg-[var(--ds-void)]"
      aria-hidden="true"
      data-testid="starfield-background"
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-80"
        style={{
          background:
            'radial-gradient(circle at 22% 18%, rgba(14, 116, 144, 0.08), transparent 46%), radial-gradient(circle at 80% 78%, rgba(30, 58, 138, 0.07), transparent 50%)',
        }}
      />
      <canvas ref={canvasRef} className="block w-full h-full opacity-80" />
    </div>
  );
};
