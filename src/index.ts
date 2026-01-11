#!/usr/bin/env node

import { Command } from "commander";
import pc from "picocolors";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, copyFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { spawn, execSync } from "node:child_process";

const OPENCODE_CONFIG_DIR = join(homedir(), ".config", "opencode");
const OPENCODE_CONFIG_FILE = join(OPENCODE_CONFIG_DIR, "opencode.json");
const LAUNCHER_DIR = join(homedir(), ".config", "opencode-launcher");
const PROFILES_DIR = join(LAUNCHER_DIR, "profiles");
const STATE_FILE = join(LAUNCHER_DIR, "state.json");

const SYMBOLS = {
  check: "✓",
  cross: "✗",
  arrow: "→",
  bullet: "•",
  star: "★",
  box: {
    topLeft: "╭",
    topRight: "╮",
    bottomLeft: "╰",
    bottomRight: "╯",
    horizontal: "─",
    vertical: "│",
  },
} as const;

interface LauncherState {
  currentProfile: string | null;
  lastUsed: string | null;
}

interface ProfileMeta {
  name: string;
  createdAt: string;
  description?: string;
}

const ui = {
  box(title: string, content: string[], width = 50): string {
    const { topLeft, topRight, bottomLeft, bottomRight, horizontal, vertical } = SYMBOLS.box;
    const innerWidth = width - 2;
    
    const top = `${topLeft}${horizontal} ${pc.bold(title)} ${horizontal.repeat(innerWidth - title.length - 3)}${topRight}`;
    const bottom = `${bottomLeft}${horizontal.repeat(innerWidth)}${bottomRight}`;
    
    const lines = content.map(line => {
      const stripped = line.replace(/\x1b\[[0-9;]*m/g, "");
      const padding = innerWidth - stripped.length - 1;
      return `${vertical} ${line}${" ".repeat(Math.max(0, padding))}${vertical}`;
    });
    
    return [top, ...lines, bottom].join("\n");
  },

  success(msg: string): void {
    console.log(`\n  ${pc.green(SYMBOLS.check)} ${msg}\n`);
  },

  error(msg: string): void {
    console.log(`\n  ${pc.red(SYMBOLS.cross)} ${pc.red(msg)}\n`);
  },

  info(msg: string): void {
    console.log(`\n  ${pc.blue(SYMBOLS.bullet)} ${msg}\n`);
  },

  warn(msg: string): void {
    console.log(`\n  ${pc.yellow(SYMBOLS.bullet)} ${pc.yellow(msg)}\n`);
  },

  header(text: string): void {
    console.log(`\n  ${pc.cyan(pc.bold(text))}`);
    console.log(`  ${pc.dim("─".repeat(text.length + 4))}\n`);
  },

  profileItem(name: string, isCurrent: boolean, description?: string): string {
    const indicator = isCurrent ? pc.green(SYMBOLS.star) : pc.dim(SYMBOLS.bullet);
    const nameStr = isCurrent ? pc.green(pc.bold(name)) : name;
    const desc = description ? pc.dim(` - ${description}`) : "";
    return `  ${indicator} ${nameStr}${desc}`;
  },
};

function ensureDirs(): void {
  if (!existsSync(LAUNCHER_DIR)) mkdirSync(LAUNCHER_DIR, { recursive: true });
  if (!existsSync(PROFILES_DIR)) mkdirSync(PROFILES_DIR, { recursive: true });
}

function loadState(): LauncherState {
  ensureDirs();
  if (!existsSync(STATE_FILE)) {
    return { currentProfile: null, lastUsed: null };
  }
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { currentProfile: null, lastUsed: null };
  }
}

function saveState(state: LauncherState): void {
  ensureDirs();
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getProfilePath(name: string): string {
  return join(PROFILES_DIR, `${name}.json`);
}

function getProfileMetaPath(name: string): string {
  return join(PROFILES_DIR, `${name}.meta.json`);
}

function listProfiles(): string[] {
  ensureDirs();
  return readdirSync(PROFILES_DIR)
    .filter(f => f.endsWith(".json") && !f.endsWith(".meta.json"))
    .map(f => basename(f, ".json"));
}

function profileExists(name: string): boolean {
  return existsSync(getProfilePath(name));
}

function loadProfileMeta(name: string): ProfileMeta | null {
  const metaPath = getProfileMetaPath(name);
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(readFileSync(metaPath, "utf-8"));
  } catch {
    return null;
  }
}

