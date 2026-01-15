import { NextResponse } from "next/server";
import { auth } from "@auth";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";
import User from "@models/User";

function isAdmin(session) {
    return session?.user?.role === "admin" || session?.user?.isAdmin === true;
}

export async function PATCH(req) {
    try {
        // 1) auth
        const session = await auth();
        const adminId = session?.user?.id;

        if (!adminId) {
            return NextResponse.json(
                { error: true, message: "Unauthorized" },
                { status: 401 }
            );
        }

        if (!isAdmin(session)) {
            return NextResponse.json(
                { error: true, message: "Forbidden" },
                { status: 403 }
            );
        }

        // 2) body
        const body = await req.json().catch(() => null);
        const id = body?.id;
        const methodRaw = body?.method;

        if (!id) {
            return NextResponse.json(
                { error: true, message: "Appointment id is required" },
                { status: 400 }
            );
        }

        const paymentMethod =
            typeof methodRaw === "string" ? methodRaw.trim().slice(0, 50) : "unknown";

        await connectMongoDB();

        // 3) validar cita
        const existing = await Appointment.findById(id)
            .select("_id paymentStatus status")
            .lean();

        if (!existing) {
            return NextResponse.json(
                { error: true, message: "Cita no encontrada" },
                { status: 404 }
            );
        }

        if (existing.paymentStatus === "paid") {
            return NextResponse.json(
                { error: true, message: "La cita ya está pagada" },
                { status: 409 }
            );
        }

        // 4) update atómico
        const updated = await Appointment.findOneAndUpdate(
            { _id: id, paymentStatus: "unpaid" },
            {
                $set: { paymentStatus: "paid" },
                $push: {
                    statusHistory: {
                        from: existing.status,
                        to: existing.status, // el estado no cambia
                        changedAt: new Date(),
                        changedBy: adminId,
                        reason: `payment_${paymentMethod}`,
                    },
                },
            },
            { new: true }
        )
            .populate("user", "firstName lastName phone")
            .select("user paymentStatus price statusHistory updatedAt")
            .lean();

        if (!updated) {
            return NextResponse.json(
                { error: true, message: "No se pudo registrar el pago" },
                { status: 409 }
            );
        }

        const first = (updated?.user?.firstName || "").trim();
        const last = (updated?.user?.lastName || "").trim();
        const name = `${first} ${last}`.trim() || "Sin nombre";

        return NextResponse.json(
            {
                ok: true,
                appointment: {
                    id: updated._id.toString(),
                    name,
                    phone: updated?.user?.phone ?? "",
                    paymentStatus: updated.paymentStatus,
                    price: updated.price,
                    updatedAt: updated.updatedAt,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Admin payment error:", error);
        return NextResponse.json(
            { error: true, message: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
