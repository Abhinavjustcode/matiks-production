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
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

function jsonNumberArray(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((v): v is number => typeof v === "number" && Number.isFinite(v))
    : [];
}

async function main() {
  await app.register(helmet);
  await app.register(cors, { origin: process.env.WEB_ORIGIN || "http://localhost:5173" });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  await app.register(jwt, { secret: process.env.JWT_SECRET || "matiks-dev-secret-change-me" });
  await app.register(websocket);

  app.get("/", async () => ({
    name: "MATIKS API", version: "1.0.0", status: "online",
    platform: "competitive-coding",
  }));

  app.get("/health", async () => {
    let db = "ok", redisStatus = "ok";
    try { await prisma.$queryRaw`SELECT 1`; } catch { db = "error"; }
    try { await redis.ping(); } catch { redisStatus = "error"; }
    return { ok: db === "ok" && redisStatus === "ok", service: "matiks-api", db, redis: redisStatus, time: new Date().toISOString() };
  });

  app.decorate("auth", async (req: any, reply: any) => {
    try { await req.jwtVerify(); }
    catch { return reply.code(401).send({ error: "Unauthorized" }); }
  });

  app.post("/auth/guest", async (req: any) => {
    const body = z.object({ username: z.string().min(2).max(24) }).parse(req.body);
    const username = body.username.trim().replace(/[^a-zA-Z0-9_]/g, "").toUpperCase();
    if (!username) throw new Error("Invalid username");

    const user = await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username },
    });
    const token = app.jwt.sign({ id: user.id, username: user.username });
    return { token, user };
  });

  app.get("/me", { preHandler: (app as any).auth }, async (req: any) =>
    prisma.user.findUnique({ where: { id: req.user.id }, include: { brain: true } })
  );

  // Coding problem API
  app.get("/problems", async (req: any) => {
    const q = req.query || {};
    const where: any = { active: true };
    if (q.difficulty) where.difficulty = String(q.difficulty).toUpperCase();
    return prisma.codingProblem.findMany({
      where,
      orderBy: { createdAt: "asc" },
      select: {
        id: true, slug: true, title: true, difficulty: true,
        description: true, examples: true, constraints: true,
        tags: true, starterCode: true,
      },
    });
  });

  app.get("/problems/:id", async (req: any, reply) => {
    const problem = await prisma.codingProblem.findFirst({
      where: { OR: [{ id: req.params.id }, { slug: req.params.id }], active: true },
      select: {
        id: true, slug: true, title: true, difficulty: true,
        description: true, examples: true, constraints: true,
        tags: true, starterCode: true,
      },
    });
    if (!problem) return reply.code(404).send({ error: "Problem not found" });
    return problem;
  });

  // Coding submissions are persisted and queued for the worker.
  app.post("/submissions", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const body = z.object({
      problemId: z.string(),
      language: z.enum(["javascript", "python", "cpp", "java"]),
      code: z.string().min(1).max(100000),
      mode: z.enum(["run", "submit"]).default("submit"),
    }).parse(req.body);

    const problem = await prisma.codingProblem.findUnique({ where: { id: body.problemId } });
    if (!problem) return reply.code(404).send({ error: "Problem not found" });

    const totalTests = Array.isArray(problem.testCases) ? problem.testCases.length : 0;
    const submission = await prisma.submission.create({
      data: {
        userId: req.user.id, problemId: problem.id, language: body.language,
        code: body.code, totalTests, status: "PENDING",
      },
    });

    await redis.lpush("matiks:submissions", JSON.stringify({
      id: submission.id, mode: body.mode, userId: req.user.id,
    }));

    return {
      submissionId: submission.id,
      status: submission.status,
      totalTests,
      message: body.mode === "run" ? "Run queued." : "Submission queued.",
    };
  });

  app.get("/submissions", { preHandler: (app as any).auth }, async (req: any) =>
    prisma.submission.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { problem: { select: { title: true, difficulty: true } } },
    })
  );

  app.get("/submissions/:id", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const s = await prisma.submission.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { problem: { select: { title: true, difficulty: true } } },
    });
    if (!s) return reply.code(404).send({ error: "Submission not found" });
    return s;
  });

  // Matchmaking
  app.post("/matchmaking/join", { preHandler: (app as any).auth }, async (req: any) => {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return { queued: false, error: "User not found" };
    await redis.hset(`matiks:queue:${user.id}`, "userId", user.id, "rating", user.rating, "joinedAt", Date.now());
    await redis.sadd("matiks:queue", user.id);
    return { queued: true, userId: user.id, rating: user.rating };
  });

  app.post("/matchmaking/cancel", { preHandler: (app as any).auth }, async (req: any) => {
    await redis.srem("matiks:queue", req.user.id);
    await redis.del(`matiks:queue:${req.user.id}`);
    return { cancelled: true };
  });

  app.post("/matchmaking/pair", { preHandler: (app as any).auth }, async () => {
    const ids = await redis.smembers("matiks:queue");
    if (ids.length < 2) return { matched: false };
    const users = await prisma.user.findMany({ where: { id: { in: ids } } });
    users.sort((a, b) => a.rating - b.rating);
    const a = users[0], b = users[1];
    if (!a || !b) return { matched: false };

    const match = await prisma.match.create({
      data: {
        id: nanoid(16), playerAId: a.id, playerBId: b.id,
        targetEdge: Math.round((a.currentEdge + b.currentEdge) / 2),
        status: "ACTIVE", startedAt: new Date(),
      },
    });
    await redis.srem("matiks:queue", a.id, b.id);
    await redis.del(`matiks:queue:${a.id}`, `matiks:queue:${b.id}`);
    return { matched: true, match };
  });

  app.get("/matches/:matchId", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const match = await prisma.match.findUnique({
      where: { id: req.params.matchId },
      include: { rounds: { include: { question: true }, orderBy: { roundIndex: "asc" } }, playerA: true, playerB: true },
    });
    if (!match) return reply.code(404).send({ error: "Match not found" });
    return match;
  });

  app.post("/matches/:matchId/answer", { preHandler: (app as any).auth }, async (req: any, reply) => {
    const body = z.object({
      questionId: z.string(), answer: z.string(),
      responseMs: z.number().int().positive().max(300000),
    }).parse(req.body);

    const [match, question, user] = await Promise.all([
      prisma.match.findUnique({ where: { id: req.params.matchId } }),
      prisma.question.findUnique({ where: { id: body.questionId } }),
      prisma.user.findUnique({ where: { id: req.user.id }, include: { brain: true } }),
    ]);
    if (!match || !question) return reply.code(404).send({ error: "Match/question not found" });
    if (!user) return reply.code(404).send({ error: "User not found" });

    const input = {
      currentEdge: user.currentEdge,
      accuracyEma: user.brain?.accuracyEma ?? 0.5,
      speedEma: user.brain?.speedEma ?? 0.5,
      consistencyEma: user.brain?.consistencyEma ?? 0.5,
      confidence: user.brain?.confidence ?? 0.2,
      volatility: user.brain?.volatility ?? 0,
      topicScores: jsonNumberMap(user.brain?.topicScores),
      recentResults: jsonNumberArray(user.brain?.recentResults),
    };

    const correct = body.answer === question.correctAnswer;
    const brain = updateBrain(input, {
      correct, responseMs: body.responseMs, expectedMs: question.estimatedMs,
      topic: question.topic,
    });

    await prisma.$transaction([
      prisma.performance.create({
        data: {
          userId: user.id, questionId: question.id, matchId: match.id,
          correct, responseMs: body.responseMs, topic: question.topic,
          difficulty: question.difficulty, edgeBefore: user.currentEdge,
          edgeAfter: brain.currentEdge,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: { currentEdge: brain.currentEdge, level: brain.level },
      }),
      prisma.brainProfile.upsert({
        where: { userId: user.id },
        update: {
          accuracyEma: brain.accuracyEma, speedEma: brain.speedEma,
          consistencyEma: brain.consistencyEma, confidence: brain.confidence,
          volatility: brain.volatility, topicScores: brain.topicScores,
          recentResults: brain.recentResults,
        },
        create: {
          userId: user.id, accuracyEma: brain.accuracyEma,
          speedEma: brain.speedEma, consistencyEma: brain.consistencyEma,
          confidence: brain.confidence, volatility: brain.volatility,
          topicScores: brain.topicScores, recentResults: brain.recentResults,
        },
      }),
    ]);

    return {
      correct,
      correctAnswer: process.env.NODE_ENV === "production" ? undefined : question.correctAnswer,
      explanation: question.explanation,
      brain,
    };
  });

  app.get("/leaderboard", async () =>
    prisma.user.findMany({
      orderBy: { rating: "desc" }, take: 100,
      select: { id: true, username: true, rating: true, level: true, currentEdge: true, streak: true },
    })
  );

  app.get("/ws", { websocket: true }, (socket: any) => {
    socket.send(JSON.stringify({ type: "connected", at: Date.now() }));
    socket.on("message", (raw: Buffer) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") socket.send(JSON.stringify({ type: "pong", at: Date.now() }));
        if (msg.type === "join_match") socket.send(JSON.stringify({ type: "match_joined", matchId: msg.matchId }));
      } catch {}
    });
  });

  app.addHook("onClose", async () => {
    await redis.quit();
    await prisma.$disconnect();
  });

  await app.listen({ port: Number(process.env.PORT || 4000), host: "0.0.0.0" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
