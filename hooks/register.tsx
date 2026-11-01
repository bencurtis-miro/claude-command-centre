import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, Vault, VaultNote } from '../types'

const PANE = 'command-centre'
const TITLE = 'JARVIS · Command Centre'
// Set from the plugin's `vaultPath` option when the module registers.
let VAULT = ''
const sep = () => (VAULT.includes('\\') ? '\\' : '/')
const vaultName = () => VAULT.split(/[\\/]/).filter(Boolean).pop() ?? 'vault'

const vault = atom({ plugin: 'command-centre', key: 'vault' } as const, null, { shape: 'vault-1' })
const activity = atom({ plugin: 'command-centre', key: 'activity' } as const, {
  state: 'idle',
  tool: null,
  turns: 0,
  toolsThisTurn: 0,
  lastTurnSeconds: null,
} as Activity)
const clock = atom({ plugin: 'command-centre', key: 'clock' } as const, 0)
const chimeOn = atom({ plugin: 'command-centre', key: 'chimeOn' } as const, true)
const bandHidden = atom({ plugin: 'command-centre', key: 'bandHidden' } as const, false)

const hhmm = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`
}
const ago = (now: number, ms: number) => {
  const m = Math.round((now - ms) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`
}
const stem = (name: string) => name.replace(/\.md$/, '')
const prettyTool = (tool: string) =>
  tool.startsWith('mcp__') ? tool.split('__').slice(2).join(' ').replace(/_/g, ' ') : tool

