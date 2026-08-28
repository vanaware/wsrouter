// main.ts

import { Router } from "../src/mod.ts ";

const app = new Router({
    staticDir: './example/public',
    embeddedDir: './example/public',
    basePath: 'servidor/',
    indexFiles: ['index.html', 'index.htm']
});


app.get("/hello", async (_req, _params) => {
    return await { body: "Olá mundo!" };
});

// HTTP GET route with cascading parameters
app.get('/:id/:tipo', async (_req, params) => {
    console.log(params); // { id: '123', tipo: 'tipoA' }
    const id = params.id;
    const tipo = params.tipo;
    return await { body: JSON.stringify({ id, tipo }), init: { headers: { 'Content-Type': 'application/json' } } };
});

// HTTP POST route
app.post('/users', async (req) => {
    const body = await req.text();
    return await { body, init: { status: 201, headers: { 'Content-Type': 'application/json' } } };
});

// WebSocket route with cascading parameters
app.ws('/chat/:room/:user', (_group, ws, _req, params) => {
    //console.log(params); // { room: 'room1', user: 'user1' }
    const room = params.room;
    const user = params.user;

    ws.onopen = () => {
        console.log(`WebSocket connection opened for room: ${room}, user: ${user}`);
        ws.send(`Welcome to room ${room}, user ${user}!`);
    };


    ws.onmessage = (event) => {
        console.log(`Message received in room ${room} from user ${user}: ${event.data}`);
        // Broadcast message
        const group = app.getWsGroupByPattern(`/chat/${room}/${user}`);
        //const group = app.getWsGroupByPath(`/chat/:room/:user`);
        //const group = _group; // Use the group passed to the handler
        if (!group) { 
            console.error(`WebSocket group not found for room: ${room}, user: ${user}`);
            return;
        }
        group.broadcast(`Broadcast from ${user}: ${event.data}`, (clientParams, _msg) => {
            // Example permission check: only broadcast if the client is in the same room
            return clientParams.room === params.room;
        });

    };

    ws.onclose = () => {
        console.log(`WebSocket connection closed for room: ${room}, user: ${user}`);
    };

    ws.onerror = (event) => {
        console.error(`WebSocket error for room: ${room}, user: ${user}`, event);
    };
});

// HTTP catch-all route with * parameter
app.get('/subfolder/*', async (_req, params) => {
    console.log(params); // { catch: ["anything/ever/last.html"] }
    return await { body: `HTTP catch-all route with catch: ${JSON.stringify(params.catch)}`, init: { status: 200 } };
});

// WebSocket catch-all route with * parameter
app.ws('/subfolder/*', (_group, ws, _req, params) => {
    console.log(params); // { catch: ["anything/ever/last.html"] }
    ws.onmessage = (event) => {
        console.log(`Message received in catch-all WebSocket: ${event.data}`);
        ws.send(`Echo: ${event.data}`);
    };
    ws.onclose = () => {
        console.log('WebSocket catch-all connection closed');
    };
    ws.onerror = (event) => {
        console.error(`WebSocket catch-all error: ${event}`);
    };
});

// Serve the application using AbortController for shutdown
const abortController = new AbortController();
Deno.serve({ handler: app.handleRequest.bind(app), signal: abortController.signal });

// Handle shutdown signals
const shutdownSignals = ['SIGINT', 'SIGBREAK'] as const;

shutdownSignals.forEach((signal) => {
    Deno.addSignalListener(signal, () => {
        console.log(`Received ${signal}, shutting down...`);
        abortController.abort();
        console.log('Server has been shut down.');
        Deno.exit(0);
    });
});

console.log(`Server is running at http://localhost:8000/${app.basePath}`);