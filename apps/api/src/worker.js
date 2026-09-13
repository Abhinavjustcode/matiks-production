import { Worker } from "bullmq";
import Redis from "ioredis";
import { generateQuestionBatch } from "../../../packages/gemini/src/index.js";
const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", { maxRetriesPerRequest: null });
const worker = new Worker("question-generation", async (job) => {
    const { language, topics, count, minDifficulty, maxDifficulty } = job.data;
    const questions = await generateQuestionBatch({ language, topics, count, minDifficulty, maxDifficulty });
    // In production: persist through Prisma here after deterministic validation.
    console.log(`Generated ${questions.length} ${language} questions for job ${job.id}`);
    return { count: questions.length };
}, { connection });
worker.on("completed", job => console.log("question job complete", job.id));
worker.on("failed", (job, err) => console.error("question job failed", job?.id, err));
