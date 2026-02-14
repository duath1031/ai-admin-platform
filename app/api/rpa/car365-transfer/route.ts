/**
 * 자동차365 이전등록 RPA API
 * POST /api/rpa/car365-transfer
 *
 * Actions:
 * - start: 이전등록 시작 (본인인증 요청)
 * - confirm: 인증 완료 후 폼 제출
 * - debug: 사이트 구조 디버그
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkFeatureAccess } from "@/lib/token/planAccess";
import { deductTokens } from "@/lib/token/tokenService";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WORKER_URL = process.env.RPA_WORKER_URL || "https://admini-rpa-worker-production.up.railway.app";
const WORKER_API_KEY = process.env.RPA_WORKER_API_KEY || "admini-rpa-worker-2024-secure-key";

async function callWorker(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`${WORKER_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": WORKER_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Worker ${endpoint} failed (${res.status}): ${text}`);
  }

  return res.json();
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "action은 필수입니다." }, { status: 400 });
    }

    switch (action) {
      // ─── START: 이전등록 시작 + 본인인증 요청 ───
      case "start": {
        const { name, phoneNumber, carrier, birthDate } = body;

        if (!name || !phoneNumber || !birthDate) {
          return NextResponse.json(
            { error: "이름, 전화번호, 생년월일은 필수입니다." },
            { status: 400 }
          );
        }

        // 플랜/토큰 체크
        const access = await checkFeatureAccess(session.user.id, "rpa_submission");
        if (!access.allowed) {
          return NextResponse.json(
            { error: "플랜 업그레이드가 필요합니다.", requiredPlan: access.requiredPlan },
            { status: 403 }
          );
        }

        const result = await callWorker("/car365/transfer/start", {
          name,
          phoneNumber,
          carrier: carrier || "SKT",
          birthDate,
          // 이전등록 데이터 전달
          sellerName: body.sellerName,
          sellerPhone: body.sellerPhone,
          sellerIdNumber: body.sellerIdNumber,
          buyerName: body.buyerName || name,
          buyerPhone: body.buyerPhone || phoneNumber,
          buyerIdNumber: body.buyerIdNumber,
          buyerAddress: body.buyerAddress,
          vehicleName: body.vehicleName,
          plateNumber: body.plateNumber,
          modelYear: body.modelYear,
          mileage: body.mileage,
          salePrice: body.salePrice,
          transferDate: body.transferDate,
          region: body.region,
        });

        return NextResponse.json({
          success: result.success,
          taskId: result.taskId,
          status: result.status,
          message: result.message,
          logs: result.logs?.slice(-20),
        });
      }

      // ─── CONFIRM: 인증 완료 후 제출 ───
      case "confirm": {
        const { taskId, autoSubmit } = body;

        if (!taskId) {
          return NextResponse.json({ error: "taskId는 필수입니다." }, { status: 400 });
        }

        // 토큰 차감 (제출 시에만)
        const deducted = await deductTokens(session.user.id, "rpa_submission");
        if (!deducted) {
          return NextResponse.json(
            { error: "토큰이 부족합니다.", redirect: "/token-charge" },
            { status: 402 }
          );
        }

        const result = await callWorker("/car365/transfer/confirm", {
          taskId,
          autoSubmit: autoSubmit !== false,
        });

        return NextResponse.json({
          success: result.success,
          taskId: result.taskId,
          status: result.status,
          receiptNumber: result.receiptNumber,
          message: result.message,
          logs: result.logs?.slice(-20),
        });
      }

      // ─── DEBUG: 사이트 구조 확인 ───
      case "debug": {
        const debugRes = await fetch(`${WORKER_URL}/car365/debug?url=${encodeURIComponent(body.url || "")}`, {
          headers: { "x-api-key": WORKER_API_KEY },
        });
        const debugResult = await debugRes.json();
        return NextResponse.json(debugResult);
      }

      default:
        return NextResponse.json(
          { error: `알 수 없는 action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Car365 Transfer API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
