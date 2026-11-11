"use server";
import { notifyOrderPlaced } from "@/lib/sms/transactional";
import { emailOrderPlaced } from "@/lib/email/send";

import { createClient } from "@/lib/supabase/server";
import { WishlistRepository } from "@/repositories/wishlist.repository";
import { AddressRepository, type AddressInput } from "@/repositories/address.repository";
import { ProductRepository } from "@/repositories/product.repository";
import { CartRepository } from "@/repositories/cart.repository";
import { quoteShippingAction } from "@/app/(shop)/actions/shipping";
import { OrderRepository } from "@/repositories/order.repository";
import { cookies } from "next/headers";
import { assertNoLinkOrImage } from "@/lib/sanitize-user-text";
import { randomUUID } from "crypto";
import { normalizeIranMobile, normalizeIranPostalCode } from "@/lib/numbers";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { headers } from "next/headers";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

const CART_SID_COOKIE = "pm_cart_sid";
const CART_SID_MAX_AGE = 60 * 60 * 24 * 30;

function cartCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: CART_SID_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  };
}

/** مهمان: کوکی پایدار سبد؛ در هر نوشتن سبد تمدید می‌شود */
async function getSessionId() {
  const jar = await cookies();
  let sid = jar.get(CART_SID_COOKIE)?.value?.trim();
  if (!sid || sid.length < 8) {
    sid = randomUUID();
  }
  // همیشه set تا تمدید maxAge و secure در prod اعمال شود
  try {
    jar.set(CART_SID_COOKIE, sid, cartCookieOptions());
  } catch (e) {
    // در بعضی مسیرهای RSC set ممکن است throw کند — sid را برمی‌گردانیم
    console.warn("[getSessionId] cookie set skipped", e);
  }
  return sid;
}

async function resolveCartId() {
  const user = await requireUser();
  const cartRepo = new CartRepository();
  const sessionId = await getSessionId();

  // اگر لاگین است: سبد کاربر + ادغام سبد مهمان (cookie)
  if (user?.id) {
    try {
      await cartRepo.mergeSessionIntoUser(sessionId, user.id);
    } catch (e) {
      console.error("[mergeSessionIntoUser]", e);
    }
    return cartRepo.getOrCreateCart({ userId: user.id, sessionId: null });
  }

  // مهمان: فقط session
  return cartRepo.getOrCreateCart({ userId: null, sessionId });
}

export async function toggleWishlistAction(productId: string) {
  const user = await requireUser();
  if (!user) {
    return { ok: false as const, error: "login_required" };
  }
  try {
    const repo = new WishlistRepository();
    const { added } = await repo.toggle(user.id, productId);
    return { ok: true as const, added };
  } catch (e) {
    console.error("[toggleWishlist]", e);
    return { ok: false as const, error: "server" };
  }
}



export type WishlistItemDTO = {
  productId: string;
  title: string;
  slug: string;
  price: number;
  image?: string;
};

