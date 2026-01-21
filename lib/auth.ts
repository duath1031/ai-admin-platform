// =============================================================================
// NextAuth Configuration with OAuth Providers
// Google, Kakao, Naver 소셜 로그인 지원
// =============================================================================

import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import KakaoProvider from "next-auth/providers/kakao";
import NaverProvider from "next-auth/providers/naver";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],

  providers: [
    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),

    // Kakao OAuth
    KakaoProvider({
      clientId: process.env.KAKAO_CLIENT_ID || "",
      clientSecret: process.env.KAKAO_CLIENT_SECRET || "",
    }),

    // Naver OAuth
    NaverProvider({
      clientId: process.env.NAVER_CLIENT_ID || "",
      clientSecret: process.env.NAVER_CLIENT_SECRET || "",
    }),

    // Credentials (Development/Test only)
    ...(process.env.NODE_ENV === "development"
      ? [
          CredentialsProvider({
            name: "테스트 로그인",
            credentials: {
              email: { label: "이메일", type: "email", placeholder: "test@test.com" },
            },
            async authorize(credentials) {
              if (!credentials?.email) return null;

              // Find or create test user
              let user = await prisma.user.findUnique({
                where: { email: credentials.email },
              });

              if (!user) {
                user = await prisma.user.create({
                  data: {
                    email: credentials.email,
                    name: "테스트 사용자",
                  },
                });
              }

              return {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
              };
            },
          }),
        ]
      : []),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      // Allow all sign-ins
      return true;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;

        // Fetch additional user data
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            credits: true,
            plan: true,
            phone: true,
          },
        });

        if (dbUser) {
          session.user.credits = dbUser.credits;
          session.user.plan = dbUser.plan;
          session.user.phone = dbUser.phone;
        }
      }
      return session;
    },

    async jwt({ token, user, account, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id;
      }

      // Handle session update
      if (trigger === "update" && session) {
        return { ...token, ...session.user };
      }

      return token;
    },
  },

  events: {
    async createUser({ user }) {
      // Log new user creation
      console.log("[Auth] New user created:", user.email);
    },

    async signIn({ user, account, isNewUser }) {
      if (isNewUser) {
        console.log("[Auth] New user signed in:", user.email);
      }
    },
  },

  pages: {
    signIn: "/login",
    error: "/login", // Error redirect
  },

  debug: process.env.NODE_ENV === "development",
};

// Type extensions are in types/next-auth.d.ts
