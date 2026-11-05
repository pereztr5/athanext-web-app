import type { BrowserContext, Page, Request, Route } from "@playwright/test";

// A stand-in for Supabase that lives inside the test. The app is started with
// VITE_SUPABASE_URL pointing at MOCK_SUPABASE_URL, and every request to it is answered here:
// auth, PostgREST tables and RPCs, edge functions, storage and realtime. Nothing leaves the
// machine, so the whole app can be tested signed in, with no accounts and no secrets.
//
// Tables are a small in-memory database: GETs filter rows, inserts add them, updates and
// deletes change them, so a test can save a form and then see the saved value. Every write
// is also recorded in `backend.writes` for the test to check.

export const MOCK_SUPABASE_URL = "https://e2emock.supabase.co";
export const MOCK_STORAGE_KEY = "sb-e2emock-auth-token";

type Row = Record<string, unknown>;
type Json = unknown;

export type MockUser = {
  id: string;
  email: string;
  password: string;
  user_metadata?: Row;
  email_confirmed_at?: string | null;
};

export type Write = {
  method: string;
  kind: "table" | "rpc" | "function" | "auth" | "storage";
  name: string;
  url: string;
  body: Json;
};

export type RpcHandler = (args: Row, ctx: { backend: MockBackend; user: MockUser | null }) => Json;
export type FunctionHandler = (body: Json, ctx: { backend: MockBackend; user: MockUser | null; method: string }) => Json;

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64"
);

const b64url = (value: string) => Buffer.from(value).toString("base64url");

const makeJwt = (payload: Row) => `${b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${b64url(JSON.stringify(payload))}.e2e-signature`;

const decodeJwt = (token: string | undefined): Row | null => {
  if (!token) return null;
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

let idCounter = 0;
// UUID-shaped so code that validates ids accepts it.
export const mockId = () => {
  idCounter += 1;
  return `0000e2e0-0000-4000-8000-${idCounter.toString(16).padStart(12, "0")}`;
};

// Reads a PostgREST filter value such as "eq.abc", "in.(a,b)", "is.null".
const matches = (row: Row, column: string, raw: string): boolean => {
  // Embedded-resource filters ("coaches.slug") and logical groups are not modelled; keep the row.
  if (column.includes(".") || column === "or" || column === "and" || column === "not") return true;
  let negate = false;
  let expr = raw;
  if (expr.startsWith("not.")) {
    negate = true;
    expr = expr.slice(4);
  }
  const dot = expr.indexOf(".");
  if (dot < 0) return true;
  const op = expr.slice(0, dot);
  const value = decodeURIComponent(expr.slice(dot + 1));
  const cell = row[column];
  const str = cell === null || cell === undefined ? null : String(cell);
  let result: boolean;
  switch (op) {
    case "eq":
      result = str === value;
      break;
    case "neq":
      result = str !== value;
      break;
    case "is":
      result = value === "null" ? cell === null || cell === undefined : value === "true" ? cell === true : value === "false" ? cell === false : true;
      break;
    case "in": {
      const list = value.replace(/^\(|\)$/g, "").split(",").map((v) => v.replace(/^"|"$/g, ""));
      result = str !== null && list.includes(str);
      break;
    }
    case "gt":
      result = str !== null && str > value;
      break;
    case "gte":
      result = str !== null && str >= value;
      break;
    case "lt":
      result = str !== null && str < value;
      break;
    case "lte":
      result = str !== null && str <= value;
      break;
    case "cs":
    case "ov": {
      const list = value.replace(/^\{|\}$/g, "").split(",").filter(Boolean);
      const arr = Array.isArray(cell) ? cell.map(String) : [];
      result = op === "cs" ? list.every((v) => arr.includes(v)) : list.some((v) => arr.includes(v));
      break;
    }
    default:
      // like, ilike, fts and friends: not modelled, keep the row.
      result = true;
  }
  return negate ? !result : result;
};

const RESERVED = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);

