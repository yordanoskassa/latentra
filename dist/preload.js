"use strict";
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
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
    }
});
