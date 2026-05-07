import { redirect } from "next/navigation";
import { auth } from "@auth";
import connectMongoDB from "@libs/mongodb";
import User from "@models/User";
import Appointment from "@models/Appointment";
import "@models/Barber";
import ProfileClient from "@public/components/client/Profile/ProfileClient";

const UPCOMING_STATUSES = ["pending", "confirmed", "in_progress"];

export default async function ClientProfilePage() {
    const session = await auth();

    if (!session?.user?.id) {
        redirect("/");
    }

    await connectMongoDB();

    const [user, appointments] = await Promise.all([
        User.findById(session.user.id)
            .select("firstName lastName email phone cedula address createdAt")
            .lean(),
        Appointment.find({ clientId: session.user.id })
            .populate({
                path: "barberId",
                select: "name",
            })
            .select(
                "serviceName startAt endAt durationMinutes price status paymentStatus barberId createdAt"
            )
            .sort({ startAt: -1 })
            .lean(),
    ]);

    if (!user) {
        redirect("/");
    }

    const serializedAppointments = appointments.map((appointment) => ({
        id: String(appointment._id),
        serviceName: appointment.serviceName || "",
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        durationMinutes: Number(appointment.durationMinutes || 0),
        price: Number(appointment.price || 0),
        status: appointment.status || "",
        paymentStatus: appointment.paymentStatus || "",
        barberName: appointment.barberId?.name || "",
        createdAt: appointment.createdAt,
    }));

    const now = Date.now();
    const nextAppointment =
        serializedAppointments
            .filter(
                (appointment) =>
                    UPCOMING_STATUSES.includes(appointment.status) &&
                    new Date(appointment.startAt).getTime() >= now
            )
            .sort(
                (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
            )[0] || null;

    return (
        <ProfileClient
            user={{
                firstName: user.firstName || "",
                lastName: user.lastName || "",
                email: user.email || "",
                phone: user.phone || "",
                cedula: user.cedula || "",
                address: user.address || "",
                createdAt: user.createdAt || null,
                name: session.user.name || "",
            }}
            nextAppointment={nextAppointment}
            appointmentHistory={serializedAppointments}
        />
    );
}
