// /src/app/contexts/GlobalFlagContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, FC, PropsWithChildren } from "react";

type GlobalFlagContextValue = {
  activeWebRtc: boolean;
  toggleGlobalFlag: () => void;
  micStream: MediaStream | null;
};

const GlobalFlagContext = createContext<GlobalFlagContextValue | undefined>(undefined);

export const GlobalFlagProvider: FC<PropsWithChildren> = ({ children }) => {
  const [activeWebRtc, setActiveWebRtc] = useState(true);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

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
        toggleGlobalFlag,
        micStream,
      }}
    >
      {children}
    </GlobalFlagContext.Provider>
  );
};

export const useGlobalFlag = () => {
  const context = useContext(GlobalFlagContext);
  if (context === undefined) {
    throw new Error("useGlobalFlag must be used within a GlobalFlagProvider");
  }
  return context;
};