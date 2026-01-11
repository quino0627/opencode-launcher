# opencode-launcher

Elegant profile manager for [OpenCode](https://opencode.ai). Switch between work, personal, and project configurations effortlessly.

## Installation

```bash
npm install -g opencode-launcher
```

## Usage

```bash
# Show status
ocl

# List all profiles
ocl list

# Create a new profile (copies current config)
ocl create work -d "Work profile"

# Create an empty profile
ocl create minimal --empty

# Switch to a profile
ocl use work

# Show current profile
ocl current

# Show profile details
ocl show work

# Copy a profile
ocl copy work work-backup

# Edit a profile
ocl edit work

# Delete a profile
ocl delete work-backup

# Run opencode with a specific profile (temporarily)
ocl run personal .
```

## Project-local Profiles (.oclrc)

You can set a default profile for a specific directory by creating a `.oclrc` file:

```bash
# In your project directory
ocl init work

# This creates .oclrc containing "work"
# Now apply it:
ocl apply
```

The `.oclrc` file is searched upward from the current directory (like `.gitignore`), so you can set it at your project root.

```bash
# Example workflow
cd ~/projects/company-app
ocl init work           # Creates .oclrc with "work"
ocl apply               # Switches to work profile

cd ~/projects/personal-app  
ocl init personal       # Creates .oclrc with "personal"
ocl apply               # Switches to personal profile
```

When you run `ocl` with no arguments, it will show if a local `.oclrc` exists and whether you need to apply it:

```
  opencode-launcher (ocl)
  Elegant profile manager for OpenCode

  ★ Current: work
  → Local: personal (/Users/you/projects/personal-app/.oclrc)
    Run ocl apply to switch
  • 3 profile(s) available
```

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `ocl list` | `ls` | List all profiles |
| `ocl current` | - | Show current active profile |
| `ocl create <name>` | `new` | Create a new profile |
| `ocl use <name>` | `switch` | Switch to a profile |
| `ocl delete <name>` | `rm` | Delete a profile |
| `ocl edit <name>` | - | Edit profile in $EDITOR |
| `ocl run <name> [args]` | - | Run opencode with profile |
| `ocl copy <src> <dest>` | `cp` | Copy a profile |
| `ocl show <name>` | `info` | Show profile details |
| `ocl init <profile>` | - | Create `.oclrc` in current directory |
| `ocl apply` | - | Apply profile from `.oclrc` |

## How It Works

- Profiles are stored in `~/.config/opencode-launcher/profiles/`
- When you `use` a profile, it copies the config to `~/.config/opencode/opencode.json`
- A backup is automatically created before your first profile switch
- The `run` command temporarily switches profiles for a single session
- `.oclrc` files let you set project-specific default profiles

## License

MIT
