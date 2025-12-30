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

    // ───────────── ESTADO (opcional pero MUY útil) ─────────────
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
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
