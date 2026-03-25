import connectMongoDB from "@libs/mongodb";
import User from "@models/User";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// helpers
const cleanStr = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
};

const cleanEmail = (v) => {
    const s = cleanStr(v);
    return s ? s.toLowerCase() : null;
};

const cleanPhone = (v) => {
    const s = cleanStr(v);
    if (!s) return null;
    // deja solo dígitos (ajusta si quieres conservar +593)
    const digits = s.replace(/[^\d]/g, "");
    return digits.length ? digits : null;
};

export async function POST(request) {
    try {
        const body = await request.json();

        await connectMongoDB();

        // Normaliza inputs (null si no hay dato)
        const cedula = cleanStr(body?.cedula);
        const email = cleanEmail(body?.email);
        const phone = cleanPhone(body?.phone);

        const firstName = cleanStr(body?.nombre);
        const lastName = cleanStr(body?.apellido) ?? ""; // permite vacío si es draft
        const address = cleanStr(body?.address);

        // password puede venir o no
        const passwordRaw = cleanStr(body?.password);

        // Requerimiento mínimo para crear cliente
        if (!firstName) {
            return NextResponse.json(
                { message: "firstName is required", error: true },
                { status: 200 }
            );
        }

        // ✅ Duplicados: SOLO con campos presentes
        const or = [];
        if (cedula) or.push({ cedula });
        if (email) or.push({ email });
        if (phone) or.push({ phone });

        if (or.length) {
            const existingUser = await User.findOne({ $or: or }).lean();

            if (existingUser) {
                let duplicatedField = "unknown";
                if (cedula && existingUser.cedula === cedula) duplicatedField = "cedula";
                else if (email && existingUser.email === email) duplicatedField = "email";
                else if (phone && existingUser.phone === phone) duplicatedField = "phone";

                return NextResponse.json(
                    { message: `${duplicatedField} already exists`, error: true },
                    { status: 200 }
                );
            }
        }

        // ✅ Decide si crear ACTIVE o DRAFT
        // ACTIVE: tiene cedula + password + address (+ terms)
        const canBeActive = Boolean(cedula && passwordRaw && address);

        let hashedPassword = null;
        if (passwordRaw) {
            hashedPassword = await bcrypt.hash(passwordRaw, 10);
        }

        const userDoc = {
            accountStatus: canBeActive ? "active" : "draft",
            isProfileComplete: canBeActive ? true : false,

            cedula,
            email,
            phone,

            firstName: firstName.trim(),
            lastName: lastName ? lastName.trim() : "",

            address: canBeActive ? address.trim() : null,

            password: canBeActive ? hashedPassword : null,

            terms: canBeActive
                ? { acceptedAt: new Date(), version: "1.0" }
                : { acceptedAt: null, version: "1.0" },
        };

        /* const newUser = await User.create(userDoc);

        return NextResponse.json(
            { message: "Data created", error: false, userId: String(newUser?._id) },
            { status: 200 }
        ); */

        return NextResponse.json(
            { message: "Data created", error: false, userId: "00000000000000" },
            { status: 200 }
        );
    } catch (err) {
        return NextResponse.json(
            { message: err?.message || "Error creating user", error: true },
            { status: 500 }
        );
    }
}