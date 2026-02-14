"use client";

import { useState, useRef } from "react";
import {
  SW_CATEGORIES,
  PROGRAMMING_LANGUAGES,
  OPERATING_SYSTEMS,
  type ProgramInfo,
} from "@/lib/copyright/copyrightHelper";

// ─── Types ───

type CopyrightType =
  | "literary"
  | "music"
  | "art"
  | "architecture"
  | "photo"
  | "audiovisual"
  | "diagram"
  | "software"
  | "derivative"
  | "compilation";

type TabId = "type" | "details" | "documents" | "guide" | "sw-tools";

interface Tab {
  id: TabId;
  label: string;
  swOnly?: boolean;
}

interface CopyrightTypeOption {
  id: CopyrightType;
  label: string;
  desc: string;
  icon: string;
}

interface CodeProcessStats {
  totalLines: number;
  maskedCount: number;
  maskedItems: { label: string; count: number }[];
  extractedPages: number;
  extractedLines: number;
  sections: { label: string; startLine: number; endLine: number }[];
}

// ─── Constants ───

const COPYRIGHT_TYPES: CopyrightTypeOption[] = [
  { id: "literary", label: "어문저작물", desc: "소설, 시, 논문, 강연, 각본 등", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { id: "music", label: "음악저작물", desc: "악곡, 가사 포함", icon: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" },
  { id: "art", label: "미술저작물", desc: "회화, 조각, 공예, 디자인, 일러스트", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { id: "architecture", label: "건축저작물", desc: "건축물, 설계도서", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { id: "photo", label: "사진저작물", desc: "사진 및 이에 유사한 방법으로 제작된 것", icon: "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" },
  { id: "audiovisual", label: "영상저작물", desc: "영화, 동영상, 애니메이션", icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" },
  { id: "diagram", label: "도형저작물", desc: "지도, 도표, 설계도, 약도, 모형", icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" },
  { id: "software", label: "컴퓨터프로그램저작물", desc: "소프트웨어, 앱, 게임", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
  { id: "derivative", label: "2차적저작물", desc: "번역, 편곡, 변형, 각색, 영상화", icon: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" },
  { id: "compilation", label: "편집저작물", desc: "데이터베이스, 편집물", icon: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" },
];

const TABS: Tab[] = [
  { id: "type", label: "저작물 유형 선택" },
  { id: "details", label: "저작물 상세정보" },
  { id: "documents", label: "첨부서류 안내" },
  { id: "guide", label: "등록 가이드" },
  { id: "sw-tools", label: "SW 전용 도구", swOnly: true },
];

// ─── Form State Interfaces ───

interface BasicInfo {
  title: string;
  titleEn: string;
  creationDate: string;
  publicDate: string;
  isPublished: boolean;
  authorType: "individual" | "corporation";
  authorName: string;
  regNumber: string;
  companyName: string;
  contact: string;
  email: string;
  address: string;
}

interface TypeDetails {
  // Literary
  pageCount: string;
  charCount: string;
  printRun: string;
  publisher: string;
  // Music
  genre: string;
  duration: string;
  composerType: string;
  // Art
  material: string;
  artSize: string;
  artCount: string;
  // Architecture
  location: string;
  architect: string;
  floorArea: string;
  // Photo
  shootDate: string;
  shootLocation: string;
  camera: string;
  // Audiovisual
  runningTime: string;
  productionType: string;
  cast: string;
  // Diagram
  scale: string;
  purpose: string;
  method: string;
  // Derivative
  originalTitle: string;
  originalAuthor: string;
  originalType: string;
  // Compilation
  scope: string;
  criteria: string;
}

const INITIAL_BASIC: BasicInfo = {
  title: "",
  titleEn: "",
  creationDate: "",
  publicDate: "",
  isPublished: false,
  authorType: "individual",
  authorName: "",
  regNumber: "",
  companyName: "",
  contact: "",
  email: "",
  address: "",
};

const INITIAL_DETAILS: TypeDetails = {
  pageCount: "", charCount: "", printRun: "", publisher: "",
  genre: "", duration: "", composerType: "",
  material: "", artSize: "", artCount: "",
  location: "", architect: "", floorArea: "",
  shootDate: "", shootLocation: "", camera: "",
  runningTime: "", productionType: "", cast: "",
  scale: "", purpose: "", method: "",
  originalTitle: "", originalAuthor: "", originalType: "",
  scope: "", criteria: "",
};

const INITIAL_SW: ProgramInfo = {
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

// ─── Document checklists per type ───

const DOCUMENT_LISTS: Record<CopyrightType, { label: string; tip: string }[]> = {
  literary: [
    { label: "저작권 등록 신청서", tip: "CROS 온라인 작성" },
    { label: "신분증 사본 또는 법인등기부등본", tip: "개인: 주민등록증/운전면허증, 법인: 등기부등본" },
    { label: "저작물 사본 1부", tip: "출판물 또는 원고 사본" },
  ],
  music: [
    { label: "저작권 등록 신청서", tip: "CROS 온라인 작성" },
    { label: "신분증 사본 또는 법인등기부등본", tip: "개인: 주민등록증/운전면허증, 법인: 등기부등본" },
    { label: "악보 또는 가사 사본", tip: "악보 PDF 또는 가사 문서" },
    { label: "음원 CD 또는 파일", tip: "MP3, WAV 등 음원 파일" },
  ],
  art: [
    { label: "저작권 등록 신청서", tip: "CROS 온라인 작성" },
    { label: "신분증 사본 또는 법인등기부등본", tip: "개인: 주민등록증/운전면허증, 법인: 등기부등본" },
    { label: "작품 사진 또는 복제물", tip: "고해상도 사진 또는 실물 복제" },
  ],
  architecture: [
    { label: "저작권 등록 신청서", tip: "CROS 온라인 작성" },
    { label: "신분증 사본 또는 법인등기부등본", tip: "개인: 주민등록증/운전면허증, 법인: 등기부등본" },
    { label: "설계도서", tip: "건축 설계 도면 사본" },
    { label: "건축물 사진", tip: "완공된 건축물 외관/내부 사진" },
  ],
  photo: [
    { label: "저작권 등록 신청서", tip: "CROS 온라인 작성" },
    { label: "신분증 사본 또는 법인등기부등본", tip: "개인: 주민등록증/운전면허증, 법인: 등기부등본" },
    { label: "원본 사진 파일", tip: "고해상도 원본 이미지 파일" },
  ],
  audiovisual: [
    { label: "저작권 등록 신청서", tip: "CROS 온라인 작성" },
    { label: "신분증 사본 또는 법인등기부등본", tip: "개인: 주민등록증/운전면허증, 법인: 등기부등본" },
    { label: "영상물 사본", tip: "DVD, 파일 등 영상 복제물" },
    { label: "시나리오", tip: "시나리오 또는 대본 사본" },
  ],
  diagram: [
    { label: "저작권 등록 신청서", tip: "CROS 온라인 작성" },
    { label: "신분증 사본 또는 법인등기부등본", tip: "개인: 주민등록증/운전면허증, 법인: 등기부등본" },
    { label: "원본 도면 사본", tip: "도면/지도/설계도 복제물" },
  ],
  software: [
    { label: "저작권 등록 신청서", tip: "CROS 온라인 작성" },
    { label: "신분증 사본 또는 법인등기부등본", tip: "개인: 주민등록증/운전면허증, 법인: 등기부등본" },
    { label: "소스코드 복제물 30페이지", tip: "처음10p + 중간10p + 끝10p, 비밀정보 마스킹 처리" },
    { label: "프로그램 명세서 (창작의도 기술서)", tip: "프로그램 개요, 창작 목적, 기술적 특성 기술" },
  ],
  derivative: [
    { label: "저작권 등록 신청서", tip: "CROS 온라인 작성" },
    { label: "신분증 사본 또는 법인등기부등본", tip: "개인: 주민등록증/운전면허증, 법인: 등기부등본" },
    { label: "원저작물 사본", tip: "원작의 사본" },
    { label: "2차적 저작물 사본", tip: "번역/편곡/각색 결과물 사본" },
  ],
  compilation: [
    { label: "저작권 등록 신청서", tip: "CROS 온라인 작성" },
    { label: "신분증 사본 또는 법인등기부등본", tip: "개인: 주민등록증/운전면허증, 법인: 등기부등본" },
    { label: "편집저작물 사본", tip: "편집물 또는 데이터베이스 사본" },
  ],
};

// ─── Main Page ───

export default function CopyrightPage() {
  const [selectedType, setSelectedType] = useState<CopyrightType | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("type");
  const [basicInfo, setBasicInfo] = useState<BasicInfo>(INITIAL_BASIC);
  const [typeDetails, setTypeDetails] = useState<TypeDetails>(INITIAL_DETAILS);
  const [swInfo, setSwInfo] = useState<ProgramInfo>(INITIAL_SW);

  // SW tools state
  const [sourceCode, setSourceCode] = useState("");
  const [processedCode, setProcessedCode] = useState("");
  const [codeStats, setCodeStats] = useState<CodeProcessStats | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [creationDesc, setCreationDesc] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [descError, setDescError] = useState("");
  const [descCopied, setDescCopied] = useState(false);

  // Guide checklist
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  // Document checklist
  const [checkedDocs, setCheckedDocs] = useState<Set<string>>(new Set());

  const descTextareaRef = useRef<HTMLTextAreaElement>(null);

  const visibleTabs = TABS.filter((t) => !t.swOnly || selectedType === "software");

  // ─── Handlers ───

  const handleBasicChange = (field: keyof BasicInfo, value: unknown) => {
    setBasicInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleDetailChange = (field: keyof TypeDetails, value: string) => {
    setTypeDetails((prev) => ({ ...prev, [field]: value }));
  };

  const handleSwChange = (field: keyof ProgramInfo, value: unknown) => {
    setSwInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handleLanguageToggle = (lang: string) => {
    setSwInfo((prev) => {
      const cur = prev.programmingLanguages;
      return {
        ...prev,
        programmingLanguages: cur.includes(lang) ? cur.filter((l) => l !== lang) : [...cur, lang],
      };
    });
  };

  const handleSwListChange = (field: "features" | "techStack", idx: number, val: string) => {
    setSwInfo((prev) => {
      const list = [...(prev[field] || [])];
      list[idx] = val;
      return { ...prev, [field]: list };
    });
  };

  const handleSwListAdd = (field: "features" | "techStack") => {
    setSwInfo((prev) => ({ ...prev, [field]: [...(prev[field] || []), ""] }));
  };

  const handleSwListRemove = (field: "features" | "techStack", idx: number) => {
    setSwInfo((prev) => {
      const list = [...(prev[field] || [])];
      if (list.length <= 1) return prev;
      list.splice(idx, 1);
      return { ...prev, [field]: list };
    });
  };

  // Code processing
  const handleProcessCode = async () => {
    if (!sourceCode.trim()) { setCodeError("소스코드를 입력해주세요."); return; }
    setIsProcessing(true); setCodeError(""); setProcessedCode(""); setCodeStats(null);
    try {
      const res = await fetch("/api/copyright/process-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceCode }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `서버 오류 (${res.status})`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "전처리에 실패했습니다.");
      setProcessedCode(data.data.extractedCode);
      setCodeStats(data.data.stats);
    } catch (e) {
      setCodeError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally { setIsProcessing(false); }
  };

  // AI description generation
  const handleGenerateDescription = async () => {
    const merged: ProgramInfo = {
      ...swInfo,
      programName: swInfo.programName || basicInfo.title,
      programNameEn: swInfo.programNameEn || basicInfo.titleEn,
      creationDate: swInfo.creationDate || basicInfo.creationDate,
      publicDate: swInfo.publicDate || basicInfo.publicDate,
      authorName: swInfo.authorName || basicInfo.authorName,
      authorType: basicInfo.authorType,
      companyName: swInfo.companyName || basicInfo.companyName,
    };
    if (!merged.programName.trim()) { setDescError("프로그램명(저작물 제목)을 입력해주세요."); return; }
    if (!merged.description.trim()) { setDescError("프로그램 설명을 입력해주세요."); return; }
    if ((merged.features || []).filter((f) => f.trim()).length === 0) {
      setDescError("주요 기능을 1개 이상 입력해주세요."); return;
    }
    setIsGenerating(true); setDescError("");
    try {
      const cleaned = {
        ...merged,
        features: merged.features.filter((f) => f.trim()),
        techStack: (merged.techStack || []).filter((t) => t.trim()),
      };
      const res = await fetch("/api/copyright/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleaned),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `서버 오류 (${res.status})`);
      }
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "기술서 생성에 실패했습니다.");
      setCreationDesc(data.data.description);
    } catch (e) {
      setDescError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally { setIsGenerating(false); }
  };

  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); document.body.removeChild(ta);
    }
  };

  const handleCopyDescription = async () => {
    await copyText(creationDesc);
    setDescCopied(true);
    setTimeout(() => setDescCopied(false), 2000);
  };

  const handlePrintDescription = () => {
    const pw = window.open("", "_blank");
    if (pw) {
      pw.document.write(`<html><head><title>창작의도 기술서 - ${swInfo.programName || basicInfo.title}</title>
        <style>body{font-family:'Malgun Gothic',sans-serif;padding:40px;line-height:1.8}h1{text-align:center;font-size:18px;margin-bottom:30px}.content{white-space:pre-wrap;font-size:14px}.footer{text-align:center;margin-top:40px;font-size:10px;color:#999}</style>
        </head><body><h1>프로그램 명세서 (창작의도 기술서)</h1><div class="content">${creationDesc}</div>
        <div class="footer">Admini AI Platform | aiadminplatform.vercel.app</div></body></html>`);
      pw.document.close(); pw.print();
    }
  };

  const toggleStepCheck = (step: number) => {
    setCheckedSteps((prev) => { const n = new Set(prev); n.has(step) ? n.delete(step) : n.add(step); return n; });
  };

  const toggleDocCheck = (label: string) => {
    setCheckedDocs((prev) => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n; });
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
              <h1 className="text-2xl font-bold text-gray-900">저작권 등록</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                모든 유형의 저작물 등록 안내 - 한국저작권위원회(CROS) 등록 가이드
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-0 overflow-x-auto scrollbar-hide">
            {visibleTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
                {tab.swOnly && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 rounded">SW</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "type" && (
          <TypeSelectionTab
            selectedType={selectedType}
            onSelectType={(t) => { setSelectedType(t); }}
            basicInfo={basicInfo}
            onBasicChange={handleBasicChange}
          />
        )}
        {activeTab === "details" && (
          <DetailsTab
            selectedType={selectedType}
            typeDetails={typeDetails}
            onDetailChange={handleDetailChange}
            swInfo={swInfo}
            onSwChange={handleSwChange}
            onLanguageToggle={handleLanguageToggle}
            onSwListChange={handleSwListChange}
            onSwListAdd={handleSwListAdd}
            onSwListRemove={handleSwListRemove}
          />
        )}
        {activeTab === "documents" && (
          <DocumentsTab
            selectedType={selectedType}
            checkedDocs={checkedDocs}
            onToggleDoc={toggleDocCheck}
          />
        )}
        {activeTab === "guide" && (
          <GuideTab checkedSteps={checkedSteps} onToggleStep={toggleStepCheck} />
        )}
        {activeTab === "sw-tools" && selectedType === "software" && (
          <SwToolsTab
            sourceCode={sourceCode}
            onSourceCodeChange={setSourceCode}
            processedCode={processedCode}
            codeStats={codeStats}
            isProcessing={isProcessing}
            codeError={codeError}
            onProcessCode={handleProcessCode}
            onCopyCode={() => copyText(processedCode)}
            creationDesc={creationDesc}
            onCreationDescChange={setCreationDesc}
            isGenerating={isGenerating}
            descError={descError}
            descCopied={descCopied}
            onGenerate={handleGenerateDescription}
            onCopyDesc={handleCopyDescription}
            onPrintDesc={handlePrintDescription}
            descTextareaRef={descTextareaRef}
            programName={swInfo.programName || basicInfo.title}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Tab 1: 저작물 유형 선택 + 기본정보
// ═══════════════════════════════════════════════════

function TypeSelectionTab({
  selectedType,
  onSelectType,
  basicInfo,
  onBasicChange,
}: {
  selectedType: CopyrightType | null;
  onSelectType: (t: CopyrightType) => void;
  basicInfo: BasicInfo;
  onBasicChange: (field: keyof BasicInfo, value: unknown) => void;
}) {
  return (
    <div className="space-y-6 max-w-5xl">
      {/* Type Selection Cards */}
      <SectionCard title="저작물 유형 선택" icon={shieldIcon}>
        <p className="text-sm text-gray-500 mb-4">등록하려는 저작물의 유형을 선택해주세요.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {COPYRIGHT_TYPES.map((ct) => {
            const isSelected = selectedType === ct.id;
            return (
              <button
                key={ct.id}
                onClick={() => onSelectType(ct.id)}
                className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? "border-indigo-500 bg-indigo-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm"
                }`}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-5 h-5 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <div className="flex items-center gap-3 mb-1.5">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isSelected ? "bg-indigo-100" : "bg-gray-100"
                  }`}>
                    <svg className={`w-4 h-4 ${isSelected ? "text-indigo-600" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d={ct.icon} />
                    </svg>
                  </div>
                  <h3 className={`text-sm font-semibold ${isSelected ? "text-indigo-700" : "text-gray-900"}`}>
                    {ct.label}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 ml-11">{ct.desc}</p>
              </button>
            );
          })}
        </div>
      </SectionCard>

      {/* Basic Info (shown after type selection) */}
      {selectedType && (
        <>
          <SectionCard title="저작물 기본정보" icon={infoIcon}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="저작물 제목" value={basicInfo.title} onChange={(v) => onBasicChange("title", v)} placeholder="저작물 제목을 입력하세요" required />
              <InputField label="저작물 영문명" value={basicInfo.titleEn} onChange={(v) => onBasicChange("titleEn", v)} placeholder="English title (optional)" />
              <InputField label="창작일" type="date" value={basicInfo.creationDate} onChange={(v) => onBasicChange("creationDate", v)} required />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">공표일</label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={basicInfo.isPublished}
                      onChange={(e) => onBasicChange("isPublished", e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300"
                    />
                    <span className="text-xs text-gray-500">공표됨</span>
                  </label>
                </div>
                <input
                  type="date"
                  value={basicInfo.publicDate}
                  onChange={(e) => onBasicChange("publicDate", e.target.value)}
                  disabled={!basicInfo.isPublished}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white disabled:bg-gray-100 disabled:text-gray-400"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="저작자 정보" icon={authorIcon}>
            <div className="space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={basicInfo.authorType === "individual"} onChange={() => onBasicChange("authorType", "individual")} className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm text-gray-700">개인</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={basicInfo.authorType === "corporation"} onChange={() => onBasicChange("authorType", "corporation")} className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm text-gray-700">법인</span>
                </label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label={basicInfo.authorType === "individual" ? "저작자 성명" : "대표자 성명"}
                  value={basicInfo.authorName}
                  onChange={(v) => onBasicChange("authorName", v)}
                  placeholder="홍길동"
                  required
                />
                <InputField
                  label={basicInfo.authorType === "individual" ? "주민등록번호" : "법인등록번호"}
                  value={basicInfo.regNumber}
                  onChange={(v) => onBasicChange("regNumber", v)}
                  placeholder={basicInfo.authorType === "individual" ? "000000-0000000" : "000000-0000000"}
                />
                {basicInfo.authorType === "corporation" && (
                  <InputField
                    label="법인명"
                    value={basicInfo.companyName}
                    onChange={(v) => onBasicChange("companyName", v)}
                    placeholder="주식회사 어드미니"
                  />
                )}
                <InputField label="연락처" value={basicInfo.contact} onChange={(v) => onBasicChange("contact", v)} placeholder="010-0000-0000" />
                <InputField label="이메일" value={basicInfo.email} onChange={(v) => onBasicChange("email", v)} placeholder="email@example.com" />
                <InputField label="주소" value={basicInfo.address} onChange={(v) => onBasicChange("address", v)} placeholder="서울특별시 강남구..." className="sm:col-span-2" />
              </div>
            </div>
          </SectionCard>
        </>
      )}

      {!selectedType && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">저작물 유형을 선택해주세요</h3>
          <p className="text-sm text-gray-500">위에서 등록하려는 저작물의 유형을 선택하면 기본정보 입력란이 표시됩니다.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Tab 2: 저작물 상세정보
// ═══════════════════════════════════════════════════

function DetailsTab({
  selectedType,
  typeDetails,
  onDetailChange,
  swInfo,
  onSwChange,
  onLanguageToggle,
  onSwListChange,
  onSwListAdd,
  onSwListRemove,
}: {
  selectedType: CopyrightType | null;
  typeDetails: TypeDetails;
  onDetailChange: (field: keyof TypeDetails, value: string) => void;
  swInfo: ProgramInfo;
  onSwChange: (field: keyof ProgramInfo, value: unknown) => void;
  onLanguageToggle: (lang: string) => void;
  onSwListChange: (field: "features" | "techStack", idx: number, val: string) => void;
  onSwListAdd: (field: "features" | "techStack") => void;
  onSwListRemove: (field: "features" | "techStack", idx: number) => void;
}) {
  if (!selectedType) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center max-w-4xl">
        <p className="text-sm text-gray-500">먼저 &apos;저작물 유형 선택&apos; 탭에서 유형을 선택해주세요.</p>
      </div>
    );
  }

  const typeLabel = COPYRIGHT_TYPES.find((t) => t.id === selectedType)?.label || "";

  return (
    <div className="space-y-6 max-w-4xl">
      <SectionCard title={`${typeLabel} 상세정보`} icon={detailIcon}>
        {selectedType === "literary" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="분량 (매 또는 자)" value={typeDetails.pageCount} onChange={(v) => onDetailChange("pageCount", v)} placeholder="예: 200매 / 80,000자" />
            <InputField label="발행부수" value={typeDetails.printRun} onChange={(v) => onDetailChange("printRun", v)} placeholder="예: 초판 3,000부" />
            <InputField label="출판사" value={typeDetails.publisher} onChange={(v) => onDetailChange("publisher", v)} placeholder="출판사명" />
          </div>
        )}

        {selectedType === "music" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="장르" value={typeDetails.genre} onChange={(v) => onDetailChange("genre", v)} placeholder="예: 클래식, 팝, 국악 등" />
            <InputField label="연주시간" value={typeDetails.duration} onChange={(v) => onDetailChange("duration", v)} placeholder="예: 3분 45초" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">작곡/작사 구분</label>
              <select value={typeDetails.composerType} onChange={(e) => onDetailChange("composerType", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white">
                <option value="">선택하세요</option>
                <option value="작곡">작곡</option>
                <option value="작사">작사</option>
                <option value="작곡+작사">작곡 + 작사</option>
                <option value="편곡">편곡</option>
              </select>
            </div>
          </div>
        )}

        {selectedType === "art" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="재질/기법" value={typeDetails.material} onChange={(v) => onDetailChange("material", v)} placeholder="예: 캔버스에 유화, 디지털 일러스트" />
            <InputField label="크기 (가로 x 세로 cm)" value={typeDetails.artSize} onChange={(v) => onDetailChange("artSize", v)} placeholder="예: 50 x 70 cm" />
            <InputField label="작품 수" value={typeDetails.artCount} onChange={(v) => onDetailChange("artCount", v)} placeholder="예: 1점" />
          </div>
        )}

        {selectedType === "architecture" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="건축물 소재지" value={typeDetails.location} onChange={(v) => onDetailChange("location", v)} placeholder="건축물 주소" />
            <InputField label="설계자" value={typeDetails.architect} onChange={(v) => onDetailChange("architect", v)} placeholder="설계자 또는 설계사무소명" />
            <InputField label="연면적" value={typeDetails.floorArea} onChange={(v) => onDetailChange("floorArea", v)} placeholder="예: 500 m2" />
          </div>
        )}

        {selectedType === "photo" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="촬영일시" type="date" value={typeDetails.shootDate} onChange={(v) => onDetailChange("shootDate", v)} />
            <InputField label="촬영장소" value={typeDetails.shootLocation} onChange={(v) => onDetailChange("shootLocation", v)} placeholder="촬영 장소" />
            <InputField label="촬영기기" value={typeDetails.camera} onChange={(v) => onDetailChange("camera", v)} placeholder="예: Canon EOS R5, iPhone 15 Pro" />
          </div>
        )}

        {selectedType === "audiovisual" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="상영시간" value={typeDetails.runningTime} onChange={(v) => onDetailChange("runningTime", v)} placeholder="예: 1시간 30분" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">제작형태</label>
              <select value={typeDetails.productionType} onChange={(e) => onDetailChange("productionType", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white">
                <option value="">선택하세요</option>
                <option value="실사 영화">실사 영화</option>
                <option value="애니메이션">애니메이션</option>
                <option value="다큐멘터리">다큐멘터리</option>
                <option value="뮤직비디오">뮤직비디오</option>
                <option value="단편영상">단편영상</option>
                <option value="기타">기타</option>
              </select>
            </div>
            <InputField label="출연자" value={typeDetails.cast} onChange={(v) => onDetailChange("cast", v)} placeholder="주요 출연자 (선택사항)" />
          </div>
        )}

        {selectedType === "diagram" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="축척" value={typeDetails.scale} onChange={(v) => onDetailChange("scale", v)} placeholder="예: 1:500" />
            <InputField label="용도" value={typeDetails.purpose} onChange={(v) => onDetailChange("purpose", v)} placeholder="예: 건축 설계, 도시계획 등" />
            <InputField label="제작방법" value={typeDetails.method} onChange={(v) => onDetailChange("method", v)} placeholder="예: CAD, 수작업 등" />
          </div>
        )}

        {selectedType === "derivative" && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700">2차적 저작물은 원저작물을 번역, 편곡, 변형, 각색, 영상화 등으로 작성한 창작물입니다. 원저작자의 허락이 필요할 수 있습니다.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="원저작물 제목" value={typeDetails.originalTitle} onChange={(v) => onDetailChange("originalTitle", v)} placeholder="원작의 제목" required />
              <InputField label="원저작자" value={typeDetails.originalAuthor} onChange={(v) => onDetailChange("originalAuthor", v)} placeholder="원작 저작자명" required />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">원저작물 유형</label>
                <select value={typeDetails.originalType} onChange={(e) => onDetailChange("originalType", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white">
                  <option value="">선택하세요</option>
                  <option value="어문">어문저작물</option>
                  <option value="음악">음악저작물</option>
                  <option value="미술">미술저작물</option>
                  <option value="영상">영상저작물</option>
                  <option value="기타">기타</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {selectedType === "compilation" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField label="수록 범위" value={typeDetails.scope} onChange={(v) => onDetailChange("scope", v)} placeholder="예: 2020~2025년 국내 논문" className="sm:col-span-2" />
            <InputField label="선택/배열 기준" value={typeDetails.criteria} onChange={(v) => onDetailChange("criteria", v)} placeholder="예: 주제별 분류, 연도순 배열" className="sm:col-span-2" />
          </div>
        )}

        {selectedType === "software" && (
          <SwDetailsForm
            swInfo={swInfo}
            onSwChange={onSwChange}
            onLanguageToggle={onLanguageToggle}
            onSwListChange={onSwListChange}
            onSwListAdd={onSwListAdd}
            onSwListRemove={onSwListRemove}
          />
        )}
      </SectionCard>
    </div>
  );
}

// ─── SW Details Sub-form ───

function SwDetailsForm({
  swInfo,
  onSwChange,
  onLanguageToggle,
  onSwListChange,
  onSwListAdd,
  onSwListRemove,
}: {
  swInfo: ProgramInfo;
  onSwChange: (field: keyof ProgramInfo, value: unknown) => void;
  onLanguageToggle: (lang: string) => void;
  onSwListChange: (field: "features" | "techStack", idx: number, val: string) => void;
  onSwListAdd: (field: "features" | "techStack") => void;
  onSwListRemove: (field: "features" | "techStack", idx: number) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Classification & Environment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">분류 <span className="text-red-500">*</span></label>
          <select value={swInfo.category} onChange={(e) => onSwChange("category", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white">
            <option value="">선택하세요</option>
            {SW_CATEGORIES.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">동작 OS <span className="text-red-500">*</span></label>
          <select value={swInfo.operatingSystem} onChange={(e) => onSwChange("operatingSystem", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white">
            <option value="">선택하세요</option>
            {OPERATING_SYSTEMS.map((os) => (<option key={os} value={os}>{os}</option>))}
          </select>
        </div>
        <InputField label="버전" value={swInfo.version} onChange={(v) => onSwChange("version", v)} placeholder="1.0.0" required />
        <InputField label="프로그램 규모" value={swInfo.programSize || ""} onChange={(v) => onSwChange("programSize", v)} placeholder="약 50,000줄 / 10MB" />
      </div>

      {/* Programming Languages */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          프로그래밍 언어 <span className="text-red-500">*</span>
          <span className="ml-2 text-xs text-gray-400 font-normal">({swInfo.programmingLanguages.length}개 선택됨)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {PROGRAMMING_LANGUAGES.map((lang) => {
            const sel = swInfo.programmingLanguages.includes(lang);
            return (
              <button key={lang} type="button" onClick={() => onLanguageToggle(lang)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${sel ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {sel && <svg className="w-3 h-3 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                {lang}
              </button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">프로그램 설명 <span className="text-red-500">*</span></label>
        <textarea value={swInfo.description} onChange={(e) => onSwChange("description", e.target.value)} placeholder="프로그램의 목적, 기능, 특징을 간략하게 설명해주세요." rows={4} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none" />
      </div>

      {/* Features */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">주요 기능</label>
        <DynamicList items={swInfo.features} field="features" placeholder="예: 사용자 인증 및 권한 관리" onChange={onSwListChange} onAdd={onSwListAdd} onRemove={onSwListRemove} />
      </div>

      {/* Tech Stack */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">기술 스택</label>
        <DynamicList items={swInfo.techStack || [""]} field="techStack" placeholder="예: Next.js 14, PostgreSQL, Redis" onChange={onSwListChange} onAdd={onSwListAdd} onRemove={onSwListRemove} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Tab 3: 첨부서류 안내
// ═══════════════════════════════════════════════════

function DocumentsTab({
  selectedType,
  checkedDocs,
  onToggleDoc,
}: {
  selectedType: CopyrightType | null;
  checkedDocs: Set<string>;
  onToggleDoc: (label: string) => void;
}) {
  if (!selectedType) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center max-w-4xl">
        <p className="text-sm text-gray-500">먼저 &apos;저작물 유형 선택&apos; 탭에서 유형을 선택해주세요.</p>
      </div>
    );
  }

  const docs = DOCUMENT_LISTS[selectedType] || [];
  const typeLabel = COPYRIGHT_TYPES.find((t) => t.id === selectedType)?.label || "";
  const checkedCount = docs.filter((d) => checkedDocs.has(d.label)).length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Progress */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">{typeLabel} - 첨부서류 준비 현황</h3>
          <span className="text-sm text-indigo-600 font-medium">{checkedCount} / {docs.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${docs.length > 0 ? (checkedCount / docs.length) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Document Checklist */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          필요 서류 체크리스트
        </h3>
        <div className="space-y-3">
          {docs.map((doc) => {
            const isChecked = checkedDocs.has(doc.label);
            return (
              <label key={doc.label} className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggleDoc(doc.label)}
                  className="mt-0.5 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                />
                <div>
                  <span className={`text-sm ${isChecked ? "text-gray-400 line-through" : "text-gray-700"}`}>{doc.label}</span>
                  <p className="text-xs text-gray-400 mt-0.5">{doc.tip}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* SW-specific note */}
      {selectedType === "software" && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">SW 저작권 등록 참고</h4>
          <ul className="space-y-1.5 text-sm text-blue-700">
            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">-</span>소스코드 복제물은 &apos;SW 전용 도구&apos; 탭에서 비밀정보 마스킹 + 30페이지 추출이 가능합니다.</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">-</span>창작의도 기술서(프로그램 명세서)도 &apos;SW 전용 도구&apos; 탭에서 AI가 자동 생성합니다.</li>
            <li className="flex items-start gap-2"><span className="text-blue-400 mt-0.5">-</span>소스코드 비밀 유지 청구가 가능합니다 (복제물 비공개 신청).</li>
          </ul>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Tab 4: 등록 가이드
// ═══════════════════════════════════════════════════

interface GuideStep {
  step: number;
  title: string;
  description: string;
  documents?: string[];
  fee?: string;
  link?: string;
}

const GUIDE_STEPS: GuideStep[] = [
  { step: 1, title: "한국저작권위원회 회원가입", description: "cros.or.kr에서 회원가입 후 로그인합니다. 공인인증서 또는 간편인증으로 본인확인이 필요합니다.", link: "https://www.cros.or.kr" },
  { step: 2, title: "등록 유형 선택", description: "저작권 등록(어문, 음악, 미술 등 일반 저작물) 또는 프로그램 등록(SW)을 선택합니다. 2차적 저작물, 편집저작물도 각각 해당 유형으로 신청합니다." },
  { step: 3, title: "신청서 작성 (온라인)", description: "저작물 제목, 창작일, 공표 여부, 저작자 정보 등을 입력합니다. 법인의 경우 법인등록번호가 필요합니다.", documents: ["저작권 등록 신청서"] },
  { step: 4, title: "첨부서류 업로드", description: "저작물 유형에 따른 필요 서류를 업로드합니다. SW의 경우 소스코드 복제물 30페이지와 프로그램 명세서가 필요합니다.", documents: ["유형별 첨부서류 (첨부서류 안내 탭 참고)"] },
  { step: 5, title: "수수료 납부", description: "온라인 결제 또는 계좌이체로 등록 수수료를 납부합니다.", fee: "온라인 등록: 50,000원 + 등록면허세 3,600원" },
  { step: 6, title: "심사 (약 4영업일)", description: "한국저작권위원회에서 신청 내용을 심사합니다. 보완 요청이 있을 수 있으며, 보완 기한 내 자료를 제출해야 합니다." },
  { step: 7, title: "등록증 발급", description: "심사 완료 후 저작권 등록증이 발급됩니다. cros.or.kr에서 등록증을 확인하고 출력할 수 있습니다.", documents: ["저작권 등록증"] },
];

function GuideTab({ checkedSteps, onToggleStep }: { checkedSteps: Set<number>; onToggleStep: (step: number) => void }) {
  const completedCount = checkedSteps.size;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Progress */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">등록 진행 상황</h3>
          <span className="text-sm text-indigo-600 font-medium">{completedCount} / {GUIDE_STEPS.length}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${(completedCount / GUIDE_STEPS.length) * 100}%` }} />
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {GUIDE_STEPS.map((step, index) => {
          const isChecked = checkedSteps.has(step.step);
          const isLast = index === GUIDE_STEPS.length - 1;
          return (
            <div key={step.step} className="relative flex gap-4">
              {!isLast && <div className="absolute left-[19px] top-10 bottom-0 w-0.5 bg-gray-200" />}
              <button onClick={() => onToggleStep(step.step)}
                className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-colors ${isChecked ? "bg-indigo-600 border-indigo-600" : "bg-white border-gray-300 hover:border-indigo-400"}`}>
                {isChecked ? (
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                ) : (
                  <span className="text-sm font-medium text-gray-500">{step.step}</span>
                )}
              </button>
              <div className={`flex-1 ${isLast ? "pb-0" : "pb-8"}`}>
                <div className={`bg-white border rounded-xl shadow-sm p-5 transition-colors ${isChecked ? "border-indigo-200 bg-indigo-50/30" : "border-gray-200"}`}>
                  <h4 className={`text-sm font-semibold mb-1 ${isChecked ? "text-indigo-700" : "text-gray-900"}`}>{step.title}</h4>
                  <p className="text-sm text-gray-600 mb-3">{step.description}</p>
                  {step.documents && step.documents.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-500 font-medium">필요 서류:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {step.documents.map((doc) => (
                          <span key={doc} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-md">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            {doc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {step.fee && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md mb-2">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {step.fee}
                    </div>
                  )}
                  {step.link && (
                    <a href={step.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      {step.link}
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Fee Info */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-emerald-900 mb-2 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          수수료 안내
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="bg-white rounded-lg p-3 border border-emerald-100">
            <p className="text-xs text-gray-500 mb-1">온라인 등록 수수료</p>
            <p className="text-lg font-bold text-gray-900">50,000원</p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-emerald-100">
            <p className="text-xs text-gray-500 mb-1">등록면허세</p>
            <p className="text-lg font-bold text-gray-900">3,600원</p>
          </div>
        </div>
      </div>

      {/* CROS Link */}
      <div className="flex flex-col sm:flex-row gap-3">
        <a href="https://www.cros.or.kr" target="_blank" rel="noopener noreferrer"
          className="flex-1 py-3 px-6 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          한국저작권위원회(CROS) 바로가기
        </a>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-indigo-900">번거로우시면 행정사가 대행해드립니다</h3>
            <p className="text-xs text-indigo-700 mt-1">행정사합동사무소 정의 | 저작권 등록 전문 대행</p>
          </div>
          <a href="tel:070-8657-1888" className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
            070-8657-1888
          </a>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-indigo-900 mb-2">참고 사항</h3>
        <ul className="space-y-1.5 text-sm text-indigo-700">
          <li className="flex items-start gap-2"><span className="text-indigo-400 mt-1">-</span>저작권은 창작과 동시에 발생하며, 등록은 법적 추정력을 부여받기 위한 절차입니다.</li>
          <li className="flex items-start gap-2"><span className="text-indigo-400 mt-1">-</span>등록 시 분쟁 발생 시 저작자 추정의 법적 효력을 갖습니다 (저작권법 제53조).</li>
          <li className="flex items-start gap-2"><span className="text-indigo-400 mt-1">-</span>SW 소스코드 복제물은 비밀 유지 청구가 가능합니다 (복제물 비공개 신청).</li>
          <li className="flex items-start gap-2"><span className="text-indigo-400 mt-1">-</span>한국저작권위원회 문의: 1800-5455 (cros.or.kr)</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Tab 5: SW 전용 도구
// ═══════════════════════════════════════════════════

function SwToolsTab({
  sourceCode, onSourceCodeChange, processedCode, codeStats, isProcessing, codeError, onProcessCode, onCopyCode,
  creationDesc, onCreationDescChange, isGenerating, descError, descCopied, onGenerate, onCopyDesc, onPrintDesc,
  descTextareaRef, programName,
}: {
  sourceCode: string; onSourceCodeChange: (v: string) => void; processedCode: string; codeStats: CodeProcessStats | null;
  isProcessing: boolean; codeError: string; onProcessCode: () => void; onCopyCode: () => void;
  creationDesc: string; onCreationDescChange: (v: string) => void; isGenerating: boolean; descError: string;
  descCopied: boolean; onGenerate: () => void; onCopyDesc: () => void; onPrintDesc: () => void;
  descTextareaRef: React.RefObject<HTMLTextAreaElement>; programName: string;
}) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [activeSwTool, setActiveSwTool] = useState<"code" | "desc">("code");
  const charCount = creationDesc.replace(/\s/g, "").length;

  const handleCopyCode = () => {
    onCopyCode();
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Tool Toggle */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
        <button onClick={() => setActiveSwTool("code")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeSwTool === "code" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}>
          소스코드 마스킹 + 추출
        </button>
        <button onClick={() => setActiveSwTool("desc")}
          className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${activeSwTool === "desc" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-600 hover:text-gray-800"}`}>
          AI 창작의도 기술서
        </button>
      </div>

      {/* Code Masking Tool */}
      {activeSwTool === "code" && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
              <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <h2 className="text-sm font-semibold text-gray-900">소스코드 입력</h2>
              <span className="text-xs text-gray-400 ml-auto">{sourceCode.split("\n").length.toLocaleString()}줄 / {sourceCode.length.toLocaleString()}자</span>
            </div>
            <div className="p-5">
              <textarea value={sourceCode} onChange={(e) => onSourceCodeChange(e.target.value)}
                placeholder={"// 소스코드를 여기에 붙여넣으세요.\n// 여러 파일의 소스코드를 합쳐서 붙여넣을 수 있습니다.\n// 비밀정보(API 키, 비밀번호, 토큰 등)는 자동으로 마스킹됩니다."}
                rows={16} className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y bg-gray-50" spellCheck={false} />
              <div className="mt-3">
                <button onClick={onProcessCode} disabled={isProcessing || !sourceCode.trim()}
                  className="w-full sm:w-auto py-2.5 px-6 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                  {isProcessing ? (<><LoadingSpinner /><span>전처리 중...</span></>) : (
                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg><span>비밀정보 마스킹 + 30페이지 추출</span></>
                  )}
                </button>
              </div>
              {codeError && <ErrorMessage message={codeError} />}
            </div>
          </div>

          {/* Stats */}
          {codeStats && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                  마스킹 결과
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">마스킹된 항목</span><span className="font-medium text-orange-600">{codeStats.maskedCount}개</span></div>
                  {codeStats.maskedItems.map((item) => (<div key={item.label} className="flex justify-between text-xs"><span className="text-gray-400">{item.label}</span><span className="text-gray-600">{item.count}건</span></div>))}
                  {codeStats.maskedCount === 0 && <p className="text-xs text-gray-400">마스킹할 비밀정보가 발견되지 않았습니다.</p>}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  추출 결과
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-gray-500">전체 줄 수</span><span className="font-medium">{codeStats.totalLines.toLocaleString()}줄</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">추출된 줄 수</span><span className="font-medium text-blue-600">{codeStats.extractedLines.toLocaleString()}줄</span></div>
                  <div className="flex justify-between text-sm"><span className="text-gray-500">추출 페이지</span><span className="font-medium text-blue-600">{codeStats.extractedPages}페이지</span></div>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                  추출 구간
                </h3>
                <div className="space-y-2">
                  {codeStats.sections.map((s) => (<div key={s.label} className="flex justify-between text-sm"><span className="text-gray-500">{s.label}</span><span className="text-xs text-gray-400">{s.startLine}~{s.endLine}줄</span></div>))}
                </div>
              </div>
            </div>
          )}

          {/* Processed Code Preview */}
          {processedCode && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <h3 className="text-sm font-semibold text-gray-900">전처리 완료 코드</h3>
                </div>
                <button onClick={handleCopyCode}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                  {codeCopied ? (<><svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>복사됨</>) : (
                    <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>전처리 코드 복사</>
                  )}
                </button>
              </div>
              <div className="p-5">
                <pre className="max-h-[500px] overflow-y-auto bg-gray-50 rounded-lg p-4 text-xs font-mono text-gray-700 whitespace-pre-wrap border border-gray-200">{processedCode}</pre>
              </div>
            </div>
          )}
        </>
      )}

      {/* AI Description Tool */}
      {activeSwTool === "desc" && (
        <>
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">AI 창작의도 기술서 생성</h3>
                <p className="text-xs text-gray-500 mt-1">&apos;저작물 상세정보&apos; 탭에 입력한 SW 정보를 기반으로 AI가 한국저작권위원회 제출용 기술서를 생성합니다.</p>
              </div>
              <button onClick={onGenerate} disabled={isGenerating}
                className="w-full sm:w-auto py-2.5 px-6 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {isGenerating ? (<><LoadingSpinner /><span>기술서 생성 중...</span></>) : (
                  <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg><span>AI 생성</span></>
                )}
              </button>
            </div>
            {descError && <ErrorMessage message={descError} />}
          </div>

          {creationDesc ? (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <h3 className="text-sm font-semibold text-gray-900">창작의도 기술서 {programName && `- ${programName}`}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${charCount >= 1500 && charCount <= 2000 ? "bg-green-100 text-green-700" : charCount > 2000 ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {charCount.toLocaleString()}자
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={onCopyDesc} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                    {descCopied ? (<><svg className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>복사됨</>) : (
                      <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>복사</>
                    )}
                  </button>
                  <button onClick={onPrintDesc} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                    인쇄
                  </button>
                </div>
              </div>
              <div className="p-5">
                <textarea ref={descTextareaRef} value={creationDesc} onChange={(e) => onCreationDescChange(e.target.value)} rows={20}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y leading-relaxed" />
                <p className="mt-2 text-xs text-gray-400">생성된 내용을 직접 수정할 수 있습니다. 한국저작권위원회 권장 분량: 1,500~2,000자</p>
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
                      &apos;저작물 상세정보&apos; 탭에서 SW 정보를 작성한 후 &quot;AI 생성&quot; 버튼을 클릭하면
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
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// Shared Sub-Components
// ═══════════════════════════════════════════════════

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
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

function InputField({ label, value, onChange, placeholder, type = "text", required, className }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white" />
    </div>
  );
}

function DynamicList({ items, field, placeholder, onChange, onAdd, onRemove }: {
  items: string[]; field: "features" | "techStack"; placeholder: string;
  onChange: (field: "features" | "techStack", index: number, value: string) => void;
  onAdd: (field: "features" | "techStack") => void;
  onRemove: (field: "features" | "techStack", index: number) => void;
}) {
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{index + 1}.</span>
          <input type="text" value={item} onChange={(e) => onChange(field, index, e.target.value)} placeholder={placeholder}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white" />
          {items.length > 1 && (
            <button onClick={() => onRemove(field, index)} className="p-1.5 text-red-400 hover:text-red-600 transition-colors" title="삭제">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>
      ))}
      <button onClick={() => onAdd(field)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
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

// ─── Icons ───

const shieldIcon = (
  <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const infoIcon = (
  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const authorIcon = (
  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const detailIcon = (
  <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);
