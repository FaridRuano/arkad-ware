import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import User from "@models/User";
import bcrypt from "bcryptjs";

function toTitleCase(value = "") {
    return value
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join(" ");
}

export async function POST(req) {
    try {
        await connectMongoDB();

        const body = await req.json().catch(() => ({}));

        const cedula = String(body?.cedula || "").trim();
        const firstName = String(body?.firstName || "").trim();
        const lastName = String(body?.lastName || "").trim();
        const email = String(body?.email || "").trim().toLowerCase();
        const phone = String(body?.phone || "").trim();      // debería venir +593...
        const address = String(body?.address || "").trim();

        // ✅ Validaciones mínimas
        if (!cedula || !/^\d{10}$/.test(cedula)) {
            return NextResponse.json({ error: "La cédula debe tener 10 dígitos" }, { status: 400 });
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

        // ✅ Evitar duplicados (cedula/email)
        const exists = await User.findOne({
            $or: [
                { cedula },
                { email },
                { phone },
            ],
        }).select("_id cedula email phone");

        if (exists) {
            if (exists.cedula === cedula) {
                return NextResponse.json(
                    { error: "Ya existe un cliente con esa cédula" },
                    { status: 409 }
                );
            }

            if (exists.email === email) {
                return NextResponse.json(
                    { error: "Ya existe un cliente con ese email" },
                    { status: 409 }
                );
            }

            if (exists.phone === phone) {
                return NextResponse.json(
                    { error: "Ya existe un cliente con ese teléfono" },
                    { status: 409 }
                );
            }
        }

        // ✅ Password automático = cedula (hasheada)
        const hashedPassword = await bcrypt.hash(cedula, 10);

        // ✅ terms.acceptedAt es REQUIRED en tu schema
        const now = new Date();

        const created = await User.create({
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
            terms: {
                acceptedAt: now,
                version: "v1.0",
            },
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
        // Manejo de errores de unique index (por si se cuela)
        if (err?.code === 11000) {
            const key = Object.keys(err?.keyPattern || {})?.[0] || "campo";

            const map = {
                cedula: "cédula",
                email: "email",
                phone: "teléfono",
            };

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
