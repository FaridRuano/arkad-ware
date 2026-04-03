import Appointment from "@models/Appointment";
import ScheduleException from "@models/ScheduleException";

export const ACTIVE_APPOINTMENT_STATUSES = ["pending", "confirmed", "in_progress"];

export const isValidDateString = (value = "") =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(value));

export const isValidTimeHHMM = (value = "") =>
  /^([01]\d|2[0-3]):([0-5]\d)$/.test(String(value));

export const pad = (n) => String(n).padStart(2, "0");

export const parseDateLocal = (dateStr) => {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

export const formatDateLocal = (date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

export const parseTimeToMinutes = (time) => {
  const [h, m] = String(time || "00:00").split(":").map(Number);
  return h * 60 + m;
};

export const minutesToHHMM = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${pad(h)}:${pad(m)}`;
};

export const combineDateAndMinutes = (dateStr, minutes) => {
  const date = parseDateLocal(dateStr);
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date;
};

export const getBusinessRangeForDay = (businessSettings, dayIndex) => {
  if (!businessSettings?.generalSchedule) return null;

  if (dayIndex >= 1 && dayIndex <= 5) return businessSettings.generalSchedule.weekdays || null;
  if (dayIndex === 6) return businessSettings.generalSchedule.saturday || null;
  return businessSettings.generalSchedule.sunday || null;
};

export const getBarberDaySchedule = (barberSchedule, dayIndex) => {
  if (!barberSchedule?.weekSchedule || !Array.isArray(barberSchedule.weekSchedule)) {
    return null;
  }

  return (
    barberSchedule.weekSchedule.find((item) => Number(item.day) === Number(dayIndex)) || null
  );
};

export const normalizeBaseRanges = ({ businessSettings, barberSchedule, dateStr }) => {
  const date = parseDateLocal(dateStr);
  const dayIndex = date.getDay();

  const barberDay = getBarberDaySchedule(barberSchedule, dayIndex);
  const businessDay = getBusinessRangeForDay(businessSettings, dayIndex);

  let source = null;

  if (barberSchedule?.isActive !== false && barberDay?.enabled) {
    source = {
      enabled: true,
      start: barberDay.start,
      end: barberDay.end,
      breakStart: barberDay.breakStart || "",
      breakEnd: barberDay.breakEnd || "",
    };
  } else if (barberSchedule?.useBusinessHoursAsFallback && businessDay?.enabled) {
    source = {
      enabled: true,
      start: businessDay.start,
      end: businessDay.end,
      breakStart: "",
      breakEnd: "",
    };
  } else if (!barberSchedule && businessDay?.enabled) {
    source = {
      enabled: true,
      start: businessDay.start,
      end: businessDay.end,
      breakStart: "",
      breakEnd: "",
    };
  }

  if (!source?.enabled || !source.start || !source.end) {
    return [];
  }

  const ranges = [
    {
      start: parseTimeToMinutes(source.start),
      end: parseTimeToMinutes(source.end),
    },
  ];

  if (source.breakStart && source.breakEnd) {
    const breakStart = parseTimeToMinutes(source.breakStart);
    const breakEnd = parseTimeToMinutes(source.breakEnd);

    return ranges.flatMap((range) => {
      const result = [];

      if (breakStart > range.start) {
        result.push({ start: range.start, end: breakStart });
      }

      if (breakEnd < range.end) {
        result.push({ start: breakEnd, end: range.end });
      }

      return result;
    });
  }

  return ranges;
};

export const applyBlockRange = (ranges, blockStart, blockEnd) => {
  return ranges.flatMap((range) => {
    if (blockEnd <= range.start || blockStart >= range.end) {
      return [range];
    }

    const result = [];

    if (blockStart > range.start) {
      result.push({ start: range.start, end: blockStart });
    }

    if (blockEnd < range.end) {
      result.push({ start: blockEnd, end: range.end });
    }

    return result;
  });
};

export const applyOpenRange = (ranges, openStart, openEnd) => {
  const next = [...ranges, { start: openStart, end: openEnd }]
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);

  if (!next.length) return [];

  const merged = [next[0]];

  for (let i = 1; i < next.length; i++) {
    const current = next[i];
    const last = merged[merged.length - 1];

    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
};

export const applyExceptionsToRanges = (ranges, exceptions) => {
  let nextRanges = [...ranges];

  const sorted = [...exceptions].sort((a, b) => {
    if (a.type === b.type) return 0;
    return a.type === "block" ? -1 : 1;
  });

  for (const exception of sorted) {
    if (exception.allDay) {
      if (exception.type === "block") {
        nextRanges = [];
      }
      continue;
    }

    const start = parseTimeToMinutes(exception.start);
    const end = parseTimeToMinutes(exception.end);

    if (exception.type === "block") {
      nextRanges = applyBlockRange(nextRanges, start, end);
    } else if (exception.type === "open") {
      nextRanges = applyOpenRange(nextRanges, start, end);
    }
  }

  return nextRanges
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);
};

export const getConflictingAppointments = async ({ barberId, dateStr }) => {
  const startOfDay = parseDateLocal(dateStr);
  const endOfDay = parseDateLocal(dateStr);
  endOfDay.setHours(23, 59, 59, 999);

  return Appointment.find({
    barberId,
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    startAt: { $lt: endOfDay },
    endAt: { $gt: startOfDay },
  })
    .select("startAt endAt status")
    .lean();
};

export const removeBusyRanges = (ranges, appointments) => {
  let nextRanges = [...ranges];

  for (const appt of appointments) {
    const start = new Date(appt.startAt);
    const end = new Date(appt.endAt);

    const startMinutes = start.getHours() * 60 + start.getMinutes();
    const endMinutes = end.getHours() * 60 + end.getMinutes();

    nextRanges = applyBlockRange(nextRanges, startMinutes, endMinutes);
  }

  return nextRanges.filter((range) => range.end > range.start);
};

export const buildSlots = ({
  dateStr,
  ranges,
  durationMinutes,
  intervalMinutes,
  minStartDateTime,
}) => {
  const slots = [];

  for (const range of ranges) {
    for (
      let start = range.start;
      start + durationMinutes <= range.end;
      start += intervalMinutes
    ) {
      const startDate = combineDateAndMinutes(dateStr, start);
      const endDate = combineDateAndMinutes(dateStr, start + durationMinutes);

      if (startDate < minStartDateTime) continue;

      slots.push({
        start: minutesToHHMM(start),
        end: minutesToHHMM(start + durationMinutes),
        startAt: startDate,
        endAt: endDate,
      });
    }
  }

  return slots;
};

export const getAvailabilityForDate = async ({
  service,
  barberId,
  dateStr,
  businessSettings,
  barberSchedule,
}) => {
  const baseRanges = normalizeBaseRanges({
    businessSettings,
    barberSchedule,
    dateStr,
  });

  if (!baseRanges.length) return [];

  const exceptions = await ScheduleException.find({
    isActive: true,
    date: dateStr,
    $or: [{ barber: null }, { barber: barberId }],
  })
    .select("type allDay start end barber")
    .lean();

  const rangesAfterExceptions = applyExceptionsToRanges(baseRanges, exceptions);
  if (!rangesAfterExceptions.length) return [];

  const busyAppointments = await getConflictingAppointments({ barberId, dateStr });
  const freeRanges = removeBusyRanges(rangesAfterExceptions, busyAppointments);
  if (!freeRanges.length) return [];

  const now = new Date();
  const minStartDateTime = new Date(
    now.getTime() + Number(businessSettings.bookingMinNoticeMinutes || 0) * 60 * 1000
  );

  return buildSlots({
    dateStr,
    ranges: freeRanges,
    durationMinutes: Number(service.durationMinutes),
    intervalMinutes: Number(businessSettings.slotIntervalMinutes || 30),
    minStartDateTime,
  });
};

export const getDefaultBusinessSettings = () => ({
  timezone: "America/Guayaquil",
  slotIntervalMinutes: 30,
  bookingMinNoticeMinutes: 60,
  bookingMaxDaysAhead: 30,
  generalSchedule: {
    weekdays: { enabled: true, start: "09:00", end: "18:00" },
    saturday: { enabled: true, start: "09:00", end: "14:00" },
    sunday: { enabled: false, start: "", end: "" },
  },
});