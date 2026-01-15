import { NextResponse } from "next/server";
import { auth } from "@auth";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";
import { fromZonedTime } from "date-fns-tz";
import { addDays, parseISO, isValid } from "date-fns";

const TUTOR_TIME_ZONE = "America/Guayaquil";

export async function GET(req) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: true, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get("date"); // "YYYY-MM-DD"

    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json(
        { error: true, message: "Parámetro date inválido (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const parsed = parseISO(dateStr);
    if (!isValid(parsed)) {
      return NextResponse.json(
        { error: true, message: "Fecha inválida" },
        { status: 400 }
      );
    }

    // Rango del día en la zona horaria del negocio, convertido a UTC
    const startUtc = fromZonedTime(`${dateStr}T00:00:00`, TUTOR_TIME_ZONE);
    const nextDayStr = addDays(parsed, 1).toISOString().slice(0, 10);
    const endUtc = fromZonedTime(`${nextDayStr}T00:00:00`, TUTOR_TIME_ZONE);

    await connectMongoDB();

    // Estados que NO quieres mostrar en la agenda del día (ajusta a tu UX)
    const excludedStatuses = ["cancelled", "completed", "no assistance"];

    const appointments = await Appointment.find({
      user: userId, // ✅ Vista del cliente. Si es agenda global/admin, QUITA esto.
      status: { $nin: excludedStatuses },
      startAt: { $gte: startUtc, $lt: endUtc },
    })
      .sort({ startAt: 1 })
      .select("startAt durationMinutes status price paymentStatus")
      .lean();

    return NextResponse.json(
      {
        ok: true,
        appointments: appointments.map((a) => ({
          id: a._id.toString(),
          startAt: a.startAt,
          durationMinutes: a.durationMinutes,
          status: a.status,
          price: a.price,
          paymentStatus: a.paymentStatus,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Appointments day error:", error);
    return NextResponse.json(
      { error: true, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
