import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@libs/mongodb";
import Barber from "@models/Barber";
import Service from "@models/Service";

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const serviceId = (searchParams.get("serviceId") || "").trim();

    let filter = { isActive: true };

    if (serviceId) {
      if (!mongoose.Types.ObjectId.isValid(serviceId)) {
        return NextResponse.json(
          { error: "Parámetro 'serviceId' inválido" },
          { status: 400 }
        );
      }

      const service = await Service.findById(serviceId)
        .select("_id name isActive barbers")
        .lean();

      if (!service) {
        return NextResponse.json(
          { error: "Servicio no encontrado" },
          { status: 404 }
        );
      }

      if (service.isActive === false) {
        return NextResponse.json(
          { error: "Este servicio está inactivo" },
          { status: 400 }
        );
      }

      const allowedBarberIds = Array.isArray(service.barbers)
        ? service.barbers.filter((id) => mongoose.Types.ObjectId.isValid(id))
        : [];

      filter = {
        isActive: true,
        _id: { $in: allowedBarberIds },
      };
    }

    const docs = await Barber.find(filter)
      .sort({ name: 1, createdAt: 1 })
      .select("_id name color isActive")
      .lean();

    const barbers = (docs || []).map((b) => ({
      id: b?._id?.toString?.() ?? b?._id,
      name: b?.name ?? "—",
      color: b?.color || "#000000",
    }));

    return NextResponse.json(
      {
        serviceId: serviceId || null,
        total: barbers.length,
        barbers,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /admin/schedule/barbers error:", err);

    return NextResponse.json(
      { error: err?.message || "Error cargando barberos de agenda" },
      { status: 500 }
    );
  }
}