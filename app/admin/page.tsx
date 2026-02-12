"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface AnalyticsData {
  users: {
    total: number;
    newThisMonth: number;
    newToday: number;
    planDistribution: { plan: string; count: number }[];
    activeSubscriptions: number;
    recent: { id: string; name: string; email: string; plan: string; createdAt: string }[];
  };
  revenue: {
    mrr: number;
    paymentCount: number;
  };
  usage: {
    totalChats: number;
    chatsToday: number;
    totalDocuments: number;
    documentsThisMonth: number;
    tokensConsumedThisMonth: number;
  };
  submissions: {
    total: number;
    pending: number;
    completed: number;
  };
  system: {
    dbConnected: boolean;
    lastChecked: string;
  };
}

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  standard: "Standard",
  pro: "Pro",
  pro_plus: "Pro Plus",
  enterprise: "Enterprise",
  none: "미가입",
  free: "무료",
  basic: "Basic",
};

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-gray-100 text-gray-700",
  standard: "bg-blue-100 text-blue-700",
  pro: "bg-purple-100 text-purple-700",
  pro_plus: "bg-orange-100 text-orange-700",
  enterprise: "bg-red-100 text-red-700",
  none: "bg-gray-50 text-gray-500",
  free: "bg-gray-50 text-gray-500",
  basic: "bg-blue-50 text-blue-600",
};

export default function AdminDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/admin/analytics");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (error) {
      console.error("분석 데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">
        데이터를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">관리자 대시보드</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className={`inline-block w-2 h-2 rounded-full ${data.system.dbConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
          시스템 {data.system.dbConnected ? '정상' : '이상'}
        </div>
      </div>

      {/* KPI Cards - Row 1: 핵심 지표 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="전체 회원"
          value={data.users.total}
          sub={`오늘 +${data.users.newToday}`}
          color="blue"
        />
        <StatCard
          label="활성 구독"
          value={data.users.activeSubscriptions}
          sub={`이번달 가입 +${data.users.newThisMonth}`}
          color="purple"
        />
        <StatCard
          label="이번달 매출"
          value={`${(data.revenue.mrr / 10000).toFixed(0)}만원`}
          sub={`결제 ${data.revenue.paymentCount}건`}
          color="green"
        />
        <StatCard
          label="토큰 소비"
          value={data.usage.tokensConsumedThisMonth.toLocaleString()}
          sub="이번달 사용량"
          color="orange"
        />
      </div>

      {/* KPI Cards - Row 2: 사용량 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="전체 채팅"
          value={data.usage.totalChats}
          sub={`오늘 ${data.usage.chatsToday}건`}
          color="sky"
        />
        <StatCard
          label="생성된 문서"
          value={data.usage.totalDocuments}
          sub={`이번달 ${data.usage.documentsThisMonth}건`}
          color="indigo"
        />
        <StatCard
          label="접수 신청"
          value={data.submissions.total}
          sub={`대기 ${data.submissions.pending}건`}
          color="yellow"
        />
        <StatCard
          label="처리 완료"
          value={data.submissions.completed}
          sub={`완료율 ${data.submissions.total > 0 ? Math.round((data.submissions.completed / data.submissions.total) * 100) : 0}%`}
          color="emerald"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 플랜별 분포 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">플랜별 회원 분포</h2>
          <div className="space-y-3">
            {data.users.planDistribution.map((item) => {
              const pct = data.users.total > 0
                ? Math.round((item.count / data.users.total) * 100)
                : 0;
              return (
                <div key={item.plan} className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium min-w-[80px] text-center ${PLAN_COLORS[item.plan] || 'bg-gray-100 text-gray-600'}`}>
                    {PLAN_LABELS[item.plan] || item.plan}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-gray-700 min-w-[60px] text-right">
                    {item.count}명 ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 최근 가입 회원 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">최근 가입 회원</h2>
            <Link href="/admin/users" className="text-sm text-blue-600 hover:text-blue-700">
              전체 보기
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {data.users.recent.map((user) => (
              <div key={user.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{user.name || '(이름 없음)'}</p>
                  <p className="text-xs text-gray-500">{user.email}</p>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLAN_COLORS[user.plan] || 'bg-gray-100 text-gray-600'}`}>
                    {PLAN_LABELS[user.plan] || user.plan || '미가입'}
                  </span>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(user.createdAt).toLocaleDateString("ko-KR")}
                  </p>
                </div>
              </div>
            ))}
            {data.users.recent.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-500 text-sm">
                가입 회원이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 빠른 링크 */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink href="/admin/users" label="회원 관리" icon="👥" />
        <QuickLink href="/admin/submissions" label="접수 관리" icon="📋" />
        <QuickLink href="/admin/knowledge" label="지식 베이스" icon="📚" />
        <QuickLink href="/admin/settings" label="사이트 설정" icon="⚙️" />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: {
  label: string;
  value: number | string;
  sub: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50",
    purple: "border-purple-200 bg-purple-50",
    green: "border-green-200 bg-green-50",
    orange: "border-orange-200 bg-orange-50",
    sky: "border-sky-200 bg-sky-50",
    indigo: "border-indigo-200 bg-indigo-50",
    yellow: "border-yellow-200 bg-yellow-50",
    emerald: "border-emerald-200 bg-emerald-50",
  };
  const textMap: Record<string, string> = {
    blue: "text-blue-700",
    purple: "text-purple-700",
    green: "text-green-700",
    orange: "text-orange-700",
    sky: "text-sky-700",
    indigo: "text-indigo-700",
    yellow: "text-yellow-700",
    emerald: "text-emerald-700",
  };

  return (
    <div className={`rounded-xl p-4 shadow-sm border ${colorMap[color] || 'border-gray-200 bg-white'}`}>
      <p className={`text-xs font-medium mb-1 ${textMap[color] || 'text-gray-500'}`}>{label}</p>
      <p className={`text-2xl font-bold ${textMap[color] || 'text-gray-900'}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-4 py-3 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
    >
      <span className="text-lg">{icon}</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </Link>
  );
}
