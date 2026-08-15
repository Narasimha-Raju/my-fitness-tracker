(function(){
"use strict";
const c=window.SUPABASE_CONFIG||{};
const configured=!!(c.url&&c.anonKey&&!String(c.url).includes("YOUR_PROJECT")&&!String(c.anonKey).includes("YOUR_SUPABASE"));
let client=null;
if(configured&&window.supabase?.createClient){
  client=window.supabase.createClient(c.url,c.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}
const localKey=(kind,date)=>`fitness-local-${kind}-${date}`;
async function session(){if(!client)return null;const {data}=await client.auth.getSession();return data.session||null}
async function signIn(email,password){const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;return data}
async function signUp(email,password){const {data,error}=await client.auth.signUp({email,password});if(error)throw error;return data}
async function signOut(){if(!client)return;const {error}=await client.auth.signOut();if(error)throw error}
async function saveLog(kind,date,payload){
  const clean=JSON.parse(JSON.stringify(payload));localStorage.setItem(localKey(kind,date),JSON.stringify(clean));
  const s=await session();if(!s)return false;const table=kind==="diet"?"diet_logs":"workout_logs";
  const {error}=await client.from(table).upsert({user_id:s.user.id,log_date:date,data:clean,updated_at:new Date().toISOString()},{onConflict:"user_id,log_date"});
  if(error)throw error;return true;
}
async function loadLog(kind,date){
  const local=localStorage.getItem(localKey(kind,date));let localData=local?JSON.parse(local):null;const s=await session();if(!s)return localData;
  const table=kind==="diet"?"diet_logs":"workout_logs";const {data,error}=await client.from(table).select("data").eq("log_date",date).maybeSingle();
  if(error)throw error;if(data?.data){localStorage.setItem(localKey(kind,date),JSON.stringify(data.data));return data.data}return localData
}
async function loadRange(kind,start,end){
  const s=await session();
  if(!s){const out={};for(let d=start;d<=end;d=FitnessUtil.addDays(d,1)){const x=localStorage.getItem(localKey(kind,d));if(x)out[d]=JSON.parse(x)}return out}
  const table=kind==="diet"?"diet_logs":"workout_logs";const {data,error}=await client.from(table).select("log_date,data").gte("log_date",start).lte("log_date",end).order("log_date");
  if(error)throw error;const out={};(data||[]).forEach(r=>{out[r.log_date]=r.data;localStorage.setItem(localKey(kind,r.log_date),JSON.stringify(r.data))});return out
}
async function loadAppData(){
  const s=await session();if(!s){const x=localStorage.getItem("fitness-local-app-data");return x?JSON.parse(x):{}}
  const {data,error}=await client.from("user_app_data").select("data").eq("user_id",s.user.id).maybeSingle();if(error)throw error;return data?.data||{}
}
async function saveAppData(payload){
  const clean=JSON.parse(JSON.stringify(payload));localStorage.setItem("fitness-local-app-data",JSON.stringify(clean));const s=await session();if(!s)return false;
  const {error}=await client.from("user_app_data").upsert({user_id:s.user.id,data:clean,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)throw error;return true
}
async function migrateOldLocalData(){
  let count=0;
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);if(!k)continue;
    let kind=null,date=null;
    if(k.startsWith("fatloss-tracker-v3-")){kind="diet";date=k.replace("fatloss-tracker-v3-","")}
    else if(k.startsWith("fatloss-tracker-")){kind="diet";date=k.replace("fatloss-tracker-","")}
    else if(k.startsWith("workout-tracker-v2-")){kind="workout";date=k.replace("workout-tracker-v2-","")}
    else continue;
    try{const d=JSON.parse(localStorage.getItem(k));await saveLog(kind,date,d);count++}catch(_){}
  }return count
}
window.FitnessCloud={configured,isConfigured:()=>configured,session,signIn,signUp,signOut,saveLog,loadLog,loadRange,loadAppData,saveAppData,migrateOldLocalData};
})();