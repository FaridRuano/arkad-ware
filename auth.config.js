import Credentials from "next-auth/providers/credentials";

export const authConfig = {
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
    }),
  ],

  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async jwt({ token, user }) {
      // Cuando el usuario hace login por primera vez
      if (user) {
        token.id = user.id;
        token.role = user.role; // 👈 guardamos el role en el token
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role; // 👈 pasamos el role a la sesión
      }

      return session;
    },
  },
};