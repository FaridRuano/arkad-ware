import { NextResponse } from "next/server";
import Appointment from "@models/Appointment";
import connectMongoDB from "@libs/mongodb";

// Ajusta a tus estados nuevos (sin espacios)
const STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_ASSISTANCE: "no_assistance",
};

// Reglas de transición (backend manda)
const TRANSITIONS = {
  [STATUS.PENDING]: [STATUS.CONFIRMED, STATUS.NO_ASSISTANCE, STATUS.CANCELLED],
  [STATUS.CONFIRMED]: [STATUS.IN_PROGRESS, STATUS.NO_ASSISTANCE, STATUS.CANCELLED],
  [STATUS.IN_PROGRESS]: [STATUS.COMPLETED, STATUS.CANCELLED],
  [STATUS.COMPLETED]: [],
  [STATUS.NO_ASSISTANCE]: [],
  [STATUS.CANCELLED]: [],
};

const isAllowedTransition = (from, to) => {
  const allowed = TRANSITIONS[from] || [];
  return allowed.includes(to);
};

export async function PATCH(req, { params }) {
  try {
    await connectMongoDB();

    const { id } = params;
    const body = await req.json();

    const to = body?.to; // nuevo estado
    const reason = body?.reason || "manual";
    const changedBy = body?.changedBy || null; // ideal: sacarlo de sesión admin

    if (!to) {
      return NextResponse.json({ error: "Campo 'to' es requerido" }, { status: 400 });
    }

    const allowedStatuses = new Set(Object.values(STATUS));
    if (!allowedStatuses.has(to)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }

    // Traemos el doc actual para saber el "from"
    const current = await Appointment.findById(id).lean();
    if (!current) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    const from = current.status || "";

    // Si no cambia, no hacemos nada (pero devolvemos ok)
    if (from === to) {
      return NextResponse.json({ ok: true, appointment: current });
    }

    // Validación de transición (según reglas de negocio)
    if (from && !isAllowedTransition(from, to)) {
      return NextResponse.json(
        { error: `Transición no permitida: ${from} → ${to}` },
        { status: 409 }
      );
    }

    const historyEntry = {
      from,
      to,
      changedAt: new Date(),
      changedBy,
      reason,
    };

    const updated = await Appointment.findByIdAndUpdate(
      id,
      {
        $set: { status: to },
        $push: { statusHistory: historyEntry },
      },
      { new: true }
    ).lean();

    return NextResponse.json({ ok: true, appointment: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error actualizando estado" },
      { status: 500 }
    );
  }
}