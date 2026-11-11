"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Floater = {
  src: string;
  alt: string;
  className: string;
  depth: number;
  drift: string;
};

const FLOATERS: Floater[] = [
  {
    src: "/hero/pistachio.webp",
    alt: "پسته",
    className:
      "left-[6%] top-[18%] w-[22vw] max-w-[9.5rem] sm:left-[10%] sm:top-[16%] sm:max-w-[11rem] lg:max-w-[13rem]",
    depth: 0.035,
    drift: "hero-drift-a",
  },
  {
    src: "/hero/walnut.webp",
    alt: "گردو",
    className:
      "right-[4%] top-[14%] w-[24vw] max-w-[10rem] sm:right-[8%] sm:top-[12%] sm:max-w-[12rem] lg:max-w-[14rem]",
    depth: 0.05,
    drift: "hero-drift-b",
  },
  {
    src: "/hero/date.webp",
    alt: "خرما",
    className:
      "bottom-[14%] left-[8%] w-[20vw] max-w-[8.5rem] sm:bottom-[16%] sm:left-[12%] sm:max-w-[10rem] lg:max-w-[12rem]",
    depth: 0.028,
    drift: "hero-drift-c",
  },
  {
    src: "/hero/cashew.webp",
    alt: "بادام هندی",
    className:
      "bottom-[12%] right-[6%] w-[22vw] max-w-[9rem] sm:bottom-[14%] sm:right-[10%] sm:max-w-[11rem] lg:max-w-[12.5rem]",
    depth: 0.042,
    drift: "hero-drift-a",
  },
  {
    src: "/hero/almond.webp",
    alt: "بادام",
    className:
      "left-[42%] top-[8%] hidden w-[16vw] max-w-[7.5rem] sm:block sm:max-w-[9rem] lg:max-w-[10rem]",
    depth: 0.022,
    drift: "hero-drift-b",
  },
];

const HIGHLIGHTS = ["پسته تازه", "بادام درختی", "خرمای مضافتی", "آجیل مخلوط", "خشکبار برگزیده"];

export function LivingNutsHero() {
  const stageRef = useRef<HTMLElement>(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setHighlightIdx((i) => (i + 1) % HIGHLIGHTS.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    const el = stageRef.current;
    if (!el) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      targetX = nx;
      targetY = ny;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setParallax((prev) => ({
          x: prev.x + (targetX - prev.x) * 0.12,
          y: prev.y + (targetY - prev.y) * 0.12,
        }));
      });
    };

    const onLeave = () => {
      targetX = 0;
      targetY = 0;
      setParallax({ x: 0, y: 0 });
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduceMotion]);

  return (
    <section
      ref={stageRef}
      aria-label="میز آجیل زنده"
      dir="rtl"
      className="relative w-screen max-w-[100vw] overflow-hidden"
      style={{
        marginLeft: "calc(50% - 50vw)",
        marginRight: "calc(50% - 50vw)",
        minHeight: "calc(100svh - 4rem)",
      }}
    >
      <style>{`
        @keyframes hero-drift-a {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-2deg); }
          50% { transform: translate3d(0, -14px, 0) rotate(2deg); }
        }
        @keyframes hero-drift-b {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(3deg); }
          50% { transform: translate3d(0, 12px, 0) rotate(-2deg); }
        }
        @keyframes hero-drift-c {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(-1deg); }
          50% { transform: translate3d(6px, -10px, 0) rotate(3deg); }
        }
        @keyframes hero-copy-in {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .hero-float-a { animation: hero-drift-a 7.5s ease-in-out infinite; }
        .hero-float-b { animation: hero-drift-b 8.8s ease-in-out infinite; }
        .hero-float-c { animation: hero-drift-c 6.6s ease-in-out infinite; }
        .hero-copy-in { animation: hero-copy-in 700ms ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .hero-float-a, .hero-float-b, .hero-float-c, .hero-copy-in { animation: none !important; }
        }
      `}</style>

      {/* Full-bleed warm atmosphere */}
      <div className="absolute inset-0" aria-hidden>
        <Image
          src="/hero/atmosphere.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-70 dark:opacity-45"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 85% 70% at 70% 35%, color-mix(in oklab, var(--primary) 28%, transparent), transparent 62%), linear-gradient(160deg, color-mix(in oklab, #F4E6D4 92%, white) 0%, color-mix(in oklab, var(--primary) 18%, #F8F1E8) 48%, color-mix(in oklab, var(--primary) 34%, #E8D2B8) 100%)",
          }}
        />
        <div className="absolute inset-0 hidden dark:block bg-[#1a1712]/72" />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 30% 70%, color-mix(in oklab, var(--primary) 35%, transparent), transparent 60%), radial-gradient(ellipse 60% 50% at 80% 20%, color-mix(in oklab, var(--primary) 22%, transparent), transparent 55%)",
          }}
        />
      </div>

      {/* Floating product visuals */}
      <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
        {FLOATERS.map((item) => (
          <div
            key={item.src}
            className={cn("absolute", item.className)}
            style={{
              transform: reduceMotion
                ? undefined
                : `translate3d(${parallax.x * item.depth * -120}px, ${parallax.y * item.depth * -90}px, 0)`,
              transition: reduceMotion ? undefined : "transform 80ms linear",
              willChange: "transform",
            }}
          >
            <div
              className={cn(
                item.drift === "hero-drift-a" && "hero-float-a",
                item.drift === "hero-drift-b" && "hero-float-b",
                item.drift === "hero-drift-c" && "hero-float-c",
              )}
            >
              <Image
                src={item.src}
                alt=""
                width={400}
                height={400}
                className="h-auto w-full drop-shadow-[0_18px_35px_rgba(60,30,10,0.28)] dark:drop-shadow-[0_16px_30px_rgba(0,0,0,0.45)]"
                sizes="(max-width: 768px) 28vw, 200px"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Copy + CTA — one composition */}
      <div className="relative z-[2] mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-5xl flex-col items-center justify-center px-5 py-16 text-center sm:px-8">
        <h1
          className="hero-copy-in text-foreground max-w-3xl text-balance text-4xl font-black leading-[1.25] sm:text-5xl md:text-6xl lg:text-7xl"
          style={{ animationDelay: "60ms" }}
        >
          <span className="text-primary">شادجیل</span>
          {" یعنی شادیِ جویدن"}
        </h1>
        <p
          className="hero-copy-in text-foreground/80 mt-4 max-w-xl text-pretty text-base font-medium leading-8 sm:text-lg md:text-xl"
          style={{ animationDelay: "160ms" }}
        >
          از آجیل تا خشکبار و سوغات؛ هر لقمه یه لبخند
        </p>

        <div
          className="hero-copy-in mt-5 min-h-[1.75rem] text-sm font-semibold text-primary/90 sm:text-base"
          style={{ animationDelay: "240ms" }}
          aria-live="polite"
        >
          {HIGHLIGHTS[highlightIdx]}
        </div>

        <div className="hero-copy-in mt-8" style={{ animationDelay: "320ms" }}>
          <Link
            href="/products"
            className={cn(
              "bg-primary text-primary-foreground inline-flex items-center justify-center gap-2 rounded-xl px-7 py-3.5 text-base font-bold shadow-[0_12px_30px_color-mix(in_oklab,var(--primary)_35%,transparent)] transition",
              "hover:brightness-110 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
            )}
          >
            یه مشت شادی بردار
            <span aria-hidden className="text-lg leading-none">
              ←
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
