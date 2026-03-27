import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";
import Service from "@models/Service";
import BarberSchedule from "@models/BarberSchedule";
import BusinessSettings from "@models/BusinessSettings";
import ScheduleException from "@models/ScheduleException";

const DEFAULT_TIMEZONE = "America/Guayaquil";
const ECUADOR_OFFSET = "-05:00";

const BLOCKING_STATUSES = [
    "pending",
    "confirmed",
    "in_progress",
    "in progress",
];

function isValidDateString(value = "") {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function toMinutes(hhmm = "") {
    if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return null;
    const [h, m] = hhmm.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

function minutesToHHMM(totalMinutes) {
    const safe = Math.max(0, Math.min(1440, totalMinutes));
    const hours = String(Math.floor(safe / 60)).padStart(2, "0");
    const minutes = String(safe % 60).padStart(2, "0");
    return `${hours}:${minutes}`;
}

function rangesOverlap(startA, endA, startB, endB) {
    return startA < endB && endA > startB;
}

function mergeIntervals(intervals = []) {
    if (!Array.isArray(intervals) || intervals.length === 0) return [];

    const sorted = intervals
        .filter(
            (item) =>
                item &&
                Number.isFinite(item.start) &&
                Number.isFinite(item.end) &&
                item.start < item.end
        )
        .sort((a, b) => a.start - b.start);

    if (!sorted.length) return [];

    const merged = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const last = merged[merged.length - 1];

        if (current.start <= last.end) {
            last.end = Math.max(last.end, current.end);
        } else {
            merged.push({ ...current });
        }
    }

    return merged;
}

function subtractIntervals(baseIntervals = [], blockedIntervals = []) {
    if (!baseIntervals.length) return [];
    if (!blockedIntervals.length) return baseIntervals;

    let result = [...baseIntervals];

    for (const block of blockedIntervals) {
        const next = [];

        for (const interval of result) {
            if (!rangesOverlap(interval.start, interval.end, block.start, block.end)) {
                next.push(interval);
                continue;
            }

            if (block.start > interval.start) {
                next.push({ start: interval.start, end: block.start });
            }

            if (block.end < interval.end) {
                next.push({ start: block.end, end: interval.end });
            }
        }

        result = next;
    }

    return mergeIntervals(result);
}

function addIntervals(baseIntervals = [], openIntervals = []) {
    return mergeIntervals([...(baseIntervals || []), ...(openIntervals || [])]);
}

function isSlotInsideIntervals(slotStart, slotEnd, intervals = []) {
    return intervals.some(
        (interval) => slotStart >= interval.start && slotEnd <= interval.end
    );
}

function getWeekdayFromDateString(dateStr) {
    const date = new Date(`${dateStr}T12:00:00Z`);
    return date.getUTCDay(); // 0 domingo ... 6 sábado
}

function addDays(dateStr, amount) {
    const date = new Date(`${dateStr}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
}

function buildDayRange(dateStr) {
    return {
        start: new Date(`${dateStr}T00:00:00${ECUADOR_OFFSET}`),
        end: new Date(`${dateStr}T23:59:59.999${ECUADOR_OFFSET}`),
    };
}

function getNowInTimeZone(timeZone = DEFAULT_TIMEZONE) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    });

    const parts = formatter.formatToParts(new Date());
    const get = (type) => parts.find((p) => p.type === type)?.value || "";

    return {
        date: `${get("year")}-${get("month")}-${get("day")}`,
        hour: Number(get("hour")),
        minute: Number(get("minute")),
        second: Number(get("second")),
    };
}

function getBusinessRangeForDay(generalSchedule = {}, day) {
    let range = null;

    if (day >= 1 && day <= 5) {
        range = generalSchedule?.weekdays || null;
    } else if (day === 6) {
        range = generalSchedule?.saturday || null;
    } else {
        range = generalSchedule?.sunday || null;
    }

    if (!range?.enabled || !range?.start || !range?.end) return [];

    const start = toMinutes(range.start);
    const end = toMinutes(range.end);

    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return [];

    return [{ start, end }];
}

function getBarberBaseIntervals({
    barberId,
    weekday,
    schedulesMap,
    businessSettings,
}) {
    const scheduleDoc = schedulesMap.get(String(barberId));

    if (scheduleDoc?.isActive) {
        const dayConfig = (scheduleDoc.weekSchedule || []).find(
            (item) => item.day === weekday
        );

        if (dayConfig?.enabled && dayConfig.start && dayConfig.end) {
            const baseStart = toMinutes(dayConfig.start);
            const baseEnd = toMinutes(dayConfig.end);

            if (Number.isFinite(baseStart) && Number.isFinite(baseEnd) && baseStart < baseEnd) {
                let intervals = [{ start: baseStart, end: baseEnd }];

                const hasBreak = dayConfig.breakStart && dayConfig.breakEnd;
                if (hasBreak) {
                    const breakStart = toMinutes(dayConfig.breakStart);
                    const breakEnd = toMinutes(dayConfig.breakEnd);

                    if (
                        Number.isFinite(breakStart) &&
                        Number.isFinite(breakEnd) &&
                        breakStart < breakEnd
                    ) {
                        intervals = subtractIntervals(intervals, [
                            { start: breakStart, end: breakEnd },
                        ]);
                    }
                }

                return mergeIntervals(intervals);
            }
        }

        if (scheduleDoc.useBusinessHoursAsFallback) {
            return getBusinessRangeForDay(businessSettings?.generalSchedule, weekday);
        }

        return [];
    }

    return getBusinessRangeForDay(businessSettings?.generalSchedule, weekday);
}

function getRelevantExceptions({
    allExceptions = [],
    barberId,
}) {
    return allExceptions.filter((item) => {
        if (!item?.isActive) return false;
        if (!item.barber) return true; // global
        return String(item.barber) === String(barberId);
    });
}

function applyExceptionsToIntervals(baseIntervals, exceptions = []) {
    let intervals = [...baseIntervals];

    const openIntervals = [];
    const blockIntervals = [];

    let hasAllDayBlock = false;
    let hasAllDayOpen = false;

    for (const exception of exceptions) {
        if (exception.allDay) {
            if (exception.type === "block") hasAllDayBlock = true;
            if (exception.type === "open") hasAllDayOpen = true;
            continue;
        }

        const start = toMinutes(exception.start);
        const end = toMinutes(exception.end);

        if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) continue;

        if (exception.type === "open") {
            openIntervals.push({ start, end });
        }

        if (exception.type === "block") {
            blockIntervals.push({ start, end });
        }
    }

    if (hasAllDayBlock && !hasAllDayOpen) {
        return [];
    }

    if (hasAllDayOpen) {
        intervals = addIntervals(intervals, [{ start: 0, end: 1440 }]);
    }

    if (openIntervals.length) {
        intervals = addIntervals(intervals, openIntervals);
    }

    if (hasAllDayBlock && hasAllDayOpen) {
        intervals = [{ start: 0, end: 1440 }];
    }

    if (blockIntervals.length) {
        intervals = subtractIntervals(intervals, blockIntervals);
    }

    return mergeIntervals(intervals);
}

function appointmentConflictsSlot(appointment, slotStart, slotEnd) {
    const startAt = new Date(appointment.startAt);
    const apptStart = startAt.getHours() * 60 + startAt.getMinutes();
    const apptEnd = apptStart + Number(appointment.durationMinutes || 0);

    return rangesOverlap(slotStart, slotEnd, apptStart, apptEnd);
}

function slotPassesNotice(dateStr, timeHHMM, minNoticeMinutes) {
    const slotDate = new Date(`${dateStr}T${timeHHMM}:00${ECUADOR_OFFSET}`);
    const minAllowed = new Date(Date.now() + minNoticeMinutes * 60 * 1000);
    return slotDate.getTime() >= minAllowed.getTime();
}

export async function GET(req) {
    try {
        await connectMongoDB();

        const { searchParams } = new URL(req.url);

        const date = String(searchParams.get("date") || "").trim();
        const serviceId = String(searchParams.get("serviceId") || "").trim();
        const barberId = String(searchParams.get("barberId") || "").trim();

        if (!date || !isValidDateString(date)) {
            return NextResponse.json(
                { error: "La fecha es obligatoria y debe tener formato YYYY-MM-DD" },
                { status: 400 }
            );
        }

        if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
            return NextResponse.json(
                { error: "El servicio es obligatorio y no es válido" },
                { status: 400 }
            );
        }

        if (barberId && !mongoose.Types.ObjectId.isValid(barberId)) {
            return NextResponse.json(
                { error: "El barbero no es válido" },
                { status: 400 }
            );
        }

        const businessSettings =
            (await BusinessSettings.findOne({ isActive: true }).lean()) || {
                timezone: DEFAULT_TIMEZONE,
                generalSchedule: {
                    weekdays: { enabled: true, start: "09:00", end: "18:00" },
                    saturday: { enabled: true, start: "09:00", end: "14:00" },
                    sunday: { enabled: false, start: "", end: "" },
                },
                slotIntervalMinutes: 30,
                bookingMinNoticeMinutes: 60,
                bookingMaxDaysAhead: 30,
            };

        const timezone = businessSettings.timezone || DEFAULT_TIMEZONE;
        const slotInterval = Number(businessSettings.slotIntervalMinutes || 30);
        const minNoticeMinutes = Number(businessSettings.bookingMinNoticeMinutes || 0);
        const maxDaysAhead = Number(businessSettings.bookingMaxDaysAhead || 30);

        const nowTz = getNowInTimeZone(timezone);
        const today = nowTz.date;
        const maxAllowedDate = addDays(today, maxDaysAhead);

        if (date < today) {
            return NextResponse.json(
                { error: "No se pueden consultar fechas anteriores al día actual" },
                { status: 400 }
            );
        }

        if (date > maxAllowedDate) {
            return NextResponse.json(
                { error: "La fecha consultada excede el máximo permitido para reservas" },
                { status: 400 }
            );
        }

        const service = await Service.findOne({
            _id: serviceId,
            isActive: true,
        })
            .select("name description durationMinutes price color barbers")
            .populate({
                path: "barbers",
                select: "name color isActive",
            })
            .lean();

        if (!service) {
            return NextResponse.json(
                { error: "Servicio no encontrado o inactivo" },
                { status: 404 }
            );
        }

        const compatibleBarbers = (service.barbers || []).filter(
            (barber) => barber && barber.isActive
        );

        if (!compatibleBarbers.length) {
            return NextResponse.json(
                { error: "Este servicio no tiene barberos activos disponibles" },
                { status: 400 }
            );
        }

        let selectedBarbers = compatibleBarbers;
        let barberMode = "any";

        if (barberId) {
            const selected = compatibleBarbers.find(
                (barber) => String(barber._id) === barberId
            );

            if (!selected) {
                return NextResponse.json(
                    { error: "El barbero no está habilitado para este servicio" },
                    { status: 400 }
                );
            }

            selectedBarbers = [selected];
            barberMode = "single";
        }

        const weekday = getWeekdayFromDateString(date);

        const schedules = await BarberSchedule.find({
            barber: { $in: selectedBarbers.map((b) => b._id) },
            isActive: true,
        }).lean();

        const schedulesMap = new Map(
            schedules.map((item) => [String(item.barber), item])
        );

        const exceptions = await ScheduleException.find({
            date,
            isActive: true,
            $or: [
                { barber: null },
                { barber: { $in: selectedBarbers.map((b) => b._id) } },
            ],
        })
            .select("barber date type allDay start end reason notes isActive")
            .lean();

        const { start: dayStart, end: dayEnd } = buildDayRange(date);

        const appointments = await Appointment.find({
            barberId: { $in: selectedBarbers.map((b) => b._id) },
            startAt: { $gte: dayStart, $lte: dayEnd },
            status: { $in: BLOCKING_STATUSES },
        })
            .select("barberId startAt durationMinutes status")
            .lean();

        const appointmentsByBarber = new Map();
        for (const barber of selectedBarbers) {
            appointmentsByBarber.set(String(barber._id), []);
        }

        for (const appointment of appointments) {
            const key = String(appointment.barberId);
            if (!appointmentsByBarber.has(key)) {
                appointmentsByBarber.set(key, []);
            }
            appointmentsByBarber.get(key).push(appointment);
        }

        const availabilityByBarber = selectedBarbers.map((barber) => {
            const baseIntervals = getBarberBaseIntervals({
                barberId: barber._id,
                weekday,
                schedulesMap,
                businessSettings,
            });

            const barberExceptions = getRelevantExceptions({
                allExceptions: exceptions,
                barberId: barber._id,
            });

            const finalIntervals = applyExceptionsToIntervals(
                baseIntervals,
                barberExceptions
            );

            return {
                id: String(barber._id),
                name: barber.name,
                color: barber.color || "#CFB690",
                intervals: finalIntervals,
                appointments: appointmentsByBarber.get(String(barber._id)) || [],
            };
        });

        const serviceDuration = Number(service.durationMinutes || 0);

        if (!serviceDuration || serviceDuration < slotInterval) {
            // igual puede funcionar si dura más que el slot, esto solo valida básico
        }

        const slots = [];

        for (
            let startMinutes = 0;
            startMinutes + serviceDuration <= 1440;
            startMinutes += slotInterval
        ) {
            const endMinutes = startMinutes + serviceDuration;
            const time = minutesToHHMM(startMinutes);

            if (!slotPassesNotice(date, time, minNoticeMinutes)) {
                continue;
            }

            const availableBarbers = availabilityByBarber
                .filter((barber) => {
                    const insideSchedule = isSlotInsideIntervals(
                        startMinutes,
                        endMinutes,
                        barber.intervals
                    );

                    if (!insideSchedule) return false;

                    const hasConflict = barber.appointments.some((appointment) =>
                        appointmentConflictsSlot(appointment, startMinutes, endMinutes)
                    );

                    return !hasConflict;
                })
                .map((barber) => ({
                    id: barber.id,
                    name: barber.name,
                    color: barber.color,
                }));

            const available = availableBarbers.length > 0;

            if (!available) continue;

            slots.push({
                time,
                available: true,
                availableBarbers,
            });
        }

        return NextResponse.json(
            {
                date,
                barberMode,
                barberId: barberId || null,
                timezone,
                slotIntervalMinutes: slotInterval,
                bookingMinNoticeMinutes: minNoticeMinutes,
                bookingMaxDaysAhead: maxDaysAhead,
                service: {
                    id: String(service._id),
                    name: service.name,
                    description: service.description || "",
                    durationMinutes: service.durationMinutes,
                    price: service.price,
                    color: service.color || "#CFB690",
                },
                slots,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("GET /api/client/schedule error:", error);

        return NextResponse.json(
            { error: "No se pudo obtener la disponibilidad" },
            { status: 500 }
        );
    }
}