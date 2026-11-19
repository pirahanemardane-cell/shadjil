# Melipayamak patterns

See `src/lib/sms/patterns.ts` for `panelText`, arity, and env keys.

## OTP login / register / recovery (approved)

- Pattern body ID: **592259**
- Env: prefer `MELIPAYAMAK_BODY_OTP_LOGIN=592259` (fallback: `MELIPAYAMAK_BODY_ID`)
- Approved text: `کد تأیید شما در شادجیل: {0} میباشد. https://shadjil.ir/`
- **Only one variable:** `{0}` = verification code. Do not send name or domain as a variable.
- Sender: `meliSendLoginCode` → `BaseServiceNumber` with `text` = code only.

## Other transactional SMS

Set `MELIPAYAMAK_USERNAME`, `MELIPAYAMAK_PASSWORD`, `MELIPAYAMAK_BODY_*`, and `ADMIN_SMS_PHONES` in Vercel.
Do not reuse the OTP body ID for order/payment patterns.
