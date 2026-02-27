import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";
import mongoose from "mongoose";

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);

    const date = (searchParams.get("date") || "").trim(); // YYYY-MM-DD
    const barberId = (searchParams.get("barberId") || "").trim(); // optional

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Parámetro 'date' inválido. Usa YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // ✅ Validación barberId si viene
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

    // Rango del día en -05:00 (Ecuador)
    const start = new Date(`${date}T00:00:00-05:00`);
    const end = new Date(`${date}T00:00:00-05:00`);
    end.setDate(end.getDate() + 1);

    // ✅ Match base con barberId opcional
    const match = {
      startAt: { $gte: start, $lt: end },
      ...(barberObjectId ? { barberId: barberObjectId } : {}),
    };

    const pipeline = [
      { $match: match },

      // join con users
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },

      // ✅ join con barbers (opcional, pero útil)
      {
        $lookup: {
          from: "barbers",
          localField: "barberId",
          foreignField: "_id",
          as: "barber",
        },
      },
      // preserveNullAndEmptyArrays: true para citas antiguas sin barberId
      {
        $unwind: {
          path: "$barber",
          preserveNullAndEmptyArrays: true,
        },
      },

      // ordenar por hora
      { $sort: { startAt: 1 } },

      // proyectar solo lo necesario
      {
        $project: {
          _id: 1,

          user: {
            _id: "$user._id",
            firstName: "$user.firstName",
            lastName: "$user.lastName",
            phone: "$user.phone",
          },

          // ✅ barber info ligera
          barber: {
            _id: "$barber._id",
            name: "$barber.name",
            color: "$barber.color",
          },

          barberId: 1,
          startAt: 1,
          durationMinutes: 1,
          price: 1,
          status: 1,
          paymentStatus: 1,
          notes: 1,
          statusHistory: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ];

    const docs = await Appointment.aggregate(pipeline);

    const appointments = (docs || []).map((a) => {
      const firstName = a?.user?.firstName || "";
      const lastName = a?.user?.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();

      return {
        ...a,
        id: a?._id?.toString?.() ?? a?._id,

        userId: a?.user?._id?.toString?.() ?? a?.user?._id,
        name: fullName || "—",
        phone: a?.user?.phone ?? "",

        // ✅ normalizar barberId y barber
        barberId: a?.barberId?.toString?.() ?? a?.barberId ?? null,
        barber: a?.barber?._id
          ? {
              id: a?.barber?._id?.toString?.() ?? a?.barber?._id,
              name: a?.barber?.name ?? "—",
              color: a?.barber?.color || "#000000",
            }
          : null,
      };
    });

    // ✅ Meta (igual que tu lógica)
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
    return NextResponse.json(
      { error: err?.message || "Error cargando agenda" },
      { status: 500 }
    );
  }
}