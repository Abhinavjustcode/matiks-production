import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {Swords,Trophy,Shield,Bell,Users,MoreHorizontal,ChevronRight,Clock3,Play,Brain,Target,Puzzle,GitBranch} from "lucide-react";
import "./styles.css";

const API="http://localhost:4000";

function App(){
 const [token,setToken]=useState(localStorage.getItem("matiks-token")||"");
 const [user,setUser]=useState<any>(null);
 const [view,setView]=useState("arena");
 const [searching,setSearching]=useState(false);
 const [match,setMatch]=useState<any>(null);

 useEffect(()=>{if(token)fetch(API+"/me",{headers:{Authorization:`Bearer ${token}`}}).then(r=>r.json()).then(setUser).catch(()=>{})},[token]);

 async function login(){
   const username="ABHINAV";
   const r=await fetch(API+"/auth/guest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username})});
   const x=await r.json();localStorage.setItem("matiks-token",x.token);setToken(x.token);setUser(x.user);
 }
 async function queue(){
   if(!token){await login();return}
   setSearching(true);setView("queue");
   await fetch(API+"/matchmaking/join",{method:"POST",headers:{Authorization:`Bearer ${token}`}});
 }
 return <div className="app">
  <aside><div className="brand">∞ MATIKS</div>{[
    ["ARENA",Swords],["QUESTS",Shield],["COMPETE",Trophy],["FEED",Bell],["GROUP PLAY",Users],["MORE",MoreHorizontal]
  ].map(([t,I],i)=><button className={i===0?"nav active":"nav"} key={t as string} onClick={()=>setView(i===0?"arena":String(t))}><I size={20}/><span>{t as string}</span></button>)}<div className="user">A <b>ABHINAV DWIVEDI</b></div></aside>
  <main>
   <header><div className="avatars">{["R","N","😎","🧑","😐","😈"].map((x,i)=><div><b>{x}</b><small>{["RAZIABEGU...","NITUSAINI4...","MATHLETE...","UNDEFINED...","MATHLETE...","MATHLETE..."][i]}</small></div>)}</div><div className="wallet">🟢 20　🔥 {user?.streak||12}　⬡ {user?.rating||2147} XP</div></header>
   {view==="arena"&&<Arena onPlay={queue}/>}
   {view==="queue"&&<Queue searching={searching} onCancel={()=>{setSearching(false);setView("arena")}}/>}
   {view!=="arena"&&view!=="queue"&&<div className="placeholder"><h1>{view}</h1><p>This production shell is ready for the next MATIKS module.</p></div>}
  </main>
 </div>
}

function Arena({onPlay}:{onPlay:()=>void}){
 return <div className="arena"><div className="daily">DAILY QUEST <b><Clock3 size={13}/> 07:11</b><a>VIEW ALL</a></div>
 <section className="hero"><h1>READY WHEN YOU ARE.</h1><p>Four minutes. One opponent. Make the better technical decision.</p><button onClick={onPlay}><span>● MATCHMAKING OPEN</span><ChevronRight/></button></section>
 <label>DUELS</label>
<div className="tabs">
  {[
    { title:"MATH", Icon:GitBranch },
    { title:"PUZZLE", Icon:Puzzle },
    { title:"MEMORY", Icon:Brain },
    { title:"LOGIC", Icon:Target }
  ].map(({title,Icon},i)=>(
    <button key={title} className={i===0?"sel":""}>
      <Icon />
      <b>{title}</b>
    </button>
  ))}
</div>
 <div className="cards"><Card title="SPRINT DUELS" sub="RACE TO SOLVE THE MOST IN 1 MINUTE" onClick={onPlay}/><Card title="FASTEST FINGERS DUELS" sub="BE THE FIRST TO ANSWER EACH QUESTION" onClick={onPlay}/></div>
 <div className="people-title">PEOPLE YOU MAY KNOW <a>VIEW ALL</a></div><div className="people">{["😎","🧑","🌸","S"].map((x,i)=><div><b>{x}</b><strong>{["arp iiii","Aman Singh","MAHENDRA...","Sarva..."][i]}</strong><small>@player_{i}</small></div>)}</div>
 </div>
}
function Card({title,sub,onClick}:{title:string,sub:string,onClick:()=>void}){return <button className="card" onClick={onClick}><span>MATH</span><h2>{title}</h2><p>{sub}</p><ChevronRight/></button>}
function Queue({searching,onCancel}:{searching:boolean,onCancel:()=>void}){return <div className="queue"><span>● QUEUE ACTIVE</span><h1>FIND YOUR<br/><em>OPPONENT.</em></h1><p>MATIKS Brain is finding the closest fair opponent.</p><div className="orbit">M+</div><code>CALIBRATING MATCH RANGE...</code><button onClick={onCancel}>CANCEL SEARCH</button></div>}
createRoot(document.getElementById("root")!).render(<App/>);
