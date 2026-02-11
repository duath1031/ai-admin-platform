"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { useUIStore } from "@/lib/store";
import { useState } from "react";

export default function Header() {
  const { data: session } = useSession();
  const { toggleSidebar } = useUIStore();
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 h-14 sm:h-16 bg-white border-b border-gray-200 z-50">
      <div className="h-full px-3 sm:px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={toggleSidebar}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <Link href="/" className="flex items-center gap-2 sm:gap-3">
            {/* AdmIni Logo */}
            <div className="flex items-center">
              <span className="text-lg sm:text-2xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Adm
              </span>
              <span className="text-lg sm:text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Ini
              </span>
            </div>
            <div className="hidden sm:flex flex-col">
              <span className="text-xs text-gray-500 leading-tight">주식회사 어드미니</span>
              <span className="text-xs font-medium text-primary-600 leading-tight">AI 행정사 플랫폼</span>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {session?.user ? (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg"
              >
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt={session.user.name || ""}
                    width={28}
                    height={28}
                    className="rounded-full sm:w-8 sm:h-8"
                  />
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-xs sm:text-sm font-medium text-gray-600">
                      {session.user.name?.[0] || "U"}
                    </span>
                  </div>
                )}
                <span className="text-xs sm:text-sm font-medium text-gray-700 hidden sm:inline">
                  {session.user.name}
                </span>
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-2 w-44 sm:w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1.5 sm:py-2">
                  <Link
                    href="/mypage"
                    className="block px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowDropdown(false)}
                  >
                    마이페이지
                  </Link>
                  <button
                    onClick={() => signOut()}
                    className="w-full text-left px-3 sm:px-4 py-2 text-xs sm:text-sm text-red-600 hover:bg-gray-50"
                  >
                    로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
