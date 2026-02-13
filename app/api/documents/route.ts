export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateWithGemini } from "@/lib/gemini";
import { DOCUMENT_GENERATION_PROMPTS } from "@/lib/systemPrompts";

// GET: Fetch user's documents
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const documents = await prisma.document.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error("Documents fetch error:", error);
    return NextResponse.json(
      { error: "서류 목록을 불러오는데 실패했습니다." },
      { status: 500 }
    );
  }
}

// POST: Generate document using AI
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.json();
    const { type } = formData;

    if (!type) {
      return NextResponse.json(
        { error: "서류 종류를 선택해주세요." },
        { status: 400 }
      );
    }

    const systemPrompt = DOCUMENT_GENERATION_PROMPTS[type as keyof typeof DOCUMENT_GENERATION_PROMPTS] || DOCUMENT_GENERATION_PROMPTS.application;

    // 타입별 사용자 콘텐츠 생성
    let userContent = "";

    const contractTypes = ["lease_contract", "goods_contract", "service_contract", "labor_contract_doc", "general_contract"];
    const isContract = contractTypes.includes(type);
    const isCertification = type === "content_certification";

    if (isContract) {
      // 계약서 전용 프롬프트
      userContent = `다음 정보를 바탕으로 계약서를 작성해주세요:

제목: ${formData.title || "미지정"}
갑(사용자): ${formData.partyA || "[갑]"}
갑 주소: ${formData.partyAAddress || "[주소]"}
을(상대방): ${formData.partyB || "[을]"}
을 주소: ${formData.partyBAddress || "[주소]"}
계약기간: ${formData.contractPeriodStart || "[시작일]"} ~ ${formData.contractPeriodEnd || "[종료일]"}
계약금액: ${formData.contractAmount || "[금액]"}원`;

      // 임대차 전용
      if (type === "lease_contract") {
        userContent += `
물건 소재지: ${formData.propertyAddress || "[소재지]"}
면적: ${formData.propertyArea || "[면적]"}㎡
보증금: ${formData.deposit || "[보증금]"}원
월 차임: ${formData.monthlyRent || "[월세]"}원`;
      }

      // 물품매매/용역 전용
      if (formData.contractSubject) {
        userContent += `\n계약 대상/내용: ${formData.contractSubject}`;
      }

      // 근로계약 전용
      if (type === "labor_contract_doc") {
        userContent += `
근무장소: ${formData.workPlace || "[근무장소]"}
담당업무: ${formData.jobDescription || "[업무]"}
근로시간: ${formData.workHours || "[근로시간]"}
임금(월): ${formData.salary || "[임금]"}원`;
      }

      if (formData.specialTerms) {
        userContent += `\n특약사항: ${formData.specialTerms}`;
      }

      userContent += `\n\n위 정보를 바탕으로 실무에서 사용 가능한 수준의 계약서를 작성해주세요.
빈 부분은 [OO] 형태로 표시하고, 모든 조항에 번호를 매겨주세요.`;

    } else if (isCertification) {
      // 내용증명 전용 프롬프트
      userContent = `다음 정보를 바탕으로 내용증명서를 작성해주세요:

제목: ${formData.title || "미지정"}
발신인 성명/상호: ${formData.senderName || "[발신인]"}
발신인 주소: ${formData.senderAddress || "[주소]"}
발신인 연락처: ${formData.senderPhone || "[연락처]"}
수신인 성명/상호: ${formData.receiverName || "[수신인]"}
수신인 주소: ${formData.receiverAddress || "[주소]"}

사실관계:
${formData.factDescription || "[사실관계를 기재해주세요]"}

요구사항:
${formData.demandContent || "[요구사항을 기재해주세요]"}

이행 기한: ${formData.deadline || "본 서면 수령 후 7일 이내"}
${formData.legalBasis ? `법적 근거: ${formData.legalBasis}` : ""}
${formData.additionalInfo ? `추가 정보: ${formData.additionalInfo}` : ""}

위 정보를 바탕으로 법적 효력을 갖춘 내용증명서를 작성해주세요.
감정적 표현은 피하고, 객관적 사실과 법적 근거를 중심으로 작성하되,
우체국 내용증명 양식에 맞게 3통 작성할 수 있도록 깔끔하게 포맷해주세요.`;

    } else {
      // 기존 행정 서류 프롬프트
      const { title, applicantName, applicantId, applicantAddress, applicantPhone, recipient, purpose, reason, additionalInfo } = formData;

      if (!purpose && !reason) {
        return NextResponse.json(
          { error: "요청 취지 또는 상세 사유를 입력해주세요." },
          { status: 400 }
        );
      }

      userContent = `다음 정보를 바탕으로 서류를 작성해주세요:

제목: ${title || "미지정"}
신청인 성명: ${applicantName}
주민등록번호: ${applicantId}
주소: ${applicantAddress}
연락처: ${applicantPhone}
수신(제출처): ${recipient}
요청 취지: ${purpose}
상세 사유: ${reason}
${additionalInfo ? `추가 정보: ${additionalInfo}` : ""}

위 정보를 바탕으로 전문적이고 격식을 갖춘 서류를 작성해주세요.
실제 제출 가능한 형식으로 작성하되, 빈 부분은 [OO] 형태로 표시해주세요.`;
    }

    const content = await generateWithGemini(userContent, systemPrompt);

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Document generation error:", error);
    return NextResponse.json(
      { error: "서류 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
