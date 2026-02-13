"use client";

import { useState } from "react";
import { usePaywall } from "@/lib/billing/usePaywall";
import PaywallModal from "@/components/billing/PaywallModal";

interface ZoneRestrictions {
  allowed: string[];
  restricted: string[];
  note: string;
}

interface ZoneData {
  name: string;
  code?: string;
  restrictions?: ZoneRestrictions | null;
}

interface LandUseResult {
  success: boolean;
  address?: string;
  coordinates?: { x: number; y: number };
  pnu?: string;
  zones: ZoneData[];
  error?: string;
}

function getZoneColor(name: string): { bg: string; text: string; border: string } {
  if (name.includes("주거")) return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
  if (name.includes("상업")) return { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" };
  if (name.includes("공업")) return { bg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" };
  if (name.includes("관리") || name.includes("보전") || name.includes("농림") || name.includes("자연"))
    return { bg: "bg-green-50", text: "text-green-700", border: "border-green-200" };
  return { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
}

export default function LandUsePage() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LandUseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { paywallProps, checkAndConsume } = usePaywall();

  const handleSearch = async () => {
    if (!address.trim() || address.trim().length < 3) {
      setError("주소를 3글자 이상 입력해주세요.");
      return;
    }

    const ok = await checkAndConsume("land_use_check");
    if (!ok) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/land-use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "조회 중 오류가 발생했습니다.");
        return;
      }

      setResult(data);

      if (!data.success && data.error) {
        setError(data.error);
      }
    } catch (err) {
      setError("네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !loading && address.trim().length >= 3) {
      handleSearch();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">토지이용계획 조회</h1>
            <p className="text-sm text-gray-500">V-World GIS 데이터 기반 용도지역/지구 조회</p>
          </div>
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">주소 입력</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="예: 서울특별시 강남구 테헤란로 123"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-shadow"
            disabled={loading}
          />
          <p className="mt-2 text-xs text-gray-400">
            시/도를 포함한 전체 주소를 입력하면 정확도가 높아집니다
          </p>

          <div className="flex items-center justify-between mt-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-medium rounded-full border border-amber-200">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              1,500 토큰 차감
            </span>

            <button
              onClick={handleSearch}
              disabled={loading || address.trim().length < 3}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  V-World API 조회 중...
                </span>
              ) : (
                "조회하기"
              )}
            </button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Results Section */}
        {result && (
          <div className="space-y-4">
            {/* Address & Coordinates Card */}
            {(result.address || result.coordinates) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  주소 &amp; 좌표
                </h2>
                <div className="space-y-3">
                  {result.address && (
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-medium text-gray-500 w-20 flex-shrink-0">주소</span>
                      <span className="text-sm text-gray-900">{result.address}</span>
                    </div>
                  )}
                  {result.coordinates && (
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-medium text-gray-500 w-20 flex-shrink-0">좌표</span>
                      <span className="text-sm text-gray-900 font-mono">
                        {result.coordinates.x.toFixed(6)}, {result.coordinates.y.toFixed(6)}
                      </span>
                    </div>
                  )}
                  {result.pnu && (
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-medium text-gray-500 w-20 flex-shrink-0">PNU</span>
                      <span className="text-sm text-gray-900 font-mono">{result.pnu}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Zone Info Card */}
            {result.zones && result.zones.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  용도지역 정보
                </h2>
                <div className="space-y-4">
                  {result.zones.map((zone, idx) => {
                    const color = getZoneColor(zone.name);
                    return (
                      <div key={idx} className={`rounded-xl border ${color.border} p-4`}>
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${color.bg} ${color.text} mb-3`}>
                          {zone.name}
                          {zone.code && <span className="ml-2 opacity-60 text-xs">({zone.code})</span>}
                        </span>

                        {zone.restrictions ? (
                          <div className="space-y-3 mt-1">
                            {/* Allowed */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1.5">허용 업종</p>
                              <ul className="space-y-1">
                                {zone.restrictions.allowed.map((item, i) => (
                                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                                    <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Restricted */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1.5">제한 업종</p>
                              <ul className="space-y-1">
                                {zone.restrictions.restricted.map((item, i) => (
                                  <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
                                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Note */}
                            {zone.restrictions.note && (
                              <p className="text-xs text-gray-400 italic mt-2">
                                {zone.restrictions.note}
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* External Links Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                외부 링크
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <a
                  href="https://www.eum.go.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors group"
                >
                  <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">토지이음</p>
                    <p className="text-xs text-gray-400">eum.go.kr</p>
                  </div>
                </a>

                <a
                  href="https://www.eais.go.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">세움터</p>
                    <p className="text-xs text-gray-400">eais.go.kr</p>
                  </div>
                </a>

                <a
                  href="https://www.gov.kr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
                >
                  <div className="w-9 h-9 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">정부24 토지대장</p>
                    <p className="text-xs text-gray-400">gov.kr</p>
                  </div>
                </a>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="font-semibold text-gray-600">면책조항:</span> 본 정보는 V-World 공간정보 오픈플랫폼 데이터를 기반으로 한 참고 자료이며, 법적 효력이 없습니다. 최종 판단은 관할 행정청 확인이 필요합니다. 실제 토지이용규제 내용은 토지이음(eum.go.kr)에서 정확히 확인하시기 바랍니다.
              </p>
            </div>

            {/* Expert CTA Card */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                  <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 mb-1">전문가 상담이 필요하신가요?</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    토지이용계획 해석, 용도변경, 건축 허가 등 전문 행정사가 도와드립니다.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <a
                      href="tel:070-8657-1888"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-emerald-200 rounded-lg text-sm font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      070-8657-1888
                    </a>
                    <a
                      href="https://pf.kakao.com/_jWfwb"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-400 rounded-lg text-sm font-medium text-yellow-900 hover:bg-yellow-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.724 1.8 5.117 4.508 6.476-.198.742-.716 2.686-.82 3.105-.13.525.192.518.405.377.167-.11 2.666-1.813 3.747-2.554.693.098 1.407.15 2.16.15 5.523 0 10-3.463 10-7.554C22 6.463 17.523 3 12 3z" />
                      </svg>
                      카카오톡 상담
                    </a>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">행정사합동사무소 정의 | 평일 09:00~18:00</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Paywall Modal */}
      <PaywallModal {...paywallProps} />
    </div>
  );
}
