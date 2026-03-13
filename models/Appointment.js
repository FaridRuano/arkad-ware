import mongoose from "mongoose";

const AppointmentSchema = new mongoose.Schema(
  {
    // ───────────── RELACIONES ─────────────
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    barberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      required: true,
      index: true,
    },

    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
      index: true,
    },

    serviceName: {
      type: String,
      required: true,
      trim: true,
    },

    // ───────────── FECHA & HORA ─────────────
    startAt: {
      type: Date,
      required: true,
      index: true,
    },

    endAt: {
      type: Date,
      required: true,
      index: true,
    },

    // ───────────── DURACIÓN ─────────────
    durationMinutes: {
      type: Number,
      required: true,
      min: 5,
    },

    // ───────────── PRECIO ─────────────
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // ───────────── ESTADOS ─────────────
    status: {
      type: String,
      enum: [
        "pending",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_assistance",
      ],
      default: "pending",
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid",
      index: true,
    },

    // ───────────── FECHAS OPERATIVAS ─────────────
    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelReason: {
      type: String,
      enum: [
        "",
        "client_cancelled",
        "client_rescheduled",
        "barber_unavailable",
        "schedule_error",
        "other",
      ],
      default: "",
    },

    completedAt: {
      type: Date,
      default: null,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    // ───────────── ORIGEN ─────────────

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    source: {
      type: String,
      enum: ["admin-panel", "client-page"],
      default: "admin-panel",
    },

    // ───────────── AUDITORÍA ─────────────
    statusHistory: [
      {
        from: { type: String, default: "" },
        to: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        reason: { type: String, default: "", trim: true },
      },
    ],

    // ───────────── NOTAS ─────────────
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

AppointmentSchema.pre("validate", function (next) {
  if (this.startAt && this.durationMinutes) {
    this.endAt = new Date(
      new Date(this.startAt).getTime() + this.durationMinutes * 60 * 1000
    );
  }
  next();
});

AppointmentSchema.pre("save", function (next) {
  if (this.isNew && (!this.statusHistory || this.statusHistory.length === 0)) {
    this.statusHistory = [
      {
        from: "",
        to: this.status || "pending",
        changedAt: new Date(),
        changedBy: null,
        reason: "created",
      },
    ];
  }
  next();
});

AppointmentSchema.index({ barberId: 1, startAt: 1 });
AppointmentSchema.index({ barberId: 1, endAt: 1 });
AppointmentSchema.index({ clientId: 1, startAt: 1 });
AppointmentSchema.index({ status: 1, startAt: 1 });

const Appointment =
  mongoose.models?.Appointment ||
  mongoose.model("Appointment", AppointmentSchema);

export default Appointment;