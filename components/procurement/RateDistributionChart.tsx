"use client";

interface RateDistribution {
  rangeStart: number;
  rangeEnd: number;
  count: number;
  frequency: number;
}

interface RateDistributionChartProps {
  buckets: RateDistribution[];
  stats: {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
    total: number;
  };
  loading?: boolean;
}

export default function RateDistributionChart({ buckets, stats, loading }: RateDistributionChartProps) {
  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-6 bg-gray-200 rounded" style={{ width: `${30 + Math.random() * 70}%` }} />
        ))}
      </div>
    );
  }

  if (!buckets || buckets.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        사정률 분포 데이터가 없습니다.
        <br />
        <span className="text-xs text-gray-400">데이터 수집 후 표시됩니다.</span>
      </div>
    );
  }

  const maxFreq = Math.max(...buckets.map((b) => b.frequency), 0.001);

  // 색상 그라데이션 (빈도에 따라 연한 파랑 → 진한 파랑)
  const getBarColor = (frequency: number): string => {
    const ratio = frequency / maxFreq;
    if (ratio > 0.8) return "bg-blue-600";
    if (ratio > 0.6) return "bg-blue-500";
    if (ratio > 0.4) return "bg-blue-400";
    if (ratio > 0.2) return "bg-blue-300";
    return "bg-blue-200";
  };

  return (
    <div className="space-y-3">
      {/* 통계 요약 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded p-2">
          <div className="text-xs text-gray-500">평균</div>
          <div className="text-sm font-bold text-blue-700">{stats.mean.toFixed(2)}%</div>
        </div>
        <div className="bg-gray-50 rounded p-2">
          <div className="text-xs text-gray-500">중간값</div>
          <div className="text-sm font-bold text-green-700">{stats.median.toFixed(2)}%</div>
        </div>
        <div className="bg-gray-50 rounded p-2">
          <div className="text-xs text-gray-500">표준편차</div>
          <div className="text-sm font-bold text-orange-700">{stats.stdDev.toFixed(3)}%</div>
        </div>
      </div>

      <div className="text-xs text-gray-400 text-right">
        총 {stats.total}건 | {stats.min.toFixed(2)}% ~ {stats.max.toFixed(2)}%
      </div>

      {/* 바 차트 */}
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {buckets.map((bucket, i) => {
          const widthPercent = Math.max(2, (bucket.frequency / maxFreq) * 100);
          const isMeanBucket = stats.mean >= bucket.rangeStart && stats.mean < bucket.rangeEnd;
          const isMedianBucket = stats.median >= bucket.rangeStart && stats.median < bucket.rangeEnd;

          return (
            <div key={i} className="flex items-center gap-2 group">
              <div className="w-20 text-right text-xs text-gray-500 font-mono shrink-0">
                {bucket.rangeStart.toFixed(2)}%
              </div>
              <div className="flex-1 relative">
                <div
                  className={`h-5 rounded-r transition-all ${getBarColor(bucket.frequency)} ${
                    isMeanBucket ? "ring-2 ring-blue-600" : ""
                  } ${isMedianBucket ? "ring-2 ring-green-600" : ""}`}
                  style={{ width: `${widthPercent}%` }}
                />
                {/* 건수 표시 */}
                <span className="absolute right-0 top-0 text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity pr-1 leading-5">
                  {bucket.count}건 ({(bucket.frequency * 100).toFixed(1)}%)
                </span>
              </div>
              {/* 마커 */}
              {isMeanBucket && (
                <span className="text-xs text-blue-600 font-medium shrink-0">평균</span>
              )}
              {isMedianBucket && !isMeanBucket && (
                <span className="text-xs text-green-600 font-medium shrink-0">중간</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
