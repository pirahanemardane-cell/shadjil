"use client";

import { Mail } from "lucide-react";
import { Footer } from "@/components/ui/modem-animated-footer";
import { Logo } from "@/components/brand/logo";

function _InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

export function SiteFooter() {
  return (
    <Footer
      brandName="شادجیل"
      watermarkName="Shadjil"
      brandDescription="فروشگاه تخصصی آجیل، خشکبار، خرما و سوغات"
      brandIcon={<Logo size="footer" link={false} />}
      socialLinks={[
        {
          icon: <Mail className="h-6 w-6" />,
          href: "mailto:info@shadjil.ir",
          label: "ایمیل",
        },
      ]}
      navLinks={[
        { label: "درباره ما", href: "/about" },
        { label: "ارسال", href: "/shipping" },
        { label: "مرجوعی", href: "/returns" },
        { label: "سوالات متداول", href: "/faq" },
        { label: "شرایط استفاده", href: "/terms" },
        { label: "حریم خصوصی", href: "/privacy" },
        { label: "تماس", href: "/contact" },
      ]}
    />
  );
}
