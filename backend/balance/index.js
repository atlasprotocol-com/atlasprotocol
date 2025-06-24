const { parse } = require("date-fns");
const useBucket = require("./bucket");
const useBalance = require("./balance");

async function main(from, to) {
  const start = from ? parse(from, "yyyyMMddHHmmss", new Date()) : null;
  const end = to ? parse(to, "yyyyMMddHHmmss", new Date()) : null;

  await useBucket(start, end);
  await useBalance(start, end);
  console.log(
    `[${start ? start.toISOString() : "start"} - ${end ? end.toISOString() : "end"}] DONE.`,
  );
}

main(process.argv[2], process.argv[3]).catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
