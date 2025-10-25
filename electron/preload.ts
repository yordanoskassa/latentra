const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  llm: {
    chat: (message: string) => ipcRenderer.invoke('llm:chat', message),
    getModelInfo: () => ipcRenderer.invoke('llm:getModelInfo'),
    reinitialize: () => ipcRenderer.invoke('llm:reinitialize'),
    getAvailableModels: () => ipcRenderer.invoke('llm:getAvailableModels'),
    getPerformanceProfiles: () => ipcRenderer.invoke('llm:getPerformanceProfiles'),
    setPerformanceProfile: (profile: string) => ipcRenderer.invoke('llm:setPerformanceProfile', profile),
  },
  model: {
    download: (modelUrl: string, filename: string) => ipcRenderer.invoke('model:download', modelUrl, filename),
    openDirectory: () => ipcRenderer.invoke('model:openDirectory'),
    onDownloadProgress: (callback: (data: { filename: string; progress: number; downloadedSize?: number; totalSize?: number }) => void) => {
      ipcRenderer.on('model:download-progress', (_: any, data: any) => callback(data))
    },
    removeDownloadProgressListener: () => {
      ipcRenderer.removeAllListeners('model:download-progress')
    }
  },
  distributed: {
    getStatus: () => ipcRenderer.invoke('distributed:getStatus'),
    getConfig: () => ipcRenderer.invoke('distributed:getConfig'),
    updateConfig: (config: any) => ipcRenderer.invoke('distributed:updateConfig', config),
    updateUserProfile: (profile: any) => ipcRenderer.invoke('distributed:updateUserProfile', profile),
    testLocalAI: () => ipcRenderer.invoke('distributed:testLocalAI'),
    getPeers: () => ipcRenderer.invoke('distributed:getPeers'),
    getMetrics: () => ipcRenderer.invoke('distributed:getMetrics'),
    getComputeDistribution: () => ipcRenderer.invoke('distributed:getComputeDistribution'),
    getCurrentRequest: () => ipcRenderer.invoke('distributed:getCurrentRequest'),
    getLocalAIStatus: () => ipcRenderer.invoke('distributed:getLocalAIStatus'),
    startLocalAI: () => ipcRenderer.invoke('distributed:startLocalAI'),
    stopLocalAI: () => ipcRenderer.invoke('distributed:stopLocalAI'),
    restartLocalAI: () => ipcRenderer.invoke('distributed:restartLocalAI'),
    getP2PToken: () => ipcRenderer.invoke('distributed:getP2PToken'),
    getSwarmInfo: () => ipcRenderer.invoke('distributed:getSwarmInfo'),
    updateLocalAIConfig: (config: any) => ipcRenderer.invoke('distributed:updateLocalAIConfig', config),
  }
})
