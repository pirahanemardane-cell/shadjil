"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LumaSpin } from "@/components/ui/luma-spin";

type Ctx = { loading: boolean };
const LoaderCtx = createContext<Ctx>({ loading: true });

export function useSiteLoading() {
  return useContext(LoaderCtx);
}

/**
 * فقط لودینگ تمام‌صفحه — بدون هدر/فوتر/محتوا.
 * بک‌گراند = secondary برچسب | اسپین = primary برچسب
 */
export function SiteLoaderProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(t);
  }, [pathname]);

  if (loading) {
    return (
      <div
        className="shadjil-site-loader fixed inset-0 z-[9999] flex items-center justify-center"
        role="status"
        aria-live="polite"
        aria-label="در حال بارگذاری"
      >
        <LumaSpin />
      </div>
    );
  }

  return (
    <LoaderCtx.Provider value={{ loading: false }}>{children}</LoaderCtx.Provider>
  );
}
