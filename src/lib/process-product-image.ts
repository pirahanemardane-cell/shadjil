import sharp from "sharp";
import { existsSync, readFileSync } from "fs";
import path from "path";

const _WEBP_QUALITY = 82;
const WATERMARK_RATIO = 0.14; // smaller mark on product photos
const _MARGIN_RATIO = 0.03;
const WATERMARK_OPACITY = 0.40;

/** فقط این فایل — طبق درخواست */
const WATERMARK_FILE = "logo.webp";

/** URL عمومی برای fallback وقتی filesystem روی serverless فایل را نبیند */
const WATERMARK_PUBLIC_URL =
  process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/brand/${WATERMARK_FILE}`
    : `https://shadjil.ir/brand/${WATERMARK_FILE}`;

export const PRODUCT_IMAGE_SIZES = {
  thumb: 320,
  small: 480,
  medium: 800,
  large: 1200,
} as const;

export type ProductImageSizeName = keyof typeof PRODUCT_IMAGE_SIZES;

let cachedLogo: Buffer | null | undefined;
let loggedMissing = false;

function tryReadLogoFile(logoPath: string): Buffer | null {
  try {
    if (!existsSync(logoPath)) return null;
    const buf = readFileSync(logoPath);
    return buf.length > 0 ? buf : null;
  } catch {
    // Never throw / spam on missing paths (common on Vercel serverless)
    return null;
  }
}

async function loadWatermarkLogo(): Promise<Buffer | null> {
  if (cachedLogo !== undefined) return cachedLogo;

  const candidates = [
    path.join(process.cwd(), "public", "brand", WATERMARK_FILE),
    path.join(process.cwd(), "brand", WATERMARK_FILE),
    path.join(process.cwd(), "public", WATERMARK_FILE),
    // Some Vercel runtimes resolve assets relative to the function bundle
    path.join(__dirname, "..", "..", "public", "brand", WATERMARK_FILE),
  ];

  // On Vercel prefer HTTP first — public/ may not be on the function FS
  const preferUrl = Boolean(process.env.VERCEL);

  const tryUrl = async (): Promise<Buffer | null> => {
    try {
      const res = await fetch(WATERMARK_PUBLIC_URL, { cache: "force-cache" });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return buf.length > 0 ? buf : null;
    } catch {
      return null;
    }
  };

  if (preferUrl) {
    const fromUrl = await tryUrl();
    if (fromUrl) {
      cachedLogo = fromUrl;
      return fromUrl;
    }
  }

  for (const logoPath of candidates) {
    const buf = tryReadLogoFile(logoPath);
    if (buf) {
      cachedLogo = buf;
      return buf;
    }
  }

  if (!preferUrl) {
    const fromUrl = await tryUrl();
    if (fromUrl) {
      cachedLogo = fromUrl;
      return fromUrl;
    }
  }

  if (!loggedMissing) {
    loggedMissing = true;
    console.warn("[watermark] logo unavailable; continuing without mark");
  }
  cachedLogo = null;
  return null;
}

async function buildWatermarkOverlay(
  logoBuf: Buffer,
  targetW: number,
): Promise<{ buf: Buffer; width: number; height: number } | null> {
  try {
    const logoMaxW = Math.max(48, Math.round(targetW * WATERMARK_RATIO));
    const resized = await sharp(logoBuf)
      .resize({
        width: logoMaxW,
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
      })
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    const { data: rgba, info } = await sharp(resized.data)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    for (let i = 3; i < rgba.length; i += 4) {
      rgba[i] = Math.round(rgba[i] * WATERMARK_OPACITY);
    }

    const buf = await sharp(rgba, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer();

    return { buf, width: info.width, height: info.height };
  } catch (e) {
    console.warn("[watermark] build overlay failed", e);
    return null;
  }
}

export async function processProductImageSizes(
  input: Buffer,
): Promise<Record<ProductImageSizeName, Buffer>> {
  const rotated = await sharp(input, { failOn: "none" }).rotate().toBuffer();
  const meta = await sharp(rotated).metadata();
  const srcW = meta.width ?? PRODUCT_IMAGE_SIZES.large;
  const logoBuf = await loadWatermarkLogo();
  const out = {} as Record<ProductImageSizeName, Buffer>;

  let masterOverlay: { buf: Buffer; width: number; height: number } | null = null;
  if (logoBuf) {
    masterOverlay = await buildWatermarkOverlay(
      logoBuf,
      Math.min(srcW, PRODUCT_IMAGE_SIZES.large),
    );
  }
  void masterOverlay;

  for (const [name, maxW] of Object.entries(PRODUCT_IMAGE_SIZES) as [
    ProductImageSizeName,
    number,
  ][]) {
    // همه خروجی‌ها مربع ۸۰۰×۸۰۰ (center cover)
    const side = maxW;

    // 1) base: cover → 800×800 + mild sharpen (فقط عکس، نه لوگو)
    const resized = await sharp(rotated)
      .resize({
        width: side,
        height: side,
        fit: "cover",
        position: "centre",
        withoutEnlargement: false,
        kernel: sharp.kernel.lanczos3,
      })
      .sharpen({ sigma: 0.55, m1: 0.7, m2: 0.35 })
      .toBuffer({ resolveWithObject: true });

    const w = resized.info.width;
    const h = resized.info.height;

    // 2) watermark AFTER sharpen — کیفیت لوگو مستقل از کیفیت عکس ورودی
    let pipeline = sharp(resized.data);

    if (logoBuf) {
      try {
        // همیشه از فایل لوگوی اصلی با lanczos بساز — نه از نسخه فشرده‌شده‌ی عکس
        const overlay = await buildWatermarkOverlay(logoBuf, w);
        if (overlay) {
          const left = Math.max(0, Math.round((w - overlay.width) / 2));
          const top = Math.max(0, Math.round((h - overlay.height) / 2));
          pipeline = sharp(resized.data).composite([
            { input: overlay.buf, left, top },
          ]);
        }
      } catch (e) {
        console.warn("[watermark] composite skip", name, e);
      }
    }

    // 3) WebP بالاترین کیفیت عملی (nearLossless + effort max)
    out[name] = await pipeline
      .webp({
        quality: 82,
        alphaQuality: 90,
        effort: 6,
        smartSubsample: true,
        nearLossless: false,
      })
      .toBuffer();
  }

  return out;
}

export async function processProductImage(input: Buffer): Promise<Buffer> {
  const weights = await processProductImageSizes(input);
  return weights.large;
}
