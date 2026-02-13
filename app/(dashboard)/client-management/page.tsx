"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useClientStore } from "@/lib/store";

// ─── Types ───

interface ClientCompany {
  id: string;
  companyName: string;
  ownerName: string | null;
  bizRegNo: string | null;
  address: string | null;
  phone: string | null;
  npBizNo: string | null;
  hiBizNo: string | null;
  eiBizNo: string | null;
  memo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ClientForm {
  companyName: string;
  ownerName: string;
  bizRegNo: string;
  address: string;
  phone: string;
  npBizNo: string;
  hiBizNo: string;
  eiBizNo: string;
  memo: string;
}

const EMPTY_FORM: ClientForm = {
  companyName: "",
  ownerName: "",
  bizRegNo: "",
  address: "",
  phone: "",
  npBizNo: "",
  hiBizNo: "",
  eiBizNo: "",
  memo: "",
};

// ─── Helpers ───

/** 사업자등록번호 포맷팅: 000-00-00000 */
function formatBizRegNo(value: string): string {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

/** 전화번호 포맷팅 */
function formatPhone(value: string): string {
  const digits = value.replace(/[^0-9]/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

// ─── Main Page ───

export default function ClientManagementPage() {
  // 글로벌 거래처 스토어
  const { selectedClient, setSelectedClient, clearSelectedClient } = useClientStore();

  // 거래처 목록
  const [clients, setClients] = useState<ClientCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientCompany | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // 삭제 확인 모달
  const [deleteTarget, setDeleteTarget] = useState<ClientCompany | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 검색
  const [searchQuery, setSearchQuery] = useState("");

  // 상세보기 (모바일용 카드 확장)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── 거래처 목록 로드 ──
  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/labor/client-companies");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "거래처 목록 조회 실패");
      setClients(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "거래처 목록 조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // ── 검색 필터링 ──
  const filteredClients = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter(
      (c) =>
        c.companyName.toLowerCase().includes(q) ||
        (c.ownerName && c.ownerName.toLowerCase().includes(q)) ||
        (c.bizRegNo && c.bizRegNo.includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.memo && c.memo.toLowerCase().includes(q))
    );
  }, [clients, searchQuery]);

  // ── 모달 열기 ──
  const handleOpenModal = (client?: ClientCompany) => {
    setFormError("");
    if (client) {
      setEditingClient(client);
      setForm({
        companyName: client.companyName,
        ownerName: client.ownerName || "",
        bizRegNo: client.bizRegNo || "",
        address: client.address || "",
        phone: client.phone || "",
        npBizNo: client.npBizNo || "",
        hiBizNo: client.hiBizNo || "",
        eiBizNo: client.eiBizNo || "",
        memo: client.memo || "",
      });
    } else {
      setEditingClient(null);
      setForm(EMPTY_FORM);
    }
    setShowModal(true);
  };

  // ── 저장 (추가/수정) ──
  const handleSave = async () => {
    if (!form.companyName.trim()) {
      setFormError("거래처 상호는 필수입니다.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = {
        companyName: form.companyName.trim(),
        ownerName: form.ownerName.trim() || null,
        bizRegNo: form.bizRegNo.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        npBizNo: form.npBizNo.trim() || null,
        hiBizNo: form.hiBizNo.trim() || null,
        eiBizNo: form.eiBizNo.trim() || null,
        memo: form.memo.trim() || null,
      };

      let res: Response;
      if (editingClient) {
        res = await fetch(`/api/labor/client-companies/${editingClient.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/labor/client-companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "저장 실패");

      // 수정된 거래처가 현재 선택된 거래처이면 스토어도 업데이트
      if (editingClient && selectedClient?.id === editingClient.id) {
        setSelectedClient({
          id: data.data.id,
          companyName: data.data.companyName,
          ownerName: data.data.ownerName,
          bizRegNo: data.data.bizRegNo,
          address: data.data.address,
          phone: data.data.phone,
          npBizNo: data.data.npBizNo,
          hiBizNo: data.data.hiBizNo,
          eiBizNo: data.data.eiBizNo,
          memo: data.data.memo,
        });
      }

      setShowModal(false);
      fetchClients();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  // ── 삭제 (soft delete) ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/labor/client-companies/${deleteTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "삭제 실패");

      // 삭제된 거래처가 현재 선택된 거래처이면 선택 해제
      if (selectedClient?.id === deleteTarget.id) {
        clearSelectedClient();
      }

      setDeleteTarget(null);
      fetchClients();
    } catch (e) {
      setError(e instanceof Error ? e.message : "삭제 실패");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // ── 거래처 선택 ──
  const handleSelectClient = (client: ClientCompany) => {
    setSelectedClient({
      id: client.id,
      companyName: client.companyName,
      ownerName: client.ownerName,
      bizRegNo: client.bizRegNo,
      address: client.address,
      phone: client.phone,
      npBizNo: client.npBizNo,
      hiBizNo: client.hiBizNo,
      eiBizNo: client.eiBizNo,
      memo: client.memo,
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── 헤더 ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">거래처 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          거래처를 등록하고 선택하여 노동행정 업무를 처리합니다 (Pro Plus)
        </p>
      </div>

      {/* ── 현재 선택된 거래처 배지 ── */}
      {selectedClient && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <span className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-sm font-bold">
              {selectedClient.companyName.charAt(0)}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-600 text-white">
                  현재 선택
                </span>
                <span className="font-semibold text-blue-900 truncate">
                  {selectedClient.companyName}
                </span>
              </div>
              <p className="text-xs text-blue-600 mt-0.5 truncate">
                {[
                  selectedClient.ownerName && `대표: ${selectedClient.ownerName}`,
                  selectedClient.bizRegNo && `사업자번호: ${selectedClient.bizRegNo}`,
                ]
                  .filter(Boolean)
                  .join(" | ") || "상세 정보 없음"}
              </p>
            </div>
          </div>
          <button
            onClick={clearSelectedClient}
            className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded-lg transition-colors"
          >
            선택 해제
          </button>
        </div>
      )}

      {/* ── 액션 바 (검색 + 추가 버튼) ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-72">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="거래처명, 대표자, 사업자번호 검색..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <p className="text-sm text-gray-500 hidden sm:block">
            총 <span className="font-semibold text-gray-900">{filteredClients.length}</span>개
            {searchQuery && ` (전체 ${clients.length}개)`}
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          거래처 추가
        </button>
      </div>

      {/* ── 에러 ── */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError("")} className="text-red-500 hover:text-red-700 text-xs underline ml-2">
            닫기
          </button>
        </div>
      )}

      {/* ── 거래처 목록 ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          {clients.length === 0 ? (
            <>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">등록된 거래처가 없습니다</p>
              <p className="text-gray-400 text-sm mt-1">
                거래처를 추가하면 4대보험, 급여명세서 등 노동행정 업무를 거래처별로 관리할 수 있습니다.
              </p>
              <button
                onClick={() => handleOpenModal()}
                className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                첫 거래처 추가하기
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 text-sm">
                &quot;{searchQuery}&quot;에 해당하는 거래처가 없습니다.
              </p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm underline"
              >
                검색 초기화
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* 데스크탑 테이블 */}
          <div className="hidden lg:block bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 w-10">#</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">상호</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">대표자</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">사업자등록번호</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">전화번호</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">관리번호</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">메모</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600 w-44">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredClients.map((client, idx) => {
                    const isSelected = selectedClient?.id === client.id;
                    return (
                      <tr
                        key={client.id}
                        className={`transition-colors ${
                          isSelected
                            ? "bg-blue-50 hover:bg-blue-100"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{client.companyName}</span>
                            {isSelected && (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white">
                                선택됨
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{client.ownerName || "-"}</td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                          {client.bizRegNo || "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                          {client.phone || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {client.npBizNo && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200">
                                국민 {client.npBizNo}
                              </span>
                            )}
                            {client.hiBizNo && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-sky-50 text-sky-700 border border-sky-200">
                                건강 {client.hiBizNo}
                              </span>
                            )}
                            {client.eiBizNo && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                고용 {client.eiBizNo}
                              </span>
                            )}
                            {!client.npBizNo && !client.hiBizNo && !client.eiBizNo && (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs max-w-[160px] truncate" title={client.memo || ""}>
                          {client.memo || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {isSelected ? (
                              <button
                                onClick={clearSelectedClient}
                                className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-100 hover:bg-blue-200 rounded transition-colors"
                              >
                                선택 해제
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSelectClient(client)}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
                              >
                                선택
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenModal(client)}
                              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
                            >
                              수정
                            </button>
                            <button
                              onClick={() => setDeleteTarget(client)}
                              className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 모바일 / 태블릿 카드 리스트 */}
          <div className="lg:hidden space-y-3">
            {filteredClients.map((client, idx) => {
              const isSelected = selectedClient?.id === client.id;
              const isExpanded = expandedId === client.id;
              return (
                <div
                  key={client.id}
                  className={`bg-white rounded-xl border overflow-hidden shadow-sm transition-colors ${
                    isSelected ? "border-blue-300 ring-1 ring-blue-200" : "border-gray-200"
                  }`}
                >
                  {/* 카드 헤더 */}
                  <div
                    className="px-4 py-3 flex items-center gap-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : client.id)}
                  >
                    <span
                      className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 truncate">
                          {client.companyName}
                        </span>
                        {isSelected && (
                          <span className="flex-shrink-0 inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-600 text-white">
                            선택됨
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {[client.ownerName, client.bizRegNo].filter(Boolean).join(" / ") || "상세 정보 없음"}
                      </p>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* 카드 확장 상세 */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      <div className="px-4 py-3 space-y-2 text-sm">
                        <InfoRow label="대표자" value={client.ownerName} />
                        <InfoRow label="사업자번호" value={client.bizRegNo} mono />
                        <InfoRow label="주소" value={client.address} />
                        <InfoRow label="전화번호" value={client.phone} mono />
                        {(client.npBizNo || client.hiBizNo || client.eiBizNo) && (
                          <div className="pt-1">
                            <p className="text-xs font-medium text-gray-500 mb-1.5">보험 관리번호</p>
                            <div className="flex flex-wrap gap-1.5">
                              {client.npBizNo && (
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                                  국민연금 {client.npBizNo}
                                </span>
                              )}
                              {client.hiBizNo && (
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                                  건강보험 {client.hiBizNo}
                                </span>
                              )}
                              {client.eiBizNo && (
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                  고용산재 {client.eiBizNo}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {client.memo && (
                          <div className="pt-1">
                            <p className="text-xs font-medium text-gray-500 mb-1">메모</p>
                            <p className="text-gray-700 text-xs bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                              {client.memo}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* 카드 액션 버튼 */}
                      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
                        {isSelected ? (
                          <button
                            onClick={clearSelectedClient}
                            className="flex-1 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            선택 해제
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSelectClient(client)}
                            className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            이 거래처로 작업하기
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenModal(client)}
                          className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => setDeleteTarget(client)}
                          className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── 안내 문구 ── */}
      {!loading && clients.length > 0 && (
        <div className="text-xs text-gray-400 space-y-1">
          <p>
            * 거래처를 선택하면 급여명세서, 4대보험 신고, 근로계약서 등 모든 노동행정 업무에 해당 거래처 정보가 자동 적용됩니다.
          </p>
          <p>
            * 삭제된 거래처는 비활성화 처리되며, 기존 데이터는 유지됩니다.
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* 추가/수정 모달                                         */}
      {/* ══════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-xl z-10">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingClient ? "거래처 수정" : "거래처 추가"}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {editingClient ? "거래처 정보를 수정합니다." : "새 거래처를 등록합니다."}
              </p>
              <button
                onClick={() => setShowModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                &times;
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="p-6 space-y-4">
              {/* 상호 (필수) */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  상호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  placeholder="주식회사 어드미니"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  autoFocus
                />
              </div>

              {/* 대표자 & 사업자등록번호 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">대표자</label>
                  <input
                    type="text"
                    value={form.ownerName}
                    onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                    placeholder="홍길동"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">사업자등록번호</label>
                  <input
                    type="text"
                    value={form.bizRegNo}
                    onChange={(e) => setForm({ ...form, bizRegNo: formatBizRegNo(e.target.value) })}
                    placeholder="000-00-00000"
                    maxLength={12}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* 주소 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">주소</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="서울특별시 강남구 테헤란로 123"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* 전화번호 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">전화번호</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                  placeholder="02-1234-5678"
                  maxLength={13}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {/* 구분선: 보험 관리번호 */}
              <div className="pt-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-200 pb-2">
                  4대보험 사업장 관리번호
                </p>
              </div>

              {/* 국민연금 & 건강보험 관리번호 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    국민연금 관리번호
                  </label>
                  <input
                    type="text"
                    value={form.npBizNo}
                    onChange={(e) => setForm({ ...form, npBizNo: e.target.value })}
                    placeholder="NP-000000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    건강보험 관리번호
                  </label>
                  <input
                    type="text"
                    value={form.hiBizNo}
                    onChange={(e) => setForm({ ...form, hiBizNo: e.target.value })}
                    placeholder="HI-000000"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* 고용/산재보험 관리번호 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  고용/산재보험 관리번호
                </label>
                <input
                  type="text"
                  value={form.eiBizNo}
                  onChange={(e) => setForm({ ...form, eiBizNo: e.target.value })}
                  placeholder="EI-000000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
                <p className="text-xs text-gray-400 mt-1">고용보험과 산재보험은 동일 관리번호를 사용합니다.</p>
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
                <textarea
                  value={form.memo}
                  onChange={(e) => setForm({ ...form, memo: e.target.value })}
                  placeholder="거래처에 대한 메모를 입력하세요..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                />
              </div>

              {/* 폼 에러 */}
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}
            </div>

            {/* 모달 하단 버튼 */}
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    저장 중...
                  </span>
                ) : editingClient ? (
                  "수정"
                ) : (
                  "등록"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════ */}
      {/* 삭제 확인 모달                                        */}
      {/* ══════════════════════════════════════════════════════ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 text-center">
              {/* 경고 아이콘 */}
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">거래처 삭제</h3>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{deleteTarget.companyName}</span>
                {deleteTarget.ownerName && (
                  <span className="text-gray-500"> ({deleteTarget.ownerName})</span>
                )}
                을(를) 삭제하시겠습니까?
              </p>
              <p className="text-xs text-gray-400 mt-2">
                삭제된 거래처는 비활성화 처리되며, 기존 데이터는 보존됩니다.
              </p>
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-6 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    삭제 중...
                  </span>
                ) : (
                  "삭제"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 정보 행 컴포넌트 (모바일 카드 상세) ───

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="flex-shrink-0 text-xs text-gray-500 w-16">{label}</span>
      <span className={`text-xs text-gray-800 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
