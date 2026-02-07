/**
 * 발주처 사정률 경향 분석 API
 *
 * POST /api/analytics/agency-bias
 * Body: { agency: "발주처명" }
 *
 * 해당 발주처의 과거 6개월 치 낙찰 데이터를 분석하여
 * 사정률(예정가격/기초금액) 분포를 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ProcurementStatus } from '@prisma/client';

interface DistributionItem {
  range: string;
  count: number;
  percentage: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agency } = body;

    if (!agency || typeof agency !== 'string') {
      return NextResponse.json(
        { success: false, error: '발주처명이 필요합니다.' },
        { status: 400 }
      );
    }

    // 6개월 전 날짜
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // 해당 발주처의 낙찰 완료된 데이터 조회
    const procurements = await prisma.procurement.findMany({
      where: {
        agency: { contains: agency },
        status: ProcurementStatus.AWARDED,
        foundationAmt: { not: null },
        preAmt: { not: null },
        collectedAt: { gte: sixMonthsAgo },
      },
      select: {
        foundationAmt: true,
        preAmt: true,
      },
    });

    if (procurements.length === 0) {
      return NextResponse.json({
        success: false,
        error: `"${agency}" 관련 낙찰 데이터가 없습니다. 데이터가 축적되면 분석이 가능합니다.`,
      });
    }

    // 사정률 계산 (예정가격 / 기초금액 × 100)
    const rates: number[] = [];
    for (const p of procurements) {
      if (p.foundationAmt && p.preAmt) {
        const foundation = Number(p.foundationAmt);
        const pre = Number(p.preAmt);
        if (foundation > 0) {
          const rate = (pre / foundation) * 100;
          // 이상치 제외 (95%~105% 범위만)
          if (rate >= 95 && rate <= 105) {
            rates.push(rate);
          }
        }
      }
    }

    if (rates.length === 0) {
      return NextResponse.json({
        success: false,
        error: '유효한 사정률 데이터가 없습니다.',
      });
    }

    // 평균 사정률
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;

    // 98%~102% 구간을 0.5% 단위로 분석 (총 8개 구간)
    const ranges = [
      { min: 98.0, max: 98.5, label: '98.0-98.5%' },
      { min: 98.5, max: 99.0, label: '98.5-99.0%' },
      { min: 99.0, max: 99.5, label: '99.0-99.5%' },
      { min: 99.5, max: 100.0, label: '99.5-100.0%' },
      { min: 100.0, max: 100.5, label: '100.0-100.5%' },
      { min: 100.5, max: 101.0, label: '100.5-101.0%' },
      { min: 101.0, max: 101.5, label: '101.0-101.5%' },
      { min: 101.5, max: 102.0, label: '101.5-102.0%' },
    ];

    const distribution: DistributionItem[] = ranges.map((range) => {
      const count = rates.filter((r) => r >= range.min && r < range.max).length;
      return {
        range: range.label,
        count,
        percentage: (count / rates.length) * 100,
      };
    });

    // 최다 구간 찾기
    const mostCommon = distribution.reduce((prev, curr) =>
      curr.count > prev.count ? curr : prev
    );

    return NextResponse.json({
      success: true,
      data: {
        agency,
        totalCount: rates.length,
        avgRate: Math.round(avgRate * 100) / 100,
        mostCommonRange: mostCommon.range,
        distribution,
      },
    });
  } catch (error) {
    console.error('[Agency Bias API] Error:', error);
    return NextResponse.json(
      { success: false, error: '분석 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
