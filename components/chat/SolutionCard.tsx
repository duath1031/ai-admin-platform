"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui";
import { FORM_TEMPLATES } from "@/lib/document/templates";
import { GOV24_SERVICES } from "@/lib/document/gov24Links";

interface SolutionCardProps {
  templateKey: string;
  collectedData?: Record<string, string>;
}

/**
 * AI가 서류 생성을 제안할 때 표시되는 솔루션 카드
 * - 서식 정보 표시
 * - 필요 정보 입력 폼
 * - 문서 생성 및 다운로드
 * - 정부24 딥링크
 */
export default function SolutionCard({ templateKey, collectedData = {} }: SolutionCardProps) {
  const [formData, setFormData] = useState<Record<string, string>>(collectedData);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false);
  const [generatedFilePath, setGeneratedFilePath] = useState<string | null>(null);
  const [isSubmittingRpa, setIsSubmittingRpa] = useState(false);
  const [rpaStatus, setRpaStatus] = useState<'idle' | 'generating' | 'submitting' | 'success' | 'error'>('idle');
  const [rpaMessage, setRpaMessage] = useState('');
  const [dbTemplate, setDbTemplate] = useState<{
    name: string;
    category: string;
    description: string;
    fields: Array<{ id: string; label: string; type: string; required?: boolean; placeholder?: string; description?: string; options?: string[]; defaultValue?: string }>;
    gov24ServiceKey?: string;
    outputFileName?: string;
    source?: string;
  } | null>(null);

  const legacyTemplate = FORM_TEMPLATES[templateKey];
  const isHwpx = templateKey.startsWith("hwpx_");

  // DB 템플릿 조회 (레거시에 없을 때)
  useEffect(() => {
    if (legacyTemplate) return;

    setIsLoadingTemplate(true);
    fetch(`/api/document/generate?templateKey=${encodeURIComponent(templateKey)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.template) {
          const t = data.template;
          const mappedFields = (t.fields || []).map((f: any) => ({
            id: f.name || f.id,
            label: f.label || f.name,
            type: f.type || "text",
            required: f.required !== false,
            placeholder: f.placeholder || "",
            description: f.description || "",
            options: f.options,
            defaultValue: f.defaultValue,
          }));
          setDbTemplate({
            name: t.name,
            category: t.category || "",
            description: t.description || "",
            fields: mappedFields,
            gov24ServiceKey: t.gov24ServiceKey,
            outputFileName: t.outputFileName,
            source: t.source,
          });
        }
      })
      .catch((err) => console.error("Template fetch error:", err))
      .finally(() => setIsLoadingTemplate(false));
  }, [templateKey, legacyTemplate]);

  const template = legacyTemplate || dbTemplate;
  const gov24Service = (() => {
    const key = legacyTemplate?.gov24ServiceKey || dbTemplate?.gov24ServiceKey;
    return key ? GOV24_SERVICES[key] : null;
  })();

  if (!template && isLoadingTemplate) {
    return (
      <div className="my-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-blue-700 text-sm">서식 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700 text-sm">템플릿을 찾을 수 없습니다: {templateKey}</p>
      </div>
    );
  }

  const handleInputChange = (fieldId: string, value: string) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    setError(null);
  };

  const handleGenerateDocument = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      let response: Response;
      let fileExt: string;
      let mimeType: string;

      if (isHwpx) {
        // HWPX 템플릿: generate-hwpx API 사용 (saveForRpa 포함)
        const hwpxRes = await fetch("/api/document/generate-hwpx", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateCode: templateKey,
            data: formData,
            returnFormat: "base64",
            saveForRpa: true,
          }),
        });
        const hwpxData = await hwpxRes.json();

        if (!hwpxRes.ok || !hwpxData.success) {
          throw new Error(hwpxData.error || "HWPX 생성 실패");
        }

        // RPA용 경로 저장
        if (hwpxData.tempFilePath) {
          setGeneratedFilePath(hwpxData.tempFilePath);
        }

        // base64 → Blob으로 변환하여 다운로드
        const binaryStr = atob(hwpxData.base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/hwp+zip" });

        const today = new Date();
        const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
        const timeStr = `${String(today.getHours()).padStart(2, "0")}${String(today.getMinutes()).padStart(2, "0")}`;
        const fileName = hwpxData.filename || `document_${dateStr}_${timeStr}.hwpx`;

        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = fileName;
        link.style.display = "none";
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          window.URL.revokeObjectURL(downloadUrl);
          document.body.removeChild(link);
        }, 100);

        setIsGenerating(false);
        return; // HWPX는 여기서 완료
      }

      // DOCX 템플릿: 기존 generate API 사용
      response = await fetch("/api/document/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey,
          formData,
          format: "docx",
        }),
      });
      fileExt = "docx";
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      // Content-Type 확인하여 JSON 에러 응답 처리
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        throw new Error(errorData.error || "문서 생성 실패");
      }

      if (!response.ok) {
        throw new Error("문서 생성 실패 (서버 오류)");
      }

      // ArrayBuffer로 받아서 Blob으로 변환
      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: mimeType });

      // 파일명 생성
      const today = new Date();
      const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      const timeStr = `${String(today.getHours()).padStart(2, "0")}${String(today.getMinutes()).padStart(2, "0")}`;
      const fileName = `document_${dateStr}_${timeStr}.${fileExt}`;

      // 다운로드 링크 생성 및 클릭
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      // 정리
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(link);
      }, 100);
    } catch (err) {
      console.error("Document generation error:", err);
      setError(err instanceof Error ? err.message : "문서 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  // 필수 필드 중 누락된 것 확인
  const missingFields = template.fields.filter(
    (field) => field.required && !formData[field.id]
  );

  const canGenerate = missingFields.length === 0;

  return (
    <div className="my-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl overflow-hidden">
      {/* 헤더 */}
      <div
        className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold">{template.name}</h3>
            <p className="text-sm text-blue-100">{template.category}</p>
          </div>
        </div>
        <svg
          className={`w-5 h-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* 설명 */}
          <p className="text-sm text-gray-600">{template.description}</p>

          {/* 입력 폼 */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              서류 작성 정보
            </h4>

            <div className="grid gap-3">
              {template.fields.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>

                  {field.type === "select" ? (
                    <select
                      value={formData[field.id] || ""}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    >
                      <option value="">선택하세요</option>
                      {field.options?.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      value={formData[field.id] || ""}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                    />
                  ) : (
                    <input
                      type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                      value={formData[field.id] || ""}
                      onChange={(e) => handleInputChange(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  )}

                  {field.description && (
                    <p className="text-xs text-gray-500 mt-1">{field.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* 누락 필드 안내 */}
          {!canGenerate && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-700 text-sm">
                <span className="font-medium">필수 항목 누락:</span>{" "}
                {missingFields.map((f) => f.label).join(", ")}
              </p>
            </div>
          )}

          {/* 문서 생성 버튼 */}
          <button
            onClick={handleGenerateDocument}
            disabled={!canGenerate || isGenerating}
            className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
              canGenerate && !isGenerating
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-200 text-gray-500 cursor-not-allowed"
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                문서 생성 중...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                서류 다운로드 ({isHwpx ? "HWPX" : "DOCX"})
              </>
            )}
          </button>

          {/* RPA 접수 대행 (HWPX 생성 후 표시) */}
          {isHwpx && generatedFilePath && (
            <div className="pt-4 border-t border-blue-200">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                접수 대행 (RPA 자동 접수)
              </h4>
              <p className="text-xs text-gray-500 mb-3">
                작성된 서류를 정부24에 자동으로 접수합니다.
                도장 날인이 필요한 경우 서류를 출력하여 날인 후 스캔하여 채팅창에 업로드해주세요.
              </p>

              {rpaStatus === 'idle' && (
                <button
                  onClick={async () => {
                    setRpaStatus('submitting');
                    setRpaMessage('정부24 접수 준비 중...');
                    try {
                      const res = await fetch('/api/rpa/submit-v2', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          mode: 'upload',
                          filePath: generatedFilePath,
                        }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setRpaStatus('success');
                        setRpaMessage(data.message || '접수가 완료되었습니다.');
                      } else {
                        setRpaStatus('error');
                        setRpaMessage(data.error || '접수 중 오류가 발생했습니다.');
                      }
                    } catch {
                      setRpaStatus('error');
                      setRpaMessage('서버 연결 오류가 발생했습니다.');
                    }
                  }}
                  className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  정부24 자동 접수하기
                </button>
              )}

              {rpaStatus === 'submitting' && (
                <div className="flex items-center gap-3 py-3 px-4 bg-teal-100 rounded-lg">
                  <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                  <span className="text-teal-700 text-sm font-medium">{rpaMessage}</span>
                </div>
              )}

              {rpaStatus === 'success' && (
                <div className="py-3 px-4 bg-green-100 border border-green-200 rounded-lg">
                  <p className="text-green-700 text-sm font-medium">{rpaMessage}</p>
                </div>
              )}

              {rpaStatus === 'error' && (
                <div className="space-y-2">
                  <div className="py-3 px-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 text-sm">{rpaMessage}</p>
                  </div>
                  <button
                    onClick={() => setRpaStatus('idle')}
                    className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                  >
                    다시 시도
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 정부24 딥링크 */}
          {gov24Service && (
            <div className="pt-4 border-t border-blue-200">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                정부24 바로가기
              </h4>

              <a
                href={gov24Service.applyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-white border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-green-700">{gov24Service.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      처리기간: {gov24Service.processingDays} | 수수료: {gov24Service.fee}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              </a>

              {/* 필요 서류 */}
              {gov24Service.requiredDocs.length > 0 && (
                <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs font-medium text-gray-700 mb-2">필요 서류</p>
                  <ul className="text-xs text-gray-600 space-y-1">
                    {gov24Service.requiredDocs.map((doc, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {doc}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 팁 */}
              {gov24Service.tips && gov24Service.tips.length > 0 && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs font-medium text-yellow-800 mb-2">신청 팁</p>
                  <ul className="text-xs text-yellow-700 space-y-1">
                    {gov24Service.tips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-yellow-500">-</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 제출 안내 */}
          <div className="pt-4 border-t border-blue-200">
            <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              제출 방법
            </h4>
            <ol className="text-sm text-gray-600 space-y-2">
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                위 버튼을 클릭하여 작성된 서류를 다운로드합니다.
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                다운로드된 파일의 내용을 확인하고 필요시 수정합니다.
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">3</span>
                정부24 바로가기를 클릭하여 로그인 후 민원을 신청합니다.
              </li>
              <li className="flex items-start gap-2">
                <span className="flex-shrink-0 w-5 h-5 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center text-xs font-bold">4</span>
                첨부파일에 다운로드한 서류를 업로드합니다.
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
