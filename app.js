const KEY="fittrack_entries_v2", SETTINGS="fittrack_settings_v2";
let entries=[], settings={cal:2000,water:2.5,exercise:30,weightGoal:null};
let deferredInstallPrompt=null;

const $=id=>document.getElementById(id);

function pad(n){return String(n).padStart(2,"0")}
function localDate(d=new Date()){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function parseDate(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12)}
function fmtDate(s){return parseDate(s).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function num(id){const v=parseFloat($(id).value);return Number.isFinite(v)?v:null}
function existing(date){return entries.find(x=>x.date===date)}
function hasAnyData(x){return !!x && ["weight","calories","breakfast","lunch","dinner","water","exercise","sleep","mood","notes","photo"].some(k=>x[k]!==null&&x[k]!==undefined&&x[k]!=="" )}
function load(){
  try{entries=JSON.parse(localStorage.getItem(KEY)||"[]")}catch{entries=[]}
  try{settings={...settings,...JSON.parse(localStorage.getItem(SETTINGS)||"{}")}}catch{}
  // Older versions used -0.3 as a weekly-change goal. Treat that as unset
  // instead of displaying it as a target body weight.
  if(typeof settings.weightGoal==="number" && (settings.weightGoal<20||settings.weightGoal>300)) settings.weightGoal=null;
}
function save(){localStorage.setItem(KEY,JSON.stringify(entries))}
function toast(t){const x=$("toast");x.textContent=t;x.classList.add("show");clearTimeout(window.__toast);window.__toast=setTimeout(()=>x.classList.remove("show"),2200)}

function showPage(id){
  document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===id));
  document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===id));
  if(id==="dashboard")renderDashboard();
  if(id==="reports")renderReport();
  if(id==="photosPage")renderPhotos();
  if(id==="history")renderHistory();
  if(id==="settings")renderSettings();
  window.scrollTo({top:0,behavior:"smooth"});
}

function init(){
  load();
  $("todayText").textContent=new Date().toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"});
  $("date").value=localDate();
  $("entryForm").addEventListener("submit",saveEntry);
  $("date").addEventListener("change",()=>loadDateIntoForm($("date").value));
  $("photo").addEventListener("change",previewPhoto);
  ["breakfast","lunch","dinner"].forEach(id=>$(id).addEventListener("input",updateMealTotal));
  if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
  window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;$("installBanner").classList.add("show")});
  window.addEventListener("appinstalled",()=>{$("installBanner").classList.remove("show");deferredInstallPrompt=null;toast("FitTrack installed ✓")});
  renderDashboard();renderSettings();
}

function recent7(){
  const out=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const s=localDate(d);out.push(existing(s)||{date:s})}
  return out;
}
function streak(){
  let n=0,d=new Date();
  while(true){
    const e=existing(localDate(d));
    if(!hasAnyData(e))break;
    n++;d.setDate(d.getDate()-1);
  }
  return n;
}
function avg(field,data=recent7()){
  const a=data.map(x=>x[field]).filter(v=>Number.isFinite(v));
  return a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
}

function renderDashboard(){
  const today=localDate(), t=existing(today)||{};
  $("heroWeight").textContent=t.weight!=null?`${t.weight.toFixed(1)} kg`:"—";
  $("heroCal").textContent=t.calories!=null?`${Math.round(t.calories)} kcal`:"—";
  $("heroWater").textContent=t.water!=null?`${t.water.toFixed(1)} L`:"—";
  $("heroExercise").textContent=t.exercise!=null?`${Math.round(t.exercise)} min`:"—";
  const st=streak();
  $("streakBadge").textContent=`${st} day${st===1?"":"s"} streak`;
  $("heroTitle").textContent=st>=7?"Excellent consistency.":st>=3?"Nice momentum — keep it going.":hasAnyData(t)?"Good work. Check-in saved.":"Ready for your check-in?";
  renderTargets(t);
  const d=recent7(), w=d.filter(x=>Number.isFinite(x.weight)).map(x=>x.weight);
  if(w.length>=2){
    const delta=w[w.length-1]-w[0];
    $("trendText").textContent=`${delta>0?"+":""}${delta.toFixed(1)} kg over 7 days`;
  }else $("trendText").textContent="Add 2+ weight entries";
  drawChart($("chart"),d.map(x=>x.weight),d.map(x=>x.date));
  loadDateIntoForm($("date").value||today);
}

