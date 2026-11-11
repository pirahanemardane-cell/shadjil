import { CatalogRealtimeRefresh } from "@/components/shop/catalog-realtime-refresh";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { createPublicClient } from "@/lib/supabase/public";
import { ProductService } from "@/services/product.service";
import { CategoryService } from "@/services/category.service";
import { AttributeService } from "@/services/attribute.service";
import { ColorRepository } from "@/repositories/color.repository";
import { SizeRepository } from "@/repositories/size.repository";
import { ProductInfiniteList } from "@/components/product/product-infinite-list";
import { ProductFiltersSidebar } from "@/components/product/product-filters-sidebar";
import { ProductFiltersMobile } from "@/components/product/product-filters-mobile";
import { facetSlugsForCategory } from "@/lib/facet-map";
import { toPersianDigits } from "@/lib/numbers";
import { JsonLd } from "@/components/seo/json-ld";
import { collectionPageSchema, breadcrumbSchema } from "@/lib/seo/schema";

export const revalidate = 60;

const FACET_KEYS = [
  "weight",
  "nut-type",
  "origin",
  "grade",
  "salted",
  "raw",
  "pack-weight",
  "weight-250",
  "weight-500",
  "weight-1kg",
  "premium",
] as const;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function decodeSlug(raw: string): string {
  let s = raw;
  for (let i = 0; i < 3; i++) {
    try {
      const d = decodeURIComponent(s);
      if (d === s) break;
      s = d;
    } catch {
      break;
    }
  }
  return s;
}

