import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBalance } from "@/lib/token/tokenService";
import { getUserPlanCode } from "@/lib/token/planAccess";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
  }

  const [balance, planCode] = await Promise.all([
    getBalance(session.user.id),
    getUserPlanCode(session.user.id),
  ]);

  return NextResponse.json({
    success: true,
    balance,
    planCode,
    unlimited: balance === -1,
  });
}
