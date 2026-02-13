/**
 * 멀티 AI 라우터 — 질문 유형별 모델 자동 선택
 *
 * Flash (60%): 단순 Q&A, 인사, 서식 안내, 절차 안내
 * Pro (25%): 복잡한 법령 분석, 토지 분석, 입찰 분석
 * Flash + Grounding (15%): 최신 정보 필요한 질문
 *
 * 비용 절감 효과: ~60% API 비용 감소
 */

export type RouteTarget = "flash" | "pro" | "flash_grounding";

export interface RouteResult {
  target: RouteTarget;
  modelName: string;
  reason: string;
  maxOutputTokens: number;
  temperature: number;
}

// 복잡한 분석이 필요한 키워드 (→ Pro)
const PRO_KEYWORDS = [
  // 법률 분석
  "판례", "대법원", "헌법재판소", "법적 해석", "법률 검토", "법적 분쟁",
  "소송", "항소", "상고", "손해배상", "계약 위반", "독소조항",
  // 토지/부동산 심층 분석
  "토지 분석", "용적률 계산", "건폐율 계산", "개발행위허가",
  "토지이용계획 해석", "건축법 해석", "도시계획",
  // 입찰/조달 분석
  "입찰 전략", "투찰가 분석", "사정율", "적격심사", "기술평가",
  // 세무/회계 복잡 분석
  "세무 조사", "가산세", "이전가격", "합병 세무", "연결납세",
  // 보조금 전략
  "보조금 전략", "정책자금 컨설팅", "사업계획서 작성",
];

// 최신 정보 필요한 키워드 (→ Flash + Grounding)
const GROUNDING_KEYWORDS = [
  "최근", "올해", "2026", "2025", "현재", "지금",
  "개정", "신설", "시행", "공고", "모집",
  "최신 법령", "최근 판례", "새로운 정책",
  "공모", "접수 기간", "마감일",
];

// 단순 절차/안내 키워드 (→ Flash 확정)
const SIMPLE_KEYWORDS = [
  "어떻게", "방법", "절차", "필요 서류", "구비 서류",
  "신고", "신청", "등록", "발급", "제출",
  "비용", "수수료", "처리 기간",
  "양식", "서식", "다운로드",
  "주소", "연락처", "전화번호", "위치",
];

/**
 * 질문 유형을 분석하여 최적 모델을 선택
 * 빠른 키워드 기반 분류 (LLM 호출 없음, <1ms)
 */
export function routeQuery(message: string): RouteResult {
  const msg = message.toLowerCase();
  const msgLen = message.length;

  // 1) 매우 짧은 메시지 → Flash
  if (msgLen < 20) {
    return {
      target: "flash",
      modelName: "gemini-2.0-flash",
      reason: "짧은 메시지",
      maxOutputTokens: 2048,
      temperature: 0.7,
    };
  }

  // 2) Pro 키워드 체크 (복잡한 분석)
  const proScore = PRO_KEYWORDS.filter((k) => msg.includes(k)).length;
  if (proScore >= 2 || (proScore >= 1 && msgLen > 100)) {
    return {
      target: "pro",
      modelName: "gemini-1.5-pro",
      reason: `복잡한 분석 (pro 키워드 ${proScore}개)`,
      maxOutputTokens: 4096,
      temperature: 0.3,
    };
  }

  // 3) Grounding 키워드 체크 (최신 정보)
  const groundingScore = GROUNDING_KEYWORDS.filter((k) => msg.includes(k)).length;
  if (groundingScore >= 2) {
    return {
      target: "flash_grounding",
      modelName: "gemini-2.0-flash",
      reason: `최신 정보 필요 (grounding 키워드 ${groundingScore}개)`,
      maxOutputTokens: 2048,
      temperature: 0.5,
    };
  }

  // 4) 단순 절차/안내 키워드 → Flash (가장 저렴)
  const simpleScore = SIMPLE_KEYWORDS.filter((k) => msg.includes(k)).length;
  if (simpleScore >= 1) {
    return {
      target: "flash",
      modelName: "gemini-2.0-flash",
      reason: `절차/안내 질문 (simple 키워드 ${simpleScore}개)`,
      maxOutputTokens: 2048,
      temperature: 0.7,
    };
  }

  // 5) 긴 메시지인데 Pro 키워드 1개 → Pro
  if (proScore >= 1 && msgLen > 80) {
    return {
      target: "pro",
      modelName: "gemini-1.5-pro",
      reason: "복잡한 질문 (길이 + 키워드)",
      maxOutputTokens: 4096,
      temperature: 0.3,
    };
  }

  // 6) 기본값 → Flash
  return {
    target: "flash",
    modelName: "gemini-2.0-flash",
    reason: "일반 질문 (기본 라우팅)",
    maxOutputTokens: 2048,
    temperature: 0.7,
  };
}

/**
 * 플랜 등급에 따른 모델 오버라이드
 * Pro/Pro Plus/Enterprise → Pro 모델 사용 가능
 * Starter/Standard → Flash만 사용
 */
export function applyPlanOverride(
  route: RouteResult,
  planCode: string
): RouteResult {
  // Starter/Standard는 항상 Flash (비용 최적화)
  if (planCode === "starter" || planCode === "standard") {
    if (route.target === "pro") {
      return {
        ...route,
        target: "flash",
        modelName: "gemini-2.0-flash",
        reason: route.reason + " → Flash (플랜 제한)",
        maxOutputTokens: 2048,
      };
    }
  }

  // Pro Plus → Pro 모델 maxOutputTokens 확장
  if (planCode === "pro_plus") {
    if (route.target === "pro") {
      return {
        ...route,
        maxOutputTokens: 8192,
      };
    }
  }

  return route;
}
