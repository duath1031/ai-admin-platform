"use client";

import { useState, useRef } from "react";
import {
  SW_CATEGORIES,
  PROGRAMMING_LANGUAGES,
  OPERATING_SYSTEMS,
  getRegistrationGuide,
  type ProgramInfo,
  type RegistrationStep,
} from "@/lib/copyright/copyrightHelper";

// ─── Types ───

type TabId = "info" | "code" | "description" | "guide";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

interface CodeProcessStats {
  totalLines: number;
  maskedCount: number;
  maskedItems: { label: string; count: number }[];
  extractedPages: number;
  extractedLines: number;
  sections: { label: string; startLine: number; endLine: number }[];
}

// ─── Tabs ───

const TABS: Tab[] = [
  {
    id: "info",
    label: "프로그램 정보",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: "code",
    label: "소스코드 전처리",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  {
    id: "description",
    label: "창작의도 기술서",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: "guide",
    label: "등록 절차 가이드",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
];

// ─── Initial Form State ───

const INITIAL_INFO: ProgramInfo = {
  programName: "",
  programNameEn: "",
  version: "1.0.0",
  creationDate: "",
  publicDate: "",
  programmingLanguages: [],
  operatingSystem: "",
  programSize: "",
  category: "",
  description: "",
  features: [""],
  techStack: [""],
  authorName: "",
  authorType: "corporation",
  companyName: "",
  bizRegNo: "",
};

// ─── Main Page ───

export default function CopyrightPage() {
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [programInfo, setProgramInfo] = useState<ProgramInfo>(INITIAL_INFO);

  // 소스코드 전처리 상태
  const [sourceCode, setSourceCode] = useState("");
  const [processedCode, setProcessedCode] = useState("");
  const [codeStats, setCodeStats] = useState<CodeProcessStats | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [codeError, setCodeError] = useState("");

  // 창작의도 기술서 상태
  const [creationDesc, setCreationDesc] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [descError, setDescError] = useState("");
  const [descCopied, setDescCopied] = useState(false);

  // 가이드 체크리스트
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());

  const descTextareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Handlers ───

  const handleInfoChange = (field: keyof ProgramInfo, value: unknown) => {
    setProgramInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleLanguageToggle = (lang: string) => {
    setProgramInfo((prev) => {
      const current = prev.programmingLanguages;
      if (current.includes(lang)) {
        return { ...prev, programmingLanguages: current.filter((l) => l !== lang) };
      }
      return { ...prev, programmingLanguages: [...current, lang] };
    });
  };

  const handleDynamicListChange = (
    field: "features" | "techStack",
    index: number,
    value: string
  ) => {
    setProgramInfo((prev) => {
      const list = [...(prev[field] || [])];
      list[index] = value;
      return { ...prev, [field]: list };
    });
  };

  const handleDynamicListAdd = (field: "features" | "techStack") => {
    setProgramInfo((prev) => ({
      ...prev,
      [field]: [...(prev[field] || []), ""],
    }));
  };

  const handleDynamicListRemove = (field: "features" | "techStack", index: number) => {
    setProgramInfo((prev) => {
      const list = [...(prev[field] || [])];
      if (list.length <= 1) return prev;
      list.splice(index, 1);
      return { ...prev, [field]: list };
    });
  };

  // 소스코드 전처리
  const handleProcessCode = async () => {
    if (!sourceCode.trim()) {
      setCodeError("소스코드를 입력해주세요.");
      return;
    }

    setIsProcessing(true);
    setCodeError("");
    setProcessedCode("");
    setCodeStats(null);

    try {
      const res = await fetch("/api/copyright/process-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceCode }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `서버 오류 (${res.status})`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "전처리에 실패했습니다.");
      }

      setProcessedCode(data.data.extractedCode);
      setCodeStats(data.data.stats);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 창작의도 기술서 AI 생성
  const handleGenerateDescription = async () => {
    if (!programInfo.programName.trim()) {
      setDescError("먼저 '프로그램 정보' 탭에서 프로그램명을 입력해주세요.");
      return;
    }
    if (!programInfo.description.trim()) {
      setDescError("먼저 '프로그램 정보' 탭에서 프로그램 설명을 입력해주세요.");
      return;
    }
    if (programInfo.features.filter((f) => f.trim()).length === 0) {
      setDescError("먼저 '프로그램 정보' 탭에서 주요 기능을 1개 이상 입력해주세요.");
      return;
    }

    setIsGenerating(true);
    setDescError("");

    try {
      const cleanedInfo = {
        ...programInfo,
        features: programInfo.features.filter((f) => f.trim()),
        techStack: (programInfo.techStack || []).filter((t) => t.trim()),
      };

      const res = await fetch("/api/copyright/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedInfo),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `서버 오류 (${res.status})`);
      }

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "기술서 생성에 실패했습니다.");
      }

      setCreationDesc(data.data.description);
    } catch (e) {
      setDescError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyDescription = async () => {
    try {
      await navigator.clipboard.writeText(creationDesc);
      setDescCopied(true);
      setTimeout(() => setDescCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = creationDesc;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setDescCopied(true);
      setTimeout(() => setDescCopied(false), 2000);
    }
  };

  const handleCopyProcessedCode = async () => {
    try {
      await navigator.clipboard.writeText(processedCode);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = processedCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
  };

  const handlePrintDescription = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>창작의도 기술서 - ${programInfo.programName}</title>
            <style>
              body { font-family: 'Malgun Gothic', sans-serif; padding: 40px; line-height: 1.8; }
              h1 { text-align: center; font-size: 18px; margin-bottom: 30px; }
              .content { white-space: pre-wrap; font-size: 14px; }
              .footer { text-align: center; margin-top: 40px; font-size: 10px; color: #999; }
            </style>
          </head>
          <body>
            <h1>프로그램 명세서 (창작의도 기술서)</h1>
            <div class="content">${creationDesc}</div>
            <div class="footer">Admini AI Platform | aiadminplatform.vercel.app</div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const toggleStepCheck = (step: number) => {
    setCheckedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  // ─── Render ───

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">SW 저작권 등록</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                소스코드 전처리, 창작의도 기술서 AI 작성, 한국저작권위원회 등록 가이드
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600"
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

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "info" && (
          <ProgramInfoTab
            info={programInfo}
            onChange={handleInfoChange}
            onLanguageToggle={handleLanguageToggle}
            onDynamicChange={handleDynamicListChange}
            onDynamicAdd={handleDynamicListAdd}
            onDynamicRemove={handleDynamicListRemove}
          />
        )}
        {activeTab === "code" && (
          <CodeProcessTab
            sourceCode={sourceCode}
            onSourceCodeChange={setSourceCode}
            processedCode={processedCode}
            stats={codeStats}
            isProcessing={isProcessing}
            error={codeError}
            onProcess={handleProcessCode}
            onCopy={handleCopyProcessedCode}
          />
        )}
        {activeTab === "description" && (
          <DescriptionTab
            description={creationDesc}
            onDescriptionChange={setCreationDesc}
            isGenerating={isGenerating}
            error={descError}
            copied={descCopied}
            onGenerate={handleGenerateDescription}
            onCopy={handleCopyDescription}
            onPrint={handlePrintDescription}
            textareaRef={descTextareaRef}
            programName={programInfo.programName}
          />
        )}
        {activeTab === "guide" && (
          <GuideTab
            checkedSteps={checkedSteps}
            onToggleStep={toggleStepCheck}
          />
        )}
      </div>
    </div>
  );
}

// ─── Tab 1: 프로그램 정보 입력 ───

function ProgramInfoTab({
  info,
  onChange,
  onLanguageToggle,
  onDynamicChange,
  onDynamicAdd,
  onDynamicRemove,
}: {
  info: ProgramInfo;
  onChange: (field: keyof ProgramInfo, value: unknown) => void;
  onLanguageToggle: (lang: string) => void;
  onDynamicChange: (field: "features" | "techStack", index: number, value: string) => void;
  onDynamicAdd: (field: "features" | "techStack") => void;
  onDynamicRemove: (field: "features" | "techStack", index: number) => void;
}) {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* 기본 정보 */}
      <SectionCard title="기본 정보" icon={infoIcon}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InputField
            label="프로그램명"
            value={info.programName}
            onChange={(v) => onChange("programName", v)}
            placeholder="AI 행정 플랫폼"
            required
          />
          <InputField
            label="영문명"
            value={info.programNameEn || ""}
            onChange={(v) => onChange("programNameEn", v)}
            placeholder="AI Admin Platform"
          />
          <InputField
            label="버전"
            value={info.version}
            onChange={(v) => onChange("version", v)}
            placeholder="1.0.0"
            required
          />
          <InputField
            label="프로그램 규모"
            value={info.programSize || ""}
            onChange={(v) => onChange("programSize", v)}
            placeholder="약 50,000줄 / 10MB"
          />
          <InputField
            label="창작일"
            type="date"
            value={info.creationDate}
            onChange={(v) => onChange("creationDate", v)}
            required
          />
          <InputField
            label="공표일"
            type="date"
            value={info.publicDate || ""}
            onChange={(v) => onChange("publicDate", v)}
          />
        </div>
      </SectionCard>

      {/* 분류 및 환경 */}
      <SectionCard title="분류 및 환경" icon={categoryIcon}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              분류 <span className="text-red-500">*</span>
            </label>
            <select
              value={info.category}
              onChange={(e) => onChange("category", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
            >
              <option value="">선택하세요</option>
              {SW_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              동작 OS <span className="text-red-500">*</span>
            </label>
            <select
              value={info.operatingSystem}
              onChange={(e) => onChange("operatingSystem", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
            >
              <option value="">선택하세요</option>
              {OPERATING_SYSTEMS.map((os) => (
                <option key={os} value={os}>{os}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 프로그래밍 언어 멀티 선택 */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            프로그래밍 언어 <span className="text-red-500">*</span>
            <span className="ml-2 text-xs text-gray-400 font-normal">
              ({info.programmingLanguages.length}개 선택됨)
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {PROGRAMMING_LANGUAGES.map((lang) => {
              const selected = info.programmingLanguages.includes(lang);
              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onLanguageToggle(lang)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    selected
                      ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {selected && (
                    <svg className="w-3 h-3 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {lang}
                </button>
              );
            })}
          </div>
        </div>
      </SectionCard>

      {/* 프로그램 설명 */}
      <SectionCard title="프로그램 설명" icon={descIcon}>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            간단 설명 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={info.description}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="프로그램의 목적, 기능, 특징을 간략하게 설명해주세요. 이 내용은 창작의도 기술서 작성에 활용됩니다."
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
          />
        </div>
      </SectionCard>

      {/* 주요 기능 */}
      <SectionCard title="주요 기능" icon={featuresIcon}>
        <DynamicList
          items={info.features}
          field="features"
          placeholder="예: 사용자 인증 및 권한 관리"
          onChange={onDynamicChange}
          onAdd={onDynamicAdd}
          onRemove={onDynamicRemove}
        />
      </SectionCard>

      {/* 기술 스택 */}
      <SectionCard title="기술 스택" icon={stackIcon}>
        <DynamicList
          items={info.techStack || [""]}
          field="techStack"
          placeholder="예: Next.js 14, PostgreSQL, Redis"
          onChange={onDynamicChange}
          onAdd={onDynamicAdd}
          onRemove={onDynamicRemove}
        />
      </SectionCard>

      {/* 저작자 정보 */}
      <SectionCard title="저작자 정보" icon={authorIcon}>
        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={info.authorType === "individual"}
                onChange={() => onChange("authorType", "individual")}
                className="w-4 h-4 text-indigo-600"
              />
              <span className="text-sm text-gray-700">개인</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={info.authorType === "corporation"}
                onChange={() => onChange("authorType", "corporation")}
                className="w-4 h-4 text-indigo-600"
              />
              <span className="text-sm text-gray-700">법인</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label={info.authorType === "individual" ? "저작자 성명" : "대표자 성명"}
              value={info.authorName}
              onChange={(v) => onChange("authorName", v)}
              placeholder="홍길동"
              required
            />
            {info.authorType === "corporation" && (
              <>
                <InputField
                  label="법인명"
                  value={info.companyName || ""}
                  onChange={(v) => onChange("companyName", v)}
                  placeholder="주식회사 어드미니"
                />
                <InputField
                  label="사업자등록번호"
                  value={info.bizRegNo || ""}
                  onChange={(v) => onChange("bizRegNo", v)}
                  placeholder="000-00-00000"
                />
              </>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Tab 2: 소스코드 전처리 ───

function CodeProcessTab({
  sourceCode,
  onSourceCodeChange,
  processedCode,
  stats,
  isProcessing,
  error,
  onProcess,
  onCopy,
}: {
  sourceCode: string;
  onSourceCodeChange: (v: string) => void;
  processedCode: string;
  stats: CodeProcessStats | null;
  isProcessing: boolean;
  error: string;
  onProcess: () => void;
  onCopy: () => void;
}) {
  const [codeCopied, setCodeCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 입력 영역 */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          <h2 className="text-sm font-semibold text-gray-900">소스코드 입력</h2>
          <span className="text-xs text-gray-400 ml-auto">
            {sourceCode.split("\n").length.toLocaleString()}줄 / {sourceCode.length.toLocaleString()}자
          </span>
        </div>
        <div className="p-5">
          <textarea
            value={sourceCode}
            onChange={(e) => onSourceCodeChange(e.target.value)}
            placeholder={"// 소스코드를 여기에 붙여넣으세요.\n// 여러 파일의 소스코드를 합쳐서 붙여넣을 수 있습니다.\n// 비밀정보(API 키, 비밀번호, 토큰 등)는 자동으로 마스킹됩니다."}
            rows={16}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y bg-gray-50"
            spellCheck={false}
          />
          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <button
              onClick={onProcess}
              disabled={isProcessing || !sourceCode.trim()}
              className="flex-1 py-2.5 px-4 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <LoadingSpinner />
                  <span>전처리 중...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>비밀정보 마스킹 + 30페이지 추출</span>
                </>
              )}
            </button>
          </div>
          {error && <ErrorMessage message={error} />}
        </div>
      </div>

      {/* 결과 영역 */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 마스킹 통계 */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              마스킹 결과
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">마스킹된 항목</span>
                <span className="font-medium text-orange-600">{stats.maskedCount}개</span>
              </div>
              {stats.maskedItems.map((item) => (
                <div key={item.label} className="flex justify-between text-xs">
                  <span className="text-gray-400">{item.label}</span>
                  <span className="text-gray-600">{item.count}건</span>
                </div>
              ))}
              {stats.maskedCount === 0 && (
                <p className="text-xs text-gray-400">마스킹할 비밀정보가 발견되지 않았습니다.</p>
              )}
            </div>
          </div>

          {/* 추출 통계 */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              추출 결과
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">전체 줄 수</span>
                <span className="font-medium">{stats.totalLines.toLocaleString()}줄</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">추출된 줄 수</span>
                <span className="font-medium text-blue-600">{stats.extractedLines.toLocaleString()}줄</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">추출 페이지</span>
                <span className="font-medium text-blue-600">{stats.extractedPages}페이지</span>
              </div>
            </div>
          </div>

          {/* 구간 정보 */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              추출 구간
            </h3>
            <div className="space-y-2">
              {stats.sections.map((section) => (
                <div key={section.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{section.label}</span>
                  <span className="text-xs text-gray-400">{section.startLine}~{section.endLine}줄</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 전처리된 코드 미리보기 */}
      {processedCode && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <h3 className="text-sm font-semibold text-gray-900">전처리 완료 코드</h3>
            </div>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {codeCopied ? (
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
                  전처리 코드 복사
                </>
              )}
            </button>
          </div>
          <div className="p-5">
            <pre className="max-h-[500px] overflow-y-auto bg-gray-50 rounded-lg p-4 text-xs font-mono text-gray-700 whitespace-pre-wrap border border-gray-200">
              {processedCode}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: 창작의도 기술서 ───

function DescriptionTab({
  description,
  onDescriptionChange,
  isGenerating,
  error,
  copied,
  onGenerate,
  onCopy,
  onPrint,
  textareaRef,
  programName,
}: {
  description: string;
  onDescriptionChange: (v: string) => void;
  isGenerating: boolean;
  error: string;
  copied: boolean;
  onGenerate: () => void;
  onCopy: () => void;
  onPrint: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  programName: string;
}) {
  const charCount = description.replace(/\s/g, "").length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 생성 버튼 */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">AI 창작의도 기술서 생성</h3>
            <p className="text-xs text-gray-500 mt-1">
              &apos;프로그램 정보&apos; 탭에 입력한 내용을 기반으로 AI가 한국저작권위원회 제출용 기술서를 생성합니다.
            </p>
          </div>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="w-full sm:w-auto py-2.5 px-6 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isGenerating ? (
              <>
                <LoadingSpinner />
                <span>기술서 생성 중...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>AI 생성</span>
              </>
            )}
          </button>
        </div>
        {error && <ErrorMessage message={error} />}
      </div>

      {/* 기술서 편집 영역 */}
      {description ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <h3 className="text-sm font-semibold text-gray-900">
                창작의도 기술서 {programName && `- ${programName}`}
              </h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                charCount >= 1500 && charCount <= 2000
                  ? "bg-green-100 text-green-700"
                  : charCount > 2000
                  ? "bg-orange-100 text-orange-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}>
                {charCount.toLocaleString()}자
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onCopy}
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
                onClick={onPrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                인쇄
              </button>
            </div>
          </div>
          <div className="p-5">
            <textarea
              ref={textareaRef}
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={20}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y leading-relaxed"
            />
            <p className="mt-2 text-xs text-gray-400">
              생성된 내용을 직접 수정할 수 있습니다. 한국저작권위원회 권장 분량: 1,500~2,000자
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="p-8 sm:p-12 flex flex-col items-center justify-center text-center min-h-[300px]">
            {isGenerating ? (
              <>
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                  <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">AI가 기술서를 작성 중입니다...</h3>
                <p className="text-sm text-gray-500">프로그램 정보를 분석하여 창작의도 기술서를 생성하고 있습니다</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">창작의도 기술서</h3>
                <p className="text-sm text-gray-500 max-w-sm">
                  &apos;프로그램 정보&apos; 탭을 먼저 작성한 후 &quot;AI 생성&quot; 버튼을 클릭하면
                  한국저작권위원회(CROS) 제출용 창작의도 기술서가 자동 생성됩니다.
                </p>
                <div className="mt-6 space-y-2 text-left w-full max-w-xs">
                  <InfoBadge text="프로그램 개요 및 창작 목적 서술" />
                  <InfoBadge text="기술적 특성 및 독창성 강조" />
                  <InfoBadge text="1,500~2,000자 권장 분량 준수" />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 4: 등록 절차 가이드 ───

function GuideTab({
  checkedSteps,
  onToggleStep,
}: {
  checkedSteps: Set<number>;
  onToggleStep: (step: number) => void;
}) {
  const steps: RegistrationStep[] = getRegistrationGuide();
  const completedCount = checkedSteps.size;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* 진행률 */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">등록 진행 상황</h3>
          <span className="text-sm text-indigo-600 font-medium">{completedCount} / {steps.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* 타임라인 */}
      <div className="space-y-0">
        {steps.map((step, index) => {
          const isChecked = checkedSteps.has(step.step);
          const isLast = index === steps.length - 1;

          return (
            <div key={step.step} className="relative flex gap-4">
              {/* 타임라인 라인 */}
              {!isLast && (
                <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-gray-200" />
              )}

              {/* 체크 원형 */}
              <button
                onClick={() => onToggleStep(step.step)}
                className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isChecked
                    ? "bg-indigo-600 border-indigo-600"
                    : "bg-white border-gray-300 hover:border-indigo-400"
                }`}
              >
                {isChecked ? (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-sm font-medium text-gray-500">{step.step}</span>
                )}
              </button>

              {/* 내용 카드 */}
              <div className={`flex-1 pb-8 ${isLast ? "pb-0" : ""}`}>
                <div className={`bg-white border rounded-xl shadow-sm p-5 transition-colors ${
                  isChecked ? "border-indigo-200 bg-indigo-50/30" : "border-gray-200"
                }`}>
                  <h4 className={`text-sm font-semibold mb-1 ${isChecked ? "text-indigo-700" : "text-gray-900"}`}>
                    {step.title}
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">{step.description}</p>

                  {step.documents && step.documents.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-medium">필요 서류:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {step.documents.map((doc) => (
                          <span key={doc} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-md">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            {doc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {step.fee && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md inline-flex mb-2">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {step.fee}
                    </div>
                  )}

                  {step.link && (
                    <a
                      href={step.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      {step.link}
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 준비물 체크리스트 */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          등록 준비물 체크리스트
        </h3>
        <div className="space-y-3">
          {CHECKLIST_ITEMS.map((item) => (
            <ChecklistItem key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* 참고 정보 */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-indigo-900 mb-2">참고 사항</h3>
        <ul className="space-y-1.5 text-sm text-indigo-700">
          <li className="flex items-start gap-2">
            <span className="text-indigo-400 mt-1">-</span>
            SW 저작권 등록은 창작 사실을 증명하는 제도이며, 등록 없이도 저작권은 발생합니다.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400 mt-1">-</span>
            등록 시 분쟁 발생 시 저작자 추정의 법적 효력을 갖습니다 (저작권법 제53조).
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400 mt-1">-</span>
            소스코드 복제물은 비밀 유지 청구가 가능합니다 (복제물 비공개 신청).
          </li>
          <li className="flex items-start gap-2">
            <span className="text-indigo-400 mt-1">-</span>
            한국저작권위원회 문의: 1800-5455 (cros.or.kr)
          </li>
        </ul>
      </div>
    </div>
  );
}

// ─── Shared Sub-Components ───

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
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
      />
    </div>
  );
}

function DynamicList({
  items,
  field,
  placeholder,
  onChange,
  onAdd,
  onRemove,
}: {
  items: string[];
  field: "features" | "techStack";
  placeholder: string;
  onChange: (field: "features" | "techStack", index: number, value: string) => void;
  onAdd: (field: "features" | "techStack") => void;
  onRemove: (field: "features" | "techStack", index: number) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{index + 1}.</span>
          <input
            type="text"
            value={item}
            onChange={(e) => onChange(field, index, e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white"
          />
          {items.length > 1 && (
            <button
              onClick={() => onRemove(field, index)}
              className="p-1.5 text-red-400 hover:text-red-600 transition-colors"
              title="삭제"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      ))}
      <button
        onClick={() => onAdd(field)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        항목 추가
      </button>
    </div>
  );
}

function InfoBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
      <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-red-700">{message}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function ChecklistItem({ item }: { item: { id: string; label: string; tip: string } }) {
  const [checked, setChecked] = useState(false);
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => setChecked(!checked)}
        className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
      />
      <div>
        <span className={`text-sm ${checked ? "text-gray-400 line-through" : "text-gray-700"}`}>
          {item.label}
        </span>
        <p className="text-xs text-gray-400 mt-0.5">{item.tip}</p>
      </div>
    </label>
  );
}

// ─── Checklist Items ───

const CHECKLIST_ITEMS = [
  { id: "account", label: "한국저작권위원회(CROS) 회원가입 완료", tip: "cros.or.kr에서 가입" },
  { id: "program_info", label: "프로그램 정보 정리 (명칭, 버전, 창작일)", tip: "본 도구의 Tab 1에서 작성" },
  { id: "description", label: "창작의도 기술서(명세서) 준비", tip: "본 도구의 Tab 3에서 AI 생성" },
  { id: "source_code", label: "소스코드 복제물 30페이지 준비", tip: "본 도구의 Tab 2에서 전처리 후 PDF 변환" },
  { id: "biz_cert", label: "사업자등록증 사본 (법인의 경우)", tip: "스캔 또는 촬영본" },
  { id: "id_copy", label: "신분증 사본 (개인의 경우)", tip: "주민등록증, 운전면허증 등" },
  { id: "fee", label: "등록 수수료 준비", tip: "개인 25,000원 / 법인 50,000원 (부가세 별도)" },
];

// ─── Icons ───

const infoIcon = (
  <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const categoryIcon = (
  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
  </svg>
);

const descIcon = (
  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
  </svg>
);

const featuresIcon = (
  <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const stackIcon = (
  <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
  </svg>
);

const authorIcon = (
  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
