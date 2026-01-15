import { NextResponse } from "next/server";
import { auth } from "@auth";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: true, message: "Unauthorized" },
        { status: 401 }
      );
    }

    await connectMongoDB();

    const now = new Date();

    // Próximas citas del usuario (ajusta si quieres incluir/excluir estados)
    const upcomingStatuses = ["pending", "confirmed", "in progress"];

    const appointments = await Appointment.find({
      user: userId,
      status: { $in: upcomingStatuses },
      startAt: { $gte: now },
    })
      .sort({ startAt: 1 })
      .limit(10)
      .lean();

    return NextResponse.json({
      ok: true,
      appointments: appointments.map((a) => ({
        id: a._id.toString(),
        startAt: a.startAt,
        durationMinutes: a.durationMinutes,
        status: a.status,
        paymentStatus: a.paymentStatus,
        price: a.price,
      })),
    });
  } catch (error) {
    console.error("Get appointments error:", error);
    return NextResponse.json(
      { error: true, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
