"use client";

import { useState, useCallback } from "react";
import {
  printTransferApplication,
  printTransferCertificate,
  printPowerOfAttorney,
  printSaleContract,
  printAllDocuments,
  getTransferApplicationHtml,
  getTransferCertificateHtml,
  getPowerOfAttorneyHtml,
  getSaleContractHtml,
  type TransferDocumentData,
} from "@/components/fleet/TransferDocumentPdf";

// ─── Types ───

interface TransferForm {
  // 양도인
  sellerName: string;
  sellerIdNumber: string;
  sellerAddress: string;
  sellerPhone: string;
  // 양수인
  buyerName: string;
  buyerIdNumber: string;
  buyerAddress: string;
  buyerPhone: string;
  // 차량
  vehicleName: string;
  vehicleType: string;
  vin: string;
  plateNumber: string;
  modelYear: string;
  displacement: string;
  color: string;
  mileage: string;
  // 거래
  salePrice: string;
  transferDate: string;
  transferReason: string;
  // 대리인
  agentName: string;
  agentIdNumber: string;
  agentAddress: string;
  agentPhone: string;
  // 특약
  specialTerms: string;
}

const EMPTY_FORM: TransferForm = {
  sellerName: "",
  sellerIdNumber: "",
  sellerAddress: "",
  sellerPhone: "",
  buyerName: "",
  buyerIdNumber: "",
  buyerAddress: "",
  buyerPhone: "",
  vehicleName: "",
  vehicleType: "sedan",
  vin: "",
  plateNumber: "",
  modelYear: "",
  displacement: "",
  color: "",
  mileage: "",
  salePrice: "",
  transferDate: new Date().toISOString().substring(0, 10),
  transferReason: "매매",
  agentName: "",
  agentIdNumber: "",
  agentAddress: "",
  agentPhone: "",
  specialTerms: "",
};

const VEHICLE_TYPE_OPTIONS = [
  { value: "sedan", label: "승용차" },
  { value: "suv", label: "SUV/RV" },
  { value: "van", label: "승합차" },
  { value: "truck", label: "화물차" },
  { value: "bus", label: "버스" },
  { value: "special", label: "특수차" },
];

const VEHICLE_TYPE_LABELS: Record<string, string> = {
  sedan: "승용차",
  suv: "SUV/RV",
  van: "승합차",
  truck: "화물차",
  bus: "버스",
  special: "특수차",
};

const TRANSFER_REASON_OPTIONS = [
  { value: "매매", label: "매매" },
  { value: "증여", label: "증여" },
  { value: "상속", label: "상속" },
  { value: "기타", label: "기타" },
];

// ─── Helpers ───

function formatNumber(v: string): string {
  const num = v.replace(/[^\d]/g, "");
  if (!num) return "";
  return Number(num).toLocaleString();
}

function parseNumber(v: string): number {
  return Number(v.replace(/[^\d]/g, "")) || 0;
}

// ─── Document Card Config ───

interface DocCardConfig {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}

const DOC_CARDS: DocCardConfig[] = [
  {
    key: "transfer_application",
    title: "이전등록신청서",
    description: "자동차관리법 시행규칙 별지 제12호 서식 기반",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
      </svg>
    ),
    color: "blue",
  },
  {
    key: "transfer_certificate",
    title: "양도증명서",
    description: "차량 양도 사실을 증명하는 문서",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.745 3.745 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
      </svg>
    ),
    color: "green",
  },
  {
    key: "power_of_attorney",
    title: "위임장",
    description: "이전등록 대리 신청을 위한 위임장",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
    color: "purple",
  },
  {
    key: "sale_contract",
    title: "매매계약서",
    description: "자동차 매매 계약 내용을 기재한 문서",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    ),
    color: "orange",
  },
];

// ─── Main Page ───

