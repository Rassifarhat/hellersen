import type { Metadata } from "next";
import "./globals.css";
import { GlobalFlagProvider } from "@/app/contexts/GlobalFlagContext";
import { PatientDataProvider } from "./contexts/PatientDataContext";

export const metadata: Metadata = {
  title: "Healthcare voice assistant",
  description: "A demo app written by Rassifarhat.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <GlobalFlagProvider>
          <PatientDataProvider>
              {children}
          </PatientDataProvider>
        </GlobalFlagProvider>
      </body>
    </html>
  );
}
