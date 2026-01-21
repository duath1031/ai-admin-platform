"use client";

import { useState, useRef } from "react";
import { Card, CardContent, Button, Textarea } from "@/components/ui";

interface ReviewResult {
  completeness: number;
  analysis: string;
  issues: Array<{
    type: string;
    description: string;
    severity: "high" | "medium" | "low";
  }>;
  suggestions: string[];
}

export default function ReviewPage() {
  const [content, setContent] = useState("");
  const [documentType, setDocumentType] = useState("general");
  const [isReviewing, setIsReviewing] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documentTypes = [
    { id: "general", name: "일반 서류" },
    { id: "petition", name: "진정서" },
    { id: "appeal", name: "탄원서" },
    { id: "objection", name: "이의신청서" },
    { id: "application", name: "신청서" },
    { id: "contract", name: "계약서" },
  ];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === "text/plain") {
      const text = await file.text();
      setContent(text);
    } else {
      alert("현재는 텍스트(.txt) 파일만 지원합니다.");
    }
  };

  const handleReview = async () => {
    if (!content.trim()) {
      alert("검토할 내용을 입력해주세요.");
      return;
    }

    setIsReviewing(true);
    setResult(null);

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, documentType }),
      });

      const data = await response.json();

      if (data.error) {
        alert(data.error);
      } else {
        setResult(data);
      }
    } catch (error) {
      alert("검토 중 오류가 발생했습니다.");
    } finally {
      setIsReviewing(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-700 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "low":
        return "bg-blue-100 text-blue-700 border-blue-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case "high":
        return "높음";
      case "medium":
        return "보통";
      case "low":
        return "낮음";
      default:
        return severity;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">서류 검토</h1>
        <p className="text-gray-600">
          AI가 작성된 서류를 분석하여 누락된 항목, 형식 오류, 개선점을 안내해 드립니다
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Input Section */}
        <div>
          <Card>
            <CardContent className="p-6">
              {/* Document Type Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  서류 종류
                </label>
                <select
                  value={documentType}
                  onChange={(e) => setDocumentType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {documentTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div className="mb-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  파일 업로드 (.txt)
                </Button>
              </div>

              {/* Content Input */}
              <Textarea
                label="검토할 내용"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="검토받을 서류 내용을 붙여넣기 하거나 직접 입력하세요..."
                rows={15}
              />

              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {content.length}자
                </span>
                <Button
                  onClick={handleReview}
                  isLoading={isReviewing}
                  disabled={content.trim().length < 50}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  AI 검토 시작
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Result Section */}
        <div>
          {!result && !isReviewing && (
            <Card className="h-full">
              <CardContent className="p-6 h-full flex flex-col items-center justify-center text-gray-500">
                <svg className="w-16 h-16 mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="text-center">
                  왼쪽에 서류 내용을 입력하고<br />
                  검토 버튼을 클릭하세요
                </p>
              </CardContent>
            </Card>
          )}

          {isReviewing && (
            <Card className="h-full">
              <CardContent className="p-6 h-full flex flex-col items-center justify-center">
                <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-600">AI가 서류를 분석하고 있습니다...</p>
              </CardContent>
            </Card>
          )}

          {result && (
            <div className="space-y-4">
              {/* Completeness Score */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">완성도 점수</h3>
                    <span className={`text-2xl font-bold ${
                      result.completeness >= 80 ? "text-green-600" :
                      result.completeness >= 60 ? "text-yellow-600" : "text-red-600"
                    }`}>
                      {result.completeness}점
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        result.completeness >= 80 ? "bg-green-500" :
                        result.completeness >= 60 ? "bg-yellow-500" : "bg-red-500"
                      }`}
                      style={{ width: `${result.completeness}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Analysis */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold text-gray-900 mb-3">분석 결과</h3>
                  <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {result.analysis}
                  </p>
                </CardContent>
              </Card>

              {/* Issues */}
              {result.issues && result.issues.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">
                      발견된 문제점 ({result.issues.length}건)
                    </h3>
                    <div className="space-y-3">
                      {result.issues.map((issue, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border ${getSeverityColor(issue.severity)}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/50">
                              {getSeverityLabel(issue.severity)}
                            </span>
                            <span className="font-medium">{issue.type}</span>
                          </div>
                          <p className="text-sm">{issue.description}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Suggestions */}
              {result.suggestions && result.suggestions.length > 0 && (
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-gray-900 mb-3">개선 제안</h3>
                    <ul className="space-y-2">
                      {result.suggestions.map((suggestion, index) => (
                        <li key={index} className="flex items-start gap-2 text-gray-700">
                          <svg className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
