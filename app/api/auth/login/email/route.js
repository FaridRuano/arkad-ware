import connectMongoDB from "@libs/mongodb"
import User from "@models/User"
import { NextResponse } from "next/server"

export async function POST(request) {

    await connectMongoDB()

    const { email } = await request.json();

    try {
        const user = await User.findOne({ email: email }).select('_id email subscription name')
        if (!user) {
            return NextResponse.json({ exists: false })
        }

        return NextResponse.json({ user: user, exists: true })
    } catch (error) {
        console.error('Error fetching user:', error)
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
    }
}