// Top-level embedded resources in a select string: "*,coach:coaches(name),reviews(*)" -> ["coach", "reviews"].
const embeddedKeys = (select: string | null): string[] => {
  if (!select) return [];
  const keys: string[] = [];
  let depth = 0;
  let token = "";
  const flush = () => {
    const t = token.trim();
    token = "";
    const paren = t.indexOf("(");
    if (paren < 0) return;
    const head = t.slice(0, paren);
    const alias = head.includes(":") ? head.split(":")[0] : head.split("!")[0];
    if (alias) keys.push(alias.replace(/^\.\.\./, ""));
  };
  for (const ch of select) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === "," && depth === 0) flush();
    else token += ch;
  }
  flush();
  return keys.filter((k) => k && !k.startsWith("..."));
};

export class MockBackend {
  tables: Record<string, Row[]> = {};
  rpc: Record<string, RpcHandler | Json> = {};
  functions: Record<string, FunctionHandler | Json> = {};
  users: MockUser[] = [];
  writes: Write[] = [];
  /** Requests the mock answered with its generic default, for spotting missing fixtures. */
  unhandled: string[] = [];
  /** Hosts outside the app and Supabase that the page tried to reach. */
  external: string[] = [];
  /** The user whose token the last auth call carried. */
  currentUser: MockUser | null = null;

  table(name: string): Row[] {
    if (!this.tables[name]) this.tables[name] = [];
    return this.tables[name];
  }

  seed(name: string, rows: Row[]) {
    this.table(name).push(...rows);
    return this;
  }

  writesTo(name: string, method?: string) {
    return this.writes.filter((w) => w.name === name && (!method || w.method === method));
  }

  addUser(user: MockUser) {
    this.users.push(user);
    return user;
  }

  sessionFor(user: MockUser) {
    const now = Math.floor(Date.now() / 1000);
    const authUser = this.authUser(user);
    return {
      access_token: makeJwt({ sub: user.id, email: user.email, role: "authenticated", aud: "authenticated", exp: now + 3600 * 24, iat: now }),
      refresh_token: `refresh-${user.id}`,
      token_type: "bearer",
      expires_in: 3600 * 24,
      expires_at: now + 3600 * 24,
      user: authUser,
    };
  }

  authUser(user: MockUser) {
    return {
      id: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email,
      email_confirmed_at: user.email_confirmed_at === undefined ? "2025-01-01T00:00:00Z" : user.email_confirmed_at,
      phone: "",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: user.user_metadata ?? {},
      identities: [],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };
  }

  private userFromRequest(request: Request): MockUser | null {
    const auth = request.headers()["authorization"];
    const payload = decodeJwt(auth?.replace(/^Bearer\s+/i, ""));
    const sub = typeof payload?.sub === "string" ? payload.sub : null;
    return (sub && this.users.find((u) => u.id === sub)) || null;
  }

  /** Signs `user` in before the first page loads (once per tab, so signing out sticks). */
  async signIn(page: Page, user: MockUser) {
    const session = this.sessionFor(user);
    await page.addInitScript(
      ({ key, value }) => {
        try {
          if (sessionStorage.getItem("e2e-session-seeded")) return;
          sessionStorage.setItem("e2e-session-seeded", "1");
          localStorage.setItem(key, value);
        } catch {
          // storage blocked: the test will see a signed-out app
        }
      },
      { key: MOCK_STORAGE_KEY, value: JSON.stringify(session) }
    );
  }

  async install(target: Page | BrowserContext, appOrigin: string) {
    const origin = new URL(MOCK_SUPABASE_URL).origin;
    await target.route(
      (url) => url.origin !== appOrigin,
      (route) => (route.request().url().startsWith(origin) ? this.handleSupabase(route) : this.handleExternal(route))
    );
    await target.routeWebSocket(/realtime\/v1\/websocket/, (ws) => {
      // Answer joins and heartbeats so channels settle as "subscribed" and stay quiet.
      ws.onMessage((message) => {
        try {
          const parsed = JSON.parse(String(message));
          if (Array.isArray(parsed)) {
            const [joinRef, ref, topic, event] = parsed;
            if (event === "phx_join" || event === "heartbeat" || event === "access_token" || event === "phx_leave")
              ws.send(JSON.stringify([joinRef, ref, topic, "phx_reply", { status: "ok", response: { postgres_changes: [] } }]));
          } else if (parsed && typeof parsed === "object") {
            const { topic, event, ref, join_ref } = parsed as Row;
            if (event === "phx_join" || event === "heartbeat" || event === "access_token" || event === "phx_leave")
              ws.send(JSON.stringify({ topic, event: "phx_reply", ref, join_ref, payload: { status: "ok", response: { postgres_changes: [] } } }));
          }
        } catch {
          // binary frames: ignore
        }
      });
    });
  }

