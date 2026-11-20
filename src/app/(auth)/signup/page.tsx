import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { SignupForm } from "../auth-forms";

export const metadata = { title: "Sign up" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/dashboard");
  return <SignupForm />;
}
