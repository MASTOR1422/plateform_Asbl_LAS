"use strict";
const fs=require("node:fs"),path=require("node:path"),Database=require("better-sqlite3");
const root=path.resolve(__dirname,".."),dataDir=path.resolve(process.env.LAS_DATA_DIR||path.join(root,"data")),dbPath=path.resolve(process.env.LAS_DB_PATH||path.join(dataDir,"las.sqlite"));
fs.mkdirSync(dataDir,{recursive:true,mode:0o700});const db=new Database(dbPath);db.pragma("journal_mode=WAL");db.pragma("foreign_keys=ON");
db.exec(fs.readFileSync(path.join(root,"db/schema.sql"),"utf8"));const seed=path.join(root,"db/seed-members-from-las-list.sql");if(fs.existsSync(seed))db.exec(fs.readFileSync(seed,"utf8"));
console.log("SQLite initialisée :",dbPath,"— Membres :",db.prepare("SELECT COUNT(*) n FROM members").get().n);
console.log("Aucun mot de passe par défaut. Créez le premier administrateur avec npm run admin:create -- identifiant \"Nom affiché\" \"MotDePasseLong12+\".");db.close();
