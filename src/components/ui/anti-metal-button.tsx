"use client";

import React from "react";
import { cn } from "@/lib/utils";

const DoubleChevron = ({ index, dotColor }: { index: number; dotColor: string }) => {
  const base = index * 0.12;
  const dots = [
    { cx: 2, cy: 2, d: 0 },
    { cx: 5, cy: 5, d: 0.05 },
    { cx: 8, cy: 8, d: 0.1 },
    { cx: 5, cy: 11, d: 0.15 },
    { cx: 2, cy: 14, d: 0.2 },
    { cx: 6, cy: 2, d: 0.05 },
    { cx: 9, cy: 5, d: 0.1 },
    { cx: 12, cy: 8, d: 0.15 },
    { cx: 9, cy: 11, d: 0.2 },
    { cx: 6, cy: 14, d: 0.25 },
  ];

  return (
    <svg
      width="14"
      height="16"
      viewBox="0 0 14 16"
      aria-hidden="true"
      focusable="false"
      className="shrink-0 overflow-visible"
    >
      <g fill={dotColor}>
        {dots.map((p, i) => (
          <circle
            key={i}
            cx={p.cx}
            cy={p.cy}
            r="1"
            className="bd-dot"
            style={{ animationDelay: `${base + p.d}s` }}
          />
        ))}
      </g>
    </svg>
  );
};

/** Theme-token defaults: light `--primary` #AA6031, dark `--primary` #99B012 */
const DEFAULT_ACCENT_FROM = "var(--primary)";
const DEFAULT_ACCENT_TO =
  "color-mix(in srgb, var(--primary) 78%, #1a1208)";
const DEFAULT_DOT_COLOR = "var(--primary-foreground)";

export const AntiMetalButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label?: React.ReactNode;
    accentFrom?: string;
    accentTo?: string;
    dotColor?: string;
  }
>(
  (
    {
      className,
      children,
      label,
      accentFrom = DEFAULT_ACCENT_FROM,
      accentTo = DEFAULT_ACCENT_TO,
      dotColor = DEFAULT_DOT_COLOR,
      ...props
    },
    ref
  ) => {
    const content = label ?? children ?? "Book a demo";

    return (
      <button
        ref={ref}
        className={cn(
          // Wider default for Persian CTA labels; logical insets for RTL
          "group/btn relative inline-flex h-11 w-52 overflow-hidden rounded-xl transition-[transform,box-shadow,filter] duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          // Light: warm brown-metal shell (brand #AA6031 family)
          "bg-[linear-gradient(180deg,#3a2418_0%,#1a100c_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_4px_12px_rgba(26,16,12,0.28)]",
          "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_6px_16px_rgba(170,96,49,0.35)]",
          // Dark: soft olive-metal shell (brand #99B012 family)
          "dark:bg-[linear-gradient(180deg,#f4f6ea_0%,#e4e8d2_100%)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_12px_rgba(0,0,0,0.35)]",
          "dark:hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_6px_16px_rgba(153,176,18,0.4)]",
          className
        )}
        {...props}
      >
        <style>{`
          @keyframes bd-dot-wave {
            0%, 70%, 100% { opacity: 0.25; transform: scale(0.85); }
            35% { opacity: 1; transform: scale(1); }
          }
          .bd-dot {
            transform-box: fill-box;
            transform-origin: center;
            animation: bd-dot-wave 1.4s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .bd-dot { animation: none; opacity: 1; }
          }
        `}</style>

        <span className="absolute inset-y-0 end-4 z-0 flex items-center text-[14px] font-medium tracking-tight text-primary-foreground">
          {content}
        </span>

        <span
          aria-hidden="true"
          className="absolute bottom-1 start-1 top-1 z-10 flex w-9 items-center justify-start gap-2.5 overflow-hidden rounded-md ps-3 pe-2.5 transition-[width,gap,filter] duration-200 ease-[cubic-bezier(0.65,0,0.35,1)] group-hover/btn:w-[calc(100%-0.5rem)] group-hover/btn:brightness-110 group-active/btn:brightness-95"
          style={{
            background: `linear-gradient(180deg, ${accentFrom} 0%, ${accentTo} 100%)`,
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -2px 4px rgba(0,0,0,0.14), 0 2px 4px rgba(0,0,0,0.08)",
          }}
        >
          <DoubleChevron index={0} dotColor={dotColor} />
          <DoubleChevron index={1} dotColor={dotColor} />
          <DoubleChevron index={2} dotColor={dotColor} />
          <DoubleChevron index={3} dotColor={dotColor} />
          <DoubleChevron index={4} dotColor={dotColor} />
        </span>
      </button>
    );
  }
);

AntiMetalButton.displayName = "AntiMetalButton";

export default AntiMetalButton;
