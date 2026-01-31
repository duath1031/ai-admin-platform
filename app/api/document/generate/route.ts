/**
 * =============================================================================
 * Document Generation API
 * =============================================================================
 * POST /api/document/generate - 서식 문서 생성
 *
 * 요청:
 * {
 *   templateKey: "통신판매업신고서",
 *   formData: { businessName: "...", representativeName: "...", ... },
 *   format: "docx" // 또는 "pdf" (현재 docx만 지원)
 * }
 *
 * 응답:
 * - 성공: 문서 파일 (Content-Disposition: attachment)
 * - 실패: JSON 에러 메시지
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateDocx, validateFormData, FormData } from "@/lib/document/generator";
import { FORM_TEMPLATES } from "@/lib/document/templates";

export async function POST(req: NextRequest) {
  try {
    // 세션 확인 (선택적 - 비로그인도 허용할 수 있음)
    const session = await getServerSession(authOptions);

    // 요청 파싱
    const body = await req.json();
    const { templateKey, formData, format = "docx" } = body;

    // 필수 파라미터 확인
    if (!templateKey) {
      return NextResponse.json(
        { success: false, error: "templateKey가 필요합니다." },
        { status: 400 }
      );
    }

    if (!formData || typeof formData !== "object") {
      return NextResponse.json(
        { success: false, error: "formData가 필요합니다." },
        { status: 400 }
      );
    }

    // 템플릿 확인
    const template = FORM_TEMPLATES[templateKey];
    if (!template) {
      return NextResponse.json(
        { success: false, error: `템플릿을 찾을 수 없습니다: ${templateKey}` },
        { status: 404 }
      );
    }

    // 필수 필드 검증
    const validation = validateFormData(template, formData as FormData);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "필수 항목이 누락되었습니다.",
          missingFields: validation.missingFields,
        },
        { status: 400 }
      );
    }

    console.log(`[Document Generate] Template: ${templateKey}, User: ${session?.user?.email || "anonymous"}`);

    // 문서 생성
    const result = await generateDocx(templateKey, formData as FormData);

    if (!result.success || !result.fileData) {
      return NextResponse.json(
        { success: false, error: result.error || "문서 생성 실패" },
        { status: 500 }
      );
    }

    // Buffer를 정확한 바이너리로 변환 (Node.js Buffer pool 문제 방지)
    // Buffer가 pool에서 할당되면 underlying ArrayBuffer가 더 크므로
    // 정확한 byte range만 추출해야 DOCX ZIP 구조가 유지됨
    const safeBuffer = Buffer.from(result.fileData);

    const headers = new Headers();
    headers.set("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    headers.set("Content-Disposition", "attachment; filename=document.docx");
    headers.set("Content-Length", String(safeBuffer.length));
    headers.set("Cache-Control", "no-cache, no-store");

    console.log(`[Document Generate] Success: ${result.fileName} (${safeBuffer.length} bytes)`);

    return new NextResponse(safeBuffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("[Document Generate] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "서버 오류",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/document/generate?templateKey=xxx
 * 템플릿 필드 정보 조회 (AI가 질문 목록 생성할 때 사용)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const templateKey = searchParams.get("templateKey");

    if (!templateKey) {
      // 전체 템플릿 목록 반환
      const templates = Object.entries(FORM_TEMPLATES).map(([key, template]) => ({
        key,
        id: template.id,
        name: template.name,
        category: template.category,
        description: template.description,
        fieldCount: template.fields.length,
        requiredFieldCount: template.fields.filter((f) => f.required).length,
      }));

      return NextResponse.json({
        success: true,
        templates,
      });
    }

    // 특정 템플릿 상세 정보
    const template = FORM_TEMPLATES[templateKey];
    if (!template) {
      return NextResponse.json(
        { success: false, error: `템플릿을 찾을 수 없습니다: ${templateKey}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template: {
        key: templateKey,
        ...template,
      },
    });
  } catch (error) {
    console.error("[Document Generate GET] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "서버 오류",
      },
      { status: 500 }
    );
  }
}
