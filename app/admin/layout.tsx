"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";

// ADMIN_EMAILS를 소문자로 정규화하여 비교
const ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || "Lawyeom@naver.com,duath1031@gmail.com")
  .split(",")
  .map(email => email.toLowerCase().trim());

const adminMenuItems = [
  { name: "대시보드", href: "/admin", icon: "📊" },
  { name: "신청 관리", href: "/admin/submissions", icon: "📋" },
  { name: "사용자 관리", href: "/admin/users", icon: "👥" },
  { name: "AI 프롬프트", href: "/admin/prompts", icon: "🤖" },
  { name: "사이트 설정", href: "/admin/settings", icon: "⚙️" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email.toLowerCase())) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Admin Header */}
      <header className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-xl font-bold">
              <span className="text-blue-400">Adm</span>
              <span className="text-purple-400">Ini</span>
              <span className="text-gray-400 text-sm ml-2">Admin</span>
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-300 hover:text-white">
              사용자 페이지로 →
            </Link>
            <span className="text-sm text-gray-400">{session.user.email}</span>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white min-h-[calc(100vh-64px)] border-r border-gray-200">
          <nav className="p-4 space-y-1">
            {adminMenuItems.map((item) => {
              const isActive = pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
