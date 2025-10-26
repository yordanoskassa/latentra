import os from 'os';
export class LLMConfigManager {
    static isAppleSilicon() {
        return process.platform === 'darwin' && process.arch === 'arm64';
    }
    static isARM() {
        return process.arch === 'arm64' || process.arch === 'arm';
    }
    static getCPUCount() {
        return os.cpus().length;
    }
    static getTotalMemoryGB() {
        return Math.round(os.totalmem() / (1024 ** 3));
    }
    static getOptimalConfig(profile = 'auto') {
        const cpuCount = this.getCPUCount();
        const memoryGB = this.getTotalMemoryGB();
        const isAppleSilicon = this.isAppleSilicon();
        const isARM = this.isARM();
        console.log('System Detection:', {
            platform: process.platform,
            arch: process.arch,
            cpuCount,
            memoryGB,
            isAppleSilicon,
            isARM
        });
        // Auto-detect best profile
        if (profile === 'auto') {
            if (isAppleSilicon && memoryGB >= 32) {
                profile = 'extreme';
            }
            else if (isAppleSilicon && memoryGB >= 16) {
                profile = 'maximum';
            }
            else if (isAppleSilicon && memoryGB >= 8) {
                profile = 'performance';
            }
            else if (isARM || memoryGB >= 8) {
                profile = 'balanced';
            }
            else {
                profile = 'cpu-only';
            }
            console.log(`Auto-selected profile: ${profile}`);
        }
        let config;
        switch (profile) {
            case 'extreme':
                // Maximum performance for Apple Silicon with 32GB+ RAM
                config = {
                    gpuLayers: isAppleSilicon ? 99 : 0, // Use all available GPU layers
                    threads: isAppleSilicon ? 8 : Math.min(cpuCount, 12),
                    batchSize: 4096,
                    contextSize: 16384, // Large context for better conversations
                    profile: 'extreme'
                };
                break;
            case 'maximum':
                // Best for Apple Silicon with 16GB+ RAM
                config = {
                    gpuLayers: isAppleSilicon ? 50 : 0,
                    threads: isAppleSilicon ? 6 : Math.min(cpuCount, 10),
                    batchSize: 3072,
                    contextSize: 12288,
                    profile: 'maximum'
                };
                break;
            case 'performance':
                // Good for Apple Silicon or powerful CPUs with 8GB+ RAM
                config = {
                    gpuLayers: isAppleSilicon ? 40 : 0,
                    threads: isAppleSilicon ? 4 : Math.min(Math.floor(cpuCount * 0.75), 12),
                    batchSize: 2048,
                    contextSize: 8192,
                    profile: 'performance'
                };
                break;
            case 'balanced':
                // Good middle ground for most systems
                config = {
                    gpuLayers: isAppleSilicon ? 20 : 0,
                    threads: Math.min(Math.floor(cpuCount * 0.6), 8),
                    batchSize: 512,
                    contextSize: 2048,
                    profile: 'balanced'
                };
                break;
            case 'cpu-only':
                // Conservative, works everywhere
                config = {
                    gpuLayers: 0,
                    threads: Math.min(Math.floor(cpuCount * 0.5), 6),
                    batchSize: 256,
                    contextSize: 1024,
                    profile: 'cpu-only'
                };
                break;
            default:
                // Fallback to balanced
                config = this.getOptimalConfig('balanced');
        }
        console.log('Selected LLM Configuration:', config);
        return config;
    }
    static getProfileDescription(profile) {
        switch (profile) {
            case 'auto':
                return 'automatically detects best settings for your hardware';
            case 'extreme':
                return 'maximum possible performance, requires 32gb+ ram (apple silicon only)';
            case 'maximum':
                return 'fastest performance, requires 16gb+ ram (apple silicon optimized)';
            case 'performance':
                return 'fast with good memory usage (recommended for apple silicon)';
            case 'balanced':
                return 'good balance of speed and resource usage';
            case 'cpu-only':
                return 'conservative settings, works on any system';
            default:
                return 'unknown profile';
        }
    }
    static getAvailableProfiles() {
        return [
            { name: 'auto', description: this.getProfileDescription('auto') },
            { name: 'extreme', description: this.getProfileDescription('extreme') },
            { name: 'maximum', description: this.getProfileDescription('maximum') },
            { name: 'performance', description: this.getProfileDescription('performance') },
            { name: 'balanced', description: this.getProfileDescription('balanced') },
            { name: 'cpu-only', description: this.getProfileDescription('cpu-only') },
        ];
    }
    static createCustomConfig(overrides) {
        const baseConfig = this.getOptimalConfig('auto');
        return {
            ...baseConfig,
            ...overrides,
            profile: 'auto' // Mark as custom
        };
    }
}
