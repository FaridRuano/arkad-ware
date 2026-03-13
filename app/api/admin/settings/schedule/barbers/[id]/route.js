import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import Barber from "@models/Barber";
import BarberSchedule from "@models/BarberSchedule";
import BusinessSettings from "@models/BusinessSettings";

const DAY_VALUES = [0, 1, 2, 3, 4, 5, 6];

const cleanStr = (v) => String(v ?? "").trim();

const isValidTimeHHMM = (value = "") => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

function normalizeDay(item = {}) {
  return {
    day: Number(item?.day),
    enabled: Boolean(item?.enabled),
    start: cleanStr(item?.start),
    end: cleanStr(item?.end),
    breakStart: cleanStr(item?.breakStart),
    breakEnd: cleanStr(item?.breakEnd),
  };
}

function normalizeWeekSchedule(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeDay).sort((a, b) => a.day - b.day);
}

function validateWeekSchedule(weekSchedule = []) {
  if (!Array.isArray(weekSchedule)) {
    return "El horario semanal debe ser un arreglo";
  }

  if (weekSchedule.length !== 7) {
    return "El horario semanal debe incluir exactamente los 7 días";
  }

  const days = weekSchedule.map((item) => item.day);
  const uniqueDays = [...new Set(days)];

  if (uniqueDays.length !== 7 || !DAY_VALUES.every((d) => uniqueDays.includes(d))) {
    return "El horario semanal debe incluir los días del 0 al 6 sin repetir";
  }

  for (const item of weekSchedule) {
    if (!item.enabled) continue;

    if (!item.start || !item.end) {
      return `El día ${item.day} está habilitado pero no tiene horario completo`;
    }

    if (!isValidTimeHHMM(item.start) || !isValidTimeHHMM(item.end)) {
      return `El día ${item.day} tiene horas inválidas`;
    }

    if (item.start >= item.end) {
      return `El día ${item.day} tiene un rango horario inválido`;
    }

    const hasBreak = item.breakStart || item.breakEnd;

    if (hasBreak) {
      if (!item.breakStart || !item.breakEnd) {
        return `El descanso del día ${item.day} está incompleto`;
      }

      if (!isValidTimeHHMM(item.breakStart) || !isValidTimeHHMM(item.breakEnd)) {
        return `El descanso del día ${item.day} tiene horas inválidas`;
      }

      if (item.breakStart >= item.breakEnd) {
        return `El descanso del día ${item.day} no es válido`;
      }

      if (item.breakStart <= item.start || item.breakEnd >= item.end) {
        return `El descanso del día ${item.day} debe estar dentro del horario laboral`;
      }
    }
  }

  return "";
}

function normalizeSchedule(doc) {
  if (!doc) return null;

  const obj = doc.toObject ? doc.toObject() : doc;

  return {
    ...obj,
    id: obj?._id?.toString?.() ?? obj?._id,
    barber: obj?.barber
      ? {
        ...(obj.barber?.toObject ? obj.barber.toObject() : obj.barber),
        id:
          obj?.barber?._id?.toString?.() ??
          obj?.barber?._id ??
          obj?.barber?.id,
      }
      : null,
  };
}


function buildWeekScheduleFromBusiness(generalSchedule) {
  const mapRangeToDay = (day, range) => ({
    day,
    enabled: Boolean(range?.enabled),
    start: range?.enabled ? range?.start || "" : "",
    end: range?.enabled ? range?.end || "" : "",
    breakStart: "",
    breakEnd: "",
  });

  return [
    mapRangeToDay(0, generalSchedule?.sunday),
    mapRangeToDay(1, generalSchedule?.weekdays),
    mapRangeToDay(2, generalSchedule?.weekdays),
    mapRangeToDay(3, generalSchedule?.weekdays),
    mapRangeToDay(4, generalSchedule?.weekdays),
    mapRangeToDay(5, generalSchedule?.weekdays),
    mapRangeToDay(6, generalSchedule?.saturday),
  ];
}

