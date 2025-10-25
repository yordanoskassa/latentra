import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User, Monitor, CheckCircle } from 'lucide-react'
import { motion } from 'motion/react'

interface UserProfile {
  id: string
  displayName: string
  deviceName: string
  color: string
}

interface UserProfileDialogProps {
  open: boolean
  onClose: (profile?: UserProfile) => void
  initialProfile?: UserProfile
}

const PRESET_COLORS = [
  { name: 'blue', value: '#3b82f6' },
  { name: 'purple', value: '#8b5cf6' },
  { name: 'pink', value: '#ec4899' },
  { name: 'orange', value: '#f59e0b' },
  { name: 'green', value: '#10b981' },
  { name: 'cyan', value: '#06b6d4' },
]

export function UserProfileDialog({ open, onClose, initialProfile }: UserProfileDialogProps) {
  const [displayName, setDisplayName] = useState(initialProfile?.displayName || '')
  const [deviceName, setDeviceName] = useState(initialProfile?.deviceName || '')
  const [selectedColor, setSelectedColor] = useState(initialProfile?.color || PRESET_COLORS[0].value)

  const handleSave = () => {
    if (!displayName.trim()) return

    const profile: UserProfile = {
      id: initialProfile?.id || `user-${Date.now()}`,
      displayName: displayName.trim(),
      deviceName: deviceName.trim() || 'my device',
      color: selectedColor
    }

    onClose(profile)
  }

  const handleSkip = () => {
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleSkip()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">setup your identity</DialogTitle>
          <DialogDescription className="text-sm">
            personalize your profile for collaborative inference
          </DialogDescription>
        </DialogHeader>

        <motion.div 
          className="space-y-6 py-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Display Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <User className="h-4 w-4" />
              display name
            </label>
            <Input
              placeholder="enter your name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="rounded-xl"
              autoFocus
            />
          </div>

          {/* Device Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              device name
            </label>
            <Input
              placeholder="e.g., macbook pro, desktop pc"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="rounded-xl"
            />
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              choose your color
            </label>
            <div className="flex gap-3">
              {PRESET_COLORS.map((color) => (
                <motion.button
                  key={color.value}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedColor(color.value)}
                  className="relative w-10 h-10 rounded-full transition-all"
                  style={{ backgroundColor: color.value }}
                >
                  {selectedColor === color.value && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <CheckCircle className="h-5 w-5 text-white drop-shadow-lg" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <motion.div 
            className="rounded-xl bg-muted/50 p-4 space-y-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-xs text-muted-foreground uppercase tracking-wide">preview</p>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                style={{ backgroundColor: selectedColor }}
              >
                {displayName.charAt(0).toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {displayName || 'your name'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {deviceName || 'device name'}
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={handleSkip} className="rounded-xl">
            skip
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!displayName.trim()}
            className="rounded-xl"
          >
            save profile
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}