function renderTargets(t){
  const tracked=["weight","calories","water","exercise"].filter(k=>Number.isFinite(t[k])).length;
  $("completionText").textContent=`${tracked}/4 tracked`;
  const calPct=t.calories!=null&&settings.cal?Math.min(100,t.calories/settings.cal*100):0;
  const waterPct=t.water!=null&&settings.water?Math.min(100,t.water/settings.water*100):0;
  const exerciseTarget=settings.exercise||30;
  const exercisePct=t.exercise!=null?Math.min(100,t.exercise/exerciseTarget*100):0;
  $("calProgress").style.width=`${calPct}%`;
  $("waterProgress").style.width=`${waterPct}%`;
  $("exerciseProgress").style.width=`${exercisePct}%`;
  $("calProgressText").textContent=t.calories!=null?`${Math.round(t.calories)} / ${Math.round(settings.cal)} kcal`:"Not logged";
  $("waterProgressText").textContent=t.water!=null?`${t.water.toFixed(1)} / ${settings.water.toFixed(1)} L`:"Not logged";
  $("exerciseProgressText").textContent=t.exercise!=null?`${Math.round(t.exercise)} / ${Math.round(exerciseTarget)} min`:"Not logged";
}

function loadDateIntoForm(date){
  if(!date)return;
  const t=existing(date)||{};
  $("date").value=date;
  $("weight").value=t.weight??"";
  $("calories").value=t.calories??"";
  $("breakfast").value=t.breakfast??"";
  $("lunch").value=t.lunch??"";
  $("dinner").value=t.dinner??"";
  $("water").value=t.water??"";
  $("exercise").value=t.exercise??"";
  $("sleep").value=t.sleep??"";
  $("mood").value=t.mood??"";
  $("notes").value=t.notes??"";
  $("photo").value="";
  if(t.photo){$("preview").src=t.photo;$("preview").classList.remove("hidden")}else{$("preview").src="";$("preview").classList.add("hidden")}
  const isToday=date===localDate();
  $("editBadge").textContent=isToday?"Today":fmtDate(date);
  $("saveBtn").textContent=existing(date)?"Update check-in":"Save check-in";
  $("deleteBtn").classList.toggle("hidden",!existing(date));
}
function clearForm(){
  $("date").value=localDate();
  loadDateIntoForm($("date").value);
  $("weight").focus();
}
function previewPhoto(e){
  const f=e.target.files[0];
  if(!f)return;
  if(f.size>12*1024*1024){toast("Photo is too large. Choose one under 12 MB.");$("photo").value="";return}
  const r=new FileReader();
  r.onload=()=>{$("preview").src=r.result;$("preview").classList.remove("hidden")};
  r.readAsDataURL(f);
}
function updateMealTotal(){
  const mealValues=[num("breakfast"),num("lunch"),num("dinner")].filter(Number.isFinite);
  if(mealValues.length)$('calories').value=mealValues.reduce((sum,value)=>sum+value,0);
}

async function saveEntry(e){
  e.preventDefault();
  const date=$("date").value;
  if(!date){toast("Choose a date first");return}
  const old=existing(date);
  let photoData=old?.photo||null;
  const file=$("photo").files[0];
  if(file)photoData=await compressImage(file,1000,.78);
  const obj={
    date,
    weight:num("weight"),
    calories:num("calories"),
    breakfast:num("breakfast"),
    lunch:num("lunch"),
    dinner:num("dinner"),
    water:num("water"),
    exercise:num("exercise"),
    sleep:num("sleep"),
    mood:num("mood"),
    notes:$("notes").value.trim(),
    photo:photoData
  };
  if(!hasAnyData(obj)){toast("Add at least one value before saving");return}
  entries=entries.filter(x=>x.date!==date);
  entries.push(obj);
  entries.sort((a,b)=>a.date.localeCompare(b.date));
  save();
  loadDateIntoForm(date);
  toast("Check-in saved ✓");
  renderDashboard();
}
function quickAddWater(amount){
  const date=localDate(), old=existing(date)||{date,weight:null,calories:null,water:null,exercise:null,sleep:null,mood:null,notes:"",photo:null};
  old.water=Math.round(((old.water||0)+amount)*100)/100;
  entries=entries.filter(x=>x.date!==date);entries.push(old);entries.sort((a,b)=>a.date.localeCompare(b.date));save();
  renderDashboard();toast(`Added ${Math.round(amount*1000)} ml of water`);
}
function openTodayCheckin(){showPage("dashboard");$("checkinCard").scrollIntoView({behavior:"smooth",block:"start"});$("weight").focus()}
function deleteCurrentEntry(){
  const date=$("date").value, e=existing(date);
  if(!e)return;
  if(!confirm(`Delete the check-in for ${fmtDate(date)}?`))return;
  entries=entries.filter(x=>x.date!==date);save();loadDateIntoForm(date);toast("Check-in deleted");renderDashboard();
}
function compressImage(file,max=1000,q=.78){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onerror=reject;
    r.onload=()=>{
      const img=new Image();
      img.onerror=reject;
      img.onload=()=>{
        const scale=Math.min(1,max/Math.max(img.width,img.height));
        const c=document.createElement("canvas");
        c.width=Math.max(1,Math.round(img.width*scale));
        c.height=Math.max(1,Math.round(img.height*scale));
        c.getContext("2d",{alpha:false}).drawImage(img,0,0,c.width,c.height);
        resolve(c.toDataURL("image/jpeg",q));
      };
      img.src=r.result;
    };
    r.readAsDataURL(file);
  });
}

