import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

// Un solo tema para todo el panel: boxeador (por defecto), cerveza, minero o el cangrejo original.

const PLUGIN = 'savvy-progress-customized'
const pane = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const
const MAX_SVG = 131072

const engine = (on: On) => {
  mock.clock(on, { now: Date.parse('2026-11-20T12:00:00Z') })
  mock.env(on, { LANG: 'es_CO.UTF-8' })
  on('settings.read', async () => ({ value: {} }) as never)
  on('session.start', async () => ({ cwd: '/repo' }) as never)
  on('command.register', (_$, e) => ({ value: { command: e.name } }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  let n = 0
  on('agent.spawn', (_$, e) => ({ model: String(e.model ?? 'claude-opus-5-5'), agentId: `a${++n}` }))
}

const spawn = ($: Engine, subagentType: string, description: string, model: string) =>
  $.agent.spawn({ tool_use_id: `t-${description}`, prompt: 'p', description, subagentType, model, provider: 'engine', parentModel: model, background: true, fork: false } as never)

const rows = async ($: Engine) => {
  const desk = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: 'savvy-agents', props: pane })
  const list = (await desk.findAll({ type: 'Svg' })).map(el => String(el.props.source))
  await desk.unmount()
  return list
}

const start = ($: Engine) => $.session.start({ source: 'startup', cwd: '/repo', surface: 'desktop', isInteractive: true } as never)

test('estilo cerveza: todas las filas son cerveza, animadas y dentro del límite del motor', { options: { estilo: 'cerveza' } }, async ($, on) => {
  engine(on)
  await start($)
  await spawn($, 'Explore', 'Primera tarea', 'claude-haiku-5-5')
  await spawn($, 'general-purpose', 'Segunda tarea', 'claude-opus-5-5')
  const list = (await rows($)).filter(s => s.includes('tarea'))
  expect(list).toHaveLength(2)
  for (const s of list) {
    expect(s).toContain('data-estilo="cerveza"')
    expect(s).toContain('animation:sf3')
    expect(s).not.toContain('×')
    expect(s.length).toBeLessThan(MAX_SVG)
  }
})

test('por defecto todas las filas son boxeador con ×N, sin scripts ni enlaces en el SVG', async ($, on) => {
  engine(on)
  await start($)
  await spawn($, 'Explore', 'Uno', 'claude-haiku-5-5')
  await spawn($, 'Plan', 'Dos', 'claude-sonnet-5-5')
  const list = (await rows($)).filter(s => s.includes('Uno') || s.includes('Dos'))
  expect(list).toHaveLength(2)
  for (const s of list) {
    expect(s).toContain('data-estilo="boxeador"')
    expect(s).toContain('animation:sf6')
    expect(s).toContain('×0')
    expect(s).not.toContain('<script')
    expect(s).not.toContain('href=')
    expect(s.length).toBeLessThan(MAX_SVG)
  }
})

test('estilo cangrejo: vuelve al dibujo original', { options: { estilo: 'cangrejo' } }, async ($, on) => {
  engine(on)
  await start($)
  await spawn($, 'Explore', 'Pirata', 'claude-haiku-5-5')
  const row = (await rows($)).find(s => s.includes('Pirata'))
  expect(row).toContain('c-explore run')
  expect(row).not.toContain('data-estilo=')
})

test('estilo minero: todas las filas son minero, animadas y dentro del límite del motor', { options: { estilo: 'minero' } }, async ($, on) => {
  engine(on)
  await start($)
  await spawn($, 'Explore', 'Pica uno', 'claude-opus-5-5')
  await spawn($, 'Plan', 'Pica dos', 'claude-fable-5-1')
  const list = (await rows($)).filter(s => s.includes('Pica'))
  expect(list).toHaveLength(2)
  for (const s of list) {
    expect(s).toContain('data-estilo="minero"')
    expect(s).toContain('animation:sf6')
    expect(s.length).toBeLessThan(MAX_SVG)
  }
})
