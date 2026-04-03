import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import User from "@models/User";
import { createPasswordActionToken } from "@libs/password-tokens";
import { getRequestIp, getRequestUserAgent } from "@libs/request-meta";

export async function POST(req) {
    try {
        const body = await req.json();
        const { email = "" } = body;

        if (!email) {
            return NextResponse.json(
                { error: "El correo es obligatorio" },
                { status: 400 }
            );
        }

        await connectMongoDB();

        const user = await User.findOne({
            email: email.trim().toLowerCase(),
        }).select("_id email");

        if (!user) {
            return NextResponse.json({
                ok: true,
                message: "Si el correo existe, se enviará un enlace de recuperación",
            });
        }

        const ip = getRequestIp(req);
        const userAgent = getRequestUserAgent(req);

        const { rawToken, expiresAt } = await createPasswordActionToken({
            userId: user._id,
            purpose: "reset_password",
            expiresInMinutes: 30,
            requestedIp: ip,
            requestedUserAgent: userAgent,
        });

        // Aquí luego conectas nodemailer o tu proveedor
        // const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${rawToken}`

        console.log("Reset token:", rawToken, "expiresAt:", expiresAt);

        return NextResponse.json({
            ok: true,
            message: "Si el correo existe, se enviará un enlace de recuperación",
        });
    } catch (error) {
        console.error("POST /api/auth/password/forgot-password error:", error);
        return NextResponse.json(
            { error: "No se pudo procesar la solicitud" },
            { status: 500 }
        );
    }
}