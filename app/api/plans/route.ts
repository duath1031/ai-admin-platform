/**
 * 요금제 목록 조회 API
 * GET /api/plans
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        planCode: true,
        displayName: true,
        price: true,
        credits: true,
        tokenQuota: true,
        trialDays: true,
        features: true,
        maxFeatures: true,
      },
    });

    return NextResponse.json({ success: true, plans });
  } catch (error) {
    console.error("[Plans] Error:", error);
    return NextResponse.json(
      { error: "요금제 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
