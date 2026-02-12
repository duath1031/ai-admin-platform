import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: "starter",
      planCode: "starter",
      displayName: "Starter",
      price: 0,
      credits: 1000,
      tokenQuota: 1000,
      trialDays: 0,
      features: "AI 상담 1회, 서류 작성 1건 (계정당 평생 1회)",
      maxFeatures: JSON.stringify({
        ai_chat: 1,
        document_create: 1,
      }),
      sortOrder: 1,
    },
    {
      name: "standard",
      planCode: "standard",
      displayName: "Standard",
      price: 90000,
      credits: 1000000,
      tokenQuota: 1000000,
      trialDays: 0,
      features: "AI 상담 무제한, 서류 작성 20건/월, 민원 자동접수, 인허가 진단, 서류 검토, 보조금 기본 매칭",
      maxFeatures: JSON.stringify({
        ai_chat: -1,
        document_create: 20,
        rpa_submission: 10,
        permit_check: true,
        review: true,
        subsidy_basic: true,
      }),
      sortOrder: 2,
    },
    {
      name: "pro",
      planCode: "pro",
      displayName: "Pro",
      price: 150000,
      credits: 3000000,
      tokenQuota: 3000000,
      trialDays: 0,
      features: "전 기능 무제한, 입찰 분석, 정책자금 매칭, 인증 진단, 비자 계산기, 우선 고객지원",
      maxFeatures: JSON.stringify({
        ai_chat: -1,
        document_create: -1,
        rpa_submission: -1,
        permit_check: true,
        review: true,
        bid_analysis: true,
        fund_matching: true,
        certification_check: true,
        visa_calculator: true,
        subsidy_full: true,
        priority_support: true,
      }),
      sortOrder: 3,
    },
    {
      name: "pro_plus",
      planCode: "pro_plus",
      displayName: "Pro Plus",
      price: 220000,
      credits: 5000000,
      tokenQuota: 5000000,
      trialDays: 0,
      features: "Pro 전체 포함, 거래처 관리 50개, 거래처별 서류함, 거래처 대시보드, 일괄 보조금매칭, 우선 고객지원",
      maxFeatures: JSON.stringify({
        all: true,
        client_management: 50,
        client_document_box: true,
        client_dashboard: true,
        batch_subsidy_matching: true,
        priority_support: true,
      }),
      sortOrder: 4,
    },
    {
      name: "enterprise",
      planCode: "enterprise",
      displayName: "Enterprise",
      price: 250000,
      credits: -1,
      tokenQuota: -1,
      trialDays: 0,
      features: "토큰 무제한, 토지분석 리포트, 안전관리(TBM), 화이트라벨, 전용 API, 전담 매니저",
      maxFeatures: JSON.stringify({
        all: true,
        unlimited_tokens: true,
        land_analysis_report: true,
        safety_management: true,
        white_label: true,
        api_access: true,
        dedicated_manager: true,
      }),
      sortOrder: 5,
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { planCode: plan.planCode },
      update: {
        displayName: plan.displayName,
        price: plan.price,
        credits: plan.credits,
        tokenQuota: plan.tokenQuota,
        trialDays: plan.trialDays,
        features: plan.features,
        maxFeatures: plan.maxFeatures,
        sortOrder: plan.sortOrder,
      },
      create: plan,
    });
    console.log(`Plan "${plan.displayName}" (${plan.planCode}) upserted`);
  }

  console.log("\nSeed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
