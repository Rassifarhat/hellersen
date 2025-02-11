"use client";

import { useEffect, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { usePatientData } from "@/app/contexts/PatientDataContext";
import Message from "@/app/components/message";

export default function SurgicalScribePage() {
  // Get patient data from context
  const { patientData } = usePatientData();

  // Initialize the chat hook with our API endpoint and an explicit id
  const { messages, handleSubmit, setInput, handleInputChange } = useChat({
    api: "/api/scribe",
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // This ref ensures we only submit once
  const hasSubmitted = useRef(false);

  // Automatically trigger form submission once when patientData is available
  useEffect(() => {
    if (patientData?.content && !hasSubmitted.current) {
      console.log("Submitting patient data via hidden form:", patientData.content);
      // Update the chat hook input with the patient data
      setInput(patientData.content);
      // Use a small timeout to allow state to update before submitting
      setTimeout(() => {
        formRef.current?.requestSubmit();
        hasSubmitted.current = true;
      }, 0);
    }
  }, [patientData?.content, setInput]);

  // Auto-scroll when messages change
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="fixed h-full w-full bg-black">
      <div className="container h-full w-full flex flex-col py-8">
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
        </div>
        {/* Hidden form that mimics the official docs */}
        <form onSubmit={handleSubmit} ref={formRef} className="hidden">
          <input
            value=""
            onChange={handleInputChange}
            placeholder="Hidden input"
            name="input"
          />
        </form>
      </div>
    </div>
  );
}