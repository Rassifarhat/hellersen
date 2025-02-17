// /src/app/contexts/GlobalFlagContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, FC, PropsWithChildren } from "react";

interface GlobalFlagContextType {
  activeWebRtc: boolean;
  displayMessages: boolean;
  toggleGlobalFlag: () => void;
  setDisplayMessages: (value: boolean) => void;
  micStream: MediaStream | null;
  parallelConnection: boolean;
  setParallelConnection: (value: boolean) => void;
  spokenLanguage: string;
  setSpokenLanguage: (lang: string) => void;
};

const GlobalFlagContext = createContext<GlobalFlagContextType>({
  activeWebRtc: true,
  displayMessages: false,
  toggleGlobalFlag: () => {},
  setDisplayMessages: () => {},
  micStream: null,
  parallelConnection: false,
  setParallelConnection: () => {},
  spokenLanguage: "unknown",
  setSpokenLanguage: () => {},
});

export const GlobalFlagProvider: FC<PropsWithChildren> = ({ children }) => {
  const [activeWebRtc, setActiveWebRtc] = useState(true);
  const [displayMessages, setDisplayMessages] = useState(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const [parallelConnection, setParallelConnection] = useState(false);
  const [spokenLanguage, setSpokenLanguage] = useState<string>("unknown");

  const toggleGlobalFlag = () => {
    setActiveWebRtc((prev) => !prev);
    console.log("Global webRTC flag toggled!");
  };

  useEffect(() => {
    async function captureMic() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicStream(stream);
      } catch (err) {
        console.error("Error capturing microphone:", err);
      }
    }
    captureMic();
  }, []);

  return (
    <GlobalFlagContext.Provider
      value={{
        activeWebRtc,
        displayMessages,
        toggleGlobalFlag,
        setDisplayMessages,
        micStream,
        parallelConnection,
        setParallelConnection,
        spokenLanguage,
        setSpokenLanguage,
      }}
    >
      {children}
    </GlobalFlagContext.Provider>
  );
};

export function useGlobalFlag() {
  const context = useContext(GlobalFlagContext);
  if (!context) {
    throw new Error("useGlobalFlag must be used within a GlobalFlagProvider");
  }
  return context;
}
