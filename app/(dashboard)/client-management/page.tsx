"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useClientStore, ClientCompanyData } from "@/lib/store";

// ─── Types ───

interface ClientCompany {
  id: string;
  companyName: string;
  ownerName: string | null;
  bizRegNo: string | null;
  address: string | null;
  phone: string | null;
  npBizNo: string | null;
  hiBizNo: string | null;
  eiBizNo: string | null;
  memo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // 식별 상세
  ceoGender: string | null;
  corpRegNo: string | null;
  bizType: string | null;
  foundedDate: string | null;
  // 업종 상세
  businessSector: string | null;
  industryCode: string | null;
  industryName: string | null;
  businessSubType: string | null;
  // 재무 정보
  revenueYear1: number | null;
  revenueYear2: number | null;
  revenueYear3: number | null;
  revenueLabel1: string | null;
  revenueLabel2: string | null;
  revenueLabel3: string | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  capital: number | null;
  // 고용 정보
  employeeCount: number;
  permanentEmployees: number | null;
  contractEmployees: number | null;
  researcherCount: number | null;
  foreignEmployees: number | null;
  // 연구소/전담부서
  hasResearchInstitute: boolean;
  hasRndDepartment: boolean;
  // 제조업 정보
  isManufacturer: boolean;
  manufacturingItems: string | null;
  factoryAddress: string | null;
  factoryArea: string | null;
  manufacturingCerts: string | null;
  mainRawMaterials: string | null;
  // 조달/입찰
  isG2bRegistered: boolean;
  g2bRegistrationNumber: string | null;
  mainProducts: string | null;
  hasDirectProductionCert: boolean;
  hasMasContract: boolean;
  // 수출/외국인
  isExporter: boolean;
  exportCountries: string | null;
  hasForeignWorkers: boolean;
  foreignWorkerVisaTypes: string | null;
  // 메타
  profileCompleteness: number;
}

interface ClientForm {
  // Tab 1: 기본 정보
  companyName: string;
  ownerName: string;
  ceoGender: string;
  bizRegNo: string;
  corpRegNo: string;
  address: string;
  phone: string;
  bizType: string;
  foundedDate: string;
  // Tab 2: 업종/산업
  businessSector: string;
  industryCode: string;
  industryName: string;
  businessSubType: string;
  // Tab 3: 재무 정보
  revenueYear1: string;
  revenueYear2: string;
  revenueYear3: string;
  revenueLabel1: string;
  revenueLabel2: string;
  revenueLabel3: string;
  capital: string;
  totalAssets: string;
  totalLiabilities: string;
  // Tab 4: 고용 정보
  employeeCount: string;
  permanentEmployees: string;
  contractEmployees: string;
  researcherCount: string;
  foreignEmployees: string;
  npBizNo: string;
  hiBizNo: string;
  eiBizNo: string;
  // Tab 5: 사업장 상세
  hasResearchInstitute: boolean;
  hasRndDepartment: boolean;
  isManufacturer: boolean;
  manufacturingItems: string;
  factoryAddress: string;
  factoryArea: string;
  manufacturingCerts: string;
  mainRawMaterials: string;
  isG2bRegistered: boolean;
  g2bRegistrationNumber: string;
  mainProducts: string;
  hasDirectProductionCert: boolean;
  hasMasContract: boolean;
  isExporter: boolean;
  exportCountries: string;
  hasForeignWorkers: boolean;
  foreignWorkerVisaTypes: string;
  // Tab 6: 메모
  memo: string;
}

const EMPTY_FORM: ClientForm = {
  companyName: "",
  ownerName: "",
  ceoGender: "",
  bizRegNo: "",
  corpRegNo: "",
  address: "",
  phone: "",
  bizType: "",
  foundedDate: "",
  businessSector: "",
  industryCode: "",
  industryName: "",
  businessSubType: "",
  revenueYear1: "",
  revenueYear2: "",
  revenueYear3: "",
  revenueLabel1: "",
  revenueLabel2: "",
  revenueLabel3: "",
  capital: "",
  totalAssets: "",
  totalLiabilities: "",
  employeeCount: "",
  permanentEmployees: "",
  contractEmployees: "",
  researcherCount: "",
  foreignEmployees: "",
  npBizNo: "",
  hiBizNo: "",
  eiBizNo: "",
  hasResearchInstitute: false,
  hasRndDepartment: false,
  isManufacturer: false,
  manufacturingItems: "",
  factoryAddress: "",
  factoryArea: "",
  manufacturingCerts: "",
  mainRawMaterials: "",
  isG2bRegistered: false,
  g2bRegistrationNumber: "",
  mainProducts: "",
  hasDirectProductionCert: false,
  hasMasContract: false,
  isExporter: false,
  exportCountries: "",
  hasForeignWorkers: false,
  foreignWorkerVisaTypes: "",
  memo: "",
};

const TAB_LABELS = [
  "기본 정보",
  "업종/산업",
  "재무 정보",
  "고용 정보",
  "사업장 상세",
  "메모",
] as const;

