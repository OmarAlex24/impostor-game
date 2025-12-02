import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getRandomWord } from "./words"

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export const create = mutation({
  args: {
    hostName: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    // Generar código único
    let code = generateRoomCode()
    let existing = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first()

    while (existing) {
      code = generateRoomCode()
      existing = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first()
    }

    // Crear sala
    const roomId = await ctx.db.insert("rooms", {
      code,
      hostId: args.sessionId,
      status: "waiting",
    })

    // Crear jugador host
    await ctx.db.insert("players", {
      roomId,
      sessionId: args.sessionId,
      name: args.hostName,
      isHost: true,
      isReady: false,
      isEliminated: false,
      joinedAt: Date.now(),
    })

    return { code, roomId }
  },
})

export const join = mutation({
  args: {
    code: v.string(),
    playerName: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first()

    if (!room) {
      throw new Error("Sala no encontrada")
    }

    if (room.status !== "waiting") {
      throw new Error("La partida ya ha comenzado")
    }

    // Verificar si ya está en la sala
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .filter((q) => q.eq(q.field("sessionId"), args.sessionId))
      .first()

    if (existingPlayer) {
      return { roomId: room._id, playerId: existingPlayer._id }
    }

    // Crear nuevo jugador
    const playerId = await ctx.db.insert("players", {
      roomId: room._id,
      sessionId: args.sessionId,
      name: args.playerName,
      isHost: false,
      isReady: false,
      isEliminated: false,
      joinedAt: Date.now(),
    })

    return { roomId: room._id, playerId }
  },
})

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first()
  },
})

export const get = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.roomId)
  },
})

export const startGame = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
    category: v.string(),
    discussionMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.hostId !== args.sessionId) throw new Error("Solo el host puede iniciar")

    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    if (players.length < 3) {
      throw new Error("Se necesitan al menos 3 jugadores")
    }

    // Seleccionar impostor aleatorio
    const impostorIndex = Math.floor(Math.random() * players.length)
    const impostor = players[impostorIndex]

    // Obtener palabra aleatoria
    const word = getRandomWord(args.category)

    // Calcular tiempo de fin de discusión
    const discussionEndTime = Date.now() + args.discussionMinutes * 60 * 1000

    // Resetear votos de todos los jugadores
    for (const player of players) {
      await ctx.db.patch(player._id, {
        votedFor: undefined,
        isEliminated: false,
      })
    }

    await ctx.db.patch(args.roomId, {
      status: "playing",
      category: args.category,
      currentWord: word,
      impostorId: impostor.sessionId,
      discussionEndTime,
      votingEndTime: undefined,
    })

    return { word, impostorId: impostor.sessionId }
  },
})

export const startVoting = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.hostId !== args.sessionId) throw new Error("Solo el host puede iniciar votación")

    const votingEndTime = Date.now() + 30 * 1000 // 30 segundos para votar

    await ctx.db.patch(args.roomId, {
      status: "voting",
      votingEndTime,
    })
  },
})

export const showResults = mutation({
  args: {
    roomId: v.id("rooms"),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")

    await ctx.db.patch(args.roomId, {
      status: "results",
    })
  },
})

export const resetRoom = mutation({
  args: {
    roomId: v.id("rooms"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId)
    if (!room) throw new Error("Sala no encontrada")
    if (room.hostId !== args.sessionId) throw new Error("Solo el host puede reiniciar")

    // Resetear jugadores
    const players = await ctx.db
      .query("players")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .collect()

    for (const player of players) {
      await ctx.db.patch(player._id, {
        isReady: false,
        votedFor: undefined,
        isEliminated: false,
      })
    }

    await ctx.db.patch(args.roomId, {
      status: "waiting",
      currentWord: undefined,
      impostorId: undefined,
      category: undefined,
      discussionEndTime: undefined,
      votingEndTime: undefined,
    })
  },
})
