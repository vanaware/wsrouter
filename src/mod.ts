// src/mod.ts

// This module provides a WebSocket router for Deno, allowing for easy management of HTTP and WebSocket routes.
// It supports static file serving, embedded files, and MIME type resolution.

import { contentType } from "@std/media_types";
import { join, normalize, parse, extname } from "@std/path/posix";
import { exists } from "@std/fs/exists";

type Params = Record<string, string | string[] | null>;
type Handler = (req: Request, params: Params) => Promise<{ body: BodyInit; init?: ResponseInit } | undefined>;
type WsHandler = (group: WebSocketGroup, ws: WebSocket, req: Request, params: Params) => void;

export class Router {
    basePath: string;
    private httpRoutes: { method: string; pattern: URLPattern; handler: Handler }[] = [];
    private wsRoutes: { pattern: URLPattern; wshandler: WsHandler; group: WebSocketGroup }[] = [];
    staticDir: string | null;
    embeddedDir: string | null;
    indexFiles: string[] = ['index.html', 'index.htm'];

    constructor({
        staticDir = null,
        embeddedDir = null,
        basePath = "",
        indexFiles = ['index.html', 'index.htm']
    }: {
        staticDir?: string | null,
        embeddedDir?: string | null,
        basePath?: string,
        indexFiles?: string[]
    }) {
        const pathParsed = parse(normalize(basePath));
        basePath = (pathParsed.ext === "") ? join(pathParsed.dir,pathParsed.name) : pathParsed.dir;
        this.basePath = normalize(basePath.startsWith("/") ? basePath : `/${basePath}`);
        this.staticDir = staticDir;
        this.embeddedDir = embeddedDir;
        this.indexFiles = indexFiles;
    }

    // Method to add an HTTP route
    private addHttpRoute(method: string, path: string, handler: Handler) {
        path = normalize(path.startsWith("/") ? path : `/${path}`);
        const pattern = new URLPattern({ pathname: join(this.basePath, path) });
        this.httpRoutes.push({ method, pattern, handler });
    }

    // Convenience methods for HTTP routes
    any(path: string, handler: Handler) {
        this.addHttpRoute('ALL', path, handler);
    }

    get(path: string, handler: Handler) {
        this.addHttpRoute('GET', path, handler);
    }

    post(path: string, handler: Handler) {
        this.addHttpRoute('POST', path, handler);
    }

    put(path: string, handler: Handler) {
        this.addHttpRoute('PUT', path, handler);
    }

    patch(path: string, handler: Handler) {
        this.addHttpRoute('PATCH', path, handler);
    }

    delete(path: string, handler: Handler) {
        this.addHttpRoute('DELETE', path, handler);
    }

    // Extract parameters from URLPattern
    private addParams(groups: Record<string, string | undefined>, params: Params): Params {
        for (const [key, value] of Object.entries(groups || {})) {
            if (typeof value === 'undefined') continue; // Ignore undefined values
            params[key] = value;
        }
        return params;
    }

    // Serve static files from the static directory
    async handleFile(pathname: string): Promise<{ body: BodyInit; init?: ResponseInit; } | undefined> {
        const filePath = [];
        if (await exists(pathname, { isDirectory: true })) {
            for (const indexFile of this.indexFiles) {
                //console.log(`Checking for index file: ${indexFile} in ${pathname}`);
                filePath.push(join(pathname, indexFile));
            }
        } else {
            filePath.push(normalize(pathname));
        }
        for (const file of filePath) {
            if (await exists(file, { isFile: true })) {
                const fileContent = await Deno.open(file, { read: true });
                //console.log(`Serving file: ${file}`);
                //console.log(`Content type: ${contentType(extname(file)) || 'application/octet-stream'}`);
                return { body: fileContent.readable, init: { headers: { 'Content-Type': contentType(extname(file)) || 'application/octet-stream' } } };
            }
        }
    }

    // Handle HTTP requests
    private async handleHttpRequest(req: Request, params: Params): Promise<Response> {
        // Check if the request method matches any HTTP route
        const reqUrl = new URL(decodeURI(req.url));
        for (const route of this.httpRoutes) {
            if (route.method === 'ALL' || route.method === req.method) {
                // Match the URL pattern against the request URL
                const match = route.pattern.exec({ pathname: reqUrl.pathname });
                //console.log(`Matching route ${reqUrl} (${match}): ${route.method} ${route.pattern.pathname}`);
                if (match) {
                    const result = await route.handler(req, this.addParams(match.pathname.groups, params));
                    if (result) {
                        return new Response(result.body, result.init);
                    }
                }
            }
        }

        const pathName: string = Array.isArray(params["path"]) ? params["path"][0] : (params["path"] || "");
        if (!(this.staticDir === null)) {
            //console.log(`Static file requested: ${join("." ,this.staticDir, pathName)}`);
            const result = await this.handleFile(join(this.staticDir, pathName));
            if (result && result.body) {
                console.log(`Serving static file: ${pathName}`);
                return new Response(result.body, result.init);
            }
        }
        if (!(this.embeddedDir === null)) {
            //console.log(`Embedded file requested: ${join(".", this.embeddedDir, pathName)}`);
            const result = await this.handleFile(join(import.meta.dirname || '', this.embeddedDir, pathName));
            if (result && result.body) {
                console.log(`Serving embedded file: ${pathName}`);
                return new Response(result.body, result.init);
            }
        }
        // If no route matches, return a 404 response
        return new Response('Not Found', { status: 404 });
    }


