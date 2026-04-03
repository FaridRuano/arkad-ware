import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectMongoDB from "@libs/mongodb";
import User from "@models/User";
import UserAccess from "@models/UserAccess";
import UserLoginEvent from "@models/UserLoginEvent";
import {
    findValidPasswordActionToken,
    consumePasswordActionToken,
} from "@libs/password-tokens";
import { getRequestIp, getRequestUserAgent } from "@libs/request-meta";

export async function PATCH(req) {
    try {
        const body = await req.json();

        const {
            token = "",
            currentPassword = "",
            newPassword = "",
            confirmPassword = "",
            city = null,
            latitude = null,
            longitude = null,
        } = body;

        if (!token || !currentPassword || !newPassword || !confirmPassword) {
            return NextResponse.json(
                { error: "Todos los campos son obligatorios" },
                { status: 400 }
            );
        }

        if (newPassword !== confirmPassword) {
            return NextResponse.json(
                { error: "La nueva contraseña y la confirmación no coinciden" },
                { status: 400 }
            );
        }

        if (newPassword.length < 8) {
            return NextResponse.json(
                { error: "La nueva contraseña debe tener al menos 8 caracteres" },
                { status: 400 }
            );
        }

        await connectMongoDB();

        const validToken = await findValidPasswordActionToken({
            rawToken: token,
            purpose: "initial_password_change",
        });

        if (!validToken) {
            return NextResponse.json(
                { error: "El token es inválido o ha expirado" },
                { status: 400 }
            );
        }

        const existingAccess = await UserAccess.findOne({
            userId: validToken.userId,
        }).lean();

        if (existingAccess) {
            return NextResponse.json(
                { error: "El primer ingreso ya fue completado" },
                { status: 400 }
            );
        }

        const user = await User.findById(validToken.userId).select(
            "+password cedula"
        );

        if (!user) {
            return NextResponse.json(
                { error: "Usuario no encontrado" },
                { status: 404 }
            );
        }

        const isCurrentPasswordValid = await bcrypt.compare(
            currentPassword,
            user.password
        );

        if (!isCurrentPasswordValid) {
            return NextResponse.json(
                { error: "La contraseña actual es incorrecta" },
                { status: 400 }
            );
        }

        if (newPassword === currentPassword) {
            return NextResponse.json(
                { error: "La nueva contraseña no puede ser igual a la actual" },
                { status: 400 }
            );
        }

        if (user.cedula && newPassword === user.cedula) {
            return NextResponse.json(
                { error: "La nueva contraseña no puede ser igual a la cédula" },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        await consumePasswordActionToken({
            rawToken: token,
            purpose: "initial_password_change",
        });

        const now = new Date();
        const ip = getRequestIp(req);
        const userAgent = getRequestUserAgent(req);

        const normalizedLatitude =
            typeof latitude === "number" && Number.isFinite(latitude)
                ? latitude
                : null;

        const normalizedLongitude =
            typeof longitude === "number" && Number.isFinite(longitude)
                ? longitude
                : null;

        const normalizedCity =
            typeof city === "string" && city.trim()
                ? city.trim()
                : null;

        await UserAccess.create({
            userId: user._id,
            firstLoginAt: now,
            lastLoginAt: now,
            loginCount: 1,
            lastLoginIp: ip,
            lastLoginUserAgent: userAgent,
            lastKnownCity: normalizedCity,
            lastKnownLatitude: normalizedLatitude,
            lastKnownLongitude: normalizedLongitude,
            passwordChangedAt: now,
        });

        await UserLoginEvent.create({
            userId: user._id,
            loggedAt: now,
            ip,
            userAgent,
            city: normalizedCity,
            latitude: normalizedLatitude,
            longitude: normalizedLongitude,
        });

        return NextResponse.json({
            ok: true,
            message: "Contraseña actualizada correctamente",
        });
    } catch (error) {
        console.error("PATCH /api/auth/password/complete-initial-password error:", error);

        return NextResponse.json(
            { error: "No se pudo completar el primer ingreso" },
            { status: 500 }
        );
    }
}