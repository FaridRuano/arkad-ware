import connectMongoDB from '@libs/mongodb'
import User from '@models/User'
import nodemailer from 'nodemailer'
import { NextResponse } from "next/server"


export async function POST(request) {

    /* Verify User */

    await connectMongoDB()

    const { userId } = await request.json();

    try {
        // Buscar y actualizar el usuario, con la opción { new: true } para obtener el documento actualizado
        const updatedUser = await User.findOneAndUpdate(
            { _id: userId },
            { emailVerified: true },
            { new: true } // Devuelve el documento modificado
        );

        // Si no se encontró el usuario
        if (!updatedUser) {
            return NextResponse.json(
                { message: "User not found", data: false },
                { status: 200 }
            );
        }

        // Si todo salió bien
        return NextResponse.json(
            { message: "User updated successfully", data: true },
            { status: 200 }
        );

    } catch (error) {
        // Manejar posibles errores (ej: ID inválido, problemas de conexión con DB)
        return NextResponse.json(
            { message: "Internal server error", data: false },
            { status: 200 }
        );
    }
}