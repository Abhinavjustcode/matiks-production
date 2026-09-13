
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import Redis from "ioredis";
import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";
import { z } from "zod";
import { updateBrain } from "../../../packages/brain/src/index.js";

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const app = Fastify({ logger: true });


function jsonNumberMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(value as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
  }
  return out;
}

function jsonNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (x): x is number => typeof x === "number" && Number.isFinite(x)
  );
}

async function main() {
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.WEB_ORIGIN || "http://localhost:5173",
  });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });
  await app.register(jwt, {
    secret: process.env.JWT_SECRET || "matiks-dev-secret-change-me",
  });
  await app.register(websocket);

  // -------------------------------------------------------
  // HEALTH
  // -------------------------------------------------------

  app.get("/", async () => ({
    name: "MATIKS API",
    version: "0.1.0",
    status: "online",
    platform: "competitive-coding",
  }));

  app.get("/health", async () => {
    let db = "ok";
    let redisStatus = "ok";

    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "error";
    }

    try {
      await redis.ping();
    } catch {
      redisStatus = "error";
    }

    return {
      ok: db === "ok" && redisStatus === "ok",
      service: "matiks-api",
      db,
      redis: redisStatus,
      time: new Date().toISOString(),
    };
  });

  // -------------------------------------------------------
  // AUTH
  // -------------------------------------------------------

  app.post("/auth/guest", async (req, reply) => {
    const body = z.object({
      username: z.string().min(2).max(24),
    }).parse(req.body);

    const username = body.username.trim().replace(/[^a-zA-Z0-9_]/g, "");

    if (!username) {
      return reply.code(400).send({ error: "Invalid username" });
    }

    const user = await prisma.user.upsert({
      where: { username: username.toUpperCase() },
      update: {},
      create: {
        username: username.toUpperCase(),
        rating: 1000,
        level: 1,
        currentEdge: 50,
        streak: 0,
      },
    });

    const token = app.jwt.sign({
      id: user.id,
      username: user.username,
    });

    return { token, user };
  });

  app.decorate("auth", async (req: any, reply: any) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });

  app.get("/me", { preHandler: (app as any).auth }, async (req: any) => {
    return prisma.user.findUnique({
      where: { id: req.user.id },
      include: { brain: true },
    });
  });

  // -------------------------------------------------------
  // PROBLEMS
  // -------------------------------------------------------

  app.get("/problems", async (req: any) => {
    const query = req.query || {};

    const where: any = {
      active: true,
    };

    if (query.domain) where.domain = query.domain;
    if (query.topic) where.topic = query.topic;

    if (query.difficulty) {
      where.difficulty = Number(query.difficulty);
    }

    return prisma.question.findMany({
      where,
      orderBy: [
        { difficulty: "asc" },
        { createdAt: "desc" },
      ],
      take: 100,
    });
  });

  app.get("/problems/:id", async (req: any, reply) => {
    const problem = await prisma.question.findUnique({
      where: { id: req.params.id },
    });

    if (!problem) {
      return reply.code(404).send({ error: "Problem not found" });
    }

    return problem;
  });

  // -------------------------------------------------------
  // SUBMISSIONS
  // -------------------------------------------------------

  app.post(
    "/submissions",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const body = z.object({
        problemId: z.string(),
        language: z.string(),
        code: z.string().max(100000),
      }).parse(req.body);

      const problem = await prisma.question.findUnique({
        where: { id: body.problemId },
      });

      if (!problem) {
        return reply.code(404).send({ error: "Problem not found" });
      }

      /*
       * MVP judge:
       * The real isolated compiler service should execute this job.
       * For now we persist the submission and return QUEUED.
       */

      const submissionId = nanoid(14);

      await redis.lpush(
        "matiks:submissions",
        JSON.stringify({
          id: submissionId,
          userId: req.user.id,
          ...body,
        })
      );

      return {
        id: submissionId,
        status: "QUEUED",
      };
    }
  );

  // -------------------------------------------------------
  // MATCHMAKING
  // -------------------------------------------------------

  app.post(
    "/matchmaking/join",
    { preHandler: (app as any).auth },
    async (req: any) => {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user) return { error: "User not found" };

      await redis.hset(
        `matiks:queue:${user.id}`,
        "userId",
        user.id,
        "rating",
        user.rating,
        "joinedAt",
        Date.now()
      );

      await redis.sadd("matiks:queue", user.id);

      return {
        queued: true,
        userId: user.id,
        rating: user.rating,
      };
    }
  );

  app.post(
    "/matchmaking/cancel",
    { preHandler: (app as any).auth },
    async (req: any) => {
      await redis.srem("matiks:queue", req.user.id);
      await redis.del(`matiks:queue:${req.user.id}`);

      return { cancelled: true };
    }
  );

  app.post(
    "/matchmaking/pair",
    { preHandler: (app as any).auth },
    async () => {
      const ids = await redis.smembers("matiks:queue");

      if (ids.length < 2) {
        return { matched: false };
      }

      const users = await prisma.user.findMany({
        where: { id: { in: ids } },
      });

      users.sort((a, b) => a.rating - b.rating);

      const a = users[0];
      const b = users[1];

      if (!a || !b) {
        return { matched: false };
      }

      const match = await prisma.match.create({
        data: {
          id: nanoid(16),
          playerAId: a.id,
          playerBId: b.id,
          targetEdge: Math.round((a.currentEdge + b.currentEdge) / 2),
          status: "ACTIVE",
          startedAt: new Date(),
        },
      });

      await redis.srem("matiks:queue", a.id, b.id);
      await redis.del(`matiks:queue:${a.id}`);
      await redis.del(`matiks:queue:${b.id}`);

      return {
        matched: true,
        match,
      };
    }
  );

  // -------------------------------------------------------
  // MATCH
  // -------------------------------------------------------

  app.get(
    "/matches/:matchId",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const match = await prisma.match.findUnique({
        where: { id: req.params.matchId },
        include: {
          rounds: {
            include: {
              question: true,
            },
            orderBy: { roundIndex: "asc" },
          },
          playerA: true,
          playerB: true,
        },
      });

      if (!match) {
        return reply.code(404).send({ error: "Match not found" });
      }

      return match;
    }
  );

  // -------------------------------------------------------
  // ANSWER
  // -------------------------------------------------------

  app.post(
    "/matches/:matchId/answer",
    { preHandler: (app as any).auth },
    async (req: any, reply) => {
      const body = z.object({
        questionId: z.string(),
        answer: z.string(),
        responseMs: z.number().int().positive().max(300000),
      }).parse(req.body);

      const match = await prisma.match.findUnique({
        where: { id: req.params.matchId },
      });

      const question = await prisma.question.findUnique({
        where: { id: body.questionId },
      });

      if (!match || !question) {
        return reply.code(404).send({ error: "Match/question not found" });
      }

      const correct = body.answer === question.correctAnswer;

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: { brain: true },
      });

      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      const brainInput = {
        currentEdge: user.currentEdge,
        accuracyEma: user.brain?.accuracyEma ?? 0.5,
        speedEma: user.brain?.speedEma ?? 0.5,
        consistencyEma: user.brain?.consistencyEma ?? 0.5,
        confidence: user.brain?.confidence ?? 0.2,
        volatility: user.brain?.volatility ?? 0,
        topicScores: user.brain?.topicScores ?? {},
        recentResults: user.brain?.recentResults ?? [],
      };

      const brain = updateBrain({
        currentEdge: Number(brainInput.currentEdge) || 50,
        accuracyEma: Number(brainInput.accuracyEma) || 0.5,
        speedEma: Number(brainInput.speedEma) || 0.5,
        consistencyEma: Number(brainInput.consistencyEma) || 0.5,
        confidence: Number(brainInput.confidence) || 0.2,
        volatility: Number(brainInput.volatility) || 0,
        topicScores:
          brainInput.topicScores &&
          typeof brainInput.topicScores === "object" &&
          !Array.isArray(brainInput.topicScores)
            ? Object.fromEntries(
                Object.entries(brainInput.topicScores as Record<string, unknown>)
                  .filter(([,v]) => typeof v === "number")
                  .map(([k,v]) => [k, Number(v)])
              )
            : {},
        recentResults:
          Array.isArray(brainInput.recentResults)
            ? brainInput.recentResults.filter((v): v is number => typeof v === "number")
            : [],
        
        recentResults: Array.isArray(brainInput.recentResults)
          ? brainInput.recentResults.filter(
              (x: unknown): x is number => typeof x === "number"
            )
          : [],
        topicScores:
          brainInput.topicScores &&
          typeof brainInput.topicScores === "object" &&
          !Array.isArray(brainInput.topicScores)
            ? Object.fromEntries(
                Object.entries(brainInput.topicScores as Record<string, unknown>)
                  .filter(([, v]) => typeof v === "number")
                  .map(([k, v]) => [k, v as number])
              )
            : {},
      }, {
        correct,
        responseMs: body.responseMs,
      });

      await prisma.performance.create({
        data: {
          userId: user.id,
          questionId: question.id,
          matchId: match.id,
          correct,
          responseMs: body.responseMs,
          topic: question.topic,
edgeBefore: user.currentEdge,
          edgeAfter: brain.currentEdge,
        },
      });

      await prisma.user.update({
        where: { id: user.id },
        data: {
          currentEdge: brain.currentEdge,
          level: brain.level,
        },
      });

      return {
        correct,
        correctAnswer:
          process.env.NODE_ENV === "production"
            ? undefined
            : question.correctAnswer,
        explanation: question.explanation,
        brain,
      };
    }
  );

  // -------------------------------------------------------
  // LEADERBOARD
  // -------------------------------------------------------

  