function validateProfileName(name: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(name);
}

function getEmptyConfig(): object {
  return {
    "$schema": "https://opencode.ai/config.json",
    plugin: [],
    mcp: {},
    provider: {},
    agent: {}
  };
}

function cmdList(): void {
  const profiles = listProfiles();
  const state = loadState();

  if (profiles.length === 0) {
    ui.info("No profiles found. Create one with: " + pc.cyan("ocl create <name>"));
    return;
  }

  ui.header("Profiles");
  
  for (const name of profiles.sort()) {
    const meta = loadProfileMeta(name);
    const isCurrent = state.currentProfile === name;
    console.log(ui.profileItem(name, isCurrent, meta?.description));
  }
  
  console.log();
  console.log(pc.dim(`  Total: ${profiles.length} profile(s)`));
  console.log();
}

function cmdCurrent(): void {
  const state = loadState();
  
  if (!state.currentProfile) {
    ui.info("No profile is currently active. Using default OpenCode config.");
    return;
  }
  
  const meta = loadProfileMeta(state.currentProfile);
  
  console.log();
  console.log(ui.box("Current Profile", [
    `${pc.bold("Name:")} ${pc.green(state.currentProfile)}`,
    meta?.description ? `${pc.bold("Description:")} ${meta.description}` : "",
    meta?.createdAt ? `${pc.bold("Created:")} ${new Date(meta.createdAt).toLocaleDateString()}` : "",
  ].filter(Boolean)));
  console.log();
}

function cmdCreate(name: string, options: { description?: string; empty?: boolean }): void {
  if (!validateProfileName(name)) {
    ui.error("Invalid profile name. Use only letters, numbers, hyphens, and underscores.");
    process.exit(1);
  }

  if (profileExists(name)) {
    ui.error(`Profile "${name}" already exists.`);
    process.exit(1);
  }

  ensureDirs();

  const profilePath = getProfilePath(name);
  
  if (options.empty) {
    writeFileSync(profilePath, JSON.stringify(getEmptyConfig(), null, 2));
  } else if (existsSync(OPENCODE_CONFIG_FILE)) {
    copyFileSync(OPENCODE_CONFIG_FILE, profilePath);
  } else {
    writeFileSync(profilePath, JSON.stringify(getEmptyConfig(), null, 2));
  }

  const meta: ProfileMeta = {
    name,
    createdAt: new Date().toISOString(),
    description: options.description,
  };
  writeFileSync(getProfileMetaPath(name), JSON.stringify(meta, null, 2));

  ui.success(`Profile "${pc.bold(name)}" created successfully!`);
  
  if (!options.empty && existsSync(OPENCODE_CONFIG_FILE)) {
    console.log(pc.dim(`  ${SYMBOLS.arrow} Copied from current OpenCode config`));
  }
  
  console.log(pc.dim(`  ${SYMBOLS.arrow} Switch to it with: ${pc.cyan(`ocl use ${name}`)}`));
  console.log();
}

function cmdUse(name: string): void {
  if (!profileExists(name)) {
    ui.error(`Profile "${name}" does not exist.`);
    console.log(pc.dim(`  ${SYMBOLS.arrow} Create it with: ${pc.cyan(`ocl create ${name}`)}`));
    console.log();
    process.exit(1);
  }

  const profilePath = getProfilePath(name);
  const state = loadState();
  
  if (existsSync(OPENCODE_CONFIG_FILE) && !state.currentProfile) {
    const backupName = `_backup_${Date.now()}`;
    copyFileSync(OPENCODE_CONFIG_FILE, getProfilePath(backupName));
    
    const backupMeta: ProfileMeta = {
      name: backupName,
      createdAt: new Date().toISOString(),
      description: "Auto-backup before first profile switch",
    };
    writeFileSync(getProfileMetaPath(backupName), JSON.stringify(backupMeta, null, 2));
  }

  copyFileSync(profilePath, OPENCODE_CONFIG_FILE);

  saveState({
    currentProfile: name,
    lastUsed: new Date().toISOString(),
  });

  ui.success(`Switched to profile "${pc.bold(name)}"`);
  console.log(pc.dim(`  ${SYMBOLS.arrow} OpenCode will now use this configuration`));
  console.log();
}

