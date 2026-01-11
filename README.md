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

## How It Works

- Profiles are stored in `~/.config/opencode-launcher/profiles/`
- When you `use` a profile, it copies the config to `~/.config/opencode/opencode.json`
- A backup is automatically created before your first profile switch
- The `run` command temporarily switches profiles for a single session

## License

MIT
