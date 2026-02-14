"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import ClientSelector from "@/components/common/ClientSelector";
import { useClientStore } from "@/lib/store";
import {
  INDUSTRY_CATEGORIES,
  CORE_PROCESSES,
  type IndustryCategory,
} from "@/lib/procurement/directProductionChecker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface RequirementResult {
  category: string;
  name: string;
  passed: boolean;
  score: number;
  maxScore: number;
  details: string;
  advice?: string;
}

interface DiagnosisResult {
  overallPass: boolean;
  totalScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  requirements: RequirementResult[];
  recommendations: string[];
  requiredDocuments: string[];
  estimatedFee: number;
  validityPeriod: string;
  confirmationType: "factory_visit" | "document_only";
  industryName: string;
  coreProcesses: string[];
}

type Step = 1 | 2 | 3;

type SiteType =
  | "factory_registered"
  | "leased_site"
  | "shared_site"
  | "home_office"
  | "none";

type EquipmentOwnership = "owned" | "leased" | "shared";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SITE_TYPE_LABELS: Record<SiteType, string> = {
  factory_registered: "공장등록 완료",
  leased_site: "임차 생산장소",
  shared_site: "공유/공동 장소",
  home_office: "사무실/홈오피스",
  none: "없음",
};

const EQUIPMENT_OWNERSHIP_LABELS: Record<EquipmentOwnership, string> = {
  owned: "자체 보유",
  leased: "임차",
  shared: "공용/공유",
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------
export default function DirectProductionCheckPage() {
  const { selectedClient } = useClientStore();

  // Step 관리
  const [step, setStep] = useState<Step>(1);

  // === Step 1: 업종 선택 ===
  const [industrySearch, setIndustrySearch] = useState("");
  const [selectedIndustry, setSelectedIndustry] =
    useState<IndustryCategory | null>(null);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [bizRegNo, setBizRegNo] = useState("");
  const [customProductName, setCustomProductName] = useState("");

  // === Step 2: 4대 요건 ===
  // 1. 생산공장
  const [hasProductionSite, setHasProductionSite] = useState(false);
  const [siteType, setSiteType] = useState<SiteType>("none");
  const [siteArea, setSiteArea] = useState<number | undefined>(undefined);
  const [siteAddress, setSiteAddress] = useState("");

  // 2. 생산시설
  const [hasMainEquipment, setHasMainEquipment] = useState(false);
  const [equipmentOwnership, setEquipmentOwnership] =
    useState<EquipmentOwnership>("owned");
  const [equipmentList, setEquipmentList] = useState("");
  const [hasMeasuringInstruments, setHasMeasuringInstruments] = useState(false);

  // 3. 생산인력
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [productionWorkers, setProductionWorkers] = useState(0);
  const [hasTechnicalStaff, setHasTechnicalStaff] = useState(false);
  const [hasQualityInspector, setHasQualityInspector] = useState(false);

  // 4. 생산공정
  const [performsCoreProcess, setPerformsCoreProcess] = useState(false);
  const [selectedCoreProcesses, setSelectedCoreProcesses] = useState<string[]>(
    []
  );
  const [outsourcedProcesses, setOutsourcedProcesses] = useState<string[]>([]);
  const [hasProcessDocumentation, setHasProcessDocumentation] = useState(false);

  // 추가 확인 항목
  const [hasProductionRecord, setHasProductionRecord] = useState(false);
  const [hasBizRegistration, setHasBizRegistration] = useState(false);
  const [hasQualityCertification, setHasQualityCertification] = useState(false);
  const [isSmallBiz, setIsSmallBiz] = useState(true);

  // === Step 3: 결과 ===
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 서류 체크 상태
  const [docChecked, setDocChecked] = useState<Record<number, boolean>>({});

  // 아코디언
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    site: true,
    facility: false,
    hr: false,
    process: false,
    extra: false,
  });

  const resultRef = useRef<HTMLDivElement>(null);

  // 거래처 자동 반영
  useEffect(() => {
    if (selectedClient) {
      setCompanyName(selectedClient.companyName || "");
      setBizRegNo(selectedClient.bizRegNo || "");
      if (selectedClient.employeeCount)
        setTotalEmployees(selectedClient.employeeCount);
      if (selectedClient.isISO9001) setHasQualityCertification(true);
      if (selectedClient.isManufacturer) {
        setHasBizRegistration(true);
        if (selectedClient.factoryAddress) {
          setHasProductionSite(true);
          setSiteAddress(selectedClient.factoryAddress);
        }
      }
    }
  }, [selectedClient]);

  // 업종 변경 시 핵심공정 선택 초기화
  useEffect(() => {
    setSelectedCoreProcesses([]);
    setOutsourcedProcesses([]);
  }, [selectedIndustry]);

  // 업종 필터링
  const filteredIndustries = useMemo(() => {
    if (!industrySearch.trim()) return INDUSTRY_CATEGORIES;
    const q = industrySearch.toLowerCase();
    return INDUSTRY_CATEGORIES.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        cat.code.includes(q) ||
        cat.items.some((item) => item.toLowerCase().includes(q))
    );
  }, [industrySearch]);

  // 현재 업종의 핵심공정
  const currentCoreProcesses = useMemo(() => {
    if (!selectedIndustry) return [];
    return CORE_PROCESSES[selectedIndustry.code] || CORE_PROCESSES["37"];
  }, [selectedIndustry]);

  // 핵심공정 토글
  const toggleCoreProcess = (process: string) => {
    setSelectedCoreProcesses((prev) =>
      prev.includes(process)
        ? prev.filter((p) => p !== process)
        : [...prev, process]
    );
    // 핵심공정에서 선택하면 외주에서 제거
    setOutsourcedProcesses((prev) => prev.filter((p) => p !== process));
  };

  // 외주공정 토글
  const toggleOutsourcedProcess = (process: string) => {
    setOutsourcedProcesses((prev) =>
      prev.includes(process)
        ? prev.filter((p) => p !== process)
        : [...prev, process]
    );
    // 외주로 선택하면 직접수행에서 제거
    setSelectedCoreProcesses((prev) => prev.filter((p) => p !== process));
  };

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Step 1 유효성
  const step1Valid = !!selectedIndustry && !!companyName.trim();

  // 실제 물품명
  const productName =
    customProductName.trim() || selectedProduct || selectedIndustry?.name || "";

  // 진단 실행
  const handleDiagnosis = useCallback(async () => {
    if (!selectedIndustry) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/procurement/direct-production-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          bizRegNo,
          productName,
          industryCode: selectedIndustry.code,
          hasProductionSite,
          siteType: hasProductionSite ? siteType : "none",
          siteArea,
          siteAddress,
          hasMainEquipment,
          equipmentOwnership,
          equipmentList,
          hasMeasuringInstruments,
          totalEmployees,
          productionWorkers,
          hasTechnicalStaff,
          hasQualityInspector,
          performsCoreProcess,
          coreProcessList: selectedCoreProcesses,
          outsourcedProcesses,
          hasProcessDocumentation,
          hasProductionRecord,
          hasBizRegistration,
          hasQualityCertification,
          isSmallBiz,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "진단 중 오류가 발생했습니다.");
        return;
      }
      setResult(json.data);
      setStep(3);
      setDocChecked({});
      // 스크롤 상단
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [
    companyName,
    bizRegNo,
    productName,
    selectedIndustry,
    hasProductionSite,
    siteType,
    siteArea,
    siteAddress,
    hasMainEquipment,
    equipmentOwnership,
    equipmentList,
    hasMeasuringInstruments,
    totalEmployees,
    productionWorkers,
    hasTechnicalStaff,
    hasQualityInspector,
    performsCoreProcess,
    selectedCoreProcesses,
    outsourcedProcesses,
    hasProcessDocumentation,
    hasProductionRecord,
    hasBizRegistration,
    hasQualityCertification,
    isSmallBiz,
  ]);

  // 인쇄
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------
  const Toggle = ({
    label,
    value,
    onChange,
    description,
  }: {
    label: string;
    value: boolean;
    onChange: (v: boolean) => void;
    description?: string;
  }) => (
    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0 gap-3">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-700">{label}</span>
        {description && (
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
          value ? "bg-blue-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            value ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );

  const NumberInput = ({
    label,
    value,
    onChange,
    unit = "명",
    description,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    unit?: string;
    description?: string;
  }) => (
    <div className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0 gap-3">
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-700">{label}</span>
        {description && (
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <input
          type="number"
          min={0}
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-24 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-right focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <span className="text-xs text-gray-500">{unit}</span>
      </div>
    </div>
  );

  const SectionHeader = ({
    sectionKey,
    title,
    maxScore,
    icon,
    badge,
  }: {
    sectionKey: string;
    title: string;
    maxScore: number;
    icon: React.ReactNode;
    badge?: string;
  }) => (
    <button
      type="button"
      onClick={() => toggleSection(sectionKey)}
      className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-t-xl transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-blue-600">{icon}</span>
        <span className="font-semibold text-gray-900">{title}</span>
        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
          {maxScore}점
        </span>
        {badge && (
          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <svg
        className={`w-5 h-5 text-gray-400 transition-transform ${
          openSections[sectionKey] ? "rotate-180" : ""
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </button>
  );

  const gradeColor = (grade: string) => {
    switch (grade) {
      case "A":
        return "text-green-600";
      case "B":
        return "text-blue-600";
      case "C":
        return "text-yellow-600";
      case "D":
        return "text-orange-600";
      default:
        return "text-red-600";
    }
  };

  const requirementStatusIcon = (passed: boolean, score: number, maxScore: number) => {
    const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
    if (passed && pct >= 80) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 flex-shrink-0">
          <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      );
    }
    if (passed) {
      return (
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-yellow-100 flex-shrink-0">
          <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-100 flex-shrink-0">
        <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    );
  };

  // ---------------------------------------------------------------------------
  // Step Indicator
  // ---------------------------------------------------------------------------
  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-0 py-4">
      {[
        { n: 1, label: "업종 선택" },
        { n: 2, label: "요건 체크" },
        { n: 3, label: "진단 결과" },
      ].map((s, idx) => (
        <div key={s.n} className="flex items-center">
          {idx > 0 && (
            <div
              className={`w-8 sm:w-12 h-0.5 ${
                step >= s.n ? "bg-blue-500" : "bg-gray-200"
              }`}
            />
          )}
          <button
            type="button"
            onClick={() => {
              // 뒤로만 갈 수 있음 (결과 탭은 결과가 있을 때만)
              if (s.n < step) setStep(s.n as Step);
              if (s.n === 3 && result) setStep(3);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${
              step === s.n
                ? "bg-blue-600 text-white"
                : step > s.n
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                : "bg-gray-100 text-gray-400"
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              {s.n}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        </div>
      ))}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-indigo-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  직접생산확인 자가진단
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  smpp.go.kr 기반 37개 업종 / 4대 요건 평가
                </p>
              </div>
            </div>
            <div className="hidden sm:block">
              <ClientSelector />
            </div>
          </div>
          <div className="sm:hidden mt-3">
            <ClientSelector />
          </div>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="bg-white border-b print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <StepIndicator />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ================================================================= */}
        {/* Step 1: 업종 선택 */}
        {/* ================================================================= */}
        {step === 1 && (
          <div className="space-y-6">
            {/* 기본 정보 */}
            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  기본 정보
                </h2>
                <p className="text-sm text-gray-500">
                  진단 대상 업체 정보를 입력하세요.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    업체명 *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="주식회사 OO산업"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    사업자등록번호
                  </label>
                  <input
                    type="text"
                    value={bizRegNo}
                    onChange={(e) => setBizRegNo(e.target.value)}
                    placeholder="000-00-00000"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>
            </div>

            {/* 업종 카테고리 선택 */}
            <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  업종 카테고리 선택 *
                </h2>
                <p className="text-sm text-gray-500">
                  smpp.go.kr 기준 37개 업종 중 해당하는 카테고리를 선택하세요.
                </p>
              </div>

              {/* 검색 */}
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={industrySearch}
                  onChange={(e) => setIndustrySearch(e.target.value)}
                  placeholder="업종명, 코드, 물품명으로 검색... (예: LED, 가구, 17)"
                  className="w-full rounded-lg border border-gray-300 pl-10 pr-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>

              {/* 카테고리 그리드 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[400px] overflow-y-auto pr-1">
                {filteredIndustries.map((cat) => {
                  const isSelected = selectedIndustry?.code === cat.code;
                  return (
                    <button
                      key={cat.code}
                      type="button"
                      onClick={() => {
                        setSelectedIndustry(cat);
                        setSelectedProduct("");
                        setCustomProductName("");
                      }}
                      className={`text-left p-3 rounded-lg border-2 transition-all ${
                        isSelected
                          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                            isSelected
                              ? "bg-blue-200 text-blue-800"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {cat.code}
                        </span>
                        <span
                          className={`text-sm font-medium truncate ${
                            isSelected ? "text-blue-900" : "text-gray-800"
                          }`}
                        >
                          {cat.name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {cat.items.slice(0, 3).join(", ")}
                        {cat.items.length > 3 && ` 외 ${cat.items.length - 3}개`}
                      </p>
                    </button>
                  );
                })}
                {filteredIndustries.length === 0 && (
                  <div className="col-span-full py-8 text-center text-sm text-gray-400">
                    검색 결과가 없습니다.
                  </div>
                )}
              </div>

              {/* 선택한 업종의 세부 물품 */}
              {selectedIndustry && (
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      선택된 업종:
                    </span>
                    <span className="text-sm font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                      [{selectedIndustry.code}] {selectedIndustry.name}
                    </span>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      세부 물품 선택 (선택사항)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {selectedIndustry.items.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() =>
                            setSelectedProduct(
                              selectedProduct === item ? "" : item
                            )
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            selectedProduct === item
                              ? "border-blue-400 bg-blue-50 text-blue-700"
                              : "border-gray-200 text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      구체적 물품명 (직접 입력)
                    </label>
                    <input
                      type="text"
                      value={customProductName}
                      onChange={(e) => setCustomProductName(e.target.value)}
                      placeholder="예: LED 고효율 직부등, 사무용 책상 등"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>

                  {/* 해당 업종 핵심공정 미리보기 */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                      <svg
                        className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="text-sm text-indigo-800">
                        <p className="font-medium mb-1">
                          이 업종의 핵심공정 ({currentCoreProcesses.length}개)
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {currentCoreProcesses.map((p) => (
                            <span
                              key={p}
                              className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium"
                            >
                              {p}
                            </span>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-indigo-600">
                          다음 단계에서 이 핵심공정의 직접 수행 여부를
                          체크합니다.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 안내 카드 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-2">
                <svg
                  className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">
                    직접생산확인증명이란?
                  </p>
                  <p>
                    중소기업이 조달청(나라장터) 물품 납품을 위해 필요한 인증으로,
                    해당 물품을 직접 생산할 수 있는 능력(공장, 설비, 인력, 공정)을
                    갖추고 있음을 중소벤처기업부에서 확인하는 제도입니다. 유효기간
                    3년(1회 연장 가능, 최대 6년)이며, 수수료는 품목당 33,000원
                    (중소기업 50% 감면 = 16,500원)입니다.
                  </p>
                </div>
              </div>
            </div>

            {/* 다음 버튼 */}
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setStep(2);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                disabled={!step1Valid}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                다음: 4대 요건 체크
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* Step 2: 4대 요건 체크리스트 */}
        {/* ================================================================= */}
        {step === 2 && (
          <div className="space-y-4">
            {/* 선택된 업종 요약 */}
            {selectedIndustry && (
              <div className="bg-white rounded-xl shadow-sm border p-4 flex flex-wrap items-center gap-3">
                <span className="text-sm text-gray-500">진단 대상:</span>
                <span className="text-sm font-semibold text-gray-900">
                  {companyName}
                </span>
                <span className="text-xs text-gray-300">|</span>
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  [{selectedIndustry.code}] {selectedIndustry.name}
                </span>
                {productName && (
                  <>
                    <span className="text-xs text-gray-300">|</span>
                    <span className="text-xs text-gray-600">{productName}</span>
                  </>
                )}
              </div>
            )}

            {/* 1. 생산공장 (25점) */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <SectionHeader
                sectionKey="site"
                title="1. 생산공장 (생산장소)"
                maxScore={25}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                }
              />
              {openSections.site && (
                <div className="px-4 py-2">
                  <Toggle
                    label="생산장소(공장/작업장) 보유"
                    value={hasProductionSite}
                    onChange={setHasProductionSite}
                    description={
                      selectedIndustry?.code === "17"
                        ? "SW/솔루션 업종은 사무실도 인정됩니다."
                        : "독립된 생산장소(공장, 작업장)가 있어야 합니다."
                    }
                  />

                  {hasProductionSite && (
                    <>
                      <div className="py-3 border-b border-gray-100">
                        <label className="block text-sm text-gray-700 mb-1.5">
                          생산장소 유형
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {(
                            Object.entries(SITE_TYPE_LABELS).filter(
                              ([key]) => key !== "none"
                            ) as [SiteType, string][]
                          ).map(([key, label]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setSiteType(key)}
                              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                                siteType === key
                                  ? "border-blue-400 bg-blue-50 text-blue-700"
                                  : "border-gray-200 text-gray-600 hover:border-gray-300"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <NumberInput
                        label="생산장소 면적"
                        value={siteArea || 0}
                        onChange={(v) => setSiteArea(v || undefined)}
                        unit="m2"
                        description="대략적인 면적을 입력하세요 (선택)"
                      />

                      <div className="py-3 border-b border-gray-100">
                        <label className="block text-sm text-gray-700 mb-1">
                          생산장소 주소 (선택)
                        </label>
                        <input
                          type="text"
                          value={siteAddress}
                          onChange={(e) => setSiteAddress(e.target.value)}
                          placeholder="공장/작업장 주소"
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 2. 생산시설 (25점) */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <SectionHeader
                sectionKey="facility"
                title="2. 생산시설"
                maxScore={25}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                    />
                  </svg>
                }
              />
              {openSections.facility && (
                <div className="px-4 py-2">
                  <Toggle
                    label="주요 생산설비 보유"
                    value={hasMainEquipment}
                    onChange={setHasMainEquipment}
                    description="핵심공정 수행에 필요한 생산설비를 갖추고 있어야 합니다."
                  />

                  {hasMainEquipment && (
                    <>
                      <div className="py-3 border-b border-gray-100">
                        <label className="block text-sm text-gray-700 mb-1.5">
                          설비 소유형태
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {(
                            Object.entries(
                              EQUIPMENT_OWNERSHIP_LABELS
                            ) as [EquipmentOwnership, string][]
                          ).map(([key, label]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setEquipmentOwnership(key)}
                              className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${
                                equipmentOwnership === key
                                  ? "border-blue-400 bg-blue-50 text-blue-700"
                                  : "border-gray-200 text-gray-600 hover:border-gray-300"
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="py-3 border-b border-gray-100">
                        <label className="block text-sm text-gray-600 mb-1">
                          보유 설비 목록 (선택)
                        </label>
                        <textarea
                          value={equipmentList}
                          onChange={(e) => setEquipmentList(e.target.value)}
                          placeholder="예: CNC 선반 2대, 프레스 1대, 용접기 3대..."
                          rows={2}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                      </div>
                    </>
                  )}

                  <Toggle
                    label="계측/검사 장비 보유"
                    value={hasMeasuringInstruments}
                    onChange={setHasMeasuringInstruments}
                    description="품질 검증을 위한 측정/검사 장비"
                  />
                </div>
              )}
            </div>

            {/* 3. 생산인력 (25점) */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <SectionHeader
                sectionKey="hr"
                title="3. 생산인력"
                maxScore={25}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                }
              />
              {openSections.hr && (
                <div className="px-4 py-2">
                  <NumberInput
                    label="총 종업원 수"
                    value={totalEmployees}
                    onChange={setTotalEmployees}
                    description="4대 사회보험 가입 기준"
                  />
                  <NumberInput
                    label="생산직 근로자 수"
                    value={productionWorkers}
                    onChange={setProductionWorkers}
                    description="해당 물품 생산에 직접 투입되는 인력"
                  />
                  <Toggle
                    label="기술인력 보유 (기사/산업기사/기능사)"
                    value={hasTechnicalStaff}
                    onChange={setHasTechnicalStaff}
                    description="관련 분야 국가기술자격 보유 인력"
                  />
                  <Toggle
                    label="품질검사 전담(겸직) 인력"
                    value={hasQualityInspector}
                    onChange={setHasQualityInspector}
                    description="입고/공정/출하 검사 담당자"
                  />
                </div>
              )}
            </div>

            {/* 4. 생산공정 (25점) - 가장 중요 */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <SectionHeader
                sectionKey="process"
                title="4. 생산공정"
                maxScore={25}
                badge="핵심"
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                }
              />
              {openSections.process && (
                <div className="px-4 py-2">
                  <Toggle
                    label="핵심공정을 직접 수행합니다"
                    value={performsCoreProcess}
                    onChange={setPerformsCoreProcess}
                    description="직접생산확인의 가장 중요한 요건입니다. 핵심공정을 외주만 주는 경우 확인이 거부됩니다."
                  />

                  {/* 핵심공정 체크 */}
                  {performsCoreProcess && currentCoreProcesses.length > 0 && (
                    <div className="py-3 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        직접 수행하는 핵심공정을 선택하세요
                      </p>
                      <div className="space-y-2">
                        {currentCoreProcesses.map((process) => {
                          const isSelected =
                            selectedCoreProcesses.includes(process);
                          const isOutsourced =
                            outsourcedProcesses.includes(process);
                          return (
                            <div
                              key={process}
                              className="flex items-center gap-3 py-1"
                            >
                              <span className="text-sm text-gray-700 w-40 flex-shrink-0">
                                {process}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleCoreProcess(process)}
                                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                                    isSelected
                                      ? "border-green-400 bg-green-50 text-green-700"
                                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                                  }`}
                                >
                                  직접 수행
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    toggleOutsourcedProcess(process)
                                  }
                                  className={`px-3 py-1 rounded text-xs font-medium border transition-colors ${
                                    isOutsourced
                                      ? "border-red-400 bg-red-50 text-red-700"
                                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                                  }`}
                                >
                                  외주
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {selectedCoreProcesses.length > 0 && (
                        <p className="text-xs text-green-600 mt-2">
                          직접 수행: {selectedCoreProcesses.join(", ")} (
                          {selectedCoreProcesses.length}/{currentCoreProcesses.length})
                        </p>
                      )}
                      {outsourcedProcesses.length > 0 && (
                        <p className="text-xs text-red-500 mt-1">
                          외주: {outsourcedProcesses.join(", ")} (
                          {outsourcedProcesses.length}/{currentCoreProcesses.length})
                        </p>
                      )}
                    </div>
                  )}

                  <Toggle
                    label="공정도/작업표준서 보유"
                    value={hasProcessDocumentation}
                    onChange={setHasProcessDocumentation}
                    description="제조공정도, 작업표준서/작업지도서를 문서화했는지"
                  />

                  <Toggle
                    label="생산/납품 실적 보유"
                    value={hasProductionRecord}
                    onChange={setHasProductionRecord}
                    description="해당 물품(또는 유사 물품)의 생산/납품 실적"
                  />
                </div>
              )}
            </div>

            {/* 5. 추가 확인 항목 */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <SectionHeader
                sectionKey="extra"
                title="추가 확인 항목"
                maxScore={0}
                icon={
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                }
              />
              {openSections.extra && (
                <div className="px-4 py-2">
                  <Toggle
                    label={
                      selectedIndustry?.code === "17"
                        ? "사업자등록증 (SW/정보통신 업종 포함)"
                        : "사업자등록증 (제조업 업종 포함)"
                    }
                    value={hasBizRegistration}
                    onChange={setHasBizRegistration}
                  />
                  <Toggle
                    label="품질인증 보유 (ISO 9001, KS 등)"
                    value={hasQualityCertification}
                    onChange={setHasQualityCertification}
                  />
                  <Toggle
                    label="중소기업 해당 (수수료 50% 감면)"
                    value={isSmallBiz}
                    onChange={setIsSmallBiz}
                    description="중소기업확인서 보유 시 수수료가 33,000원에서 16,500원으로 감면됩니다."
                  />
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
                <svg
                  className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setStep(1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                이전: 업종 선택
              </button>
              <button
                onClick={handleDiagnosis}
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    진단 중...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    진단 실행
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* Step 3: 진단 결과 */}
        {/* ================================================================= */}
        {step === 3 && (
          <div className="space-y-6" ref={resultRef}>
            {!result ? (
              <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                <svg
                  className="w-16 h-16 mx-auto text-gray-300 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <p className="text-gray-500 mb-4">
                  아직 진단을 실행하지 않았습니다.
                </p>
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  진단 항목 입력하기
                </button>
              </div>
            ) : (
              <>
                {/* 총점 카드 */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    {/* 원형 점수 */}
                    <div className="relative w-40 h-40 flex-shrink-0">
                      <svg
                        className="w-40 h-40 transform -rotate-90"
                        viewBox="0 0 160 160"
                      >
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke="#e5e7eb"
                          strokeWidth="10"
                          fill="none"
                        />
                        <circle
                          cx="80"
                          cy="80"
                          r="70"
                          stroke={
                            result.overallPass ? "#22c55e" : "#ef4444"
                          }
                          strokeWidth="10"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={`${
                            (result.totalScore / 100) * 2 * Math.PI * 70
                          } ${2 * Math.PI * 70}`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span
                          className={`text-3xl font-bold ${
                            result.overallPass
                              ? "text-green-600"
                              : "text-red-600"
                          }`}
                        >
                          {result.totalScore}
                        </span>
                        <span className="text-sm text-gray-400">/ 100</span>
                      </div>
                    </div>

                    <div className="flex-1 text-center sm:text-left">
                      <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            result.overallPass
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {result.overallPass ? "기준 충족" : "기준 미달"}
                        </span>
                        <span
                          className={`text-2xl font-bold ${gradeColor(
                            result.grade
                          )}`}
                        >
                          {result.grade}등급
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">
                        {result.overallPass
                          ? "직접생산확인 신청 기준(70점 이상)을 충족합니다."
                          : "직접생산확인 신청 기준(70점 이상)에 미달합니다. 아래 개선사항을 보완하세요."}
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          업체: {companyName}
                        </span>
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
                          업종: [{selectedIndustry?.code}]{" "}
                          {result.industryName}
                        </span>
                        {productName && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                            물품: {productName}
                          </span>
                        )}
                        <span className="text-xs bg-purple-50 text-purple-600 px-2 py-1 rounded">
                          {result.confirmationType === "factory_visit"
                            ? "공장확인(실사)"
                            : "서면확인"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4대 요건 점수 바 */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    4대 요건별 점수
                  </h3>
                  <div className="space-y-4">
                    {result.requirements.map((req) => {
                      const pct =
                        req.maxScore > 0
                          ? Math.round((req.score / req.maxScore) * 100)
                          : 0;
                      const barColor =
                        pct >= 80
                          ? "bg-green-500"
                          : pct >= 60
                          ? "bg-yellow-500"
                          : pct >= 40
                          ? "bg-orange-500"
                          : "bg-red-500";
                      return (
                        <div key={req.category}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              {requirementStatusIcon(req.passed, req.score, req.maxScore)}
                              <span className="text-sm font-medium text-gray-700">
                                {req.category}
                              </span>
                            </div>
                            <span className="text-sm font-semibold text-gray-700">
                              {req.score} / {req.maxScore}점
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3 ml-9">
                            <div
                              className={`h-3 rounded-full transition-all ${barColor}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 상세 결과 카드 */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    상세 진단 결과
                  </h3>
                  <div className="space-y-4">
                    {result.requirements.map((req) => (
                      <div
                        key={req.category}
                        className={`border rounded-lg p-4 ${
                          req.passed
                            ? "border-green-200 bg-green-50/50"
                            : "border-red-200 bg-red-50/50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {requirementStatusIcon(req.passed, req.score, req.maxScore)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="text-sm font-semibold text-gray-900">
                                {req.category}: {req.name}
                              </h4>
                              <span
                                className={`text-sm font-bold flex-shrink-0 ${
                                  req.passed
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {req.score}/{req.maxScore}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">
                              {req.details}
                            </p>
                            {req.advice && (
                              <p className="text-xs text-amber-700 mt-1.5 bg-amber-50 px-2 py-1 rounded inline-block">
                                {req.advice}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 수수료 + 유효기간 */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">예상 수수료</p>
                    <p className="text-xl font-bold text-gray-900">
                      {result.estimatedFee.toLocaleString()}원
                    </p>
                    {isSmallBiz && (
                      <p className="text-xs text-green-600 mt-0.5">
                        중소기업 50% 감면 적용
                      </p>
                    )}
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">유효기간</p>
                    <p className="text-sm font-bold text-gray-900">
                      {result.validityPeriod}
                    </p>
                  </div>
                  <div className="bg-white rounded-xl shadow-sm border p-4 text-center">
                    <p className="text-xs text-gray-500 mb-1">확인 유형</p>
                    <p className="text-sm font-bold text-gray-900">
                      {result.confirmationType === "factory_visit"
                        ? "공장확인 (현장 실사)"
                        : "서면확인 (서류심사)"}
                    </p>
                  </div>
                </div>

                {/* 핵심공정 정보 */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-indigo-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    핵심공정 ({result.industryName})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {result.coreProcesses.map((p) => {
                      const isDirect = selectedCoreProcesses.includes(p);
                      const isOut = outsourcedProcesses.includes(p);
                      return (
                        <span
                          key={p}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                            isDirect
                              ? "border-green-300 bg-green-50 text-green-700"
                              : isOut
                              ? "border-red-300 bg-red-50 text-red-700"
                              : "border-gray-200 bg-gray-50 text-gray-600"
                          }`}
                        >
                          {p}{" "}
                          {isDirect
                            ? "(직접)"
                            : isOut
                            ? "(외주)"
                            : "(미선택)"}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* 개선 권고사항 */}
                {result.recommendations.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-amber-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                      개선 권고사항
                    </h3>
                    <ul className="space-y-2">
                      {result.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <svg
                            className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                              rec.startsWith("[필수]") ||
                              rec.startsWith("[경고]")
                                ? "text-red-500"
                                : rec.startsWith("[중요]")
                                ? "text-amber-500"
                                : "text-blue-500"
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={
                                rec.startsWith("[필수]") ||
                                rec.startsWith("[경고]")
                                  ? "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  : "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              }
                            />
                          </svg>
                          <span
                            className={`text-sm ${
                              rec.startsWith("[필수]") ||
                              rec.startsWith("[경고]")
                                ? "text-red-700 font-medium"
                                : "text-gray-700"
                            }`}
                          >
                            {rec}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 필요 서류 체크리스트 */}
                {result.requiredDocuments.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-indigo-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                      필요 서류 체크리스트 ({result.requiredDocuments.length}건)
                    </h3>
                    <ul className="space-y-2">
                      {result.requiredDocuments.map((doc, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!docChecked[idx]}
                            onChange={() =>
                              setDocChecked((prev) => ({
                                ...prev,
                                [idx]: !prev[idx],
                              }))
                            }
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4 flex-shrink-0"
                          />
                          <span
                            className={`text-sm ${
                              docChecked[idx]
                                ? "text-gray-400 line-through"
                                : "text-gray-700"
                            }`}
                          >
                            {doc}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-gray-400 mt-3">
                      준비 완료된 서류에 체크하세요. (
                      {Object.values(docChecked).filter(Boolean).length}/
                      {result.requiredDocuments.length} 완료)
                    </p>
                  </div>
                )}

                {/* 하단 버튼 */}
                <div className="flex items-center justify-between print:hidden">
                  <button
                    onClick={() => {
                      setStep(2);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    항목 수정
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrint}
                      className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                        />
                      </svg>
                      인쇄
                    </button>
                    <button
                      onClick={handleDiagnosis}
                      disabled={loading}
                      className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      다시 진단
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