// Reads every top-level note in the vault and works out hubs (links in
// _index.md), open "- [ ]" directives and scheduled-task headings.
async function refreshVault($: EngineInterface): Promise<boolean> {
  if (!VAULT) return false
  try {
    const entries = await $.fs.list(VAULT)
    const notes: VaultNote[] = entries
      .filter(e => e.kind === 'file' && e.name.endsWith('.md'))
      .map(e => ({ name: e.name, mtimeMs: e.mtimeMs }))
    const hubs: string[] = []
    const directives: Vault['directives'] = []
    const scheduled: string[] = []
    for (const n of notes) {
      const text = await $.fs.read(`${VAULT}${sep()}${n.name}`).catch(() => '')
      if (n.name === '_index.md') {
        for (const m of text.matchAll(/^- \[\[([^\]|]+)/gm)) hubs.push(m[1] ?? '')
      }
      for (const m of text.matchAll(/^\s*- \[ \] (.+)$/gm)) directives.push({ text: m[1] ?? '', note: stem(n.name) })
      if (n.name === 'Scheduled Tasks.md') {
        for (const m of text.matchAll(/^## (.+)$/gm)) if (m[1] && m[1] !== 'Log') scheduled.push(m[1])
      }
    }
    await update($, vault, () => ({ notes, hubs, directives, scheduled, source: 'live' as const, loadedAt: Date.now() }))
    return true
  } catch {
    return false
  }
}

const chime = async ($: EngineInterface) => {
  if (await read($, chimeOn)) await $.audio.play({ asset: 'assets/chime.wav' }, { gain: 0.8 }).catch(() => undefined)
}

export const register: Register = (on, options) => {
  VAULT = String(options.vaultPath ?? '').trim().replace(/[\\/]+$/, '')
  on('session.start', async ($, e, next) => {
    for (const [name, description] of [
      ['centre', 'Open the JARVIS Command Centre panel'],
      ['vault', 'List your vault hubs and most recent notes'],
      ['today', 'Show open directives and scheduled tasks'],
      ['chime', 'Play the completion chime (or /chime off, /chime on)'],
      ['refresh-vault', 'Re-read your Obsidian vault'],
    ] as const) {
      await $.command.register({ name, description })
    }
    await update($, clock, () => 0)
    $.clock.every(15000, () => {
      void $.clock.now().then(now => update($, clock, () => now))
    })
    void $.clock.now().then(now => update($, clock, () => now))
    void $.ui.open({ id: PANE, title: TITLE })
    void refreshVault($)
    return next(e)
  })

  // ---- Slash commands -------------------------------------------------
  on('command.run', { command: 'centre' }, async $ => {
    const r = await $.ui.open({ id: PANE, title: TITLE })
    return {
      text: r.isPlaced
        ? 'Command Centre panel opened.'
        : 'This app does not draw mod panels for this session. Try /vault or /today instead.',
    }
  })

  on('command.run', { command: 'vault' }, async $ => {
    const v = await read($, vault)
    if (!v) return { text: VAULT ? 'Vault not loaded yet. Try /refresh-vault.' : 'No vault set: add vaultPath in the plugin settings (/plugin).' }
    const now = await $.clock.now()
    const recent = [...v.notes].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, 5)
    return {
      text: [
        `Vault "${vaultName()}": ${v.notes.length} notes.`,
        `Hubs: ${v.hubs.join(', ') || 'none found in _index.md'}`,
        'Recent:',
        ...recent.map(n => `  • ${stem(n.name)} (${ago(now, n.mtimeMs)})`),
      ].join('\n'),
    }
  })

  on('command.run', { command: 'today' }, async $ => {
    const v = await read($, vault)
    if (!v) return { text: 'Vault not loaded yet.' }
    const d = v.directives.length
      ? v.directives.map(x => `  ☐ ${x.text}  [${x.note}]`).join('\n')
      : '  None yet. Add "- [ ] task" lines to any vault note.'
    return { text: `Directives:\n${d}\nScheduled:\n${v.scheduled.map(s => `  ⏱ ${s}`).join('\n')}` }
  })

  on('command.run', { command: 'chime' }, async ($, e) => {
    const arg = String((e as { args?: string }).args ?? '').trim()
    if (arg === 'off' || arg === 'on') {
      await update($, chimeOn, () => arg === 'on')
      return { text: `Chime ${arg}.` }
    }
    await $.audio.play({ asset: 'assets/chime.wav' }, { gain: 0.8 }).catch(() => undefined)
    return { text: 'Chime played.' }
  })

  on('command.run', { command: 'refresh-vault' }, async $ => {
    const ok = await refreshVault($)
    return { text: ok ? 'Vault refreshed.' : VAULT ? `Could not read ${VAULT}.` : 'No vault set: add vaultPath in the plugin settings (/plugin).' }
  })

  // ---- Prompt rewrite: "!v ..." becomes a vault-first request -----------
  on('prompt.submit', async ($, e, next) => {
    await update($, activity, (a): Activity => ({ ...a, state: 'working', tool: null, toolsThisTurn: 0 }))
    $.ui.status('◉ JARVIS · thinking…')
    if (/^!v\s+/.test(e.text)) {
      $.ui.toast('Vault-first mode: Claude will check your notes before answering')
      return next({
        ...e,
        text: `Check my Obsidian vault for relevant notes first and name any you use. Then: ${e.text.replace(/^!v\s+/, '')}`,
      })
    }
    return next(e)
  }).catch(($, e, next) => (next.called ? next(e) : next(e)))

  // ---- Standing instruction ------------------------------------------
  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    return {
      sections: [
        ...r.sections,
        {
          id: 'command-centre:standing',
          scope: 'session',
          text: 'Command Centre mod is active. When you use something from the Obsidian vault, name the note. Keep end-of-turn summaries to one or two sentences.',
        },
      ],
    }
  })

  // ---- Guardrail + live status + toasts on vault writes ----------------
  on('tool.call', async ($, e, next) => {
    const args = e as unknown as { tool: string; files?: { devicePath?: string }[]; file_path?: string }
    const targets = [
      ...(args.files ?? []).map(f => f.devicePath ?? ''),
      args.file_path ?? '',
    ]
    if (targets.some(p => /[\\/]\.obsidian([\\/]|$)/.test(p))) {
      $.ui.toast('🛡 Blocked: Obsidian settings folder is protected')
      return { deny: 'command-centre: the vault\'s .obsidian settings folder is protected. Do not write there.' }
    }

    await update($, activity, (a): Activity => ({ ...a, state: 'working', tool: e.tool, toolsThisTurn: a.toolsThisTurn + 1 }))
    $.ui.status(`◉ JARVIS · ${prettyTool(e.tool)}`)
    const ran = await next(e)

    if (VAULT && !ran.deny && !ran.isError) {
      const names = targets
        .filter(p => p.startsWith(VAULT) && p.endsWith('.md'))
        .map(p => stem(p.split('\\').pop() ?? ''))
      if (names.length) {
        $.ui.toast(`📝 Vault updated: ${names.join(', ')}`, { timeoutMs: 6000 })
        void refreshVault($)
      }
    }
    if (ran.isError) await update($, activity, (a): Activity => ({ ...a, state: 'error' }))
    return ran
  }).catch(($, e, next) => next(e))

  let turnStart = 0
  on('turn.start', async ($, e, next) => {
    turnStart = await $.clock.now()
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const secs = turnStart ? Math.round(((await $.clock.now()) - turnStart) / 1000) : null
    await update($, activity, (a): Activity => ({
      ...a,
      state: e.reason === 'error' ? 'error' : 'idle',
      tool: null,
      turns: a.turns + 1,
      lastTurnSeconds: secs,
    }))
    $.ui.status(undefined)
    if (e.reason === 'answer') {
      $.ui.toast(`✓ Done${secs !== null ? ` in ${secs}s` : ''}`)
      await chime($)
    }
    return next(e)
  })

  // ---- Band above the prompt -----------------------------------------
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, bandHidden))) return next(e)
    const v = await read($, vault)
    const a = await read($, activity)
    const { Box, Button, Text } = $.ui.resolve(e)
    const dot = a.state === 'working' ? 'warning' : a.state === 'error' ? 'error' : 'success'
    return (
      <Box flexDirection="row" gap={1} alignItems="center">
        <Text color={dot}>◉</Text>
        <Text color="success" weight="semibold">JARVIS</Text>
        <Text dimColor>
          · Vault: {VAULT ? vaultName() : 'not set'} · {v ? v.notes.length : '…'} notes · {v ? v.directives.length : 0} directives ·{' '}
          {a.state === 'working' ? `working${a.tool ? `: ${prettyTool(a.tool)}` : ''}` : a.state}
        </Text>
        <Button key="open" label="Panel" onPress={() => $.ui.open({ id: PANE, title: TITLE })} />
        <Button key="hide" label="Hide" onPress={() => update($, bandHidden, () => true)} />
      </Box>
    )
  })

  // ---- Side panel ----------------------------------------------------
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const v = await read($, vault)
    const a = await read($, activity)
    const isChime = await read($, chimeOn)
    const now = (await read($, clock)) || (await $.clock.now())
    const stateColor = a.state === 'working' ? 'warning' : a.state === 'error' ? 'error' : 'success'
    const stateLabel = a.state === 'working' ? 'WORKING' : a.state === 'error' ? 'ERROR' : 'IDLE'
    const recent = v ? [...v.notes].sort((x, y) => y.mtimeMs - x.mtimeMs).slice(0, 5) : []

    const Heading = ({ label }: { label: string }) => (
      <Text color="success" size="caption" weight="semibold">
        {label}
      </Text>
    )

    return (
      <Box flexDirection="column" gap={1} padding={1}>
        <Box flexDirection="row" justifyContent="space-between" alignItems="center">
          <Text size="title" weight="bold" color="success">
            JARVIS
          </Text>
          <Text size="heading" weight="medium">
            {hhmm(now)}
          </Text>
        </Box>
        <Text dimColor size="caption">
          Your command centre · Vault: {VAULT ? vaultName() : 'not set'}
        </Text>

        <Box flexDirection="column" alignItems="center" borderStyle="round" borderColor={stateColor} paddingY={1}>
          <Text color={stateColor} size="title">
            {a.state === 'working' ? '◉ ◎ ◉' : '·  ◉  ·'}
          </Text>
          <Text color={stateColor} weight="bold">
            CLAUDE · {stateLabel}
          </Text>
          <Text dimColor size="caption">
            {a.state === 'working' && a.tool ? prettyTool(a.tool) : `${a.turns} turns this session`}
            {a.lastTurnSeconds !== null && a.state !== 'working' ? ` · last ${a.lastTurnSeconds}s` : ''}
          </Text>
        </Box>

        <Heading label="DIRECTIVES" />
        {v && v.directives.length > 0 ? (
          v.directives.slice(0, 6).map(d => (
            <Text key={d.text}>
              ☐ {d.text} <Text dimColor>[{d.note}]</Text>
            </Text>
          ))
        ) : (
          <Text dimColor>None yet. Add "- [ ] task" to any note.</Text>
        )}

        <Heading label="SCHEDULED" />
        {(v?.scheduled ?? []).length === 0 && <Text dimColor>None found.</Text>}
        {(v?.scheduled ?? []).map(s => (
          <Text key={s}>⏱ {s}</Text>
        ))}

        <Heading label="HUBS" />
        <Text>{v ? v.hubs.join(' · ') : '…'}</Text>

        <Heading label="RECENT NOTES" />
        {recent.map(n => (
          <Box key={n.name} flexDirection="row" justifyContent="space-between">
            <Text>{stem(n.name)}</Text>
            <Text dimColor>{ago(now, n.mtimeMs)}</Text>
          </Box>
        ))}

        <Heading label="CONTROLS" />
        <Box flexDirection="row" gap={1} flexWrap="wrap">
          <Button key="refresh" label="Refresh vault" onPress={() => void refreshVault($).then(ok => $.ui.toast(ok ? 'Vault refreshed' : 'Vault not readable'))} />
          <Button key="test" label="Test chime" onPress={() => $.audio.play({ asset: 'assets/chime.wav' }, { gain: 0.8 }).catch(() => undefined)} />
          <Button key="mute" label={isChime ? 'Mute chime' : 'Unmute chime'} onPress={() => update($, chimeOn, c => !c)} />
          <Button key="band" label="Show band" onPress={() => update($, bandHidden, () => false)} />
        </Box>
        <Text dimColor size="caption">
          Commands: /vault /today /chime /refresh-vault · Start a message with "!v " for vault-first answers.
        </Text>
      </Box>
    )
  })
}
