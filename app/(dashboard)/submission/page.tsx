"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui";

interface SubmissionForm {
  type: "proxy" | "delegate"; // 접수대행 vs 대리
  name: string;
  phone: string;
  email: string;
  documentType: string;
  documentDescription: string;
  attachments: File[];
  agreeTerms: boolean;
}

// 탭 타입
type TabType = "gov24" | "proxy" | "delegate";

// 접수대행 불가 업무
const PROXY_UNAVAILABLE = [
  { category: "직접 방문 필요", items: ["출입국 민원 (비자, 체류, 귀화 등)", "관광숙박업 등록 (호텔, 휴양콘도)"] },
  { category: "개별 홈페이지 접수", items: ["벤처기업 인증신청", "조달청 나라장터 입찰", "특허/상표 출원"] },
  { category: "수수료 납부 필요", items: ["인지대, 수입증지 등 수수료 납부가 필요한 민원"] },
];

// 정부24 검색 URL 생성 함수
const getGov24SearchUrl = (keyword: string) =>
  `https://www.gov.kr/portal/service/serviceList?srchText=${encodeURIComponent(keyword)}`;

// 정부24 주요 민원 서비스 (검색 URL 방식)
const GOV24_SERVICES = [
  {
    category: "사업자/세무",
    services: [
      { name: "사업자등록증명 발급", url: getGov24SearchUrl("사업자등록증명 발급") },
      { name: "휴폐업사실증명 발급", url: getGov24SearchUrl("휴폐업사실증명 발급") },
      { name: "납세증명서 발급", url: getGov24SearchUrl("납세증명서 발급") },
      { name: "소득금액증명 발급", url: getGov24SearchUrl("소득금액증명 발급") },
    ],
  },
  {
    category: "부동산",
    services: [
      { name: "건축물대장 발급", url: getGov24SearchUrl("건축물대장 발급") },
      { name: "토지대장 발급", url: getGov24SearchUrl("토지대장 발급") },
      { name: "토지이용계획확인서", url: getGov24SearchUrl("토지이용계획확인서") },
      { name: "개별공시지가 확인", url: getGov24SearchUrl("개별공시지가 확인") },
    ],
  },
  {
    category: "가족/신분",
    services: [
      { name: "주민등록등본 발급", url: getGov24SearchUrl("주민등록등본 발급") },
      { name: "주민등록초본 발급", url: getGov24SearchUrl("주민등록초본 발급") },
      { name: "가족관계증명서", url: getGov24SearchUrl("가족관계증명서 발급") },
      { name: "기본증명서", url: getGov24SearchUrl("기본증명서 발급") },
    ],
  },
  {
    category: "영업/인허가",
    services: [
      { name: "통신판매업 신고", url: getGov24SearchUrl("통신판매업 신고") },
      { name: "일반음식점 영업신고", url: getGov24SearchUrl("일반음식점 영업신고") },
      { name: "휴게음식점 영업신고", url: getGov24SearchUrl("휴게음식점 영업신고") },
      { name: "건설업 등록", url: getGov24SearchUrl("건설업 등록") },
    ],
  },
];

// 자주 쓰는 정부 민원 사이트
const GOV_SITES = [
  { name: "정부24", url: "https://www.gov.kr", desc: "정부 통합 민원 포털" },
  { name: "홈택스", url: "https://www.hometax.go.kr", desc: "국세청 세금 신고/납부" },
  { name: "위택스", url: "https://www.wetax.go.kr", desc: "지방세 신고/납부" },
  { name: "인터넷등기소", url: "https://www.iros.go.kr", desc: "법인/부동산 등기" },
  { name: "세움터", url: "https://www.eais.go.kr", desc: "건축행정 시스템" },
  { name: "토지이음", url: "https://www.eum.go.kr", desc: "토지이용계획 확인" },
  { name: "일사편리", url: "https://kras.go.kr", desc: "부동산 통합 열람" },
  { name: "하이코리아", url: "https://www.hikorea.go.kr", desc: "출입국/외국인" },
];

