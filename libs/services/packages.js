import mongoose from "mongoose";
import Service from "@models/Service";

export const SERVICE_TYPES = ["single", "package"];
export const DISCOUNT_TYPES = ["amount", "percent"];

export const cleanPackageItems = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => ({
      service: String(item?.service || item?.serviceId || "").trim(),
      order: Number(item?.order || index + 1),
    }))
    .filter((item) => item.service);
};

export const calculatePackagePrice = (basePrice, discountType, discountValue) => {
  const subtotal = Number(basePrice || 0);
  const discount = Number(discountValue || 0);

  if (discountType === "percent") {
    return Math.max(0, subtotal - subtotal * Math.min(discount, 100) / 100);
  }

  return Math.max(0, subtotal - discount);
};

export const validateAndBuildPackage = async ({
  packageItems,
  discountType = "amount",
  discountValue = 0,
  excludeServiceId = null,
}) => {
  const items = cleanPackageItems(packageItems);

  if (items.length !== 2) {
    return { error: "Un paquete debe incluir exactamente dos servicios" };
  }

  if (!DISCOUNT_TYPES.includes(discountType)) {
    return { error: "El tipo de descuento no es válido" };
  }

  const discount = Number(discountValue || 0);
  if (!Number.isFinite(discount) || discount < 0) {
    return { error: "El descuento debe ser un número mayor o igual a 0" };
  }

  if (discountType === "percent" && discount > 100) {
    return { error: "El porcentaje de descuento no puede superar 100%" };
  }

  const invalidItem = items.find((item) => !mongoose.Types.ObjectId.isValid(item.service));
  if (invalidItem) {
    return { error: "Uno o más servicios del paquete no tienen un ID válido" };
  }

  const uniqueIds = [...new Set(items.map((item) => item.service))];
  if (uniqueIds.length !== items.length) {
    return { error: "El paquete no puede repetir el mismo servicio" };
  }

  if (excludeServiceId && uniqueIds.some((id) => String(id) === String(excludeServiceId))) {
    return { error: "Un paquete no puede incluirse a sí mismo" };
  }

  const services = await Service.find({
    _id: { $in: uniqueIds },
    serviceType: { $ne: "package" },
  })
    .select("_id name durationMinutes price barbers isActive")
    .lean();

  if (services.length !== uniqueIds.length) {
    return { error: "Solo puedes crear paquetes con servicios individuales existentes" };
  }

  const byId = new Map(services.map((service) => [String(service._id), service]));
  const orderedItems = items
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({
      service: item.service,
      order: index + 1,
      serviceDoc: byId.get(String(item.service)),
    }));

  const unavailable = orderedItems.find(
    (item) =>
      item.serviceDoc?.isActive === false ||
      !Array.isArray(item.serviceDoc?.barbers) ||
      item.serviceDoc.barbers.length === 0
  );

  if (unavailable) {
    return { error: "Todos los servicios del paquete deben estar activos y tener barberos asignados" };
  }

  const durationMinutes = orderedItems.reduce(
    (sum, item) => sum + Number(item.serviceDoc?.durationMinutes || 0),
    0
  );
  const basePrice = orderedItems.reduce(
    (sum, item) => sum + Number(item.serviceDoc?.price || 0),
    0
  );
  const price = calculatePackagePrice(basePrice, discountType, discount);
  const barbers = [
    ...new Set(
      orderedItems.flatMap((item) =>
        Array.isArray(item.serviceDoc?.barbers)
          ? item.serviceDoc.barbers.map((id) => String(id))
          : []
      )
    ),
  ];

  return {
    packageItems: orderedItems.map((item) => ({
      service: item.service,
      order: item.order,
    })),
    durationMinutes,
    price,
    barbers,
    discountType,
    discountValue: discount,
  };
};

export const formatPackageItemsForClient = (packageItems = []) =>
  packageItems
    .map((item) => {
      const service = item?.service;
      if (!service || typeof service !== "object") return null;

      const activeBarbers = Array.isArray(service.barbers)
        ? service.barbers
            .filter((barber) => barber && barber.isActive)
            .map((barber) => ({
              id: String(barber._id),
              name: String(barber.name || "").trim(),
              color: barber.color || null,
              notes: String(barber.notes || "").trim(),
            }))
            .filter((barber) => barber.name)
        : [];

      return {
        serviceId: String(service._id),
        order: Number(item.order || 0),
        name: String(service.name || "").trim(),
        durationMinutes: Number(service.durationMinutes || 0),
        price: Number(service.price || 0),
        color: service.color || null,
        barbers: activeBarbers,
      };
    })
    .filter((item) => item && item.name && item.durationMinutes > 0)
    .sort((a, b) => a.order - b.order);
