"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUIStore } from "@/lib/store";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// ADMIN_EMAILS를 소문자로 정규화하여 비교
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "Lawyeom@naver.com,duath1031@gmail.com")
  .split(",")
  .map(email => email.toLowerCase().trim());

interface MenuItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  external?: boolean;
  badge?: string;
}

interface MenuGroup {
  name: string;
  emoji: string;
  children: MenuItem[];
}

type SidebarItem = MenuItem | MenuGroup;

function isGroup(item: SidebarItem): item is MenuGroup {
  return "children" in item;
}

// ── Icons (w-4 h-4 for child items) ──────────────────────────────────

const icons = {
  // Dashboard
  home: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),

  // 행정-민원 children
  chat: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  submission: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  car: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0H3m10 0h2m4 0h1a1 1 0 001-1v-4.586a1 1 0 00-.293-.707l-3.414-3.414A1 1 0 0016.586 6H13" />
    </svg>
  ),
  permit: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  copyright: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  fine: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),

  // 노무-HR children
  insurance: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  payslip: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  contract: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  visa: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  severance: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),

  // 자금-컨설팅 children
  fund: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  subsidy: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  certification: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  ),
  bizplan: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),

  // 입찰-조달 children
  search: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  simulator: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  ),
  guarantee: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),

  // 서류 children
  docWrite: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  docReview: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  contractAnalysis: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  ),

  // 연구-관리 children
  researchNote: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  alarm: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  ),
  calendar: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),

  // Bottom items
  user: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  pricing: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  ),
  admin: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

// ── Menu structure ───────────────────────────────────────────────────

const sidebarItems: SidebarItem[] = [
  // 대시보드 (top-level)
  {
    name: "대시보드",
    href: "/dashboard",
    icon: icons.home,
  },

  // AI 행정 상담 (top-level)
  {
    name: "AI 행정 상담",
    href: "/chat",
    icon: icons.chat,
  },

  // 행정 AI
  {
    name: "행정 AI",
    emoji: "\uD83D\uDCCB",
    children: [
      { name: "민원 자동접수", href: "/submission", icon: icons.submission },
      { name: "인허가 자가진단", href: "/permit-check", icon: icons.permit },
      { name: "저작권 등록", href: "/copyright", icon: icons.copyright },
      { name: "내용증명", href: "/legal-notice", icon: icons.docWrite },
      { name: "회의록 AI", href: "/meeting-minutes", icon: icons.docReview },
    ],
  },

  // 기업행정 AI
  {
    name: "기업행정 AI",
    emoji: "\uD83C\uDFE2",
    children: [
      { name: "연구노트 (KOITA)", href: "/research-note", icon: icons.researchNote },
      { name: "정책자금/정부지원", href: "/fund-matching", icon: icons.fund },
      { name: "인증 자가진단", href: "/certification-check", icon: icons.certification },
      { name: "사업계획서 AI", href: "/chat?q=사업계획서 작성을 도와주세요", icon: icons.bizplan, badge: "준비 중" },
    ],
  },

  // 노무·HR
  {
    name: "노무·HR",
    emoji: "\uD83D\uDC77",
    children: [
      { name: "4대보험 계산기", href: "/labor/insurance-calc", icon: icons.insurance },
      { name: "4대보험 신고서", href: "/labor/insurance-report", icon: icons.docWrite },
      { name: "급여명세서", href: "/labor/payslip", icon: icons.payslip },
      { name: "근로계약서 AI", href: "/labor/contract", icon: icons.contract },
      { name: "퇴직금 계산기", href: "/labor/severance-calc", icon: icons.severance },
      { name: "연차 계산기", href: "/labor/annual-leave", icon: icons.calendar },
      { name: "주휴수당 계산기", href: "/labor/weekly-holiday-pay", icon: icons.insurance },
      { name: "비자 계산기", href: "/visa-calculator", icon: icons.visa },
    ],
  },

  // 자동차 행정
  {
    name: "자동차 행정",
    emoji: "\uD83D\uDE97",
    children: [
      { name: "온라인 이전등록", href: "/fleet/transfer-online", icon: icons.car },
      { name: "취등록세 계산기", href: "/fleet/transfer-cost", icon: icons.insurance },
      { name: "이전등록 서류", href: "/fleet/transfer-documents", icon: icons.docWrite },
      { name: "운행일지", href: "/fleet/trip-log", icon: icons.calendar },
      { name: "법인차량 관리", href: "/fleet", icon: icons.car },
    ],
  },

  // 입찰·조달
  {
    name: "입찰·조달",
    emoji: "\uD83D\uDCCA",
    children: [
      { name: "입찰 검색/분석", href: "/procurement", icon: icons.search },
      { name: "사정률 시뮬레이터", href: "/bid-simulation", icon: icons.simulator },
      { name: "직접생산확인 진단", href: "/direct-production-check", icon: icons.certification },
    ],
  },

  // 서류 AI
  {
    name: "서류 AI",
    emoji: "\uD83D\uDCC4",
    children: [
      { name: "서류 작성", href: "/documents", icon: icons.docWrite },
      { name: "서류 검토", href: "/review", icon: icons.docReview },
      { name: "계약서 분석", href: "/contract-analysis", icon: icons.contractAnalysis },
    ],
  },

  // 거래처 관리
  {
    name: "거래처 관리",
    emoji: "\uD83D\uDC65",
    children: [
      { name: "거래처 관리", href: "/client-management", icon: icons.user },
    ],
  },
];

// Bottom fixed items (below divider)
const bottomItems: MenuItem[] = [
  { name: "마스터 프로필", href: "/mypage", icon: icons.user },
  { name: "요금제 / 토큰 충전", href: "/pricing", icon: icons.pricing },
];

