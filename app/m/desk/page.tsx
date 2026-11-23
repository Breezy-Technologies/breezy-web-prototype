import { redirect } from "next/navigation";

// Moved: the phone's "Run this on your computer" sheet is one of the nudges on /start.
export default function DeskSheet() {
  redirect("/start?nudge=action");
}
