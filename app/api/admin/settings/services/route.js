import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import Service from "@models/Service";

export async function GET(req) {
    try {
        await connectMongoDB();

        const { searchParams } = new URL(req.url);

        const q = (searchParams.get("q") || "").trim();
        const page = Math.max(1, Number(searchParams.get("page") || 1));
        const limit = Math.max(1, Number(searchParams.get("limit") || 12));
        const includeInactive = searchParams.get("includeInactive") === "true";

        const skip = (page - 1) * limit;

        // 1) Match base
        const match = includeInactive ? {} : { isActive: true };

        // 2) Búsqueda por nombre
        if (q) {
            const terms = q.split(/\s+/).filter(Boolean);

            match.$and = terms.map((term) => ({
                $or: [
                    { name: { $regex: term, $options: "i" } },
                    { description: { $regex: term, $options: "i" } },
                ],
            }));
        }

        // 3) Total + docs
        const [total, docs] = await Promise.all([
            Service.countDocuments(match),
            Service.find(match)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate({
                    path: "barbers",
                    select: "_id name phone color isActive",
                })
                .select("-__v"),
        ]);

        // 4) Normalizar para frontend
        const services = (docs || []).map((service) => ({
            ...service.toObject(),
            id: service?._id?.toString?.() ?? service?._id,
            barbers: (service?.barbers || []).map((barber) => ({
                ...barber.toObject(),
                id: barber?._id?.toString?.() ?? barber?._id,
            })),
        }));

        return NextResponse.json({
            services,
            total,
            page,
            limit,
            totalPages: Math.max(1, Math.ceil(total / limit)),
        });
    } catch (err) {
        return NextResponse.json(
            { error: err?.message || "Error cargando servicios" },
            { status: 500 }
        );
    }
}