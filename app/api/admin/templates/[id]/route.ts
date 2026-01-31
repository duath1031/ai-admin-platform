/**
 * Admin Template Detail API
 * GET    /api/admin/templates/[id] - 단일 템플릿 조회
 * PUT    /api/admin/templates/[id] - 템플릿 수정
 * DELETE /api/admin/templates/[id] - 템플릿 삭제 (soft delete)
 */

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { saveTemplateToSupabase } from "@/lib/supabaseStorage";
import { extractPlaceholders } from "@/lib/document/placeholderExtractor";

/**
 * GET /api/admin/templates/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const template = await prisma.formTemplate.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json(
        { success: false, error: "템플릿을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template: {
        ...template,
        fields: JSON.parse(template.fields),
        requiredDocs: template.requiredDocs ? JSON.parse(template.requiredDocs) : [],
        tips: template.tips ? JSON.parse(template.tips) : [],
      },
    });
  } catch (error) {
    console.error("[Admin Template GET]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/templates/[id]
 * JSON body 또는 multipart/form-data (파일 교체 시)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.formTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "템플릿을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const contentType = req.headers.get("content-type") || "";

    let updateData: Record<string, unknown> = {};

    if (contentType.includes("multipart/form-data")) {
      // 파일 교체 포함
      const formData = await req.formData();
      const file = formData.get("file") as File | null;

      if (file) {
        const docxBuffer = Buffer.from(await file.arrayBuffer());
        const { storagePath } = await saveTemplateToSupabase(
          docxBuffer,
          `${existing.code}.docx`,
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        );
        updateData.docxStoragePath = storagePath;

        // 새 파일에서 플레이스홀더 재추출
        if (!formData.get("fields")) {
          const extraction = await extractPlaceholders(docxBuffer);
          updateData.fields = JSON.stringify(extraction.suggestedFields);
        }
      }

      // 텍스트 필드 업데이트
      const textFields = ["name", "category", "description", "gov24ServiceKey", "outputFileName", "fields", "requiredDocs", "tips", "status"];
      for (const field of textFields) {
        const value = formData.get(field);
        if (value !== null) {
          updateData[field] = value as string;
        }
      }
    } else {
      // JSON body
      const body = await req.json();
      const allowed = ["name", "category", "description", "gov24ServiceKey", "outputFileName", "status", "requiredDocs", "tips"];
      for (const key of allowed) {
        if (body[key] !== undefined) {
          updateData[key] = typeof body[key] === "object" ? JSON.stringify(body[key]) : body[key];
        }
      }
      if (body.fields !== undefined) {
        updateData.fields = typeof body.fields === "object"
          ? JSON.stringify(body.fields)
          : body.fields;
      }
    }

    updateData.version = existing.version + 1;

    const updated = await prisma.formTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      template: {
        ...updated,
        fields: JSON.parse(updated.fields),
      },
    });
  } catch (error) {
    console.error("[Admin Template PUT]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/templates/[id]
 * Soft delete (status → "archived")
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await prisma.formTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "템플릿을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    await prisma.formTemplate.update({
      where: { id },
      data: { status: "archived" },
    });

    return NextResponse.json({
      success: true,
      message: `템플릿 '${existing.name}' 아카이브 완료`,
    });
  } catch (error) {
    console.error("[Admin Template DELETE]", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "서버 오류" },
      { status: 500 }
    );
  }
}