export async function listWishlistAction(): Promise<{
  ok: boolean;
  items: WishlistItemDTO[];
  error?: string;
}> {
  try {
    const user = await requireUser();
    if (!user) return { ok: false, items: [], error: "login_required" };
    const repo = new WishlistRepository();
    const ids = await repo.listProductIds(user.id);
    if (!ids.length) return { ok: true, items: [] };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        name,
        slug,
        product_variants(price),
        product_images(url, is_primary, sort_order, variant_id)
      `
      )
      .in("id", ids)
      .eq("status", "published")
      .is("deleted_at", null);
    if (error) throw error;

    const items: WishlistItemDTO[] = (data ?? []).map((p: any) => {
      const images = (p.product_images ?? []) as {
        url: string;
        is_primary?: boolean;
        sort_order?: number;
      }[];
      const sorted = images
        .slice()
        .sort(
          (a, b) =>
            Number(b.is_primary) - Number(a.is_primary) ||
            (a.sort_order ?? 0) - (b.sort_order ?? 0)
        );
      const variants = (p.product_variants ?? []) as { price?: number }[];
      const price = variants.length
        ? Math.min(...variants.map((v) => Number(v.price ?? 0)))
        : 0;
      return {
        productId: p.id,
        title: p.name ?? "محصول",
        slug: p.slug ?? "",
        price,
        image: sorted[0]?.url,
      };
    });
    return { ok: true, items };
  } catch (e) {
    console.error("[listWishlist]", e);
    return { ok: false, items: [], error: "server" };
  }
}

export async function addToCartAction(variantId: string, quantity = 1) {
  try {
    if (!variantId) {
      return { ok: false as const, error: "variant_required" };
    }
    let ip = "unknown";
    try {
      const h = await headers();
      ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        h.get("x-real-ip") ||
        "unknown";
    } catch {}
    const rl = await checkRateLimit({ identifier: ip, type: "cart" });
    if (!rl.success) {
      return { ok: false as const, error: "rate_limit" };
    }
    const cartRepo = new CartRepository();
    const cartId = await resolveCartId(); // user یا session cookie
    await cartRepo.addItem(cartId, variantId, quantity);
    return { ok: true as const };
  } catch (e) {
    console.error("[addToCart]", e);
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as { message: string }).message)
        : e instanceof Error
          ? e.message
          : String(e);
    return { ok: false as const, error: msg };
  }
}

export async function updateCartQuantityAction(
  variantId: string,
  quantity: number
) {
  try {
    if (!variantId) return { ok: false as const, error: "missing_variant" };
    const cartId = await resolveCartId();
    if (!cartId) return { ok: false as const, error: "no_cart" };
    const cartRepo = new CartRepository();
    const q = Math.max(0, Math.min(99, Math.floor(Number(quantity) || 0)));
    await cartRepo.setQuantity(cartId, variantId, q);
    return { ok: true as const };
  } catch (e) {
    console.error("[updateCartQty]", e);
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as { message: string }).message)
        : e instanceof Error
          ? e.message
          : "server";
    if (msg.startsWith("insufficient_stock")) {
      return { ok: false as const, error: msg };
    }
    return { ok: false as const, error: msg || "server" };
  }
}

export async function removeCartItemAction(variantId: string) {
  try {
    const cartId = await resolveCartId();
    const cartRepo = new CartRepository();
    await cartRepo.removeItem(cartId, variantId);
    return { ok: true as const };
  } catch (e) {
    console.error("[removeCartItem]", e);
    return { ok: false as const, error: "server" };
  }
}

export async function swapCartVariantAction(input: {
  oldVariantId: string;
  productId: string;
  roastHex?: string | null;
  weight?: string | null;
  quantity?: number;
}): Promise<{ ok: boolean; error?: string; variantId?: string }> {
  try {
    const qty = Math.max(1, Number(input.quantity) || 1);
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: vars, error } = await supabase
      .from("product_variants")
      .select("id, roast_name, roast_hex, weight, is_active, stock_quantity")
      .eq("product_id", input.productId)
      .eq("is_active", true);
    if (error) throw error;

    const norm = (s?: string | null) =>
      (s || "").trim().replace(/^#/, "").toLowerCase();
    const wantHex = norm(input.roastHex);
    const wantSize = (input.weight || "").trim().toUpperCase();

    const match = (vars ?? []).find((v: any) => {
      const hex = norm(v.roast_hex);
      const name = norm(v.roast_name);
      const szRaw = v.weight;
      const sz =
        typeof szRaw === "string"
          ? szRaw.trim().toUpperCase()
          : szRaw && typeof szRaw === "object"
            ? String(szRaw.name || "").trim().toUpperCase()
            : "";
      const roastOk =
        !wantHex ||
        hex === wantHex ||
        name === wantHex ||
        norm(v.roast_hex || v.roast_name) === wantHex;
      const weightOk = !wantSize || sz === wantSize;
      return roastOk && weightOk;
    });

    if (!match?.id) return { ok: false, error: "variant_not_found" };

    const stock = Math.max(0, Number((match as { stock_quantity?: number }).stock_quantity ?? 0));
    if (stock < qty) {
      return { ok: false, error: `insufficient_stock:${stock}` };
    }
    if (match.id === input.oldVariantId) {
      return { ok: true, variantId: match.id as string };
    }

    const cartId = await resolveCartId();
    const cartRepo = new CartRepository();
    await cartRepo.removeItem(cartId, input.oldVariantId);
    await cartRepo.addItem(cartId, match.id as string, qty);
    return { ok: true, variantId: match.id as string };
  } catch (e) {
    console.error("[swapCartVariant]", e);
    return { ok: false, error: "server" };
  }
}



export type CartLineDTO = {
  itemId: string;
  variantId: string;
  quantity: number;
  price: number;
  productId: string;
  title: string;
  slug: string;
  image?: string;
  weight?: string;
  roast?: string;
  roastHex?: string;
  roasts?: string[];
  weights?: string[];
  /** وزن یک واحد به گرم — برای محاسبه ارسال */
  weightGrams?: number;
};

export async function getCartAction(): Promise<{
  ok: boolean;
  items: CartLineDTO[];
  error?: string;
}> {
  try {
    const cartId = await resolveCartId();
    const cartRepo = new CartRepository();
    const rows = await cartRepo.listItems(cartId);
    const _cartItemsForDiscount = (rows as any[]).map((row) => {
      const v = row.product_variants;
      return {
        productId: String(v?.product_id ?? v?.products?.id ?? ""),
        price: Number(v?.price ?? 0),
        quantity: Number(row.quantity ?? 0),
      };
    });

    const items: CartLineDTO[] = (rows as any[]).map((row) => {
      const v = row.product_variants;
      const product = v?.products;
      const images = product?.product_images as
        | { url: string; is_primary?: boolean; sort_order?: number; variant_id?: string | null }[]
        | undefined;
      const vid = String(row.variant_id ?? v?.id ?? "");
      const byVariant = (images ?? []).find(
        (im) => im.variant_id && vid && String(im.variant_id) === vid,
      );
      const sorted = (images ?? [])
        .slice()
        .sort(
          (a, b) =>
            Number(b.is_primary) - Number(a.is_primary) ||
            (a.sort_order ?? 0) - (b.sort_order ?? 0)
        );
      // بدون variant_id = گالری/شاخص؛ با variant_id = عکس همان واریانت
      const image = byVariant?.url ?? sorted.find((im) => !im.variant_id)?.url ?? sorted[0]?.url;
      return {
        itemId: row.id,
        variantId: row.variant_id,
        quantity: row.quantity,
        price: Number(v?.price ?? 0),
        productId: product?.id ?? v?.product_id ?? "",
        title: product?.name ?? "محصول",
        slug: product?.slug ?? "",
        image,
        weight: typeof v?.weight === "string" ? v.weight : v?.weight?.name ?? undefined,
        roast: v?.roast_name ?? (typeof v?.roast === "string" ? v.roast : v?.roast?.name) ?? undefined,
        roastHex: v?.roast_hex ?? v?.roast?.hex_code ?? undefined,
        weightGrams: Math.max(0, Number(v?.weight_grams ?? 0) || 0) || undefined,
      };
    });

    // گزینه‌های وضعیت محصول/وزن همه وریانت‌های همان محصول
    const productIds = [...new Set(items.map((i) => i.productId).filter(Boolean))];
    if (productIds.length) {
      try {
        const { createClient } = await import("@/lib/supabase/server");
        const supabase = await createClient();
        const { data: vars, error: vErr } = await supabase
          .from("product_variants")
          .select("id, product_id, roast_name, roast_hex, weight, is_active, stock_quantity")
          .in("product_id", productIds)
          .eq("is_active", true);
        if (vErr) console.error("[getCart variants]", vErr);
        const byProd = new Map<string, { roasts: string[]; weights: string[] }>();
        for (const v of vars ?? []) {
          const pid = (v as { product_id: string }).product_id;
          if (!pid) continue;
          const entry = byProd.get(pid) ?? { roasts: [], weights: [] };
          const hexRaw = ((v as { roast_hex?: string }).roast_hex || "").trim();
          const nameRaw = ((v as { roast_name?: string }).roast_name || "").trim();
          // اولویت با hex؛ نام فقط اگر hex نبود
          let roastKey = hexRaw;
          if (!roastKey && nameRaw) roastKey = nameRaw;
          if (roastKey) {
            const exists = entry.roasts.some(
              (c) => c.replace(/^#/, "").toLowerCase() === roastKey.replace(/^#/, "").toLowerCase()
                || c === roastKey,
            );
            if (!exists) entry.roasts.push(roastKey.startsWith("#") || !hexRaw ? roastKey : roastKey);
            // اگر hex داریم همیشه با # نگه دار
            if (hexRaw && !entry.roasts.includes(hexRaw)) {
              entry.roasts = entry.roasts.filter((c) => c !== nameRaw);
              if (!entry.roasts.includes(hexRaw)) entry.roasts.push(hexRaw);
            }
          }
          const szRaw = (v as { weight?: string | { name?: string } }).weight;
          const sz =
            typeof szRaw === "string"
              ? szRaw.trim()
              : szRaw && typeof szRaw === "object"
                ? String(szRaw.name || "").trim()
                : "";
          if (sz && !entry.weights.includes(sz)) entry.weights.push(sz);
          byProd.set(pid, entry);
        }
        // گزینه‌های کامل با موجودی برای دراور/کارت
        const optsByProd = new Map<string, { roast?: string; roastHex?: string; weight?: string; stock: number }[]>();
        for (const v of vars ?? []) {
          const pid = (v as { product_id: string }).product_id;
          if (!pid) continue;
          const list = optsByProd.get(pid) ?? [];
          const szRaw = (v as { weight?: string | { name?: string } }).weight;
          const sz =
            typeof szRaw === "string"
              ? szRaw.trim()
              : szRaw && typeof szRaw === "object"
                ? String(szRaw.name || "").trim()
                : "";
          list.push({
            roast: ((v as { roast_name?: string }).roast_name || "").trim() || undefined,
            roastHex: ((v as { roast_hex?: string }).roast_hex || "").trim() || undefined,
            weight: sz || undefined,
            stock: Number((v as { stock_quantity?: number }).stock_quantity ?? 0),
          });
          optsByProd.set(pid, list);
        }
        for (const it of items) {
          const opt = byProd.get(it.productId);
          if (opt) {
            it.roasts = opt.roasts.length ? opt.roasts : it.roastHex || it.roast ? [it.roastHex || it.roast!] : [];
            it.weights = opt.weights.length ? opt.weights : it.weight ? [it.weight] : [];
          }
          const vo = optsByProd.get(it.productId);
          if (vo) (it as { variantOptions?: unknown }).variantOptions = vo;
        }
      } catch (e) {
        console.error("[getCart options]", e);
      }
    }

    return { ok: true, items };
  } catch (e) {
    console.error("[getCart]", e);
    return { ok: false, items: [], error: "server" };
  }
}


export type CreateOrderPayload = {
  name: string;
  phone: string;
  address: string;
  city?: string;
  province?: string;
  postal?: string;
  note?: string;
  /** اختیاری — برای ایمیل تأیید سفارش مهمان */
  email?: string;
  discountCode?: string;
  paymentMethod?: "cod" | "online";
  shippingMethodId?: string;
};

export async function createOrderAction(payload: CreateOrderPayload) {
  try {
    const user = await requireUser();
    // Guest checkout: بدون حساب هم مجاز است (استاندارد فروشگاه‌های ایرانی)
    const cartRepo = new CartRepository();
    const sessionId = await getSessionId();
    const cartId = user?.id
      ? await cartRepo.getOrCreateCart({ userId: user.id, sessionId: null })
      : await cartRepo.getOrCreateCart({ userId: null, sessionId });
    const raw = await cartRepo.listItems(cartId);
    if (!raw.length) return { ok: false as const, error: "empty_cart" };

    const cartItemsForDiscount = (raw as any[]).map((row) => {
      const v = row.product_variants;
      return {
        productId: String(v?.product_id ?? v?.products?.id ?? ""),
        price: Number(v?.price ?? 0),
        quantity: Number(row.quantity ?? 0),
      };
    });

    const items = raw.map((row: any) => {
      const v = row.product_variants;
      const prod = v?.products;
      const title = prod?.name ?? "محصول";
      const unitPrice = Number(v?.price ?? 0);
      return {
        variantId: row.variant_id as string,
        productId: (v?.product_id ?? prod?.id) as string,
        title,
        weightName: (typeof v?.weight === "string" ? v.weight : v?.weight?.name) as string | undefined,
        roastName: (v?.roast_name ?? (typeof v?.roast === "string" ? v.roast : v?.roast?.name)) as string | undefined,
        unitPrice,
        quantity: row.quantity as number,
      };
    });

    const subtotal = items.reduce(
      (s, it) => s + Number(it.unitPrice) * Number(it.quantity),
      0
    );

    let discountCode: string | null = null;
    let discountAmount = 0;
    if (payload.discountCode?.trim()) {
      const v = await validateDiscountAction(payload.discountCode, subtotal, cartItemsForDiscount);
      if (!v.ok) {
        return { ok: false as const, error: `discount_${v.error}` };
      }
      discountCode = v.discount.code;
      discountAmount = v.discount.discountAmount;

      const supabaseInc = await createClient();

      // once_per_user + سقف — فقط چک، مصرف بعد از ثبت موفق سفارش
      const { data: dRow } = await supabaseInc
        .from("discounts")
        .select("once_per_user, max_uses, used_count")
        .ilike("code", discountCode)
        .maybeSingle();
      if ((dRow as { once_per_user?: boolean } | null)?.once_per_user) {
        if (!user?.id) {
          return { ok: false as const, error: "discount_login_required" };
        }
        const { data: prior } = await supabaseInc
          .from("orders")
          .select("id")
          .eq("user_id", user.id)
          .ilike("discount_code", discountCode)
          .limit(1)
          .maybeSingle();
        if (prior) {
          return { ok: false as const, error: "discount_already_used" };
        }
      }
      const maxUses = (dRow as { max_uses?: number | null } | null)?.max_uses;
      const usedCount = Number((dRow as { used_count?: number } | null)?.used_count ?? 0);
      if (maxUses != null && usedCount >= Number(maxUses)) {
        return { ok: false as const, error: "discount_max_uses" };
      }
    }

    const nameOk = assertNoLinkOrImage(payload.name, "نام");
    if (!nameOk.ok) return { ok: false as const, error: nameOk.error };
    if (!nameOk.text.trim() || nameOk.text.trim().length < 3) {
      return { ok: false as const, error: "نام گیرنده الزامی است" };
    }
    const phoneNorm = normalizeIranMobile(payload.phone || "");
    if (!phoneNorm) {
      return { ok: false as const, error: "شماره موبایل نامعتبر است" };
    }
    const phoneOk = assertNoLinkOrImage(phoneNorm, "تلفن");
    if (!phoneOk.ok) return { ok: false as const, error: phoneOk.error };
    const addrOk = assertNoLinkOrImage(payload.address, "آدرس");
    if (!addrOk.ok) return { ok: false as const, error: addrOk.error };
    if (!addrOk.text.trim() || addrOk.text.trim().length < 8) {
      return { ok: false as const, error: "آدرس کامل الزامی است" };
    }
    const cityOk = assertNoLinkOrImage(payload.city ?? "", "شهر");
    if (!cityOk.ok) return { ok: false as const, error: cityOk.error };
    if (!cityOk.text.trim()) {
      return { ok: false as const, error: "شهر الزامی است" };
    }
    const provinceOk = assertNoLinkOrImage(payload.province ?? "", "استان");
    if (!provinceOk.ok) return { ok: false as const, error: provinceOk.error };
    const postalNorm = normalizeIranPostalCode(payload.postal || "");
    if (!postalNorm) {
      return { ok: false as const, error: "کد پستی باید ۱۰ رقم باشد" };
    }
    const noteOk = assertNoLinkOrImage(payload.note ?? "", "یادداشت");
    if (!noteOk.ok) return { ok: false as const, error: noteOk.error };

    const addressLine = [
      provinceOk.text.trim() || null,
      cityOk.text.trim() || null,
      addrOk.text.trim(),
    ]
      .filter(Boolean)
      .join("، ");

    let shippingFee = 0;
    let shippingMethodTitle: string | null = null;
    const methodId = (payload.shippingMethodId || "").trim();
    if (!methodId) {
      return { ok: false as const, error: "shipping_method_required" };
    }
    const weightGrams = Math.max(
      100,
      (raw as any[]).reduce((s, row) => {
        const w = Number(row.product_variants?.weight_grams ?? 0) || 300;
        return s + w * Math.max(1, Number(row.quantity) || 1);
      }, 0),
    );
    const quoteRes = await quoteShippingAction({
      methodId,
      weightGrams,
      destCity: cityOk.text || undefined,
      destProvince: provinceOk.text || undefined,
      parcelValueToman: Math.max(0, subtotal - discountAmount),
    });
    if (!quoteRes.ok || !quoteRes.quote.ok) {
      return { ok: false as const, error: "shipping_quote_failed" };
    }
    shippingMethodTitle = quoteRes.title || null;
    shippingFee = Math.max(0, Math.floor(Number(quoteRes.quote.fee) || 0));
    const orderGrandTotal = Math.max(
      0,
      subtotal - Math.min(discountAmount, subtotal) + shippingFee,
    );

    const orderRepo = new OrderRepository();
    const orderId = await orderRepo.createFromCart({
      userId: user?.id ?? null,
      sessionId: user?.id ? null : sessionId,
      items,
      shipping: {
        name: nameOk.text,
        phone: phoneOk.text,
        address: addressLine,
        city: cityOk.text || undefined,
        postal: postalNorm,
      },
      shippingFee,
      shippingMethodId: methodId,
      shippingMethodTitle,
      note: noteOk.text || undefined,
      discountCode,
      discountAmount,
      paymentMethod: payload.paymentMethod === "online" ? "online" : "cod",
    });

    await cartRepo.clearCart(cartId);

    // مصرف سقف کد تخفیف فقط بعد از ثبت موفق سفارش
    if (discountCode) {
      try {
        const supabaseInc = await createClient();
        const { data: reserved, error: incErr } = await supabaseInc.rpc(
          "increment_discount_use",
          { p_code: discountCode },
        );
        if (incErr || reserved !== true) {
          console.error("[discount consume after order]", discountCode, incErr, reserved);
        }
      } catch (de) {
        console.error("[discount consume after order]", de);
      }
    }

    // SMS/ایمیل با مبلغ واقعی سرور
    const amountStr = orderGrandTotal.toLocaleString("fa-IR");
    try {
      await notifyOrderPlaced({
        customerPhone: phoneOk.text,
        customerName: nameOk.text,
        orderId,
        amount: amountStr,
      });
    } catch (smsErr) {
      console.warn("[sms order placed]", smsErr);
    }

      try {
        const emailTo =
          String((payload as { email?: string }).email ?? "").trim() ||
          (user && typeof user === "object" && "email" in user
            ? String((user as { email?: string }).email ?? "")
            : "");
        if (emailTo) {
          await emailOrderPlaced({
            to: emailTo,
            customerName: nameOk.text,
            orderId,
            amount: amountStr,
          });
        }
      } catch (emErr) {
        console.warn("[email order placed]", emErr);
      }

    // ذخیره آدرس فقط برای کاربر لاگین‌شده
    if (!user?.id) {
      return { ok: true as const, orderId, totalAmount: orderGrandTotal };
    }
    try {
      const addrRepo = new AddressRepository();
      const existing = await addrRepo.list(user.id);
      const line = addrOk.text.trim();
      const city = (cityOk.text || "").trim() || "—";
      const phone = phoneOk.text;
      const fullName = nameOk.text;
      const postal = (payload.postal || "").trim() || null;
      const already = existing.some(
        (a) =>
          a.address_line.trim() === line &&
          a.city.trim() === city &&
          (a.postal_code || "") === (postal || ""),
      );
      if (!already && line) {
        await addrRepo.create(user.id, {
          full_name: fullName,
          phone,
          city,
          address_line: line,
          postal_code: postal || undefined,
          is_default: existing.length === 0,
          title: existing.length === 0 ? "پیش‌فرض" : "آدرس سفارش",
        });
      }
    } catch (ae) {
      console.error("[createOrder save address]", ae);
    }

    return { ok: true as const, orderId, totalAmount: orderGrandTotal };
  } catch (e) {
    console.error("[createOrder]", e);
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as { message: string }).message)
        : e instanceof Error
          ? e.message
          : String(e);
    return { ok: false as const, error: msg };
  }
}

export async function listMyOrdersAction() {
  try {
    const user = await requireUser();
    if (!user) return { ok: false as const, items: [], error: "login_required" };
    const orderRepo = new OrderRepository();
    const items = await orderRepo.listByUser(user.id);
    return { ok: true as const, items };
  } catch (e) {
    console.error("[listOrders]", e);
    return { ok: false as const, items: [], error: "server" };
  }
}


export async function trackOrderAction(code: string) {
  try {
    const c = (code || "").trim();
    const compact = c.toLowerCase().replace(/[^0-9a-f]/g, "");
    if (compact.length !== 32) {
      return { ok: false as const, error: "کد سفارش باید شناسه کامل باشد" };
    }
    const orderRepo = new OrderRepository();
    const order = await orderRepo.trackPublic(c);
    if (!order) {
      return { ok: false as const, error: "سفارشی یافت نشد" };
    }
    return {
      ok: true as const,
      order: {
        id: order.id as string,
        status: order.status as string,
        total_amount: Number(order.total_amount ?? 0),
        shipping_city: (order as { shipping_city?: string }).shipping_city ?? null,
        tracking_number: (order as { tracking_number?: string | null }).tracking_number ?? null,
        shipped_at: (order as { shipped_at?: string | null }).shipped_at ?? null,
        created_at: order.created_at as string,
        items: ((order as unknown as { order_items?: unknown[] }).order_items ?? []).map(
          (it: any) => ({
            id: it.id,
            title: it.title,
            weight_name: it.weight_name,
            roast_name: it.roast_name,
            quantity: it.quantity,
            line_total: Number(it.line_total ?? 0),
          })
        ),
      },
    };
  } catch (e) {
    console.error("[trackOrder]", e);
    return { ok: false as const, error: "server" };
  }
}


export async function getMyProfileAction() {
  try {
    const user = await requireUser();
    if (!user) return { ok: false as const, error: "login_required" };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, phone, avatar_url, role")
      .eq("id", user.id)
      .maybeSingle();
    if (error) throw error;
    return {
      ok: true as const,
      profile: data ?? {
        id: user.id,
        full_name: null,
        phone: null,
        avatar_url: null,
        role: "customer",
      },
      email: user.email ?? null,
    };
  } catch (e) {
    console.error("[getMyProfile]", e);
    return { ok: false as const, error: "server" };
  }
}

export async function updateMyProfileAction(input: {
  full_name?: string;
  phone?: string;
}) {
  try {
    const user = await requireUser();
    if (!user) return { ok: false as const, error: "login_required" };
    const supabase = await createClient();
    const patch: Record<string, string | null> = {};
    if (typeof input.full_name === "string") {
      const nameOk = assertNoLinkOrImage(input.full_name, "نام");
      if (!nameOk.ok) return { ok: false as const, error: nameOk.error };
      patch.full_name = nameOk.text || null;
    }
    if (typeof input.phone === "string") {
      const raw = input.phone.trim().replace(/\s/g, "");
      if (!raw) {
        patch.phone = null;
      } else {
        const phoneNorm = normalizeIranMobile(raw);
        if (!phoneNorm) {
          return { ok: false as const, error: "شماره موبایل نامعتبر است" };
        }
        const phoneOk = assertNoLinkOrImage(phoneNorm, "تلفن");
        if (!phoneOk.ok) return { ok: false as const, error: phoneOk.error };
        patch.phone = phoneOk.text || null;
      }
    }
    if (!Object.keys(patch).length) {
      return { ok: false as const, error: "nothing_to_update" };
    }
    const { error } = await supabase
      .from("profiles")
      .update(patch as never)
      .eq("id", user.id);
    if (error) throw error;
    return { ok: true as const };
  } catch (e) {
    console.error("[updateMyProfile]", e);
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as { message: string }).message)
        : "server";
    return { ok: false as const, error: msg };
  }
}


export async function listMyAddressesAction() {
  try {
    const user = await requireUser();
    if (!user) return { ok: false as const, items: [], error: "login_required" };
    const repo = new AddressRepository();
    let items = await repo.list(user.id);

    // اگر خالی است ولی سفارش قبلی دارد → از آخرین سفارش بساز
    if (!items.length) {
      try {
        const { createServiceClient } = await import("@/lib/supabase/service");
        const service = createServiceClient();
        const { data: last } = await service
          .from("orders")
          .select(
            "shipping_name, shipping_phone, shipping_address, shipping_city, shipping_postal",
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (last?.shipping_address) {
          const created = await repo.create(user.id, {
            full_name: String(last.shipping_name || "گیرنده"),
            phone: String(last.shipping_phone || ""),
            city: String(last.shipping_city || "—"),
            address_line: String(last.shipping_address),
            postal_code: last.shipping_postal
              ? String(last.shipping_postal)
              : undefined,
            is_default: true,
            title: "پیش‌فرض",
          });
          items = [created];
        }
      } catch (be) {
        console.error("[listMyAddresses bootstrap]", be);
      }
    }

    return { ok: true as const, items };
  } catch (e) {
    console.error("[listMyAddresses]", e);
    return { ok: false as const, items: [], error: "server" };
  }
}

export async function createMyAddressAction(input: AddressInput) {
  try {
    const user = await requireUser();
    if (!user) return { ok: false as const, error: "login_required" };
    if (
      !input.full_name?.trim() ||
      !input.phone?.trim() ||
      !input.city?.trim() ||
      !input.address_line?.trim()
    ) {
      return { ok: false as const, error: "required_fields" };
    }
    const n1 = assertNoLinkOrImage(input.full_name, "نام");
    if (!n1.ok) return { ok: false as const, error: n1.error };
    const phoneNormAddr = normalizeIranMobile(input.phone || "");
    if (!phoneNormAddr) {
      return { ok: false as const, error: "شماره موبایل نامعتبر است" };
    }
    const n2 = assertNoLinkOrImage(phoneNormAddr, "تلفن");
    if (!n2.ok) return { ok: false as const, error: n2.error };
    const n3 = assertNoLinkOrImage(input.city, "شهر");
    if (!n3.ok) return { ok: false as const, error: n3.error };
    const n4 = assertNoLinkOrImage(input.address_line, "آدرس");
    if (!n4.ok) return { ok: false as const, error: n4.error };
    input = {
      ...input,
      full_name: n1.text,
      phone: n2.text,
      city: n3.text,
      address_line: n4.text,
    };
    const repo = new AddressRepository();
    const item = await repo.create(user.id, input);
    return { ok: true as const, item };
  } catch (e) {
    console.error("[createMyAddress]", e);
    const msg =
      e && typeof e === "object" && "message" in e
        ? String((e as { message: string }).message)
        : e && typeof e === "object" && "code" in e
          ? String((e as { code: string }).code)
          : "server";
    return { ok: false as const, error: msg };
  }
}

export async function updateMyAddressAction(id: string, input: Partial<AddressInput>) {
  try {
    const user = await requireUser();
    if (!user) return { ok: false as const, error: "login_required" };
    if (!id?.trim()) return { ok: false as const, error: "missing_id" };
    const patch: Partial<AddressInput> = { ...input };
    if (input.full_name != null) {
      const n = assertNoLinkOrImage(String(input.full_name), "نام");
      if (!n.ok) return { ok: false as const, error: n.error };
      patch.full_name = n.text;
    }
    if (input.phone != null) {
      const phoneNorm = normalizeIranMobile(String(input.phone));
      if (!phoneNorm) return { ok: false as const, error: "شماره موبایل نامعتبر است" };
      const n = assertNoLinkOrImage(phoneNorm, "تلفن");
      if (!n.ok) return { ok: false as const, error: n.error };
      patch.phone = n.text;
    }
    if (input.city != null) {
      const n = assertNoLinkOrImage(String(input.city), "شهر");
      if (!n.ok) return { ok: false as const, error: n.error };
      patch.city = n.text;
    }
    if (input.address_line != null) {
      const n = assertNoLinkOrImage(String(input.address_line), "آدرس");
      if (!n.ok) return { ok: false as const, error: n.error };
      patch.address_line = n.text;
    }
    const repo = new AddressRepository();
    await repo.update(user.id, id, patch);
    return { ok: true as const };
  } catch (e) {
    console.error("[updateMyAddress]", e);
    return { ok: false as const, error: "server" };
  }
}

export async function deleteMyAddressAction(id: string) {
  try {
    const user = await requireUser();
    if (!user) return { ok: false as const, error: "login_required" };
    const repo = new AddressRepository();
    await repo.remove(user.id, id);
    return { ok: true as const };
  } catch (e) {
    console.error("[deleteMyAddress]", e);
    return { ok: false as const, error: "server" };
  }
}

export async function setDefaultAddressAction(id: string) {
  try {
    const user = await requireUser();
    if (!user) return { ok: false as const, error: "login_required" };
    const repo = new AddressRepository();
    await repo.setDefault(user.id, id);
    return { ok: true as const };
  } catch (e) {
    console.error("[setDefaultAddress]", e);
    return { ok: false as const, error: "server" };
  }
}


/** محصولات فعال برای تب فروشگاه پنل خریدار */
export async function listShopProductsAction(limit = 12) {
  try {
    const repo = new ProductRepository();
    const result = await repo.findPublished({ page: 1, pageSize: limit });
    // findPublished معمولاً { data, count } یا آرایه برمی‌گرداند
    const data = Array.isArray(result)
      ? result
      : (result as { data?: unknown[] }).data ?? [];
    return { ok: true as const, products: data };
  } catch (e) {
    console.error("[listShopProducts]", e);
    return { ok: false as const, products: [], error: "server" };
  }
}


/** اقلام یک سفارش را دوباره به سبد اضافه می‌کند */
export async function reorderOrderAction(orderId: string) {
  try {
    const user = await requireUser();
    if (!user) return { ok: false as const, error: "login_required" };

    const supabase = await createClient();

    const { data: order, error: oErr } = await supabase
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (oErr) throw oErr;
    if (!order) return { ok: false as const, error: "not_found" };

    const { data: items, error: iErr } = await supabase
      .from("order_items")
      .select("variant_id, quantity")
      .eq("order_id", orderId);
    if (iErr) throw iErr;
    if (!items?.length) return { ok: false as const, error: "empty" };

    let added = 0;
    for (const it of items) {
      const variantId = (it as { variant_id?: string | null }).variant_id;
      const qty = Math.max(1, Number((it as { quantity?: number }).quantity ?? 1));
      if (!variantId) continue;
      const res = await addToCartAction(variantId, qty);
      if (res.ok) added += 1;
    }

    if (added === 0) return { ok: false as const, error: "none_added" };
    return { ok: true as const, added };
  } catch (e) {
    console.error("[reorderOrder]", e);
    return { ok: false as const, error: "server" };
  }
}


export type DiscountPreview = {
  code: string;
  type: "percentage" | "fixed";
  value: number;
  discountAmount: number;
  finalTotal: number;
};

export type DiscountCartLine = {
  productId: string;
  price: number;
  quantity: number;
};

/** مبلغ پایه تخفیف با محدودیت محصول/دسته */
async function eligibleDiscountBase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  subtotal: number,
  productIds: string[] | null | undefined,
  categoryIds: string[] | null | undefined,
  lines?: DiscountCartLine[] | null,
): Promise<{ base: number; error?: string }> {
  const pids = (productIds ?? []).filter(Boolean);
  const cids = (categoryIds ?? []).filter(Boolean);
  if (!pids.length && !cids.length) return { base: subtotal };
  if (!lines?.length) return { base: 0, error: "not_applicable" };

  const allowed = new Set<string>(pids);
  if (cids.length) {
    const cartPids = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
    if (cartPids.length) {
      const { data: prows } = await supabase
        .from("products")
        .select("id, category_id")
        .in("id", cartPids);
      for (const r of prows ?? []) {
        const cid = String((r as { category_id?: string }).category_id ?? "");
        if (cid && cids.includes(cid)) {
          allowed.add(String((r as { id: string }).id));
        }
      }
    }
  }
  if (!allowed.size) return { base: 0, error: "not_applicable" };

  let base = 0;
  for (const line of lines) {
    if (allowed.has(line.productId)) {
      base += Math.floor(Number(line.price) * Number(line.quantity));
    }
  }
  if (base <= 0) return { base: 0, error: "not_applicable" };
  return { base };
}

/** اعتبارسنجی کد تخفیف: سقف مبلغ + محدودیت محصول/دسته */
export async function validateDiscountAction(
  code: string,
  subtotal: number,
  lines?: DiscountCartLine[] | null,
): Promise<
  | {
      ok: true;
      discount: {
        code: string;
        type: string;
        value: number;
        discountAmount: number;
        finalTotal: number;
      };
    }
  | { ok: false; error: string }
> {
  const raw = (code || "").trim();
  if (!raw) return { ok: false, error: "empty" };
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return { ok: false, error: "bad_subtotal" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discounts")
    .select(
      "id, code, type, value, min_order_amount, max_uses, used_count, starts_at, ends_at, is_active, max_discount_amount, product_ids, category_ids",
    )
    .ilike("code", raw)
    .maybeSingle();

  if (error) {
    console.error("validateDiscount", error);
    return { ok: false, error: "db" };
  }
  if (!data) return { ok: false, error: "not_found" };
  if (!data.is_active) return { ok: false, error: "inactive" };

  const now = Date.now();
  if (data.starts_at && new Date(data.starts_at).getTime() > now) {
    return { ok: false, error: "not_started" };
  }
  if (data.ends_at && new Date(data.ends_at).getTime() < now) {
    return { ok: false, error: "expired" };
  }

  const maxUses = data.max_uses;
  const used = Number(data.used_count ?? 0);
  if (maxUses != null && used >= Number(maxUses)) {
    return { ok: false, error: "max_uses" };
  }

  const minOrder = Number(data.min_order_amount ?? 0);
  if (subtotal < minOrder) return { ok: false, error: "min_order" };

  const row = data as {
    product_ids?: string[] | null;
    category_ids?: string[] | null;
    max_discount_amount?: number | null;
    type: string;
    value: number;
    code: string;
  };

  const { base, error: eligErr } = await eligibleDiscountBase(
    supabase,
    subtotal,
    row.product_ids,
    row.category_ids,
    lines,
  );
  if (eligErr) return { ok: false, error: eligErr };

  const value = Number(row.value);
  const t = String(row.type || "").toLowerCase();
  let discountAmount = 0;
  if (t === "percentage" || t === "percent") {
    discountAmount = Math.floor((base * value) / 100);
  } else if (t === "fixed" || t === "amount") {
    discountAmount = Math.floor(value);
  } else {
    return { ok: false, error: "bad_type" };
  }

  if (discountAmount > base) discountAmount = base;
  if (discountAmount < 0) discountAmount = 0;
  const cap = Number(row.max_discount_amount ?? 0);
  if (cap > 0 && discountAmount > cap) discountAmount = Math.floor(cap);

  return {
    ok: true,
    discount: {
      code: String(data.code ?? raw),
      type: data.type,
      value,
      discountAmount,
      finalTotal: Math.max(0, subtotal - discountAmount),
    },
  };
}


/** لیست کدهای فعال برای تب پنل (فقط نمایش عمومی) */
export async function listActiveDiscountsAction() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("discounts")
      .select("code, type, value, min_order_amount, ends_at, is_active")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    const now = Date.now();
    const items = (data ?? []).filter((d) => {
      if (d.ends_at && new Date(d.ends_at).getTime() < now) return false;
      return true;
    });
    return { ok: true as const, items };
  } catch (e) {
    console.error("[listActiveDiscounts]", e);
    return { ok: false as const, items: [], error: "server" };
  }
}

/** بعد از لاگین: سبد cookie مهمان → سبد کاربر */
export async function mergeGuestCartAction() {
  try {
    const user = await requireUser();
    if (!user) return { ok: false as const, error: "login_required" };
    const sid = await getSessionId();
    if (!sid) return { ok: true as const, skipped: true as const };
    const cartRepo = new CartRepository();
    await cartRepo.mergeSessionIntoUser(sid, user.id);
    return { ok: true as const };
  } catch (e) {
    console.error("[mergeGuestCart]", e);
    return { ok: false as const, error: "server" };
  }
}


/** به‌روزرسانی ایمیل کاربر فعلی */
export async function updateMyEmailAction(email: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) return { ok: false as const, error: "auth" };
    const cleaned = (email || "").trim().toLowerCase();
    if (!cleaned || !cleaned.includes("@")) {
      return { ok: false as const, error: "ایمیل نامعتبر است" };
    }
    const { error } = await supabase.auth.updateUser({ email: cleaned });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  } catch (e) {
    console.error("[updateMyEmail]", e);
    return { ok: false as const, error: "server" };
  }
}

/** حذف حساب کاربر فعلی (soft: signOut + حذف profile در صورت وجود) */
export async function deleteMyAccountAction() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) return { ok: false as const, error: "auth" };
    const uid = user.id;
    try {
      await supabase.from("profiles").delete().eq("id", uid);
    } catch (pe) {
      console.error("[deleteMyAccount profile]", pe);
    }
    try {
      const { createServiceClient } = await import("@/lib/supabase/service");
      const service = createServiceClient();
      const { error: delErr } = await service.auth.admin.deleteUser(uid);
      if (delErr) {
        console.error("[deleteMyAccount auth.admin]", delErr);
        await supabase.auth.signOut();
        return { ok: false as const, error: "auth_delete_failed" };
      }
    } catch (ae) {
      console.error("[deleteMyAccount service]", ae);
      await supabase.auth.signOut();
      return { ok: false as const, error: "auth_delete_failed" };
    }
    try {
      await supabase.auth.signOut();
    } catch {
      /* session ممکن است از قبل باطل شده باشد */
    }
    return { ok: true as const };
  } catch (e) {
    console.error("[deleteMyAccount]", e);
    return { ok: false as const, error: "server" };
  }
}


/** فقط محصولات منتشر و غیرحذف‌شده — برای بازدید اخیر */
export async function filterLiveProductIdsAction(ids: string[]) {
  try {
    const clean = [...new Set((ids || []).filter(Boolean))].slice(0, 40);
    if (!clean.length) return { ok: true as const, ids: [] as string[] };
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .in("id", clean)
      .eq("status", "published")
      .is("deleted_at", null);
    if (error) {
      console.error("[filterLiveProductIds]", error);
      return { ok: false as const, ids: [] as string[], error: "db" };
    }
    const live = new Set((data ?? []).map((r: { id: string }) => r.id));
    return { ok: true as const, ids: clean.filter((id) => live.has(id)) };
  } catch (e) {
    console.error("[filterLiveProductIds]", e);
    return { ok: false as const, ids: [] as string[], error: "server" };
  }
}

/** محصولات زنده برای آخرین بازدیدها — فقط published و حذف‌نشده + داده فعلی */
export type LiveRecentProductDTO = {
  id: string;
  title: string;
  slug: string;
  price: number;
  image?: string;
  brand?: string;
  href: string;
};

export async function getLiveRecentlyViewedAction(ids: string[]): Promise<{
  ok: boolean;
  items: LiveRecentProductDTO[];
  error?: string;
}> {
  try {
    const clean = [...new Set((ids || []).filter(Boolean))].slice(0, 40);
    if (!clean.length) return { ok: true, items: [] };

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        name,
        slug,
        status,
        deleted_at,
        brands(name),
        product_variants(price, is_active),
        product_images(url, is_primary, sort_order, variant_id)
      `
      )
      .in("id", clean)
      .eq("status", "published")
      .is("deleted_at", null);

    if (error) {
      console.error("[getLiveRecentlyViewed]", error);
      return { ok: false, items: [], error: "db" };
    }

    const byId = new Map<string, LiveRecentProductDTO>();
    for (const p of data ?? []) {
      const row = p as unknown as {
        id: string;
        name?: string | null;
        slug?: string | null;
        brands?: { name?: string } | { name?: string }[] | null;
        product_variants?: { price?: number; is_active?: boolean }[];
        product_images?: {
          url?: string;
          is_primary?: boolean;
          sort_order?: number;
          variant_id?: string | null;
        }[];
      };
      if (!row.id) continue;

      const variants = (row.product_variants ?? []).filter(
        (v) => v.is_active !== false
      );
      const prices = variants
        .map((v) => Number(v.price ?? 0))
        .filter((n) => !Number.isNaN(n) && n >= 0);
      const price = prices.length ? Math.min(...prices) : 0;

      const images = (row.product_images ?? [])
        .slice()
        .sort(
          (a, b) =>
            Number(b.is_primary) - Number(a.is_primary) ||
            (a.sort_order ?? 0) - (b.sort_order ?? 0)
        );
      // عکس شاخص (بدون variant_id) یا اولین عکس
      const image =
        images.find((im) => !im.variant_id)?.url ?? images[0]?.url ?? undefined;

      let brand: string | undefined;
      const b = row.brands;
      if (Array.isArray(b)) brand = b[0]?.name;
      else if (b && typeof b === "object") brand = b.name;

      const slug = (row.slug || "").trim();
      byId.set(row.id, {
        id: row.id,
        title: (row.name || "محصول").trim(),
        slug,
        price,
        image,
        brand,
        href: slug ? `/products/${slug}` : `/products/${row.id}`,
      });
    }

    // ترتیب همان ids ورودی (آخرین بازدید اول)
    const items = clean
      .map((id) => byId.get(id))
      .filter((x): x is LiveRecentProductDTO => x != null);

    return { ok: true, items };
  } catch (e) {
    console.error("[getLiveRecentlyViewed]", e);
    return { ok: false, items: [], error: "server" };
  }
}
