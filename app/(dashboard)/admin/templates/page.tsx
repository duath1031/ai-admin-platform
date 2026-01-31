"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui";

interface TemplateField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
}

interface Template {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string;
  fields: TemplateField[];
  status: string;
  version: number;
  createdAt: string;
  gov24ServiceKey?: string;
  requiredDocs?: string;
  tips?: string;
}

const CATEGORIES = [
  { value: "", label: "전체" },
  { value: "사업자등록", label: "사업자등록" },
  { value: "인허가", label: "인허가" },
  { value: "노무", label: "노무" },
  { value: "세무", label: "세무" },
  { value: "지적재산권", label: "지적재산권" },
  { value: "법인", label: "법인" },
  { value: "기타", label: "기타" },
];

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/admin/templates");
      if (!res.ok) throw new Error("템플릿 로드 실패");
      const data = await res.json();
      if (!data.success) throw new Error("데이터 오류");
      setTemplates(data.templates || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = selectedCategory
    ? templates.filter((t) => t.category === selectedCategory)
    : templates;

  const categoryCount = (cat: string) =>
    cat ? templates.filter((t) => t.category === cat).length : templates.length;

  return (
    <div className="max-w-6xl mx-auto">
      {/* 헤더 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">템플릿 관리</h1>
        <p className="text-gray-500 mt-1">
          등록된 서류 양식 템플릿을 조회합니다. 총 {templates.length}개
        </p>
      </div>

      {/* 카테고리 필터 */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setSelectedCategory(cat.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              selectedCategory === cat.value
                ? "bg-violet-600 text-white shadow-md"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {cat.label} ({categoryCount(cat.value)})
          </button>
        ))}
      </div>

      {/* 에러 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <svg className="animate-spin w-8 h-8 text-violet-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* 템플릿 그리드 */}
      {!isLoading && (
        <div className="grid md:grid-cols-2 gap-4">
          {filtered.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                {/* 헤더 */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">{t.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      코드: {t.code}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-violet-100 text-violet-700 text-xs font-medium rounded-full">
                      {t.category}
                    </span>
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        t.status === "active"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {t.status === "active" ? "활성" : t.status}
                    </span>
                  </div>
                </div>

                {/* 설명 */}
                {t.description && (
                  <p className="text-sm text-gray-500 mb-3">{t.description}</p>
                )}

                {/* 메타 정보 */}
                <div className="flex gap-4 text-xs text-gray-400 mb-3">
                  <span>필드 {t.fields?.length || 0}개</span>
                  <span>v{t.version}</span>
                  {t.gov24ServiceKey && <span>정부24 연동</span>}
                </div>

                {/* 필드 목록 토글 */}
                <button
                  onClick={() =>
                    setExpandedId(expandedId === t.id ? null : t.id)
                  }
                  className="text-xs text-violet-600 hover:text-violet-800 font-medium"
                >
                  {expandedId === t.id ? "필드 접기" : "필드 보기"}
                </button>

                {/* 필드 상세 */}
                {expandedId === t.id && t.fields && (
                  <div className="mt-3 border-t pt-3 space-y-2">
                    {t.fields.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 bg-violet-400 rounded-full" />
                          <span className="text-gray-700">{f.label}</span>
                          {f.required && (
                            <span className="text-red-400 text-xs">*필수</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                          {f.type}
                        </span>
                      </div>
                    ))}

                    {/* 추가 정보 */}
                    {t.requiredDocs && (
                      <div className="pt-2 border-t">
                        <p className="text-xs text-gray-500">
                          <strong>필요 서류:</strong> {t.requiredDocs}
                        </p>
                      </div>
                    )}
                    {t.tips && (
                      <div className="pt-1">
                        <p className="text-xs text-gray-500">
                          <strong>팁:</strong> {t.tips}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 빈 상태 */}
      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">
            {selectedCategory
              ? `'${selectedCategory}' 카테고리에 등록된 템플릿이 없습니다.`
              : "등록된 템플릿이 없습니다."}
          </p>
        </div>
      )}
    </div>
  );
}
