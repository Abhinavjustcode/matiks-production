import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {
  Code2,Trophy,Swords,Users,ChevronRight,Clock3,
  Play,Send,CheckCircle2,XCircle,Loader2,Terminal,
  BarChart3,LogOut
} from "lucide-react";
import "./styles.css";

const API="http://localhost:4000";

type Problem={
 id:string;slug:string;title:string;difficulty:string;
 description:string;starterCode:any;examples:any[];
 constraints?:string;tags:any[]
};

function App(){
 const [token,setToken]=useState(localStorage.getItem("matiks-token")||"");
 const [user,setUser]=useState<any>(null);
 const [problems,setProblems]=useState<Problem[]>([]);
 const [problem,setProblem]=useState<Problem|null>(null);
 const [code,setCode]=useState("");
 const [language,setLanguage]=useState("javascript");
 const [output,setOutput]=useState<any>(null);
 const [running,setRunning]=useState(false);
 const [time,setTime]=useState(240);
 const [tab,setTab]=useState("arena");

 useEffect(()=>{
   if(!token)return;
   fetch(API+"/me",{headers:{Authorization:`Bearer ${token}`}})
     .then(r=>r.json()).then(setUser).catch(()=>{});
 },[token]);

 useEffect(()=>{
   fetch(API+"/problems").then(r=>r.json()).then((x)=>{
     setProblems(x);
     if(x[0])setProblem(x[0]);
   });
 },[]);

 useEffect(()=>{
   if(!problem)return;
   setCode(problem.starterCode?.[language]||"");
 },[problem,language]);

 useEffect(()=>{
   if(!problem || tab!=="arena")return;
   const id=setInterval(()=>setTime(t=>t>0?t-1:0),1000);
   return()=>clearInterval(id);
 },[problem,tab]);

 async function login(){
   const r=await fetch(API+"/auth/guest",{
     method:"POST",
     headers:{"Content-Type":"application/json"},
     body:JSON.stringify({username:"ABHINAV"})
   });
   const x=await r.json();
   localStorage.setItem("matiks-token",x.token);
   setToken(x.token);
   setUser(x.user);
 }

 async function submit(mode:"run"|"submit"){
   if(!token){await login();return}
   if(!problem)return;

   setRunning(true);
   setOutput(null);

   try{
     const r=await fetch(API+"/submissions",{
       method:"POST",
       headers:{
         "Content-Type":"application/json",
         Authorization:`Bearer ${token}`
       },
       body:JSON.stringify({
         problemId:problem.id,
         language,
         code,
         mode
       })
     });

     const x=await r.json();

     if(!r.ok) throw new Error(x.error||"Submission failed");

     setOutput({
       type:"pending",
       title:mode==="run"?"RUN QUEUED":"SUBMITTED",
       ...x
     });
   }catch(e:any){
     setOutput({type:"error",title:"ERROR",message:e.message});
   }finally{
     setRunning(false);
   }
 }

 function fmt(t:number){
   return `${String(Math.floor(t/60)).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`;
 }

 return <div className="shell">

  <aside className="sidebar">
    <div className="logo">∞ MATIKS</div>

    <button className={tab==="arena"?"side active":"side"} onClick={()=>setTab("arena")}>
      <Code2/> CODING ARENA
    </button>

    <button className={tab==="leaderboard"?"side active":"side"} onClick={()=>setTab("leaderboard")}>
      <Trophy/> LEADERBOARD
    </button>

    <button className="side">
      <Swords/> DUELS
    </button>

    <button className="side">
      <Users/> PLAYERS
    </button>

    <div className="side-bottom">
      <div className="profile">
        <div className="avatar">A</div>
        <div>
          <b>{user?.username||"GUEST"}</b>
          <small>{user?.rating||1000} RATING</small>
        </div>
      </div>
    </div>
  </aside>

  <main className="main">

    <header className="topbar">
      <div>
        <span className="eyebrow">MATIKS / COMPETE</span>
        <h1>{tab==="arena"?"CODING ARENA":"GLOBAL LEADERBOARD"}</h1>
      </div>

      <div className="stats">
        <span>🔥 {user?.streak||0}</span>
        <span>◆ {user?.rating||1000}</span>
      </div>
    </header>

    {tab==="arena" && <div className="arena-layout">

      <section className="problems-panel">
        <div className="panel-head">
          <span>PROBLEMS</span>
          <small>{problems.length} AVAILABLE</small>
        </div>

        {problems.map((p,i)=>
          <button
            key={p.id}
            className={problem?.id===p.id?"problem active":"problem"}
            onClick={()=>{setProblem(p);setTime(240)}}
          >
            <div className="problem-number">{String(i+1).padStart(2,"0")}</div>
            <div className="problem-info">
              <b>{p.title}</b>
              <small>{p.tags?.slice(0,2).join(" · ")}</small>
            </div>
            <span className={"difficulty "+p.difficulty.toLowerCase()}>
              {p.difficulty}
            </span>
          </button>
        )}

        <div className="brain-card">
          <span>MATIKS BRAIN</span>
          <strong>ADAPTIVE MODE</strong>
          <p>Difficulty will adapt to your performance.</p>
        </div>
      </section>

      {problem && <section className="workspace">

        <div className="problem-view">
          <div className="problem-top">
            <div>
              <span className={"difficulty "+problem.difficulty.toLowerCase()}>
                {problem.difficulty}
              </span>
              <h2>{problem.title}</h2>
            </div>

            <div className={"timer "+(time<30?"danger":"")}>
              <Clock3 size={17}/>
              {fmt(time)}
            </div>
          </div>

          <p className="description">{problem.description}</p>

          <h3>EXAMPLES</h3>
          <div className="examples">
            {problem.examples?.map((e:any,i:number)=>
              <div className="example" key={i}>
                <span>Example {i+1}</span>
                <code>Input: {e.input}</code>
                <code>Output: {e.output}</code>
              </div>
            )}
          </div>

          {problem.constraints && <>
            <h3>CONSTRAINTS</h3>
            <p className="constraints">{problem.constraints}</p>
          </>}
        </div>

        <div className="editor-panel">

          <div className="editor-toolbar">
            <select value={language} onChange={e=>setLanguage(e.target.value)}>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
              <option value="java">Java</option>
            </select>

            <div className="editor-actions">
              <button onClick={()=>submit("run")} disabled={running}>
                {running?<Loader2 className="spin"/>:<Play/>}
                RUN
              </button>

              <button className="submit" onClick={()=>submit("submit")} disabled={running}>
                {running?<Loader2 className="spin"/>:<Send/>}
                SUBMIT
              </button>
            </div>
          </div>

          <textarea
            spellCheck={false}
            value={code}
            onChange={e=>setCode(e.target.value)}
            className="code-editor"
          />

          <div className="console">
            <div className="console-head">
              <span><Terminal size={15}/> TEST OUTPUT</span>
              {output?.type==="pending" && <span className="pending">QUEUED</span>}
            </div>

            {!output && <div className="empty-console">
              <Terminal size={25}/>
              <p>Run your code to see results.</p>
            </div>}

            {output?.type==="pending" &&
              <div className="result pending-result">
                <Loader2 className="spin"/>
                <div>
                  <b>{output.title}</b>
                  <p>{output.message}</p>
                  <small>{output.totalTests} test cases queued</small>
                </div>
              </div>
            }

            {output?.type==="error" &&
              <div className="result error-result">
                <XCircle/>
                <div>
                  <b>{output.title}</b>
                  <p>{output.message}</p>
                </div>
              </div>
            }
          </div>
        </div>

      </section>}
    </div>}

    {tab==="leaderboard" &&
      <Leaderboard API={API}/>
    }

  </main>
 </div>
}

function Leaderboard({API}:{API:string}){
 const [rows,setRows]=useState<any[]>([]);

 useEffect(()=>{
   fetch(API+"/leaderboard").then(r=>r.json()).then(setRows);
 },[]);

 return <section className="leaderboard">
   <div className="leader-hero">
     <Trophy size={34}/>
     <div>
       <span>GLOBAL RANKING</span>
       <h2>TOP CODERS</h2>
     </div>
   </div>

   <div className="leader-head">
     <span>#</span><span>PLAYER</span><span>RATING</span><span>LEVEL</span><span>EDGE</span>
   </div>

   {rows.map((r,i)=>
     <div className="leader-row" key={r.id}>
       <strong>{String(i+1).padStart(2,"0")}</strong>
       <div className="leader-player">
         <div className="avatar">{r.username?.[0]}</div>
         <b>{r.username}</b>
       </div>
       <b>{r.rating}</b>
       <span>LVL {r.level}</span>
       <span>{r.currentEdge}</span>
     </div>
   )}
 </section>
}

createRoot(document.getElementById("root")!).render(<App/>);
