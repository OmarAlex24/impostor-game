"use client"

import { use, useEffect, useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { getSessionId } from "@/lib/session"
import { Lobby } from "@/components/lobby"
import { GameBoard } from "@/components/game-board"
import { VotingPhase } from "@/components/voting-phase"
import { GameResults } from "@/components/game-results"
import { JoinRoomDialog } from "@/components/join-room-dialog"
import { Loader2 } from "lucide-react"

export default function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [needsToJoin, setNeedsToJoin] = useState(false)

  const room = useQuery(api.rooms.getByCode, { code: code.toUpperCase() })
  const players = useQuery(api.players.getByRoom, room ? { roomId: room._id } : "skip")
  const currentPlayer = useQuery(api.players.getBySession, room && sessionId ? { roomId: room._id, sessionId } : "skip")

  useEffect(() => {
    const sid = getSessionId()
    setSessionId(sid)
  }, [])

  useEffect(() => {
    if (sessionId && room && currentPlayer === null) {
      setNeedsToJoin(true)
    } else if (currentPlayer) {
      setNeedsToJoin(false)
    }
  }, [sessionId, room, currentPlayer])

  // Loading state
  if (room === undefined || players === undefined || sessionId === null) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    )
  }

  // Room not found
  if (room === null) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Sala no encontrada</h1>
          <p className="text-muted-foreground">El código {code.toUpperCase()} no existe o ha expirado</p>
          <a href="/" className="inline-block text-primary hover:underline">
            Volver al inicio
          </a>
        </div>
      </main>
    )
  }

  // Need to join the room
  if (needsToJoin) {
    return <JoinRoomDialog code={code} sessionId={sessionId} />
  }

  // Still loading current player
  if (!currentPlayer) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    )
  }

  // Render based on room status
  switch (room.status) {
    case "waiting":
      return <Lobby room={room} players={players} currentPlayer={currentPlayer} sessionId={sessionId} />
    case "playing":
      return <GameBoard room={room} players={players} currentPlayer={currentPlayer} sessionId={sessionId} />
    case "voting":
      return <VotingPhase room={room} players={players} currentPlayer={currentPlayer} sessionId={sessionId} />
    case "results":
      return <GameResults room={room} players={players} currentPlayer={currentPlayer} sessionId={sessionId} />
    default:
      return null
  }
}
