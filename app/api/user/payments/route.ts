/**
 * 사용자 결제 내역 조회 API
 * GET /api/user/payments
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { userId: session.user.id },
        select: {
          id: true,
          orderId: true,
          itemName: true,
          itemType: true,
          amount: true,
          status: true,
          method: true,
          receiptUrl: true,
          requestedAt: true,
          approvedAt: true,
          cancelledAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.payment.count({ where: { userId: session.user.id } }),
    ]);

    return NextResponse.json({
      success: true,
      payments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[User Payments] Error:", error);
    return NextResponse.json(
      { error: "결제 내역 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
