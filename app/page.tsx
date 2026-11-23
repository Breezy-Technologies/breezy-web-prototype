import { redirect } from "next/navigation";

// The prototype starts on the phone (23 Nov, "web as a booster": no web sign-up). The older
// V5 web onboarding stays at /onboarding (Dev menu → Restart onboarding).
export default function Index() {
  redirect("/start");
}
