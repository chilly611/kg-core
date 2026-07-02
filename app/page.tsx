import { redirect } from "next/navigation";

// The workspace IS the app.
export default function Home() {
  redirect("/workspace");
}
