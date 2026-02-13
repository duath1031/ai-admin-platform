"use client";

import { useState, useMemo } from "react";

// ─── Data ───

const CATEGORIES = [
  { id: "all", name: "전체" },
  { id: "insurance", name: "4대보험" },
  { id: "labor", name: "노동/인사" },
  { id: "business", name: "사업자/법인" },
  { id: "construction", name: "건설/건축" },
  { id: "civil", name: "민원/신고" },
] as const;

type CategoryId = (typeof CATEGORIES)[number]["id"];

interface Template {
  id: string;
  name: string;
  category: Exclude<CategoryId, "all">;
  filename: string;
  description: string;
}

const TEMPLATES: Template[] = [
  // 4대보험
  { id: "1", name: "국민연금 취득신고서", category: "insurance", filename: "np-acquisition.hwpx", description: "국민연금 사업장 가입자 취득 신고" },
  { id: "2", name: "국민연금 상실신고서", category: "insurance", filename: "np-loss.hwpx", description: "국민연금 사업장 가입자 상실 신고" },
  { id: "3", name: "건강보험 취득신고서", category: "insurance", filename: "hi-acquisition.hwpx", description: "건강보험 직장가입자 취득 신고" },
  { id: "4", name: "건강보험 상실신고서", category: "insurance", filename: "hi-loss.hwpx", description: "건강보험 직장가입자 상실 신고" },
  { id: "5", name: "고용보험 취득신고서", category: "insurance", filename: "ei-acquisition.hwpx", description: "고용보험 피보험자격 취득 신고" },
  { id: "6", name: "고용보험 상실신고서", category: "insurance", filename: "ei-loss.hwpx", description: "고용보험 피보험자격 상실 신고" },
  { id: "7", name: "산재보험 성립신고서", category: "insurance", filename: "wi-establishment.hwpx", description: "산재보험 관계 성립 신고" },
  { id: "8", name: "보수월액변경 신고서", category: "insurance", filename: "salary-change.hwpx", description: "4대보험 보수월액 변경 신고" },
  // 노동/인사
  { id: "9", name: "근로계약서 (정규직)", category: "labor", filename: "labor-contract-regular.hwpx", description: "정규직 표준근로계약서" },
  { id: "10", name: "근로계약서 (계약직)", category: "labor", filename: "labor-contract-temp.hwpx", description: "기간제 근로계약서" },
  { id: "11", name: "퇴직금 정산서", category: "labor", filename: "severance-calc.hwpx", description: "퇴직금 산정 및 정산서" },
  { id: "12", name: "급여명세서", category: "labor", filename: "payslip.hwpx", description: "월 급여명세서 양식" },
  { id: "13", name: "재직증명서", category: "labor", filename: "employment-cert.hwpx", description: "재직증명서 표준 양식" },
  { id: "14", name: "경력증명서", category: "labor", filename: "career-cert.hwpx", description: "경력증명서 양식" },
  // 사업자/법인
  { id: "15", name: "사업자등록 신청서", category: "business", filename: "biz-registration.hwpx", description: "개인/법인 사업자등록 신청" },
  { id: "16", name: "법인설립등기 신청서", category: "business", filename: "corp-registration.hwpx", description: "법인설립등기 신청서" },
  { id: "17", name: "주주총회 의사록", category: "business", filename: "shareholders-minutes.hwpx", description: "주주총회 의사록 양식" },
  { id: "18", name: "이사회 의사록", category: "business", filename: "board-minutes.hwpx", description: "이사회 의사록 양식" },
  // 건설/건축
  { id: "19", name: "건축허가 신청서", category: "construction", filename: "building-permit.hwpx", description: "건축물 건축허가 신청" },
  { id: "20", name: "건설업 등록신청서", category: "construction", filename: "construction-reg.hwpx", description: "건설업 등록/변경 신청" },
  // 민원/신고
  { id: "21", name: "민원 신청서 (일반)", category: "civil", filename: "civil-general.hwpx", description: "일반 민원 신청서" },
  { id: "22", name: "위임장", category: "civil", filename: "power-of-attorney.hwpx", description: "행정사 위임장 양식" },
  { id: "23", name: "내용증명", category: "civil", filename: "legal-notice.hwpx", description: "내용증명 우편 양식" },
  { id: "24", name: "확인서", category: "civil", filename: "confirmation.hwpx", description: "확인서 일반 양식" },
];

