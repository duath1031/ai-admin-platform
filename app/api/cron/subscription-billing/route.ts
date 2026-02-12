/**
 * 구독 자동결제 Cron
 * 매일 02:00 (UTC) = 한국시간 11:00
 *
 * 1. 오늘 결제일인 활성 구독 조회
 * 2. 빌링키로 자동결제
 * 3. 실패 시 재시도 카운트 + 유예기간
 * 4. 무료체험 종료 처리
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { renewSubscription } from "@/lib/billing/subscriptionService";

export async function GET(request: NextRequest) {
  // Cron 보안: Vercel Cron Secret 검증
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    // 1. 오늘 결제 예정인 활성 구독
    const dueSubs = await prisma.subscription.findMany({
      where: {
        status: { in: ["active", "past_due"] },
        nextBillingDate: { gte: todayStart, lt: todayEnd },
        billingKeyId: { not: null },
      },
      include: { plan: true },
    });

    console.log(`[Cron] 자동결제 대상: ${dueSubs.length}건`);

    const results = [];

    for (const sub of dueSubs) {
      try {
        const result = await renewSubscription(sub.id);
        results.push({
          subscriptionId: sub.id,
          userId: sub.userId,
          plan: sub.plan.planCode,
          ...result,
        });
      } catch (error) {
        results.push({
          subscriptionId: sub.id,
          userId: sub.userId,
          plan: sub.plan.planCode,
          success: false,
          error: String(error),
        });
      }
    }

    // 2. 무료체험 종료 처리
    const expiredTrials = await prisma.subscription.findMany({
      where: {
        status: "trial",
        trialEndsAt: { lt: now },
      },
    });

    for (const trial of expiredTrials) {
      if (trial.billingKeyId) {
        // 빌링키 있으면 자동결제 시도
        try {
          await renewSubscription(trial.id);
          results.push({
            subscriptionId: trial.id,
            type: "trial_conversion",
            success: true,
          });
        } catch {
          await prisma.subscription.update({
            where: { id: trial.id },
            data: { status: "expired" },
          });
        }
      } else {
        // 빌링키 없으면 만료
        await prisma.subscription.update({
          where: { id: trial.id },
          data: { status: "expired" },
        });
      }
    }

    // 3. 유예기간 초과 구독 만료
    const expiredGrace = await prisma.subscription.updateMany({
      where: {
        status: "grace",
        gracePeriodEndsAt: { lt: now },
      },
      data: { status: "expired" },
    });

    console.log(
      `[Cron] 결과: 갱신 ${results.filter((r) => r.success).length}건, ` +
        `실패 ${results.filter((r) => !r.success).length}건, ` +
        `체험종료 ${expiredTrials.length}건, ` +
        `유예만료 ${expiredGrace.count}건`
    );

    return NextResponse.json({
      success: true,
      processed: dueSubs.length,
      results,
      expiredTrials: expiredTrials.length,
      expiredGrace: expiredGrace.count,
    });
  } catch (error) {
    console.error("[Cron] subscription-billing Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
