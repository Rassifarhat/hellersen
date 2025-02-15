import type { Metadata } from "next";
import "./globals.css";
import { GlobalFlagProvider } from "@/app/contexts/GlobalFlagContext";
import { PatientDataProvider } from "./contexts/PatientDataContext";
import { LanguageProvider } from './contexts/LanguageContext';

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
            <LanguageProvider>
              {children}
            </LanguageProvider>
          </PatientDataProvider>
        </GlobalFlagProvider>
      </body>
    </html>
  );
}
