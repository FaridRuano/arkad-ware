import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@auth";

import connectMongoDB from "@libs/mongodb";
import ScheduleException from "@models/ScheduleException";
import {
  attachBarberMetaToExceptions,
  buildExceptionPayload,
  findConflictingAppointmentsForException,
  getScheduleExceptionsInRange,
  isValidDateString,
} from "@libs/schedule/exceptions";

async function requireAdminSession() {
  const session = await auth();

  if (!session?.user?.id) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (session.user.role !== "admin") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { session };
}

export async function GET(request) {
  try {
    const authResult = await requireAdminSession();
    if (authResult.error) return authResult.error;

    await connectMongoDB();

    const { searchParams } = new URL(request.url);

    const startDate = String(searchParams.get("startDate") || "").trim();
    const endDate = String(searchParams.get("endDate") || startDate || "").trim();
    const scope = String(searchParams.get("scope") || "").trim();
    const barberId = String(searchParams.get("barberId") || "").trim();
    const activeOnly = String(searchParams.get("activeOnly") || "true").trim() !== "false";

    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
      return NextResponse.json(
        { error: "startDate y endDate deben tener formato YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (barberId && !mongoose.Types.ObjectId.isValid(barberId)) {
      return NextResponse.json({ error: "barberId inválido" }, { status: 400 });
    }

    const exceptions = await getScheduleExceptionsInRange({
      startDate,
      endDate,
      barberId: barberId || null,
      scope,
      activeOnly,
    });

    const enriched = await attachBarberMetaToExceptions(exceptions);

    return NextResponse.json(
      {
        total: enriched.length,
        filters: {
          startDate,
          endDate,
          scope: scope || null,
          barberId: barberId || null,
          activeOnly,
        },
        exceptions: enriched,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("GET /api/admin/schedule/exceptions error:", error);

    return NextResponse.json(
      { error: error?.message || "Error listando excepciones" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const authResult = await requireAdminSession();
    if (authResult.error) return authResult.error;

    await connectMongoDB();

    const body = await request.json().catch(() => ({}));
    const payload = buildExceptionPayload(body);

    const conflicts = await findConflictingAppointmentsForException(payload);

    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: "No se puede crear la excepción porque existen citas activas en conflicto",
          conflicts: conflicts.map((appointment) => ({
            id: appointment?._id?.toString?.() ?? appointment?._id,
            barberId: appointment?.barberId?.toString?.() ?? appointment?.barberId ?? null,
            serviceName: appointment?.serviceName ?? "",
            startAt: appointment?.startAt ?? null,
            endAt: appointment?.endAt ?? null,
            status: appointment?.status ?? "",
          })),
        },
        { status: 409 }
      );
    }

    const created = await ScheduleException.create({
      scope: payload.scope,
      barberId:
        payload.scope === "barber"
          ? new mongoose.Types.ObjectId(payload.barberId)
          : null,
      type: payload.type,
      startDate: new Date(`${payload.startDate}T05:00:00.000Z`),
      endDate: new Date(`${payload.endDate}T05:00:00.000Z`),
      startTime: payload.startTime,
      endTime: payload.endTime,
      reason: payload.reason,
      createdBy: new mongoose.Types.ObjectId(authResult.session.user.id),
    });

    const [normalized] = await attachBarberMetaToExceptions([
      {
        id: created?._id?.toString?.() ?? created?._id,
        scope: created.scope,
        barberId: created?.barberId?.toString?.() ?? null,
        type: created.type,
        startDate: payload.startDate,
        endDate: payload.endDate,
        startTime: created.startTime || "",
        endTime: created.endTime || "",
        reason: created.reason || "",
        isActive: created.isActive !== false,
        createdBy: created?.createdBy?.toString?.() ?? null,
        deactivatedBy: created?.deactivatedBy?.toString?.() ?? null,
        deactivatedAt: created?.deactivatedAt ?? null,
        createdAt: created.createdAt ?? null,
        updatedAt: created.updatedAt ?? null,
      },
    ]);

    return NextResponse.json({ ok: true, exception: normalized }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/schedule/exceptions error:", error);

    return NextResponse.json(
      { error: error?.message || "Error creando excepción" },
      { status: 500 }
    );
  }
}
