import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import Barber from "@models/Barber";

function toTitleCase(value = "") {
  return value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const cleanStr = (v) => String(v ?? "").trim();

const cleanPhone = (v) => {
  // ✅ normaliza a dígitos para evitar duplicados con formatos distintos
  // Ej: +593 99 644 7884 -> 593996447884
  //     0996447884 -> 0996447884
  const digits = cleanStr(v).replace(/[^\d]/g, "");
  return digits;
};

const cleanColor = (v) => {
  const s = cleanStr(v);
  return s || "#000000";
};

export async function POST(req) {
  try {
    await connectMongoDB();

    const body = await req.json().catch(() => ({}));

    const name = cleanStr(body?.name);
    const phone = cleanPhone(body?.phone);
    const color = cleanColor(body?.color);
    const isActive = body?.isActive !== false; // default true
    const notes = cleanStr(body?.notes);

    // ✅ Validaciones
    if (!name) {
      return NextResponse.json({ error: "El nombre del barbero es requerido" }, { status: 400 });
    }

    if (!phone) {
      return NextResponse.json({ error: "Teléfono es requerido" }, { status: 400 });
    }

    // Color HEX #RRGGBB
    if (!/^#([0-9a-fA-F]{6})$/.test(color)) {
      return NextResponse.json({ error: "El color debe ser HEX (#RRGGBB)" }, { status: 400 });
    }

    // ✅ Evitar duplicados (name + phone)
    // - name lo guardamos en title case para consistencia, pero comparamos sin case
    const nameTitle = toTitleCase(name);

    // duplicado por teléfono exacto
    const existsPhone = await Barber.findOne({ phone }).select("_id phone");
    if (existsPhone) {
      return NextResponse.json({ error: "Ya existe un barbero con ese teléfono" }, { status: 409 });
    }

    // duplicado por nombre (case-insensitive exact)
    // si quieres permitir nombres repetidos, eliminamos esto
    const existsName = await Barber.findOne({
      name: { $regex: `^${nameTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    }).select("_id name");

    if (existsName) {
      return NextResponse.json({ error: "Ya existe un barbero con ese nombre" }, { status: 409 });
    }

    const created = await Barber.create({
      name: nameTitle,
      phone,
      color,
      isActive,
      notes,
      linkedUserId: body?.linkedUserId ?? null, // por si luego lo usas
    });

    const safe = created.toObject();
    delete safe.__v;

    return NextResponse.json(
      {
        barber: {
          ...safe,
          id: created?._id?.toString?.() ?? created?._id,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    // ✅ Errores de unique index (por si se cuela)
    if (err?.code === 11000) {
      const key = Object.keys(err?.keyPattern || {})?.[0] || "campo";
      const map = { phone: "teléfono", name: "nombre" };

      return NextResponse.json(
        { error: `Ya existe un barbero con ese ${map[key] || key}` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: err?.message || "Error creando barbero" },
      { status: 500 }
    );
  }
}