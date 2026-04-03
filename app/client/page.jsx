import HomeClient from "@public/components/client/Home/HomeClient/HomeClient";
import { auth } from "@auth";
import React from "react";

const page = async () => {
  const session = await auth();

  const userName = session?.user?.name || "Usuario";

  return (
    <>
      <HomeClient userName={userName} session={session} />
    </>
  );
};

export default page;