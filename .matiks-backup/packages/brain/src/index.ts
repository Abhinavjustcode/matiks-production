export type BrainInput = {
  currentEdge: number;
  accuracyEma: number;
  speedEma: number;
  consistencyEma: number;
  confidence: number;
  volatility: number;
  topicScores: Record<string, number>;
  recentResults: number[];
};

export type BrainOutput = BrainInput & {
  level: number;
  recommendedDifficulty: number;
  recommendedRange: number;
  confidenceBand: "low" | "medium" | "high";
};

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

/**
 * MATIKS Brain:
 * - currentEdge is the live skill estimate.
 * - accuracy/speed/consistency are exponentially smoothed.
 * - volatility prevents one lucky/unlucky round from moving the player too far.
 * - topic weakness is used for question selection, not direct rating manipulation.
 *
 * Gemini is deliberately NOT in this hot path. Deterministic scoring makes
 * matchmaking fast, cheap and reproducible. Gemini handles offline analysis,
 * generation and explanations.
 */
export function updateBrain(input:BrainInput, result:{
  correct:boolean; responseMs:number; expectedMs:number; topic:string;
}):BrainOutput{
  const accuracy=result.correct?1:0;
  const speed=clamp(1-result.responseMs/(Math.max(result.expectedMs,1)*2),0,1);
  const alpha=.18;
  const accuracyEma=input.accuracyEma*(1-alpha)+accuracy*alpha;
  const speedEma=input.speedEma*(1-alpha)+speed*alpha;
  const recent=[...input.recentResults,accuracy].slice(-20);
  const consistency=recent.reduce((a,b)=>a+b,0)/Math.max(recent.length,1);
  const delta=(accuracy-.5)*10 + (speed-.5)*6;
  const volatility=Math.abs(delta)*.12 + input.volatility*.88;
  const edge=clamp(Math.round(input.currentEdge + delta*(1-Math.min(volatility/10,.65))),1,200);
  const topicScores={...input.topicScores};
  topicScores[result.topic]=Math.round((topicScores[result.topic]??50)*.82+accuracy*100*.18);
  const level=clamp(Math.floor((edge-1)/10)+1,1,20);
  const recommendedDifficulty=clamp(Math.round(edge),1,200);
  const recommendedRange=100+Math.floor(edge/25)*50;
  const confidence=clamp(input.confidence*.85+Math.min(recent.length/20,1)*.15,0,1);
  return {
    ...input, accuracyEma, speedEma, consistencyEma:consistency,
    volatility, currentEdge:edge, level, recommendedDifficulty,
    recommendedRange, confidenceBand:confidence<.35?"low":confidence<.7?"medium":"high"
  };
}

export function rankDistance(a:number,b:number){return Math.abs(a-b)}
export function matchScore(a:number,b:number,waitSeconds:number){
  const base=rankDistance(a,b);
  const allowed=100+Math.floor(waitSeconds/3)*50;
  return base<=allowed ? Math.max(1,100-base/allowed*100) : 0;
}
