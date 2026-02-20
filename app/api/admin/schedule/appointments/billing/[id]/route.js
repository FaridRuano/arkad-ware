import { NextResponse } from "next/server";
import Appointment from "@models/Appointment";
import connectMongoDB from "@libs/mongodb";

export async function PATCH(req, { params }) {
  try {
    await connectMongoDB();

    const { id } = params;
    const body = await req.json();

    // Whitelist: solo paymentStatus (billing)
    const update = {};

    // Puedes permitir toggle explícito: 'paid' | 'unpaid'
    if (body.paymentStatus) update.paymentStatus = body.paymentStatus;

    // (Opcional) también soportar booleano "paid: true/false"
    if (body.paid != null) update.paymentStatus = body.paid ? "paid" : "unpaid";

    // Validación
    if (!update.paymentStatus) {
      return NextResponse.json(
        { error: "paymentStatus es requerido" },
        { status: 400 }
      );
    }

    const allowed = new Set(["paid", "unpaid"]);
    if (!allowed.has(update.paymentStatus)) {
      return NextResponse.json(
        { error: 'paymentStatus debe ser "paid" o "unpaid"' },
        { status: 400 }
      );
    }

    const doc = await Appointment.findByIdAndUpdate(id, update, { new: true }).lean();

    if (!doc) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      appointment: {
        _id: doc._id,
        paymentStatus: doc.paymentStatus,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error actualizando billing" },
      { status: 500 }
    );
  }
}