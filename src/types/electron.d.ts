export interface IElectronAPI {
  platform: string
  getEnv?: (key: string) => Promise<string | undefined>
  llm: {
    chat: (message: string) => Promise<{ success: boolean; response?: string; error?: string }>
    getModelInfo: () => Promise<{ 
      isLoaded: boolean; 
      modelName?: string; 
      modelPath?: string;
      modelSize?: string;
      error?: string;
    }>
    reinitialize: () => Promise<{ success: boolean; error?: string }>
    getAvailableModels: () => Promise<{ success: boolean; models?: string[]; error?: string }>
    getPerformanceProfiles: () => Promise<{ success: boolean; profiles?: any; current?: string; config?: any; error?: string }>
    setPerformanceProfile: (profile: string) => Promise<{ success: boolean; message?: string; error?: string }>
  }
  model: {
    download: (modelUrl: string, filename: string) => Promise<{ success: boolean; path?: string; size?: number; error?: string }>
    openDirectory: () => Promise<{ success: boolean; error?: string }>
    onDownloadProgress: (callback: (data: { filename: string; progress: number; downloadedSize?: number; totalSize?: number }) => void) => void
    removeDownloadProgressListener: () => void
  }
  distributed: {
    getStatus: () => Promise<{ 
      success: boolean
      status?: {
        mode: 'local' | 'distributed' | 'hybrid'
        localAIAvailable: boolean
        peersConnected: number
        userProfile: {
          id: string
          displayName: string
          deviceName: string
          color: string
        }
      }
      error?: string
    }>
    getConfig: () => Promise<{
      success: boolean
      config?: {
        mode: 'local' | 'distributed' | 'hybrid'
        localAIEndpoint?: string
        p2pPort?: number
        coordinatorAddress?: string
        enableP2P: boolean
        userProfile: {
          id: string
          displayName: string
          deviceName: string
          color: string
        }
      }
      error?: string
    }>
    updateConfig: (config: any) => Promise<{ success: boolean; error?: string }>
    updateUserProfile: (profile: any) => Promise<{ success: boolean; error?: string }>
    testLocalAI: () => Promise<{ success: boolean; error?: string; latency?: number }>
    getPeers: () => Promise<{ 
      success: boolean
      peers?: Array<{
        id: string
        name: string
        address: string
        port: number
        status: 'connected' | 'disconnected' | 'busy'
        contribution: number
      }>
      error?: string
    }>
    getMetrics: () => Promise<{ success: boolean; metrics?: any; error?: string }>
    getComputeDistribution: () => Promise<{ success: boolean; distribution?: any; error?: string }>
    getCurrentRequest: () => Promise<{ success: boolean; request?: any; error?: string }>
    getLocalAIStatus: () => Promise<{
      success: boolean
      status?: {
        isRunning: boolean
        binaryAvailable: boolean
        binaryPath: string
        config: {
          port: number
          p2pPort: number
          modelsPath: string
        }
      }
      error?: string
    }>
    startLocalAI: () => Promise<{ success: boolean; error?: string }>
    stopLocalAI: () => Promise<{ success: boolean; error?: string }>
    restartLocalAI: () => Promise<{ success: boolean; error?: string }>
    getP2PToken: () => Promise<{ success: boolean; token?: string | null; error?: string }>
    getSwarmInfo: () => Promise<{ success: boolean; info?: any; error?: string }>
    updateLocalAIConfig: (config: any) => Promise<{ success: boolean; error?: string }>
  }
}

export interface Agent {
  id: string
  name: string
  role: string
  goal: string
  backstory: string
  tools: string[]
  knowledgeBase?: {
    files: string[]
    chromaCollectionId?: string
  }
  modelConfig?: {
    model: string
    temperature: number
    maxTokens: number
  }
  createdAt: string
  updatedAt: string
}

export interface AgentFile {
  id: string
  agentId: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  uploadedAt: string
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

export interface ToolResult {
  id: string
  result: any
  error?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

export interface AgentResponse {
  content: string
  toolCalls?: ToolCall[]
  needsTools?: boolean
  finished: boolean
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
    electron?: {
      getEnv?: (key: string) => Promise<string | undefined>
      composio?: {
        checkHealth: () => Promise<{ success: boolean; available?: boolean; error?: string }>
        createAuthConfig: (data: { toolkit: string, authScheme: string, scopes?: string[] }) => Promise<{ success: boolean; data?: any; error?: string; statusCode?: number }>
        getIntegrations: () => Promise<{ success: boolean; data?: any; error?: string }>
        initiateConnection: (data: { integrationId: string, authConfigId?: string, userId?: string, authScheme?: string }) => Promise<{ success: boolean; data?: any; error?: string; statusCode?: number; details?: any }>
        verifyConnection: (connectionId: string) => Promise<{ success: boolean; data?: any; error?: string; statusCode?: number }>
      }
      agent?: {
        create: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; data?: Agent; error?: string }>
        getAll: () => Promise<{ success: boolean; data?: Agent[]; error?: string }>
        getById: (id: string) => Promise<{ success: boolean; data?: Agent | null; error?: string }>
        update: (id: string, updates: Partial<Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>>) => Promise<{ success: boolean; data?: Agent | null; error?: string }>
        delete: (id: string) => Promise<{ success: boolean; data?: boolean; error?: string }>
        uploadFile: (agentId: string) => Promise<{ success: boolean; data?: AgentFile[]; error?: string }>
        getFiles: (agentId: string) => Promise<{ success: boolean; data?: AgentFile[]; error?: string }>
        deleteFile: (fileId: string) => Promise<{ success: boolean; data?: boolean; error?: string }>
        // Agent chat methods
        setCurrentAgent: (agentId: string) => Promise<{ success: boolean; data?: Agent; error?: string }>
        chat: (message: string) => Promise<{ success: boolean; data?: AgentResponse; error?: string }>
        getCurrentAgent: () => Promise<{ success: boolean; data?: Agent | null; error?: string }>
        getConversationHistory: () => Promise<{ success: boolean; data?: ChatMessage[]; error?: string }>
        clearHistory: () => Promise<{ success: boolean; error?: string }>
      }
    }
  }
}