export default function TransferDocumentsPage() {
  const [activeTab, setActiveTab] = useState<"input" | "documents">("input");
  const [form, setForm] = useState<TransferForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);

  // ── Form updater ──
  const updateForm = useCallback((field: keyof TransferForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ── Build document data from form ──
  const buildDocumentData = useCallback((): TransferDocumentData => {
    return {
      seller: {
        name: form.sellerName,
        idNumber: form.sellerIdNumber,
        address: form.sellerAddress,
        phone: form.sellerPhone,
      },
      buyer: {
        name: form.buyerName,
        idNumber: form.buyerIdNumber,
        address: form.buyerAddress,
        phone: form.buyerPhone,
      },
      vehicle: {
        name: form.vehicleName,
        type: VEHICLE_TYPE_LABELS[form.vehicleType] || form.vehicleType,
        vin: form.vin,
        plateNumber: form.plateNumber,
        modelYear: form.modelYear ? Number(form.modelYear) : null,
        displacement: form.displacement ? Number(form.displacement) : null,
        color: form.color,
        mileage: form.mileage ? parseNumber(form.mileage) : null,
        purpose: "자가용",
      },
      transferDate: form.transferDate,
      transferReason: form.transferReason,
      salePrice: form.salePrice ? parseNumber(form.salePrice) : 0,
      contractDate: form.transferDate,
      specialTerms: form.specialTerms,
      agent: {
        name: form.agentName,
        idNumber: form.agentIdNumber,
        address: form.agentAddress,
        phone: form.agentPhone,
      },
      delegationScope: "자동차이전등록 신청 일체",
      delegationDate: form.transferDate,
    };
  }, [form]);

  // ── Validate before generation ──
  const validate = (): boolean => {
    if (!form.sellerName.trim()) {
      setError("양도인 성명을 입력해주세요.");
      return false;
    }
    if (!form.buyerName.trim()) {
      setError("양수인 성명을 입력해주세요.");
      return false;
    }
    if (!form.vehicleName.trim()) {
      setError("차명을 입력해주세요.");
      return false;
    }
    return true;
  };

  // ── Save to API ──
  const handleSaveToApi = async () => {
    if (!validate()) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/fleet/transfer-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerName: form.sellerName,
          sellerIdNumber: form.sellerIdNumber,
          sellerAddress: form.sellerAddress,
          sellerPhone: form.sellerPhone,
          buyerName: form.buyerName,
          buyerIdNumber: form.buyerIdNumber,
          buyerAddress: form.buyerAddress,
          buyerPhone: form.buyerPhone,
          vehicleName: form.vehicleName,
          vehicleType: form.vehicleType,
          vin: form.vin,
          plateNumber: form.plateNumber,
          modelYear: form.modelYear ? Number(form.modelYear) : undefined,
          displacement: form.displacement ? Number(form.displacement) : undefined,
          color: form.color,
          mileage: form.mileage ? parseNumber(form.mileage) : undefined,
          salePrice: form.salePrice ? parseNumber(form.salePrice) : undefined,
          transferDate: form.transferDate,
          transferReason: form.transferReason,
          agentName: form.agentName,
          agentIdNumber: form.agentIdNumber,
          agentAddress: form.agentAddress,
          agentPhone: form.agentPhone,
          specialTerms: form.specialTerms,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "서류 생성에 실패했습니다.");

      setSuccess("서류 데이터가 저장되었습니다. 서류 생성 탭에서 인쇄하세요.");
      setActiveTab("documents");
    } catch (e) {
      setError(e instanceof Error ? e.message : "서류 생성 실패");
    } finally {
      setSaving(false);
    }
  };

  // ── Print handlers ──
  const handlePrint = (docType: string) => {
    if (!validate()) return;
    const data = buildDocumentData();

    switch (docType) {
      case "transfer_application":
        printTransferApplication(data);
        break;
      case "transfer_certificate":
        printTransferCertificate(data);
        break;
      case "power_of_attorney":
        printPowerOfAttorney(data);
        break;
      case "sale_contract":
        printSaleContract(data);
        break;
    }
  };

  const handlePrintAll = () => {
    if (!validate()) return;
    const data = buildDocumentData();
    printAllDocuments(data);
  };

  // ── Preview handler ──
  const getPreviewHtml = (docType: string): string => {
    const data = buildDocumentData();
    switch (docType) {
      case "transfer_application":
        return getTransferApplicationHtml(data);
      case "transfer_certificate":
        return getTransferCertificateHtml(data);
      case "power_of_attorney":
        return getPowerOfAttorneyHtml(data);
      case "sale_contract":
        return getSaleContractHtml(data);
      default:
        return "";
    }
  };

  // ── Reset ──
  const handleReset = () => {
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
  };

  // ── Color classes ──
  const getColorClasses = (color: string) => {
    switch (color) {
      case "blue":
        return { bg: "bg-blue-50", icon: "text-blue-600", border: "border-blue-200", hover: "hover:bg-blue-50" };
      case "green":
        return { bg: "bg-green-50", icon: "text-green-600", border: "border-green-200", hover: "hover:bg-green-50" };
      case "purple":
        return { bg: "bg-purple-50", icon: "text-purple-600", border: "border-purple-200", hover: "hover:bg-purple-50" };
      case "orange":
        return { bg: "bg-orange-50", icon: "text-orange-600", border: "border-orange-200", hover: "hover:bg-orange-50" };
      default:
        return { bg: "bg-gray-50", icon: "text-gray-600", border: "border-gray-200", hover: "hover:bg-gray-50" };
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">이전등록 서류 생성</h1>
        <p className="text-sm text-gray-500 mt-1">
          법인차량 관리에서 차량을 선택하거나 직접 입력하세요
        </p>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("input")}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "input"
              ? "text-blue-600 border-blue-600"
              : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
            </svg>
            차량정보 입력
          </span>
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "documents"
              ? "text-blue-600 border-blue-600"
              : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
            </svg>
            서류 생성
          </span>
        </button>
      </div>

      {/* ── Error / Success Messages ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700 text-xs underline ml-3">
            닫기
          </button>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess("")} className="text-green-500 hover:text-green-700 text-xs underline ml-3">
            닫기
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB 1: 차량정보 입력                     */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === "input" && (
        <div className="space-y-6">
          {/* ── 양도인 (매도인) 정보 ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              양도인 (매도인) 정보
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  성명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.sellerName}
                  onChange={(e) => updateForm("sellerName", e.target.value)}
                  placeholder="홍길동"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">주민등록번호</label>
                <input
                  type="text"
                  value={form.sellerIdNumber}
                  onChange={(e) => updateForm("sellerIdNumber", e.target.value)}
                  placeholder="000000-0000000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">주소</label>
                <input
                  type="text"
                  value={form.sellerAddress}
                  onChange={(e) => updateForm("sellerAddress", e.target.value)}
                  placeholder="서울특별시 강남구 테헤란로 123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">전화번호</label>
                <input
                  type="text"
                  value={form.sellerPhone}
                  onChange={(e) => updateForm("sellerPhone", e.target.value)}
                  placeholder="010-1234-5678"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* ── 양수인 (매수인) 정보 ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              양수인 (매수인) 정보
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  성명 / 법인명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.buyerName}
                  onChange={(e) => updateForm("buyerName", e.target.value)}
                  placeholder="(주)어드미니"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">주민등록번호 / 사업자번호</label>
                <input
                  type="text"
                  value={form.buyerIdNumber}
                  onChange={(e) => updateForm("buyerIdNumber", e.target.value)}
                  placeholder="000-00-00000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">주소</label>
                <input
                  type="text"
                  value={form.buyerAddress}
                  onChange={(e) => updateForm("buyerAddress", e.target.value)}
                  placeholder="서울특별시 서초구 서초대로 456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">전화번호</label>
                <input
                  type="text"
                  value={form.buyerPhone}
                  onChange={(e) => updateForm("buyerPhone", e.target.value)}
                  placeholder="010-9876-5432"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* ── 차량 정보 ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H21M3.375 14.25h.008M21 14.25h-2.625m0 0h-2.25m4.875 0V7.5a1.125 1.125 0 0 0-1.125-1.125H5.25A1.125 1.125 0 0 0 4.125 7.5v6.75" />
              </svg>
              차량 정보
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  차명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.vehicleName}
                  onChange={(e) => updateForm("vehicleName", e.target.value)}
                  placeholder="현대 아반떼 CN7"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">차종</label>
                <select
                  value={form.vehicleType}
                  onChange={(e) => updateForm("vehicleType", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {VEHICLE_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">차대번호</label>
                <input
                  type="text"
                  value={form.vin}
                  onChange={(e) => updateForm("vin", e.target.value)}
                  placeholder="KMHD341ABNU123456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">등록번호</label>
                <input
                  type="text"
                  value={form.plateNumber}
                  onChange={(e) => updateForm("plateNumber", e.target.value)}
                  placeholder="12가 3456"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">연식</label>
                <input
                  type="number"
                  value={form.modelYear}
                  onChange={(e) => updateForm("modelYear", e.target.value)}
                  placeholder="2024"
                  min="1990"
                  max="2030"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">배기량 (cc)</label>
                <input
                  type="number"
                  value={form.displacement}
                  onChange={(e) => updateForm("displacement", e.target.value)}
                  placeholder="1598"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">색상</label>
                <input
                  type="text"
                  value={form.color}
                  onChange={(e) => updateForm("color", e.target.value)}
                  placeholder="흰색"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">주행거리 (km)</label>
                <input
                  type="text"
                  value={form.mileage}
                  onChange={(e) => updateForm("mileage", formatNumber(e.target.value))}
                  placeholder="45,000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* ── 거래 정보 ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
              거래 정보
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">매매금액 (원)</label>
                <input
                  type="text"
                  value={form.salePrice}
                  onChange={(e) => updateForm("salePrice", formatNumber(e.target.value))}
                  placeholder="15,000,000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                />
                {form.salePrice && (
                  <p className="text-xs text-gray-400 mt-1">
                    {parseNumber(form.salePrice).toLocaleString()}원
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">양도일자</label>
                <input
                  type="date"
                  value={form.transferDate}
                  onChange={(e) => updateForm("transferDate", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">이전사유</label>
                <select
                  value={form.transferReason}
                  onChange={(e) => updateForm("transferReason", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {TRANSFER_REASON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ── 대리인 정보 (위임장용) ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
              대리인 정보 (위임장용)
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              위임장 작성 시 필요합니다. 대리인이 없으면 비워두세요.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">성명</label>
                <input
                  type="text"
                  value={form.agentName}
                  onChange={(e) => updateForm("agentName", e.target.value)}
                  placeholder="대리인 성명"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">주민등록번호</label>
                <input
                  type="text"
                  value={form.agentIdNumber}
                  onChange={(e) => updateForm("agentIdNumber", e.target.value)}
                  placeholder="000000-0000000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">주소</label>
                <input
                  type="text"
                  value={form.agentAddress}
                  onChange={(e) => updateForm("agentAddress", e.target.value)}
                  placeholder="대리인 주소"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">전화번호</label>
                <input
                  type="text"
                  value={form.agentPhone}
                  onChange={(e) => updateForm("agentPhone", e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* ── 특약사항 (매매계약서용) ── */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              특약사항 (매매계약서용)
            </h2>
            <p className="text-xs text-gray-400 mb-3">
              비워두면 기본 특약사항이 자동으로 적용됩니다.
            </p>
            <textarea
              value={form.specialTerms}
              onChange={(e) => updateForm("specialTerms", e.target.value)}
              placeholder="특약사항을 입력하세요 (선택)"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* ── Action Buttons ── */}
          <div className="flex gap-3">
            <button
              onClick={handleSaveToApi}
              disabled={saving}
              className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  서류 데이터 저장 후 생성
                </>
              )}
            </button>
            <button
              onClick={() => {
                if (!validate()) return;
                setActiveTab("documents");
              }}
              className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              바로 서류 생성
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-100 text-gray-600 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              초기화
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* TAB 2: 서류 생성                         */}
      {/* ═══════════════════════════════════════ */}
      {activeTab === "documents" && (
        <div className="space-y-6">
          {/* ── 전체 인쇄 버튼 ── */}
          <div className="flex justify-end">
            <button
              onClick={handlePrintAll}
              className="px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
              전체 인쇄 (4종)
            </button>
          </div>

          {/* ── Document Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {DOC_CARDS.map((card) => {
              const colors = getColorClasses(card.color);
              return (
                <div
                  key={card.key}
                  className={`bg-white rounded-xl border ${colors.border} overflow-hidden`}
                >
                  {/* Card Header */}
                  <div className={`${colors.bg} px-5 py-4 flex items-center gap-3`}>
                    <div className={colors.icon}>{card.icon}</div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{card.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{card.description}</p>
                    </div>
                  </div>

                  {/* Card Body - Summary */}
                  <div className="px-5 py-3 text-xs text-gray-500 border-b border-gray-100">
                    {card.key === "transfer_application" && (
                      <span>양도인: {form.sellerName || "-"} / 양수인: {form.buyerName || "-"} / 차량: {form.vehicleName || "-"}</span>
                    )}
                    {card.key === "transfer_certificate" && (
                      <span>양도인: {form.sellerName || "-"} / 양도가액: {form.salePrice ? parseNumber(form.salePrice).toLocaleString() + "원" : "-"}</span>
                    )}
                    {card.key === "power_of_attorney" && (
                      <span>위임인: {form.buyerName || "-"} / 수임인: {form.agentName || "-"}</span>
                    )}
                    {card.key === "sale_contract" && (
                      <span>매도인: {form.sellerName || "-"} / 매수인: {form.buyerName || "-"} / 금액: {form.salePrice ? parseNumber(form.salePrice).toLocaleString() + "원" : "-"}</span>
                    )}
                  </div>

                  {/* Card Footer - Actions */}
                  <div className="px-5 py-3 flex items-center gap-2">
                    <button
                      onClick={() => setPreviewDoc(card.key)}
                      className="flex-1 py-2 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                      미리보기
                    </button>
                    <button
                      onClick={() => handlePrint(card.key)}
                      className="flex-1 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                      </svg>
                      인쇄
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Info Note ── */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800 space-y-1">
            <p className="font-semibold">안내사항</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-yellow-700">
              <li>이전등록신청서는 자동차관리법 시행규칙 별지 제12호 서식을 기반으로 작성됩니다.</li>
              <li>인쇄 시 A4 용지에 맞게 출력되며, PDF로 저장할 수도 있습니다.</li>
              <li>주민등록번호 등 민감 정보는 서버에 암호화 저장되지 않으므로 관리에 유의하세요.</li>
              <li>정식 서류로 사용하려면 서명/날인 후 관할 관청에 제출하세요.</li>
            </ul>
          </div>

          {/* ── Back to input ── */}
          <div className="flex justify-start">
            <button
              onClick={() => setActiveTab("input")}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              입력 화면으로 돌아가기
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* Preview Modal                           */}
      {/* ═══════════════════════════════════════ */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setPreviewDoc(null)}
          />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl z-10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">
                {DOC_CARDS.find((c) => c.key === previewDoc)?.title} 미리보기
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handlePrint(previewDoc);
                    setPreviewDoc(null);
                  }}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
                  </svg>
                  인쇄
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none px-2"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Modal body - Preview content */}
            <div className="p-6">
              <div
                className="border border-gray-200 rounded-lg overflow-hidden"
                dangerouslySetInnerHTML={{ __html: getPreviewHtml(previewDoc) }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
