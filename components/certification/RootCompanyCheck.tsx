"use client";

import { useState, useEffect, useRef } from "react";
import { useClientStore } from "@/lib/store";

// ─── Types ───

interface FormData {
  companyName: string;
  bizRegNo: string;
  industryCode: string;
  businessSector: string;
  manufacturingItems: string;
  factoryAddress: string;
  mainRawMaterials: string;
  employeeCount: string;
  hasFactoryRegistration: boolean;
}

interface RootCompanyResult {
  isRootCompany: "해당" | "미해당" | "부분해당";
  matchedTechnologies: string[];
  score: number;
  analysis: string;
  recommendations: string[];
  requiredDocuments: string[];
  benefits: string[];
}

const INITIAL_FORM: FormData = {
  companyName: "",
  bizRegNo: "",
  industryCode: "",
  businessSector: "",
  manufacturingItems: "",
  factoryAddress: "",
  mainRawMaterials: "",
  employeeCount: "",
  hasFactoryRegistration: false,
};

const BUSINESS_SECTOR_OPTIONS = [
  { value: "", label: "선택하세요" },
  { value: "제조업", label: "제조업" },
  { value: "서비스업", label: "서비스업" },
  { value: "건설업", label: "건설업" },
  { value: "도소매업", label: "도소매업" },
  { value: "운수업", label: "운수업" },
  { value: "정보통신업", label: "정보통신업" },
  { value: "전기/가스/수도", label: "전기/가스/수도" },
  { value: "농업/임업/어업", label: "농업/임업/어업" },
  { value: "광업", label: "광업" },
  { value: "기타", label: "기타" },
];

const ROOT_TECHNOLOGIES = [
  {
    name: "주조",
    icon: "🏭",
    description: "금속을 녹여 거푸집에 부어 형상을 만드는 기술",
    examples: "사형주조, 금형주조, 다이캐스팅, 정밀주조",
  },
  {
    name: "금형",
    icon: "🔧",
    description: "제품 형상을 만들기 위한 틀을 제작하는 기술",
    examples: "프레스금형, 사출금형, 다이캐스트금형",
  },
  {
    name: "소성가공",
    icon: "⚙️",
    description: "금속 재료에 힘을 가하여 원하는 형상으로 변형시키는 기술",
    examples: "프레스가공, 판금, 단조, 압출, 전조",
  },
  {
    name: "용접",
    icon: "🔥",
    description: "금속 재료를 열이나 압력으로 접합하는 기술",
    examples: "아크용접, TIG/MIG, 레이저용접, 저항용접",
  },
  {
    name: "표면처리",
    icon: "✨",
    description: "금속/비금속 표면에 기능성을 부여하는 기술",
    examples: "도금, 도장, 양극산화, PVD/CVD",
  },
  {
    name: "열처리",
    icon: "🌡️",
    description: "금속 재료를 가열/냉각하여 물성을 변화시키는 기술",
    examples: "담금질, 뜨임, 침탄, 질화, 고주파열처리",
  },
];

// ─── Main Component ───

