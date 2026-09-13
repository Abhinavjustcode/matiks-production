import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import websocket from "@fastify/websocket";
import Redis from "ioredis";
import {PrismaClient} from "@prisma/client";
import {nanoid} from "nanoid";
import {z} from "zod";
import {updateBrain,matchScore} from "../../../packages/brain/src/index.js";

async function main() {

const prisma=new PrismaClient();
const redis=new Redis(process.env.REDIS_URL||"redis://localhost:6379");
const app=Fastify({logger:true});

await app.register(helmet);
await app.register(cors,{origin:process.env.CORS_ORIGIN||true});
await app.register(rateLimit,{max:120,timeWindow:"1 minute"});
await app.register(jwt,{secret:process.env.JWT_SECRET||"dev-only-change-me"});
await app.register(websocket);

app.get("/health",async()=>({ok:true,service:"matiks-api",time:new Date().toISOString()}));

app.post("/auth/guest",async(req,reply)=>{
  const body=z.object({username:z.string().min(2).max(24).regex(/^[a-zA-Z0-9_]+$/)}).parse(req.body);
  const user=await prisma.user.upsert({
    where:{username:body.username},
    update:{},
    create:{username:body.username,brain:{create:{topicScores:{},recentResults:[]}}}
  });
  const token=await app.jwt.sign({sub:user.id,username:user.username});
  return {token,user:{id:user.id,username:user.username,rating:user.rating,level:user.level,currentEdge:user.currentEdge}};
});

app.decorate("auth",async(req:any,reply:any)=>{
  try{await req.jwtVerify()}catch{return reply.code(401).send({error:"unauthorized"})}
});

app.get("/me",{preHandler:(app as any).auth},async(req:any)=>{
  const id=(req as any).user.sub;
  return prisma.user.findUnique({where:{id},include:{brain:true}});
});

app.post("/matchmaking/join",{preHandler:(app as any).auth},async(req:any)=>{
  const userId=(req as any).user.sub;
  const user=await prisma.user.findUnique({where:{id:userId},include:{brain:true}});
  if(!user) return {error:"user not found"};
  const edge=user.currentEdge;
  const queueKey="matiks:queue";
  const entry={userId,edge,joinedAt:Date.now(),ticket:nanoid(10)};
  await redis.zadd(queueKey,edge,userId);
  await redis.hset(`matiks:ticket:${userId}`,entry as any);
  await redis.expire(`matiks:ticket:${userId}`,300);
  return {ticket:entry.ticket,status:"queued",currentEdge:edge,level:user.level};
});

app.post("/matchmaking/pair",{preHandler:(app as any).auth},async(req:any)=>{
  const userId=(req as any).user.sub;
  const user=await prisma.user.findUnique({where:{id:userId}});
  if(!user)return {error:"user not found"};
  const members=await redis.zrangebyscore("matiks:queue",Math.max(0,user.currentEdge-100),user.currentEdge+100);
  for(const otherId of members){
    if(otherId===userId)continue;
    const other=await prisma.user.findUnique({where:{id:otherId}});
    if(!other)continue;
    const waited=Number(req.headers["x-wait-seconds"]||0);
    if(matchScore(user.currentEdge,other.currentEdge,waited)>0){
      const match=await prisma.match.create({
        data:{id:nanoid(14),playerAId:userId,playerBId:otherId,status:"ACTIVE",targetEdge:Math.round((user.currentEdge+other.currentEdge)/2),startedAt:new Date()}
      });
      await redis.zrem("matiks:queue",userId,otherId);
      return {status:"matched",matchId:match.id,opponent:{id:other.id,username:other.username,rating:other.rating,level:other.level}};
    }
  }
  return {status:"queued"};
});

app.post("/matches/:matchId/answer",{preHandler:(app as any).auth},async(req:any,reply)=>{
  const userId=(req as any).user.sub;
  const body=z.object({questionId:z.string(),answer:z.string(),responseMs:z.number().int().min(0).max(120000)}).parse(req.body);
  const match = await prisma.match.findUnique({
      where: { id: req.params["matchId"] },
      include: {
        rounds: {
          include: { question: true },
          orderBy: { roundIndex: "asc" }
        }
      }
    });
  if(!match||match.status!=="ACTIVE")return reply.code(404).send({error:"match inactive"});
  if(match.playerAId!==userId&&match.playerBId!==userId)return reply.code(403).send({error:"not a player"});
  const q=await prisma.question.findUnique({where:{id:body.questionId}});
  if(!q)return reply.code(404).send({error:"question not found"});
  const correct=body.answer===q.correctAnswer;
  const user=await prisma.user.findUnique({where:{id:userId},include:{brain:true}});
  if(!user||!user.brain)return reply.code(500).send({error:"brain unavailable"});
  const brain=updateBrain({
    currentEdge:user.currentEdge,
    accuracyEma:user.brain.accuracyEma,
    speedEma:user.brain.speedEma,
    consistencyEma:user.brain.consistencyEma,
    confidence:user.brain.confidence,
    volatility:user.brain.volatility,
    topicScores:(user.brain.topicScores as Record<string,number>)||{},
    recentResults:(user.brain.recentResults as number[])||[]
  },{correct,responseMs:body.responseMs,expectedMs:q.estimatedMs,topic:q.topic});

  await prisma.$transaction([
    prisma.performance.create({data:{
      userId,questionId:q.id,matchId:match.id,correct,responseMs:body.responseMs,topic:q.topic,difficulty:q.difficulty,
      edgeBefore:user.currentEdge,edgeAfter:brain.currentEdge
    }}),
    prisma.user.update({where:{id:userId},data:{currentEdge:brain.currentEdge,level:brain.level,rating:{increment:correct?10:-6}}}),
    prisma.brainProfile.update({where:{userId},data:{
      accuracyEma:brain.accuracyEma,speedEma:brain.speedEma,consistencyEma:brain.consistencyEma,
      confidence:Math.min(1,user.brain.confidence*.9+.1),volatility:brain.volatility,
      topicScores:brain.topicScores,recentResults:brain.recentResults
    }})
  ]);

  return {correct,correctAnswer:process.env.NODE_ENV==="production"?undefined:q.correctAnswer,
    explanation:q.explanation,currentEdge:brain.currentEdge,level:brain.level,
    recommendedDifficulty:brain.recommendedDifficulty};
});

app.get("/leaderboard",async()=>prisma.user.findMany({orderBy:{rating:"desc"},take:100,select:{id:true,username:true,rating:true,level:true,currentEdge:true,streak:true}}));

app.get("/ws",{websocket:true},(socket:any)=>{
  socket.send(JSON.stringify({type:"connected",at:Date.now()}));
  socket.on("message",(raw:Buffer)=>{
    try{
      const msg=JSON.parse(raw.toString());
      if(msg.type==="ping")socket.send(JSON.stringify({type:"pong",at:Date.now()}));
    }catch{}
  });
});

app.addHook("onClose",async()=>{await redis.quit();await prisma.$disconnect()});
await app.listen({
  port: Number(process.env.PORT || 4000),
  host: "0.0.0.0"
});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
