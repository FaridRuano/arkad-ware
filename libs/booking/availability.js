import Appointment from "@models/Appointment";
import {
  applyExceptionsToRanges as applyScheduleExceptionsToRanges,
  combineDateAndMinutes,
  formatDateLocal,
  getScheduleExceptionsInRange,
  isValidDateString,
  isValidTimeHHMM,
  minutesToHHMM,
  parseDateLocal,
  parseTimeToMinutes,
} from "@libs/schedule/exceptions";

export {
  combineDateAndMinutes,
  formatDateLocal,
  isValidDateString,
  isValidTimeHHMM,
  minutesToHHMM,
  parseDateLocal,
  parseTimeToMinutes,
};

export const ACTIVE_APPOINTMENT_STATUSES = ["pending", "confirmed", "in_progress"];

export const pad = (n) => String(n).padStart(2, "0");

export const GUAYAQUIL_UTC_OFFSET_MINUTES = 5 * 60;

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

export const getConflictingAppointments = async ({ barberId, dateStr }) => {
  const startOfDay = parseDateLocal(dateStr);
  const endOfDay = parseDateLocal(dateStr);
  endOfDay.setHours(23, 59, 59, 999);

  return Appointment.find({
    $or: [{ barberId }, { "serviceSegments.barberId": barberId }],
    status: { $in: ACTIVE_APPOINTMENT_STATUSES },
    startAt: { $lt: endOfDay },
    endAt: { $gt: startOfDay },
  })
    .select("startAt endAt status barberId serviceSegments")
    .lean();
};

const utcToGuayaquilMinutes = (date) => {
  let hours = date.getUTCHours() - 5;
  if (hours < 0) hours += 24;
  return hours * 60 + date.getUTCMinutes();
};

