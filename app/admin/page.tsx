"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  totalSubmissions: number;
  pendingSubmissions: number;
  todaySubmissions: number;
  completedSubmissions: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalSubmissions: 0,
    pendingSubmissions: 0,
    todaySubmissions: 0,
    completedSubmissions: 0,
  });
  const [recentSubmissions, setRecentSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/submission?limit=5");
      if (response.ok) {
        const data = await response.json();
        setRecentSubmissions(data.submissions || []);

        // 통계 계산
        const allRes = await fetch("/api/submission?limit=1000");
        if (allRes.ok) {
          const allData = await allRes.json();
          const all = allData.submissions || [];
          const today = new Date().toISOString().split("T")[0];

          setStats({
            totalSubmissions: all.length,
            pendingSubmissions: all.filter((s: any) => s.status === "pending").length,
            todaySubmissions: all.filter((s: any) => s.createdAt.startsWith(today)).length,
            completedSubmissions: all.filter((s: any) => s.status === "completed").length,
          });
        }
      }
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      contacted: "bg-blue-100 text-blue-800",
      in_progress: "bg-purple-100 text-purple-800",
      completed: "bg-green-100 text-green-800",
      cancelled: "bg-gray-100 text-gray-800",
    };
    const labels: Record<string, string> = {
      pending: "대기중",
      contacted: "연락완료",
      in_progress: "처리중",
      completed: "완료",
      cancelled: "취소",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100"}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">관리자 대시보드</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500 mb-1">전체 신청</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalSubmissions}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-yellow-200 bg-yellow-50">
          <p className="text-sm text-yellow-700 mb-1">대기중</p>
          <p className="text-3xl font-bold text-yellow-700">{stats.pendingSubmissions}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-blue-200 bg-blue-50">
          <p className="text-sm text-blue-700 mb-1">오늘 신청</p>
          <p className="text-3xl font-bold text-blue-700">{stats.todaySubmissions}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-green-200 bg-green-50">
          <p className="text-sm text-green-700 mb-1">처리 완료</p>
          <p className="text-3xl font-bold text-green-700">{stats.completedSubmissions}</p>
        </div>
      </div>

      {/* Recent Submissions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">최근 신청</h2>
          <Link href="/admin/submissions" className="text-sm text-blue-600 hover:text-blue-700">
            전체 보기 →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청자</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">민원</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {recentSubmissions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    아직 신청이 없습니다.
                  </td>
                </tr>
              ) : (
                recentSubmissions.map((submission) => (
                  <tr key={submission.id} className="hover:bg-gray-50">
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
                    <td className="px-4 py-3 text-gray-700">{submission.documentType}</td>
                    <td className="px-4 py-3">{getStatusBadge(submission.status)}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(submission.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
