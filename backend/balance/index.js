const useBucket = require("./bucket");
const useBalance = require("./balance");
const usePointSnapshot = require("./point_snapshot");
const usePointWeight = require("./point_weight");

async function main(start, end) {
  await useBucket(start, end);
  await useBalance(start, end);

  await usePointSnapshot(start, end);
  await usePointWeight(start, end);
}

main(process.argv[2], process.argv[3]).catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
