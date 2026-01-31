export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkAdminAuth } from "@/lib/admin-auth";

// GET: 사용자 목록 조회
export async function GET(request: NextRequest) {
  try {
    const { authorized } = await checkAdminAuth();
    if (!authorized) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const plan = searchParams.get("plan") || "";
    const role = searchParams.get("role") || "";

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (plan) {
      where.plan = plan;
    }

    if (role) {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          phone: true,
          credits: true,
          plan: true,
          role: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              chats: true,
              documents: true,
              subscriptions: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // 통계 정보
    const stats = await prisma.user.groupBy({
      by: ["plan"],
      _count: { id: true },
    });

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: stats.reduce((acc, s) => {
        acc[s.plan] = s._count.id;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error: any) {
    console.error("[Admin Users API] 조회 오류:", error);
    return NextResponse.json({ error: "조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
