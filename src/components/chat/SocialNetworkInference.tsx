import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Users, 
  Zap, 
  Plus, 
  Search,
  TrendingUp,
  Award,
  Share2,
  UserPlus
} from 'lucide-react'

interface User {
  id: string
  name: string
  color: string
  device: string
  contribution: number
  online: boolean
}

interface Room {
  id: string
  name: string
  memberCount: number
  totalCompute: number
  host: User
  isPublic: boolean
}

export function SocialNetworkInference() {
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'me',
    name: 'You',
    color: '#3b82f6',
    device: 'MacBook Pro',
    contribution: 0,
    online: true
  })
  
  const [activeRoom, setActiveRoom] = useState<Room | null>(null)
  const [roomMembers, setRoomMembers] = useState<User[]>([currentUser])
  const [nearbyRooms, setNearbyRooms] = useState<Room[]>([])
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [roomCode, setRoomCode] = useState('')

  const createRoom = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const newRoom: Room = {
      id: code,
      name: roomName || 'Untitled Room',
      memberCount: 1,
      totalCompute: 0,
      host: currentUser,
      isPublic: true
    }
    setActiveRoom(newRoom)
    setRoomMembers([currentUser])
    setShowCreateRoom(false)
    setRoomName('')
  }

  const joinRoom = (room: Room) => {
    setActiveRoom(room)
    // In real implementation, send join request to backend
  }

  const leaveRoom = () => {
    setActiveRoom(null)
    setRoomMembers([currentUser])
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold">compute network</h2>
        <p className="text-sm text-muted-foreground mt-1">
          join others to run AI models together
        </p>
      </div>

      {/* Current User Card */}
      <Card className="rounded-xl border-2">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-4" style={{ borderColor: currentUser.color }}>
                <AvatarFallback style={{ backgroundColor: currentUser.color }} className="text-white text-xl font-bold">
                  {currentUser.name.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{currentUser.name}</h3>
                <p className="text-sm text-muted-foreground">{currentUser.device}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="rounded-full">
                    <Zap className="h-3 w-3 mr-1" />
                    {currentUser.contribution} tokens
                  </Badge>
                  {currentUser.online && (
                    <Badge variant="default" className="rounded-full bg-green-500">
                      online
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl">
              edit profile
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Room or Create/Join */}
      {activeRoom ? (
        <Card className="rounded-xl border-2 border-primary">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{activeRoom.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Room · {activeRoom.memberCount} members
                  </p>
                </div>
              </div>
              <Button variant="ghost" onClick={leaveRoom} className="rounded-xl">
                leave
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Room Code */}
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                invite code
              </p>
              <div className="flex items-center justify-center gap-2">
                <code className="text-2xl font-bold tracking-widest">{activeRoom.id}</code>
                <Button variant="ghost" size="icon" className="rounded-xl">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Members */}
            <div>
              <p className="text-sm font-medium mb-3">members ({roomMembers.length})</p>
              <div className="space-y-2">
                {roomMembers.map((member) => (
                  <motion.div
                    key={member.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border-2" style={{ borderColor: member.color }}>
                        <AvatarFallback style={{ backgroundColor: member.color }} className="text-white font-bold">
                          {member.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.device}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="rounded-full">
                      {member.contribution}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-blue-50 p-3 text-center">
                <TrendingUp className="h-5 w-5 mx-auto text-blue-600 mb-1" />
                <p className="text-xs text-blue-900">active</p>
              </div>
              <div className="rounded-xl bg-green-50 p-3 text-center">
                <Zap className="h-5 w-5 mx-auto text-green-600 mb-1" />
                <p className="text-xs text-green-900">fast</p>
              </div>
              <div className="rounded-xl bg-purple-50 p-3 text-center">
                <Award className="h-5 w-5 mx-auto text-purple-600 mb-1" />
                <p className="text-xs text-purple-900">top 10%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {/* Create Room */}
          {showCreateRoom ? (
            <Card className="rounded-xl col-span-2">
              <CardHeader>
                <CardTitle>create room</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder="room name (e.g., Speed Demons, Night Owls)"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="rounded-xl"
                />
                <div className="flex gap-2">
                  <Button onClick={createRoom} className="rounded-xl flex-1">
                    <Plus className="h-4 w-4 mr-2" />
                    create
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowCreateRoom(false)}
                    className="rounded-xl"
                  >
                    cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card 
                className="rounded-xl cursor-pointer hover:border-primary transition-colors"
                onClick={() => setShowCreateRoom(true)}
              >
                <CardContent className="pt-6 text-center">
                  <div className="p-4 rounded-full bg-primary/10 w-16 h-16 mx-auto flex items-center justify-center mb-3">
                    <Plus className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-1">create room</h3>
                  <p className="text-xs text-muted-foreground">
                    start your own compute network
                  </p>
                </CardContent>
              </Card>

              {/* Join with Code */}
              <Card className="rounded-xl">
                <CardContent className="pt-6 text-center">
                  <div className="p-4 rounded-full bg-green-500/10 w-16 h-16 mx-auto flex items-center justify-center mb-3">
                    <UserPlus className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="font-semibold mb-3">join room</h3>
                  <Input
                    placeholder="enter code"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                    className="rounded-xl text-center font-bold tracking-widest mb-2"
                    maxLength={6}
                  />
                  <Button 
                    className="rounded-xl w-full" 
                    size="sm"
                    disabled={roomCode.length !== 6}
                  >
                    join
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Discover Nearby Rooms */}
      {!activeRoom && (
        <Card className="rounded-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                <CardTitle>discover</CardTitle>
              </div>
              <Badge variant="secondary" className="rounded-full">
                {nearbyRooms.length} nearby
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {nearbyRooms.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>no rooms nearby</p>
                <p className="text-xs mt-1">create one or join with a code</p>
              </div>
            ) : (
              <div className="space-y-2">
                {nearbyRooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-3 rounded-xl border hover:border-primary cursor-pointer transition-colors"
                    onClick={() => joinRoom(room)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback style={{ backgroundColor: room.host.color }}>
                          {room.host.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-sm">{room.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {room.memberCount} members · hosted by {room.host.name}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" className="rounded-xl">
                      join
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}


