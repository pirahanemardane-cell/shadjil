"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { ProductWithRelations } from "@/repositories/product.repository";
import {
  loadProductsPage,
  type LoadProductsResult,
} from "@/app/(shop)/products/actions";
import { EmptyBlock } from "@/components/ui/ui-state-blocks";
import { ProductCard } from "./product-card";
import { LumaSpin } from "@/components/ui/luma-spin";
import { useRtEvent } from "@/hooks/use-rt-event";
import { RT } from "@/lib/realtime/events";

type Props = {
  initialProducts: ProductWithRelations[];
  initialPage: number;
  initialHasMore: boolean;
  categorySlug?: string;
  brandSlug?: string;
  tagSlug?: string;
  q?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "popular";
  featured?: boolean;
  attrs?: Record<string, string>;
  roastId?: string;
  weightId?: string;
  minPrice?: number;
  maxPrice?: number;
};

export function ProductInfiniteList({
  initialProducts,
  initialPage,
  initialHasMore,
  categorySlug,
  brandSlug,
  tagSlug,
  q,
  sort,
  featured,
  attrs,
  roastId,
  weightId,
  minPrice,
  maxPrice,
}: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    setProducts(initialProducts);
    setPage(initialPage);
    setHasMore(initialHasMore);
    setError(null);
  }, [initialProducts, initialPage, initialHasMore]);

  const reloadFirstPage = useCallback(() => {
    startTransition(async () => {
      const result = await loadProductsPage({
        page: 1,
        pageSize: 12,
        categorySlug,
        brandSlug,
        tagSlug,
        q,
        sort,
        featured,
        attrs,
        roastId,
        weightId,
        minPrice,
        maxPrice,
      });
      if (result.success) {
        setProducts(result.products);
        setPage(1);
        setHasMore(result.hasMore);
        setError(null);
      }
    });
  }, [
    categorySlug,
    brandSlug,
    tagSlug,
    q,
    sort,
    featured,
    attrs,
    roastId,
    weightId,
    minPrice,
    maxPrice,
  ]);

  useRtEvent(RT.catalog, () => {
    reloadFirstPage();
  });

  useRtEvent(RT.stock, () => {
    reloadFirstPage();
  });

  const loadMore = useCallback(() => {
    if (!hasMore || loadingRef.current) return;
    loadingRef.current = true;

    startTransition(async () => {
      const nextPage = page + 1;
      const result: LoadProductsResult = await loadProductsPage({
        page: nextPage,
        pageSize: 12,
        categorySlug,
        brandSlug,
        tagSlug,
        q,
        sort,
        featured,
        attrs,
        roastId,
        weightId,
        minPrice,
        maxPrice,
      });

      if (!result.success) {
        setError(result.error ?? "خطا در بارگذاری");
        loadingRef.current = false;
        return;
      }

      setProducts((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const p of result.products) {
          if (!ids.has(p.id)) merged.push(p);
        }
        return merged;
      });
      setPage(result.page);
      setHasMore(result.hasMore);
      setError(null);
      loadingRef.current = false;
    });
  }, [
    hasMore,
    page,
    categorySlug,
    brandSlug,
    tagSlug,
    q,
    sort,
    featured,
    attrs,
    roastId,
    weightId,
    minPrice,
    maxPrice,
  ]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore]);

  if ((products?.length ?? 0) === 0) {
    return (
      <EmptyBlock
        title="محصولی یافت نشد"
        description="فیلترها را تغییر دهید یا بعداً سر بزنید."
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 lg:grid-cols-3">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      <div
        ref={sentinelRef}
        className="flex min-h-10 items-center justify-center"
      >
        {isPending ? (
          <div className="flex justify-center py-8" dir="rtl">
            <LumaSpin />
          </div>
        ) : null}
        {!hasMore && (products?.length ?? 0) > 0 ? (
          <p className="text-muted-foreground text-sm">
            همه محصولات نمایش داده شد
          </p>
        ) : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
    </div>
  );
}
