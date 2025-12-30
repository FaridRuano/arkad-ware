import { NextResponse } from "next/server";
import { signOut } from "@auth";

export async function POST() {
  try {
    await signOut({ redirect: false });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: true, message: "Error al cerrar sesión" },
      { status: 500 }
    );
  }
}
