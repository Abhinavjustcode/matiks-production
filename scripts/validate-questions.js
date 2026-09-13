import { z } from "zod";
const Q = z.object({
    id: z.string(), domain: z.string(), type: z.enum(["MCQ", "OUTPUT", "DEBUG", "COMPLEXITY", "CODE"]),
    topic: z.string(), difficulty: z.number().int().min(1).max(200), statement: z.string().min(10),
    correctAnswer: z.string().min(1), explanation: z.string().min(10), estimatedMs: z.number().int().min(2000).max(60000)
});
console.log("Validator ready. Wire it to the DB ingestion worker before activating generated questions.");
