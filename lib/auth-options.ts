import db from "@/lib/db";
import { NextAuthOptions, type DefaultSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import NextAuth from "next-auth";

// Define the authOptions with proper types
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  secret: process.env.NEXTAUTH_SECRET ?? "secret",
  callbacks: {
    async signIn(params) {
      if (!params.user.email) {
        return false;
      }
      try {
        await db.user.create({
          data: {
            email: params.user.email,
            provider: "Google",
          },
        });
      } catch (e) {
        console.log(e);
      }
      return true;
    },
    async jwt({ token, user }) {
      // Only called when user first signs in, so requiring fewer db calls
      if (user && user.email) {
        const dbUser = await db.user.findUnique({
          where: {
            email: user.email,
          },
        });

        // This will not happen as we are storing the user in db on sign-in callback
        if (!dbUser) {
          return token;
        }

        return {
          ...token,
          id: dbUser.id,
        };
      }

      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
        },
      };
    },
  },
};

// Extend the Session interface to include user ID
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

export default NextAuth(authOptions);
