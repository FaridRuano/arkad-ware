import { auth } from "@auth";
import { redirect } from "@node_modules/next/navigation";

export default async function ClientLayout({ children }) {
    const session = await auth();

    if (!session?.user) {
        redirect("/");
    }

    if (session.user.role !== "admin") {
        redirect("/client");
    }
    return (
        <div className="admin">
            {children}
        </div>
    );
}
