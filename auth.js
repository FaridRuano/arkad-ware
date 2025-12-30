// src/auth.js
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                email: {},
                password: {},
            },
            async authorize(credentials) {
                const { default: connectMongoDB } = await import("@libs/mongodb");
                const { default: User } = await import("@models/User");

                await connectMongoDB();

                const user = await User.findOne({ email: credentials.email })
                    .select("+password");

                if (!user) return null;

                const ok = await bcrypt.compare(credentials.password, user.password);
                if (!ok) return null;

                // ✅ ACTUALIZA lastLoginAt
                user.lastLoginAt = new Date();
                await user.save();

                return {
                    id: user._id.toString(),
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`,
                };
            },
        }),
    ],
    session: { strategy: "jwt" },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async jwt({ token, user }) {
            // En el primer login, user viene desde authorize()
            if (user) {
                token.id = user.id;
            }
            return token;
        },

        async session({ session, token }) {
            // Copiamos el id del token a session.user
            if (session.user) {
                session.user.id = token.id;
            }
            return session;
        },
    },
});
