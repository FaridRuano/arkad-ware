import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectMongoDB from "@libs/mongodb";
import User from "@models/User";
import { isValidMasterPasswordResetCode } from "@libs/password-reset-code";

export async function PATCH(req) {
    try {
        const body = await req.json();
        const {
            identifier = "",
            recoveryCode = "",
            newPassword = "",
            confirmPassword = "",
        } = body;

        if (!identifier || !recoveryCode || !newPassword || !confirmPassword) {
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

        if (!isValidMasterPasswordResetCode(recoveryCode)) {
            return NextResponse.json(
                { error: "El código de recuperación no es válido" },
                { status: 400 }
            );
        }

        await connectMongoDB();

        const normalizedIdentifier = identifier.trim();
        const normalizedEmail = normalizedIdentifier.toLowerCase();

        const user = await User.findOne({
            $or: [
                { email: normalizedEmail },
                { cedula: normalizedIdentifier },
            ],
        }).select("+password cedula");

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
