import Footer from "@public/components/shared/Footer/Footer";

export default function ClientLayout({ children }) {

    return (
        <>
            <div>
                {children}
            </div>
            <Footer />
        </>
    );
}