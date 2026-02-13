"use client";

import { useEffect, useState } from "react";

interface User {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  phone: string | null;
  credits: number;
  plan: string;
  role: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    chats: number;
    documents: number;
    subscriptions: number;
  };
}

interface Stats {
  [key: string]: number;
}

const PLAN_OPTIONS = [
  { value: "starter", label: "Starter (무료)", color: "gray" },
  { value: "standard", label: "Standard (9만)", color: "blue" },
  { value: "pro", label: "Pro (15만)", color: "purple" },
  { value: "pro_plus", label: "Pro Plus (25만)", color: "orange" },
];

const ROLE_OPTIONS = [
  { value: "USER", label: "사용자" },
  { value: "ADMIN", label: "관리자" },
];

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [stats, setStats] = useState<Stats>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [editData, setEditData] = useState({
    plan: "",
    credits: 0,
    phone: "",
    role: "USER",
    syncTokensWithPlan: true, // 플랜 변경 시 토큰도 플랜 기준으로 동기화
  });

  useEffect(() => {
    fetchUsers();
  }, [search, planFilter, roleFilter, pagination.page]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (planFilter) params.append("plan", planFilter);
      if (roleFilter) params.append("role", roleFilter);
      params.append("page", pagination.page.toString());
      params.append("limit", "20");

      const response = await fetch(`/api/admin/users?${params}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users || []);
        setStats(data.stats || {});
        setPagination((prev) => ({
          ...prev,
          total: data.pagination?.total || 0,
          totalPages: data.pagination?.totalPages || 0,
        }));
      }
    } catch (error) {
      console.error("사용자 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUser = (user: User) => {
    setSelectedUser(user);
    setEditData({
      plan: user.plan,
      credits: user.credits,
      phone: user.phone || "",
      role: user.role,
      syncTokensWithPlan: true,
    });
  };

  const handleSave = async () => {
    if (!selectedUser) return;

    try {
      setSaving(true);
      // 플랜 변경 + 토큰 동기화인 경우, credits를 보내지 않아야 서버에서 tokenQuota로 설정
      const payload: Record<string, unknown> = {
        plan: editData.plan,
        phone: editData.phone,
        role: editData.role,
      };
      // 플랜이 변경되었고 토큰 동기화가 켜져있으면 credits 미포함 → 서버가 tokenQuota 적용
      if (editData.plan !== selectedUser.plan && editData.syncTokensWithPlan) {
        // credits를 보내지 않음 → 서버에서 해당 플랜의 tokenQuota로 자동 설정
      } else {
        payload.credits = editData.credits;
      }
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchUsers();
        setSelectedUser(null);
      } else {
        const data = await response.json();
        alert(data.error || "저장 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error("저장 실패:", error);
      alert("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedUser) return;

    const confirmed = window.confirm(
      `정말로 "${selectedUser.name || selectedUser.email}" 사용자를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 해당 사용자의 모든 데이터가 삭제됩니다.`
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (response.ok) {
        setSelectedUser(null);
        await fetchUsers();
      } else {
        alert(data.error || "삭제 중 오류가 발생했습니다.");
      }
    } catch (error) {
      console.error("삭제 실패:", error);
      alert("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeleting(false);
    }
  };

  const getPlanBadge = (plan: string) => {
    const option = PLAN_OPTIONS.find((o) => o.value === plan);
    const colorMap: Record<string, string> = {
      gray: "bg-gray-100 text-gray-800",
      blue: "bg-blue-100 text-blue-800",
      purple: "bg-purple-100 text-purple-800",
      orange: "bg-orange-100 text-orange-800",
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colorMap[option?.color || "gray"]}`}>
        {option?.label || plan}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    if (role === "ADMIN") {
      return (
        <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
          관리자
        </span>
      );
    }
    return (
      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        사용자
      </span>
    );
  };

  const totalUsers = Object.values(stats).reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">사용자 관리</h1>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-500">전체 사용자</p>
          <p className="text-2xl font-bold text-gray-900">{totalUsers}</p>
        </div>
        {PLAN_OPTIONS.map((plan) => (
          <div key={plan.value} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500">{plan.label}</p>
            <p className="text-2xl font-bold text-gray-900">{stats[plan.value] || 0}</p>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이름 또는 이메일 검색..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">전체 플랜</option>
          {PLAN_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg"
        >
          <option value="">전체 역할</option>
          {ROLE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-6">
        {/* 사용자 목록 */}
        <div className={`${selectedUser ? "w-2/3" : "w-full"} bg-white rounded-xl shadow-sm border border-gray-200`}>
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용자</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">플랜</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">토큰</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">활동</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                          사용자가 없습니다.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr
                          key={user.id}
                          onClick={() => handleSelectUser(user)}
                          className={`cursor-pointer hover:bg-gray-50 ${
                            selectedUser?.id === user.id ? "bg-blue-50" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {user.image ? (
                                <img
                                  src={user.image}
                                  alt={user.name || ""}
                                  className="w-8 h-8 rounded-full"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm">
                                  {user.name?.charAt(0) || "?"}
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-gray-900">{user.name || "(이름 없음)"}</p>
                                <p className="text-sm text-gray-500">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                          <td className="px-4 py-3">{getPlanBadge(user.plan)}</td>
                          <td className="px-4 py-3">
                            <span className={`font-medium ${user.credits === -1 ? "text-green-600" : user.credits < 1000 ? "text-red-600" : ""}`}>
                              {user.credits === -1 ? "무제한" : user.credits.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            채팅 {user._count.chats}개 | 문서 {user._count.documents}개
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500">
                            {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 페이지네이션 */}
              {pagination.totalPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    총 {pagination.total}명 중 {((pagination.page - 1) * 20) + 1}-{Math.min(pagination.page * 20, pagination.total)}명
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

        {/* 상세 패널 */}
        {selectedUser && (
          <div className="w-1/3 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">사용자 정보</h2>
              <button
                onClick={() => setSelectedUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                닫기
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {selectedUser.image ? (
                  <img
                    src={selectedUser.image}
                    alt={selectedUser.name || ""}
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-2xl">
                    {selectedUser.name?.charAt(0) || "?"}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-lg">{selectedUser.name || "(이름 없음)"}</p>
                  <p className="text-gray-500">{selectedUser.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">역할</label>
                <select
                  value={editData.role}
                  onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">플랜</label>
                <select
                  value={editData.plan}
                  onChange={(e) => setEditData({ ...editData, plan: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {PLAN_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  토큰 잔액
                  {selectedUser.credits === -1 && (
                    <span className="ml-1 text-xs text-green-600">(무제한)</span>
                  )}
                </label>
                {editData.plan !== selectedUser.plan && (
                  <label className="flex items-center gap-2 mb-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editData.syncTokensWithPlan}
                      onChange={(e) => setEditData({ ...editData, syncTokensWithPlan: e.target.checked })}
                      className="w-3.5 h-3.5 rounded text-blue-600"
                    />
                    <span className="text-blue-600">플랜 변경 시 해당 플랜 기본 토큰으로 리셋</span>
                  </label>
                )}
                <input
                  type="number"
                  value={editData.credits}
                  onChange={(e) => setEditData({ ...editData, credits: parseInt(e.target.value) || 0, syncTokensWithPlan: false })}
                  disabled={editData.plan !== selectedUser.plan && editData.syncTokensWithPlan}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                />
                <p className="text-xs text-gray-400 mt-1">
                  -1 = 무제한 | 현재: {selectedUser.credits === -1 ? "무제한" : selectedUser.credits.toLocaleString() + " 토큰"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
                <input
                  type="tel"
                  value={editData.phone}
                  onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-medium text-gray-900 mb-2">활동 통계</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-gray-500">채팅</p>
                    <p className="font-medium">{selectedUser._count.chats}개</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-gray-500">문서</p>
                    <p className="font-medium">{selectedUser._count.documents}개</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-gray-500">구독</p>
                    <p className="font-medium">{selectedUser._count.subscriptions}개</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-gray-500">마지막 로그인</p>
                    <p className="font-medium">
                      {selectedUser.lastLoginAt
                        ? new Date(selectedUser.lastLoginAt).toLocaleDateString("ko-KR")
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 text-sm"
                >
                  {deleting ? "삭제 중..." : "강제 탈퇴"}
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
