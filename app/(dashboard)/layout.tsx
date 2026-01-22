"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { useUIStore } from "@/lib/store";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const { sidebarOpen } = useUIStore();

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Sidebar />
      <main
        className={`pt-16 transition-all duration-300 ${
          sidebarOpen ? "md:ml-64" : "ml-0"
        }`}
      >
        <div className="p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
