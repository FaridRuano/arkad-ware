import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";
import User from "@models/User";
import { auth } from "@auth";

function buildStartAt({ startAt, date, time }) {
  if (startAt && typeof startAt === "string") return startAt;

  if (date && time && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)) {
    return `${date}T${time}:00-05:00`;
  }

  return "";
}

function priceForDuration(durationMinutes) {
  if (Number(durationMinutes) >= 60) return 12;
  return 8;
}

export async function POST(req) {
  try {
    const session = await auth();

    const adminId = session?.user?.id;
    const role = session?.user?.role;

    if (!adminId) {
      return NextResponse.json({ error: true, message: "Unauthorized" }, { status: 401 });
    }

    // ✅ Fix: isAdmin() no definido → check directo
    if (role !== "admin") {
      return NextResponse.json({ error: true, message: "Forbidden" }, { status: 403 });
    }

    // ✅ Fix: cast seguro a ObjectId
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId)
      ? new mongoose.Types.ObjectId(adminId)
      : null;

    await connectMongoDB();

    const body = await req.json().catch(() => ({}));

    const userId = body?.userId;
    const durationMinutes = Number(body?.durationMinutes || 0);

    const startAtStr = buildStartAt({
      startAt: body?.startAt,
      date: body?.date,
      time: body?.time,
    });

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ error: "userId inválido" }, { status: 400 });
    }

    if (!startAtStr) {
      return NextResponse.json({ error: "Falta startAt o date+time válidos" }, { status: 400 });
    }

    if (![30, 60].includes(durationMinutes)) {
      return NextResponse.json({ error: "durationMinutes debe ser 30 o 60" }, { status: 400 });
    }

    const user = await User.findById(userId).select("_id firstName lastName phone role");
    if (!user) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const startAt = new Date(startAtStr);
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json({ error: "startAt inválido" }, { status: 400 });
    }

    const endAt = new Date(startAt);
    endAt.setMinutes(endAt.getMinutes() + durationMinutes);

    const excludedStatuses = ["cancelled", "no_assistance"];

    // ✅ Fix opcional: aseguramos startAt date type (evita 500 con data sucia)
    const conflict = await Appointment.findOne({
      status: { $nin: excludedStatuses },
      startAt: { $type: "date", $lt: endAt },
      $expr: {
        $gt: [
          { $add: ["$startAt", { $multiply: ["$durationMinutes", 60000] }] },
          startAt,
        ],
      },
    })
      .select("_id startAt durationMinutes status")
      .lean();

    if (conflict) {
      return NextResponse.json(
        {
          error: "Ese horario ya está ocupado",
          conflict: {
            id: conflict?._id?.toString?.() ?? conflict?._id,
            startAt: conflict?.startAt,
            durationMinutes: conflict?.durationMinutes,
            status: conflict?.status,
          },
        },
        { status: 409 }
      );
    }

    const price = Number(body?.price) > 0 ? Number(body.price) : priceForDuration(durationMinutes);

    const created = await Appointment.create({
      user: user._id,
      startAt,
      durationMinutes,
      price,
      status: "pending",
      paymentStatus: "unpaid",
      notes: (body?.notes || "").trim(),
      statusHistory: [
        {
          from: "",
          to: "pending",
          changedAt: new Date(),
          changedBy: adminObjectId, // ✅ admin real
          reason: "created",
        },
      ],
    });

    return NextResponse.json({
      ok: true,
      appointment: {
        ...created.toObject(),
        id: created?._id?.toString?.() ?? created?._id,
        userId: user._id?.toString?.() ?? user._id,
        name: `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "—",
        phone: user?.phone ?? "",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error creando cita" },
      { status: 500 }
    );
  }
}
