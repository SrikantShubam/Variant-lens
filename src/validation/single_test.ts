
import { AgentOrchestrator } from '../lib/agents';

async function run() {
  const orchestrator = new AgentOrchestrator();
  console.log("Testing Gemma 3 with TP53:p.R175H...");
  try {
    const result = await orchestrator.analyze('TP53:p.R175H');
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Test Failed:", error);
  }
}

run();
