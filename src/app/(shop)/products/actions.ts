"use server";

import { ProductService } from "@/services/product.service";
import type { ProductWithRelations } from "@/repositories/product.repository";

export type LoadProductsResult = {
  success: boolean;
  products: ProductWithRelations[];
  page: number;
  totalPages: number;
  hasMore: boolean;
  error?: string;
};

export async function loadProductsPage(input: {
  page: number;
  pageSize?: number;
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
}): Promise<LoadProductsResult> {
  const service = new ProductService();
  const pageSize = input.pageSize ?? 12;

  const result = await service.getPublishedProducts({
    page: input.page,
    pageSize,
    categorySlug: input.categorySlug,
    brandSlug: input.brandSlug,
    tagSlug: input.tagSlug,
    q: input.q,
    sort: input.sort ?? "newest",
    featured: input.featured,
    attrs: input.attrs,
    roastId: input.roastId,
    weightId: input.weightId,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
  });

  if (!result.success) {
    return {
      success: false,
      products: [],
      page: input.page,
      totalPages: 0,
      hasMore: false,
      error: result.error ?? undefined,
    };
  }

  if (!result.data) {
    return {
      success: false,
      products: [],
      page: input.page,
      totalPages: 0,
      hasMore: false,
      error: result.error ?? undefined,
    };
  }
  const { data, page, totalPages } = result.data;

  return {
    success: true,
    products: data,
    page,
    totalPages,
    hasMore: page < totalPages,
  };
}
