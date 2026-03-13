import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Appointment from "@models/Appointment";
import connectMongoDB from "@libs/mongodb";
import { auth } from "@auth";

export async function PATCH(req, { params }) {
  try {
    const session = await auth();

    const userId = session?.user?.id;
    const role = session?.user?.role;

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    await connectMongoDB();

    const { id } = params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "ID de cita inválido" },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));

    let paymentStatus = null;

    if (typeof body?.paymentStatus === "string") {
      paymentStatus = body.paymentStatus.trim();
    } else if (body?.paid != null) {
      paymentStatus = body.paid ? "paid" : "unpaid";
    }

    if (!paymentStatus) {
      return NextResponse.json(
        { error: "paymentStatus es requerido" },
        { status: 400 }
      );
    }

    const allowed = new Set(["paid", "unpaid"]);

    if (!allowed.has(paymentStatus)) {
      return NextResponse.json(
        { error: 'paymentStatus debe ser "paid" o "unpaid"' },
        { status: 400 }
      );
    }

    const current = await Appointment.findById(id)
      .select("_id paymentStatus paidAt")
      .lean();

    if (!current) {
      return NextResponse.json(
        { error: "Cita no encontrada" },
        { status: 404 }
      );
    }

    const update = {
      paymentStatus,
      paidAt: paymentStatus === "paid" ? new Date() : null,
    };

    const updated = await Appointment.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean();

    return NextResponse.json({
      ok: true,
      appointment: {
        id: updated?._id?.toString?.() ?? updated?._id,
        paymentStatus: updated?.paymentStatus ?? "unpaid",
        paidAt: updated?.paidAt ?? null,
      },
    });
  } catch (err) {
    console.error("PATCH /admin/schedule/appointments/billing/[id] error:", err);

    return NextResponse.json(
      { error: err?.message || "Error actualizando billing" },
      { status: 500 }
    );
  }
}