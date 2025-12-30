import { NextResponse } from "next/server";
import { auth } from "@auth";
import connectMongoDB from "@libs/mongodb";
import Appointment from "@models/Appointment";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: true, message: "Unauthorized" }, { status: 401 });
  }

  await connectMongoDB();

  const now = new Date();

  const appointments = await Appointment.find({
    user: userId,
    status: "scheduled",
    startAt: { $gte: now },
  })
    .sort({ startAt: 1 })
    .limit(10)
    .lean();

  return NextResponse.json({
    ok: true,
    appointments: appointments.map((a) => ({
      id: a._id.toString(),
      startAt: a.startAt,
      durationMinutes: a.durationMinutes,
      status: a.status,
    })),
  });
}
