import { NextResponse } from "next/server";
import connectMongoDB from "@libs/mongodb";
import Barber from "@models/Barber";
import mongoose from "mongoose";

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
  const digits = cleanStr(v).replace(/[^\d]/g, "");
  return digits;
};

const cleanColor = (v) => {
  const s = cleanStr(v);
  return s || "#000000";
};

function escapeRegex(str = "") {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ───────────────────────────────────────────────────────────────
// PATCH /api/admin/barbers/:id  -> editar barbero
// ───────────────────────────────────────────────────────────────
export async function PATCH(req, { params }) {
  try {
    await connectMongoDB();

    const id = params?.id;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    // Campos permitidos
    const nameRaw = body?.name;
    const phoneRaw = body?.phone;
    const colorRaw = body?.color;
    const isActiveRaw = body?.isActive;
    const notesRaw = body?.notes;
    const linkedUserIdRaw = body?.linkedUserId;

    // Traer actual para comparar duplicados
    const current = await Barber.findById(id).select("_id name phone");
    if (!current) {
      return NextResponse.json({ error: "Barbero no encontrado" }, { status: 404 });
    }

    const update = {};

    // name
    if (nameRaw !== undefined) {
      const name = cleanStr(nameRaw);
      if (!name) {
        return NextResponse.json({ error: "El nombre del barbero es requerido" }, { status: 400 });
      }
      const nameTitle = toTitleCase(name);

      // Evitar duplicado de nombre (case-insensitive exact)
      const existsName = await Barber.findOne({
        _id: { $ne: id },
        name: { $regex: `^${escapeRegex(nameTitle)}$`, $options: "i" },
      }).select("_id name");

      if (existsName) {
        return NextResponse.json({ error: "Ya existe un barbero con ese nombre" }, { status: 409 });
      }

      update.name = nameTitle;
    }

    // phone
    if (phoneRaw !== undefined) {
      const phone = cleanPhone(phoneRaw);
      if (!phone) {
        return NextResponse.json({ error: "Teléfono es requerido" }, { status: 400 });
      }

      const existsPhone = await Barber.findOne({
        _id: { $ne: id },
        phone,
      }).select("_id phone");

      if (existsPhone) {
        return NextResponse.json({ error: "Ya existe un barbero con ese teléfono" }, { status: 409 });
      }

      update.phone = phone;
    }

    // color
    if (colorRaw !== undefined) {
      const color = cleanColor(colorRaw);
      if (!/^#([0-9a-fA-F]{6})$/.test(color)) {
        return NextResponse.json({ error: "El color debe ser HEX (#RRGGBB)" }, { status: 400 });
      }
      update.color = color;
    }

    // isActive
    if (isActiveRaw !== undefined) {
      update.isActive = Boolean(isActiveRaw);
    }

    // notes
    if (notesRaw !== undefined) {
      update.notes = cleanStr(notesRaw);
    }

    // linkedUserId (opcional)
    if (linkedUserIdRaw !== undefined) {
      const v = linkedUserIdRaw ? String(linkedUserIdRaw) : "";
      if (v && !mongoose.Types.ObjectId.isValid(v)) {
        return NextResponse.json({ error: "linkedUserId inválido" }, { status: 400 });
      }
      update.linkedUserId = v ? v : null;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const updated = await Barber.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).select("-__v");

    return NextResponse.json({
      barber: {
        ...updated.toObject(),
        id: updated?._id?.toString?.() ?? updated?._id,
      },
    });
  } catch (err) {
    if (err?.code === 11000) {
      const key = Object.keys(err?.keyPattern || {})?.[0] || "campo";
      const map = { phone: "teléfono", name: "nombre" };

      return NextResponse.json(
        { error: `Ya existe un barbero con ese ${map[key] || key}` },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: err?.message || "Error actualizando barbero" },
      { status: 500 }
    );
  }
}

// ───────────────────────────────────────────────────────────────
// DELETE /api/admin/barbers/:id  -> por defecto desactiva (soft delete)
//   - opcional: /api/admin/barbers/:id?hard=true -> borra real
// ───────────────────────────────────────────────────────────────
export async function DELETE(req, { params }) {
  try {
    await connectMongoDB();

    const { id } = await params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const hard = searchParams.get("hard") === "true";
    const action = searchParams.get("action"); // activate | deactivate

    const barber = await Barber.findById(id).select("_id name isActive");
    if (!barber) {
      return NextResponse.json({ error: "Barbero no encontrado" }, { status: 404 });
    }

    if (hard) {
      await Barber.deleteOne({ _id: id });
      return NextResponse.json({
        ok: true,
        deleted: true,
        action: "deleted",
      });
    }

    if (action === "activate") {
      barber.isActive = true;
    } else if (action === "deactivate") {
      barber.isActive = false;
    } else {
      barber.isActive = !barber.isActive;
    }

    await barber.save();

    return NextResponse.json({
      ok: true,
      isActive: barber.isActive,
      action: barber.isActive ? "activated" : "deactivated",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message || "Error actualizando estado del barbero" },
      { status: 500 }
    );
  }
}