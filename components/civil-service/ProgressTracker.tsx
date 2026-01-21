'use client';

// =============================================================================
// Progress Tracker Component
// 민원 처리 진행 상황 추적 컴포넌트 - UI/UX 개선 버전
// =============================================================================

import React from 'react';

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

interface ProgressTrackerProps {
  logs: TrackingLog[];
  progress: number;
  status: string;
}

const STEP_INFO: Record<string, { label: string; icon: string; description: string }> = {
  initialize: { label: '초기화', icon: '🔧', description: 'RPA 엔진 준비' },
  verify_poa: { label: '위임장 검증', icon: '📋', description: '전자위임장 유효성 확인' },
  login: { label: '로그인', icon: '🔐', description: '정부 사이트 인증' },
  navigate: { label: '페이지 이동', icon: '🧭', description: '민원 신청 페이지 접근' },
  fill_form: { label: '양식 입력', icon: '✏️', description: '신청서 자동 작성' },
  verify_data: { label: '데이터 검증', icon: '✅', description: '입력 정보 확인' },
  submit: { label: '제출', icon: '📤', description: '민원 신청 제출' },
  confirm: { label: '접수 확인', icon: '🎉', description: '접수번호 발급' },
};

const STATUS_CONFIG: Record<string, {
  bgColor: string;
  borderColor: string;
  textColor: string;
  iconBg: string;
  badge: string;
}> = {
  pending: {
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-500',
    iconBg: 'bg-gray-200',
    badge: 'bg-gray-100 text-gray-500'
  },
  in_progress: {
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-700',
    iconBg: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700'
  },
  success: {
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    textColor: 'text-green-700',
    iconBg: 'bg-green-500',
    badge: 'bg-green-100 text-green-700'
  },
  failed: {
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    textColor: 'text-red-700',
    iconBg: 'bg-red-500',
    badge: 'bg-red-100 text-red-700'
  },
  skipped: {
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    textColor: 'text-gray-400',
    iconBg: 'bg-gray-300',
    badge: 'bg-gray-100 text-gray-400'
  },
};

export default function ProgressTracker({ logs, progress, status }: ProgressTrackerProps) {
  const logMap = new Map(logs.map(log => [log.step, log]));

  const allSteps = [
    'initialize',
    'verify_poa',
    'login',
    'navigate',
    'fill_form',
    'verify_data',
    'submit',
    'confirm',
  ];

  const getStepStatus = (step: string): string => {
    const log = logMap.get(step);
    if (!log) return 'pending';
    return log.status;
  };

  const getStepMessage = (step: string): string | null => {
    const log = logMap.get(step);
    return log?.message || null;
  };

  const getStepScreenshot = (step: string): string | null => {
    const log = logMap.get(step);
    return log?.screenshotUrl || null;
  };

  const formatDuration = (startedAt: string | null, completedAt: string | null): string | null => {
    if (!startedAt || !completedAt) return null;
    const start = new Date(startedAt).getTime();
    const end = new Date(completedAt).getTime();
    const duration = end - start;

    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}초`;
    return `${Math.floor(duration / 60000)}분 ${Math.floor((duration % 60000) / 1000)}초`;
  };

  const getProgressColor = () => {
    if (status === 'failed') return 'bg-red-500';
    if (status === 'completed') return 'bg-green-500';
    return 'bg-blue-500';
  };

  const getProgressBgColor = () => {
    if (status === 'failed') return 'bg-red-100';
    if (status === 'completed') return 'bg-green-100';
    return 'bg-blue-100';
  };

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full ${getProgressBgColor()} flex items-center justify-center`}>
              {status === 'completed' ? (
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : status === 'failed' ? (
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-blue-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {status === 'completed' ? '민원 접수 완료' : status === 'failed' ? '처리 실패' : '민원 처리 중...'}
              </h3>
              <p className="text-sm text-gray-500">
                {status === 'completed'
                  ? '모든 단계가 성공적으로 완료되었습니다'
                  : status === 'failed'
                  ? '문제가 발생했습니다. 재시도해 주세요'
                  : '잠시만 기다려 주세요'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className={`text-2xl font-bold ${
              status === 'completed' ? 'text-green-600' : status === 'failed' ? 'text-red-600' : 'text-blue-600'
            }`}>
              {progress}%
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className={`w-full h-3 ${getProgressBgColor()} rounded-full overflow-hidden`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressColor()} ${
              status !== 'completed' && status !== 'failed' ? 'progress-bar-striped' : ''
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step Timeline */}
      <div className="relative">
        {allSteps.map((step, index) => {
          const stepStatus = getStepStatus(step);
          const stepInfo = STEP_INFO[step] || { label: step, icon: '📌', description: '' };
          const styles = STATUS_CONFIG[stepStatus] || STATUS_CONFIG.pending;
          const message = getStepMessage(step);
          const screenshot = getStepScreenshot(step);
          const log = logMap.get(step);
          const duration = log ? formatDuration(log.startedAt, log.completedAt) : null;
          const isLast = index === allSteps.length - 1;

          return (
            <div key={step} className="relative flex gap-4">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                {/* Icon Circle */}
                <div
                  className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center shadow-sm transition-all duration-300 ${
                    stepStatus === 'in_progress'
                      ? 'ring-4 ring-blue-100 bg-blue-500'
                      : stepStatus === 'success'
                      ? 'bg-green-500'
                      : stepStatus === 'failed'
                      ? 'bg-red-500'
                      : 'bg-gray-200'
                  }`}
                >
                  {stepStatus === 'in_progress' ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : stepStatus === 'success' ? (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : stepStatus === 'failed' ? (
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <span className="text-lg">{stepInfo.icon}</span>
                  )}
                </div>

                {/* Connector Line */}
                {!isLast && (
                  <div
                    className={`w-0.5 flex-1 min-h-[40px] transition-all duration-300 ${
                      stepStatus === 'success' ? 'bg-green-300' : 'bg-gray-200'
                    }`}
                  />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
                <div
                  className={`p-4 rounded-xl border-2 transition-all duration-300 ${styles.bgColor} ${styles.borderColor}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className={`font-semibold ${styles.textColor}`}>
                          {stepInfo.label}
                        </h4>
                        <StatusBadge status={stepStatus} />
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{stepInfo.description}</p>

                      {message && (
                        <div className={`mt-2 text-sm ${styles.textColor} bg-white/50 rounded-lg px-3 py-2`}>
                          {message}
                        </div>
                      )}

                      {screenshot && (
                        <a
                          href={screenshot}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 mt-2 bg-blue-50 px-2 py-1 rounded-lg"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          스크린샷 보기
                        </a>
                      )}
                    </div>

                    {duration && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 bg-white/50 px-2 py-1 rounded-lg">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {duration}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string; icon?: React.ReactNode }> = {
    pending: {
      label: '대기',
      className: 'bg-gray-100 text-gray-500',
      icon: <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
    },
    in_progress: {
      label: '진행중',
      className: 'bg-blue-100 text-blue-700',
      icon: <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
    },
    success: {
      label: '완료',
      className: 'bg-green-100 text-green-700',
      icon: (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )
    },
    failed: {
      label: '실패',
      className: 'bg-red-100 text-red-700',
      icon: (
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    },
    skipped: {
      label: '건너뜀',
      className: 'bg-gray-100 text-gray-400',
      icon: <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
    },
  };

  const config = configs[status] || configs.pending;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.icon}
      {config.label}
    </span>
  );
}
