export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET - 서류함 통계
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 거래처별 서류 수
    const byClient = await prisma.clientDocument.groupBy({
      by: ["clientCompanyId"],
      where: {
        userId: session.user.id,
        status: "active",
      },
      _count: {
        id: true,
      },
    });

    // 카테고리별 서류 수
    const byCategory = await prisma.clientDocument.groupBy({
      by: ["category"],
      where: {
        userId: session.user.id,
        status: "active",
      },
      _count: {
        id: true,
      },
    });

    // 총 서류 수
    const totalCount = await prisma.clientDocument.count({
      where: {
        userId: session.user.id,
        status: "active",
      },
    });

    // 거래처 ID → 이름 매핑
    const clientIds = byClient.map((b) => b.clientCompanyId);
    const clients = await prisma.clientCompany.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, companyName: true },
    });
    const clientMap = new Map(clients.map((c) => [c.id, c.companyName]));

    return NextResponse.json({
      success: true,
      data: {
        totalCount,
        byClient: byClient.map((b) => ({
          clientCompanyId: b.clientCompanyId,
          companyName: clientMap.get(b.clientCompanyId) || "알 수 없음",
          count: b._count.id,
        })),
        byCategory: byCategory.map((b) => ({
          category: b.category,
          count: b._count.id,
        })),
      },
    });
  } catch (error) {
    console.error("Client documents stats error:", error);
    return NextResponse.json({ error: "통계 조회 실패" }, { status: 500 });
  }
}
