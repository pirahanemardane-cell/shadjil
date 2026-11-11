"use client";

import React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface FooterLink {
  label: string;
  href: string;
}

interface SocialLink {
  icon: React.ReactNode;
  href: string;
  label: string;
}

interface FooterProps {
  brandName?: string;
  watermarkName?: string;
  brandDescription?: string;
  socialLinks?: SocialLink[];
  navLinks?: FooterLink[];
  creatorName?: string;
  creatorUrl?: string;
  /** Lower footer chrome mark only — not shown above the title. */
  brandIcon?: React.ReactNode;
  className?: string;
}

export function Footer({
  brandName = "شادجیل",
  watermarkName = "Shadjil",
  brandDescription = "فروشگاه تخصصی شادجیل — آجیل، خشکبار، خرما و سوغات",
  socialLinks = [],
  navLinks = [],
  creatorName: _creatorName,
  creatorUrl: _creatorUrl,
  brandIcon,
  className,
}: FooterProps) {
  return (
    <section className={cn("relative mt-0 w-full overflow-hidden", className)}>
      <footer className="border-t bg-background relative mt-20">
        <div className="relative mx-auto flex min-h-[26rem] w-full max-w-7xl flex-col justify-between p-4 py-8 sm:min-h-[28rem] md:min-h-[30rem] md:py-10">
          <div className="mb-8 flex w-full flex-col sm:mb-10 md:mb-6">
            <div className="flex w-full flex-col items-center">
              <div className="flex flex-1 flex-col items-center space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-primary whitespace-nowrap text-4xl font-thin tracking-tight sm:text-5xl md:text-6xl">
                    {brandName}
                  </span>
                </div>
                <p className="text-muted-foreground max-w-4xl px-4 text-center text-sm font-semibold whitespace-nowrap sm:text-base">
                  {brandDescription}
                </p>
              </div>

              {socialLinks.length > 0 && (
                <div className="mt-3 mb-8 flex gap-4">
                  {socialLinks.map((link, index) => (
                    <Link
                      key={index}
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <div className="h-6 w-6 duration-300 hover:scale-110">
                        {link.icon}
                      </div>
                      <span className="sr-only">{link.label}</span>
                    </Link>
                  ))}
                </div>
              )}

              {navLinks.length > 0 && (
                <div className="text-muted-foreground relative z-20 mx-auto grid w-full max-w-4xl grid-cols-4 gap-x-2 gap-y-2.5 px-4 pb-10 text-center text-xs font-medium sm:text-sm md:flex md:flex-wrap md:justify-center md:gap-x-5 md:gap-y-0 md:pb-36 md:text-sm">
                  {navLinks.map((link, index) => (
                    <Link
                      key={index}
                      className="hover:text-foreground duration-300 hover:font-semibold"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Soft fade above chrome — keep below watermark so glass can see “Shadjil” */}
        <div className="from-background via-background/80 to-background/40 pointer-events-none absolute bottom-28 z-0 h-24 w-full bg-gradient-to-t blur-[1em]" />

        {/* Large background text */}
        <div
          className="text-primary/35 pointer-events-none absolute bottom-8 left-1/2 z-[1] max-w-[95vw] -translate-x-1/2 overflow-hidden whitespace-nowrap px-4 text-center leading-none font-extrabold select-none sm:bottom-8 md:bottom-0"
          style={{
            fontSize: "clamp(1.35rem, 9vw, 9.5rem)",
            letterSpacing: "-0.02em",
          }}
        >
          {watermarkName}
        </div>

        {/* Lower logo + side borders — خط‌ها حذف نشوند؛ نزدیک لوگو پروضعیت محصول، لبه محو */}
        <div
          dir="ltr"
          className="pointer-events-none absolute bottom-12 left-1/2 z-10 flex w-[min(100%,42rem)] max-w-full -translate-x-1/2 items-center px-4 sm:bottom-14 md:bottom-20 md:w-[min(100%,56rem)] lg:w-[min(100%,64rem)]"
        >
          <div className="bg-gradient-to-r from-transparent to-primary/70 h-px min-w-0 flex-1" />
          <div
            className="border-border/50 bg-background/40 pointer-events-auto relative mx-0 flex h-14 w-14 max-h-14 max-w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border p-1.5 shadow-sm backdrop-blur-xl backdrop-saturate-150 transition-colors duration-300 hover:border-primary supports-[backdrop-filter]:bg-background/25 sm:h-20 sm:w-20 sm:max-h-20 sm:max-w-20 sm:p-2 md:h-24 md:w-24 md:max-h-24 md:max-w-24"
          >
            {brandIcon}
          </div>
          <div className="bg-gradient-to-l from-transparent to-primary/70 h-px min-w-0 flex-1" />
        </div>
      </footer>
    </section>
  );
}
