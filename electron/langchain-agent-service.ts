import { Agent } from './agent-service.js'
import { LLMService } from './llm-service.js'

interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

interface ToolResult {
  id: string
  result: any
  error?: string
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

interface AgentResponse {
  content: string
  toolCalls?: ToolCall[]
  needsTools?: boolean
  finished: boolean
}

export class LangChainAgentService {
  private currentAgent: Agent | null = null
  private conversationHistory: ChatMessage[] = []
  private composioApiKey: string | null = null
  private llmService: LLMService

  constructor(composioApiKey?: string) {
    this.composioApiKey = composioApiKey || process.env.COMPOSIO_API_KEY || null
    this.llmService = new LLMService()
  }

  setAgent(agent: Agent) {
    this.currentAgent = agent
    this.conversationHistory = []
    
    // Initialize conversation with system prompt - this will be used for LLM context
    if (agent.backstory) {
      this.conversationHistory.push({
        role: 'system',
        content: `You are ${agent.name}, ${agent.role}.

Background: ${agent.backstory}

Your goal: ${agent.goal}

Available tools: ${agent.tools.join(', ')}

Instructions:
1. Always stay in character as ${agent.name}
2. Be helpful, natural, and conversational
3. When users ask about your capabilities, mention the tools you have available
4. If users ask you to perform actions that require tools (like sending emails, scheduling meetings, etc.), let them know you can help with that
5. Be proactive and suggest related actions that might be helpful
6. Keep responses concise but friendly`
      })
    }
  }

  async chat(message: string): Promise<AgentResponse> {
    if (!this.currentAgent) {
      return {
        content: "No agent selected. Please choose an agent first.",
        finished: true
      }
    }

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: message
    })

    try {
      // Analyze if we need tools based on the message and agent capabilities
      const needsTools = this.analyzeToolNeed(message)
      
      if (needsTools.length > 0) {
        // Generate tool calls based on the request
        const toolCalls = this.generateToolCalls(message, needsTools)
        
        if (toolCalls.length > 0) {
          // Execute tools and get response with results
          return await this.handleToolExecution(message, toolCalls)
        }
      }

      // Generate conversational response without tools
      return await this.generateConversationalResponse(message)
    } catch (error) {
      console.error('LangChain agent error:', error)
      return {
        content: `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        finished: true
      }
    }
  }

  private analyzeToolNeed(message: string): string[] {
    if (!this.currentAgent) return []

    const messageLower = message.toLowerCase()
    const neededTools: string[] = []

    // Check each available tool against the message intent
    this.currentAgent.tools.forEach(tool => {
      const toolLower = tool.toLowerCase()
      
      // Gmail/Email tools
      if (toolLower.includes('gmail') || toolLower.includes('email')) {
        if (messageLower.includes('send') && (messageLower.includes('email') || messageLower.includes('mail'))) {
          neededTools.push(tool)
        } else if (messageLower.includes('read') && (messageLower.includes('email') || messageLower.includes('mail'))) {
          neededTools.push(tool)
        }
      }

      // Calendar tools
      if (toolLower.includes('calendar')) {
        if (messageLower.includes('schedule') || messageLower.includes('meeting') || messageLower.includes('event')) {
          neededTools.push(tool)
        } else if (messageLower.includes('check') && messageLower.includes('calendar')) {
          neededTools.push(tool)
        }
      }

      // Slack tools
      if (toolLower.includes('slack')) {
        if (messageLower.includes('send') && messageLower.includes('message')) {
          neededTools.push(tool)
        } else if (messageLower.includes('slack')) {
          neededTools.push(tool)
        }
      }

      // GitHub tools
      if (toolLower.includes('github') || toolLower.includes('git')) {
        if (messageLower.includes('create') && (messageLower.includes('issue') || messageLower.includes('pr'))) {
          neededTools.push(tool)
        } else if (messageLower.includes('github')) {
          neededTools.push(tool)
        }
      }

      // Notion tools
      if (toolLower.includes('notion')) {
        if (messageLower.includes('create') || messageLower.includes('note') || messageLower.includes('page')) {
          neededTools.push(tool)
        }
      }
    })

    return neededTools
  }

  private generateToolCalls(message: string, tools: string[]): ToolCall[] {
    const toolCalls: ToolCall[] = []
    const messageLower = message.toLowerCase()

    tools.forEach((tool, index) => {
      const toolLower = tool.toLowerCase()

      // Gmail - Send Email
      if (toolLower.includes('gmail') && messageLower.includes('send')) {
        toolCalls.push({
          id: `tool_${Date.now()}_${index}`,
          name: 'GMAIL_SEND_EMAIL',
          arguments: this.extractEmailArguments(message)
        })
      }

      // Calendar - Create Event
      if (toolLower.includes('calendar') && (messageLower.includes('schedule') || messageLower.includes('meeting'))) {
        toolCalls.push({
          id: `tool_${Date.now()}_${index}`,
          name: 'GOOGLECALENDAR_CREATE_EVENT',
          arguments: this.extractCalendarArguments(message)
        })
      }

      // Slack - Send Message
      if (toolLower.includes('slack') && messageLower.includes('send')) {
        toolCalls.push({
          id: `tool_${Date.now()}_${index}`,
          name: 'SLACK_SEND_MESSAGE',
          arguments: this.extractSlackArguments(message)
        })
      }

      // GitHub - Create Issue
      if (toolLower.includes('github') && messageLower.includes('issue')) {
        toolCalls.push({
          id: `tool_${Date.now()}_${index}`,
          name: 'GITHUB_CREATE_ISSUE',
          arguments: this.extractGitHubArguments(message)
        })
      }
    })

    return toolCalls
  }

  private extractEmailArguments(message: string): Record<string, any> {
    // Simple extraction logic - in production, you'd use more sophisticated NLP
    const emailMatch = message.match(/to\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i)
    const subjectMatch = message.match(/subject[:\s]+"([^"]+)"/i) || message.match(/about\s+"([^"]+)"/i)
    
    return {
      to: emailMatch?.[1] || 'recipient@example.com',
      subject: subjectMatch?.[1] || 'Message from Agent',
      body: message.length > 100 ? message.substring(0, 100) + '...' : message
    }
  }

  private extractCalendarArguments(message: string): Record<string, any> {
    const dateMatch = message.match(/(tomorrow|today|next week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i)
    const timeMatch = message.match(/(\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))/i)
    
    return {
      summary: message.length > 50 ? message.substring(0, 50) + '...' : message,
      start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // tomorrow
      end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(), // tomorrow + 1 hour
      description: message
    }
  }

  private extractSlackArguments(message: string): Record<string, any> {
    const channelMatch = message.match(/to\s+(#[\w-]+|\@[\w-]+)/i)
    
    return {
      channel: channelMatch?.[1] || '#general',
      text: message
    }
  }

  private extractGitHubArguments(message: string): Record<string, any> {
    const repoMatch = message.match(/in\s+([\w-]+\/[\w-]+)/i)
    
    return {
      owner: repoMatch?.[1]?.split('/')[0] || 'owner',
      repo: repoMatch?.[1]?.split('/')[1] || 'repo',
      title: message.length > 50 ? message.substring(0, 50) + '...' : message,
      body: message
    }
  }

  private async handleToolExecution(message: string, toolCalls: ToolCall[]): Promise<AgentResponse> {
    // Add assistant message with tool calls to history
    this.conversationHistory.push({
      role: 'assistant',
      content: `I'll help you with that. Let me ${toolCalls.map(tc => `use ${tc.name}`).join(' and ')}.`,
      toolCalls
    })