    // Method to add a WebSocket route
    ws(path: string, wshandler: WsHandler) {
        path = normalize(path.startsWith("/") ? path : `/${path}`);
        const pattern = new URLPattern({ pathname: join(this.basePath, path) });
        const group = new WebSocketGroup();
        this.wsRoutes.push({ pattern, wshandler, group });
    }
    
    // Handle WebSocket upgrade requests
    private handleWsUpgrade(req: Request, params: Params): Promise<Response> {
        // Check if the request matches any WebSocket route
        const reqUrl = new URL(decodeURI(req.url));
        for (const route of this.wsRoutes) {
            const match = route.pattern.exec({ pathname: reqUrl.pathname });
            //console.log(`Matching route ${reqUrl} (${match}): ${route.pattern.pathname}`);
            if (match) {
                const { socket, response } = Deno.upgradeWebSocket(req);
                params = this.addParams(match.pathname.groups, params);
               //console.log(`WebSocket upgrade for path: ${route.pattern.pathname}, params: ${JSON.stringify(params)}`);
                route.wshandler(route.group, socket, req, params);

                socket.onopen = () => {
                    //console.log(`WebSocket connection opened for path: ${route.pattern.pathname}, params: ${JSON.stringify(params)}`);
                    route.group.addSocket(socket, params);
                };

                socket.onclose = () => {
                    route.group.removeSocket(socket);
                };
                socket.onerror = (event) => {
                    console.error(`WebSocket error: ${event}`);
                    route.group.removeSocket(socket);
                };
                return Promise.resolve(response);
            }
        }

        return Promise.resolve(new Response('WebSocket Not Found', { status: 404 }));
    }

    // Main handler for all requests
    handleRequest(req: Request): Promise<Response> {
        const params: Params = {};
        const reqUrl = new URL(decodeURI(req.url));
        params["path"] = reqUrl.pathname.replace(this.basePath, "");
        params["basePath"] = this.basePath;
        params["staticDir"] = this.staticDir;
        params["embeddedDir"] = this.embeddedDir;

        //console.log(`Handling request for: ${JSON.stringify(params)}`);

        const upgradeHeader = req.headers.get('upgrade');
        if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
            // Handle HTTP request
            return this.handleHttpRequest(req, params);
        } else {
            // Handle WebSocket upgrade request
            return this.handleWsUpgrade(req, params);
        } 
    }
            
    // Get WebSocket group by path
    getWsGroupByPath(path: string): WebSocketGroup | undefined {
        path = join(this.basePath, normalize(path.startsWith("/") ? path : `/${path}`) );
        for (const route of this.wsRoutes) {
            //console.log(`Checking route: ${route.pattern.pathname} against path: ${path}`);
            if (route.pattern.pathname === path) {
                return route.group;
            }
        }
        return undefined;
    }

    // Get WebSocket group by pattern
    getWsGroupByPattern(path: string): WebSocketGroup | undefined {
        path = join(this.basePath, normalize(path.startsWith("/") ? path : `/${path}`) );
        for (const route of this.wsRoutes) {
            const match = route.pattern.exec({pathname: path});
            //console.log(`Matching route ${path} (${match}): ${route.pattern.pathname}`);
            if (match) {
                return route.group;
            }
        }
        return undefined;
    }

}

class WebSocketGroup {
    private sockets: Map<WebSocket, Params> = new Map();

    addSocket(ws: WebSocket, params: Params) {
        this.sockets.set(ws, params);
    } 

    removeSocket(ws: WebSocket) {
        this.sockets.delete(ws);
    }

    broadcast(message: string, permissionFn?: (params: Params, message: string) => boolean) {
        for (const [socket, params] of this.sockets.entries()) {
            if (socket.readyState === WebSocket.OPEN) {
                if (!permissionFn || permissionFn(params, message)) {
                    //console.log(`Broadcasting message to socket, params: ${JSON.stringify(params)}, message: ${message}`);
                    socket.send(message);
                }
            }
        }
    }

    getWebSockets() {
        return Array.from(this.sockets.keys());
    }

    getSockets() {
        return this.sockets;
    }

    closeGroup() {
        for (const [socket] of this.sockets.entries()) {
            if (socket.readyState === WebSocket.OPEN) {
                socket.close(1000, 'Group is being closed');
            }
        }
        this.sockets.clear();
    }
}
