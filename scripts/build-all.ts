/**
 * Build All Script - Cross-platform binary builds
 */

import { mkdir } from "fs/promises";

const targets = [
  { os: "windows", arch: "x64", ext: ".exe" },
  { os: "darwin", arch: "x64", ext: "" },
  { os: "darwin", arch: "arm64", ext: "" },
  { os: "linux", arch: "x64", ext: "" },
  { os: "linux", arch: "arm64", ext: "" },
];

async function buildAll(): Promise<void> {
  console.log("Building Sharkbait binaries for all platforms...\n");
  
  await mkdir("dist/binaries", { recursive: true });

  for (const { os, arch, ext } of targets) {
    const output = `dist/binaries/sharkbait-${os}-${arch}${ext}`;
    console.log(`Building ${output}...`);
    
    const proc = Bun.spawn([
      "bun", "build", "src/cli.ts",
      "--compile",
      `--target=bun-${os}-${arch}`,
      "--outfile", output,
    ], {
      stdout: "inherit",
      stderr: "inherit",
    });
    
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      console.error(`Failed to build ${output}`);
      process.exit(1);
    }
    
    console.log(`✓ Built ${output}\n`);
  }

  console.log("All binaries built successfully!");
}

buildAll().catch(err => {
  console.error(err);
  process.exit(1);
});