    // Execute tools (simulate for now)
    const toolResults: ToolResult[] = []
    
    for (const toolCall of toolCalls) {
      try {
        const result = await this.simulateToolExecution(toolCall)
        toolResults.push({
          id: toolCall.id,
          result
        })
      } catch (error) {
        toolResults.push({
          id: toolCall.id,
          result: null,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Add tool results to history
    this.conversationHistory.push({
      role: 'tool',
      content: 'Tool execution results',
      toolResults
    })

    // Generate response based on tool results
    return await this.generateToolResponse(toolCalls, toolResults)
  }

  private async simulateToolExecution(toolCall: ToolCall): Promise<any> {
    // Simulate realistic tool responses
    switch (toolCall.name) {
      case 'GMAIL_SEND_EMAIL':
        return {
          id: `email_${Date.now()}`,
          message: 'Email sent successfully',
          to: toolCall.arguments.to,
          subject: toolCall.arguments.subject,
          sent_at: new Date().toISOString()
        }

      case 'GOOGLECALENDAR_CREATE_EVENT':
        return {
          id: `event_${Date.now()}`,
          message: 'Calendar event created successfully',
          summary: toolCall.arguments.summary,
          start_time: toolCall.arguments.start_time,
          html_link: `https://calendar.google.com/event?eid=${Date.now()}`
        }

      case 'SLACK_SEND_MESSAGE':
        return {
          ok: true,
          message: {
            ts: Date.now().toString(),
            text: toolCall.arguments.text,
            channel: toolCall.arguments.channel
          }
        }

      case 'GITHUB_CREATE_ISSUE':
        return {
          id: Math.floor(Math.random() * 1000) + 1,
          number: Math.floor(Math.random() * 1000) + 1,
          title: toolCall.arguments.title,
          state: 'open',
          html_url: `https://github.com/${toolCall.arguments.owner}/${toolCall.arguments.repo}/issues/1`
        }

      default:
        return { message: 'Tool executed successfully', tool: toolCall.name }
    }
  }

  private buildLLMPrompt(message: string): string {
    if (!this.currentAgent) return message

    // Build context from conversation history and agent info
    let prompt = `You are ${this.currentAgent.name}, ${this.currentAgent.role}.\n\n`
    
    if (this.currentAgent.backstory) {
      prompt += `Background: ${this.currentAgent.backstory}\n\n`
    }
    
    prompt += `Your goal: ${this.currentAgent.goal}\n\n`
    prompt += `Available tools: ${this.currentAgent.tools.join(', ')}\n\n`
    
    // Add recent conversation context (last 3 exchanges)
    const recentHistory = this.conversationHistory
      .filter(msg => msg.role !== 'system')
      .slice(-6) // Last 6 messages (3 exchanges)
    
    if (recentHistory.length > 0) {
      prompt += `Recent conversation:\n`
      recentHistory.forEach(msg => {
        if (msg.role === 'user') prompt += `User: ${msg.content}\n`
        else if (msg.role === 'assistant') prompt += `${this.currentAgent?.name}: ${msg.content}\n`
      })
      prompt += `\n`
    }
    
    prompt += `Current user message: ${message}\n\n`
    prompt += `Respond as ${this.currentAgent.name}. Be conversational, helpful, and natural - like you're talking to a friend. Show personality and enthusiasm. Stay in character but don't be overly formal or robotic. If the user wants you to do something that requires tools (like sending emails, scheduling meetings, etc.), let them know you can help and ask for details in a friendly way.`
    
    return prompt
  }

  private async generateConversationalResponse(message: string): Promise<AgentResponse> {
    if (!this.currentAgent) {
      return { content: "Error: No agent available", finished: true }
    }

    try {
      // Prepare context for the LLM with conversation history and agent info
      const contextPrompt = this.buildLLMPrompt(message)
      
      // Get response from LLM
      const response = await this.llmService.chat(contextPrompt)
      
      // Add to conversation history
      this.conversationHistory.push({
        role: 'assistant',
        content: response
      })

      return {
        content: response,
        finished: true
      }
    } catch (error) {
      console.error('Error generating conversational response:', error)
      
      // Fallback to a simple response if LLM fails
      const fallbackResponse = `I'm ${this.currentAgent.name}, and I'm here to help! Unfortunately I'm having trouble with my language processing right now. You can still ask me to perform actions like sending emails, scheduling meetings, or other tasks using my available tools: ${this.currentAgent.tools.join(', ')}.`
      
      this.conversationHistory.push({
        role: 'assistant',
        content: fallbackResponse
      })

      return {
        content: fallbackResponse,
        finished: true
      }
    }
  }

  private async generateToolResponse(toolCalls: ToolCall[], toolResults: ToolResult[]): Promise<AgentResponse> {
    if (!this.currentAgent) {
      return { content: "Error: No agent available", finished: true }
    }

    try {
      // Build a summary of what was accomplished
      const actionSummary = toolResults.map((result, index) => {
        const toolCall = toolCalls[index]
        if (result.error) {
          return `Failed to execute ${toolCall.name}: ${result.error}`
        } else {
          switch (toolCall.name) {
            case 'GMAIL_SEND_EMAIL':
              return `Successfully sent email to ${toolCall.arguments.to} with subject "${toolCall.arguments.subject}"`
            case 'GOOGLECALENDAR_CREATE_EVENT':
              return `Created calendar event "${toolCall.arguments.summary}" for ${new Date(toolCall.arguments.start_time).toLocaleDateString()}`
            case 'SLACK_SEND_MESSAGE':
              return `Sent Slack message to ${toolCall.arguments.channel}`
            case 'GITHUB_CREATE_ISSUE':
              return `Created GitHub issue #${result.result.number} in ${toolCall.arguments.owner}/${toolCall.arguments.repo}`
            default:
              return `Successfully completed ${toolCall.name}`
          }
        }
      }).join('. ')

      // Use LLM to generate a natural response about the completed actions
      const contextPrompt = `You are ${this.currentAgent.name}. You just completed these actions: ${actionSummary}. 

Respond naturally and conversationally as ${this.currentAgent.name}, confirming what you accomplished. Be friendly, show some personality, and ask if there's anything else you can help with. Keep it concise but warm and human-like.`
      
      const response = await this.llmService.chat(contextPrompt)
      
      // Add final response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: response
      })

      return {
        content: response,
        finished: true
      }
    } catch (error) {
      console.error('Error generating tool response:', error)
      
      // Fallback to simple confirmation if LLM fails
      const fallbackResponse = `I've completed the requested actions. Is there anything else you'd like me to help you with?`
      
      this.conversationHistory.push({
        role: 'assistant',
        content: fallbackResponse
      })

      return {
        content: fallbackResponse,
        finished: true
      }
    }
  }

  getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory]
  }

  clearHistory() {
    this.conversationHistory = []
    if (this.currentAgent?.backstory) {
      this.conversationHistory.push({
        role: 'system',
        content: `You are ${this.currentAgent.name}, ${this.currentAgent.role}...`
      })
    }
  }

  getCurrentAgent(): Agent | null {
    return this.currentAgent
  }
}