import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { homeForRole } from "@/lib/auth";

export default async function RootPage() {
  const session = await getSession();
  redirect(session ? homeForRole(session.role) : "/login");
}
