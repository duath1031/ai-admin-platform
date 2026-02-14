"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import {
  calculateTransferCost,
  REGIONS,
  type TransferCostInput,
  type TransferCostResult,
} from "@/lib/fleet/transferCostCalculator";

// ─── Types ───

interface TransferOnlineForm {
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
  // 비용 계산용
  region: string;
  isElectric: boolean;
  isHybrid: boolean;
  isDisabled: boolean;
  isMultiChild: boolean;
  isFirstCar: boolean;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  category: "transfer_cert" | "seal_cert" | "id_copy" | "registration_copy" | "other";
}

interface SubmitResult {
  requestId: string;
  requestNumber: string;
  status: string;
  estimatedCost: number;
}

const EMPTY_FORM: TransferOnlineForm = {
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
  region: "서울",
  isElectric: false,
  isHybrid: false,
  isDisabled: false,
  isMultiChild: false,
  isFirstCar: false,
};

const VEHICLE_TYPE_OPTIONS = [
  { value: "sedan", label: "승용차" },
  { value: "suv", label: "SUV/RV" },
  { value: "van", label: "승합차" },
  { value: "truck", label: "화물차" },
  { value: "bus", label: "버스" },
  { value: "special", label: "특수차" },
];

const TRANSFER_REASON_OPTIONS = [
  { value: "매매", label: "매매" },
  { value: "증여", label: "증여" },
  { value: "상속", label: "상속" },
  { value: "기타", label: "기타" },
];

const FILE_CATEGORIES: { value: UploadedFile["category"]; label: string; required: boolean }[] = [
  { value: "transfer_cert", label: "양도증명서", required: true },
  { value: "seal_cert", label: "인감증명서", required: true },
  { value: "id_copy", label: "신분증 사본", required: true },
  { value: "registration_copy", label: "차량등록증 사본", required: false },
  { value: "other", label: "기타 서류", required: false },
];

const AGENCY_FEE = 16500; // 대행 수수료 (VAT 포함)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// ─── Helpers ───

function formatNumber(v: string): string {
  const num = v.replace(/[^\d]/g, "");
  if (!num) return "";
  return Number(num).toLocaleString();
}

function parseNumber(v: string): number {
  return Number(v.replace(/[^\d]/g, "")) || 0;
}

