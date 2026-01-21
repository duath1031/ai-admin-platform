'use client';

// =============================================================================
// Civil Service Submission Detail Page
// 민원 접수 상세 페이지 - UI/UX 개선 버전
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ProgressTracker from '@/components/civil-service/ProgressTracker';

interface TrackingLog {
  id: string;
  step: string;
  stepOrder: number;
  status: string;
  message: string | null;
  screenshotUrl: string | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface SubmissionDetail {
  id: string;
  serviceName: string;
  serviceCode: string | null;
  targetSite: string;
  targetUrl: string | null;
  applicantName: string;
  applicantBirth: string | null;
  applicantPhone: string | null;
  applicationData: Array<{
    fieldId: string;
    fieldName: string;
    fieldType: string;
    value: string | boolean;
    required: boolean;
  }>;
  status: string;
  progress: number;
  applicationNumber: string | null;
  receiptUrl: string | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  creditsUsed: number;
  powerOfAttorney: {
    id: string;
    delegatorName: string;
    serviceName: string;
    status: string;
    validFrom: string;
    validTo: string;
  } | null;
  trackingLogs: TrackingLog[];
  createdAt: string;
  completedAt: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string; bgColor: string }> = {
  draft: { label: '임시저장', color: 'text-gray-600', icon: '📝', bgColor: 'bg-gray-100' },
  pending: { label: '대기중', color: 'text-yellow-600', icon: '⏳', bgColor: 'bg-yellow-100' },
  submitted: { label: '제출됨', color: 'text-blue-600', icon: '📤', bgColor: 'bg-blue-100' },
  processing: { label: '처리중', color: 'text-blue-600', icon: '⚙️', bgColor: 'bg-blue-100' },
  completed: { label: '완료', color: 'text-green-600', icon: '✅', bgColor: 'bg-green-100' },
  failed: { label: '실패', color: 'text-red-600', icon: '❌', bgColor: 'bg-red-100' },
  cancelled: { label: '취소됨', color: 'text-gray-500', icon: '🚫', bgColor: 'bg-gray-100' },
};

const SITE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  gov24: { label: '정부24', color: 'text-blue-700', icon: '🏛️' },
  hometax: { label: '홈택스', color: 'text-green-700', icon: '💰' },
  wetax: { label: '위택스', color: 'text-purple-700', icon: '🏠' },
  minwon: { label: '민원24', color: 'text-orange-700', icon: '📋' },
};

