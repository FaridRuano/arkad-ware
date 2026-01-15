import { NextResponse } from "next/server";
import { auth } from "@auth";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";
import User from "@models/User";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { addDays, parseISO, isValid } from "date-fns";

const BUSINESS_TZ = "America/Guayaquil";

function isAdmin(session) {
    // ✅ Ajusta esta lógica a tu app:
    // opciones típicas:
    // - session.user.role === "admin"
    // - session.user.isAdmin === true
    // - session.user.permissions?.includes("admin")
    return session?.user?.role === "admin" || session?.user?.isAdmin === true;
}

function buildFullName(user) {
    const first = (user?.firstName || "").trim();
    const last = (user?.lastName || "").trim();
    const full = `${first} ${last}`.trim();
    return full || "Sin nombre";
}

export async function GET(req) {
    try {
        // 1) Sesión
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: true, message: "Unauthorized" },
                { status: 401 }
            );
        }

        if (!isAdmin(session)) {
            return NextResponse.json(
                { error: true, message: "Forbidden" },
                { status: 403 }
            );
        }

        // 2) Fecha “hoy” en timezone del negocio
        const todayStr = formatInTimeZone(new Date(), BUSINESS_TZ, "yyyy-MM-dd");

        // Validación (extra, por si acaso)
        const parsed = parseISO(todayStr);
        if (!isValid(parsed)) {
            return NextResponse.json(
                { error: true, message: "Fecha inválida" },
                { status: 400 }
            );
        }

        // 3) Rango del día en UTC (según zona del negocio)
        const startUtc = fromZonedTime(`${todayStr}T00:00:00`, BUSINESS_TZ);
        const nextDayStr = addDays(parsed, 1).toISOString().slice(0, 10);
        const endUtc = fromZonedTime(`${nextDayStr}T00:00:00`, BUSINESS_TZ);

        await connectMongoDB();

        // 4) Query (todas las citas del día)
        // Puedes excluir canceladas si quieres:
        // const excluded = ["cancelled"];
        // status: { $nin: excluded },
        const docs = await Appointment.find({
            startAt: { $gte: startUtc, $lt: endUtc },
            status: { $nin: ["cancelled", "completed", "no assistance"] },
        })
            .sort({ startAt: 1 })
            .populate("user", "firstName lastName phone") // asumiendo que User tiene name y phone
            .select("user startAt durationMinutes status paymentStatus price")
            .lean();

        // 5) Normalizar para el frontend
        const appointments = docs.map((a) => ({
            id: a._id.toString(),
            name: buildFullName(a.user),
            phone: a?.user?.phone ?? "",
            startAt: a.startAt,
            durationMinutes: a.durationMinutes,
            status: a.status,
            paymentStatus: a.paymentStatus,
            price: a.price,
        }));

        return NextResponse.json(
            {
                ok: true,
                date: todayStr,
                timezone: BUSINESS_TZ,
                appointments,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Admin today appointments error:", error);
        return NextResponse.json(
            { error: true, message: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
