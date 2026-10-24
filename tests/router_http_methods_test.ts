// monorepo/router/tests/router_http_methods_test.ts
import { assertEquals, assertExists, } from "@std/assert";
import { createDenoRouter, } from "../src/deno.ts";

// ============================================================
// Tests for the OPTIONS method (CORS preflight)
// ============================================================

Deno.test("OPTIONS returns correct CORS headers", async () => {
  const app = createDenoRouter("", null, null,);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };

  app.options("/*", () => ({
    body: "",
    init: { status: 204, headers: corsHeaders, },
  }),);

  const req = new Request("http://localhost/api/users", {
    method: "OPTIONS",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 204,);
  assertEquals(res.headers.get("Access-Control-Allow-Origin",), "*",);
  assertEquals(
    res.headers.get("Access-Control-Allow-Methods",),
    "GET, POST, PUT, DELETE, PATCH, OPTIONS",
  );
  assertEquals(res.headers.get("Access-Control-Max-Age",), "86400",);
});

Deno.test("OPTIONS with a specific route", async () => {
  const app = createDenoRouter("", null, null,);

  app.options("/users/:id", (_req, params,) => ({
    body: JSON.stringify({
      allowed: ["GET", "PATCH", "DELETE",],
      id: params.id,
    },),
    init: {
      headers: {
        "Allow": "GET, PATCH, DELETE, OPTIONS",
        "Content-Type": "application/json",
      },
    },
  }),);

  const req = new Request("http://localhost/users/42", {
    method: "OPTIONS",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.allowed, ["GET", "PATCH", "DELETE",],);
  assertEquals(data.id, "42",);
});

// ============================================================
// Tests for the PUT method
// ============================================================

Deno.test("PUT updates the full resource", async () => {
  const app = createDenoRouter("", null, null,);

  app.put("/users/:id", async (req, params,) => {
    const body = await req.json();
    return {
      body: JSON.stringify({
        updated: true,
        id: params.id,
        data: body,
      },),
      init: { headers: { "Content-Type": "application/json", }, },
    };
  },);

  const req = new Request("http://localhost/users/42", {
    method: "PUT",
    body: JSON.stringify({ name: "John", email: "john@example.com", },),
    headers: { "Content-Type": "application/json", },
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.updated, true,);
  assertEquals(data.id, "42",);
  assertEquals(data.data.name, "John",);
});

Deno.test("PUT without body works", async () => {
  const app = createDenoRouter("", null, null,);

  app.put("/status", () => ({
    body: "Status updated",
    init: { status: 200, },
  }),);

  const req = new Request("http://localhost/status", {
    method: "PUT",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  assertEquals(await res.text(), "Status updated",);
});

// ============================================================
// Tests for the DELETE method
// ============================================================

Deno.test("DELETE removes the resource", async () => {
  const app = createDenoRouter("", null, null,);

  app.delete("/users/:id", (_req, params,) => ({
    body: JSON.stringify({ deleted: true, id: params.id, },),
    init: {
      status: 200,
      headers: { "Content-Type": "application/json", },
    },
  }),);

  const req = new Request("http://localhost/users/42", {
    method: "DELETE",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.deleted, true,);
  assertEquals(data.id, "42",);
});

Deno.test("DELETE returns 204 No Content", async () => {
  const app = createDenoRouter("", null, null,);

  app.delete("/items/:id", (_req, params,) => ({
    body: "",
    init: { status: 204, },
  }),);

  const req = new Request("http://localhost/items/123", {
    method: "DELETE",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 204,);
  assertEquals(await res.text(), "",);
});

// ============================================================
// Tests for the PATCH method
// ============================================================

Deno.test("PATCH updates the resource partially", async () => {
  const app = createDenoRouter("", null, null,);

  app.patch("/users/:id", async (req, params,) => {
    const updates = await req.json();
    return {
      body: JSON.stringify({
        patched: true,
        id: params.id,
        updates,
      },),
      init: { headers: { "Content-Type": "application/json", }, },
    };
  },);

  const req = new Request("http://localhost/users/42", {
    method: "PATCH",
    body: JSON.stringify({ email: "new@email.com", },),
    headers: { "Content-Type": "application/json", },
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.patched, true,);
  assertEquals(data.id, "42",);
  assertEquals(data.updates.email, "new@email.com",);
});

Deno.test("PATCH with multiple fields", async () => {
  const app = createDenoRouter("", null, null,);

  app.patch("/products/:id", async (req, params,) => {
    const updates = await req.json();
    return {
      body: JSON.stringify({
        id: params.id,
        fieldsUpdated: Object.keys(updates,),
      },),
      init: { headers: { "Content-Type": "application/json", }, },
    };
  },);

  const req = new Request("http://localhost/products/99", {
    method: "PATCH",
    body: JSON.stringify({
      price: 29.99,
      stock: 100,
      category: "electronics",
    },),
    headers: { "Content-Type": "application/json", },
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.id, "99",);
  assertEquals(data.fieldsUpdated, ["price", "stock", "category",],);
});

// ============================================================
// Tests for the HEAD method
// ============================================================

Deno.test("HEAD returns headers without body", async () => {
  const app = createDenoRouter("", null, null,);

  app.head("/users/:id", (_req, params,) => ({
    body: JSON.stringify({ id: params.id, name: "John", },),
    init: {
      headers: {
        "Content-Type": "application/json",
        "X-Custom-Header": "test-value",
      },
    },
  }),);

  const req = new Request("http://localhost/users/42", {
    method: "HEAD",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  assertEquals(res.headers.get("Content-Type",), "application/json",);
  assertEquals(res.headers.get("X-Custom-Header",), "test-value",);

  // HEAD should have no body (or an empty body)
  const text = await res.text();
  assertEquals(text, "",);
});

Deno.test("HEAD to check resource existence", async () => {
  const app = createDenoRouter("", null, null,);

  app.head("/files/:name", (_req, params,) => ({
    body: "",
    init: {
      status: 200,
      headers: {
        "Content-Length": "1024",
        "Last-Modified": "Mon, 25 Aug 2026 12:00:00 GMT",
      },
    },
  }),);

  const req = new Request("http://localhost/files/document.pdf", {
    method: "HEAD",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  assertEquals(res.headers.get("Content-Length",), "1024",);
  assertExists(res.headers.get("Last-Modified",),);
});

// ============================================================
// Tests for disallowed methods
// ============================================================

// 🚀 FIX: Now returns 405 Method Not Allowed
Deno.test("Unregistered method returns 405", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/only-get", () => ({ body: "ok", }),);
  const req = new Request("http://localhost/only-get", {
    method: "POST",
  },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 405,);
  assertEquals(res.headers.get("Allow",), "GET",);
});

// 🚀 FIX: Now returns 405 Method Not Allowed
Deno.test("PUT on a GET route returns 405", async () => {
  const app = createDenoRouter("", null, null,);
  app.get("/resource", () => ({ body: "data", }),);
  const req = new Request("http://localhost/resource", {
    method: "PUT",
    body: "update",
  },);
  const res = await app.handleRequest(req,);
  assertEquals(res.status, 405,);
  assertEquals(res.headers.get("Allow",), "GET",);
});

// ============================================================
// Tests with basePath
// ============================================================

Deno.test("OPTIONS with basePath works", async () => {
  const app = createDenoRouter("/api", null, null,);

  app.options("/*", () => ({
    body: "",
    init: {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*", },
    },
  }),);

  const req = new Request("http://localhost/api/users", {
    method: "OPTIONS",
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 204,);
  assertEquals(res.headers.get("Access-Control-Allow-Origin",), "*",);
});

Deno.test("PUT with basePath and parameters", async () => {
  const app = createDenoRouter("/api/v1", null, null,);

  app.put("/users/:id", async (req, params,) => {
    const body = await req.json();
    return {
      body: JSON.stringify({ id: params.id, ...body, },),
      init: { headers: { "Content-Type": "application/json", }, },
    };
  },);

  const req = new Request("http://localhost/api/v1/users/42", {
    method: "PUT",
    body: JSON.stringify({ name: "Maria", },),
    headers: { "Content-Type": "application/json", },
  },);
  const res = await app.handleRequest(req,);

  assertEquals(res.status, 200,);
  const data = await res.json();
  assertEquals(data.id, "42",);
  assertEquals(data.name, "Maria",);
});

// ============================================================
// Method combination tests
// ============================================================

Deno.test("Same route with different methods", async () => {
  const app = createDenoRouter("", null, null,);

  app.get("/resource", () => ({ body: "GET response", }),);
  app.post(
    "/resource",
    () => ({ body: "POST response", init: { status: 201, }, }),
  );
  app.put("/resource", () => ({ body: "PUT response", }),);
  app.delete("/resource", () => ({ body: "DELETE response", }),);
  app.patch("/resource", () => ({ body: "PATCH response", }),);
  app.options("/resource", () => ({ body: "", init: { status: 204, }, }),);
  app.head("/resource", () => ({ body: "", }),);

  // Tests each method
  const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD",];

  for (const method of methods) {
    const req = new Request("http://localhost/resource", { method, },);
    const res = await app.handleRequest(req,);

    if (method === "OPTIONS") {
      assertEquals(res.status, 204,);
    } else if (method === "POST") {
      assertEquals(res.status, 201,);
    } else {
      assertEquals(res.status, 200,);
    }
  }
});
