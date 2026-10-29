import { API_URL } from "../config";
import { uid } from "./utils";

function parseJsonText(text) {
  const clean = String(text || "").trim();
  if (!clean) throw new Error("A API retornou uma resposta vazia.");
  return JSON.parse(clean);
}

const SESSION_KEY = "amvf2_session";

export function getSession(){ try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null"); } catch { return null; } }
export function setSession(session){ if(session) sessionStorage.setItem(SESSION_KEY,JSON.stringify(session)); else sessionStorage.removeItem(SESSION_KEY); }
export function clearSession(){ sessionStorage.removeItem(SESSION_KEY); }
export function hasPermission(permission){ return !!getSession()?.permissions?.includes(permission); }

export async function login(username,password){
  const r=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action:"login",username,password}),cache:"no-store"});
  const text=await r.text(); const j=parseJsonText(text); if(!j.ok) throw Error(j.error||"Falha no login.");
  setSession(j.data); return j.data;
}

export async function logout(){
  const s=getSession();
  try { if(s?.token) await req({action:"logout",token:s.token}); } catch(_) {}
  clearSession();
}

async function getAllRaw() {
  const session=getSession();
  if(!session?.token) throw Error("Sessão não iniciada.");
  const url = API_URL + (API_URL.includes("?") ? "&" : "?") + "action=read&token=" + encodeURIComponent(session.token) + "&t=" + Date.now();
  const r = await fetch(url, {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
  });
  const text = await r.text();
  let j;
  try {
    j = parseJsonText(text);
  } catch (_) {
    const preview = String(text || "").trim().slice(0, 160).replace(/\s+/g, " ");
    throw new Error(`A API de leitura retornou conteúdo que não é JSON: ${preview}`);
  }
  if (!j.ok) { if(/sessão|login/i.test(String(j.error||""))) clearSession(); throw Error(j.error || "Erro na API."); }
  return j.data;
}

export async function getAll() {
  return getAllRaw();
}

function looksLikeGoogleHtml(text) {
  const s = String(text || "").trim().toLowerCase();
  return s.startsWith("<!doctype html") || s.startsWith("<html") || s.includes("window['ppconfig']") || s.includes("window[\"ppconfig\"]");
}

function writeAcceptedFallback(p) {
  // O Apps Script pode executar o POST com sucesso e, por causa do redirecionamento
  // do ContentService, entregar ao navegador uma página HTML/404 em vez do JSON.
  // Nesse cenário a alteração já foi enviada; o app atualiza a UI localmente e
  // faz uma sincronização silenciosa em segundo plano.
  return {
    __writeAccepted: true,
    entity: p.entity || "",
    action: p.action || "",
    id: p.id || p.data?.id || "",
    data: p.data || {},
  };
}

async function req(p) {
  const session=getSession();
  const payload={...p,token:p.token||session?.token};
  const r = await fetch(API_URL, {
    method: "POST",
    cache: "no-store",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const text = await r.text();

  try {
    const j = parseJsonText(text);
    if (!j.ok) { if(/sessão|login/i.test(String(j.error||""))) clearSession(); throw Error(j.error || "Erro na API."); }
    return j.data;
  } catch (postError) {
    if (looksLikeGoogleHtml(text)) return writeAcceptedFallback(p);
    throw postError;
  }
}

export const create = (entity, data) =>
  req({ entity, action: "create", data: { ...data, id: data.id || uid() } });

export const update = (entity, id, data) =>
  req({ entity, action: "update", id, data });

export const remove = (entity, id) =>
  req({ entity, action: "delete", id });

export const saveSettings = settings =>
  req({ entity: "Settings", action: "saveSettings", data: settings });

export const togglePayment = (residentId, month, paid, method = "", date = "", amount = "") =>
  req({
    entity: "Residents",
    action: "togglePayment",
    id: residentId,
    data: { month, paid, method, date, amount },
  });

export async function restoreBackup(data) {
  const result = await req({ action: "restoreBackup", data });
  if (result && result.__writeAccepted) {
    // A gravação pode ser aceita pelo Apps Script enquanto o ContentService
    // devolve HTML ao navegador. Para restauração, confirme lendo novamente
    // a API antes de informar sucesso.
    await new Promise(resolve => setTimeout(resolve, 350));
    return await getAllRaw();
  }
  return result;
}

export async function usersList(){ return req({action:"users",subaction:"list"}); }
export async function usersCreate(data){ return req({action:"users",subaction:"create",data}); }
export async function usersUpdate(id,data){ return req({action:"users",subaction:"update",id,data}); }
export async function usersDelete(id){ return req({action:"users",subaction:"delete",id}); }
export async function changePassword(currentPassword,newPassword){ return req({action:"changePassword",currentPassword,newPassword}); }
