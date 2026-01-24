import { NextResponse } from "next/server";
import Appointment from "@models/Appointment";
import connectMongoDB from "@libs/mongodb";

export async function PATCH(req, { params }) {
    try {
        await connectMongoDB();

        const { id } = params;
        const body = await req.json();

        // Whitelist de campos editables
        const update = {};
        if (body.startAt) update.startAt = new Date(body.startAt);
        if (body.durationMinutes != null) update.durationMinutes = Number(body.durationMinutes);
        if (body.price != null) update.price = Number(body.price);
        if (body.status) update.status = body.status;

        const doc = await Appointment.findByIdAndUpdate(id, update, { new: true }).lean();

        if (!doc) {
            return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
        }

        return NextResponse.json({ ok: true, appointment: doc });
    } catch (err) {
        return NextResponse.json(
            { error: err?.message || "Error actualizando cita" },
            { status: 500 }
        );
    }
}

export async function DELETE(req, { params }) {
    try {
        await connectMongoDB();


        const { id } = params;

        const doc = await Appointment.findByIdAndDelete(id).lean();
        if (!doc) {
            return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (err) {
        return NextResponse.json(
            { error: err?.message || "Error eliminando cita" },
            { status: 500 }
        );
    }
}
