"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 토큰 충전 페이지 → 마이페이지로 리다이렉트
 * 초과과금 자동결제 시스템으로 전환됨
 */
export default function TokenChargePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/mypage");
  }, [router]);

  return (
    <div className="max-w-md mx-auto py-16 text-center">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
      <p className="text-gray-500">
        토큰 충전이 초과과금 자동결제로 변경되었습니다.
      </p>
      <p className="text-sm text-gray-400 mt-1">
        마이페이지로 이동합니다...
      </p>
    </div>
  );
}
