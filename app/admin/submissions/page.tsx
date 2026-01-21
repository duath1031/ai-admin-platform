"use client";

import { useEffect, useState } from "react";

interface Submission {
  id: string;
  type: string;
  name: string;
  phone: string;
  email: string;
  documentType: string;
  description: string | null;
  status: string;
  adminNote: string | null;
  emailSent: boolean;
  smsSent: boolean;
  kakaoSent: boolean;
  createdAt: string;
  processedAt: string | null;
  completedAt: string | null;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "대기중", color: "yellow" },
  { value: "contacted", label: "연락완료", color: "blue" },
  { value: "in_progress", label: "처리중", color: "purple" },
  { value: "completed", label: "완료", color: "green" },
  { value: "cancelled", label: "취소", color: "gray" },
];

export default function AdminSubmissions() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [filter, setFilter] = useState({ status: "", type: "" });
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  useEffect(() => {
    fetchSubmissions();
  }, [filter, pagination.page]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.status) params.append("status", filter.status);
      if (filter.type) params.append("type", filter.type);
      params.append("page", pagination.page.toString());
      params.append("limit", "20");

      const response = await fetch(`/api/submission?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data.submissions || []);
        setPagination((prev) => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 0,
        }));
      }
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateSubmission = async (id: string, updates: Partial<Submission>) => {
    try {
      const response = await fetch(`/api/submission/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        fetchSubmissions();
        if (selectedSubmission?.id === id) {
          setSelectedSubmission((prev) => prev ? { ...prev, ...updates } : null);
        }
      }
    } catch (error) {
      console.error("업데이트 실패:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find((o) => o.value === status);
    const colorMap: Record<string, string> = {
      yellow: "bg-yellow-100 text-yellow-800",
      blue: "bg-blue-100 text-blue-800",
      purple: "bg-purple-100 text-purple-800",
      green: "bg-green-100 text-green-800",
      gray: "bg-gray-100 text-gray-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorMap[option?.color || "gray"]}`}>
        {option?.label || status}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">신청 관리</h1>
        <div className="flex gap-2">
          <select
            value={filter.type}
            onChange={(e) => setFilter((prev) => ({ ...prev, type: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">전체 유형</option>
            <option value="proxy">접수대행</option>
            <option value="delegate">대리의뢰</option>
          </select>
          <select
            value={filter.status}
            onChange={(e) => setFilter((prev) => ({ ...prev, status: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">전체 상태</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청자</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">민원</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">알림</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {submissions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          신청이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      submissions.map((submission) => (
                        <tr
                          key={submission.id}
                          onClick={() => setSelectedSubmission(submission)}
                          className={`cursor-pointer hover:bg-gray-50 ${
                            selectedSubmission?.id === submission.id ? "bg-blue-50" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              submission.type === "proxy" ? "bg-teal-100 text-teal-800" : "bg-indigo-100 text-indigo-800"
                            }`}>
                              {submission.type === "proxy" ? "접수대행" : "대리의뢰"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{submission.name}</p>
                            <p className="text-sm text-gray-500">{submission.phone}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-700 max-w-[200px] truncate">
                            {submission.documentType}
                          </td>
                          <td className="px-4 py-3">{getStatusBadge(submission.status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <span title="이메일" className={submission.emailSent ? "text-green-500" : "text-gray-300"}>✉️</span>
                              <span title="SMS" className={submission.smsSent ? "text-green-500" : "text-gray-300"}>📱</span>
                              <span title="카카오" className={submission.kakaoSent ? "text-green-500" : "text-gray-300"}>💬</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(submission.createdAt).toLocaleDateString("ko-KR")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    총 {pagination.total}건 중 {((pagination.page - 1) * 20) + 1}-{Math.min(pagination.page * 20, pagination.total)}건
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      disabled={pagination.page === 1}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      이전
                    </button>
                    <button
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      disabled={pagination.page === pagination.totalPages}
                      className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                      다음
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail Panel */}
        {selectedSubmission && (
          <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">신청 상세</h2>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-500">유형</label>
                <p className="font-medium">
                  {selectedSubmission.type === "proxy" ? "접수대행" : "대리의뢰"}
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-500">신청자</label>
                <p className="font-medium">{selectedSubmission.name}</p>
              </div>

              <div>
                <label className="text-sm text-gray-500">연락처</label>
                <p>
                  <a href={`tel:${selectedSubmission.phone}`} className="text-blue-600 hover:underline">
                    {selectedSubmission.phone}
                  </a>
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-500">이메일</label>
                <p>
                  <a href={`mailto:${selectedSubmission.email}`} className="text-blue-600 hover:underline">
                    {selectedSubmission.email}
                  </a>
                </p>
              </div>

              <div>
                <label className="text-sm text-gray-500">민원 종류</label>
                <p className="font-medium">{selectedSubmission.documentType}</p>
              </div>

              {selectedSubmission.description && (
                <div>
                  <label className="text-sm text-gray-500">상세 내용</label>
                  <p className="text-sm bg-gray-50 p-3 rounded-lg">{selectedSubmission.description}</p>
                </div>
              )}

              <div>
                <label className="text-sm text-gray-500 block mb-1">상태 변경</label>
                <select
                  value={selectedSubmission.status}
                  onChange={(e) => updateSubmission(selectedSubmission.id, { status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-500 block mb-1">관리자 메모</label>
                <textarea
                  defaultValue={selectedSubmission.adminNote || ""}
                  onBlur={(e) => updateSubmission(selectedSubmission.id, { adminNote: e.target.value })}
                  placeholder="메모를 입력하세요..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg min-h-[80px]"
                />
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <a
                    href={`tel:${selectedSubmission.phone}`}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg text-center font-medium hover:bg-green-700"
                  >
                    📞 전화하기
                  </a>
                  <a
                    href={`mailto:${selectedSubmission.email}`}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-center font-medium hover:bg-blue-700"
                  >
                    ✉️ 이메일
                  </a>
                </div>
              </div>

              <div className="text-xs text-gray-400">
                <p>신청일: {new Date(selectedSubmission.createdAt).toLocaleString("ko-KR")}</p>
                {selectedSubmission.processedAt && (
                  <p>처리일: {new Date(selectedSubmission.processedAt).toLocaleString("ko-KR")}</p>
                )}
                {selectedSubmission.completedAt && (
                  <p>완료일: {new Date(selectedSubmission.completedAt).toLocaleString("ko-KR")}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
