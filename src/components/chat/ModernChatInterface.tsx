"use client";

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Send, Bot, User, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import {
  AIInput,
  AIInputTextarea,
  AIInputToolbar,
  AIInputTools,
  AIInputSubmit,
  AIInputModelSelect,
  AIInputModelSelectTrigger,
  AIInputModelSelectValue,
  AIInputModelSelectContent,
  AIInputModelSelectItem,
} from '@/components/ui/ai-input'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { NetworkStatus } from './NetworkStatus'
import { Agent } from '../types/electron'

interface Message {
  id: string
  content: string
  sender: 'user' | 'bot'
  timestamp: Date
}

export function ModernChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [modelStatus, setModelStatus] = useState<{ isLoaded: boolean; error?: string }>({ isLoaded: false })
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('')
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    checkModelStatus()
    loadAvailableModels()
    loadAgents()
  }, [])

  const loadAgents = async () => {
    try {
      const result = await window.electron?.agent?.getAll()
      if (result?.success && result.data) {
        setAgents(result.data)
      }
    } catch (error) {
      console.error('Failed to load agents:', error)
    }
  }

  const loadAvailableModels = async () => {
    try {
      const response = await window.electronAPI.llm.getAvailableModels()
      if (response.success && response.models) {
        setAvailableModels(response.models)
      }
      
      // Get currently loaded model
      const modelInfo = await window.electronAPI.llm.getModelInfo()
      if (modelInfo.modelName) {
        setSelectedModel(modelInfo.modelName)
      }
    } catch (error) {
      console.error('Failed to load available models:', error)
    }
  }

  const handleModelChange = async (modelName: string) => {
    setSelectedModel(modelName)
    // Note: Model switching would require backend support to unload/load different models
    // For now, this just updates the UI
  }

  const checkModelStatus = async () => {
    try {
      const status = await window.electronAPI.llm.getModelInfo()
      setModelStatus(status)
    } catch (error) {
      setModelStatus({ isLoaded: false, error: 'Failed to check model status' })
    }
  }

  const reinitializeModel = async () => {
    try {
      setModelStatus({ isLoaded: false, error: 'Initializing model...' })
      const result = await window.electronAPI.llm.reinitialize()
      if (result.success) {
        await checkModelStatus()
      } else {
        setModelStatus({ isLoaded: false, error: result.error || 'Failed to reinitialize model' })
      }
    } catch (error) {
      setModelStatus({ isLoaded: false, error: 'Failed to reinitialize model' })
    }
  }

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: content.trim(),
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    try {
      let response
      
      if (selectedAgent) {
        // Use agent chat when an agent is selected
        response = await window.electron?.agent?.chat(content.trim())
        
        if (response?.success && response.data) {
          const agentResponse = response.data
          const botMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: agentResponse.content,
            sender: 'bot',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, botMessage])
        } else {
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: `Agent Error: ${response?.error || 'Failed to get response from agent'}`,
            sender: 'bot',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, errorMessage])
        }
      } else {
        // Use direct LLM chat when no agent is selected
        response = await window.electronAPI.llm.chat(content.trim())
        
        if (response.success && response.response) {
          const botMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: response.response,
            sender: 'bot',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, botMessage])
        } else {
          const errorMessage: Message = {
            id: (Date.now() + 1).toString(),
            content: `Error: ${response.error || 'Unknown error occurred'}`,
            sender: 'bot',
            timestamp: new Date()
          }
          setMessages(prev => [...prev, errorMessage])
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
        sender: 'bot',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const message = formData.get('message') as string
    if (message?.trim()) {
      sendMessage(message)
      // Reset the form
      e.currentTarget.reset()
      setInputMessage('')
    }
  }

  const getSuggestions = () => {
    if (selectedAgent) {
      // Generate contextual suggestions based on agent's role and tools
      const suggestions: string[] = []
      const role = selectedAgent.role.toLowerCase()
      
      // Role-specific suggestions
      if (role.includes('assistant') || role.includes('secretary')) {
        if (selectedAgent.tools.some(tool => tool.toLowerCase().includes('gmail'))) {
          suggestions.push("Send an email to my client about the project update")
          suggestions.push("Check my inbox for urgent messages")
        }
        if (selectedAgent.tools.some(tool => tool.toLowerCase().includes('calendar'))) {
          suggestions.push("Schedule a meeting with the team for next week")
          suggestions.push("What's on my calendar for today?")
        }
      }
      
      if (role.includes('developer') || role.includes('engineer')) {
        if (selectedAgent.tools.some(tool => tool.toLowerCase().includes('github'))) {
          suggestions.push("Create a bug report in our main repository")
          suggestions.push("Check the latest pull requests")
        }
        if (selectedAgent.tools.some(tool => tool.toLowerCase().includes('slack'))) {
          suggestions.push("Send a message to the dev team about the deployment")
        }
      }
      
      if (role.includes('manager') || role.includes('lead')) {
        if (selectedAgent.tools.some(tool => tool.toLowerCase().includes('calendar'))) {
          suggestions.push("Schedule a team standup for tomorrow at 10am")
        }
        if (selectedAgent.tools.some(tool => tool.toLowerCase().includes('slack'))) {
          suggestions.push("Send a status update to the #general channel")
        }
        if (selectedAgent.tools.some(tool => tool.toLowerCase().includes('notion'))) {
          suggestions.push("Create a project roadmap document")
        }
      }
      
      // Generic tool-based suggestions if role-specific ones don't apply
      if (suggestions.length === 0) {
        if (selectedAgent.tools.some(tool => tool.toLowerCase().includes('gmail'))) {
          suggestions.push("Send an email about our upcoming project")
        }
        if (selectedAgent.tools.some(tool => tool.toLowerCase().includes('calendar'))) {
          suggestions.push("Schedule a follow-up meeting")
        }
        if (selectedAgent.tools.some(tool => tool.toLowerCase().includes('slack'))) {
          suggestions.push("Send a team announcement")
        }
        if (selectedAgent.tools.some(tool => tool.toLowerCase().includes('github'))) {
          suggestions.push("Create an issue for the new feature")
        }
        if (selectedAgent.tools.some(tool => tool.toLowerCase().includes('notion'))) {
          suggestions.push("Create a new project note")
        }
      }
      
      // Always add agent-specific help suggestions
      suggestions.push("What tasks can you help me with?")
      suggestions.push(`Tell me more about your ${selectedAgent.tools.length} tools`)
      
      return suggestions.slice(0, 4) // Limit to 4 suggestions
    }
    
    // Enhanced default suggestions for direct LLM chat
    return [
      "Explain a complex concept simply",
      "Help me write some code", 
      "Brainstorm ideas for my project",
      "Analyze this problem I'm facing",
    ]
  }

  const suggestions = getSuggestions()

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header with Network Status and Agent Selector */}
      <div className="flex items-center justify-between gap-4 p-2 border-b bg-background/95">
        <div className="flex items-center gap-2 flex-1">
          <Bot className="w-4 h-4 text-muted-foreground" />
          <Select
            value={selectedAgent?.id || 'none'}
            onValueChange={async (value) => {
              if (value === 'none') {
                setSelectedAgent(null)
                // Clear any active agent
                await window.electron?.agent?.clearHistory()
              } else {
                const agent = agents.find(a => a.id === value)
                if (agent) {
                  setSelectedAgent(agent)
                  // Set the current agent in the backend
                  const result = await window.electron?.agent?.setCurrentAgent(agent.id)
                  if (result?.success) {
                    // Clear messages when switching agents
                    setMessages([])
                    // Add initial agent greeting
                    const greetingMessage: Message = {
                      id: Date.now().toString(),
                      content: `Hello! I'm ${agent.name}, your ${agent.role}. ${agent.backstory ? agent.backstory.substring(0, 200) + '...' : ''}\n\nI have access to these tools: ${agent.tools.join(', ')}\n\nHow can I help you today?`,
                      sender: 'bot',
                      timestamp: new Date()
                    }
                    setMessages([greetingMessage])
                  } else {
                    console.error('Failed to set current agent:', result?.error)
                  }
                }
              }
            }}
          >
            <SelectTrigger className="w-[250px] h-8 text-sm">
              <SelectValue placeholder="Select an agent (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Agent (Direct Chat)</SelectItem>
              {agents.map(agent => (
                <SelectItem key={agent.id} value={agent.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{agent.name}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {agent.role}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedAgent && (
            <span className="text-xs text-muted-foreground lowercase">
              • {selectedAgent.tools.length} tools configured
            </span>
          )}
        </div>
        <NetworkStatus />
      </div>

      {/* Model Status */}
      {!modelStatus.isLoaded && (
        <div className="p-4 bg-yellow-50 border-b border-yellow-200">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Model Setup Required</span>
            <Button
              variant="outline"
              size="sm"
              onClick={reinitializeModel}
              className="ml-auto h-7"
              disabled={modelStatus.error?.includes('Initializing')}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Load Model
            </Button>
          </div>
          <p className="text-sm text-yellow-700 mt-1">
            {modelStatus.error || 'Please download a GGUF model file to start chatting.'}
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center space-y-4"
              >
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-semibold text-foreground">
                    Welcome to latentra
                  </h1>
                  <p className="text-muted-foreground">
                    Your local AI assistant is ready to help
                  </p>
                </div>
              </motion.div>
              
              {modelStatus.isLoaded && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md"
                >
                  {suggestions.map((suggestion, index) => (
                    <motion.div
                      key={suggestion}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + index * 0.05 }}
                    >
                      <Button
                        variant="outline"
                        className="h-auto p-4 text-left justify-start whitespace-normal w-full"
                        onClick={() => setInputMessage(suggestion)}
                      >
                        {suggestion}
                      </Button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </div>
          ) : (
            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.sender === 'bot' && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary/10">
                        <Bot className="h-4 w-4 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  
                  <div className={`max-w-[80%] ${message.sender === 'user' ? 'order-first' : ''}`}>
                    <div
                      className={`rounded-lg p-3 ${
                        message.sender === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 px-1">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>

                  {message.sender === 'user' && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 justify-start"
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input with Model Picker */}
      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-3xl p-4">
          <AIInput onSubmit={handleSubmit}>
            <AIInputTextarea
              placeholder={modelStatus.isLoaded ? "Type your message..." : "Model not loaded"}
              disabled={!modelStatus.isLoaded || isLoading}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
            />
            <AIInputToolbar>
              <AIInputTools>
                <AIInputModelSelect value={selectedModel} onValueChange={handleModelChange}>
                  <AIInputModelSelectTrigger className="w-[180px]">
                    <AIInputModelSelectValue placeholder="Select model" />
                  </AIInputModelSelectTrigger>
                  <AIInputModelSelectContent>
                    {availableModels.map((model) => (
                      <AIInputModelSelectItem key={model} value={model}>
                        {model.replace('.gguf', '')}
                      </AIInputModelSelectItem>
                    ))}
                  </AIInputModelSelectContent>
                </AIInputModelSelect>
              </AIInputTools>
              <AIInputSubmit disabled={!inputMessage.trim() || !modelStatus.isLoaded || isLoading}>
                <Send className="h-4 w-4" />
              </AIInputSubmit>
            </AIInputToolbar>
          </AIInput>
        </div>
      </div>
    </div>
  )
}
