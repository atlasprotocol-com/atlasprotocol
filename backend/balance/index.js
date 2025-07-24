const parser = require("./parser");
const useBucket = require("./bucket");
const useBalance = require("./balance");
const usePointSnapshot = require("./point_snapshot");
const usePointWeight = require("./point_weight");

async function execute(start, end) {
  await useBucket(start, end);
  await useBalance(start, end);

  await usePointSnapshot(start, end);
  await usePointWeight(start, end);
}

async function main() {
  const now = new Date().getTime();
  const last3hours = now - 3 * 60 * 60 * 1000;
  const last1hour = now - 60 * 60 * 1000;
  const start = parser.ts2bucket(last3hours);
  const end = parser.ts2bucket(last1hour);
  await execute(start, end);

  console.log(`Executed balance update from ${start} to ${end}`);
  await new Promise((resolve) => setTimeout(resolve, 45 * 60 * 1000));
  return main();
}

if (process.env.CRON) {
  main().catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
} else {
  execute(process.argv[2], process.argv[3]).catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
}
