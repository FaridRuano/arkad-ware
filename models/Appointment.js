import mongoose from "mongoose";

const APPOINTMENT_STATUS = [
  "pending",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "no_assistance",
];

const PAYMENT_STATUS = ["unpaid", "paid"];

const ASSIGNMENT_STATUS = ["assigned", "unassigned"];

const CANCEL_REASONS = [
  "",
  "client_cancelled",
  "client_rescheduled",
  "barber_unavailable",
  "schedule_error",
  "other",
];

const APPOINTMENT_SOURCE = ["admin-panel", "client-page"];

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
      required: false,
      default: null,
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

    assignmentStatus: {
      type: String,
      enum: ASSIGNMENT_STATUS,
      default: "unassigned",
      index: true,
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

    serviceDurationMinutes: {
      type: Number,
      default: null,
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
      enum: APPOINTMENT_STATUS,
      default: "pending",
      index: true,
    },

    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUS,
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
      enum: CANCEL_REASONS,
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

    barberAssignedAt: {
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
      enum: APPOINTMENT_SOURCE,
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
  try {
    if (!this.durationMinutes || this.durationMinutes < 5) {
      return next(new Error("La duración de la cita debe ser de al menos 5 minutos"));
    }

    if (!this.startAt || Number.isNaN(new Date(this.startAt).getTime())) {
      return next(new Error("La fecha de inicio de la cita no es válida"));
    }

    // Recalcular endAt en base a startAt + durationMinutes
    this.endAt = new Date(
      new Date(this.startAt).getTime() + this.durationMinutes * 60 * 1000
    );

    if (!this.endAt || this.endAt <= this.startAt) {
      return next(new Error("La hora de fin de la cita no es válida"));
    }

    // Sincronizar estado de asignación
    if (this.barberId) {
      this.assignmentStatus = "assigned";

      if (!this.barberAssignedAt) {
        this.barberAssignedAt = new Date();
      }
    } else {
      this.assignmentStatus = "unassigned";
      this.barberAssignedAt = null;
    }

    next();
  } catch (error) {
    next(error);
  }
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

// Índices útiles
AppointmentSchema.index({ barberId: 1, startAt: 1 });
AppointmentSchema.index({ barberId: 1, endAt: 1 });
AppointmentSchema.index({ clientId: 1, startAt: 1 });
AppointmentSchema.index({ status: 1, startAt: 1 });
AppointmentSchema.index({ assignmentStatus: 1, startAt: 1 });

const Appointment =
  mongoose.models?.Appointment ||
  mongoose.model("Appointment", AppointmentSchema);

export default Appointment;
