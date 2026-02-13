/**
 * 나라장터 입찰 시뮬레이션 엔진
 *
 * 복수예비가격 기반 사정률 시뮬레이션.
 * 과거 공개 데이터 분석 도구 — 미래 결과를 예측하거나 추천하지 않음.
 *
 * 핵심 공식:
 *   예정가격 = 기초금액 × 사정률(%)
 *   투찰금액 = [(예정가격 - A값) × 투찰률(%)] + A값
 *   낙찰하한가 = 예정가격 × 하한율(%)
 */

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────

export interface SimulationInput {
  foundationAmt: number;   // 기초금액 (원)
  aValue: number;          // A값 (직접생산비 등, 원)
  bidRate: number;         // 투찰률 (%, 예: 87.745)
  rateMin: number;         // 사정률 하한 (%, 예: 99.5)
  rateMax: number;         // 사정률 상한 (%, 예: 100.5)
  rateStep?: number;       // 사정률 단위 (%, 기본 0.1)
  lowerLimitRate: number;  // 낙찰하한율 (%, 예: 87.745)
}

export interface SimulationResult {
  rate: number;            // 사정률 (%)
  estimatedPrice: number;  // 예정가격
  bidAmount: number;       // 투찰금액
  lowerLimit: number;      // 낙찰하한가
  isDumping: boolean;      // 투찰금액 < 하한가 여부
  bidToEstimated: number;  // 투찰금액/예정가격 비율 (%)
}

export interface RateDistribution {
  rangeStart: number;      // 구간 시작 (%)
  rangeEnd: number;        // 구간 끝 (%)
  count: number;           // 건수
  frequency: number;       // 빈도 (0~1)
}

export interface RateDistributionAnalysis {
  buckets: RateDistribution[];
  stats: {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    total: number;
  };
}

export interface MonteCarloInput {
  foundationAmt: number;
  aValue: number;
  bidRate: number;
  lowerLimitRate: number;
  rateDistribution: RateDistribution[];  // 과거 사정률 분포
  iterations: number;                     // 시뮬레이션 횟수 (최대 10000)
}

export interface MonteCarloResult {
  iterations: number;
  passCount: number;       // 하한가 통과 횟수
  passRate: number;        // 하한가 통과율 (%)
  dumpingCount: number;    // 덤핑(하한가 미달) 횟수
  dumpingRate: number;     // 덤핑률 (%)
  bidAmounts: {
    min: number;
    max: number;
    mean: number;
    median: number;
  };
  histogram: { rangeLabel: string; count: number; frequency: number }[];
}

// ─────────────────────────────────────────
// 1. 사정률 계산
// ─────────────────────────────────────────

export function calculateAssessmentRate(
  estimatedPrice: number,
  foundationAmt: number,
): number {
  if (foundationAmt <= 0) return 0;
  return Math.round((estimatedPrice / foundationAmt) * 100 * 10000) / 10000;
}

// ─────────────────────────────────────────
// 2. 과거 사정률 분포 분석
// ─────────────────────────────────────────

export function analyzeRateDistribution(
  rates: number[],
  options?: { bucketSize?: number },
): RateDistributionAnalysis {
  const bucketSize = options?.bucketSize ?? 0.25;

  if (rates.length === 0) {
    return {
      buckets: [],
      stats: { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, total: 0 },
    };
  }

  const sorted = [...rates].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const total = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / total;
  const median = total % 2 === 0
    ? (sorted[total / 2 - 1] + sorted[total / 2]) / 2
    : sorted[Math.floor(total / 2)];
  const variance = sorted.reduce((sum, r) => sum + (r - mean) ** 2, 0) / total;
  const stdDev = Math.sqrt(variance);

  // 구간별 분포
  const bucketStart = Math.floor(min / bucketSize) * bucketSize;
  const bucketEnd = Math.ceil(max / bucketSize) * bucketSize;
  const buckets: RateDistribution[] = [];

  for (let start = bucketStart; start < bucketEnd; start += bucketSize) {
    const end = start + bucketSize;
    const count = sorted.filter((r) => r >= start && r < end).length;
    buckets.push({
      rangeStart: Math.round(start * 10000) / 10000,
      rangeEnd: Math.round(end * 10000) / 10000,
      count,
      frequency: total > 0 ? count / total : 0,
    });
  }

  return {
    buckets,
    stats: {
      mean: Math.round(mean * 10000) / 10000,
      median: Math.round(median * 10000) / 10000,
      stdDev: Math.round(stdDev * 10000) / 10000,
      min: Math.round(min * 10000) / 10000,
      max: Math.round(max * 10000) / 10000,
      total,
    },
  };
}

// ─────────────────────────────────────────
// 3. 구간별 투찰금액 시뮬레이션
// ─────────────────────────────────────────