async function getActiveTagBySlug(slug: string) {
  const client = createPublicClient();
  const { data, error } = await client
    .from("product_tags")
    .select("id, name, slug, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error || !data) return null;
  return data as { id: string; name: string; slug: string; is_active: boolean };
}

/** برچسب محصول: لیست واقعی — برای موتور جستجو همیشه noindex */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = decodeSlug((await params).slug);
  const tag = await getActiveTagBySlug(slug);
  if (!tag) {
    return {
      title: "برچسب",
      robots: { index: false, follow: false },
    };
  }
  return {
    title: `برچسب: ${tag.name}`,
    description: `محصولات با برچسب ${tag.name} در شادجیل`,
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

export default async function ProductTagListingPage({
  params,
  searchParams,
}: Props) {
  const slug = decodeSlug((await params).slug);
  const sp = await searchParams;

  const tag = await getActiveTagBySlug(slug);
  if (!tag) notFound();

  const productService = new ProductService();
  const categoryService = new CategoryService();
  const attributeService = new AttributeService();

  const categorySlug =
    typeof sp.category === "string" ? sp.category : undefined;
  const brandSlug = typeof sp.brand === "string" ? sp.brand : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const sort =
    typeof sp.sort === "string"
      ? (sp.sort as "newest" | "price_asc" | "price_desc" | "popular")
      : "newest";
  const featured = sp.featured === "1" ? true : undefined;
  const minPrice =
    typeof sp.minPrice === "string" && sp.minPrice
      ? Number(sp.minPrice)
      : undefined;
  const maxPrice =
    typeof sp.maxPrice === "string" && sp.maxPrice
      ? Number(sp.maxPrice)
      : undefined;
  const roastSlug =
    typeof sp.roast === "string" && sp.roast ? sp.roast : undefined;
  const weightSlug =
    typeof sp.weight === "string" && sp.weight ? sp.weight : undefined;

  const attrs: Record<string, string> = {};
  for (const key of FACET_KEYS) {
    const v = sp[key];
    if (typeof v === "string" && v) attrs[key] = v;
  }

  const rootsResult = await categoryService.getRoots();
  const categories = rootsResult.success
    ? (rootsResult.data ?? []).map((c: { name: string; slug: string }) => ({
        name: c.name,
        slug: c.slug,
      }))
    : [];

  const facetsResult = await attributeService.getFilterableFacets();
  const allFacets = facetsResult.success ? (facetsResult.data ?? []) : [];
  const allowed = new Set(facetSlugsForCategory(categorySlug));
  const facets = allFacets.filter((f) => allowed.has(f.slug));

  const roastAttr = allFacets.find((f) => f.slug === "roast");
  const weightAttr = allFacets.find((f) => f.slug === "weight");
  type Chip = { id: string; name: string; slug: string; hex?: string | null };
  let roasts: Chip[] = (roastAttr?.options ?? []).map((o) => ({
    id: o.id,
    name: o.value,
    slug: o.slug || o.value,
    hex: (o as { hex?: string | null }).hex ?? null,
  }));
  let weights: Chip[] = (weightAttr?.options ?? []).map((o) => ({
    id: o.id,
    name: o.value,
    slug: o.slug || o.value,
  }));
  const roastRepo = new ColorRepository();
  const weightRepo = new SizeRepository();
  if (!roasts.length || !weights.length) {
    const [legacyColors, legacySizes] = await Promise.all([
      roastRepo
        .findAllActive()
        .catch(() => [] as Awaited<ReturnType<ColorRepository["findAllActive"]>>),
      weightRepo
        .findAllActive()
        .catch(() => [] as Awaited<ReturnType<SizeRepository["findAllActive"]>>),
    ]);
    if (!roasts.length) {
      roasts = legacyColors.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        hex: (c as { hex_code?: string | null }).hex_code ?? null,
      }));
    }
    if (!weights.length) {
      weights = legacySizes.map((s) => ({
        id: s.id,
        name: s.name,
        slug: s.slug,
      }));
    }
  }
  const roastOpt = roastSlug
    ? roasts.find((c) => c.slug === roastSlug || c.name === roastSlug)
    : undefined;
  const weightOpt = weightSlug
    ? weights.find((s) => s.slug === weightSlug || s.name === weightSlug)
    : undefined;
  const roastValue = roastOpt?.name;
  const weightValue = weightOpt?.name;
  let roastId: string | undefined;
  let weightId: string | undefined;
  if (roastSlug && !roastAttr) {
    const c = await roastRepo.findBySlug(roastSlug).catch(() => null);
    roastId = c?.id;
  }
  if (weightSlug && !weightAttr) {
    const s = await weightRepo.findBySlug(weightSlug).catch(() => null);
    weightId = s?.id;
  }

  const result = await productService.getPublishedProducts({
    page: 1,
    pageSize: 12,
    tagSlug: slug,
    brandSlug,
    categorySlug,
    q,
    sort,
    featured,
    attrs: Object.keys(attrs).length ? attrs : undefined,
    weightValue,
    roastValue,
    minPrice: minPrice && !Number.isNaN(minPrice) ? minPrice : undefined,
    maxPrice: maxPrice && !Number.isNaN(maxPrice) ? maxPrice : undefined,
    roastId,
    weightId,
  });

  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://shadjil.ir").replace(
    /\/$/,
    "",
  );
  const tagUrl = `${site}/tag/${encodeURIComponent(slug)}`;

  if (!result.success || !result.data) {
    return (
      <>
        <JsonLd
          data={[
            collectionPageSchema({
              name: tag.name,
              description: `محصولات با برچسب ${tag.name}`,
              url: tagUrl,
            }),
            breadcrumbSchema([
              { name: "خانه", url: `${site}/` },
              { name: `برچسب: ${tag.name}`, url: tagUrl },
            ]),
          ]}
        />
        <CatalogRealtimeRefresh />
        <main className="mx-auto w-full max-w-none px-4 py-12">
          <p className="text-destructive text-center">
            {result.error ?? "خطا"}
          </p>
        </main>
      </>
    );
  }

  const { data: products, total, page, totalPages } = result.data;
  const attrsProp = Object.keys(attrs).length ? attrs : undefined;

  return (
    <main className="mx-auto w-full max-w-none px-4 py-8 md:py-12" dir="rtl">
      <JsonLd
        data={[
          collectionPageSchema({
            name: tag.name,
            description: `محصولات با برچسب ${tag.name}`,
            url: tagUrl,
          }),
          breadcrumbSchema([
            { name: "خانه", url: `${site}/` },
            { name: `برچسب: ${tag.name}`, url: tagUrl },
          ]),
        ]}
      />
      <CatalogRealtimeRefresh />

      <div className="mb-8">
        <h1 className="font-iranyekan-heavy text-primary text-2xl md:text-3xl">
          برچسب: {tag.name}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {toPersianDigits(String(total))} محصول
        </p>
      </div>

      <ProductFiltersMobile
        roasts={roasts}
        weights={weights}
        roastSlug={roastSlug}
        weightSlug={weightSlug}
        facets={facets}
        current={attrs}
        categories={categories}
        categorySlug={categorySlug}
        brandSlug={brandSlug}
        q={q}
        sort={sort}
        featured={featured}
        minPrice={minPrice}
        maxPrice={maxPrice}
      />

      <div className="flex flex-col gap-8 lg:flex-row">
        <Suspense
          fallback={
            <aside className="border-border bg-card hidden w-64 shrink-0 rounded-xl border p-4 lg:block" />
          }
        >
          <ProductFiltersSidebar
            roasts={roasts}
            weights={weights}
            roastSlug={roastSlug}
            weightSlug={weightSlug}
            facets={facets}
            current={attrs}
            categories={categories}
            categorySlug={categorySlug}
            brandSlug={brandSlug}
            q={q}
            sort={sort}
            featured={featured}
            minPrice={minPrice}
            maxPrice={maxPrice}
          />
        </Suspense>
        <div className="min-w-0 flex-1">
          <ProductInfiniteList
            initialProducts={products}
            initialPage={page}
            initialHasMore={page < totalPages}
            categorySlug={categorySlug}
            brandSlug={brandSlug}
            tagSlug={slug}
            q={q}
            sort={sort}
            featured={featured}
            attrs={attrsProp}
            roastId={roastId}
            weightId={weightId}
            minPrice={minPrice}
            maxPrice={maxPrice}
          />
        </div>
      </div>
    </main>
  );
}
