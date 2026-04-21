import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { auth } from "@auth";
import Appointment from "@models/Appointment";
import connectMongoDB from "@libs/mongodb";

const TZ_OFFSET_HOURS = 5;

const ACTIVE_STATUSES = ["pending", "confirmed", "in_progress", "completed"];
const UPCOMING_STATUSES = ["pending", "confirmed", "in_progress"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function isValidDateString(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function parseDateLocal(dateStr) {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, TZ_OFFSET_HOURS, 0, 0, 0));
}

function formatDateLocal(date) {
  const safe = new Date(date);
  return `${safe.getUTCFullYear()}-${pad(safe.getUTCMonth() + 1)}-${pad(
    safe.getUTCDate()
  )}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function getTodayLocalDateString() {
  const now = new Date();
  const local = new Date(now.getTime() - TZ_OFFSET_HOURS * 60 * 60 * 1000);
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(
    local.getUTCDate()
  )}`;
}

function getStartOfMonth(dateStr) {
  const [year, month] = String(dateStr).split("-").map(Number);
  return parseDateLocal(`${year}-${pad(month)}-01`);
}

function getStartOfNextMonth(dateStr) {
  const [yearRaw, monthRaw] = String(dateStr).split("-").map(Number);
  const nextMonth = monthRaw === 12 ? 1 : monthRaw + 1;
  const nextYear = monthRaw === 12 ? yearRaw + 1 : yearRaw;
  return parseDateLocal(`${nextYear}-${pad(nextMonth)}-01`);
}

function getStartOfWeek(dateStr) {
  const date = parseDateLocal(dateStr);
  const localWeekday = (date.getUTCDay() + 6) % 7;
  return addDays(date, -localWeekday);
}

function getWeekLabel(startDate, endDate) {
  const startDay = new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
  }).format(startDate);

  const endDay = new Intl.DateTimeFormat("es-EC", {
    timeZone: "America/Guayaquil",
    day: "2-digit",
  }).format(addDays(endDate, -1));

  return `${startDay}–${endDay}`;
}

