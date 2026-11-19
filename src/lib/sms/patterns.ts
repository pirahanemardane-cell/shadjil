/**
 * رجیستری پترن‌های ملی‌پیامک
 * bodyId از env: MELIPAYAMAK_BODY_<KEY>
 */

export type SmsPatternKey =
  | "OTP_REGISTER"
  | "OTP_LOGIN"
  | "OTP_RECOVERY"
  | "SECURITY_PHONE_CHANGE"
  | "SECURITY_PASSWORD_CHANGE"
  | "SECURITY_SUSPICIOUS_LOGIN"
  | "ORDER_NEW_ADMIN"
  | "ORDER_PLACED"
  | "ORDER_CONFIRMED"
  | "ORDER_CANCELLED"
  | "ORDER_REMINDER_ADMIN"
  | "ORDER_DEADLINE_ADMIN"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "PAYMENT_REVERSED"
  | "SHIPPED"
  | "TRACKING_CODE"
  | "SHIP_DELAY"
  | "DELIVERY_FAILED"
  | "SELLER_PAYOUT_PROCESSING"
  | "SELLER_PAYOUT_SUCCESS"
  | "SELLER_PAYOUT_FAILED"
  | "SELLER_BANK_CHANGED"
  | "RETURN_REQUESTED_ADMIN"
  | "RETURN_DECISION"
  | "RETURN_RECEIVED"
  | "REFUND_REQUESTED"
  | "REFUND_APPROVED"
  | "REFUND_DONE"
  | "REFUND_FAILED"
  | "DISPUTE_OPENED"
  | "DISPUTE_ACTION_NEEDED"
  | "DISPUTE_RESULT"
  | "ADMIN_CRITICAL"
  | "ADMIN_FRAUD"
  | "ADMIN_PAYMENT_OUTAGE"
  | "ADMIN_SMS_OUTAGE";

export type PatternDef = {
  key: SmsPatternKey;
  envKey: string;
  arity: number;
  panelText: string;
  priority: "required" | "recommended";
};

function p(
  key: SmsPatternKey,
  arity: number,
  panelText: string,
  priority: "required" | "recommended" = "required",
): PatternDef {
  return { key, envKey: `MELIPAYAMAK_BODY_${key}`, arity, panelText, priority };
}

/** Approved Melipayamak OTP body (single var {0} = code only). Panel ID: 592259 */
const OTP_PANEL_TEXT =
  "کد تأیید شما در شادجیل: {0} میباشد. https://shadjil.ir/";

