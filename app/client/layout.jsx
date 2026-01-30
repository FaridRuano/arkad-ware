import ClientHeader from "@public/components/client/ClientHeader";
import { auth } from "@auth";
import Footer from "@public/components/shared/Footer";

export default async function ClientLayout({ children }) {
    const session = await auth();

    const userName = session?.user?.name || "Usuario";

    return (
        <>
            <div className="container client">
                <ClientHeader userName={userName} />
                {children}
            </div>
            <Footer />
        </>

    );
}
