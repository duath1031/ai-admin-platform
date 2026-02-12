/**
 * 토큰 사용 내역 조회 API
 * GET /api/tokens/history?page=1&limit=20&type=consume
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const type = searchParams.get("type"); // consume, subscription_grant, purchase, etc.

    const where: Record<string, unknown> = { userId: session.user.id };
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.creditTransaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          amount: true,
          balance: true,
          type: true,
          description: true,
          referenceType: true,
          createdAt: true,
        },
      }),
      prisma.creditTransaction.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Token History] Error:", error);
    return NextResponse.json(
      { error: "내역 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
