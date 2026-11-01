# JARVIS Command Centre for Claude Code

A Jarvis-style command centre mod for Claude Code. It adds a side panel, a status band above the prompt, toasts, a completion chime and a few slash commands, all wired to your Obsidian vault.

## What you get

- **Side panel**: clock, a status orb (Idle / Working / Error), open `- [ ]` directives from your notes, scheduled tasks, vault hubs, recently edited notes, and buttons to refresh the vault, test or mute the chime.
- **Band above the prompt**: vault name, note and directive counts, and what Claude is doing right now.
- **Status line and toasts**: the current tool while Claude works, "Done in Xs" when a reply finishes, and "Vault updated: …" when Claude writes to a note.
- **Chime**: two soft tones when a reply finishes.
- **Slash commands**: `/centre`, `/vault`, `/today`, `/chime` (`/chime off`, `/chime on`), `/refresh-vault`.
- **`!v` prefix**: start a message with `!v ` and Claude checks your vault before answering.
- **Guardrail**: blocks writes to your vault's `.obsidian` settings folder.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install command-centre --marketplace bencurtis-miro/claude-command-centre
```

Answer `y` to add the marketplace, choose the user scope, then enter your vault folder (the one holding `_index.md`) when asked for **Obsidian vault folder**.

From a shell:

```
claude plugin install command-centre --marketplace bencurtis-miro/claude-command-centre
```

In the Claude desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `bencurtis-miro/claude-command-centre`, then Add plugin.

A mod installed from a terminal at the user scope also loads in the desktop app's local Code sessions.

## Notes

- Panels, the band, toasts and the chime need a session that draws mods (the Claude Code terminal or desktop app). Cloud sessions in the Claude app don't draw them; the slash commands still work there.
- Hubs come from `[[links]]` at the start of list lines in `_index.md`; scheduled tasks come from `##` headings in `Scheduled Tasks.md`.
