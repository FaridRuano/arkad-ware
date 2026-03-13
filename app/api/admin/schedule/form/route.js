import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";
import Barber from "@models/Barber";
import Service from "@models/Service";
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

        if (
          validation.startAtValid &&
          selectedService.durationMinutes > 0
        ) {
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

    // 6) Si hay startAt + service => consultar conflictos
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

    // 7) Construir lista de barberos con compatibilidad + disponibilidad
    const barbers = activeBarbers.map((barber) => {
      const barberId = toId(barber._id);

      const compatible = selectedService
        ? selectedService.allowedBarberIds.includes(barberId)
        : true;

      const conflict = conflictsMap.get(barberId) || null;
      const available = compatible && !conflict;

      let reason = "";

      if (!compatible) {
        reason = "No realiza este servicio";
      } else if (conflict) {
        reason = "Horario ocupado";
      }

      return {
        id: barberId,
        name: barber.name ?? "—",
        color: barber.color || "#000000",
        compatible,
        available,
        enabled: compatible && available,
        reason,
        conflict,
      };
    });

    // 8) Validar barbero seleccionado
    if (hasBarberId) {
      const barber = barbers.find((b) => b.id === rawBarberId);

      if (!barber) {
        errors.push("Barbero no encontrado o inactivo");
        validation.barberValid = false;
      } else if (!barber.compatible) {
        errors.push("Este barbero no tiene asignado el servicio seleccionado");
        validation.barberValid = false;
      } else if (!barber.available) {
        errors.push("Este barbero ya tiene ocupado ese horario");
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
    }

    if (!hasServiceId) {
      warnings.push("Selecciona un servicio para calcular duración y disponibilidad real");
    }

    if (!hasBarberId) {
      warnings.push("Selecciona un barbero para completar la cita");
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