/* ─────────────────────────────────────────────
   PATCH /api/admin/settings/schedule/barbers/[id]
───────────────────────────────────────────── */
export async function PATCH(req, { params }) {
  try {
    await connectMongoDB();

    const { id } = await params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const current = await BarberSchedule.findById(id).select("-__v");
    if (!current) {
      return NextResponse.json(
        { error: "Horario de barbero no encontrado" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const update = {};

    if (body?.barber !== undefined) {
      const barberId = cleanStr(body.barber);

      if (!barberId) {
        return NextResponse.json(
          { error: "El barbero es requerido" },
          { status: 400 }
        );
      }

      if (!mongoose.Types.ObjectId.isValid(barberId)) {
        return NextResponse.json(
          { error: "ID de barbero inválido" },
          { status: 400 }
        );
      }

      const barber = await Barber.findById(barberId).select("_id");
      if (!barber) {
        return NextResponse.json(
          { error: "Barbero no encontrado" },
          { status: 404 }
        );
      }

      const duplicate = await BarberSchedule.findOne({
        _id: { $ne: id },
        barber: barberId,
      }).select("_id");

      if (duplicate) {
        return NextResponse.json(
          { error: "Ese barbero ya tiene otro horario configurado" },
          { status: 409 }
        );
      }

      update.barber = barberId;
    }

    if (body?.weekSchedule !== undefined) {
      const weekSchedule = normalizeWeekSchedule(body.weekSchedule);
      const scheduleError = validateWeekSchedule(weekSchedule);

      if (scheduleError) {
        return NextResponse.json(
          { error: scheduleError },
          { status: 400 }
        );
      }

      update.weekSchedule = weekSchedule;
    }

    if (body?.useBusinessHoursAsFallback !== undefined) {
      const nextUseFallback = Boolean(body.useBusinessHoursAsFallback);
      update.useBusinessHoursAsFallback = nextUseFallback;

      if (nextUseFallback) {
        const businessSettings = await BusinessSettings.findOne().select("generalSchedule");

        if (!businessSettings?.generalSchedule) {
          return NextResponse.json(
            { error: "No existe una configuración general de horarios para sincronizar" },
            { status: 400 }
          );
        }

        update.weekSchedule = buildWeekScheduleFromBusiness(
          businessSettings.generalSchedule
        );
      }
    }

    if (body?.notes !== undefined) {
      update.notes = cleanStr(body.notes);
    }

    if (body?.isActive !== undefined) {
      update.isActive = Boolean(body.isActive);
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No hay campos para actualizar" },
        { status: 400 }
      );
    }

    const updated = await BarberSchedule.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    })
      .populate({
        path: "barber",
        select: "_id name phone color isActive createdAt",
      })
      .select("-__v");

    return NextResponse.json({
      schedule: normalizeSchedule(updated),
    });
  } catch (err) {
    if (err?.code === 11000) {
      return NextResponse.json(
        { error: "Ese barbero ya tiene un horario configurado" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: err?.message || "Error actualizando horario del barbero" },
      { status: 500 }
    );
  }
}

/* ─────────────────────────────────────────────
   DELETE /api/admin/settings/schedule/barbers/[id]
   - por defecto toggle activo/inactivo
   - opcional: ?action=activate | deactivate
   - opcional: ?hard=true
───────────────────────────────────────────── */
export async function DELETE(req, { params }) {
  try {
    await connectMongoDB();

    const { id } = await params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const hard = searchParams.get("hard") === "true";
    const action = searchParams.get("action");

    const schedule = await BarberSchedule.findById(id)
      .populate({
        path: "barber",
        select: "_id name",
      })
      .select("_id barber isActive");

    if (!schedule) {
      return NextResponse.json(
        { error: "Horario de barbero no encontrado" },
        { status: 404 }
      );
    }

    if (hard) {
      await BarberSchedule.deleteOne({ _id: id });

      return NextResponse.json({
        ok: true,
        deleted: true,
        action: "deleted",
      });
    }

    if (action === "activate") {
      schedule.isActive = true;
    } else if (action === "deactivate") {
      schedule.isActive = false;
    } else {
      schedule.isActive = !schedule.isActive;
    }

    await schedule.save();

    return NextResponse.json({
      ok: true,
      isActive: schedule.isActive,
      action: schedule.isActive ? "activated" : "deactivated",
      barber: schedule?.barber
        ? {
          id: schedule.barber?._id?.toString?.() ?? schedule.barber?._id,
          name: schedule.barber?.name ?? "",
        }
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error actualizando estado del horario del barbero" },
      { status: 500 }
    );
  }
}