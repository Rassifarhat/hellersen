import { useCallback, useState, useEffect } from 'react';
import { SessionStatus, AgentConfig } from '@/app/types';
import { useEvent } from '@/app/contexts/EventContext';

interface UseSessionManagementParams {
  selectedAgentName: string;
  selectedAgentConfigSet: AgentConfig[] | null;
  activeWebRtc: boolean;
}

export function useSessionManagement({
  selectedAgentName,
  selectedAgentConfigSet,
  activeWebRtc,
}: UseSessionManagementParams) {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>("DISCONNECTED");
  const { logClientEvent } = useEvent();

  const fetchEphemeralKey = async (): Promise<string | null> => {
    logClientEvent({ url: "/session" }, "fetch_session_token_request");
    const tokenResponse = await fetch("/api/session");
    if (!tokenResponse.ok) {
      console.error("Failed to fetch session token");
      return null;
    }
    const { token } = await tokenResponse.json();
    return token;
  };

  const connectToRealtime = useCallback(async () => {
    if (!selectedAgentName || !selectedAgentConfigSet) {
      console.error("Cannot connect: missing agent configuration");
      return;
    }

    try {
      setSessionStatus("CONNECTING");
      const token = await fetchEphemeralKey();
      if (!token) {
        throw new Error("Failed to obtain session token");
      }

      // Additional connection logic here...
      setSessionStatus("CONNECTED");
    } catch (error) {
      console.error("Error connecting to realtime:", error);
      setSessionStatus("DISCONNECTED");
    }
  }, [selectedAgentName, selectedAgentConfigSet]);

  // Effect to handle initial connection
  useEffect(() => {
    if (selectedAgentName && sessionStatus === "DISCONNECTED") {
      connectToRealtime();
    }
  }, [selectedAgentName, sessionStatus, connectToRealtime]);

  // Effect to handle WebRTC track enabling/disabling
  useEffect(() => {
    if (pcRef.current) {
      const senders = pcRef.current.getSenders();
      senders.forEach((sender) => {
        if (sender.track) {
          sender.track.enabled = activeWebRtc;
          console.log(`WebRTC ${sender.track.kind} track ${activeWebRtc ? "enabled" : "disabled"}`);
        }
      });
    }
  }, [activeWebRtc]);

  return {
    sessionStatus,
    setSessionStatus,
    connectToRealtime,
  };
}
