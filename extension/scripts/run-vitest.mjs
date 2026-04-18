import { startVitest } from "vitest/node";

const cliFilters = process.argv.slice(2);

const ctx = await startVitest(
  "test",
  cliFilters,
  {
    watch: false,
    reporters: "basic"
  },
  {
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
      pool: "threads",
      poolOptions: {
        threads: {
          singleThread: true
        }
      }
    }
  }
);

if (!ctx) {
  process.exit(1);
}

const hasFailures = ctx.state.getCountOfFailedTests() > 0;
await ctx.close();
process.exit(hasFailures ? 1 : 0);
