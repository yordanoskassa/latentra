# WSL LocalAI Auto-Fallback Fix

## Problem
LocalAI was not working on Windows because:
1. The system only tried to auto-start LocalAI if a native binary was available
2. On Windows without a native binary, `binaryAvailable` was false
3. The WSL fallback existed but was never automatically triggered
4. Users had to manually enable WSL mode, which wasn't obvious
5. WSL detection was using cached results (failing permanently after first failure)
6. WSL commands were failing due to PATH issues in Electron's child_process

## Solution

### Changes Made

#### 1. **electron/localai-manager.ts**
- Modified `_start()` method to automatically try WSL fallback on Windows when native binary is not found
- Now when `start()` is called, it automatically detects Windows and attempts WSL if the native binary is missing
- This makes WSL transparent to the user

```typescript
// Before: Threw an error if binary not found
if (!this.isBinaryAvailable()) {
  throw new Error(`LocalAI binary not found...`)
}

// After: Automatically tries WSL on Windows
if (!this.isBinaryAvailable()) {
  if (process.platform === 'win32') {
    console.log('Native LocalAI binary not found, attempting WSL fallback...')
    return this._startViaWSL()
  }
  throw new Error(`LocalAI binary not found...`)
}
```

#### 2. **electron/distributed-service.ts**
- Removed the `status.binaryAvailable` check from auto-start logic
- Now attempts to start LocalAI even if native binary isn't available
- WSL fallback happens automatically through the LocalAIManager

```typescript
// Before: Only auto-started if binary available
} else if (this.config.enableP2P && status.binaryAvailable && !this.manuallyStopped) {

// After: Always tries to auto-start (WSL fallback is automatic)
} else if (this.config.enableP2P && !this.manuallyStopped) {
```

#### 3. **src/components/chat/LocalAIControl.tsx**
- Added `usingWSL` property to status interface
- Added visual indicator when running via WSL
- Updated warning message to mention WSL auto-fallback
- Removed `binaryAvailable` requirement from start button

#### 4. **src/components/chat/P2PSettings.tsx**
- Removed `binaryAvailable` check from start button visibility
- Added hint that WSL will be used on Windows if needed
- Button is now always visible when LocalAI is not running

## How It Works Now

### On Windows (without native binary):

1. User starts the app
2. Distributed service initializes
3. LocalAI auto-start attempts:
   - Checks for native binary (not found)
   - Detects Windows platform
   - Automatically calls `_startViaWSL()`
4. WSL Manager:
   - Checks if WSL is available
   - Downloads LocalAI Linux binary if needed
   - Syncs models to WSL
   - Starts LocalAI in WSL
5. App connects to LocalAI at `localhost:8080`
6. UI shows "running via wsl" indicator

### Benefits

✅ **Automatic** - No manual configuration needed  
✅ **Transparent** - Works seamlessly in the background  
✅ **Clear UI** - Shows when WSL is being used  
✅ **Fallback Chain** - Native → WSL → Native P2P  
✅ **Better UX** - Start button always available  

## Testing

To test the fix:

1. Start the app on Windows (without native LocalAI binary)
2. The app should automatically detect WSL and use it
3. Check console logs for:
   - "Native LocalAI binary not found, attempting WSL fallback..."
   - "Using WSL to run LocalAI..."
   - "✓ LocalAI started successfully via WSL"
4. UI should show "running via wsl" badge in LocalAI Control panel

## Troubleshooting

If WSL still doesn't work:

1. **Check WSL is installed**:
   ```powershell
   wsl --status
   ```

2. **Check Linux distribution is installed**:
   ```powershell
   wsl echo "test"
   ```

3. **Install if needed**:
   ```powershell
   wsl --install -d Ubuntu
   ```

4. **Check app logs** for WSL-related errors

## Files Modified

### Phase 1: Auto-fallback
- `electron/localai-manager.ts` - Auto WSL fallback
- `electron/distributed-service.ts` - Removed binary check
- `src/components/chat/LocalAIControl.tsx` - WSL status display
- `src/components/chat/P2PSettings.tsx` - Always show start button

### Phase 2: WSL Detection Reliability
- `electron/wsl-manager.ts` - Fixed critical WSL detection issues:
  - Removed caching of WSL availability check
  - Use full path to wsl.exe (`C:\Windows\System32\wsl.exe`)
  - Fixed all exec/spawn calls to use absolute path
  - Made detection work properly from Electron's child_process context

