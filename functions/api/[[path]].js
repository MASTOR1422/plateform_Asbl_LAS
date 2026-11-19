const COOKIE = "__Host-las_session";
const SESSION_SECONDS = 8 * 60 * 60;
const ROLES = new Set(["admin", "secretaire", "tresorier", "membre"]);
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store",...extra}});
const fail = (message,status=400) => json({error:message},status);
const now = () => Math.floor(Date.now()/1000);
const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const fromB64 = value => Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
async function digest(value){return b64(await crypto.subtle.digest("SHA-256",typeof value==="string"?enc.encode(value):value));}
async function pbkdf2(password,salt,iterations){
 const material=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
 return b64(await crypto.subtle.deriveBits({name:"PBKDF2",salt:fromB64(salt),iterations,hash:"SHA-256"},material,256));
}
function same(a,b){if(typeof a!=="string"||typeof b!=="string"||a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0;}
function cookieValue(request,name){const raw=request.headers.get("cookie")||"";const pair=raw.split(";").map(v=>v.trim()).find(v=>v.startsWith(name+"="));return pair?decodeURIComponent(pair.slice(name.length+1)):"";}
function cookie(token,maxAge=SESSION_SECONDS){return COOKIE+"="+encodeURIComponent(token)+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+maxAge;}
function ip(request){return request.headers.get("CF-Connecting-IP")||"unknown";}
async function ipHash(request){return digest(ip(request));}
function safeUser(row){return{id:row.id,username:row.username,displayName:row.display_name,role:row.role,memberId:row.member_id,active:!!row.active};}
async function audit(db,userId,action,targetType,targetId,ipDigest){return db.prepare("INSERT INTO audit_log (user_id,action,target_type,target_id,ip_hash,created_at) VALUES (?,?,?,?,?,?)").bind(userId??null,action,targetType??null,targetId==null?null:String(targetId),ipDigest??null,new Date().toISOString()).run();}
async function auth(request,env){
 const token=cookieValue(request,COOKIE);if(!token||token.length<32)return null;
 const tokenHash=await digest(token);
 const row=await env.DB.prepare("SELECT s.id AS session_id,s.expires_at,u.id,u.username,u.display_name,u.role,u.member_id,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?").bind(tokenHash).first();
 if(!row||!row.active||row.expires_at<=now()){if(row)await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(row.session_id).run();return null;}
 return{...safeUser(row),sessionId:row.session_id};
}
function validOrigin(request){const origin=request.headers.get("Origin");if(origin&&origin!==new URL(request.url).origin)return false;if((request.headers.get("Sec-Fetch-Site")||"").toLowerCase()==="cross-site")return false;return true;}
async function body(request){const type=request.headers.get("content-type")||"";if(!type.toLowerCase().includes("application/json"))throw new Error("Format JSON requis.");const value=await request.json();if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Corps de requête invalide.");return value;}
const str=(v,max=180)=>typeof v==="string"?v.trim().slice(0,max):"";
const nullable=(v,max=180)=>str(v,max)||null;
function memberInput(data){const name=str(data.name,180);if(!name)throw new Error("Le nom du membre est obligatoire.");return{name,poste:nullable(data.poste,120),profession:nullable(data.profession,160),phone:nullable(data.phone,50),email:nullable(data.email,180),birthdate:nullable(data.birthdate,20),birthplace:nullable(data.birthplace,120),address:nullable(data.address,240),joined:nullable(data.joined,20),asbl:data.asbl==="NON"?"NON":"OUI",forum:data.forum==="Inactif"?"Inactif":"Actif"};}
async function listMembers(env,user,url){
 const q=str(url.searchParams.get("q"),100).toLowerCase(),asbl=url.searchParams.get("asbl"),args=[];
 let sql="SELECT id,name,poste,profession,asbl,forum";
 if(user.role!=="membre")sql+=",phone,email,birthdate,birthplace,address,joined";
 sql+=" FROM members WHERE 1=1";
 if(user.role==="membre"){if(!user.memberId)return[];sql+=" AND id=?";args.push(user.memberId);}
 if(asbl==="OUI"||asbl==="NON"){sql+=" AND asbl=?";args.push(asbl);}
 if(q){sql+=" AND (LOWER(name) LIKE ? OR LOWER(COALESCE(poste,'')) LIKE ? OR LOWER(COALESCE(profession,'')) LIKE ?)";const term="%"+q+"%";args.push(term,term,term);}
 sql+=" ORDER BY name";const result=await env.DB.prepare(sql).bind(...args).all();return result.results||[];
}
async function route(request,env){
 if(!env.DB)return fail("Base D1 non configurée (binding DB).",503);
 if(!validOrigin(request))return fail("Origine de requête refusée.",403);
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,""),method=request.method.toUpperCase();
 if(path==="/api/health"&&method==="GET"){const row=await env.DB.prepare("SELECT 1 AS ok").first();return json({ok:row?.ok===1,service:"LAS API"});}
 if(path==="/api/auth/login"&&method==="POST"){
  let data;try{data=await body(request);}catch(e){return fail(e.message);}
  const username=str(data.username,180).toLowerCase(),password=typeof data.password==="string"?data.password:"";
  if(!username||!password||password.length>256)return fail("Identifiant ou mot de passe invalide.",401);
  const ipDigest=await ipHash(request),since=now()-900;
  const attempts=await env.DB.prepare("SELECT COUNT(*) AS n FROM auth_attempts WHERE ip_hash=? AND created_at>=? AND success=0").bind(ipDigest,since).first();
  if((attempts?.n||0)>=5)return fail("Trop de tentatives. Réessayez dans 15 minutes.",429);
  const user=await env.DB.prepare("SELECT * FROM users WHERE username=? COLLATE NOCASE AND active=1").bind(username).first();
  let valid=false;
  if(user&&user.salt&&user.password_hash&&Number(user.iterations)>=100000&&Number(user.iterations)<=1000000){try{valid=same(await pbkdf2(password,user.salt,Number(user.iterations)),user.password_hash);}catch(_){}}
  await env.DB.prepare("INSERT INTO auth_attempts (ip_hash,username,success,created_at) VALUES (?,?,?,?)").bind(ipDigest,username,valid?1:0,now()).run();
  if(!valid)return fail("Identifiant ou mot de passe incorrect.",401);
  const token=b64(crypto.getRandomValues(new Uint8Array(32))),tokenHash=await digest(token),expiry=now()+SESSION_SECONDS;
  await env.DB.prepare("INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)").bind(tokenHash,user.id,expiry,now()).run();
  await audit(env.DB,user.id,"auth.login","user",user.id,ipDigest);
  return json({user:safeUser(user)},200,{"set-cookie":cookie(token)});
 }
 if(path==="/api/auth/logout"&&method==="POST"){
  const user=await auth(request,env);if(user){await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(user.sessionId).run();await audit(env.DB,user.id,"auth.logout","user",user.id,await ipHash(request));}
  return json({ok:true},200,{"set-cookie":cookie("",0)});
 }
 const user=await auth(request,env);
 if(path==="/api/auth/me"&&method==="GET")return user?json({user}):fail("Session expirée. Veuillez vous reconnecter.",401);
 if(!user)return fail("Authentification requise.",401);

 if(path==="/api/members"&&method==="GET"){
  const members=await listMembers(env,user,url),year=Number(url.searchParams.get("year"))||new Date().getFullYear();
  const canPayments=["admin","tresorier"].includes(user.role);
  const payments=canPayments?await env.DB.prepare("SELECT member_id,COUNT(*) AS paid FROM member_payments WHERE payment_year=? AND paid=1 GROUP BY member_id").bind(year).all():{results:[]};
  const paidMap=Object.fromEntries((payments.results||[]).map(p=>[p.member_id,p.paid]));
  return json({members:members.map(m=>({...m,paidMonths:paidMap[m.id]||0}))});
 }
 if(path==="/api/stats"&&method==="GET"){
  if(!["admin","secretaire","tresorier"].includes(user.role))return fail("Accès refusé.",403);
  const year=Number(url.searchParams.get("year"))||new Date().getFullYear();
  const total=await env.DB.prepare("SELECT COUNT(*) AS n FROM members").first(),active=await env.DB.prepare("SELECT COUNT(*) AS n FROM members WHERE asbl='OUI'").first(),paid=await env.DB.prepare("SELECT COUNT(DISTINCT member_id) AS n,COUNT(*) AS months FROM member_payments WHERE payment_year=? AND paid=1").bind(year).first();
  return json({total:total.n,active:active.n,upToDate:paid.months>=total.n*12?total.n:0,paidMonths:paid.months,collected:paid.months*10,expected:total.n*120,year});
 }
 const memberMatch=path.match(/^\/api\/members\/(\d+)$/);
 if(memberMatch&&method==="GET"){
  const id=Number(memberMatch[1]);if(user.role==="membre"&&user.memberId!==id)return fail("Accès refusé.",403);
  const m=await env.DB.prepare("SELECT * FROM members WHERE id=?").bind(id).first();if(!m)return fail("Membre introuvable.",404);
  if(user.role==="membre"){delete m.phone;delete m.email;delete m.address;delete m.birthdate;delete m.birthplace;}
  return json({member:m});
 }
 if(memberMatch&&method==="PUT"){
  if(!["admin","secretaire"].includes(user.role))return fail("Accès refusé.",403);
  let d;try{d=memberInput(await body(request));}catch(e){return fail(e.message);}const id=Number(memberMatch[1]);
  const r=await env.DB.prepare("UPDATE members SET name=?,poste=?,profession=?,phone=?,email=?,birthdate=?,birthplace=?,address=?,joined=?,asbl=?,forum=?,updated_at=? WHERE id=?").bind(d.name,d.poste,d.profession,d.phone,d.email,d.birthdate,d.birthplace,d.address,d.joined,d.asbl,d.forum,new Date().toISOString(),id).run();
  if(!r.meta.changes)return fail("Membre introuvable.",404);await audit(env.DB,user.id,"member.update","member",id,await ipHash(request));return json({ok:true});
 }
 if(memberMatch&&method==="DELETE"){
  if(user.role!=="admin")return fail("Accès refusé.",403);const id=Number(memberMatch[1]);await env.DB.prepare("DELETE FROM members WHERE id=?").bind(id).run();await audit(env.DB,user.id,"member.delete","member",id,await ipHash(request));return json({ok:true});
 }
 if(path==="/api/members"&&method==="POST"){
  if(!["admin","secretaire"].includes(user.role))return fail("Accès refusé.",403);let d;try{d=memberInput(await body(request));}catch(e){return fail(e.message);}
  const r=await env.DB.prepare("INSERT INTO members (name,poste,profession,phone,email,birthdate,birthplace,address,joined,asbl,forum,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(d.name,d.poste,d.profession,d.phone,d.email,d.birthdate,d.birthplace,d.address,d.joined,d.asbl,d.forum,new Date().toISOString(),new Date().toISOString()).run();
  await audit(env.DB,user.id,"member.create","member",r.meta.last_row_id,await ipHash(request));return json({id:r.meta.last_row_id},201);
 }
 if(path==="/api/payments"&&method==="GET"){
  if(!["admin","tresorier"].includes(user.role))return fail("Accès refusé.",403);const year=Number(url.searchParams.get("year"))||new Date().getFullYear();
  const r=await env.DB.prepare("SELECT member_id,payment_month,paid,updated_by,updated_at FROM member_payments WHERE payment_year=? ORDER BY member_id,payment_month").bind(year).all();return json({payments:r.results||[]});
 }
 const paymentMatch=path.match(/^\/api\/payments\/(\d+)\/(\d+)\/(\d+)$/);
 if(paymentMatch&&(method==="PUT"||method==="DELETE")){
  if(!["admin","tresorier"].includes(user.role))return fail("Accès refusé.",403);const [memberId,year,month]=paymentMatch.slice(1).map(Number);
  if(month<1||month>12||year<2020||year>2100)return fail("Période invalide.");const m=await env.DB.prepare("SELECT id FROM members WHERE id=?").bind(memberId).first();if(!m)return fail("Membre introuvable.",404);
  if(method==="PUT")await env.DB.prepare("INSERT INTO member_payments (member_id,payment_year,payment_month,paid,updated_by,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(member_id,payment_year,payment_month) DO UPDATE SET paid=1,updated_by=excluded.updated_by,updated_at=excluded.updated_at").bind(memberId,year,month,1,user.username,new Date().toISOString()).run();
  else await env.DB.prepare("DELETE FROM member_payments WHERE member_id=? AND payment_year=? AND payment_month=?").bind(memberId,year,month).run();
  await audit(env.DB,user.id,method==="PUT"?"payment.mark_paid":"payment.unmark_paid","member",memberId,await ipHash(request));return json({ok:true});
 }
 if(path==="/api/users"&&method==="GET"){
  if(user.role!=="admin")return fail("Accès refusé.",403);const r=await env.DB.prepare("SELECT u.id,u.username,u.display_name,u.role,u.member_id,u.active,m.name AS member_name FROM users u LEFT JOIN members m ON m.id=u.member_id ORDER BY u.role,u.username").all();return json({users:r.results||[]});
 }
 if(path==="/api/users"&&method==="POST"){
  if(user.role!=="admin")return fail("Accès refusé.",403);let d;try{d=await body(request);}catch(e){return fail(e.message);}
  const username=str(d.username,180).toLowerCase(),displayName=str(d.displayName,180),password=typeof d.password==="string"?d.password:"",role=str(d.role,20),memberId=d.memberId?Number(d.memberId):null;
  if(!username||!/^[a-z0-9._@+-]{3,180}$/.test(username)||!displayName)return fail("Identifiant ou nom invalide.");
  if(password.length<12||password.length>256)return fail("Le mot de passe doit contenir au moins 12 caractères.");
  if(!ROLES.has(role))return fail("Rôle invalide.");if(memberId&&!await env.DB.prepare("SELECT id FROM members WHERE id=?").bind(memberId).first())return fail("Membre associé introuvable.");
  if(await env.DB.prepare("SELECT id FROM users WHERE username=? COLLATE NOCASE").bind(username).first())return fail("Cet identifiant existe déjà.",409);
  const salt=b64(crypto.getRandomValues(new Uint8Array(16))),iterations=210000,hash=await pbkdf2(password,salt,iterations);
  const r=await env.DB.prepare("INSERT INTO users (username,display_name,role,member_id,salt,password_hash,iterations,active,created_at) VALUES (?,?,?,?,?,?,?,?,?)").bind(username,displayName,role,memberId,salt,hash,iterations,1,new Date().toISOString()).run();
  await audit(env.DB,user.id,"user.create","user",r.meta.last_row_id,await ipHash(request));return json({id:r.meta.last_row_id},201);
 }
 const userMatch=path.match(/^\/api\/users\/(\d+)$/);
 if(userMatch&&method==="PATCH"){
  if(user.role!=="admin")return fail("Accès refusé.",403);const id=Number(userMatch[1]);if(id===user.id)return fail("Vous ne pouvez pas désactiver votre propre compte.");
  let d;try{d=await body(request);}catch(e){return fail(e.message);}if(typeof d.active!=="boolean")return fail("État de compte invalide.");
  if(!d.active){const target=await env.DB.prepare("SELECT role,active FROM users WHERE id=?").bind(id).first();if(!target)return fail("Utilisateur introuvable.",404);if(target.role==="admin"&&target.active){const n=await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin' AND active=1").first();if(n.n<=1)return fail("Impossible de désactiver le dernier administrateur.");}}
  await env.DB.prepare("UPDATE users SET active=? WHERE id=?").bind(d.active?1:0,id).run();if(!d.active)await env.DB.prepare("DELETE FROM sessions WHERE user_id=?").bind(id).run();
  await audit(env.DB,user.id,d.active?"user.activate":"user.deactivate","user",id,await ipHash(request));return json({ok:true});
 }
 if(path==="/api/audit"&&method==="GET"){
  if(user.role!=="admin")return fail("Accès refusé.",403);const r=await env.DB.prepare("SELECT a.id,a.action,a.target_type,a.target_id,a.created_at,u.username FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 100").all();return json({events:r.results||[]});
 }
 return fail("Ressource introuvable.",404);
}
export async function onRequest({request,env}){
 try{
  const response=await route(request,env),headers=new Headers(response.headers);
  headers.set("x-content-type-options","nosniff");headers.set("referrer-policy","strict-origin-when-cross-origin");headers.set("permissions-policy","camera=(), microphone=(), geolocation=()");
  headers.set("content-security-policy","default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self';");
  return new Response(response.body,{status:response.status,headers});
 }catch(_){return fail("Erreur interne du serveur. Contactez l'administrateur.",500);}
}
