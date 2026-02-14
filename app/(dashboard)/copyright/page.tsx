"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ─── Types ───

type CopyrightType = "literary" | "art" | "software" | "music";

interface FeeRow {
  category: string;
  fee: string;
  note: string;
}

interface DocumentItem {
  label: string;
  required: boolean;
  note?: string;
}

// ─── Constants ───

const COPYRIGHT_TYPES: {
  id: CopyrightType;
  label: string;
  emoji: string;
  desc: string;
  examples: string;
  color: string;
}[] = [
  {
    id: "literary",
    label: "어문저작물",
    emoji: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    desc: "소설, 시, 논문, 블로그, 강연, 각본 등",
    examples: "소설, 논문, 시나리오, 웹소설, 블로그 글",
    color: "blue",
  },
  {
    id: "art",
    label: "미술저작물",
    emoji: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
    desc: "회화, 디자인, 일러스트, 조각, 공예",
    examples: "로고, 캐릭터, 일러스트, UI 디자인",
    color: "purple",
  },
  {
    id: "software",
    label: "프로그램저작물",
    emoji: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4",
    desc: "소프트웨어, 앱, 게임, 웹서비스",
    examples: "모바일앱, 웹사이트, 게임, SaaS",
    color: "green",
  },
  {
    id: "music",
    label: "음악저작물",
    emoji: "M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3",
    desc: "작곡, 편곡, 가사, 음원",
    examples: "음원, 효과음, BGM, 가사",
    color: "orange",
  },
];

const REGISTRATION_STEPS = [
  {
    step: 1,
    title: "CROS 접속",
    desc: "cros.or.kr에서 회원가입 또는 비회원 접속",
  },
  {
    step: 2,
    title: "등록신청서 작성",
    desc: "저작물 유형 선택 후 신청서 온라인 작성",
  },
  {
    step: 3,
    title: "본인인증",
    desc: "PASS 또는 카카오 간편인증으로 본인확인",
  },
  {
    step: 4,
    title: "수수료 결제",
    desc: "신용카드 또는 실시간 계좌이체로 납부",
  },
  {
    step: 5,
    title: "접수 및 심사",
    desc: "접수번호 확인 후 약 1~2주 심사 대기",
  },
];

const FEE_TABLE: FeeRow[] = [
  { category: "일반저작물 (온라인)", fee: "20,000원", note: "오프라인 30,000원" },
  { category: "프로그램저작물 (온라인)", fee: "50,000원", note: "오프라인 60,000원" },
  { category: "등록면허세", fee: "3,600원", note: "교육세 포함" },
];

const TYPE_DOCUMENTS: Record<CopyrightType, DocumentItem[]> = {
  literary: [
    { label: "저작권 등록신청서", required: true, note: "CROS에서 온라인 작성" },
    { label: "등록신청명세서", required: true },
    { label: "저작물 복제물 (원고 파일, PDF 등)", required: true, note: "전자파일 업로드" },
    { label: "공표사실 증명서류", required: false, note: "출판된 경우" },
    { label: "대리인 위임장", required: false, note: "행정사 대리 신청 시" },
  ],
  art: [
    { label: "저작권 등록신청서", required: true, note: "CROS에서 온라인 작성" },
    { label: "등록신청명세서", required: true },
    { label: "저작물 사진 또는 도면", required: true, note: "고해상도 이미지 파일" },
    { label: "창작 과정 증빙자료", required: false, note: "스케치, 작업 기록 등" },
    { label: "대리인 위임장", required: false, note: "행정사 대리 신청 시" },
  ],
  software: [
    { label: "프로그램 등록신청서", required: true, note: "CROS에서 온라인 작성" },
    { label: "프로그램 명세서 (창작의도 기술서)", required: true, note: "1,500~2,000자" },
    { label: "소스코드 복제물 (30페이지)", required: true, note: "비밀정보 마스킹 처리" },
    { label: "신분증 또는 사업자등록증 사본", required: true },
    { label: "대리인 위임장", required: false, note: "행정사 대리 신청 시" },
  ],
  music: [
    { label: "저작권 등록신청서", required: true, note: "CROS에서 온라인 작성" },
    { label: "등록신청명세서", required: true },
    { label: "악보 또는 음원 파일", required: true, note: "MP3, WAV, PDF 악보" },
    { label: "가사 (가사 포함 시)", required: false },
    { label: "대리인 위임장", required: false, note: "행정사 대리 신청 시" },
  ],
};

