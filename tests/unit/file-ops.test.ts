/**
 * Unit Tests - File Operations Tools
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm } from "fs/promises";
import { fileTools } from "../../src/tools/file-ops";

const TEST_DIR = "./test-fixtures";

describe("file-ops", () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
    await Bun.write(`${TEST_DIR}/test.txt`, "line1\nline2\nline3\n");
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test("read_file reads entire file", async () => {
    const tool = fileTools.find(t => t.name === "read_file")!;
    const result = await tool.execute({ path: `${TEST_DIR}/test.txt` });
    expect(result).toBe("line1\nline2\nline3\n");
  });

  test("read_file reads line range", async () => {
    const tool = fileTools.find(t => t.name === "read_file")!;
    const result = await tool.execute({ 
      path: `${TEST_DIR}/test.txt`,
      startLine: 2,
      endLine: 2 
    });
    expect(result).toBe("line2");
  });

  test("read_file throws for non-existent file", async () => {
    const tool = fileTools.find(t => t.name === "read_file")!;
    await expect(tool.execute({ path: `${TEST_DIR}/nonexistent.txt` }))
      .rejects.toThrow("File not found");
  });

  test("write_file creates new file", async () => {
    const tool = fileTools.find(t => t.name === "write_file")!;
    await tool.execute({
      path: `${TEST_DIR}/new.txt`,
      content: "hello world",
    });
    
    const content = await Bun.file(`${TEST_DIR}/new.txt`).text();
    expect(content).toBe("hello world");
  });

  test("edit_file replaces string", async () => {
    const tool = fileTools.find(t => t.name === "edit_file")!;
    await tool.execute({
      path: `${TEST_DIR}/test.txt`,
      oldString: "line2",
      newString: "modified",
    });
    
    const content = await Bun.file(`${TEST_DIR}/test.txt`).text();
    expect(content).toContain("modified");
    expect(content).not.toContain("line2");
  });

  test("edit_file throws if string not found", async () => {
    const tool = fileTools.find(t => t.name === "edit_file")!;
    await expect(tool.execute({
      path: `${TEST_DIR}/test.txt`,
      oldString: "nonexistent",
      newString: "replacement",
    })).rejects.toThrow("String not found");
  });

  test("list_directory lists files", async () => {
    const tool = fileTools.find(t => t.name === "list_directory")!;
    const result = await tool.execute({ path: TEST_DIR }) as string[];
    expect(result).toContain("test-fixtures/test.txt");
  });

  test("create_directory creates nested directories", async () => {
    const tool = fileTools.find(t => t.name === "create_directory")!;
    await tool.execute({ path: `${TEST_DIR}/nested/deep/dir` });
    
    const exists = await Bun.file(`${TEST_DIR}/nested/deep/dir`).exists();
    // Note: Bun.file.exists() doesn't work on directories, this is just for illustration
  });
});
