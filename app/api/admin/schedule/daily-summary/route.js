import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { auth } from "@auth";
import Appointment from "@models/Appointment";
import connectMongoDB from "@libs/mongodb";

const TZ = "America/Guayaquil";

function getTodayISO() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function parseDayBounds(dateStr) {
  const start = new Date(`${dateStr}T00:00:00-05:00`);
  const end = new Date(`${dateStr}T00:00:00-05:00`);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function formatUserName(user = {}) {
  return `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "—";
}

function serializeAppointment(doc) {
  const client = doc?.clientId;
  const barber = doc?.barberId;

  return {
    id: doc?._id?.toString?.() ?? doc?._id,
    serviceName: doc?.serviceName || "Servicio",
    startAt: doc?.startAt ?? null,
    endAt: doc?.endAt ?? null,
    createdAt: doc?.createdAt ?? null,
    updatedAt: doc?.updatedAt ?? null,
    durationMinutes: doc?.durationMinutes ?? 0,
    serviceDurationMinutes:
      doc?.serviceDurationMinutes ?? doc?.durationMinutes ?? 0,
    price: doc?.price ?? 0,
    status: doc?.status ?? "pending",
    paymentStatus: doc?.paymentStatus ?? "unpaid",
    paidAt: doc?.paidAt ?? null,
    completedAt: doc?.completedAt ?? null,
    cancelledAt: doc?.cancelledAt ?? null,
    cancelReason: doc?.cancelReason ?? "",
    notes: doc?.notes ?? "",
    source: doc?.source ?? "admin-panel",
    client: client
      ? {
          id: client?._id?.toString?.() ?? client?._id,
          firstName: client?.firstName ?? "",
          lastName: client?.lastName ?? "",
          name: formatUserName(client),
          phone: client?.phone ?? "",
          email: client?.email ?? "",
        }
      : null,
    barber: barber
      ? {
          id: barber?._id?.toString?.() ?? barber?._id,
          name: barber?.name || barber?.fullName || "Sin asignar",
          color: barber?.color || "#000000",
        }
      : null,
  };
}

export async function GET() {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { error: "Usuario de sesión inválido" },
        { status: 400 }
      );
    }

    await connectMongoDB();

    const date = getTodayISO();
    const { start, end } = parseDayBounds(date);

    const docs = await Appointment.find({
      startAt: { $gte: start, $lt: end },
    })
      .sort({ startAt: 1, createdAt: 1 })
      .populate("clientId", "firstName lastName phone email")
      .populate("barberId", "name fullName color")
      .lean();

    const appointments = docs.map(serializeAppointment);
    const now = new Date();

    const currentAppointments = appointments.filter(
      (item) => item?.status === "in_progress"
    );

    const upcomingAppointments = appointments.filter((item) => {
      const status = item?.status;
      const startAt = item?.startAt ? new Date(item.startAt).getTime() : 0;
      return (
        ["pending", "confirmed"].includes(status) &&
        startAt >= now.getTime()
      );
    });

    const attentionAppointments = appointments.filter((item) => {
      const status = item?.status;
      const isUnpaid = item?.paymentStatus === "unpaid";

      if (status === "completed" && isUnpaid) return true;
      if (status === "no_assistance") return true;
      if (status === "confirmed" && item?.startAt && new Date(item.startAt) < now)
        return true;
      return false;
    });

    const pastAppointments = appointments.filter((item) => {
      const endAt = item?.endAt ? new Date(item.endAt).getTime() : 0;
      return endAt < now.getTime() || ["completed", "no_assistance", "cancelled"].includes(item?.status);
    });

    const summary = {
      totalToday: appointments.length,
      currentCount: currentAppointments.length,
      upcomingCount: upcomingAppointments.length,
      pendingConfirmationCount: appointments.filter((item) => item?.status === "pending").length,
      unpaidCompletedCount: appointments.filter(
        (item) => item?.status === "completed" && item?.paymentStatus === "unpaid"
      ).length,
      totalEstimated: appointments
        .filter((item) => item?.status !== "cancelled")
        .reduce((sum, item) => sum + (Number(item?.price) || 0), 0),
      totalCash: appointments
        .filter((item) => item?.paymentStatus === "paid")
        .reduce((sum, item) => sum + (Number(item?.price) || 0), 0),
    };

    return NextResponse.json({
      ok: true,
      date,
      summary,
      currentAppointments,
      upcomingAppointments,
      attentionAppointments,
      pastAppointments,
      allAppointments: appointments,
    });
  } catch (err) {
    console.error("GET /api/admin/schedule/daily-summary error:", err);
    return NextResponse.json(
      { error: err?.message || "Error cargando la estación diaria" },
      { status: 500 }
    );
  }
}
