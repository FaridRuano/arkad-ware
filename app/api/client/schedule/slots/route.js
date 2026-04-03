import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@libs/mongodb";

import Service from "@models/Service";
import Barber from "@models/Barber";
import BusinessSettings from "@models/BusinessSettings";
import BarberSchedule from "@models/BarberSchedule";

import {
    isValidDateString,
    getAvailabilityForDate,
    getDefaultBusinessSettings,
} from "@libs/booking/availability";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

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

        if (!date || !isValidDateString(date)) {
            return NextResponse.json(
                { error: "date es obligatorio y debe tener formato YYYY-MM-DD" },
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
    } catch (error) {
        console.error("GET /api/client/schedule/slots error:", error);

        return NextResponse.json(
            { error: "No se pudo obtener la disponibilidad del día" },
            { status: 500 }
        );
    }
}