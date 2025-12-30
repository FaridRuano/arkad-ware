import { NextResponse } from "next/server";
import { auth } from "@auth";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";

export async function POST(req) {
  try {
    // 1️⃣ Sesión
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json(
        { error: true, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // 2️⃣ Body
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: true, message: "Appointment id is required" },
        { status: 400 }
      );
    }

    // 3️⃣ DB
    await connectMongoDB();

    // 4️⃣ Cancelar (solo si pertenece al usuario y no está cancelada)
    const updatedAppointment = await Appointment.findOneAndUpdate(
      {
        _id: id,
        user: userId,
        status: { $ne: "cancelled" },
      },
      {
        $set: {
          status: "cancelled",
          cancelledAt: new Date(),
        },
      },
      { new: true }
    ).lean();

    if (!updatedAppointment) {
      return NextResponse.json(
        {
          error: true,
          message:
            "No se encontró la cita, ya fue cancelada o no tienes permisos",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        appointment: {
          id: updatedAppointment._id.toString(),
          status: updatedAppointment.status,
          cancelledAt: updatedAppointment.cancelledAt,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Cancel appointment error:", error);
    return NextResponse.json(
      { error: true, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
