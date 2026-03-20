import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import BusinessSettings from "@models/BusinessSettings";
import BarberSchedule from "@models/BarberSchedule";

const cleanStr = (v) => String(v ?? "").trim();

const cleanInt = (v, fallback = NaN) => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isInteger(n) ? n : fallback;
};

const isValidTimeHHMM = (value = "") =>
  /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

function normalizeRange(range = {}) {
  const enabled = Boolean(range?.enabled);
  const start = cleanStr(range?.start);
  const end = cleanStr(range?.end);

  if (!enabled) {
    return {
      enabled: false,
      start: "",
      end: "",
    };
  }

  return {
    enabled: true,
    start,
    end,
  };
}

function validateRange(label, range) {
  if (!range.enabled) return "";

  if (!range.start || !range.end) {
    return `El horario de ${label} debe tener inicio y fin`;
  }

  if (!isValidTimeHHMM(range.start) || !isValidTimeHHMM(range.end)) {
    return `Las horas de ${label} deben tener formato HH:MM`;
  }

  if (range.start >= range.end) {
    return `La hora de inicio de ${label} debe ser menor que la de cierre`;
  }

  return "";
}

function normalizeBusiness(doc) {
  if (!doc) return null;

  const obj = doc.toObject ? doc.toObject() : doc;

  return {
    ...obj,
    id: obj?._id?.toString?.() ?? obj?._id,
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

async function syncFallbackBarberSchedules(generalSchedule) {
  const nextWeekSchedule = buildWeekScheduleFromBusiness(generalSchedule);

  await BarberSchedule.updateMany(
    { useBusinessHoursAsFallback: true },
    {
      $set: {
        weekSchedule: nextWeekSchedule,
      },
    }
  );
}

/* ─────────────────────────────────────────────
   GET
───────────────────────────────────────────── */
export async function GET() {
  try {
    await connectMongoDB();

    const settings = await BusinessSettings.findOne().select("-__v");

    return NextResponse.json({
      business: normalizeBusiness(settings),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error cargando configuración del negocio" },
      { status: 500 }
    );
  }
}

/* ─────────────────────────────────────────────
   POST (crear configuración inicial)
───────────────────────────────────────────── */
export async function POST(req) {
  try {
    await connectMongoDB();

    const existing = await BusinessSettings.findOne().select("_id");
    if (existing) {
      return NextResponse.json(
        { error: "La configuración del negocio ya existe" },
        { status: 409 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const timezone = cleanStr(body?.timezone) || "America/Guayaquil";

    const weekdays = normalizeRange(body?.generalSchedule?.weekdays);
    const saturday = normalizeRange(body?.generalSchedule?.saturday);
    const sunday = normalizeRange(body?.generalSchedule?.sunday);

    const err1 = validateRange("lunes a viernes", weekdays);
    const err2 = validateRange("sábado", saturday);
    const err3 = validateRange("domingo", sunday);

    const error = err1 || err2 || err3;

    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    const slotIntervalMinutes = cleanInt(body?.slotIntervalMinutes, 15);
    const bookingMinNoticeMinutes = cleanInt(body?.bookingMinNoticeMinutes, 60);
    const bookingMaxDaysAhead = cleanInt(body?.bookingMaxDaysAhead, 30);

    if (!Number.isInteger(slotIntervalMinutes) || slotIntervalMinutes <= 0) {
      return NextResponse.json(
        { error: "El intervalo debe ser un número entero mayor a 0" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(bookingMinNoticeMinutes) || bookingMinNoticeMinutes < 0) {
      return NextResponse.json(
        { error: "La anticipación mínima no es válida" },
        { status: 400 }
      );
    }

    if (!Number.isInteger(bookingMaxDaysAhead) || bookingMaxDaysAhead < 1) {
      return NextResponse.json(
        { error: "El máximo de días debe ser mayor que 0" },
        { status: 400 }
      );
    }

    const created = await BusinessSettings.create({
      timezone,
      generalSchedule: {
        weekdays,
        saturday,
        sunday,
      },
      slotIntervalMinutes,
      bookingMinNoticeMinutes,
      bookingMaxDaysAhead,
    });

    await syncFallbackBarberSchedules(created.generalSchedule);

    return NextResponse.json(
      {
        business: normalizeBusiness(created),
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error creando configuración del negocio" },
      { status: 500 }
    );
  }
}

/* ─────────────────────────────────────────────
   PATCH (actualizar configuración)
───────────────────────────────────────────── */
export async function PATCH(req) {
  try {
    await connectMongoDB();

    const current = await BusinessSettings.findOne().select("-__v");

    if (!current) {
      return NextResponse.json(
        { error: "La configuración del negocio aún no existe" },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const update = {};

    if (body?.timezone !== undefined) {
      update.timezone = cleanStr(body.timezone) || "America/Guayaquil";
    }

    if (body?.generalSchedule !== undefined) {
      const weekdays = normalizeRange(body?.generalSchedule?.weekdays);
      const saturday = normalizeRange(body?.generalSchedule?.saturday);
      const sunday = normalizeRange(body?.generalSchedule?.sunday);

      const err1 = validateRange("lunes a viernes", weekdays);
      const err2 = validateRange("sábado", saturday);
      const err3 = validateRange("domingo", sunday);

      const error = err1 || err2 || err3;

      if (error) {
        return NextResponse.json({ error }, { status: 400 });
      }

      update.generalSchedule = {
        weekdays,
        saturday,
        sunday,
      };
    }

    if (body?.slotIntervalMinutes !== undefined) {
      const v = cleanInt(body.slotIntervalMinutes);

      if (!Number.isInteger(v) || v <= 0) {
        return NextResponse.json(
          { error: "El intervalo debe ser un número entero mayor a 0" },
          { status: 400 }
        );
      }

      update.slotIntervalMinutes = v;
    }

    if (body?.bookingMinNoticeMinutes !== undefined) {
      const v = cleanInt(body.bookingMinNoticeMinutes);

      if (!Number.isInteger(v) || v < 0) {
        return NextResponse.json(
          { error: "La anticipación mínima no es válida" },
          { status: 400 }
        );
      }

      update.bookingMinNoticeMinutes = v;
    }

    if (body?.bookingMaxDaysAhead !== undefined) {
      const v = cleanInt(body.bookingMaxDaysAhead);

      if (!Number.isInteger(v) || v < 1) {
        return NextResponse.json(
          { error: "El máximo de días debe ser mayor que 0" },
          { status: 400 }
        );
      }

      update.bookingMaxDaysAhead = v;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json(
        { error: "No hay campos para actualizar" },
        { status: 400 }
      );
    }

    const updated = await BusinessSettings.findByIdAndUpdate(
      current._id,
      update,
      { new: true, runValidators: true }
    ).select("-__v");

    if (update.generalSchedule) {
      await syncFallbackBarberSchedules(updated.generalSchedule);
    }

    return NextResponse.json({
      business: normalizeBusiness(updated),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error actualizando configuración del negocio" },
      { status: 500 }
    );
  }
}