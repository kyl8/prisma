import { PrismaAdapter } from "@auth/prisma-adapter";

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { login } from "@/../types/user";
import prisma from "./prisma";
import bcryptjs from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma as any),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsedCredentials = login.safeParse(credentials);
        if (!parsedCredentials.success) return null;

        const user = await prisma.user.findUnique({
          where: {
            email: parsedCredentials.data.email,
          },
        });

        if (!user?.password) return null;
        if (!(await bcryptjs.compare(parsedCredentials.data.password, user.password))) return null;

        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as typeof session.user & { id: string }).id = token.sub;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // The Vite shell and the Auth.js API are separate origins in local and
      // Vercel deployments. Allow only the configured frontend origin so the
      // credentials callback can return to the app without an opaque redirect.
      const frontendUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (frontendUrl) {
        try {
          if (new URL(url).origin === new URL(frontendUrl).origin) return url;
        } catch {
          // Fall through to Auth.js' safe default for malformed URLs.
        }
      }
      if (url.startsWith(baseUrl)) return url;
      return baseUrl;
    },
  },
});
