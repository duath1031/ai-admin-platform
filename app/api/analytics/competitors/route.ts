/**
 * 경쟁자 분석 API
 *
 * GET /api/analytics/competitors?region=서울&bidType=SERVICE
 *
 * 해당 지역/유형에서 최근 6개월간 가장 많이 낙찰받은 업체 Top 3 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ProcurementStatus, ProcurementType } from '@prisma/client';

function formatKRW(amount: bigint | number): string {
  const num = Number(amount);
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(1)}억원`;
  }
  if (num >= 10000) {
    return `${Math.round(num / 10000).toLocaleString()}만원`;
  }
  return `${num.toLocaleString()}원`;
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return '오늘';
  if (days === 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  return `${Math.floor(days / 30)}개월 전`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const region = searchParams.get('region');
    const bidType = searchParams.get('bidType');

    // 6개월 전 날짜
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // 조건 구성
    const where: {
      status: ProcurementStatus;
      winner: { not: null };
      collectedAt: { gte: Date };
      region?: string;
      type?: ProcurementType;
    } = {
      status: ProcurementStatus.AWARDED,
      winner: { not: null },
      collectedAt: { gte: sixMonthsAgo },
    };

    if (region) {
      where.region = region;
    }

    if (bidType) {
      const typeMap: Record<string, ProcurementType> = {
        service: ProcurementType.SERVICE,
        goods: ProcurementType.GOODS,
        construction: ProcurementType.CONSTRUCTION,
        SERVICE: ProcurementType.SERVICE,
        GOODS: ProcurementType.GOODS,
        CONSTRUCTION: ProcurementType.CONSTRUCTION,
      };
      if (typeMap[bidType]) {
        where.type = typeMap[bidType];
      }
    }

    // 낙찰자별 집계
    const procurements = await prisma.procurement.findMany({
      where,
      select: {
        winner: true,
        bidWinAmt: true,
        bidRate: true,
        openingDt: true,
        collectedAt: true,
      },
      orderBy: {
        openingDt: 'desc',
      },
    });

    if (procurements.length === 0) {
      return NextResponse.json({
        success: true,
        competitors: [],
        message: '해당 조건의 낙찰 데이터가 없습니다.',
      });
    }

    // 업체별 집계
    const companyStats: Record<
      string,
      {
        winCount: number;
        totalAmount: bigint;
        rates: number[];
        lastWinDate: Date;
      }
    > = {};

    for (const p of procurements) {
      const winner = p.winner || '미상';
      if (!companyStats[winner]) {
        companyStats[winner] = {
          winCount: 0,
          totalAmount: BigInt(0),
          rates: [],
          lastWinDate: new Date(0),
        };
      }

      companyStats[winner].winCount++;
      if (p.bidWinAmt) {
        companyStats[winner].totalAmount += p.bidWinAmt;
      }
      if (p.bidRate && p.bidRate > 0 && p.bidRate < 200) {
        companyStats[winner].rates.push(p.bidRate);
      }

      const winDate = p.openingDt || p.collectedAt;
      if (winDate > companyStats[winner].lastWinDate) {
        companyStats[winner].lastWinDate = winDate;
      }
    }

    // 순위 계산 (낙찰 건수 기준 정렬)
    const sorted = Object.entries(companyStats)
      .sort((a, b) => b[1].winCount - a[1].winCount)
      .slice(0, 3);

    const competitors = sorted.map(([name, stats], idx) => {
      const avgRate =
        stats.rates.length > 0
          ? stats.rates.reduce((a, b) => a + b, 0) / stats.rates.length
          : 0;

      return {
        rank: idx + 1,
        companyName: name,
        winCount: stats.winCount,
        totalAmount: formatKRW(stats.totalAmount),
        avgRate: Math.round(avgRate * 10) / 10,
        recentWin: formatDate(stats.lastWinDate),
      };
    });

    return NextResponse.json({
      success: true,
      competitors,
      totalAnalyzed: procurements.length,
      filters: { region, bidType },
    });
  } catch (error) {
    console.error('[Competitors API] Error:', error);
    return NextResponse.json(
      { success: false, error: '경쟁자 분석 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