// ============================================================
// CODING ARENA
// ============================================================

app.get("/problems", async (req:any) => {
  const q=req.query||{};
  const where:any={active:true};

  const problems=await prisma.codingProblem.findMany({
    where,
    orderBy:{createdAt:"asc"},
    select:{
      id:true,slug:true,title:true,difficulty:true,
      description:true,examples:true,constraints:true,tags:true,
      starterCode:true
    }
  });

  return q.difficulty
    ? problems.filter((p:any)=>p.difficulty===String(q.difficulty).toUpperCase())
    : problems;
});

app.get("/problems/:id", async (req:any,reply) => {
  const p=await prisma.codingProblem.findFirst({
    where:{OR:[{id:req.params.id},{slug:req.params.id}]},
    select:{
      id:true,slug:true,title:true,difficulty:true,description:true,
      starterCode:true,examples:true,constraints:true,tags:true
    }
  });

  if(!p) return reply.code(404).send({error:"Problem not found"});
  return p;
});

app.get("/submissions",{preHandler:(app as any).auth},async(req:any)=>{
  return prisma.submission.findMany({
    where:{userId:req.user.id},
    orderBy:{createdAt:"desc"},
    take:20,
    include:{problem:{select:{title:true,difficulty:true}}}
  });
});

app.post("/submissions",{preHandler:(app as any).auth},async(req:any,reply)=>{
  const body=z.object({
    problemId:z.string(),
    language:z.enum(["javascript","python","cpp","java"]),
    code:z.string().min(1).max(100000),
    mode:z.enum(["run","submit"]).default("submit")
  }).parse(req.body);

  const problem=await prisma.codingProblem.findUnique({
    where:{id:body.problemId}
  });

  if(!problem) return reply.code(404).send({error:"Problem not found"});

  // Execution engine is intentionally isolated from the API process.
  // For now this creates a real submission record and returns a safe
  // pending result. The sandbox runner is the next backend layer.
  const totalTests=Array.isArray(problem.testCases)?problem.testCases.length:0;

  const submission=await prisma.submission.create({
    data:{
      userId:req.user.id,
      problemId:problem.id,
      language:body.language,
      code:body.code,
      status:"PENDING",
      totalTests
    }
  });

  return {
    submissionId:submission.id,
    status:"PENDING",
    message:"Submission queued for isolated execution.",
    totalTests
  };
});

