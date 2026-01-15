import { NextResponse } from "next/server";
import { auth } from "@auth";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";
import User from "@models/User";

function isAdmin(session) {
    return session?.user?.role === "admin" || session?.user?.isAdmin === true;
}

function normalizeAction(action) {
    if (typeof action !== "string") return "";
    return action.trim().toLowerCase();
}

function actionToTargetStatus(currentStatus, action, appointmentStartAt) {
    // Reglas del negocio
    if (action === "start") {
        if (currentStatus === "pending" || currentStatus === "confirmed") {
            return "in progress";
        }
        return null;
    }

    if (action === "complete") {
        if (currentStatus === "in progress") return "completed";
        return null;
    }

    if (action === "cancel") {
        const nonCancellable = ["cancelled", "completed", "no assistance"];
        if (!nonCancellable.includes(currentStatus)) return "cancelled";
        return null;
    }

    if (action === "no_assistance") {
        const closed = ["cancelled", "completed", "no assistance"];
        if (closed.includes(currentStatus)) return null;

        // ✅ Recomendado: solo marcar inasistencia si ya pasó la hora de inicio
        if (appointmentStartAt && new Date(appointmentStartAt).getTime() > Date.now()) {
            return null;
        }

        return "no assistance";
    }

    return null;
}

export async function PATCH(req) {
    try {
        const session = await auth();
        const adminId = session?.user?.id;

        if (!adminId) {
            return NextResponse.json(
                { error: true, message: "Unauthorized" },
                { status: 401 }
            );
        }

        if (!isAdmin(session)) {
            return NextResponse.json(
                { error: true, message: "Forbidden" },
                { status: 403 }
            );
        }

        const body = await req.json().catch(() => null);
        const id = body?.id;
        const action = normalizeAction(body?.action);
        const reasonRaw = body?.reason;

        if (!id || !action) {
            return NextResponse.json(
                { error: true, message: "id y action son requeridos" },
                { status: 400 }
            );
        }

        const allowedActions = ["start", "complete", "cancel", "no_assistance"];
        if (!allowedActions.includes(action)) {
            return NextResponse.json(
                { error: true, message: "action inválida (start | complete | cancel | no_assistance)" },
                { status: 400 }
            );
        }

        const reason =
            typeof reasonRaw === "string" ? reasonRaw.trim().slice(0, 200) : "";

        await connectMongoDB();

        // Leer cita
        const existing = await Appointment.findById(id)
            .select("_id status user startAt")
            .lean();

        if (!existing) {
            return NextResponse.json(
                { error: true, message: "Cita no encontrada" },
                { status: 404 }
            );
        }

        const currentStatus = existing.status;
        const targetStatus = actionToTargetStatus(currentStatus, action, existing.startAt);

        if (!targetStatus) {
            return NextResponse.json(
                {
                    error: true,
                    message: `Transición no permitida: ${currentStatus} -> ${action}`,
                },
                { status: 409 }
            );
        }

        // Update atómico
        const updated = await Appointment.findOneAndUpdate(
            { _id: id, status: currentStatus },
            {
                $set: { status: targetStatus },
                $push: {
                    statusHistory: {
                        from: currentStatus,
                        to: targetStatus,
                        changedAt: new Date(),
                        changedBy: adminId,
                        reason: reason || `admin_${action}`,
                    },
                },
            },
            { new: true }
        )
            .populate("user", "firstName lastName phone")
            .select("user startAt durationMinutes status paymentStatus price statusHistory updatedAt")
            .lean();

        if (!updated) {
            return NextResponse.json(
                { error: true, message: "No se pudo actualizar (cambio simultáneo de estado)." },
                { status: 409 }
            );
        }

        const first = (updated?.user?.firstName || "").trim();
        const last = (updated?.user?.lastName || "").trim();
        const name = `${first} ${last}`.trim() || "Sin nombre";

        return NextResponse.json(
            {
                ok: true,
                appointment: {
                    id: updated._id.toString(),
                    name,
                    phone: updated?.user?.phone ?? "",
                    startAt: updated.startAt,
                    durationMinutes: updated.durationMinutes,
                    status: updated.status,
                    paymentStatus: updated.paymentStatus,
                    price: updated.price,
                    updatedAt: updated.updatedAt,
                    lastStatusEvent:
                        updated.statusHistory?.[updated.statusHistory.length - 1] || null,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Admin update status error:", error);
        return NextResponse.json(
            { error: true, message: "Error interno del servidor" },
            { status: 500 }
        );
    }
}
