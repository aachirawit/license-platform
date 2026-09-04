import { redirect } from "next/navigation";

// Entry point: send to the dashboard, which itself redirects to /login when
// there is no valid session.
export default function Home() {
  redirect("/dashboard");
}
