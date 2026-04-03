import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@auth";

import connectMongoDB from "@libs/mongodb";
import Service from "@models/Service";
import Barber from "@models/Barber";
import Appointment from "@models/Appointment";
import BusinessSettings from "@models/BusinessSettings";
import BarberSchedule from "@models/BarberSchedule";

import {
    isValidDateString,
    isValidTimeHHMM,
    parseDateLocal,
    getAvailabilityForDate,
    getDefaultBusinessSettings,
} from "@libs/booking/availability";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export async function POST(request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Debes iniciar sesión para reservar" },
                { status: 401 }
            );
        }

        await connectMongoDB();

        const body = await request.json().catch(() => ({}));
        const serviceId = body?.serviceId;
        const barberId = body?.barberId;
        const date = body?.date;
        const time = body?.time;

        if (!serviceId || !isValidObjectId(serviceId)) {
            return NextResponse.json(
                { error: "serviceId es obligatorio y debe ser válido" },
                { status: 400 }
            );
        }

        if (!barberId || !isValidObjectId(barberId)) {
            return NextResponse.json(
                { error: "barberId es obligatorio y debe ser válido" },
                { status: 400 }
            );
        }

        if (!date || !isValidDateString(date)) {
            return NextResponse.json(
                { error: "date es obligatorio y debe tener formato YYYY-MM-DD" },
                { status: 400 }
            );
        }

        if (!time || !isValidTimeHHMM(time)) {
            return NextResponse.json(
                { error: "time es obligatorio y debe tener formato HH:MM" },
                { status: 400 }
            );
        }

        const [service, barber, businessSettings, barberSchedule] = await Promise.all([
            Service.findOne({ _id: serviceId, isActive: true })
                .select("name durationMinutes price barbers")
                .lean(),
            Barber.findOne({ _id: barberId, isActive: true })
                .select("name color")
                .lean(),
            BusinessSettings.findOne({ isActive: true }).lean(),
            BarberSchedule.findOne({ barber: barberId, isActive: true }).lean(),
        ]);

        if (!service) {
            return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
        }

        if (!barber) {
            return NextResponse.json({ error: "Barbero no encontrado" }, { status: 404 });
        }

        const barberCanPerformService = Array.isArray(service.barbers)
            ? service.barbers.some((id) => String(id) === String(barberId))
            : false;

        if (!barberCanPerformService) {
            return NextResponse.json(
                { error: "El barbero no está disponible para este servicio" },
                { status: 400 }
            );
        }

        const settings = businessSettings || getDefaultBusinessSettings();

        const targetDate = parseDateLocal(date);
        const today = new Date();
        const startToday = new Date(
            today.getFullYear(),
            today.getMonth(),
            today.getDate(),
            0,
            0,
            0,
            0
        );

        const lastAllowedDate = new Date(startToday);
        lastAllowedDate.setDate(
            lastAllowedDate.getDate() + Number(settings.bookingMaxDaysAhead || 30) - 1
        );
        lastAllowedDate.setHours(23, 59, 59, 999);

        if (targetDate < startToday) {
            return NextResponse.json(
                { error: "No puedes reservar en una fecha pasada" },
                { status: 400 }
            );
        }

        if (targetDate > lastAllowedDate) {
            return NextResponse.json(
                { error: "La fecha está fuera del rango permitido para reservar" },
                { status: 400 }
            );
        }

        const availableSlots = await getAvailabilityForDate({
            service,
            barberId,
            dateStr: date,
            businessSettings: settings,
            barberSchedule,
        });

        const matchedSlot = availableSlots.find((slot) => slot.start === time);

        if (!matchedSlot) {
            return NextResponse.json(
                {
                    error:
                        "Ese horario ya no está disponible. Actualiza la disponibilidad e intenta nuevamente.",
                },
                { status: 409 }
            );
        }

        const clientId = session.user.id;

        const activeClientAppointmentsCount = await Appointment.countDocuments({
            clientId,
            status: { $in: ["pending", "confirmed"] },
            startAt: { $gte: new Date() },
        });

        if (activeClientAppointmentsCount >= 2) {
            return NextResponse.json(
                { error: "Ya tienes el máximo permitido de citas activas por confirmar." },
                { status: 400 }
            );
        }

        const appointment = await Appointment.create({
            clientId,
            barberId,
            serviceId,
            serviceName: service.name,
            startAt: matchedSlot.startAt,
            durationMinutes: Number(service.durationMinutes),
            price: Number(service.price || 0),
            paymentStatus: "unpaid",
            status: "pending",
            source: "client-page",
            createdBy: clientId,
            notes: "",
        });

        return NextResponse.json(
            {
                ok: true,
                appointment: {
                    id: String(appointment._id),
                    serviceName: appointment.serviceName,
                    startAt: appointment.startAt,
                    endAt: appointment.endAt,
                    durationMinutes: appointment.durationMinutes,
                    price: appointment.price,
                    status: appointment.status,
                    paymentStatus: appointment.paymentStatus,
                },
                message: "Reserva creada correctamente",
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/client/appointment error:", error);

        return NextResponse.json(
            { error: "No se pudo crear la reserva" },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Debes iniciar sesión" },
                { status: 401 }
            );
        }

        await connectMongoDB();

        const appointments = await Appointment.find({
            clientId: session.user.id,
            status: { $in: ["pending", "confirmed"] },
            startAt: { $gte: new Date() },
        })
            .populate({
                path: "barberId",
                select: "name color",
            })
            .sort({ startAt: 1 })
            .select("serviceName startAt endAt price status barberId")
            .lean();

        const formattedAppointments = appointments.map((appointment) => ({
            id: String(appointment._id),
            serviceName: appointment.serviceName || "",
            startAt: appointment.startAt,
            endAt: appointment.endAt,
            price: Number(appointment.price || 0),
            status: appointment.status,
            barberName: appointment.barberId?.name || "",
            barberColor: appointment.barberId?.color || null,
        }));

        return NextResponse.json(
            { appointments: formattedAppointments },
            { status: 200 }
        );
    } catch (error) {
        console.error("GET /api/client/appointments error:", error);

        return NextResponse.json(
            { error: "No se pudieron obtener las citas del usuario" },
            { status: 500 }
        );
    }
}