function cmdDelete(name: string, options: { force?: boolean }): void {
  if (!profileExists(name)) {
    ui.error(`Profile "${name}" does not exist.`);
    process.exit(1);
  }

  const state = loadState();
  
  if (state.currentProfile === name && !options.force) {
    ui.error(`Cannot delete active profile "${name}". Switch to another profile first.`);
    console.log(pc.dim(`  ${SYMBOLS.arrow} Or use --force to delete anyway`));
    console.log();
    process.exit(1);
  }

  unlinkSync(getProfilePath(name));
  const metaPath = getProfileMetaPath(name);
  if (existsSync(metaPath)) {
    unlinkSync(metaPath);
  }

  if (state.currentProfile === name) {
    saveState({ currentProfile: null, lastUsed: state.lastUsed });
  }

  ui.success(`Profile "${pc.bold(name)}" deleted.`);
}

function cmdEdit(name: string): void {
  if (!profileExists(name)) {
    ui.error(`Profile "${name}" does not exist.`);
    process.exit(1);
  }

  const profilePath = getProfilePath(name);
  const editor = process.env.EDITOR || process.env.VISUAL || "vi";

  ui.info(`Opening ${pc.bold(name)} in ${pc.cyan(editor)}...`);
  
  try {
    execSync(`${editor} "${profilePath}"`, { stdio: "inherit" });
    ui.success("Profile saved.");
  } catch {
    ui.error("Failed to open editor.");
    process.exit(1);
  }
}

function cmdRun(name: string, args: string[]): void {
  if (!profileExists(name)) {
    ui.error(`Profile "${name}" does not exist.`);
    process.exit(1);
  }

  const profilePath = getProfilePath(name);
  const originalConfig = existsSync(OPENCODE_CONFIG_FILE) 
    ? readFileSync(OPENCODE_CONFIG_FILE, "utf-8") 
    : null;

  copyFileSync(profilePath, OPENCODE_CONFIG_FILE);

  ui.info(`Running OpenCode with profile "${pc.bold(name)}"...`);
  console.log();

  const opencode = spawn("opencode", args, {
    stdio: "inherit",
    shell: true,
  });

  opencode.on("close", (code) => {
    if (originalConfig !== null) {
      writeFileSync(OPENCODE_CONFIG_FILE, originalConfig);
    }
    process.exit(code ?? 0);
  });

  opencode.on("error", (err) => {
    if (originalConfig !== null) {
      writeFileSync(OPENCODE_CONFIG_FILE, originalConfig);
    }
    ui.error(`Failed to run OpenCode: ${err.message}`);
    process.exit(1);
  });
}

function cmdCopy(source: string, dest: string): void {
  if (!profileExists(source)) {
    ui.error(`Source profile "${source}" does not exist.`);
    process.exit(1);
  }

  if (!validateProfileName(dest)) {
    ui.error("Invalid profile name. Use only letters, numbers, hyphens, and underscores.");
    process.exit(1);
  }

  if (profileExists(dest)) {
    ui.error(`Destination profile "${dest}" already exists.`);
    process.exit(1);
  }

  copyFileSync(getProfilePath(source), getProfilePath(dest));
  
  const sourceMeta = loadProfileMeta(source);
  const destMeta: ProfileMeta = {
    name: dest,
    createdAt: new Date().toISOString(),
    description: sourceMeta?.description ? `Copy of ${source}: ${sourceMeta.description}` : `Copy of ${source}`,
  };
  writeFileSync(getProfileMetaPath(dest), JSON.stringify(destMeta, null, 2));

  ui.success(`Profile "${pc.bold(source)}" copied to "${pc.bold(dest)}"`);
}

