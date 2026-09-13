import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Code2, Trophy, Swords, Users, Clock3, Play, Send, XCircle, Loader2, Terminal } from "lucide-react";
import "./styles.css";
const API = "http://localhost:4000";
function App() {
    const [token, setToken] = useState(localStorage.getItem("matiks-token") || "");
    const [user, setUser] = useState(null);
    const [problems, setProblems] = useState([]);
    const [problem, setProblem] = useState(null);
    const [code, setCode] = useState("");
    const [language, setLanguage] = useState("javascript");
    const [output, setOutput] = useState(null);
    const [running, setRunning] = useState(false);
    const [time, setTime] = useState(240);
    const [tab, setTab] = useState("arena");
    useEffect(() => {
        if (!token)
            return;
        fetch(API + "/me", { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.json()).then(setUser).catch(() => { });
    }, [token]);
    useEffect(() => {
        fetch(API + "/problems").then(r => r.json()).then((x) => {
            setProblems(x);
            if (x[0])
                setProblem(x[0]);
        });
    }, []);
    useEffect(() => {
        if (!problem)
            return;
        setCode(problem.starterCode?.[language] || "");
    }, [problem, language]);
    useEffect(() => {
        if (!problem || tab !== "arena")
            return;
        const id = setInterval(() => setTime(t => t > 0 ? t - 1 : 0), 1000);
        return () => clearInterval(id);
    }, [problem, tab]);
    async function login() {
        const r = await fetch(API + "/auth/guest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: "ABHINAV" })
        });
        const x = await r.json();
        localStorage.setItem("matiks-token", x.token);
        setToken(x.token);
        setUser(x.user);
    }
    async function submit(mode) {
        if (!token) {
            await login();
            return;
        }
        if (!problem)
            return;
        setRunning(true);
        setOutput(null);
        try {
            const r = await fetch(API + "/submissions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    problemId: problem.id,
                    language,
                    code,
                    mode
                })
            });
            const x = await r.json();
            if (!r.ok)
                throw new Error(x.error || "Submission failed");
            setOutput({
                type: "pending",
                title: mode === "run" ? "RUN QUEUED" : "SUBMITTED",
                ...x
            });
        }
        catch (e) {
            setOutput({ type: "error", title: "ERROR", message: e.message });
        }
        finally {
            setRunning(false);
        }
    }
    function fmt(t) {
        return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    }
    return _jsxs("div", { className: "shell", children: [_jsxs("aside", { className: "sidebar", children: [_jsx("div", { className: "logo", children: "\u221E MATIKS" }), _jsxs("button", { className: tab === "arena" ? "side active" : "side", onClick: () => setTab("arena"), children: [_jsx(Code2, {}), " CODING ARENA"] }), _jsxs("button", { className: tab === "leaderboard" ? "side active" : "side", onClick: () => setTab("leaderboard"), children: [_jsx(Trophy, {}), " LEADERBOARD"] }), _jsxs("button", { className: "side", children: [_jsx(Swords, {}), " DUELS"] }), _jsxs("button", { className: "side", children: [_jsx(Users, {}), " PLAYERS"] }), _jsx("div", { className: "side-bottom", children: _jsxs("div", { className: "profile", children: [_jsx("div", { className: "avatar", children: "A" }), _jsxs("div", { children: [_jsx("b", { children: user?.username || "GUEST" }), _jsxs("small", { children: [user?.rating || 1000, " RATING"] })] })] }) })] }), _jsxs("main", { className: "main", children: [_jsxs("header", { className: "topbar", children: [_jsxs("div", { children: [_jsx("span", { className: "eyebrow", children: "MATIKS / COMPETE" }), _jsx("h1", { children: tab === "arena" ? "CODING ARENA" : "GLOBAL LEADERBOARD" })] }), _jsxs("div", { className: "stats", children: [_jsxs("span", { children: ["\uD83D\uDD25 ", user?.streak || 0] }), _jsxs("span", { children: ["\u25C6 ", user?.rating || 1000] })] })] }), tab === "arena" && _jsxs("div", { className: "arena-layout", children: [_jsxs("section", { className: "problems-panel", children: [_jsxs("div", { className: "panel-head", children: [_jsx("span", { children: "PROBLEMS" }), _jsxs("small", { children: [problems.length, " AVAILABLE"] })] }), problems.map((p, i) => _jsxs("button", { className: problem?.id === p.id ? "problem active" : "problem", onClick: () => { setProblem(p); setTime(240); }, children: [_jsx("div", { className: "problem-number", children: String(i + 1).padStart(2, "0") }), _jsxs("div", { className: "problem-info", children: [_jsx("b", { children: p.title }), _jsx("small", { children: p.tags?.slice(0, 2).join(" · ") })] }), _jsx("span", { className: "difficulty " + p.difficulty.toLowerCase(), children: p.difficulty })] }, p.id)), _jsxs("div", { className: "brain-card", children: [_jsx("span", { children: "MATIKS BRAIN" }), _jsx("strong", { children: "ADAPTIVE MODE" }), _jsx("p", { children: "Difficulty will adapt to your performance." })] })] }), problem && _jsxs("section", { className: "workspace", children: [_jsxs("div", { className: "problem-view", children: [_jsxs("div", { className: "problem-top", children: [_jsxs("div", { children: [_jsx("span", { className: "difficulty " + problem.difficulty.toLowerCase(), children: problem.difficulty }), _jsx("h2", { children: problem.title })] }), _jsxs("div", { className: "timer " + (time < 30 ? "danger" : ""), children: [_jsx(Clock3, { size: 17 }), fmt(time)] })] }), _jsx("p", { className: "description", children: problem.description }), _jsx("h3", { children: "EXAMPLES" }), _jsx("div", { className: "examples", children: problem.examples?.map((e, i) => _jsxs("div", { className: "example", children: [_jsxs("span", { children: ["Example ", i + 1] }), _jsxs("code", { children: ["Input: ", e.input] }), _jsxs("code", { children: ["Output: ", e.output] })] }, i)) }), problem.constraints && _jsxs(_Fragment, { children: [_jsx("h3", { children: "CONSTRAINTS" }), _jsx("p", { className: "constraints", children: problem.constraints })] })] }), _jsxs("div", { className: "editor-panel", children: [_jsxs("div", { className: "editor-toolbar", children: [_jsxs("select", { value: language, onChange: e => setLanguage(e.target.value), children: [_jsx("option", { value: "javascript", children: "JavaScript" }), _jsx("option", { value: "python", children: "Python" }), _jsx("option", { value: "cpp", children: "C++" }), _jsx("option", { value: "java", children: "Java" })] }), _jsxs("div", { className: "editor-actions", children: [_jsxs("button", { onClick: () => submit("run"), disabled: running, children: [running ? _jsx(Loader2, { className: "spin" }) : _jsx(Play, {}), "RUN"] }), _jsxs("button", { className: "submit", onClick: () => submit("submit"), disabled: running, children: [running ? _jsx(Loader2, { className: "spin" }) : _jsx(Send, {}), "SUBMIT"] })] })] }), _jsx("textarea", { spellCheck: false, value: code, onChange: e => setCode(e.target.value), className: "code-editor" }), _jsxs("div", { className: "console", children: [_jsxs("div", { className: "console-head", children: [_jsxs("span", { children: [_jsx(Terminal, { size: 15 }), " TEST OUTPUT"] }), output?.type === "pending" && _jsx("span", { className: "pending", children: "QUEUED" })] }), !output && _jsxs("div", { className: "empty-console", children: [_jsx(Terminal, { size: 25 }), _jsx("p", { children: "Run your code to see results." })] }), output?.type === "pending" &&
                                                        _jsxs("div", { className: "result pending-result", children: [_jsx(Loader2, { className: "spin" }), _jsxs("div", { children: [_jsx("b", { children: output.title }), _jsx("p", { children: output.message }), _jsxs("small", { children: [output.totalTests, " test cases queued"] })] })] }), output?.type === "error" &&
                                                        _jsxs("div", { className: "result error-result", children: [_jsx(XCircle, {}), _jsxs("div", { children: [_jsx("b", { children: output.title }), _jsx("p", { children: output.message })] })] })] })] })] })] }), tab === "leaderboard" &&
                        _jsx(Leaderboard, { API: API })] })] });
}
function Leaderboard({ API }) {
    const [rows, setRows] = useState([]);
    useEffect(() => {
        fetch(API + "/leaderboard").then(r => r.json()).then(setRows);
    }, []);
    return _jsxs("section", { className: "leaderboard", children: [_jsxs("div", { className: "leader-hero", children: [_jsx(Trophy, { size: 34 }), _jsxs("div", { children: [_jsx("span", { children: "GLOBAL RANKING" }), _jsx("h2", { children: "TOP CODERS" })] })] }), _jsxs("div", { className: "leader-head", children: [_jsx("span", { children: "#" }), _jsx("span", { children: "PLAYER" }), _jsx("span", { children: "RATING" }), _jsx("span", { children: "LEVEL" }), _jsx("span", { children: "EDGE" })] }), rows.map((r, i) => _jsxs("div", { className: "leader-row", children: [_jsx("strong", { children: String(i + 1).padStart(2, "0") }), _jsxs("div", { className: "leader-player", children: [_jsx("div", { className: "avatar", children: r.username?.[0] }), _jsx("b", { children: r.username })] }), _jsx("b", { children: r.rating }), _jsxs("span", { children: ["LVL ", r.level] }), _jsx("span", { children: r.currentEdge })] }, r.id))] });
}
createRoot(document.getElementById("root")).render(_jsx(App, {}));
