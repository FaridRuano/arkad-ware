import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import User from "@models/User";

export async function POST(req) {
    try {
        const body = await req.json();
        const { identifier = "" } = body;

        if (!identifier) {
            return NextResponse.json(
                { error: "Debes ingresar un correo o cédula" },
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
        }).select("_id email cedula");

        if (!user) {
            return NextResponse.json({
                ok: true,
                message: "Si la cuenta existe, solicita tu código presencial al negocio.",
            });
        }

        return NextResponse.json({
            ok: true,
            message: "Solicita tu código presencial al negocio para continuar con el cambio.",
        });
    } catch (error) {
        console.error("POST /api/auth/password/forgot-password error:", error);
        return NextResponse.json(
            { error: "No se pudo procesar la solicitud" },
            { status: 500 }
        );
    }
}
