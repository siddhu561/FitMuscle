const KEY="fittrack_entries_v2", SETTINGS="fittrack_settings_v2";
let entries=[], settings={cal:2000,water:2.5,weightGoal:-0.3}, db;

const $=id=>document.getElementById(id);
function today(){return new Date().toISOString().slice(0,10)}
function fmtDate(s){return new Date(s+"T12:00:00").toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"})}
function load(){entries=JSON.parse(localStorage.getItem(KEY)||"[]");settings={...settings,...JSON.parse(localStorage.getItem(SETTINGS)||"{}")}}
function save(){localStorage.setItem(KEY,JSON.stringify(entries))}
function toast(t){let x=$("toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2200)}
function showPage(id){
 document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===id));
 document.querySelectorAll(".nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===id));
 if(id==="dashboard")renderDashboard(); if(id==="reports")renderReport(); if(id==="photosPage")renderPhotos(); if(id==="history")renderHistory(); if(id==="settings")renderSettings();
 window.scrollTo({top:0,behavior:"smooth"});
}
function init(){
 load(); $("todayText").textContent=new Date().toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"});
 $("date").value=today(); renderDashboard(); renderSettings();
 $("photo").addEventListener("change",e=>{let f=e.target.files[0];if(f){let r=new FileReader();r.onload=()=>{$("preview").src=r.result;$("preview").classList.remove("hidden")};r.readAsDataURL(f)}});
 $("entryForm").addEventListener("submit",saveEntry);
 if("serviceWorker"in navigator)navigator.serviceWorker.register("./sw.js").catch(()=>{});
}
function existing(date){return entries.find(x=>x.date===date)}
async function saveEntry(e){
 e.preventDefault(); let date=$("date").value; let old=existing(date);
 let photoData=null, file=$("photo").files[0];
 if(file) photoData=await compressImage(file,900,0.78);
 let obj={date,weight:num("weight"),calories:num("calories"),water:num("water"),exercise:num("exercise"),notes:$("notes").value.trim(),photo:photoData||(old?.photo||null)};
 entries=entries.filter(x=>x.date!==date); entries.push(obj); entries.sort((a,b)=>a.date.localeCompare(b.date)); save();
 $("entryForm").reset();$("date").value=date;$("preview").classList.add("hidden");
 toast("Check-in saved ✓"); renderDashboard();
}
function num(id){let v=parseFloat($(id).value);return Number.isFinite(v)?v:null}
function compressImage(file,max=900,q=.78){return new Promise(res=>{let r=new FileReader();r.onload=()=>{let img=new Image();img.onload=()=>{let s=Math.min(1,max/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*s);c.height=Math.round(img.height*s);c.getContext("2d").drawImage(img,0,0,c.width,c.height);res(c.toDataURL("image/jpeg",q))};img.src=r.result};r.readAsDataURL(file)})}
function last7(){let end=new Date();let a=[];for(let i=6;i>=0;i--){let d=new Date(end);d.setDate(end.getDate()-i);let s=d.toISOString().slice(0,10);a.push(entries.find(x=>x.date===s)||{date:s})}return a}
function streak(){let n=0,d=new Date();for(;;){let s=d.toISOString().slice(0,10);if(entries.some(x=>x.date===s)){n++;d.setDate(d.getDate()-1)}else break}return n}
function renderDashboard(){
 let t=existing(today())||{}; $("heroWeight").textContent=t.weight!=null?t.weight+" kg":"—"; $("heroCal").textContent=t.calories!=null?t.calories+" kcal":"—"; $("heroWater").textContent=t.water!=null?t.water+" L":"—"; $("heroExercise").textContent=t.exercise!=null?t.exercise+" min":"—";
 let st=streak();$("streakBadge").textContent=st+" day"+(st===1?"":"s")+" streak"; $("heroTitle").textContent=st>=7?"Excellent consistency. Keep going!":st>=3?"Nice momentum — protect the streak.":"Let's keep the streak alive.";
 let w=last7().filter(x=>x.weight!=null).map(x=>x.weight);$("trendText").textContent=w.length>=2?(w[w.length-1]-w[0]).toFixed(1)+" kg over 7 days":"Add weight entries to see trend";
 drawChart($("chart"),last7().map(x=>x.weight),last7().map(x=>x.date));
 fillForm(t);
}
function fillForm(t){$("weight").value=t.weight??"";$("calories").value=t.calories??"";$("water").value=t.water??"";$("exercise").value=t.exercise??"";$("notes").value=t.notes??""}
function drawChart(canvas,vals,labels){
 let dpr=devicePixelRatio||1,w=canvas.clientWidth||600,h=canvas.clientHeight||230;canvas.width=w*dpr;canvas.height=h*dpr;let c=canvas.getContext("2d");c.scale(dpr,dpr);c.clearRect(0,0,w,h);
 let nums=vals.filter(v=>v!=null);if(!nums.length){c.fillStyle="#8b93a3";c.font="14px system-ui";c.textAlign="center";c.fillText("No weight data yet",w/2,h/2);return}
 let min=Math.min(...nums),max=Math.max(...nums);if(min===max){min-=1;max+=1}let pad={l:38,r:14,t:18,b:28},pw=w-pad.l-pad.r,ph=h-pad.t-pad.b;
 c.strokeStyle="#e6e9ef";c.lineWidth=1;for(let i=0;i<4;i++){let y=pad.t+ph*i/3;c.beginPath();c.moveTo(pad.l,y);c.lineTo(w-pad.r,y);c.stroke()}
 c.fillStyle="#7b8495";c.font="11px system-ui";c.textAlign="right";for(let i=0;i<4;i++){let v=max-(max-min)*i/3;c.fillText(v.toFixed(1),pad.l-7,pad.t+ph*i/3+4)}
 let pts=[];vals.forEach((v,i)=>{if(v!=null){let x=pad.l+pw*(i/(vals.length-1||1)),y=pad.t+ph*(max-v)/(max-min);pts.push([x,y])}});
 c.strokeStyle="#4f46e5";c.lineWidth=3;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();c.fillStyle="#4f46e5";pts.forEach(p=>{c.beginPath();c.arc(p[0],p[1],4,0,Math.PI*2);c.fill()});
 c.fillStyle="#7b8495";c.textAlign="center";labels.forEach((l,i)=>{if(i===0||i===labels.length-1||i===3){let x=pad.l+pw*(i/(labels.length-1||1));c.fillText(new Date(l+"T12:00:00").toLocaleDateString(undefined,{weekday:"short"}),x,h-8)}})
}
function weekData(){return last7()}
function avg(field){let a=weekData().map(x=>x[field]).filter(v=>v!=null);return a.length?a.reduce((s,v)=>s+v,0)/a.length:null}
function renderReport(){
 let d=weekData(), weights=d.filter(x=>x.weight!=null).map(x=>x.weight), days=d.filter(x=>Object.keys(x).length>1).length;
 $("reportChart").style.height="230px";drawChart($("reportChart"),d.map(x=>x.weight),d.map(x=>x.date));
 if(weights.length>=2){let delta=weights[weights.length-1]-weights[0];$("reportHeadline").textContent=delta<-.1?"You're trending downward 📉":delta>.1?"Weight is trending upward — let's adjust gently.":"Your weight is roughly stable this week.";
 $("reportSummary").textContent=`${days}/7 days logged • ${delta>=0?"+":""}${delta.toFixed(1)} kg from first to latest weight entry.`;
 }else{$("reportHeadline").textContent="Log more weight entries for a stronger trend.";$("reportSummary").textContent=`${days}/7 days logged.`}
 let wi=$("weightInsight"); wi.innerHTML="";
 if(weights.length>=2){let delta=weights[weights.length-1]-weights[0];let cls=Math.abs(delta)<=.2?"warn":"good";wi.innerHTML=`<div class="tip ${cls}">${delta<0?"Your scale trend is moving down.":"Your scale trend is not moving down yet."} Avoid reacting to a single day's number; look at the 7-day trend.</div>`}
 let tips=[];
 let ac=avg("calories"),aw=avg("water"),ae=avg("exercise");
 if(ac!=null)tips.push(ac>settings.cal*1.1?`Your average calories (${Math.round(ac)}) are above your target (${settings.cal}). If weight loss is the goal, consider a small, sustainable reduction rather than a crash diet.`:ac<settings.cal*.75?`Your average calories are quite low (${Math.round(ac)}). Consider eating enough to support energy, training and recovery.`:`Your average calories (${Math.round(ac)}) are close to your target.`);
 if(aw!=null)tips.push(aw<settings.water*.8?`Water averaged ${aw.toFixed(1)} L/day. Try moving gradually toward ${settings.water.toFixed(1)} L.`:`Water averaged ${aw.toFixed(1)} L/day — good consistency.`);
 if(ae!=null)tips.push(ae<90?`Exercise averaged ${Math.round(ae)} min/day. If appropriate for you, add a little more walking or structured activity.`:`You averaged ${Math.round(ae)} min/day of exercise — solid activity.`);
 if(days<5)tips.push(`You logged ${days}/7 days. Consistency is the biggest missing piece this week.`);
 $("tips").innerHTML=tips.map((x,i)=>`<div class="tip ${i===0?"good":""}">${x}</div>`).join("");
 $("avgGrid").innerHTML=[["Calories",ac?Math.round(ac)+" kcal":"—"],["Water",aw?aw.toFixed(1)+" L":"—"],["Exercise",ae?Math.round(ae)+" min":"—"],["Weight",avg("weight")?avg("weight").toFixed(1)+" kg":"—"]].map(x=>`<div class="stat"><span class="label">${x[0]}</span><b>${x[1]}</b></div>`).join("");
}
function renderPhotos(){
 let p=entries.filter(x=>x.photo).sort((a,b)=>b.date.localeCompare(a.date));$("photoGrid").innerHTML=p.length?p.map(x=>`<div><img class="photo" src="${x.photo}" alt="Progress photo ${x.date}"><div class="photo-label">${fmtDate(x.date)}${x.weight!=null?" • "+x.weight+" kg":""}</div></div>`).join(""):`<div class="empty" style="grid-column:1/-1">No photos yet.</div>`;
 let msg=p.length<2?"Add at least two photos, ideally one week apart.":`You have ${p.length} progress photos. For reliable visual comparison, keep pose, clothing, camera distance and lighting as similar as possible.`;
 $("photoCoach").textContent=msg;
}
function renderHistory(){
 let a=[...entries].sort((x,y)=>y.date.localeCompare(x.date));$("historyList").innerHTML=a.length?a.map(x=>`<div class="card" style="box-shadow:none;margin:8px 0;padding:13px"><div class="row between"><b>${fmtDate(x.date)}</b><span class="badge">${x.weight!=null?x.weight+" kg":"No weight"}</span></div><div class="small muted" style="margin-top:8px">${x.calories??"—"} kcal • ${x.water??"—"} L • ${x.exercise??"—"} min${x.notes?" • "+escapeHtml(x.notes):""}</div><button class="btn secondary small" style="margin-top:9px;padding:8px 10px" onclick="editEntry('${x.date}')">Edit</button></div>`).join(""):`<div class="empty">No check-ins yet.</div>`;
}
function editEntry(date){let x=existing(date);showPage("dashboard");$("date").value=date;fillForm(x);window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"})}
function renderSettings(){$("goalCal").value=settings.cal;$("goalWater").value=settings.water;$("goalWeight").value=settings.weightGoal}
function saveSettings(){settings.cal=num("goalCal")||2000;settings.water=num("goalWater")||2.5;settings.weightGoal=num("goalWeight")??-.3;localStorage.setItem(SETTINGS,JSON.stringify(settings));toast("Goals saved ✓");renderDashboard()}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function downloadReport(){
 let d=weekData(),w=d.filter(x=>x.weight!=null).map(x=>x.weight),delta=w.length>1?w[w.length-1]-w[0]:null;
 let text=`FITTRACK WEEKLY REPORT\n${fmtDate(d[0].date)} — ${fmtDate(d[6].date)}\n\n`;
 text+=`Days logged: ${d.filter(x=>x.weight!=null||x.calories!=null||x.water!=null||x.exercise!=null).length}/7\n`;
 if(delta!=null)text+=`Weight change: ${delta>=0?"+":""}${delta.toFixed(1)} kg\n`;
 text+=`Average calories: ${avg("calories")?.toFixed(0)??"—"} kcal\nAverage water: ${avg("water")?.toFixed(1)??"—"} L\nAverage exercise: ${avg("exercise")?.toFixed(0)??"—"} min\n\n`;
 text+=`COACH NOTES\n- Use weekly trends instead of reacting to single-day changes.\n- Keep progress photos consistent in pose, distance and lighting.\n- Make food/exercise changes gradually and sustainably.\n`;
 let blob=new Blob([text],{type:"text/plain"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="FitTrack-weekly-report.txt";a.click();URL.revokeObjectURL(a.href);
}
async function requestNotifications(){if(!("Notification"in window)){toast("Notifications not supported");return}let p=await Notification.requestPermission();toast(p==="granted"?"Notifications enabled":"Permission not granted")}
function clearAll(){if(confirm("Delete every FitTrack entry, photo and goal? This cannot be undone.")){localStorage.removeItem(KEY);localStorage.removeItem(SETTINGS);entries=[];settings={cal:2000,water:2.5,weightGoal:-.3};toast("All local data deleted");renderDashboard();renderHistory();renderPhotos();}}
window.addEventListener("resize",()=>{if($("dashboard").classList.contains("active"))renderDashboard();});
init();
