"use client";

import { useState, useRef } from "react";

// ─── Types ───

type MeetingType = "board" | "shareholders" | "general" | "transcript";

interface FormData {
  meetingType: MeetingType;
  organizationName: string;
  meetingDate: string;
  meetingTime: string;
  location: string;
  chairperson: string;
  secretary: string;
  attendees: string;
  agendaItems: string;
  discussionContent: string;
  decisions: string;
  additionalNotes: string;
}

const INITIAL_FORM: FormData = {
  meetingType: "board",
  organizationName: "",
  meetingDate: "",
  meetingTime: "",
  location: "",
  chairperson: "",
  secretary: "",
  attendees: "",
  agendaItems: "",
  discussionContent: "",
  decisions: "",
  additionalNotes: "",
};

const MEETING_TYPE_TABS: { value: MeetingType; label: string; icon: string }[] = [
  { value: "board", label: "이사회 회의록", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
  { value: "shareholders", label: "주주총회 회의록", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" },
  { value: "general", label: "일반 회의록", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" },
  { value: "transcript", label: "녹취록", icon: "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" },
];

const TIP_MAP: Record<MeetingType, { title: string; tips: string[] }> = {
  board: {
    title: "이사회 회의록 작성 가이드",
    tips: [
      "상법 제391조의3에 따라 이사회 의사록은 법정 필수 문서입니다.",
      "출석 이사 및 감사의 이름을 정확히 기재해주세요.",
      "각 안건별 찬성/반대/기권 결과를 명확히 입력하면 더 정확한 회의록이 생성됩니다.",
      "의장(대표이사)과 출석이사 전원의 기명날인/서명이 필요합니다.",
    ],
  },
  shareholders: {
    title: "주주총회 회의록 작성 가이드",
    tips: [
      "상법 제373조에 의거, 주주총회 의사록은 법적 의무 문서입니다.",
      "발행주식총수, 출석주주 수, 의결권 있는 주식수를 안건에 포함하면 정족수 검증이 가능합니다.",
      "보통결의(출석의결권 과반수 + 발행주식 1/4)와 특별결의(2/3 + 1/3) 요건을 확인하세요.",
      "정기총회는 매 사업연도 종료 후 3개월 이내에 개최해야 합니다.",
    ],
  },
  general: {
    title: "일반 회의록 작성 가이드",
    tips: [
      "참석자 이름을 모두 기재하면 참석자 목록이 자동으로 정리됩니다.",
      "안건(의제)을 번호로 구분하여 입력하면 체계적인 회의록이 생성됩니다.",
      "각 안건별 담당자와 이행 기한이 있으면 결정사항에 포함해주세요.",
      "차기 회의 일정이 있으면 추가사항에 기재해주세요.",
    ],
  },
  transcript: {
    title: "녹취록 작성 가이드",
    tips: [
      "음성 녹취를 텍스트로 변환한 내용을 '회의/녹취 내용' 란에 붙여넣으세요.",
      "발언자를 구분할 수 있으면 \"홍길동: 발언내용\" 형식으로 입력하세요.",
      "발언자 구분이 어려우면 그대로 붙여넣어도 AI가 자동으로 정리합니다.",
      "녹취록은 법적 증거 자료로 활용될 수 있으므로 정확한 일시와 장소를 기재해주세요.",
    ],
  },
};

// ─── Main Page ───

export default function MeetingMinutesPage() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [resultContent, setResultContent] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleTabChange = (type: MeetingType) => {
    setForm((prev) => ({ ...prev, meetingType: type }));
    if (error) setError("");
  };

  const handleSubmit = async () => {
    if (!form.discussionContent.trim()) {
      setError(
        form.meetingType === "transcript"
          ? "녹취 내용을 입력해주세요."
          : "회의 내용을 입력해주세요."
      );
      return;
    }

    setIsLoading(true);
    setError("");
    setResultContent("");

    try {
      const res = await fetch("/api/labor/meeting-minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `서버 오류 (${res.status})`);
      }

      const data = await res.json();
      if (!data.success || !data.content) {
        throw new Error(data.error || "회의록 생성에 실패했습니다.");
      }

      setResultContent(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(resultContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = resultContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const typeLabels: Record<string, string> = {
      board: "이사회 회의록",
      shareholders: "주주총회 회의록",
      general: "일반 회의록",
      transcript: "녹취록",
    };

    const title = typeLabels[form.meetingType] || "회의록";

    printWindow.document.write(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <title>${title} - ${form.organizationName || "어드미니"}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm 15mm 20mm 15mm;
    }
    body {
      font-family: 'Batang', 'BatangChe', '바탕', '바탕체', serif;
      font-size: 12pt;
      line-height: 1.8;
      color: #111;
      white-space: pre-wrap;
      word-break: keep-all;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 10px;
      border-top: 1px solid #ccc;
      font-size: 9pt;
      color: #999;
    }
  </style>
</head>
<body>
${resultContent}
<div class="footer">어드미니(Admini) | aiadminplatform.vercel.app</div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const handleReset = () => {
    setResultContent("");
    setError("");
  };

  const currentTip = TIP_MAP[form.meetingType];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">회의록/녹취록 AI</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                AI어드미니가 상법 및 실무 기준에 맞는 회의록/녹취록을 자동 작성합니다
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Buttons */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto py-2 -mb-px">
            {MEETING_TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTabChange(tab.value)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  form.meetingType === tab.value
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50 border border-transparent"
                }`}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ─── Left Panel: Input Form ─── */}
          <div className="space-y-5 print:hidden">
            {/* 기본 정보 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
                <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-900">기본 정보</h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="단체/법인명"
                    value={form.organizationName}
                    onChange={(v) => handleChange("organizationName", v)}
                    placeholder="주식회사 어드미니"
                    className="sm:col-span-2"
                  />
                  <InputField
                    label="회의 일자"
                    type="date"
                    value={form.meetingDate}
                    onChange={(v) => handleChange("meetingDate", v)}
                  />
                  <InputField
                    label="회의 시간"
                    type="time"
                    value={form.meetingTime}
                    onChange={(v) => handleChange("meetingTime", v)}
                  />
                  <InputField
                    label="장소"
                    value={form.location}
                    onChange={(v) => handleChange("location", v)}
                    placeholder="본사 회의실"
                    className="sm:col-span-2"
                  />
                </div>
              </div>
            </div>

            {/* 참석자 정보 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
                <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-900">참석자 정보</h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="의장/사회자"
                    value={form.chairperson}
                    onChange={(v) => handleChange("chairperson", v)}
                    placeholder="홍길동 대표이사"
                  />
                  <InputField
                    label="서기/작성자"
                    value={form.secretary}
                    onChange={(v) => handleChange("secretary", v)}
                    placeholder="김철수 사무국장"
                  />
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      참석자 목록
                    </label>
                    <textarea
                      value={form.attendees}
                      onChange={(e) => handleChange("attendees", e.target.value)}
                      placeholder={
                        form.meetingType === "board"
                          ? "이사 홍길동, 이사 김영희, 이사 박민수, 감사 이정호"
                          : form.meetingType === "shareholders"
                          ? "주주 홍길동(3,000주), 주주 김영희(2,000주), 주주 박민수(1,000주)"
                          : "참석자 이름을 쉼표 또는 줄바꿈으로 구분하여 입력"
                      }
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 안건 및 내용 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
                <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-900">
                  {form.meetingType === "transcript" ? "녹취 내용" : "안건 및 회의 내용"}
                </h2>
              </div>
              <div className="p-5 space-y-4">
                {form.meetingType !== "transcript" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      안건/의제
                    </label>
                    <textarea
                      value={form.agendaItems}
                      onChange={(e) => handleChange("agendaItems", e.target.value)}
                      placeholder={
                        form.meetingType === "board"
                          ? "제1호 안건: 2025년도 재무제표 승인의 건\n제2호 안건: 신규 사업 투자 승인의 건\n제3호 안건: 이사 보수 한도 결정의 건"
                          : form.meetingType === "shareholders"
                          ? "제1호 의안: 제5기 재무제표 승인의 건\n제2호 의안: 이사 선임의 건\n제3호 의안: 이사 보수 한도 승인의 건"
                          : "1. 신규 프로젝트 진행 현황\n2. 예산 집행 보고\n3. 차기 일정 논의"
                      }
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {form.meetingType === "transcript" ? (
                      <>녹취 내용 <span className="text-red-500">*</span></>
                    ) : (
                      <>회의 내용 <span className="text-red-500">*</span></>
                    )}
                  </label>
                  {form.meetingType === "transcript" && (
                    <p className="text-xs text-gray-500 mb-2">
                      음성 녹취를 텍스트로 변환한 내용(STT 결과)을 아래에 붙여넣으세요. AI가 발언자별로 정리하고 핵심 내용을 요약합니다.
                    </p>
                  )}
                  <textarea
                    value={form.discussionContent}
                    onChange={(e) => handleChange("discussionContent", e.target.value)}
                    placeholder={
                      form.meetingType === "transcript"
                        ? "홍길동: 오늘 회의를 시작하겠습니다. 먼저 지난주 매출 현황을 보고해 주시기 바랍니다.\n김영희: 네, 지난주 매출은 전주 대비 15% 증가한 5억 2천만원을 기록했습니다.\n박민수: 마케팅 캠페인 효과가 큰 것 같습니다. 특히 SNS 광고의 전환율이...\n\n(음성인식 텍스트 또는 녹취 내용을 그대로 붙여넣어 주세요)"
                        : form.meetingType === "board"
                        ? "제1호 안건에 대해 재무이사가 2025년 매출 150억원, 영업이익 20억원을 보고함. 전년 대비 매출 12% 증가. 출석이사 전원 찬성으로 원안 가결.\n\n제2호 안건에 대해 신규 AI 플랫폼 사업 투자 3억원 건을 논의. 사업계획서 기반 ROI 설명 후 출석이사 3인 찬성, 1인 기권으로 가결."
                        : form.meetingType === "shareholders"
                        ? "의장이 출석주주 확인 후 성원이 되었음을 선포. 총 발행주식 10,000주 중 7,000주 출석(70%).\n\n제1호 의안: 재무이사가 제5기 재무제표를 설명. 매출 150억, 당기순이익 15억. 출석주주 전원 찬성으로 원안 승인.\n\n제2호 의안: 이사 후보 3인 소개 후 표결. 찬성 6,500주, 반대 500주로 전원 선임."
                        : "프로젝트 현황 보고 후 일정 조정 논의. 김 팀장이 현재 진행률 80% 보고. 추가 인력 1명 투입 필요성 제기. 다음 주까지 최종 산출물 제출 합의."
                    }
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    결정사항
                  </label>
                  <textarea
                    value={form.decisions}
                    onChange={(e) => handleChange("decisions", e.target.value)}
                    placeholder={
                      form.meetingType === "board" || form.meetingType === "shareholders"
                        ? "1. 2025년도 재무제표 원안대로 승인\n2. 신규 사업 투자 3억원 승인 (이행기한: 2026.03.31)\n3. 이사 보수 한도 연 5억원으로 결정"
                        : "1. 추가 인력 1명 채용 승인 (담당: 인사팀, 기한: 2주 이내)\n2. 최종 보고서 다음 주 금요일까지 제출"
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    추가사항
                  </label>
                  <textarea
                    value={form.additionalNotes}
                    onChange={(e) => handleChange("additionalNotes", e.target.value)}
                    placeholder="차기 회의 일정, 특이사항, 비고 등"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                  />
                </div>
              </div>
            </div>

            {/* Tip Box */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-indigo-800 mb-1">{currentTip.title}</h3>
                  <ul className="space-y-1">
                    {currentTip.tips.map((tip, i) => (
                      <li key={i} className="text-xs text-indigo-700 flex items-start gap-1.5">
                        <span className="text-indigo-400 mt-0.5 flex-shrink-0">-</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

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
              className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>AI어드미니가 {form.meetingType === "transcript" ? "녹취록" : "회의록"}을 작성 중입니다...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>AI어드미니 {form.meetingType === "transcript" ? "녹취록" : "회의록"} 생성</span>
                </>
              )}
            </button>

            {/* Disclaimer */}
            <p className="text-xs text-gray-400 text-center px-4">
              AI가 생성한 회의록/녹취록은 참고용이며, 최종 문서는 반드시 사실관계를 확인한 후 사용하시기 바랍니다.
              법적 효력이 필요한 문서(이사회/주주총회 의사록 등)는 관련 법령의 요건을 별도로 확인해주세요.
            </p>
          </div>

          {/* ─── Right Panel: Preview / Result ─── */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            {resultContent ? (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                {/* Preview Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      생성된 {form.meetingType === "transcript" ? "녹취록" : "회의록"}
                    </h3>
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
                          텍스트 복사
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
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
                    {resultContent}
                  </div>
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
                      <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                        <svg className="animate-spin h-8 w-8 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        AI어드미니가 {form.meetingType === "transcript" ? "녹취록" : "회의록"}을 작성 중입니다...
                      </h3>
                      <p className="text-sm text-gray-500">
                        {form.meetingType === "board"
                          ? "상법 제391조의3 이사회 의사록 요건을 검토하고 있습니다"
                          : form.meetingType === "shareholders"
                          ? "상법 제373조 주주총회 의사록 요건을 검토하고 있습니다"
                          : form.meetingType === "transcript"
                          ? "녹취 내용을 분석하고 발언자별로 정리하고 있습니다"
                          : "회의 내용을 체계적으로 정리하고 있습니다"
                        }
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
                        {form.meetingType === "transcript" ? "녹취록" : "회의록"} 미리보기
                      </h3>
                      <p className="text-sm text-gray-500 max-w-xs">
                        왼쪽 양식을 작성한 후 &quot;AI {form.meetingType === "transcript" ? "녹취록" : "회의록"} 생성&quot; 버튼을 클릭하면
                        <br />
                        이곳에 생성된 문서가 표시됩니다.
                      </p>
                      <div className="mt-6 space-y-2 text-left w-full max-w-xs">
                        {form.meetingType === "board" && (
                          <>
                            <InfoBadge text="상법 제391조의3 법정 기재사항 준수" />
                            <InfoBadge text="안건별 의결 결과 자동 정리" />
                            <InfoBadge text="출석이사 기명날인/서명란 포함" />
                          </>
                        )}
                        {form.meetingType === "shareholders" && (
                          <>
                            <InfoBadge text="상법 제373조 법정 기재사항 준수" />
                            <InfoBadge text="정족수 검증 및 표결 결과 정리" />
                            <InfoBadge text="보통결의/특별결의 구분 반영" />
                          </>
                        )}
                        {form.meetingType === "general" && (
                          <>
                            <InfoBadge text="안건별 논의 내용 체계적 정리" />
                            <InfoBadge text="담당자 및 이행기한 명시" />
                            <InfoBadge text="비즈니스 표준 회의록 형식" />
                          </>
                        )}
                        {form.meetingType === "transcript" && (
                          <>
                            <InfoBadge text="발언자별 발언 내용 시간순 정리" />
                            <InfoBadge text="핵심 논의사항 별도 요약" />
                            <InfoBadge text="법적 증거력을 위한 형식 준수" />
                          </>
                        )}
                      </div>
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
