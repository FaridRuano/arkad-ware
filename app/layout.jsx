import "@public/styles/global-styles.scss";
import { Manrope, Outfit } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "Arkad - Barber Empire",
  description: "Bienvenidos a Arkad - Barber Empire, tu destino definitivo para servicios de barbería excepcionales. Nuestro equipo de barberos expertos está dedicado a ofrecer cortes de cabello modernos, afeitados precisos y estilos personalizados que realzan tu apariencia y confianza.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${manrope.variable} ${outfit.variable}`}>
      <body>
        <div className="app">
          {children}
        </div>

      </body>
    </html>
  );
}
