"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

// ─── Types ───

interface ClientCompanyRef {
  id: string;
  companyName: string;
  ownerName?: string | null;
  bizRegNo?: string | null;
}

interface ClientDocument {
  id: string;
  clientCompanyId: string;
  userId: string;
  category: string;
  documentType: string;
  title: string;
  description: string | null;
  fileUrl: string | null;
  fileType: string | null;
  metadata: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  clientCompany: {
    id: string;
    companyName: string;
  };
}

interface ClientStats {
  clientCompanyId: string;
  companyName: string;
  count: number;
}

interface CategoryStats {
  category: string;
  count: number;
}

// ─── Category Config ───

interface CategoryConfig {
  label: string;
  iconPath: string;
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const CATEGORIES: Record<string, CategoryConfig> = {
  insurance_report: {
    label: "4대보험 신고서",
    iconPath: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
    color: "blue",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    borderColor: "border-blue-200",
  },
  payslip: {
    label: "급여명세서",
    iconPath: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    color: "green",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    borderColor: "border-green-200",
  },
  contract: {
    label: "근로계약서",
    iconPath: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
    color: "purple",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    borderColor: "border-purple-200",
  },
  permit: {
    label: "인허가 서류",
    iconPath: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    color: "amber",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
    borderColor: "border-amber-200",
  },
  transfer: {
    label: "이전등록 서류",
    iconPath: "M13 10V3L4 14h7v7l9-11h-7z",
    color: "red",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    borderColor: "border-red-200",
  },
  certification: {
    label: "기업인증",
    iconPath: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
    color: "teal",
    bgColor: "bg-teal-50",
    textColor: "text-teal-700",
    borderColor: "border-teal-200",
  },
  other: {
    label: "기타",
    iconPath: "M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13",
    color: "gray",
    bgColor: "bg-gray-50",
    textColor: "text-gray-700",
    borderColor: "border-gray-200",
  },
};

const CATEGORY_KEYS = ["all", ...Object.keys(CATEGORIES)] as const;

function getCategoryConfig(category: string): CategoryConfig {
  return CATEGORIES[category] || CATEGORIES.other;
}

function getCategoryLabel(category: string): string {
  return CATEGORIES[category]?.label || category;
}

// ─── SVG Icon Helper ───

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  const config = getCategoryConfig(category);
  return (
    <svg className={className || "w-5 h-5"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={config.iconPath} />
    </svg>
  );
}

// ─── Format Date ───

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

function formatDateRelative(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHr < 24) return `${diffHr}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return formatDate(dateStr);
}

// ─── Main Page ───

export default function ClientDocumentsPage() {
  const { data: session } = useSession();

  // Data
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [clients, setClients] = useState<ClientCompanyRef[]>([]);
  const [clientStats, setClientStats] = useState<ClientStats[]>([]);
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // UI state
  const [loading, setLoading] = useState(true);
  const [detailDoc, setDetailDoc] = useState<ClientDocument | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  // Add form
  const [addForm, setAddForm] = useState({
    clientCompanyId: "",
    category: "insurance_report",
    documentType: "",
    title: "",
    description: "",
  });
  const [addLoading, setAddLoading] = useState(false);

  // ─── Fetch clients ───
  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/labor/client-companies");
      const json = await res.json();
      if (json.success) {
        setClients(json.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch clients:", e);
    }
  }, []);

  // ─── Fetch stats ───
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/client-documents/stats");
      const json = await res.json();
      if (json.success) {
        setClientStats(json.data.byClient || []);
        setCategoryStats(json.data.byCategory || []);
        setTotalCount(json.data.totalCount || 0);
      }
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }
  }, []);

  // ─── Fetch documents ───
  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedClientId) params.set("clientCompanyId", selectedClientId);
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      params.set("status", "active");

      const res = await fetch(`/api/client-documents?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setDocuments(json.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch documents:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedClientId, selectedCategory]);

  // ─── Initial load ───
  useEffect(() => {
    if (session?.user?.id) {
      fetchClients();
      fetchStats();
    }
  }, [session?.user?.id, fetchClients, fetchStats]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchDocuments();
    }
  }, [session?.user?.id, fetchDocuments]);

  // ─── Add document ───
  const handleAdd = async () => {
    if (!addForm.clientCompanyId || !addForm.title || !addForm.category) return;
    setAddLoading(true);
    try {
      const res = await fetch("/api/client-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientCompanyId: addForm.clientCompanyId,
          category: addForm.category,
          documentType: addForm.documentType || addForm.category,
          title: addForm.title,
          description: addForm.description || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        setAddForm({
          clientCompanyId: "",
          category: "insurance_report",
          documentType: "",
          title: "",
          description: "",
        });
        fetchDocuments();
        fetchStats();
      } else {
        alert(json.error || "서류 등록에 실패했습니다.");
      }
    } catch {
      alert("서류 등록 중 오류가 발생했습니다.");
    } finally {
      setAddLoading(false);
    }
  };

  // ─── Delete document ───
  const handleDelete = async (id: string) => {
    if (!confirm("이 서류를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/client-documents/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        setDetailDoc(null);
        fetchDocuments();
        fetchStats();
      } else {
        alert(json.error || "삭제에 실패했습니다.");
      }
    } catch {
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  // ─── Get doc count for a client ───
  function getClientDocCount(clientId: string): number {
    return clientStats.find((s) => s.clientCompanyId === clientId)?.count || 0;
  }

  // ─── Not logged in ───
  if (!session?.user?.id) {
    return (
      <div className="max-w-4xl mx-auto py-20 text-center">
        <p className="text-gray-500">로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] overflow-hidden">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setMobileSidebar(!mobileSidebar)}
        className="lg:hidden fixed bottom-4 left-4 z-50 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors"
        title="거래처 목록"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      </button>

      {/* Mobile sidebar overlay */}
      {mobileSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebar(false)}
        />
      )}

      {/* ─── Left Sidebar: Client List ─── */}
      <aside
        className={`
          ${mobileSidebar ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
          fixed lg:static inset-y-0 left-0 z-50 lg:z-auto
          w-60 bg-white border-r border-gray-200
          flex flex-col overflow-hidden
          transition-transform duration-200 ease-in-out
          top-14 sm:top-16 lg:top-0
        `}
      >
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">거래처 목록</h2>
          <p className="text-xs text-gray-400 mt-0.5">{clients.length}개 거래처</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* All documents option */}
          <button
            onClick={() => {
              setSelectedClientId(null);
              setMobileSidebar(false);
            }}
            className={`
              w-full flex items-center justify-between px-4 py-3 text-sm transition-colors border-b border-gray-50
              ${selectedClientId === null
                ? "bg-indigo-50 text-indigo-700 font-medium"
                : "text-gray-600 hover:bg-gray-50"
              }
            `}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              전체 서류
            </span>
            <span className={`
              text-xs px-2 py-0.5 rounded-full
              ${selectedClientId === null ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}
            `}>
              {totalCount}
            </span>
          </button>

          {/* Client list */}
          {clients.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <p className="text-xs text-gray-400">거래처가 없습니다.</p>
              <Link
                href="/client-management"
                className="inline-block mt-3 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                거래처 등록하기
              </Link>
            </div>
          ) : (
            clients.map((client) => {
              const count = getClientDocCount(client.id);
              const isSelected = selectedClientId === client.id;

              return (
                <button
                  key={client.id}
                  onClick={() => {
                    setSelectedClientId(isSelected ? null : client.id);
                    setMobileSidebar(false);
                  }}
                  className={`
                    w-full flex items-center justify-between px-4 py-3 text-sm transition-colors border-b border-gray-50
                    ${isSelected
                      ? "bg-indigo-50 text-indigo-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                    }
                  `}
                >
                  <span className="truncate pr-2">{client.companyName}</span>
                  <span className={`
                    text-xs px-2 py-0.5 rounded-full shrink-0
                    ${isSelected ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500"}
                  `}>
                    {count}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                {selectedClientId
                  ? `${clients.find((c) => c.id === selectedClientId)?.companyName || ""} 서류함`
                  : "거래처별 서류함"
                }
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {selectedClientId
                  ? `${documents.length}건의 서류`
                  : `전체 ${totalCount}건의 서류`
                }
              </p>
            </div>
            <button
              onClick={() => {
                setAddForm({
                  clientCompanyId: selectedClientId || "",
                  category: "insurance_report",
                  documentType: "",
                  title: "",
                  description: "",
                });
                setShowAddModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              서류 추가
            </button>
          </div>

          {/* Category filter tabs */}
          <div className="mt-3 flex gap-1 overflow-x-auto pb-1 -mb-1 scrollbar-none">
            {CATEGORY_KEYS.map((key) => {
              const isActive = selectedCategory === key;
              const label = key === "all" ? "전체" : CATEGORIES[key]?.label || key;
              const catCount = key === "all"
                ? (selectedClientId
                  ? documents.length
                  : totalCount)
                : categoryStats.find((s) => s.category === key)?.count || 0;

              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key)}
                  className={`
                    shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                    ${isActive
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }
                  `}
                >
                  {label}
                  {catCount > 0 && (
                    <span className={`ml-1 ${isActive ? "text-indigo-200" : "text-gray-400"}`}>
                      {catCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Document Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-400">서류를 불러오는 중...</p>
              </div>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <svg className="w-16 h-16 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-base font-semibold text-gray-700 mb-1">아직 서류가 없습니다</h3>
                <p className="text-sm text-gray-400 mb-4">
                  {selectedClientId
                    ? "이 거래처에 등록된 서류가 없습니다."
                    : "서류를 추가하여 거래처별로 관리해보세요."
                  }
                </p>
                <button
                  onClick={() => {
                    setAddForm({
                      clientCompanyId: selectedClientId || "",
                      category: "insurance_report",
                      documentType: "",
                      title: "",
                      description: "",
                    });
                    setShowAddModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  서류 추가
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
              {documents.map((doc) => {
                const config = getCategoryConfig(doc.category);
                return (
                  <button
                    key={doc.id}
                    onClick={() => setDetailDoc(doc)}
                    className="text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Category Icon */}
                      <div className={`
                        w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                        ${config.bgColor}
                      `}>
                        <CategoryIcon category={doc.category} className={`w-5 h-5 ${config.textColor}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
                          {doc.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`
                            inline-flex items-center text-xs px-2 py-0.5 rounded-full
                            ${config.bgColor} ${config.textColor}
                          `}>
                            {getCategoryLabel(doc.category)}
                          </span>
                          {!selectedClientId && (
                            <span className="text-xs text-gray-400 truncate">
                              {doc.clientCompany.companyName}
                            </span>
                          )}
                        </div>
                        {doc.description && (
                          <p className="text-xs text-gray-400 mt-1.5 line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            {doc.description}
                          </p>
                        )}
                      </div>

                      {/* Date & Status */}
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-xs text-gray-400">
                          {formatDateRelative(doc.createdAt)}
                        </span>
                        <span className={`
                          text-xs px-2 py-0.5 rounded-full
                          ${doc.status === "active"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-gray-100 text-gray-500"
                          }
                        `}>
                          {doc.status === "active" ? "활성" : "보관"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ─── Detail Modal ─── */}
      {detailDoc && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center
                  ${getCategoryConfig(detailDoc.category).bgColor}
                `}>
                  <CategoryIcon
                    category={detailDoc.category}
                    className={`w-5 h-5 ${getCategoryConfig(detailDoc.category).textColor}`}
                  />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">{detailDoc.title}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{detailDoc.clientCompany.companyName}</p>
                </div>
              </div>
              <button
                onClick={() => setDetailDoc(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {/* Category / Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">카테고리</label>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {getCategoryLabel(detailDoc.category)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">문서유형</label>
                  <p className="text-sm text-gray-800 mt-0.5">
                    {detailDoc.documentType || "-"}
                  </p>
                </div>
              </div>

              {/* Description */}
              {detailDoc.description && (
                <div>
                  <label className="text-xs font-medium text-gray-500">설명</label>
                  <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">
                    {detailDoc.description}
                  </p>
                </div>
              )}

              {/* Metadata */}
              {detailDoc.metadata && (
                <div>
                  <label className="text-xs font-medium text-gray-500">메타데이터</label>
                  <div className="mt-1 bg-gray-50 rounded-lg p-3 text-xs text-gray-600 font-mono overflow-x-auto">
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(detailDoc.metadata), null, 2);
                      } catch {
                        return detailDoc.metadata;
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">등록일</label>
                  <p className="text-sm text-gray-800 mt-0.5">{formatDate(detailDoc.createdAt)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">상태</label>
                  <p className="mt-0.5">
                    <span className={`
                      text-xs px-2 py-0.5 rounded-full
                      ${detailDoc.status === "active"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-gray-100 text-gray-500"
                      }
                    `}>
                      {detailDoc.status === "active" ? "활성" : "보관"}
                    </span>
                  </p>
                </div>
              </div>

              {/* File download */}
              {detailDoc.fileUrl && (
                <div>
                  <label className="text-xs font-medium text-gray-500">첨부파일</label>
                  <a
                    href={detailDoc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-2 px-3 py-2 bg-gray-50 text-sm text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    다운로드 ({detailDoc.fileType || "파일"})
                  </a>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => handleDelete(detailDoc.id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                삭제
              </button>
              <button
                onClick={() => setDetailDoc(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Add Modal ─── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900">서류 추가</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Form */}
            <div className="p-5 space-y-4">
              {/* Client select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  거래처 <span className="text-red-500">*</span>
                </label>
                <select
                  value={addForm.clientCompanyId}
                  onChange={(e) => setAddForm({ ...addForm, clientCompanyId: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  <option value="">거래처를 선택하세요</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.companyName}</option>
                  ))}
                </select>
              </div>

              {/* Category select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  카테고리 <span className="text-red-500">*</span>
                </label>
                <select
                  value={addForm.category}
                  onChange={(e) => setAddForm({ ...addForm, category: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {Object.entries(CATEGORIES).map(([key, cfg]) => (
                    <option key={key} value={key}>{cfg.label}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제목 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addForm.title}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  placeholder="서류 제목을 입력하세요"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                  placeholder="서류에 대한 설명을 입력하세요 (선택)"
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAdd}
                disabled={addLoading || !addForm.clientCompanyId || !addForm.title}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addLoading ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
