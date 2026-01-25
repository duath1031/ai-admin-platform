"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface MessageRendererProps {
  content: string;
  isUser?: boolean;
}

// 접수대행 불가 업무 (직접 방문 또는 개별 홈페이지 접수 필요)
const DIRECT_VISIT_REQUIRED = [
  "출입국", "비자", "체류", "귀화", "영주권",
  "관광숙박업", "호텔업", "휴양콘도",
];

const INDIVIDUAL_SITE_REQUIRED = [
  "벤처기업", "이노비즈", "메인비즈",
  "조달청", "나라장터",
  "특허", "상표", "디자인등록",
];

// 민원별 관련 사이트 매핑
const SERVICE_LINKS: Record<string, { name: string; url: string; description: string }[]> = {
  "공장등록": [
    { name: "공장등록 신청 (스마트공장)", url: "https://smart.factoryinfo.or.kr", description: "공장등록 온라인 신청" },
    { name: "산업단지공단", url: "https://www.kicox.or.kr", description: "산업단지 입주 안내" },
  ],
  "직접생산확인": [
    { name: "SMPP 직접생산확인", url: "https://www.smpp.go.kr", description: "직접생산확인신청" },
    { name: "나라장터", url: "https://www.g2b.go.kr", description: "조달 입찰 참여" },
  ],
  "벤처기업": [
    { name: "벤처인", url: "https://www.venturein.or.kr", description: "벤처기업 인증 신청" },
    { name: "벤처확인 현황", url: "https://www.venturein.or.kr/venturein/status/C12100.do", description: "인증 현황 조회" },
  ],
  "이노비즈": [
    { name: "이노비즈협회", url: "https://www.innobiz.net", description: "이노비즈 인증 신청" },
  ],
  "메인비즈": [
    { name: "메인비즈", url: "https://www.mainbiz.go.kr", description: "메인비즈 인증 신청" },
  ],
  "여성기업": [
    { name: "SMPP 여성기업", url: "https://www.smpp.go.kr", description: "여성기업 확인 신청" },
  ],
  "장애인기업": [
    { name: "SMPP 장애인기업", url: "https://www.smpp.go.kr", description: "장애인기업 확인 신청" },
  ],
  "뿌리기업": [
    { name: "뿌리기업확인", url: "https://apply.kpic.re.kr/html/?pmode=confirmation_intro", description: "뿌리기업 확인 신청" },
  ],
  "나라장터": [
    { name: "나라장터", url: "https://www.g2b.go.kr", description: "국가종합전자조달" },
    { name: "나라장터 종합쇼핑몰", url: "https://shopping.g2b.go.kr", description: "조달 쇼핑몰" },
    { name: "조달청", url: "https://www.pps.go.kr", description: "조달청 홈페이지" },
  ],
  "정책자금": [
    { name: "중진공 정책자금", url: "https://www.kosmes.or.kr", description: "중소벤처기업진흥공단" },
    { name: "소공인 정책자금", url: "https://www.semas.or.kr", description: "소상공인시장진흥공단" },
  ],
  "비자": [
    { name: "하이코리아", url: "https://www.hikorea.go.kr", description: "출입국외국인정책본부" },
  ],
  "체류": [
    { name: "하이코리아", url: "https://www.hikorea.go.kr", description: "체류자격 변경/연장" },
  ],
  "음식점": [
    { name: "식품안전나라", url: "https://www.foodsafetykorea.go.kr", description: "영업신고/허가" },
    { name: "정부24 영업신고", url: "https://www.gov.kr/portal/service/serviceList?srvcFpUrl=&ordBy=1&orgId=ALL&svcSe=&ctgId=07", description: "영업신고 민원" },
  ],
  "건축": [
    { name: "세움터", url: "https://www.eais.go.kr", description: "건축행정시스템" },
    { name: "토지이음", url: "https://www.eum.go.kr", description: "토지이용계획 확인" },
  ],
  "건설업": [
    { name: "건설산업지식정보시스템", url: "https://www.kiscon.net", description: "건설업 등록/신고" },
  ],
  "부동산": [
    { name: "인터넷등기소", url: "https://www.iros.go.kr", description: "등기부등본 발급" },
    { name: "일사편리", url: "https://kras.go.kr", description: "부동산 통합 열람" },
  ],
};

// URL 패턴 정의
const URL_PATTERN = /https?:\/\/[^\s<>\[\]()]+/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
const LAW_DOWNLOAD_PATTERN = /https:\/\/www\.law\.go\.kr\/LSW\/flDownload\.do\?flSeq=\d+/;
const LAW_PAGE_PATTERN = /https:\/\/www\.law\.go\.kr\/법령서식\/[^\s<>\[\]()]+/;

// 서식 다운로드 버튼 컴포넌트
function DownloadButton({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 my-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      {label}
    </a>
  );
}

// 법령 페이지 링크 버튼 컴포넌트
function LawPageButton({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 px-4 py-2 my-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
      {label}
    </a>
  );
}

// 일반 링크 컴포넌트
function ExternalLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:text-blue-800 underline"
    >
      {label}
    </a>
  );
}

