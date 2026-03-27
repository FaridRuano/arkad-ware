import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import Service from "@models/Service";

export async function GET() {
    try {
        await connectMongoDB();

        const services = await Service.find({ isActive: true })
            .select("name description durationMinutes price color barbers")
            .populate({
                path: "barbers",
                select: "name color isActive",
            })
            .lean();

        const formattedServices = services
            .map((service) => {
                const activeBarbers = (service.barbers || [])
                    .filter((barber) => barber && barber.isActive)
                    .map((barber) => ({
                        id: barber._id.toString(),
                        name: barber.name,
                        color: barber.color || "#CFB690",
                    }));

                // 🚨 si no hay barberos activos → descartamos
                if (activeBarbers.length === 0) return null;

                return {
                    id: service._id.toString(),
                    name: service.name,
                    description: service.description || "",
                    durationMinutes: service.durationMinutes,
                    price: service.price,
                    color: service.color || "#CFB690",
                    barbers: activeBarbers,
                };
            })
            .filter(Boolean); // elimina nulls

        return NextResponse.json(formattedServices, { status: 200 });
    } catch (error) {
        console.error("GET /api/client/services error:", error);

        return NextResponse.json(
            { error: "No se pudieron obtener los servicios" },
            { status: 500 }
        );
    }
}