function drawChart(canvas,vals,labels){
  const dpr=window.devicePixelRatio||1,w=canvas.clientWidth||600,h=canvas.clientHeight||240;
  canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
  const c=canvas.getContext("2d");c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  const nums=vals.filter(Number.isFinite);
  const pad={l:42,r:16,t:20,b:32},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
  c.font="11px system-ui";
  if(!nums.length){c.fillStyle="#94a3b8";c.textAlign="center";c.fillText("No weight data yet",w/2,h/2);return}
  let min=Math.min(...nums),max=Math.max(...nums);
  const range=Math.max(1,max-min), margin=Math.max(.5,range*.18);min-=margin;max+=margin;
  c.strokeStyle="#e5e7eb";c.lineWidth=1;
  for(let i=0;i<4;i++){const y=pad.t+ph*i/3;c.beginPath();c.moveTo(pad.l,y);c.lineTo(w-pad.r,y);c.stroke()}
  c.fillStyle="#64748b";c.textAlign="right";
  for(let i=0;i<4;i++){const v=max-(max-min)*i/3;c.fillText(v.toFixed(1),pad.l-7,pad.t+ph*i/3+4)}
  const pts=[];
  vals.forEach((v,i)=>{
    if(!Number.isFinite(v))return;
    const x=pad.l+pw*(i/(vals.length-1||1)),y=pad.t+ph*(max-v)/(max-min);
    pts.push({x,y,v,i});
  });
  if(pts.length===1){
    c.fillStyle="#4f46e5";c.beginPath();c.arc(pts[0].x,pts[0].y,5,0,Math.PI*2);c.fill();
  }else{
    c.strokeStyle="#4f46e5";c.lineWidth=3;c.lineJoin="round";c.beginPath();
    pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();
    c.fillStyle="#4f46e5";pts.forEach(p=>{c.beginPath();c.arc(p.x,p.y,4,0,Math.PI*2);c.fill()});
  }
  c.fillStyle="#64748b";c.textAlign="center";
  [0,3,6].forEach(i=>{if(labels[i]){const x=pad.l+pw*(i/(labels.length-1||1));c.fillText(parseDate(labels[i]).toLocaleDateString(undefined,{weekday:"short"}),x,h-8)}});
}

function weekData(){return recent7()}

