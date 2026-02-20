import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { authConfig } from "@auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  providers: [
    Credentials({
      credentials: { email: {}, password: {} },

      async authorize(credentials) {
        const email = credentials?.email?.toString().trim().toLowerCase();
        const password = credentials?.password?.toString();

        if (!email || !password) return null;

        const { default: connectMongoDB } = await import("@libs/mongodb");
        const { default: User } = await import("@models/User");

        await connectMongoDB();

        const user = await User.findOne({ email }).select(
          "+password role firstName lastName email"
        );

        if (!user || !user.password) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        // Mejor que user.save() para evitar validaciones/hook inesperados
        await User.updateOne(
          { _id: user._id },
          { $set: { lastLoginAt: new Date() } }
        );

        return {
          id: user._id.toString(),
          email: user.email,
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          role: user.role || "user",
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // Se ejecuta al iniciar sesión y en cada request
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    async session({ session, token }) {
      if (session?.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
});