import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Send, Bot, User, AlertCircle, Loader2, RefreshCw } from 'lucide-react'

interface Message {
  id: string
  content: string
  sender: 'user' | 'bot'
  timestamp: Date
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [modelStatus, setModelStatus] = useState<{ isLoaded: boolean; error?: string }>({ isLoaded: false })
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    checkModelStatus()
  }, [])

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

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputMessage.trim(),
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await window.electronAPI.llm.chat(userMessage.content)
      
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Chat
              {!modelStatus.isLoaded && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  {modelStatus.error?.includes('Initializing') ? 'Initializing...' : 'Not loaded'}
                </div>
              )}
              {modelStatus.isLoaded && (
                <div className="flex items-center gap-1 text-sm text-green-600">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Ready
                </div>
              )}
            </CardTitle>
            {(modelStatus.modelName || modelStatus.modelSize) && (
              <p className="text-xs text-muted-foreground mt-1">
                {modelStatus.modelName} {modelStatus.modelSize && `(${modelStatus.modelSize})`}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={reinitializeModel}
              className="h-8"
              disabled={modelStatus.error?.includes('Initializing')}
            >
              <RefreshCw className="h-3 w-3" />
              Load
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkModelStatus}
              className="h-8"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Model Status */}
        {!modelStatus.isLoaded && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium">Model Setup Required</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              {modelStatus.error || 'Please download a GGUF model file to start chatting.'}
            </p>
            <p className="text-xs text-yellow-600 mt-2">
              Go to the "Models" page to download a compatible model.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 min-h-[400px] max-h-[500px]">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Bot className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <h3 className="font-medium text-lg mb-2">Ready to Chat</h3>
                <p className="text-sm">Start a conversation with your local AI model</p>
                {modelStatus.isLoaded && (
                  <p className="text-xs mt-2 opacity-75">
                    Try asking: "Tell me a joke" or "Explain quantum physics"
                  </p>
                )}
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.sender === 'bot' && (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4" />
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>

                {message.sender === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={modelStatus.isLoaded ? "Type your message..." : "Model not loaded"}
                disabled={!modelStatus.isLoaded || isLoading}
                className="flex-1"
              />
              <Button 
                onClick={sendMessage} 
                disabled={!inputMessage.trim() || !modelStatus.isLoaded || isLoading}
                size="icon"
              >
                <Send className="h-4 w-4" />
              </Button>
        </div>
      </CardContent>
    </Card>
  )
}
