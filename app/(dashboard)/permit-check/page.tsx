"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui";

interface DiagnosisResult {
  score: number;
  grade: string;
  zoneInfo: {
    zone: string;
    buildingCoverage: number;
    floorAreaRatio: number;
  };
  analysis: {
    category: string;
    status: "pass" | "warning" | "fail";
    description: string;
    relatedLaw?: string;
  }[];
  recommendations: string[];
  legalBasis: {
    law: string;
    article: string;
    summary: string;
  }[];
  hasDiscretion: boolean;
}

// 법령명으로 국가법령정보센터 검색 URL 생성
const getLawSearchUrl = (lawName: string) => {
  const encodedLaw = encodeURIComponent(lawName.split(" ")[0]); // 첫 단어만 사용
  return `https://www.law.go.kr/법령/${encodedLaw}`;
};

export default function PermitCheckPage() {
  const [address, setAddress] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState("");

  const businessTypes = [
    { value: "restaurant", label: "일반음식점", category: "음식점업" },
    { value: "cafe", label: "카페/휴게음식점", category: "음식점업" },
    { value: "retail", label: "소매점/판매시설", category: "판매업" },
    { value: "office", label: "사무실/업무시설", category: "업무시설" },
    { value: "manufacturing", label: "제조업/공장", category: "공장" },
    { value: "warehouse", label: "창고시설", category: "물류" },
    { value: "medical", label: "의료시설", category: "의료업" },
    { value: "education", label: "교육시설/학원", category: "교육업" },
    { value: "lodging", label: "숙박시설", category: "숙박업" },
    { value: "sports", label: "체육시설", category: "체육시설업" },
    { value: "construction", label: "건설업", category: "건설업" },
    { value: "realestate", label: "부동산중개업", category: "부동산업" },
    { value: "transport", label: "화물운송업", category: "운송업" },
    { value: "passenger", label: "여객운송업", category: "운송업" },
    { value: "beauty", label: "미용업/이용업", category: "위생업" },
    { value: "pharmacy", label: "약국", category: "의료업" },
    { value: "petshop", label: "동물병원/펫샵", category: "동물관련업" },
    { value: "daycare", label: "어린이집", category: "아동복지" },
    { value: "elderly", label: "노인요양시설", category: "노인복지" },
    { value: "recycling", label: "폐기물처리업", category: "환경업" },
  ];

  const handleDiagnosis = async () => {
    if (!address.trim() || !businessType) {
      setError("주소와 업종을 모두 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/permit-check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address,
          businessType,
        }),
      });

      if (!response.ok) {
        throw new Error("진단 중 오류가 발생했습니다.");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    if (score >= 40) return "text-orange-600";
    return "text-red-600";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-yellow-500";
    if (score >= 40) return "bg-orange-500";
    return "bg-red-500";
  };

  const getGradeEmoji = (grade: string) => {
    switch (grade) {
      case "A": return "🟢";
      case "B": return "🔵";
      case "C": return "🟡";
      case "D": return "🟠";
      default: return "🔴";
    }
  };

  const getStatusIcon = (status: "pass" | "warning" | "fail") => {
    switch (status) {
      case "pass":
        return (
          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case "warning":
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">건축행정AI</h1>
            <p className="text-gray-600">GIS 기반 인허가 가능성 진단 시스템</p>
          </div>
        </div>
      </div>

      {/* Input Form */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Address Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                사업장 주소
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="예: 서울시 강남구 테헤란로 123"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              <div className="mt-2 flex gap-2">
                <a
                  href="https://cloud.eais.go.kr/moct/awp/abb01/AWPABB01F01"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  세움터 건축물대장
                </a>
                <span className="text-gray-300">|</span>
                <a
                  href="https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A01010&CappBizCD=13100000015"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  정부24 열람
                </a>
              </div>
            </div>

            {/* Business Type Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                희망 업종
              </label>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              >
                <option value="">업종을 선택하세요</option>
                {businessTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleDiagnosis}
            disabled={isLoading}
            className="mt-6 w-full py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                진단 중...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                인허가 가능성 진단
              </>
            )}
          </button>
        </CardContent>
      </Card>

      {/* Result Section */}
      {result && (
        <div className="space-y-6 animate-fadeIn">
          {/* Score Card */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">진단 결과</h2>
                <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-sm font-medium">
                  {getGradeEmoji(result.grade)} 등급 {result.grade}
                </span>
              </div>

              <div className="flex items-center gap-8">
                {/* Score Circle */}
                <div className="relative w-32 h-32">
                  <svg className="w-32 h-32 transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="#e5e7eb"
                      strokeWidth="12"
                      fill="none"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="currentColor"
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${result.score * 3.52} 352`}
                      className={getScoreColor(result.score)}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-3xl font-bold ${getScoreColor(result.score)}`}>
                      {result.score}
                    </span>
                  </div>
                </div>

                {/* Zone Info */}
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">용도지역 정보</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">용도지역</span>
                      <span className="font-medium">{result.zoneInfo.zone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">건폐율</span>
                      <span className="font-medium">{result.zoneInfo.buildingCoverage}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">용적률</span>
                      <span className="font-medium">{result.zoneInfo.floorAreaRatio}%</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-6">
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getScoreBgColor(result.score)} transition-all duration-1000`}
                    style={{ width: `${result.score}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>불가</span>
                  <span>조건부 허가</span>
                  <span>허가 가능</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Analysis Details */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">상세 분석</h2>
              <div className="space-y-4">
                {result.analysis.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg"
                  >
                    {getStatusIcon(item.status)}
                    <div>
                      <h4 className="font-medium text-gray-900">{item.category}</h4>
                      <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">권장 사항</h2>
              <ul className="space-y-3">
                {result.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="text-gray-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Legal Basis */}
          {result.legalBasis && result.legalBasis.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  관계 법령 검토
                  <a
                    href="https://www.law.go.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                  >
                    국가법령정보센터
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </h2>
                <div className="space-y-4">
                  {result.legalBasis.map((law, index) => (
                    <div key={index} className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                      <div className="flex items-start gap-3">
                        <span className="flex-shrink-0 px-2 py-1 bg-indigo-600 text-white text-xs rounded font-medium">
                          법령
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-indigo-900">{law.law}</h4>
                            <a
                              href={getLawSearchUrl(law.law)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                            >
                              법령 보기
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                          <p className="text-sm text-indigo-700 mt-1">{law.article}</p>
                          <p className="text-sm text-gray-600 mt-2">{law.summary}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Professional Notice - Discretion Warning */}
          {result.hasDiscretion && (
            <Card className="border-2 border-amber-300 bg-amber-50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-amber-800 mb-2">
                      전문 행정사 상담 권고
                    </h3>
                    <p className="text-amber-700 mb-3">
                      본 진단 결과에는 <strong>행정청의 재량이 개입되는 사항</strong>이 포함되어 있습니다.
                      재량행위의 경우 법령의 규정만으로는 정확한 판단이 어려우며,
                      관할 행정청의 해석과 판례, 실무 관행에 따라 결과가 달라질 수 있습니다.
                    </p>
                    <p className="text-amber-700">
                      정확한 인허가 가능성 판단과 원활한 행정절차 진행을 위해
                      <strong> 전문 행정사를 통한 상담을 강력히 권장</strong>드립니다.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contact CTA - 행정사합동사무소 정의 */}
          <Card className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white overflow-hidden">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold mb-2">행정사합동사무소 정의</h3>
                  <p className="text-blue-100 mb-1">
                    인허가 전문 행정사가 직접 상담해 드립니다.
                  </p>
                  <p className="text-blue-200 text-sm">
                    복잡한 인허가 절차, 저희가 대행해 드리겠습니다.
                  </p>
                  <p className="text-blue-200 text-xs mt-2">
                    염현수 대표 행정사 | Lawyeom@naver.com
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <div className="text-2xl font-bold mb-1">070-8657-1888</div>
                  <p className="text-blue-200 text-sm">평일 09:00 ~ 18:00</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
                <a
                  href="tel:070-8657-1888"
                  className="py-3 bg-white text-blue-700 font-medium rounded-lg text-center hover:bg-blue-50 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  전화
                </a>
                <a
                  href="https://pf.kakao.com/_jWfwb"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 bg-yellow-400 text-yellow-900 font-medium rounded-lg text-center hover:bg-yellow-300 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 3C6.48 3 2 6.48 2 10.5c0 2.55 1.67 4.78 4.17 6.08-.18.64-.67 2.32-.77 2.68-.12.44.16.43.34.31.14-.09 2.19-1.46 3.08-2.05.37.05.75.08 1.18.08 5.52 0 10-3.48 10-7.5S17.52 3 12 3z"/>
                  </svg>
                  카카오
                </a>
                <a
                  href="https://www.jungeui.com/%EB%AC%B8%EC%9D%98%ED%95%98%EA%B8%B0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 bg-indigo-100 text-indigo-700 font-medium rounded-lg text-center hover:bg-indigo-200 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  의뢰하기
                </a>
                <a
                  href="mailto:Lawyeom@naver.com"
                  className="py-3 bg-green-100 text-green-700 font-medium rounded-lg text-center hover:bg-green-200 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  이메일
                </a>
                <a
                  href="https://www.jungeui.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-3 bg-blue-100 text-blue-700 font-medium rounded-lg text-center hover:bg-blue-200 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  홈페이지
                </a>
              </div>
            </CardContent>
          </Card>

          {/* AI Consultation */}
          <div className="p-4 bg-gray-100 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-700">
              <strong>참고:</strong> AI 상담을 통해 관련 절차와 구비서류에 대한 기본 정보를 확인하실 수 있습니다.
              다만, 최종적인 인허가 판단은 반드시 전문가 상담을 통해 확인하시기 바랍니다.
            </p>
            <a
              href={`/chat?q=${encodeURIComponent(`${address}에서 ${businessTypes.find(t => t.value === businessType)?.label || businessType} 인허가 절차를 알려주세요`)}`}
              className="mt-3 inline-block px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              AI 상담 받기
            </a>
          </div>
        </div>
      )}

      {/* Info Section */}
      {!result && (
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-2">건축행정AI 안내</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• 토지이용계획 정보를 기반으로 인허가 가능성을 사전에 진단합니다.</li>
            <li>• 용도지역, 건폐율, 용적률 등을 종합적으로 분석합니다.</li>
            <li>• 본 진단 결과는 참고용이며, 실제 인허가 여부와 다를 수 있습니다.</li>
            <li>• 정확한 판단을 위해서는 관할 행정기관 또는 전문가 상담을 권장합니다.</li>
          </ul>
        </div>
      )}
    </div>
  );
}
