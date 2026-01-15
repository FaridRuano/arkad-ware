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
      enum: [
        "pending",
        "confirmed",
        "in progress",
        "completed",
        "cancelled",
        "no assistance",
      ],
      default: "pending",
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
    },

    // ───────────── AUDITORÍA: CAMBIOS DE ESTADO ─────────────
    statusHistory: [
      {
        from: { type: String, default: "" },
        to: { type: String, required: true },

        changedAt: { type: Date, default: Date.now },

        // quién ejecutó la acción (barbero/admin/staff)
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },

        // opcional: motivo o comentario
        reason: { type: String, default: "", trim: true },
      },
    ],

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

AppointmentSchema.pre("save", function (next) {
  // Si es nuevo doc y no hay historial, guarda el estado inicial
  if (this.isNew && (!this.statusHistory || this.statusHistory.length === 0)) {
    this.statusHistory = [
      {
        from: "",
        to: this.status,
        changedAt: new Date(),
        changedBy: this.user, // o null si prefieres
        reason: "created",
      },
    ];
  }

  next();
});

const Appointment =
  mongoose.models?.Appointment ||
  mongoose.model("Appointment", AppointmentSchema);

export default Appointment;
