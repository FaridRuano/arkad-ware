import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectMongoDB from "@libs/mongodb";
import Service from "@models/Service";
import Barber from "@models/Barber";

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);
    const barberId = (searchParams.get("barberId") || "").trim();

    let filter = { isActive: true };
    let selectedBarber = null;

    if (barberId) {
      if (!mongoose.Types.ObjectId.isValid(barberId)) {
        return NextResponse.json(
          { error: "Parámetro 'barberId' inválido" },
          { status: 400 }
        );
      }

      const barber = await Barber.findById(barberId)
        .select("_id name isActive color")
        .lean();

      if (!barber) {
        return NextResponse.json(
          { error: "Barbero no encontrado" },
          { status: 404 }
        );
      }

      if (barber.isActive === false) {
        return NextResponse.json(
          { error: "Este barbero está inactivo" },
          { status: 400 }
        );
      }

      selectedBarber = {
        id: barber?._id?.toString?.() ?? barber?._id,
        name: barber?.name ?? "—",
        color: barber?.color || "#000000",
      };

      filter = {
        isActive: true,
        barbers: new mongoose.Types.ObjectId(barberId),
      };
    }

    const docs = await Service.find(filter)
      .sort({ name: 1, createdAt: 1 })
      .select("_id name description durationMinutes price color isActive barbers")
      .lean();

    const services = (docs || []).map((s) => ({
      id: s?._id?.toString?.() ?? s?._id,
      name: s?.name ?? "—",
      description: s?.description ?? "",
      durationMinutes: Number(s?.durationMinutes || 0),
      price: Number(s?.price || 0),
      color: s?.color || "#CFB690",
      barberIds: Array.isArray(s?.barbers)
        ? s.barbers.map((id) => id?.toString?.() ?? id)
        : [],
    }));

    return NextResponse.json(
      {
        barberId: barberId || null,
        barber: selectedBarber,
        total: services.length,
        services,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /admin/schedule/services error:", err);

    return NextResponse.json(
      { error: err?.message || "Error cargando servicios de agenda" },
      { status: 500 }
    );
  }
}