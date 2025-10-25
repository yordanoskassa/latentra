"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  Square,
  Bot,
  User,
} from "lucide-react";

import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";

import type { FC } from "react";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import * as m from "motion/react-m";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const TooltipIconButton: FC<{
  tooltip: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}> = ({ tooltip, children, className, onClick, variant = "ghost", size = "icon" }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={className}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
};

export const Thread: FC = () => {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <ThreadPrimitive.Root className="flex h-full flex-col bg-background">
          <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto max-w-3xl space-y-6">
              <ThreadPrimitive.If empty>
                <ThreadWelcome />
              </ThreadPrimitive.If>

              <ThreadPrimitive.Messages
                components={{
                  UserMessage,
                  EditComposer,
                  AssistantMessage,
                }}
              />

              <ThreadPrimitive.If empty={false}>
                <div className="h-8" />
              </ThreadPrimitive.If>
            </div>
          </ThreadPrimitive.Viewport>
          
          <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto max-w-3xl">
              <Composer />
            </div>
          </div>
          
          <ThreadScrollToBottom />
        </ThreadPrimitive.Root>
      </MotionConfig>
    </LazyMotion>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        className="fixed bottom-20 right-6 rounded-full shadow-lg"
        variant="outline"
      >
        <ArrowDownIcon className="h-4 w-4" />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
          <Bot className="w-8 h-8 text-primary" />
        </div>
        <div className="space-y-2">
          <m.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-semibold text-foreground"
          >
            Welcome to LatenTra
          </m.h1>
          <m.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground"
          >
            Your local AI assistant is ready to help
          </m.p>
        </div>
      </div>
      <ThreadSuggestions />
    </div>
  );
};

const ThreadSuggestions: FC = () => {
  const suggestions = [
    "Explain quantum computing",
    "Write a Python function",
    "Help me plan my day",
    "Tell me a joke",
  ];

  return (
    <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
      {suggestions.map((suggestion, index) => (
        <m.div
          key={suggestion}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + index * 0.05 }}
        >
          <ThreadPrimitive.Suggestion prompt={suggestion} send asChild>
            <Button
              variant="outline"
              className="h-auto p-4 text-left justify-start whitespace-normal"
            >
              {suggestion}
            </Button>
          </ThreadPrimitive.Suggestion>
        </m.div>
      ))}
    </div>
  );
};

const Composer: FC = () => {
  return (
    <div className="relative p-4">
      <ComposerPrimitive.Root className="flex items-end gap-3 rounded-lg border bg-background p-3 shadow-sm">
        <ComposerPrimitive.Input
          placeholder="Type your message..."
          className="flex-1 resize-none border-0 bg-transparent p-0 text-sm placeholder:text-muted-foreground focus-visible:outline-none"
          rows={1}
          autoFocus
        />
        <ComposerAction />
      </ComposerPrimitive.Root>
    </div>
  );
};

const ComposerAction: FC = () => {
  return (
    <div className="flex items-center gap-2">
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send message"
            variant="default"
            className="rounded-full"
          >
            <ArrowUpIcon className="h-4 w-4" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>

      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <TooltipIconButton
            tooltip="Stop generating"
            variant="outline"
            className="rounded-full"
          >
            <Square className="h-4 w-4" />
          </TooltipIconButton>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
    </div>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="group flex gap-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className="bg-primary/10">
          <Bot className="h-4 w-4 text-primary" />
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 space-y-2">
        <div className="rounded-lg bg-muted/50 p-3">
          <MessagePrimitive.Content className="prose prose-sm max-w-none dark:prose-invert" />
        </div>
        
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <BranchPicker />
          <AssistantActionBar />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex items-center gap-1"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy" size="sm">
          <MessagePrimitive.If copied>
            <CheckIcon className="h-3 w-3" />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon className="h-3 w-3" />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Regenerate" size="sm">
          <RefreshCwIcon className="h-3 w-3" />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root className="group flex gap-3 justify-end">
      <div className="flex-1 space-y-2">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-lg bg-primary p-3 text-primary-foreground">
            <MessagePrimitive.Content />
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <UserActionBar />
          <BranchPicker />
        </div>
      </div>
      
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback>
          <User className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="flex items-center gap-1"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit" size="sm">
          <PencilIcon className="h-3 w-3" />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <div className="group flex gap-3 justify-end">
      <div className="flex-1">
        <ComposerPrimitive.Root className="rounded-lg border bg-background p-3">
          <ComposerPrimitive.Input className="w-full resize-none border-0 bg-transparent p-0 text-sm focus-visible:outline-none" />
          
          <div className="mt-3 flex justify-end gap-2">
            <ComposerPrimitive.Cancel asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </ComposerPrimitive.Cancel>
            <ComposerPrimitive.Send asChild>
              <Button size="sm">
                Update
              </Button>
            </ComposerPrimitive.Send>
          </div>
        </ComposerPrimitive.Root>
      </div>
      
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback>
          <User className="h-4 w-4" />
        </AvatarFallback>
      </Avatar>
    </div>
  );
};

const BranchPicker: FC = () => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className="flex items-center gap-1"
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous" size="sm">
          <ChevronLeftIcon className="h-3 w-3" />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      
      <span className="text-xs text-muted-foreground">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next" size="sm">
          <ChevronRightIcon className="h-3 w-3" />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
