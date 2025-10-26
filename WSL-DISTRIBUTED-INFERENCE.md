# Distributed Inference on Windows via WSL

## Overview

Windows doesn't have native LocalAI binaries, but we've implemented **automatic WSL2 fallback** to enable full distributed inference on Windows!

## How It Works

1. **Automatic Detection**: When you start the app on Windows, it checks for a native LocalAI binary
2. **WSL Fallback**: If not found, it automatically uses WSL2 to run the Linux version
3. **Seamless Integration**: Your Windows app connects to `localhost:8080` - WSL2's networking makes this transparent
4. **Full Features**: You get complete distributed inference, P2P discovery, and swarm capabilities

## Setup Requirements

### Install WSL2

If you don't have WSL2 installed:

```powershell
# Run in PowerShell as Administrator
wsl --install
```

Then restart your computer.

### Verify WSL2

```powershell
wsl --status
```

You should see "Default Version: 2"

## What Happens Automatically

When you start Latentra on Windows:

1. ✅ Checks for native Windows LocalAI binary
2. ✅ Falls back to WSL2 if not available
3. ✅ Downloads LocalAI Linux binary to WSL (`~/.latentra/local-ai`)
4. ✅ Syncs your models from Windows to WSL (`~/.latentra/models`)
5. ✅ Starts LocalAI in WSL with P2P enabled
6. ✅ Your app connects via `localhost:8080`

## First Run

The first time you enable distributed inference on Windows:

- LocalAI binary (~400MB) downloads to WSL
- Your models sync to WSL (if not already there)
- This may take a few minutes depending on model sizes

Subsequent starts are much faster!

## Benefits

### ✅ Full Distributed Inference
- Share computation across devices on your network
- Mac, Linux, and Windows devices can all participate
- Automatic load balancing

### ✅ P2P Discovery
- Automatically finds other Latentra instances
- mDNS-based discovery (no configuration needed)
- Real-time peer status

### ✅ Performance
- WSL2 has near-native Linux performance
- GPU passthrough support (if you have WSL2 GPU drivers)
- Efficient localhost networking

## Architecture

```
┌─────────────────────────────────────────┐
│         Windows (Electron App)          │
│                                         │
│  ┌─────────────────────────────────┐  │
│  │   Latentra UI                   │  │
│  │   (React + TypeScript)          │  │
│  └──────────────┬──────────────────┘  │
│                 │ IPC                  │
│  ┌──────────────▼──────────────────┐  │
│  │   LocalAI Manager               │  │
│  │   (Detects: No Windows binary)  │  │
│  └──────────────┬──────────────────┘  │
│                 │                      │
│  ┌──────────────▼──────────────────┐  │
│  │   WSL Manager                   │  │
│  │   • Check WSL availability      │  │
│  │   • Download LocalAI Linux      │  │
│  │   • Sync models                 │  │
│  │   • Start via wsl command       │  │
│  └──────────────┬──────────────────┘  │
└─────────────────┼────────────────────┘
                  │
                  │ localhost:8080
                  │
┌─────────────────▼────────────────────┐
│         WSL2 (Linux)                  │
│                                       │
│  ┌─────────────────────────────────┐│
│  │   LocalAI Binary (Linux)        ││
│  │   • P2P Mode                    ││
│  │   • mDNS Discovery              ││
│  │   • Model Inference             ││
│  └─────────────────────────────────┘│
│                                       │
│  Models: ~/.latentra/models/         │
└───────────────────────────────────────┘
                  │
                  │ Network (P2P)
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼──────┐  ┌────────▼────────┐
│  Mac Device  │  │  Windows Device │
│  (LocalAI)   │  │  (WSL2+LocalAI) │
└──────────────┘  └─────────────────┘
```

## Troubleshooting

### "WSL is not available"

Install WSL2:
```powershell
wsl --install
```

### "LocalAI startup timeout"

Check WSL is running:
```powershell
wsl --status
```

### Models Not Syncing

Manually check WSL models:
```bash
wsl ls ~/.latentra/models/
```

### Port Already in Use

Check what's using port 8080:
```powershell
netstat -ano | findstr :8080
```

## Performance Tips

1. **Use WSL2** (not WSL1) - much faster
2. **Store models in WSL** for better I/O performance
3. **Enable GPU** in WSL2 if you have compatible drivers
4. **Allocate RAM** to WSL2 in `.wslconfig` if needed

## File Locations

### Windows
- App Data: `%APPDATA%\latentra`
- Models: `%APPDATA%\latentra\models`

### WSL
- LocalAI Binary: `~/.latentra/local-ai`
- Models: `~/.latentra/models/`

## Future Enhancements

- [ ] Docker support as alternative to WSL
- [ ] GPU acceleration detection in WSL
- [ ] Automatic model format optimization
- [ ] Hybrid inference (partial Windows, partial WSL)

## Comparison

| Platform | Native Binary | WSL Support | Distributed Inference |
|----------|--------------|-------------|----------------------|
| macOS    | ✅ Yes       | N/A         | ✅ Yes               |
| Linux    | ✅ Yes       | N/A         | ✅ Yes               |
| Windows  | ❌ No        | ✅ Yes      | ✅ Yes (via WSL)     |



