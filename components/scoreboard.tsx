"use client"

import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import type { Id, Doc } from "@/convex/_generated/dataModel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy, Target, Skull, Crown } from "lucide-react"

interface ScoreboardProps {
  roomId: Id<"rooms">
  currentSessionId: string
}

export function Scoreboard({ roomId, currentSessionId }: ScoreboardProps) {
  const leaderboardData = useQuery(api.players.getLeaderboard, { roomId })

  if (!leaderboardData) {
    return null
  }

  const { leaderboard, mvp, bestDetective, bestLiar } = leaderboardData

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Puntuaciones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Awards */}
        <div className="grid grid-cols-3 gap-2">
          {/* MVP */}
          {mvp && (mvp.points || 0) > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-2 text-center">
              <Crown className="w-5 h-5 text-yellow-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">MVP</p>
              <p className="font-medium text-sm truncate">{mvp.name}</p>
              <p className="text-xs text-yellow-500">{mvp.points || 0} pts</p>
            </div>
          )}

          {/* Best Detective */}
          {bestDetective && (bestDetective.correctVotes || 0) > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2 text-center">
              <Target className="w-5 h-5 text-blue-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Detective</p>
              <p className="font-medium text-sm truncate">{bestDetective.name}</p>
              <p className="text-xs text-blue-500">{bestDetective.correctVotes || 0} aciertos</p>
            </div>
          )}

          {/* Best Liar */}
          {bestLiar && (bestLiar.impostorWins || 0) > 0 && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 text-center">
              <Skull className="w-5 h-5 text-red-500 mx-auto mb-1" />
              <p className="text-xs text-muted-foreground">Mentiroso</p>
              <p className="font-medium text-sm truncate">{bestLiar.name}</p>
              <p className="text-xs text-red-500">{bestLiar.impostorWins || 0} victorias</p>
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground mb-2">Clasificación</p>
          {leaderboard.map((player, index) => {
            const isMe = player.sessionId === currentSessionId
            return (
              <div
                key={player._id}
                className={`flex items-center justify-between p-2 rounded ${
                  isMe ? "bg-primary/10 ring-1 ring-primary/30" : "bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0
                        ? "bg-yellow-500 text-black"
                        : index === 1
                          ? "bg-gray-400 text-black"
                          : index === 2
                            ? "bg-amber-700 text-white"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className="font-medium text-sm">
                    {player.name}
                    {isMe && <span className="text-muted-foreground ml-1">(tú)</span>}
                  </span>
                </div>
                <span className="text-sm font-bold text-primary">{player.points || 0}</span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
