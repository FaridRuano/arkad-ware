import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import Service from "@models/Service";
import "@models/Barber";

const toSafeNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};

export async function GET() {
    try {
        await connectMongoDB();

        const services = await Service.find({ isActive: true })
            .sort({ name: 1 })
            .select("name description durationMinutes price color barbers")
            .populate({
                path: "barbers",
                select: "name color isActive",
            })
            .lean();

        const formattedServices = services
            .map((service) => {
                const activeBarbers = Array.isArray(service.barbers)
                    ? service.barbers
                        .filter((barber) => barber && barber.isActive)
                        .map((barber) => ({
                            id: String(barber._id),
                            name: String(barber.name || "").trim(),
                            color: barber.color || null,
                        }))
                        .filter((barber) => barber.name)
                    : [];

                if (activeBarbers.length === 0) return null;

                return {
                    id: String(service._id),
                    name: String(service.name || "").trim(),
                    description: String(service.description || "").trim(),
                    durationMinutes: toSafeNumber(service.durationMinutes, 0),
                    price: toSafeNumber(service.price, 0),
                    color: service.color || null,
                    barbers: activeBarbers,
                };
            })
            .filter(
                (service) =>
                    service &&
                    service.name &&
                    service.durationMinutes > 0
            );

        return NextResponse.json(formattedServices, { status: 200 });
    } catch (error) {
        console.error("GET /api/client/services error:", error);

        return NextResponse.json(
            { error: "No se pudieron obtener los servicios" },
            { status: 500 }
        );
    }
}