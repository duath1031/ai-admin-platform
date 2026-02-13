"use client";

interface MonteCarloResultData {
  iterations: number;
  passCount: number;
  passRate: number;
  dumpingCount: number;
  dumpingRate: number;
  bidAmounts: {
    min: number;
    max: number;
    mean: number;
    median: number;
  };
  histogram: { rangeLabel: string; count: number; frequency: number }[];
}

interface MonteCarloResultProps {
  result: MonteCarloResultData | null;
  loading?: boolean;
  dataSource?: string;
  dataCount?: number;
}

function formatKRW(amount: number): string {
  if (amount >= 100000000) return `${(amount / 100000000).toFixed(2)}억원`;
  if (amount >= 10000) return `${Math.round(amount / 10000).toLocaleString()}만원`;
  return `${amount.toLocaleString()}원`;
}

export default function MonteCarloResult({ result, loading, dataSource, dataCount }: MonteCarloResultProps) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <p className="text-sm text-gray-500 mt-2">몬테카를로 시뮬레이션 실행 중...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        시뮬레이션을 실행하면 결과가 표시됩니다.
      </div>
    );
  }

  const maxHistFreq = Math.max(...result.histogram.map((h) => h.frequency), 0.001);

  // 통과율에 따른 색상
  const passRateColor = result.passRate >= 90
    ? "text-green-600"
    : result.passRate >= 70
      ? "text-yellow-600"
      : "text-red-600";

  const passRateBg = result.passRate >= 90
    ? "bg-green-50 border-green-200"
    : result.passRate >= 70
      ? "bg-yellow-50 border-yellow-200"
      : "bg-red-50 border-red-200";

  return (
    <div className="space-y-4">
      {/* 핵심 수치: 하한가 통과율 */}
      <div className={`rounded-xl border p-4 text-center ${passRateBg}`}>
        <p className="text-xs text-gray-500 mb-1">하한가 통과율 (과거 데이터 기반)</p>
        <p className={`text-4xl font-bold ${passRateColor}`}>
          {result.passRate.toFixed(1)}%
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {result.iterations.toLocaleString()}회 시뮬레이션 중 {result.passCount.toLocaleString()}회 통과
        </p>
      </div>

      {/* 덤핑 경고 */}
      {result.dumpingRate > 20 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <span className="text-red-500 text-lg leading-none">!</span>
          <div>
            <p className="text-sm font-medium text-red-700">덤핑 위험 주의</p>
            <p className="text-xs text-red-600">
              시뮬레이션 결과 {result.dumpingRate.toFixed(1)}%가 하한가 미달입니다.
              투찰률을 상향 조정하거나 사정률 범위를 재검토하세요.
            </p>
          </div>
        </div>
      )}

      {/* 투찰금액 통계 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-50 rounded-lg p-2.5">
          <p className="text-xs text-gray-500">최소 투찰금액</p>
          <p className="text-sm font-bold text-gray-800">{formatKRW(result.bidAmounts.min)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2.5">
          <p className="text-xs text-gray-500">최대 투찰금액</p>
          <p className="text-sm font-bold text-gray-800">{formatKRW(result.bidAmounts.max)}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-2.5">
          <p className="text-xs text-gray-500">평균 투찰금액</p>
          <p className="text-sm font-bold text-blue-700">{formatKRW(result.bidAmounts.mean)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-2.5">
          <p className="text-xs text-gray-500">중간값 투찰금액</p>
          <p className="text-sm font-bold text-green-700">{formatKRW(result.bidAmounts.median)}</p>
        </div>
      </div>

      {/* 히스토그램 (수평 바) */}
      {result.histogram.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">투찰금액 분포</p>
          <div className="space-y-1">
            {result.histogram.map((h, i) => {
              const widthPercent = Math.max(2, (h.frequency / maxHistFreq) * 100);
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-24 text-right text-xs text-gray-400 font-mono shrink-0 truncate" title={h.rangeLabel}>
                    {h.rangeLabel}
                  </div>
                  <div className="flex-1">
                    <div
                      className="h-4 bg-indigo-400 rounded-r transition-all"
                      style={{ width: `${widthPercent}%` }}
                    />
                  </div>
                  <div className="w-10 text-xs text-gray-400 text-right shrink-0">
                    {h.count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 데이터 소스 정보 */}
      <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
        {dataSource === "database"
          ? `DB 수집 데이터 ${dataCount?.toLocaleString()}건 기반 분석`
          : "기본 통계 분포(정규분포) 기반 분석 — DB 데이터 수집 후 정확도 향상"}
      </div>
    </div>
  );
}
