import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'command-centre',
  component: 'Pane',
  requestId: 'command-centre',
  props: { title: 'JARVIS', isFocused: false, bodyColumns: 50, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

test('the panel draws its sections on every surface', async ($, on) => {
  on('clock.now', () => ({ value: 1793553000000 }))
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /JARVIS/ }))?.text).toBe('JARVIS')
    expect((await ui.find({ type: 'Text', text: /CLAUDE · IDLE/ }))).toBeTruthy()
    expect((await ui.find({ type: 'Text', text: /DIRECTIVES/ }))).toBeTruthy()
    await ui.unmount()
  }
})

test('the band shows above the prompt', async ($, on) => {
  const ui = await $.ui.mount({ plugin: 'command-centre', component: 'AbovePrompt', surface: 'desktop', props: { hasSurvey: false } } as never)
  expect((await ui.find({ type: 'Text', text: /JARVIS/ }))).toBeTruthy()
  await ui.unmount()
})