// ─── Category color mapping ───

const CATEGORY_COLORS: Record<string, { bg: string; text: string; icon: string; badge: string }> = {
  insurance: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    icon: "text-blue-500",
    badge: "bg-blue-100 text-blue-700",
  },
  labor: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    icon: "text-emerald-500",
    badge: "bg-emerald-100 text-emerald-700",
  },
  business: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    icon: "text-purple-500",
    badge: "bg-purple-100 text-purple-700",
  },
  construction: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    icon: "text-orange-500",
    badge: "bg-orange-100 text-orange-700",
  },
  civil: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    icon: "text-rose-500",
    badge: "bg-rose-100 text-rose-700",
  },
};

function getCategoryName(catId: string): string {
  return CATEGORIES.find((c) => c.id === catId)?.name ?? catId;
}

// ─── Document Icon ───

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

// ─── Download Icon ───

function DownloadIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ─── Search Icon ───

function SearchIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-gray-400"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

// ─── Template Card ───

function TemplateCard({ template }: { template: Template }) {
  const colors = CATEGORY_COLORS[template.category];

  return (
    <div className="group relative flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-amber-300">
      {/* Top section: icon + badge */}
      <div className="flex items-start justify-between mb-3">
        <div className={`flex-shrink-0 rounded-lg p-2 ${colors.bg}`}>
          <DocumentIcon className={colors.icon} />
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.badge}`}
        >
          {getCategoryName(template.category)}
        </span>
      </div>

      {/* Name */}
      <h3 className="text-base font-semibold text-gray-900 mb-1 leading-tight">
        {template.name}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-500 mb-4 flex-grow">{template.description}</p>

      {/* Filename hint */}
      <p className="text-xs text-gray-400 mb-3 font-mono">{template.filename}</p>

      {/* Download button */}
      <a
        href={"/templates/hwpx/" + template.filename}
        download
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2"
      >
        <DownloadIcon />
        다운로드
      </a>
    </div>
  );
}

// ─── Main Page ───

export default function TemplateLibraryPage() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryId>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      // Category filter
      if (activeCategory !== "all" && t.category !== activeCategory) return false;
      // Search filter
      if (q && !t.name.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [search, activeCategory]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">
            서식함
          </h1>
          <p className="mt-2 text-amber-100 text-sm sm:text-base">
            행정 서류 양식을 다운로드할 수 있습니다
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-6">
        {/* Search + Filter Card */}
        <div className="rounded-xl bg-white p-4 shadow-md sm:p-6 mb-6">
          {/* Search */}
          <div className="relative mb-4">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="서식 이름 또는 설명으로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-3 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-amber-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-amber-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Result Count */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-amber-600">{filtered.length}개</span> 서식
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              검색 초기화
            </button>
          )}
        </div>

        {/* Template Grid */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pb-8">
            {filtered.map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white py-16 px-4 text-center">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-gray-300 mb-4"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            <p className="text-gray-500 font-medium mb-1">검색 결과가 없습니다</p>
            <p className="text-sm text-gray-400">
              다른 키워드로 검색하거나 카테고리를 변경해 보세요
            </p>
          </div>
        )}

        {/* Footer Note */}
        <div className="border-t border-gray-200 mt-4 py-6 text-center">
          <p className="text-xs text-gray-400">
            서식은 한글(HWP/HWPX) 형식입니다. 한컴오피스에서 열 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}
