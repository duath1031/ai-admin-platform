"use client";

import { useState, useEffect, useRef } from "react";
import ClientSelector from "@/components/common/ClientSelector";
import { useClientStore } from "@/lib/store";

// ─── Types ───

type ApplicationType =
  | "business_registration"
  | "food_business"
  | "construction_permit"
  | "manufacturing_permit"
  | "environment_permit"
  | "fire_safety"
  | "medical_business"
  | "general";

interface FormData {
  applicationType: ApplicationType | "";
  applicantName: string;
  companyName: string;
  bizRegNo: string;
  applicantAddress: string;
  businessDetails: string;
  applicationReason: string;
  additionalInfo: string;
}

interface ApiResponse {
  success: boolean;
  content: string;
  metadata: {
    applicationType: string;
    typeLabel: string;
    generatedAt: string;
    relatedLaws: string[];
  };
}

const INITIAL_FORM: FormData = {
  applicationType: "",
  applicantName: "",
  companyName: "",
  bizRegNo: "",
  applicantAddress: "",
  businessDetails: "",
  applicationReason: "",
  additionalInfo: "",
};

// ─── Application Type Definitions ───

const APPLICATION_TYPE_OPTIONS: {
  value: ApplicationType;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    value: "business_registration",
    label: "사업자등록 신청/변경",
    shortLabel: "사업자등록",
    description: "신규 사업자등록 또는 정정 신고",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    value: "food_business",
    label: "식품영업 허가/신고",
    shortLabel: "식품영업",
    description: "식품제조, 식품접객업 등 영업허가",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-2.21 0-4 1.79-4 4h8c0-2.21-1.79-4-4-4zm-6 6h12v1a5 5 0 01-5 5h-2a5 5 0 01-5-5v-1zm6-10V2m4.5 2.5L15 6m-7.5-1.5L9 6" />
      </svg>
    ),
  },
  {
    value: "construction_permit",
    label: "건설업 등록/변경",
    shortLabel: "건설업",
    description: "건설업 등록, 변경 신고",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
      </svg>
    ),
  },
  {
    value: "manufacturing_permit",
    label: "제조업 등록/인가",
    shortLabel: "제조업",
    description: "공장설립, 제조업 관련 등록",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  {
    value: "environment_permit",
    label: "환경 관련 인허가",
    shortLabel: "환경",
    description: "배출시설, 환경영향평가 등",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
      </svg>
    ),
  },
  {
    value: "fire_safety",
    label: "소방시설 관련",
    shortLabel: "소방시설",
    description: "소방시설 설치, 안전관리",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1.001A3.75 3.75 0 0012 18z" />
      </svg>
    ),
  },
  {
    value: "medical_business",
    label: "의료기기/의약품 관련",
    shortLabel: "의료기기",
    description: "의료기기 제조/수입/판매 인허가",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  {
    value: "general",
    label: "기타 일반 인허가",
    shortLabel: "기타",
    description: "위 카테고리 외 일반 인허가",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
];

// ─── Informational items per type (for empty state) ───

const TYPE_GUIDE: Record<ApplicationType, string[]> = {
  business_registration: [
    "개인/법인 사업자등록 신규 신청",
    "사업장 이전, 업종 추가/변경 등 정정",
    "공동사업자 등록, 간이과세자 전환",
  ],
  food_business: [
    "일반음식점, 휴게음식점 영업신고",
    "식품제조가공업 영업허가",
    "즉석판매제조가공업 신고",
  ],
  construction_permit: [
    "종합건설업, 전문건설업 신규 등록",
    "실적신고, 기술자 변경 신고",
    "건설업 양도/합병 인가",
  ],
  manufacturing_permit: [
    "공장등록 및 공장설립 승인",
    "제조시설 변경 신고",
    "위험물제조소 설치 허가",
  ],
  environment_permit: [
    "대기/수질 배출시설 설치 허가",
    "환경영향평가서 제출",
    "폐기물처리업 허가",
  ],
  fire_safety: [
    "소방시설공사업 등록",
    "소방안전관리자 선임 신고",
    "다중이용업소 안전시설 완비 증명",
  ],
  medical_business: [
    "의료기기 제조/수입업 허가",
    "의약품 도매/소매업 허가",
    "체외진단의료기기 제조 신고",
  ],
  general: [
    "각종 행정기관 인허가 신청",
    "영업 신고/등록/허가 민원",
    "기타 행정절차법상 처분 신청",
  ],
};

// ─── Main Page ───

export default function ApplicationFormPage() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const { selectedClient } = useClientStore();

  // Auto-fill from selected client
  useEffect(() => {
    if (selectedClient) {
      setForm((prev) => ({
        ...prev,
        applicantName: selectedClient.ownerName || prev.applicantName,
        companyName: selectedClient.companyName || prev.companyName,
        bizRegNo: selectedClient.bizRegNo || prev.bizRegNo,
        applicantAddress: selectedClient.address || prev.applicantAddress,
      }));
    }
  }, [selectedClient]);

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleTypeSelect = (type: ApplicationType) => {
    setForm((prev) => ({ ...prev, applicationType: type }));
    if (error) setError("");
  };

  const handleSubmit = async () => {
    if (!form.applicationType) {
      setError("인허가 유형을 선택해주세요.");
      return;
    }
    if (!form.applicantName.trim()) {
      setError("신청인(대표자) 이름을 입력해주세요.");
      return;
    }
    if (!form.companyName.trim()) {
      setError("회사명을 입력해주세요.");
      return;
    }
    if (!form.applicationReason.trim()) {
      setError("신청 사유를 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/labor/application-form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationType: form.applicationType,
          applicantName: form.applicantName,
          applicantAddress: form.applicantAddress || undefined,
          bizRegNo: form.bizRegNo || undefined,
          companyName: form.companyName,
          businessDetails: form.businessDetails || undefined,
          applicationReason: form.applicationReason,
          additionalInfo: form.additionalInfo || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `서버 오류 (${res.status})`);
      }

      const data: ApiResponse = await res.json();
      if (!data.success || !data.content) {
        throw new Error("인허가 신청서 생성에 실패했습니다.");
      }

      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = result.content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    if (!result) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const today = new Date();
    const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    const formattedContent = result.content
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^### (.*$)/gm, '<h3 style="font-size:14px;font-weight:bold;margin:14px 0 6px;">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 style="font-size:16px;font-weight:bold;margin:18px 0 8px;">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 style="font-size:18px;font-weight:bold;margin:22px 0 10px;">$1</h1>')
      .replace(/\n/g, "<br>");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <title>${result.metadata.typeLabel} - 인허가 신청서</title>
        <style>
          @page {
            size: A4;
            margin: 20mm 18mm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Batang', 'Nanum Myeongjo', serif;
            font-size: 13px;
            line-height: 1.8;
            color: #000;
            background: #fff;
          }
          .document {
            max-width: 700px;
            margin: 0 auto;
            padding: 30px 0;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 12px;
            border-bottom: 2px solid #000;
          }
          .header h1 {
            font-size: 22px;
            font-weight: bold;
            letter-spacing: 10px;
          }
          .header .subtitle {
            font-size: 12px;
            color: #555;
            margin-top: 4px;
          }
          .content {
            text-align: justify;
            word-break: keep-all;
          }
          .laws-section {
            margin-top: 30px;
            padding-top: 16px;
            border-top: 1px solid #ccc;
          }
          .laws-section h3 {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 8px;
          }
          .laws-section ul {
            list-style: disc;
            padding-left: 20px;
          }
          .laws-section li {
            font-size: 12px;
            margin-bottom: 3px;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
          }
          .date-line {
            margin-bottom: 20px;
            text-align: center;
            font-size: 13px;
          }
          .applicant-line {
            text-align: center;
            font-size: 14px;
            font-weight: bold;
          }
          .seal-text {
            display: inline-block;
            margin-left: 16px;
            font-size: 12px;
            color: #666;
          }
          .branding {
            margin-top: 30px;
            text-align: center;
            font-size: 10px;
            color: #999;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <div class="document">
          <div class="header">
            <h1>${result.metadata.typeLabel}</h1>
            <div class="subtitle">인허가 신청서</div>
          </div>

          <div class="content">
            ${formattedContent}
          </div>

          <div class="laws-section">
            <h3>관련 법령</h3>
            <ul>
              ${result.metadata.relatedLaws.map((law) => `<li>${law}</li>`).join("")}
            </ul>
          </div>

          <div class="footer">
            <div class="date-line">${dateStr}</div>
            <div class="applicant-line">
              신청인: ${form.applicantName} <span class="seal-text">(인)</span>
            </div>
          </div>

          <div class="branding">
            어드미니(Admini) | aiadminplatform.vercel.app
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleReset = () => {
    setResult(null);
    setError("");
  };

  const selectedTypeInfo = APPLICATION_TYPE_OPTIONS.find(
    (opt) => opt.value === form.applicationType
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">인허가 신청서 AI</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  AI어드미니가 인허가 유형에 맞는 공식 신청서를 작성합니다
                </p>
              </div>
            </div>
            <ClientSelector />
          </div>
        </div>
      </div>

      {/* Type Selection Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            인허가 유형 선택
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {APPLICATION_TYPE_OPTIONS.map((opt) => {
              const isSelected = form.applicationType === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleTypeSelect(opt.value)}
                  className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? "border-teal-500 bg-teal-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-teal-300 hover:bg-teal-50/30"
                  }`}
                >
                  <div
                    className={`flex-shrink-0 mt-0.5 ${
                      isSelected ? "text-teal-600" : "text-gray-400"
                    }`}
                  >
                    {opt.icon}
                  </div>
                  <div className="min-w-0">
                    <div
                      className={`text-sm font-semibold ${
                        isSelected ? "text-teal-800" : "text-gray-700"
                      }`}
                    >
                      {opt.shortLabel}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                      {opt.description}
                    </div>
                  </div>
                  {isSelected && (
                    <svg className="w-4 h-4 text-teal-600 flex-shrink-0 mt-0.5 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ─── Left Panel: Input Form ─── */}
          <div className="space-y-5 print:hidden">
            {/* 선택된 인허가 유형 표시 */}
            {selectedTypeInfo && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 flex items-center gap-3">
                <div className="text-teal-600 flex-shrink-0">{selectedTypeInfo.icon}</div>
                <div>
                  <div className="text-sm font-semibold text-teal-800">{selectedTypeInfo.label}</div>
                  <div className="text-xs text-teal-600">{selectedTypeInfo.description}</div>
                </div>
                <span className="ml-auto text-xs bg-teal-200 text-teal-800 px-2 py-0.5 rounded-full font-medium">
                  선택됨
                </span>
              </div>
            )}

            {/* 신청인 정보 */}
            <SectionCard title="신청인 정보" icon={applicantIcon}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="신청인(대표자) 이름"
                  value={form.applicantName}
                  onChange={(v) => handleChange("applicantName", v)}
                  placeholder="홍길동"
                  required
                />
                <InputField
                  label="회사명(상호)"
                  value={form.companyName}
                  onChange={(v) => handleChange("companyName", v)}
                  placeholder="주식회사 OO"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <InputField
                  label="사업자등록번호"
                  value={form.bizRegNo}
                  onChange={(v) => handleChange("bizRegNo", v)}
                  placeholder="123-45-67890"
                />
                <InputField
                  label="주소"
                  value={form.applicantAddress}
                  onChange={(v) => handleChange("applicantAddress", v)}
                  placeholder="서울특별시 강남구..."
                />
              </div>
              {selectedClient && (
                <p className="text-xs text-teal-600 mt-3 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  거래처 &quot;{selectedClient.companyName}&quot; 정보가 자동 반영되었습니다.
                </p>
              )}
            </SectionCard>

            {/* 사업 및 신청 내용 */}
            <SectionCard title="사업 및 신청 내용" icon={businessIcon}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    사업 내용 상세
                  </label>
                  <textarea
                    value={form.businessDetails}
                    onChange={(e) => handleChange("businessDetails", e.target.value)}
                    placeholder={"사업의 구체적인 내용을 기술해주세요.\n\n예시:\n- 업종: 일반음식점\n- 영업 면적: 99.17m2 (30평)\n- 좌석수: 40석\n- 주요 메뉴: 한식(비빔밥, 찌개류)"}
                    rows={5}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    신청 사유 <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.applicationReason}
                    onChange={(e) => handleChange("applicationReason", e.target.value)}
                    placeholder={"인허가 신청 사유를 구체적으로 작성해주세요.\n\n예시:\n- 신규 음식점 개업을 위한 영업허가 신청\n- 사업장 이전에 따른 변경 신고\n- 업종 추가에 따른 등록 변경"}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    추가 참고사항
                  </label>
                  <textarea
                    value={form.additionalInfo}
                    onChange={(e) => handleChange("additionalInfo", e.target.value)}
                    placeholder="특이사항, 첨부할 서류 목록, 기타 참고 정보 등"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
                  />
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
              className="w-full py-3 px-4 bg-teal-600 text-white rounded-lg font-medium text-sm hover:bg-teal-700 disabled:bg-teal-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>AI어드미니가 인허가 신청서를 작성 중입니다...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>AI 신청서 생성</span>
                </>
              )}
            </button>
          </div>

          {/* ─── Right Panel: Preview / Result ─── */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            {result ? (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                {/* Preview Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      생성된 인허가 신청서
                    </h3>
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">
                      {result.metadata.typeLabel}
                    </span>
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      다시 생성
                    </button>
                  </div>
                </div>

                {/* Document Preview */}
                <div
                  ref={previewRef}
                  className="p-6 sm:p-8 max-h-[80vh] overflow-y-auto"
                >
                  <div className="bg-white border border-gray-300 rounded p-6 sm:p-8 shadow-inner font-serif text-[15px] leading-relaxed text-gray-800 whitespace-pre-wrap">
                    {result.content}
                  </div>

                  {/* 관련 법령 목록 */}
                  <div className="mt-4 p-4 bg-teal-50 border border-teal-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-teal-800 mb-2 flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                      관련 법령
                    </h4>
                    <ul className="space-y-1">
                      {result.metadata.relatedLaws.map((law, index) => (
                        <li
                          key={index}
                          className="text-xs text-teal-700 flex items-start gap-1.5"
                        >
                          <span className="text-teal-400 mt-0.5 flex-shrink-0">-</span>
                          <span>{law}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* 인쇄 시에만 보이는 어드미니 브랜딩 */}
                  <div className="hidden print:block text-center mt-8 pt-4 border-t border-gray-200">
                    <p className="text-[10px] text-gray-400">어드미니(Admini) | aiadminplatform.vercel.app</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
                  {isLoading ? (
                    <>
                      <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mb-4">
                        <svg className="animate-spin h-8 w-8 text-teal-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        AI어드미니가 인허가 신청서를 작성 중입니다...
                      </h3>
                      <p className="text-sm text-gray-500">
                        관련 법령을 검토하고 공식 양식을 구성하고 있습니다
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        인허가 신청서 미리보기
                      </h3>
                      <p className="text-sm text-gray-500 max-w-xs">
                        인허가 유형을 선택하고 양식을 작성한 후<br />
                        &quot;AI 신청서 생성&quot; 버튼을 클릭하면<br />
                        이곳에 생성된 신청서가 표시됩니다.
                      </p>

                      {/* 인허가 유형별 안내 */}
                      {form.applicationType ? (
                        <div className="mt-6 space-y-2 text-left w-full max-w-xs">
                          <p className="text-xs font-semibold text-teal-700 mb-1">
                            {selectedTypeInfo?.label} 주요 신청 사항:
                          </p>
                          {TYPE_GUIDE[form.applicationType as ApplicationType]?.map(
                            (item, idx) => (
                              <InfoBadge key={idx} text={item} />
                            )
                          )}
                        </div>
                      ) : (
                        <div className="mt-6 space-y-2 text-left w-full max-w-xs">
                          <InfoBadge text="8가지 인허가 유형 지원 (사업자등록, 식품, 건설, 제조 등)" />
                          <InfoBadge text="관련 법령 근거를 포함한 공식 신청서 양식" />
                          <InfoBadge text="A4 인쇄용 레이아웃 및 복사 기능" />
                          <InfoBadge text="거래처 선택 시 신청인 정보 자동 반영" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
      />
    </div>
  );
}

function InfoBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <svg className="w-4 h-4 text-teal-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

// ─── Icons ───

const applicantIcon = (
  <svg className="w-4 h-4 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const businessIcon = (
  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
