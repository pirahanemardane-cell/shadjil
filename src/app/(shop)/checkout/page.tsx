"use client";


import { Price } from "@/components/ui/price";
import { normalizeIranMobile, normalizeIranPostalCode } from "@/lib/numbers";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  createOrderAction,
  getCartAction,
  listMyAddressesAction,
  validateDiscountAction,
  type CartLineDTO,
} from "@/app/(shop)/actions/shop";
import {
  listActiveShippingMethodsAction,
  quoteShippingAction,
} from "@/app/(shop)/actions/shipping";
import type { ShippingMethodRow } from "@/lib/shipping/types";
import {
  reserveCheckoutStockAction,
  extendCheckoutReservationAction,
  releaseCheckoutReservationAction,
} from "@/app/(shop)/actions/stock-reservations";
import { useShopStore } from "@/lib/shop-store";
import { IRAN_PROVINCES } from "@/lib/iran-provinces";
import { LumaSpin } from "@/components/ui/luma-spin";
import { toPersianDigits } from "@/lib/numbers";
import { useRtEvent } from "@/hooks/use-rt-event";
import { RT } from "@/lib/realtime/events";
import { getMyOrderStatusAction } from "@/app/(shop)/actions/order-status";
import { track } from "@/lib/analytics/track";

export const dynamic = "force-dynamic";

type Step = 1 | 2 | 3 | 4 | 5;
type PayStatus = "success" | "pending" | "failed";
type ShipMethod = string; // id از جدول shipping_methods

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "تأیید سبد" },
  { n: 2, label: "اطلاعات گیرنده" },
  { n: 3, label: "نحوه ارسال" },
  { n: 4, label: "پرداخت" },
  { n: 5, label: "نتیجه" },
];

/** fallback اگر دیتابیس خالی بود */
const FALLBACK_shipOptions: {
  id: string;
  title: string;
  desc: string;
  fee: number;
}[] = [
  { id: "post", title: "پست پیشتاز", desc: "۲ تا ۴ روز کاری", fee: 45000 },
  { id: "tipax", title: "تیپاکس", desc: "۱ تا ۳ روز کاری", fee: 65000 },
  { id: "peyk", title: "پیک موتوری", desc: "فقط تهران — توافقی", fee: 0 },
  { id: "pickup", title: "تحویل حضوری", desc: "از فروشگاه — رایگان", fee: 0 },
];

function mapCheckoutError(code: string | undefined): string {
  if (!code) return "ثبت سفارش ناموفق بود.";
  const map: Record<string, string> = {
    login_required: "برای ثبت سفارش وارد شوید.",
    empty_cart: "سبد خرید خالی است.",
    discount_login_required:
      "این کد تخفیف فقط برای کاربران واردشده است. وارد شوید یا بدون کد ادامه دهید.",
    discount_invalid: "کد تخفیف نامعتبر است.",
    discount_not_found: "کد تخفیف یافت نشد.",
    discount_inactive: "این کد تخفیف غیرفعال است.",
    discount_expired: "مهلت این کد تخفیف تمام شده است.",
    discount_not_started: "این کد تخفیف هنوز فعال نشده است.",
    discount_exhausted: "سقف استفاده از این کد پر شده است.",
    discount_max_uses: "سقف استفاده از این کد پر شده است.",
    discount_min_order: "مبلغ سبد برای این کد کافی نیست.",
    discount_already_used: "این کد را قبلاً استفاده کرده‌اید.",
    discount_reserve_failed: "اعمال کد تخفیف ممکن نشد؛ دوباره تلاش کنید.",
    discount_empty: "کد تخفیف وارد نشده است.",
    discount_db: "خطا در بررسی کد تخفیف.",
    discount_bad_subtotal: "مبلغ سبد نامعتبر است.",
    discount_not_applicable: "این کد برای محصولات سبد شما قابل استفاده نیست.",
    insufficient_stock: "موجودی یکی از اقلام کافی نیست.",
    shipping_method_required: "روش ارسال را انتخاب کنید.",
    shipping_quote_failed: "محاسبه هزینه ارسال ممکن نشد. روش دیگری انتخاب کنید.",
  };
  if (map[code]) return map[code];
  if (code.startsWith("discount_")) return "کد تخفیف قابل اعمال نیست.";
  if (code.startsWith("insufficient_stock")) return "موجودی یکی از اقلام کافی نیست.";
  if (/[\u0600-\u06FF]/.test(code)) return code;
  return "ثبت سفارش ناموفق بود. دوباره تلاش کنید.";
}

function shortTrack(id: string) {
  const clean = (id || "").replace(/-/g, "").slice(0, 12).toUpperCase();
  return clean || id;
}

