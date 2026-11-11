import { BaseRepository } from "./base.repository";
import type { Product, ProductVariant, ProductImage } from "@/types/database";
import type { ProductFilterInput } from "@/lib/validation/product";
import { normalizeProductSlug } from "@/lib/product-slug";
import { expandTypoVariants, normalizeSearchQuery } from "@/lib/search/normalize";
import { isBlockedBrand } from "@/lib/brands/blocked";

export type ProductWithRelations = Product & {
  brand?: { id: string; name: string; slug: string } | null;
  category?: { id: string; name: string; slug: string } | null;
  variants?: ProductVariant[];
  images?: ProductImage[];
};

export class ProductRepository extends BaseRepository {
  async findPublished(filters: ProductFilterInput = { page: 1, pageSize: 12 }) {
    const client = await this.getClient();
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? filters.limit ?? 12;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = client
      .from("products")
      .select(
        `
        id,
        name,
        slug,
        status,
        is_featured,
        is_new,
        is_bestseller,
        created_at,
        brand:brands(id, name, slug),
        category:categories(id, name, slug),
        images:product_images(id, url, alt_text, is_primary, sort_order, variant_id),
        variants:product_variants(id, price, original_price, stock_quantity, weight, roast_name, roast_hex, is_active, sku)
      `,
        { count: "exact" }
      )
      .eq("status", "published")
      .is("deleted_at", null);

    // دسته‌بندی: خود دسته + همه زیردسته‌های مستقیم
    if (filters.categorySlug) {
      let catSlug = String(filters.categorySlug);
      for (let i = 0; i < 3; i++) {
        try {
          const d = decodeURIComponent(catSlug);
          if (d === catSlug) break;
          catSlug = d;
        } catch {
          break;
        }
      }
      const { data: category } = await client
        .from("categories")
        .select("id")
        .eq("slug", catSlug)
        .eq("is_active", true)
        .maybeSingle();
      if (category) {
        const parentId = (category as { id: string }).id;
        const { data: children } = await client
          .from("categories")
          .select("id")
          .eq("parent_id", parentId)
          .eq("is_active", true);
        const ids = [
          parentId,
          ...((children ?? []) as { id: string }[]).map((c) => c.id),
        ];
        query = query.in("category_id", ids);
      }
    }

    // برند
    if (filters.brandSlug) {
      if (isBlockedBrand({ slug: filters.brandSlug, name: filters.brandSlug })) {
        // Blocked brand — force empty product set
        query = query.eq("brand_id", "00000000-0000-0000-0000-000000000000");
      } else {
        const { data: brand } = await client
          .from("brands")
          .select("id")
          .eq("slug", filters.brandSlug)
          .eq("is_active", true)
          .maybeSingle();
        if (brand) query = query.eq("brand_id", brand.id);
      }
    }

    // برچسب محصول (product_tags → product_tag_map)
    if (filters.tagSlug) {
      let tagSlug = String(filters.tagSlug);
      for (let i = 0; i < 3; i++) {
        try {
          const d = decodeURIComponent(tagSlug);
          if (d === tagSlug) break;
          tagSlug = d;
        } catch {
          break;
        }
      }
      const { data: tag } = await client
        .from("product_tags")
        .select("id")
        .eq("slug", tagSlug)
        .eq("is_active", true)
        .maybeSingle();
      if (!tag) {
        query = query.eq("id", "00000000-0000-0000-0000-000000000000");
      } else {
        const { data: mapRows } = await client
          .from("product_tag_map")
          .select("product_id")
          .eq("tag_id", (tag as { id: string }).id);
        const ids = ((mapRows ?? []) as { product_id: string }[]).map(
          (r) => r.product_id,
        );
        if (!ids.length) {
          query = query.eq("id", "00000000-0000-0000-0000-000000000000");
        } else {
          query = query.in("id", ids);
        }
      }
    }

    // فیلتر attribute (facet) — AND بین attributeها
    if (filters.attrs && Object.keys(filters.attrs).length > 0) {
      let matchedIds: string[] | null = null;

      for (const [attrSlug, optionSlug] of Object.entries(filters.attrs)) {
        if (!attrSlug || !optionSlug) continue;

        const { data: attr } = await client
          .from("attributes")
          .select("id")
          .eq("slug", attrSlug)
          .eq("is_filterable", true)
          .maybeSingle();
        if (!attr) {
          matchedIds = [];
          break;
        }

        const { data: opt } = await client
          .from("attribute_options")
          .select("id")
          .eq("attribute_id", (attr as { id: string }).id)
          .eq("slug", optionSlug)
          .maybeSingle();
        if (!opt) {
          matchedIds = [];
          break;
        }

        const { data: pav } = await client
          .from("product_attribute_values")
          .select("product_id")
          .eq("attribute_id", (attr as { id: string }).id)
          .eq("option_id", (opt as { id: string }).id);

        const ids = (pav ?? []).map(
          (r) => (r as { product_id: string }).product_id
        );
        matchedIds =
          matchedIds === null
            ? ids
            : matchedIds.filter((id) => ids.includes(id));

        if (matchedIds.length === 0) break;
      }

      if (matchedIds !== null) {
        if (matchedIds.length === 0) {
          return {
            data: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
          };
        }
        query = query.in("id", matchedIds);
      }
    }

    // فلگ‌ها
    if (filters.featured === true) query = query.eq("is_featured", true);
    if (filters.isNew === true) query = query.eq("is_new", true);
    if (filters.bestseller === true) query = query.eq("is_bestseller", true);

    // جستجو: چند فیلد + واریانت غلط‌املای سبک
    if (filters.q) {
      const variants = expandTypoVariants(String(filters.q));
      const terms = variants.length ? variants : [normalizeSearchQuery(String(filters.q))];
      const orParts: string[] = [];
      for (const term of terms) {
        const safe = term.replace(/%/g, "").replace(/,/g, " ").slice(0, 80);
        if (!safe) continue;
        orParts.push(`name.ilike.%${safe}%`);
        orParts.push(`short_description.ilike.%${safe}%`);
        orParts.push(`slug.ilike.%${safe}%`);
      }
      if (orParts.length) {
        query = query.or(orParts.join(","));
      }
    }

    // مرتب‌سازی بر اساس
    switch (filters.sort) {
      case "price_asc":
      case "price_desc":
        // مرتب‌سازی بر اساس دقیق قیمت نیاز به view دارد؛ فعلاً newest
        query = query.order("created_at", { ascending: false });
        break;
      case "popular":
        query = query.order("review_count", { ascending: false });
        break;
      default:
        query = query.order("created_at", { ascending: false });
    }

    query = query.range(from, to);

    const { data, error, count } = await query;
    if (error) throw error;

    let items = (data ?? []) as unknown as ProductWithRelations[];

    // UUID فیلتر → برچسب متنی واریانت (weight / roast_name)
    let weightLabel: string | null = null;
    let roastName: string | null = null;
    
    const resolvedSizeName: string | undefined = filters.weightValue;
    const resolvedColorName: string | undefined = filters.roastValue;
if (filters.weightId) {
      const { data: sz } = await client
        .from("weights") /* attr-aware */
        .select("name, slug")
        .eq("id", filters.weightId)
        .maybeSingle();
      if (sz) {
        const row = sz as { name?: string; slug?: string };
        weightLabel = (row.name || row.slug || "").trim() || null;
      }
    }
    if (filters.roastId) {
      const { data: cl } = await client
        .from("roasts")
        .select("name, slug")
        .eq("id", filters.roastId)
        .maybeSingle();
      if (cl) {
        const row = cl as { name?: string; slug?: string };
        roastName = (row.name || row.slug || "").trim() || null;
      }
    }

    if (
      filters.weightId ||
      filters.weightValue ||
      filters.roastId ||
      filters.roastValue ||
      filters.inStock ||
      filters.minPrice != null ||
      filters.maxPrice != null
    ) {
      items = items.filter((p) => {
        const variants = (p.variants ?? []).filter((v) => v.is_active);
        return variants.some((v) => {
          if (filters.weightId || filters.weightValue) {
            const wantSize = resolvedSizeName;
            if (wantSize && String(v.weight || "").toLowerCase() !== String(wantSize).toLowerCase()) return false;
            if (!weightLabel) return false;
            const sn = (
              typeof (v as { weight?: string | null }).weight === "string"
                ? (v as { weight: string }).weight
                : ""
            ).trim();
            if (!sn || sn.toLowerCase() !== weightLabel.toLowerCase()) return false;
          }
          if (filters.roastId || filters.roastValue) {
            const wantColor = resolvedColorName;
            if (wantColor && String(v.roast_name || "").toLowerCase() !== String(wantColor).toLowerCase()) return false;
            if (!roastName) return false;
            const cn = (
              typeof (v as { roast_name?: string | null }).roast_name === "string"
                ? (v as { roast_name: string }).roast_name
                : ""
            ).trim();
            if (!cn || cn.toLowerCase() !== roastName.toLowerCase()) return false;
          }
          if (filters.inStock && v.stock_quantity <= 0) return false;
          if (filters.minPrice != null && Number(v.price) < filters.minPrice)
            return false;
          if (filters.maxPrice != null && Number(v.price) > filters.maxPrice)
            return false;
          return true;
        });
      });
    }

    return {
      data: items,
      total: count ?? items.length,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? items.length) / pageSize),
    };
  }

  async findBySlug(slug: string) {
    const client = await this.getClient();
    const normalized = normalizeProductSlug(slug);
    if (!normalized) return null;

    const selectCols = `
        id,
        name,
        slug,
        status,
        short_description,
        description,
        is_featured,
        is_new,
        is_bestseller,
        created_at,
        category_id,
        brand_id,
        weight_guide_id,
        meta_title,
        meta_description,
        og_title,
        og_description,
        og_image_url,
        robots_index,
        robots_follow,
        canonical_url,
        brand:brands(id, name, slug),
        category:categories(id, name, slug),
        images:product_images(id, url, alt_text, is_primary, sort_order, variant_id),
        variants:product_variants(id, price, original_price, stock_quantity, weight, roast_name, roast_hex, is_active, sku)
      `;

    // 1) exact match
    {
      const { data, error } = await client
        .from("products")
        .select(selectCols)
        .eq("slug", normalized)
        .eq("status", "published")
        .is("deleted_at", null)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("[findBySlug exact]", normalized, error);
        throw error;
      }
      if (data) return data as unknown as ProductWithRelations;
    }

    // 2) raw param (اگر decode فرق داشته)
    const raw = (slug || "").trim();
    if (raw && raw !== normalized) {
      const { data, error } = await client
        .from("products")
        .select(selectCols)
        .eq("slug", raw)
        .eq("status", "published")
        .is("deleted_at", null)
        .maybeSingle();
      if (error && error.code !== "PGRST116") {
        console.error("[findBySlug raw]", raw, error);
        throw error;
      }
      if (data) return data as unknown as ProductWithRelations;
    }

    // 3) fallback: بین publishedها اسلاگ نرمال‌شده را پیدا کن
    const { data: rows, error: listErr } = await client
      .from("products")
      .select(selectCols)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (listErr) {
      console.error("[findBySlug fallback list]", listErr);
      throw listErr;
    }
    const hit = (rows ?? []).find(
      (r) => normalizeProductSlug(String((r as { slug?: string }).slug ?? "")) === normalized,
    );
    return (hit as unknown as ProductWithRelations) ?? null;
  }

  async findById(id: string) {
    const client = await this.getClient();

    const { data, error } = await client
      .from("products")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data as Product;
  }

  /** لیست ادمین — همه وضعیت‌ها (غیرحذف‌شده) */
  async listAdmin(limit = 50) {
    const client = await this.getClient();
    const { data, error } = await client
      .from("products")
      .select(
        `
        id,
        name,
        slug,
        status,
        is_featured,
        is_new,
        is_bestseller,
        created_at,
        brand:brands(id, name),
        category:categories(id, name)
      `
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  }

  async updateFlags(
    id: string,
    flags: {
      status?: string;
      is_featured?: boolean;
      is_new?: boolean;
      is_bestseller?: boolean;
    },
  ) {
    const client = await this.getClient();
    const patch: Record<string, unknown> = {};
    if (flags.status !== undefined) patch.status = flags.status;
    if (flags.is_featured !== undefined) patch.is_featured = flags.is_featured;
    if (flags.is_new !== undefined) patch.is_new = flags.is_new;
    if (flags.is_bestseller !== undefined) patch.is_bestseller = flags.is_bestseller;
    if (!Object.keys(patch).length) return true;
    const { error } = await client.from("products").update(patch as never).eq("id", id);
    if (error) throw error;
    return true;
  }

}
