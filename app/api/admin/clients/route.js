import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import User from "@models/User";

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);

    const q = (searchParams.get("q") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = 12;

    const skip = (page - 1) * limit;

    // 1) Match base: SOLO clientes (no admins)
    const match = { role: "user" };

    // 2) Búsqueda por nombre/apellido/teléfono/cédula/email
    //    - Soporta múltiples palabras (ej: "Juan Perez")
    if (q) {
      const terms = q.split(/\s+/).filter(Boolean);

      match.$and = terms.map((term) => ({
        $or: [
          { firstName: { $regex: term, $options: "i" } },
          { lastName: { $regex: term, $options: "i" } },
          { phone: { $regex: term, $options: "i" } },
          { cedula: { $regex: term, $options: "i" } },
          { email: { $regex: term, $options: "i" } },
        ],
      }));
    }

    // 3) Total + docs
    const [total, docs] = await Promise.all([
      User.countDocuments(match),
      User.find(match)
        .sort({ createdAt: -1 }) // ordenar por fecha de creación descendente
        .skip(skip)
        .limit(limit)
        .select("-password -__v"),
    ]);

    // 4) Normalizar para frontend
    const clients = (docs || []).map((u) => {
      const firstName = u?.firstName || "";
      const lastName = u?.lastName || "";
      const fullName = `${firstName} ${lastName}`.trim();

      return {
        ...u.toObject(),
        id: u?._id?.toString?.() ?? u?._id,
        name: fullName || "—",
      };
    });

    return NextResponse.json({
      clients,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error cargando clientes" },
      { status: 500 }
    );
  }
}
