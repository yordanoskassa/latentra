"use strict";
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    getEnv: (key) => ipcRenderer.invoke('app:getEnv', key),
    llm: {
        chat: (message) => ipcRenderer.invoke('llm:chat', message),
        getModelInfo: () => ipcRenderer.invoke('llm:getModelInfo'),
        reinitialize: () => ipcRenderer.invoke('llm:reinitialize'),
        getAvailableModels: () => ipcRenderer.invoke('llm:getAvailableModels'),
        getPerformanceProfiles: () => ipcRenderer.invoke('llm:getPerformanceProfiles'),
        setPerformanceProfile: (profile) => ipcRenderer.invoke('llm:setPerformanceProfile', profile),
    },
    model: {
        download: (modelUrl, filename) => ipcRenderer.invoke('model:download', modelUrl, filename),
        openDirectory: () => ipcRenderer.invoke('model:openDirectory'),
        onDownloadProgress: (callback) => {
            ipcRenderer.on('model:download-progress', (_, data) => callback(data));
        },
        removeDownloadProgressListener: () => {
            ipcRenderer.removeAllListeners('model:download-progress');
        }
    },
    distributed: {
        getStatus: () => ipcRenderer.invoke('distributed:getStatus'),
        getConfig: () => ipcRenderer.invoke('distributed:getConfig'),
        updateConfig: (config) => ipcRenderer.invoke('distributed:updateConfig', config),
        updateUserProfile: (profile) => ipcRenderer.invoke('distributed:updateUserProfile', profile),
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
        updateLocalAIConfig: (config) => ipcRenderer.invoke('distributed:updateLocalAIConfig', config),
    }
});
// Also expose a simpler interface for compatibility
contextBridge.exposeInMainWorld('electron', {
    getEnv: (key) => ipcRenderer.invoke('app:getEnv', key),
    composio: {
        getIntegrations: () => ipcRenderer.invoke('composio:getIntegrations'),
        initiateConnection: (data) => ipcRenderer.invoke('composio:initiateConnection', data),
        verifyConnection: (connectionId) => ipcRenderer.invoke('composio:verifyConnection', connectionId)
    },
    agent: {
        create: (agent) => ipcRenderer.invoke('agent:create', agent),
        getAll: () => ipcRenderer.invoke('agent:getAll'),
        getById: (id) => ipcRenderer.invoke('agent:getById', id),
        update: (id, updates) => ipcRenderer.invoke('agent:update', id, updates),
        delete: (id) => ipcRenderer.invoke('agent:delete', id),
        uploadFile: (agentId) => ipcRenderer.invoke('agent:uploadFile', agentId),
        getFiles: (agentId) => ipcRenderer.invoke('agent:getFiles', agentId),
        deleteFile: (fileId) => ipcRenderer.invoke('agent:deleteFile', fileId)
    }
});
