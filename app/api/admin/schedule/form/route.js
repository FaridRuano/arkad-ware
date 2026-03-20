import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";
import Barber from "@models/Barber";
import Service from "@models/Service";
import BarberSchedule from "@models/BarberSchedule";
import BusinessSettings from "@models/BusinessSettings";
import { auth } from "@auth";

function buildStartAt({ startAt, date, time }) {
  if (startAt && typeof startAt === "string") {
    return startAt;
  }

  if (
    date &&
    time &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    /^\d{2}:\d{2}$/.test(time)
  ) {
    return `${date}T${time}:00-05:00`;
  }

  return "";
}

function toId(value) {
  return value?.toString?.() ?? value ?? null;
}

function parseTimeToMinutes(value = "") {
  const str = String(value || "").trim();
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(str)) return null;

  const [hh, mm] = str.split(":").map(Number);
  return hh * 60 + mm;
}

function getMinutesFromDate(date) {
  if (!date || Number.isNaN(new Date(date).getTime())) return null;
  const d = new Date(date);
  return d.getHours() * 60 + d.getMinutes();
}

function getDayNumberFromDate(date) {
  if (!date || Number.isNaN(new Date(date).getTime())) return null;
  return new Date(date).getDay(); // 0 domingo ... 6 sábado
}

function getBusinessRangeForDay(businessSettings, dayNumber) {
  if (!businessSettings?.generalSchedule || dayNumber == null) return null;

  let range = null;

  if (dayNumber === 0) range = businessSettings.generalSchedule?.sunday || null;
  else if (dayNumber === 6) range = businessSettings.generalSchedule?.saturday || null;
  else range = businessSettings.generalSchedule?.weekdays || null;

  if (!range?.enabled || !range?.start || !range?.end) return null;

  const start = parseTimeToMinutes(range.start);
  const end = parseTimeToMinutes(range.end);

  if (start == null || end == null || start >= end) return null;

  return {
    source: "business",
    start,
    end,
    breakStart: null,
    breakEnd: null,
  };
}

function getBarberRangeForDay(barberSchedule, dayNumber) {
  if (!barberSchedule?.isActive || !Array.isArray(barberSchedule?.weekSchedule)) {
    return null;
  }

  const dayConfig = barberSchedule.weekSchedule.find((item) => item?.day === dayNumber);

  if (!dayConfig?.enabled || !dayConfig?.start || !dayConfig?.end) {
    return null;
  }

  const start = parseTimeToMinutes(dayConfig.start);
  const end = parseTimeToMinutes(dayConfig.end);
  const breakStart = parseTimeToMinutes(dayConfig.breakStart);
  const breakEnd = parseTimeToMinutes(dayConfig.breakEnd);

  if (start == null || end == null || start >= end) return null;

  return {
    source: "barber",
    start,
    end,
    breakStart:
      breakStart != null &&
      breakEnd != null &&
      breakStart < breakEnd &&
      breakStart > start &&
      breakEnd < end
        ? breakStart
        : null,
    breakEnd:
      breakStart != null &&
      breakEnd != null &&
      breakStart < breakEnd &&
      breakStart > start &&
      breakEnd < end
        ? breakEnd
        : null,
  };
}

function resolveEffectiveRange({ barberSchedule, businessSettings, dayNumber }) {
  const barberRange = getBarberRangeForDay(barberSchedule, dayNumber);
  const businessRange = getBusinessRangeForDay(businessSettings, dayNumber);

  if (barberRange) return barberRange;

  const useFallback = barberSchedule?.useBusinessHoursAsFallback !== false;
  if (useFallback && businessRange) return businessRange;

  return null;
}

function isInsideBreak(startMinutes, endMinutes, breakStart, breakEnd) {
  if (breakStart == null || breakEnd == null) return false;
  return startMinutes < breakEnd && endMinutes > breakStart;
}

