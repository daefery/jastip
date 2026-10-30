// PayPal Orders v2 + Payments v2, sandbox. Hold = AUTHORIZE order; exact charge = partial capture
// with final_capture; not found = void. Captures can go straight to the traveller (payee), so the
// app never holds anyone's money.
import { randomUUID } from "node:crypto";
import { toValue } from "../public/js/money.js";

const BASE = process.env.PAYPAL_BASE || "https://api-m.sandbox.paypal.com";
let cached = { token: null, until: 0 };

// PAYPAL_FAKE=1 is for UI tests only: no network, ids prefixed FAKE-, approval returns straight to the app.
// The server prints it at start and the Activity log marks every call "(test mode)".
export const fake = () => process.env.PAYPAL_FAKE === "1";
export const paypalReady = () => fake() || Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
const fid = (p) => `FAKE-${p}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

async function token() {
  if (cached.token && Date.now() < cached.until) return cached.token;
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const b = await res.json();
  if (!res.ok) throw new PayPalError("token", res.status, b);
  cached = { token: b.access_token, until: Date.now() + (b.expires_in - 60) * 1000 };
  return cached.token;
}

export class PayPalError extends Error {
  constructor(op, status, body) {
    const issue = body?.details?.[0]?.issue || body?.name || "ERROR";
    super(`${op}: ${status} ${issue}`);
    this.status = status; this.issue = issue; this.body = body;
  }
}

async function call(method, path, payload, requestId = randomUUID()) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": requestId,
      Prefer: "return=representation",
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) throw new PayPalError(`${method} ${path.split("/").slice(0, 4).join("/")}`, res.status, body);
  return body;
}

// Hold up to `amount` for one request. Returns the approval link for the friend.
export async function createHold({ requestId, amount, cur, title, travellerName, payeeEmail, returnUrl, cancelUrl }) {
  if (fake()) return { orderId: fid("ORDER"), approve: returnUrl };
  const unit = {
    reference_id: requestId,
    custom_id: requestId,
    description: `Jastip hold: ${title} (${travellerName})`.slice(0, 127),
    soft_descriptor: "JASTIP",
    amount: { currency_code: cur, value: toValue(amount, cur) },
  };
  if (payeeEmail) unit.payee = { email_address: payeeEmail };
  const body = await call("POST", "/v2/checkout/orders", {
    intent: "AUTHORIZE",
    purchase_units: [unit],
    payment_source: { paypal: { experience_context: {
      user_action: "CONTINUE", shipping_preference: "NO_SHIPPING", brand_name: "Jastip",
      return_url: returnUrl, cancel_url: cancelUrl,
    } } },
  }, `hold-${requestId}`);
  const approve = (body.links || []).find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
  return { orderId: body.id, approve };
}

export async function getOrder(orderId) { return call("GET", `/v2/checkout/orders/${orderId}`); }

export async function authorizeOrder(orderId) {
  if (fake()) return { authId: fid("AUTH"), status: "CREATED" };
  const b = await call("POST", `/v2/checkout/orders/${orderId}/authorize`, {}, `auth-${orderId}`);
  const a = b.purchase_units?.[0]?.payments?.authorizations?.[0];
  return { authId: a?.id, status: a?.status, payer: b.payer?.email_address };
}

export async function capture(authId, amount, cur, note) {
  if (fake()) return { captureId: fid("CAPTURE"), status: "COMPLETED" };
  const b = await call("POST", `/v2/payments/authorizations/${authId}/capture`, {
    amount: { currency_code: cur, value: toValue(amount, cur) },
    final_capture: true,
    note_to_payer: note?.slice(0, 255),
  }, `cap-${authId}`);
  return { captureId: b.id, status: b.status, fee: b.seller_receivable_breakdown?.paypal_fee };
}

export async function voidHold(authId) {
  if (fake()) return { status: "VOIDED" };
  await call("POST", `/v2/payments/authorizations/${authId}/void`, undefined, `void-${authId}`);
  return { status: "VOIDED" };
}

export async function reauthorize(authId, amount, cur) {
  const b = await call("POST", `/v2/payments/authorizations/${authId}/reauthorize`, { amount: { currency_code: cur, value: toValue(amount, cur) } });
  return { authId: b.id, status: b.status };
}
