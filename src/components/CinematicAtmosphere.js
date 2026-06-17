import React, { useEffect, useRef } from "react";

function CinematicAtmosphere({ active = false, loading = false }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") {
      return undefined;
    }

    if (window.navigator?.userAgent?.includes("jsdom")) {
      return undefined;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return undefined;
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobileQuery = window.matchMedia("(max-width: 720px)");
    const state = {
      width: 0,
      height: 0,
      dpr: 1,
      mouseX: 0.5,
      mouseY: 0.44,
      targetX: 0.5,
      targetY: 0.44,
      rafId: 0,
      particles: [],
      reducedMotion: reducedMotionQuery.matches,
      mobile: mobileQuery.matches,
    };

    const particleCount = state.mobile ? 16 : 24;

    const createParticles = () =>
      Array.from({ length: particleCount }, (_, index) => {
        const seed = index / particleCount;
        return {
          x: 0.1 + Math.random() * 0.8,
          y: 0.16 + Math.random() * 0.7,
          radius: 0.75 + Math.random() * 1.7,
          speed: 0.1 + Math.random() * 0.22,
          drift: (Math.random() - 0.5) * 0.018,
          alpha: 0.12 + Math.random() * 0.22,
          hueShift: seed,
        };
      });

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const nextWidth = Math.max(1, Math.floor(rect.width));
      const nextHeight = Math.max(1, Math.floor(rect.height));
      const nextDpr = Math.min(window.devicePixelRatio || 1, 1.5);

      state.width = nextWidth;
      state.height = nextHeight;
      state.dpr = nextDpr;
      canvas.width = Math.max(1, Math.floor(nextWidth * nextDpr));
      canvas.height = Math.max(1, Math.floor(nextHeight * nextDpr));
      canvas.style.width = `${nextWidth}px`;
      canvas.style.height = `${nextHeight}px`;
      context.setTransform(nextDpr, 0, 0, nextDpr, 0, 0);
      state.particles = createParticles();
    };

    const drawGlow = (x, y, radius, color, opacity) => {
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity})`);
      gradient.addColorStop(0.45, `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${opacity * 0.35})`);
      gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fill();
    };

    const render = (time = 0) => {
      const width = state.width;
      const height = state.height;
      if (!width || !height) {
        return;
      }

      context.clearRect(0, 0, width, height);

      const motionBoost = active ? 1 : 0;
      const loadBoost = loading ? 1 : 0;
      const glowX = width * (0.44 + (state.mouseX - 0.5) * 0.06);
      const glowY = height * (0.42 + (state.mouseY - 0.5) * 0.05);
      const beamOpacity = 0.2 + motionBoost * 0.08 + loadBoost * 0.08;

      drawGlow(glowX, glowY, Math.max(width, height) * 0.72, [242, 197, 86], beamOpacity);
      drawGlow(width * 0.72, height * 0.22, Math.max(width, height) * 0.42, [129, 160, 222], 0.12 + motionBoost * 0.05);
      drawGlow(width * 0.22, height * 0.8, Math.max(width, height) * 0.32, [150, 97, 58], 0.08);

      context.save();
      context.globalCompositeOperation = "screen";
      context.filter = "blur(26px)";
      context.fillStyle = `rgba(244, 197, 94, ${0.08 + beamOpacity * 0.18})`;
      context.beginPath();
      context.ellipse(width * 0.44, height * 0.24, width * 0.34, height * 0.08, -0.22, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = `rgba(255, 245, 220, ${0.06 + beamOpacity * 0.12})`;
      context.beginPath();
      context.ellipse(width * 0.51, height * 0.28, width * 0.22, height * 0.05, -0.22, 0, Math.PI * 2);
      context.fill();
      context.restore();

      context.save();
      context.globalAlpha = 0.16;
      context.strokeStyle = "rgba(208, 219, 233, 0.24)";
      context.lineWidth = 1;
      context.beginPath();
      context.ellipse(width * 0.62, height * 0.48, width * 0.34, height * 0.4, -0.18, 0.2, Math.PI * 1.7);
      context.stroke();
      context.beginPath();
      context.ellipse(width * 0.56, height * 0.52, width * 0.21, height * 0.25, 0.28, 0, Math.PI * 2);
      context.stroke();
      context.restore();

      state.particles.forEach((particle, index) => {
        const wobble = Math.sin(time * 0.00018 * particle.speed + index) * 0.006;
        const x = ((particle.x + wobble + state.mouseX * (state.mobile ? 0.003 : 0.01) + time * 0.00001 * particle.speed) % 1) * width;
        const y = ((particle.y + particle.drift + state.mouseY * (state.mobile ? 0.002 : 0.006) + time * 0.00002 * particle.speed) % 1) * height;
        const size = particle.radius * (1 + motionBoost * 0.2 + loadBoost * 0.1);
        context.beginPath();
        context.fillStyle = `rgba(243, 238, 222, ${particle.alpha})`;
        context.arc(x, y, size, 0, Math.PI * 2);
        context.fill();
      });

      if (!state.reducedMotion && !state.mobile) {
        state.rafId = window.requestAnimationFrame(render);
      }
    };

    const scheduleDraw = () => {
      window.cancelAnimationFrame(state.rafId);
      render(performance.now());
    };

    const handlePointerMove = (event) => {
      if (state.reducedMotion || state.mobile) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? rect.width * 0.5;
      const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? rect.height * 0.5;
      state.targetX = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      state.targetY = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    };

    const handlePointerLeave = () => {
      state.targetX = 0.5;
      state.targetY = 0.44;
    };

    const animate = (time) => {
      state.mouseX += (state.targetX - state.mouseX) * 0.045;
      state.mouseY += (state.targetY - state.mouseY) * 0.045;
      render(time);
    };

    const handleFrame = (time) => {
      animate(time);
      if (!state.reducedMotion && !state.mobile) {
        state.rafId = window.requestAnimationFrame(handleFrame);
      }
    };

    const handleResize = () => {
      state.mobile = mobileQuery.matches;
      resize();
      scheduleDraw();
      if (!state.reducedMotion && !state.mobile) {
        window.cancelAnimationFrame(state.rafId);
        state.rafId = window.requestAnimationFrame(handleFrame);
      }
    };

    resize();
    scheduleDraw();

    if (!state.reducedMotion && !state.mobile) {
      state.rafId = window.requestAnimationFrame(handleFrame);
      canvas.addEventListener("pointermove", handlePointerMove);
      canvas.addEventListener("pointerleave", handlePointerLeave);
      canvas.addEventListener("touchmove", handlePointerMove, { passive: true });
      canvas.addEventListener("touchend", handlePointerLeave);
    }

    window.addEventListener("resize", handleResize);
    if (typeof reducedMotionQuery.addEventListener === "function") {
      reducedMotionQuery.addEventListener("change", handleResize);
      mobileQuery.addEventListener("change", handleResize);
    } else {
      reducedMotionQuery.addListener(handleResize);
      mobileQuery.addListener(handleResize);
    }

    return () => {
      window.cancelAnimationFrame(state.rafId);
      window.removeEventListener("resize", handleResize);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("touchmove", handlePointerMove);
      canvas.removeEventListener("touchend", handlePointerLeave);
      if (typeof reducedMotionQuery.removeEventListener === "function") {
        reducedMotionQuery.removeEventListener("change", handleResize);
        mobileQuery.removeEventListener("change", handleResize);
      } else {
        reducedMotionQuery.removeListener(handleResize);
        mobileQuery.removeListener(handleResize);
      }
    };
  }, [active, loading]);

  return (
    <div className={`page-atmosphere${active ? " is-active" : ""}${loading ? " is-loading" : ""}`} aria-hidden="true">
      <canvas ref={canvasRef} className="page-atmosphere-canvas" />
    </div>
  );
}

export default CinematicAtmosphere;
