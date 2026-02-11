import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: "starter",
      planCode: "starter",
      displayName: "Starter",
      price: 0,
      credits: 10000,
      tokenQuota: 10000,
      trialDays: 0,
      features: "AI 상담 3회/월, 서류 작성 1건/월, 기본 서식 열람",
      maxFeatures: JSON.stringify({
        ai_chat: 3,
        document_create: 1,
        template_view: true,
      }),
      sortOrder: 1,
    },
    {
      name: "standard",
      planCode: "standard",
      displayName: "Standard",
      price: 99000,
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
      name: "enterprise",
      planCode: "enterprise",
      displayName: "Enterprise",
      price: 250000,
      credits: -1,
      tokenQuota: -1,
      trialDays: 0,
      features: "무제한 사용, 전용 API, 화이트라벨, 전담 매니저, 커스텀 서식",
      maxFeatures: JSON.stringify({
        all: true,
        api_access: true,
        white_label: true,
        dedicated_manager: true,
        custom_templates: true,
      }),
      sortOrder: 4,
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
