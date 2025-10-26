import path from 'path';
import { app } from 'electron';
import { LLMConfigManager } from './llm-config.js';
export class LLMService {
    constructor() {
        this.llama = null;
        this.model = null;
        this.context = null;
        this.session = null;
        this.isInitialized = false;
        this.modelPath = null;
        this.performanceProfile = 'extreme'; // Use maximum performance by default
        // Concurrency controls
        this.initPromise = null;
        this.reinitInProgress = false;
        this.chatLock = Promise.resolve();
    }
    async findAvailableModel() {
        try {
            const { existsSync, readdirSync, statSync } = await import('fs');
            const modelsDir = path.join(app.getPath('userData'), 'models');
            console.log('Looking for models in:', modelsDir);
            // Create models directory if it doesn't exist
            if (!existsSync(modelsDir)) {
                const { mkdirSync } = await import('fs');
                mkdirSync(modelsDir, { recursive: true });
                return null;
            }
            // Enhanced model selection with performance tiers
            const modelTiers = {
                // Tier 1: Best conversational models (prioritize these)
                conversational: [
                    'llama-3.2-3b-instruct-q4.gguf',
                    'llama-3.2-1b-instruct-q4.gguf',
                    'qwen2.5-3b-instruct-q4_k_m.gguf',
                    'qwen2.5-1.5b-instruct-q4_k_m.gguf',
                    'qwen2.5-0.5b-instruct-q4.gguf',
                    'phi-3.5-mini-instruct-q4.gguf',
                    'phi-3-mini-4k-instruct-q4.gguf'
                ],
                // Tier 2: High-quality larger models (if system can handle)
                premium: [
                    'llama-3.2-8b-instruct-q4_k_m.gguf',
                    'mistral-nemo-12b-instruct-2407-q4_k_m.gguf',
                    'mistral-7b-instruct-v0.3.Q4_K_M.gguf',
                    'mistral-7b-instruct-v0.2.Q4_K_M.gguf',
                    'codellama-7b-instruct.Q4_K_M.gguf'
                ],
                // Tier 3: Fast but basic (fallback for testing)
                fallback: [
                    'tinyllama-1.1b-chat-v1.0.Q4_K_M.gguf'
                ]
            };
            // Get system capabilities  
            const memoryGB = Math.round(require('os').totalmem() / (1024 ** 3));
            const isAppleSilicon = process.platform === 'darwin' && process.arch === 'arm64';
            // Select tier based on system capabilities
            let searchOrder = [];
            if (isAppleSilicon && memoryGB >= 16) {
                // High-end systems: try premium first, then conversational
                searchOrder = [...modelTiers.premium, ...modelTiers.conversational, ...modelTiers.fallback];
            }
            else if (memoryGB >= 8) {
                // Mid-range systems: conversational models only
                searchOrder = [...modelTiers.conversational, ...modelTiers.fallback];
            }
            else {
                // Low-end systems: fallback models only
                searchOrder = [...modelTiers.fallback, ...modelTiers.conversational];
            }
            console.log(`System: ${isAppleSilicon ? 'Apple Silicon' : 'Other'}, RAM: ${memoryGB}GB`);
            console.log('Model search order:', searchOrder.slice(0, 3), '...');
            // Check for preferred models in order
            for (const modelFile of searchOrder) {
                const modelPath = path.join(modelsDir, modelFile);
                if (existsSync(modelPath)) {
                    try {
                        const stats = statSync(modelPath);
                        const sizeMB = stats.size / 1024 / 1024;
                        // Skip corrupted or incomplete models
                        if (sizeMB < 50) {
                            console.log(`Skipping ${modelFile}: too small (${sizeMB.toFixed(1)}MB)`);
                            continue;
                        }
                        console.log(`Selected model: ${modelFile} (${sizeMB.toFixed(1)}MB)`);
                        return modelPath;
                    }
                    catch (error) {
                        console.log(`Error checking ${modelFile}:`, error);
                        continue;
                    }
                }
            }
            // If no preferred model found, look for any valid .gguf file
            try {
                const files = readdirSync(modelsDir);
                const ggufFiles = files
                    .filter(file => file.endsWith('.gguf'))
                    .map(file => {
                    try {
                        const filePath = path.join(modelsDir, file);
                        const stats = statSync(filePath);
                        return {
                            name: file,
                            path: filePath,
                            size: stats.size / 1024 / 1024
                        };
                    }
                    catch {
                        return null;
                    }
                })
                    .filter(file => file && file.size >= 50) // Filter out corrupted files
                    .sort((a, b) => {
                    // Sort by size - prefer medium-sized models for better balance
                    const aScore = Math.abs(a.size - 1000); // Prefer ~1GB models
                    const bScore = Math.abs(b.size - 1000);
                    return aScore - bScore;
                });
                if (ggufFiles.length > 0) {
                    const selected = ggufFiles[0];
                    console.log(`Found GGUF model: ${selected.name} (${selected.size.toFixed(1)}MB)`);
                    return selected.path;
                }
            }
            catch (error) {
                console.log('Error reading models directory:', error);
            }
            return null;
        }
        catch (error) {
            console.error('Error finding available model:', error);
            return null;
        }
    }
    async initialize() {
        // Coalesce concurrent initialize() calls
        if (this.isInitialized && this.session) {
            return;
        }
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = (async () => {
            try {
                console.log('Initializing LLM service...');
                // Find available model
                this.modelPath = await this.findAvailableModel();
                if (!this.modelPath) {
                    throw new Error('No GGUF model found in models directory. Please download a model first.');
                }
                console.log('Loading model from:', this.modelPath);
                // Dynamic import of node-llama-cpp
                const { getLlama } = await import('node-llama-cpp');
                // Get llama instance
                this.llama = await getLlama();
                // Check if model file actually exists and is readable
                const { existsSync, statSync } = await import('fs');
                if (!existsSync(this.modelPath)) {
                    throw new Error(`Model file not found: ${this.modelPath}`);
                }
                const stats = statSync(this.modelPath);
                if (stats.size === 0) {
                    throw new Error(`Model file is empty or corrupted: ${this.modelPath}`);
                }
                const modelSizeMB = stats.size / 1024 / 1024;
                console.log(`Model file size: ${modelSizeMB.toFixed(2)} MB`);
                // Warn about large models
                if (modelSizeMB > 3000) {
                    console.warn(`Warning: Large model (${modelSizeMB.toFixed(0)}MB) may be slow on CPU. Consider using a smaller model for better performance.`);
                }
                // Load model with error handling and timeout
                console.log('Loading model into memory...');
                const loadStartTime = Date.now();
                // Get optimal configuration based on hardware
                const config = LLMConfigManager.getOptimalConfig(this.performanceProfile);
                console.log('Using performance profile:', this.performanceProfile);
                console.log('LLM Configuration:', {
                    gpuLayers: config.gpuLayers,
                    threads: config.threads,
                    batchSize: config.batchSize,
                    contextSize: config.contextSize
                });
                this.model = await Promise.race([
                    this.llama.loadModel({
                        modelPath: this.modelPath,
                        gpuLayers: config.gpuLayers, // GPU acceleration for Apple Silicon
                        threads: config.threads, // Optimal thread count
                        batchSize: config.batchSize, // Optimized batch size
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Model loading timeout (120s)')), 120000))
                ]);
                const loadTime = ((Date.now() - loadStartTime) / 1000).toFixed(2);
                console.log(`Model loaded in ${loadTime} seconds`);
                if (!this.model) {
                    throw new Error('Failed to load model - model instance is null');
                }
                console.log('Creating model context...');
                this.context = await this.model.createContext({
                    sequences: 1,
                    contextSize: config.contextSize, // Dynamic context size based on profile
                });
                if (!this.context) {
                    throw new Error('Failed to create model context');
                }
                console.log('Initializing chat session...');
                const { LlamaChatSession } = await import('node-llama-cpp');
                this.session = new LlamaChatSession({
                    contextSequence: this.context.getSequence(),
                    systemPrompt: "You are a helpful, friendly AI assistant with personality. Be conversational and natural - like talking to a knowledgeable friend. Show enthusiasm, use casual language when appropriate, and don't be overly formal or robotic. Keep responses concise but engaging. When role-playing as specific agents or characters, fully embody their personality and expertise."
                });
                if (!this.session) {
                    throw new Error('Failed to create chat session');
                }
                this.isInitialized = true;
                console.log('LLM service initialized successfully');
                console.log(`Model loaded: ${path.basename(this.modelPath)}`);
            }
            catch (error) {
                console.error('Failed to initialize LLM service:', error);
                this.cleanup();
                throw error;
            }
        })();
        try {
            await this.initPromise;
        }
        finally {
            // Clear the init promise so future calls can re-init if needed
            this.initPromise = null;
        }
    }
    cleanup() {
        try {
            if (this.context) {
                this.context.dispose();
                this.context = null;
            }
            if (this.model) {
                this.model.dispose();
                this.model = null;
            }
            this.session = null;
            this.isInitialized = false;
        }
        catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
    async reinitialize() {
        if (this.reinitInProgress) {
            // If already reinitializing, wait for any in-flight init to finish
            if (this.initPromise) {
                await this.initPromise;
            }
            return;
        }
        this.reinitInProgress = true;
        try {
            console.log('Reinitializing LLM service...');
            this.cleanup();
            await this.initialize();
        }
        finally {
            this.reinitInProgress = false;
        }
    }
    async chat(message) {
        // Ensure single-file chat execution order to avoid overlapping prompts
        const run = async () => {
            if (!this.isInitialized || !this.session) {
                // Attempt to initialize on-demand
                await this.initialize();
            }
            if (!message || message.trim().length === 0) {
                throw new Error('Message cannot be empty');
            }
            try {
                console.log('Processing chat message...');
                const chatStartTime = Date.now();
                // Add timeout for chat responses (longer for larger models)
                const timeoutMs = 120000; // 2 minutes for larger models
                const response = await Promise.race([
                    this.session.prompt(message.trim()),
                    new Promise((_, reject) => setTimeout(() => reject(new Error(`Chat response timeout (${timeoutMs / 1000}s) - model may be too large for your system`)), timeoutMs))
                ]);
                if (!response || response.trim().length === 0) {
                    throw new Error('Model returned empty response');
                }
                const chatTime = ((Date.now() - chatStartTime) / 1000).toFixed(2);
                console.log(`Chat response generated successfully in ${chatTime} seconds`);
                console.log(`Response length: ${response.length} characters`);
                return response.trim();
            }
            catch (error) {
                console.error('Chat error:', error);
                // If there's a context/session error, try to reinitialize
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage?.includes('context') || errorMessage?.includes('session')) {
                    console.log('Attempting to reinitialize LLM service...');
                    try {
                        await this.reinitialize();
                        throw new Error('Model was reinitialized. Please try your message again.');
                    }
                    catch (reinitError) {
                        const reinitErrorMessage = reinitError instanceof Error ? reinitError.message : String(reinitError);
                        throw new Error(`Chat failed and reinitialize failed: ${reinitErrorMessage}`);
                    }
                }
                throw error;
            }
        };
        // Serialize chats: chain onto previous lock
        const resultPromise = this.chatLock.then(run);
        this.chatLock = resultPromise.then(() => { }).catch(() => { });
        return resultPromise;
    }
    async getModelInfo() {
        try {
            const availableModelPath = await this.findAvailableModel();
            // Determine the model name based on loaded or available model
            let modelName;
            if (this.isInitialized && this.modelPath) {
                modelName = path.basename(this.modelPath);
            }
            else if (availableModelPath) {
                modelName = path.basename(availableModelPath);
            }
            const result = {
                isLoaded: this.isInitialized,
                modelName,
                modelPath: this.modelPath || availableModelPath || undefined,
                modelSize: undefined,
                error: undefined
            };
            if (this.modelPath) {
                try {
                    const { statSync } = await import('fs');
                    const stats = statSync(this.modelPath);
                    result.modelSize = `${(stats.size / 1024 / 1024).toFixed(1)} MB`;
                }
                catch (error) {
                    console.error('Error getting model size:', error);
                }
            }
            if (!this.isInitialized) {
                if (availableModelPath) {
                    result.error = 'Model found but not loaded. Click refresh to load it.';
                }
                else {
                    result.error = 'No GGUF model found. Please download a model first.';
                }
            }
            console.log('Model info:', {
                isLoaded: result.isLoaded,
                modelName: result.modelName,
                modelPath: result.modelPath ? path.basename(result.modelPath) : undefined
            });
            return result;
        }
        catch (error) {
            console.error('Error getting model info:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                isLoaded: false,
                error: `Failed to get model information: ${errorMessage}`
            };
        }
    }
    async getAvailableModels() {
        try {
            const { existsSync, readdirSync } = await import('fs');
            const modelsDir = path.join(app.getPath('userData'), 'models');
            if (!existsSync(modelsDir)) {
                return [];
            }
            const files = readdirSync(modelsDir);
            return files.filter((file) => file.endsWith('.gguf'));
        }
        catch (error) {
            console.error('Error getting available models:', error);
            return [];
        }
    }
    setPerformanceProfile(profile) {
        this.performanceProfile = profile;
        console.log(`Performance profile set to: ${profile}`);
    }
    getPerformanceProfile() {
        return this.performanceProfile;
    }
    getAvailableProfiles() {
        return LLMConfigManager.getAvailableProfiles();
    }
    getCurrentConfig() {
        return LLMConfigManager.getOptimalConfig(this.performanceProfile);
    }
    dispose() {
        console.log('Disposing LLM service...');
        this.cleanup();
    }
}
