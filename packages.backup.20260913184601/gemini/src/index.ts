import {GoogleGenAI} from "@google/genai";
import {z} from "zod";

const QuestionSchema=z.object({
  id:z.string(),
  domain:z.string(),
  language:z.string().nullable(),
  type:z.enum(["MCQ","OUTPUT","DEBUG","COMPLEXITY","CODE"]),
  topic:z.string(),
  difficulty:z.number().int().min(1).max(200),
  statement:z.string(),
  code:z.string().nullable(),
  options:z.array(z.string()).nullable(),
  correctAnswer:z.string(),
  explanation:z.string(),
  estimatedMs:z.number().int().min(2000).max(60000)
});

export type GeneratedQuestion=z.infer<typeof QuestionSchema>;

const ai=()=>new GoogleGenAI({apiKey:process.env.GEMINI_API_KEY});

export async function generateQuestionBatch(input:{
  language:string; topics:string[]; count:number; minDifficulty:number; maxDifficulty:number;
}):Promise<GeneratedQuestion[]>{
  if(!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");
  const prompt=`You are the MATIKS competitive programming question engine.
Generate ${input.count} original, technically correct ${input.language} questions.
Topics: ${input.topics.join(", ")}.
Difficulty range: ${input.minDifficulty}-${input.maxDifficulty}.
Mix MCQ, OUTPUT, DEBUG, COMPLEXITY and CODE.
Every question must have exactly one unambiguous correct answer.
For MCQ/OUTPUT/DEBUG/COMPLEXITY, options should normally contain 4 close distractors.
Do not copy known contest statements. Prefer compact duel-friendly questions.
Return JSON only.`;

  const interaction=await ai().interactions.create({
    model:process.env.GEMINI_MODEL||"gemini-3.8-flash",
    input:prompt,
    response_format:{
      type:"text",
      mime_type:"application/json",
      schema:{
        type:"object",
        properties:{questions:{type:"array",items:{
          type:"object",
          properties:{
            id:{type:"string"},domain:{type:"string"},language:{type:["string","null"]},
            type:{type:"string",enum:["MCQ","OUTPUT","DEBUG","COMPLEXITY","CODE"]},
            topic:{type:"string"},difficulty:{type:"integer",minimum:1,maximum:200},
            statement:{type:"string"},code:{type:["string","null"]},
            options:{type:["array","null"],items:{type:"string"}},
            correctAnswer:{type:"string"},explanation:{type:"string"},
            estimatedMs:{type:"integer",minimum:2000,maximum:60000}
          },
          required:["id","domain","language","type","topic","difficulty","statement","code","options","correctAnswer","explanation","estimatedMs"]
        }}},
        required:["questions"]
      }
    }
  });
  const raw=JSON.parse(interaction.output_text||"{}");
  return z.array(QuestionSchema).parse(raw.questions);
}
