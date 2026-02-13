/**
 * 입찰 시뮬레이션 API
 * POST /api/analytics/bid-simulation
 *
 * Actions:
 *   - simulate:         구간별 투찰금액 시뮬레이션
 *   - montecarlo:       몬테카를로 시뮬레이션
 *   - rate-distribution: 발주처/유형별 사정률 분포 조회
 *   - reserve-prices:   특정 공고 예비가격상세 실시간 조회
 *
 * 법적 면책: 과거 공개 데이터 기반 분석 도구.
 *            미래 결과를 예측하거나 추천하지 않습니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deductTokens } from '@/lib/token/tokenService';
import { checkFeatureAccess } from '@/lib/token/planAccess';
import {
  simulateBidPrice,
  runMonteCarloSimulation,
  analyzeRateDistribution,
} from '@/lib/analytics/bidSimulator';
import { fetchReservePriceDetails } from '@/lib/analytics/g2bAnalyzer';

export async function POST(request: NextRequest) {
  try {
    // 인증 체크
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.' },
        { status: 401 },
      );
    }

    const userId = session.user.id;

    // 플랜 체크
    const access = await checkFeatureAccess(userId, 'bid_simulation');
    if (!access.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: '입찰 시뮬레이터는 Pro 이상 플랜에서 사용 가능합니다.',
          requiredPlan: access.requiredPlan,
        },
        { status: 403 },
      );
    }

    // 토큰 차감
    const deducted = await deductTokens(userId, 'bid_simulation');
    if (!deducted) {
      return NextResponse.json(
        {
          success: false,
          error: '토큰이 부족합니다.',
          required: 3000,
          redirect: '/token-charge',
        },
        { status: 402 },
      );
    }

    const body = await request.json();
    const action = body.action || 'simulate';

    // ── 구간별 투찰금액 시뮬레이션 ──
    if (action === 'simulate') {
      const { foundationAmt, aValue, bidRate, rateMin, rateMax, rateStep, lowerLimitRate } = body;

      if (!foundationAmt || foundationAmt <= 0) {
        return NextResponse.json(
          { success: false, error: '기초금액을 입력하세요.' },
          { status: 400 },
        );
      }

      const results = simulateBidPrice({
        foundationAmt: Number(foundationAmt),
        aValue: Number(aValue || 0),
        bidRate: Number(bidRate || 87.745),
        rateMin: Number(rateMin || 99.5),
        rateMax: Number(rateMax || 100.5),
        rateStep: Number(rateStep || 0.1),
        lowerLimitRate: Number(lowerLimitRate || 87.745),
      });

      return NextResponse.json({
        success: true,
        action: 'simulate',
        results,
        summary: {
          totalSteps: results.length,
          dumpingSteps: results.filter((r) => r.isDumping).length,
          bidAmountRange: {
            min: results.length > 0 ? Math.min(...results.map((r) => r.bidAmount)) : 0,
            max: results.length > 0 ? Math.max(...results.map((r) => r.bidAmount)) : 0,
          },
        },
      });
    }

    // ── 몬테카를로 시뮬레이션 ──
    if (action === 'montecarlo') {
      const { foundationAmt, aValue, bidRate, lowerLimitRate, iterations, agency, bidType } = body;

      if (!foundationAmt || foundationAmt <= 0) {
        return NextResponse.json(
          { success: false, error: '기초금액을 입력하세요.' },
          { status: 400 },
        );
      }

      // DB에서 사정률 분포 조회
      const where: Record<string, unknown> = {
        assessmentRate: { not: null, gt: 90, lt: 110 },
      };
      if (agency) where.procurement = { agency: { contains: agency } };

      const reserveDetails = await prisma.reservePriceDetail.findMany({
        where,
        select: { assessmentRate: true },
        take: 5000,
      });

      let rateDistribution;
      if (reserveDetails.length >= 10) {
        // DB 데이터가 충분하면 사용
        const rates = reserveDetails
          .map((d) => d.assessmentRate)
          .filter((r): r is number => r !== null);
        const analysis = analyzeRateDistribution(rates);
        rateDistribution = analysis.buckets;
      } else {
        // DB 데이터 부족 시 기본 분포 사용 (정규분포 근사)
        rateDistribution = generateDefaultDistribution(bidType || 'service');
      }

      const result = runMonteCarloSimulation({
        foundationAmt: Number(foundationAmt),
        aValue: Number(aValue || 0),
        bidRate: Number(bidRate || 87.745),
        lowerLimitRate: Number(lowerLimitRate || 87.745),
        rateDistribution,
        iterations: Number(iterations || 1000),
      });

      return NextResponse.json({
        success: true,
        action: 'montecarlo',
        result,
        dataSource: reserveDetails.length >= 10 ? 'database' : 'default_distribution',
        dataCount: reserveDetails.length,
      });
    }

    // ── 사정률 분포 조회 ──
    if (action === 'rate-distribution') {
      const { agency, bidType, months } = body;

      const dateFrom = new Date();
      dateFrom.setMonth(dateFrom.getMonth() - (Number(months) || 6));

      const where: Record<string, unknown> = {
        assessmentRate: { not: null, gt: 90, lt: 110 },
        openingDt: { gte: dateFrom },
      };

      if (agency) {
        where.procurement = { agency: { contains: agency } };
      }

      const reserveDetails = await prisma.reservePriceDetail.findMany({
        where,
        select: {
          assessmentRate: true,
          bidNo: true,
          openingDt: true,
          procurement: {
            select: { agency: true, type: true, bidNtceNm: true },
          },
        },
        orderBy: { openingDt: 'desc' },
        take: 5000,
      });

      const rates = reserveDetails
        .map((d) => d.assessmentRate)
        .filter((r): r is number => r !== null);

      const analysis = analyzeRateDistribution(rates);

      return NextResponse.json({
        success: true,
        action: 'rate-distribution',
        analysis,
        dataCount: rates.length,
        dateRange: {
          from: dateFrom.toISOString(),
          to: new Date().toISOString(),
        },
      });
    }

    // ── 예비가격상세 실시간 조회 ──
    if (action === 'reserve-prices') {
      const { bidNo, bidType } = body;

      if (!bidNo) {
        return NextResponse.json(
          { success: false, error: '공고번호를 입력하세요.' },
          { status: 400 },
        );
      }

      const result = await fetchReservePriceDetails({
        bidNo: String(bidNo),
        bidType: bidType || 'service',
      });

      if (!result) {
        return NextResponse.json({
          success: false,
          error: '해당 공고의 예비가격 정보를 찾을 수 없습니다.',
        });
      }

      return NextResponse.json({
        success: true,
        action: 'reserve-prices',
        data: result,
      });
    }

    return NextResponse.json(
      { success: false, error: `지원하지 않는 action: ${action}` },
      { status: 400 },
    );
  } catch (error) {
    console.error('[Bid Simulation API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '시뮬레이션 처리 중 오류가 발생했습니다.',
      },
      { status: 500 },
    );
  }
}

/**
 * DB 데이터 부족 시 기본 사정률 분포 생성
 * 공사/용역/물품별 일반적 분포 (정규분포 근사)
 */
function generateDefaultDistribution(
  bidType: string,
): { rangeStart: number; rangeEnd: number; count: number; frequency: number }[] {
  // 중심값과 표준편차 (유형별)
  const params: Record<string, { center: number; std: number }> = {
    service: { center: 100.0, std: 0.3 },
    construction: { center: 99.9, std: 0.35 },
    goods: { center: 100.0, std: 0.25 },
  };

  const { center, std } = params[bidType] || params.service;
  const bucketSize = 0.25;
  const range = std * 4;
  const buckets: { rangeStart: number; rangeEnd: number; count: number; frequency: number }[] = [];

  for (let start = center - range; start < center + range; start += bucketSize) {
    const mid = start + bucketSize / 2;
    const z = (mid - center) / std;
    const density = Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));
    buckets.push({
      rangeStart: Math.round(start * 10000) / 10000,
      rangeEnd: Math.round((start + bucketSize) * 10000) / 10000,
      count: Math.round(density * 1000),
      frequency: density * bucketSize,
    });
  }

  // 정규화
  const totalFreq = buckets.reduce((sum, b) => sum + b.frequency, 0);
  for (const b of buckets) {
    b.frequency = b.frequency / totalFreq;
  }

  return buckets;
}
