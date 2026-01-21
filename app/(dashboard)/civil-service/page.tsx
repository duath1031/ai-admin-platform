'use client';

// =============================================================================
// Civil Service List Page
// 민원 접수 목록 페이지 - UI/UX 개선 버전
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Submission {
  id: string;
  serviceName: string;
  serviceCode: string | null;
  targetSite: string;
  applicantName: string;
  status: string;
  progress: number;
  applicationNumber: string | null;
  creditsUsed: number;
  createdAt: string;
  completedAt: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; dotColor: string }> = {
  draft: { label: '임시저장', color: 'patent-badge-neutral', icon: '📝', dotColor: 'bg-gray-400' },
  pending: { label: '대기중', color: 'patent-badge-warning', icon: '⏳', dotColor: 'bg-yellow-500' },
  submitted: { label: '제출됨', color: 'patent-badge-info', icon: '📤', dotColor: 'bg-blue-500' },
  processing: { label: '처리중', color: 'patent-badge-info', icon: '⚙️', dotColor: 'bg-blue-500 animate-pulse' },
  completed: { label: '완료', color: 'patent-badge-success', icon: '✅', dotColor: 'bg-green-500' },
  failed: { label: '실패', color: 'patent-badge-danger', icon: '❌', dotColor: 'bg-red-500' },
  cancelled: { label: '취소됨', color: 'patent-badge-neutral', icon: '🚫', dotColor: 'bg-gray-400' },
};

const SITE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  gov24: { label: '정부24', color: 'bg-blue-100 text-blue-700', icon: '🏛️' },
  hometax: { label: '홈택스', color: 'bg-green-100 text-green-700', icon: '💰' },
  wetax: { label: '위택스', color: 'bg-purple-100 text-purple-700', icon: '🏠' },
  minwon: { label: '민원24', color: 'bg-orange-100 text-orange-700', icon: '📋' },
};

export default function CivilServiceListPage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
  });

  useEffect(() => {
    fetchSubmissions();
  }, [statusFilter, page]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(statusFilter && { status: statusFilter }),
      });

      const res = await fetch(`/api/rpa/civil-service?${params}`);
      const data = await res.json();

      if (data.success) {
        setSubmissions(data.data);
        setTotalPages(data.pagination.totalPages);

        // Calculate stats
        const allSubmissions = data.data as Submission[];
        setStats({
          total: data.pagination.total || allSubmissions.length,
          completed: allSubmissions.filter(s => s.status === 'completed').length,
          processing: allSubmissions.filter(s => ['pending', 'processing', 'submitted'].includes(s.status)).length,
          failed: allSubmissions.filter(s => s.status === 'failed').length,
        });
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('민원 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return formatDate(dateString);
  };

  const filteredSubmissions = submissions.filter(submission =>
    searchQuery === '' ||
    submission.serviceName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    submission.applicantName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (submission.applicationNumber && submission.applicationNumber.includes(searchQuery))
  );

  return (
    <div className="p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-3xl">🏛️</span>
            민원 대행 서비스
          </h1>
          <p className="text-gray-500 mt-1">전자위임장 기반 민원 자동 접수 서비스</p>
        </div>
        <Link
          href="/civil-service/new"
          className="btn-primary flex items-center gap-2 justify-center"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 민원 접수
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card-interactive" onClick={() => setStatusFilter('')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">전체</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-xl">📊</span>
            </div>
          </div>
        </div>
        <div className="card-interactive" onClick={() => setStatusFilter('completed')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">완료</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-xl">✅</span>
            </div>
          </div>
        </div>
        <div className="card-interactive" onClick={() => setStatusFilter('processing')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">진행중</p>
              <p className="text-2xl font-bold text-blue-600">{stats.processing}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-xl">⚙️</span>
            </div>
          </div>
        </div>
        <div className="card-interactive" onClick={() => setStatusFilter('failed')}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">실패</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-xl">❌</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="card mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="민원명, 신청인, 접수번호 검색..."
                className="input-field pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input-field w-auto min-w-[140px]"
            >
              <option value="">전체 상태</option>
              <option value="draft">📝 임시저장</option>
              <option value="pending">⏳ 대기중</option>
              <option value="processing">⚙️ 처리중</option>
              <option value="completed">✅ 완료</option>
              <option value="failed">❌ 실패</option>
            </select>
            <button
              onClick={() => fetchSubmissions()}
              className="btn-outline flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              새로고침
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl mb-6 flex items-center gap-3 animate-slide-up">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="card">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/4"></div>
                </div>
                <div className="h-6 bg-gray-200 rounded-full w-20"></div>
              </div>
            ))}
          </div>
        </div>
      ) : filteredSubmissions.length === 0 ? (
        <div className="card text-center py-16 animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">📭</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchQuery || statusFilter ? '검색 결과가 없습니다' : '접수된 민원이 없습니다'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchQuery || statusFilter
              ? '다른 검색어나 필터를 시도해보세요'
              : '새 민원을 접수하여 시작하세요'}
          </p>
          {!searchQuery && !statusFilter && (
            <Link href="/civil-service/new" className="btn-primary inline-flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              새 민원 접수하기
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Submissions List */}
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th>민원 정보</th>
                    <th>대상 사이트</th>
                    <th>신청인</th>
                    <th>상태</th>
                    <th>접수번호</th>
                    <th>신청일시</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubmissions.map((submission, index) => {
                    const statusConfig = STATUS_CONFIG[submission.status] || STATUS_CONFIG.draft;
                    const siteConfig = SITE_CONFIG[submission.targetSite] || { label: submission.targetSite, color: 'bg-gray-100 text-gray-700', icon: '📋' };

                    return (
                      <tr
                        key={submission.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/civil-service/${submission.id}`)}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <div className={`w-2.5 h-2.5 rounded-full ${statusConfig.dotColor}`}></div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {submission.serviceName}
                              </div>
                              {submission.serviceCode && (
                                <div className="text-xs text-gray-500 font-mono">
                                  {submission.serviceCode}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${siteConfig.color}`}>
                            <span>{siteConfig.icon}</span>
                            {siteConfig.label}
                          </span>
                        </td>
                        <td>
                          <span className="text-gray-900">{submission.applicantName}</span>
                        </td>
                        <td>
                          <span className={statusConfig.color}>
                            <span className="mr-1">{statusConfig.icon}</span>
                            {statusConfig.label}
                            {submission.status === 'processing' && (
                              <span className="ml-1 text-xs opacity-75">({submission.progress}%)</span>
                            )}
                          </span>
                        </td>
                        <td>
                          {submission.applicationNumber ? (
                            <span className="font-mono text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded">
                              {submission.applicationNumber}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td>
                          <div className="text-sm text-gray-500">
                            {formatRelativeTime(submission.createdAt)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">
                총 {stats.total}건 중 {(page - 1) * 10 + 1}-{Math.min(page * 10, stats.total)}건
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPage(i + 1)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                        page === i + 1
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
