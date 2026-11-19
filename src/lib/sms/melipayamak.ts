/**
 * ملی‌پیامک — الگو + OTP
 * OTP login/register/recovery: single-variable pattern ({0} = code only).
 */
import { resolveBodyId } from "./patterns";

export type MeliResult =
  | { ok: true; recId: string }
  | { ok: false; error: string; raw?: string };

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v || undefined;
}

function requireEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function parseResponse(body: string): MeliResult {
  const t = (body || "").trim().replace(/^"|"$/g, "");
  if (!t) return { ok: false, error: "empty_response", raw: body };
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    const val = String(j.Value ?? j.value ?? j.RecId ?? j.recId ?? "");
    const status = Number(j.RetStatus ?? j.retStatus ?? j.Status ?? 1);
    if (status === 1 && val && !/^(0|1[0-9]|2[0-2]|35)$/.test(val)) {
      return { ok: true, recId: val };
    }
    if (val && /^\d{5,}$/.test(val)) return { ok: true, recId: val };
    return { ok: false, error: val || `status_${status}`, raw: t };
  } catch {
    /* plain */
  }
  if (/^\d{5,}$/.test(t)) return { ok: true, recId: t };
  if (/^-?\d+$/.test(t)) {
    const n = Number(t);
    if (n > 1000) return { ok: true, recId: t };
    return { ok: false, error: `meli_${t}`, raw: t };
  }
  return { ok: false, error: "unknown_response", raw: t };
}

async function postForm(path: string, fields: Record<string, string>): Promise<MeliResult> {
  const body = new URLSearchParams(fields);
  const res = await fetch(`https://rest.payamak-panel.com/api/SendSMS/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) return { ok: false, error: `http_${res.status}`, raw: text };
  return parseResponse(text);
}

export async function meliSendByBodyId(opts: {
  to: string;
  bodyId: string;
  text: string;
}): Promise<MeliResult> {
  const username = env("MELIPAYAMAK_USERNAME");
  const password = env("MELIPAYAMAK_PASSWORD");
  if (!username || !password) return { ok: false, error: "config_missing_credentials" };
  if (!opts.bodyId?.trim()) return { ok: false, error: "config_missing_body_id" };
  return postForm("BaseServiceNumber", {
    username,
    password,
    to: opts.to,
    text: opts.text,
    bodyId: opts.bodyId.trim(),
  });
}

export async function meliSendByPattern(opts: { to: string; text: string }): Promise<MeliResult> {
  const bodyId = env("MELIPAYAMAK_BODY_ID");
  if (!bodyId) return { ok: false, error: "config_missing_body_id" };
  return meliSendByBodyId({ to: opts.to, bodyId, text: opts.text });
}

export async function meliSendOtp(opts: { to: string; code: number }): Promise<MeliResult> {
  try {
    const username = requireEnv("MELIPAYAMAK_USERNAME");
    const password = requireEnv("MELIPAYAMAK_PASSWORD");
    const from = requireEnv("MELIPAYAMAK_FROM");
    return postForm("SendOtp", {
      username,
      password,
      to: opts.to,
      from,
      code: String(opts.code),
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "config" };
  }
}

/**
 * Send OTP for login / register / recovery.
 * Pattern args: only the verification code (never name or domain).
 * bodyId: MELIPAYAMAK_BODY_OTP_LOGIN, else MELIPAYAMAK_BODY_ID (needed value: 592259).
 */
export async function meliSendLoginCode(opts: { to: string; code: string }): Promise<MeliResult> {
  const bodyId = resolveBodyId("OTP_LOGIN");
  if (bodyId) {
    // BaseServiceNumber `text` is semicolon-joined pattern vars; arity=1 → code only.
    return meliSendByBodyId({ to: opts.to, bodyId, text: String(opts.code).trim() });
  }
  return meliSendOtp({ to: opts.to, code: Number(opts.code) });
}
