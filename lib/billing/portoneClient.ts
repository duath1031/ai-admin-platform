/**
 * PortOne V2 서버 API 클라이언트
 * 빌링키 결제, 결제 조회, 취소 등
 */

const PORTONE_API_URL = "https://api.portone.io";

function getSecret() {
  const secret = process.env.PORTONE_API_SECRET;
  if (!secret) throw new Error("PORTONE_API_SECRET 환경변수가 설정되지 않았습니다.");
  return secret;
}

function headers() {
  return {
    Authorization: `PortOne ${getSecret()}`,
    "Content-Type": "application/json",
  };
}

/** 결제 조회 */
export async function getPayment(paymentId: string) {
  const res = await fetch(
    `${PORTONE_API_URL}/payments/${encodeURIComponent(paymentId)}`,
    { headers: headers() }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PortOne getPayment 오류 (${res.status}): ${text}`);
  }
  return res.json();
}

/** 결제 취소 */
export async function cancelPayment(paymentId: string, reason: string) {
  const res = await fetch(
    `${PORTONE_API_URL}/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ reason }),
    }
  );
  return res.ok;
}

/** 빌링키로 즉시 결제 (구독 자동결제) */
export async function payWithBillingKey(params: {
  paymentId: string;
  billingKey: string;
  orderName: string;
  amount: number;
  currency?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
}) {
  const res = await fetch(
    `${PORTONE_API_URL}/payments/${encodeURIComponent(params.paymentId)}/billing-key`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        billingKey: params.billingKey,
        orderName: params.orderName,
        amount: { total: params.amount },
        currency: params.currency || "KRW",
        customer: {
          id: params.customerId,
          name: { full: params.customerName },
          email: params.customerEmail,
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PortOne billingKey 결제 오류 (${res.status}): ${text}`);
  }
  return res.json();
}

/** 빌링키 정보 조회 */
export async function getBillingKeyInfo(billingKey: string) {
  const res = await fetch(
    `${PORTONE_API_URL}/billing-keys/${encodeURIComponent(billingKey)}`,
    { headers: headers() }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PortOne getBillingKey 오류 (${res.status}): ${text}`);
  }
  return res.json();
}

/** 빌링키 삭제 */
export async function deleteBillingKey(billingKey: string) {
  const res = await fetch(
    `${PORTONE_API_URL}/billing-keys/${encodeURIComponent(billingKey)}`,
    {
      method: "DELETE",
      headers: headers(),
    }
  );
  return res.ok;
}

/**
 * PortOne V2 웹훅 시그니처 검증 (Standard Webhooks spec)
 *
 * Headers: webhook-id, webhook-timestamp, webhook-signature
 * Signing content: "{webhook-id}.{webhook-timestamp}.{body}"
 * Secret: "whsec_" prefix + base64 encoded key
 * Signature: "v1,{base64-hmac-sha256}"
 */
export function verifyWebhookSignature(
  body: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null }
): boolean {
  const webhookSecret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn("[PortOne] PORTONE_WEBHOOK_SECRET 미설정 - 시그니처 검증 건너뜀");
    return true;
  }

  const { id: webhookId, timestamp, signature } = headers;
  if (!webhookId || !timestamp || !signature) {
    console.error("[PortOne] 웹훅 헤더 누락:", { webhookId: !!webhookId, timestamp: !!timestamp, signature: !!signature });
    return false;
  }

  // 타임스탬프 검증 (5분 이내)
  const ts = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    console.error(`[PortOne] 웹훅 타임스탬프 만료: ts=${ts}, now=${now}, diff=${now - ts}s`);
    return false;
  }

  // Secret 디코딩 (whsec_ prefix 제거 후 base64 디코딩)
  const crypto = require("crypto");
  const secretBytes = Buffer.from(
    webhookSecret.startsWith("whsec_") ? webhookSecret.slice(6) : webhookSecret,
    "base64"
  );

  // HMAC-SHA256 서명 생성
  const signContent = `${webhookId}.${timestamp}.${body}`;
  const expectedSig = crypto
    .createHmac("sha256", secretBytes)
    .update(signContent)
    .digest("base64");

  // webhook-signature 헤더에서 v1 서명 추출 (공백 구분, 여러 개 가능)
  const signatures = signature.split(" ");
  for (const sig of signatures) {
    const [version, hash] = sig.split(",");
    if (version === "v1" && hash) {
      // 상수 시간 비교 (타이밍 공격 방지)
      try {
        if (crypto.timingSafeEqual(Buffer.from(hash, "base64"), Buffer.from(expectedSig, "base64"))) {
          return true;
        }
      } catch {
        // 길이 불일치 시 timingSafeEqual이 에러를 던짐
        continue;
      }
    }
  }

  console.error("[PortOne] 웹훅 시그니처 불일치");
  return false;
}
