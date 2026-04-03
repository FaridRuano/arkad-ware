import { auth } from "@auth";
import UpdatePasswordClient from "@public/components/public/UpdatePasswordClient/UpdatePasswordClient";
import Footer from "@public/components/shared/Footer/Footer";
import { redirect } from "next/navigation";


export default async function UpdatePasswordPage() {
    const session = await auth();

    if (!session?.user) {
        redirect("/");
    }

    return (
        <>
            <UpdatePasswordClient
                sessionUser={{
                    id: session.user.id,
                    role: session.user.role,
                    isFirstLogin: session.user.isFirstLogin,
                    name: session.user.name || "",
                    email: session.user.email || "",
                }}
            />
            <Footer/>
        </>

    );
}