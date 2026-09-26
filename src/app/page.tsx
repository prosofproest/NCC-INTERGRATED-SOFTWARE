import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function RootPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.mustChangePassword) {
    redirect("/change-password");
  }

  if (session.role === "admin") {
    redirect("/admin");
  } else if (session.role === "cto") {
    redirect("/cto");
  } else if (session.role === "cadet") {
    redirect("/cadet");
  }

  redirect("/login");
}
