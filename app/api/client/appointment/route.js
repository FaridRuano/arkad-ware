import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@libs/mongodb";
import { auth } from "@auth";

import Appointment from "@models/Appointment";
import Service from "@models/Service";
import BarberSchedule from "@models/BarberSchedule";
import BusinessSettings from "@models/BusinessSettings";
import ScheduleException from "@models/ScheduleException";

const DEFAULT_TIMEZONE = "America/Guayaquil";
const ECUADOR_OFFSET = "-05:00";

const BLOCKING_STATUSES = ["pending", "confirmed", "in_progress"];
const ACTIVE_CLIENT_STATUSES = ["pending", "confirmed", "in_progress"];

function isValidDateString(value = "") {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function isValidTimeString(value = "") {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value));
}

function toMinutes(hhmm = "") {
    if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return null;

    const [h, m] = hhmm.split(":").map(Number);

    if (Number.isNaN(h) || Number.isNaN(m)) return null;

    return h * 60 + m;
}

function addDays(dateStr, amount) {
    const date = new Date(`${dateStr}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount);
    return date.toISOString().slice(0, 10);
}

function buildStartAt(dateStr, timeStr) {
    return new Date(`${dateStr}T${timeStr}:00${ECUADOR_OFFSET}`);
}

function buildEndAt(dateStr, timeStr, durationMinutes) {
    return new Date(
        buildStartAt(dateStr, timeStr).getTime() + Number(durationMinutes || 0) * 60 * 1000
    );
}

function buildDayRange(dateStr) {
    return {
        start: new Date(`${dateStr}T00:00:00${ECUADOR_OFFSET}`),
        end: new Date(`${dateStr}T23:59:59.999${ECUADOR_OFFSET}`),
    };
}

function getWeekdayFromDateString(dateStr) {
    const date = new Date(`${dateStr}T12:00:00Z`);
    return date.getUTCDay(); // 0 domingo ... 6 sábado
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

function rangesOverlap(startA, endA, startB, endB) {
    return startA < endB && endA > startB;
}

function mergeIntervals(intervals = []) {
    if (!Array.isArray(intervals) || !intervals.length) return [];

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

    const merged = [{ ...sorted[0] }];

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
    if (!blockedIntervals.length) return mergeIntervals(baseIntervals);

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

    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
        return [];
    }

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

            if (
                Number.isFinite(baseStart) &&
                Number.isFinite(baseEnd) &&
                baseStart < baseEnd
            ) {
                let intervals = [{ start: baseStart, end: baseEnd }];

                if (dayConfig.breakStart && dayConfig.breakEnd) {
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

function getRelevantExceptions({ allExceptions = [], barberId }) {
    return allExceptions.filter((item) => {
        if (!item?.isActive) return false;
        if (!item.barber) return true; // excepción global
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

        if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
            continue;
        }

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
    const apptStartDate = new Date(appointment.startAt);
    const apptStart = apptStartDate.getHours() * 60 + apptStartDate.getMinutes();
    const apptEnd = apptStart + Number(appointment.durationMinutes || 0);

    return rangesOverlap(slotStart, slotEnd, apptStart, apptEnd);
}

function slotPassesNotice(dateStr, timeHHMM, minNoticeMinutes) {
    const slotDate = new Date(`${dateStr}T${timeHHMM}:00${ECUADOR_OFFSET}`);
    const minAllowed = new Date(Date.now() + Number(minNoticeMinutes || 0) * 60 * 1000);
    return slotDate.getTime() >= minAllowed.getTime();
}

async function resolveAvailableBarbersForSlot({
    date,
    time,
    durationMinutes,
    compatibleBarbers,
    requestedBarberId,
    businessSettings,
}) {
    let selectedBarbers = compatibleBarbers;

    if (requestedBarberId) {
        const selected = compatibleBarbers.find(
            (barber) => String(barber._id) === String(requestedBarberId)
        );

        if (!selected) {
            return {
                ok: false,
                error: "El barbero no está habilitado para este servicio",
                code: "INVALID_BARBER",
                status: 400,
            };
        }

        selectedBarbers = [selected];
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
        .select("barber date type allDay start end isActive")
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

    const startMinutes = toMinutes(time);
    const endMinutes = startMinutes + Number(durationMinutes || 0);

    const availableBarbers = selectedBarbers.filter((barber) => {
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

        const insideSchedule = isSlotInsideIntervals(
            startMinutes,
            endMinutes,
            finalIntervals
        );

        if (!insideSchedule) return false;

        const barberAppointments = appointmentsByBarber.get(String(barber._id)) || [];

        const hasConflict = barberAppointments.some((appointment) =>
            appointmentConflictsSlot(appointment, startMinutes, endMinutes)
        );

        return !hasConflict;
    });

    return {
        ok: true,
        availableBarbers,
    };
}

export async function POST(req) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                {
                    error: "Debes iniciar sesión para reservar",
                    code: "UNAUTHORIZED",
                },
                { status: 401 }
            );
        }

        await connectMongoDB();

        const body = await req.json().catch(() => ({}));

        const serviceId = String(body?.serviceId || "").trim();
        const barberId = String(body?.barberId || "").trim();
        const date = String(body?.date || "").trim();
        const time = String(body?.time || "").trim();
        const notes = String(body?.notes || "").trim();

        if (!serviceId || !mongoose.Types.ObjectId.isValid(serviceId)) {
            return NextResponse.json(
                {
                    error: "El servicio es obligatorio y no es válido",
                    code: "INVALID_SERVICE",
                },
                { status: 400 }
            );
        }

        if (barberId && !mongoose.Types.ObjectId.isValid(barberId)) {
            return NextResponse.json(
                {
                    error: "El barbero no es válido",
                    code: "INVALID_BARBER",
                },
                { status: 400 }
            );
        }

        if (!date || !isValidDateString(date)) {
            return NextResponse.json(
                {
                    error: "La fecha es obligatoria y debe tener formato YYYY-MM-DD",
                    code: "INVALID_DATE",
                },
                { status: 400 }
            );
        }

        if (!time || !isValidTimeString(time)) {
            return NextResponse.json(
                {
                    error: "La hora es obligatoria y debe tener formato HH:MM",
                    code: "INVALID_TIME",
                },
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
        const minNoticeMinutes = Number(businessSettings.bookingMinNoticeMinutes || 0);
        const maxDaysAhead = Number(businessSettings.bookingMaxDaysAhead || 30);

        const nowTz = getNowInTimeZone(timezone);
        const today = nowTz.date;
        const maxAllowedDate = addDays(today, maxDaysAhead);

        if (date < today) {
            return NextResponse.json(
                {
                    error: "No se puede reservar en fechas pasadas",
                    code: "PAST_DATE",
                },
                { status: 400 }
            );
        }

        if (date > maxAllowedDate) {
            return NextResponse.json(
                {
                    error: "La fecha excede el máximo permitido para reservas",
                    code: "DATE_TOO_FAR",
                },
                { status: 400 }
            );
        }

        if (!slotPassesNotice(date, time, minNoticeMinutes)) {
            return NextResponse.json(
                {
                    error: "Ese horario ya no cumple la anticipación mínima",
                    code: "NOTICE_TOO_SHORT",
                },
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
                {
                    error: "Servicio no encontrado o inactivo",
                    code: "SERVICE_NOT_FOUND",
                },
                { status: 404 }
            );
        }

        const compatibleBarbers = (service.barbers || []).filter(
            (barber) => barber && barber.isActive
        );

        if (!compatibleBarbers.length) {
            return NextResponse.json(
                {
                    error: "Este servicio no tiene barberos activos disponibles",
                    code: "NO_BARBERS",
                },
                { status: 400 }
            );
        }

        const requestedStartAt = buildStartAt(date, time);
        const requestedEndAt = buildEndAt(date, time, service.durationMinutes);

        const activeAppointmentsCount = await Appointment.countDocuments({
            clientId: session.user.id,
            status: { $in: ACTIVE_CLIENT_STATUSES },
            startAt: { $gte: new Date() },
        });

        if (activeAppointmentsCount >= 2) {
            return NextResponse.json(
                {
                    error: "Solo puedes tener hasta 2 citas activas reservadas",
                    code: "MAX_ACTIVE_APPOINTMENTS_REACHED",
                },
                { status: 400 }
            );
        }

        const duplicateClientAppointment = await Appointment.findOne({
            clientId: session.user.id,
            status: { $in: ACTIVE_CLIENT_STATUSES },
            startAt: requestedStartAt,
        })
            .select("_id startAt")
            .lean();

        if (duplicateClientAppointment) {
            return NextResponse.json(
                {
                    error: "Ya tienes una cita reservada en ese horario",
                    code: "CLIENT_ALREADY_BOOKED_THIS_SLOT",
                },
                { status: 400 }
            );
        }

        const availability = await resolveAvailableBarbersForSlot({
            date,
            time,
            durationMinutes: service.durationMinutes,
            compatibleBarbers,
            requestedBarberId: barberId || null,
            businessSettings,
        });

        if (!availability.ok) {
            return NextResponse.json(
                {
                    error: availability.error,
                    code: availability.code,
                },
                { status: availability.status || 400 }
            );
        }

        if (!availability.availableBarbers.length) {
            return NextResponse.json(
                {
                    error: "El horario seleccionado ya no está disponible",
                    code: "SLOT_TAKEN",
                    shouldRefreshAvailability: true,
                },
                { status: 409 }
            );
        }

        let assignedBarber = availability.availableBarbers[0];

        const hasCollision = async (barberObjectId) => {
            return Appointment.findOne({
                barberId: barberObjectId,
                status: { $in: BLOCKING_STATUSES },
                startAt: { $lt: requestedEndAt },
                endAt: { $gt: requestedStartAt },
            })
                .select("_id barberId startAt endAt")
                .lean();
        };

        let collision = await hasCollision(assignedBarber._id);

        if (collision && !barberId) {
            assignedBarber = null;

            for (const barber of availability.availableBarbers) {
                const altCollision = await hasCollision(barber._id);
                if (!altCollision) {
                    assignedBarber = barber;
                    collision = null;
                    break;
                }
            }
        }

        if (!assignedBarber || collision) {
            return NextResponse.json(
                {
                    error: "El horario seleccionado ya no está disponible",
                    code: "SLOT_TAKEN",
                    shouldRefreshAvailability: true,
                },
                { status: 409 }
            );
        }

        const appointment = await Appointment.create({
            clientId: session.user.id,
            barberId: assignedBarber._id,
            serviceId: service._id,
            serviceName: service.name,
            startAt: requestedStartAt,
            durationMinutes: service.durationMinutes,
            price: service.price,
            status: "pending",
            paymentStatus: "unpaid",
            createdBy: session.user.id,
            source: "client-page",
            notes: notes.slice(0, 1000),
        });

        return NextResponse.json(
            {
                message: "Cita creada correctamente",
                appointment: {
                    id: appointment._id.toString(),
                    clientId: appointment.clientId?.toString?.() || session.user.id,
                    barberId: appointment.barberId?.toString?.() || null,
                    serviceId: appointment.serviceId?.toString?.() || serviceId,
                    serviceName: appointment.serviceName,
                    date,
                    time,
                    startAt: appointment.startAt,
                    endAt: appointment.endAt,
                    durationMinutes: appointment.durationMinutes,
                    price: appointment.price,
                    status: appointment.status,
                    paymentStatus: appointment.paymentStatus,
                    assignmentStatus: appointment.assignmentStatus,
                    source: appointment.source,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("POST /api/client/appointment error:", error);

        return NextResponse.json(
            {
                error: "No se pudo crear la cita",
                code: "CREATE_APPOINTMENT_ERROR",
            },
            { status: 500 }
        );
    }
}