  private async handleExternal(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    this.external.push(url.host);
    if (url.host === "api.zippopotam.us") {
      return route.fulfill({
        json: { "post code": "10001", country: "United States", places: [{ "place name": "New York", state: "New York", "state abbreviation": "NY", latitude: "40.75", longitude: "-73.99" }] },
      });
    }
    switch (request.resourceType()) {
      case "image":
        return route.fulfill({ status: 200, contentType: "image/png", body: PNG_1X1 });
      case "stylesheet":
        return route.fulfill({ status: 200, contentType: "text/css", body: "" });
      case "script":
        return route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
      case "font":
      case "media":
        return route.fulfill({ status: 404, body: "" });
      case "document":
        // Leaving the app (Stripe checkout, Google sign-in, mailto). Show a blank page.
        return route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>external</body></html>" });
      default:
        return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
  }

  private async handleSupabase(route: Route) {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      return route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS",
        },
      });
    }
    const url = new URL(request.url());
    const path = url.pathname;
    try {
      if (path.startsWith("/auth/v1/")) return await this.handleAuth(route, path.slice("/auth/v1/".length), url);
      if (path.startsWith("/rest/v1/rpc/")) return await this.handleRpc(route, decodeURIComponent(path.slice("/rest/v1/rpc/".length)));
      if (path.startsWith("/rest/v1/")) return await this.handleTable(route, decodeURIComponent(path.slice("/rest/v1/".length)), url);
      if (path.startsWith("/functions/v1/")) return await this.handleFunction(route, path.slice("/functions/v1/".length));
      if (path.startsWith("/storage/v1/")) return await this.handleStorage(route, path.slice("/storage/v1/".length));
    } catch (error) {
      return this.json(route, 500, { message: `mock error: ${(error as Error).message}` });
    }
    this.unhandled.push(`${request.method()} ${path}`);
    return this.json(route, 404, { message: "not found" });
  }

  private json(route: Route, status: number, body: Json, headers: Record<string, string> = {}) {
    return route.fulfill({
      status,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range, x-total-count", ...headers },
      body: body === undefined ? "" : JSON.stringify(body),
    });
  }

  private body(request: Request): Json {
    const raw = request.postData();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  private record(request: Request, kind: Write["kind"], name: string, body: Json) {
    this.writes.push({ method: request.method(), kind, name, url: request.url(), body });
  }

  private async handleAuth(route: Route, endpoint: string, url: URL) {
    const request = route.request();
    const method = request.method();
    const body = (this.body(request) ?? {}) as Row;
    if (method !== "GET") this.record(request, "auth", endpoint, endpoint === "token" ? { ...body, password: body.password ? "***" : undefined } : body);

    if (endpoint === "token") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const user = this.users.find((u) => u.email.toLowerCase() === String(body.email ?? "").toLowerCase() && u.password === body.password);
        if (!user) return this.json(route, 400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
        this.currentUser = user;
        return this.json(route, 200, this.sessionFor(user));
      }
      if (grant === "refresh_token") {
        const id = String(body.refresh_token ?? "").replace(/^refresh-/, "");
        const user = this.users.find((u) => u.id === id);
        if (!user) return this.json(route, 400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
        return this.json(route, 200, this.sessionFor(user));
      }
      return this.json(route, 400, { code: 400, error_code: "unsupported_grant_type", msg: "unsupported grant" });
    }
    if (endpoint === "user") {
      const user = this.userFromRequest(request);
      if (!user) return this.json(route, 401, { code: 401, error_code: "no_authorization", msg: "no user" });
      if (method === "PUT") {
        if (body.data && typeof body.data === "object") user.user_metadata = { ...(user.user_metadata ?? {}), ...(body.data as Row) };
        if (typeof body.password === "string") user.password = body.password;
        if (typeof body.email === "string") user.email = body.email;
      }
      return this.json(route, 200, this.authUser(user));
    }
    if (endpoint === "signup") {
      const existing = this.users.find((u) => u.email.toLowerCase() === String(body.email ?? "").toLowerCase());
      if (existing) return this.json(route, 422, { code: 422, error_code: "user_already_exists", msg: "User already registered" });
      const user = this.addUser({
        id: mockId(),
        email: String(body.email),
        password: String(body.password ?? ""),
        user_metadata: (body.data as Row) ?? {},
        email_confirmed_at: null,
      });
      // Email confirmation on: a user and no session, like the real project. An empty
      // identities list is how GoTrue says "already registered", so give the new user one.
      return this.json(route, 200, {
        ...this.authUser(user),
        identities: [{ id: user.id, user_id: user.id, provider: "email", identity_data: { email: user.email, sub: user.id } }],
        confirmation_sent_at: new Date().toISOString(),
      });
    }
    if (endpoint === "logout") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
    if (endpoint === "recover" || endpoint === "resend" || endpoint === "otp" || endpoint === "reauthenticate") return this.json(route, 200, {});
    if (endpoint === "verify") {
      // The user the code was sent to; "000000" stands for a wrong or expired code.
      const email = String(body.email ?? "").toLowerCase();
      const user = email ? this.users.find((u) => u.email.toLowerCase() === email) : this.users[0];
      if (!user || body.token === "000000") return this.json(route, 403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
      user.email_confirmed_at = new Date().toISOString();
      this.currentUser = user;
      return this.json(route, 200, this.sessionFor(user));
    }
    if (endpoint === "settings") return this.json(route, 200, { external: { google: true, email: true }, disable_signup: false, mailer_autoconfirm: false });
    if (endpoint === "factors" || endpoint.startsWith("factors")) return this.json(route, 200, []);
    this.unhandled.push(`${method} /auth/v1/${endpoint}`);
    return this.json(route, 200, {});
  }

  private async handleRpc(route: Route, name: string) {
    const request = route.request();
    const args = ((request.method() === "GET" ? Object.fromEntries(new URL(request.url()).searchParams) : this.body(request)) ?? {}) as Row;
    this.record(request, "rpc", name, args);
    const handler = this.rpc[name];
    const user = this.userFromRequest(request);
    let result: Json;
    if (handler === undefined) {
      this.unhandled.push(`rpc ${name}`);
      result = null;
    } else {
      result = typeof handler === "function" ? (handler as RpcHandler)(args, { backend: this, user }) : handler;
    }
    if (result instanceof MockError) return this.json(route, result.status, { code: result.code, message: result.message, details: null, hint: null });
    const accept = request.headers()["accept"] ?? "";
    if (accept.includes("vnd.pgrst.object") && Array.isArray(result)) {
      if (result.length !== 1) return this.json(route, 406, { code: "PGRST116", details: `The result contains ${result.length} rows`, message: "JSON object requested, multiple (or no) rows returned" });
      return this.json(route, 200, result[0]);
    }
    return this.json(route, 200, result);
  }

  private async handleTable(route: Route, name: string, url: URL) {
    const request = route.request();
    const method = request.method();
    const headers = request.headers();
    const accept = headers["accept"] ?? "";
    const prefer = headers["prefer"] ?? "";
    const wantsObject = accept.includes("vnd.pgrst.object");
    const select = url.searchParams.get("select");
    const filters = [...url.searchParams.entries()].filter(([k]) => !RESERVED.has(k));
    const rows = this.table(name);
    const filtered = () => rows.filter((row) => filters.every(([k, v]) => matches(row, k, v)));
    const shape = (list: Row[]) => {
      const keys = embeddedKeys(select);
      return list.map((row) => {
        const out = { ...row };
        for (const key of keys) if (!(key in out)) out[key] = [];
        return out;
      });
    };
    const respond = (list: Row[], status = 200, total?: number) => {
      const extra: Record<string, string> = {};
      if (prefer.includes("count=") || total !== undefined) {
        const count = total ?? list.length;
        extra["content-range"] = list.length ? `0-${list.length - 1}/${count}` : `*/${count}`;
      }
      if (method === "HEAD") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "content-range", ...extra } });
      if (wantsObject) {
        if (list.length !== 1) return this.json(route, 406, { code: "PGRST116", details: `The result contains ${list.length} rows`, message: "JSON object requested, multiple (or no) rows returned" });
        return this.json(route, status, shape(list)[0], extra);
      }
      return this.json(route, status, shape(list), extra);
    };

    if (method === "GET" || method === "HEAD") {
      let list = filtered();
      const order = url.searchParams.get("order");
      if (order) {
        const [col, dir] = order.split(",")[0].split(".");
        list = [...list].sort((a, b) => {
          const x = a[col] as string | number;
          const y = b[col] as string | number;
          if (x === y) return 0;
          if (x === null || x === undefined) return 1;
          if (y === null || y === undefined) return -1;
          return (x > y ? 1 : -1) * (dir === "desc" ? -1 : 1);
        });
      }
      const total = list.length;
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = url.searchParams.get("limit");
      list = list.slice(offset, limit ? offset + Number(limit) : undefined);
      return respond(list, 200, prefer.includes("count=") ? total : undefined);
    }

    const body = this.body(request);
    this.record(request, "table", name, body);
    const returns = prefer.includes("return=representation") || Boolean(select);

    if (method === "POST") {
      const incoming = (Array.isArray(body) ? body : [body]) as Row[];
      const conflict = url.searchParams.get("on_conflict");
      const saved = incoming.map((item) => {
        const key = conflict ?? "id";
        const existing = item[key] !== undefined ? rows.find((r) => r[key] === item[key]) : undefined;
        if (existing && prefer.includes("resolution=")) {
          Object.assign(existing, item);
          return existing;
        }
        const row = { id: mockId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...item };
        rows.push(row);
        return row;
      });
      return returns ? respond(saved, 201) : route.fulfill({ status: 201, headers: { "access-control-allow-origin": "*" } });
    }
    if (method === "PATCH") {
      const target = filtered();
      for (const row of target) Object.assign(row, body as Row, { updated_at: new Date().toISOString() });
      return returns ? respond(target) : route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
    }
    if (method === "DELETE") {
      const target = filtered();
      this.tables[name] = rows.filter((r) => !target.includes(r));
      return returns ? respond(target) : route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
    }
    return this.json(route, 405, { message: "method not allowed" });
  }

  private async handleFunction(route: Route, name: string) {
    const request = route.request();
    const body = this.body(request);
    this.record(request, "function", name, body);
    const handler = this.functions[name];
    const user = this.userFromRequest(request);
    if (handler === undefined) {
      this.unhandled.push(`function ${name}`);
      return this.json(route, 200, {});
    }
    const result = typeof handler === "function" ? (handler as FunctionHandler)(body, { backend: this, user, method: request.method() }) : handler;
    if (result instanceof MockError) return this.json(route, result.status, { error: result.message, code: result.code });
    return this.json(route, 200, result);
  }

  private async handleStorage(route: Route, path: string) {
    const request = route.request();
    const method = request.method();
    if (path.startsWith("object/public/") || path.startsWith("render/image/") || (method === "GET" && path.startsWith("object/"))) {
      return route.fulfill({ status: 200, contentType: "image/png", headers: { "access-control-allow-origin": "*" }, body: PNG_1X1 });
    }
    if (path.startsWith("object/list/")) return this.json(route, 200, []);
    if (path.startsWith("object/sign/")) {
      const bucketPath = path.slice("object/sign/".length);
      const body = this.body(request) as Row | null;
      if (body && Array.isArray(body.paths)) return this.json(route, 200, (body.paths as string[]).map((p) => ({ path: p, signedURL: `/object/sign/${p}?token=e2e`, error: null })));
      return this.json(route, 200, { signedURL: `/object/sign/${bucketPath}?token=e2e` });
    }
    if (path.startsWith("object/")) {
      this.record(request, "storage", path, null);
      const key = path.replace(/^object\//, "");
      return this.json(route, 200, { Key: key, Id: mockId(), path: key.split("/").slice(1).join("/") });
    }
    if (path.startsWith("bucket")) return this.json(route, 200, []);
    this.unhandled.push(`${method} /storage/v1/${path}`);
    return this.json(route, 200, {});
  }
}

/** Return from an RPC or function handler to answer with an error. */
export class MockError {
  constructor(
    public message: string,
    public status = 400,
    public code = "P0001"
  ) {}
}
