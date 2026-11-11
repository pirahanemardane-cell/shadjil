import type { Metadata } from "next";
import dynamic from "next/dynamic";
import {
  ShieldCheck,
  Truck,
  RotateCcw,
  Headphones,
} from "lucide-react";
import { ProductService } from "@/services/product.service";
import { CategoryService } from "@/services/category.service";
import { BrandService } from "@/services/brand.service";
import { getFlashSaleEndsAtAction } from "@/app/admin/actions/flash-sale";
import type { ProductWithRelations } from "@/repositories/product.repository";

// Below-fold client islands — SSR HTML kept; JS deferred from critical path.
const CarouselLinks = dynamic(
  () => import("@/components/ui/carousel-cards").then((m) => m.CarouselLinks),
  { ssr: true },
);
const ProductCarousel = dynamic(
  () => import("@/components/ui/product-carousel").then((m) => m.ProductCarousel),
  { ssr: true },
);
const FlashSalePromoCard = dynamic(
  () =>
    import("@/components/home/flash-sale-promo-card").then(
      (m) => m.FlashSalePromoCard,
    ),
  { ssr: true },
);
const NewsletterSmsBox = dynamic(
  () =>
    import("@/components/home/newsletter-sms-box").then((m) => m.NewsletterSmsBox),
  { ssr: true },
);
const OrderTrackBox = dynamic(
  () => import("@/components/home/order-track-box").then((m) => m.OrderTrackBox),
  { ssr: true },
);

// ISR: HTML کش‌شده ۶۰ ثانیه
export const revalidate = 60;

export const metadata: Metadata = {
  title: "شادجیل | خرید آنلاین آجیل و خشکبار",
  description:
    "خرید شادجیل، ،  و سوغات از فروشگاه تخصصی شادجیل",
};

