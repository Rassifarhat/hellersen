import type { Metadata } from "next";
import "./globals.css";
import { GlobalFlagProvider } from "@/app/contexts/GlobalFlagContext";
import { PatientDataProvider } from "./contexts/PatientDataContext";
import { EmailProvider } from "./contexts/EmailContext";

export const metadata: Metadata = {
  title: "Realtime API Agents",
  description: "A demo app from OpenAI.",
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
            <EmailProvider>
              {children}
            </EmailProvider>
          </PatientDataProvider>
        </GlobalFlagProvider>
      </body>
    </html>
  );
}
