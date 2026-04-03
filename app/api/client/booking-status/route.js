import { NextResponse } from "next/server";
import { auth } from "@auth";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Debes iniciar sesión" },
                { status: 401 }
            );
        }

        await connectMongoDB();

        const clientId = session.user.id;
        const maxActiveAppointments = 2;

        const activeAppointmentsCount = await Appointment.countDocuments({
            clientId,
            status: { $in: ["pending", "confirmed"] },
            startAt: { $gte: new Date() },
        });

        return NextResponse.json(
            {
                canBook: activeAppointmentsCount < maxActiveAppointments,
                activeAppointmentsCount,
                maxActiveAppointments,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("GET /api/client/booking-status error:", error);

        return NextResponse.json(
            { error: "No se pudo obtener el estado de reservas" },
            { status: 500 }
        );
    }
}