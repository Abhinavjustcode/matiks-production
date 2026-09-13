import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const qs = Array.from({ length: 100 }, (_, i) => ({
    id: `starter-${i + 1}`,
    domain: "cpp", language: "C++", type: (i % 4 === 0 ? "OUTPUT" : i % 4 === 1 ? "MCQ" : i % 4 === 2 ? "COMPLEXITY" : "DEBUG"),
    topic: ["types", "loops", "arrays", "strings", "complexity", "debugging", "pointers", "STL"][i % 8],
    difficulty: Math.min(200, 5 + (i % 20) * 10),
    statement: `Starter MATIKS C++ challenge #${i + 1}: choose the correct result for this compact technical challenge.`,
    code: i % 2 === 0 ? "int x = 5; cout << x + 2;" : null,
    options: ["5", "6", "7", "8"],
    correctAnswer: "7",
    explanation: "The expression evaluates to 7.",
    estimatedMs: 5000 + (i % 5) * 500, qualityScore: 80, source: "starter"
}));
await prisma.question.createMany({ data: qs, skipDuplicates: true });
const u = await prisma.user.upsert({ where: { username: "ABHINAV" }, update: {}, create: { username: "ABHINAV", brain: { create: { topicScores: {}, recentResults: [] } } } });
console.log("Seeded", qs.length, "questions and user", u.username);
await prisma.$disconnect();
