import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const date = (searchParams.get("date") || "").trim(); // YYYY-MM-DD

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Parámetro 'date' inválido. Usa YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Rango del día en -05:00 (Ecuador)
    const start = new Date(`${date}T00:00:00-05:00`);
    const end = new Date(`${date}T00:00:00-05:00`);
    end.setDate(end.getDate() + 1);

    const pipeline = [
      {
        $match: {
          startAt: { $gte: start, $lt: end },
        },
      },

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
      };
    });

    // ✅ Meta
    const meta = {
      total: 0,          // ✅ ahora será total operativo
      pending: 0,
      confirmed: 0,
      inProgress: 0,
      completed: 0,

      // incidencias (no cuentan para total/billing)
      cancelled: 0,
      noAssistance: 0,

      // billing operativo
      unpaid: 0,
      paid: 0,
    };

    for (const a of appointments) {
      const st = a?.status || "pending";

      // ✅ incidencias: se cuentan pero NO entran al total ni al billing
      if (st === "cancelled") {
        meta.cancelled++;
        continue;
      }
      if (st === "no_assistance") {
        meta.noAssistance++;
        continue;
      }

      // ✅ solo estados operativos suman al total
      meta.total++;

      // ✅ conteo de estados operativos (ajusta a tus nuevos slugs)
      if (st === "pending") meta.pending++;
      else if (st === "confirmed") meta.confirmed++;
      else if (st === "in_progress") meta.inProgress++;
      else if (st === "completed") meta.completed++;

      // ✅ billing: solo para operativos
      const pay = a?.paymentStatus || "unpaid";
      if (pay === "paid") meta.paid++;
      else meta.unpaid++;
    }

    return NextResponse.json({
      date,
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
