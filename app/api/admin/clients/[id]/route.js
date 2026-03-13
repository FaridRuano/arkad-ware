import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import User from "@models/User";
import mongoose from "mongoose";
import Appointment from "@models/Appointment";

export async function PATCH(req, { params }) {
  try {
    await connectMongoDB();

    const { id } = await params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    const cedula = body?.cedula != null ? String(body.cedula).trim() : undefined;
    const firstName = body?.firstName != null ? String(body.firstName).trim() : undefined;
    const lastName = body?.lastName != null ? String(body.lastName).trim() : undefined;
    const email = body?.email != null ? String(body.email).trim().toLowerCase() : undefined;
    const phone = body?.phone != null ? String(body.phone).trim() : undefined;
    const address = body?.address != null ? String(body.address).trim() : undefined;

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
    if (cedula !== undefined && !/^\d{10}$/.test(cedula)) {
      return NextResponse.json({ error: "La cédula debe tener 10 dígitos" }, { status: 400 });
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
          return NextResponse.json({ error: "Ya existe un cliente con esa cédula" }, { status: 409 });
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
      const map = { cedula: "cédula", email: "email", phone: "teléfono" };
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
    const hasAppointments = await Appointment.exists({ user: user._id });
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

