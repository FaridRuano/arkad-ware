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

const cleanColor = (v) => {
    const s = cleanStr(v);
    return s || "#CFB690";
};

const cleanBarbers = (value) => {
    if (!Array.isArray(value)) return [];

    return [...new Set(value.map((id) => String(id ?? "").trim()).filter(Boolean))];
};

function escapeRegex(str = "") {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ───────────────────────────────────────────────────────────────
   PATCH /api/admin/services/:id  -> editar servicio
─────────────────────────────────────────────────────────────── */
export async function PATCH(req, { params }) {
    try {
        await connectMongoDB();

        const id = params?.id;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: "ID inválido" }, { status: 400 });
        }

        const body = await req.json().catch(() => ({}));
        const businessSettings = await BusinessSettings.findOne().select("slotIntervalMinutes");
        const slotIntervalMinutes = Number(businessSettings?.slotIntervalMinutes || 30);

        const nameRaw = body?.name;
        const descriptionRaw = body?.description;
        const durationRaw = body?.durationMinutes;
        const priceRaw = body?.price;
        const colorRaw = body?.color;
        const barbersRaw = body?.barbers;
        const isActiveRaw = body?.isActive;

        const current = await Service.findById(id).select("_id name");
        if (!current) {
            return NextResponse.json(
                { error: "Servicio no encontrado" },
                { status: 404 }
            );
        }

        const update = {};

        // name
        if (nameRaw !== undefined) {
            const name = toTitleCase(cleanStr(nameRaw));

            if (!name) {
                return NextResponse.json(
                    { error: "El nombre del servicio es requerido" },
                    { status: 400 }
                );
            }

            const existsName = await Service.findOne({
                _id: { $ne: id },
                name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
            }).select("_id name");

            if (existsName) {
                return NextResponse.json(
                    { error: "Ya existe un servicio con ese nombre" },
                    { status: 409 }
                );
            }

            update.name = name;
        }

        // description
        if (descriptionRaw !== undefined) {
            update.description = cleanStr(descriptionRaw);
        }

        // durationMinutes
        if (durationRaw !== undefined) {
            const durationMinutes = cleanDuration(durationRaw);

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

            update.durationMinutes = durationMinutes;
        }

        // price
        if (priceRaw !== undefined) {
            const price = cleanPrice(priceRaw);

            if (!Number.isFinite(price) || price < 0) {
                return NextResponse.json(
                    { error: "El precio debe ser un número válido mayor o igual a 0" },
                    { status: 400 }
                );
            }

            update.price = price;
        }

        // color
        if (colorRaw !== undefined) {
            const color = cleanColor(colorRaw);

            if (!/^#([0-9a-fA-F]{6})$/.test(color)) {
                return NextResponse.json(
                    { error: "El color debe ser HEX (#RRGGBB)" },
                    { status: 400 }
                );
            }

            update.color = color;
        }

        // isActive
        if (isActiveRaw !== undefined) {
            update.isActive = Boolean(isActiveRaw);
        }

        // barbers
        if (barbersRaw !== undefined) {
            const barbers = cleanBarbers(barbersRaw);

            const invalidBarberId = barbers.find(
                (barberId) => !mongoose.Types.ObjectId.isValid(barberId)
            );

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

            update.barbers = barbers;
        }

        if (Object.keys(update).length === 0) {
            return NextResponse.json(
                { error: "No hay campos para actualizar" },
                { status: 400 }
            );
        }

        const updated = await Service.findByIdAndUpdate(id, update, {
            new: true,
            runValidators: true,
        })
            .populate({
                path: "barbers",
                select: "_id name phone color isActive",
            })
            .select("-__v");

        return NextResponse.json({
            service: {
                ...updated.toObject(),
                id: updated?._id?.toString?.() ?? updated?._id,
                barbers: (updated?.barbers || []).map((barber) => ({
                    ...barber.toObject(),
                    id: barber?._id?.toString?.() ?? barber?._id,
                })),
            },
        });
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
            { error: err?.message || "Error actualizando servicio" },
            { status: 500 }
        );
    }
}

/* ───────────────────────────────────────────────────────────────
   DELETE /api/admin/services/:id
   - por defecto toggle activo/inactivo
   - opcional: ?action=activate | deactivate
   - opcional: ?hard=true para borrar real
─────────────────────────────────────────────────────────────── */
export async function DELETE(req, { params }) {
    try {
        await connectMongoDB();

        const {id} = await params;


        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return NextResponse.json({ error: "ID inválido" }, { status: 400 });
        }

        const { searchParams } = new URL(req.url);
        const hard = searchParams.get("hard") === "true";
        const action = searchParams.get("action"); // activate | deactivate

        const service = await Service.findById(id).select("_id name isActive");
        if (!service) {
            return NextResponse.json(
                { error: "Servicio no encontrado" },
                { status: 404 }
            );
        }

        if (hard) {
            await Service.deleteOne({ _id: id });

            return NextResponse.json({
                ok: true,
                deleted: true,
                action: "deleted",
            });
        }

        if (action === "activate") {
            service.isActive = true;
        } else if (action === "deactivate") {
            service.isActive = false;
        } else {
            service.isActive = !service.isActive;
        }

        await service.save();

        return NextResponse.json({
            ok: true,
            isActive: service.isActive,
            action: service.isActive ? "activated" : "deactivated",
        });
    } catch (err) {
        return NextResponse.json(
            { error: err?.message || "Error actualizando estado del servicio" },
            { status: 500 }
        );
    }
}
