export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { checkAdminAuth } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/admin/analytics
 * 관리자 대시보드 통합 분석 데이터
 * - 사용자 통계 (총 회원, 신규, 플랜별 분포)
 * - 매출 통계 (MRR, 결제 건수)
 * - 사용량 통계 (채팅, 문서, 토큰)
 * - 시스템 상태 (서비스별 상태)
 */
export async function GET() {
  try {
    const { authorized } = await checkAdminAuth();
    if (!authorized) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 병렬 쿼리 실행
    const [
      totalUsers,
      newUsersThisMonth,
      newUsersToday,
      planDistribution,
      activeSubscriptions,
      totalChats,
      chatsToday,
      totalDocuments,
      documentsThisMonth,
      totalSubmissions,
      pendingSubmissions,
      completedSubmissions,
      recentPayments,
      totalTokensUsed,
      recentUsers,
    ] = await Promise.all([
      // 사용자 통계
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: thisMonthStart } } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),

      // 플랜별 분포
      prisma.user.groupBy({
        by: ['plan'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),

      // 활성 구독
      prisma.subscription.count({ where: { status: 'active' } }),

      // 채팅 통계
      prisma.chat.count(),
      prisma.chat.count({ where: { createdAt: { gte: today } } }),

      // 문서 통계
      prisma.document.count(),
      prisma.document.count({ where: { createdAt: { gte: thisMonthStart } } }),

      // 신청 통계
      prisma.civilServiceSubmission.count().catch(() => 0),
      prisma.civilServiceSubmission.count({ where: { status: 'pending' } }).catch(() => 0),
      prisma.civilServiceSubmission.count({ where: { status: 'completed' } }).catch(() => 0),

      // 최근 결제
      prisma.payment.findMany({
        where: { status: 'completed', createdAt: { gte: thisMonthStart } },
        select: { amount: true },
      }).catch(() => []),

      // 토큰 사용량 (이번 달)
      prisma.creditTransaction.aggregate({
        where: {
          type: { in: ['use', 'token_deduction'] },
          createdAt: { gte: thisMonthStart },
        },
        _sum: { amount: true },
      }).catch(() => ({ _sum: { amount: null } })),

      // 최근 가입 사용자 5명
      prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, name: true, email: true, plan: true, createdAt: true },
      }),
    ]);

    // MRR 계산
    const monthlyRevenue = (recentPayments as any[]).reduce(
      (sum: number, p: any) => sum + (p.amount || 0), 0
    );

    // 플랜별 분포 변환
    const planStats = (planDistribution as any[]).map((p: any) => ({
      plan: p.plan || 'none',
      count: p._count.id,
    }));

    // 토큰 소비량
    const tokensConsumed = Math.abs((totalTokensUsed as any)?._sum?.amount || 0);

    return NextResponse.json({
      users: {
        total: totalUsers,
        newThisMonth: newUsersThisMonth,
        newToday: newUsersToday,
        planDistribution: planStats,
        activeSubscriptions,
        recent: recentUsers,
      },
      revenue: {
        mrr: monthlyRevenue,
        paymentCount: (recentPayments as any[]).length,
      },
      usage: {
        totalChats,
        chatsToday,
        totalDocuments,
        documentsThisMonth,
        tokensConsumedThisMonth: tokensConsumed,
      },
      submissions: {
        total: totalSubmissions,
        pending: pendingSubmissions,
        completed: completedSubmissions,
      },
      system: {
        dbConnected: true,
        lastChecked: now.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[Admin Analytics] 오류:", error);
    return NextResponse.json(
      { error: "분석 데이터 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
