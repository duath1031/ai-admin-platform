/**
 * Centralized admin authentication check
 * DB role 기반 (PRIMARY) + email fallback (시딩용)
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "Lawyeom@naver.com,duath1031@gmail.com")
  .split(",")
  .map((email) => email.toLowerCase().trim());

export async function checkAdminAuth() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { authorized: false as const, session: null };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, email: true },
  });

  // DB role 체크 (primary) + email fallback (초기 시딩용)
  const isAdmin =
    user?.role === "ADMIN" ||
    (user?.email ? ADMIN_EMAILS.includes(user.email.toLowerCase()) : false);

  if (!isAdmin) {
    return { authorized: false as const, session };
  }

  return { authorized: true as const, session };
}
