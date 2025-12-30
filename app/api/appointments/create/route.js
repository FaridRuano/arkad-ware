import { NextResponse } from "next/server";
import { auth } from "@auth";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";

export async function POST(req) {
    try {
        // 1️⃣ Sesión
        const session = await auth();
        const userId = session?.user?.id;

        if (!userId) {
            return NextResponse.json(
                { error: true, message: "Unauthorized" },
                { status: 401 }
            );
        }

        // 2️⃣ Body
        const body = await req.json();
        const { date, time, type } = body;


        if (!date || !time || !type) {
            return NextResponse.json(
                { error: true, message: "Datos incompletos" },
                { status: 400 }
            );
        }

        // 3️⃣ Duración (type = 30 o 60)
        const durationMinutes = Number(type);

        if (![30, 60].includes(durationMinutes)) {
            return NextResponse.json(
                { error: true, message: "Tipo de duración inválido" },
                { status: 400 }
            );
        }


        // 4️⃣ Construir fecha + hora
        // date y time vienen como ISO strings
        const dateObj = new Date(date);
        const timeObj = new Date(time);

        if (Number.isNaN(dateObj.getTime()) || Number.isNaN(timeObj.getTime())) {
            return NextResponse.json(
                { error: true, message: "Fecha u hora inválida" },
                { status: 400 }
            );
        }

        // Combinar fecha + hora
        const startAt = new Date(dateObj);
        startAt.setHours(
            timeObj.getHours(),
            timeObj.getMinutes(),
            0,
            0
        );

        if (Number.isNaN(startAt.getTime())) {
            return NextResponse.json(
                { error: true, message: "Fecha u hora inválida" },
                { status: 400 }
            );
        }

        await connectMongoDB();

        // 5️⃣ Evitar solapamiento de citas
        const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);

        const overlap = await Appointment.findOne({
            user: userId,
            status: { $ne: "cancelled" },
            startAt: { $lt: endAt },
            $expr: {
                $gt: [
                    { $add: ["$startAt", { $multiply: ["$durationMinutes", 60000] }] },
                    startAt,
                ],
            },
        });

        if (overlap) {
            return NextResponse.json(
                { error: true, message: "Ese horario ya está ocupado" },
                { status: 409 }
            );
        }

        // 6️⃣ Crear cita
        const appointment = await Appointment.create({
            user: userId,
            startAt,
            durationMinutes,
            status: "scheduled",
        });

        return NextResponse.json(
            {
                ok: true,
                appointment: {
                    id: appointment._id.toString(),
                    startAt: appointment.startAt,
                    durationMinutes: appointment.durationMinutes,
                    status: appointment.status,
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
