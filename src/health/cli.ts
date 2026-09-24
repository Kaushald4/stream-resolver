import { createEngine } from "../create-engine.js";
import { HealthChecker } from "./checker.js";

async function main() {
  const engine = await createEngine();
  const checker = new HealthChecker(engine.pipeline, engine.registry, {
    probeStreams: process.argv.includes("--probe"),
  });
  const results = await checker.runAll();
  console.log(checker.formatReport(results));
  const failed = results.some((r) => !r.ok);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
