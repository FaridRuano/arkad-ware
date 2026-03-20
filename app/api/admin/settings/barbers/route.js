import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import Barber from "@models/Barber";

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = 12;

    const includeInactive = searchParams.get("includeInactive") === "true";

    const skip = (page - 1) * limit;

    // 1) Match base
    const match = includeInactive ? {} : { isActive: true };

    // 2) Búsqueda por nombre (multi palabra)
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);

      match.$and = terms.map((term) => ({
        $or: [{ name: { $regex: term, $options: "i" } }],
      }));
    }

    // 3) Total + docs
    const [total, docs] = await Promise.all([
      Barber.countDocuments(match),
      Barber.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-__v"),
    ]);

    // 4) Normalizar para frontend
    const barbers = (docs || []).map((b) => ({
      ...b.toObject(),
      id: b?._id?.toString?.() ?? b?._id,
    }));

    return NextResponse.json({
      barbers,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error cargando barberos" },
      { status: 500 }
    );
  }
}