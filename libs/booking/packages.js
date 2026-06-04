import mongoose from "mongoose";
import Service from "@models/Service";
import Barber from "@models/Barber";
import BarberSchedule from "@models/BarberSchedule";

export const parsePackageBarbers = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];

  return String(value)
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
};

export const buildPackageBookingItems = async ({ packageService, barberIds }) => {
  const selectedBarberIds = parsePackageBarbers(barberIds);
  const packageItems = Array.isArray(packageService?.packageItems)
    ? packageService.packageItems
        .filter((item) => item?.service)
        .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    : [];

  if (packageItems.length !== 2) {
    return { error: "Este paquete no tiene dos servicios configurados" };
  }

  if (selectedBarberIds.length !== packageItems.length) {
    return { error: "Debes seleccionar un barbero por cada servicio del paquete" };
  }

  const invalidBarberId = selectedBarberIds.find(
    (id) => !mongoose.Types.ObjectId.isValid(id)
  );
  if (invalidBarberId) {
    return { error: "Uno o más barberos seleccionados no tienen un ID válido" };
  }

  const uniqueServiceIds = packageItems.map((item) => String(item.service._id || item.service));
  const selectedServices = await Service.find({
    _id: { $in: uniqueServiceIds },
    isActive: true,
    serviceType: { $ne: "package" },
  })
    .select("_id name durationMinutes price barbers")
    .lean();
  const servicesById = new Map(selectedServices.map((service) => [String(service._id), service]));

  const barbers = await Barber.find({
    _id: { $in: selectedBarberIds },
    isActive: true,
  })
    .select("_id name color")
    .lean();
  const barbersById = new Map(barbers.map((barber) => [String(barber._id), barber]));

  const schedules = await BarberSchedule.find({
    barber: { $in: selectedBarberIds },
    isActive: true,
  }).lean();
  const schedulesByBarberId = new Map(
    schedules.map((schedule) => [String(schedule.barber), schedule])
  );

  const items = [];

  for (let index = 0; index < packageItems.length; index++) {
    const serviceId = String(packageItems[index].service._id || packageItems[index].service);
    const barberId = String(selectedBarberIds[index]);
    const service = servicesById.get(serviceId);
    const barber = barbersById.get(barberId);

    if (!service) {
      return { error: "Uno de los servicios del paquete no está disponible" };
    }

    if (!barber) {
      return { error: "Uno de los barberos seleccionados no está disponible" };
    }

    const canPerform = Array.isArray(service.barbers)
      ? service.barbers.some((id) => String(id) === barberId)
      : false;

    if (!canPerform) {
      return {
        error: `${barber.name} no está disponible para ${service.name}`,
      };
    }

    items.push({
      serviceId,
      serviceName: service.name,
      durationMinutes: Number(service.durationMinutes || 0),
      barberId,
      barberName: barber.name,
      barberSchedule: schedulesByBarberId.get(barberId) || null,
      order: index + 1,
    });
  }

  return { items };
};
