"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FRAME_COUNT = 70;
/** Tall scrub runway — denser frames = smoother scrub feel */
const SCROLL_VH = 380;
/** Eager-load this many frames right after frame 0 for early scrub */
const EAGER_COUNT = 16;
/** Versioned path — busts immutable CDN cache from older cartoon frames70 */
const HERO_ASSET_BASE = "/hero/f70b1";

function frameSrc(i: number) {
  return `${HERO_ASSET_BASE}/frame-${String(i).padStart(3, "0")}.webp`;
}

/**
 * Full-bleed scroll-scrub hero — frames only, no overlay copy/CTA.
 */
export function HeroScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>(
    new Array(FRAME_COUNT).fill(null),
  );
  const lastIdxRef = useRef(-1);
  const rafRef = useRef(0);
  const pendingProgressRef = useRef(0);
  const smoothProgressRef = useRef(0);
  const [firstReady, setFirstReady] = useState(false);

  const drawIndex = useCallback((idx: number, force = false) => {
    if (!force && idx === lastIdxRef.current) return;
    lastIdxRef.current = idx;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext("2d", { alpha: false, desynchronized: true });
    if (!ctx) return;

    let img = imagesRef.current[idx];
    if (!img?.complete || !img.naturalWidth) {
      for (let d = 1; d < FRAME_COUNT; d++) {
        const a = imagesRef.current[idx - d];
        const b = imagesRef.current[idx + d];
        if (a?.complete && a.naturalWidth) {
          img = a;
          break;
        }
        if (b?.complete && b.naturalWidth) {
          img = b;
          break;
        }
      }
    }
    if (!img?.complete || !img.naturalWidth) return;

    const rect = stage.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const tw = Math.floor(w * dpr);
    const th = Math.floor(h * dpr);
    if (canvas.width !== tw || canvas.height !== th) {
      canvas.width = tw;
      canvas.height = th;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Slight cover zoom so 16:9 frames fill the stage cleanly
    const zoom = 1.02;
    const ir = img.naturalWidth / img.naturalHeight;
    const cr = w / h;
    let dw: number;
    let dh: number;
    if (ir > cr) {
      dh = h * zoom;
      dw = dh * ir;
    } else {
      dw = w * zoom;
      dh = dw / ir;
    }
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }, []);

  useEffect(() => {
    const imgs: (HTMLImageElement | null)[] = new Array(FRAME_COUNT).fill(null);
    imagesRef.current = imgs;
    let cancelled = false;

    const loadOne = (i: number) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          if (!cancelled) {
            imgs[i] = img;
            if (i === 0) {
              setFirstReady(true);
              requestAnimationFrame(() => drawIndex(0, true));
            } else if (i === lastIdxRef.current) {
              requestAnimationFrame(() => drawIndex(i, true));
            }
          }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = frameSrc(i + 1);
      });

    (async () => {
      await loadOne(0);
      // Burst-load early frames so the first scrub stretch stays crisp
      const eagerEnd = Math.min(EAGER_COUNT, FRAME_COUNT);
      await Promise.all(
        Array.from({ length: eagerEnd - 1 }, (_, k) => loadOne(k + 1)),
      );
      if (cancelled) return;

      const CONCURRENCY = 8;
      let next = eagerEnd;
      const workers = Array.from({ length: CONCURRENCY }, async () => {
        while (!cancelled && next < FRAME_COUNT) {
          const i = next++;
          await new Promise<void>((r) => {
            if (typeof requestIdleCallback === "function") {
              requestIdleCallback(() => r(), { timeout: 120 });
            } else {
              setTimeout(r, 0);
            }
          });
          if (cancelled) return;
          await loadOne(i);
        }
      });
      await Promise.all(workers);
    })();

    return () => {
      cancelled = true;
    };
  }, [drawIndex]);

  useEffect(() => {
    if (!firstReady) return;

    const applyProgress = (raw: number) => {
      // Light EMA keeps scrub fluid without noticeable lag
      const prev = smoothProgressRef.current;
      const smoothed = prev + (raw - prev) * 0.55;
      smoothProgressRef.current = Math.abs(raw - prev) < 0.002 ? raw : smoothed;
      const p = smoothProgressRef.current;
      const idx = Math.min(
        FRAME_COUNT - 1,
        Math.max(0, Math.round(p * (FRAME_COUNT - 1))),
      );
      drawIndex(idx);
    };

    const measure = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = Math.max(1, el.offsetHeight - window.innerHeight);
      const scrolled = Math.min(Math.max(-rect.top, 0), total);
      pendingProgressRef.current = scrolled / total;
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        applyProgress(pendingProgressRef.current);
      });
    };

    measure();
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });

    const stage = stageRef.current;
    const ro =
      typeof ResizeObserver !== "undefined" && stage
        ? new ResizeObserver(() => {
            lastIdxRef.current = -1;
            measure();
          })
        : null;
    if (stage && ro) ro.observe(stage);

    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      ro?.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [drawIndex, firstReady]);

  return (
    <section
      ref={sectionRef}
      className="relative w-screen max-w-[100vw]"
      style={{
        height: `${SCROLL_VH}vh`,
        marginLeft: "calc(50% - 50vw)",
        marginRight: "calc(50% - 50vw)",
      }}
      aria-label="هیرو"
    >
      <div
        ref={stageRef}
        className="sticky top-0 left-0 w-full overflow-hidden"
        style={{
          height: "100dvh",
          minHeight: "100vh",
          width: "100vw",
          backgroundColor: "#111",
          contain: "strict",
        }}
      >
        {!firstReady ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`${HERO_ASSET_BASE}/poster.webp`}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: "center center" }}
            fetchPriority="high"
          />
        ) : null}

        <canvas
          ref={canvasRef}
          className="absolute inset-0 block h-full w-full"
          style={{
            width: "100%",
            height: "100%",
            willChange: "contents",
            pointerEvents: "none",
          }}
          aria-hidden
        />
      </div>
    </section>
  );
}
