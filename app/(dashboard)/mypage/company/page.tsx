"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui";
import BasicInfoSection from "./components/BasicInfoSection";
import FinancialSection from "./components/FinancialSection";
import CrudListSection, { formatMoney } from "./components/CrudListSection";
import RndProcurementSection from "./components/RndProcurementSection";

const TABS = [
  { id: "basic", label: "기본정보", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { id: "financial", label: "재무/인력", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { id: "certs", label: "인증/특허", icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" },
  { id: "license", label: "면허/실적", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { id: "bid", label: "입찰이력", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { id: "etc", label: "조달/수출", icon: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function CompanyProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("basic");
  const [form, setForm] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Relations data
  const [licenses, setLicenses] = useState<any[]>([]);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [patents, setPatents] = useState<any[]>([]);
  const [performances, setPerformances] = useState<any[]>([]);
  const [bidHistory, setBidHistory] = useState<any[]>([]);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/user/company-profile");
      const data = await res.json();
      if (data.success && data.data) {
        const p = data.data;
        // Date 필드 변환
        const dateFields = ["foundedDate", "establishmentDate", "researchInstituteDate"];
        const formData: Record<string, any> = {};
        for (const [key, val] of Object.entries(p)) {
          if (dateFields.includes(key) && typeof val === "string") {
            formData[key] = val.split("T")[0];
          } else if (key === "bizRegNo" && val) {
            const d = String(val).replace(/\D/g, "");
            formData[key] = d.length >= 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : val;
          } else if (key === "corpRegNo" && val) {
            const d = String(val).replace(/\D/g, "");
            formData[key] = d.length >= 13 ? `${d.slice(0, 6)}-${d.slice(6)}` : val;
          } else {
            formData[key] = val;
          }
        }
        setForm(formData);
        setLicenses(p.licenses || []);
        setCertifications(p.certifications || []);
        setPatents(p.patents || []);
        setPerformances(p.performances || []);
        setBidHistory(p.bidHistory || []);
      }
    } catch (error) {
      console.error("Failed to fetch company profile:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleChange = (field: string, value: any) => {
    setErrors((prev) => ({ ...prev, [field]: "" }));
    setMessage(null);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setErrors({});

    try {
      const payload: Record<string, any> = {};
      // String fields
      const strFields = [
        "companyName", "ownerName", "bizRegNo", "corpRegNo", "address", "bizType",
        "businessSector", "industryCode", "industryName", "businessSubType",
        "revenueLabel1", "revenueLabel2", "revenueLabel3",
        "g2bRegistrationNumber", "mainProducts", "productClassificationCodes", "masItems",
        "exportCountries", "importItems", "foreignWorkerVisaTypes",
        "ceoGender",
      ];
      strFields.forEach((k) => { payload[k] = form[k] || null; });

      // Date fields
      const dateFields = ["foundedDate", "establishmentDate", "researchInstituteDate"];
      dateFields.forEach((k) => { payload[k] = form[k] || null; });

      // Number fields
      payload.employeeCount = Number(form.employeeCount) || 0;
      payload.capital = Number(form.capital) || 0;
      payload.profileCompleteness = Number(form.profileCompleteness) || 0;

      // Nullable int fields
      ["permanentEmployees", "researcherCount", "foreignEmployees"].forEach((k) => {
        payload[k] = form[k] != null ? Number(form[k]) : null;
      });

      // BigInt fields
      const bigFields = [
        "revenueYear1", "revenueYear2", "revenueYear3",
        "operatingProfitYear1", "operatingProfitYear2", "operatingProfitYear3",
        "netIncomeYear1", "netIncomeYear2", "netIncomeYear3",
        "totalAssets", "totalLiabilities", "rndExpenditure", "exportAmount",
      ];
      bigFields.forEach((k) => { payload[k] = form[k] != null ? Number(form[k]) : null; });

      // Boolean fields
      const boolFields = [
        "hasResearchInstitute", "hasRndDepartment", "isG2bRegistered",
        "hasDirectProductionCert", "hasMasContract", "isExporter", "hasForeignWorkers",
      ];
      boolFields.forEach((k) => { payload[k] = !!form[k]; });

      const res = await fetch("/api/user/company-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.details) {
          const fieldErrors: Record<string, string> = {};
          for (const [key, msgs] of Object.entries(data.details)) {
            fieldErrors[key] = (msgs as string[])[0];
          }
          setErrors(fieldErrors);
        }
        setMessage({ type: "error", text: data.error || "저장에 실패했습니다" });
        return;
      }
      setMessage({ type: "success", text: "기업 정보가 저장되었습니다" });
    } catch (error) {
      console.error("Failed to save:", error);
      setMessage({ type: "error", text: "서버 오류가 발생했습니다" });
    } finally {
      setIsSaving(false);
    }
  };

  // 프로필 완성도 계산
  const completeness = (() => {
    const checks = [
      form.companyName, form.ownerName, form.bizRegNo, form.address, form.bizType,
      form.foundedDate, form.employeeCount > 0, form.capital > 0,
      form.businessSector, form.revenueYear1, form.totalAssets,
      certifications.length > 0, licenses.length > 0 || performances.length > 0,
    ];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  })();

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* 헤더 + 완성도 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link href="/mypage" className="hover:text-gray-700">마이페이지</Link>
          <span>/</span>
          <span className="text-gray-900">기업 마스터 프로필</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">기업 마스터 프로필</h1>
            <p className="text-gray-500 mt-1">AI 분석, 서류 자동완성, 인증 진단, 정책자금 매칭에 활용됩니다</p>
          </div>
          <div className="text-center">
            <div className="relative w-16 h-16">
              <svg className="w-16 h-16 transform -rotate-90">
                <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="4" />
                <circle cx="32" cy="32" r="28" fill="none" stroke={completeness >= 80 ? "#10b981" : completeness >= 50 ? "#f59e0b" : "#ef4444"} strokeWidth="4" strokeDasharray={`${(completeness / 100) * 176} 176`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-700">{completeness}%</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">완성도</p>
          </div>
        </div>
      </div>

      {/* 알림 메시지 */}
      {message && (
        <div className={`mb-4 p-3 rounded-lg border text-sm ${message.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
          {message.text}
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
            </svg>
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* 탭 1: 기본정보 */}
        {activeTab === "basic" && (
          <BasicInfoSection form={form} onChange={handleChange} errors={errors} />
        )}

        {/* 탭 2: 재무/인력 */}
        {activeTab === "financial" && (
          <FinancialSection form={form} onChange={handleChange} />
        )}

        {/* 탭 3: 인증/특허 */}
        {activeTab === "certs" && (
          <div className="space-y-6">
            <CrudListSection
              title="기업 인증"
              icon={<svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>}
              items={certifications}
              apiPath="/api/user/company-profile/certifications"
              onRefresh={fetchProfile}
              fields={[
                { key: "certType", label: "인증 유형", type: "select", required: true, options: [
                  { value: "venture", label: "벤처기업" }, { value: "innobiz", label: "이노비즈" },
                  { value: "mainbiz", label: "메인비즈" }, { value: "iso9001", label: "ISO 9001" },
                  { value: "iso14001", label: "ISO 14001" }, { value: "greentech", label: "녹색기술인증" },
                  { value: "other", label: "기타" },
                ]},
                { key: "certName", label: "인증명", type: "text", required: true, placeholder: "예: 벤처기업확인서" },
                { key: "certNumber", label: "인증번호", type: "text" },
                { key: "issuer", label: "발급기관", type: "text", placeholder: "예: 기술보증기금" },
                { key: "issueDate", label: "발급일", type: "date" },
                { key: "expiryDate", label: "만료일", type: "date" },
              ]}
              displayColumns={[
                { key: "certName", label: "인증명" },
                { key: "certType", label: "유형" },
                { key: "issuer", label: "발급기관" },
                { key: "expiryDate", label: "만료일", render: (item) => item.expiryDate ? item.expiryDate.split("T")[0] : "-" },
              ]}
            />
            <CrudListSection
              title="지식재산권"
              icon={<svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
              items={patents}
              apiPath="/api/user/company-profile/patents"
              onRefresh={fetchProfile}
              fields={[
                { key: "patentType", label: "종류", type: "select", required: true, options: [
                  { value: "patent", label: "특허" }, { value: "utility_model", label: "실용신안" },
                  { value: "trademark", label: "상표" }, { value: "design", label: "디자인" },
                ]},
                { key: "title", label: "명칭", type: "text", required: true },
                { key: "registrationNo", label: "등록번호", type: "text" },
                { key: "applicationNo", label: "출원번호", type: "text" },
                { key: "status", label: "상태", type: "select", options: [
                  { value: "registered", label: "등록" }, { value: "pending", label: "출원중" }, { value: "expired", label: "만료" },
                ]},
                { key: "registrationDate", label: "등록일", type: "date" },
              ]}
              displayColumns={[
                { key: "title", label: "명칭" },
                { key: "patentType", label: "종류" },
                { key: "registrationNo", label: "등록번호" },
                { key: "status", label: "상태" },
              ]}
            />
          </div>
        )}

        {/* 탭 4: 면허/실적 */}
        {activeTab === "license" && (
          <div className="space-y-6">
            <CrudListSection
              title="건설 면허"
              icon={<svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
              items={licenses}
              apiPath="/api/user/company-profile/licenses"
              onRefresh={fetchProfile}
              fields={[
                { key: "licenseType", label: "면허 종류", type: "text", required: true, placeholder: "예: 토목공사업" },
                { key: "licenseNumber", label: "면허 번호", type: "text" },
                { key: "grade", label: "등급", type: "text" },
                { key: "capacity", label: "시공능력평가액", type: "money" },
                { key: "issueDate", label: "취득일", type: "date" },
                { key: "expiryDate", label: "만료일", type: "date" },
              ]}
              displayColumns={[
                { key: "licenseType", label: "면허 종류" },
                { key: "grade", label: "등급" },
                { key: "capacity", label: "시공능력", render: (item) => formatMoney(item.capacity) },
                { key: "expiryDate", label: "만료일", render: (item) => item.expiryDate ? item.expiryDate.split("T")[0] : "-" },
              ]}
            />
            <CrudListSection
              title="수행 실적"
              icon={<svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>}
              items={performances}
              apiPath="/api/user/company-profile/performance"
              onRefresh={fetchProfile}
              fields={[
                { key: "projectName", label: "사업명", type: "text", required: true },
                { key: "clientName", label: "발주처", type: "text" },
                { key: "contractAmount", label: "계약금액", type: "money" },
                { key: "startDate", label: "착수일", type: "date" },
                { key: "endDate", label: "완료일", type: "date" },
                { key: "projectType", label: "유형", type: "select", options: [
                  { value: "service", label: "용역" }, { value: "goods", label: "물품" }, { value: "construction", label: "공사" },
                ]},
              ]}
              displayColumns={[
                { key: "projectName", label: "사업명" },
                { key: "clientName", label: "발주처" },
                { key: "contractAmount", label: "계약금액", render: (item) => formatMoney(item.contractAmount) },
                { key: "endDate", label: "완료일", render: (item) => item.endDate ? item.endDate.split("T")[0] : "-" },
              ]}
            />
          </div>
        )}

        {/* 탭 5: 입찰이력 */}
        {activeTab === "bid" && (
          <CrudListSection
            title="입찰 이력"
            icon={<svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            items={bidHistory}
            apiPath="/api/user/company-profile/bid-history"
            onRefresh={fetchProfile}
            fields={[
              { key: "bidName", label: "공고명", type: "text", required: true },
              { key: "bidNo", label: "공고번호", type: "text" },
              { key: "agency", label: "발주기관", type: "text" },
              { key: "bidAmount", label: "투찰금액", type: "money" },
              { key: "estimatedPrice", label: "예정가격", type: "money" },
              { key: "bidDate", label: "투찰일", type: "date" },
              { key: "result", label: "결과", type: "select", options: [
                { value: "won", label: "낙찰" }, { value: "lost", label: "유찰" }, { value: "cancelled", label: "취소" },
              ]},
              { key: "bidRate", label: "투찰률(%)", type: "number" },
            ]}
            displayColumns={[
              { key: "bidName", label: "공고명" },
              { key: "agency", label: "발주기관" },
              { key: "bidAmount", label: "투찰금액", render: (item) => formatMoney(item.bidAmount) },
              { key: "result", label: "결과", render: (item) => item.result === "won" ? "낙찰" : item.result === "lost" ? "유찰" : item.result || "-" },
              { key: "bidDate", label: "투찰일", render: (item) => item.bidDate ? item.bidDate.split("T")[0] : "-" },
            ]}
          />
        )}

        {/* 탭 6: 조달/수출 */}
        {activeTab === "etc" && (
          <RndProcurementSection form={form} onChange={handleChange} />
        )}

        {/* 하단 버튼 (기본정보/재무/조달 탭에서만 저장 버튼 표시) */}
        {["basic", "financial", "etc"].includes(activeTab) && (
          <div className="mt-6 flex items-center justify-between">
            <Button type="button" variant="outline" onClick={() => router.push("/mypage")}>
              돌아가기
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  저장 중...
                </span>
              ) : "저장하기"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