export const removeBusyRanges = (ranges, appointments, barberId = null) => {
  let nextRanges = [...ranges];

  for (const appt of appointments) {
    const matchingSegments =
      barberId && Array.isArray(appt?.serviceSegments)
        ? appt.serviceSegments.filter(
            (segment) => String(segment?.barberId) === String(barberId)
          )
        : [];

    const busyBlocks = matchingSegments.length
      ? matchingSegments
      : String(appt?.barberId || "") === String(barberId || appt?.barberId || "")
        ? [{ startAt: appt.startAt, endAt: appt.endAt }]
        : [];

    for (const block of busyBlocks) {
      const start = new Date(block.startAt);
      const end = new Date(block.endAt);

      const startMinutes = utcToGuayaquilMinutes(start);
      const endMinutes = utcToGuayaquilMinutes(end);

      nextRanges = applyBlockRange(nextRanges, startMinutes, endMinutes);
    }
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
  exceptions = null,
  appointments = null,
}) => {
  const freeRanges = await getFreeRangesForDate({
    barberId,
    dateStr,
    businessSettings,
    barberSchedule,
    exceptions,
    appointments,
  });

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

export const getFreeRangesForDate = async ({
  barberId,
  dateStr,
  businessSettings,
  barberSchedule,
  exceptions = null,
  appointments = null,
}) => {
  const baseRanges = normalizeBaseRanges({
    businessSettings,
    barberSchedule,
    dateStr,
  });

  if (!baseRanges.length) return [];

  const relevantExceptions = Array.isArray(exceptions)
    ? exceptions
    : await getScheduleExceptionsInRange({
        startDate: dateStr,
        endDate: dateStr,
        barberId,
        activeOnly: true,
      });

  const rangesAfterExceptions = applyScheduleExceptionsToRanges({
    ranges: baseRanges,
    exceptions: relevantExceptions,
    dateStr,
    barberId,
  });
  if (!rangesAfterExceptions.length) return [];

  const busyAppointments = Array.isArray(appointments)
    ? appointments.filter((appointment) => {
        const appointmentDate = formatDateLocal(appointment?.startAt);
        return appointmentDate === dateStr;
      })
    : await getConflictingAppointments({ barberId, dateStr });
  const freeRanges = removeBusyRanges(rangesAfterExceptions, busyAppointments, barberId);
  return freeRanges;
};

const rangeContains = (ranges, start, end) =>
  ranges.some((range) => start >= range.start && end <= range.end);

const getPackageFreeRangesByItem = async ({
  packageItems,
  dateStr,
  businessSettings,
  exceptions,
  appointments,
}) => {
  const rangesByItem = [];

  for (const item of packageItems) {
    const ranges = await getFreeRangesForDate({
      barberId: item.barberId,
      dateStr,
      businessSettings,
      barberSchedule: item.barberSchedule,
      exceptions,
      appointments,
    });

    rangesByItem.push(ranges);
  }

  return rangesByItem;
};

export const getPackageAvailabilityForDate = async ({
  items,
  dateStr,
  businessSettings,
  exceptions = null,
  appointments = null,
}) => {
  const packageItems = Array.isArray(items) ? items : [];
  if (packageItems.length < 2) return [];

  const settings = businessSettings || getDefaultBusinessSettings();
  const rangesByItem = await getPackageFreeRangesByItem({
    packageItems,
    dateStr,
    businessSettings: settings,
    exceptions,
    appointments,
  });

  if (rangesByItem.some((ranges) => ranges.length === 0)) return [];

  const totalDuration = packageItems.reduce(
    (sum, item) => sum + Number(item.durationMinutes || 0),
    0
  );
  const packageSlots = [];
  const now = new Date();
  const minStartDateTime = new Date(
    now.getTime() + Number(settings.bookingMinNoticeMinutes || 0) * 60 * 1000
  );
  const intervalMinutes = Number(settings.slotIntervalMinutes || 30);

  for (const firstRange of rangesByItem[0]) {
    for (
      let packageStart = firstRange.start;
      packageStart + Number(packageItems[0].durationMinutes || 0) <= firstRange.end;
      packageStart += intervalMinutes
    ) {
      const startDate = combineDateAndMinutes(dateStr, packageStart);
      if (startDate < minStartDateTime) continue;

      let cursor = packageStart;
      const segments = [];
      let valid = true;

      for (let index = 0; index < packageItems.length; index++) {
        const item = packageItems[index];
        const endMinutes = cursor + Number(item.durationMinutes || 0);
        if (!rangeContains(rangesByItem[index], cursor, endMinutes)) {
          valid = false;
          break;
        }

        segments.push({
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          barberId: item.barberId,
          barberName: item.barberName || "",
          start: minutesToHHMM(cursor),
          end: minutesToHHMM(endMinutes),
          startAt: combineDateAndMinutes(dateStr, cursor),
          endAt: combineDateAndMinutes(dateStr, endMinutes),
          durationMinutes: Number(item.durationMinutes || 0),
          order: index + 1,
        });
        cursor = endMinutes;
      }

      if (!valid) continue;

      packageSlots.push({
        start: minutesToHHMM(packageStart),
        end: minutesToHHMM(packageStart + totalDuration),
        startAt: startDate,
        endAt: combineDateAndMinutes(dateStr, packageStart + totalDuration),
        segments,
      });
    }
  }

  return packageSlots;
};

const hasPackageAvailabilityForDate = async ({
  items,
  dateStr,
  businessSettings,
  exceptions = null,
  appointments = null,
}) => {
  const packageItems = Array.isArray(items) ? items : [];
  if (packageItems.length < 2) return false;

  const settings = businessSettings || getDefaultBusinessSettings();
  const rangesByItem = await getPackageFreeRangesByItem({
    packageItems,
    dateStr,
    businessSettings: settings,
    exceptions,
    appointments,
  });

  if (rangesByItem.some((ranges) => ranges.length === 0)) return false;

  const intervalMinutes = Number(settings.slotIntervalMinutes || 30);
  const now = new Date();
  const minStartDateTime = new Date(
    now.getTime() + Number(settings.bookingMinNoticeMinutes || 0) * 60 * 1000
  );

  for (const firstRange of rangesByItem[0]) {
    for (
      let packageStart = firstRange.start;
      packageStart + Number(packageItems[0].durationMinutes || 0) <= firstRange.end;
      packageStart += intervalMinutes
    ) {
      if (combineDateAndMinutes(dateStr, packageStart) < minStartDateTime) continue;

      let cursor = packageStart;
      let valid = true;

      for (let index = 0; index < packageItems.length; index++) {
        const endMinutes = cursor + Number(packageItems[index].durationMinutes || 0);
        if (!rangeContains(rangesByItem[index], cursor, endMinutes)) {
          valid = false;
          break;
        }
        cursor = endMinutes;
      }

      if (valid) return true;
    }
  }

  return false;
};

export const getAvailableDatesForPackage = async ({
  items,
  businessSettings,
}) => {
  const packageItems = Array.isArray(items) ? items : [];
  if (packageItems.length < 2) return [];

  const settings = businessSettings || getDefaultBusinessSettings();
  const maxDaysAhead = Number(settings.bookingMaxDaysAhead || 30);
  const today = new Date();
  const startDate = formatDateLocal(today);
  const endDate = formatDateLocal(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + Math.max(maxDaysAhead - 1, 0),
      0,
      0,
      0,
      0
    )
  );
  const barberIds = [
    ...new Set(packageItems.map((item) => String(item?.barberId || "")).filter(Boolean)),
  ];

  const [exceptions, appointments] = await Promise.all([
    getScheduleExceptionsInRange({
      startDate,
      endDate,
      activeOnly: true,
    }),
    Appointment.find({
      $or: [
        { barberId: { $in: barberIds } },
        { "serviceSegments.barberId": { $in: barberIds } },
      ],
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      startAt: { $lt: combineDateAndMinutes(endDate, 24 * 60) },
      endAt: { $gt: combineDateAndMinutes(startDate, 0) },
    })
      .select("startAt endAt status barberId serviceSegments")
      .lean(),
  ]);

  const dates = [];

  for (let offset = 0; offset < maxDaysAhead; offset++) {
    const current = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + offset,
      0,
      0,
      0,
      0
    );
    const dateStr = formatDateLocal(current);

    if (!isDateAllowedByMinNotice({ dateStr, businessSettings: settings })) {
      continue;
    }

    const hasAvailability = await hasPackageAvailabilityForDate({
      items: packageItems,
      dateStr,
      businessSettings: settings,
      exceptions,
      appointments,
    });

    if (hasAvailability) dates.push(dateStr);
  }

  return dates;
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

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const formatDateLabel = (dateStr) => {
  const date = parseDateLocal(dateStr);
  return `${DAY_LABELS[date.getDay()]} ${date.getDate()} ${MONTH_LABELS[date.getMonth()]}`;
};