export const SMS_PATTERNS: Record<SmsPatternKey, PatternDef> = {
  // Login / register / recovery share the same single-variable approved pattern.
  OTP_REGISTER: p("OTP_REGISTER", 1, OTP_PANEL_TEXT),
  OTP_LOGIN: p("OTP_LOGIN", 1, OTP_PANEL_TEXT),
  OTP_RECOVERY: p("OTP_RECOVERY", 1, OTP_PANEL_TEXT),
  SECURITY_PHONE_CHANGE: p("SECURITY_PHONE_CHANGE", 2, "{0} عزیز شماره موبایل حساب شما در شادجیل به {1} تغییر یافت. اگر شما نبودید فوراً با پشتیبانی تماس بگیرید. https://shadjil.ir لغو11"),
  SECURITY_PASSWORD_CHANGE: p("SECURITY_PASSWORD_CHANGE", 1, "{0} عزیز رمز عبور حساب شما در شادجیل با موفقیت تغییر کرد. اگر شما نبودید فوراً اقدام کنید. https://shadjil.ir لغو11"),
  SECURITY_SUSPICIOUS_LOGIN: p("SECURITY_SUSPICIOUS_LOGIN", 2, "{0} عزیز ورود جدید از دستگاه/IP مشکوک به حساب شادجیل شما ثبت شد. زمان: {1} https://shadjil.ir لغو11", "recommended"),
  ORDER_NEW_ADMIN: p("ORDER_NEW_ADMIN", 3, "{0} عزیز سفارش جدید شماره {1} به مبلغ {2} تومان در شادجیل ثبت شد. لطفاً بررسی کنید. https://shadjil.ir لغو11"),
  ORDER_PLACED: p("ORDER_PLACED", 3, "{0} عزیز سفارش شما با شماره {1} در شادجیل با موفقیت ثبت شد. مبلغ: {2} تومان https://shadjil.ir لغو11", "recommended"),
  ORDER_CONFIRMED: p("ORDER_CONFIRMED", 2, "{0} عزیز سفارش {1} شما در شادجیل تأیید شد و در حال آماده‌سازی است. https://shadjil.ir لغو11"),
  ORDER_CANCELLED: p("ORDER_CANCELLED", 4, "{0} عزیز سفارش {1} شما در شادجیل {2} شد. دلیل: {3} https://shadjil.ir لغو11"),
  ORDER_REMINDER_ADMIN: p("ORDER_REMINDER_ADMIN", 2, "{0} عزیز سفارش {1} در شادجیل هنوز اقدام نشده است. لطفاً بررسی کنید. https://shadjil.ir لغو11", "recommended"),
  ORDER_DEADLINE_ADMIN: p("ORDER_DEADLINE_ADMIN", 3, "{0} عزیز Deadline پردازش سفارش {1} در شادجیل نزدیک است ({2}). https://shadjil.ir لغو11", "recommended"),
  PAYMENT_SUCCESS: p("PAYMENT_SUCCESS", 3, "{0} عزیز پرداخت سفارش {1} به مبلغ {2} تومان در شادجیل با موفقیت انجام شد. https://shadjil.ir لغو11"),
  PAYMENT_FAILED: p("PAYMENT_FAILED", 2, "{0} عزیز پرداخت سفارش {1} در شادجیل ناموفق بود. لطفاً مجدداً تلاش کنید. https://shadjil.ir لغو11"),
  PAYMENT_REVERSED: p("PAYMENT_REVERSED", 3, "{0} عزیز مبلغ {1} تومان از سفارش {2} در شادجیل به حساب شما برگشت خورد. https://shadjil.ir لغو11", "recommended"),
  SHIPPED: p("SHIPPED", 2, "{0} عزیز سفارش {1} شما از شادجیل ارسال شد. https://shadjil.ir لغو11"),
  TRACKING_CODE: p("TRACKING_CODE", 3, "{0} عزیز کد رهگیری سفارش {1} از شادجیل: {2} https://shadjil.ir لغو11"),
  SHIP_DELAY: p("SHIP_DELAY", 2, "{0} عزیز ارسال/تحویل سفارش {1} از شادجیل با تأخیر مواجه شده است. https://shadjil.ir لغو11", "recommended"),
  DELIVERY_FAILED: p("DELIVERY_FAILED", 2, "{0} عزیز تحویل سفارش {1} از شادجیل ناموفق بود. لطفاً با پشتیبانی تماس بگیرید. https://shadjil.ir لغو11", "recommended"),
  SELLER_PAYOUT_PROCESSING: p("SELLER_PAYOUT_PROCESSING", 2, "{0} عزیز مبلغ {1} تومان از فروش شما در شادجیل در حال پردازش است. https://shadjil.ir لغو11", "recommended"),
  SELLER_PAYOUT_SUCCESS: p("SELLER_PAYOUT_SUCCESS", 2, "{0} عزیز تسویه مبلغ {1} تومان در شادجیل با موفقیت انجام شد. https://shadjil.ir لغو11"),
  SELLER_PAYOUT_FAILED: p("SELLER_PAYOUT_FAILED", 3, "{0} عزیز تسویه مبلغ {1} تومان در شادجیل ناموفق بود. دلیل: {2} https://shadjil.ir لغو11"),
  SELLER_BANK_CHANGED: p("SELLER_BANK_CHANGED", 1, "{0} عزیز اطلاعات حساب بانکی شما در شادجیل تغییر یافت. اگر شما نبودید فوراً اقدام کنید. https://shadjil.ir لغو11"),
  RETURN_REQUESTED_ADMIN: p("RETURN_REQUESTED_ADMIN", 2, "{0} عزیز درخواست مرجوعی برای سفارش {1} در شادجیل ثبت شد. https://shadjil.ir لغو11"),
  RETURN_DECISION: p("RETURN_DECISION", 3, "{0} عزیز درخواست مرجوعی سفارش {1} در شادجیل {2} شد. https://shadjil.ir لغو11"),
  RETURN_RECEIVED: p("RETURN_RECEIVED", 2, "{0} عزیز کالای مرجوعی سفارش {1} در شادجیل دریافت شد. https://shadjil.ir لغو11", "recommended"),
  REFUND_REQUESTED: p("REFUND_REQUESTED", 2, "{0} عزیز درخواست بازپرداخت سفارش {1} در شادجیل ثبت شد. https://shadjil.ir لغو11", "recommended"),
  REFUND_APPROVED: p("REFUND_APPROVED", 2, "{0} عزیز بازپرداخت سفارش {1} در شادجیل تأیید شد. https://shadjil.ir لغو11"),
  REFUND_DONE: p("REFUND_DONE", 3, "{0} عزیز مبلغ {1} تومان از سفارش {2} در شادجیل به حساب شما بازگردانده شد. https://shadjil.ir لغو11"),
  REFUND_FAILED: p("REFUND_FAILED", 2, "{0} عزیز بازپرداخت سفارش {1} در شادجیل ناموفق بود. https://shadjil.ir لغو11"),
  DISPUTE_OPENED: p("DISPUTE_OPENED", 2, "{0} عزیز اختلاف برای سفارش {1} در شادجیل ایجاد شد. لطفاً وارد پنل شوید. https://shadjil.ir لغو11"),
  DISPUTE_ACTION_NEEDED: p("DISPUTE_ACTION_NEEDED", 2, "{0} عزیز برای اختلاف سفارش {1} در شادجیل نیاز به اقدام/مدرک دارید. https://shadjil.ir لغو11"),
  DISPUTE_RESULT: p("DISPUTE_RESULT", 3, "{0} عزیز نتیجه نهایی اختلاف سفارش {1} در شادجیل: {2} https://shadjil.ir لغو11"),
  ADMIN_CRITICAL: p("ADMIN_CRITICAL", 2, "خطای Critical سیستم شادجیل: {0} زمان: {1} https://shadjil.ir لغو11"),
  ADMIN_FRAUD: p("ADMIN_FRAUD", 2, "فعالیت مشکوک/Fraud در شادجیل: {0} {1} https://shadjil.ir لغو11", "recommended"),
  ADMIN_PAYMENT_OUTAGE: p("ADMIN_PAYMENT_OUTAGE", 1, "اختلال جدی در درگاه پرداخت شادجیل: {0} https://shadjil.ir لغو11"),
  ADMIN_SMS_OUTAGE: p("ADMIN_SMS_OUTAGE", 1, "اختلال در سرویس پیامک شادجیل: {0} https://shadjil.ir لغو11", "recommended"),
};

const OTP_PATTERN_KEYS = new Set<SmsPatternKey>([
  "OTP_LOGIN",
  "OTP_REGISTER",
  "OTP_RECOVERY",
]);

/**
 * Resolve Melipayamak bodyId for a pattern key.
 * OTP login/register/recovery: MELIPAYAMAK_BODY_<KEY> → MELIPAYAMAK_BODY_OTP_LOGIN → MELIPAYAMAK_BODY_ID.
 * Production OTP body ID for this project: 592259 (set via MELIPAYAMAK_BODY_OTP_LOGIN).
 */
export function resolveBodyId(key: SmsPatternKey): string | undefined {
  const def = SMS_PATTERNS[key];
  const specific = process.env[def.envKey]?.trim();
  if (specific) return specific;
  if (OTP_PATTERN_KEYS.has(key)) {
    const otpLogin = process.env.MELIPAYAMAK_BODY_OTP_LOGIN?.trim();
    if (otpLogin) return otpLogin;
    return process.env.MELIPAYAMAK_BODY_ID?.trim();
  }
  return undefined;
}
