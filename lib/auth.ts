import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { ObjectId } from "mongodb";
import { prisma } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "mongodb",
  }),

  advanced: {
    generateId: () => new ObjectId().toString(),
    // Handle existing users on OAuth login
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disable for dev
  },

  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      scope: ["read:user", "repo"],
      // Link existing accounts with same email
      allowDangerousEmailAccountLinking: true,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },

  user: {
    changeEmail: {
      enabled: true,
    },
  },
});

export type Session = typeof auth.$Infer.Session;
