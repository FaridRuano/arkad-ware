import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@auth";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";

const ALLOWED_TARGET_STATUSES = ["cancelled", "no_assistance"];

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export async function PATCH(request, { params }) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Debes iniciar sesión" },
                { status: 401 }
            );
        }

        const { id } = await params;

        if (!id || !isValidObjectId(id)) {
            return NextResponse.json(
                { error: "El id de la cita no es válido" },
                { status: 400 }
            );
        }

        const body = await request.json().catch(() => ({}));
        const nextStatus = String(body?.status || "").trim();

        if (!ALLOWED_TARGET_STATUSES.includes(nextStatus)) {
            return NextResponse.json(
                { error: "El estado solicitado no es válido" },
                { status: 400 }
            );
        }

        await connectMongoDB();

        const appointment = await Appointment.findOne({
            _id: id,
            clientId: session.user.id,
        });

        if (!appointment) {
            return NextResponse.json(
                { error: "La cita no existe o no pertenece al usuario" },
                { status: 404 }
            );
        }

        if (!["pending", "confirmed"].includes(appointment.status)) {
            return NextResponse.json(
                { error: "Esta cita ya no puede modificarse" },
                { status: 400 }
            );
        }

        const now = Date.now();
        const appointmentStart = new Date(appointment.startAt).getTime();

        if (Number.isNaN(appointmentStart)) {
            return NextResponse.json(
                { error: "La fecha de la cita no es válida" },
                { status: 400 }
            );
        }

        if (appointmentStart <= now) {
            return NextResponse.json(
                { error: "No puedes modificar una cita que ya inició o ya pasó" },
                { status: 400 }
            );
        }

        const diffMs = appointmentStart - now;
        const canCancel = diffMs > TWO_HOURS_MS;

        if (canCancel && nextStatus !== "cancelled") {
            return NextResponse.json(
                {
                    error:
                        "Esta cita todavía puede cancelarse. Usa la acción de cancelar.",
                },
                { status: 400 }
            );
        }

        if (!canCancel && nextStatus !== "no_assistance") {
            return NextResponse.json(
                {
                    error:
                        "Faltan menos de 2 horas para la cita. Solo puedes marcar que no asistirás.",
                },
                { status: 400 }
            );
        }

        const previousStatus = appointment.status;
        appointment.status = nextStatus;

        if (nextStatus === "cancelled") {
            appointment.cancelledAt = new Date();
            appointment.cancelReason = "client_cancelled";
        }

        appointment.statusHistory = [
            ...(appointment.statusHistory || []),
            {
                from: previousStatus,
                to: nextStatus,
                changedAt: new Date(),
                changedBy: session.user.id,
                reason:
                    nextStatus === "cancelled"
                        ? "client_cancelled"
                        : "client_no_assistance",
            },
        ];

        await appointment.save();

        return NextResponse.json(
            {
                ok: true,
                appointment: {
                    id: String(appointment._id),
                    status: appointment.status,
                    cancelledAt: appointment.cancelledAt,
                    cancelReason: appointment.cancelReason,
                },
                message:
                    nextStatus === "cancelled"
                        ? "La cita fue cancelada correctamente"
                        : "La cita fue marcada como no asistencia",
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("PATCH /api/client/appointments/[id]/status error:", error);

        return NextResponse.json(
            { error: "No se pudo actualizar la cita" },
            { status: 500 }
        );
    }
}