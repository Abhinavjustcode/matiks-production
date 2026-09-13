import {Queue} from "bullmq";
import Redis from "ioredis";
import "dotenv/config";

const connection=new Redis(process.env.REDIS_URL||"redis://localhost:6379",{maxRetriesPerRequest:null});
const queue=new Queue("question-generation",{connection});

const languages=["C++","Python","JavaScript","Java"];
const topics={
  "C++":["types","operators","loops","arrays","strings","pointers","references","STL","complexity","debugging","OOP","memory"],
  "Python":["types","slicing","loops","lists","dicts","functions","exceptions","complexity","debugging","OOP"],
  "JavaScript":["types","closures","arrays","objects","promises","async","DOM","complexity","debugging","events"],
  "Java":["types","collections","loops","strings","OOP","exceptions","streams","complexity","debugging"]
};

for(const language of languages){
  for(let batch=0;batch<10;batch++){
    await queue.add("generate",{
      language,topics:topics[language as keyof typeof topics],
      count:25,minDifficulty:1+batch*20,maxDifficulty:Math.min(200,(batch+1)*20)
    },{removeOnComplete:100,removeOnFail:100});
  }
}
console.log("Queued 1,000+ questions for Gemini generation.");
await queue.close();await connection.quit();
