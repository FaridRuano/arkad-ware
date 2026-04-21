import mongoose from "mongoose";

import Appointment from "@models/Appointment";
import Barber from "@models/Barber";
import ScheduleException from "@models/ScheduleException";

export const SCHEDULE_APPOINTMENT_CONFLICT_STATUSES = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "no_assistance",
];

export const EXCEPTION_SCOPE = {
  BUSINESS: "business",
  BARBER: "barber",
};

export const EXCEPTION_TYPE = {
  FULL_DAY: "full_day",
  TIME_RANGE: "time_range",
};

export function isValidDateString(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

export function isValidTimeHHMM(value = "") {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value || "").trim());
}

export function pad(value) {
  return String(value).padStart(2, "0");
}

export function parseTimeToMinutes(value = "") {
  if (!isValidTimeHHMM(value)) return null;
  const [hh, mm] = String(value).split(":").map(Number);
  return hh * 60 + mm;
}

export function minutesToHHMM(minutes = 0) {
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  return `${pad(hh)}:${pad(mm)}`;
}

export function parseDateLocal(dateStr) {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0));
}

export function formatDateLocal(date) {
  const safe = new Date(date);
  return `${safe.getUTCFullYear()}-${pad(safe.getUTCMonth() + 1)}-${pad(safe.getUTCDate())}`;
}

export function combineDateAndMinutes(dateStr, minutes) {
  const [year, month, day] = String(dateStr).split("-").map(Number);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return new Date(Date.UTC(year, month - 1, day, hours + 5, mins, 0, 0));
}

export function getDayStartDateUTC(dateStr) {
  return combineDateAndMinutes(dateStr, 0);
}

export function getDayEndDateUTC(dateStr) {
  return combineDateAndMinutes(dateStr, 24 * 60);
}

