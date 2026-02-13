/**
 * 월간 토큰 리셋 Cron
 * 매월 1일 00:00 UTC (한국시간 09:00)
 *
 * 활성 구독자의 토큰을 플랜별 월간 할당량으로 리셋
 * ADMIN 사용자는 -1(무제한) 유지
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // 오늘이 1일인지 체크 (매일 실행해도 1일에만 리셋)
    if (now.getUTCDate() !== 1) {
      return NextResponse.json({
        success: true,
        message: "Not the 1st day of month, skipping",
        reset: 0,
      });
    }

    // 활성 구독자 조회 (플랜 정보 포함)
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        status: { in: ["active", "trial"] },
      },
      include: {
        plan: true,
        user: { select: { id: true, role: true, credits: true, email: true } },
      },
    });

    let resetCount = 0;
    const results: { email: string; planCode: string; quota: number }[] = [];

    for (const sub of activeSubscriptions) {
      // ADMIN은 항상 무제한 유지
      if (sub.user.role === "ADMIN") {
        if (sub.user.credits !== -1) {
          await prisma.user.update({
            where: { id: sub.userId },
            data: { credits: -1 },
          });
        }
        continue;
      }

      const quota = sub.plan?.tokenQuota ?? 1000;

      // 토큰 리셋 + 초과과금 누적 초기화
      await prisma.user.update({
        where: { id: sub.userId },
        data: { credits: quota, overageSpentThisMonth: 0 },
      });

      // 리셋 트랜잭션 기록
      await prisma.creditTransaction.create({
        data: {
          userId: sub.userId,
          amount: quota,
          balance: quota,
          type: "subscription_renewal",
          description: `월간 토큰 리셋 (${sub.plan?.planCode || "unknown"}) - ${quota.toLocaleString()} 토큰`,
        },
      });

      results.push({
        email: sub.user.email || "unknown",
        planCode: sub.plan?.planCode || "unknown",
        quota,
      });
      resetCount++;
    }

    console.log(`[Cron] 토큰 리셋: ${resetCount}명 완료`);

    return NextResponse.json({
      success: true,
      reset: resetCount,
      results,
    });
  } catch (error) {
    console.error("[Cron] token-reset Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