export function simulateBidPrice(input: SimulationInput): SimulationResult[] {
  const {
    foundationAmt,
    aValue,
    bidRate,
    rateMin,
    rateMax,
    rateStep = 0.1,
    lowerLimitRate,
  } = input;

  const results: SimulationResult[] = [];
  const step = Math.max(0.01, rateStep);

  // 최대 200개 구간으로 제한
  const maxSteps = 200;
  const actualStep = (rateMax - rateMin) / step > maxSteps
    ? (rateMax - rateMin) / maxSteps
    : step;

  for (let rate = rateMin; rate <= rateMax + 0.0001; rate += actualStep) {
    const r = Math.round(rate * 10000) / 10000;
    const estimatedPrice = Math.round(foundationAmt * r / 100);
    const bidAmount = Math.round(((estimatedPrice - aValue) * bidRate / 100) + aValue);
    const lowerLimit = Math.round(estimatedPrice * lowerLimitRate / 100);
    const isDumping = bidAmount < lowerLimit;
    const bidToEstimated = estimatedPrice > 0
      ? Math.round((bidAmount / estimatedPrice) * 100 * 10000) / 10000
      : 0;

    results.push({
      rate: r,
      estimatedPrice,
      bidAmount,
      lowerLimit,
      isDumping,
      bidToEstimated,
    });
  }

  return results;
}

// ─────────────────────────────────────────
// 4. 몬테카를로 시뮬레이션
// ─────────────────────────────────────────

export function runMonteCarloSimulation(input: MonteCarloInput): MonteCarloResult {
  const {
    foundationAmt,
    aValue,
    bidRate,
    lowerLimitRate,
    rateDistribution,
    iterations: rawIterations,
  } = input;

  // 최대 10,000회 제한
  const iterations = Math.min(Math.max(1, rawIterations), 10000);

  // 가중 랜덤 추출을 위한 누적 확률 배열 생성
  const totalFreq = rateDistribution.reduce((sum, b) => sum + b.frequency, 0);
  if (totalFreq === 0 || rateDistribution.length === 0) {
    return {
      iterations: 0,
      passCount: 0,
      passRate: 0,
      dumpingCount: 0,
      dumpingRate: 0,
      bidAmounts: { min: 0, max: 0, mean: 0, median: 0 },
      histogram: [],
    };
  }

  const cumulative: { bucket: RateDistribution; cumProb: number }[] = [];
  let cumProb = 0;
  for (const bucket of rateDistribution) {
    cumProb += bucket.frequency / totalFreq;
    cumulative.push({ bucket, cumProb });
  }

  const bidAmounts: number[] = [];
  let passCount = 0;
  let dumpingCount = 0;

  for (let i = 0; i < iterations; i++) {
    // 가중 랜덤으로 사정률 구간 선택
    const rand = Math.random();
    const selected = cumulative.find((c) => rand <= c.cumProb) || cumulative[cumulative.length - 1];

    // 구간 내 균등 분포로 사정률 결정
    const rate = selected.bucket.rangeStart +
      Math.random() * (selected.bucket.rangeEnd - selected.bucket.rangeStart);

    const estimatedPrice = Math.round(foundationAmt * rate / 100);
    const bidAmount = Math.round(((estimatedPrice - aValue) * bidRate / 100) + aValue);
    const lowerLimit = Math.round(estimatedPrice * lowerLimitRate / 100);

    bidAmounts.push(bidAmount);

    if (bidAmount >= lowerLimit) {
      passCount++;
    } else {
      dumpingCount++;
    }
  }

  // 통계
  const sortedAmounts = [...bidAmounts].sort((a, b) => a - b);
  const mean = sortedAmounts.reduce((a, b) => a + b, 0) / iterations;
  const median = iterations % 2 === 0
    ? (sortedAmounts[iterations / 2 - 1] + sortedAmounts[iterations / 2]) / 2
    : sortedAmounts[Math.floor(iterations / 2)];

  // 히스토그램 (10구간)
  const histMin = sortedAmounts[0];
  const histMax = sortedAmounts[sortedAmounts.length - 1];
  const histStep = (histMax - histMin) / 10 || 1;
  const histogram: MonteCarloResult['histogram'] = [];

  for (let i = 0; i < 10; i++) {
    const start = histMin + i * histStep;
    const end = i === 9 ? histMax + 1 : histMin + (i + 1) * histStep;
    const count = sortedAmounts.filter((a) => a >= start && a < end).length;
    histogram.push({
      rangeLabel: `${formatAmount(start)}~${formatAmount(end)}`,
      count,
      frequency: count / iterations,
    });
  }

  return {
    iterations,
    passCount,
    passRate: Math.round((passCount / iterations) * 100 * 100) / 100,
    dumpingCount,
    dumpingRate: Math.round((dumpingCount / iterations) * 100 * 100) / 100,
    bidAmounts: {
      min: sortedAmounts[0],
      max: sortedAmounts[sortedAmounts.length - 1],
      mean: Math.round(mean),
      median: Math.round(median),
    },
    histogram,
  };
}

// ─────────────────────────────────────────
// Helper
// ─────────────────────────────────────────

function formatAmount(amount: number): string {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(1)}억`;
  if (amount >= 10000) return `${Math.round(amount / 10000)}만`;
  return `${Math.round(amount).toLocaleString()}`;
}

// 낙찰하한율 프리셋
export const LOWER_LIMIT_PRESETS: Record<string, { label: string; rate: number }> = {
  service: { label: '용역 (87.745%)', rate: 87.745 },
  construction: { label: '공사 (86.745%)', rate: 86.745 },
  goods: { label: '물품 (100%)', rate: 100 },
  custom: { label: '직접 입력', rate: 0 },
};
