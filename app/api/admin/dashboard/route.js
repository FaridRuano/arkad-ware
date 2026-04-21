import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { auth } from "@auth";
import Appointment from "@models/Appointment";
import Barber from "@models/Barber";
import Service from "@models/Service";
import User from "@models/User";
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

function parseDateLocal(dateStr) {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
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

function formatUserName(user = {}) {
  return `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "—";
}

function toCurrency(value = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isReportableClient(user) {
  return Boolean(user?._id) && user?.role === "user";
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
      return NextResponse.json({ error: "Usuario inválido" }, { status: 400 });
    }

    await connectMongoDB();

    const todayIso = getTodayISO();
    const todayStart = parseDateLocal(todayIso);
    const todayEnd = addDays(todayStart, 1);
    const monthStart = getStartOfMonth(todayIso);
    const monthEnd = getStartOfNextMonth(todayIso);
    const now = new Date();

    const [
      activeServices,
      activeBarbers,
      totalClients,
      recentClientsDocs,
      todayAppointments,
      monthAppointments,
      upcomingAppointments,
    ] = await Promise.all([
      Service.find({ isActive: true })
        .sort({ updatedAt: -1 })
        .select("name price durationMinutes color barbers")
        .limit(6)
        .lean(),
      Barber.find({ isActive: true })
        .sort({ name: 1 })
        .select("name color phone createdAt")
        .lean(),
      User.countDocuments({ role: "user" }),
      User.find({ role: "user" })
        .sort({ createdAt: -1 })
        .select("firstName lastName phone email createdAt")
        .limit(6)
        .lean(),
      Appointment.find({
        startAt: { $gte: todayStart, $lt: todayEnd },
      })
        .populate("clientId", "firstName lastName phone role")
        .populate("barberId", "name")
        .sort({ startAt: 1 })
        .lean(),
      Appointment.find({
        startAt: { $gte: monthStart, $lt: monthEnd },
      })
        .populate("clientId", "role")
        .populate("barberId", "name")
        .lean(),
      Appointment.find({
        startAt: { $gte: now },
        status: { $in: ["pending", "confirmed", "in_progress"] },
      })
        .populate("clientId", "firstName lastName phone role")
        .populate("barberId", "name")
        .sort({ startAt: 1 })
        .limit(6)
        .lean(),
    ]);

    const filteredTodayAppointments = todayAppointments.filter((appointment) =>
      isReportableClient(appointment?.clientId)
    );
    const filteredMonthAppointments = monthAppointments.filter((appointment) =>
      isReportableClient(appointment?.clientId)
    );
    const filteredUpcomingAppointments = upcomingAppointments.filter((appointment) =>
      isReportableClient(appointment?.clientId)
    );

    const barberStatsMap = new Map();
    const topServicesMap = new Map();

    let monthlyEstimatedRevenue = 0;
    let monthlyCashRevenue = 0;
    let completedThisMonth = 0;
    let unpaidCompletedThisMonth = 0;
    let cancelledThisMonth = 0;
    let noShowsThisMonth = 0;

    for (const appointment of filteredMonthAppointments) {
      const status = appointment?.status || "pending";
      const price = toCurrency(appointment?.price);
      const paymentStatus = appointment?.paymentStatus || "unpaid";
      const barberId = appointment?.barberId?._id
        ? String(appointment.barberId._id)
        : "unassigned";
      const barberName = appointment?.barberId?.name || "Sin asignar";
      const serviceName = appointment?.serviceName || "Servicio";

      if (status !== "cancelled") {
        monthlyEstimatedRevenue += price;
      }

      if (paymentStatus === "paid") {
        monthlyCashRevenue += price;
      }

      if (status === "completed") {
        completedThisMonth += 1;
        if (paymentStatus !== "paid") unpaidCompletedThisMonth += 1;
      }

      if (status === "cancelled") cancelledThisMonth += 1;
      if (status === "no_assistance") noShowsThisMonth += 1;

      if (!barberStatsMap.has(barberId)) {
        barberStatsMap.set(barberId, {
          barberId,
          barberName,
          monthAppointments: 0,
          monthCompleted: 0,
          monthCashRevenue: 0,
        });
      }

      const barberItem = barberStatsMap.get(barberId);
      barberItem.monthAppointments += 1;
      barberItem.monthCompleted += status === "completed" ? 1 : 0;
      barberItem.monthCashRevenue += paymentStatus === "paid" ? price : 0;

      if (!topServicesMap.has(serviceName)) {
        topServicesMap.set(serviceName, {
          serviceName,
          count: 0,
          estimatedRevenue: 0,
        });
      }

      const serviceItem = topServicesMap.get(serviceName);
      serviceItem.count += 1;
      serviceItem.estimatedRevenue += status !== "cancelled" ? price : 0;
    }

    const todayByBarber = new Map();
    let pendingConfirmationsToday = 0;

    for (const appointment of filteredTodayAppointments) {
      const barberId = appointment?.barberId?._id
        ? String(appointment.barberId._id)
        : "unassigned";
      todayByBarber.set(barberId, (todayByBarber.get(barberId) || 0) + 1);

      if (appointment?.status === "pending") {
        pendingConfirmationsToday += 1;
      }
    }

    const barbers = activeBarbers.map((barber) => {
      const id = String(barber._id);
      const monthStats = barberStatsMap.get(id) || {
        monthAppointments: 0,
        monthCompleted: 0,
        monthCashRevenue: 0,
      };

      return {
        id,
        name: barber.name,
        color: barber.color,
        phone: barber.phone,
        appointmentsToday: todayByBarber.get(id) || 0,
        monthAppointments: monthStats.monthAppointments,
        monthCompleted: monthStats.monthCompleted,
        monthCashRevenue: monthStats.monthCashRevenue,
      };
    });

    return NextResponse.json({
      ok: true,
      summary: {
        appointmentsToday: filteredTodayAppointments.length,
        pendingConfirmationsToday,
        monthlyAppointments: filteredMonthAppointments.length,
        monthlyEstimatedRevenue,
        monthlyCashRevenue,
        activeServices: activeServices.length,
        activeBarbers: activeBarbers.length,
        totalClients,
      },
      monthInsights: {
        completedThisMonth,
        unpaidCompletedThisMonth,
        cancelledThisMonth,
        noShowsThisMonth,
      },
      services: activeServices.map((service) => ({
        id: String(service._id),
        name: service.name,
        durationMinutes: service.durationMinutes,
        price: service.price,
        color: service.color,
        assignedBarbers: Array.isArray(service.barbers) ? service.barbers.length : 0,
      })),
      barbers,
      recentClients: recentClientsDocs.map((client) => ({
        id: String(client._id),
        name: formatUserName(client),
        phone: client.phone || "",
        email: client.email || "",
        createdAt: client.createdAt,
      })),
      upcomingAppointments: filteredUpcomingAppointments.map((appointment) => ({
        id: String(appointment._id),
        clientName: appointment?.clientId
          ? formatUserName(appointment.clientId)
          : "Cliente",
        phone: appointment?.clientId?.phone || "",
        barberName: appointment?.barberId?.name || "Sin asignar",
        serviceName: appointment?.serviceName || "Servicio",
        status: appointment?.status || "pending",
        price: toCurrency(appointment?.price),
        startAt: appointment?.startAt,
      })),
      topServices: [...topServicesMap.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/admin/dashboard error:", error);
    return NextResponse.json(
      { error: error?.message || "Error cargando resumen del panel" },
      { status: 500 }
    );
  }
}
