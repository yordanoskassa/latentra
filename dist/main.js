import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';
import { LLMService } from './llm-service.js';
import { DistributedInferenceService } from './distributed-service.js';
import { AgentDatabaseService } from './agent-service.js';
import { LangChainAgentService } from './langchain-agent-service.js';
import fs from 'fs/promises';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';
// Load environment variables from .env file
dotenvConfig({ path: path.join(__dirname, '../.env') });
const llmService = new LLMService();
const distributedService = new DistributedInferenceService(llmService);
const agentService = new AgentDatabaseService();
const langChainAgentService = new LangChainAgentService();
function createWindow() {
    const mainWindow = new BrowserWindow({
        height: 800,
        width: 1200,
        icon: path.join(__dirname, '../src/assets/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        titleBarStyle: 'hiddenInset',
        show: false,
    });
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5176');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
    }
}
app.whenReady().then(async () => {
    createWindow();
    // Initialize LLM service (optional - can be done on first chat)
    try {
        await llmService.initialize();
    }
    catch (error) {
        console.log('LLM service initialization failed, will try again on first chat:', error);
    }
    // Initialize distributed service
    try {
        await distributedService.initialize();
    }
    catch (error) {
        console.log('Distributed service initialization failed:', error);
    }
    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
    // Start lightweight relay server for peer UI -> master inference
    startRelayServer();
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        app.quit();
});
if (isDev) {
    Menu.setApplicationMenu(null);
}
// Simple relay HTTP server to allow other devices to call this device for inference
// Exposes:
//  - GET /health -> { ok: true }
//  - POST /api/relay/chat { message } -> { success, response }
async function startRelayServer() {
    try {
        const http = await import('http');
        const relayPort = Number(process.env.RELAY_PORT || 5123);
        const server = http.createServer(async (req, res) => {
            // Basic CORS for convenience
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            if (req.method === 'OPTIONS') {
                res.writeHead(204);
                res.end();
                return;
            }
            if (req.method === 'GET' && req.url === '/health') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true }));
                return;
            }
            if (req.method === 'POST' && req.url === '/api/relay/chat') {
                try {
                    let body = '';
                    req.on('data', chunk => { body += chunk; });
                    req.on('end', async () => {
                        try {
                            const parsed = JSON.parse(body || '{}');
                            const message = parsed.message || '';
                            if (!message) {
                                res.writeHead(400, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ success: false, error: 'Missing message' }));
                                return;
                            }
                            const result = await llmService.chat(message);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, response: result }));
                        }
                        catch (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: err?.message || 'Unknown error' }));
                        }
                    });
                }
                catch (error) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: error?.message || 'Unknown error' }));
                }
                return;
            }
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Not Found' }));
        });
        server.listen(relayPort, () => {
            console.log(`Relay server listening on http://0.0.0.0:${relayPort}`);
        });
    }
    catch (error) {
        console.error('Failed to start relay server:', error);
    }
}
// IPC handler for environment variables
ipcMain.handle('app:getEnv', async (event, key) => {
    try {
        return process.env[key] || undefined;
    }
    catch (error) {
        console.error('Failed to get environment variable:', error);
        return undefined;
    }
});
// IPC handlers for Composio API calls (to avoid CORS issues) - Using v3 API
ipcMain.handle('composio:createAuthConfig', async (event, data) => {
    try {
        const apiKey = process.env.COMPOSIO_API_KEY;
        if (!apiKey) {
            return { success: false, error: 'No API key configured' };
        }
        const https = await import('https');
        // Build payload for creating auth config using v3 format
        const requestBody = {
            toolkit: data.toolkit.toUpperCase(),
            auth_scheme: data.authScheme,
        };
        if (data.scopes && data.scopes.length > 0) {
            requestBody.scopes = data.scopes;
        }
        const payload = JSON.stringify(requestBody);
        console.log('[Composio] Creating auth config with payload:', requestBody);
        return new Promise((resolve) => {
            const req = https.request({
                hostname: 'backend.composio.dev',
                path: '/api/v3/auth_configs',
                method: 'POST',
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    console.log('[Composio] Create auth config response:', {
                        statusCode: res.statusCode,
                        bodyLength: data.length,
                        bodyPreview: data.substring(0, 500)
                    });
                    if (!data || data.trim() === '') {
                        console.error('[Composio] Empty response body');
                        resolve({ success: false, error: 'Empty response from Composio API', statusCode: res.statusCode });
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode === 200 || res.statusCode === 201) {
                            resolve({ success: true, data: parsed });
                        }
                        else {
                            console.error('[Composio] API error response:', parsed);
                            // Handle different v3 API error formats for createAuthConfig
                            let errorMessage = 'API error';
                            if (parsed.message) {
                                errorMessage = parsed.message;
                            }
                            else if (parsed.error) {
                                if (typeof parsed.error === 'string') {
                                    errorMessage = parsed.error;
                                }
                                else if (parsed.error.message) {
                                    errorMessage = parsed.error.message;
                                }
                            }
                            else if (parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
                                errorMessage = parsed.errors[0].message || parsed.errors[0];
                            }
                            resolve({
                                success: false,
                                error: errorMessage,
                                statusCode: res.statusCode
                            });
                        }
                    }
                    catch (error) {
                        console.error('[Composio] Failed to parse response:', data);
                        resolve({ success: false, error: 'Failed to parse response: The deployment is currently unavailable', statusCode: res.statusCode });
                    }
                });
            });
            req.on('error', (error) => {
                console.error('[Composio] Request error:', error);
                resolve({ success: false, error: error.message });
            });
            req.write(payload);
            req.end();
        });
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
ipcMain.handle('composio:getIntegrations', async () => {
    try {
        const apiKey = process.env.COMPOSIO_API_KEY;
        if (!apiKey) {
            return { success: false, error: 'No API key configured' };
        }
        const https = await import('https');
        return new Promise((resolve) => {
            const req = https.request({
                hostname: 'backend.composio.dev',
                path: '/api/v3/auth_configs',
                method: 'GET',
                timeout: 30000,
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json'
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    console.log('[Composio] Auth configs response:', {
                        statusCode: res.statusCode,
                        bodyLength: data.length,
                        bodyPreview: data.substring(0, 500)
                    });
                    if (!data || data.trim() === '') {
                        console.error('[Composio] Empty response body');
                        resolve({ success: false, error: 'Empty response from Composio API', statusCode: res.statusCode });
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode === 200) {
                            resolve({ success: true, data: parsed });
                        }
                        else {
                            console.error('[Composio] API error response:', parsed);
                            resolve({ success: false, error: parsed.message || parsed.error || 'API error', statusCode: res.statusCode });
                        }
                    }
                    catch (error) {
                        console.error('[Composio] Failed to parse response:', data);
                        resolve({ success: false, error: 'Failed to parse response: The deployment is currently unavailable', statusCode: res.statusCode });
                    }
                });
            });
            req.on('error', (error) => {
                console.error('[Composio] Request error:', error);
                resolve({ success: false, error: `Network error: ${error.message}` });
            });
            req.on('timeout', () => {
                req.destroy();
                console.error('[Composio] Request timeout');
                resolve({ success: false, error: 'Request timed out after 30 seconds' });
            });
            req.end();
        });
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
ipcMain.handle('composio:initiateConnection', async (event, data) => {
    try {
        const apiKey = process.env.COMPOSIO_API_KEY;
        if (!apiKey) {
            return { success: false, error: 'No API key configured' };
        }
        const https = await import('https');
        // Require a valid auth config id (ac_...); do NOT fall back to toolkit slug
        if (!data.authConfigId) {
            return { success: false, error: `Missing authConfigId for integration '${data.integrationId}'` };
        }
        // Build payload according to Composio v3 API format (nested objects)
        const requestBody = {
            auth_config: { id: data.authConfigId },
            connection: { user_id: data.userId || 'default-user' },
        };
        // Pass auth scheme when provided (OAuth2, API_KEY, etc.)
        if (data.authScheme) {
            requestBody.config = { auth_scheme: data.authScheme };
        }
        const payload = JSON.stringify(requestBody);
        console.log('[Composio] Initiating connection with payload:', requestBody);
        return new Promise((resolve) => {
            const req = https.request({
                hostname: 'backend.composio.dev',
                path: '/api/v3/connected_accounts',
                method: 'POST',
                timeout: 30000, // 30 second timeout
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    console.log('[Composio] Initiate connection response:', {
                        statusCode: res.statusCode,
                        headers: res.headers,
                        bodyLength: data.length,
                        bodyPreview: data.substring(0, 500)
                    });
                    // Handle empty response
                    if (!data || data.trim() === '') {
                        console.error('[Composio] Empty response body');
                        resolve({ success: false, error: 'Empty response from Composio API', statusCode: res.statusCode });
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode === 200 || res.statusCode === 201) {
                            // v3 API typically returns redirectUri, redirect_url, or redirectUrl
                            const redirectUrl = parsed.redirectUri || parsed.redirect_url || parsed.redirectUrl;
                            if (redirectUrl) {
                                resolve({ success: true, data: parsed });
                            }
                            else {
                                console.error('[Composio] No redirect URL in successful response:', parsed);
                                resolve({ success: false, error: 'No redirect URL in response' });
                            }
                        }
                        else {
                            console.error('[Composio] API error response:', parsed);
                            // Handle different v3 API error formats
                            let errorMessage = 'API error';
                            if (parsed.message) {
                                errorMessage = parsed.message;
                            }
                            else if (parsed.error) {
                                if (typeof parsed.error === 'string') {
                                    errorMessage = parsed.error;
                                }
                                else if (parsed.error.message) {
                                    errorMessage = parsed.error.message;
                                }
                            }
                            else if (parsed.errors && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
                                errorMessage = parsed.errors[0].message || parsed.errors[0];
                            }
                            resolve({
                                success: false,
                                error: errorMessage,
                                statusCode: res.statusCode,
                                details: parsed
                            });
                        }
                    }
                    catch (error) {
                        console.error('[Composio] Failed to parse response. Raw data:', data);
                        resolve({ success: false, error: `Failed to parse response: The deployment is currently unavailable`, statusCode: res.statusCode });
                    }
                });
            });
            req.on('error', (error) => {
                console.error('[Composio] Request error:', error);
                resolve({ success: false, error: `Network error: ${error.message}` });
            });
            req.on('timeout', () => {
                req.destroy();
                console.error('[Composio] Request timeout');
                resolve({ success: false, error: 'Request timed out after 30 seconds' });
            });
            req.write(payload);
            req.end();
        });
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
ipcMain.handle('composio:verifyConnection', async (event, connectionId) => {
    try {
        const apiKey = process.env.COMPOSIO_API_KEY;
        if (!apiKey) {
            return { success: false, error: 'No API key configured' };
        }
        const https = await import('https');
        return new Promise((resolve) => {
            const req = https.request({
                hostname: 'backend.composio.dev',
                path: `/api/v3/connected_accounts/${connectionId}`,
                method: 'GET',
                timeout: 30000,
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'application/json'
                }
            }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    console.log('[Composio] Verify connection response:', {
                        statusCode: res.statusCode,
                        bodyLength: data.length,
                        bodyPreview: data.substring(0, 500)
                    });
                    if (!data || data.trim() === '') {
                        console.error('[Composio] Empty response body');
                        resolve({ success: false, error: 'Empty response from Composio API', statusCode: res.statusCode });
                        return;
                    }
                    try {
                        const parsed = JSON.parse(data);
                        if (res.statusCode === 200) {
                            resolve({ success: true, data: parsed });
                        }
                        else {
                            console.error('[Composio] API error response:', parsed);
                            resolve({ success: false, error: parsed.message || parsed.error || 'API error', statusCode: res.statusCode });
                        }
                    }
                    catch (error) {
                        console.error('[Composio] Failed to parse response:', data);
                        resolve({ success: false, error: 'Failed to parse response: The deployment is currently unavailable', statusCode: res.statusCode });
                    }
                });
            });
            req.on('error', (error) => {
                console.error('[Composio] Request error:', error);
                resolve({ success: false, error: `Network error: ${error.message}` });
            });
            req.on('timeout', () => {
                req.destroy();
                console.error('[Composio] Request timeout');
                resolve({ success: false, error: 'Request timed out after 30 seconds' });
            });
            req.end();
        });
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
// IPC handlers for model downloading
ipcMain.handle('model:download', async (event, modelUrl, filename) => {
    const https = await import('https');
    const fs = await import('fs');
    const modelDir = path.join(app.getPath('userData'), 'models');
    // Create models directory if it doesn't exist
    if (!fs.existsSync(modelDir)) {
        fs.mkdirSync(modelDir, { recursive: true });
        console.log(`Created models directory: ${modelDir}`);
    }
    const modelPath = path.join(modelDir, filename);
    // Check if file already exists
    if (fs.existsSync(modelPath)) {
        console.log(`Model ${filename} already exists`);
        return { success: false, error: 'Model already exists' };
    }
    const downloadFile = (url, maxRedirects = 5) => {
        return new Promise((resolve, reject) => {
            if (maxRedirects === 0) {
                reject(new Error('Too many redirects'));
                return;
            }
            console.log(`Downloading from: ${url}`);
            const tempFilePath = path.join(modelDir, `${filename}.tmp`);
            // Clean up any existing temp file
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
            const file = fs.createWriteStream(tempFilePath);
            let downloadTimeout;
            let isComplete = false;
            let lastProgressTime = Date.now();
            const cleanup = () => {
                if (downloadTimeout)
                    clearTimeout(downloadTimeout);
                if (fs.existsSync(tempFilePath)) {
                    try {
                        fs.unlinkSync(tempFilePath);
                    }
                    catch (error) {
                        console.error('Error cleaning up temp file:', error);
                    }
                }
            };
            // Set overall download timeout (15 minutes)
            downloadTimeout = setTimeout(() => {
                if (!isComplete) {
                    file.close();
                    cleanup();
                    reject(new Error('Download timeout - the download took too long'));
                }
            }, 900000);
            const request = https.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
                    file.close();
                    cleanup();
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        console.log(`Following redirect to: ${redirectUrl}`);
                        clearTimeout(downloadTimeout);
                        resolve(downloadFile(redirectUrl, maxRedirects - 1));
                        return;
                    }
                    else {
                        reject(new Error('Redirect response without location header'));
                        return;
                    }
                }
                if (response.statusCode !== 200) {
                    cleanup();
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                    return;
                }
                const totalSize = parseInt(response.headers['content-length'] || '0', 10);
                let downloadedSize = 0;
                if (totalSize === 0) {
                    cleanup();
                    reject(new Error('Invalid file size - content-length header missing or zero'));
                    return;
                }
                console.log(`Download started - Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
                response.pipe(file);
                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    const progress = Math.round((downloadedSize / totalSize) * 100);
                    const now = Date.now();
                    // Send progress update every 500ms
                    if (now - lastProgressTime > 500) {
                        event.sender.send('model:download-progress', { filename, progress, downloadedSize, totalSize });
                        lastProgressTime = now;
                    }
                });
                file.on('finish', () => {
                    file.close((closeErr) => {
                        if (closeErr) {
                            cleanup();
                            reject(closeErr);
                            return;
                        }
                        // Verify file size
                        try {
                            const stats = fs.statSync(tempFilePath);
                            if (stats.size !== totalSize) {
                                cleanup();
                                reject(new Error(`File size mismatch. Expected ${totalSize}, got ${stats.size}`));
                                return;
                            }
                            // Move temp file to final location
                            fs.renameSync(tempFilePath, modelPath);
                            isComplete = true;
                            clearTimeout(downloadTimeout);
                            console.log(`Download completed successfully: ${filename}`);
                            console.log(`Final file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
                            // Try to reinitialize LLM service with new model
                            llmService.reinitialize().catch(err => {
                                console.log('Failed to auto-load new model:', err.message);
                            });
                            resolve({ success: true, path: modelPath, size: stats.size });
                        }
                        catch (error) {
                            cleanup();
                            reject(error);
                        }
                    });
                });
                file.on('error', (err) => {
                    console.error('File write error:', err);
                    cleanup();
                    reject(err);
                });
                response.on('error', (err) => {
                    console.error('Response error:', err);
                    cleanup();
                    reject(err);
                });
            });
            request.on('error', (err) => {
                console.error('Request error:', err);
                cleanup();
                reject(err);
            });
            // Set request timeout
            request.setTimeout(30000, () => {
                cleanup();
                reject(new Error('Request timeout - no response from server'));
            });
        });
    };
    try {
        console.log(`Starting download: ${filename}`);
        return await downloadFile(modelUrl);
    }
    catch (error) {
        console.error('Download error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown download error'
        };
    }
});
ipcMain.handle('model:openDirectory', async () => {
    try {
        const { shell } = await import('electron');
        const modelDir = path.join(app.getPath('userData'), 'models');
        const fs = await import('fs');
        // Create directory if it doesn't exist
        if (!fs.existsSync(modelDir)) {
            fs.mkdirSync(modelDir, { recursive: true });
        }
        shell.openPath(modelDir);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
// IPC handlers for LLM communication
ipcMain.handle('llm:chat', async (event, message) => {
    try {
        if (!llmService) {
            throw new Error('LLM service not available');
        }
        // Try to initialize if not already done
        const modelInfo = await llmService.getModelInfo();
        if (!modelInfo.isLoaded) {
            console.log('Model not loaded, attempting to initialize...');
            await llmService.initialize();
        }
        const response = await llmService.chat(message);
        return { success: true, response };
    }
    catch (error) {
        console.error('Chat error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
// IPC handlers for agent chat
ipcMain.handle('agent:setCurrentAgent', async (event, agentId) => {
    try {
        const agent = agentService.getAgentById(agentId);
        if (!agent) {
            return { success: false, error: 'Agent not found' };
        }
        langChainAgentService.setAgent(agent);
        return { success: true, data: agent };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('agent:chat', async (event, message) => {
    try {
        const response = await langChainAgentService.chat(message);
        return { success: true, data: response };
    }
    catch (error) {
        console.error('Agent chat error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('agent:getCurrentAgent', async () => {
    try {
        const agent = langChainAgentService.getCurrentAgent();
        return { success: true, data: agent };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('agent:getConversationHistory', async () => {
    try {
        const history = langChainAgentService.getConversationHistory();
        return { success: true, data: history };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('agent:clearHistory', async () => {
    try {
        langChainAgentService.clearHistory();
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('llm:getModelInfo', async () => {
    try {
        return await llmService.getModelInfo();
    }
    catch (error) {
        console.error('Error getting model info:', error);
        return { isLoaded: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('llm:reinitialize', async () => {
    try {
        await llmService.reinitialize();
        return { success: true };
    }
    catch (error) {
        console.error('Reinitialize error:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('llm:getAvailableModels', async () => {
    try {
        const models = await llmService.getAvailableModels();
        return { success: true, models };
    }
    catch (error) {
        console.error('Error getting available models:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('llm:getPerformanceProfiles', async () => {
    try {
        const profiles = llmService.getAvailableProfiles();
        const current = llmService.getPerformanceProfile();
        const config = llmService.getCurrentConfig();
        return { success: true, profiles, current, config };
    }
    catch (error) {
        console.error('Error getting performance profiles:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('llm:setPerformanceProfile', async (event, profile) => {
    try {
        llmService.setPerformanceProfile(profile);
        return { success: true, message: 'Profile updated. Restart required for changes to take effect.' };
    }
    catch (error) {
        console.error('Error setting performance profile:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
// IPC handlers for distributed inference
ipcMain.handle('distributed:getStatus', async () => {
    try {
        return { success: true, status: distributedService.getStatus() };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:getConfig', async () => {
    try {
        return { success: true, config: distributedService.getConfig() };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:updateConfig', async (event, config) => {
    try {
        await distributedService.updateConfig(config);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:updateUserProfile', async (event, profile) => {
    try {
        await distributedService.updateUserProfile(profile);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:testLocalAI', async () => {
    try {
        return await distributedService.testLocalAI();
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:getPeers', async () => {
    try {
        return { success: true, peers: distributedService.getPeers() };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:getMetrics', async () => {
    try {
        return { success: true, metrics: distributedService.getMetrics() };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:getComputeDistribution', async () => {
    try {
        return { success: true, distribution: distributedService.getComputeDistribution() };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:getCurrentRequest', async () => {
    try {
        return { success: true, request: distributedService.getCurrentRequest() };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:getLocalAIStatus', async () => {
    try {
        return { success: true, status: distributedService.getLocalAIStatus() };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:startLocalAI', async () => {
    try {
        await distributedService.startLocalAI();
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:stopLocalAI', async () => {
    try {
        await distributedService.stopLocalAI();
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:restartLocalAI', async () => {
    try {
        await distributedService.restartLocalAI();
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:getP2PToken', async () => {
    try {
        const token = await distributedService.getP2PToken();
        return { success: true, token };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:getSwarmInfo', async () => {
    try {
        const info = await distributedService.getSwarmInfo();
        return { success: true, info };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('distributed:updateLocalAIConfig', async (event, config) => {
    try {
        distributedService.updateLocalAIConfig(config);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
// Agent IPC handlers
ipcMain.handle('agent:create', async (event, agent) => {
    try {
        const newAgent = agentService.createAgent(agent);
        return { success: true, data: newAgent };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('agent:getAll', async () => {
    try {
        const agents = agentService.getAllAgents();
        return { success: true, data: agents };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('agent:getById', async (event, id) => {
    try {
        const agent = agentService.getAgentById(id);
        return { success: true, data: agent };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('agent:update', async (event, id, updates) => {
    try {
        const updatedAgent = agentService.updateAgent(id, updates);
        return { success: true, data: updatedAgent };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('agent:delete', async (event, id) => {
    try {
        const success = agentService.deleteAgent(id);
        return { success, data: success };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('agent:uploadFile', async (event, agentId) => {
    try {
        // Show file picker dialog
        const result = await dialog.showOpenDialog({
            properties: ['openFile', 'multiSelections'],
            filters: [
                { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'doc', 'docx'] },
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        if (result.canceled || result.filePaths.length === 0) {
            return { success: false, error: 'No files selected' };
        }
        const files = [];
        for (const filePath of result.filePaths) {
            const stats = await fs.stat(filePath);
            const fileName = path.basename(filePath);
            // Copy file to agent's knowledge base directory
            const agentFilesDir = path.join(app.getPath('userData'), 'agent-files', agentId);
            await fs.mkdir(agentFilesDir, { recursive: true });
            const destPath = path.join(agentFilesDir, fileName);
            await fs.copyFile(filePath, destPath);
            const agentFile = agentService.addAgentFile(agentId, {
                fileName,
                filePath: destPath,
                fileSize: stats.size,
                mimeType: getMimeType(fileName)
            });
            if (agentFile) {
                files.push(agentFile);
            }
        }
        return { success: true, data: files };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('agent:getFiles', async (event, agentId) => {
    try {
        const files = agentService.getAgentFiles(agentId);
        return { success: true, data: files };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
ipcMain.handle('agent:deleteFile', async (event, fileId) => {
    try {
        const success = agentService.deleteAgentFile(fileId);
        return { success, data: success };
    }
    catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});
// Helper function to get MIME type
function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
        '.pdf': 'application/pdf',
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.csv': 'text/csv',
        '.json': 'application/json'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}
// Cleanup on app quit
app.on('before-quit', () => {
    if (llmService) {
        llmService.dispose();
    }
    if (distributedService) {
        distributedService.dispose();
    }
    if (agentService) {
        agentService.close();
    }
});