const TYPE_DETAIL_INFO: Record<CopyrightType, { legalEffect: string[]; tips: string[]; duration: string }> = {
  literary: {
    legalEffect: [
      "저작자 추정 효력 (저작권법 제53조 제3항)",
      "침해 시 과실 추정 (저작권법 제125조 제4항)",
      "제3자 대항력 확보",
      "세관 통관보류 신청 가능",
    ],
    tips: [
      "창작일로부터 1년 이내 등록 시 창작일 추정 효력 발생",
      "출판 전이라도 등록 가능 (미공표 저작물)",
      "블로그/SNS 게시물도 어문저작물로 등록 가능",
    ],
    duration: "약 1~2주 (영업일 기준)",
  },
  art: {
    legalEffect: [
      "저작자 추정 효력 (저작권법 제53조 제3항)",
      "침해 시 과실 추정 (저작권법 제125조 제4항)",
      "제3자 대항력 확보",
      "세관 통관보류 신청 가능",
    ],
    tips: [
      "디자인 도용 분쟁 시 강력한 증거로 활용",
      "로고/캐릭터는 상표권과 별도로 저작권 등록 권장",
      "AI로 생성한 이미지는 인간의 창작적 기여가 있어야 등록 가능",
    ],
    duration: "약 1~2주 (영업일 기준)",
  },
  software: {
    legalEffect: [
      "프로그램 저작자 추정 효력",
      "침해 시 과실 추정 + 손해배상 청구 유리",
      "기술탈취 분쟁 시 선 창작 입증 가능",
      "세무조사 시 R&D 비용 증빙",
    ],
    tips: [
      "소스코드 비밀정보(API키, 비밀번호 등) 반드시 마스킹",
      "30페이지 추출: 처음 10p + 중간 10p + 끝 10p",
      "어드미니 SW도구에서 코드 전처리 + 명세서 자동 생성 가능",
    ],
    duration: "약 4영업일",
  },
  music: {
    legalEffect: [
      "저작자 추정 효력 (저작권법 제53조 제3항)",
      "침해 시 과실 추정 (저작권법 제125조 제4항)",
      "음원 유통 시 권리 증명",
      "KOMCA(한국음악저작권협회) 신탁 근거",
    ],
    tips: [
      "작곡과 작사를 별도로 등록할 수 있음",
      "편곡의 경우 원곡 저작자 동의 필요",
      "음원 유통 전 등록 완료 권장",
    ],
    duration: "약 1~2주 (영업일 기준)",
  },
};

// ─── Page Component ───

