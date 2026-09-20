import { PrismaAdapter } from "@auth/prisma-adapter";

import NextAuth from "next-auth";
import { encode as defaultEncode } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { v4 as uuid } from "uuid";
import { login } from "@/../types/user";
import prisma from "./prisma";
import bcryptjs from "bcryptjs";

//adicionando o adaptador para o Auth.js
const adapter = PrismaAdapter(prisma as any);

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const verifiedCredentials = login.parse(credentials);

        const user = await prisma.user.findUnique({
          where: {
            email: verifiedCredentials.email,
          },
        });

        if (!user) {
          throw new Error("Usuário inválido");
        }

        if (!user.password) {
          throw new Error("Senha do usuário não identificada");
        }

        if (!bcryptjs.compareSync(verifiedCredentials.password, user.password)) {
          throw new Error("Senha inválida");
        }

        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === "credentials") {
        token.credentials = true;
      }
      return token;
    },
  },
  jwt: {
    encode: async function (params) {
      if (params.token?.credentials) {
        const sessionToken = uuid();

        if (!params.token.sub) {
          throw new Error("No user ID found in token");
        }

        const createdSession = await adapter?.createSession?.({
          sessionToken: sessionToken,
          userId: params.token.sub,
          expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });

        if (!createdSession) {
          throw new Error("Failed to create session");
        }

        return sessionToken;
      }
      return defaultEncode(params);
    },
  },
});
