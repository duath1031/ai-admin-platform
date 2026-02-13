"use client";

import { useState, useRef } from "react";

// ─── Types ───

type Tone = "formal" | "strong" | "diplomatic";

interface FormData {
  senderName: string;
  senderAddress: string;
  recipientName: string;
  recipientAddress: string;
  subject: string;
  details: string;
  demandAmount: string;
  demandDeadline: string;
  tone: Tone;
}

const INITIAL_FORM: FormData = {
  senderName: "",
  senderAddress: "",
  recipientName: "",
  recipientAddress: "",
  subject: "",
  details: "",
  demandAmount: "",
  demandDeadline: "",
  tone: "formal",
};

const TONE_OPTIONS: { value: Tone; label: string; desc: string }[] = [
  { value: "formal", label: "정중", desc: "객관적이고 명확한 어조" },
  { value: "strong", label: "강경", desc: "단호한 법적 경고 어조" },
  { value: "diplomatic", label: "외교적", desc: "협의 가능성을 열어둔 어조" },
];

// ─── Main Page ───

export default function LegalNoticePage() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [noticeContent, setNoticeContent] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const handleChange = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleSubmit = async () => {
    if (!form.senderName.trim()) {
      setError("발신인 이름을 입력해주세요.");
      return;
    }
    if (!form.recipientName.trim()) {
      setError("수신인 이름을 입력해주세요.");
      return;
    }
    if (!form.subject.trim()) {
      setError("내용증명 제목을 입력해주세요.");
      return;
    }
    if (!form.details.trim()) {
      setError("상세 내용을 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");
    setNoticeContent("");

    try {
      const res = await fetch("/api/labor/legal-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          demandAmount: form.demandAmount || undefined,
          demandDeadline: form.demandDeadline || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `서버 오류 (${res.status})`);
      }

      const data = await res.json();
      if (!data.success || !data.content) {
        throw new Error(data.error || "내용증명 생성에 실패했습니다.");
      }

      setNoticeContent(data.content);
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(noticeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = noticeContent;
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

    const today = new Date();
    const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일`;

    // 내용증명 본문에서 마크다운 서식 제거 및 HTML 변환
    const formattedContent = noticeContent
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/^### (.*$)/gm, '<h3 style="font-size:15px;font-weight:bold;margin:16px 0 8px;">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 style="font-size:16px;font-weight:bold;margin:20px 0 10px;">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 style="font-size:18px;font-weight:bold;margin:24px 0 12px;">$1</h1>')
      .replace(/\n/g, "<br>");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <title>내용증명 - ${form.subject}</title>
        <style>
          @page {
            size: A4;
            margin: 25mm 20mm;
          }
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Batang', 'Nanum Myeongjo', '바탕', serif;
            font-size: 14px;
            line-height: 1.8;
            color: #000;
            background: #fff;
          }
          .document {
            max-width: 700px;
            margin: 0 auto;
            padding: 40px 0;
          }
          .title {
            text-align: center;
            font-size: 24px;
            font-weight: bold;
            letter-spacing: 16px;
            margin-bottom: 40px;
            padding-bottom: 16px;
            border-bottom: 2px solid #000;
          }
          .info-section {
            margin-bottom: 30px;
          }
          .info-row {
            display: flex;
            margin-bottom: 6px;
          }
          .info-label {
            font-weight: bold;
            min-width: 100px;
          }
          .content-section {
            margin: 30px 0;
            text-align: justify;
            word-break: keep-all;
          }
          .signature-section {
            margin-top: 50px;
            text-align: center;
          }
          .date-line {
            margin-bottom: 30px;
            font-size: 14px;
          }
          .sender-line {
            font-size: 15px;
            font-weight: bold;
          }
          .seal-text {
            display: inline-block;
            margin-left: 20px;
            font-size: 13px;
            color: #666;
          }
          .footer-notice {
            margin-top: 40px;
            padding-top: 16px;
            border-top: 1px solid #ccc;
            text-align: center;
            font-size: 12px;
            color: #666;
          }
          .branding {
            margin-top: 20px;
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
          <div class="title">내 용 증 명</div>

          <div class="info-section">
            <div class="info-row">
              <span class="info-label">발 신 인:</span>
              <span>${form.senderName}${form.senderAddress ? ` (${form.senderAddress})` : ""}</span>
            </div>
            <div class="info-row">
              <span class="info-label">수 신 인:</span>
              <span>${form.recipientName}${form.recipientAddress ? ` (${form.recipientAddress})` : ""}</span>
            </div>
          </div>

          <div class="content-section">
            ${formattedContent}
          </div>

          <div class="signature-section">
            <div class="date-line">${dateStr}</div>
            <div class="sender-line">
              발신인: ${form.senderName} <span class="seal-text">(인)</span>
            </div>
          </div>

          <div class="footer-notice">
            위 내용을 우체국에서 내용증명 우편으로 발송합니다.
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
    setNoticeContent("");
    setError("");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">내용증명 AI</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                AI어드미니가 법적 효력을 갖춘 내용증명서를 작성합니다
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ─── Left Panel: Input Form ─── */}
          <div className="space-y-5 print:hidden">
            {/* 발신인 정보 */}
            <SectionCard title="발신인 정보" icon={senderIcon}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="발신인 이름"
                  value={form.senderName}
                  onChange={(v) => handleChange("senderName", v)}
                  placeholder="홍길동"
                  required
                />
                <InputField
                  label="발신인 주소"
                  value={form.senderAddress}
                  onChange={(v) => handleChange("senderAddress", v)}
                  placeholder="서울특별시 강남구..."
                  className="sm:col-span-1"
                />
              </div>
            </SectionCard>

            {/* 수신인 정보 */}
            <SectionCard title="수신인 정보" icon={recipientIcon}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="수신인 이름"
                  value={form.recipientName}
                  onChange={(v) => handleChange("recipientName", v)}
                  placeholder="김철수 / 주식회사 OO"
                  required
                />
                <InputField
                  label="수신인 주소"
                  value={form.recipientAddress}
                  onChange={(v) => handleChange("recipientAddress", v)}
                  placeholder="서울특별시 서초구..."
                  className="sm:col-span-1"
                />
              </div>
            </SectionCard>

            {/* 내용증명 내용 */}
            <SectionCard title="내용증명 내용" icon={documentIcon}>
              <div className="space-y-4">
                <InputField
                  label="제목"
                  value={form.subject}
                  onChange={(v) => handleChange("subject", v)}
                  placeholder="예: 임금 체불에 대한 지급 요청, 계약 해지 통지 등"
                  required
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    상세 내용 (사실관계) <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.details}
                    onChange={(e) => handleChange("details", e.target.value)}
                    placeholder={"사건의 경위를 시간순으로 상세히 기술해주세요.\n\n예시:\n- 2025년 3월 1일 근로계약 체결\n- 2025년 6월분~8월분 급여 미지급\n- 수차례 구두 독촉했으나 미이행"}
                    rows={8}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none resize-none"
                  />
                </div>
              </div>
            </SectionCard>

            {/* 청구 및 이행기한 */}
            <SectionCard title="청구 및 이행기한 (선택)" icon={currencyIcon}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="청구금액 (원)"
                  type="number"
                  value={form.demandAmount}
                  onChange={(v) => handleChange("demandAmount", v)}
                  placeholder="5,000,000"
                />
                <InputField
                  label="이행기한"
                  type="date"
                  value={form.demandDeadline}
                  onChange={(v) => handleChange("demandDeadline", v)}
                />
              </div>
              <p className="text-xs text-gray-400 mt-3">
                청구금액과 이행기한은 선택사항입니다. 금전 청구가 아닌 경우 비워두세요.
              </p>
            </SectionCard>

            {/* 어조 선택 */}
            <SectionCard title="어조 선택" icon={toneIcon}>
              <div className="grid grid-cols-3 gap-3">
                {TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleChange("tone", opt.value)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      form.tone === opt.value
                        ? "border-red-500 bg-red-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div
                      className={`text-sm font-semibold ${
                        form.tone === opt.value ? "text-red-700" : "text-gray-700"
                      }`}
                    >
                      {opt.label}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{opt.desc}</div>
                  </button>
                ))}
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
              className="w-full py-3 px-4 bg-red-600 text-white rounded-lg font-medium text-sm hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>AI어드미니가 내용증명을 작성 중입니다...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>AI 초안 생성</span>
                </>
              )}
            </button>
          </div>

          {/* ─── Right Panel: Preview / Result ─── */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            {noticeContent ? (
              <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
                {/* Preview Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <h3 className="text-sm font-semibold text-gray-900">생성된 내용증명</h3>
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
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
                    {noticeContent}
                  </div>

                  {/* 우체국 내용증명 안내 */}
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-800 mb-2">
                      우체국 내용증명 발송 안내
                    </h4>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>1. 내용증명서 3부를 동일하게 준비합니다 (발신인, 수신인, 우체국 보관용)</li>
                      <li>2. 가까운 우체국에 방문하여 &quot;내용증명&quot; 발송을 요청합니다</li>
                      <li>3. 발송료는 등기료 + 내용증명료 (약 2,650원~)입니다</li>
                    </ul>
                    <a
                      href="https://www.epost.go.kr/main.retrieveMainPage.comm"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-3 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      우체국 인터넷 내용증명 서비스 바로가기
                    </a>
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
                      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                        <svg className="animate-spin h-8 w-8 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        AI어드미니가 내용증명을 작성 중입니다...
                      </h3>
                      <p className="text-sm text-gray-500">
                        관련 법률 조항을 검토하고 법적 문서를 구성하고 있습니다
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">내용증명 미리보기</h3>
                      <p className="text-sm text-gray-500 max-w-xs">
                        왼쪽 양식을 작성한 후 &quot;AI 초안 생성&quot; 버튼을 클릭하면<br />
                        이곳에 생성된 내용증명서가 표시됩니다.
                      </p>
                      <div className="mt-6 space-y-2 text-left w-full max-w-xs">
                        <InfoBadge text="법적 효력을 갖춘 표준 내용증명 형식" />
                        <InfoBadge text="사실관계 + 법적근거 + 요구사항 자동 구성" />
                        <InfoBadge text="A4 인쇄용 레이아웃 지원" />
                        <InfoBadge text="정중/강경/외교적 어조 선택 가능" />
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
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-white"
      />
    </div>
  );
}

function InfoBadge({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
      <span>{text}</span>
    </div>
  );
}

// ─── Icons ───

const senderIcon = (
  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const recipientIcon = (
  <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const documentIcon = (
  <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const currencyIcon = (
  <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const toneIcon = (
  <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
  </svg>
);