export async function POST(req) {
  try {
    const session = await auth();

    const adminId = session?.user?.id;
    const role = session?.user?.role;

    if (!adminId) {
      return NextResponse.json(
        { error: true, message: "Unauthorized" },
        { status: 401 }
      );
    }

    if (role !== "admin") {
      return NextResponse.json(
        { error: true, message: "Forbidden" },
        { status: 403 }
      );
    }

    await connectMongoDB();

    const body = await req.json().catch(() => ({}));

    const rawServiceId = String(body?.serviceId || "").trim();
    const rawBarberId = String(body?.barberId || "").trim();

    const startAtStr = buildStartAt({
      startAt: body?.startAt,
      date: body?.date,
      time: body?.time,
    });

    const hasServiceId = !!rawServiceId;
    const hasBarberId = !!rawBarberId;
    const hasStartAt = !!startAtStr;

    const validation = {
      startAtValid: false,
      serviceValid: !hasServiceId,
      barberValid: !hasBarberId,
      canSubmit: false,
    };

    const errors = [];
    const warnings = [];

    let parsedStartAt = null;
    let parsedEndAt = null;
    let selectedService = null;
    let selectedBarber = null;

    // 1) Validar hora
    if (hasStartAt) {
      parsedStartAt = new Date(startAtStr);

      if (Number.isNaN(parsedStartAt.getTime())) {
        errors.push("startAt inválido");
      } else {
        validation.startAtValid = true;
      }
    } else {
      warnings.push("Aún no se ha seleccionado una fecha y hora válidas");
    }

    // 2) Validar serviceId si viene
    if (hasServiceId && !mongoose.Types.ObjectId.isValid(rawServiceId)) {
      errors.push("serviceId inválido");
    }

    // 3) Validar barberId si viene
    if (hasBarberId && !mongoose.Types.ObjectId.isValid(rawBarberId)) {
      errors.push("barberId inválido");
    }

    if (errors.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          errors,
          warnings,
          validation,
          service: null,
          selectedBarber: null,
          barbers: [],
        },
        { status: 400 }
      );
    }

    // 4) Cargar servicio si existe
    if (hasServiceId) {
      const service = await Service.findById(rawServiceId)
        .select("_id name durationMinutes price isActive barbers color")
        .lean();

      if (!service) {
        errors.push("Servicio no encontrado");
        validation.serviceValid = false;
      } else if (service.isActive === false) {
        errors.push("Este servicio está inactivo");
        validation.serviceValid = false;
      } else {
        validation.serviceValid = true;

        selectedService = {
          id: toId(service._id),
          name: service.name ?? "—",
          durationMinutes: Number(service.durationMinutes || 0),
          price: Number(service.price || 0),
          color: service.color || "#CFB690",
          allowedBarberIds: Array.isArray(service.barbers)
            ? service.barbers.map((id) => toId(id))
            : [],
        };

        if (validation.startAtValid && selectedService.durationMinutes > 0) {
          parsedEndAt = new Date(
            parsedStartAt.getTime() + selectedService.durationMinutes * 60 * 1000
          );
        }
      }
    }

    // 5) Traer barberos activos
    const activeBarbers = await Barber.find({ isActive: true })
      .sort({ name: 1, createdAt: 1 })
      .select("_id name color isActive")
      .lean();

    // 6) Horarios
    const [businessSettings, barberSchedules] = await Promise.all([
      BusinessSettings.findOne({ isActive: true })
        .sort({ createdAt: -1 })
        .lean(),
      BarberSchedule.find({
        barber: { $in: activeBarbers.map((b) => b._id) },
        isActive: true,
      })
        .select("_id barber weekSchedule useBusinessHoursAsFallback isActive")
        .lean(),
    ]);

    const barberScheduleMap = new Map(
      barberSchedules.map((item) => [toId(item.barber), item])
    );

    // 7) Si hay startAt + service => consultar conflictos
    let conflictsMap = new Map();

    if (
      validation.startAtValid &&
      selectedService &&
      parsedEndAt instanceof Date &&
      !Number.isNaN(parsedEndAt.getTime())
    ) {
      const excludedStatuses = ["cancelled", "no_assistance"];

      const conflicts = await Appointment.find({
        barberId: { $in: activeBarbers.map((b) => b._id) },
        status: { $nin: excludedStatuses },
        startAt: { $lt: parsedEndAt },
        endAt: { $gt: parsedStartAt },
      })
        .select("_id barberId startAt endAt durationMinutes status serviceName")
        .lean();

      conflictsMap = new Map(
        conflicts.map((c) => [
          toId(c.barberId),
          {
            id: toId(c._id),
            startAt: c.startAt ?? null,
            endAt: c.endAt ?? null,
            durationMinutes: c.durationMinutes ?? 0,
            status: c.status ?? "",
            serviceName: c.serviceName ?? "",
          },
        ])
      );
    }

    // 8) Construir lista de barberos con compatibilidad + disponibilidad + horario real
    const barbers = activeBarbers.map((barber) => {
      const barberId = toId(barber._id);

      const compatible = selectedService
        ? selectedService.allowedBarberIds.includes(barberId)
        : true;

      const conflict = conflictsMap.get(barberId) || null;

      const dayNumber = validation.startAtValid ? getDayNumberFromDate(parsedStartAt) : null;
      const appointmentStartMinutes = validation.startAtValid
        ? getMinutesFromDate(parsedStartAt)
        : null;
      const appointmentEndMinutes =
        validation.startAtValid && parsedEndAt
          ? getMinutesFromDate(parsedEndAt)
          : null;

      const barberSchedule = barberScheduleMap.get(barberId) || null;
      const effectiveRange =
        dayNumber != null
          ? resolveEffectiveRange({
              barberSchedule,
              businessSettings,
              dayNumber,
            })
          : null;

      const worksThisDay = !!effectiveRange;
      const insideWorkingHours =
        worksThisDay &&
        appointmentStartMinutes != null &&
        appointmentEndMinutes != null &&
        appointmentStartMinutes >= effectiveRange.start &&
        appointmentEndMinutes <= effectiveRange.end;

      const insideBreak =
        worksThisDay &&
        appointmentStartMinutes != null &&
        appointmentEndMinutes != null &&
        isInsideBreak(
          appointmentStartMinutes,
          appointmentEndMinutes,
          effectiveRange?.breakStart ?? null,
          effectiveRange?.breakEnd ?? null
        );

      const available =
        compatible &&
        !conflict &&
        worksThisDay &&
        insideWorkingHours &&
        !insideBreak;

      let reason = "";

      if (!compatible) {
        reason = "No realiza este servicio";
      } else if (!worksThisDay) {
        reason = "No trabaja este día";
      } else if (!insideWorkingHours) {
        reason = "Fuera del horario laboral";
      } else if (insideBreak) {
        reason = "Horario dentro del descanso";
      } else if (conflict) {
        reason = "Horario ocupado";
      }

      return {
        id: barberId,
        name: barber.name ?? "—",
        color: barber.color || "#000000",

        compatible,
        available,
        enabled: available,
        reason,
        conflict,

        schedule: effectiveRange
          ? {
              source: effectiveRange.source,
              start: effectiveRange.start,
              end: effectiveRange.end,
              breakStart: effectiveRange.breakStart,
              breakEnd: effectiveRange.breakEnd,
            }
          : null,
      };
    });

    // 9) Validar barbero seleccionado solo si viene uno
    if (hasBarberId) {
      const barber = barbers.find((b) => b.id === rawBarberId);

      if (!barber) {
        errors.push("Barbero no encontrado o inactivo");
        validation.barberValid = false;
      } else if (!barber.compatible) {
        errors.push("Este barbero no tiene asignado el servicio seleccionado");
        validation.barberValid = false;
      } else if (!barber.enabled) {
        errors.push(barber.reason || "Este barbero no está disponible en ese horario");
        validation.barberValid = false;
      } else {
        validation.barberValid = true;
        selectedBarber = {
          id: barber.id,
          name: barber.name,
          color: barber.color,
          compatible: barber.compatible,
          available: barber.available,
          enabled: barber.enabled,
          reason: barber.reason,
        };
      }
    } else {
      validation.barberValid = true;
      selectedBarber = null;
    }

    if (!hasServiceId) {
      warnings.push(
        "Selecciona un servicio para calcular duración y disponibilidad real"
      );
    }

    if (!hasBarberId) {
      warnings.push("La cita puede crearse sin barbero y asignarse después");
    }

    validation.canSubmit =
      validation.startAtValid &&
      validation.serviceValid &&
      validation.barberValid &&
      errors.length === 0;

    return NextResponse.json(
      {
        ok: errors.length === 0,
        errors,
        warnings,

        startAt: parsedStartAt,
        endAt: parsedEndAt,

        service: selectedService
          ? {
              id: selectedService.id,
              name: selectedService.name,
              durationMinutes: selectedService.durationMinutes,
              price: selectedService.price,
              color: selectedService.color,
            }
          : null,

        selectedBarber,
        barbers,
        validation,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /admin/schedule/form error:", err);

    return NextResponse.json(
      { error: err?.message || "Error validando formulario de agenda" },
      { status: 500 }
    );
  }
}