const BUSINESS_SECTOR_OPTIONS = [
  "",
  "제조업",
  "서비스업",
  "건설업",
  "IT",
  "유통업",
  "농림어업",
  "기타",
] as const;

// ─── Helpers ───

/** 사업자등록번호 포맷팅: 000-00-00000 */
function formatBizRegNo(value: string): string {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/** 법인등록번호 포맷팅: 000000-0000000 */
function formatCorpRegNo(value: string): string {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 13);
  if (digits.length <= 6) return digits;
  return `${digits.slice(0, 6)}-${digits.slice(6)}`;
}

/** 전화번호 포맷팅 */
function formatPhone(value: string): string {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

/** 숫자만 허용 (금액용) */
function onlyDigits(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/** 금액 포맷팅 (한국 원) */
function formatCurrency(value: number | string | null | undefined): string {
  if (value == null || value === "" || value === 0) return "-";
  const num = typeof value === "string" ? parseInt(value, 10) : value;
  if (isNaN(num)) return "-";
  return num.toLocaleString("ko-KR") + "원";
}

/** ISO date → YYYY-MM-DD */
function toDateInput(d: string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toISOString().split("T")[0];
  } catch {
    return "";
  }
}

/** 프로필 완성도 계산 (클라이언트 기준) */
function calcCompleteness(form: ClientForm): number {
  const checks: boolean[] = [
    !!form.companyName.trim(),
    !!form.ownerName.trim(),
    !!form.bizRegNo.trim(),
    !!form.address.trim(),
    !!form.phone.trim(),
    !!form.ceoGender,
    !!form.bizType.trim(),
    !!form.foundedDate,
    !!form.businessSector,
    !!form.industryCode.trim() || !!form.industryName.trim(),
    !!form.revenueYear1 || !!form.revenueYear2 || !!form.revenueYear3,
    !!form.capital,
    !!form.employeeCount,
    !!form.npBizNo.trim() || !!form.hiBizNo.trim() || !!form.eiBizNo.trim(),
    !!form.memo.trim(),
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

/** ClientCompany -> ClientForm */
function clientToForm(client: ClientCompany): ClientForm {
  return {
    companyName: client.companyName,
    ownerName: client.ownerName || "",
    ceoGender: client.ceoGender || "",
    bizRegNo: client.bizRegNo || "",
    corpRegNo: client.corpRegNo || "",
    address: client.address || "",
    phone: client.phone || "",
    bizType: client.bizType || "",
    foundedDate: toDateInput(client.foundedDate),
    businessSector: client.businessSector || "",
    industryCode: client.industryCode || "",
    industryName: client.industryName || "",
    businessSubType: client.businessSubType || "",
    revenueYear1: client.revenueYear1 != null ? String(client.revenueYear1) : "",
    revenueYear2: client.revenueYear2 != null ? String(client.revenueYear2) : "",
    revenueYear3: client.revenueYear3 != null ? String(client.revenueYear3) : "",
    revenueLabel1: client.revenueLabel1 || "",
    revenueLabel2: client.revenueLabel2 || "",
    revenueLabel3: client.revenueLabel3 || "",
    capital: client.capital != null ? String(client.capital) : "",
    totalAssets: client.totalAssets != null ? String(client.totalAssets) : "",
    totalLiabilities: client.totalLiabilities != null ? String(client.totalLiabilities) : "",
    employeeCount: client.employeeCount ? String(client.employeeCount) : "",
    permanentEmployees: client.permanentEmployees != null ? String(client.permanentEmployees) : "",
    contractEmployees: client.contractEmployees != null ? String(client.contractEmployees) : "",
    researcherCount: client.researcherCount != null ? String(client.researcherCount) : "",
    foreignEmployees: client.foreignEmployees != null ? String(client.foreignEmployees) : "",
    npBizNo: client.npBizNo || "",
    hiBizNo: client.hiBizNo || "",
    eiBizNo: client.eiBizNo || "",
    hasResearchInstitute: client.hasResearchInstitute || false,
    hasRndDepartment: client.hasRndDepartment || false,
    isManufacturer: client.isManufacturer || false,
    manufacturingItems: client.manufacturingItems || "",
    factoryAddress: client.factoryAddress || "",
    factoryArea: client.factoryArea || "",
    manufacturingCerts: client.manufacturingCerts || "",
    mainRawMaterials: client.mainRawMaterials || "",
    isG2bRegistered: client.isG2bRegistered || false,
    g2bRegistrationNumber: client.g2bRegistrationNumber || "",
    mainProducts: client.mainProducts || "",
    hasDirectProductionCert: client.hasDirectProductionCert || false,
    hasMasContract: client.hasMasContract || false,
    isExporter: client.isExporter || false,
    exportCountries: client.exportCountries || "",
    hasForeignWorkers: client.hasForeignWorkers || false,
    foreignWorkerVisaTypes: client.foreignWorkerVisaTypes || "",
    memo: client.memo || "",
  };
}

/** ClientCompany -> ClientCompanyData (store) */
function clientToStoreData(client: ClientCompany): ClientCompanyData {
  return {
    id: client.id,
    companyName: client.companyName,
    ownerName: client.ownerName,
    bizRegNo: client.bizRegNo,
    address: client.address,
    phone: client.phone,
    npBizNo: client.npBizNo,
    hiBizNo: client.hiBizNo,
    eiBizNo: client.eiBizNo,
    memo: client.memo,
    ceoGender: client.ceoGender,
    corpRegNo: client.corpRegNo,
    bizType: client.bizType,
    foundedDate: client.foundedDate,
    businessSector: client.businessSector,
    industryCode: client.industryCode,
    industryName: client.industryName,
    businessSubType: client.businessSubType,
    revenueYear1: client.revenueYear1,
    revenueYear2: client.revenueYear2,
    revenueYear3: client.revenueYear3,
    revenueLabel1: client.revenueLabel1,
    revenueLabel2: client.revenueLabel2,
    revenueLabel3: client.revenueLabel3,
    totalAssets: client.totalAssets,
    totalLiabilities: client.totalLiabilities,
    capital: client.capital,
    employeeCount: client.employeeCount,
    permanentEmployees: client.permanentEmployees,
    contractEmployees: client.contractEmployees,
    researcherCount: client.researcherCount,
    foreignEmployees: client.foreignEmployees,
    hasResearchInstitute: client.hasResearchInstitute,
    hasRndDepartment: client.hasRndDepartment,
    isManufacturer: client.isManufacturer,
    manufacturingItems: client.manufacturingItems,
    factoryAddress: client.factoryAddress,
    mainProducts: client.mainProducts,
    isG2bRegistered: client.isG2bRegistered,
    g2bRegistrationNumber: client.g2bRegistrationNumber,
    hasForeignWorkers: client.hasForeignWorkers,
    foreignWorkerVisaTypes: client.foreignWorkerVisaTypes,
    profileCompleteness: client.profileCompleteness,
  };
}

/** Form -> API payload */
function formToPayload(form: ClientForm) {
  const completeness = calcCompleteness(form);
  return {
    companyName: form.companyName.trim(),
    ownerName: form.ownerName.trim() || null,
    ceoGender: form.ceoGender || null,
    bizRegNo: form.bizRegNo.trim() || null,
    corpRegNo: form.corpRegNo.trim() || null,
    address: form.address.trim() || null,
    phone: form.phone.trim() || null,
    bizType: form.bizType.trim() || null,
    foundedDate: form.foundedDate || null,
    businessSector: form.businessSector || null,
    industryCode: form.industryCode.trim() || null,
    industryName: form.industryName.trim() || null,
    businessSubType: form.businessSubType.trim() || null,
    revenueYear1: form.revenueYear1 ? Number(form.revenueYear1) : null,
    revenueYear2: form.revenueYear2 ? Number(form.revenueYear2) : null,
    revenueYear3: form.revenueYear3 ? Number(form.revenueYear3) : null,
    revenueLabel1: form.revenueLabel1.trim() || null,
    revenueLabel2: form.revenueLabel2.trim() || null,
    revenueLabel3: form.revenueLabel3.trim() || null,
    capital: form.capital ? Number(form.capital) : null,
    totalAssets: form.totalAssets ? Number(form.totalAssets) : null,
    totalLiabilities: form.totalLiabilities ? Number(form.totalLiabilities) : null,
    employeeCount: form.employeeCount ? Number(form.employeeCount) : 0,
    permanentEmployees: form.permanentEmployees ? Number(form.permanentEmployees) : null,
    contractEmployees: form.contractEmployees ? Number(form.contractEmployees) : null,
    researcherCount: form.researcherCount ? Number(form.researcherCount) : null,
    foreignEmployees: form.foreignEmployees ? Number(form.foreignEmployees) : null,
    npBizNo: form.npBizNo.trim() || null,
    hiBizNo: form.hiBizNo.trim() || null,
    eiBizNo: form.eiBizNo.trim() || null,
    hasResearchInstitute: form.hasResearchInstitute,
    hasRndDepartment: form.hasRndDepartment,
    isManufacturer: form.isManufacturer,
    manufacturingItems: form.manufacturingItems.trim() || null,
    factoryAddress: form.factoryAddress.trim() || null,
    factoryArea: form.factoryArea.trim() || null,
    manufacturingCerts: form.manufacturingCerts.trim() || null,
    mainRawMaterials: form.mainRawMaterials.trim() || null,
    isG2bRegistered: form.isG2bRegistered,
    g2bRegistrationNumber: form.g2bRegistrationNumber.trim() || null,
    mainProducts: form.mainProducts.trim() || null,
    hasDirectProductionCert: form.hasDirectProductionCert,
    hasMasContract: form.hasMasContract,
    isExporter: form.isExporter,
    exportCountries: form.exportCountries.trim() || null,
    hasForeignWorkers: form.hasForeignWorkers,
    foreignWorkerVisaTypes: form.foreignWorkerVisaTypes.trim() || null,
    memo: form.memo.trim() || null,
    profileCompleteness: completeness,
  };
}

// ─── Main Page ───

export default function ClientManagementPage() {
  const { selectedClient, setSelectedClient, clearSelectedClient } = useClientStore();

  const [clients, setClients] = useState<ClientCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientCompany | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<ClientCompany | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Profile completeness (live calculation)
  const profilePercent = useMemo(() => calcCompleteness(form), [form]);

  // ── 거래처 목록 로드 ──
  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/labor/client-companies");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "거래처 목록 조회 실패");
      setClients(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "거래처 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // ── 검색 필터링 ──
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.companyName.toLowerCase().includes(q) ||
        (c.ownerName && c.ownerName.toLowerCase().includes(q)) ||
        (c.bizRegNo && c.bizRegNo.includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.businessSector && c.businessSector.toLowerCase().includes(q)) ||
        (c.memo && c.memo.toLowerCase().includes(q))
    );
  }, [clients, searchQuery]);

  // ── 모달 열기 ──
  const handleOpenModal = (client?: ClientCompany) => {
    setFormError("");
    setActiveTab(0);
    if (client) {
      setEditingClient(client);
      setForm(clientToForm(client));
    } else {
      setEditingClient(null);
      setForm(EMPTY_FORM);
    }
    setShowModal(true);
  };

  // ── 저장 ──
  const handleSave = async () => {
    if (!form.companyName.trim()) {
      setFormError("거래처 상호는 필수입니다.");
      setActiveTab(0);
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = formToPayload(form);

      let res: Response;
      if (editingClient) {
        res = await fetch(`/api/labor/client-companies/${editingClient.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/labor/client-companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "저장 실패");

      // 수정된 거래처가 현재 선택된 거래처이면 스토어도 업데이트
      if (editingClient && selectedClient?.id === editingClient.id) {
        setSelectedClient(clientToStoreData(data.data));
      }

      setShowModal(false);
      fetchClients();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // ── 삭제 (soft delete) ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/labor/client-companies/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "삭제 실패");

      if (selectedClient?.id === deleteTarget.id) {
        clearSelectedClient();
      }

      setDeleteTarget(null);
      fetchClients();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── 거래처 선택 (모든 필드 전달) ──
  const handleSelectClient = (client: ClientCompany) => {
    setSelectedClient(clientToStoreData(client));
  };

  // ── form field updater ──
  const setField = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── 헤더 ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">거래처 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          거래처를 등록하고 선택하여 노동행정 업무를 처리합니다 (Pro Plus)
        </p>
      </div>

      {/* ── 현재 선택된 거래처 배지 ── */}
      {selectedClient && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-bold">
              {selectedClient.companyName.charAt(0)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
                  현재 선택
                </span>
                <span className="font-semibold text-blue-900 truncate">
                  {selectedClient.companyName}
                </span>
              </div>
              <p className="text-xs text-blue-600 mt-0.5 truncate">
                {[
                  selectedClient.ownerName && `대표: ${selectedClient.ownerName}`,
                  selectedClient.bizRegNo && `사업자번호: ${selectedClient.bizRegNo}`,
                  selectedClient.businessSector,
                  selectedClient.employeeCount && `직원 ${selectedClient.employeeCount}명`,
                ]
                  .filter(Boolean)
                  .join(" | ") || "상세 정보 없음"}
              </p>
            </div>
          </div>
          <button
            onClick={clearSelectedClient}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* ── 액션 바 (검색 + 추가 버튼) ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-72">
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="거래처명, 대표자, 사업자번호, 업종 검색..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 hidden sm:block">
            총 <span className="font-semibold text-gray-900">{filteredClients.length}</span>개
            {searchQuery && ` (전체 ${clients.length}개)`}
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          거래처 추가
        </button>
      </div>

      {/* ── 에러 ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700 text-xs underline ml-2">
            닫기
          </button>
        </div>
      )}

      {/* ── 거래처 목록 ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          {clients.length === 0 ? (
            <>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">등록된 거래처가 없습니다</p>
              <p className="text-gray-400 text-sm mt-1">
                거래처를 추가하면 4대보험, 급여명세서 등 노동행정 업무를 거래처별로 관리할 수 있습니다.
              </p>
              <button
                onClick={() => handleOpenModal()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                첫 거래처 추가하기
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-sm">
                &quot;{searchQuery}&quot;에 해당하는 거래처가 없습니다.
              </p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm underline"
              >
                검색 초기화
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* 데스크탑 테이블 */}
          <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-10">#</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">상호</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">대표자</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">사업자등록번호</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">업종</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">직원수</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">완성도</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600 w-44">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredClients.map((client, idx) => {
                    const isSelected = selectedClient?.id === client.id;
                    return (
                      <tr
                        key={client.id}
                        className={`transition-colors ${
                          isSelected
                            ? "bg-blue-50 hover:bg-blue-100"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{client.companyName}</span>
                            {isSelected && (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white">
                                선택됨
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{client.ownerName || "-"}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                          {client.bizRegNo || "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {client.businessSector || "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {client.employeeCount ? `${client.employeeCount}명` : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <ProfileBar percent={client.profileCompleteness || 0} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {isSelected ? (
                              <button
                                onClick={clearSelectedClient}
                                className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                              >
                                선택 해제
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSelectClient(client)}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                              >
                                선택
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenModal(client)}
                              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => setDeleteTarget(client)}
                              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 모바일 / 태블릿 카드 리스트 */}
          <div className="lg:hidden space-y-3">
            {filteredClients.map((client, idx) => {
              const isSelected = selectedClient?.id === client.id;
              const isExpanded = expandedId === client.id;
              return (
                <div
                  key={client.id}
                  className={`bg-white rounded-xl border overflow-hidden shadow-sm transition-colors ${
                    isSelected ? "border-blue-300 ring-1 ring-blue-200" : "border-gray-200"
                  }`}
                >
                  {/* 카드 헤더 */}
                  <div
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : client.id)}
                  >
                    <span
                      className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 truncate">
                          {client.companyName}
                        </span>
                        {isSelected && (
                          <span className="flex-shrink-0 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white">
                            선택됨
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {[
                          client.ownerName,
                          client.bizRegNo,
                          client.businessSector,
                          client.employeeCount ? `${client.employeeCount}명` : null,
                        ].filter(Boolean).join(" / ") || "상세 정보 없음"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ProfileBar percent={client.profileCompleteness || 0} compact />
                      <svg
                        className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* 카드 확장 상세 */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      <div className="px-4 py-3 space-y-2 text-sm">
                        <InfoRow label="대표자" value={client.ownerName} />
                        <InfoRow label="성별" value={client.ceoGender === "male" ? "남" : client.ceoGender === "female" ? "여" : null} />
                        <InfoRow label="사업자번호" value={client.bizRegNo} mono />
                        <InfoRow label="주소" value={client.address} />
                        <InfoRow label="전화번호" value={client.phone} mono />
                        <InfoRow label="업종" value={client.businessSector} />
                        <InfoRow label="업태/종목" value={client.bizType} />
                        <InfoRow label="직원수" value={client.employeeCount ? `${client.employeeCount}명 (정규직 ${client.permanentEmployees ?? "-"}명, 계약직 ${client.contractEmployees ?? "-"}명)` : null} />
                        {client.capital != null && client.capital > 0 && (
                          <InfoRow label="자본금" value={formatCurrency(client.capital)} />
                        )}
                        {(client.npBizNo || client.hiBizNo || client.eiBizNo) && (
                          <div className="pt-1">
                            <p className="text-xs font-medium text-gray-500 mb-1.5">보험 관리번호</p>
                            <div className="flex flex-wrap gap-1.5">
                              {client.npBizNo && (
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                  국민연금 {client.npBizNo}
                                </span>
                              )}
                              {client.hiBizNo && (
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                                  건강보험 {client.hiBizNo}
                                </span>
                              )}
                              {client.eiBizNo && (
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  고용산재 {client.eiBizNo}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {client.memo && (
                          <div className="pt-1">
                            <p className="text-xs font-medium text-gray-500 mb-1">메모</p>
                            <p className="text-gray-700 text-xs bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                              {client.memo}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* 카드 액션 버튼 */}
                      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
                        {isSelected ? (
                          <button
                            onClick={clearSelectedClient}
                            className="flex-1 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            선택 해제
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSelectClient(client)}
                            className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            이 거래처로 작업하기
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenModal(client)}
                          className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => setDeleteTarget(client)}
                          className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── 안내 문구 ── */}
      {!loading && clients.length > 0 && (
        <div className="text-xs text-gray-400 space-y-1">
          <p>
            * 거래처를 선택하면 급여명세서, 4대보험 신고, 근로계약서 등 모든 노동행정 업무에 해당 거래처 정보가 자동 적용됩니다.
          </p>
          <p>
            * 삭제된 거래처는 비활성화 처리되며, 기존 데이터는 유지됩니다.
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* 추가/수정 모달 (탭 구조)                                */}
      {/* ══════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingClient ? "거래처 수정" : "거래처 추가"}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {editingClient ? "거래처 정보를 수정합니다." : "새 거래처를 등록합니다. 상호(*)는 필수 항목입니다."}
                  </p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1"
                >
                  &times;
                </button>
              </div>

              {/* 프로필 완성도 바 */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">프로필 완성도</span>
                  <span className={`font-semibold ${profilePercent >= 80 ? "text-green-600" : profilePercent >= 50 ? "text-amber-600" : "text-gray-500"}`}>
                    {profilePercent}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      profilePercent >= 80
                        ? "bg-green-500"
                        : profilePercent >= 50
                        ? "bg-amber-500"
                        : "bg-gray-400"
                    }`}
                    style={{ width: `${profilePercent}%` }}
                  />
                </div>
              </div>

              {/* 탭 네비게이션 */}
              <div className="mt-4 flex gap-1 overflow-x-auto pb-1 -mb-4">
                {TAB_LABELS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveTab(i)}
                    className={`flex-shrink-0 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                      activeTab === i
                        ? "border-blue-600 text-blue-600 bg-blue-50/50"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 모달 본문 (스크롤 영역) */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* ─── Tab 0: 기본 정보 ─── */}
              {activeTab === 0 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      상호 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.companyName}
                      onChange={(e) => setField("companyName", e.target.value)}
                      placeholder="주식회사 어드미니"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">대표자</label>
                      <input
                        type="text"
                        value={form.ownerName}
                        onChange={(e) => setField("ownerName", e.target.value)}
                        placeholder="홍길동"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">대표자 성별</label>
                      <select
                        value={form.ceoGender}
                        onChange={(e) => setField("ceoGender", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                      >
                        <option value="">선택안함</option>
                        <option value="male">남성</option>
                        <option value="female">여성</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">설립일/개업일</label>
                      <input
                        type="date"
                        value={form.foundedDate}
                        onChange={(e) => setField("foundedDate", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">사업자등록번호</label>
                      <input
                        type="text"
                        value={form.bizRegNo}
                        onChange={(e) => setField("bizRegNo", formatBizRegNo(e.target.value))}
                        placeholder="000-00-00000"
                        maxLength={12}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">법인등록번호</label>
                      <input
                        type="text"
                        value={form.corpRegNo}
                        onChange={(e) => setField("corpRegNo", formatCorpRegNo(e.target.value))}
                        placeholder="000000-0000000"
                        maxLength={14}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">주소</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setField("address", e.target.value)}
                      placeholder="서울특별시 강남구 테헤란로 123"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">전화번호</label>
                      <input
                        type="text"
                        value={form.phone}
                        onChange={(e) => setField("phone", formatPhone(e.target.value))}
                        placeholder="02-1234-5678"
                        maxLength={13}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">업태/종목</label>
                      <input
                        type="text"
                        value={form.bizType}
                        onChange={(e) => setField("bizType", e.target.value)}
                        placeholder="예: 서비스업 / 소프트웨어개발"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Tab 1: 업종/산업 ─── */}
              {activeTab === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">업종 대분류</label>
                    <select
                      value={form.businessSector}
                      onChange={(e) => setField("businessSector", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                    >
                      <option value="">선택안함</option>
                      {BUSINESS_SECTOR_OPTIONS.filter(Boolean).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">한국표준산업분류 코드</label>
                      <input
                        type="text"
                        value={form.industryCode}
                        onChange={(e) => setField("industryCode", e.target.value)}
                        placeholder="예: C26110"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">산업분류명</label>
                      <input
                        type="text"
                        value={form.industryName}
                        onChange={(e) => setField("industryName", e.target.value)}
                        placeholder="예: 반도체 제조업"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">세부업종</label>
                    <input
                      type="text"
                      value={form.businessSubType}
                      onChange={(e) => setField("businessSubType", e.target.value)}
                      placeholder="예: 시스템 소프트웨어 개발 및 공급"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-500">
                    <p className="font-medium text-gray-600 mb-1">한국표준산업분류 코드란?</p>
                    <p>통계청에서 부여하는 산업 분류 코드입니다. 사업자등록증이나 국세청 홈택스에서 확인할 수 있습니다.</p>
                  </div>
                </div>
              )}

              {/* ─── Tab 2: 재무 정보 ─── */}
              {activeTab === 2 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    최근 3개년 매출액을 입력합니다. 보조금 매칭, 입찰 시뮬레이션 등에 활용됩니다.
                  </p>

                  {/* 매출액 1차년도 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">1차년도 라벨</label>
                      <input
                        type="text"
                        value={form.revenueLabel1}
                        onChange={(e) => setField("revenueLabel1", e.target.value)}
                        placeholder="예: 2025년"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">매출액 (원)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.revenueYear1 ? Number(form.revenueYear1).toLocaleString("ko-KR") : ""}
                          onChange={(e) => setField("revenueYear1", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                      </div>
                    </div>
                  </div>

                  {/* 매출액 2차년도 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">2차년도 라벨</label>
                      <input
                        type="text"
                        value={form.revenueLabel2}
                        onChange={(e) => setField("revenueLabel2", e.target.value)}
                        placeholder="예: 2024년"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">매출액 (원)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.revenueYear2 ? Number(form.revenueYear2).toLocaleString("ko-KR") : ""}
                          onChange={(e) => setField("revenueYear2", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                      </div>
                    </div>
                  </div>

                  {/* 매출액 3차년도 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">3차년도 라벨</label>
                      <input
                        type="text"
                        value={form.revenueLabel3}
                        onChange={(e) => setField("revenueLabel3", e.target.value)}
                        placeholder="예: 2023년"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">매출액 (원)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.revenueYear3 ? Number(form.revenueYear3).toLocaleString("ko-KR") : ""}
                          onChange={(e) => setField("revenueYear3", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">재무상태</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">자본금 (원)</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={form.capital ? Number(form.capital).toLocaleString("ko-KR") : ""}
                            onChange={(e) => setField("capital", onlyDigits(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">총자산 (원)</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={form.totalAssets ? Number(form.totalAssets).toLocaleString("ko-KR") : ""}
                            onChange={(e) => setField("totalAssets", onlyDigits(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">총부채 (원)</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={form.totalLiabilities ? Number(form.totalLiabilities).toLocaleString("ko-KR") : ""}
                            onChange={(e) => setField("totalLiabilities", onlyDigits(e.target.value))}
                            placeholder="0"
                            className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Tab 3: 고용 정보 ─── */}
              {activeTab === 3 && (
                <div className="space-y-4">
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
                    고용 현황과 4대보험 사업장 관리번호를 입력합니다.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">상시근로자 수</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.employeeCount}
                          onChange={(e) => setField("employeeCount", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">명</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">정규직 수</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.permanentEmployees}
                          onChange={(e) => setField("permanentEmployees", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">명</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">계약직 수</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.contractEmployees}
                          onChange={(e) => setField("contractEmployees", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">명</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">연구원 수</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.researcherCount}
                          onChange={(e) => setField("researcherCount", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">명</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">외국인 근로자 수</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.foreignEmployees}
                          onChange={(e) => setField("foreignEmployees", onlyDigits(e.target.value))}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-lg text-sm text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">명</span>
                      </div>
                    </div>
                  </div>

                  {/* 4대보험 관리번호 */}
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                      4대보험 사업장 관리번호
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">국민연금 관리번호</label>
                        <input
                          type="text"
                          value={form.npBizNo}
                          onChange={(e) => setField("npBizNo", e.target.value)}
                          placeholder="NP-000000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">건강보험 관리번호</label>
                        <input
                          type="text"
                          value={form.hiBizNo}
                          onChange={(e) => setField("hiBizNo", e.target.value)}
                          placeholder="HI-000000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">고용/산재보험 관리번호</label>
                      <input
                        type="text"
                        value={form.eiBizNo}
                        onChange={(e) => setField("eiBizNo", e.target.value)}
                        placeholder="EI-000000"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                      <p className="text-xs text-gray-400 mt-1">고용보험과 산재보험은 동일 관리번호를 사용합니다.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Tab 4: 사업장 상세 ─── */}
              {activeTab === 4 && (
                <div className="space-y-5">
                  {/* 연구소 */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">연구소 / 전담부서</p>
                    <div className="flex flex-wrap gap-4">
                      <CheckboxField
                        label="기업부설연구소 보유"
                        checked={form.hasResearchInstitute}
                        onChange={(v) => setField("hasResearchInstitute", v)}
                      />
                      <CheckboxField
                        label="연구개발전담부서 보유"
                        checked={form.hasRndDepartment}
                        onChange={(v) => setField("hasRndDepartment", v)}
                      />
                    </div>
                  </div>

                  {/* 제조업 */}
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">제조업 정보</p>
                    <CheckboxField
                      label="제조업체 여부"
                      checked={form.isManufacturer}
                      onChange={(v) => setField("isManufacturer", v)}
                    />
                    {form.isManufacturer && (
                      <div className="mt-3 space-y-3 pl-0 sm:pl-6">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">제조물품 (쉼표 구분)</label>
                          <input
                            type="text"
                            value={form.manufacturingItems}
                            onChange={(e) => setField("manufacturingItems", e.target.value)}
                            placeholder="예: 전자부품, PCB, 커넥터"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">공장 소재지</label>
                            <input
                              type="text"
                              value={form.factoryAddress}
                              onChange={(e) => setField("factoryAddress", e.target.value)}
                              placeholder="공장 주소 입력"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">공장 면적</label>
                            <div className="relative">
                              <input
                                type="text"
                                value={form.factoryArea}
                                onChange={(e) => setField("factoryArea", e.target.value)}
                                placeholder="0"
                                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">m2</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">제조 인증 (쉼표 구분)</label>
                          <input
                            type="text"
                            value={form.manufacturingCerts}
                            onChange={(e) => setField("manufacturingCerts", e.target.value)}
                            placeholder="예: HACCP, GMP, KS, ISO9001"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">주요 원자재 (쉼표 구분)</label>
                          <input
                            type="text"
                            value={form.mainRawMaterials}
                            onChange={(e) => setField("mainRawMaterials", e.target.value)}
                            placeholder="예: 구리, 알루미늄, 실리콘"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 조달/입찰 */}
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">조달 / 입찰 정보</p>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-4">
                        <CheckboxField
                          label="나라장터(G2B) 등록"
                          checked={form.isG2bRegistered}
                          onChange={(v) => setField("isG2bRegistered", v)}
                        />
                        <CheckboxField
                          label="직접생산확인증명 보유"
                          checked={form.hasDirectProductionCert}
                          onChange={(v) => setField("hasDirectProductionCert", v)}
                        />
                        <CheckboxField
                          label="다수공급자계약(MAS)"
                          checked={form.hasMasContract}
                          onChange={(v) => setField("hasMasContract", v)}
                        />
                      </div>
                      {form.isG2bRegistered && (
                        <div className="pl-0 sm:pl-6">
                          <label className="block text-xs font-medium text-gray-600 mb-1">나라장터 업체등록번호</label>
                          <input
                            type="text"
                            value={form.g2bRegistrationNumber}
                            onChange={(e) => setField("g2bRegistrationNumber", e.target.value)}
                            placeholder="업체등록번호 입력"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">주요 생산품목 (쉼표 구분)</label>
                        <input
                          type="text"
                          value={form.mainProducts}
                          onChange={(e) => setField("mainProducts", e.target.value)}
                          placeholder="예: 사무용 가구, 철재 캐비닛"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 수출/외국인 */}
                  <div className="border-t border-gray-200 pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">수출 / 외국인 근로자</p>
                    <div className="space-y-3">
                      <CheckboxField
                        label="수출 기업"
                        checked={form.isExporter}
                        onChange={(v) => setField("isExporter", v)}
                      />
                      {form.isExporter && (
                        <div className="pl-0 sm:pl-6">
                          <label className="block text-xs font-medium text-gray-600 mb-1">수출 대상국 (쉼표 구분)</label>
                          <input
                            type="text"
                            value={form.exportCountries}
                            onChange={(e) => setField("exportCountries", e.target.value)}
                            placeholder="예: 미국, 일본, 중국"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      )}
                      <CheckboxField
                        label="외국인 근로자 고용"
                        checked={form.hasForeignWorkers}
                        onChange={(v) => setField("hasForeignWorkers", v)}
                      />
                      {form.hasForeignWorkers && (
                        <div className="pl-0 sm:pl-6">
                          <label className="block text-xs font-medium text-gray-600 mb-1">비자 유형 (쉼표 구분)</label>
                          <input
                            type="text"
                            value={form.foreignWorkerVisaTypes}
                            onChange={(e) => setField("foreignWorkerVisaTypes", e.target.value)}
                            placeholder="예: E-9, H-2, D-10"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ─── Tab 5: 메모 ─── */}
              {activeTab === 5 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
                    <textarea
                      value={form.memo}
                      onChange={(e) => setField("memo", e.target.value)}
                      placeholder="거래처에 대한 메모를 입력하세요. 특이사항, 계약 조건, 연락처 등 자유롭게 기록합니다."
                      rows={12}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                    />
                    <p className="text-xs text-gray-400 mt-1">{form.memo.length}자</p>
                  </div>
                </div>
              )}

              {/* 폼 에러 */}
              {formError && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}
            </div>

            {/* 모달 하단 버튼 */}
            <div className="flex-shrink-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl flex items-center justify-between">
              {/* 탭 네비게이션 (이전/다음) */}
              <div className="flex items-center gap-2">
                {activeTab > 0 && (
                  <button
                    onClick={() => setActiveTab((t) => t - 1)}
                    className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    이전
                  </button>
                )}
                {activeTab < TAB_LABELS.length - 1 && (
                  <button
                    onClick={() => setActiveTab((t) => t + 1)}
                    className="px-3 py-1.5 text-xs text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    다음
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      저장 중...
                    </span>
                  ) : editingClient ? (
                    "수정"
                  ) : (
                    "등록"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* 삭제 확인 모달                                        */}
      {/* ══════════════════════════════════════════════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 text-center">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">거래처 삭제</h3>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{deleteTarget.companyName}</span>
                {deleteTarget.ownerName && (
                  <span className="text-gray-500"> ({deleteTarget.ownerName})</span>
                )}
                을(를) 삭제하시겠습니까?
              </p>
              <p className="text-xs text-gray-400 mt-2">
                삭제된 거래처는 비활성화 처리되며, 기존 데이터는 보존됩니다.
              </p>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-6 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    삭제 중...
                  </span>
                ) : (
                  "삭제"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───

/** 프로필 완성도 바 */
function ProfileBar({ percent, compact }: { percent: number; compact?: boolean }) {
  const color =
    percent >= 80 ? "bg-green-500" : percent >= 50 ? "bg-amber-500" : "bg-gray-400";
  const textColor =
    percent >= 80 ? "text-green-600" : percent >= 50 ? "text-amber-600" : "text-gray-500";

  if (compact) {
    return (
      <span className={`text-[10px] font-semibold ${textColor}`}>{percent}%</span>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className={`text-[10px] font-semibold ${textColor}`}>{percent}%</span>
    </div>
  );
}

/** 체크박스 필드 */
function CheckboxField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

/** 정보 행 컴포넌트 (모바일 카드 상세) */
function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="flex-shrink-0 text-xs text-gray-500 w-20">{label}</span>
      <span className={`text-xs text-gray-800 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