export default function CopyrightGuidePage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<CopyrightType | null>(null);
  const [checkedDocs, setCheckedDocs] = useState<Set<string>>(new Set());

  const toggleDoc = (label: string) => {
    setCheckedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const goToChat = () => {
    const context = selectedType
      ? `저작권 등록에 대해 상담하고 싶습니다. 저작물 유형: ${COPYRIGHT_TYPES.find((t) => t.id === selectedType)?.label || "일반"}`
      : "저작권 등록에 대해 상담하고 싶습니다.";
    router.push(`/chat?q=${encodeURIComponent(context)}`);
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-8">
      {/* ─── 헤더 ─── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI 저작권 등록 가이드</h1>
        <p className="mt-1 text-gray-500">
          AI가 저작물 유형을 분석하고, 등록에 필요한 모든 정보를 안내해드립니다.
        </p>
      </div>

      {/* ─── [1] 저작물 유형 선택 카드 ─── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">저작물 유형 선택</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {COPYRIGHT_TYPES.map((type) => {
            const isSelected = selectedType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setSelectedType(isSelected ? null : type.id)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 shadow-md"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <svg className={`w-5 h-5 ${isSelected ? "text-blue-600" : "text-gray-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={type.emoji} />
                  </svg>
                  <span className={`font-semibold text-sm ${isSelected ? "text-blue-700" : "text-gray-800"}`}>
                    {type.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{type.desc}</p>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* 유형별 상세 안내 패널 */}
        {selectedType && (
          <div className="mt-4 p-5 bg-white border border-gray-200 rounded-xl space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-semibold text-gray-800">
                {COPYRIGHT_TYPES.find((t) => t.id === selectedType)?.label} 등록 안내
              </h3>
              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                {TYPE_DETAIL_INFO[selectedType].duration}
              </span>
            </div>

            {/* 등록의 법적 효과 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">등록의 법적 효과</h4>
              <ul className="space-y-1">
                {TYPE_DETAIL_INFO[selectedType].legalEffect.map((effect, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {effect}
                  </li>
                ))}
              </ul>
            </div>

            {/* 알아두면 좋은 정보 */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">알아두면 좋은 정보</h4>
              <ul className="space-y-1">
                {TYPE_DETAIL_INFO[selectedType].tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                    <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </section>

      {/* ─── [2] 등록 절차 안내 (스텝바) ─── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">등록 절차</h2>
        <div className="relative">
          {/* 연결선 */}
          <div className="hidden md:block absolute top-6 left-0 right-0 h-0.5 bg-gray-200" style={{ marginLeft: "10%", marginRight: "10%" }} />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {REGISTRATION_STEPS.map((s) => (
              <div key={s.step} className="relative flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-lg font-bold z-10">
                  {s.step}
                </div>
                <h4 className="mt-2 text-sm font-semibold text-gray-800">{s.title}</h4>
                <p className="mt-1 text-xs text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── [3] 수수료 안내 테이블 ─── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">수수료 안내</h2>
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-700">구분</th>
                <th className="text-right px-4 py-3 font-medium text-gray-700">수수료</th>
                <th className="text-left px-4 py-3 font-medium text-gray-700">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {FEE_TABLE.map((row, i) => (
                <tr key={i} className="bg-white">
                  <td className="px-4 py-3 text-gray-800">{row.category}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{row.fee}</td>
                  <td className="px-4 py-3 text-gray-500">{row.note}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-blue-50">
                <td className="px-4 py-3 font-medium text-blue-800">합계 (일반 온라인)</td>
                <td className="px-4 py-3 text-right font-bold text-blue-900">23,600원</td>
                <td className="px-4 py-3 text-blue-600 text-xs">프로그램: 53,600원</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ─── [4] 필요서류 체크리스트 ─── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          필요서류 체크리스트
          {!selectedType && (
            <span className="ml-2 text-sm font-normal text-gray-400">
              (위에서 저작물 유형을 선택하세요)
            </span>
          )}
        </h2>

        {selectedType ? (
          <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
            {TYPE_DOCUMENTS[selectedType].map((doc) => (
              <label
                key={doc.label}
                className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={checkedDocs.has(doc.label)}
                  onChange={() => toggleDoc(doc.label)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm ${checkedDocs.has(doc.label) ? "line-through text-gray-400" : "text-gray-800"}`}>
                      {doc.label}
                    </span>
                    {doc.required && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded font-medium">필수</span>
                    )}
                  </div>
                  {doc.note && (
                    <p className="text-xs text-gray-400 mt-0.5">{doc.note}</p>
                  )}
                </div>
              </label>
            ))}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${(checkedDocs.size / TYPE_DOCUMENTS[selectedType].filter((d) => d.required).length) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-gray-500">
                  {checkedDocs.size}/{TYPE_DOCUMENTS[selectedType].filter((d) => d.required).length} 필수서류
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-400">저작물 유형을 선택하면 필요서류가 표시됩니다</p>
          </div>
        )}
      </section>

      {/* ─── [5] 관련 법령 ─── */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">관련 법령</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
          {[
            { law: "저작권법 제53조", desc: "저작권의 등록" },
            { law: "저작권법 제55조", desc: "등록절차 등" },
            { law: "저작권법 제53조 제3항", desc: "등록된 저작물의 저작자 추정" },
            { law: "저작권법 제125조 제4항", desc: "등록 저작물 침해 시 과실 추정" },
            { law: "저작권법 시행규칙 별지 제3호서식", desc: "저작권 등록신청서" },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="font-medium text-gray-700">{item.law}</span>
              <span className="text-gray-400">-</span>
              <span className="text-gray-500">{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── [6] CTA 버튼 ─── */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* CROS 바로가기 */}
          <a
            href="https://www.cros.or.kr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="font-semibold">CROS 저작권등록 바로가기</span>
            <span className="text-blue-200 text-sm">(cros.or.kr)</span>
          </a>

          {/* AI 상담 */}
          <button
            onClick={goToChat}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-white border-2 border-blue-200 text-blue-700 rounded-xl hover:bg-blue-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span className="font-semibold">AI 상담으로 자세히 알아보기</span>
          </button>
        </div>

        {/* 대리의뢰 안내 */}
        <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-xl p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-gray-800">
                직접 등록이 번거로우시다면, 행정사가 대행해드립니다
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                행정사합동사무소 정의 | 저작권 등록 전문 대행 | 비용 별도 협의
              </p>
            </div>
            <a
              href="tel:070-8657-1888"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors whitespace-nowrap"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="font-semibold">대리의뢰하기</span>
              <span className="text-gray-300">|</span>
              <span className="text-sm">070-8657-1888</span>
            </a>
          </div>
        </div>
      </section>

      {/* ─── SW 프로그램 전용 도구 안내 ─── */}
      {selectedType === "software" && (
        <section className="bg-green-50 border border-green-200 rounded-xl p-5">
          <h3 className="text-base font-semibold text-green-800 mb-2">SW 프로그램 전용 도구</h3>
          <p className="text-sm text-green-700 mb-3">
            어드미니에서 소스코드 전처리(마스킹 + 30페이지 추출)와 창작의도 기술서 AI 자동 생성을 지원합니다.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <h4 className="text-sm font-medium text-gray-800 mb-1">소스코드 전처리</h4>
              <p className="text-xs text-gray-500">
                비밀정보(API키, 비밀번호 등) 자동 마스킹 + CROS 규격 30페이지 추출
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-green-100">
              <h4 className="text-sm font-medium text-gray-800 mb-1">창작의도 기술서 AI 생성</h4>
              <p className="text-xs text-gray-500">
                프로그램 정보 입력 시 1,500~2,000자 명세서 자동 생성 (Gemini AI)
              </p>
            </div>
          </div>
          <button
            onClick={() => router.push("/chat?q=" + encodeURIComponent("SW 프로그램 저작권 등록을 위한 소스코드 전처리와 창작의도 기술서를 만들고 싶습니다."))}
            className="mt-3 text-sm text-green-700 hover:text-green-900 font-medium flex items-center gap-1"
          >
            <span>AI 상담에서 도구 이용하기</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </section>
      )}
    </div>
  );
}
