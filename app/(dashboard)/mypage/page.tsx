"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Card, CardContent, Button } from "@/components/ui";
import Link from "next/link";

interface Stats {
  totalDocuments: number;
  totalChats: number;
  completedDocuments: number;
  draftDocuments: number;
}

interface RecentActivity {
  id: string;
  type: "document" | "chat";
  title: string;
  createdAt: string;
}

export default function MyPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // 문서24 계정 연동
  const [doc24Account, setDoc24Account] = useState<{ isLinked: boolean; maskedId?: string; displayName?: string; accountType?: string } | null>(null);
  const [doc24Id, setDoc24Id] = useState('');
  const [doc24Password, setDoc24Password] = useState('');
  const [doc24AccountType, setDoc24AccountType] = useState('personal');
  const [doc24Linking, setDoc24Linking] = useState(false);

  useEffect(() => {
    fetchUserData();
    fetchDoc24Account();
  }, []);

  const fetchUserData = async () => {
    try {
      const [statsRes, activitiesRes] = await Promise.all([
        fetch("/api/user/stats"),
        fetch("/api/user/activities"),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (activitiesRes.ok) {
        const activitiesData = await activitiesRes.json();
        setActivities(activitiesData);
      }
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  const fetchDoc24Account = async () => {
    try {
      const res = await fetch('/api/user/doc24-account');
      if (res.ok) {
        const data = await res.json();
        setDoc24Account(data);
      }
    } catch (error) {
      console.error('Failed to fetch doc24 account:', error);
    }
  };

  const handleLinkDoc24 = async () => {
    if (!doc24Id || !doc24Password) return;
    setDoc24Linking(true);
    try {
      const res = await fetch('/api/user/doc24-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc24Id, doc24Password, accountType: doc24AccountType }),
      });
      const data = await res.json();
      if (data.success) {
        setDoc24Account({ isLinked: true, maskedId: data.maskedId, accountType: doc24AccountType });
        setDoc24Id('');
        setDoc24Password('');
        setDoc24AccountType('personal');
      } else {
        alert(data.error || '연동 실패');
      }
    } catch {
      alert('연동 중 오류가 발생했습니다.');
    } finally {
      setDoc24Linking(false);
    }
  };

  const handleUnlinkDoc24 = async () => {
    if (!confirm('문서24 계정 연동을 해제하시겠습니까?')) return;
    try {
      const res = await fetch('/api/user/doc24-account', { method: 'DELETE' });
      if (res.ok) {
        setDoc24Account({ isLinked: false });
      }
    } catch {
      alert('해제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">마이페이지</h1>
        <p className="text-gray-600">계정 정보 및 활동 내역을 확인하세요</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                {session?.user?.image ? (
                  <img
                    src={session.user.image}
                    alt="Profile"
                    className="w-20 h-20 rounded-full"
                  />
                ) : (
                  <span className="text-3xl text-primary-600">
                    {session?.user?.name?.[0] || "U"}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {session?.user?.name || "사용자"}
              </h2>
              <p className="text-gray-500 text-sm mb-4">
                {session?.user?.email}
              </p>
              <Button variant="outline" size="sm" onClick={handleLogout} className="w-full">
                로그아웃
              </Button>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">이용 현황</h3>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">작성 서류</span>
                    <span className="font-semibold text-gray-900">
                      {stats?.totalDocuments || 0}건
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">완료된 서류</span>
                    <span className="font-semibold text-green-600">
                      {stats?.completedDocuments || 0}건
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">작성중 서류</span>
                    <span className="font-semibold text-yellow-600">
                      {stats?.draftDocuments || 0}건
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">AI 상담</span>
                    <span className="font-semibold text-gray-900">
                      {stats?.totalChats || 0}회
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Activities */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">최근 활동</h3>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>아직 활동 내역이 없습니다</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {activities.map((activity) => (
                    <div key={activity.id} className="py-3 flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        activity.type === "document"
                          ? "bg-blue-100 text-blue-600"
                          : "bg-green-100 text-green-600"
                      }`}>
                        {activity.type === "document" ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{activity.title}</p>
                        <p className="text-sm text-gray-500">
                          {activity.type === "document" ? "서류 작성" : "AI 상담"}
                          {" · "}
                          {new Date(activity.createdAt).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 기업 정보 관리 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">기업 정보</h3>
                <Link
                  href="/mypage/company"
                  className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                >
                  관리하기
                </Link>
              </div>
              <Link href="/mypage/company">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                  <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center text-teal-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">기업 마스터 프로필</p>
                    <p className="text-sm text-gray-500">상호, 사업자번호, 주소 등 기업 정보를 등록하면 AI가 기억합니다</p>
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>

          {/* 문서24 계정 연동 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">문서24 계정</h3>
                <span className="text-xs text-gray-400">docu.gdoc.go.kr</span>
              </div>
              {doc24Account?.isLinked ? (
                <div className="flex items-center gap-4 p-4 bg-green-50 rounded-lg">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{doc24Account.maskedId}</p>
                    <p className="text-sm text-green-600">
                      연동됨 ({
                        doc24Account.accountType === 'corp_rep' ? '법인/단체 대표' :
                        doc24Account.accountType === 'corp_admin' ? '법인/단체 업무관리자' :
                        doc24Account.accountType === 'corp_member' ? '법인/단체 부서사용자' : '개인'
                      })
                    </p>
                  </div>
                  <button
                    onClick={handleUnlinkDoc24}
                    className="text-sm text-red-500 hover:text-red-700 font-medium"
                  >
                    해제
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">
                    문서24 계정을 연동하면 AI 채팅에서 공문을 자동 발송할 수 있습니다.
                  </p>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800 font-medium mb-1">ID/비밀번호 로그인만 지원됩니다</p>
                    <p className="text-xs text-amber-700">
                      간편인증(카카오/네이버 등)으로 가입하신 경우, 문서24 홈페이지에서 <strong>ID/비밀번호를 설정</strong>한 후 연동해주세요.
                      공인인증서로만 가입된 경우에도 ID/비밀번호 재설정이 필요합니다.
                    </p>
                    <a
                      href="https://docu.gdoc.go.kr"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline mt-1 inline-block"
                    >
                      문서24 바로가기 &rarr;
                    </a>
                  </div>
                  <select
                    value={doc24AccountType}
                    onChange={(e) => setDoc24AccountType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="personal">개인 사용자</option>
                    <option value="corp_rep">법인/단체 - 대표사용자</option>
                    <option value="corp_admin">법인/단체 - 업무관리자</option>
                    <option value="corp_member">법인/단체 - 부서(일반) 사용자</option>
                  </select>
                  <input
                    type="text"
                    placeholder="문서24 아이디"
                    value={doc24Id}
                    onChange={(e) => setDoc24Id(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="password"
                    placeholder="비밀번호"
                    value={doc24Password}
                    onChange={(e) => setDoc24Password(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Button
                    onClick={handleLinkDoc24}
                    disabled={doc24Linking || !doc24Id || !doc24Password}
                    size="sm"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {doc24Linking ? '연동 중...' : '계정 연동'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 결제 내역 */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">결제 내역</h3>
                <Link
                  href="/mypage/payments"
                  className="text-sm text-primary-600 hover:text-primary-800 font-medium"
                >
                  전체 보기
                </Link>
              </div>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900">결제 및 구매 내역 확인</p>
                  <p className="text-sm text-gray-500">영수증 조회 및 결제 관리</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Settings */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">계정 설정</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">이메일 알림</p>
                    <p className="text-sm text-gray-500">서류 작성 완료 시 알림 받기</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-primary-100 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">데이터 보관</p>
                    <p className="text-sm text-gray-500">작성한 서류 및 상담 내역 저장</p>
                  </div>
                  <span className="text-sm text-primary-600 font-medium">90일</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Support */}
          <Card>
            <CardContent className="p-6">
              <h3 className="font-semibold text-gray-900 mb-4">도움말</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <a href="#" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">자주 묻는 질문</p>
                    <p className="text-sm text-gray-500">FAQ 확인하기</p>
                  </div>
                </a>
                <a href="#" className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">문의하기</p>
                    <p className="text-sm text-gray-500">1:1 문의 접수</p>
                  </div>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
