import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@auth";

import connectMongoDB from "@libs/mongodb";
import ScheduleException from "@models/ScheduleException";
import { attachBarberMetaToExceptions } from "@libs/schedule/exceptions";

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

export async function PATCH(request, { params }) {
  try {
    const authResult = await requireAdminSession();
    if (authResult.error) return authResult.error;

    await connectMongoDB();

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const isActive = Boolean(body?.isActive);
    const actorId = new mongoose.Types.ObjectId(authResult.session.user.id);

    const update = isActive
      ? {
          isActive: true,
          deactivatedBy: null,
          deactivatedAt: null,
        }
      : {
          isActive: false,
          deactivatedBy: actorId,
          deactivatedAt: new Date(),
        };

    const updated = await ScheduleException.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return NextResponse.json({ error: "Excepción no encontrada" }, { status: 404 });
    }

    const [exception] = await attachBarberMetaToExceptions([
      {
        id: updated?._id?.toString?.() ?? updated?._id,
        scope: updated.scope,
        barberId: updated?.barberId?.toString?.() ?? null,
        type: updated.type,
        startDate: updated.startDate ? new Date(updated.startDate).toISOString().slice(0, 10) : "",
        endDate: updated.endDate ? new Date(updated.endDate).toISOString().slice(0, 10) : "",
        startTime: updated.startTime || "",
        endTime: updated.endTime || "",
        reason: updated.reason || "",
        isActive: updated.isActive !== false,
        createdBy: updated?.createdBy?.toString?.() ?? null,
        deactivatedBy: updated?.deactivatedBy?.toString?.() ?? null,
        deactivatedAt: updated?.deactivatedAt ?? null,
        createdAt: updated.createdAt ?? null,
        updatedAt: updated.updatedAt ?? null,
      },
    ]);

    return NextResponse.json({ ok: true, exception }, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/admin/schedule/exceptions/[id] error:", error);

    return NextResponse.json(
      { error: error?.message || "Error actualizando excepción" },
      { status: 500 }
    );
  }
}
