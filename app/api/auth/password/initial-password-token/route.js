import { NextResponse } from "next/server";
import { auth } from "@auth";
import connectMongoDB from "@libs/mongodb";
import UserAccess from "@models/UserAccess";
import { createPasswordActionToken } from "@libs/password-tokens";
import { getRequestIp, getRequestUserAgent } from "@libs/request-meta";

export async function POST(req) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "No autorizado" },
                { status: 401 }
            );
        }

        if (session?.user?.role !== "user") {
            return NextResponse.json(
                { error: "Este proceso solo aplica para usuarios del sistema" },
                { status: 403 }
            );
        }

        if (session?.user?.isFirstLogin !== true) {
            return NextResponse.json(
                { error: "Este usuario no requiere primer ingreso" },
                { status: 400 }
            );
        }

        await connectMongoDB();

        const existingAccess = await UserAccess.findOne({
            userId: session.user.id,
        }).lean();

        if (existingAccess) {
            return NextResponse.json(
                { error: "El primer ingreso ya fue completado" },
                { status: 400 }
            );
        }

        const ip = getRequestIp(req);
        const userAgent = getRequestUserAgent(req);

        const { rawToken, expiresAt } = await createPasswordActionToken({
            userId: session.user.id,
            purpose: "initial_password_change",
            expiresInMinutes: 20,
            requestedIp: ip,
            requestedUserAgent: userAgent,
        });

        return NextResponse.json({
            ok: true,
            token: rawToken,
            expiresAt,
        });
    } catch (error) {
        console.error("POST /api/auth/password/initial-password-token error:", error);

        return NextResponse.json(
            { error: "No se pudo generar el token de primer ingreso" },
            { status: 500 }
        );
    }
}