export const getTodayStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
};

export const isSameLocalDate = (a, b) => {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

export const isDateAllowedByMinNotice = ({
  dateStr,
  businessSettings,
}) => {
  const minNoticeMinutes = Number(businessSettings?.bookingMinNoticeMinutes || 0);
  const date = parseDateLocal(dateStr);
  const now = new Date();
  const todayStart = getTodayStart();

  if (date < todayStart) return false;
  if (minNoticeMinutes <= 0) return true;

  if (isSameLocalDate(date, now)) {
    const minutesNow = now.getHours() * 60 + now.getMinutes();
    const latestReasonableStart = 24 * 60 - minNoticeMinutes;

    return minutesNow <= latestReasonableStart;
  }

  return true;
};

export const hasDayAvailabilityBySchedule = ({
  businessSettings,
  barberSchedule,
  dateStr,
}) => {
  const ranges = normalizeBaseRanges({
    businessSettings,
    barberSchedule,
    dateStr,
  });

  return ranges.length > 0;
};

export const getAvailableDatesForBarber = async ({
  service,
  barberId,
  businessSettings,
  barberSchedule,
}) => {
  const settings = businessSettings || getDefaultBusinessSettings();
  const maxDaysAhead = Number(settings.bookingMaxDaysAhead || 30);
  const today = new Date();
  const startDate = formatDateLocal(today);
  const endDate = formatDateLocal(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + Math.max(maxDaysAhead - 1, 0),
      0,
      0,
      0,
      0
    )
  );

  const [exceptions, appointments] = await Promise.all([
    getScheduleExceptionsInRange({
      startDate,
      endDate,
      barberId,
      activeOnly: true,
    }),
    Appointment.find({
      barberId,
      status: { $in: ACTIVE_APPOINTMENT_STATUSES },
      startAt: { $lt: combineDateAndMinutes(endDate, 24 * 60) },
      endAt: { $gt: combineDateAndMinutes(startDate, 0) },
    })
      .select("startAt endAt status barberId")
      .lean(),
  ]);

  const dates = [];

  for (let offset = 0; offset < maxDaysAhead; offset++) {
    const current = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + offset,
      0,
      0,
      0,
      0
    );

    const dateStr = formatDateLocal(current);

    if (
      !isDateAllowedByMinNotice({
        dateStr,
        businessSettings: settings,
      })
    ) {
      continue;
    }

    const slots = await getAvailabilityForDate({
      service: {
        durationMinutes:
          Number(service?.durationMinutes || 0) ||
          Number(settings.slotIntervalMinutes || 30),
      },
      barberId,
      dateStr,
      businessSettings: settings,
      barberSchedule,
      exceptions,
      appointments,
    });

    if (slots.length > 0) {
      dates.push(dateStr);
    }
  }

  return dates;
};
