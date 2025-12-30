import Credentials from "next-auth/providers/credentials";

export const authConfig = {
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      // 👇 Importante: NO pongas authorize aquí.
      // El authorize lo pondremos en auth.js (Node).
    }),
  ],
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id;
      return session;
    },
  },
};
