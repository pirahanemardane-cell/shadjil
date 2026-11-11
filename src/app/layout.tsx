import type { Metadata } from "next";
import { headers } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "./globals.css";
import { AppToaster } from "@/components/ui/app-toaster";
import { DeferredRealtime } from "@/components/providers/deferred-realtime";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationSchema, websiteSchema } from "@/lib/seo/schema";
import { isSiteIndexable } from "@/lib/seo/indexing";
import { WebVitalsReporter } from "@/components/performance/web-vitals-reporter";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://shadjil.ir";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "شادجیل",
    template: "%s | شادجیل",
  },
  description:
    "فروشگاه تخصصی آجیل و خشکبار و خرما — آجیل تازه، خشکبار، خرما و سوغات با بهترین کیفیت",
  applicationName: "شادجیل",
  authors: [{ name: "شادجیل" }],
  generator: "Next.js",
  keywords: [
    "شادجیل",
    "آجیل",
    "خشکبار",
    "خرما",
    "سوغات",
  ],
  manifest: "/site.webmanifest",
  appleWebApp: {
    title: "شادجیل",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "fa_IR",
    url: siteUrl,
    siteName: "شادجیل",
    title: "شادجیل | فروشگاه تخصصی آجیل و خشکبار و خرما",
    description:
      "فروشگاه تخصصی آجیل و خشکبار و خرما — آجیل، خشکبار، خرما و سوغات",
    images: [
      {
        url: "/og-image.webp",
        width: 1200,
        height: 630,
        alt: "شادجیل",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "شادجیل | فروشگاه تخصصی آجیل و خشکبار و خرما",
    description:
      "فروشگاه تخصصی آجیل و خشکبار و خرما — آجیل، خشکبار، خرما و سوغات",
    images: ["/og-image.webp"],
  },
  robots: isSiteIndexable()
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
        },
      }
    : {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
          noimageindex: true,
        },
      },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning className="max-w-full">
      <head>
        {nonce ? <meta property="csp-nonce" content={nonce} /> : null}
        <link rel="preconnect" href="https://media.shadjil.ir" crossOrigin="" />
        <link rel="dns-prefetch" href="https://media.shadjil.ir" />
        <link
          rel="preload"
          as="font"
          href="/fonts/iranyekan/IRANYekanX-Regular.woff2"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          href="/fonts/iranyekan/IRANYekanX-Bold.woff2"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          href="/fonts/iranyekan/IRANYekanX-Thin.woff2"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          as="font"
          href="/fonts/iranyekan/IRANYekanX-Heavy.woff2"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="apple-mobile-web-app-title" content="شادجیل" />
        <meta name="application-name" content="شادجیل" />
        <meta name="theme-color" content="#023047" />
      </head>
      <body className="min-h-screen font-sans antialiased max-w-full" suppressHydrationWarning>
        <JsonLd data={[organizationSchema(), websiteSchema()]} />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          storageKey="shadjil-theme"
          disableTransitionOnChange
        >
          {children}
          <Toaster theme="light" position="top-left" richColors closeButton />
          <DeferredRealtime />
          <AppToaster />
          <WebVitalsReporter />
        </ThemeProvider>
      </body>
    </html>
  );
}