export default function CivilServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [submission, setSubmission] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchSubmission = useCallback(async () => {
    try {
      const res = await fetch(`/api/rpa/civil-service/${id}`);
      const data = await res.json();

      if (data.success) {
        setSubmission(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('민원 정보를 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSubmission();

    // Poll for updates if in progress
    const interval = setInterval(() => {
      if (submission?.status === 'pending' || submission?.status === 'processing' || submission?.status === 'submitted') {
        fetchSubmission();
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchSubmission, submission?.status]);

  const handleAction = async (action: 'execute' | 'retry' | 'cancel') => {
    setActionLoading(true);
    setError(null);

    try {
      if (action === 'cancel') {
        const res = await fetch(`/api/rpa/civil-service/${id}`, {
          method: 'DELETE',
        });
        const data = await res.json();

        if (data.success) {
          router.push('/civil-service');
        } else {
          setError(data.error);
        }
      } else {
        const res = await fetch(`/api/rpa/civil-service/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();

        if (data.success) {
          fetchSubmission();
        } else {
          setError(data.error);
        }
      }
    } catch (err) {
      setError('작업 처리 중 오류가 발생했습니다');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">민원 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-gray-50/50 p-6">
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">❌</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">민원을 찾을 수 없습니다</h2>
          <p className="text-gray-500 mb-6">{error || '요청하신 민원 정보가 존재하지 않습니다'}</p>
          <Link href="/civil-service" className="btn-primary inline-flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = STATUS_CONFIG[submission.status] || STATUS_CONFIG.draft;
  const siteConfig = SITE_CONFIG[submission.targetSite] || { label: submission.targetSite, color: 'text-gray-700', icon: '📋' };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="p-6 max-w-6xl mx-auto animate-fade-in">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/civil-service"
            className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-700 transition-colors mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            목록으로
          </Link>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl ${statusConfig.bgColor} flex items-center justify-center`}>
                <span className="text-2xl">{statusConfig.icon}</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{submission.serviceName}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`inline-flex items-center gap-1 text-sm ${siteConfig.color}`}>
                    <span>{siteConfig.icon}</span>
                    {siteConfig.label}
                  </span>
                  {submission.serviceCode && (
                    <span className="text-sm text-gray-400 font-mono">{submission.serviceCode}</span>
                  )}
                </div>
              </div>
            </div>
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${statusConfig.bgColor} ${statusConfig.color}`}>
              <span>{statusConfig.icon}</span>
              {statusConfig.label}
              {submission.status === 'processing' && <span>({submission.progress}%)</span>}
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Progress Tracker */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-xl">📊</span>
                진행 상황
              </h2>
              <ProgressTracker
                logs={submission.trackingLogs}
                progress={submission.progress}
                status={submission.status}
              />
            </div>

            {/* Application Data */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-xl">📋</span>
                신청 정보
              </h2>
              <div className="divide-y divide-gray-100">
                {submission.applicationData.map((field) => (
                  <div key={field.fieldId} className="flex items-center justify-between py-3">
                    <span className="text-gray-500">{field.fieldName}</span>
                    <span className="font-medium text-gray-900">{String(field.value) || '-'}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Error Details */}
            {submission.errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 animate-slide-up">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-700">오류가 발생했습니다</h3>
                    <p className="text-red-600 mt-1">{submission.errorMessage}</p>
                    {submission.retryCount < submission.maxRetries && (
                      <button
                        onClick={() => handleAction('retry')}
                        disabled={actionLoading}
                        className="mt-4 btn-danger"
                      >
                        {actionLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            처리 중...
                          </>
                        ) : (
                          <>재시도 ({submission.retryCount}/{submission.maxRetries})</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Success Result */}
            {submission.status === 'completed' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 animate-slide-up">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-700">민원 접수가 완료되었습니다</h3>
                    <div className="mt-3 space-y-2">
                      {submission.applicationNumber && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">접수번호:</span>
                          <span className="font-mono font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-lg">
                            {submission.applicationNumber}
                          </span>
                        </div>
                      )}
                      {submission.completedAt && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">완료일시:</span>
                          <span className="text-gray-900">{formatDate(submission.completedAt)}</span>
                        </div>
                      )}
                    </div>
                    {submission.receiptUrl && (
                      <a
                        href={submission.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 btn-success inline-flex items-center gap-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        접수증 다운로드
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Summary Card */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-xl">📌</span>
                요약
              </h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">신청인</span>
                  <span className="font-medium">{submission.applicantName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">신청일시</span>
                  <span className="text-sm">{formatDate(submission.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">사용 크레딧</span>
                  <span className="font-semibold text-blue-600">{submission.creditsUsed}</span>
                </div>
              </div>
            </div>

            {/* POA Card */}
            {submission.powerOfAttorney && (
              <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span className="text-xl">📋</span>
                  전자위임장
                </h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">위임인</span>
                    <span className="font-medium">{submission.powerOfAttorney.delegatorName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">상태</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      submission.powerOfAttorney.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {submission.powerOfAttorney.status === 'active' ? '유효' : submission.powerOfAttorney.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">유효기간</span>
                    <span className="text-sm">
                      {new Date(submission.powerOfAttorney.validTo).toLocaleDateString('ko-KR')}까지
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="card">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="text-xl">⚡</span>
                작업
              </h2>
              <div className="space-y-3">
                {submission.status === 'draft' && (
                  <button
                    onClick={() => handleAction('execute')}
                    disabled={actionLoading}
                    className="w-full btn-primary flex items-center justify-center gap-2"
                  >
                    {actionLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        처리 중...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        민원 실행
                      </>
                    )}
                  </button>
                )}

                {['draft', 'pending'].includes(submission.status) && (
                  <button
                    onClick={() => handleAction('cancel')}
                    disabled={actionLoading}
                    className="w-full btn-outline text-red-500 border-red-300 hover:bg-red-50 flex items-center justify-center gap-2"
                  >
                    {actionLoading ? '처리 중...' : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        민원 취소
                      </>
                    )}
                  </button>
                )}

                {submission.status === 'completed' && (
                  <Link
                    href="/civil-service/new"
                    className="w-full btn-secondary flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    새 민원 접수
                  </Link>
                )}

                <Link
                  href="/civil-service"
                  className="w-full btn-outline flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  목록 보기
                </Link>
              </div>
            </div>

            {/* Help */}
            <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">도움이 필요하신가요?</p>
                  <p className="text-xs text-gray-500 mt-1">
                    문제가 발생하면 고객센터로 문의해 주세요.
                  </p>
                  <a href="#" className="text-xs text-blue-600 hover:underline mt-1 inline-block">
                    고객센터 문의하기
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
