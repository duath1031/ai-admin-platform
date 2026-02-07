"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui";

/**
 * Competitor Profiling (경쟁자 분석)
 *
 * 해당 공고와 유사한 종목/지역에서 최근 낙찰자 Top 3를 표시
 */

interface CompetitorData {
  rank: number;
  companyName: string;
  winCount: number;
  totalAmount: string;
  avgRate: number;
  recentWin: string;
}

interface CompetitorProfileProps {
  region?: string;
  bidType?: string;
  className?: string;
}

export default function CompetitorProfile({
  region,
  bidType,
  className = "",
}: CompetitorProfileProps) {
  const [competitors, setCompetitors] = useState<CompetitorData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCompetitors = async () => {
      setIsLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();
        if (region) params.set("region", region);
        if (bidType) params.set("bidType", bidType);

        const res = await fetch(`/api/analytics/competitors?${params.toString()}`);
        const data = await res.json();

        if (data.success) {
          setCompetitors(data.competitors);
        } else {
          setError(data.error || "데이터를 불러올 수 없습니다.");
        }
      } catch {
        setError("경쟁자 분석 데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompetitors();
  }, [region, bidType]);

  const getRankIcon = (rank: number): string => {
    switch (rank) {
      case 1:
        return "🥇";
      case 2:
        return "🥈";
      case 3:
        return "🥉";
      default:
        return `${rank}.`;
    }
  };

  const getRankColor = (rank: number): string => {
    switch (rank) {
      case 1:
        return "from-amber-400 to-amber-500";
      case 2:
        return "from-slate-300 to-slate-400";
      case 3:
        return "from-orange-300 to-orange-400";
      default:
        return "from-slate-200 to-slate-300";
    }
  };

  if (isLoading) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 animate-pulse">
            <div className="w-6 h-6 bg-slate-200 rounded-full" />
            <div className="h-4 bg-slate-200 rounded w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`${className} border-amber-200`}>
        <CardContent className="p-4">
          <p className="text-sm text-amber-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (competitors.length === 0) {
    return (
      <Card className={`${className} bg-slate-50`}>
        <CardContent className="p-4 text-center">
          <p className="text-sm text-slate-500">
            유사 공고 낙찰자 데이터가 아직 없습니다.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${className} bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl">🏆</span>
          <div>
            <h3 className="font-bold text-slate-800">최근 유사 공고 낙찰자</h3>
            <p className="text-xs text-slate-500">
              {region && `${region} 지역 `}
              {bidType && `${bidType} 분야 `}
              Top 3
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {competitors.map((comp) => (
            <div
              key={comp.rank}
              className="bg-white rounded-lg p-3 border border-amber-100 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                {/* 순위 뱃지 */}
                <div
                  className={`w-10 h-10 rounded-full bg-gradient-to-br ${getRankColor(
                    comp.rank
                  )} flex items-center justify-center text-lg shadow-sm`}
                >
                  {getRankIcon(comp.rank)}
                </div>

                {/* 업체 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">
                    {comp.companyName}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                    <span>낙찰 {comp.winCount}건</span>
                    <span>평균 {comp.avgRate.toFixed(1)}%</span>
                  </div>
                </div>

                {/* 금액 */}
                <div className="text-right">
                  <p className="font-bold text-amber-700 text-sm">
                    {comp.totalAmount}
                  </p>
                  <p className="text-xs text-slate-400">{comp.recentWin}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 안내 */}
        <p className="text-xs text-slate-400 mt-3 text-center">
          지난 6개월간 낙찰 데이터 기준
        </p>
      </CardContent>
    </Card>
  );
}
