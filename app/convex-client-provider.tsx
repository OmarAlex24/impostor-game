"use client"

import { ConvexProvider, ConvexReactClient } from "convex/react"
import { type ReactNode, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, ExternalLink } from "lucide-react"

function SetupInstructions() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-500" />
            Configuración requerida
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Para usar el juego Impostor necesitas configurar Convex como base de datos en tiempo real.
          </p>

          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-lg bg-secondary">
              <p className="font-medium mb-2">Paso 1: Crear proyecto en Convex</p>
              <a
                href="https://dashboard.convex.dev"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1"
              >
                Ir a Convex Dashboard
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="p-3 rounded-lg bg-secondary">
              <p className="font-medium mb-2">Paso 2: Obtener URL del proyecto</p>
              <p className="text-muted-foreground">
                En tu proyecto de Convex, ve a Settings y copia la "Deployment URL"
              </p>
            </div>

            <div className="p-3 rounded-lg bg-secondary">
              <p className="font-medium mb-2">Paso 3: Agregar variable de entorno</p>
              <p className="text-muted-foreground mb-2">
                En el sidebar izquierdo de v0, haz clic en <strong>Vars</strong> y agrega:
              </p>
              <code className="block p-2 rounded bg-muted font-mono text-xs">
                NEXT_PUBLIC_CONVEX_URL = https://tu-proyecto.convex.cloud
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

  const client = useMemo(() => {
    if (!convexUrl) return null
    return new ConvexReactClient(convexUrl)
  }, [convexUrl])

  if (!client) {
    return <SetupInstructions />
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>
}
