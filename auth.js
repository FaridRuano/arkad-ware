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
        const { default: UserAccess } = await import("@models/UserAccess");

        await connectMongoDB();

        const user = await User.findOne({ email }).select(
          "+password role firstName lastName email"
        );

        if (!user || !user.password) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        const access = await UserAccess.findOne({ userId: user._id })
          .select("_id")
          .lean();

        const isFirstLogin = !access;

        return {
          id: user._id.toString(),
          email: user.email,
          name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
          role: user.role || "user",
          isFirstLogin,
        };
      },
    }),
  ],
});