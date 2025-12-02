import { CreateRoomForm } from "@/components/create-room-form"
import { JoinRoomForm } from "@/components/join-room-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, Users } from "lucide-react"

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo y título */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Eye className="w-7 h-7 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-balance">Impostor</h1>
          <p className="text-muted-foreground text-balance">
            Descubre quién miente. Todos conocen la palabra secreta... excepto uno.
          </p>
        </div>

        {/* Formularios */}
        <Card className="bg-card border-border">
          <Tabs defaultValue="create" className="w-full">
            <CardHeader className="pb-2">
              <TabsList className="grid w-full grid-cols-2 bg-muted">
                <TabsTrigger value="create">Crear Sala</TabsTrigger>
                <TabsTrigger value="join">Unirse</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="pt-4">
              <TabsContent value="create" className="mt-0">
                <CreateRoomForm />
              </TabsContent>
              <TabsContent value="join" className="mt-0">
                <JoinRoomForm />
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        {/* Cómo jugar */}
        <Card className="bg-card/50 border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Cómo jugar
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Crea una sala y comparte el código con tus amigos</p>
            <p>2. Cuando todos estén listos, el host inicia el juego</p>
            <p>3. Todos reciben una palabra secreta, excepto el impostor</p>
            <p>4. Discute y descubre quién es el impostor antes de votar</p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
