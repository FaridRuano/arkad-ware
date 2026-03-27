import { auth } from "@auth";
import HomeClient from "@public/components/client/HomeClient";
import Footer from "@public/components/shared/Footer";

export default async function HomePage() {
  const session = await auth();
  const userName = session?.user?.name || "";

  return (
    <>
      <HomeClient session={session} userName={userName} />
      <Footer />
    </>
  );
}