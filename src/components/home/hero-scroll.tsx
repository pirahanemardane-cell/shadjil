"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ArrowFillButton } from "@/components/ui/arrow-fill-button";

const FRAME_COUNT = 70;
const SCROLL_VH = 320;

const SLIDES = [
  { start: 0, end: 23, text: "تازه‌ترین آجیل و خشکبار" },
  { start: 24, end: 48, text: "خرما و سوغات باکیفیت" },
  { start: 48, end: 69, text: "شادجیل" },
] as const;

const FADE_FRAMES = 2.5;
const BUTTON_FROM = 48;

function frameSrc(i: number) {
  return `/hero/frames/frame-${String(i).padStart(3, "0")}.webp`;
}

function rangeOpacity(idx: number, start: number, end: number, fade = FADE_FRAMES) {
  if (idx < start - 0.001 || idx > end + 0.001) return 0;
  const fadeIn = Math.min(1, Math.max(0, (idx - start) / fade));
  const fadeOut = Math.min(1, Math.max(0, (end - idx) / fade));
  return Math.min(fadeIn, fadeOut);
}

function TitleContent({ text }: { text: string }) {
  if (text === "تازه‌ترین آجیل و خشکبار") {
    return (
      <>
        <span className="text-[40px] text-white md:text-[55px] lg:text-[90px]">تازه‌ترین</span>{" "}
        <span className="text-[20px] font-thin text-white md:text-[30px] lg:text-[40px]">آجیل و خشکبار</span>
      </>
    );
  }
  if (text === "خرما و سوغات باکیفیت") {
    return (
      <>
        <span className="text-[20px] font-thin text-white md:text-[30px] lg:text-[40px]">خرما و</span>{" "}
        <span className="text-[40px] text-white md:text-[55px] lg:text-[90px]">سوغات باکیفیت</span>
      </>
    );
  }
  if (text === "شادجیل") {
    return <span className="text-[40px] text-white md:text-[55px] lg:text-[90px]">شادجیل</span>;
  }
  return <>{text}</>;
}

export function HeroScroll() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<(HTMLImageElement | null)[]>(new Array(FRAME_COUNT).fill(null));
  const lastIdxRef = useRef(-1);
  const introFiredRef = useRef(false);
  const rafRef = useRef(0);
  const [firstReady, setFirstReady] = useState(false);
  const [frameIdx, setFrameIdx] = useState(0);

  const drawIndex = useCallback((idx: number, force = false) => {
    if (!force && idx === lastIdxRef.current) return;
    lastIdxRef.current = idx;
    setFrameIdx(idx);
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const ctx = canvas.getContext("2d", { alpha: false });
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
    const zoom = 1.08;
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
            }
          }
          resolve();
        };
        img.onerror = () => resolve();
        img.src = frameSrc(i + 1);
      });
    (async () => {
      await loadOne(0);
      const CONCURRENCY = 3;
      let next = 1;
      const workers = Array.from({ length: CONCURRENCY }, async () => {
        while (!cancelled && next < FRAME_COUNT) {
          const i = next++;
          await new Promise<void>((r) => {
            if (typeof requestIdleCallback === "function") {
              requestIdleCallback(() => r(), { timeout: 400 });
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
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        const el = sectionRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const total = Math.max(1, el.offsetHeight - window.innerHeight);
        const scrolled = Math.min(Math.max(-rect.top, 0), total);
        const progress = scrolled / total;
        const idx = Math.min(FRAME_COUNT - 1, Math.max(0, Math.round(progress * (FRAME_COUNT - 1))));
        drawIndex(idx);
        if (
          idx >= FRAME_COUNT - 1 &&
          progress >= 0.995 &&
          imagesRef.current[FRAME_COUNT - 1]?.complete &&
          !introFiredRef.current
        ) {
          introFiredRef.current = true;
          window.dispatchEvent(new Event("shadjil:hero-intro-done"));
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [drawIndex, firstReady]);

  const buttonOpacity = rangeOpacity(frameIdx, BUTTON_FROM, FRAME_COUNT - 1, 3);

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
      dir="rtl"
    >
      <style>{`
        @keyframes hero-scroll-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.85; }
          50% { transform: translateY(8px); opacity: 1; }
        }
        .hero-scroll-hint {
          animation: hero-scroll-bounce 1.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-scroll-hint { animation: none; }
        }
      `}</style>

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
        {!firstReady && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/hero/hero-poster.webp"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: "center center" }}
            fetchPriority="high"
          />
        )}

        <canvas
          ref={canvasRef}
          className="absolute inset-0 block h-full w-full"
          style={{ width: "100%", height: "100%" }}
        />

        <div
          className="pointer-events-none absolute inset-0 z-[5] bg-transparent dark:bg-black/25"
          aria-hidden
        />

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] h-40"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)",
          }}
        />

        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6">
          <div className="relative flex w-full max-w-3xl flex-col items-center justify-center text-center">
            {SLIDES.map((slide, i) => {
              const op = rangeOpacity(frameIdx, slide.start, slide.end);
              if (op <= 0.001) return null;
              return (
                <p
                  key={i}
                  className="absolute inset-x-0 font-black leading-relaxed text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]"
                  style={{
                    opacity: op,
                    transition: "opacity 40ms linear, transform 120ms linear",
                    paintOrder: "stroke fill",
                    transform:
                      i === 2 && buttonOpacity > 0.05
                        ? "translateY(-1.25rem)"
                        : "translateY(0)",
                  }}
                >
                  <TitleContent text={slide.text} />
                </p>
              );
            })}

            <div
              className="pointer-events-auto mt-20 flex translate-y-[8px] justify-center sm:mt-24 sm:translate-y-[15px]"
              style={{
                opacity: buttonOpacity,
                pointerEvents: buttonOpacity > 0.15 ? "auto" : "none",
                transition: "opacity 40ms linear",
              }}
            >
              <ArrowFillButton href="/products" btnText="خرید آنلاین" className="pointer-events-auto" />
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-2"
          style={{
            opacity: frameIdx < 0.5 ? 1 : Math.max(0, 1 - (frameIdx - 0.5) / 9),
            transition: "opacity 160ms linear",
          }}
          aria-hidden
        >
          <span className="text-sm font-semibold tracking-wide text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)] sm:text-base">
            اسکرول کنید
          </span>
          <span className="hero-scroll-hint inline-flex items-center justify-center text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)]">
            <ChevronDown className="h-12 w-12 sm:h-16 sm:w-16 lg:h-[100px] lg:w-[100px]" strokeWidth={2.25} />
          </span>
        </div>
      </div>
    </section>
  );
}
