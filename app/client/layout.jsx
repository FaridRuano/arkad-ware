import ClientHeader from "@public/components/ClientHeader";

export default function RootLayout({ children }) {
    return (
        <div className="container client">
            <ClientHeader/>
            {children}
        </div>
    );
}
