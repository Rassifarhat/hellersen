"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { usePatientData } from "@/app/contexts/PatientDataContext";
import Message from "@/app/components/message";
import { useTranscript } from "@/app/contexts/TranscriptContext";

export default function SurgicalScribePage() {
  // Get patient data from context
  const { patientData } = usePatientData();

  // Initialize the chat hook with our API endpoint and an explicit id.
  const { messages, append } = useChat({
    api: "/api/scribe",
    id: "surgical-scribe",
  });
  const { transcriptItems } = useTranscript();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Use a ref to track the last submitted patient data content.
  const lastSubmitted = useRef<string | null>(null);

  // Local state flag to ensure the email is sent only once
  const [emailSent, setEmailSent] = useState(false);

  // Whenever patientData.content changes (and is new), trigger a new submission.
  useEffect(() => {
    if (patientData?.content && patientData.content !== lastSubmitted.current) {
      console.log("Appending new patient data via hidden submission:", patientData.content);
      append({ content: patientData.content, role: "user" });
      lastSubmitted.current = patientData.content;
    }
  }, [patientData?.content, append]);

  // Auto-scroll when messages update.
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Monitor transcript items for the email trigger and send the email when found.
  useEffect(() => {
    // If there are no transcript items or the email has already been sent, do nothing.
    if (transcriptItems.length === 0 || emailSent) return;
    
    // Get the most recent transcript item.
    const lastItem = transcriptItems[transcriptItems.length - 1];
    // Use the "title" property (or adjust if your trigger is stored elsewhere).
    const content = lastItem.title || "";
    
    try {
      const parsed = JSON.parse(content);
      if (
        parsed.type?.trim() === "string" &&
        parsed.action?.trim() === "you have to send an email now"
      ) {
        console.log("📧 Email trigger detected in transcript");
        if (messages.length > 0) {
          const lastMessage = messages[messages.length - 1];
          const emailContent = lastMessage.content;
          // Create a subject from the first 10 words.
          const firstTenWords = emailContent
            .split(" ")
            .slice(0, 10)
            .join(" ")
            .trim() + "...";
          
          // Call the send email API.
          fetch("/api/sendEmail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: "farhat.rassi@eih.ae",
              subject: firstTenWords,
              text: emailContent,
            }),
          })
            .then(response => response.json())
            .then((data) => {
              console.log(data.message || data.error);
              setEmailSent(true);
            })
            .catch(error => {
              console.error("Error sending email:", error);
              setEmailSent(true);
            });
        }
      }
    } catch (error) {
      // Content is not valid JSON—do nothing.
    }
  }, [transcriptItems, messages, emailSent]);

  return (
    <div className="relative h-full w-full bg-black">
      <div className="container h-full w-full flex flex-col py-8">
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          {messages.map((message) => (
            <Message key={message.id} message={message} />
          ))}
        </div>
      </div>
    </div>
  );
}