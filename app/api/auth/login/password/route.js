import connectMongoDB from '@libs/mongodb'
import User from '@models/User'
import { NextResponse } from "next/server"
import transporter from '@libs/mailer'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import ActionToken from '@models/ActionToken'

export async function GET(request) {

    await connectMongoDB()

    const url = request.nextUrl

    const tokenSent = url.searchParams.get('token')

    // Verificar que se haya enviado un token
    if (!tokenSent) {
        return NextResponse.json(
            { message: 'No token provided', error: true },
            { status: 200 }
        )
    }

    // Validar formato del token si es necesario (en este caso, ObjectId)
    if (!mongoose.Types.ObjectId.isValid(tokenSent)) {
        return NextResponse.json(
            { message: 'Invalid token format', error: true },
            { status: 200 }
        )
    }

    const token = await ActionToken.findById(tokenSent)

    // Si no se encuentra el token en la base de datos
    if (!token) {
        return NextResponse.json(
            { message: 'Token not found', error: true },
            { status: 200 }
        )
    }

    // Comprobar que el token no haya expirado
    if (new Date() > token.expireAt) {
        return NextResponse.json(
            { message: 'Token expired', error: true },
            { status: 200 }
        )
    }

    // Opcional: Verificar que el token no haya sido utilizado
    if (token.used) {
        return NextResponse.json(
            { message: 'Token already used', error: true },
            { status: 200 }
        )
    }

    return NextResponse.json(
        { message: 'Token found', error: false },
        { status: 200 }
    )

}

export async function POST(request) {
    const { email } = await request.json()

    await connectMongoDB()

    /* Check Email */

    const user = await User.findOne({ email })

    if (!user) {
        return NextResponse.json(
            {
                message: 'Email doesnt exists',
                error: true
            },
            { status: 200 },
        )
    }

    // Crear un nuevo token de acción para restablecer la contraseña
    const tokenDuration = 10

    const actionToken = await ActionToken.create({
        user: user._id,
        action: 'resetPassword',
        duration: tokenDuration,
    })

    const userLink = `${process.env.PUBLIC_API_URL}/client/profile/changepassword?token=${actionToken._id}`

    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: 'Cambio de Contraseña - Escuela de Artes Visuales',
        html: `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta name="color-scheme" content="light">
                    <meta name="supported-color-schemes" content="light">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; forced-color-adjust: none; -webkit-text-size-adjust: none; }
                        .header { text-align: center; margin-bottom: 20px; background-color:rgb(0, 0, 0); color: #00ff95; border-radius: 20px;}
                        .separator-logo{ height: 20px;}
                        .logo-container{text-align: center;  height: 60px;}
                        .logo { width: auto; height: 60px; }
                        .content { background-color: #f1f1f1; padding: 20px; border-radius: 5px; color: #161616; border-radius: 20px; font-weight: 500;}
                        .button { 
                            display: inline-block; 
                            padding: 10px 20px; 
                            background-color: #00ff95; 
                            color: rgb(0, 0, 0) !important; 
                            font-weight: 600;
                            text-decoration: none; 
                            border-radius: 20px; 
                            margin: 15px 0;
                        }
                        .footer { 
                            margin-top: 20px; 
                            font-size: 12px; 
                            color: #777; 
                            text-align: center;
                        }
                            @media (prefers-color-scheme: dark) {
                                body{
                                    color: #333 !important;
                                }
                                .header{ background-color:rgb(0, 0, 0) !important;}
                                .button{
                                    background-color: #00ff95; 
                                    color: rgb(255, 255, 255) !important; 
                                }
                            }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="separator-logo"></div>
                        <div class="logo-container">
                        <img
                            src="https://visualartsschool.com/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Flogo-navbar.257dcda8.webp&w=96&q=75"
                            alt="Escuela de Artes Visuales Logo" class="logo">
                        </div>
                        <div class="separator-logo"></div>
                    </div>

                    <div class="content">
                        <h2>Has solicitado un cambio de contraseña</h2>
                        <p>Si no has solicitado este cambio, puedes ignorar este mensaje.</p>
                        <p><b>${user.name}</b>, para completar este proceso, por favor haz clic en el siguiente botón:</p>

                        <p style="text-align: center;">
                        <a href="${userLink}"
                            class="button">Cambiar Contraseña</a>
                        </p>

                        <p>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
                        <p><small>${userLink}</small></p>
                    </div>

                    <div class="footer">
                        <p>© ${new Date().getFullYear()} Escuela de Artes Visuales. Todos los derechos reservados.</p>
                        <p>Si no solicitaste este cambio, ignora este mensaje.</p>
                    </div>
                </body>
            </html>
            `
    }

    if (process.env.NODE_ENV === 'development') {
        return NextResponse.json({ message: "Data created" }, { status: 200 })
    } else {
        try {
            await transporter.sendMail(mailOptions)
            console.log('Change Password email sent succesfully:', email)
        } catch (error) {
            console.error('Error at sending the change password:', error.message)
        }
        return NextResponse.json({ message: "Data created" }, { status: 200 })
    }

}

export async function PUT(request) {

    try {

        const { token, newpassword } = await request.json()

        if (!token) {
            return NextResponse.json(
                {
                    message: 'No token provided',
                    error: true
                },
                { status: 200 },
            )
        }

        if (!mongoose.Types.ObjectId.isValid(token)) {
            return NextResponse.json(
                {
                    message: 'Token not valid',
                    error: true
                },
                { status: 200 }
            )
        }

        // Buscar el token en la colección ActionToken
        const tokenDoc = await ActionToken.findById(token);

        if (!tokenDoc) {
            return NextResponse.json(
                { message: 'Token not found', error: true },
                { status: 200 }
            )
        }

        // Verificar si el token ha expirado
        if (new Date() > tokenDoc.expireAt) {
            return NextResponse.json(
                { message: 'Token expired', error: true },
                { status: 200 }
            )
        }

        // Verificar si el token ya ha sido utilizado
        if (tokenDoc.used) {
            return NextResponse.json(
                { message: 'Token already used', error: true },
                { status: 200 }
            )
        }

        // Obtener el usuario asociado al token
        const user = await User.findById(tokenDoc.user);
        if (!user) {
            return NextResponse.json(
                { message: 'User not found', error: true },
                { status: 200 }
            )
        }

        // Hashear la nueva contraseña y actualizar el usuario
        const hashedPassword = await bcrypt.hash(newpassword, 10)
        user.password = hashedPassword
        await user.save()

        // Marcar el token como utilizado
        tokenDoc.used = true
        await tokenDoc.save()

        return NextResponse.json(
            { message: "Password updated successfully", error: false },
            { status: 200 }
        )
    } catch (error) {
        return NextResponse.json(
            { message: 'Server Error', error: true },
            { status: 200 }
        )
    }
}