app.get("/submissions/:id",{preHandler:(app as any).auth},async(req:any,reply)=>{
  const submission=await prisma.submission.findFirst({
    where:{id:req.params.id,userId:req.user.id},
    include:{problem:{select:{title:true,difficulty:true}}}
  });

  if(!submission) return reply.code(404).send({error:"Submission not found"});
  return submission;
});

app.get("/leaderboard", async () => {
    return prisma.user.findMany({
      orderBy: { rating: "desc" },
      take: 100,
      select: {
        id: true,
        username: true,
        rating: true,
        level: true,
        currentEdge: true,
        streak: true,
      },
    });
  });

  // -------------------------------------------------------
  // WEBSOCKET
  // -------------------------------------------------------

  app.get("/ws", { websocket: true }, (socket: any) => {
    socket.send(JSON.stringify({
      type: "connected",
      at: Date.now(),
    }));

    socket.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === "ping") {
          socket.send(JSON.stringify({
            type: "pong",
            at: Date.now(),
          }));
        }

        if (msg.type === "join_match") {
          socket.send(JSON.stringify({
            type: "match_joined",
            matchId: msg.matchId,
          }));
        }
      } catch {}
    });
  });

  app.addHook("onClose", async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  await app.listen({
    port: Number(process.env.PORT || 4000),
    host: "0.0.0.0",
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
