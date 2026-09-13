const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function updateBrain(input, result) {
    const accuracy = result.correct ? 1 : 0;
    const speed = clamp(1 - result.responseMs / Math.max(result.expectedMs, 1) / 2, 0, 1);
    const alpha = 0.18;
    const accuracyEma = input.accuracyEma * (1 - alpha) + accuracy * alpha;
    const speedEma = input.speedEma * (1 - alpha) + speed * alpha;
    const recentResults = [...input.recentResults, accuracy].slice(-20);
    const consistency = recentResults.reduce((a, b) => a + b, 0) / Math.max(recentResults.length, 1);
    const delta = (accuracy - 0.5) * 10 + (speed - 0.5) * 6;
    const volatility = Math.abs(delta) * 0.12 + input.volatility * 0.88;
    const edge = clamp(Math.round(input.currentEdge + delta * (1 - Math.min(volatility / 10, 0.65))), 1, 200);
    const topicScores = { ...input.topicScores };
    topicScores[result.topic] = Math.round((topicScores[result.topic] ?? 50) * 0.82 + accuracy * 100 * 0.18);
    const level = clamp(Math.floor((edge - 1) / 10) + 1, 1, 20);
    const recommendedDifficulty = clamp(Math.round(edge), 1, 200);
    const recommendedRange = 100 + Math.floor(edge / 25) * 50;
    const confidence = clamp(input.confidence * 0.85 + Math.min(recentResults.length / 20, 1) * 0.15, 0, 1);
    return {
        ...input,
        accuracyEma,
        speedEma,
        consistencyEma: consistency,
        volatility,
        currentEdge: edge,
        topicScores,
        recentResults,
        level,
        recommendedDifficulty,
        recommendedRange,
        confidenceBand: confidence < 0.35 ? "low" : confidence < 0.7 ? "medium" : "high",
        confidence,
    };
}
export function rankDistance(a, b) {
    return Math.abs(a - b);
}
export function matchScore(a, b, waitSeconds) {
    const base = rankDistance(a, b);
    const allowed = 100 + Math.floor(waitSeconds / 3) * 50;
    return base <= allowed ? Math.max(1, 100 - (base / allowed) * 100) : 0;
}
