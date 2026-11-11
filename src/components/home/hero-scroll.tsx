"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const FRAME_COUNT = 70;
/** Tall scrub runway — denser frames = smoother scrub feel */
const SCROLL_VH = 380;
/** Eager-load this many frames right after frame 0 for early scrub */
const EAGER_COUNT = 16;
/** Versioned path — busts immutable CDN cache from older cartoon frames70 */
const HERO_ASSET_BASE = "/hero/f70b1";
/** Soft crossfade width at phase boundaries (1-based frames) */
const PHASE_FADE = 3.25;

function frameSrc(i: number) {
  return `${HERO_ASSET_BASE}/frame-${String(i).padStart(3, "0")}.webp`;
}

/** Trapezoid membership for a 1-based frame range with soft edges */
function phaseOpacity(frame: number, start: number, end: number, fade = PHASE_FADE) {
  if (frame <= start - fade || frame >= end + fade) return 0;
  if (frame < start) return (frame - (start - fade)) / fade;
  if (frame > end) return (end + fade - frame) / fade;
  return 1;
}

function phaseOpacities(frame1Based: number) {
  return [
    phaseOpacity(frame1Based, 1, 22),
    phaseOpacity(frame1Based, 23, 46),
    phaseOpacity(frame1Based, 47, 70),
  ] as const;
}

/**
 * Full-bleed scroll-scrub hero with phased RTL copy that crossfades by frame range.
 */
export function HeroScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phase1Ref = useRef<HTMLDivElement>(null);
  const phase2Ref = useRef<HTMLDivElement>(null);
  const phase3Ref = useRef<HTMLDivElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>(
    new Array(FRAME_COUNT).fill(null),
  );
  const lastIdxRef = useRef(-1);
  const rafRef = useRef(0);
  const pendingProgressRef = useRef(0);
  const smoothProgressRef = useRef(0);
  const [firstReady, setFirstReady] = useState(false);

  const applyPhaseOpacities = useCallback((frame1Based: number) => {
    const opacities = phaseOpacities(frame1Based);
    const els = [phase1Ref.current, phase2Ref.current, phase3Ref.current];
    for (let i = 0; i < 3; i++) {
      const el = els[i];
      if (!el) continue;
      const o = opacities[i];
      el.style.opacity = String(o);
      el.style.visibility = o < 0.02 ? "hidden" : "visible";
      el.style.pointerEvents = o > 0.45 ? "auto" : "none";
      el.setAttribute("aria-hidden", o < 0.35 ? "true" : "false");
    }
  }, []);

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
              requestAnimationFrame(() => {
                drawIndex(0, true);
                applyPhaseOpacities(1);
              });
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
  }, [applyPhaseOpacities, drawIndex]);

  useEffect(() => {
    if (!firstReady) return;

    const applyProgress = (raw: number) => {
      const prev = smoothProgressRef.current;
      const smoothed = prev + (raw - prev) * 0.55;
      smoothProgressRef.current = Math.abs(raw - prev) < 0.002 ? raw : smoothed;
      const p = smoothProgressRef.current;
      const idx = Math.min(
        FRAME_COUNT - 1,
        Math.max(0, Math.round(p * (FRAME_COUNT - 1))),
      );
      // Continuous 1-based frame for soft phase crossfades
      const frame1 = 1 + p * (FRAME_COUNT - 1);
      drawIndex(idx);
      applyPhaseOpacities(frame1);
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
  }, [applyPhaseOpacities, drawIndex, firstReady]);

  const textShadowStrong =
    "0 2px 18px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.7)";
  const textShadowSoft = "0 1px 10px rgba(0,0,0,0.5)";

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

        {/* Soft center vignette — keeps mid-frame type legible over busy nuts */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% 50%, rgba(18,14,10,0.58) 0%, rgba(18,14,10,0.28) 45%, rgba(18,14,10,0) 72%)",
          }}
          aria-hidden
        />

        <div
          className="absolute inset-0 z-[2] flex items-center justify-center px-4 sm:px-8"
          dir="rtl"
        >
          <div
            className={
              firstReady
                ? "hero-copy-panel w-full max-w-2xl rounded-2xl px-5 py-5 text-center sm:px-8 sm:py-7 animate-hero-copy-in"
                : "hero-copy-panel w-full max-w-2xl rounded-2xl px-5 py-5 text-center sm:px-8 sm:py-7 opacity-0"
            }
            style={{
              background: "rgba(18, 14, 10, 0.55)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.28)",
            }}
          >
            <div className="relative grid place-items-center">
              {/* Phase 1 — frames 1–22 */}
              <div
                ref={phase1Ref}
                className="col-start-1 row-start-1 w-full"
                style={{ opacity: 1 }}
              >
                <h1
                  className="font-extrabold text-[1.55rem] leading-[1.45] text-white sm:text-3xl md:text-4xl"
                  style={{ textShadow: textShadowStrong }}
                >
                  شادجیل یعنی شادیِ جویدن
                </h1>
              </div>

              {/* Phase 2 — frames 23–46 */}
              <div
                ref={phase2Ref}
                className="col-start-1 row-start-1 w-full"
                style={{ opacity: 0, visibility: "hidden", pointerEvents: "none" }}
                aria-hidden
              >
                <p
                  className="font-medium text-base leading-8 text-white/95 sm:text-lg sm:leading-9 md:text-xl"
                  style={{ textShadow: textShadowSoft }}
                >
                  از آجیل تا خشکبار و سوغات؛ هر لقمه یه لبخند
                </p>
              </div>

              {/* Phase 3 — frames 47–70 */}
              <div
                ref={phase3Ref}
                className="col-start-1 row-start-1 flex w-full items-center justify-center"
                style={{ opacity: 0, visibility: "hidden", pointerEvents: "none" }}
                aria-hidden
              >
                <Link
                  href="/products"
                  className="font-regular bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm transition-colors sm:px-6 sm:py-3 sm:text-base"
                >
                  یه مشت شادی بردار
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
