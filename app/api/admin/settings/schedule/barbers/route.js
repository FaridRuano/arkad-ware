import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import Barber from "@models/Barber";
import BarberSchedule from "@models/BarberSchedule";

const DEFAULT_WEEK_SCHEDULE = [
  { day: 0, enabled: false, start: "", end: "", breakStart: "", breakEnd: "" },
  { day: 1, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 2, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 3, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 4, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 5, enabled: true, start: "09:00", end: "18:00", breakStart: "", breakEnd: "" },
  { day: 6, enabled: true, start: "09:00", end: "14:00", breakStart: "", breakEnd: "" },
];

function normalizeBarber(barber) {
  if (!barber) return null;

  const obj = barber.toObject ? barber.toObject() : barber;

  return {
    ...obj,
    id: obj?._id?.toString?.() ?? obj?._id,
  };
}

function normalizeSchedule(schedule) {
  if (!schedule) return null;

  const obj = schedule.toObject ? schedule.toObject() : schedule;

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

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const onlyWithSchedule = searchParams.get("onlyWithSchedule") === "true";

    const barberMatch = includeInactive ? {} : { isActive: true };

    const [barbers, schedules] = await Promise.all([
      Barber.find(barberMatch)
        .sort({ createdAt: -1 })
        .select("_id name phone color isActive createdAt"),
      BarberSchedule.find({})
        .populate({
          path: "barber",
          select: "_id name phone color isActive createdAt",
        })
        .sort({ createdAt: -1 })
        .select("-__v"),
    ]);

    const normalizedSchedules = (schedules || []).map(normalizeSchedule);

    if (onlyWithSchedule) {
      return NextResponse.json({
        schedules: normalizedSchedules.filter((item) => item?.barber),
        total: normalizedSchedules.filter((item) => item?.barber).length,
      });
    }

    const scheduleMap = new Map();

    for (const schedule of normalizedSchedules) {
      const barberId = schedule?.barber?.id || schedule?.barber?._id?.toString?.();
      if (barberId) {
        scheduleMap.set(barberId, schedule);
      }
    }

    const merged = (barbers || []).map((barber) => {
      const normalizedBarber = normalizeBarber(barber);
      const barberId = normalizedBarber.id;
      const existingSchedule = scheduleMap.get(barberId);

      if (existingSchedule) {
        return {
          ...existingSchedule,
          barber: normalizedBarber,
          hasCustomSchedule: true,
        };
      }

      return {
        id: null,
        barber: normalizedBarber,
        weekSchedule: DEFAULT_WEEK_SCHEDULE,
        useBusinessHoursAsFallback: true,
        notes: "",
        isActive: true,
        hasCustomSchedule: false,
        createdAt: null,
        updatedAt: null,
      };
    });

    return NextResponse.json({
      schedules: merged,
      total: merged.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error cargando horarios de barberos" },
      { status: 500 }
    );
  }
}