import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

export const getByRoom = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()
  },
})

export const getBySession = query({
  args: { sessionId: v.string(), roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .first()
  },
})

export const toggleReady = mutation({
  args: {
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId)
    if (!player) throw new Error("Jugador no encontrado")

    await ctx.db.patch(args.playerId, {
      isReady: !player.isReady,
    })
  },
})

export const vote = mutation({
  args: {
    voterId: v.id("players"),
    targetSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const voter = await ctx.db.get(args.voterId)
    if (!voter) throw new Error("Jugador no encontrado")

    await ctx.db.patch(args.voterId, {
      votedFor: args.targetSessionId,
    })
  },
})

export const leave = mutation({
  args: {
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId)
    if (!player) return

    // Si es host, transferir a otro jugador
    if (player.isHost) {
      const otherPlayers = await ctx.db
        .query("players")
        .withIndex("by_room", (q) => q.eq("roomId", player.roomId))
        .filter((q) => q.neq(q.field("_id"), args.playerId))
        .collect()

      if (otherPlayers.length > 0) {
        // Ordenar por tiempo de unión y asignar host al primero
        otherPlayers.sort((a, b) => a.joinedAt - b.joinedAt)
        await ctx.db.patch(otherPlayers[0]._id, { isHost: true })

        // Actualizar hostId en la sala
        const room = await ctx.db.get(player.roomId)
        if (room) {
          await ctx.db.patch(player.roomId, { hostId: otherPlayers[0].sessionId })
        }
      } else {
        // Si no hay más jugadores, eliminar la sala
        await ctx.db.delete(player.roomId)
      }
    }

    await ctx.db.delete(args.playerId)
  },
})

// Get leaderboard sorted by points
export const getLeaderboard = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    // Sort by points descending
    const sorted = [...players].sort((a, b) => (b.points || 0) - (a.points || 0))

    // Calculate rankings
    const mvp = sorted[0] || null
    const bestDetective = [...players].sort((a, b) => (b.correctVotes || 0) - (a.correctVotes || 0))[0] || null
    const bestLiar = [...players].sort((a, b) => (b.impostorWins || 0) - (a.impostorWins || 0))[0] || null

    return {
      leaderboard: sorted,
      mvp,
      bestDetective,
      bestLiar,
    }
  },
})

// Host can kick a player from the room
export const kick = mutation({
  args: {
    playerId: v.id("players"),
    kickerSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db.get(args.playerId)
    if (!player) throw new Error("Jugador no encontrado")

    // Get the room to verify kicker is host
    const room = await ctx.db.get(player.roomId)
    if (!room) throw new Error("Sala no encontrada")

    // Verify kicker is the host
    if (room.hostId !== args.kickerSessionId) {
      throw new Error("Solo el host puede expulsar jugadores")
    }

    // Cannot kick yourself
    if (player.sessionId === args.kickerSessionId) {
      throw new Error("No puedes expulsarte a ti mismo")
    }

    // Cannot kick during active game (only in lobby)
    if (room.status !== "waiting") {
      throw new Error("Solo puedes expulsar jugadores en el lobby")
    }

    // Delete the player
    await ctx.db.delete(args.playerId)

    // Update room's last activity
    await ctx.db.patch(room._id, { lastActivityAt: Date.now() })
  },
})
