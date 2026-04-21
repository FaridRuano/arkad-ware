import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import User from "@models/User";
import bcrypt from "bcryptjs";
import { validateClientDocument } from "@utils/documentId";

function toTitleCase(value = "") {
  return value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const cleanStr = (v) => String(v ?? "").trim();

const cleanEmail = (v) => {
  const s = cleanStr(v).toLowerCase();
  return s || "";
};

const cleanPhone = (v) => {
  // ✅ normaliza a dígitos para evitar duplicados con formatos distintos
  // Si prefieres guardar con +593, avísame y lo ajusto.
  const digits = cleanStr(v).replace(/[^\d]/g, "");
  return digits;
};

export async function POST(req) {
  try {
    await connectMongoDB();

    const body = await req.json().catch(() => ({}));

    const documentResult = validateClientDocument(body?.cedula);
    const cedula = documentResult.value;
    const firstName = cleanStr(body?.firstName);
    const lastName = cleanStr(body?.lastName);
    const email = cleanEmail(body?.email);
    const phone = cleanPhone(body?.phone);
    const address = cleanStr(body?.address);

    // ✅ Validaciones estrictas
    if (!documentResult.ok) {
      return NextResponse.json({ error: documentResult.message }, { status: 400 });
    }
    if (!firstName) {
      return NextResponse.json({ error: "Nombre es requerido" }, { status: 400 });
    }
    if (!lastName) {
      return NextResponse.json({ error: "Apellido es requerido" }, { status: 400 });
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Email no es válido" }, { status: 400 });
    }
    if (!phone) {
      return NextResponse.json({ error: "Teléfono es requerido" }, { status: 400 });
    }
    if (!address) {
      return NextResponse.json({ error: "Dirección es requerida" }, { status: 400 });
    }

    // ✅ Evitar duplicados (cedula/email/phone)
    // Importante: solo con valores ya normalizados
    const exists = await User.findOne({
      $or: [{ cedula }, { email }, { phone }],
    }).select("_id cedula email phone");

    if (exists) {
      if (exists.cedula === cedula) {
        return NextResponse.json({ error: "Ya existe un cliente con ese documento" }, { status: 409 });
      }
      if (exists.email === email) {
        return NextResponse.json({ error: "Ya existe un cliente con ese email" }, { status: 409 });
      }
      if (exists.phone === phone) {
        return NextResponse.json({ error: "Ya existe un cliente con ese teléfono" }, { status: 409 });
      }
      return NextResponse.json({ error: "Cliente duplicado" }, { status: 409 });
    }

    // ✅ Password automático = cédula (hasheada)
    const hashedPassword = await bcrypt.hash(cedula, 10);
    const now = new Date();

    const created = await User.create({
      // ✅ con el nuevo schema
      accountStatus: "active",
      isProfileComplete: true,

      cedula,
      firstName: toTitleCase(firstName),
      lastName: toTitleCase(lastName),
      email,
      phone,
      address,

      password: hashedPassword,
      role: "user",
      emailVerified: null,
      lastLoginAt: null,

      terms: { acceptedAt: now, version: "v1.0" },
    });

    // ✅ Respuesta segura (sin password)
    const safe = created.toObject();
    delete safe.password;
    delete safe.__v;

    return NextResponse.json(
      {
        client: {
          ...safe,
          id: created?._id?.toString?.() ?? created?._id,
          name: `${created?.firstName ?? ""} ${created?.lastName ?? ""}`.trim(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    // ✅ Errores de unique index (por si se cuela)
    if (err?.code === 11000) {
      const key = Object.keys(err?.keyPattern || {})?.[0] || "campo";
      const map = { cedula: "documento", email: "email", phone: "teléfono" };

      return NextResponse.json(
        { error: `Ya existe un cliente con ese ${map[key] || key}` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: err?.message || "Error creando cliente" },
      { status: 500 }
    );
  }
}
