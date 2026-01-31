export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * =============================================================================
 * RPA Delegate API
 * =============================================================================
 * Main Server(Vercel) -> Worker Server(Railway) 작업 위임
 *
 * [역할]
 * - RPA 작업 요청을 Worker 서버로 전달
 * - 작업 상태 DB 기록
 * - Vercel 10초 타임아웃 우회
 */

const WORKER_URL = process.env.RPA_WORKER_URL || "http://localhost:3001";
const WORKER_API_KEY = process.env.RPA_WORKER_API_KEY || "";

interface DelegateRequest {
  taskType: "gov24_auth_request" | "gov24_auth_confirm" | "gov24_submit";
  taskData: Record<string, any>;
  async?: boolean; // 비동기 처리 여부
}

// Worker 서버에 작업 요청
async function callWorker(taskType: string, taskData: Record<string, any>) {
  const response = await fetch(`${WORKER_URL}/execute-task`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": WORKER_API_KEY,
    },
    body: JSON.stringify({ taskType, taskData }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Worker error: ${error}`);
  }

  return response.json();
}

/**
 * POST /api/rpa/delegate
 * Worker 서버에 RPA 작업 위임
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: DelegateRequest = await request.json();
    const { taskType, taskData, async: isAsync = false } = body;

    if (!taskType || !taskData) {
      return NextResponse.json(
        { error: "taskType and taskData are required" },
        { status: 400 }
      );
    }

    console.log(`[RPA Delegate] Starting: ${taskType}`);

    // DB에 작업 기록
    const rpaTask = await prisma.rpaTask.create({
      data: {
        taskType,
        targetSite: "gov24",
        targetUrl: "https://www.gov.kr",
        formData: JSON.stringify(taskData),
        status: "pending",
        userId: session.user.id,
      },
    });

    // 비동기 처리 모드
    if (isAsync) {
      // 백그라운드에서 Worker 호출 (응답 대기 안 함)
      callWorker(taskType, { ...taskData, taskId: rpaTask.id })
        .then(async (result) => {
          await prisma.rpaTask.update({
            where: { id: rpaTask.id },
            data: {
              status: result.success ? "success" : "failed",
              executionLog: JSON.stringify(result.logs || []),
              completedAt: new Date(),
              errorMessage: result.error || null,
            },
          });
        })
        .catch(async (error) => {
          await prisma.rpaTask.update({
            where: { id: rpaTask.id },
            data: {
              status: "failed",
              errorMessage: error.message,
              completedAt: new Date(),
            },
          });
        });

      // 즉시 응답 (작업 ID만 반환)
      return NextResponse.json({
        success: true,
        taskId: rpaTask.id,
        message: "작업이 백그라운드에서 처리됩니다.",
        status: "pending",
      });
    }

    // 동기 처리 모드 (Worker 응답 대기)
    await prisma.rpaTask.update({
      where: { id: rpaTask.id },
      data: {
        status: "running",
        startedAt: new Date(),
      },
    });

    const result = await callWorker(taskType, { ...taskData, taskId: rpaTask.id });

    // 결과 저장
    await prisma.rpaTask.update({
      where: { id: rpaTask.id },
      data: {
        status: result.success ? "success" : "failed",
        executionLog: JSON.stringify(result.logs || []),
        completedAt: new Date(),
        errorMessage: result.error || null,
      },
    });

    return NextResponse.json({
      success: result.success,
      taskId: rpaTask.id,
      phase: result.phase,
      message: result.message,
      data: result,
    });

  } catch (error: any) {
    console.error("[RPA Delegate] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "RPA 작업 처리 중 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rpa/delegate?taskId=xxx
 * 작업 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 }
      );
    }

    const task = await prisma.rpaTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // 본인 작업인지 확인
    if (task.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      task: {
        id: task.id,
        taskType: task.taskType,
        status: task.status,
        progress: task.progress,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        errorMessage: task.errorMessage,
        logs: task.executionLog ? JSON.parse(task.executionLog) : [],
      },
    });

  } catch (error: any) {
    console.error("[RPA Delegate GET] Error:", error);

    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
