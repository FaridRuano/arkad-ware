import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";
import BarberSchedule from "@models/BarberSchedule";
import BusinessSettings from "@models/BusinessSettings";
import {
  attachBarberMetaToExceptions,
  getScheduleExceptionsInRange,
} from "@libs/schedule/exceptions";

function isValidDateString(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeTime(value = "") {
  const str = String(value || "").trim();
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(str) ? str : "";
}

function getDayNumberFromDateString(dateString) {
  const date = new Date(`${dateString}T12:00:00-05:00`);
  return date.getDay(); // 0 domingo ... 6 sábado
}

function getDayKeyFromDayNumber(dayNumber) {
  if (dayNumber === 0) return "sunday";
  if (dayNumber === 6) return "saturday";
  return "weekdays";
}

function buildClosedHours(source = "none") {
  return {
    source,
    enabled: false,
    isClosed: true,
    start: "",
    end: "",
    breakStart: "",
    breakEnd: "",
  };
}

function buildOpenHours({
  source = "unknown",
  start = "",
  end = "",
  breakStart = "",
  breakEnd = "",
}) {
  const safeStart = normalizeTime(start);
  const safeEnd = normalizeTime(end);
  const safeBreakStart = normalizeTime(breakStart);
  const safeBreakEnd = normalizeTime(breakEnd);

  if (!safeStart || !safeEnd || safeStart >= safeEnd) {
    return buildClosedHours(source);
  }

  const hasValidBreak =
    safeBreakStart &&
    safeBreakEnd &&
    safeBreakStart < safeBreakEnd &&
    safeBreakStart > safeStart &&
    safeBreakEnd < safeEnd;

  return {
    source,
    enabled: true,
    isClosed: false,
    start: safeStart,
    end: safeEnd,
    breakStart: hasValidBreak ? safeBreakStart : "",
    breakEnd: hasValidBreak ? safeBreakEnd : "",
  };
}

function getBusinessHoursForDay(businessSettings, dayNumber) {
  const dayKey = getDayKeyFromDayNumber(dayNumber);
  const range = businessSettings?.generalSchedule?.[dayKey];

  if (!range?.enabled || !range?.start || !range?.end) {
    return buildClosedHours("business");
  }

  return buildOpenHours({
    source: "business",
    start: range.start,
    end: range.end,
  });
}

function getBarberHoursForDay(barberSchedule, dayNumber) {
  if (!barberSchedule?.isActive) {
    return buildClosedHours("barber");
  }

  const dayConfig = Array.isArray(barberSchedule?.weekSchedule)
    ? barberSchedule.weekSchedule.find((item) => item?.day === dayNumber)
    : null;

  if (!dayConfig?.enabled || !dayConfig?.start || !dayConfig?.end) {
    return buildClosedHours("barber");
  }

  return buildOpenHours({
    source: "barber",
    start: dayConfig.start,
    end: dayConfig.end,
    breakStart: dayConfig.breakStart,
    breakEnd: dayConfig.breakEnd,
  });
}

async function getScheduleContext({ date, barberObjectId }) {
  const dayNumber = getDayNumberFromDateString(date);

  const businessSettings =
    (await BusinessSettings.findOne({ isActive: true })
      .sort({ createdAt: -1 })
      .lean()) || null;

  const businessHours = getBusinessHoursForDay(businessSettings, dayNumber);

  let barberSchedule = null;
  let barberHours = buildClosedHours("barber");

  if (barberObjectId) {
    barberSchedule = await BarberSchedule.findOne({
      barber: barberObjectId,
      isActive: true,
    }).lean();

    barberHours = getBarberHoursForDay(barberSchedule, dayNumber);
  }

  let effectiveHours = businessHours;

  if (barberObjectId) {
    const useFallback = barberSchedule?.useBusinessHoursAsFallback !== false;

    if (barberHours.enabled && !barberHours.isClosed) {
      effectiveHours = barberHours;
    } else if (useFallback) {
      effectiveHours = businessHours;
    } else {
      effectiveHours = buildClosedHours("effective");
    }
  }

  return {
    businessSettings: businessSettings
      ? {
        id: businessSettings?._id?.toString?.() ?? businessSettings?._id ?? null,
        businessName: businessSettings?.businessName ?? "",
        timezone: businessSettings?.timezone || "America/Guayaquil",
        slotIntervalMinutes: businessSettings?.slotIntervalMinutes || 30,
        bookingMinNoticeMinutes: businessSettings?.bookingMinNoticeMinutes ?? 60,
        bookingMaxDaysAhead: businessSettings?.bookingMaxDaysAhead ?? 30,
      }
      : {
        id: null,
        businessName: "",
        timezone: "America/Guayaquil",
        slotIntervalMinutes: 30,
        bookingMinNoticeMinutes: 60,
        bookingMaxDaysAhead: 30,
      },

    dayNumber,
    businessHours,
    barberHours,
    effectiveHours,
    barberSchedule: barberSchedule
      ? {
        id: barberSchedule?._id?.toString?.() ?? barberSchedule?._id ?? null,
        barber: barberSchedule?.barber?.toString?.() ?? barberSchedule?.barber ?? null,
        useBusinessHoursAsFallback:
          barberSchedule?.useBusinessHoursAsFallback !== false,
        notes: barberSchedule?.notes ?? "",
        isActive: barberSchedule?.isActive !== false,
      }
      : null,
  };
}

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);

    const date = (searchParams.get("date") || "").trim(); // YYYY-MM-DD
    const barberId = (searchParams.get("barberId") || "").trim(); // optional

    if (!date || !isValidDateString(date)) {
      return NextResponse.json(
        { error: "Parámetro 'date' inválido. Usa YYYY-MM-DD" },
        { status: 400 }
      );
    }

    let barberObjectId = null;

    if (barberId) {
      if (!mongoose.Types.ObjectId.isValid(barberId)) {
        return NextResponse.json(
          { error: "Parámetro 'barberId' inválido" },
          { status: 400 }
        );
      }

      barberObjectId = new mongoose.Types.ObjectId(barberId);
    }

    // Ecuador UTC-5
    const start = new Date(`${date}T00:00:00-05:00`);
    const end = new Date(`${date}T00:00:00-05:00`);
    end.setDate(end.getDate() + 1);

    const match = {
      startAt: { $gte: start, $lt: end },
      status: { $ne: "cancelled" },
      ...(barberObjectId ? { barberId: barberObjectId } : {}),
    };

    const pipeline = [
      { $match: match },

      // Cliente
      {
        $lookup: {
          from: "users",
          localField: "clientId",
          foreignField: "_id",
          as: "client",
        },
      },
      {
        $unwind: {
          path: "$client",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Barbero
      {
        $lookup: {
          from: "barbers",
          localField: "barberId",
          foreignField: "_id",
          as: "barber",
        },
      },
      {
        $unwind: {
          path: "$barber",
          preserveNullAndEmptyArrays: true,
        },
      },

      // Creador
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdByUser",
        },
      },
      {
        $unwind: {
          path: "$createdByUser",
          preserveNullAndEmptyArrays: true,
        },
      },

      { $sort: { startAt: 1 } },

      {
        $project: {
          _id: 1,

          clientId: 1,
          barberId: 1,
          serviceId: 1,

          serviceName: 1,
          startAt: 1,
          endAt: 1,
          durationMinutes: 1,
          serviceDurationMinutes: 1,
          price: 1,

          status: 1,
          paymentStatus: 1,
          source: 1,

          notes: 1,
          statusHistory: 1,

          cancelledAt: 1,
          completedAt: 1,
          paidAt: 1,

          createdAt: 1,
          updatedAt: 1,

          client: {
            _id: "$client._id",
            firstName: "$client.firstName",
            lastName: "$client.lastName",
            phone: "$client.phone",
            email: "$client.email",
          },

          barber: {
            _id: "$barber._id",
            name: "$barber.name",
            color: "$barber.color",
          },

          createdByUser: {
            _id: "$createdByUser._id",
            firstName: "$createdByUser.firstName",
            lastName: "$createdByUser.lastName",
            email: "$createdByUser.email",
            role: "$createdByUser.role",
          },
        },
      },
    ];

    const docs = await Appointment.aggregate(pipeline);

    const appointments = (docs || []).map((a) => {
      const clientFirstName = a?.client?.firstName || "";
      const clientLastName = a?.client?.lastName || "";
      const clientFullName = `${clientFirstName} ${clientLastName}`.trim();

      const creatorFirstName = a?.createdByUser?.firstName || "";
      const creatorLastName = a?.createdByUser?.lastName || "";
      const creatorFullName = `${creatorFirstName} ${creatorLastName}`.trim();

      return {
        id: a?._id?.toString?.() ?? a?._id,

        clientId: a?.clientId?.toString?.() ?? a?.clientId ?? null,
        barberId: a?.barberId?.toString?.() ?? a?.barberId ?? null,
        serviceId: a?.serviceId?.toString?.() ?? a?.serviceId ?? null,

        client: a?.client?._id
          ? {
            id: a?.client?._id?.toString?.() ?? a?.client?._id,
            firstName: a?.client?.firstName ?? "",
            lastName: a?.client?.lastName ?? "",
            name: clientFullName || "—",
            phone: a?.client?.phone ?? "",
            email: a?.client?.email ?? "",
          }
          : null,

        barber: a?.barber?._id
          ? {
            id: a?.barber?._id?.toString?.() ?? a?.barber?._id,
            name: a?.barber?.name ?? "—",
            color: a?.barber?.color || "#000000",
          }
          : null,

        createdBy: a?.createdByUser?._id
          ? {
            id:
              a?.createdByUser?._id?.toString?.() ?? a?.createdByUser?._id,
            firstName: a?.createdByUser?.firstName ?? "",
            lastName: a?.createdByUser?.lastName ?? "",
            name: creatorFullName || "—",
            email: a?.createdByUser?.email ?? "",
            role: a?.createdByUser?.role ?? "",
          }
          : null,

        serviceName: a?.serviceName ?? "",
        startAt: a?.startAt ?? null,
        endAt: a?.endAt ?? null,
        durationMinutes: a?.durationMinutes ?? 0,
        serviceDurationMinutes: a?.serviceDurationMinutes ?? a?.durationMinutes ?? 0,
        price: a?.price ?? 0,

        status: a?.status ?? "pending",
        paymentStatus: a?.paymentStatus ?? "unpaid",
        source: a?.source ?? "admin-panel",

        notes: a?.notes ?? "",
        statusHistory: Array.isArray(a?.statusHistory) ? a.statusHistory : [],

        cancelledAt: a?.cancelledAt ?? null,
        completedAt: a?.completedAt ?? null,
        paidAt: a?.paidAt ?? null,

        createdAt: a?.createdAt ?? null,
        updatedAt: a?.updatedAt ?? null,
      };
    });

    const stats = {
      total: 0,
      pending: 0,
      confirmed: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      noAssistance: 0,
      unpaid: 0,
      paid: 0,
    };

    for (const a of appointments) {
      const st = a?.status || "pending";

      if (st === "cancelled") {
        stats.cancelled++;
        continue;
      }

      if (st === "no_assistance") {
        stats.noAssistance++;
        continue;
      }

      stats.total++;

      if (st === "pending") stats.pending++;
      else if (st === "confirmed") stats.confirmed++;
      else if (st === "in_progress") stats.inProgress++;
      else if (st === "completed") stats.completed++;

      const pay = a?.paymentStatus || "unpaid";
      if (pay === "paid") stats.paid++;
      else stats.unpaid++;
    }

    const scheduleContext = await getScheduleContext({
      date,
      barberObjectId,
    });

    const exceptions = await attachBarberMetaToExceptions(
      await getScheduleExceptionsInRange({
        startDate: date,
        endDate: date,
        barberId: barberId || null,
        activeOnly: true,
      })
    );

    return NextResponse.json({
      date,
      barberId: barberId || null,
      startAtRange: { start, end },
      appointments,
      exceptions,
      meta: {
        ...stats,
        dayNumber: scheduleContext.dayNumber,
      },
      schedule: {
        timezone: scheduleContext.businessSettings.timezone,
        slotIntervalMinutes: scheduleContext.businessSettings.slotIntervalMinutes,
        bookingMinNoticeMinutes:
          scheduleContext.businessSettings.bookingMinNoticeMinutes,
        bookingMaxDaysAhead:
          scheduleContext.businessSettings.bookingMaxDaysAhead,

        businessHours: scheduleContext.businessHours,
        barberHours: scheduleContext.barberHours,
        effectiveHours: scheduleContext.effectiveHours,

        barberSchedule: scheduleContext.barberSchedule,
      },
    });
  } catch (err) {
    console.error("GET /admin/schedule error:", err);

    return NextResponse.json(
      { error: err?.message || "Error cargando agenda" },
      { status: 500 }
    );
  }
}
