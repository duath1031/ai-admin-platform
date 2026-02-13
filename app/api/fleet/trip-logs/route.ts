/**
 * 차량 운행일지 API
 * GET  /api/fleet/trip-logs - 운행일지 목록 (vehicleId 필수, 날짜범위 선택)
 * POST /api/fleet/trip-logs - 운행일지 등록 (vehicle.currentMileage 자동 업데이트)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const vehicleId = searchParams.get("vehicleId");

    if (!vehicleId) {
      return NextResponse.json(
        { error: "vehicleId 파라미터는 필수입니다." },
        { status: 400 }
      );
    }

    // 차량 소유권 확인
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, userId: session.user.id },
    });
    if (!vehicle) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다." }, { status: 404 });
    }

    // 날짜 범위 필터
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const whereClause: Record<string, unknown> = {
      vehicleId,
      userId: session.user.id,
    };

    if (startDate || endDate) {
      const tripDateFilter: Record<string, Date> = {};
      if (startDate) {
        tripDateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        // endDate의 하루 끝까지 포함
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        tripDateFilter.lte = end;
      }
      whereClause.tripDate = tripDateFilter;
    }

    const tripLogs = await prisma.vehicleTripLog.findMany({
      where: whereClause,
      orderBy: { tripDate: "desc" },
      include: {
        vehicle: {
          select: {
            plateNumber: true,
            modelName: true,
            manufacturer: true,
            ownershipType: true,
            vehicleType: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: tripLogs });
  } catch (error) {
    console.error("[TripLogs GET] Error:", error);
    return NextResponse.json({ error: "운행일지 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const {
      vehicleId,
      tripDate,
      driverName,
      department,
      startMileage,
      endMileage,
      departure,
      destination,
      purpose,
      startTime,
      endTime,
      fuelCost,
      tollCost,
      parkingCost,
      otherCost,
      costMemo,
      memo,
    } = body;

    // 필수 필드 검증
    if (!vehicleId || !tripDate || !driverName || !departure || !destination || !purpose) {
      return NextResponse.json(
        { error: "차량, 운행일, 운전자명, 출발지, 목적지, 운행목적은 필수입니다." },
        { status: 400 }
      );
    }

    if (startMileage == null || endMileage == null) {
      return NextResponse.json(
        { error: "출발 전 키로수와 도착 후 키로수는 필수입니다." },
        { status: 400 }
      );
    }

    const startMileageNum = Number(startMileage);
    const endMileageNum = Number(endMileage);

    // 차량 소유권 확인 + 현재 주행거리 조회
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, userId: session.user.id },
    });
    if (!vehicle) {
      return NextResponse.json({ error: "차량을 찾을 수 없습니다." }, { status: 404 });
    }

    // 검증: endMileage > startMileage
    if (endMileageNum <= startMileageNum) {
      return NextResponse.json(
        { error: "도착 후 키로수는 출발 전 키로수보다 커야 합니다." },
        { status: 400 }
      );
    }

    // 검증: startMileage >= vehicle.currentMileage (현재보다 작으면 에러)
    if (vehicle.currentMileage != null && startMileageNum < vehicle.currentMileage) {
      return NextResponse.json(
        {
          error: `출발 전 키로수(${startMileageNum.toLocaleString()}km)가 차량의 현재 주행거리(${vehicle.currentMileage.toLocaleString()}km)보다 작습니다.`,
        },
        { status: 400 }
      );
    }

    const distance = endMileageNum - startMileageNum;

    // 운행일지 생성 + 차량 currentMileage 업데이트를 트랜잭션으로
    const [tripLog] = await prisma.$transaction([
      prisma.vehicleTripLog.create({
        data: {
          vehicleId,
          userId: session.user.id,
          tripDate: new Date(tripDate),
          driverName: driverName.trim(),
          department: department?.trim() || null,
          startMileage: startMileageNum,
          endMileage: endMileageNum,
          distance,
          departure: departure.trim(),
          destination: destination.trim(),
          purpose,
          startTime: startTime || null,
          endTime: endTime || null,
          fuelCost: fuelCost ? Number(fuelCost) : null,
          tollCost: tollCost ? Number(tollCost) : null,
          parkingCost: parkingCost ? Number(parkingCost) : null,
          otherCost: otherCost ? Number(otherCost) : null,
          costMemo: costMemo?.trim() || null,
          memo: memo?.trim() || null,
        },
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
        where: { id: vehicleId },
        data: { currentMileage: endMileageNum },
      }),
    ]);

    return NextResponse.json({ success: true, data: tripLog }, { status: 201 });
  } catch (error) {
    console.error("[TripLogs POST] Error:", error);
    return NextResponse.json({ error: "운행일지 등록 실패" }, { status: 500 });
  }
}
