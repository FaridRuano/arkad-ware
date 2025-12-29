import Footer from "@public/components/shared/Footer";
import "@public/styles/global-styles.scss";

export const metadata = {
  title: "Arkad - Barber Empire",
  description: "Bienvenidos a Arkad - Barber Empire, tu destino definitivo para servicios de barbería excepcionales. Nuestro equipo de barberos expertos está dedicado a ofrecer cortes de cabello modernos, afeitados precisos y estilos personalizados que realzan tu apariencia y confianza.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <div className="app">
          {children}
        </div>
        <Footer/>

      </body>
    </html>
  );
}
