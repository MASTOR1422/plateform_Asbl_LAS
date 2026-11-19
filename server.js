"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const express = require("express");
const helmet = require("helmet");
const Database = require("better-sqlite3");
const multer = require("multer");
const { rateLimit } = require("express-rate-limit");

const root = __dirname;
const dataDir = path.resolve(process.env.LAS_DATA_DIR || path.join(root, "data"));
const storageDir = path.resolve(process.env.LAS_STORAGE_DIR || path.join(root, "storage"));
const photoDir = path.join(storageDir, "photos");
const documentDir = path.join(storageDir, "documents");
const tempDir = path.join(storageDir, "tmp");
const dbPath = path.resolve(process.env.LAS_DB_PATH || path.join(dataDir, "las.sqlite"));
for (const dir of [dataDir, photoDir, documentDir, tempDir]) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
if (process.env.NODE_ENV === "production" && (!process.env.LAS_SESSION_SECRET || process.env.LAS_SESSION_SECRET.length < 32)) throw new Error("LAS_SESSION_SECRET doit contenir au moins 32 caractères.");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
db.exec(fs.readFileSync(path.join(root, "db/schema.sql"), "utf8"));

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", Number(process.env.TRUST_PROXY || 0));
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", "data:"], connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], frameAncestors: ["'none'"], formAction: ["'self'"] } }, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: "100kb" }));

