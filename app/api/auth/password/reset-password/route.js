import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectMongoDB from "@libs/mongodb";
import User from "@models/User";
import { findValidPasswordActionToken, consumePasswordActionToken } from "@libs/password-tokens";

export async function PATCH(req) {
    try {
        const body = await req.json();
        const {
            token = "",
            newPassword = "",
            confirmPassword = "",
        } = body;

        if (!token || !newPassword || !confirmPassword) {
            return NextResponse.json(
                { error: "Datos incompletos" },
                { status: 400 }
            );
        }

        if (newPassword !== confirmPassword) {
            return NextResponse.json(
                { error: "Las contraseñas no coinciden" },
                { status: 400 }
            );
        }

        if (newPassword.length < 8) {
            return NextResponse.json(
                { error: "La contraseña debe tener al menos 8 caracteres" },
                { status: 400 }
            );
        }

        await connectMongoDB();

        const validToken = await findValidPasswordActionToken({
            rawToken: token,
            purpose: "reset_password",
        });

        if (!validToken) {
            return NextResponse.json(
                { error: "El enlace es inválido o ha expirado" },
                { status: 400 }
            );
        }

        const user = await User.findById(validToken.userId).select("+password cedula");

        if (!user) {
            return NextResponse.json(
                { error: "Usuario no encontrado" },
                { status: 404 }
            );
        }

        if (user.cedula && newPassword === user.cedula) {
            return NextResponse.json(
                { error: "La nueva contraseña no puede ser igual a la cédula" },
                { status: 400 }
            );
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        await consumePasswordActionToken({
            rawToken: token,
            purpose: "reset_password",
        });

        return NextResponse.json({
            ok: true,
            message: "Contraseña restablecida correctamente",
        });
    } catch (error) {
        console.error("PATCH /api/auth/password/reset-password error:", error);
        return NextResponse.json(
            { error: "No se pudo restablecer la contraseña" },
            { status: 500 }
        );
    }
}