export default async function HomePage() {
  const productService = new ProductService();
  const categoryService = new CategoryService();
  const brandService = new BrandService();

  const settled = await Promise.allSettled([
    productService.getPublishedProducts({ page: 1, pageSize: 8, featured: true }),
    productService.getPublishedProducts({ page: 1, pageSize: 8, sort: "newest" }),
    productService.getPublishedProducts({ page: 1, pageSize: 12, bestseller: true }),
    categoryService.getRoots(),
    brandService.getActive(),
  ]);
  const pick = <T,>(i: number, fallback: T): T => {
    const s = settled[i];
    if (s.status === "fulfilled") return s.value as T;
    console.error("[home] section failed", i, s.reason);
    return fallback;
  };
  const featuredResult = pick(0, {
    success: false as const,
    data: null as {
      data: ProductWithRelations[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    } | null,
  });
  const newResult = pick(1, {
    success: false as const,
    data: null as {
      data: ProductWithRelations[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    } | null,
  });
  const bestsellerResult = pick(2, {
    success: false as const,
    data: null as {
      data: ProductWithRelations[];
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    } | null,
  });
  const categoriesResult = pick(3, {
    success: false as const,
    data: null as Array<{
      id: string;
      name: string;
      slug: string;
      parent_id: string | null;
      image_url?: string | null;
    }> | null,
  });
  const brandsResult = pick(4, {
    success: false as const,
    data: null as Array<{
      id: string;
      name: string;
      slug: string;
      logo_url?: string | null;
      name_fa?: string;
    }> | null,
  });

  const pageData = (r: { success?: boolean; data?: unknown }) => {
    if (!r?.success || !r.data || typeof r.data !== "object")
      return [] as ProductWithRelations[];
    const inner = (r.data as { data?: unknown }).data;
    return Array.isArray(inner) ? (inner as ProductWithRelations[]) : [];
  };
  const featured: ProductWithRelations[] = pageData(
    featuredResult as { success?: boolean; data?: unknown },
  );
  const newest: ProductWithRelations[] = pageData(
    newResult as { success?: boolean; data?: unknown },
  );
  const categories =
    categoriesResult.success && categoriesResult.data
      ? categoriesResult.data
      : [];
  const brands =
    brandsResult.success && brandsResult.data ? brandsResult.data : [];

  const bestsellersRaw: ProductWithRelations[] = pageData(
    bestsellerResult as { success?: boolean; data?: unknown },
  );
  const bestsellers =
    bestsellersRaw.length > 0
      ? bestsellersRaw
      : newest.filter((p) => p.is_bestseller).length
        ? newest.filter((p) => p.is_bestseller)
        : newest;

  const flashRes = await getFlashSaleEndsAtAction();
  const flashEndsAt = flashRes.ok ? flashRes.endsAt : null;
  const flashActive =
    Boolean(flashEndsAt) &&
    !Number.isNaN(new Date(flashEndsAt as string).getTime()) &&
    new Date(flashEndsAt as string).getTime() > Date.now();
  const deals = flashActive ? featured : [];

  const features = [
    { title: "تضمین تازگی", desc: "آجیل و خشکبار تازه و مرغوب", icon: ShieldCheck },
    { title: "ارسال سریع", desc: "ارسال به تمام نقاط ایران", icon: Truck },
    { title: "۷ روز ضمانت", desc: "امکان مرجوعی طبق شرایط", icon: RotateCcw },
    { title: "پشتیبانی", desc: "پاسخگویی قبل و بعد از خرید", icon: Headphones },
  ];

  return (
      <div className="mx-auto w-full max-w-none space-y-14 px-4 py-10 md:py-14">
          <section
            aria-label="اعتماد"
            className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4"
          >
            {features.map((f) => (
              <div
                key={f.title}
                className="bg-card flex flex-col gap-2 rounded-2xl border p-4"
              >
                <f.icon className="text-primary size-6" />
                <h3 className="text-sm font-semibold text-primary">{f.title}</h3>
                <p className="text-muted-foreground text-xs leading-6">{f.desc}</p>
              </div>
            ))}
          </section>

          {brands.length > 0 ? (
            <CarouselLinks
              title="محصولات ویژه"
              viewAllHref="/brands"
              variant="brand"
              items={brands.map((b) => ({
                id: b.id,
                label: b.name,
                labelFa: (b as { name_fa?: string }).name_fa || b.name,
                href: `/${encodeURIComponent(b.slug)}`,
                imageUrl: (b as { logo_url?: string | null }).logo_url || null,
              }))}
            />
          ) : null}

          {(() => {
            const HIDDEN = new Set(["متفرقه"]);
            const homeCats = categories.filter(
              (c) => !c.parent_id && !HIDDEN.has(String(c.name).trim()),
            );
            return homeCats.length > 0 ? (
              <CarouselLinks
                title="دسته‌بندی آجیل و خشکبار"
                viewAllHref="/products"
                variant="category"
                items={homeCats.map((cat) => ({
                  id: cat.id,
                  label: cat.name,
                  href: "/" + encodeURIComponent(cat.slug),
                  imageUrl:
                    (cat as { image_url?: string | null }).image_url ?? null,
                }))}
              />
            ) : null;
          })()}

          {newest.length > 0 ? (
            <ProductCarousel
              title="تازه‌ترین آجیل و خشکبار"
              viewAllHref="/products?sort=newest"
              products={newest}
              liveQuery={{ sort: "newest", pageSize: 8 }}
            />
          ) : (
            <section aria-label="تازه‌ترین آجیل و خشکبار">
              <h2 className="mb-5 text-xl font-bold text-primary md:text-2xl">
                تازه‌ترین آجیل و خشکبار
              </h2>
              <p className="text-muted-foreground text-sm">
                فعلاً محصول جدیدی موجود نیست.
              </p>
            </section>
          )}

          <section aria-label="پیشنهاد ویژه شادجیل">
            {flashActive && (deals.length > 0 || flashEndsAt) ? (
              <ProductCarousel
                title="پیشنهاد ویژه شادجیل"
                viewAllHref="/products?featured=1"
                products={deals}
                liveQuery={{ featured: true, pageSize: 8 }}
                leading={
                  flashEndsAt ? (
                    <FlashSalePromoCard endsAt={flashEndsAt} />
                  ) : null
                }
              />
            ) : (
              <>
                <h2 className="mb-5 text-xl font-bold text-primary md:text-2xl">
                  پیشنهاد ویژه شادجیل
                </h2>
                <p className="text-muted-foreground text-sm">
                  پیشنهاد ویژه شادجیلی فعلاً فعال نیست.
                </p>
              </>
            )}
          </section>

          {bestsellers.length > 0 ? (
            <ProductCarousel
              title="پرفروش‌ترین آجیل‌ها"
              viewAllHref="/products?sort=popular"
              products={bestsellers}
              liveQuery={{ sort: "popular", pageSize: 12 }}
            />
          ) : (
            <section aria-label="پرفروش‌ترین آجیل‌ها">
              <h2 className="mb-5 text-xl font-bold text-primary md:text-2xl">
                پرفروش‌ترین آجیل‌ها
              </h2>
              <p className="text-muted-foreground text-sm">
                پرفروش‌ترین آجیل‌ها فعلاً خالی است.
              </p>
            </section>
          )}
          <section className="grid gap-6 md:grid-cols-2">
            <NewsletterSmsBox />
            <OrderTrackBox />
          </section>
      </div>
  );
}
