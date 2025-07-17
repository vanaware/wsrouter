// main.ts (exemplo)
import { Router } from "./mod.ts";

const router = new Router();

router.get("/hello", () => new Response("Olá mundo!"));

router.websocket("/ws", (socket) => {
  socket.onOpen = () => console.log("Cliente conectado");
  socket.onMessage((msg) => {
    console.log("Mensagem recebida:", msg.data);
    socket.send(`Echo: ${msg.data}`);
  });
});

export default {
  fetch: (req: Request) => router.fetch(req),
};