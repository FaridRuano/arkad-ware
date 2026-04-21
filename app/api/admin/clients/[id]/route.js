import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import User from "@models/User";
import mongoose from "mongoose";
import Appointment from "@models/Appointment";
import Barber from "@models/Barber";
import Service from "@models/Service";
import { validateClientDocument } from "@utils/documentId";

const cleanPhone = (v) => String(v ?? "").trim().replace(/[^\d]/g, "");
const cleanText = (v) => String(v ?? "").trim();

function formatUserName(user = {}) {
  return `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "—";
}

function serializeAppointment(appointment) {
  const client = appointment?.clientId;
  const barber = appointment?.barberId;
  const service = appointment?.serviceId;
  const createdBy = appointment?.createdBy;

  return {
    ...appointment.toObject(),
    id: appointment?._id?.toString?.() ?? appointment?._id,
    client: client
      ? {
          id: client?._id?.toString?.() ?? client?._id,
          name: formatUserName(client),
          email: client?.email || "",
          phone: client?.phone || "",
          document: client?.cedula || "",
        }
      : null,
    barber: barber
      ? {
          id: barber?._id?.toString?.() ?? barber?._id,
          name: barber?.name || barber?.fullName || "Sin asignar",
        }
      : null,
    service: service
      ? {
          id: service?._id?.toString?.() ?? service?._id,
          name: service?.name || appointment?.serviceName || "—",
          durationMinutes: service?.durationMinutes ?? appointment?.serviceDurationMinutes ?? appointment?.durationMinutes ?? null,
          price: service?.price ?? appointment?.price ?? null,
        }
      : null,
    createdBy: createdBy
      ? {
          id: createdBy?._id?.toString?.() ?? createdBy?._id,
          name: formatUserName(createdBy),
          email: createdBy?.email || "",
        }
      : null,
    statusHistory: Array.isArray(appointment?.statusHistory)
      ? appointment.statusHistory.map((entry, index) => {
          const rawEntry =
            typeof entry?.toObject === "function" ? entry.toObject() : entry || {};

          return {
            id: `${appointment?._id}-${index}`,
            from: rawEntry?.from || "",
            to: rawEntry?.to || "",
            changedAt: rawEntry?.changedAt || null,
            reason: rawEntry?.reason || "",
            changedBy:
              rawEntry?.changedBy && typeof rawEntry.changedBy === "object"
                ? {
                    id: rawEntry.changedBy?._id?.toString?.() ?? rawEntry.changedBy?._id,
                    name: formatUserName(rawEntry.changedBy),
                    email: rawEntry.changedBy?.email || "",
                  }
                : null,
          };
        })
      : [],
  };
}

export async function GET(req, { params }) {
  try {
    await connectMongoDB();

    const { id } = await params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const client = await User.findById(id).select("-password -__v");

    if (!client || client.role !== "user") {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const appointments = await Appointment.find({ clientId: client._id })
      .sort({ startAt: -1, createdAt: -1 })
      .populate("clientId", "firstName lastName email phone cedula")
      .populate("barberId", "name fullName")
      .populate("serviceId", "name durationMinutes price")
      .populate("createdBy", "firstName lastName email")
      .populate("statusHistory.changedBy", "firstName lastName email");

    return NextResponse.json({
      client: {
        ...client.toObject(),
        id: client?._id?.toString?.() ?? client?._id,
        name: formatUserName(client),
      },
      history: {
        totalAppointments: appointments.length,
        appointments: appointments.map(serializeAppointment),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error cargando historial del cliente" },
      { status: 500 }
    );
  }
}

export async function PATCH(req, { params }) {
  try {
    await connectMongoDB();

    const { id } = await params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    const documentResult =
      body?.cedula != null ? validateClientDocument(body?.cedula) : null;
    const cedula = documentResult ? documentResult.value : undefined;
    const firstName = body?.firstName != null ? cleanText(body.firstName) : undefined;
    const lastName = body?.lastName != null ? cleanText(body.lastName) : undefined;
    const email = body?.email != null ? cleanText(body.email).toLowerCase() : undefined;
    const phone = body?.phone != null ? cleanPhone(body.phone) : undefined;
    const address = body?.address != null ? cleanText(body.address) : undefined;

    // 1) Encontrar cliente
    const current = await User.findById(id).select("_id role");
    if (!current) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    // ✅ si quieres que solo se editen clientes, no admins:
    if (current.role !== "user") {
      return NextResponse.json({ error: "No puedes editar este usuario" }, { status: 403 });
    }

    // 2) Validaciones (solo si vienen en body)
    if (documentResult && !documentResult.ok) {
      return NextResponse.json({ error: documentResult.message }, { status: 400 });
    }
    if (email !== undefined && !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Email no es válido" }, { status: 400 });
    }
    if (firstName !== undefined && !firstName) {
      return NextResponse.json({ error: "Nombre es requerido" }, { status: 400 });
    }
    if (lastName !== undefined && !lastName) {
      return NextResponse.json({ error: "Apellido es requerido" }, { status: 400 });
    }
    if (phone !== undefined && !phone) {
      return NextResponse.json({ error: "Teléfono es requerido" }, { status: 400 });
    }
    if (address !== undefined && !address) {
      return NextResponse.json({ error: "Dirección es requerida" }, { status: 400 });
    }

    // 3) Duplicados (cedula/email/phone) excluyendo el mismo id
    const or = [];
    if (cedula !== undefined) or.push({ cedula });
    if (email !== undefined) or.push({ email });
    if (phone !== undefined) or.push({ phone });

    if (or.length) {
      const exists = await User.findOne({
        _id: { $ne: id },
        $or: or,
      }).select("_id cedula email phone");

      if (exists) {
        if (cedula !== undefined && exists.cedula === cedula) {
          return NextResponse.json({ error: "Ya existe un cliente con ese documento" }, { status: 409 });
        }
        if (email !== undefined && exists.email === email) {
          return NextResponse.json({ error: "Ya existe un cliente con ese email" }, { status: 409 });
        }
        if (phone !== undefined && exists.phone === phone) {
          return NextResponse.json({ error: "Ya existe un cliente con ese teléfono" }, { status: 409 });
        }
        return NextResponse.json({ error: "Ya existe un cliente con esos datos" }, { status: 409 });
      }
    }

    // 4) Update payload (solo campos permitidos)
    const update = {};
    if (cedula !== undefined) update.cedula = cedula;
    if (firstName !== undefined) update.firstName = firstName;
    if (lastName !== undefined) update.lastName = lastName;
    if (email !== undefined) update.email = email;
    if (phone !== undefined) update.phone = phone;
    if (address !== undefined) update.address = address;

    // ✅ role siempre user (no permitimos cambiarlo desde aquí)
    update.role = "user";

    // 5) Guardar
    const updated = await User.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).select("-password -__v");

    const safe = updated?.toObject?.() ?? updated;

    return NextResponse.json({
      client: {
        ...safe,
        id: updated?._id?.toString?.() ?? updated?._id,
        name: `${updated?.firstName ?? ""} ${updated?.lastName ?? ""}`.trim(),
      },
    });
  } catch (err) {
    if (err?.code === 11000) {
      const key = Object.keys(err?.keyPattern || {})?.[0] || "campo";
      const map = { cedula: "documento", email: "email", phone: "teléfono" };
      return NextResponse.json(
        { error: `Ya existe un cliente con ese ${map[key] || key}` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: err?.message || "Error actualizando cliente" },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    await connectMongoDB();

    const { id } = params || {};

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { error: "ID inválido" },
        { status: 400 }
      );
    }

    const user = await User.findById(id);

    if (!user) {
      return NextResponse.json(
        { error: "Cliente no encontrado" },
        { status: 404 }
      );
    }

    // ✅ Seguridad: no borrar admins
    if (user.role === "admin") {
      return NextResponse.json(
        { error: "No puedes eliminar un administrador" },
        { status: 403 }
      );
    }

    // ✅ Opcional: bloquear si tiene citas
    // (Si prefieres permitirlo, deja comentado)
    const hasAppointments = await Appointment.exists({ clientId: user._id });
    if (hasAppointments) {
      return NextResponse.json(
        { error: "No se puede eliminar: el cliente tiene citas registradas" },
        { status: 409 }
      );
    }

    await User.findByIdAndDelete(id);

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error eliminando cliente" },
      { status: 500 }
    );
  }
}
