import { NextResponse } from "next/server";
import Appointment from "@models/Appointment";
import connectMongoDB from "@libs/mongodb";

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") || "").trim();
    const status = searchParams.get("status"); // "pending", etc
    const from = searchParams.get("from"); // yyyy-mm-dd
    const to = searchParams.get("to"); // yyyy-mm-dd
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = 12;

    const skip = (page - 1) * limit;

    // 1) Match base (solo campos de Appointment)
    const baseMatch = {};

    if (status && status !== "all") {
      baseMatch.status = status;
    }

    if (from || to) {
      baseMatch.startAt = {};

      if (from) {
        baseMatch.startAt.$gte = new Date(`${from}T00:00:00-05:00`);
      }

      if (to) {
        const end = new Date(`${to}T00:00:00-05:00`);
        end.setDate(end.getDate() + 1);
        baseMatch.startAt.$lt = end;
      }
    }

    // 2) Pipeline
    const pipeline = [
      { $match: baseMatch },

      // join con users (AJUSTA "users" si tu colección tiene otro nombre)
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
    ];

    // 3) Búsqueda SOLO por nombre/apellido (sobre campos del user ya "unwound")
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);

      pipeline.push({
        $match: {
          $and: terms.map((term) => ({
            $or: [
              { "user.firstName": { $regex: term, $options: "i" } },
              { "user.lastName": { $regex: term, $options: "i" } },
            ],
          })),
        },
      });
    }

    // 4) Total + docs paginados (mismo pipeline)
    const [countArr, docs] = await Promise.all([
      Appointment.aggregate([...pipeline, { $count: "count" }]),
      Appointment.aggregate([
        ...pipeline,
        { $sort: { startAt: -1 } },
        { $skip: skip },
        { $limit: limit },
      ]),
    ]);

    const total = countArr?.[0]?.count ?? 0;

    // 5) Normalizar para el frontend (name/phone/id)
    const appointments = (docs || []).map((a) => {
      const firstName = a?.user?.firstName || "";
      const lastName = a?.user?.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();

      return {
        ...a,
        id: a?._id?.toString?.() ?? a?._id,
        name: fullName || "—",
        phone: a?.user?.phone ?? "",
      };
    });

    return NextResponse.json({
      appointments,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error cargando citas" },
      { status: 500 }
    );
  }
}
