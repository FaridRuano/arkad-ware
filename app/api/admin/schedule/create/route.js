import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";
import User from "@models/User";
import Barber from "@models/Barber";
import Service from "@models/Service";
import { auth } from "@auth";

function buildStartAt({ startAt, date, time }) {
  if (startAt && typeof startAt === "string") {
    return startAt;
  }

  if (
    date &&
    time &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    /^\d{2}:\d{2}$/.test(time)
  ) {
    return `${date}T${time}:00-05:00`;
  }

  return "";
}

export async function POST(req) {
  try {
    const session = await auth();

    const adminId = session?.user?.id;
    const role = session?.user?.role;

    if (!adminId) {
      return NextResponse.json(
        { error: true, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (role !== "admin") {
      return NextResponse.json(
        { error: true, message: "Forbidden" },
        { status: 403 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(adminId)) {
      return NextResponse.json(
        { error: "adminId inválido" },
        { status: 400 }
      );
    }

    await connectMongoDB();

    const adminObjectId = new mongoose.Types.ObjectId(adminId);
    const body = await req.json().catch(() => ({}));

    const clientId = String(body?.clientId || body?.userId || "").trim();
    const barberIdRaw = String(body?.barberId || "").trim();
    const serviceId = String(body?.serviceId || "").trim();
    const notes = String(body?.notes || "").trim();

    const hasBarberAssigned = !!barberIdRaw;

    const startAtStr = buildStartAt({
      startAt: body?.startAt,
      date: body?.date,
      time: body?.time,
    });

    if (!clientId || !mongoose.Types.ObjectId.isValid(clientId)) {
      return NextResponse.json(
        { error: "clientId inválido" },
        { status: 400 }
      );
    }

    if (hasBarberAssigned && !mongoose.Types.ObjectId.isValid(barberIdRaw)) {
      return NextResponse.json(
        { error: "barberId inválido" },
        { status: 400 }
      );
    }

    if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
      return NextResponse.json(
        { error: "serviceId inválido" },
        { status: 400 }
      );
    }

    if (!startAtStr) {
      return NextResponse.json(
        { error: "Falta startAt o date+time válidos" },
        { status: 400 }
      );
    }

    const startAt = new Date(startAtStr);

    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json(
        { error: "startAt inválido" },
        { status: 400 }
      );
    }

    const queries = [
      User.findById(clientId).select("_id firstName lastName phone email role"),
      Service.findById(serviceId).select(
        "_id name durationMinutes price isActive barbers color"
      ),
    ];

    if (hasBarberAssigned) {
      queries.push(
        Barber.findById(barberIdRaw).select("_id name isActive color")
      );
    }

    const results = await Promise.all(queries);

    const client = results[0];
    const service = results[1];
    const barber = hasBarberAssigned ? results[2] : null;

    if (!client) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    if (!service) {
      return NextResponse.json(
        { error: "Servicio no encontrado" },
        { status: 404 }
      );
    }

    if (service.isActive === false) {
      return NextResponse.json(
        { error: "Este servicio está inactivo" },
        { status: 400 }
      );
    }

    if (hasBarberAssigned) {
      if (!barber) {
        return NextResponse.json(
          { error: "Barbero no encontrado" },
          { status: 404 }
        );
      }

      if (barber.isActive === false) {
        return NextResponse.json(
          { error: "Este barbero está inactivo" },
          { status: 400 }
        );
      }
    }

    const durationMinutes = Number(service?.durationMinutes || 0);
    const price = Number(service?.price || 0);
    const serviceName = String(service?.name || "").trim();

    if (!durationMinutes || durationMinutes < 5) {
      return NextResponse.json(
        { error: "El servicio no tiene una duración válida" },
        { status: 400 }
      );
    }

    if (!serviceName) {
      return NextResponse.json(
        { error: "El servicio no tiene un nombre válido" },
        { status: 400 }
      );
    }

    if (price < 0) {
      return NextResponse.json(
        { error: "El servicio tiene un precio inválido" },
        { status: 400 }
      );
    }

    // Si hay barbero asignado, validar que pueda realizar ese servicio
    if (hasBarberAssigned) {
      const serviceBarbers = Array.isArray(service?.barbers) ? service.barbers : [];

      const barberAllowed = serviceBarbers.some(
        (id) => id?.toString?.() === barber._id.toString()
      );

      if (!barberAllowed) {
        return NextResponse.json(
          { error: "Este barbero no tiene asignado ese servicio" },
          { status: 400 }
        );
      }
    }

    const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
    const excludedStatuses = ["cancelled", "no_assistance"];

    // Solo validar conflicto si hay barbero asignado
    if (hasBarberAssigned) {
      const conflict = await Appointment.findOne({
        barberId: barber._id,
        status: { $nin: excludedStatuses },
        startAt: { $lt: endAt },
        endAt: { $gt: startAt },
      })
        .select("_id startAt endAt durationMinutes status barberId serviceName")
        .lean();

      if (conflict) {
        return NextResponse.json(
          {
            error: "Ese horario ya está ocupado para este barbero",
            conflict: {
              id: conflict?._id?.toString?.() ?? conflict?._id,
              startAt: conflict?.startAt ?? null,
              endAt: conflict?.endAt ?? null,
              durationMinutes: conflict?.durationMinutes ?? 0,
              status: conflict?.status ?? "",
              barberId: conflict?.barberId?.toString?.() ?? conflict?.barberId,
              serviceName: conflict?.serviceName ?? "",
            },
          },
          { status: 409 }
        );
      }
    }

    const created = await Appointment.create({
      clientId: client._id,
      barberId: hasBarberAssigned ? barber._id : null,
      serviceId: service._id,
      serviceName,
      startAt,
      endAt,
      durationMinutes,
      price,
      status: "pending",
      paymentStatus: "unpaid",
      notes,
      createdBy: adminObjectId,
      source: "admin-panel",
      statusHistory: [
        {
          from: "",
          to: "pending",
          changedAt: new Date(),
          changedBy: adminObjectId,
          reason: "created",
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      appointment: {
        id: created?._id?.toString?.() ?? created?._id,

        clientId: client._id?.toString?.() ?? client._id,
        barberId: hasBarberAssigned
          ? barber?._id?.toString?.() ?? barber?._id
          : null,
        serviceId: service._id?.toString?.() ?? service._id,

        assignmentStatus: created?.assignmentStatus ?? "unassigned",

        client: {
          id: client._id?.toString?.() ?? client._id,
          firstName: client?.firstName ?? "",
          lastName: client?.lastName ?? "",
          name:
            `${client?.firstName || ""} ${client?.lastName || ""}`.trim() || "—",
          phone: client?.phone ?? "",
          email: client?.email ?? "",
        },

        barber: hasBarberAssigned
          ? {
            id: barber._id?.toString?.() ?? barber._id,
            name: barber?.name ?? "—",
            color: barber?.color || "#000000",
          }
          : null,

        service: {
          id: service._id?.toString?.() ?? service._id,
          name: serviceName,
          durationMinutes,
          price,
          color: service?.color || "#CFB690",
        },

        startAt,
        endAt,
        durationMinutes,
        price,
        status: "pending",
        paymentStatus: "unpaid",
        source: "admin-panel",
        notes,
        createdAt: created?.createdAt ?? null,
        updatedAt: created?.updatedAt ?? null,
      },
    });
  } catch (err) {
    console.error("POST /admin/schedule/create error:", err);

    return NextResponse.json(
      { error: err?.message || "Error creando cita" },
      { status: 500 }
    );
  }
}