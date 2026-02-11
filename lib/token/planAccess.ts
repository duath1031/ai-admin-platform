import { prisma } from "@/lib/prisma";

/**
 * 플랜별 기능 접근 제어 맵
 * true = 접근 가능, false = 접근 불가
 */
const PLAN_ACCESS: Record<string, Record<string, boolean>> = {
  starter: {
    ai_chat: true,
    document_create: true,
    document_review: false,
    rpa_submission: false,
    doc24_submission: false,
    permit_check: false,
    visa_calculator: false,
    bid_analysis: false,
    certification_check: false,
    fund_matching: false,
    subsidy_matching: false,
    template_download: true,
  },
  standard: {
    ai_chat: true,
    document_create: true,
    document_review: true,
    rpa_submission: true,
    doc24_submission: true,
    permit_check: true,
    visa_calculator: false,
    bid_analysis: false,
    certification_check: false,
    fund_matching: false,
    subsidy_matching: true,
    template_download: true,
  },
  pro: {
    ai_chat: true,
    document_create: true,
    document_review: true,
    rpa_submission: true,
    doc24_submission: true,
    permit_check: true,
    visa_calculator: true,
    bid_analysis: true,
    certification_check: true,
    fund_matching: true,
    subsidy_matching: true,
    template_download: true,
  },
  enterprise: {
    ai_chat: true,
    document_create: true,
    document_review: true,
    rpa_submission: true,
    doc24_submission: true,
    permit_check: true,
    visa_calculator: true,
    bid_analysis: true,
    certification_check: true,
    fund_matching: true,
    subsidy_matching: true,
    template_download: true,
  },
};

/**
 * 사용자의 현재 플랜 코드 조회
 */
export async function getUserPlanCode(userId: string): Promise<string> {
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ["active", "trial"] },
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  return sub?.plan?.planCode ?? "starter";
}

/**
 * 특정 기능에 대한 접근 권한 확인
 */
export async function checkFeatureAccess(
  userId: string,
  feature: string
): Promise<{ allowed: boolean; planCode: string; requiredPlan: string | null }> {
  const planCode = await getUserPlanCode(userId);
  const access = PLAN_ACCESS[planCode]?.[feature] ?? false;

  if (access) {
    return { allowed: true, planCode, requiredPlan: null };
  }

  // 어떤 플랜부터 사용 가능한지 찾기
  const planOrder = ["starter", "standard", "pro", "enterprise"];
  const requiredPlan =
    planOrder.find((p) => PLAN_ACCESS[p]?.[feature] === true) || "pro";

  return { allowed: false, planCode, requiredPlan };
}

/**
 * 플랜별 기능 제한 (횟수 제한) 확인
 * maxFeatures JSON에서 해당 기능의 월 제한 횟수를 반환
 * -1 = 무제한
 */
export async function getFeatureLimit(
  userId: string,
  feature: string
): Promise<number> {
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ["active", "trial"] },
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });

  if (!sub?.plan?.maxFeatures) {
    // Starter 기본값
    const defaults: Record<string, number> = {
      ai_chat: 3,
      document_create: 1,
    };
    return defaults[feature] ?? 0;
  }

  try {
    const limits = JSON.parse(sub.plan.maxFeatures);
    if (limits.all === true) return -1;
    return limits[feature] ?? 0;
  } catch {
    return 0;
  }
}
