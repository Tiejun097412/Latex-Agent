import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
const allowedCompilers = new Set(["xelatex", "pdflatex", "lualatex"]);

const hashPassword = (password) => {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
};

const verifyPassword = (password, storedHash, legacyPassword) => {
  if (storedHash?.startsWith("scrypt:")) {
    const [, salt, expectedHash] = storedHash.split(":");
    if (!salt || !expectedHash) return false;
    const actualHash = scryptSync(String(password), salt, 64);
    const expectedBuffer = Buffer.from(expectedHash, "hex");
    return expectedBuffer.length === actualHash.length && timingSafeEqual(expectedBuffer, actualHash);
  }
  if (typeof legacyPassword === "string") return legacyPassword === String(password);
  return false;
};

const sanitizeUser = (user) => ({
  username: user.username,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt || null
});

const dataUrlToBuffer = (dataUrl) => {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,(.+)$/);
  if (!match) throw new Error("Invalid image data URL.");
  return Buffer.from(match[2], "base64");
};

const writeTextAttachments = async (attachments, workDir) => {
  for (const attachment of attachments || []) {
    if (!attachment?.name || typeof attachment.content !== "string") continue;
    const safeName = path.basename(String(attachment.name));
    await fs.writeFile(path.join(workDir, safeName), attachment.content, "utf-8");
  }
};

const needsBiber = (source) => /\\addbibresource|\\printbibliography|biblatex/.test(source);
const needsBibtex = (source, attachments) => {
  const hasBibAttachment = (attachments || []).some((attachment) => /\.bib$/i.test(String(attachment?.name || "")));
  return hasBibAttachment && /\\bibliography\{|\\cite\{|\\citep\{|\\citet\{/.test(source) && !needsBiber(source);
};

const copyArtifacts = async ({ outputDir, workDir, textAttachments, images }) => {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.copyFile(path.join(workDir, "main.pdf"), path.join(outputDir, "main.pdf"));
  await fs.copyFile(path.join(workDir, "main.tex"), path.join(outputDir, "main.tex"));

  for (const attachment of textAttachments || []) {
    if (!attachment?.name || typeof attachment.content !== "string") continue;
    const safeName = path.basename(String(attachment.name));
    await fs.writeFile(path.join(outputDir, safeName), attachment.content, "utf-8");
  }

  for (const image of images || []) {
    if (!image?.name || !image?.dataUrl) continue;
    const safeName = path.basename(String(image.name));
    await fs.writeFile(path.join(outputDir, safeName), dataUrlToBuffer(image.dataUrl));
  }
};

const compileLatex = async ({ compiler, source, images, attachments, outputDir }) => {
  const selectedCompiler = allowedCompilers.has(compiler) ? compiler : "xelatex";
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "latex-agent-"));
  const texPath = path.join(workDir, "main.tex");
  const pdfPath = path.join(workDir, "main.pdf");

  try {
    await fs.writeFile(texPath, source, "utf-8");
    await writeTextAttachments(attachments, workDir);

    for (const image of images || []) {
      if (!image?.name || !image?.dataUrl) continue;
      const safeName = path.basename(String(image.name));
      await fs.writeFile(path.join(workDir, safeName), dataUrlToBuffer(image.dataUrl));
    }

    let combinedLog = "";
    const runLatexPass = async (pass) => {
      const { stdout, stderr } = await execFileAsync(selectedCompiler, ["-interaction=nonstopmode", "-file-line-error", "main.tex"], {
        cwd: workDir,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 20
      });
      combinedLog += `\n--- ${selectedCompiler} pass ${pass} ---\n${stdout || ""}${stderr || ""}`;
    };

    await runLatexPass(1);

    if (needsBiber(source)) {
      const { stdout, stderr } = await execFileAsync("biber", ["main"], {
        cwd: workDir,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 20
      });
      combinedLog += `\n--- biber ---\n${stdout || ""}${stderr || ""}`;
      await runLatexPass(2);
      await runLatexPass(3);
    } else if (needsBibtex(source, attachments)) {
      const { stdout, stderr } = await execFileAsync("bibtex", ["main"], {
        cwd: workDir,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 20
      });
      combinedLog += `\n--- bibtex ---\n${stdout || ""}${stderr || ""}`;
      await runLatexPass(2);
      await runLatexPass(3);
    } else {
      await runLatexPass(2);
    }

    const pdfBuffer = await fs.readFile(pdfPath);
    await copyArtifacts({ outputDir, workDir, textAttachments: attachments, images });

    return { pdfBase64: pdfBuffer.toString("base64"), log: combinedLog.trim(), compiler: selectedCompiler };
  } catch (error) {
    const logPath = path.join(workDir, "main.log");
    const auxLog = await fs.readFile(logPath, "utf-8").catch(() => "");
    const errorLog = [error?.stdout || "", error?.stderr || "", auxLog].filter(Boolean).join("\n").trim();
    throw new Error(errorLog || error?.message || "LaTeX compilation failed.");
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
};

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
          return send(res, 200, { ok: true, users: users.map(sanitizeUser) });
        }

        if (method === "POST" && pathname === "/api/auth/register") {
          const body = await parseBody(req);
          const username = toSafeName(body.username);
          const password = String(body.password || "");
          if (!username || !password) return send(res, 400, { ok: false, message: "Username and password are required." });

          const users = await readJson(usersFile, []);
          if (users.some((u) => u.username === username)) return send(res, 409, { ok: false, message: "User already exists." });

          users.push({ username, passwordHash: hashPassword(password), createdAt: Date.now(), lastLoginAt: Date.now() });
          await writeJson(usersFile, users);
          await fs.mkdir(path.join(dataRoot, "projects", username), { recursive: true });
          return send(res, 200, { ok: true, users: users.map(sanitizeUser) });
        }

        if (method === "POST" && pathname === "/api/auth/login") {
          const body = await parseBody(req);
          const username = toSafeName(body.username);
          const password = String(body.password || "");
          const users = await readJson(usersFile, []);
          const user = users.find((u) => u.username === username);
          if (!user || !verifyPassword(password, user.passwordHash, user.password)) {
            return send(res, 401, { ok: false, message: "Invalid username or password." });
          }

          let shouldPersist = false;
          if (!user.passwordHash) {
            user.passwordHash = hashPassword(password);
            delete user.password;
            shouldPersist = true;
          }
          user.lastLoginAt = Date.now();
          shouldPersist = true;
          if (shouldPersist) await writeJson(usersFile, users);

          return send(res, 200, { ok: true, user: sanitizeUser(user) });
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

        if (method === "POST" && pathname === "/api/projects/compile") {
          const body = await parseBody(req);
          const id = toSafeName(body.id || `temp-${Date.now()}`);
          const owner = toSafeName(body.owner || "anonymous");
          const compiler = String(body.compiler || "xelatex").toLowerCase();
          const source = String(body.content || "");
          const images = Array.isArray(body.images) ? body.images : [];
          const attachments = Array.isArray(body.attachments) ? body.attachments : [];
          if (!source.trim()) return send(res, 400, { ok: false, message: "LaTeX source is required." });

          const outputDir = path.join(dataRoot, "projects", owner, `${id}_artifacts`);
          const result = await compileLatex({ compiler, source, images, attachments, outputDir });
          return send(res, 200, {
            ok: true,
            compiler: result.compiler,
            pdfBase64: result.pdfBase64,
            log: result.log,
            outputDir
          });
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
