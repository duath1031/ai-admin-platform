"use client";

/**
 * =============================================================================
 * [Patent Technology] Government Service Hybrid Card Component
 * =============================================================================
 *
 * AI-Powered Hybrid Civil Service Application UI
 *
 * [Technical Innovation Points]
 * 1. Dual-Mode UI - RPA Auto-Submit vs Manual Guide
 * 2. Real-time Progress Tracking - WebSocket-like polling
 * 3. Automatic Fallback - RPA failure gracefully switches to guide mode
 * 4. Session-aware Authentication Flow
 *
 * @author AI Admin Platform
 * @version 1.0.0
 * =============================================================================
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

// =============================================================================
// Type Definitions
// =============================================================================

export interface CivilServiceInfo {
  id: string;
  name: string;
  description: string;
  processingPeriod: string;
  fee: string;
  requiredDocs: string[];
  agency: string;
  onlineAvailable: boolean;
  gov24Url?: string;
}

export type AuthCarrier = "SKT" | "KT" | "LGU" | "SKT_MVNO" | "KT_MVNO" | "LGU_MVNO";
export type AuthMethod = "pass" | "kakao" | "naver" | "toss";

export interface AuthFormData {
  name: string;
  birthDate: string;
  phoneNumber: string;
  carrier: AuthCarrier;
  authMethod: AuthMethod;
}

export type SubmitMode = "auto" | "manual";
export type AuthStatus = "idle" | "requesting" | "waiting_auth" | "authenticated" | "failed" | "expired";

interface GovServiceCardProps {
  service: CivilServiceInfo;
  onSubmitSuccess?: (applicationId: string) => void;
  onSubmitError?: (error: string) => void;
  className?: string;
}

// =============================================================================
// Carrier Options
// =============================================================================

const CARRIER_OPTIONS: { value: AuthCarrier; label: string }[] = [
  { value: "SKT", label: "SKT" },
  { value: "KT", label: "KT" },
  { value: "LGU", label: "LG U+" },
  { value: "SKT_MVNO", label: "SKT 알뜰폰" },
  { value: "KT_MVNO", label: "KT 알뜰폰" },
  { value: "LGU_MVNO", label: "LG U+ 알뜰폰" },
];

const AUTH_METHOD_OPTIONS: { value: AuthMethod; label: string; appName: string; color: string }[] = [
  { value: "pass", label: "통신사 PASS", appName: "PASS 앱", color: "bg-red-500" },
  { value: "kakao", label: "카카오톡", appName: "카카오톡", color: "bg-yellow-400" },
  { value: "naver", label: "네이버", appName: "네이버 앱", color: "bg-green-500" },
  { value: "toss", label: "토스", appName: "토스 앱", color: "bg-blue-500" },
];

// =============================================================================
// Component
// =============================================================================

export default function GovServiceCard({
  service,
  onSubmitSuccess,
  onSubmitError,
  className = "",
}: GovServiceCardProps) {
  // Mode State
  const [submitMode, setSubmitMode] = useState<SubmitMode>("auto");
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Auth State
  const [authStatus, setAuthStatus] = useState<AuthStatus>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [remainingTime, setRemainingTime] = useState<number>(300);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState<AuthFormData>({
    name: "",
    birthDate: "",
    phoneNumber: "",
    carrier: "SKT",
    authMethod: "pass",
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof AuthFormData, string>>>({});

  // Polling refs
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  // =============================================================================
  // Cleanup
  // =============================================================================

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // =============================================================================
  // Form Validation
  // =============================================================================

  const validateForm = useCallback((): boolean => {
    const errors: Partial<AuthFormData> = {};

    if (!formData.name || formData.name.length < 2) {
      errors.name = "이름을 2자 이상 입력해주세요";
    } else if (!/^[가-힣]+$/.test(formData.name)) {
      errors.name = "이름은 한글만 입력 가능합니다";
    }

    if (!formData.birthDate || formData.birthDate.length !== 8) {
      errors.birthDate = "생년월일 8자리를 입력해주세요 (예: 19900101)";
    } else if (!/^\d{8}$/.test(formData.birthDate)) {
      errors.birthDate = "숫자만 입력해주세요";
    }

    if (!formData.phoneNumber) {
      errors.phoneNumber = "휴대폰 번호를 입력해주세요";
    } else if (!/^01[016789]\d{7,8}$/.test(formData.phoneNumber)) {
      errors.phoneNumber = "올바른 휴대폰 번호 형식이 아닙니다";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  // =============================================================================
  // Auth Request Handler
  // =============================================================================

  const handleAuthRequest = useCallback(async () => {
    if (!validateForm()) return;

    setAuthStatus("requesting");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/rpa/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        setSessionId(result.sessionId);
        setAuthStatus("waiting_auth");
        setRemainingTime(result.expiresIn || 300);

        // Start polling for auth confirmation
        startAuthPolling(result.sessionId);

        // Start countdown timer
        startCountdown();
      } else {
        setAuthStatus("failed");
        setErrorMessage(result.message || "인증 요청에 실패했습니다");
        // Fallback to manual mode
        handleFallbackToManual();
      }
    } catch (error) {
      console.error("[GovServiceCard] Auth request error:", error);
      setAuthStatus("failed");
      setErrorMessage("네트워크 오류가 발생했습니다");
      handleFallbackToManual();
    }
  }, [formData, validateForm]);

  // =============================================================================
  // Auth Polling
  // =============================================================================

  const startAuthPolling = useCallback((sid: string) => {
    // Clear existing polling
    if (pollingRef.current) clearInterval(pollingRef.current);

    // Poll every 3 seconds
    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch("/api/rpa/auth/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid }),
        });

        const result = await response.json();

        if (result.authenticated) {
          // Auth success
          setAuthStatus("authenticated");
          stopPolling();

          // Proceed with civil service submission
          await handleCivilServiceSubmit(sid);
        } else if (result.status === "expired") {
          setAuthStatus("expired");
          setErrorMessage("인증 시간이 만료되었습니다");
          stopPolling();
        } else if (result.status === "failed") {
          setAuthStatus("failed");
          setErrorMessage(result.message || "인증에 실패했습니다");
          stopPolling();
          handleFallbackToManual();
        }
        // If still waiting_auth, continue polling
      } catch (error) {
        console.error("[GovServiceCard] Polling error:", error);
      }
    }, 3000);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  // =============================================================================
  // Countdown Timer
  // =============================================================================

  const startCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);

    countdownRef.current = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 1) {
          stopPolling();
          setAuthStatus("expired");
          setErrorMessage("인증 시간이 만료되었습니다");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopPolling]);

  // =============================================================================
  // Reset State
  // =============================================================================

  const resetAuthState = useCallback(() => {
    setAuthStatus("idle");
    setSessionId(null);
    setRemainingTime(300);
    setErrorMessage(null);
    setFormData({
      name: "",
      birthDate: "",
      phoneNumber: "",
      carrier: "SKT",
      authMethod: "pass",
    });
    setFormErrors({});
    stopPolling();
  }, [stopPolling]);

  // =============================================================================
  // Civil Service Submit
  // =============================================================================

  const handleCivilServiceSubmit = useCallback(async (sid: string) => {
    // 인증 완료 - 성공 콜백 호출
    // 실제 민원 제출은 별도 페이지(/civil-service/new)에서 처리
    onSubmitSuccess?.(sid);
    setTimeout(() => {
      setShowAuthModal(false);
      resetAuthState();
    }, 2000);
  }, [onSubmitSuccess, resetAuthState]);

  // =============================================================================
  // Fallback Handler
  // =============================================================================

  const handleFallbackToManual = useCallback(() => {
    setSubmitMode("manual");
    setShowAuthModal(false);
    stopPolling();
  }, [stopPolling]);

  // =============================================================================
  // Render Helpers
  // =============================================================================

  const formatTime = (seconds: number): string => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const getStatusColor = (status: AuthStatus): string => {
    switch (status) {
      case "authenticated":
        return "text-green-600";
      case "failed":
      case "expired":
        return "text-red-600";
      case "waiting_auth":
      case "requesting":
        return "text-blue-600";
      default:
        return "text-gray-600";
    }
  };

  const getAuthMethodInfo = () => {
    return AUTH_METHOD_OPTIONS.find((o) => o.value === formData.authMethod) || AUTH_METHOD_OPTIONS[0];
  };

  const getStatusText = (status: AuthStatus): string => {
    const method = getAuthMethodInfo();
    switch (status) {
      case "idle":
        return "대기 중";
      case "requesting":
        return "인증 요청 중...";
      case "waiting_auth":
        return `${method.appName} 인증 대기 중`;
      case "authenticated":
        return "인증 완료";
      case "failed":
        return "인증 실패";
      case "expired":
        return "시간 만료";
      default:
        return "";
    }
  };

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <>
      <Card className={`overflow-hidden ${className}`} variant="bordered">
        {/* Header - Service Info Summary */}
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {service.name}
              </h3>
              <p className="text-sm text-gray-600 mt-1">{service.agency}</p>
            </div>
            {service.onlineAvailable && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                온라인 신청 가능
              </span>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Service Details */}
          <p className="text-gray-700 text-sm">{service.description}</p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-gray-500 block">처리기간</span>
              <span className="font-medium text-gray-900">
                {service.processingPeriod || "문의 필요"}
              </span>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <span className="text-gray-500 block">수수료</span>
              <span className="font-medium text-gray-900">
                {service.fee || "무료"}
              </span>
            </div>
          </div>

          {/* Required Documents */}
          {service.requiredDocs && service.requiredDocs.length > 0 && (
            <div className="bg-yellow-50 rounded-lg p-3">
              <span className="text-yellow-800 font-medium block mb-2">
                구비서류
              </span>
              <ul className="text-sm text-yellow-700 space-y-1">
                {service.requiredDocs.map((doc, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="mr-2">-</span>
                    {doc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Mode Selection Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setSubmitMode("auto")}
              className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                submitMode === "auto"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              원클릭 자동 접수
            </button>
            <button
              onClick={() => setSubmitMode("manual")}
              className={`flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                submitMode === "manual"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              직접 신청 가이드
            </button>
          </div>
        </CardContent>

        <CardFooter className="bg-gray-50">
          {submitMode === "auto" ? (
            /* RPA Auto Mode */
            <div className="w-full space-y-3">
              <Button
                onClick={() => setShowAuthModal(true)}
                className="w-full"
                size="lg"
                disabled={!service.onlineAvailable}
              >
                원클릭 자동 접수
              </Button>
              {!service.onlineAvailable && (
                <p className="text-xs text-gray-500 text-center">
                  이 민원은 온라인 신청을 지원하지 않습니다
                </p>
              )}
            </div>
          ) : (
            /* Manual Guide Mode */
            <div className="w-full space-y-3">
              <a
                href={service.gov24Url || "https://www.gov.kr"}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                <Button variant="secondary" className="w-full" size="lg">
                  정부24 바로가기
                </Button>
              </a>
              <p className="text-xs text-gray-500 text-center">
                위 링크에서 직접 민원을 신청하세요
              </p>
            </div>
          )}
        </CardFooter>
      </Card>

      {/* Auth Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (authStatus === "idle" || authStatus === "failed" || authStatus === "expired") {
                setShowAuthModal(false);
                resetAuthState();
              }
            }}
          />

          {/* Modal Content */}
          <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                간편인증
              </h2>

              {authStatus === "idle" || authStatus === "failed" || authStatus === "expired" ? (
                /* Auth Form */
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAuthRequest();
                  }}
                  className="space-y-4"
                >
                  {errorMessage && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                      {errorMessage}
                    </div>
                  )}

                  {/* 인증 방식 선택 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      인증 방식
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {AUTH_METHOD_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, authMethod: option.value }))
                          }
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                            formData.authMethod === option.value
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                          }`}
                        >
                          <span className={`w-3 h-3 rounded-full ${option.color} flex-shrink-0`} />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Input
                    label="이름"
                    placeholder="홍길동"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    error={formErrors.name}
                  />

                  <Input
                    label="생년월일"
                    placeholder="19900101"
                    maxLength={8}
                    value={formData.birthDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        birthDate: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                    error={formErrors.birthDate}
                  />

                  <Input
                    label="휴대폰 번호"
                    placeholder="01012345678"
                    maxLength={11}
                    value={formData.phoneNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phoneNumber: e.target.value.replace(/\D/g, ""),
                      }))
                    }
                    error={formErrors.phoneNumber}
                  />

                  <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      통신사
                    </label>
                    <select
                      value={formData.carrier}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          carrier: e.target.value as AuthCarrier,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                    >
                      {CARRIER_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        setShowAuthModal(false);
                        resetAuthState();
                      }}
                    >
                      취소
                    </Button>
                    <Button type="submit" className="flex-1">
                      인증 요청
                    </Button>
                  </div>
                </form>
              ) : authStatus === "requesting" ? (
                /* Requesting State */
                <div className="text-center py-8">
                  <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-700">인증 요청 중...</p>
                </div>
              ) : authStatus === "waiting_auth" ? (
                /* Waiting Auth State */
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
                    <svg
                      className="w-8 h-8 text-yellow-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {getAuthMethodInfo().appName} 인증 대기 중
                    </h3>
                    <p className="text-gray-600 mt-1">
                      {getAuthMethodInfo().appName}에서 인증을 완료해주세요
                    </p>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <span className="text-sm text-blue-600">남은 시간</span>
                    <p className="text-2xl font-bold text-blue-700">
                      {formatTime(remainingTime)}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => {
                      handleFallbackToManual();
                    }}
                  >
                    직접 신청으로 전환
                  </Button>
                </div>
              ) : authStatus === "authenticated" ? (
                /* Authenticated State */
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-green-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    인증 완료
                  </h3>
                  <p className="text-gray-600 mt-1">민원 접수를 진행합니다...</p>
                </div>
              ) : null}

              {/* Status Display */}
              {authStatus !== "idle" && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">상태</span>
                    <span className={`font-medium ${getStatusColor(authStatus)}`}>
                      {getStatusText(authStatus)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
