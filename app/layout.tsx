import type { Metadata } from "next";
import "./globals.css";
import { MapProvider } from "@/components/map/MapProvider";
import { AppStateProvider } from "@/components/AppState";
import { SavedProvider } from "@/components/SavedState";

export const metadata: Metadata = {
  title: "Breezy · Web prototype",
  description: "Onboarding, activation and the Home Web experience on one shared map.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/vendor/phosphor/regular/style.css" />
        <link rel="stylesheet" href="/vendor/phosphor/bold/style.css" />
        <link rel="stylesheet" href="/vendor/phosphor/fill/style.css" />
      </head>
      <body>
        <AppStateProvider>
          <SavedProvider>
            <MapProvider>{children}</MapProvider>
          </SavedProvider>
        </AppStateProvider>
      </body>
    </html>
  );
}
