"use client";

import { useState } from "react";
import { BidCalculator, AgencyBiasAnalyzer, CompetitorProfile } from "@/components/procurement";
import SearchSection from "@/components/procurement/SearchSection";
import SimSection from "@/components/procurement/SimSection";

const MAIN_TABS = [
  { key: "search", label: "입찰검색", icon: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" },
  { key: "simulator", label: "시뮬레이터", icon: "M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" },
  { key: "tools", label: "분석도구", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
] as const;

type MainTab = (typeof MAIN_TABS)[number]["key"];

export default function ProcurementPage() {
  const [mainTab, setMainTab] = useState<MainTab>("search");
  const [bidType, setBidType] = useState("service");
  const [region, setRegion] = useState("");

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">조달 AI</h1>
        <p className="text-sm text-gray-500 mt-1">
          나라장터 공공조달 입찰검색, 낙찰분석, 투찰 시뮬레이션, A값 계산 도구
        </p>
      </div>

      {/* 메인 탭 */}
      <div className="flex gap-2 bg-gray-100 p-1.5 rounded-xl">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setMainTab(tab.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              mainTab === tab.key
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      {/* 입찰검색 섹션 */}
      {mainTab === "search" && <SearchSection />}

      {/* 시뮬레이터 섹션 */}
      {mainTab === "simulator" && <SimSection />}

      {/* 분석도구 섹션 */}
      {mainTab === "tools" && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <BidCalculator />
            <AgencyBiasAnalyzer />
          </div>
          <CompetitorProfile region={region || undefined} bidType={bidType} />

          {/* 도구 설정 */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-600 mb-3">경쟁사 분석 필터</p>
            <div className="flex gap-4">
              <select
                value={bidType}
                onChange={(e) => setBidType(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="service">용역</option>
                <option value="goods">물품</option>
                <option value="construction">공사</option>
              </select>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">전체 지역</option>
                {["서울","부산","대구","인천","광주","대전","울산","세종","경기","강원","충북","충남","전북","전남","경북","경남","제주"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 법적 면책조항 */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-500 leading-relaxed">
        <p className="font-medium text-gray-600 mb-1">법적 안내</p>
        <p>
          본 도구는 나라장터(G2B)에서 공개된 과거 데이터를 기반으로 한 분석 도구이며,
          미래의 입찰 결과를 예측하거나 특정 투찰가를 추천하지 않습니다.
          시뮬레이션 결과는 참고용으로만 활용하시기 바라며, 실제 투찰 의사결정은
          사용자의 판단과 책임하에 이루어져야 합니다.
        </p>
      </div>
    </div>
  );
}
