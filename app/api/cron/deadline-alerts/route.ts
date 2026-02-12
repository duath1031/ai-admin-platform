/**
 * 기한 알림 Cron
 * 매일 08:00 (UTC) = 한국시간 17:00
 *
 * DeadlineAlert 테이블에서 미발송 알림 조회 → 알림 발송
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // D-30, D-7, D-3, D-1 알림 생성
    const intervals = [
      { days: 30, type: "d-30" },
      { days: 7, type: "d-7" },
      { days: 3, type: "d-3" },
      { days: 1, type: "d-1" },
    ];

    let created = 0;

    // 구독 갱신일 알림
    for (const { days, type } of intervals) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const targetEnd = new Date(targetStart);
      targetEnd.setDate(targetEnd.getDate() + 1);

      const subs = await prisma.subscription.findMany({
        where: {
          status: { in: ["active", "trial"] },
          nextBillingDate: { gte: targetStart, lt: targetEnd },
        },
        select: { id: true, userId: true, nextBillingDate: true },
      });

      for (const sub of subs) {
        // 중복 체크
        const exists = await prisma.deadlineAlert.findFirst({
          where: {
            userId: sub.userId,
            referenceType: "subscription",
            referenceId: sub.id,
            alertType: type,
          },
        });
        if (exists) continue;

        await prisma.deadlineAlert.create({
          data: {
            userId: sub.userId,
            referenceType: "subscription",
            referenceId: sub.id,
            title: `구독 결제 예정 (D-${days})`,
            deadline: sub.nextBillingDate!,
            alertType: type,
            channel: "in_app",
          },
        });
        created++;
      }
    }

    // 보조금 신청 마감 알림
    for (const { days, type } of intervals) {
      const targetDate = new Date(now);
      targetDate.setDate(targetDate.getDate() + days);
      const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
      const targetEnd = new Date(targetStart);
      targetEnd.setDate(targetEnd.getDate() + 1);

      const subsidies = await prisma.subsidyMatch.findMany({
        where: {
          isBookmarked: true,
          subsidyProgram: {
            applicationEnd: { gte: targetStart, lt: targetEnd },
          },
        },
        include: {
          subsidyProgram: { select: { title: true, applicationEnd: true, id: true } },
        },
      });

      for (const match of subsidies) {
        const exists = await prisma.deadlineAlert.findFirst({
          where: {
            userId: match.userId,
            referenceType: "subsidy",
            referenceId: match.subsidyProgramId,
            alertType: type,
          },
        });
        if (exists) continue;

        await prisma.deadlineAlert.create({
          data: {
            userId: match.userId,
            referenceType: "subsidy",
            referenceId: match.subsidyProgramId,
            title: `보조금 마감 D-${days}: ${match.subsidyProgram.title}`,
            deadline: match.subsidyProgram.applicationEnd!,
            alertType: type,
            channel: "in_app",
          },
        });
        created++;
      }
    }

    // 미발송 인앱 알림을 Notification으로 변환
    const unsent = await prisma.deadlineAlert.findMany({
      where: {
        isSent: false,
        deadline: { gte: now },
      },
      take: 100,
    });

    let sent = 0;
    for (const alert of unsent) {
      await prisma.notification.create({
        data: {
          userId: alert.userId,
          type: "deadline",
          title: alert.title,
          message: `${alert.title} - 기한: ${alert.deadline.toLocaleDateString("ko-KR")}`,
          channel: alert.channel,
          status: "sent",
          sentAt: new Date(),
          referenceType: alert.referenceType,
          referenceId: alert.referenceId || undefined,
        },
      });
      await prisma.deadlineAlert.update({
        where: { id: alert.id },
        data: { isSent: true, sentAt: new Date() },
      });
      sent++;
    }

    console.log(`[Cron] 기한알림: 생성 ${created}건, 발송 ${sent}건`);

    return NextResponse.json({
      success: true,
      created,
      sent,
    });
  } catch (error) {
    console.error("[Cron] deadline-alerts Error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
