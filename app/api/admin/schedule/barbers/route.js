import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import Barber from "@models/Barber";

export async function GET() {
  try {
    await connectMongoDB();

    const docs = await Barber.find({ isActive: true })
      .sort({ createdAt: 1 })
      .select("name color isActive");

    const barbers = (docs || []).map((b) => ({
      id: b?._id?.toString?.() ?? b?._id,
      name: b?.name ?? "—",
      color: b?.color || "#000000",
    }));

    return NextResponse.json({ barbers }, { status: 200 });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error cargando barberos de agenda" },
      { status: 500 }
    );
  }
}