export function getExceptionDayStrings(exception) {
  const days = [];
  if (!exception?.startDate || !exception?.endDate) return days;

  const current = parseDateLocal(formatDateLocal(exception.startDate));
  const end = parseDateLocal(formatDateLocal(exception.endDate));

  while (current.getTime() <= end.getTime()) {
    days.push(formatDateLocal(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return days;
}

export function normalizeExceptionDocument(exception) {
  if (!exception) return null;

  const scope = String(exception.scope || EXCEPTION_SCOPE.BUSINESS);
  const type = String(exception.type || EXCEPTION_TYPE.FULL_DAY);
  const barberId = exception?.barberId?.toString?.() ?? exception?.barberId ?? null;
  const startDate = formatDateLocal(exception.startDate);
  const endDate = formatDateLocal(exception.endDate);

  return {
    id: exception?._id?.toString?.() ?? exception?.id ?? null,
    scope,
    barberId,
    type,
    startDate,
    endDate,
    startTime: exception?.startTime || "",
    endTime: exception?.endTime || "",
    reason: exception?.reason || "",
    isActive: exception?.isActive !== false,
    createdBy: exception?.createdBy?.toString?.() ?? exception?.createdBy ?? null,
    deactivatedBy:
      exception?.deactivatedBy?.toString?.() ?? exception?.deactivatedBy ?? null,
    deactivatedAt: exception?.deactivatedAt ?? null,
    createdAt: exception?.createdAt ?? null,
    updatedAt: exception?.updatedAt ?? null,
  };
}

export async function getScheduleExceptionsInRange({
  startDate,
  endDate,
  barberId = null,
  scope = "",
  activeOnly = true,
} = {}) {
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    return [];
  }

  const query = {
    startDate: { $lt: getDayEndDateUTC(endDate) },
    endDate: { $gte: getDayStartDateUTC(startDate) },
  };

  if (activeOnly) {
    query.isActive = true;
  }

  if (scope) {
    query.scope = scope;
  } else if (barberId) {
    query.$or = [
      { scope: EXCEPTION_SCOPE.BUSINESS },
      { scope: EXCEPTION_SCOPE.BARBER, barberId: new mongoose.Types.ObjectId(barberId) },
    ];
  }

  if (scope === EXCEPTION_SCOPE.BARBER && barberId) {
    query.barberId = new mongoose.Types.ObjectId(barberId);
  }

  const docs = await ScheduleException.find(query)
    .sort({ startDate: 1, startTime: 1, createdAt: -1 })
    .lean();

  return docs.map(normalizeExceptionDocument).filter(Boolean);
}

export function exceptionAppliesToDate(exception, dateStr) {
  if (!exception?.isActive) return false;
  if (!isValidDateString(dateStr)) return false;
  return dateStr >= exception.startDate && dateStr <= exception.endDate;
}

export function getExceptionsForDate({
  exceptions = [],
  dateStr,
  barberId = null,
} = {}) {
  return (Array.isArray(exceptions) ? exceptions : []).filter((exception) => {
    if (!exceptionAppliesToDate(exception, dateStr)) return false;
    if (exception.scope === EXCEPTION_SCOPE.BUSINESS) return true;
    return String(exception.barberId || "") === String(barberId || "");
  });
}

export function isDateBlockedByException({
  exceptions = [],
  dateStr,
  barberId = null,
} = {}) {
  return getExceptionsForDate({ exceptions, dateStr, barberId }).some(
    (exception) => exception.type === EXCEPTION_TYPE.FULL_DAY
  );
}

export function isTimeBlockedByException({
  exceptions = [],
  dateStr,
  startMinutes,
  endMinutes,
  barberId = null,
} = {}) {
  const relevant = getExceptionsForDate({ exceptions, dateStr, barberId });

  return relevant.some((exception) => {
    if (exception.type === EXCEPTION_TYPE.FULL_DAY) return true;

    const blockedStart = parseTimeToMinutes(exception.startTime);
    const blockedEnd = parseTimeToMinutes(exception.endTime);

    if (blockedStart == null || blockedEnd == null) return false;
    return startMinutes < blockedEnd && endMinutes > blockedStart;
  });
}

export function slotConflictsWithException({
  exceptions = [],
  dateStr,
  startMinutes,
  endMinutes,
  barberId = null,
} = {}) {
  return isTimeBlockedByException({
    exceptions,
    dateStr,
    startMinutes,
    endMinutes,
    barberId,
  });
}

export function applyExceptionsToRanges({
  ranges = [],
  exceptions = [],
  dateStr,
  barberId = null,
} = {}) {
  if (isDateBlockedByException({ exceptions, dateStr, barberId })) {
    return [];
  }

  let nextRanges = [...ranges];
  const relevant = getExceptionsForDate({ exceptions, dateStr, barberId }).filter(
    (exception) => exception.type === EXCEPTION_TYPE.TIME_RANGE
  );

  for (const exception of relevant) {
    const blockStart = parseTimeToMinutes(exception.startTime);
    const blockEnd = parseTimeToMinutes(exception.endTime);

    if (blockStart == null || blockEnd == null) continue;

    nextRanges = nextRanges.flatMap((range) => {
      if (blockEnd <= range.start || blockStart >= range.end) {
        return [range];
      }

      const split = [];

      if (blockStart > range.start) {
        split.push({ start: range.start, end: blockStart });
      }

      if (blockEnd < range.end) {
        split.push({ start: blockEnd, end: range.end });
      }

      return split;
    });
  }

  return nextRanges
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);
}

export function buildExceptionPayload(input = {}) {
  const scope = String(input.scope || "").trim();
  const type = String(input.type || "").trim();
  const barberId = input.barberId ? String(input.barberId).trim() : "";
  const startDate = String(input.startDate || "").trim();
  const endDate = String(input.endDate || startDate || "").trim();
  const startTime = String(input.startTime || "").trim();
  const endTime = String(input.endTime || "").trim();
  const reason = String(input.reason || "").trim();

  if (![EXCEPTION_SCOPE.BUSINESS, EXCEPTION_SCOPE.BARBER].includes(scope)) {
    throw new Error("scope inválido");
  }

  if (![EXCEPTION_TYPE.FULL_DAY, EXCEPTION_TYPE.TIME_RANGE].includes(type)) {
    throw new Error("type inválido");
  }

  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    throw new Error("Las fechas deben tener formato YYYY-MM-DD");
  }

  if (startDate > endDate) {
    throw new Error("La fecha inicial no puede ser mayor que la fecha final");
  }

  if (scope === EXCEPTION_SCOPE.BARBER) {
    if (!barberId || !mongoose.Types.ObjectId.isValid(barberId)) {
      throw new Error("barberId es obligatorio y debe ser válido para excepciones por barbero");
    }
  }

  if (type === EXCEPTION_TYPE.TIME_RANGE) {
    if (!isValidTimeHHMM(startTime) || !isValidTimeHHMM(endTime)) {
      throw new Error("startTime y endTime deben tener formato HH:MM");
    }

    if (startTime >= endTime) {
      throw new Error("La hora inicial debe ser menor que la hora final");
    }
  }

  return {
    scope,
    barberId: scope === EXCEPTION_SCOPE.BARBER ? barberId : null,
    type,
    startDate,
    endDate,
    startTime: type === EXCEPTION_TYPE.TIME_RANGE ? startTime : "",
    endTime: type === EXCEPTION_TYPE.TIME_RANGE ? endTime : "",
    reason,
  };
}

