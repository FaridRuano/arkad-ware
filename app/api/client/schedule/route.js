import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@libs/mongodb";

import Service from "@models/Service";
import Barber from "@models/Barber";
import BusinessSettings from "@models/BusinessSettings";
import BarberSchedule from "@models/BarberSchedule";

import {
    parseDateLocal,
    formatDateLocal,
    getAvailabilityForDate,
    getDefaultBusinessSettings,
} from "@libs/booking/availability";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const isValidDateString = (value = "") => /^\d{4}-\d{2}-\d{2}$/.test(String(value));

const formatDateLabel = (dateStr) => {
    const date = parseDateLocal(dateStr);
    return `${DAY_LABELS[date.getDay()]} ${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`;
};

export async function GET(request) {
    try {
        await connectMongoDB();

        const { searchParams } = new URL(request.url);
        const serviceId = searchParams.get("serviceId");
        const barberId = searchParams.get("barberId");
        const date = searchParams.get("date");

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

        if (date && !isValidDateString(date)) {
            return NextResponse.json(
                { error: "date debe tener formato YYYY-MM-DD" },
                { status: 400 }
            );
        }

        const [service, barber, businessSettings, barberSchedule] = await Promise.all([
            Service.findOne({ _id: serviceId, isActive: true })
                .select("name durationMinutes price barbers")
                .lean(),
            Barber.findOne({ _id: barberId, isActive: true }).select("name color").lean(),
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

        if (date) {
            const slots = await getAvailabilityForDate({
                service,
                barberId,
                dateStr: date,
                businessSettings: settings,
                barberSchedule,
            });

            return NextResponse.json(
                {
                    barberId: String(barber._id),
                    barberName: barber.name,
                    serviceId: String(service._id),
                    serviceName: service.name,
                    date,
                    durationMinutes: Number(service.durationMinutes),
                    slotIntervalMinutes: Number(settings.slotIntervalMinutes || 30),
                    timezone: settings.timezone || "America/Guayaquil",
                    slots: slots.map((slot) => ({
                        start: slot.start,
                        end: slot.end,
                        startAt: slot.startAt.toISOString(),
                        endAt: slot.endAt.toISOString(),
                    })),
                },
                { status: 200 }
            );
        }

        const availableDates = [];
        const today = new Date();
        const maxDaysAhead = Number(settings.bookingMaxDaysAhead || 30);

        for (let offset = 0; offset < maxDaysAhead; offset++) {
            const current = new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate() + offset,
                0,
                0,
                0,
                0
            );

            const dateStr = formatDateLocal(current);

            const slots = await getAvailabilityForDate({
                service,
                barberId,
                dateStr,
                businessSettings: settings,
                barberSchedule,
            });

            if (slots.length > 0) {
                availableDates.push({
                    date: dateStr,
                    label: formatDateLabel(dateStr),
                    hasAvailability: true,
                });
            }
        }

        return NextResponse.json(
            {
                barberId: String(barber._id),
                barberName: barber.name,
                serviceId: String(service._id),
                serviceName: service.name,
                durationMinutes: Number(service.durationMinutes),
                timezone: settings.timezone || "America/Guayaquil",
                minNoticeMinutes: Number(settings.bookingMinNoticeMinutes || 0),
                maxDaysAhead: Number(settings.bookingMaxDaysAhead || 30),
                availableDates,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("GET /api/client/schedule error:", error);

        return NextResponse.json(
            { error: "No se pudo obtener la disponibilidad" },
            { status: 500 }
        );
    }
}