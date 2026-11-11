const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://shadjil.ir").replace(/\/$/, "");
/** کلید ثابت — فایل public/{key}.txt باید در دسترس باشد */
export const INDEXNOW_KEY =
  process.env.INDEXNOW_KEY?.trim() || "shadjil-indexnow-8f3a2c1b9e7d4a06";

export async function submitIndexNow(urls: string[]): Promise<void> {
  const list = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  if (!list.length) return;
  try {
    const host = new URL(SITE).host;
    const body = {
      host,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE}/${INDEXNOW_KEY}.txt`,
      urlList: list.map((u) => (u.startsWith("http") ? u : `${SITE}${u.startsWith("/") ? "" : "/"}${u}`)),
    };
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(body),
    });
    if (!res.ok && res.status !== 202) {
      console.warn("[IndexNow]", res.status, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.warn("[IndexNow]", e);
  }
}

export function productUrl(slug: string) {
  return `${SITE}/products/${slug}`;
}

export function blogUrl(slug: string) {
  return `${SITE}/blog/${slug}`;
}
