import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import Barber from "@models/Barber";
import BarberSchedule from "@models/BarberSchedule";
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

const cleanPhone = (v) => {
  const digits = cleanStr(v).replace(/[^\d]/g, "");
  return digits;
};

const cleanColor = (v) => {
  const s = cleanStr(v);
  return s || "#000000";
};

const DEFAULT_WEEK_SCHEDULE = [
  { day: 0, enabled: false, start: "", end: "", breakStart: "", breakEnd: "" },
  { day: 1, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 2, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 3, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 4, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 5, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 6, enabled: true, start: "09:00", end: "14:00", breakStart: "", breakEnd: "" },
];

function buildWeekScheduleFromBusiness(generalSchedule) {
  if (!generalSchedule) return DEFAULT_WEEK_SCHEDULE;

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

export async function POST(req) {
  try {
    await connectMongoDB();

    const body = await req.json().catch(() => ({}));

    const name = cleanStr(body?.name);
    const phone = cleanPhone(body?.phone);
    const color = cleanColor(body?.color);
    const isActive = body?.isActive !== false;
    const notes = cleanStr(body?.notes);

    if (!name) {
      return NextResponse.json(
        { error: "El nombre del barbero es requerido" },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json(
        { error: "Teléfono es requerido" },
        { status: 400 }
      );
    }

    if (!/^#([0-9a-fA-F]{6})$/.test(color)) {
      return NextResponse.json(
        { error: "El color debe ser HEX (#RRGGBB)" },
        { status: 400 }
      );
    }

    const nameTitle = toTitleCase(name);

    const existsPhone = await Barber.findOne({ phone }).select("_id phone");
    if (existsPhone) {
      return NextResponse.json(
        { error: "Ya existe un barbero con ese teléfono" },
        { status: 409 }
      );
    }

    const existsName = await Barber.findOne({
      name: {
        $regex: `^${nameTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        $options: "i",
      },
    }).select("_id name");

    if (existsName) {
      return NextResponse.json(
        { error: "Ya existe un barbero con ese nombre" },
        { status: 409 }
      );
    }

    const created = await Barber.create({
      name: nameTitle,
      phone,
      color,
      isActive,
      notes,
      linkedUserId: body?.linkedUserId ?? null,
    });

    // Crear horario inicial automáticamente
    const businessSettings = await BusinessSettings.findOne().select("generalSchedule");
    const weekSchedule = buildWeekScheduleFromBusiness(
      businessSettings?.generalSchedule || null
    );

    await BarberSchedule.create({
      barber: created._id,
      weekSchedule,
      useBusinessHoursAsFallback: true,
      notes: "",
      isActive: true,
    });

    const safe = created.toObject();
    delete safe.__v;

    return NextResponse.json(
      {
        barber: {
          ...safe,
          id: created?._id?.toString?.() ?? created?._id,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    if (err?.code === 11000) {
      const key = Object.keys(err?.keyPattern || {})?.[0] || "campo";
      const map = { phone: "teléfono", name: "nombre", barber: "barbero" };

      return NextResponse.json(
        { error: `Ya existe un registro con ese ${map[key] || key}` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: err?.message || "Error creando barbero" },
      { status: 500 }
    );
  }
}