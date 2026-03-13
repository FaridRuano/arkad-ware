import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Appointment from "@models/Appointment";
import connectMongoDB from "@libs/mongodb";
import { auth } from "@auth";

const STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_ASSISTANCE: "no_assistance",
};

const TRANSITIONS = {
  [STATUS.PENDING]: [STATUS.CONFIRMED, STATUS.NO_ASSISTANCE, STATUS.CANCELLED],
  [STATUS.CONFIRMED]: [STATUS.IN_PROGRESS, STATUS.NO_ASSISTANCE, STATUS.CANCELLED],
  [STATUS.IN_PROGRESS]: [STATUS.COMPLETED, STATUS.CANCELLED],
  [STATUS.COMPLETED]: [],
  [STATUS.NO_ASSISTANCE]: [],
  [STATUS.CANCELLED]: [],
};

function isAllowedTransition(from, to) {
  const allowed = TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export async function PATCH(req, { params }) {
  try {
    const session = await auth();

    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: "Usuario de sesión inválido" },
        { status: 400 }
      );
    }

    await connectMongoDB();

    const { id } = params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "ID de cita inválido" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const to = String(body?.to || "").trim();
    const reason = String(body?.reason || "manual").trim();

    if (!to) {
      return NextResponse.json(
        { error: "Campo 'to' es requerido" },
        { status: 400 }
      );
    }

    const allowedStatuses = new Set(Object.values(STATUS));

    if (!allowedStatuses.has(to)) {
      return NextResponse.json(
        { error: "Estado inválido" },
        { status: 400 }
      );
    }

    const current = await Appointment.findById(id)
      .select(
        "_id status statusHistory completedAt cancelledAt paymentStatus paidAt"
      )
      .lean();

    if (!current) {
      return NextResponse.json(
        { error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    const from = current?.status || "";

    if (from === to) {
      return NextResponse.json({
        ok: true,
        appointment: {
          id: current?._id?.toString?.() ?? current?._id,
          status: current?.status ?? null,
          completedAt: current?.completedAt ?? null,
          cancelledAt: current?.cancelledAt ?? null,
        },
      });
    }

    if (from && !isAllowedTransition(from, to)) {
      return NextResponse.json(
        { error: `Transición no permitida: ${from} → ${to}` },
        { status: 409 }
      );
    }

    const changedBy = new mongoose.Types.ObjectId(userId);
    const now = new Date();

    const setFields = {
      status: to,
    };

    // Normalizar timestamps de estado
    if (to === STATUS.COMPLETED) {
      setFields.completedAt = now;
      setFields.cancelledAt = null;
    } else if (to === STATUS.CANCELLED) {
      setFields.cancelledAt = now;
      setFields.completedAt = null;
    } else {
      // Para estados intermedios limpiamos timestamps finales
      setFields.completedAt = null;
      setFields.cancelledAt = null;
    }

    const historyEntry = {
      from,
      to,
      changedAt: now,
      changedBy,
      reason: reason || "manual",
    };

    const updated = await Appointment.findByIdAndUpdate(
      id,
      {
        $set: setFields,
        $push: { statusHistory: historyEntry },
      },
      {
        new: true,
        runValidators: true,
      }
    ).lean();

    return NextResponse.json({
      ok: true,
      appointment: {
        id: updated?._id?.toString?.() ?? updated?._id,
        status: updated?.status ?? null,
        paymentStatus: updated?.paymentStatus ?? "unpaid",
        completedAt: updated?.completedAt ?? null,
        cancelledAt: updated?.cancelledAt ?? null,
        paidAt: updated?.paidAt ?? null,
        statusHistory: Array.isArray(updated?.statusHistory)
          ? updated.statusHistory
          : [],
        updatedAt: updated?.updatedAt ?? null,
      },
    });
  } catch (err) {
    console.error("PATCH /admin/schedule/appointments/status/[id] error:", err);

    return NextResponse.json(
      { error: err?.message || "Error actualizando estado" },
      { status: 500 }
    );
  }
}