function toCurrency(value = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function formatPersonName(person = {}) {
  return `${person?.firstName || ""} ${person?.lastName || ""}`.trim() || "—";
}

function serializeAppointment(appointment) {
  const client = appointment?.clientId;
  const barber = appointment?.barberId;

  return {
    id: appointment?._id?.toString?.() ?? appointment?._id,
    serviceName: appointment?.serviceName || "Servicio",
    startAt: appointment?.startAt ?? null,
    endAt: appointment?.endAt ?? null,
    createdAt: appointment?.createdAt ?? null,
    price: appointment?.price ?? 0,
    status: appointment?.status ?? "pending",
    paymentStatus: appointment?.paymentStatus ?? "unpaid",
    durationMinutes: appointment?.durationMinutes ?? 0,
    serviceDurationMinutes:
      appointment?.serviceDurationMinutes ?? appointment?.durationMinutes ?? 0,
    source: appointment?.source ?? "admin-panel",
    client: client
      ? {
          id: client?._id?.toString?.() ?? client?._id,
          name: formatPersonName(client),
          phone: client?.phone || "",
          email: client?.email || "",
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

export async function GET(req) {
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

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") === "month" ? "month" : "day";
    const date = isValidDateString(searchParams.get("date"))
      ? searchParams.get("date")
      : getTodayLocalDateString();

    const dayStart = parseDateLocal(date);
    const dayEnd = addDays(dayStart, 1);

    const periodStart = period === "month" ? getStartOfMonth(date) : dayStart;
    const periodEnd = period === "month" ? getStartOfNextMonth(date) : dayEnd;

    const weekStart = getStartOfWeek(date);
    const weekEnd = addDays(weekStart, 7);

    const now = new Date();

    const [
      appointmentsInPeriod,
      appointmentsInWeek,
      recentAppointments,
      upcomingAppointments,
      cashAppointmentsInWeek,
    ] = await Promise.all([
      Appointment.find({
        startAt: { $gte: periodStart, $lt: periodEnd },
      })
        .sort({ startAt: 1 })
        .populate("clientId", "firstName lastName phone email")
        .populate("barberId", "name fullName color"),

      Appointment.find({
        startAt: { $gte: weekStart, $lt: weekEnd },
      })
        .select("_id startAt status paymentStatus price")
        .lean(),

      Appointment.find({
        status: { $in: UPCOMING_STATUSES },
      })
        .sort({ createdAt: -1, startAt: -1 })
        .limit(6)
        .populate("clientId", "firstName lastName phone email")
        .populate("barberId", "name fullName color"),

      Appointment.find({
        startAt: { $gte: now },
        status: { $in: UPCOMING_STATUSES },
      })
        .sort({ startAt: 1 })
        .limit(6)
        .populate("clientId", "firstName lastName phone email")
        .populate("barberId", "name fullName color"),

      Appointment.find({
        paidAt: { $gte: weekStart, $lt: weekEnd },
        paymentStatus: "paid",
      })
        .select("_id price paidAt")
        .lean(),
    ]);

    const activeAppointmentsInPeriod = appointmentsInPeriod.filter((item) =>
      ACTIVE_STATUSES.includes(String(item?.status || ""))
    );

    const estimatedRevenue = activeAppointmentsInPeriod.reduce(
      (sum, item) => sum + toCurrency(item?.price),
      0
    );

    const pendingConfirmationCount = appointmentsInPeriod.filter(
      (item) => item?.status === "pending"
    ).length;
    const completedCount = appointmentsInPeriod.filter(
      (item) => item?.status === "completed"
    ).length;
    const paidCount = appointmentsInPeriod.filter(
      (item) => item?.paymentStatus === "paid"
    ).length;

    const weeklyCashRevenue = cashAppointmentsInWeek.reduce(
      (sum, item) => sum + toCurrency(item?.price),
      0
    );

    const upcomingCount = upcomingAppointments.length;

    const chartItems =
      period === "month"
        ? (() => {
            const monthStart = getStartOfMonth(date);
            const monthEnd = getStartOfNextMonth(date);
            const monthWeeks = [];

            let cursor = monthStart;
            let weekIndex = 1;

            while (cursor < monthEnd) {
              const weekStart = cursor;
              const weekEnd = addDays(weekStart, 7) < monthEnd ? addDays(weekStart, 7) : monthEnd;

              const weekAppointments = appointmentsInPeriod.filter((item) => {
                const startAt = new Date(item?.startAt || 0);
                return startAt >= weekStart && startAt < weekEnd && item?.status !== "cancelled";
              });

              monthWeeks.push({
                key: `week-${weekIndex}`,
                date: formatDateLocal(weekStart),
                label: `Semana ${weekIndex}`,
                helper: getWeekLabel(weekStart, weekEnd),
                totalAppointments: weekAppointments.length,
                completedAppointments: weekAppointments.filter((item) => item?.status === "completed")
                  .length,
              });

              cursor = weekEnd;
              weekIndex += 1;
            }

            return monthWeeks;
          })()
        : Array.from({ length: 7 }, (_, index) => {
            const current = addDays(weekStart, index);
            const dateKey = formatDateLocal(current);
            const dayAppointments = appointmentsInWeek.filter(
              (item) => formatDateLocal(item?.startAt) === dateKey && item?.status !== "cancelled"
            );

            return {
              key: dateKey,
              date: dateKey,
              label: new Intl.DateTimeFormat("es-EC", {
                timeZone: "America/Guayaquil",
                weekday: "short",
              }).format(current),
              helper: new Intl.DateTimeFormat("es-EC", {
                timeZone: "America/Guayaquil",
                day: "2-digit",
              }).format(current),
              totalAppointments: dayAppointments.length,
              completedAppointments: dayAppointments.filter((item) => item?.status === "completed")
                .length,
            };
          });

    const maxBarValue = Math.max(
      1,
      ...chartItems.map((item) => item.totalAppointments)
    );

    return NextResponse.json({
      ok: true,
      filters: {
        period,
        date,
      },
      summary: {
        totalAppointments: activeAppointmentsInPeriod.length,
        pendingConfirmationCount,
        upcomingCount,
        completedCount,
        paidCount,
        estimatedRevenue,
        weeklyCashRevenue,
      },
      chart: {
        maxBarValue,
        mode: period === "month" ? "weeks" : "days",
        items: chartItems,
      },
      recentAppointments: recentAppointments.map(serializeAppointment),
      upcomingAppointments: upcomingAppointments.map(serializeAppointment),
    });
  } catch (err) {
    console.error("GET /api/admin/schedule/summary error:", err);
    return NextResponse.json(
      { error: err?.message || "Error cargando el resumen de agenda" },
      { status: 500 }
    );
  }
}