export default function CheckoutPage() {
  const clearCartLocal = useShopStore((s) => s.clearCart);

  const [items, setItems] = useState<CartLineDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>(1);
  const [payMethod, setPayMethod] = useState<"cod" | "online">("cod");
  const [shipMethod, setShipMethod] = useState<ShipMethod>("");
  const [shipMethods, setShipMethods] = useState<ShippingMethodRow[]>([]);
  const [shipOptions, setShipOptions] = useState(FALLBACK_shipOptions);
  const [shipFee, setShipFee] = useState(0);
  const [shipQuoteNote, setShipQuoteNote] = useState<string | null>(null);
  const [shipLoading, setShipLoading] = useState(false);
  const [payStatus, setPayStatus] = useState<PayStatus | null>(null);
  const [doneOrder, setDoneOrder] = useState<{
    id: string;
    total: number;
    track: string;
  } | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    address: "",
    province: "",
    city: "",
    postal: "",
    note: "",
  });

  const [savedAddresses, setSavedAddresses] = useState<
    {
      id: string;
      title: string | null;
      full_name: string;
      phone: string;
      province: string | null;
      city: string;
      address_line: string;
      postal_code: string | null;
      is_default: boolean;
    }[]
  >([]);
  /** مهمان = بدون آدرس ذخیره‌شده (لاگین نشده یا اولین خرید) */
  const isGuestCheckout = savedAddresses.length === 0;

  // بارگذاری روش‌های فعال از دیتابیس (با فیلتر منطقه)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listActiveShippingMethodsAction({
        province: form.province || undefined,
        city: form.city || undefined,
      });
      if (cancelled) return;
      if (res.ok && res.items.length) {
        setShipMethods(res.items);
        const opts = res.items.map((m) => ({
          id: m.id,
          title: m.title,
          desc: m.description || "",
          fee: m.fee,
        }));
        setShipOptions(opts);
        if (!shipMethod || !opts.some((o) => o.id === shipMethod)) {
          setShipMethod(opts[0].id);
        }
      } else {
        setShipOptions(FALLBACK_shipOptions);
        if (!shipMethod) setShipMethod(FALLBACK_shipOptions[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.province, form.city, step]);

  // استعلام هزینه ارسال
  useEffect(() => {
    if (!shipMethod) return;
    let cancelled = false;
    (async () => {
      setShipLoading(true);
      setShipQuoteNote(null);

      // اگر از fallback است (idهای کوتاه)
      const isDbId = shipMethod.length > 20;
      if (!isDbId) {
        const fb = FALLBACK_shipOptions.find((s) => s.id === shipMethod);
        if (!cancelled) {
          setShipFee(fb?.fee ?? 0);
          setShipLoading(false);
        }
        return;
      }

      const method = shipMethods.find((m) => m.id === shipMethod);
      if (!method) {
        if (!cancelled) setShipLoading(false);
        return;
      }

      // وزن واقعی واریانت‌ها؛ اگر نبود هر قلم ۴۰۰ گرم
      const weightGrams = Math.max(
        100,
        items.reduce((sum, it) => {
          const w = Number(it.weightGrams) > 0 ? Number(it.weightGrams) : 400;
          return sum + w * Number(it.quantity || 1);
        }, 0),
      );

      const res = await quoteShippingAction({
        methodId: shipMethod,
        weightGrams,
        destCity: form.city || undefined,
        destProvince: form.province || undefined,
        parcelValueToman: afterDiscount,
      });

      if (cancelled) return;

      if (res.ok && res.quote.ok) {
        setShipFee(res.quote.fee);
        setShipQuoteNote(res.quote.note || null);
      } else if (res.ok && !res.quote.ok) {
        // API پیکربندی نشده یا خطا → fee ثابت / صفر + یادداشت
        const fallbackFee =
          method.pricing_type === "fixed" ? method.fee : 0;
        setShipFee(fallbackFee);
        const err = "error" in res.quote ? res.quote.error : "quote_failed";
        if (err.includes("not_configured") || err.includes("missing_")) {
          setShipQuoteNote("هزینه پس از تأیید سفارش اعلام می‌شود");
        } else if (method.pricing_type === "negotiable") {
          setShipQuoteNote("هزینه توافقی");
        } else {
          setShipQuoteNote("استعلام موقت در دسترس نیست");
        }
      } else {
        setShipFee(method.fee || 0);
        setShipQuoteNote(null);
      }
      setShipLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipMethod, form.city, form.province, shipMethods]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  /** default = آدرس ذخیره‌شده/پیش‌فرض | new = فرم آدرس جدید */
  const [addressMode, setAddressMode] = useState<"default" | "new">("new");

  const [discountCode, setDiscountCode] = useState("");
  const [discountPreview, setDiscountPreview] = useState<{
    code: string;
    discountAmount: number;
    finalTotal: number;
    type: string;
    value: number;
  } | null>(null);
  const [discountError, setDiscountError] = useState<string | null>(null);
  const [discountLoading, setDiscountLoading] = useState(false);
  const orderPlacedRef = useRef(false);
  const [reserveExpiresAt, setReserveExpiresAt] = useState<string | null>(null);
  const [reserveHint, setReserveHint] = useState<string | null>(null);

  async function reloadCart() {
    const res = await getCartAction();
    if (res.ok) setItems(res.items);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await reloadCart();
      if (cancelled) return;

      const r = await reserveCheckoutStockAction();
      if (cancelled) return;
      if (r.ok) {
        setReserveExpiresAt(r.expiresAt);
        setReserveHint("موجودی تا ۱۵ دقیقه برای شما نگه داشته شد.");
      } else if (r.error === "insufficient_stock") {
        setReserveHint(
          "برخی اقلام موجودی کافی ندارند: " +
            ((r as { failed?: string[] }).failed ?? []).join("، "),
        );
      }
    })();

    const iv = window.setInterval(() => {
      void extendCheckoutReservationAction().then((x) => {
        if (x.ok && x.expiresAt) setReserveExpiresAt(x.expiresAt);
      });
    }, 120_000);

    function onCartChanged() {
      if (orderPlacedRef.current) return;
      void reloadCart();
    }
    function onFocus() {
      if (orderPlacedRef.current) return;
      void reloadCart();
    }
    window.addEventListener("pm:cart-changed", onCartChanged);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(iv);
      window.removeEventListener("pm:cart-changed", onCartChanged);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      if (!orderPlacedRef.current) {
        void releaseCheckoutReservationAction();
      }
    };
  }, []);

  useEffect(() => {
    void track({ event_name: "begin_checkout" });
  }, []);

  useRtEvent(RT.cart, () => {
    if (orderPlacedRef.current) return;
    void reloadCart();
  });
  useRtEvent(RT.stock, () => {
    if (orderPlacedRef.current) return;
    void reloadCart();
  });

  useRtEvent(RT.orders, () => {
    if (!doneOrder?.id) return;
    void getMyOrderStatusAction(doneOrder.id).then((r) => {
      if (!r.ok) return;
      const ps = r.order.paymentStatus;
      const st = r.order.status;
      if (ps === "paid" || ps === "success" || st === "paid") setPayStatus("success");
      else if (ps === "failed" || ps === "cancelled" || st === "cancelled") setPayStatus("failed");
      else setPayStatus("pending");
    });
  });
  useRtEvent(RT.payment, () => {
    if (!doneOrder?.id) return;
    void getMyOrderStatusAction(doneOrder.id).then((r) => {
      if (!r.ok) return;
      const ps = r.order.paymentStatus;
      const st = r.order.status;
      if (ps === "paid" || ps === "success" || st === "paid") setPayStatus("success");
      else if (ps === "failed" || ps === "cancelled" || st === "cancelled") setPayStatus("failed");
      else setPayStatus("pending");
    });
  });

  useEffect(() => {
    if (step !== 5 || !doneOrder?.id || payStatus !== "pending") return;
    let cancelled = false;
    const tick = async () => {
      const r = await getMyOrderStatusAction(doneOrder.id);
      if (cancelled || !r.ok) return;
      const ps = r.order.paymentStatus;
      const st = r.order.status;
      if (ps === "paid" || ps === "success" || st === "paid") setPayStatus("success");
      else if (ps === "failed" || ps === "cancelled" || st === "cancelled") setPayStatus("failed");
    };
    void tick();
    const iv = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
    };
  }, [step, doneOrder?.id, payStatus]);

  function applyAddress(a: {
    id: string;
    full_name: string;
    phone: string;
    province: string | null;
    city: string;
    address_line: string;
    postal_code: string | null;
  }) {
    setSelectedAddressId(a.id);
    const parts = (a.full_name || "").trim().split(/\s+/);
    const firstName = parts[0] || "";
    const lastName = parts.slice(1).join(" ") || "";
    setForm((f) => ({
      ...f,
      firstName: firstName || f.firstName,
      lastName: lastName || f.lastName,
      phone: a.phone || f.phone,
      address: a.address_line || f.address,
      province: a.province || f.province,
      city: a.city || f.city,
      postal: a.postal_code || f.postal,
    }));
  }

  useEffect(() => {
    (async () => {
      const res = await listMyAddressesAction();
      if (!res.ok || !res.items?.length) return;
      setSavedAddresses(res.items as typeof savedAddresses);
      const def =
        res.items.find((x: { is_default?: boolean }) => x.is_default) ??
        res.items[0];
      if (def) {
        applyAddress(def as Parameters<typeof applyAddress>[0]);
        setAddressMode("default");
      } else {
        setAddressMode("new");
      }
    })();
  }, []);

  const subtotal = useMemo(
    () => items.reduce((s, it) => s + Number(it.price) * Number(it.quantity), 0),
    [items],
  );
  const afterDiscount = discountPreview?.finalTotal ?? subtotal;
  const payable = Math.max(0, afterDiscount + shipFee);

  function fullName() {
    return `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
  }

  function goFrom1() {
    setError(null);
    if (!items.length) {
      setError("سبد خرید خالی است.");
      return;
    }
    setStep(2);
  }

  function validateRecipient(): string | null {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      return "نام و نام خانوادگی الزامی است.";
    }
    if (!form.phone.trim()) {
      return "شماره موبایل الزامی است.";
    }
    if (!normalizeIranMobile(form.phone.trim())) {
      return "شماره موبایل معتبر نیست (مثال: ۰۹۱۲۱۲۳۴۵۶۷).";
    }
    if (!form.province.trim()) {
      return "استان را انتخاب کنید.";
    }
    if (!form.city.trim()) {
      return "شهر الزامی است.";
    }
    if (!form.address.trim() || form.address.trim().length < 8) {
      return "آدرس کامل را وارد کنید (حداقل ۸ کاراکتر).";
    }
    if (!form.postal.trim()) {
      return "کد پستی ۱۰ رقمی الزامی است.";
    }
    if (!normalizeIranPostalCode(form.postal.trim())) {
      return "کد پستی باید دقیقاً ۱۰ رقم باشد.";
    }
    return null;
  }

  function goFrom2() {
    setError(null);
    const err = validateRecipient();
    if (err) {
      setError(err);
      return;
    }
    setStep(3);
  }

  function goFrom3() {
    setError(null);
    if (!shipMethod) {
      setError("روش ارسال را انتخاب کنید.");
      return;
    }
    void track({
      event_name: "add_shipping_info",
      value: payable,
    });
    setStep(4);
  }

  async function handlePay() {
    setError(null);
    void track({
      event_name: "add_payment_info",
      value: payable,
    });
    // اعتبارسنجی تا لبه پرداخت (استاندارد فروشگاه‌های ایرانی)
    const recipErr = validateRecipient();
    if (recipErr) {
      setError(recipErr);
      setStep(2);
      return;
    }
    if (!shipMethod) {
      setError("روش ارسال را انتخاب کنید.");
      setStep(3);
      return;
    }
    if (!items.length) {
      setError("سبد خرید خالی است.");
      setStep(1);
      return;
    }
    setSubmitting(true);
    setPayStatus(null);

    if (payMethod === "online") {
      // درگاه هنوز وصل نیست → معلق با کد پیگیری موقت بعد از ثبت سفارش
    }

    const res = await createOrderAction({
      name: fullName(),
      phone: normalizeIranMobile(form.phone.trim()) || form.phone.trim(),
      address: form.address.trim(),
      city: form.city.trim() || undefined,
      province: form.province.trim() || undefined,
      postal: normalizeIranPostalCode(form.postal.trim()) || form.postal.trim(),
      email: form.email.trim() || undefined,
      note:
        [
          form.note.trim(),
          `ارسال: ${shipOptions.find((s) => s.id === shipMethod)?.title ?? shipMethod}`,
          `پرداخت: ${payMethod === "cod" ? "در محل" : "آنلاین"}`,
        ]
          .filter(Boolean)
          .join(" | ") || undefined,
      discountCode: (discountPreview?.code || discountCode).trim() || undefined,
      paymentMethod: payMethod,
      shippingMethodId: shipMethod || undefined,
    });
    setSubmitting(false);

    if (!res.ok) {
      if (res.error === "login_required") {
        // مسیر مهمان باید کار کند؛ اگر هنوز login_required آمد، پیام بده نه ریدایرکت اجباری
        setPayStatus("failed");
        setError("ثبت سفارش ممکن نشد. دوباره تلاش کنید یا وارد حساب شوید.");
        setStep(5);
        return;
      }
      setPayStatus("failed");
      setError(mapCheckoutError(res.error));
      setStep(5);
      return;
    }

    orderPlacedRef.current = true;
    clearCartLocal();
    const trackCode = shortTrack(res.orderId);
    const serverTotal =
      typeof (res as { totalAmount?: number }).totalAmount === "number"
        ? Number((res as { totalAmount?: number }).totalAmount)
        : payable;
    setDoneOrder({
      id: res.orderId,
      total: serverTotal,
      track: trackCode,
    });
    void track({
      event_name: "purchase",
      order_id: res.orderId,
      value: payable,
    });
    // COD = موفق (پرداخت هنگام تحویل) | آنلاین = معلق تا تأیید درگاه
    setPayStatus(payMethod === "cod" ? "success" : "pending");
    setStep(5);
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] w-full items-center justify-center" dir="rtl">
        <LumaSpin />
      </div>
    );
  }

  if (!items.length && !doneOrder && step !== 5) {
    return (
      <div className="w-full max-w-none space-y-4 px-4 py-16 text-center" dir="rtl">
        <p>سبد خرید خالی است.</p>
        <Link href="/products" className="text-primary underline">
          بازگشت به فروشگاه
        </Link>
      </div>
    );
  }

  const reserveBanner =
    reserveHint && step < 5 ? (
      <p className="text-muted-foreground border-border bg-muted/40 mb-4 rounded-xl border px-3 py-2 text-xs">
        {reserveHint}
        {reserveExpiresAt ? (
          <span className="mr-2 tabular-nums">
            {" "}
            (تا{" "}
            {new Date(reserveExpiresAt).toLocaleTimeString("fa-IR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            )
          </span>
        ) : null}
      </p>
    ) : null;

  return (
    <div className="bg-surface-muted min-h-screen" dir="rtl">
      <div className="w-full max-w-none mx-auto px-4 py-8 md:py-12">
        {reserveBanner}
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-iranyekan-heavy text-primary">
            تسویه حساب
          </h1>
        </div>

        {/* نوار ۵ مرحله */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-1 sm:gap-2">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  if (s.n < step && step < 5) setStep(s.n);
                }}
                className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full text-xs sm:text-sm font-medium ${
                  step === s.n
                    ? "bg-primary text-primary-foreground"
                    : step > s.n
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {toPersianDigits(String(s.n))}
              </button>
              <span className="text-muted-foreground hidden text-xs sm:inline md:text-sm">
                {s.label}
              </span>
              {i < STEPS.length - 1 ? (
                <span className="bg-border mx-0.5 h-px w-4 sm:w-8" />
              ) : null}
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-5">
          <div className="border-border bg-card space-y-4 rounded-2xl border p-5 shadow-sm lg:col-span-3">
            {error && step !== 5 ? (
              <p className="text-destructive text-sm">{error}</p>
            ) : null}

            {/* ۱ — تأیید اقلام */}
            {step === 1 ? (
              <>
                <h2 className="font-semibold text-primary">۱. تأیید آیتم‌های سبد</h2>
                <p className="text-muted-foreground text-xs">
                  تعداد، وضعیت محصول و وزن انتخاب‌شده را بررسی کنید.
                </p>
                <ul className="space-y-3">
                  {items.map((it) => (
                    <li
                      key={it.itemId || it.variantId}
                      className="border-border flex gap-3 rounded-xl border p-3"
                    >
                      <div className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-lg">
                        {it.image ? (
                          <Image
                            src={it.image}
                            alt={it.title}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="font-medium text-primary">{it.title}</p>
                        <div className="text-muted-foreground mt-1 flex flex-wrap gap-2 text-xs">
                          {it.weight ? (
                            <span className="bg-muted rounded-md px-2 py-0.5">
                              وزن: {it.weight}
                            </span>
                          ) : null}
                          {it.roast || it.roastHex ? (
                            <span className="bg-muted inline-flex items-center gap-1 rounded-md px-2 py-0.5">
                              وضعیت محصول:
                              {it.roastHex ? (
                                <span
                                  className="inline-block h-3 w-3 rounded-full border"
                                  style={{ background: it.roastHex }}
                                />
                              ) : null}
                              {it.roast || it.roastHex}
                            </span>
                          ) : null}
                          <span className="bg-muted rounded-md px-2 py-0.5">
                            تعداد: {toPersianDigits(String(it.quantity))}
                          </span>
                        </div>
                        <p className="mt-1 font-medium">
                          <Price
                            amount={Number(it.price) * Number(it.quantity)}
                            weight="sm"
                          />
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2 pt-2">
                  <Link
                    href="/cart"
                    className="border-border flex h-11 flex-1 items-center justify-center rounded-xl border text-sm"
                  >
                    ویرایش سبد
                  </Link>
                  <button
                    type="button"
                    onClick={goFrom1}
                    className="bg-primary text-primary-foreground h-11 flex-1 rounded-xl text-sm font-medium"
                  >
                    ادامه — اطلاعات گیرنده
                  </button>
                </div>
              </>
            ) : null}

            {/* ۲ — اطلاعات فردی */}
            {step === 2 ? (
              <>
                <h2 className="font-semibold text-primary">۲. اطلاعات گیرنده</h2>
                <p className="text-muted-foreground text-xs">
                  خرید بدون ثبت‌نام ممکن است. شماره موبایل برای هماهنگی ارسال الزامی است.
                </p>
                {isGuestCheckout ? (
                  <p className="border-border bg-muted/40 rounded-xl border px-3 py-2 text-xs leading-6">
                    مهمان هستید — سفارش با کد پیگیری قابل پیگیری است. برای ذخیره آدرس و
                    تاریخچه در حساب،{" "}
                    <Link
                      href="/ورود?next=/checkout"
                      className="text-primary font-medium underline-offset-2 hover:underline"
                    >
                      وارد شوید
                    </Link>
                    .
                  </p>
                ) : null}

                {savedAddresses.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const def =
                          savedAddresses.find((x) => x.is_default) ??
                          savedAddresses[0];
                        if (def) applyAddress(def);
                        setAddressMode("default");
                      }}
                      className={`rounded-xl border p-3 text-sm font-medium transition-colors ${
                        addressMode === "default"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      استفاده از آدرس پیش‌فرض
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddressMode("new");
                        setSelectedAddressId(null);
                        setForm((f) => ({
                          ...f,
                          address: "",
                          city: "",
                          postal: "",
                          note: "",
                        }));
                      }}
                      className={`rounded-xl border p-3 text-sm font-medium transition-colors ${
                        addressMode === "new"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      افزودن آدرس جدید
                    </button>
                  </div>
                ) : null}

                {savedAddresses.length > 0 && addressMode === "default" ? (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs">
                      یکی از آدرس‌های ذخیره‌شده را انتخاب کنید
                    </p>
                    <ul className="space-y-2">
                      {savedAddresses.map((a) => (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => applyAddress(a)}
                            className={`w-full rounded-xl border p-3 text-right text-sm ${
                              selectedAddressId === a.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/50"
                            }`}
                          >
                            <span className="font-medium">
                              {a.full_name}
                              {a.is_default ? (
                                <span className="text-primary mr-2 text-xs">
                                  (پیش‌فرض)
                                </span>
                              ) : null}
                            </span>
                            <span className="text-muted-foreground mt-1 block text-xs">
                              {a.city} — {a.address_line}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="text-muted-foreground text-xs">
                      در صورت نیاز می‌توانید فیلدهای زیر را قبل از ادامه ویرایش کنید.
                    </p>
                  </div>
                ) : null}

                {(addressMode === "new" || savedAddresses.length === 0) ? (
                  <p className="text-muted-foreground text-xs">
                    مشخصات گیرنده و آدرس تحویل را وارد کنید.
                  </p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["firstName", "نام *", "text"],
                      ["lastName", "نام خانوادگی *", "text"],
                      ["phone", "شماره موبایل *", "tel"],
                      ["postal", "کد پستی ۱۰ رقمی *", "text"],
                      ["city", "شهر *", "text"],
                    ] as const
                  ).map(([key, label, type]) => (
                    <label key={key} className="block space-y-1 text-sm">
                      <span>{label}</span>
                      <input
                        type={type}
                        value={form[key]}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, [key]: e.target.value }))
                        }
                        className="border-input bg-background h-10 w-full rounded-xl border px-3"
                        dir={key === "phone" || key === "postal" ? "ltr" : "rtl"}
                        inputMode={key === "phone" || key === "postal" ? "numeric" : undefined}
                        placeholder={
                          key === "phone"
                            ? "09121234567"
                            : key === "postal"
                              ? "1234567890"
                              : undefined
                        }
                        autoComplete={
                          key === "phone"
                            ? "tel"
                            : key === "postal"
                              ? "postal-code"
                              : undefined
                        }
                        required
                      />
                    </label>
                  ))}
                  {isGuestCheckout ? (
                    <label className="block space-y-1 text-sm sm:col-span-2">
                      <span>ایمیل (اختیاری)</span>
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, email: e.target.value }))
                        }
                        className="border-input bg-background h-10 w-full rounded-xl border px-3"
                        dir="ltr"
                        autoComplete="email"
                        placeholder="برای دریافت رسید سفارش"
                      />
                    </label>
                  ) : null}
                  <label className="block space-y-1 text-sm sm:col-span-2">
                    <span>استان *</span>
                    <select
                      value={form.province}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, province: e.target.value }))
                      }
                      className="border-input bg-background h-10 w-full rounded-xl border px-3"
                      dir="rtl"
                    >
                      <option value="">انتخاب استان…</option>
                      {IRAN_PROVINCES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="block space-y-1 text-sm">
                  <span>آدرس کامل *</span>
                  <textarea
                    value={form.address}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address: e.target.value }))
                    }
                    rows={3}
                    className="border-input bg-background w-full rounded-xl border px-3 py-2"
                    dir="rtl"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span>توضیحات (اختیاری)</span>
                  <input
                    type="text"
                    value={form.note}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, note: e.target.value }))
                    }
                    className="border-input bg-background h-10 w-full rounded-xl border px-3"
                    dir="rtl"
                  />
                </label>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="border-border h-11 flex-1 rounded-xl border text-sm"
                  >
                    بازگشت
                  </button>
                  <button
                    type="button"
                    onClick={goFrom2}
                    className="bg-primary text-primary-foreground h-11 flex-1 rounded-xl text-sm font-medium"
                  >
                    ادامه — نحوه ارسال
                  </button>
                </div>
              </>
            ) : null}

            {/* ۳ — ارسال */}
            {step === 3 ? (
              <>
                <h2 className="font-semibold text-primary">۳. نحوه ارسال</h2>
              {shipLoading ? (
                <p className="text-muted-foreground text-xs">در حال محاسبه هزینه ارسال...</p>
              ) : shipQuoteNote ? (
                <p className="text-muted-foreground text-xs">{shipQuoteNote}</p>
              ) : null}
                <div className="space-y-2">
                  {shipOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setShipMethod(opt.id)}
                      className={`flex w-full items-center justify-between rounded-xl border p-4 text-right text-sm ${
                        shipMethod === opt.id
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border"
                      }`}
                    >
                      <span>
                        <span className="block">{opt.title}</span>
                        <span className="text-muted-foreground text-xs">
                          {opt.desc}
                        </span>
                      </span>
                      <span className="shrink-0">
                        {shipMethod === opt.id ? (
                          shipLoading ? (
                            "…"
                          ) : shipFee === 0 ? (
                            shipQuoteNote && shipQuoteNote.includes("ارسال رایگان")
                              ? "رایگان"
                              : "توافقی"
                          ) : (
                            <Price amount={shipFee} weight="sm" />
                          )
                        ) : opt.fee === 0 ? (
                          "توافقی"
                        ) : (
                          <Price amount={opt.fee} weight="sm" />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="border-border h-11 flex-1 rounded-xl border text-sm"
                  >
                    بازگشت
                  </button>
                  <button
                    type="button"
                    onClick={goFrom3}
                    className="bg-primary text-primary-foreground h-11 flex-1 rounded-xl text-sm font-medium"
                  >
                    ادامه — پرداخت
                  </button>
                </div>
              </>
            ) : null}

            {/* ۴ — پرداخت */}
            {step === 4 ? (
              <>
                <h2 className="font-semibold text-primary">۴. پرداخت</h2>
                <div className="space-y-2">
                  {(
                    [
                      ["cod", "پرداخت در محل (هنگام تحویل)"],
                      ["online", "پرداخت آنلاین"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setPayMethod(id)}
                      className={`w-full rounded-xl border p-4 text-right text-sm ${
                        payMethod === id
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border"
                      }`}
                    >
                      {label}
                      {id === "online" ? (
                        <span className="text-muted-foreground mt-1 block text-xs">
                          پس از ثبت، وضعیت پرداخت «معلق» می‌ماند تا درگاه تأیید کند.
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>

                <div className="space-y-2 pt-2">
                  <p className="text-sm font-medium">کد تخفیف</p>
                  <div className="flex gap-2">
                    <input
                      value={discountCode}
                      onChange={(e) => {
                        setDiscountCode(e.target.value);
                        setDiscountPreview(null);
                        setDiscountError(null);
                      }}
                      placeholder="مثلاً WELCOME20"
                      className="border-input bg-background h-10 flex-1 rounded-xl border px-3 text-sm"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      disabled={discountLoading || !items.length}
                      className="border-border h-10 shrink-0 rounded-xl border px-4 text-sm"
                      onClick={async () => {
                        setDiscountLoading(true);
                        setDiscountError(null);
                        const lines = items.map((it) => ({
                          productId: it.productId,
                          price: Number(it.price),
                          quantity: Number(it.quantity),
                        }));
                        const res = await validateDiscountAction(
                          discountCode,
                          subtotal,
                          lines,
                        );
                        setDiscountLoading(false);
                        if (!res.ok) {
                          setDiscountPreview(null);
                          setDiscountError(
                            (
                              {
                                invalid: "کد نامعتبر است",
                                not_found: "کد تخفیف یافت نشد",
                                inactive: "این کد غیرفعال است",
                                expired: "مهلت کد تمام شده",
                                not_started: "کد هنوز فعال نشده",
                                exhausted: "سقف استفاده تمام شده",
                                max_uses: "سقف استفاده تمام شده",
                                min_order: "حداقل مبلغ سفارش رعایت نشده",
                                empty: "کد را وارد کنید",
                              } as Record<string, string>
                            )[res.error] ?? "خطا در بررسی کد",
                          );
                          return;
                        }
                        setDiscountPreview(res.discount);
                      }}
                    >
                      {discountLoading ? "…" : "اعمال"}
                    </button>
                  </div>
                  {discountError ? (
                    <p className="text-destructive text-xs">{discountError}</p>
                  ) : null}
                  {discountPreview ? (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      <Price amount={discountPreview.discountAmount} weight="sm" />{" "}
                      تخفیف اعمال شد
                    </p>
                  ) : null}
                </div>

                <div className="bg-muted/40 space-y-1 rounded-xl p-3 text-sm">
                  <p>
                    <span className="text-muted-foreground">گیرنده: </span>
                    {fullName()} — {form.phone}
                  </p>
                  <p>
                    <span className="text-muted-foreground">آدرس: </span>
                    {form.city} {form.address}
                  </p>
                  <p>
                    <span className="text-muted-foreground">ارسال: </span>
                    {shipOptions.find((s) => s.id === shipMethod)?.title}
                  </p>
                  <p className="font-bold">
                    قابل پرداخت: <Price amount={payable} weight="md" />
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="border-border h-11 flex-1 rounded-xl border text-sm"
                  >
                    بازگشت
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handlePay()}
                    className="bg-primary text-primary-foreground h-11 flex-1 rounded-xl text-sm font-medium disabled:opacity-60"
                  >
                    {submitting ? "در حال ثبت…" : "ثبت و پرداخت"}
                  </button>
                </div>
              </>
            ) : null}

            {/* ۵ — گزارش پرداخت */}
            {step === 5 ? (
              <div className="space-y-4 text-center">
                <h2 className="font-semibold text-primary">۵. گزارش پرداخت</h2>
                {payStatus === "success" ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/40">
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                      پرداخت / ثبت موفق
                    </p>
                    <p className="text-muted-foreground mt-2 text-sm">
                      سفارش شما با موفقیت ثبت شد.
                      {payMethod === "cod"
                        ? " مبلغ هنگام تحویل دریافت می‌شود."
                        : ""}
                    </p>
                  </div>
                ) : null}
                {payStatus === "pending" ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950/40">
                    <p className="text-lg font-bold text-amber-800 dark:text-amber-200">
                      پرداخت معلق
                    </p>
                    <p className="text-muted-foreground mt-2 text-sm">
                      سفارش ثبت شد. وضعیت پرداخت معلق است و پس از تأیید ادمین موفق میشود.
                    </p>
                  </div>
                ) : null}
                {payStatus === "failed" ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-900 dark:bg-rose-950/40">
                    <p className="text-lg font-bold text-rose-700 dark:text-rose-300">
                      ناموفق
                    </p>
                    <p className="text-destructive mt-2 text-sm">
                      {error || "ثبت یا پرداخت انجام نشد."}
                    </p>
                  </div>
                ) : null}

                {doneOrder ? (
                  <div className="border-border bg-muted/30 space-y-2 rounded-xl border p-4 text-sm">
                    <p>
                      <span className="text-muted-foreground">کد پیگیری: </span>
                      <span className="font-mono text-base font-bold tracking-wider">
                        {doneOrder.track}
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs break-all">
                      شناسه سفارش: {doneOrder.id}
                    </p>
                    <p>
                      مبلغ: <Price amount={doneOrder.total} weight="md" />
                    </p>
                  </div>
                ) : null}

                {doneOrder && isGuestCheckout && payStatus !== "failed" ? (
                  <p className="text-muted-foreground text-xs leading-6">
                    کد پیگیری را نگه دارید. بدون ورود به حساب هم از صفحه پیگیری سفارش
                    قابل مشاهده است. برای تاریخچه دائمی، بعداً ثبت‌نام کنید.
                  </p>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row">
                  {payStatus === "failed" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setStep(4);
                        setError(null);
                        setPayStatus(null);
                      }}
                      className="bg-primary text-primary-foreground h-11 flex-1 rounded-xl text-sm font-medium"
                    >
                      تلاش دوباره
                    </button>
                  ) : (
                    <Link
                      href={
                        doneOrder
                          ? `/track?code=${encodeURIComponent(doneOrder.id)}`
                          : isGuestCheckout
                            ? "/track"
                            : "/dashboard?tab=orders"
                      }
                      className="bg-primary text-primary-foreground flex h-11 flex-1 items-center justify-center rounded-xl text-sm font-medium"
                    >
                      پیگیری سفارش
                    </Link>
                  )}
                  <Link
                    href="/products"
                    className="border-border flex h-11 flex-1 items-center justify-center rounded-xl border text-sm"
                  >
                    بازگشت به فروشگاه
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          {/* خلاصه */}
          <aside className="border-border bg-card h-fit rounded-2xl border p-5 shadow-sm lg:col-span-2">
            <h2 className="mb-4 font-semibold text-primary">خلاصه سفارش</h2>
            <ul className="space-y-3">
              {items.map((it) => (
                <li
                  key={it.itemId || it.variantId}
                  className="flex justify-between gap-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{it.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {[it.weight, it.roast, `×${it.quantity}`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0">
                    <Price
                      amount={Number(it.price) * Number(it.quantity)}
                      weight="sm"
                    />
                  </span>
                </li>
              ))}
            </ul>
            <div className="border-border mt-4 space-y-1 border-t pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">جمع کالا</span>
                <Price amount={subtotal} weight="sm" />
              </div>
              {discountPreview ? (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>تخفیف</span>
                  <span>
                    −
                    <Price amount={discountPreview.discountAmount} weight="sm" />
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-muted-foreground">ارسال</span>
                {shipFee === 0 ? (
                  <span>
                    {shipQuoteNote && shipQuoteNote.includes("ارسال رایگان")
                      ? "رایگان"
                      : "توافقی"}
                  </span>
                ) : (
                  <Price amount={shipFee} weight="sm" />
                )}
              </div>
              <div className="flex justify-between text-base font-bold">
                <span>قابل پرداخت</span>
                <Price amount={payable} weight="md" />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
