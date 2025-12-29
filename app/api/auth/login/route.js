import { NextResponse } from "next/server";
import { signIn } from "@auth";

export async function POST(req) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: true, message: "Datos incompletos" },
      { status: 400 }
    );
  }

  try {
    await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    // 🔑 AQUÍ está la clave
    if (error?.type === "CredentialsSignin") {
      return NextResponse.json(
        { error: true, message: "Credenciales inválidas" },
        { status: 200 }
      );
    }

    console.error("Auth error:", error);

    return NextResponse.json(
      { error: true, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
