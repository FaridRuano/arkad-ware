import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@auth";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";

function buildStartAt({ date, time }) {
  // date: 'YYYY-MM-DD'
  // time: 'HH:MM'
  if (!date || !time) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)) {
    return `${date}T${time}:00-05:00`; // Ecuador -05:00
  }

  return "";
}

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

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: true, message: "Invalid session userId" },
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

    // 4) Construir startAt (robusto)
    const startAtStr = buildStartAt({ date, time });
    if (!startAtStr) {
      return NextResponse.json(
        { error: true, message: "Fecha u hora inválida" },
        { status: 400 }
      );
    }

    const startAt = new Date(startAtStr);
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json(
        { error: true, message: "Fecha u hora inválida" },
        { status: 400 }
      );
    }

    await connectMongoDB();

    // 5) Evitar solapamiento (agenda GLOBAL)
    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + durationMinutes);

    const overlap = await Appointment.findOne({
      status: { $nin: ["cancelled", "no assistance"] },
      startAt: { $type: "date", $lt: endAt },
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

    // 6) Crear cita
    const price = durationMinutes === 30 ? 8 : 12;

    const actorObjectId = new mongoose.Types.ObjectId(userId);

    const appointment = await Appointment.create({
      user: actorObjectId, // cliente crea su propia cita
      startAt,
      durationMinutes,
      price,
      notes: typeof notes === "string" ? notes.trim() : "",
      statusHistory: [
        {
          from: "",
          to: "pending",
          changedAt: new Date(),
          changedBy: actorObjectId, // ✅ actor = el mismo usuario
          reason: "created",
        },
      ],
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
          statusHistory: appointment.statusHistory,
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
