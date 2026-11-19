"use strict";
require("dotenv").config();
const crypto=require("node:crypto"),path=require("node:path"),Database=require("better-sqlite3"),root=path.resolve(__dirname,"..");
const dbPath=path.resolve(process.env.LAS_DB_PATH||path.join(process.env.LAS_DATA_DIR||path.join(root,"data"),"las.sqlite"));
const [raw,display,password]=process.argv.slice(2),username=String(raw||"").trim().toLowerCase();
if(!/^[a-z0-9._@+-]{3,180}$/.test(username)||!String(display||"").trim()||!password||password.length<12){console.error('Usage: npm run admin:create -- identifiant "Nom affiché" "MotDePasseLong12+"');process.exit(1)}
const db=new Database(dbPath);try{const salt=crypto.randomBytes(16),derived=crypto.scryptSync(password,salt,64),hash="scrypt$"+salt.toString("base64url")+"$"+derived.toString("base64url");const r=db.prepare("INSERT INTO users(username,display_name,role,password_hash,created_at) VALUES(?,?,'admin',?,?)").run(username,display,hash,new Date().toISOString());console.log("Compte administrateur créé. ID :",Number(r.lastInsertRowid))}catch(e){console.error("Échec :",e.message);process.exitCode=1}finally{db.close()}