export default function RootCompanyCheck() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<RootCompanyResult | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const { selectedClient } = useClientStore();

  // Auto-fill from selectedClient
  useEffect(() => {
    if (selectedClient) {
      setForm((prev) => ({
        ...prev,
        companyName: selectedClient.companyName || prev.companyName,
        bizRegNo: selectedClient.bizRegNo || prev.bizRegNo,
        industryCode: selectedClient.industryCode || prev.industryCode,
        businessSector: selectedClient.businessSector || prev.businessSector,
        manufacturingItems: selectedClient.manufacturingItems || prev.manufacturingItems,
        factoryAddress: selectedClient.factoryAddress || prev.factoryAddress,
        employeeCount: selectedClient.employeeCount ? String(selectedClient.employeeCount) : prev.employeeCount,
      }));
    }
  }, [selectedClient]);

  // Auto-fill from company profile if no client selected
  useEffect(() => {
    if (!selectedClient) {
      (async () => {
        try {
          const res = await fetch("/api/user/company-profile");
          if (!res.ok) return;
          const data = await res.json();
          if (data.success && data.data) {
            const p = data.data;
            setForm((prev) => ({
              ...prev,
              companyName: p.companyName || prev.companyName,
              bizRegNo: p.bizRegNo || prev.bizRegNo,
              industryCode: p.industryCode || prev.industryCode,
              businessSector: p.businessSector || prev.businessSector,
              factoryAddress: p.factoryAddress || prev.factoryAddress,
              manufacturingItems: p.manufacturingItems || p.mainProducts || prev.manufacturingItems,
              employeeCount: p.employeeCount ? String(p.employeeCount) : prev.employeeCount,
            }));
          }
        } catch {
          // Silent fail
        }
      })();
    }
  }, [selectedClient]);

  const handleChange = (field: keyof FormData, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleSubmit = async () => {
    if (!form.companyName.trim()) {
      setError("기업명을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/labor/root-company-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          employeeCount: form.employeeCount ? Number(form.employeeCount) : 0,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `서버 오류 (${res.status})`);
      }

      const data = await res.json();
      if (!data.success || !data.result) {
        throw new Error(data.error || "분석에 실패했습니다.");
      }

      setResult(data.result);

      // Scroll to result on mobile
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const text = formatResultText(result, form.companyName);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    setResult(null);
    setError("");
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ─── Left Panel: Input Form ─── */}
        <div className="space-y-5 print:hidden">
          {/* 기업 기본 정보 */}
          <SectionCard title="기업 기본 정보" icon={buildingIcon}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="기업명"
                value={form.companyName}
                onChange={(v) => handleChange("companyName", v)}
                placeholder="주식회사 어드미니"
                required
              />
              <InputField
                label="사업자등록번호"
                value={form.bizRegNo}
                onChange={(v) => handleChange("bizRegNo", v)}
                placeholder="000-00-00000"
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  업종 대분류 <span className="text-red-500 ml-0.5">*</span>
                </label>
                <select
                  value={form.businessSector}
                  onChange={(e) => handleChange("businessSector", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white"
                >
                  {BUSINESS_SECTOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <InputField
                label="산업분류코드"
                value={form.industryCode}
                onChange={(v) => handleChange("industryCode", v)}
                placeholder="C24 (1차 금속 제조업 등)"
              />
            </div>
          </SectionCard>

          {/* 제조 정보 */}
          <SectionCard title="제조 정보" icon={factoryIcon}>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  주요 제조물품
                </label>
                <textarea
                  value={form.manufacturingItems}
                  onChange={(e) => handleChange("manufacturingItems", e.target.value)}
                  placeholder="주요 제조 물품을 상세히 입력하세요 (예: 자동차 엔진 부품, 알루미늄 다이캐스팅 제품, 프레스 금형 등)"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
                />
              </div>
              <InputField
                label="공장 소재지"
                value={form.factoryAddress}
                onChange={(v) => handleChange("factoryAddress", v)}
                placeholder="경기도 화성시 ..."
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  주요 원자재
                </label>
                <textarea
                  value={form.mainRawMaterials}
                  onChange={(e) => handleChange("mainRawMaterials", e.target.value)}
                  placeholder="주요 원자재를 입력하세요 (예: 알루미늄 합금, 탄소강, 스테인리스강, 구리합금 등)"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
                />
              </div>
            </div>
          </SectionCard>

          {/* 추가 정보 */}
          <SectionCard title="추가 정보" icon={infoIcon}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="상시근로자 수"
                type="number"
                value={form.employeeCount}
                onChange={(v) => handleChange("employeeCount", v)}
                placeholder="50"
              />
              <div className="flex items-center gap-3 sm:pt-6">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.hasFactoryRegistration}
                    onChange={(e) => handleChange("hasFactoryRegistration", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-100 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  <span className="ml-2 text-sm font-medium text-gray-700">공장등록증 보유</span>
                </label>
              </div>
            </div>
          </SectionCard>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>AI가 뿌리기업 여부를 분석 중입니다...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>뿌리기업 진단</span>
              </>
            )}
          </button>
        </div>

        {/* ─── Right Panel: Result Display ─── */}
        <div ref={resultRef} className="lg:sticky lg:top-6 lg:self-start">
          {result ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              {/* Result Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <h3 className="text-sm font-semibold text-gray-900">분석 결과</h3>
                </div>
                <div className="flex items-center gap-2 print:hidden">
                  <button
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {copied ? (
                      <>
                        <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        복사됨
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        복사
                      </>
                    )}
                  </button>
                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    인쇄
                  </button>
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    다시 진단
                  </button>
                </div>
              </div>

              {/* Result Content */}
              <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
                {/* 해당 여부 배지 */}
                <div className="text-center py-4">
                  <StatusBadge status={result.isRootCompany} />
                  <div className="mt-3">
                    <div className="text-sm text-gray-500 mb-1">뿌리기업 해당 가능성</div>
                    <div className="flex items-center justify-center gap-3">
                      <div className="flex-1 max-w-48 h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            result.score >= 70
                              ? "bg-green-500"
                              : result.score >= 40
                              ? "bg-yellow-500"
                              : "bg-red-400"
                          }`}
                          style={{ width: `${result.score}%` }}
                        />
                      </div>
                      <span className="text-lg font-bold text-gray-900">{result.score}점</span>
                    </div>
                  </div>
                </div>

                {/* 매칭된 뿌리기술 */}
                {result.matchedTechnologies.length > 0 && (
                  <ResultSection title="매칭된 뿌리기술" icon={techIcon}>
                    <div className="flex flex-wrap gap-2">
                      {ROOT_TECHNOLOGIES.map((tech) => {
                        const isMatched = result.matchedTechnologies.some(
                          (t) => t.includes(tech.name) || tech.name.includes(t)
                        );
                        return (
                          <span
                            key={tech.name}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              isMatched
                                ? "bg-green-100 text-green-800 border border-green-200"
                                : "bg-gray-100 text-gray-400 border border-gray-200"
                            }`}
                          >
                            <span>{tech.icon}</span>
                            <span>{tech.name}</span>
                            {isMatched && (
                              <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </ResultSection>
                )}

                {/* 분석 결과 */}
                <ResultSection title="분석 결과" icon={analysisIcon}>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {result.analysis}
                  </p>
                </ResultSection>

                {/* 필요 서류 */}
                {result.requiredDocuments.length > 0 && (
                  <ResultSection title="필요 서류" icon={documentIcon}>
                    <ul className="space-y-2">
                      {result.requiredDocuments.map((doc, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-sm text-gray-700">{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </ResultSection>
                )}

                {/* 혜택 */}
                {result.benefits.length > 0 && (
                  <ResultSection title="뿌리기업 인증 혜택" icon={benefitIcon}>
                    <ul className="space-y-2">
                      {result.benefits.map((benefit, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span className="text-sm text-gray-700">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </ResultSection>
                )}

                {/* 개선 권고사항 */}
                {result.recommendations.length > 0 && (
                  <ResultSection title="개선 권고사항" icon={recommendIcon}>
                    <ul className="space-y-2">
                      {result.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="flex-shrink-0 w-5 h-5 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="text-sm text-gray-700">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </ResultSection>
                )}

                {/* 어드미니 브랜딩 (인쇄용) */}
                <div className="hidden print:block text-center mt-8 pt-4 border-t border-gray-200">
                  <p className="text-[10px] text-gray-400">어드미니(Admini) | aiadminplatform.vercel.app</p>
                </div>
              </div>
            </div>
          ) : (
            /* ─── Empty State ─── */
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="p-8 sm:p-10 flex flex-col items-center justify-center text-center min-h-[400px]">
                {isLoading ? (
                  <>
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                      <svg className="animate-spin h-8 w-8 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      뿌리기업 여부를 분석 중입니다...
                    </h3>
                    <p className="text-sm text-gray-500">
                      뿌리산업법 기준 6대 기술 해당 여부를 검토하고 있습니다
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      뿌리기업 확인 서비스
                    </h3>
                    <p className="text-sm text-gray-500 max-w-sm mb-6">
                      &quot;뿌리산업 진흥과 첨단화에 관한 법률&quot; 기준으로<br />
                      귀사의 뿌리기업 해당 여부를 AI가 분석합니다.
                    </p>

                    {/* 6대 뿌리기술 소개 */}
                    <div className="w-full max-w-sm space-y-2">
                      <p className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">
                        6대 뿌리기술
                      </p>
                      {ROOT_TECHNOLOGIES.map((tech) => (
                        <div
                          key={tech.name}
                          className="flex items-start gap-3 text-left bg-green-50/50 rounded-lg p-3 border border-green-100"
                        >
                          <span className="text-lg flex-shrink-0">{tech.icon}</span>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{tech.name}</div>
                            <div className="text-xs text-gray-500">{tech.description}</div>
                            <div className="text-xs text-green-600 mt-0.5">{tech.examples}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helper: Format result as plain text ───

function formatResultText(result: RootCompanyResult, companyName: string): string {
  let text = `[뿌리기업 분석 결과] ${companyName}\n`;
  text += `${"=".repeat(50)}\n\n`;
  text += `판정: ${result.isRootCompany} (${result.score}점/100점)\n\n`;

  if (result.matchedTechnologies.length > 0) {
    text += `매칭된 뿌리기술:\n`;
    result.matchedTechnologies.forEach((t) => {
      text += `  - ${t}\n`;
    });
    text += `\n`;
  }

  text += `분석:\n${result.analysis}\n\n`;

  if (result.requiredDocuments.length > 0) {
    text += `필요 서류:\n`;
    result.requiredDocuments.forEach((d) => {
      text += `  - ${d}\n`;
    });
    text += `\n`;
  }

  if (result.benefits.length > 0) {
    text += `뿌리기업 인증 혜택:\n`;
    result.benefits.forEach((b) => {
      text += `  - ${b}\n`;
    });
    text += `\n`;
  }

  if (result.recommendations.length > 0) {
    text += `개선 권고사항:\n`;
    result.recommendations.forEach((r, i) => {
      text += `  ${i + 1}. ${r}\n`;
    });
  }

  text += `\n${"=".repeat(50)}\n`;
  text += `어드미니(Admini) | aiadminplatform.vercel.app`;
  return text;
}

// ─── Reusable Sub-Components ───

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
        {icon}
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ResultSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        {icon}
        <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{title}</h4>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none bg-white"
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config =
    status === "해당"
      ? { bg: "bg-green-100", border: "border-green-300", text: "text-green-800", ring: "ring-green-200", label: "뿌리기업 해당" }
      : status === "부분해당"
      ? { bg: "bg-yellow-100", border: "border-yellow-300", text: "text-yellow-800", ring: "ring-yellow-200", label: "부분 해당 (확인 필요)" }
      : { bg: "bg-red-100", border: "border-red-300", text: "text-red-800", ring: "ring-red-200", label: "뿌리기업 미해당" };

  return (
    <span
      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-lg font-bold border-2 ring-4 ${config.bg} ${config.border} ${config.text} ${config.ring}`}
    >
      {status === "해당" && (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )}
      {status === "부분해당" && (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      )}
      {status === "미해당" && (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )}
      {config.label}
    </span>
  );
}

// ─── Icons ───

const buildingIcon = (
  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const factoryIcon = (
  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
  </svg>
);

const infoIcon = (
  <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const techIcon = (
  <svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const analysisIcon = (
  <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const documentIcon = (
  <svg className="w-3.5 h-3.5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const benefitIcon = (
  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const recommendIcon = (
  <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
);
