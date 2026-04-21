import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";
import Barber from "@models/Barber";
import Service from "@models/Service";
import User from "@models/User";
import { auth } from "@auth";
import {
    formatDateLocal,
    getScheduleExceptionsInRange,
    slotConflictsWithException,
} from "@libs/schedule/exceptions";

function toId(value) {
    return value?.toString?.() ?? value ?? null;
}

function getLocalMinutesFromUTCDate(date) {
    const safe = new Date(date);
    const hours = (safe.getUTCHours() + 19) % 24;
    return hours * 60 + safe.getUTCMinutes();
}

export async function PATCH(req, { params }) {
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

        const { id } = await params;
        const appointmentId = String(id || "").trim();

        if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
            return NextResponse.json(
                { error: "appointmentId inválido" },
                { status: 400 }
            );
        }

        await connectMongoDB();

        const body = await req.json().catch(() => ({}));
        const rawBarberId = String(body?.barberId || "").trim();

        if (!rawBarberId || !mongoose.Types.ObjectId.isValid(rawBarberId)) {
            return NextResponse.json(
                { error: "barberId inválido" },
                { status: 400 }
            );
        }

        const appointment = await Appointment.findById(appointmentId).select(
            "_id clientId barberId serviceId serviceName startAt endAt durationMinutes price status paymentStatus notes createdAt updatedAt cancelledAt completedAt paidAt cancelReason createdBy source statusHistory assignmentStatus barberAssignedAt"
        );

        if (!appointment) {
            return NextResponse.json(
                { error: "Cita no encontrada" },
                { status: 404 }
            );
        }

        const excludedStatuses = ["cancelled", "no_assistance"];

        if (excludedStatuses.includes(appointment.status)) {
            return NextResponse.json(
                { error: "No puedes asignar un barbero a una cita cancelada o no asistida" },
                { status: 400 }
            );
        }

        const [barber, service] = await Promise.all([
            Barber.findById(rawBarberId).select("_id name isActive color"),
            Service.findById(appointment.serviceId).select(
                "_id name durationMinutes price isActive barbers color"
            ),
        ]);

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

        if (!service) {
            return NextResponse.json(
                { error: "El servicio asociado a la cita no fue encontrado" },
                { status: 404 }
            );
        }

        if (service.isActive === false) {
            return NextResponse.json(
                { error: "El servicio asociado a la cita está inactivo" },
                { status: 400 }
            );
        }

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

        const appointmentDate = formatDateLocal(appointment.startAt);
        const activeExceptions = await getScheduleExceptionsInRange({
            startDate: appointmentDate,
            endDate: appointmentDate,
            barberId: rawBarberId,
            activeOnly: true,
        });

        if (
            slotConflictsWithException({
                exceptions: activeExceptions,
                dateStr: appointmentDate,
                startMinutes: getLocalMinutesFromUTCDate(appointment.startAt),
                endMinutes: getLocalMinutesFromUTCDate(appointment.endAt),
                barberId: rawBarberId,
            })
        ) {
            return NextResponse.json(
                { error: "Ese horario está bloqueado por una excepción activa" },
                { status: 409 }
            );
        }

        const conflict = await Appointment.findOne({
            _id: { $ne: appointment._id },
            barberId: barber._id,
            status: { $nin: excludedStatuses },
            startAt: { $lt: appointment.endAt },
            endAt: { $gt: appointment.startAt },
        })
            .select("_id startAt endAt durationMinutes status barberId serviceName")
            .lean();

        if (conflict) {
            return NextResponse.json(
                {
                    error: "Ese horario ya está ocupado para este barbero",
                    conflict: {
                        id: toId(conflict?._id),
                        startAt: conflict?.startAt ?? null,
                        endAt: conflict?.endAt ?? null,
                        durationMinutes: conflict?.durationMinutes ?? 0,
                        status: conflict?.status ?? "",
                        barberId: toId(conflict?.barberId),
                        serviceName: conflict?.serviceName ?? "",
                    },
                },
                { status: 409 }
            );
        }

        appointment.barberId = barber._id;
        appointment.assignmentStatus = "assigned";

        if (!appointment.barberAssignedAt) {
            appointment.barberAssignedAt = new Date();
        }

        await appointment.save();

        const [client, creator] = await Promise.all([
            appointment.clientId
                ? User.findById(appointment.clientId).select(
                    "_id firstName lastName phone email"
                )
                : null,
            appointment.createdBy
                ? User.findById(appointment.createdBy).select(
                    "_id firstName lastName email role"
                )
                : null,
        ]);

        const clientName =
            `${client?.firstName || ""} ${client?.lastName || ""}`.trim() || "—";

        const creatorName =
            `${creator?.firstName || ""} ${creator?.lastName || ""}`.trim() || "—";

        return NextResponse.json({
            ok: true,
            appointment: {
                id: toId(appointment._id),

                clientId: toId(appointment.clientId),
                barberId: toId(barber._id),
                serviceId: toId(appointment.serviceId),

                assignmentStatus: appointment.assignmentStatus || "assigned",
                barberAssignedAt: appointment.barberAssignedAt ?? null,

                client: client
                    ? {
                        id: toId(client._id),
                        firstName: client?.firstName ?? "",
                        lastName: client?.lastName ?? "",
                        name: clientName,
                        phone: client?.phone ?? "",
                        email: client?.email ?? "",
                    }
                    : null,

                barber: {
                    id: toId(barber._id),
                    name: barber?.name ?? "—",
                    color: barber?.color || "#000000",
                },

                createdBy: creator
                    ? {
                        id: toId(creator._id),
                        firstName: creator?.firstName ?? "",
                        lastName: creator?.lastName ?? "",
                        name: creatorName,
                        email: creator?.email ?? "",
                        role: creator?.role ?? "",
                    }
                    : null,

                serviceName: appointment?.serviceName ?? service?.name ?? "",
                startAt: appointment?.startAt ?? null,
                endAt: appointment?.endAt ?? null,
                durationMinutes: appointment?.durationMinutes ?? 0,
                price: appointment?.price ?? 0,

                status: appointment?.status ?? "pending",
                paymentStatus: appointment?.paymentStatus ?? "unpaid",
                source: appointment?.source ?? "admin-panel",

                notes: appointment?.notes ?? "",
                statusHistory: Array.isArray(appointment?.statusHistory)
                    ? appointment.statusHistory
                    : [],

                cancelledAt: appointment?.cancelledAt ?? null,
                cancelReason: appointment?.cancelReason ?? "",
                completedAt: appointment?.completedAt ?? null,
                paidAt: appointment?.paidAt ?? null,

                createdAt: appointment?.createdAt ?? null,
                updatedAt: appointment?.updatedAt ?? null,
            },
        });
    } catch (err) {
        console.error("PATCH /admin/schedule/appointments/assign-barber/[id] error:", err);

        return NextResponse.json(
            { error: err?.message || "Error asignando barbero" },
            { status: 500 }
        );
    }
}
