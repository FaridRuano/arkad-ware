import { auth } from "@auth";
import { redirect } from "next/navigation";
import Footer from "@public/components/shared/Footer/Footer";
import LoginClient from "@public/components/public/LoginClient/LoginClient";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    if (session.user.mustChangePassword) {
      redirect("/change-password");
    }

    redirect("/client");
  }

  return (
    <>
      <LoginClient />
      <Footer />
    </>
  );
}