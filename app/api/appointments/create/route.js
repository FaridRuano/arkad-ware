import { NextResponse } from "next/server";
import { auth } from "@auth";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";

export async function POST(req) {
    try {
        // 1) Sesión
        const session = await auth();
        const userId = session?.user?.id;

        if (!userId) {
            return NextResponse.json(
                { error: true, message: "Unauthorized" },
                { status: 401 }
            );
        }

        // 2) Body
        const body = await req.json().catch(() => null);
        const { date, time, type, notes } = body || {};

        if (!date || !time || !type) {
            return NextResponse.json(
                { error: true, message: "Datos incompletos" },
                { status: 400 }
            );
        }

        // 3) Duración (type = 30 o 60)
        const durationMinutes = Number(type);

        if (![30, 60].includes(durationMinutes)) {
            return NextResponse.json(
                { error: true, message: "Tipo de duración inválido" },
                { status: 400 }
            );
        }

        // 4) Construir fecha + hora
        const dateObj = new Date(date);
        const timeObj = new Date(time);

        if (Number.isNaN(dateObj.getTime()) || Number.isNaN(timeObj.getTime())) {
            return NextResponse.json(
                { error: true, message: "Fecha u hora inválida" },
                { status: 400 }
            );
        }

        const startAt = new Date(dateObj);
        startAt.setHours(timeObj.getHours(), timeObj.getMinutes(), 0, 0);

        if (Number.isNaN(startAt.getTime())) {
            return NextResponse.json(
                { error: true, message: "Fecha u hora inválida" },
                { status: 400 }
            );
        }

        await connectMongoDB();

        // 5) Evitar solapamiento (agenda GLOBAL)
        // Si en tu negocio hay 1 sola agenda, NO filtres por user.
        const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

        const overlap = await Appointment.findOne({
            // user: userId, // <- (quitar para agenda global)
            status: { $nin: ["cancelled", "no assistance"] },
            startAt: { $lt: endAt },
            $expr: {
                $gt: [
                    { $add: ["$startAt", { $multiply: ["$durationMinutes", 60000] }] },
                    startAt,
                ],
            },
        }).lean();

        if (overlap) {
            return NextResponse.json(
                { error: true, message: "Ese horario ya está ocupado" },
                { status: 409 }
            );
        }

        // 6) Crear cita (adaptado a tu enum)
        // status default = "pending" según schema.
        // paymentStatus default = "unpaid" según schema.
        // Precio según duración
        const price = durationMinutes === 30 ? 8 : 12;

        const appointment = await Appointment.create({
            user: userId,
            startAt,
            durationMinutes,
            price: price, // <-- AJUSTA: tu schema requiere price y min 8
            notes: typeof notes === "string" ? notes : "",
            // status: "pending", // opcional, el default ya lo pone
        });

        return NextResponse.json(
            {
                ok: true,
                appointment: {
                    id: appointment._id.toString(),
                    startAt: appointment.startAt,
                    durationMinutes: appointment.durationMinutes,
                    status: appointment.status,
                    paymentStatus: appointment.paymentStatus,
                    statusHistory: appointment.statusHistory, // útil para debug/UX
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Create appointment error:", error);
        return NextResponse.json(
            { error: true, message: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
