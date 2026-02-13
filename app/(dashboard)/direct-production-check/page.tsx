"use client";

import { useState, useEffect, useCallback } from "react";
import ClientSelector from "@/components/common/ClientSelector";
import { useClientStore } from "@/lib/store";

// ─── Types ───

interface DiagnosisItem {
  label: string;
  score: number;
  maxScore: number;
  status: "pass" | "fail" | "warning";
  advice?: string;
}

interface DiagnosisCategory {
  name: string;
  score: number;
  maxScore: number;
  items: DiagnosisItem[];
}

interface DiagnosisResult {
  totalScore: number;
  passed: boolean;
  grade: "A" | "B" | "C" | "D" | "F";
  categories: DiagnosisCategory[];
  recommendations: string[];
  requiredDocuments: string[];
}

type Tab = "basic" | "checklist" | "result";

const PRODUCT_CATEGORIES = [
  "기계류",
  "전자/전기 제품",
  "금속 가공품",
  "플라스틱/고무 제품",
  "섬유/의류",
  "가구/목재",
  "화학 제품",
  "식품/음료",
  "의료기기",
  "자동차 부품",
  "건축자재",
  "기타",
];

// ─── Main Page ───

export default function DirectProductionCheckPage() {
  const { selectedClient } = useClientStore();

  // 탭
  const [activeTab, setActiveTab] = useState<Tab>("basic");

  // 기본정보
  const [companyName, setCompanyName] = useState("");
  const [bizRegNo, setBizRegNo] = useState("");
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState("");

  // 1. 생산설비
  const [hasFactory, setHasFactory] = useState(false);
  const [factoryOwnership, setFactoryOwnership] = useState<"owned" | "leased" | "none">("none");
  const [hasProductionEquipment, setHasProductionEquipment] = useState(false);
  const [equipmentList, setEquipmentList] = useState("");
  const [hasRawMaterialStorage, setHasRawMaterialStorage] = useState(false);

  // 2. 생산인력
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [productionWorkers, setProductionWorkers] = useState(0);
  const [hasTechnician, setHasTechnician] = useState(false);

  // 3. 품질관리
  const [hasQualitySystem, setHasQualitySystem] = useState(false);
  const [hasQualityInspector, setHasQualityInspector] = useState(false);
  const [hasTestEquipment, setHasTestEquipment] = useState(false);
  const [hasISO9001, setHasISO9001] = useState(false);
  const [hasKSCertification, setHasKSCertification] = useState(false);

  // 4. 생산실적
  const [hasProductionRecord, setHasProductionRecord] = useState(false);
  const [recentYearRevenue, setRecentYearRevenue] = useState(0);

  // 5. 기타
  const [hasBizRegistration, setHasBizRegistration] = useState(false);
  const [hasFactoryRegistration, setHasFactoryRegistration] = useState(false);
  const [hasEnvironmentPermit, setHasEnvironmentPermit] = useState(false);

  // 결과
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 아코디언
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    equipment: true,
    hr: false,
    quality: false,
    record: false,
    etc: false,
  });

  // 거래처 자동 반영
  useEffect(() => {
    if (selectedClient) {
      setCompanyName(selectedClient.companyName || "");
      setBizRegNo(selectedClient.bizRegNo || "");
      if (selectedClient.employeeCount) setTotalEmployees(selectedClient.employeeCount);
      if (selectedClient.isISO9001) setHasISO9001(true);
      if (selectedClient.isManufacturer) {
        setHasBizRegistration(true);
        if (selectedClient.factoryAddress) setHasFactory(true);
      }
      if (selectedClient.revenueYear1) setRecentYearRevenue(selectedClient.revenueYear1);
    }
  }, [selectedClient]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 진단 실행
  const handleDiagnosis = useCallback(async () => {
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
          productCategory,
          hasFactory,
          factoryOwnership,
          hasProductionEquipment,
          equipmentList,
          hasRawMaterialStorage,
          totalEmployees,
          productionWorkers,
          hasTechnician,
          hasQualitySystem,
          hasQualityInspector,
          hasTestEquipment,
          hasISO9001,
          hasKSCertification,
          hasProductionRecord,
          recentYearRevenue,
          hasBizRegistration,
          hasFactoryRegistration,
          hasEnvironmentPermit,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || "진단 중 오류가 발생했습니다.");
        return;
      }
      setResult(json.data);
      setActiveTab("result");
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [
    companyName, bizRegNo, productName, productCategory,
    hasFactory, factoryOwnership, hasProductionEquipment, equipmentList, hasRawMaterialStorage,
    totalEmployees, productionWorkers, hasTechnician,
    hasQualitySystem, hasQualityInspector, hasTestEquipment, hasISO9001, hasKSCertification,
    hasProductionRecord, recentYearRevenue,
    hasBizRegistration, hasFactoryRegistration, hasEnvironmentPermit,
  ]);

  // ─── 탭 정의 ───
  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    {
      key: "basic",
      label: "기본정보",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      key: "checklist",
      label: "진단 항목",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      key: "result",
      label: "진단 결과",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  // ─── Render helpers ───

  const renderToggle = (label: string, value: boolean, onChange: (v: boolean) => void, maxScore: number) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-xs text-gray-400">({maxScore}점)</span>
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
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

  const renderNumberInput = (label: string, value: number, onChange: (v: number) => void, maxScore: number, unit: string = "명") => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-700">{label}</span>
        <span className="text-xs text-gray-400">({maxScore}점)</span>
      </div>
      <div className="flex items-center gap-1">
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

  const SectionHeader = ({ sectionKey, title, maxScore, icon }: { sectionKey: string; title: string; maxScore: number; icon: React.ReactNode }) => (
    <button
      type="button"
      onClick={() => toggleSection(sectionKey)}
      className="flex items-center justify-between w-full px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-t-xl transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="text-blue-600">{icon}</span>
        <span className="font-semibold text-gray-900">{title}</span>
        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{maxScore}점</span>
      </div>
      <svg
        className={`w-5 h-5 text-gray-400 transition-transform ${openSections[sectionKey] ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );

  const statusBadge = (status: "pass" | "fail" | "warning") => {
    const styles = {
      pass: "bg-green-100 text-green-700",
      fail: "bg-red-100 text-red-700",
      warning: "bg-yellow-100 text-yellow-700",
    };
    const labels = { pass: "충족", fail: "미충족", warning: "주의" };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const gradeColor = (grade: string) => {
    switch (grade) {
      case "A": return "text-green-600";
      case "B": return "text-blue-600";
      case "C": return "text-yellow-600";
      case "D": return "text-orange-600";
      default: return "text-red-600";
    }
  };

  // ─── Render ───

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">직접생산확인 자가진단</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  조달청 직접생산확인증명 취득 사전 점검
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

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* ─── Tab 1: 기본정보 ─── */}
        {activeTab === "basic" && (
          <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">기본 정보 입력</h2>
              <p className="text-sm text-gray-500">
                진단 대상 업체와 납품 물품 정보를 입력하세요.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">업체명 *</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="주식회사 OO산업"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">사업자등록번호</label>
                <input
                  type="text"
                  value={bizRegNo}
                  onChange={(e) => setBizRegNo(e.target.value)}
                  placeholder="000-00-00000"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">납품 물품명 *</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="예: LED 조명기구, 사무용 가구"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">물품분류 *</label>
                <select
                  value={productCategory}
                  onChange={(e) => setProductCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value="">선택하세요</option>
                  {PRODUCT_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 안내 카드 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-2">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">직접생산확인증명이란?</p>
                  <p>
                    중소기업 제조업체가 조달청(나라장터)을 통해 물품을 납품하기 위해 필요한 인증입니다.
                    공장, 생산설비, 인력, 품질관리체계를 갖추고 있음을 확인하는 서류로,
                    중소벤처기업부에서 발급합니다.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setActiveTab("checklist")}
                disabled={!companyName || !productName || !productCategory}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                다음: 진단 항목 입력
              </button>
            </div>
          </div>
        )}

        {/* ─── Tab 2: 진단 항목 ─── */}
        {activeTab === "checklist" && (
          <div className="space-y-4">
            {/* 카테고리 1: 생산설비 (30점) */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <SectionHeader
                sectionKey="equipment"
                title="생산설비"
                maxScore={30}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                }
              />
              {openSections.equipment && (
                <div className="px-4 py-2">
                  {renderToggle("공장(생산시설) 보유", hasFactory, setHasFactory, 12)}
                  {hasFactory && (
                    <div className="flex items-center justify-between py-3 border-b border-gray-100">
                      <span className="text-sm text-gray-700 pl-4">공장 소유형태</span>
                      <select
                        value={factoryOwnership}
                        onChange={(e) => setFactoryOwnership(e.target.value as "owned" | "leased" | "none")}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      >
                        <option value="none">선택</option>
                        <option value="owned">자가</option>
                        <option value="leased">임차</option>
                      </select>
                    </div>
                  )}
                  {renderToggle("주요 생산설비 보유", hasProductionEquipment, setHasProductionEquipment, 12)}
                  {hasProductionEquipment && (
                    <div className="py-3 border-b border-gray-100">
                      <label className="block text-sm text-gray-600 pl-4 mb-1">보유 설비 목록 (선택)</label>
                      <textarea
                        value={equipmentList}
                        onChange={(e) => setEquipmentList(e.target.value)}
                        placeholder="예: CNC 선반 2대, 프레스 1대, 용접기 3대..."
                        rows={2}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  )}
                  {renderToggle("원자재 보관시설", hasRawMaterialStorage, setHasRawMaterialStorage, 6)}
                </div>
              )}
            </div>

            {/* 카테고리 2: 생산인력 (20점) */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <SectionHeader
                sectionKey="hr"
                title="생산인력"
                maxScore={20}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                }
              />
              {openSections.hr && (
                <div className="px-4 py-2">
                  {renderNumberInput("총 종업원 수", totalEmployees, setTotalEmployees, 6)}
                  {renderNumberInput("생산직 근로자 수", productionWorkers, setProductionWorkers, 8)}
                  {renderToggle("기술인력 보유 (기사/산업기사 등)", hasTechnician, setHasTechnician, 6)}
                </div>
              )}
            </div>

            {/* 카테고리 3: 품질관리 (25점) */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <SectionHeader
                sectionKey="quality"
                title="품질관리"
                maxScore={25}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              {openSections.quality && (
                <div className="px-4 py-2">
                  {renderToggle("품질관리체계 구축", hasQualitySystem, setHasQualitySystem, 7)}
                  {renderToggle("품질검사 전담인력", hasQualityInspector, setHasQualityInspector, 6)}
                  {renderToggle("시험/검사 장비 보유", hasTestEquipment, setHasTestEquipment, 6)}
                  {renderToggle("ISO 9001 인증", hasISO9001, setHasISO9001, 4)}
                  {renderToggle("KS 인증", hasKSCertification, setHasKSCertification, 2)}
                </div>
              )}
            </div>

            {/* 카테고리 4: 생산실적 (15점) */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <SectionHeader
                sectionKey="record"
                title="생산실적"
                maxScore={15}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              />
              {openSections.record && (
                <div className="px-4 py-2">
                  {renderToggle("생산/납품 실적 보유", hasProductionRecord, setHasProductionRecord, 8)}
                  {renderNumberInput("최근 1년 매출액", recentYearRevenue, setRecentYearRevenue, 7, "원")}
                </div>
              )}
            </div>

            {/* 카테고리 5: 기타 (10점) */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <SectionHeader
                sectionKey="etc"
                title="기타 서류"
                maxScore={10}
                icon={
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
              />
              {openSections.etc && (
                <div className="px-4 py-2">
                  {renderToggle("사업자등록증 (제조업 업종 포함)", hasBizRegistration, setHasBizRegistration, 4)}
                  {renderToggle("공장등록증명서", hasFactoryRegistration, setHasFactoryRegistration, 4)}
                  {renderToggle("환경관련 인허가 (해당 시)", hasEnvironmentPermit, setHasEnvironmentPermit, 2)}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
                <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* 버튼 영역 */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveTab("basic")}
                className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                이전
              </button>
              <button
                onClick={handleDiagnosis}
                disabled={loading}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    진단 중...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    진단 실행
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ─── Tab 3: 진단 결과 ─── */}
        {activeTab === "result" && (
          <div className="space-y-6">
            {!result ? (
              <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
                <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-gray-500 mb-4">아직 진단을 실행하지 않았습니다.</p>
                <button
                  onClick={() => setActiveTab("checklist")}
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
                      <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 160 160">
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
                          stroke={result.passed ? "#22c55e" : "#ef4444"}
                          strokeWidth="10"
                          fill="none"
                          strokeLinecap="round"
                          strokeDasharray={`${(result.totalScore / 100) * 2 * Math.PI * 70} ${2 * Math.PI * 70}`}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={`text-3xl font-bold ${result.passed ? "text-green-600" : "text-red-600"}`}>
                          {result.totalScore}
                        </span>
                        <span className="text-sm text-gray-400">/ 100</span>
                      </div>
                    </div>

                    <div className="flex-1 text-center sm:text-left">
                      <div className="flex items-center justify-center sm:justify-start gap-3 mb-2">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            result.passed
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {result.passed ? "기준 충족" : "기준 미달"}
                        </span>
                        <span className={`text-2xl font-bold ${gradeColor(result.grade)}`}>
                          {result.grade}등급
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mb-3">
                        {result.passed
                          ? "직접생산확인 신청 기준(70점 이상)을 충족합니다. 서류를 준비하여 신청하세요."
                          : "직접생산확인 신청 기준(70점 이상)에 미달합니다. 아래 개선사항을 보완하세요."}
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          업체: {companyName}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          물품: {productName}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                          분류: {productCategory}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 카테고리별 점수 바 차트 */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">카테고리별 점수</h3>
                  <div className="space-y-4">
                    {result.categories.map((cat) => {
                      const pct = Math.round((cat.score / cat.maxScore) * 100);
                      const barColor =
                        pct >= 80
                          ? "bg-green-500"
                          : pct >= 60
                          ? "bg-yellow-500"
                          : pct >= 40
                          ? "bg-orange-500"
                          : "bg-red-500";
                      return (
                        <div key={cat.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                            <span className="text-sm text-gray-500">
                              {cat.score} / {cat.maxScore}점
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
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

                {/* 상세 항목 */}
                <div className="bg-white rounded-xl shadow-sm border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">항목별 상세 결과</h3>
                  <div className="space-y-4">
                    {result.categories.map((cat) => (
                      <div key={cat.name}>
                        <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                          {cat.name}
                          <span className="text-xs text-gray-400">
                            ({cat.score}/{cat.maxScore})
                          </span>
                        </h4>
                        <div className="divide-y divide-gray-100">
                          {cat.items.map((item, idx) => (
                            <div key={idx} className="py-2.5 flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-gray-700">{item.label}</span>
                                  {statusBadge(item.status)}
                                </div>
                                {item.advice && (
                                  <p className="text-xs text-gray-500 mt-1 pl-0">{item.advice}</p>
                                )}
                              </div>
                              <span className="text-sm font-medium text-gray-600 flex-shrink-0">
                                {item.score}/{item.maxScore}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 개선 권고사항 */}
                {result.recommendations.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      개선 권고사항
                    </h3>
                    <ul className="space-y-2">
                      {result.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <svg
                            className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                              rec.startsWith("[필수]")
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
                                rec.startsWith("[필수]")
                                  ? "M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  : "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              }
                            />
                          </svg>
                          <span className="text-sm text-gray-700">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 필요 서류 체크리스트 */}
                {result.requiredDocuments.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      필요 서류 체크리스트
                    </h3>
                    <ul className="space-y-2">
                      {result.requiredDocuments.map((doc, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                          />
                          <span className="text-sm text-gray-700">{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* 다시 진단 */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setActiveTab("checklist")}
                    className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    항목 수정
                  </button>
                  <button
                    onClick={handleDiagnosis}
                    disabled={loading}
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                  >
                    다시 진단
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