function cmdShow(name: string): void {
  if (!profileExists(name)) {
    ui.error(`Profile "${name}" does not exist.`);
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(getProfilePath(name), "utf-8"));
  const meta = loadProfileMeta(name);
  const state = loadState();
  const isCurrent = state.currentProfile === name;

  console.log();
  console.log(ui.box(`Profile: ${name}`, [
    isCurrent ? `${pc.green(SYMBOLS.star)} ${pc.green("Currently Active")}` : "",
    meta?.description ? `${pc.bold("Description:")} ${meta.description}` : "",
    meta?.createdAt ? `${pc.bold("Created:")} ${new Date(meta.createdAt).toLocaleDateString()}` : "",
    "",
    `${pc.bold("Plugins:")} ${config.plugin?.length || 0}`,
    `${pc.bold("MCP Servers:")} ${Object.keys(config.mcp || {}).length}`,
    `${pc.bold("Providers:")} ${Object.keys(config.provider || {}).length}`,
  ].filter(Boolean), 55));
  
  if (config.plugin?.length > 0) {
    console.log();
    console.log(pc.dim("  Plugins:"));
    for (const p of config.plugin) {
      console.log(pc.dim(`    ${SYMBOLS.bullet} ${p}`));
    }
  }
  
  if (Object.keys(config.mcp || {}).length > 0) {
    console.log();
    console.log(pc.dim("  MCP Servers:"));
    for (const m of Object.keys(config.mcp)) {
      const enabled = config.mcp[m].enabled !== false;
      const status = enabled ? pc.green("enabled") : pc.dim("disabled");
      console.log(pc.dim(`    ${SYMBOLS.bullet} ${m} (${status})`));
    }
  }
  
  console.log();
}

const program = new Command();

program
  .name("ocl")
  .description("Elegant profile manager for OpenCode")
  .version("1.0.0");

program
  .command("list")
  .alias("ls")
  .description("List all profiles")
  .action(cmdList);

program
  .command("current")
  .description("Show current active profile")
  .action(cmdCurrent);

program
  .command("create <name>")
  .alias("new")
  .description("Create a new profile")
  .option("-d, --description <text>", "Profile description")
  .option("-e, --empty", "Create empty profile instead of copying current config")
  .action(cmdCreate);

program
  .command("use <name>")
  .alias("switch")
  .description("Switch to a profile")
  .action(cmdUse);

program
  .command("delete <name>")
  .alias("rm")
  .description("Delete a profile")
  .option("-f, --force", "Force delete even if profile is active")
  .action(cmdDelete);

program
  .command("edit <name>")
  .description("Edit a profile in your default editor")
  .action(cmdEdit);

program
  .command("run <name> [args...]")
  .description("Run opencode with a specific profile (temporary)")
  .action(cmdRun);

program
  .command("copy <source> <dest>")
  .alias("cp")
  .description("Copy a profile")
  .action(cmdCopy);

program
  .command("show <name>")
  .alias("info")
  .description("Show profile details")
  .action(cmdShow);

program.action(() => {
  const state = loadState();
  const profiles = listProfiles();
  
  console.log();
  console.log(pc.cyan(pc.bold("  opencode-launcher")) + pc.dim(" (ocl)"));
  console.log(pc.dim("  Elegant profile manager for OpenCode"));
  console.log();
  
  if (state.currentProfile) {
    console.log(`  ${pc.green(SYMBOLS.star)} Current: ${pc.green(pc.bold(state.currentProfile))}`);
  } else {
    console.log(`  ${pc.dim(SYMBOLS.bullet)} No active profile`);
  }
  console.log(`  ${pc.dim(SYMBOLS.bullet)} ${profiles.length} profile(s) available`);
  console.log();
  console.log(pc.dim("  Run ") + pc.cyan("ocl --help") + pc.dim(" for available commands"));
  console.log();
});

program.parse();
