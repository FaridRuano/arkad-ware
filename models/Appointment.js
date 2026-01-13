import mongoose from "mongoose";

const AppointmentSchema = new mongoose.Schema(
  {
    // ───────────── RELACIÓN ─────────────
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ───────────── FECHA & HORA ─────────────
    startAt: {
      type: Date,
      required: true,
      index: true,
    },

    // ───────────── DURACIÓN ─────────────
    durationMinutes: {
      type: Number,
      required: true,
      min: 30,
    },

    // ───────────── PRECIO ─────────────
    price: {
      type: Number,
      required: true,
      min: 8,
    },

    // ───────────── ESTADOS ─────────────
    status: {
      type: String,
      enum: ["pending", "confirmed", "in progress", "completed", "cancelled", "no assistance"],
      default: "pending",
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
    },

    // ───────────── NOTAS (opcional) ─────────────
    notes: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Appointment =
  mongoose.models?.Appointment ||
  mongoose.model("Appointment", AppointmentSchema);

export default Appointment;
