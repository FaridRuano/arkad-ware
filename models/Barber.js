import mongoose from "mongoose";

const BarberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Para activar/desactivar sin borrar
    isActive: {
      type: Boolean,
      default: true,
    },

    // Si en el futuro este barbero tiene login
    linkedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Útil para colorear en la agenda general
    color: {
      type: String,
      default: "#be902a",
    },

    // Opcional por si luego necesitas info operativa
    phone: {
      type: String,
      default: "",
    },

    notes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export default mongoose.models.Barber ||
  mongoose.model("Barber", BarberSchema);