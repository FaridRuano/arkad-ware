import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";

function isValidDateString(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
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

    const meta = {
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
        meta.cancelled++;
        continue;
      }

      if (st === "no_assistance") {
        meta.noAssistance++;
        continue;
      }

      meta.total++;

      if (st === "pending") meta.pending++;
      else if (st === "confirmed") meta.confirmed++;
      else if (st === "in_progress") meta.inProgress++;
      else if (st === "completed") meta.completed++;

      const pay = a?.paymentStatus || "unpaid";
      if (pay === "paid") meta.paid++;
      else meta.unpaid++;
    }

    return NextResponse.json({
      date,
      barberId: barberId || null,
      startAtRange: { start, end },
      appointments,
      meta,
    });
  } catch (err) {
    console.error("GET /admin/schedule error:", err);

    return NextResponse.json(
      { error: err?.message || "Error cargando agenda" },
      { status: 500 }
    );
  }
}