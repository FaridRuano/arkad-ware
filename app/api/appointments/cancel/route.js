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
    const { id, reason } = body || {};

    if (!id) {
      return NextResponse.json(
        { error: true, message: "Appointment id is required" },
        { status: 400 }
      );
    }

    await connectMongoDB();

    // 3) Leer la cita (para conocer el status actual y poder guardar "from")
    const appointment = await Appointment.findOne({ _id: id, user: userId })
      .select("_id status user")
      .lean();

    if (!appointment) {
      return NextResponse.json(
        { error: true, message: "No se encontró la cita o no tienes permisos" },
        { status: 404 }
      );
    }

    // 4) Reglas: no cancelar si ya está finalizada o ya cancelada
    const nonCancellable = ["cancelled", "completed", "no assistance"];
    if (nonCancellable.includes(appointment.status)) {
      return NextResponse.json(
        {
          error: true,
          message: `No puedes cancelar una cita en estado: ${appointment.status}`,
        },
        { status: 409 }
      );
    }

    const safeReason =
      typeof reason === "string" ? reason.trim().slice(0, 200) : "";

    // 5) Update atómico: cambia status + push al historial
    const updatedAppointment = await Appointment.findOneAndUpdate(
      { _id: id, user: userId, status: appointment.status }, // evita carreras
      {
        $set: { status: "cancelled" },
        $push: {
          statusHistory: {
            from: appointment.status,
            to: "cancelled",
            changedAt: new Date(),
            changedBy: userId,
            reason: safeReason || "user_cancelled",
          },
        },
      },
      { new: true }
    )
      .select("_id status statusHistory updatedAt")
      .lean();

    if (!updatedAppointment) {
      return NextResponse.json(
        {
          error: true,
          message: "No se pudo cancelar (posible cambio simultáneo de estado)",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        appointment: {
          id: updatedAppointment._id.toString(),
          status: updatedAppointment.status,
          updatedAt: updatedAppointment.updatedAt,
          // opcional: te devuelvo el último evento del historial
          lastStatusEvent:
            updatedAppointment.statusHistory?.[
              updatedAppointment.statusHistory.length - 1
            ] || null,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Cancel appointment error:", error);
    return NextResponse.json(
      { error: true, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
