"use client"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Doc, Id } from "@/convex/_generated/dataModel"
import { ROLE_DESCRIPTIONS, type SecretRole } from "@/convex/gameModes"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2, Search, Gavel, Send } from "lucide-react"

interface RoleActionsProps {
  room: Doc<"rooms">
  currentPlayer: Doc<"players">
  players: Doc<"players">[]
  sessionId: string
}

export function RoleActions({ room, currentPlayer, players, sessionId }: RoleActionsProps) {
  const [selectedTarget, setSelectedTarget] = useState<string>("")
  const [ghostClue, setGhostClue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [investigationResult, setInvestigationResult] = useState<boolean | null>(null)

  const detectiveInvestigate = useMutation(api.rooms.detectiveInvestigate)
  const fiscalCallVote = useMutation(api.rooms.fiscalCallVote)
  const setGhostClueMutation = useMutation(api.rooms.setGhostClue)

  const role = currentPlayer.secretRole as SecretRole | undefined
  const hasUsedAbility = currentPlayer.hasUsedAbility

  if (!role || role === "none") return null

  const roleInfo = ROLE_DESCRIPTIONS[role]
  const activePlayers = players.filter((p) => !p.isEliminated && p.sessionId !== sessionId && p.sessionId)

  const handleDetectiveInvestigate = async () => {
    if (!selectedTarget || hasUsedAbility) return
    setIsLoading(true)
    try {
      const result = await detectiveInvestigate({
        roomId: room._id,
        detectiveSessionId: sessionId,
        targetSessionId: selectedTarget,
      })
      setInvestigationResult(result.isImpostor)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleFiscalCallVote = async () => {
    if (hasUsedAbility) return
    setIsLoading(true)
    try {
      await fiscalCallVote({
        roomId: room._id,
        fiscalSessionId: sessionId,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSetGhostClue = async () => {
    if (!ghostClue.trim() || currentPlayer.ghostClue) return
    setIsLoading(true)
    try {
      await setGhostClueMutation({
        roomId: room._id,
        ghostSessionId: sessionId,
        clue: ghostClue.trim(),
      })
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="bg-card/80 border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <span className="text-lg">{roleInfo.emoji}</span>
          Tu Rol: {roleInfo.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{roleInfo.description}</p>

        {/* Detective Action */}
        {role === "detective" && !currentPlayer.isEliminated && (
          <div className="space-y-2">
            {investigationResult !== null ? (
              <div className={`p-3 rounded-lg ${investigationResult ? "bg-destructive/20 text-destructive" : "bg-green-500/20 text-green-400"}`}>
                <p className="text-sm font-medium">
                  {investigationResult
                    ? "Es IMPOSTOR"
                    : "NO es impostor"}
                </p>
              </div>
            ) : hasUsedAbility ? (
              <p className="text-xs text-muted-foreground">Ya usaste tu habilidad</p>
            ) : (
              <>
                <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                  <SelectTrigger className="bg-secondary">
                    <SelectValue placeholder="Selecciona jugador..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activePlayers.map((p) => (
                      <SelectItem key={p.sessionId} value={p.sessionId}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleDetectiveInvestigate}
                  disabled={!selectedTarget || isLoading}
                  size="sm"
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Investigar
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Fiscal Action */}
        {role === "fiscal" && !currentPlayer.isEliminated && room.status === "playing" && (
          <div>
            {hasUsedAbility ? (
              <p className="text-xs text-muted-foreground">Ya usaste tu habilidad</p>
            ) : (
              <Button
                onClick={handleFiscalCallVote}
                disabled={isLoading}
                size="sm"
                variant="destructive"
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Gavel className="h-4 w-4 mr-2" />
                    Llamar Votacion Ahora
                  </>
                )}
              </Button>
            )}
          </div>
        )}

        {/* Payaso Info */}
        {role === "payaso" && (
          <div className="p-2 bg-yellow-500/10 rounded-lg">
            <p className="text-xs text-yellow-400">
              Intenta que te voten para ganar. No reveles que eres el Payaso.
            </p>
          </div>
        )}

        {/* Doble Votante Info */}
        {role === "doble_votante" && (
          <div className="p-2 bg-blue-500/10 rounded-lg">
            <p className="text-xs text-blue-400">
              Tu voto cuenta el doble en las votaciones.
            </p>
          </div>
        )}

        {/* Ghost Action */}
        {role === "fantasma" && currentPlayer.isEliminated && (
          <div className="space-y-2">
            {currentPlayer.ghostClue ? (
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <p className="text-xs text-purple-400">Tu pista: "{currentPlayer.ghostClue}"</p>
              </div>
            ) : (
              <>
                <Input
                  value={ghostClue}
                  onChange={(e) => setGhostClue(e.target.value)}
                  placeholder="Escribe una pista (max 100 chars)..."
                  maxLength={100}
                  className="bg-secondary"
                />
                <Button
                  onClick={handleSetGhostClue}
                  disabled={!ghostClue.trim() || isLoading}
                  size="sm"
                  className="w-full"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Dejar Pista
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Component to display ghost clues to other players
export function GhostClueDisplay({ players }: { players: Doc<"players">[] }) {
  const ghostWithClue = players.find((p) => p.secretRole === "fantasma" && p.ghostClue && p.isEliminated)

  if (!ghostWithClue) return null

  return (
    <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
      <p className="text-xs text-purple-400 mb-1">Pista del Fantasma ({ghostWithClue.name}):</p>
      <p className="text-sm text-purple-300">"{ghostWithClue.ghostClue}"</p>
    </div>
  )
}
