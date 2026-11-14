import { spawn } from "node:child_process";
spawn("pnpm -F @noname/fs dev --debug --dirname=../../apps/core", { shell: true, stdio: "inherit" });
spawn("pnpm -F ./packages/extension/** build:watch", { shell: true, stdio: "inherit" });
spawn("pnpm -F noname dev --open", { shell: true, stdio: "inherit" });
