const { parse } = require("date-fns");
const useBucket = require("./bucket");
const useBalance = require("./balance");
const usePointSnapshot = require("./point_snapshot");

async function main(start, end) {
  await Promise.all([
    usePointSnapshot(start, end),
    (async () => {
      await useBucket(start, end);
      await useBalance(start, end);
    })(),
  ]);
}

main(process.argv[2], process.argv[3]).catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
