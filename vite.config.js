import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";

const readJson = async (filePath, fallback) => {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeJson = async (filePath, data) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
};

const toSafeName = (value) => String(value || "").replace(/[\\/:*?"<>|]/g, "_").trim();

const localPersistencePlugin = () => ({
  name: "local-persistence-api",
  configureServer(server) {
    const root = server.config.root;
    const dataRoot = path.join(root, "local_data");
    const usersFile = path.join(dataRoot, "users", "users.json");
    const projectsMetaFile = path.join(dataRoot, "projects", "projects.json");

    const parseBody = (req) => new Promise((resolve) => {
      let data = "";
      req.on("data", (chunk) => { data += chunk; });
      req.on("end", () => {
        try { resolve(data ? JSON.parse(data) : {}); }
        catch { resolve({}); }
      });
    });

    const send = (res, code, payload) => {
      res.statusCode = code;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(payload));
    };

    server.middlewares.use(async (req, res, next) => {
      if (!req.url?.startsWith("/api/")) return next();

      try {
        const method = req.method || "GET";
        const reqUrl = new URL(req.url, "http://127.0.0.1");
        const pathname = reqUrl.pathname;

        if (method === "GET" && pathname === "/api/users") {
          const users = await readJson(usersFile, []);
          return send(res, 200, { ok: true, users });
        }

        if (method === "POST" && pathname === "/api/auth/register") {
          const body = await parseBody(req);
          const username = toSafeName(body.username);
          const password = String(body.password || "");
          if (!username || !password) return send(res, 400, { ok: false, message: "Username and password are required." });

          const users = await readJson(usersFile, []);
          if (users.some((u) => u.username === username)) return send(res, 409, { ok: false, message: "User already exists." });

          users.push({ username, password, createdAt: Date.now() });
          await writeJson(usersFile, users);
          await fs.mkdir(path.join(dataRoot, "projects", username), { recursive: true });
          return send(res, 200, { ok: true, users });
        }

        if (method === "POST" && pathname === "/api/auth/login") {
          const body = await parseBody(req);
          const username = toSafeName(body.username);
          const password = String(body.password || "");
          const users = await readJson(usersFile, []);
          const valid = users.some((u) => u.username === username && u.password === password);
          if (!valid) return send(res, 401, { ok: false, message: "Invalid username or password." });
          return send(res, 200, { ok: true });
        }

        if (method === "GET" && pathname === "/api/projects") {
          const owner = toSafeName(reqUrl.searchParams.get("owner") || "");
          const all = await readJson(projectsMetaFile, []);
          const list = all.filter((p) => p.owner === owner).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          return send(res, 200, { ok: true, projects: list });
        }

        if (method === "GET" && pathname.startsWith("/api/projects/")) {
          const id = decodeURIComponent(pathname.replace("/api/projects/", ""));
          const owner = toSafeName(reqUrl.searchParams.get("owner") || "");
          const all = await readJson(projectsMetaFile, []);
          const project = all.find((p) => p.id === id && p.owner === owner);
          if (!project) return send(res, 404, { ok: false, message: "Project not found." });
          const content = await fs.readFile(project.filePath, "utf-8").catch(() => "");
          return send(res, 200, { ok: true, project: { ...project, content } });
        }

        if (method === "POST" && pathname === "/api/projects/create") {
          const body = await parseBody(req);
          const owner = toSafeName(body.owner);
          const name = toSafeName(body.name) || `Untitled-${Date.now()}`;
          const template = String(body.template || "article");
          const content = String(body.content || "");
          if (!owner) return send(res, 400, { ok: false, message: "Owner is required." });

          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const ownerDir = path.join(dataRoot, "projects", owner);
          await fs.mkdir(ownerDir, { recursive: true });
          const texPath = path.join(ownerDir, `${id}.tex`);
          await fs.writeFile(texPath, content, "utf-8");

          const all = await readJson(projectsMetaFile, []);
          const project = { id, owner, name, template, updatedAt: Date.now(), filePath: texPath, content };
          all.push({ ...project, content: undefined });
          await writeJson(projectsMetaFile, all);
          return send(res, 200, { ok: true, project });
        }

        if (method === "POST" && pathname === "/api/projects/save") {
          const body = await parseBody(req);
          const id = String(body.id || "");
          const owner = toSafeName(body.owner);
          const content = String(body.content || "");
          const name = toSafeName(body.name) || "main";
          const template = String(body.template || "article");
          if (!id || !owner) return send(res, 400, { ok: false, message: "id and owner are required." });

          const all = await readJson(projectsMetaFile, []);
          let project = all.find((p) => p.id === id && p.owner === owner);
          if (!project) {
            const ownerDir = path.join(dataRoot, "projects", owner);
            await fs.mkdir(ownerDir, { recursive: true });
            const texPath = path.join(ownerDir, `${id}.tex`);
            project = { id, owner, name, template, updatedAt: Date.now(), filePath: texPath };
            all.push(project);
          }

          project.updatedAt = Date.now();
          project.name = name;
          project.template = template;
          await fs.mkdir(path.dirname(project.filePath), { recursive: true });
          await fs.writeFile(project.filePath, content, "utf-8");
          await writeJson(projectsMetaFile, all);
          return send(res, 200, { ok: true, project: { ...project, content } });
        }

        if (method === "POST" && pathname === "/api/projects/delete") {
          const body = await parseBody(req);
          const id = String(body.id || "");
          const owner = toSafeName(body.owner);
          const all = await readJson(projectsMetaFile, []);
          const idx = all.findIndex((p) => p.id === id && p.owner === owner);
          if (idx === -1) return send(res, 404, { ok: false, message: "Project not found." });
          const [project] = all.splice(idx, 1);
          await fs.unlink(project.filePath).catch(() => {});
          await writeJson(projectsMetaFile, all);
          return send(res, 200, { ok: true });
        }

        return send(res, 404, { ok: false, message: "API route not found." });
      } catch (error) {
        return send(res, 500, { ok: false, message: error?.message || "Server error" });
      }
    });
  }
});

export default defineConfig({
  plugins: [react(), localPersistencePlugin()],
  esbuild: {
    include: /\.[jt]sx?$/,
    jsx: "automatic"
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        ".js": "jsx",
        ".jsx": "jsx"
      }
    }
  },
  server: {
    port: 5173,
    host: "127.0.0.1"
  }
});