// 기업 인증/지원 사이트
const BUSINESS_CERT_SITES = [
  { name: "벤처기업확인", url: "https://www.venturein.or.kr", desc: "벤처기업 인증" },
  { name: "이노비즈", url: "https://www.innobiz.net", desc: "기술혁신 중소기업" },
  { name: "메인비즈", url: "https://www.mainbiz.go.kr", desc: "경영혁신 중소기업" },
  { name: "SMPP", url: "https://www.smpp.go.kr", desc: "여성/장애인/직접생산" },
  { name: "뿌리기업확인", url: "https://apply.kpic.re.kr/html/?pmode=confirmation_intro", desc: "뿌리산업 기업확인" },
];

// 조달/정책자금 사이트
const PROCUREMENT_SITES = [
  { name: "나라장터", url: "https://www.g2b.go.kr", desc: "국가종합전자조달" },
  { name: "조달청", url: "https://www.pps.go.kr", desc: "조달청 홈페이지" },
  { name: "나라장터 종합쇼핑몰", url: "https://shopping.g2b.go.kr", desc: "조달 쇼핑몰" },
  { name: "중진공 정책자금", url: "https://www.kosmes.or.kr", desc: "중소벤처기업진흥공단" },
  { name: "소공인 정책자금", url: "https://www.semas.or.kr", desc: "소상공인시장진흥공단" },
];

