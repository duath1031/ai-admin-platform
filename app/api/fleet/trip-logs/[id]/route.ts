/**
 * 운행일지 상세 API
 * GET    /api/fleet/trip-logs/[id] - 운행일지 상세 조회
 * PUT    /api/fleet/trip-logs/[id] - 운행일지 수정 (endMileage 변경 시 vehicle.currentMileage 업데이트)
 * DELETE /api/fleet/trip-logs/[id] - 운행일지 삭제 (마지막 tripLog의 endMileage로 vehicle.currentMileage 재설정)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;

    const tripLog = await prisma.vehicleTripLog.findFirst({
      where: { id, userId: session.user.id },
      include: {
        vehicle: {
          select: {
            plateNumber: true,
            modelName: true,
            manufacturer: true,
            vehicleType: true,
            ownershipType: true,
            currentMileage: true,
          },
        },
      },
    });

    if (!tripLog) {
      return NextResponse.json({ error: "운행일지를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: tripLog });
  } catch (error) {
    console.error("[TripLog GET] Error:", error);
    return NextResponse.json({ error: "운행일지 조회 실패" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;

    // 기존 레코드 조회
    const existing = await prisma.vehicleTripLog.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "운행일지를 찾을 수 없습니다." }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    // 문자열 필드
    if (body.driverName !== undefined) updateData.driverName = body.driverName.trim();
    if (body.department !== undefined) updateData.department = body.department?.trim() || null;
    if (body.departure !== undefined) updateData.departure = body.departure.trim();
    if (body.destination !== undefined) updateData.destination = body.destination.trim();
    if (body.purpose !== undefined) updateData.purpose = body.purpose;
    if (body.startTime !== undefined) updateData.startTime = body.startTime || null;
    if (body.endTime !== undefined) updateData.endTime = body.endTime || null;
    if (body.costMemo !== undefined) updateData.costMemo = body.costMemo?.trim() || null;
    if (body.memo !== undefined) updateData.memo = body.memo?.trim() || null;

    // 날짜 필드
    if (body.tripDate !== undefined) updateData.tripDate = new Date(body.tripDate);

    // 비용 필드
    if (body.fuelCost !== undefined) updateData.fuelCost = body.fuelCost ? Number(body.fuelCost) : null;
    if (body.tollCost !== undefined) updateData.tollCost = body.tollCost ? Number(body.tollCost) : null;
    if (body.parkingCost !== undefined) updateData.parkingCost = body.parkingCost ? Number(body.parkingCost) : null;
    if (body.otherCost !== undefined) updateData.otherCost = body.otherCost ? Number(body.otherCost) : null;

    // 키로수 관련 필드
    const newStartMileage = body.startMileage != null ? Number(body.startMileage) : existing.startMileage;
    const newEndMileage = body.endMileage != null ? Number(body.endMileage) : existing.endMileage;

    if (body.startMileage != null || body.endMileage != null) {
      // 검증: endMileage > startMileage
      if (newEndMileage <= newStartMileage) {
        return NextResponse.json(
          { error: "도착 후 키로수는 출발 전 키로수보다 커야 합니다." },
          { status: 400 }
        );
      }

      updateData.startMileage = newStartMileage;
      updateData.endMileage = newEndMileage;
      updateData.distance = newEndMileage - newStartMileage;
    }

    // endMileage가 변경되면 vehicle.currentMileage도 업데이트
    const endMileageChanged = body.endMileage != null && Number(body.endMileage) !== existing.endMileage;

    if (endMileageChanged) {
      const [tripLog] = await prisma.$transaction([
        prisma.vehicleTripLog.update({
          where: { id },
          data: updateData,
          include: {
            vehicle: {
              select: {
                plateNumber: true,
                modelName: true,
                manufacturer: true,
              },
            },
          },
        }),
        prisma.vehicle.update({
          where: { id: existing.vehicleId },
          data: { currentMileage: newEndMileage },
        }),
      ]);
      return NextResponse.json({ success: true, data: tripLog });
    } else {
      const tripLog = await prisma.vehicleTripLog.update({
        where: { id },
        data: updateData,
        include: {
          vehicle: {
            select: {
              plateNumber: true,
              modelName: true,
              manufacturer: true,
            },
          },
        },
      });
      return NextResponse.json({ success: true, data: tripLog });
    }
  } catch (error) {
    console.error("[TripLog PUT] Error:", error);
    return NextResponse.json({ error: "운행일지 수정 실패" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.vehicleTripLog.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "운행일지를 찾을 수 없습니다." }, { status: 404 });
    }

    const vehicleId = existing.vehicleId;

    // 삭제
    await prisma.vehicleTripLog.delete({ where: { id } });

    // 삭제 후: 해당 차량의 가장 마지막 tripLog의 endMileage로 vehicle.currentMileage 재설정
    const lastTripLog = await prisma.vehicleTripLog.findFirst({
      where: { vehicleId },
      orderBy: { tripDate: "desc" },
      select: { endMileage: true },
    });

    await prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        currentMileage: lastTripLog ? lastTripLog.endMileage : null,
      },
    });

    return NextResponse.json({
      success: true,
      message: "운행일지가 삭제되었습니다.",
      currentMileage: lastTripLog ? lastTripLog.endMileage : null,
    });
  } catch (error) {
    console.error("[TripLog DELETE] Error:", error);
    return NextResponse.json({ error: "운행일지 삭제 실패" }, { status: 500 });
  }
}
