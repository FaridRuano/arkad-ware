import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@libs/mongodb";

import Service from "@models/Service";
import Barber from "@models/Barber";
import BusinessSettings from "@models/BusinessSettings";
import BarberSchedule from "@models/BarberSchedule";
import { buildPackageBookingItems, parsePackageBarbers } from "@libs/booking/packages";

import {
    formatDateLocal,
    getDefaultBusinessSettings,
    getAvailableDatesForBarber,
    formatDateLabel,
    getAvailableDatesForPackage,
} from "@libs/booking/availability";

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

export async function GET(request) {
    try {
        await connectMongoDB();

        const { searchParams } = new URL(request.url);
        const serviceId = searchParams.get("serviceId");
        const barberId = searchParams.get("barberId");
        const packageBarbers = parsePackageBarbers(searchParams.get("packageBarbers"));

        if (!serviceId || !isValidObjectId(serviceId)) {
            return NextResponse.json(
                { error: "serviceId es obligatorio y debe ser válido" },
                { status: 400 }
            );
        }

        if (!barberId && packageBarbers.length === 0) {
            return NextResponse.json(
                { error: "barberId o packageBarbers es obligatorio" },
                { status: 400 }
            );
        }

        const [service, barber, businessSettings, barberSchedule] = await Promise.all([
            Service.findOne({ _id: serviceId, isActive: true })
                .select("serviceType name durationMinutes price barbers packageItems")
                .populate({
                    path: "packageItems.service",
                    select: "_id name durationMinutes price barbers isActive serviceType",
                })
                .lean(),
            barberId && isValidObjectId(barberId)
                ? Barber.findOne({ _id: barberId, isActive: true })
                .select("name color")
                .lean()
                : null,
            BusinessSettings.findOne({ isActive: true }).lean(),
            barberId && isValidObjectId(barberId)
                ? BarberSchedule.findOne({ barber: barberId, isActive: true }).lean()
                : null,
        ]);

        if (!service) {
            return NextResponse.json({ error: "Servicio no encontrado" }, { status: 404 });
        }

        const settings = businessSettings || getDefaultBusinessSettings();

        if (service.serviceType === "package") {
            const built = await buildPackageBookingItems({
                packageService: service,
                barberIds: packageBarbers,
            });

            if (built?.error) {
                return NextResponse.json({ error: built.error }, { status: 400 });
            }

            const maxDaysAhead = Number(settings.bookingMaxDaysAhead || 30);
            const availableDateStrings = await getAvailableDatesForPackage({
                items: built.items,
                businessSettings: settings,
            });

            return NextResponse.json(
                {
                    serviceId: String(service._id),
                    serviceName: service.name,
                    durationMinutes: Number(service.durationMinutes),
                    timezone: settings.timezone || "America/Guayaquil",
                    minNoticeMinutes: Number(settings.bookingMinNoticeMinutes || 0),
                    maxDaysAhead,
                    availableDates: availableDateStrings.map((dateStr) => ({
                        date: dateStr,
                        label: formatDateLabel(dateStr),
                        hasAvailability: true,
                    })),
                },
                { status: 200 }
            );
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

        const availableDateStrings = await getAvailableDatesForBarber({
            service,
            barberId,
            businessSettings: settings,
            barberSchedule,
        });

        const availableDates = availableDateStrings.map((dateStr) => ({
            date: dateStr,
            label: formatDateLabel(dateStr),
            hasAvailability: true,
        }));

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
        console.error("GET /api/client/schedule/dates error:", error);

        return NextResponse.json(
            { error: "No se pudieron obtener las fechas disponibles" },
            { status: 500 }
        );
    }
}
