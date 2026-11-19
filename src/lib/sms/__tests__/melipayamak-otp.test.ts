import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { meliSendLoginCode } from "@/lib/sms/melipayamak";
import { SMS_PATTERNS, resolveBodyId } from "@/lib/sms/patterns";

const OTP_KEYS = ["OTP_LOGIN", "OTP_REGISTER", "OTP_RECOVERY"] as const;

describe("Melipayamak OTP single-variable contract", () => {
  const ENV_KEYS = [
    "MELIPAYAMAK_USERNAME",
    "MELIPAYAMAK_PASSWORD",
    "MELIPAYAMAK_FROM",
    "MELIPAYAMAK_BODY_ID",
    "MELIPAYAMAK_BODY_OTP_LOGIN",
    "MELIPAYAMAK_BODY_OTP_REGISTER",
    "MELIPAYAMAK_BODY_OTP_RECOVERY",
  ] as const;

  const envBackup: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) {
      envBackup[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      const prev = envBackup[key];
      if (prev === undefined) delete process.env[key];
      else process.env[key] = prev;
    }
  });

  it("registry: login/register/recovery share arity 1 and approved panel text", () => {
    const expected =
      "کد تأیید شما در شادجیل: {0} میباشد. https://shadjil.ir/";
    for (const key of OTP_KEYS) {
      expect(SMS_PATTERNS[key].arity).toBe(1);
      expect(SMS_PATTERNS[key].panelText).toBe(expected);
      expect(SMS_PATTERNS[key].panelText).not.toMatch(/\{1\}/);
    }
  });

  it("resolveBodyId prefers MELIPAYAMAK_BODY_OTP_LOGIN then MELIPAYAMAK_BODY_ID", () => {
    process.env.MELIPAYAMAK_BODY_ID = "111111";
    expect(resolveBodyId("OTP_LOGIN")).toBe("111111");
    process.env.MELIPAYAMAK_BODY_OTP_LOGIN = "592259";
    expect(resolveBodyId("OTP_LOGIN")).toBe("592259");
    expect(resolveBodyId("OTP_REGISTER")).toBe("592259");
    expect(resolveBodyId("OTP_RECOVERY")).toBe("592259");
  });

  it("meliSendLoginCode posts bodyId 592259 with only the code as text", async () => {
    process.env.MELIPAYAMAK_USERNAME = "test-user";
    process.env.MELIPAYAMAK_PASSWORD = "test-pass";
    process.env.MELIPAYAMAK_BODY_OTP_LOGIN = "592259";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ RetStatus: 1, Value: "5000123456789" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await meliSendLoginCode({ to: "09121234567", code: "482913" });
    expect(result).toEqual({ ok: true, recId: "5000123456789" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber");
    expect(init.method).toBe("POST");

    const params = new URLSearchParams(String(init.body));
    expect(params.get("bodyId")).toBe("592259");
    expect(params.get("to")).toBe("09121234567");
    expect(params.get("text")).toBe("482913");
    // Single-var contract: no name/domain/extra args in text
    expect(params.get("text")).not.toContain(";");
    expect(params.get("username")).toBe("test-user");
    expect(params.has("password")).toBe(true);
  });

  it("meliSendLoginCode falls back to MELIPAYAMAK_BODY_ID when OTP_LOGIN unset", async () => {
    process.env.MELIPAYAMAK_USERNAME = "test-user";
    process.env.MELIPAYAMAK_PASSWORD = "test-pass";
    process.env.MELIPAYAMAK_BODY_ID = "592259";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ RetStatus: 1, Value: "5000999888777" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await meliSendLoginCode({ to: "09121112233", code: "100001" });
    expect(result).toEqual({ ok: true, recId: "5000999888777" });

    const params = new URLSearchParams(String(fetchMock.mock.calls[0][1].body));
    expect(params.get("bodyId")).toBe("592259");
    expect(params.get("text")).toBe("100001");
  });

  it("meliSendLoginCode maps Melipayamak service errors without throwing", async () => {
    process.env.MELIPAYAMAK_USERNAME = "test-user";
    process.env.MELIPAYAMAK_PASSWORD = "test-pass";
    process.env.MELIPAYAMAK_BODY_OTP_LOGIN = "592259";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ RetStatus: 0, Value: "0" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await meliSendLoginCode({ to: "09121234567", code: "123456" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeTruthy();
    }
  });

  it("meliSendLoginCode maps HTTP failures", async () => {
    process.env.MELIPAYAMAK_USERNAME = "test-user";
    process.env.MELIPAYAMAK_PASSWORD = "test-pass";
    process.env.MELIPAYAMAK_BODY_OTP_LOGIN = "592259";

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "unavailable",
      }),
    );

    const result = await meliSendLoginCode({ to: "09121234567", code: "123456" });
    expect(result).toEqual({
      ok: false,
      error: "http_503",
      raw: "unavailable",
    });
  });

  it("meliSendLoginCode returns config_missing_credentials when creds absent", async () => {
    process.env.MELIPAYAMAK_BODY_OTP_LOGIN = "592259";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await meliSendLoginCode({ to: "09121234567", code: "123456" });
    expect(result).toEqual({ ok: false, error: "config_missing_credentials" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
