import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      credits?: number;
      plan?: string;
      phone?: string | null;
      role?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    credits?: number;
    plan?: string;
    role?: string;
  }
}