function renderReport(){
  const d=weekData(),weights=d.filter(x=>Number.isFinite(x.weight)).map(x=>x.weight);
  const days=d.filter(hasAnyData).length;
  $("reportRange").textContent=`${fmtDate(d[0].date)} – ${fmtDate(d[6].date)}`;
  drawChart($("reportChart"),d.map(x=>x.weight),d.map(x=>x.date));
  if(weights.length>=2){
    const delta=weights[weights.length-1]-weights[0];
    $("reportHeadline").textContent=Math.abs(delta)<.15?"Weight was broadly stable this week.":delta<0?"Your recorded weight is trending down.":"Your recorded weight is trending up.";
    $("reportSummary").textContent=`${days}/7 days logged • ${delta>=0?"+":""}${delta.toFixed(1)} kg from first to latest recorded weight.`;
    $("weightInsight").innerHTML=`<div class="tip ${Math.abs(delta)<=.2?"warn":"good"}">${Math.abs(delta)<=.2?"Small week-to-week changes are normal.":"Use the trend rather than reacting to a single weigh-in."} Scale readings can move because of hydration, meals and other normal day-to-day factors.</div>`;
  }else{
    $("reportHeadline").textContent="Add at least two weight entries to see a trend.";
    $("reportSummary").textContent=`${days}/7 days logged.`;
    $("weightInsight").innerHTML=`<div class="tip">A few consistent check-ins will make the weekly trend more useful.</div>`;
  }

  const ac=avg("calories",d),aw=avg("water",d),ae=avg("exercise",d),awt=avg("weight",d),asl=avg("sleep",d),am=avg("mood",d);
  $("avgGrid").innerHTML=[
    ["Calories",ac!=null?`${Math.round(ac)} kcal`:"—"],
    ["Water",aw!=null?`${aw.toFixed(1)} L`:"—"],
    ["Exercise",ae!=null?`${Math.round(ae)} min`:"—"],
    ["Weight",awt!=null?`${awt.toFixed(1)} kg`:"—"],
    ["Sleep",asl!=null?`${asl.toFixed(1)} h`:"—"],
    ["Mood",am!=null?`${am.toFixed(1)} / 5`:"—"]
  ].map(([a,b])=>`<div class="stat"><div class="stat-label">${a}</div><div class="stat-value">${b}</div></div>`).join("");

  const tips=[];
  if(ac!=null){
    const diff=ac-settings.cal;
    if(Math.abs(diff)<settings.cal*.1)tips.push(`Your average calorie intake (${Math.round(ac)} kcal) was close to your personal target (${Math.round(settings.cal)} kcal).`);
    else if(diff>0)tips.push(`Your average calorie intake was about ${Math.round(diff)} kcal above your personal target. If changing intake is appropriate for your goal, make small sustainable adjustments rather than drastic cuts.`);
    else tips.push(`Your average calorie intake was about ${Math.round(Math.abs(diff))} kcal below your personal target. Pay attention to energy, hunger and recovery rather than trying to minimize intake.`);
  }
  if(aw!=null){
    tips.push(aw<settings.water*.8?`Average water intake was ${aw.toFixed(1)} L/day. You are below your personal ${settings.water.toFixed(1)} L target.`:`Average water intake was ${aw.toFixed(1)} L/day — good consistency against your ${settings.water.toFixed(1)} L target.`);
  }
  if(ae!=null)tips.push(ae<settings.exercise?`Exercise averaged ${Math.round(ae)} min/day. Consider whether a little more everyday movement fits your routine.`:`Exercise averaged ${Math.round(ae)} min/day this week.`);
  if(asl!=null)tips.push(`Sleep averaged ${asl.toFixed(1)} hours per logged night. Watch how this lines up with your energy and mood notes.`);
  if(days<5)tips.push(`Only ${days}/7 days were logged. More consistent tracking will make the report more reliable.`);
  if(!tips.length)tips.push("Keep logging for a clearer weekly picture.");
  $("tips").innerHTML=tips.map((x,i)=>`<div class="tip ${i===0?"good":""}">${escapeHtml(x)}</div>`).join("");
}

function renderPhotos(){
  const p=entries.filter(x=>x.photo).sort((a,b)=>b.date.localeCompare(a.date));
  $("photoCount").textContent=`${p.length} photo${p.length===1?"":"s"}`;
  $("photoGrid").innerHTML=p.length?p.map(x=>`<div class="photo-card"><img class="photo" src="${x.photo}" alt="Progress photo ${escapeHtml(x.date)}"><div class="photo-label">${fmtDate(x.date)}${x.weight!=null?` • ${x.weight.toFixed(1)} kg`:""}</div></div>`).join(""):`<div class="empty" style="grid-column:1/-1">No progress photos yet.</div>`;
  $("photoCoach").textContent=p.length<2?"Add at least two photos, ideally around a week apart, for a more useful visual timeline.":`You have ${p.length} progress photos. Keep your pose, camera distance and lighting similar for better comparisons.`;
}

function renderHistory(){
  const a=[...entries].sort((x,y)=>y.date.localeCompare(x.date));
  $("historyCount").textContent=`${a.length} day${a.length===1?"":"s"}`;
  $("historyList").innerHTML=a.length?a.map(x=>`<div class="history-item">
    <div class="history-main"><span class="history-date">${fmtDate(x.date)}</span><span class="badge">${x.weight!=null?`${x.weight.toFixed(1)} kg`:"Check-in"}</span></div>
    <div class="history-values">${x.calories!=null?`${Math.round(x.calories)} kcal`:"—"} • ${x.water!=null?`${x.water.toFixed(1)} L`:"—"} • ${x.exercise!=null?`${Math.round(x.exercise)} min`:"—"}${x.sleep!=null?` • ${x.sleep.toFixed(1)} h sleep`:""}${x.mood!=null?` • mood ${x.mood}/5`:""}${x.photo?" • 📷 Photo":""}</div>
    ${x.notes?`<div class="history-values">“${escapeHtml(x.notes)}”</div>`:""}
    <button class="btn secondary small" style="margin-top:9px" onclick="editEntry('${x.date}')">Edit</button>
  </div>`).join(""):`<div class="empty">No check-ins yet.</div>`;
}
function editEntry(date){showPage("dashboard");$("date").value=date;loadDateIntoForm(date);setTimeout(()=>$("checkinCard").scrollIntoView({behavior:"smooth",block:"start"}),80)}

