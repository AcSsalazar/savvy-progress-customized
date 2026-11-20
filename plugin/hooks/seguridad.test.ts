import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

// Pruebas de la copia endurecida: lo que se quitó no vuelve y lo que se quedó sigue
// dibujando. Cada hook de `on` hace de motor bajo el mod.

const PLUGIN = 'savvy-progress-customized'
const pane = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const

const engine = (on: On, seen: { tools: string[]; commands: string[]; opened: string[]; prompts: string[] }) => {
  mock.clock(on, { now: Date.parse('2026-11-20T12:00:00Z') })
  mock.env(on, { LANG: 'es_CO.UTF-8' })
  on('settings.read', async () => ({ value: {} }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('tool.register', (_$, e) => {
    seen.tools.push(e.name)
    return { value: {} } as never
  })
  on('command.register', (_$, e) => {
    seen.commands.push(e.name)
    return { value: { command: e.name } } as never
  })
  on('ui.open', (_$, e) => {
    seen.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('agent.spawn', (_$, e) => {
    seen.prompts.push(e.prompt)
    return { model: 'claude-haiku-5-5', agentId: `a${seen.prompts.length}` }
  })
}

const start = async ($: Engine) =>
  $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)

const spawn = ($: Engine, subagentType: string, prompt: string) =>
  $.agent.spawn({
    tool_use_id: `t-${subagentType}`,
    prompt,
    description: `Tarea ${subagentType}`,
    subagentType,
    provider: 'engine',
    parentModel: 'claude-opus-5-5',
    background: true,
    fork: false,
  } as never)

test('seguridad: no registra herramientas para el modelo, solo el comando /agents-info', async ($, on) => {
  const seen = { tools: [] as string[], commands: [] as string[], opened: [] as string[], prompts: [] as string[] }
  engine(on, seen)
  await start($)
  expect(seen.tools).toEqual([])
  expect(seen.commands).toEqual(['agents-info'])
})

test('seguridad: el prompt de un subagente savvy-* y de cualquier otro pasa sin cambios', async ($, on) => {
  const seen = { tools: [] as string[], commands: [] as string[], opened: [] as string[], prompts: [] as string[] }
  engine(on, seen)
  await start($)
  await spawn($, 'savvy-careful', 'brief exacto')
  await spawn($, 'Explore', 'otro brief')
  expect(seen.prompts).toEqual(['brief exacto', 'otro brief'])
})

test('panel: se abre solo con cualquier subagente; en el escritorio dibuja la figura y en la terminal, texto', async ($, on) => {
  const seen = { tools: [] as string[], commands: [] as string[], opened: [] as string[], prompts: [] as string[] }
  engine(on, seen)
  await start($)
  await spawn($, 'Explore', 'buscar')
  expect(seen.opened).toEqual(['savvy-agents'])

  const desk = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'savvy-agents', props: pane })
  const rows = (await desk.findAll({ type: 'Svg' })).map(el => String(el.props.source))
  const card = rows.find(s => s.includes('Tarea Explore'))
  expect(card).toBeDefined()
  expect(card).toContain('data-estilo="cerveza"')
  expect(card).toContain('prefers-reduced-motion')
  await desk.unmount()

  const term = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: 'savvy-agents', props: pane })
  expect(await term.find({ type: 'Text', text: /Tarea Explore/ })).toBeDefined()
  expect(await term.find({ type: 'Svg' })).toBeUndefined()
  await term.unmount()
})
