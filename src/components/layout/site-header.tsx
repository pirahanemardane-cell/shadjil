"use client";
import { NotificationCountBadge } from "@/components/notifications/notification-count-badge";
 import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HeaderAuthButton } from "@/components/layout/header-auth-button";
import { SmartSearch } from "@/components/layout/smart-search";
import { CountBadge, useShopCounts } from "@/components/layout/header-badges";
import { useShopStore } from "@/lib/shop-store";
import { ShopActivityDrawer, type ActivityTab } from "@/components/layout/shop-activity-drawer";
import { Heart, GitCompareArrows, ShoppingCart, History, Menu, X, Sun, Moon, ChevronDown, Sparkles, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { CategorySvgIcon } from "@/components/home/category-icons";
import { Logo } from "@/components/brand/logo";
const MAIN_NAV = [
  { href: "/", label: "خانه", mega: null as null | "categories" | "brands" | "sale" },
  { href: "/products", label: "فروشگاه", mega: null },
  { href: "/contact", label: "تماس با ما", mega: null },
  { href: "/blog", label: "بلاگ", mega: null },
  { href: "/products", label: "دسته‌بندی‌ها", mega: "categories" as const },
  { href: "/brands", label: "برچسبها", mega: "brands" as const },
  { href: "/products?featured=1", label: "شگفت‌انگیز", mega: null },
]; const EXTRA_NAV = [ { href: "/blog", label: "بلاگ" }, { href: "/about", label: "درباره ما" }, { href: "/contact", label: "تماس با ما" },
];
function ThemeToggle() { const [dark, setDark] = useState(false); useEffect(() => { const root = document.documentElement; const stored = localStorage.getItem("theme"); const isDark = stored === "dark" || (!stored && root.classList.contains("dark")); setDark(isDark); root.classList.toggle("dark", isDark); }, []); function toggle() { const next = !dark; setDark(next); document.documentElement.classList.toggle("dark", next); localStorage.setItem("theme", next ? "dark" : "light"); } return ( <button type="button" onClick={toggle} className="border-border hover:bg-primary hover:text-primary-foreground relative inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-background" aria-label="تغییر تم" > {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />} </button> );
} function HeaderIcons({ onOpenPanel, hideCart }: { onOpenPanel?: (tab: string) => void; hideCart?: boolean }) { const counts = useShopCounts(); const item = "border-border hover:bg-primary hover:text-primary-foreground relative inline-flex h-10 w-10 items-center justify-center rounded-xl border bg-background"; return ( <div className="flex flex-wrap items-center justify-center gap-1.5"> <button type="button" className={item} title="علاقه‌مندی‌ها" onClick={() => onOpenPanel?.("wishlist")}> <Heart className="h-4 w-4" /> <CountBadge count={counts.wishlist} /> </button> <button type="button" className={item} title="مقایسه" onClick={() => onOpenPanel?.("compare")}> <GitCompareArrows className="h-4 w-4" /> <CountBadge count={counts.compare} /> </button> <button type="button" className={item} title="بازدیدهای اخیر" onClick={() => onOpenPanel?.("recent")}> <History className="h-4 w-4" /> <CountBadge count={counts.recent} /> </button> <ThemeToggle /> <button type="button" className={item} title="اعلان‌ها" onClick={() => onOpenPanel?.("notifications")}><Bell className="h-4 w-4" /><NotificationCountBadge /></button> 
{!hideCart ? (
    <button type="button" className={item} title="سبد خرید" onClick={() => onOpenPanel?.("cart")}>
      <ShoppingCart className="h-4 w-4" />
      <CountBadge count={counts.cart} />
    </button>
  ) : null} </div> );
} function MegaPanel({
  type,
  onNavigate,
  categories = [],
  brands = [],
}: {
  type: "categories" | "brands" | "sale";
  onNavigate?: () => void;
  categories?: { name: string; href: string; slug?: string; children?: { name: string; href: string; slug?: string }[] }[];
  brands?: { name: string; href: string; slug?: string; logoUrl?: string | null }[];
}) {
  if (type === "sale") {
    return (
      <div className="py-5">
        <Link
          href="/products?featured=1"
          onClick={onNavigate}
          className="from-primary/20 via-primary/10 to-transparent group flex flex-col gap-2 rounded-2xl bg-gradient-to-l p-6 transition hover:from-primary/30"
        >
          <span className="text-primary inline-flex items-center gap-1.5 text-xs font-bold">
            <Sparkles className="h-3.5 w-3.5" />
            فروش ویژه
          </span>
          <span className="text-xl font-black tracking-tight">تخفیف‌های امروز</span>
          <span className="text-muted-foreground text-sm">بهترین قیمت روی آجیل‌های منتخب</span>
          <span className="text-primary mt-1 text-sm font-medium group-hover:underline">مشاهده محصولات ←</span>
        </Link>
      </div>
    );
  }

  if (type === "categories") {
    if (categories.length === 0) {
      return (
        <div className="text-muted-foreground py-10 text-center text-sm">
          هنوز دسته‌بندی‌ای ثبت نشده
        </div>
      );
    }
    return (
      <div className="py-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">دسته‌بندی‌ها</p>
            <p className="text-muted-foreground text-xs">انتخاب بر اساس آجیل، خشکبار، خرما و سوغات</p>
          </div>
          <Link
            href="/products"
            onClick={onNavigate}
            className="bg-primary text-primary-foreground hover:bg-primary/90 hidden rounded-full px-4 py-1.5 text-xs font-medium sm:inline-flex"
          >
            همه محصولات
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((root) => {
            const hasKids = (root.children?.length ?? 0) > 0;
            return (
              <div
                key={root.href + root.name}
                className="border-border/60 bg-background/70 hover:border-primary/40 group rounded-2xl border p-4 shadow-sm transition hover:shadow-md"
              >
                <Link
                  href={root.href}
                  onClick={onNavigate}
                  className="mb-2 flex items-center gap-2.5"
                >
                  <span className="bg-primary/10 text-primary group-hover:bg-primary/15 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition">
                    <CategorySvgIcon name={root.name} slug={root.href} className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-bold leading-tight group-hover:text-primary">
                    {root.name}
                  </span>
                </Link>
                {hasKids ? (
                  <ul className="mt-2 space-y-0.5 border-t border-border/50 pt-2">
                    {root.children!.slice(0, 8).map((ch) => (
                      <li key={ch.href + ch.name}>
                        <Link
                          href={ch.href}
                          onClick={onNavigate}
                          className="text-muted-foreground hover:bg-primary/10 hover:text-primary flex items-center justify-between rounded-lg px-2 py-1.5 text-xs transition"
                        >
                          <span>{ch.name}</span>
                          <span className="opacity-0 transition group-hover:opacity-40">‹</span>
                        </Link>
                      </li>
                    ))}
                    {(root.children!.length > 8) ? (
                      <li>
                        <Link
                          href={root.href}
                          onClick={onNavigate}
                          className="text-primary block px-2 py-1 text-[11px] font-medium"
                        >
                          +{root.children!.length - 8} مورد دیگر
                        </Link>
                      </li>
                    ) : null}
                  </ul>
                ) : (
                  <p className="text-muted-foreground mt-1 text-[11px]">مشاهده همه در این دسته</p>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex justify-center sm:hidden">
          <Link
            href="/products"
            onClick={onNavigate}
            className="bg-primary text-primary-foreground rounded-full px-5 py-2 text-xs font-medium"
          >
            همه محصولات
          </Link>
        </div>
      </div>
    );
  }

  if (brands.length === 0) {
    return (
      <div className="text-muted-foreground py-10 text-center text-sm">هنوز برچسبی ثبت نشده</div>
    );
  }
  return (
    <div className="py-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">برچسبها</p>
          <p className="text-muted-foreground text-xs">انتخاب برچسب مورد علاقه</p>
        </div>
        <Link
          href="/brands"
          onClick={onNavigate}
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full px-4 py-1.5 text-xs font-medium"
        >
          همه برچسبها
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {brands.map((item) => (
          <Link
            key={item.href + item.name}
            href={item.href}
            onClick={onNavigate}
            className="border-border/60 bg-white hover:border-primary/40 flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl border px-3 py-3 text-center text-sm font-medium shadow-sm transition hover:bg-muted/30 dark:bg-background/70"
          >
            {item.logoUrl ? (
              <span className="relative flex h-10 w-full max-w-[6.5rem] items-center justify-center">
                <Image
                  src={item.logoUrl}
                  alt={item.name}
                  width={104}
                  height={40}
                  className="max-h-10 w-auto object-contain"
                />
              </span>
            ) : null}
            <span className="line-clamp-1 text-xs text-primary">{item.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function SiteHeader({ className }: { className?: string }) {
  const [megaCategories, setMegaCategories] = useState<{ name: string; href: string; children?: { name: string; href: string }[] }[]>([]);
  const [megaBrands, setMegaBrands] = useState<{ name: string; href: string; slug?: string; logoUrl?: string | null }[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/nav/mega")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setMegaCategories(
          (data.categories ?? []).map(
            (c: {
              name: string;
              href: string;
              slug?: string;
              children?: { name: string; href: string; slug?: string }[];
            }) => ({
              name: c.name,
              href: c.href,
              slug: c.slug,
              children: c.children ?? [],
            }),
          ),
        );
        setMegaBrands(
          (data.brands ?? []).map(
            (b: { name: string; href: string; slug?: string; logoUrl?: string | null }) => ({
              name: b.name,
              href: b.href,
              slug: b.slug,
              logoUrl: b.logoUrl ?? null,
            }),
          ),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useShopCounts();
  const [menuOpen, setMenuOpen] = useState(false); const [panelOpen, setPanelOpen] = useState(false); const [panelTab, setPanelTab] = useState<ActivityTab>("cart"); const [trackCode, setTrackCode] = useState(""); const [mega, setMega] = useState<null | "categories" | "brands" | "sale">(null);
  const megaTimer = useRef<ReturnType<typeof setTimeout> | null>(null); useEffect(() => { const unsub = useShopStore.subscribe((state, prev) => { if (!prev) return; if (state.cart.length > prev.cart.length) { setPanelTab("cart"); setPanelOpen(true); setMenuOpen(false); } else if (state.wishlist.length > prev.wishlist.length) { setPanelTab("wishlist"); setPanelOpen(true); setMenuOpen(false); } else if (state.compare.length > prev.compare.length) { setPanelTab("compare"); setPanelOpen(true); setMenuOpen(false); } }); 
  return () => unsub(); }, []); useEffect(() => { function onOpen(e: Event) { const detail = (e as CustomEvent).detail as { tab?: ActivityTab } | undefined; setPanelTab(detail?.tab || "cart"); setPanelOpen(true); setMenuOpen(false); } window.addEventListener("pm:open-panel", onOpen as EventListener); return () => window.removeEventListener("pm:open-panel", onOpen as EventListener); }, []); useEffect(() => { document.body.style.overflow = menuOpen || panelOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [menuOpen, panelOpen]); function openPanel(tab: string) { setPanelTab(tab as ActivityTab); setPanelOpen(true); setMenuOpen(false); } function openMega(type: "categories" | "brands" | "sale") { if (megaTimer.current) clearTimeout(megaTimer.current); setMega(type); } function closeMegaDelayed() { if (megaTimer.current) clearTimeout(megaTimer.current); megaTimer.current = setTimeout(() => setMega(null), 150); } function submitTrack(e: React.FormEvent) { e.preventDefault(); const code = trackCode.trim(); if (!code) return; window.location.href = `/track?code=${encodeURIComponent(code)}`; setMenuOpen(false); } 
  const pathname = usePathname();
  const [hideForHeroIntro, setHideForHeroIntro] = useState(false);

  useEffect(() => {
    if (pathname !== "/") {
      setHideForHeroIntro(false);
      return;
    }
    let done = false;
    try {
      done = sessionStorage.getItem("pm-hero-intro-done") === "1";
    } catch {}
    setHideForHeroIntro(!done);
    const onDone = () => {
      try {
        sessionStorage.setItem("pm-hero-intro-done", "1");
      } catch {}
      setHideForHeroIntro(false);
    };
    window.addEventListener("pm:hero-intro-done", onDone);
    return () => window.removeEventListener("pm:hero-intro-done", onDone);
  }, [pathname]);

return ( <> <header className={cn( "sticky top-0 z-50 border-b border-border/60", "bg-[#F8F9FA]/80 dark:bg-[#212529]/75", "supports-[backdrop-filter]:bg-[#F8F9FA]/65 dark:supports-[backdrop-filter]:bg-[#212529]/55", "backdrop-blur-xl backdrop-saturate-150", hideForHeroIntro && "hidden", className )} dir="rtl" onMouseLeave={closeMegaDelayed} > {/* دسکتاپ */} <div className="mx-auto hidden h-16 max-w-none items-center gap-3 px-4 xl:flex"> <div className="shrink-0"> <Logo size="md" priority /> </div> <nav className="relative flex shrink-0 items-center gap-0.5"> {MAIN_NAV.map((item) => ( <div key={item.label} className="relative" onMouseEnter={() => (item.mega ? openMega(item.mega) : setMega(null))} > <Link href={item.href} className={cn( "text-muted-foreground inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm", mega && item.mega === mega && "bg-muted text-foreground" )} onClick={(e) => { if (item.mega) { e.preventDefault(); setMega((m) => (m === item.mega ? null : item.mega)); } }} > {item.label} {item.mega ? <ChevronDown className="h-3.5 w-3.5 opacity-60" /> : null} </Link> </div> ))} </nav> <div className="flex h-10 min-w-0 flex-1 items-center"> <SmartSearch /> </div> <HeaderIcons onOpenPanel={openPanel} /> <HeaderAuthButton /> </div> {/* مگامنو تمام‌عرض */} {mega ? ( <div className="absolute inset-x-0 top-full z-50 hidden w-full border-b border-border bg-[#F8F9FA] shadow-md dark:bg-[#212529] xl:block" onMouseEnter={() => mega && openMega(mega)} onMouseLeave={closeMegaDelayed} > <div className="w-full px-6 py-2 lg:px-10"> <MegaPanel type={mega} onNavigate={() => setMega(null)} categories={megaCategories} brands={megaBrands} /> </div> </div> ) : null} {/* موبایل + تبلت: برگر | سرچ | ورود */} <div className="mx-auto flex h-14 max-w-none items-center gap-2 px-3 xl:hidden"> <button type="button" className="border-border bg-background/80 hover:bg-primary hover:text-primary-foreground inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border" aria-label="باز کردن منو" onClick={() => setMenuOpen(true)} > <Menu className="h-5 w-5" /> </button> <div className="flex h-10 min-w-0 flex-1 items-center"> <SmartSearch /> </div> <button type="button" className="border-border bg-background/80 hover:bg-primary hover:text-primary-foreground relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border" title="سبد خرید" aria-label="سبد خرید" onClick={() => openPanel("cart")}><ShoppingCart className="h-4 w-4" /><CountBadge count={counts.cart} /></button> <HeaderAuthButton /> </div> </header> {/* کشوی منوی موبایل — پس‌زمینه شیشه‌ای */} {menuOpen ? ( <div className="fixed inset-0 z-[110] xl:hidden" dir="rtl" role="dialog" aria-modal="true"> <button type="button" className="absolute inset-0 bg-[#F8F9FA]/45 backdrop-blur-md dark:bg-[#212529]/50" aria-label="بستن منو" onClick={() => setMenuOpen(false)} /> <div className="border-border/40 absolute top-0 right-0 flex h-full w-[min(100vw,22rem)] flex-col border-l bg-[#F8F9FA]/90 shadow-2xl backdrop-blur-xl dark:bg-[#212529]/90"> <div className="border-border/40 flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3"> <Logo size="sm" /> <button type="button" className=" hover:bg-primary hover:text-primary-foreground inline-flex h-10 w-10 items-center justify-center rounded-full" onClick={() => setMenuOpen(false)} > <X className="h-5 w-5" /> </button> </div> <div className="flex-1 space-y-5 overflow-y-auto p-4"> <div>  <HeaderIcons onOpenPanel={openPanel} hideCart /> </div> <HeaderAuthButton fullWidth onNavigate={() => setMenuOpen(false)} /> <nav className="space-y-1"> {MAIN_NAV.map((item) => ( <div key={item.label}> <Link href={item.href} onClick={() => setMenuOpen(false)} className=" hover:bg-primary hover:text-primary-foreground block rounded-xl px-3 py-2.5 text-sm font-medium" > {item.label} </Link> </div> ))} </nav>
            {megaCategories.length > 0 ? (
              <div className="space-y-2">
                <p className="text-muted-foreground px-1 text-xs font-semibold">دسته‌بندی‌ها</p>
                <nav className="space-y-1">
                  {megaCategories.map((root) => (
                    <div key={root.href + root.name} className="space-y-0.5">
                      <Link
                        href={root.href}
                        onClick={() => setMenuOpen(false)}
                        className="hover:bg-primary hover:text-primary-foreground flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium"
                      >
                        <span className="bg-primary/10 text-primary inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                          <CategorySvgIcon name={root.name} slug={root.href} className="h-4 w-4" />
                        </span>
                        {root.name}
                      </Link>
                      {(root.children?.length ?? 0) > 0 ? (
                        <div className="pr-3 space-y-0.5">
                          {root.children!.map((ch) => (
                            <Link
                              key={ch.href + ch.name}
                              href={ch.href}
                              onClick={() => setMenuOpen(false)}
                              className="text-muted-foreground hover:bg-primary hover:text-primary-foreground block rounded-lg px-3 py-1.5 text-xs"
                            >
                              {ch.name}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </nav>
              </div>
            ) : null} <form onSubmit={submitTrack} className="border-border/50 space-y-2 rounded-xl border p-3"> <label className="block text-sm font-medium">پیگیری سفارش</label> <input value={trackCode} onChange={(e) => setTrackCode(e.target.value)} placeholder="کد رهگیری" className="border-input bg-background h-10 w-full rounded-lg border px-3 text-sm text-right" dir="rtl" /> <button type="submit" className="bg-primary text-primary-foreground h-10 w-full rounded-lg text-sm font-medium hover:bg-primary/90" > پیگیری </button> </form> <nav className="border-border/40 space-y-1 border-t pt-3"> {EXTRA_NAV.map((item) => ( <Link key={item.label} href={item.href} onClick={() => setMenuOpen(false)} className=" hover:bg-primary hover:text-primary-foreground block rounded-xl px-3 py-2.5 text-sm" > {item.label} </Link> ))} </nav> </div> </div> </div> ) : null} <ShopActivityDrawer open={panelOpen} tab={panelTab} onOpenChange={setPanelOpen} onTabChange={setPanelTab} /> </> );
} 