const now = () => new Date().toISOString();
const unix = () => Math.floor(Date.now() / 1000);
const hash = s => crypto.createHash("sha256").update(s).digest("hex");
const clean = (v, n = 180) => typeof v === "string" ? v.trim().slice(0, n) : "";
const roles = ["admin", "secretaire", "tresorier", "membre"];
const cookieName = "las_session";
const sessionSecret = process.env.LAS_SESSION_SECRET || "development-only-change-this-secret-before-deployment";
function parseCookies(req) {
  return Object.fromEntries((req.headers.cookie || "").split(";").map(v => v.trim().split(/=(.*)/s).slice(0, 2)).filter(v => v.length === 2).map(([k,v]) => [k, decodeURIComponent(v)]));
}
function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", cookieName + "=" + encodeURIComponent(token) + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800" + secure);
}
function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", cookieName + "=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0" + secure);
}
function ipHash(req) { return hash(String(req.ip || req.socket.remoteAddress || "unknown") + sessionSecret); }
function audit(req, userId, action, targetType, targetId) {
  db.prepare("INSERT INTO audit_log(user_id,action,target_type,target_id,ip_hash,created_at) VALUES(?,?,?,?,?,?)")
    .run(userId || null, action, targetType || null, targetId == null ? null : String(targetId), ipHash(req), now());
}
function userSafe(u) {
  return { id: u.id, username: u.username, displayName: u.display_name, role: u.role, memberId: u.member_id, active: !!u.active };
}
function passwordHash(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return "scrypt$" + salt.toString("base64url") + "$" + derived.toString("base64url");
}
function verifyPassword(password, stored) {
  try {
    const [scheme, salt, expectedText] = String(stored || "").split("$");
    if (scheme !== "scrypt" || !salt || !expectedText) return false;
    const expected = Buffer.from(expectedText, "base64url");
    const actual = crypto.scryptSync(password, Buffer.from(salt, "base64url"), expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (_) { return false; }
}
function auth(req, res, next) {
  const token = parseCookies(req)[cookieName];
  if (!token || token.length < 40) return res.status(401).json({ error: "Connexion requise." });
  const row = db.prepare("SELECT s.id AS sid,s.expires_at,u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?").get(hash(token));
  if (!row || !row.active || row.expires_at <= unix()) {
    if (row) db.prepare("DELETE FROM sessions WHERE id=?").run(row.sid);
    clearSessionCookie(res);
    return res.status(401).json({ error: "Session expirée. Reconnectez-vous." });
  }
  req.user = userSafe(row);
  next();
}
function allow(...allowed) {
  return (req, res, next) => allowed.includes(req.user.role) ? next() : res.status(403).json({ error: "Autorisation insuffisante." });
}
function sameOrigin(req, res, next) {
  const origin = req.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.host !== req.get("host") || !["http:", "https:"].includes(parsed.protocol)) return res.status(403).json({ error: "Origine refusée." });
    } catch (_) { return res.status(403).json({ error: "Origine refusée." }); }
  }
  next();
}
app.use("/api", sameOrigin);
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-8", legacyHeaders: false, message: { error: "Trop de tentatives. Réessayez dans 15 minutes." } });
const photoUpload = multer({ dest: tempDir, limits: { fileSize: 5 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => cb(null, ["image/jpeg","image/png","image/webp"].includes(file.mimetype)) });
const docUpload = multer({ dest: tempDir, limits: { fileSize: 15 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => cb(null, ["application/pdf","image/jpeg","image/png","text/plain","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(file.mimetype)) });
function fileSignature(file, kind) {
  const b = fs.readFileSync(file.path);
  if (kind === "photo") return (file.mimetype === "image/jpeg" && b.subarray(0,3).equals(Buffer.from([255,216,255]))) ||
    (file.mimetype === "image/png" && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ||
    (file.mimetype === "image/webp" && b.toString("ascii",0,4)==="RIFF" && b.toString("ascii",8,12)==="WEBP");
  if (file.mimetype === "application/pdf") return b.toString("ascii",0,5)==="%PDF-";
  if (file.mimetype === "image/jpeg") return b.subarray(0,3).equals(Buffer.from([255,216,255]));
  if (file.mimetype === "image/png") return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  return true;
}
function memberInput(body) {
  const name = clean(body.name, 180), phone = clean(body.phone, 40);
  if (!name || !phone) throw new Error("Le nom complet et le numéro de téléphone sont obligatoires.");
  return { name, phone };
}

app.get("/api/health", (_req,res) => { db.prepare("SELECT 1").get(); res.json({ ok:true, app:"ASBL-LAS", database:"SQLite" }); });
app.get("/api/public/announcements", (_req,res) => res.json({ announcements: db.prepare("SELECT id,title,body,published_at FROM announcements WHERE published=1 ORDER BY published_at DESC LIMIT 20").all() }));
app.get("/api/public/events", (_req,res) => res.json({ events: db.prepare("SELECT id,title,body,event_date,location FROM events WHERE published=1 ORDER BY event_date LIMIT 30").all() }));

app.post("/api/auth/login", loginLimiter, (req,res) => {
  const username = clean(req.body?.username,180).toLowerCase(), password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!username || !password || password.length > 256) return res.status(401).json({error:"Identifiant ou mot de passe incorrect."});
  const recent = db.prepare("SELECT COUNT(*) n FROM auth_attempts WHERE ip_hash=? AND created_at>? AND success=0").get(ipHash(req),unix()-900).n;
  if (recent >= 5) return res.status(429).json({error:"Trop de tentatives. Réessayez plus tard."});
  const u = db.prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE AND active=1").get(username);
  const ok = !!u && verifyPassword(password,u.password_hash);
  db.prepare("INSERT INTO auth_attempts(ip_hash,username,success,created_at) VALUES(?,?,?,?)").run(ipHash(req),username,ok?1:0,unix());
  if (!ok) return res.status(401).json({error:"Identifiant ou mot de passe incorrect."});
  const token = crypto.randomBytes(32).toString("base64url");
  db.prepare("INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").run(hash(token),u.id,unix()+28800,unix());
  setSessionCookie(res,token); audit(req,u.id,"auth.login","user",u.id);
  res.json({user:userSafe(u)});
});
app.get("/api/auth/me",auth,(req,res)=>res.json({user:req.user}));
app.post("/api/auth/logout",(req,res)=>{
  const token=parseCookies(req)[cookieName];
  if(token){const s=db.prepare("SELECT id,user_id FROM sessions WHERE token_hash=?").get(hash(token));if(s){db.prepare("DELETE FROM sessions WHERE id=?").run(s.id);audit(req,s.user_id,"auth.logout","user",s.user_id);}}
  clearSessionCookie(res);res.json({ok:true});
});

app.get("/api/members",auth,(req,res)=>{
  const q=clean(req.query.q,100).toLowerCase();
  const rows=db.prepare("SELECT id,name,phone,profile_photo_path FROM members WHERE (?='' OR lower(name) LIKE ?) ORDER BY name").all(q,q?"%"+q+"%":"");
  res.json({members:rows.map(m=>({...m,photoUrl:m.profile_photo_path?"/api/members/"+m.id+"/photo":null}))});
});
app.get("/api/members/:id",auth,(req,res)=>{
  const m=db.prepare("SELECT id,name,phone,profile_photo_path FROM members WHERE id=?").get(Number(req.params.id));
  if(!m)return res.status(404).json({error:"Membre introuvable."});
  res.json({member:{...m,photoUrl:m.profile_photo_path?"/api/members/"+m.id+"/photo":null}});
});
app.post("/api/members",auth,allow("admin","secretaire"),(req,res)=>{
  let m;try{m=memberInput(req.body||{});}catch(e){return res.status(400).json({error:e.message});}
  const r=db.prepare("INSERT INTO members(name,phone,created_at,updated_at) VALUES(?,?,?,?)").run(m.name,m.phone,now(),now());
  audit(req,req.user.id,"member.create","member",r.lastInsertRowid);res.status(201).json({id:Number(r.lastInsertRowid)});
});
app.put("/api/members/:id",auth,allow("admin","secretaire"),(req,res)=>{
  let m;try{m=memberInput(req.body||{});}catch(e){return res.status(400).json({error:e.message});}
  const r=db.prepare("UPDATE members SET name=?,phone=?,updated_at=? WHERE id=?").run(m.name,m.phone,now(),Number(req.params.id));
  if(!r.changes)return res.status(404).json({error:"Membre introuvable."});
  audit(req,req.user.id,"member.update","member",req.params.id);res.json({ok:true});
});
app.delete("/api/members/:id",auth,allow("admin"),(req,res)=>{
  const id=Number(req.params.id),m=db.prepare("SELECT profile_photo_path FROM members WHERE id=?").get(id);
  if(!m)return res.status(404).json({error:"Membre introuvable."});
  const r=db.prepare("DELETE FROM members WHERE id=?").run(id);
  if(m.profile_photo_path){const f=path.join(photoDir,path.basename(m.profile_photo_path));if(fs.existsSync(f))fs.unlinkSync(f);}
  audit(req,req.user.id,"member.delete","member",id);res.json({ok:true});
});
app.post("/api/members/:id/photo",auth,allow("admin","secretaire"),photoUpload.single("photo"),(req,res)=>{
  if(!req.file)return res.status(400).json({error:"Sélectionnez une photo JPG, PNG ou WEBP (5 Mo maximum)."});
  if(!fileSignature(req.file,"photo")){fs.unlinkSync(req.file.path);return res.status(400).json({error:"Le fichier envoyé n'est pas une image valide."});}
  const id=Number(req.params.id),m=db.prepare("SELECT profile_photo_path FROM members WHERE id=?").get(id);
  if(!m){fs.unlinkSync(req.file.path);return res.status(404).json({error:"Membre introuvable."});}
  const ext={ "image/jpeg":".jpg","image/png":".png","image/webp":".webp" }[req.file.mimetype];
  const stored=crypto.randomUUID()+ext, destination=path.join(photoDir,stored);
  fs.renameSync(req.file.path,destination);
  if(m.profile_photo_path){const old=path.join(photoDir,path.basename(m.profile_photo_path));if(fs.existsSync(old))fs.unlinkSync(old);}
  db.prepare("UPDATE members SET profile_photo_path=?,updated_at=? WHERE id=?").run(stored,now(),id);
  audit(req,req.user.id,"member.photo.update","member",id);res.json({ok:true,photoUrl:"/api/members/"+id+"/photo"});
});
app.get("/api/members/:id/photo",auth,(req,res)=>{
  const m=db.prepare("SELECT profile_photo_path FROM members WHERE id=?").get(Number(req.params.id));
  if(!m||!m.profile_photo_path)return res.sendStatus(404);
  const file=path.join(photoDir,path.basename(m.profile_photo_path));
  if(!fs.existsSync(file))return res.sendStatus(404);
  res.setHeader("Cache-Control","private, max-age=300");res.sendFile(file);
});

app.get("/api/stats",auth,allow("admin","secretaire","tresorier"),(req,res)=>{
  const year=Math.max(2020,Math.min(2100,Number(req.query.year)||new Date().getFullYear()));
  const total=db.prepare("SELECT COUNT(*) n FROM members").get().n;
  const paid=db.prepare("SELECT COUNT(*) n FROM member_payments WHERE payment_year=? AND paid=1").get(year).n;
  const collected=db.prepare("SELECT COALESCE(SUM(amount),0) n FROM member_payments WHERE payment_year=? AND paid=1").get(year).n;
  res.json({total,paidMonths:paid,collected,year});
});
app.get("/api/payments",auth,allow("admin","tresorier"),(req,res)=>{
  const year=Math.max(2020,Math.min(2100,Number(req.query.year)||new Date().getFullYear()));
  res.json({payments:db.prepare("SELECT member_id,payment_year,payment_month,paid,amount,currency,updated_at FROM member_payments WHERE payment_year=? ORDER BY member_id,payment_month").all(year)});
});
app.put("/api/payments/:memberId/:year/:month",auth,allow("admin","tresorier"),(req,res)=>{
  const id=Number(req.params.memberId),year=Number(req.params.year),month=Number(req.params.month);
  if(!Number.isInteger(id)||year<2020||year>2100||month<1||month>12)return res.status(400).json({error:"Période invalide."});
  if(!db.prepare("SELECT id FROM members WHERE id=?").get(id))return res.status(404).json({error:"Membre introuvable."});
  db.prepare("INSERT INTO member_payments(member_id,payment_year,payment_month,paid,amount,currency,updated_by,updated_at) VALUES(?,?,?,1,10,'USD',?,?) ON CONFLICT(member_id,payment_year,payment_month) DO UPDATE SET paid=1,updated_by=excluded.updated_by,updated_at=excluded.updated_at").run(id,year,month,req.user.username,now());
  audit(req,req.user.id,"payment.paid","member",id);res.json({ok:true});
});
app.delete("/api/payments/:memberId/:year/:month",auth,allow("admin","tresorier"),(req,res)=>{
  db.prepare("DELETE FROM member_payments WHERE member_id=? AND payment_year=? AND payment_month=?").run(Number(req.params.memberId),Number(req.params.year),Number(req.params.month));
  audit(req,req.user.id,"payment.unpaid","member",req.params.memberId);res.json({ok:true});
});

app.get("/api/tontine",auth,(req,res)=>{
  let sql="SELECT t.id,t.member_id,m.name member_name,t.contribution_date,t.amount,t.currency,t.period_label,t.note FROM tontine_contributions t JOIN members m ON m.id=t.member_id";
  const params=[];
  if(req.user.role==="membre"){if(!req.user.memberId)return res.json({contributions:[]});sql+=" WHERE t.member_id=?";params.push(req.user.memberId);}
  res.json({contributions:db.prepare(sql+" ORDER BY t.contribution_date DESC,t.id DESC LIMIT 500").all(...params)});
});
app.post("/api/tontine",auth,allow("admin","tresorier"),(req,res)=>{
  const id=Number(req.body?.memberId),amount=Number(req.body?.amount),date=clean(req.body?.date,10);
  if(!Number.isInteger(id)||!Number.isFinite(amount)||amount<=0||!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:"Contribution invalide."});
  if(!db.prepare("SELECT id FROM members WHERE id=?").get(id))return res.status(404).json({error:"Membre introuvable."});
  const r=db.prepare("INSERT INTO tontine_contributions(member_id,contribution_date,amount,currency,period_label,note,recorded_by,created_at) VALUES(?,?,?,?,?,?,?,?)").run(id,date,amount,clean(req.body.currency,8)||"USD",clean(req.body.period,80)||null,clean(req.body.note,500)||null,req.user.id,now());
  audit(req,req.user.id,"tontine.add","tontine",r.lastInsertRowid);res.status(201).json({id:Number(r.lastInsertRowid)});
});

app.get("/api/documents",auth,(req,res)=>{
  const sql=req.user.role==="admin"?"SELECT id,title,description,original_name,size_bytes,visibility,created_at FROM documents ORDER BY created_at DESC":"SELECT id,title,description,original_name,size_bytes,visibility,created_at FROM documents WHERE visibility='members' ORDER BY created_at DESC";
  res.json({documents:db.prepare(sql).all()});
});
app.post("/api/documents",auth,allow("admin"),docUpload.single("file"),(req,res)=>{
  if(!req.file)return res.status(400).json({error:"Sélectionnez un document autorisé."});
  if(!fileSignature(req.file,"document")){fs.unlinkSync(req.file.path);return res.status(400).json({error:"Fichier invalide."});}
  const stored=crypto.randomUUID()+path.extname(req.file.originalname).toLowerCase();
  fs.renameSync(req.file.path,path.join(documentDir,stored));
  const r=db.prepare("INSERT INTO documents(title,description,original_name,stored_name,mime_type,size_bytes,visibility,uploaded_by,created_at) VALUES(?,?,?,?,?,?,?,?,?)").run(clean(req.body.title,180)||path.basename(req.file.originalname),clean(req.body.description,1000)||null,path.basename(req.file.originalname),stored,req.file.mimetype,req.file.size,req.body.visibility==="admin"?"admin":"members",req.user.id,now());
  audit(req,req.user.id,"document.upload","document",r.lastInsertRowid);res.status(201).json({id:Number(r.lastInsertRowid)});
});
app.get("/api/documents/:id/download",auth,(req,res)=>{
  const d=db.prepare("SELECT * FROM documents WHERE id=?").get(Number(req.params.id));
  if(!d)return res.status(404).json({error:"Document introuvable."});
  if(d.visibility==="admin"&&req.user.role!=="admin")return res.status(403).json({error:"Accès réservé à l'administrateur."});
  const file=path.join(documentDir,path.basename(d.stored_name));if(!fs.existsSync(file))return res.status(404).json({error:"Fichier indisponible."});
  audit(req,req.user.id,"document.download","document",d.id);res.download(file,path.basename(d.original_name));
});
app.delete("/api/documents/:id",auth,allow("admin"),(req,res)=>{
  const d=db.prepare("SELECT * FROM documents WHERE id=?").get(Number(req.params.id));if(!d)return res.status(404).json({error:"Document introuvable."});
  const f=path.join(documentDir,path.basename(d.stored_name));if(fs.existsSync(f))fs.unlinkSync(f);
  db.prepare("DELETE FROM documents WHERE id=?").run(d.id);audit(req,req.user.id,"document.delete","document",d.id);res.json({ok:true});
});

app.get("/api/users",auth,allow("admin"),(_req,res)=>res.json({users:db.prepare("SELECT u.id,u.username,u.display_name,u.role,u.member_id,u.active,m.name member_name FROM users u LEFT JOIN members m ON m.id=u.member_id ORDER BY u.role,u.username").all()}));
app.post("/api/users",auth,allow("admin"),(req,res)=>{
  const username=clean(req.body?.username,180).toLowerCase(),display=clean(req.body?.displayName,180),password=typeof req.body?.password==="string"?req.body.password:"",role=clean(req.body?.role,20),memberId=req.body?.memberId?Number(req.body.memberId):null;
  if(!/^[a-z0-9._@+-]{3,180}$/.test(username)||!display)return res.status(400).json({error:"Identifiant ou nom invalide."});
  if(password.length<12||password.length>256)return res.status(400).json({error:"Le mot de passe doit contenir au moins 12 caractères."});
  if(!roles.includes(role))return res.status(400).json({error:"Rôle invalide."});
  if(memberId&&!db.prepare("SELECT id FROM members WHERE id=?").get(memberId))return res.status(400).json({error:"Membre associé introuvable."});
  if(db.prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE").get(username))return res.status(409).json({error:"Cet identifiant existe déjà."});
  const r=db.prepare("INSERT INTO users(username,display_name,role,member_id,password_hash,created_at) VALUES(?,?,?,?,?,?)").run(username,display,role,memberId,passwordHash(password),now());
  audit(req,req.user.id,"user.create","user",r.lastInsertRowid);res.status(201).json({id:Number(r.lastInsertRowid)});
});
app.patch("/api/users/:id",auth,allow("admin"),(req,res)=>{
  const id=Number(req.params.id),active=!!req.body?.active;
  if(id===req.user.id&&!active)return res.status(400).json({error:"Vous ne pouvez pas désactiver votre propre compte."});
  const target=db.prepare("SELECT id,role,active FROM users WHERE id=?").get(id);if(!target)return res.status(404).json({error:"Compte introuvable."});
  if(target.role==="admin"&&target.active&&!active&&db.prepare("SELECT COUNT(*) n FROM users WHERE role='admin' AND active=1").get().n<=1)return res.status(400).json({error:"Impossible de désactiver le dernier administrateur."});
  db.prepare("UPDATE users SET active=? WHERE id=?").run(active?1:0,id);if(!active)db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
  audit(req,req.user.id,active?"user.activate":"user.deactivate","user",id);res.json({ok:true});
});

app.post("/api/admin/announcements",auth,allow("admin","secretaire"),(req,res)=>{
  const title=clean(req.body?.title,180),body=clean(req.body?.body,5000);if(!title||!body)return res.status(400).json({error:"Titre et contenu requis."});
  const r=db.prepare("INSERT INTO announcements(title,body,published,published_at) VALUES(?,?,1,?)").run(title,body,now());audit(req,req.user.id,"announcement.publish","announcement",r.lastInsertRowid);res.status(201).json({id:Number(r.lastInsertRowid)});
});
app.post("/api/admin/events",auth,allow("admin","secretaire"),(req,res)=>{
  const title=clean(req.body?.title,180),date=clean(req.body?.date,10),body=clean(req.body?.body,3000),location=clean(req.body?.location,180);
  if(!title||!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:"Titre et date requis."});
  const r=db.prepare("INSERT INTO events(title,body,event_date,location,published) VALUES(?,?,?,?,1)").run(title,body||null,date,location||null);audit(req,req.user.id,"event.publish","event",r.lastInsertRowid);res.status(201).json({id:Number(r.lastInsertRowid)});
});

app.use(express.static(path.join(root,"public"),{index:"index.html",dotfiles:"deny",fallthrough:true,maxAge:process.env.NODE_ENV==="production"?"1h":0}));
app.get("*",(req,res)=>res.sendFile(path.join(root,"public","index.html")));
app.use((err,_req,res,_next)=>{
  if(err instanceof multer.MulterError)return res.status(400).json({error:err.code==="LIMIT_FILE_SIZE"?"Fichier trop volumineux.": "Erreur d'envoi du fichier."});
  res.status(400).json({error:err.message||"Requête invalide."});
});
const port=Number(process.env.PORT||3000);
app.listen(port,"0.0.0.0",()=>console.log("ASBL-LAS Node.js + SQLite écoute sur le port "+port));
