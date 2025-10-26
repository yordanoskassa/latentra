export interface IElectronAPI {
  platform: string
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

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
}
