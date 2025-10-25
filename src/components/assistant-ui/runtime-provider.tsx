"use client";

import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react";
import { type ReactNode } from "react";

interface MyRuntimeProviderProps {
  children: ReactNode;
}

export function MyRuntimeProvider({ children }: MyRuntimeProviderProps) {
  const runtime = useLocalRuntime(async (messages: any) => {
    try {
      // Get the latest message
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage || lastMessage.role !== "user") {
        throw new Error("Expected user message");
      }

      // Send to our Electron LLM service
      const response = await window.electronAPI.llm.chat(lastMessage.content);
      
      if (!response.success) {
        throw new Error(response.error || "Chat failed");
      }

      return {
        role: "assistant",
        content: [{ type: "text", text: response.response || "" }],
      };
    } catch (error) {
      console.error("Chat error:", error);
      return {
        role: "assistant",
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      };
    }
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