const adminMenuItem: MenuItem = {
  name: "관리자",
  href: "/admin",
  icon: icons.admin,
};

// ── Chevron SVG ──────────────────────────────────────────────────────

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ── "준비 중" Badge ──────────────────────────────────────────────────

function ComingSoonBadge() {
  return (
    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full ml-auto whitespace-nowrap">
      준비 중
    </span>
  );
}

// ── Sidebar Component ────────────────────────────────────────────────

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, setSidebarOpen } = useUIStore();
  const { data: session } = useSession();
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const isAdmin = session?.user?.email && ADMIN_EMAILS.includes(session.user.email.toLowerCase());

  // Helper: check if a path is active
  const isPathActive = (href: string): boolean => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/";
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  // Auto-open groups containing active child route
  useEffect(() => {
    const newOpen = new Set<string>();
    for (const item of sidebarItems) {
      if (isGroup(item)) {
        const hasActiveChild = item.children.some(
          (child) => !child.external && !child.badge && isPathActive(child.href)
        );
        if (hasActiveChild) newOpen.add(item.name);
      }
    }
    if (newOpen.size > 0) {
      setOpenGroups((prev) => {
        const merged = new Set(prev);
        newOpen.forEach((n) => merged.add(n));
        return merged;
      });
    }
  }, [pathname]);

  // Auto-close on mobile & handle resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMenuClick = () => {
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const toggleGroup = (name: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (!sidebarOpen) return null;

  // ── Render helpers ───────────────────────────────────────────────

  const renderMenuItem = (item: MenuItem, isTopLevel: boolean = false) => {
    const active = isPathActive(item.href);
    const hasBadge = !!item.badge;

    if (item.external) {
      return (
        <a
          key={`${item.name}-${item.href}`}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleMenuClick}
          className={`
            flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md transition-colors text-xs sm:text-sm
            text-gray-500 hover:bg-gray-50 hover:text-gray-700
            ${hasBadge ? "opacity-60" : ""}
          `}
        >
          {item.icon}
          <span>{item.name}</span>
          {hasBadge && <ComingSoonBadge />}
        </a>
      );
    }

    if (isTopLevel) {
      return (
        <Link
          key={`${item.name}-${item.href}`}
          href={item.href}
          onClick={handleMenuClick}
          className={`
            flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg transition-colors text-sm sm:text-base
            ${active
              ? "bg-blue-50 text-blue-700 font-medium"
              : "text-gray-600 hover:bg-gray-50"
            }
            ${hasBadge ? "opacity-60" : ""}
          `}
        >
          {item.icon}
          <span>{item.name}</span>
          {hasBadge && <ComingSoonBadge />}
        </Link>
      );
    }

    // Child item (inside a group)
    return (
      <Link
        key={`${item.name}-${item.href}`}
        href={item.href}
        onClick={handleMenuClick}
        className={`
          flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-md transition-colors text-xs sm:text-sm
          ${active && !hasBadge
            ? "bg-blue-50 text-blue-700 font-medium"
            : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          }
          ${hasBadge ? "opacity-60" : ""}
        `}
      >
        {item.icon}
        <span>{item.name}</span>
        {hasBadge && <ComingSoonBadge />}
      </Link>
    );
  };

  const renderGroup = (group: MenuGroup) => {
    const isOpen = openGroups.has(group.name);
    const hasActiveChild = group.children.some(
      (child) => !child.external && !child.badge && isPathActive(child.href)
    );

    return (
      <div key={group.name}>
        <button
          onClick={() => toggleGroup(group.name)}
          className={`
            w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg transition-colors text-sm sm:text-base
            ${hasActiveChild
              ? "bg-blue-50 text-blue-700"
              : "text-gray-600 hover:bg-gray-50"
            }
          `}
        >
          <span className="text-base leading-none">{group.emoji}</span>
          <span className="flex-1 text-left">{group.name}</span>
          <ChevronDown open={isOpen} />
        </button>

        {isOpen && (
          <div className="ml-3 sm:ml-4 mt-0.5 space-y-0.5 border-l-2 border-gray-200 pl-2 sm:pl-3">
            {group.children.map((child) => renderMenuItem(child, false))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile backdrop overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-30 md:hidden"
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className="fixed left-0 top-14 sm:top-16 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] w-56 sm:w-64 bg-white border-r border-gray-200 z-40 overflow-y-auto">
        <nav className="p-2 sm:p-4 space-y-0.5 sm:space-y-1">
          {/* Main menu items */}
          {sidebarItems.map((item) => {
            if (isGroup(item)) {
              return renderGroup(item);
            }
            return renderMenuItem(item as MenuItem, true);
          })}

          {/* Divider before bottom items */}
          <div className="border-t border-gray-200 my-2 sm:my-3" />

          {/* Bottom items: profile & pricing */}
          {bottomItems.map((item) => {
            const active = isPathActive(item.href);
            return (
              <Link
                key={`bottom-${item.name}-${item.href}`}
                href={item.href}
                onClick={handleMenuClick}
                className={`
                  flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg transition-colors text-sm sm:text-base
                  ${active
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-600 hover:bg-gray-50"
                  }
                `}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            );
          })}

          {/* Admin section */}
          {isAdmin && (
            <>
              <div className="border-t border-gray-200 my-1 sm:my-2" />
              <Link
                href={adminMenuItem.href}
                onClick={handleMenuClick}
                className={`
                  flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg transition-colors text-sm sm:text-base
                  ${pathname.startsWith("/admin")
                    ? "bg-purple-50 text-purple-700 font-medium"
                    : "text-purple-600 hover:bg-purple-50"
                  }
                `}
              >
                {adminMenuItem.icon}
                <span>{adminMenuItem.name}</span>
              </Link>
            </>
          )}
        </nav>
      </aside>
    </>
  );
}