export default function SubmissionPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const typeParam = searchParams.get("type");

  // URL 파라미터로 탭 초기화
  const getInitialTab = (): TabType => {
    if (typeParam === "proxy") return "proxy";
    if (typeParam === "delegate") return "delegate";
    return "gov24";
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab());
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<SubmissionForm>({
    type: typeParam === "delegate" ? "delegate" : "proxy",
    name: session?.user?.name || "",
    phone: "",
    email: session?.user?.email || "",
    documentType: "",
    documentDescription: "",
    attachments: [],
    agreeTerms: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [requestId, setRequestId] = useState<string>("");

  const handleSubmit = async () => {
    if (!form.agreeTerms) {
      alert("약관에 동의해주세요.");
      return;
    }

    if (!form.name || !form.phone || !form.documentType) {
      alert("필수 항목을 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      // FormData 사용 (파일 첨부 지원)
      const formData = new FormData();
      formData.append("type", form.type);
      formData.append("name", form.name);
      formData.append("phone", form.phone);
      formData.append("email", form.email);
      formData.append("documentType", form.documentType);
      if (form.documentDescription) {
        formData.append("description", form.documentDescription);
      }

      // 파일 첨부
      for (const file of form.attachments) {
        formData.append("files", file);
      }

      const response = await fetch("/api/submission", {
        method: "POST",
        body: formData, // FormData 전송 (Content-Type 자동 설정)
      });

      const data = await response.json();

      if (response.ok) {
        setRequestId(data.requestId);
        setIsComplete(true);
      } else {
        alert(data.error || "신청 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error("신청 오류:", error);
      alert("신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isComplete) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {form.type === "proxy" ? "접수대행" : "대리 의뢰"} 신청 완료
            </h2>
            <p className="text-gray-600 mb-6">
              신청이 접수되었습니다. 담당 행정사가 확인 후 연락드리겠습니다.
            </p>
            <div className="p-4 bg-blue-50 rounded-lg text-left mb-6">
              <p className="text-sm text-blue-800">
                {requestId && <><strong>접수번호:</strong> {requestId}<br /></>}
                <strong>문의처:</strong> 행정사합동사무소 정의<br />
                <strong>전화:</strong> 070-8657-1888<br />
                <strong>이메일:</strong> Lawyeom@naver.com
              </p>
            </div>
            <a
              href="/chat"
              className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
            >
              AI 상담으로 돌아가기
            </a>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-4 md:mb-8">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-1 md:mb-2">민원 접수</h1>
        <p className="text-sm md:text-base text-gray-600">정부24에서 직접 접수하거나, 행정사에 대행을 맡기세요.</p>
      </div>

      {/* Tab Navigation - 모바일에서 스크롤 가능 */}
      <div className="flex overflow-x-auto border-b border-gray-200 mb-4 md:mb-6 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
        <button
          onClick={() => setActiveTab("gov24")}
          className={`px-3 md:px-6 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "gov24"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="flex items-center gap-1 md:gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
            <span className="hidden sm:inline">정부24</span> 직접접수
          </span>
        </button>
        <button
          onClick={() => { setActiveTab("proxy"); setForm({ ...form, type: "proxy" }); }}
          className={`px-3 md:px-6 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "proxy"
              ? "border-teal-600 text-teal-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="flex items-center gap-1 md:gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            접수대행
          </span>
        </button>
        <button
          onClick={() => { setActiveTab("delegate"); setForm({ ...form, type: "delegate" }); }}
          className={`px-3 md:px-6 py-2 md:py-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "delegate"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="flex items-center gap-1 md:gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            대리의뢰
          </span>
        </button>
      </div>

      {/* 정부24 직접 접수 탭 */}
      {activeTab === "gov24" && (
        <div className="space-y-6">
          {/* 정부24 안내 */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-900 mb-2">정부24에서 직접 민원 접수</h3>
                  <p className="text-sm text-blue-800 mb-3">
                    정부24에서 직접 민원을 신청하세요. AI 상담에서 서류 작성을 도와드립니다.
                  </p>
                  <a
                    href="https://www.gov.kr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    정부24 바로가기
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 민원 검색 */}
          <div>
            <div className="relative mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="민원 서비스 검색 (예: 건축물대장, 사업자등록)"
                className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* 자주 쓰는 민원 사이트 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">자주 쓰는 정부 사이트</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {GOV_SITES.map((site) => (
                  <a
                    key={site.name}
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-center"
                  >
                    <p className="font-medium text-gray-900 text-sm">{site.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{site.desc}</p>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 기업 인증/지원 사이트 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">기업 인증 / 지원</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {BUSINESS_CERT_SITES.map((site) => (
                  <a
                    key={site.name}
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors text-center"
                  >
                    <p className="font-medium text-gray-900 text-xs">{site.name}</p>
                    <p className="text-xs text-gray-400">{site.desc}</p>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 조달/정책자금 사이트 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">조달 / 정책자금</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {PROCUREMENT_SITES.map((site) => (
                  <a
                    key={site.name}
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors text-center"
                  >
                    <p className="font-medium text-gray-900 text-xs">{site.name}</p>
                    <p className="text-xs text-gray-400">{site.desc}</p>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 주요 민원 서비스 */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">정부24 주요 민원 서비스</h3>
              <div className="space-y-6">
                {GOV24_SERVICES.map((category) => {
                  const filteredServices = searchTerm
                    ? category.services.filter((s) =>
                        s.name.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                    : category.services;

                  if (searchTerm && filteredServices.length === 0) return null;

                  return (
                    <div key={category.category}>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        {category.category}
                      </h4>
                      <div className="grid md:grid-cols-3 gap-2">
                        {filteredServices.map((service) => (
                          <a
                            key={service.name}
                            href={service.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors group"
                          >
                            <span className="text-sm">{service.name}</span>
                            <svg className="w-4 h-4 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 도움 필요 안내 */}
          <Card className="border-gray-200 bg-gray-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">직접 접수가 어려우신가요?</h4>
                  <p className="text-sm text-gray-600">
                    행정사합동사무소 정의에서 접수대행 또는 대리 서비스를 제공해 드립니다.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setActiveTab("proxy"); setForm({ ...form, type: "proxy" }); }}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700"
                  >
                    접수대행 신청
                  </button>
                  <a
                    href="tel:070-8657-1888"
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700"
                  >
                    전화 상담
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 접수대행/대리의뢰 탭 */}
      {(activeTab === "proxy" || activeTab === "delegate") && (
        <>
          {/* Type Selection */}
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <button
              onClick={() => { setActiveTab("proxy"); setForm({ ...form, type: "proxy" }); }}
              className={`p-6 rounded-xl border-2 text-left transition-all ${
                form.type === "proxy"
                  ? "border-teal-500 bg-teal-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  form.type === "proxy" ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">접수대행</h3>
                  <p className="text-xs text-gray-500">문서24 접수 대행 서비스</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                고객님이 작성한 서류를 <strong>문서24</strong>를 통해 대신 접수해드립니다. (온라인 접수대행 위임장 필요)
              </p>
            </button>

            <button
              onClick={() => { setActiveTab("delegate"); setForm({ ...form, type: "delegate" }); }}
              className={`p-6 rounded-xl border-2 text-left transition-all ${
                form.type === "delegate"
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  form.type === "delegate" ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">대리 의뢰</h3>
                  <p className="text-xs text-gray-500">행정사 대리인 서비스</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                행정사가 대리인으로서 모든 절차를 대행합니다. (유선 상담 필요)
              </p>
            </button>
          </div>

      {/* Proxy Unavailable Notice */}
      {form.type === "proxy" && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              접수대행 불가 안내
            </h4>
            <div className="space-y-3">
              {PROXY_UNAVAILABLE.map((category) => (
                <div key={category.category}>
                  <p className="text-sm font-medium text-amber-800">{category.category}</p>
                  <ul className="text-sm text-amber-700 ml-4 mt-1">
                    {category.items.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="text-sm text-amber-800 mt-3">
              위 사항에 해당하는 경우 <strong>대리 의뢰</strong> 또는{" "}
              <a href="tel:070-8657-1888" className="underline font-semibold">유선 상담(070-8657-1888)</a>을 이용해주세요.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Form */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">신청 정보</h3>

          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="홍길동"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="010-1234-5678"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="example@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">민원 종류</label>
              <input
                type="text"
                value={form.documentType}
                onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="예: 일반음식점 영업신고, 건축허가 신청 등"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상세 내용</label>
              <textarea
                value={form.documentDescription}
                onChange={(e) => setForm({ ...form, documentDescription: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 min-h-[100px]"
                placeholder="접수할 민원의 상세 내용을 입력해주세요"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">첨부파일</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setForm({ ...form, attachments: files });
                  }}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-sm text-gray-600">파일을 드래그하거나 클릭하여 업로드</p>
                  <p className="text-xs text-gray-500 mt-1">PDF, HWP, DOCX (최대 10MB)</p>
                </label>
              </div>
              {form.attachments.length > 0 && (
                <ul className="mt-2 text-sm text-gray-600">
                  {form.attachments.map((file, index) => (
                    <li key={index}>📎 {file.name}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="agree-terms"
                checked={form.agreeTerms}
                onChange={(e) => setForm({ ...form, agreeTerms: e.target.checked })}
                className="mt-1"
              />
              <label htmlFor="agree-terms" className="text-sm text-gray-600">
                {form.type === "proxy" ? (
                  <>
                    온라인 접수대행을 위한 위임에 동의하며, 접수대행 불가 사항을 확인하였습니다.
                    접수대행 비용은 별도 안내에 따릅니다.
                  </>
                ) : (
                  <>
                    대리 의뢰에 동의하며, 수수료는 유선 상담을 통해 별도 안내받겠습니다.
                  </>
                )}
              </label>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !form.name || !form.phone || !form.documentType || !form.agreeTerms}
              className={`flex-1 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                form.type === "proxy"
                  ? "bg-teal-600 hover:bg-teal-700 text-white disabled:bg-gray-300"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-300"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  신청 중...
                </>
              ) : (
                <>
                  {form.type === "proxy" ? "접수대행 신청" : "대리 의뢰 신청"}
                </>
              )}
            </button>
            <a
              href="tel:070-8657-1888"
              className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              전화 상담
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Contact Info */}
      <div className="mt-6 p-4 bg-gray-50 rounded-xl text-center">
        <p className="text-sm text-gray-600">
          문의: <strong>행정사합동사무소 정의</strong> | 070-8657-1888 | Lawyeom@naver.com
        </p>
        <p className="text-xs text-gray-500 mt-1">
          <a href="https://www.jungeui.com" target="_blank" rel="noopener noreferrer" className="underline">
            www.jungeui.com
          </a>
        </p>
      </div>
      </>
      )}
    </div>
  );
}