// 접수대행/대리의뢰 모달
function SubmissionModal({
  isOpen,
  onClose,
  type
}: {
  isOpen: boolean;
  onClose: () => void;
  type: "proxy" | "delegate";
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900">
              {type === "proxy" ? "접수대행 안내" : "대리 의뢰 안내"}
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {type === "proxy" ? (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2">접수대행 서비스</h4>
                <p className="text-sm text-blue-800">
                  고객님께서 작성하신 서류를 정부24(문서24)를 통해 대신 접수해드리는 서비스입니다.
                  온라인 접수대행 위임장을 받아 처리합니다.
                </p>
              </div>

              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h4 className="font-semibold text-amber-900 mb-2">접수대행 불가 안내</h4>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• <strong>수수료 납부가 필요한 경우</strong> - 행정사 대리 의뢰 필요</li>
                  <li>• <strong>직접 방문 접수가 필요한 경우</strong></li>
                  <li className="pl-4">- 출입국 민원 (비자, 체류, 귀화 등)</li>
                  <li className="pl-4">- 관광숙박업 (호텔, 휴양콘도 등)</li>
                  <li>• <strong>개별 홈페이지 접수가 필요한 경우</strong></li>
                  <li className="pl-4">- 벤처기업 인증신청</li>
                  <li className="pl-4">- 조달청 나라장터 입찰</li>
                  <li className="pl-4">- 특허/상표 출원 등</li>
                </ul>
              </div>

              <p className="text-sm text-gray-600">
                위 사항에 해당하는 경우 <strong>대리 의뢰</strong> 또는 <strong>유선 상담</strong>을 통해 문의하여 주세요.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                <h4 className="font-semibold text-indigo-900 mb-2">대리 서비스</h4>
                <p className="text-sm text-indigo-800">
                  행정사가 대리인으로서 민원 접수부터 완료까지 모든 절차를 대행합니다.
                  복잡한 인허가, 수수료 납부, 방문 접수 등이 필요한 경우에 적합합니다.
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-900 mb-2">대리 수수료 안내</h4>
                <p className="text-sm text-gray-700">
                  대리 서비스의 수수료는 업무의 종류와 난이도에 따라 상이합니다.
                  <strong> 유선 상담을 통해 정확한 비용을 안내</strong>받으시기 바랍니다.
                </p>
              </div>
            </div>
          )}

          {/* 연락처 */}
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl text-white">
            <h4 className="font-bold mb-2">행정사합동사무소 정의</h4>
            <p className="text-sm text-blue-100 mb-3">염현수 대표 행정사</p>
            <div className="grid grid-cols-2 gap-2">
              <a
                href="tel:070-8657-1888"
                className="flex items-center justify-center gap-2 py-2 bg-white text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                070-8657-1888
              </a>
              <a
                href="https://pf.kakao.com/_jWfwb"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2 bg-yellow-400 text-yellow-900 rounded-lg text-sm font-medium hover:bg-yellow-300"
              >
                카카오 상담
              </a>
              <a
                href="https://www.jungeui.com/%EB%AC%B8%EC%9D%98%ED%95%98%EA%B8%B0"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 col-span-2"
              >
                온라인 의뢰하기
              </a>
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-4 w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

// 서비스별 바로가기 링크 섹션
function ServiceLinks({ content }: { content: string }) {
  // 콘텐츠에서 관련 서비스 키워드 찾기
  const matchedServices: { name: string; url: string; description: string }[] = [];
  const seenUrls = new Set<string>();

  for (const [keyword, links] of Object.entries(SERVICE_LINKS)) {
    if (content.includes(keyword)) {
      for (const link of links) {
        if (!seenUrls.has(link.url)) {
          seenUrls.add(link.url);
          matchedServices.push(link);
        }
      }
    }
  }

  if (matchedServices.length === 0) return null;

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
      <p className="text-xs text-gray-500 mb-2 font-medium">관련 사이트 바로가기</p>
      <div className="flex flex-wrap gap-2">
        {matchedServices.slice(0, 5).map((service) => (
          <a
            key={service.url}
            href={service.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            <span className="font-medium">{service.name}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

// 접수대행/대리의뢰 버튼 섹션
function SubmissionButtons({ content }: { content: string }) {
  const router = useRouter();

  // 직접 방문 필요 여부 체크
  const requiresDirectVisit = DIRECT_VISIT_REQUIRED.some(keyword =>
    content.includes(keyword)
  );

  // 개별 사이트 접수 필요 여부 체크
  const requiresIndividualSite = INDIVIDUAL_SITE_REQUIRED.some(keyword =>
    content.includes(keyword)
  );

  const canUseProxy = !requiresDirectVisit && !requiresIndividualSite;

  // 접수대행 클릭 - 민원접수 페이지로 이동
  const handleProxyClick = () => {
    router.push("/submission?type=proxy");
  };

  // 대리의뢰 클릭 - 민원접수 페이지로 이동
  const handleDelegateClick = () => {
    router.push("/submission?type=delegate");
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <p className="text-xs text-gray-500 mb-3">
        서류 작성이 완료되셨나요? 접수를 도와드립니다.
      </p>
      <div className="flex flex-wrap gap-2">
        {/* 접수대행 버튼 - 클릭 시 민원접수 페이지로 이동 */}
        <button
          onClick={handleProxyClick}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            canUseProxy
              ? "bg-teal-600 hover:bg-teal-700 text-white"
              : "bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          접수대행 신청
        </button>
        <button
          onClick={handleDelegateClick}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          대리 의뢰하기
        </button>
        <a
          href="tel:070-8657-1888"
          className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          유선 상담
        </a>
      </div>
    </div>
  );
}

export default function MessageRenderer({ content, isUser = false }: MessageRendererProps) {
  if (isUser) {
    // 사용자 메시지는 그냥 텍스트로 렌더링
    return <span>{content}</span>;
  }

  // AI 응답 메시지 파싱 및 렌더링
  const renderContent = () => {
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    // 먼저 마크다운 링크 처리
    let processedContent = content;
    const markdownLinks: { original: string; label: string; url: string }[] = [];

    let match;
    while ((match = MARKDOWN_LINK_PATTERN.exec(content)) !== null) {
      markdownLinks.push({
        original: match[0],
        label: match[1],
        url: match[2],
      });
    }

    // 마크다운 링크를 플레이스홀더로 교체
    markdownLinks.forEach((link, index) => {
      processedContent = processedContent.replace(link.original, `{{LINK_${index}}}`);
    });

    // 줄 단위로 처리
    const lines = processedContent.split("\n");

    lines.forEach((line, lineIndex) => {
      // 플레이스홀더 복원 및 렌더링
      let lineParts: React.ReactNode[] = [];
      let currentText = line;

      // 마크다운 링크 플레이스홀더 처리
      markdownLinks.forEach((link, index) => {
        const placeholder = `{{LINK_${index}}}`;
        if (currentText.includes(placeholder)) {
          const parts = currentText.split(placeholder);
          lineParts.push(<span key={`text-${key++}`}>{parts[0]}</span>);

          // 링크 타입에 따라 다른 컴포넌트 렌더링
          if (LAW_DOWNLOAD_PATTERN.test(link.url)) {
            lineParts.push(
              <DownloadButton key={`btn-${key++}`} url={link.url} label={`📥 ${link.label} 다운로드`} />
            );
          } else if (LAW_PAGE_PATTERN.test(link.url)) {
            lineParts.push(
              <LawPageButton key={`law-${key++}`} url={link.url} label={`📚 ${link.label}`} />
            );
          } else {
            lineParts.push(
              <ExternalLink key={`link-${key++}`} url={link.url} label={link.label} />
            );
          }

          currentText = parts.slice(1).join(placeholder);
        }
      });

      // 남은 텍스트에서 일반 URL 찾기
      if (currentText) {
        const urlMatches = currentText.match(URL_PATTERN);
        if (urlMatches) {
          let tempText = currentText;
          urlMatches.forEach((url) => {
            const parts = tempText.split(url);
            if (parts[0]) {
              lineParts.push(<span key={`text-${key++}`}>{parts[0]}</span>);
            }

            // URL 타입에 따라 다른 컴포넌트 렌더링
            if (LAW_DOWNLOAD_PATTERN.test(url)) {
              lineParts.push(
                <DownloadButton key={`btn-${key++}`} url={url} label="📥 서식 다운로드" />
              );
            } else if (LAW_PAGE_PATTERN.test(url)) {
              lineParts.push(
                <LawPageButton key={`law-${key++}`} url={url} label="📚 법령 페이지 보기" />
              );
            } else {
              lineParts.push(
                <ExternalLink key={`link-${key++}`} url={url} label={url.length > 50 ? url.substring(0, 50) + "..." : url} />
              );
            }

            tempText = parts.slice(1).join(url);
          });
          if (tempText) {
            lineParts.push(<span key={`text-${key++}`}>{tempText}</span>);
          }
        } else {
          lineParts.push(<span key={`text-${key++}`}>{currentText}</span>);
        }
      }

      elements.push(
        <React.Fragment key={`line-${lineIndex}`}>
          {lineParts.length > 0 ? lineParts : line}
          {lineIndex < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });

    return elements;
  };

  // 서식 다운로드 또는 법령 서식 링크가 있는지 확인
  const hasFormDownload = LAW_DOWNLOAD_PATTERN.test(content) || LAW_PAGE_PATTERN.test(content);

  // 서류 작성 관련 키워드가 있는지 확인
  const hasDocumentKeywords = /서식|신청서|신고서|등록신청|허가신청|인가신청|위임장|첨부서류|구비서류/.test(content);

  // 민원/인허가 관련 키워드가 있는지 확인
  const hasServiceKeywords = Object.keys(SERVICE_LINKS).some(keyword => content.includes(keyword));

  const showSubmissionButtons = hasFormDownload || hasDocumentKeywords;
  const showServiceLinks = hasServiceKeywords;

  return (
    <div className="text-sm leading-relaxed">
      {renderContent()}
      {showServiceLinks && <ServiceLinks content={content} />}
      {showSubmissionButtons && <SubmissionButtons content={content} />}
    </div>
  );
}
