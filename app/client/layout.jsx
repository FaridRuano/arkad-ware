import ClientHeader from "@public/components/client/ClientHeader";
import { auth } from "@auth";

export default async function ClientLayout({ children }) {
    const session = await auth();

    const userName = session?.user?.name || "Usuario";

    return (
        <div className="container client">
            <ClientHeader userName={userName} />
            {children}
        </div>
    );
}