export function appointmentConflictsWithExceptionPayload({
  appointment,
  exception,
} = {}) {
  if (!appointment || !exception) return false;

  const appointmentStatus = String(appointment.status || "");
  if (!SCHEDULE_APPOINTMENT_CONFLICT_STATUSES.includes(appointmentStatus)) {
    return false;
  }

  const appointmentDate = formatDateLocal(appointment.startAt);

  if (!exceptionAppliesToDate({ ...exception, isActive: true }, appointmentDate)) {
    return false;
  }

  if (exception.scope === EXCEPTION_SCOPE.BARBER) {
    const appointmentBarberId =
      appointment?.barberId?.toString?.() ?? appointment?.barberId ?? null;

    if (String(appointmentBarberId || "") !== String(exception.barberId || "")) {
      return false;
    }
  }

  if (exception.type === EXCEPTION_TYPE.FULL_DAY) {
    return true;
  }

  const startDate = new Date(appointment.startAt);
  const endDate = new Date(appointment.endAt);
  const startMinutes = (startDate.getUTCHours() - 5) * 60 + startDate.getUTCMinutes();
  const endMinutes = (endDate.getUTCHours() - 5) * 60 + endDate.getUTCMinutes();

  return slotConflictsWithException({
    exceptions: [exception],
    dateStr: appointmentDate,
    startMinutes,
    endMinutes,
    barberId:
      appointment?.barberId?.toString?.() ?? appointment?.barberId ?? null,
  });
}

export async function findConflictingAppointmentsForException(payload = {}) {
  const exception = buildExceptionPayload(payload);

  const query = {
    status: { $in: SCHEDULE_APPOINTMENT_CONFLICT_STATUSES },
    startAt: { $lt: getDayEndDateUTC(exception.endDate) },
    endAt: { $gt: getDayStartDateUTC(exception.startDate) },
  };

  if (exception.scope === EXCEPTION_SCOPE.BARBER) {
    query.barberId = new mongoose.Types.ObjectId(exception.barberId);
  }

  const appointments = await Appointment.find(query)
    .select("_id barberId startAt endAt durationMinutes serviceDurationMinutes status serviceName clientId")
    .lean();

  return appointments.filter((appointment) =>
    appointmentConflictsWithExceptionPayload({ appointment, exception })
  );
}

export async function attachBarberMetaToExceptions(exceptions = []) {
  const barberIds = [...new Set(
    (Array.isArray(exceptions) ? exceptions : [])
      .map((item) => item?.barberId)
      .filter((value) => mongoose.Types.ObjectId.isValid(value))
  )];

  if (!barberIds.length) {
    return exceptions.map((exception) => ({
      ...exception,
      barber: null,
    }));
  }

  const barbers = await Barber.find({ _id: { $in: barberIds } })
    .select("_id name color")
    .lean();

  const map = new Map(
    barbers.map((barber) => [
      barber?._id?.toString?.() ?? barber?._id,
      {
        id: barber?._id?.toString?.() ?? barber?._id,
        name: barber?.name ?? "Barbero",
        color: barber?.color || "#000000",
      },
    ])
  );

  return exceptions.map((exception) => ({
    ...exception,
    barber: exception?.barberId ? map.get(String(exception.barberId)) || null : null,
  }));
}
