import mongoose from "mongoose";
import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import Barber from "@models/Barber";
import BarberSchedule from "@models/BarberSchedule";

const DAY_VALUES = [0, 1, 2, 3, 4, 5, 6];

const cleanStr = (v) => String(v ?? "").trim();

const isValidTimeHHMM = (value = "") => /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

const DEFAULT_WEEK_SCHEDULE = [
  { day: 0, enabled: false, start: "", end: "", breakStart: "", breakEnd: "" },
  { day: 1, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 2, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 3, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 4, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 5, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 6, enabled: true, start: "09:00", end: "14:00", breakStart: "", breakEnd: "" },
];

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
  const source = Array.isArray(value) && value.length ? value : DEFAULT_WEEK_SCHEDULE;

  return source
    .map(normalizeDay)
    .sort((a, b) => a.day - b.day);
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

export async function POST(req) {
  try {
    await connectMongoDB();

    const body = await req.json().catch(() => ({}));

    const barberId = cleanStr(body?.barber);
    const weekSchedule = normalizeWeekSchedule(body?.weekSchedule);
    const useBusinessHoursAsFallback = body?.useBusinessHoursAsFallback !== false;
    const notes = cleanStr(body?.notes);
    const isActive = body?.isActive !== false;

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

    const barber = await Barber.findById(barberId).select("_id name phone color isActive");
    if (!barber) {
      return NextResponse.json(
        { error: "Barbero no encontrado" },
        { status: 404 }
      );
    }

    const existing = await BarberSchedule.findOne({ barber: barberId }).select("_id");
    if (existing) {
      return NextResponse.json(
        { error: "Este barbero ya tiene un horario configurado" },
        { status: 409 }
      );
    }

    const scheduleError = validateWeekSchedule(weekSchedule);
    if (scheduleError) {
      return NextResponse.json(
        { error: scheduleError },
        { status: 400 }
      );
    }

    const created = await BarberSchedule.create({
      barber: barberId,
      weekSchedule,
      useBusinessHoursAsFallback,
      notes,
      isActive,
    });

    const populated = await BarberSchedule.findById(created._id)
      .populate({
        path: "barber",
        select: "_id name phone color isActive createdAt",
      })
      .select("-__v");

    return NextResponse.json(
      {
        schedule: normalizeSchedule(populated),
      },
      { status: 201 }
    );
  } catch (err) {
    if (err?.code === 11000) {
      return NextResponse.json(
        { error: "Este barbero ya tiene un horario configurado" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: err?.message || "Error creando horario del barbero" },
      { status: 500 }
    );
  }
}