function renderSettings(){
  $("goalCal").value=settings.cal??2000;
  $("goalWater").value=settings.water??2.5;
  $("goalExercise").value=settings.exercise??30;
  $("goalWeight").value=settings.weightGoal??"";
}
function saveSettings(){
  const cal=num("goalCal"),water=num("goalWater"),exercise=num("goalExercise"),weight=num("goalWeight");
  if(!cal||cal<500){toast("Enter a valid calorie target");return}
  if(!water||water<.5){toast("Enter a valid water target");return}
  if(!exercise||exercise<1){toast("Enter a valid exercise target");return}
  settings={cal,water,exercise,weightGoal:weight};
  localStorage.setItem(SETTINGS,JSON.stringify(settings));
  toast("Goals saved ✓");renderDashboard();
}

function downloadReport(){
  const d=weekData(),w=d.filter(x=>Number.isFinite(x.weight)).map(x=>x.weight),delta=w.length>1?w[w.length-1]-w[0]:null;
  let text=`FITTRACK — WEEKLY REVIEW\n${fmtDate(d[0].date)} — ${fmtDate(d[6].date)}\n\n`;
  text+=`Days logged: ${d.filter(hasAnyData).length}/7\n`;
  text+=`Average calories: ${avg("calories",d)?.toFixed(0)??"—"} kcal\n`;
  text+=`Average water: ${avg("water",d)?.toFixed(1)??"—"} L\n`;
  text+=`Average exercise: ${avg("exercise",d)?.toFixed(0)??"—"} min\n`;
  text+=`Average sleep: ${avg("sleep",d)?.toFixed(1)??"—"} h\n`;
  text+=`Average mood: ${avg("mood",d)?.toFixed(1)??"—"} / 5\n`;
  text+=`Average weight: ${avg("weight",d)?.toFixed(1)??"—"} kg\n`;
  if(delta!=null)text+=`Weight change (first to latest recorded): ${delta>=0?"+":""}${delta.toFixed(1)} kg\n`;
  text+=`\nNOTES\n- Look at trends over time instead of reacting to one weigh-in.\n- Keep progress photos consistent in pose, distance and lighting.\n- Your calorie and water targets are user-entered tracking targets.\n- This report is informational and not medical advice.\n`;
  const blob=new Blob([text],{type:"text/plain;charset=utf-8"}),a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=`FitTrack-weekly-${localDate()}.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);
}

async function requestNotifications(){
  if(!("Notification"in window)){toast("Notifications are not supported here");return}
  try{
    const p=await Notification.requestPermission();
    toast(p==="granted"?"Notifications enabled ✓":"Notification permission not granted");
  }catch{toast("Could not enable notifications")}
}
async function installApp(){
  if(!deferredInstallPrompt){toast("Use your browser's Add to Home Screen option");return}
  deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$("installBanner").classList.remove("show");
}
function clearAll(){
  if(!confirm("Delete every FitTrack entry, photo and goal? This cannot be undone."))return;
  localStorage.removeItem(KEY);localStorage.removeItem(SETTINGS);
  entries=[];settings={cal:2000,water:2.5,exercise:30,weightGoal:null};
  renderDashboard();renderHistory();renderPhotos();renderSettings();toast("All local data deleted");
}
function exportBackup(){
  const blob=new Blob([JSON.stringify({version:3,exportedAt:new Date().toISOString(),entries,settings},null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`FitTrack-backup-${localDate()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500);toast("Backup downloaded");
}
function importBackup(event){
  const file=event.target.files[0];event.target.value="";
  if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{try{
    const data=JSON.parse(reader.result);
    if(!Array.isArray(data.entries)||!data.settings)throw new Error("invalid");
    if(!confirm("Replace all current FitTrack data with this backup?"))return;
    entries=data.entries.filter(x=>x&&typeof x.date==="string");
    settings={cal:2000,water:2.5,exercise:30,weightGoal:null,...data.settings};
    save();localStorage.setItem(SETTINGS,JSON.stringify(settings));renderDashboard();renderHistory();renderPhotos();renderSettings();toast("Backup restored");
  }catch{toast("That file is not a valid FitTrack backup")}};
  reader.readAsText(file);
}
window.addEventListener("resize",()=>{
  if($("dashboard").classList.contains("active"))renderDashboard();
  if($("reports").classList.contains("active"))renderReport();
});
init();
