import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import Service from "@models/Service";
import Barber from "@models/Barber";
import BusinessSettings from "@models/BusinessSettings";

function toTitleCase(value = "") {
    return value
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

const cleanStr = (v) => String(v ?? "").trim();

const cleanPrice = (v) => {
    if (v === null || v === undefined || v === "") return NaN;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
};

const cleanDuration = (v) => {
    if (v === null || v === undefined || v === "") return NaN;
    const n = Number(v);
    return Number.isInteger(n) ? n : NaN;
};

const cleanBarbers = (value) => {
    if (!Array.isArray(value)) return [];

    const uniqueIds = [...new Set(value.map((id) => String(id ?? "").trim()).filter(Boolean))];

    return uniqueIds;
};

const cleanColor = (v) => {
    const s = cleanStr(v);
    return s || "#CFB690";
};

function escapeRegex(value = "") {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(req) {
    try {
        await connectMongoDB();

        const body = await req.json().catch(() => ({}));

        const nameRaw = cleanStr(body?.name);
        const description = cleanStr(body?.description);
        const durationMinutes = cleanDuration(body?.durationMinutes);
        const price = cleanPrice(body?.price);
        const barbers = cleanBarbers(body?.barbers);
        const color = cleanColor(body?.color);
        const isActive = body?.isActive !== false;
        const businessSettings = await BusinessSettings.findOne().select("slotIntervalMinutes");
        const slotIntervalMinutes = Number(businessSettings?.slotIntervalMinutes || 30);

        // Normalizar nombre
        const name = toTitleCase(nameRaw);

        /* =========================
           VALIDACIONES
           ========================= */
        if (!name) {
            return NextResponse.json(
                { error: "El nombre del servicio es requerido" },
                { status: 400 }
            );
        }

        if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
            return NextResponse.json(
                { error: "La duración debe ser un número entero de minutos mayor a 0" },
                { status: 400 }
            );
        }

        if (durationMinutes % slotIntervalMinutes !== 0) {
            return NextResponse.json(
                { error: `La duración debe ir en bloques de ${slotIntervalMinutes} minutos` },
                { status: 400 }
            );
        }

        if (durationMinutes > slotIntervalMinutes * 4) {
            return NextResponse.json(
                { error: `La duración no puede superar ${slotIntervalMinutes * 4} minutos` },
                { status: 400 }
            );
        }

        if (!Number.isFinite(price) || price < 0) {
            return NextResponse.json(
                { error: "El precio debe ser un número válido mayor o igual a 0" },
                { status: 400 }
            );
        }

        if (!/^#([0-9a-fA-F]{6})$/.test(color)) {
            return NextResponse.json(
                { error: "El color debe ser HEX (#RRGGBB)" },
                { status: 400 }
            );
        }

        // Validar ids de barberos si vienen
        const invalidBarberId = barbers.find((id) => !mongoose.Types.ObjectId.isValid(id));
        if (invalidBarberId) {
            return NextResponse.json(
                { error: "Uno o más barberos enviados no tienen un ID válido" },
                { status: 400 }
            );
        }

        if (barbers.length > 0) {
            const existingBarbers = await Barber.find({
                _id: { $in: barbers },
            }).select("_id");

            if (existingBarbers.length !== barbers.length) {
                return NextResponse.json(
                    { error: "Uno o más barberos seleccionados no existen" },
                    { status: 400 }
                );
            }
        }

        // Evitar duplicados por nombre exacto sin importar mayúsculas/minúsculas
        const existsName = await Service.findOne({
            name: {
                $regex: `^${escapeRegex(name)}$`,
                $options: "i",
            },
        }).select("_id name");

        if (existsName) {
            return NextResponse.json(
                { error: "Ya existe un servicio con ese nombre" },
                { status: 409 }
            );
        }

        const created = await Service.create({
            name,
            description,
            durationMinutes,
            price,
            color,
            barbers,
            isActive,
        });

        const populated = await Service.findById(created._id)
            .populate({
                path: "barbers",
                select: "_id name phone color isActive",
            })
            .select("-__v");

        const safe = populated.toObject();

        return NextResponse.json(
            {
                service: {
                    ...safe,
                    id: populated?._id?.toString?.() ?? populated?._id,
                    barbers: (safe?.barbers || []).map((barber) => ({
                        ...barber,
                        id: barber?._id?.toString?.() ?? barber?._id,
                    })),
                },
            },
            { status: 201 }
        );
    } catch (err) {
        if (err?.code === 11000) {
            const key = Object.keys(err?.keyPattern || {})?.[0] || "campo";
            const map = { name: "nombre" };

            return NextResponse.json(
                { error: `Ya existe un servicio con ese ${map[key] || key}` },
                { status: 409 }
            );
        }

        return NextResponse.json(
            { error: err?.message || "Error creando servicio" },
            { status: 500 }
        );
    }
}
