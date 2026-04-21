import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { auth } from "@auth";
import Appointment from "@models/Appointment";
import connectMongoDB from "@libs/mongodb";

const TZ = "America/Guayaquil";

function pad(value) {
  return String(value).padStart(2, "0");
}

function getTodayISO() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(new Date());
}

function isValidDateString(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

function parseDateLocal(dateStr) {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function getStartOfWeek(dateStr) {
  const date = parseDateLocal(dateStr);
  const weekday = (date.getUTCDay() + 6) % 7;
  return addDays(date, -weekday);
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

function formatDateLocal(date) {
  const safe = new Date(date);
  return `${safe.getUTCFullYear()}-${pad(safe.getUTCMonth() + 1)}-${pad(
    safe.getUTCDate()
  )}`;
}

function resolveRange({ filterType, date, startDate, endDate }) {
  const safeDate = isValidDateString(date) ? date : getTodayISO();

  if (filterType === "custom") {
    const safeStart = isValidDateString(startDate) ? startDate : safeDate;
    const safeEnd = isValidDateString(endDate) ? endDate : safeStart;
    return {
      filterType,
      label: "Rango personalizado",
      startDate: safeStart,
      endDate: safeEnd,
      start: parseDateLocal(safeStart),
      end: addDays(parseDateLocal(safeEnd), 1),
    };
  }

  if (filterType === "month") {
    return {
      filterType,
      label: "Mes",
      startDate: formatDateLocal(getStartOfMonth(safeDate)),
      endDate: formatDateLocal(addDays(getStartOfNextMonth(safeDate), -1)),
      start: getStartOfMonth(safeDate),
      end: getStartOfNextMonth(safeDate),
    };
  }

  if (filterType === "week") {
    const start = getStartOfWeek(safeDate);
    const end = addDays(start, 7);
    return {
      filterType,
      label: "Semana",
      startDate: formatDateLocal(start),
      endDate: formatDateLocal(addDays(end, -1)),
      start,
      end,
    };
  }

  const start = parseDateLocal(safeDate);
  return {
    filterType: "day",
    label: "Día",
    startDate: safeDate,
    endDate: safeDate,
    start,
    end: addDays(start, 1),
  };
}

function toCurrency(value = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatUserName(user = {}) {
  return `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "—";
}

function isReportableClient(user) {
  return Boolean(user?._id) && user?.role === "user";
}

function finalizeClientRows(map) {
  return [...map.values()]
    .map((item) => ({
      clientId: item.clientId,
      clientName: item.clientName,
      email: item.email,
      phone: item.phone,
      totalAppointments: item.totalAppointments,
      completedCount: item.completedCount,
      cancelledCount: item.cancelledCount,
      noAssistanceCount: item.noAssistanceCount,
      pendingCount: item.pendingCount,
      confirmedCount: item.confirmedCount,
      inProgressCount: item.inProgressCount,
      estimatedRevenue: item.estimatedRevenue,
      cashRevenue: item.cashRevenue,
      averageTicket: item.totalAppointments
        ? item.estimatedRevenue / item.totalAppointments
        : 0,
      completionRate: item.totalAppointments
        ? (item.completedCount / item.totalAppointments) * 100
        : 0,
      cancellationRate: item.totalAppointments
        ? (item.cancelledCount / item.totalAppointments) * 100
        : 0,
      lastAppointmentAt: item.lastAppointmentAt,
    }))
    .sort((a, b) => {
      if (b.cashRevenue !== a.cashRevenue) return b.cashRevenue - a.cashRevenue;
      if (b.estimatedRevenue !== a.estimatedRevenue) {
        return b.estimatedRevenue - a.estimatedRevenue;
      }
      return b.totalAppointments - a.totalAppointments;
    });
}

function finalizeBarberRows(map) {
  return [...map.values()]
    .map((item) => ({
      barberId: item.barberId,
      barberName: item.barberName,
      totalAppointments: item.totalAppointments,
      completedCount: item.completedCount,
      cancelledCount: item.cancelledCount,
      noAssistanceCount: item.noAssistanceCount,
      pendingCount: item.pendingCount,
      confirmedCount: item.confirmedCount,
      inProgressCount: item.inProgressCount,
      estimatedRevenue: item.estimatedRevenue,
      cashRevenue: item.cashRevenue,
      distinctClientsCount: item.clients.size,
      distinctServicesCount: item.services.size,
      averageTicket: item.totalAppointments
        ? item.estimatedRevenue / item.totalAppointments
        : 0,
    }))
    .sort((a, b) => {
      if (b.cashRevenue !== a.cashRevenue) return b.cashRevenue - a.cashRevenue;
      if (b.estimatedRevenue !== a.estimatedRevenue) {
        return b.estimatedRevenue - a.estimatedRevenue;
      }
      return b.totalAppointments - a.totalAppointments;
    });
}

function buildReportData(docs) {
  const servicesMap = new Map();
  const barbersMap = new Map();
  const statusMap = new Map();
  const clientsMap = new Map();

  let estimatedRevenue = 0;
  let cashRevenue = 0;
  let completedCount = 0;
  let paidCount = 0;
  let pendingCount = 0;
  let cancelledCount = 0;
  let noAssistanceCount = 0;

  for (const appointment of docs) {
    const serviceName = appointment?.serviceName || "Servicio";
    const barberId = appointment?.barberId?._id
      ? String(appointment.barberId._id)
      : "unassigned";
    const barberName = appointment?.barberId?.name || "Sin asignar";
    const clientId = appointment?.clientId?._id
      ? String(appointment.clientId._id)
      : `unknown:${appointment?._id}`;
    const clientName = appointment?.clientId
      ? formatUserName(appointment.clientId)
      : "Cliente sin asignar";
    const status = appointment?.status || "pending";
    const paymentStatus = appointment?.paymentStatus || "unpaid";
    const price = toCurrency(appointment?.price);

    if (status !== "cancelled") {
      estimatedRevenue += price;
    }

    if (paymentStatus === "paid") {
      cashRevenue += price;
      paidCount += 1;
    }

    if (status === "completed") completedCount += 1;
    if (status === "pending") pendingCount += 1;
    if (status === "cancelled") cancelledCount += 1;
    if (status === "no_assistance") noAssistanceCount += 1;

    if (!servicesMap.has(serviceName)) {
      servicesMap.set(serviceName, {
        serviceName,
        count: 0,
        estimatedRevenue: 0,
        cashRevenue: 0,
        averageTicket: 0,
      });
    }

    const serviceItem = servicesMap.get(serviceName);
    serviceItem.count += 1;
    serviceItem.estimatedRevenue += status !== "cancelled" ? price : 0;
    serviceItem.cashRevenue += paymentStatus === "paid" ? price : 0;
    serviceItem.averageTicket = serviceItem.count
      ? serviceItem.estimatedRevenue / serviceItem.count
      : 0;

    if (!barbersMap.has(barberId)) {
      barbersMap.set(barberId, {
        barberId,
        barberName,
        totalAppointments: 0,
        completedCount: 0,
        cancelledCount: 0,
        noAssistanceCount: 0,
        pendingCount: 0,
        confirmedCount: 0,
        inProgressCount: 0,
        cashRevenue: 0,
        estimatedRevenue: 0,
        clients: new Set(),
        services: new Set(),
      });
    }

    const barberItem = barbersMap.get(barberId);
    barberItem.totalAppointments += 1;
    barberItem.completedCount += status === "completed" ? 1 : 0;
    barberItem.cancelledCount += status === "cancelled" ? 1 : 0;
    barberItem.noAssistanceCount += status === "no_assistance" ? 1 : 0;
    barberItem.pendingCount += status === "pending" ? 1 : 0;
    barberItem.confirmedCount += status === "confirmed" ? 1 : 0;
    barberItem.inProgressCount += status === "in_progress" ? 1 : 0;
    barberItem.cashRevenue += paymentStatus === "paid" ? price : 0;
    barberItem.estimatedRevenue += status !== "cancelled" ? price : 0;
    barberItem.clients.add(clientId);
    barberItem.services.add(serviceName);

    if (!statusMap.has(status)) {
      statusMap.set(status, {
        status,
        count: 0,
      });
    }

    statusMap.get(status).count += 1;

    if (!clientsMap.has(clientId)) {
      clientsMap.set(clientId, {
        clientId,
        clientName,
        email: appointment?.clientId?.email || "",
        phone: appointment?.clientId?.phone || "",
        totalAppointments: 0,
        completedCount: 0,
        cancelledCount: 0,
        noAssistanceCount: 0,
        pendingCount: 0,
        confirmedCount: 0,
        inProgressCount: 0,
        estimatedRevenue: 0,
        cashRevenue: 0,
        lastAppointmentAt: null,
      });
    }

    const clientItem = clientsMap.get(clientId);
    clientItem.totalAppointments += 1;
    clientItem.completedCount += status === "completed" ? 1 : 0;
    clientItem.cancelledCount += status === "cancelled" ? 1 : 0;
    clientItem.noAssistanceCount += status === "no_assistance" ? 1 : 0;
    clientItem.pendingCount += status === "pending" ? 1 : 0;
    clientItem.confirmedCount += status === "confirmed" ? 1 : 0;
    clientItem.inProgressCount += status === "in_progress" ? 1 : 0;
    clientItem.estimatedRevenue += status !== "cancelled" ? price : 0;
    clientItem.cashRevenue += paymentStatus === "paid" ? price : 0;

    const startAt = appointment?.startAt ? new Date(appointment.startAt) : null;
    if (
      startAt &&
      (!clientItem.lastAppointmentAt ||
        startAt.getTime() > new Date(clientItem.lastAppointmentAt).getTime())
    ) {
      clientItem.lastAppointmentAt = startAt;
    }
  }

  return {
    summary: {
      totalAppointments: docs.length,
      completedCount,
      paidCount,
      pendingCount,
      cancelledCount,
      noAssistanceCount,
      estimatedRevenue,
      cashRevenue,
    },
    tables: {
      services: [...servicesMap.values()].sort((a, b) => b.count - a.count),
      statuses: [...statusMap.values()].sort((a, b) => b.count - a.count),
      barbers: finalizeBarberRows(barbersMap),
      clients: finalizeClientRows(clientsMap),
    },
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
      return NextResponse.json({ error: "Usuario inválido" }, { status: 400 });
    }

    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const filterType = String(searchParams.get("filterType") || "day").trim();
    const date = String(searchParams.get("date") || "").trim();
    const startDate = String(searchParams.get("startDate") || "").trim();
    const endDate = String(searchParams.get("endDate") || "").trim();
    const view = String(searchParams.get("view") || "overview").trim();
    const q = String(searchParams.get("q") || "").trim().toLowerCase();

    const range = resolveRange({ filterType, date, startDate, endDate });

    const docs = await Appointment.find({
      startAt: { $gte: range.start, $lt: range.end },
    })
      .sort({ startAt: -1 })
      .populate("clientId", "firstName lastName email phone role")
      .populate("barberId", "name color")
      .lean();

    const filteredDocs = docs.filter((appointment) =>
      isReportableClient(appointment?.clientId)
    );

    const reportData = buildReportData(filteredDocs);

    if (view === "clients" && q) {
      reportData.tables.clients = reportData.tables.clients.filter((item) =>
        [item.clientName, item.email, item.phone]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    if (view === "barbers" && q) {
      reportData.tables.barbers = reportData.tables.barbers.filter((item) =>
        String(item.barberName || "").toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      ok: true,
      view,
      filters: {
        filterType: range.filterType,
        date: range.startDate,
        startDate: range.startDate,
        endDate: range.endDate,
        label: range.label,
        query: q,
      },
      summary: reportData.summary,
      tables: reportData.tables,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("GET /api/admin/reports error:", err);
    return NextResponse.json(
      { error: err?.message || "Error cargando reportes" },
      { status: 500 }
    );
  }
}
