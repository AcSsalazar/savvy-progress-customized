import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

// La barra sobre el prompt sin savvy-flow: cuenta el lote de subagentes observado,
// ×N abre o cierra el panel y ✕ la oculta hasta el siguiente lote.

const PLUGIN = 'savvy-progress-customized'
const band = { hasSurvey: false, isCollapsed: false, isWorking: true, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} }

const engine = (on: On, opened: string[], closed: string[]) => {
  const clock = mock.clock(on, { now: Date.parse('2026-11-20T12:00:00Z') })
  mock.env(on, { LANG: 'en_US.UTF-8' })
  on('settings.read', async () => ({ value: {} }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('command.register', (_$, e) => ({ value: { command: e.name } }) as never)
  on('ui.open', (_$, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$, e) => {
    closed.push(String((e as { id?: string }).id))
    return { value: {} } as never
  })
  on('ui.panes', () => ({ value: opened.length > closed.length ? [{ id: 'savvy-agents' }] : [] }) as never)
  let n = 0
  on('agent.spawn', (_$, e) => ({ model: String(e.model ?? 'claude-haiku-5-5'), agentId: `a${++n}` }))
  on('turn.complete', () => ({ text: '' }) as never)
  return clock
}

const spawn = ($: Engine, description: string) =>
  $.agent.spawn({ tool_use_id: `t-${description}`, prompt: 'p', description, subagentType: 'Explore', model: 'claude-haiku-5-5', provider: 'engine', parentModel: 'claude-opus-5-5', background: true, fork: false } as never)

const finish = ($: Engine, agentId: string) =>
  ($.turn.complete as (e: unknown) => Promise<unknown>)({ agentId, reason: 'answer', answer: 'ok' })

const bandSvg = async ($: Engine) => {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', props: band })
  const svg = (await ui.findAll({ type: 'Svg' })).map(el => String(el.props.source)).find(s => s.includes('Agents'))
  return { ui, svg }
}

test('barra: aparece con el lote, cuenta los terminados y ×N abre y cierra el panel', async ($, on) => {
  const opened: string[] = [], closed: string[] = []
  engine(on, opened, closed)
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  opened.length = 0

  let { ui, svg } = await bandSvg($)
  expect(svg).toBeUndefined()
  await ui.unmount()

  await spawn($, 'Uno')
  await spawn($, 'Dos')
  ;({ ui, svg } = await bandSvg($))
  expect(svg).toContain('Tasks 0/2')
  expect(svg).toContain('data-estilo="cerveza"')
  expect((await ui.find({ key: 'savvy-agents' }))?.props.label).toBe('×2')
  await ui.press({ key: 'savvy-agents' })
  await ui.unmount()

  await finish($, 'a1')
  ;({ ui, svg } = await bandSvg($))
  expect(svg).toContain('Tasks 1/2')
  expect(svg).toContain('50%')
  await ui.press({ key: 'savvy-agents' })
  await ui.unmount()
  expect(closed).toEqual(['savvy-agents'])

  await finish($, 'a2')
  ;({ ui, svg } = await bandSvg($))
  expect(svg).toContain('Done')
  expect(svg).toContain('100%')
  await ui.unmount()
})

test('barra: ✕ la oculta hasta que arranca otro subagente, que empieza un lote nuevo', async ($, on) => {
  const clock = engine(on, [], [])
  await $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)
  await spawn($, 'Uno')
  await finish($, 'a1')

  let { ui, svg } = await bandSvg($)
  expect(svg).toContain('Done')
  await ui.press({ key: 'savvy-dismiss' })
  await ui.unmount()
  ;({ ui, svg } = await bandSvg($))
  expect(svg).toBeUndefined()
  await ui.unmount()

  await clock.advance(5000)
  await spawn($, 'Otra tarea')
  ;({ ui, svg } = await bandSvg($))
  expect(svg).toContain('Tasks 0/1')
  await ui.unmount()

  const term = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: band })
  expect(await term.find({ type: 'Text', text: /Tasks 0\/1/ })).toBeDefined()
  await term.unmount()
})
