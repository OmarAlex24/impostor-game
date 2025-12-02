"use client"

import type React from "react"

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getSessionId, setPlayerName } from "@/lib/session"
import { Loader2, LogIn, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function JoinRoomForm() {
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [needsDeployment, setNeedsDeployment] = useState(false)
  const router = useRouter()
  const joinRoom = useMutation(api.rooms.join)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Ingresa tu nombre")
      return
    }
    if (!code.trim()) {
      setError("Ingresa el código de sala")
      return
    }

    setIsLoading(true)
    setError("")
    setNeedsDeployment(false)

    try {
      const sessionId = getSessionId()
      await joinRoom({
        code: code.trim().toUpperCase(),
        playerName: name.trim(),
        sessionId,
      })
      setPlayerName(name.trim())
      router.push(`/room/${code.trim().toUpperCase()}`)
    } catch (err: any) {
      const errorMessage = err?.message || err?.toString() || ""
      if (errorMessage.includes("Could not find public function") || errorMessage.includes("npx convex dev")) {
        setNeedsDeployment(true)
      } else {
        setError(err.message || "Error al unirse a la sala")
      }
      setIsLoading(false)
    }
  }

  if (needsDeployment) {
    return (
      <Alert className="bg-amber-500/10 border-amber-500/50">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-500">Funciones no desplegadas</AlertTitle>
        <AlertDescription className="text-muted-foreground space-y-3 mt-2">
          <p>Las funciones de Convex no están desplegadas en tu backend.</p>
          <div className="bg-secondary/50 p-3 rounded-md text-xs font-mono space-y-1">
            <p className="text-foreground">Para desplegar:</p>
            <p>1. Descarga este proyecto (menu ... {">"} Download ZIP)</p>
            <p>2. Abre terminal en la carpeta del proyecto</p>
            <p>
              3. Ejecuta: <span className="text-primary">npm install</span>
            </p>
            <p>
              4. Ejecuta: <span className="text-primary">npx convex dev</span>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setNeedsDeployment(false)} className="mt-2">
            Intentar de nuevo
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="join-name">Tu nombre</Label>
        <Input
          id="join-name"
          placeholder="Ej: María"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          className="bg-secondary border-border"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">Código de sala</Label>
        <Input
          id="code"
          placeholder="Ej: ABC123"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          className="bg-secondary border-border font-mono tracking-widest text-center text-lg"
        />
      </div>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <Button
        type="submit"
        disabled={isLoading}
        variant="outline"
        className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground bg-transparent"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <LogIn className="h-4 w-4 mr-2" />
            Unirse a Sala
          </>
        )}
      </Button>
    </form>
  )
}
