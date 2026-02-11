export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const serialize = (obj: any) => JSON.parse(JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? Number(v) : v));

async function getProfile(userId: string) {
  return prisma.companyProfile.findUnique({ where: { userId } });
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    const profile = await getProfile(session.user.id);
    if (!profile) return NextResponse.json({ error: '프로필 없음' }, { status: 404 });
    const items = await prisma.bidHistoryRecord.findMany({ where: { companyProfileId: profile.id }, orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ success: true, data: serialize(items) });
  } catch (e) { console.error(e); return NextResponse.json({ error: '조회 오류' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    const profile = await getProfile(session.user.id);
    if (!profile) return NextResponse.json({ error: '프로필 없음' }, { status: 404 });
    const body = await req.json();
    if (!body.bidName) return NextResponse.json({ error: '공고명 필수' }, { status: 400 });
    const created = await prisma.bidHistoryRecord.create({
      data: {
        companyProfileId: profile.id, bidName: body.bidName,
        bidNo: body.bidNo ?? null, agency: body.agency ?? null,
        bidAmount: body.bidAmount != null ? BigInt(body.bidAmount) : null,
        estimatedPrice: body.estimatedPrice != null ? BigInt(body.estimatedPrice) : null,
        bidDate: body.bidDate ? new Date(body.bidDate) : null,
        result: body.result ?? null, bidRate: body.bidRate ?? null, notes: body.notes ?? null,
      },
    });
    return NextResponse.json({ success: true, data: serialize(created) });
  } catch (e) { console.error(e); return NextResponse.json({ error: '등록 오류' }, { status: 500 }); }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    const profile = await getProfile(session.user.id);
    if (!profile) return NextResponse.json({ error: '프로필 없음' }, { status: 404 });
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });
    const existing = await prisma.bidHistoryRecord.findUnique({ where: { id: body.id } });
    if (!existing || existing.companyProfileId !== profile.id) return NextResponse.json({ error: '찾을 수 없음' }, { status: 404 });
    const updated = await prisma.bidHistoryRecord.update({
      where: { id: body.id },
      data: {
        ...(body.bidName !== undefined && { bidName: body.bidName }),
        ...(body.bidNo !== undefined && { bidNo: body.bidNo }),
        ...(body.agency !== undefined && { agency: body.agency }),
        ...(body.bidAmount !== undefined && { bidAmount: body.bidAmount != null ? BigInt(body.bidAmount) : null }),
        ...(body.estimatedPrice !== undefined && { estimatedPrice: body.estimatedPrice != null ? BigInt(body.estimatedPrice) : null }),
        ...(body.bidDate !== undefined && { bidDate: body.bidDate ? new Date(body.bidDate) : null }),
        ...(body.result !== undefined && { result: body.result }),
        ...(body.bidRate !== undefined && { bidRate: body.bidRate }),
        ...(body.notes !== undefined && { notes: body.notes }),
      },
    });
    return NextResponse.json({ success: true, data: serialize(updated) });
  } catch (e) { console.error(e); return NextResponse.json({ error: '수정 오류' }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: '인증 필요' }, { status: 401 });
    const profile = await getProfile(session.user.id);
    if (!profile) return NextResponse.json({ error: '프로필 없음' }, { status: 404 });
    const id = new URL(req.url).searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 });
    const existing = await prisma.bidHistoryRecord.findUnique({ where: { id } });
    if (!existing || existing.companyProfileId !== profile.id) return NextResponse.json({ error: '찾을 수 없음' }, { status: 404 });
    await prisma.bidHistoryRecord.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) { console.error(e); return NextResponse.json({ error: '삭제 오류' }, { status: 500 }); }
}