function formatWon(amount: number): string {
  if (amount >= 100_000_000) {
    const eok = Math.floor(amount / 100_000_000);
    const man = Math.floor((amount % 100_000_000) / 10_000);
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`;
  }
  if (amount >= 10_000) {
    const man = Math.floor(amount / 10_000);
    return `${man.toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// ─── Step Configuration ───

const STEPS = [
  { id: 1, label: "서비스 안내", icon: "info" },
  { id: 2, label: "정보 입력", icon: "edit" },
  { id: 3, label: "비용 확인", icon: "calculator" },
  { id: 4, label: "서류 첨부", icon: "upload" },
  { id: 5, label: "접수 완료", icon: "check" },
];

// ─── Main Page ───

export default function TransferOnlinePage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [form, setForm] = useState<TransferOnlineForm>(EMPTY_FORM);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [costResult, setCostResult] = useState<TransferCostResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Form updater ──
  const updateForm = useCallback((field: keyof TransferOnlineForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ── Calculate cost ──
  const calculateCost = useCallback(() => {
    const purchasePrice = parseNumber(form.salePrice);
    if (!purchasePrice || purchasePrice <= 0) return null;

    const input: TransferCostInput = {
      vehicleType: form.vehicleType as TransferCostInput["vehicleType"],
      purchasePrice,
      displacement: form.displacement ? Number(form.displacement) : undefined,
      region: form.region,
      transferType: "used",
      isCommercial: false,
      isElectric: form.isElectric,
      isHybrid: form.isHybrid && !form.isElectric,
      isDisabled: form.isDisabled,
      isMultiChild: form.isMultiChild,
      isFirstCar: form.isFirstCar,
    };

    try {
      return calculateTransferCost(input);
    } catch {
      return null;
    }
  }, [form]);

  // ── Step navigation ──
  const goToStep = useCallback((step: number) => {
    setError("");
    if (step === 3) {
      // Calculate cost when entering step 3
      const result = calculateCost();
      setCostResult(result);
    }
    setCurrentStep(step);
  }, [calculateCost]);

  const validateStep2 = (): boolean => {
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
    if (!form.salePrice || parseNumber(form.salePrice) <= 0) {
      setError("매매금액을 입력해주세요.");
      return false;
    }
    return true;
  };

  // ── File handlers ──
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>, category: UploadedFile["category"]) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      if (file.size > MAX_FILE_SIZE) {
        setError(`파일 "${file.name}"의 크기가 10MB를 초과합니다.`);
        continue;
      }
      newFiles.push({
        id: generateFileId(),
        name: file.name,
        size: file.size,
        type: file.type,
        category,
      });
    }

    setFiles((prev) => [...prev, ...newFiles]);
    if (e.target) e.target.value = "";
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  // ── Submit ──
  const handleSubmit = async () => {
    if (!agreedTerms) {
      setError("약관에 동의해주세요.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/fleet/transfer-online", {
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
          salePrice: parseNumber(form.salePrice),
          transferDate: form.transferDate,
          transferReason: form.transferReason,
          agentName: form.agentName,
          agentIdNumber: form.agentIdNumber,
          agentAddress: form.agentAddress,
          agentPhone: form.agentPhone,
          specialTerms: form.specialTerms,
          region: form.region,
          isElectric: form.isElectric,
          isHybrid: form.isHybrid,
          isDisabled: form.isDisabled,
          isMultiChild: form.isMultiChild,
          isFirstCar: form.isFirstCar,
          agencyFee: AGENCY_FEE,
          costBreakdown: costResult
            ? {
                acquisitionTax: costResult.acquisitionTax,
                registrationTax: costResult.registrationTax,
                educationTax: costResult.educationTax,
                specialTax: costResult.specialTax,
                bondDiscount: costResult.bondDiscount,
                stampTax: costResult.stampTax,
                totalCost: costResult.totalCost,
              }
            : undefined,
          attachedFiles: files.map((f) => ({
            name: f.name,
            size: f.size,
            type: f.type,
            category: f.category,
          })),
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error || "접수에 실패했습니다.");

      setSubmitResult(json.data);
      setCurrentStep(5);
    } catch (e) {
      setError(e instanceof Error ? e.message : "접수 실패");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Total estimated cost ──
  const totalEstimatedCost = useMemo(() => {
    return (costResult?.totalCost || 0) + AGENCY_FEE;
  }, [costResult]);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">온라인 이전등록 대행</h1>
        <p className="text-sm text-gray-500 mt-1">
          자동차 명의이전을 온라인으로 신청하세요. 전문 행정사가 대행합니다.
        </p>
      </div>

      {/* ── Step Indicator ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          {STEPS.map((step, idx) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    currentStep > step.id
                      ? "bg-blue-600 text-white"
                      : currentStep === step.id
                      ? "bg-blue-600 text-white ring-4 ring-blue-100"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {currentStep > step.id ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={`text-xs mt-1.5 font-medium whitespace-nowrap ${
                    currentStep >= step.id ? "text-blue-600" : "text-gray-400"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-3 mt-[-16px] ${
                    currentStep > step.id ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700 text-xs underline ml-3">
            닫기
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* STEP 1: 서비스 안내                              */}
      {/* ═══════════════════════════════════════════════ */}
      {currentStep === 1 && (
        <div className="space-y-5">
          {/* 서비스 소개 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H21M3.375 14.25h.008M21 14.25h-2.625m0 0h-2.25m4.875 0V7.5a1.125 1.125 0 0 0-1.125-1.125H5.25A1.125 1.125 0 0 0 4.125 7.5v6.75" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">온라인 자동차 이전등록 대행 서비스</h2>
                <p className="text-sm text-gray-600 mt-1">
                  차량 명의이전을 방문 없이 온라인으로 신청하세요. 전문 행정사가 접수부터 완료까지 대행합니다.
                </p>
              </div>
            </div>
          </div>

          {/* 핵심 정보 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-green-50 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-gray-900">16,500<span className="text-sm font-normal">원</span></p>
              <p className="text-xs text-gray-500 mt-1">대행 수수료 (VAT 포함)</p>
              <p className="text-xs text-gray-400 mt-0.5">전 차종 동일</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-blue-50 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-gray-900">1~3<span className="text-sm font-normal">영업일</span></p>
              <p className="text-xs text-gray-500 mt-1">처리 기간</p>
              <p className="text-xs text-gray-400 mt-0.5">접수 완료 후 기준</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 text-center">
              <div className="w-10 h-10 mx-auto rounded-full bg-purple-50 flex items-center justify-center mb-3">
                <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-gray-900">100<span className="text-sm font-normal">%</span></p>
              <p className="text-xs text-gray-500 mt-1">전문 행정사 처리</p>
              <p className="text-xs text-gray-400 mt-0.5">안전한 대행</p>
            </div>
          </div>

          {/* 필요 서류 안내 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              필요 서류
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "양도증명서", desc: "양도인/양수인 인감 날인", required: true },
                { label: "인감증명서", desc: "양도인 인감증명서 (3개월 이내 발급)", required: true },
                { label: "신분증 사본", desc: "양도인/양수인 신분증 사본", required: true },
                { label: "차량등록증 사본", desc: "현재 차량 등록증", required: false },
              ].map((doc) => (
                <div
                  key={doc.label}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${doc.required ? "bg-red-100" : "bg-gray-200"}`}>
                    {doc.required ? (
                      <svg className="w-3 h-3 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {doc.label}
                      {doc.required && <span className="text-red-500 ml-1">*</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{doc.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 예외 안내 */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              <div>
                <h4 className="text-sm font-semibold text-amber-800">온라인 대행 불가 차량</h4>
                <p className="text-xs text-amber-700 mt-1">
                  아래 차량은 온라인 대행이 불가하며, 전문가 연결이 필요합니다.
                </p>
                <ul className="mt-2 space-y-1 text-xs text-amber-700">
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                    지게차 (건설기계) - 건설기계관리법 적용
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                    수출말소 차량
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-500 flex-shrink-0" />
                    영업용 차량 (노란색 번호판)
                  </li>
                </ul>
                <div className="mt-3 p-3 bg-white/60 rounded-lg">
                  <p className="text-xs font-semibold text-amber-800">전문가 연결</p>
                  <p className="text-xs text-amber-700 mt-1">
                    행정사합동사무소 정의
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-amber-600">
                    <span>070-8657-1888</span>
                    <span>Lawyeom@naver.com</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 신청하기 버튼 */}
          <button
            onClick={() => goToStep(2)}
            className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-2"
          >
            신청하기
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* STEP 2: 차량/당사자 정보 입력                     */}
      {/* ═══════════════════════════════════════════════ */}
      {currentStep === 2 && (
        <div className="space-y-5">
          {/* 양도인 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              양도인 (매도인) 정보
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="성명" required value={form.sellerName} onChange={(v) => updateForm("sellerName", v)} placeholder="홍길동" />
              <InputField label="주민등록번호" value={form.sellerIdNumber} onChange={(v) => updateForm("sellerIdNumber", v)} placeholder="000000-0000000" />
              <InputField label="주소" colSpan2 value={form.sellerAddress} onChange={(v) => updateForm("sellerAddress", v)} placeholder="서울특별시 강남구 테헤란로 123" />
              <InputField label="전화번호" value={form.sellerPhone} onChange={(v) => updateForm("sellerPhone", v)} placeholder="010-1234-5678" />
            </div>
          </div>

          {/* 양수인 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              양수인 (매수인) 정보
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="성명 / 법인명" required value={form.buyerName} onChange={(v) => updateForm("buyerName", v)} placeholder="(주)어드미니" />
              <InputField label="주민등록번호 / 사업자번호" value={form.buyerIdNumber} onChange={(v) => updateForm("buyerIdNumber", v)} placeholder="000-00-00000" />
              <InputField label="주소" colSpan2 value={form.buyerAddress} onChange={(v) => updateForm("buyerAddress", v)} placeholder="서울특별시 서초구 서초대로 456" />
              <InputField label="전화번호" value={form.buyerPhone} onChange={(v) => updateForm("buyerPhone", v)} placeholder="010-9876-5432" />
            </div>
          </div>

          {/* 차량 정보 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0H21M3.375 14.25h.008M21 14.25h-2.625m0 0h-2.25m4.875 0V7.5a1.125 1.125 0 0 0-1.125-1.125H5.25A1.125 1.125 0 0 0 4.125 7.5v6.75" />
              </svg>
              차량 정보
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="차명" required value={form.vehicleName} onChange={(v) => updateForm("vehicleName", v)} placeholder="현대 아반떼 CN7" />
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
              <InputField label="차대번호" value={form.vin} onChange={(v) => updateForm("vin", v)} placeholder="KMHD341ABNU123456" mono />
              <InputField label="등록번호" value={form.plateNumber} onChange={(v) => updateForm("plateNumber", v)} placeholder="12가 3456" />
              <InputField label="연식" value={form.modelYear} onChange={(v) => updateForm("modelYear", v)} placeholder="2024" type="number" />
              <InputField label="배기량 (cc)" value={form.displacement} onChange={(v) => updateForm("displacement", v)} placeholder="1598" type="number" />
              <InputField label="색상" value={form.color} onChange={(v) => updateForm("color", v)} placeholder="흰색" />
              <InputField
                label="주행거리 (km)"
                value={form.mileage}
                onChange={(v) => updateForm("mileage", formatNumber(v))}
                placeholder="45,000"
                mono
              />
            </div>
          </div>

          {/* 거래 정보 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
              거래 정보
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  매매금액 (원) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.salePrice}
                  onChange={(e) => updateForm("salePrice", formatNumber(e.target.value))}
                  placeholder="15,000,000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
                />
                {form.salePrice && (
                  <p className="text-xs text-gray-400 mt-1">
                    {formatWon(parseNumber(form.salePrice))}
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

          {/* 비용 계산 옵션 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 15.75V18m-7.5-6.75h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V13.5Zm0 2.25h.008v.008H8.25v-.008Zm0 2.25h.008v.008H8.25V18Zm2.498-6.75h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V13.5Zm0 2.25h.007v.008h-.007v-.008Zm0 2.25h.007v.008h-.007V18Zm2.504-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5Zm0 2.25h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V18Zm2.498-6.75h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V13.5ZM8.25 6h7.5v2.25h-7.5V6ZM12 2.25c-1.892 0-3.758.11-5.593.322C5.307 2.7 4.5 3.65 4.5 4.757V19.5a2.25 2.25 0 0 0 2.25 2.25h10.5a2.25 2.25 0 0 0 2.25-2.25V4.757c0-1.108-.806-2.057-1.907-2.185A48.507 48.507 0 0 0 12 2.25Z" />
              </svg>
              취등록세 계산 옵션
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">등록 지역</label>
                <select
                  value={form.region}
                  onChange={(e) => updateForm("region", e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                >
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">공채매입 비율이 지역별로 상이합니다</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ToggleOption
                checked={form.isElectric}
                onChange={(v) => {
                  updateForm("isElectric", v);
                  if (v) updateForm("isHybrid", false);
                }}
                label="전기차"
                description="취득세 최대 140만원 감면"
              />
              <ToggleOption
                checked={form.isHybrid}
                onChange={(v) => {
                  updateForm("isHybrid", v);
                  if (v) updateForm("isElectric", false);
                }}
                label="하이브리드"
                description="취득세 최대 40만원 감면"
                disabled={form.isElectric}
              />
              <ToggleOption
                checked={form.isDisabled}
                onChange={(v) => updateForm("isDisabled", v)}
                label="장애인 감면"
                description="취득세 전액 면제"
              />
              <ToggleOption
                checked={form.isMultiChild}
                onChange={(v) => updateForm("isMultiChild", v)}
                label="다자녀 감면 (3자녀 이상)"
                description="취득세 50% 감면 (최대 140만원)"
                disabled={form.isDisabled}
              />
              <ToggleOption
                checked={form.isFirstCar}
                onChange={(v) => updateForm("isFirstCar", v)}
                label="생애최초 차량"
                description="취득가 4천만원 이하 승용차"
                disabled={form.isDisabled}
              />
            </div>
          </div>

          {/* 대리인 정보 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
              </svg>
              대리인 정보 (위임장용)
            </h2>
            <p className="text-xs text-gray-400 mb-4">위임장 작성 시 필요합니다. 비워두면 행정사 정보가 자동 입력됩니다.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="성명" value={form.agentName} onChange={(v) => updateForm("agentName", v)} placeholder="대리인 성명" />
              <InputField label="주민등록번호" value={form.agentIdNumber} onChange={(v) => updateForm("agentIdNumber", v)} placeholder="000000-0000000" />
              <InputField label="주소" colSpan2 value={form.agentAddress} onChange={(v) => updateForm("agentAddress", v)} placeholder="대리인 주소" />
              <InputField label="전화번호" value={form.agentPhone} onChange={(v) => updateForm("agentPhone", v)} placeholder="010-0000-0000" />
            </div>
          </div>

          {/* 특약사항 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
              </svg>
              특약사항
            </h2>
            <textarea
              value={form.specialTerms}
              onChange={(e) => updateForm("specialTerms", e.target.value)}
              placeholder="특약사항을 입력하세요 (선택)"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            />
          </div>

          {/* 네비게이션 */}
          <div className="flex gap-3">
            <button
              onClick={() => goToStep(1)}
              className="px-6 py-3 bg-gray-100 text-gray-600 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              이전
            </button>
            <button
              onClick={() => {
                if (validateStep2()) goToStep(3);
              }}
              className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-1.5"
            >
              비용 확인
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* STEP 3: 비용 확인                                */}
      {/* ═══════════════════════════════════════════════ */}
      {currentStep === 3 && (
        <div className="space-y-5">
          {/* 입력 정보 요약 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">입력 정보 요약</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">양도인</span>
                <span className="text-gray-900 font-medium">{form.sellerName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">양수인</span>
                <span className="text-gray-900 font-medium">{form.buyerName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">차명</span>
                <span className="text-gray-900 font-medium">{form.vehicleName}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">차종</span>
                <span className="text-gray-900 font-medium">
                  {VEHICLE_TYPE_OPTIONS.find((o) => o.value === form.vehicleType)?.label || form.vehicleType}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">등록번호</span>
                <span className="text-gray-900 font-medium">{form.plateNumber || "-"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">매매금액</span>
                <span className="text-gray-900 font-medium font-mono">{form.salePrice ? parseNumber(form.salePrice).toLocaleString() + "원" : "-"}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">등록 지역</span>
                <span className="text-gray-900 font-medium">{form.region}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-gray-100">
                <span className="text-gray-500">이전사유</span>
                <span className="text-gray-900 font-medium">{form.transferReason}</span>
              </div>
            </div>
          </div>

          {/* 비용 상세 */}
          {costResult ? (
            <>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-base font-semibold text-gray-900">취등록세 상세 내역</h2>
                  <p className="text-xs text-gray-500 mt-0.5">2026년 기준 자동 계산 (참고용)</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {costResult.breakdown.map((item, i) => (
                    <div key={i} className="flex items-start justify-between px-6 py-3 text-sm">
                      <div>
                        <span className="text-gray-700 font-medium">{item.label}</span>
                        {item.note && <p className="text-xs text-gray-400 mt-0.5">{item.note}</p>}
                      </div>
                      <span className="font-mono text-gray-900 whitespace-nowrap ml-4">
                        {item.amount.toLocaleString()}원
                      </span>
                    </div>
                  ))}
                </div>
                {/* 세금 소계 */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">세금 소계</span>
                  <span className="text-sm font-semibold font-mono text-gray-900">
                    {costResult.totalCost.toLocaleString()}원
                  </span>
                </div>
              </div>

              {/* 감면 내역 */}
              {costResult.discounts.length > 0 && (
                <div className="bg-green-50 rounded-xl border border-green-200 overflow-hidden">
                  <div className="px-6 py-3 bg-green-100/50 border-b border-green-200">
                    <h3 className="text-sm font-semibold text-green-800">감면 내역</h3>
                  </div>
                  <div className="divide-y divide-green-100">
                    {costResult.discounts.map((d, i) => (
                      <div key={i} className="flex items-center justify-between px-6 py-3 text-sm">
                        <span className="text-green-700">{d.name}</span>
                        <span className="font-mono text-green-800 font-semibold">
                          -{d.amount.toLocaleString()}원
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
              매매금액 또는 차량 정보가 부족하여 취등록세를 계산할 수 없습니다. 이전 단계에서 정보를 입력해주세요.
            </div>
          )}

          {/* 대행 수수료 + 합계 */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-200">취등록세 합계</span>
                <span className="font-mono font-semibold">
                  {costResult ? costResult.totalCost.toLocaleString() : "-"}원
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-200">대행 수수료 (VAT 포함)</span>
                <span className="font-mono font-semibold">{AGENCY_FEE.toLocaleString()}원</span>
              </div>
              <div className="border-t border-blue-500/40 pt-3 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-blue-100 font-medium">총 예상 비용</span>
                  <span className="text-2xl font-bold font-mono">
                    {totalEstimatedCost.toLocaleString()}
                    <span className="text-sm font-normal ml-1">원</span>
                  </span>
                </div>
                {costResult && (
                  <p className="text-xs text-blue-300 mt-1 text-right">{formatWon(totalEstimatedCost)}</p>
                )}
              </div>
            </div>
          </div>

          {/* 안내 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-xs text-yellow-700 space-y-1">
            <p className="font-semibold text-yellow-800">참고 사항</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>세금 금액은 2026년 기준 참고용이며, 실제 금액과 차이가 있을 수 있습니다.</li>
              <li>대행 수수료는 접수 후 안내되는 계좌로 별도 입금해주세요.</li>
              <li>취등록세는 관할 관청에서 직접 납부하거나, 대행사에서 안내드립니다.</li>
            </ul>
          </div>

          {/* 네비게이션 */}
          <div className="flex gap-3">
            <button
              onClick={() => goToStep(2)}
              className="px-6 py-3 bg-gray-100 text-gray-600 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              이전
            </button>
            <button
              onClick={() => goToStep(4)}
              className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-1.5"
            >
              서류 첨부
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* STEP 4: 서류 첨부 & 접수                         */}
      {/* ═══════════════════════════════════════════════ */}
      {currentStep === 4 && (
        <div className="space-y-5">
          {/* 서류 첨부 */}
          {FILE_CATEGORIES.map((cat) => {
            const catFiles = files.filter((f) => f.category === cat.value);
            return (
              <div key={cat.value} className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                    {cat.required ? (
                      <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs font-bold flex-shrink-0">!</span>
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs flex-shrink-0">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </span>
                    )}
                    {cat.label}
                    {cat.required && <span className="text-red-500 text-xs">(필수)</span>}
                  </h3>
                  {cat.value === "transfer_cert" && (
                    <a
                      href="/fleet/transfer-documents"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      양도증명서 PDF 생성
                    </a>
                  )}
                </div>

                {/* 첨부된 파일 */}
                {catFiles.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {catFiles.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                          </svg>
                          <span className="text-sm text-gray-700 truncate">{f.name}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(f.size)}</span>
                        </div>
                        <button
                          onClick={() => removeFile(f.id)}
                          className="text-gray-400 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* 업로드 버튼 */}
                <label className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                  </svg>
                  <span className="text-sm text-gray-500">파일 선택 또는 드래그 (최대 10MB)</span>
                  <input
                    ref={cat.value === "other" ? fileInputRef : undefined}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.tiff,.bmp"
                    multiple
                    onChange={(e) => handleFileSelect(e, cat.value)}
                  />
                </label>
              </div>
            );
          })}

          {/* 약관 동의 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  개인정보 수집/이용 동의 및 서비스 이용약관에 동의합니다
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  입력하신 정보는 이전등록 대행 업무에만 사용되며, 업무 완료 후 30일 이내에 파기됩니다.
                  주민등록번호 등 민감정보는 암호화하여 처리합니다.
                </p>
              </div>
            </label>
          </div>

          {/* 네비게이션 */}
          <div className="flex gap-3">
            <button
              onClick={() => goToStep(3)}
              className="px-6 py-3 bg-gray-100 text-gray-600 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
              </svg>
              이전
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  접수 중...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                  대행 접수
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════ */}
      {/* STEP 5: 접수 완료                                */}
      {/* ═══════════════════════════════════════════════ */}
      {currentStep === 5 && submitResult && (
        <div className="space-y-5">
          {/* 완료 메시지 */}
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 mx-auto bg-green-50 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">접수가 완료되었습니다</h2>
            <p className="text-sm text-gray-500 mt-2">
              전문 행정사가 서류를 확인한 후 이전등록을 진행합니다.
            </p>
          </div>

          {/* 접수 정보 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">접수 정보</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">접수번호</span>
                <span className="text-sm font-bold text-blue-600 font-mono">{submitResult.requestNumber}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">접수 상태</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {submitResult.status === "requested" ? "접수완료" : submitResult.status}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">총 예상 비용</span>
                <span className="text-sm font-semibold text-gray-900 font-mono">
                  {submitResult.estimatedCost.toLocaleString()}원
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">양도인</span>
                <span className="text-sm text-gray-900">{form.sellerName}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">양수인</span>
                <span className="text-sm text-gray-900">{form.buyerName}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-500">차량</span>
                <span className="text-sm text-gray-900">{form.vehicleName} ({form.plateNumber || "-"})</span>
              </div>
            </div>
          </div>

          {/* 진행 상태 타임라인 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-5">처리 진행 상태</h3>
            <div className="relative">
              {[
                { step: "접수완료", desc: "신청이 접수되었습니다", active: true, completed: true },
                { step: "서류확인", desc: "첨부 서류를 확인합니다", active: false, completed: false },
                { step: "처리중", desc: "이전등록을 진행합니다", active: false, completed: false },
                { step: "완료", desc: "이전등록이 완료되었습니다", active: false, completed: false },
              ].map((item, idx, arr) => (
                <div key={item.step} className="flex items-start gap-4 mb-0 last:mb-0">
                  {/* Timeline dot & line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        item.completed
                          ? "bg-blue-600 text-white"
                          : item.active
                          ? "bg-blue-100 text-blue-600 ring-4 ring-blue-50"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {item.completed ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      ) : (
                        <span className="text-xs font-semibold">{idx + 1}</span>
                      )}
                    </div>
                    {idx < arr.length - 1 && (
                      <div
                        className={`w-0.5 h-8 ${
                          item.completed ? "bg-blue-600" : "bg-gray-200"
                        }`}
                      />
                    )}
                  </div>
                  {/* Content */}
                  <div className="pb-6">
                    <p className={`text-sm font-semibold ${item.completed || item.active ? "text-gray-900" : "text-gray-400"}`}>
                      {item.step}
                    </p>
                    <p className={`text-xs mt-0.5 ${item.completed || item.active ? "text-gray-500" : "text-gray-300"}`}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 안내사항 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">안내사항</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs text-blue-700">
              <li>접수 후 1~3영업일 이내에 처리가 완료됩니다.</li>
              <li>서류에 문제가 있을 경우 담당자가 연락드립니다.</li>
              <li>대행 수수료와 취등록세 납부 안내는 별도로 안내됩니다.</li>
              <li>문의: 행정사합동사무소 정의 / 070-8657-1888</li>
            </ul>
          </div>

          {/* 액션 */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setForm(EMPTY_FORM);
                setFiles([]);
                setAgreedTerms(false);
                setCostResult(null);
                setSubmitResult(null);
                setCurrentStep(1);
              }}
              className="flex-1 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              새 신청
            </button>
            <a
              href="/fleet"
              className="flex-1 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors text-sm flex items-center justify-center gap-1.5"
            >
              차량 관리로 이동
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reusable Components ───

function InputField({
  label,
  value,
  onChange,
  placeholder,
  required,
  colSpan2,
  type,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  colSpan2?: boolean;
  type?: string;
  mono?: boolean;
}) {
  return (
    <div className={colSpan2 ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type || "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none ${mono ? "font-mono" : ""}`}
      />
    </div>
  );
}

function ToggleOption({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
        disabled
          ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
          : checked
          ? "border-blue-200 bg-blue-50"
          : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
      />
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
    </label>
  );
}
