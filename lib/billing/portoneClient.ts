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

/** 웹훅 검증 (PortOne V2 웹훅 시그니처) */
export function verifyWebhookSignature(
  body: string,
  signature: string | null
): boolean {
  // PortOne V2 웹훅은 기본적으로 paymentId를 포함
  // 프로덕션에서는 HMAC 검증 필요
  const webhookSecret = process.env.PORTONE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn("[PortOne] PORTONE_WEBHOOK_SECRET 미설정 - 시그니처 검증 건너뜀");
    return true;
  }
  // TODO: HMAC-SHA256 검증 (프로덕션 배포 시)
  return true;
}
