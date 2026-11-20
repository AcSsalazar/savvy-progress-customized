"""Receta de savvy-progress-customized: el original fijo más cambios exactos y documentados.

Uso, desde la raíz del repositorio:
  python herramientas/endurecer.py verificar
      Rehace los archivos de la receta a partir de original/ y comprueba que coinciden
      byte a byte con plugin/. Sale con código 1 si algo difiere.
  python herramientas/endurecer.py construir <original> <propios> <destino> [--sin-estilos]
      Arma el plugin en <destino>: aplica la receta a <original> y copia encima los
      archivos propios de <propios> (manifiesto, estilos, pruebas, README, guardia).

Cada cambio es un reemplazo exacto que debe encontrarse el número de veces esperado:
si el original cambia, la receta falla en vez de aplicar algo a ciegas.
"""
import difflib
import re
import shutil
import sys
import tempfile
from pathlib import Path

R = "hooks/register.tsx"
# Lo que produce la receta (el resto de plugin/ son archivos propios).
RECETA = [R, "types/index.d.ts", "hooks/cost.test.ts", "hooks/hooks.json", "README.upstream.md"]
QUITADOS = ["hooks/band.test.tsx", "hooks/caller.test.ts", "hooks/register.test.ts"]


def aplicar(dst: Path, estilos: bool = True) -> None:
    def edit(rel, old, new, count=1):
        p = dst / rel
        text = p.read_text(encoding="utf-8")
        found = text.count(old)
        if found != count:
            sys.exit(f"{rel}: se esperaban {count} coincidencias y hay {found} de:\n{old[:120]}")
        p.write_text(text.replace(old, new), encoding="utf-8", newline="\n")

    def cut(rel, start, end_marker):
        """Quita desde `start` hasta `end_marker`, que se conserva."""
        p = dst / rel
        text = p.read_text(encoding="utf-8")
        if text.count(start) != 1 or text.count(end_marker) != 1:
            sys.exit(f"{rel}: marcadores no únicos: {start[:60]!r} / {end_marker[:60]!r}")
        i = text.index(start)
        p.write_text(text[:i] + text[text.index(end_marker, i):], encoding="utf-8", newline="\n")

    # 1. Nombre propio: el estado vive bajo savvy-progress-customized.
    edit(R, "{ plugin: 'savvy-progress', key:", "{ plugin: 'savvy-progress-customized', key:", count=4)
    edit("types/index.d.ts", "'savvy-progress': {", "'savvy-progress-customized': {")

    # 2. Sin nombres de herramientas ni el texto que se añadía a los prompts.
    cut(R, "const TOOL = 'mcp__savvy-progress__progress'\n", "const PANE = 'savvy-agents'\n")
    edit(R, "const PANE = 'savvy-agents'\n",
         "// Copia endurecida de savvy-progress 1.2.1 (MIT, johnnyvizz; commit af8902c):\n"
         "// sin herramientas para el modelo y sin reescribir prompts. Solo observa y dibuja.\n"
         "const PANE = 'savvy-agents'\n")

    # 3. Código que solo servía a la herramienta `progress`: tipos, límites y fusión del flujo.
    cut(R, "const PHASES: readonly Phase[] =", "const ACCENT = '#8f8cf4'\n")
    cut(R, "type ProgressInput = {\n", "// ---------------------------------------------------------------------------\n// Language:")
    cut(R, "const isNewFlow = (prev: Flow | null", "const label = (f: Flow): string =>")

    # 4. session.start ya no registra las herramientas `progress` ni `step`.
    cut(R, "    await $.tool.register({\n      name: 'progress',", "    await $.command.register({\n      name: 'agents-info',")

    # 5. Sin los manejadores de esas herramientas.
    cut(R, "  on('tool.call', { tool: TOOL }, async ($, e) => {", "  // Safety net: worker launches move the faint layer")

    # 6. agent.spawn deja pasar el prompt tal cual.
    edit(R, "    const isUnbriefed = e.subagentType.startsWith('savvy-') && !e.prompt.includes(STEP_TOOL)\n"
            "    const started = await next(isUnbriefed ? { ...e, prompt: e.prompt + STEP_BRIEF } : e)\n",
         "    // Endurecido: el prompt del subagente pasa sin cambios.\n"
         "    const started = await next(e)\n")

    # 7. Las pruebas de las herramientas quitadas se van; la de costos se queda con el nombre nuevo.
    for rel in QUITADOS:
        (dst / rel).unlink()
    edit("hooks/cost.test.ts", "const PLUGIN = 'savvy-progress'\n", "const PLUGIN = 'savvy-progress-customized'\n")

    # 8. Lo que quedó sin uso al quitar la herramienta.
    edit(R, "import type { AgentRun, Flow, Panel, Phase, PlannedTask } from '../types'", "import type { AgentRun, Flow, Panel, PlannedTask } from '../types'")
    edit(R, "const clip = (s: string, max: number): string => (s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s)\n\n", "")

    # 9. El README original se conserva como referencia del autor.
    (dst / "README.md").rename(dst / "README.upstream.md")

    if not estilos:
        return

    # 10. Estilos propios (cerveza o boxeador) desde hooks/estilos.ts, elegidos con la opción `estilo`.
    edit(R, "import type { AgentRun, Flow, Panel, PlannedTask } from '../types'\n",
         "import type { AgentRun, Flow, Panel, PlannedTask } from '../types'\n"
         "import { SPRITE_CSS, estiloOf, sprite } from './estilos'\n"
         "import type { Estilo } from './estilos'\n")
    edit(R, "let lang: Lang = 'en'\n",
         "let lang: Lang = 'en'\n// El estilo de las figuras: la opción `estilo`, fijada en session.start como `lang`.\nlet estilo: Estilo = 'cerveza'\n")
    edit(R, "${PANE_CSS}${CRAB_CSS}${body}</svg>`", "${PANE_CSS}${CRAB_CSS}${SPRITE_CSS}${body}</svg>`")
    edit(R, "const agentSvg = (W: number, a: AgentRun, at: number): string => {",
         "// La figura de un agente: cerveza o boxeador según el estilo; el cangrejo original si el estilo lo pide.\n"
         "const spriteIn = (a: AgentRun, order: number) => ({ type: a.type, model: a.model, status: a.status, steps: a.steps, ctx: ctxOf(a), order })\n\n"
         "// Columna de la figura: el texto de la fila empieza en TX (el original usaba 42 para el cangrejo).\n"
         "const TX = 64\n\n"
         "const rowSprite = (W: number, a: AgentRun, at: number, order: number): string =>\n"
         "  sprite(spriteIn(a, order), estilo, at, { x: mx(W, 0, TX - 4), y: 4, w: TX - 4, h: 58, scale: 1.5, rtl: isRtl(), animate: true }) ??\n"
         "  rowCrab(W, 0, 14, costumeOf(a.type), false, a.status === 'running')\n\n"
         "const agentSvg = (W: number, a: AgentRun, at: number, order = 0): string => {")
    # En agentSvg, el texto y la barra se corren a TX para dar sitio a la figura más grande.
    p = dst / R
    t = p.read_text(encoding="utf-8")
    i = t.index("const agentSvg = (W: number, a: AgentRun, at: number, order = 0): string => {")
    j = t.index("const plannedSvg = ", i)
    block, n = re.subn(r"\b42\b", "TX", t[i:j])
    if n != 7:
        sys.exit(f"agentSvg: se esperaban 7 apariciones de 42 y hay {n}")
    p.write_text(t[:i] + block + t[j:], encoding="utf-8", newline="\n")
    edit(R, "  if (a.status === 'failed') meta.push(s.failed)\n",
         "  if (a.status === 'failed') meta.push(s.failed)\n  if (estilo === 'boxeador') meta.push(`×${a.steps}`)\n")
    edit(R, "    `${rowCrab(W, 0, 14, costumeOf(a.type), false, a.status === 'running')}\n", "    `${rowSprite(W, a, at, order)}\n")
    edit(R, "const compactSvg = (W: number, list: AgentRun[], planned: Planned[], t: ReturnType<typeof totals>): string => {",
         "const compactSvg = (W: number, list: AgentRun[], planned: Planned[], t: ReturnType<typeof totals>, at = 0): string => {")
    edit(R, "s: 'running', dim: false })),", "s: 'running', dim: false, a })),")
    edit(R, "s: a.status, dim: false })),", "s: a.status, dim: false, a })),")
    edit(R, "s: 'planned', dim: true })),", "s: 'planned', dim: true, a: undefined as AgentRun | undefined })),")
    edit(R, "    .map((ic, i) => rowCrab(W, i * 36, 0, ic.k, ic.dim, ic.s === 'running') +",
         "    .map((ic, i) =>\n"
         "      ((ic.a ? sprite(spriteIn(ic.a, list.indexOf(ic.a)), estilo, at, { x: mx(W, i * 36, 32), y: 1, w: 32, h: 30, scale: 0.8, rtl: isRtl(), animate: false }) : null) ??\n"
         "        rowCrab(W, i * 36, 0, ic.k, ic.dim, ic.s === 'running')) +")
    edit(R, "compactSvg(W, list, planned, t)}", "compactSvg(W, list, planned, t, at)}")
    edit(R, "source={agentSvg(W, a, at)}", "source={agentSvg(W, a, at, list.indexOf(a))}", count=2)
    edit(R, "    lang = await detectLang($, options.language)\n",
         "    lang = await detectLang($, options.language)\n    estilo = estiloOf(options.estilo)\n")

    # 11. Barra sobre el prompt sin savvy-flow: el dibujo del original alimentado por el lote
    #     de subagentes observado, con su botón ×N y ✕ (que la oculta hasta el siguiente lote).
    edit("types/index.d.ts", "  autoOpenedFor: string\n}",
         "  autoOpenedFor: string\n  /** Desde cuándo cuenta la barra propia: ✕ la oculta hasta el siguiente lote. */\n  bandFrom?: number\n}")
    edit(R, "const rowSvg = (f: Flow, W: number, isWorking: boolean): string => {",
         "// Sin savvy-flow nadie reporta un flujo: la barra cuenta el lote actual, los subagentes\n"
         "// desde la última vez que no corría ninguno (y desde que se ocultó con ✕).\n"
         "const batchOf = (list: AgentRun[], from: number): AgentRun[] => {\n"
         "  const sorted = list.filter(a => a.startedAt >= from).sort((a, b) => a.startedAt - b.startedAt)\n"
         "  let start = 0\n"
         "  let busy = -Infinity\n"
         "  sorted.forEach((a, i) => {\n"
         "    if (a.startedAt > busy) start = i\n"
         "    busy = a.status === 'running' ? Infinity : Math.max(busy, a.endedAt ?? a.startedAt)\n"
         "  })\n"
         "  return sorted.slice(start)\n"
         "}\n\n"
         "const batchFlow = (list: AgentRun[], from: number): Flow | null => {\n"
         "  const batch = batchOf(list, from)\n"
         "  if (!batch.length) return null\n"
         "  const done = batch.filter(a => a.status !== 'running').length\n"
         "  return { title: tr().pane, total: batch.length, done, running: batch.length - done, phase: 'delegate', isFinished: done === batch.length, tasks: [] }\n"
         "}\n\n"
         "// La figura de la barra: la del tema en pequeño (la cerveza se llena con el lote); null deja el cangrejo.\n"
         "const bandFigure = (list: AgentRun[], f: Flow, W: number, at: number): string | null => {\n"
         "  const a = list.find(r => r.status === 'running') ?? list[list.length - 1]\n"
         "  const fig = sprite(\n"
         "    { type: a?.type ?? 'general-purpose', model: a?.model ?? '', status: f.isFinished ? 'done' : 'running', steps: 0, level: ratio(f), ctx: 0, order: 0 },\n"
         "    estilo, at, { x: isRtl() ? 0 : W - CRAB_W - 4, y: 0, w: CRAB_W + 4, h: H, scale: 0.72, rtl: isRtl(), animate: !f.isFinished },\n"
         "  )\n"
         "  return fig && SPRITE_CSS + fig\n"
         "}\n\n"
         "// ✕ en la barra: un flujo reportado se borra como en el original; el lote propio se oculta\n"
         "// hasta que arranque otro subagente.\n"
         "async function dismissBand($: EngineInterface): Promise<void> {\n"
         "  if (await read($, flow)) {\n"
         "    await update($, flow, () => null)\n"
         "    return\n"
         "  }\n"
         "  const t = await $.clock.now()\n"
         "  await update($, panel, prev => ({ ...prev, bandFrom: t + 1 }))\n"
         "}\n\n"
         "const rowSvg = (f: Flow, W: number, isWorking: boolean, figure: string | null = null): string => {")
    edit(R, "${CRAB_CSS}${crab(rx(W - CRAB_W + 1, crabW), 0, 'other', false, isWorking, 0.8, rtl)}",
         "${figure ?? `${CRAB_CSS}${crab(rx(W - CRAB_W + 1, crabW), 0, 'other', false, isWorking, 0.8, rtl)}`}")
    edit(R, "    const f = await read($, flow)\n    if (f === null || e.props.hasSurvey) return next(e)\n",
         "    // La opción `barra` en `no` la apaga del todo; el panel sigue con ×N y /agents-info.\n"
         "    if (e.props.hasSurvey || options.barra === 'no') return next(e)\n"
         "    const list = await read($, agents)\n"
         "    const p: Panel = await read($, panel)\n"
         "    const at = await read($, now)\n"
         "    const f = (await read($, flow)) ?? batchFlow(list, p.bandFrom ?? 0)\n"
         "    if (f === null) return next(e)\n")
    edit(R, "    const list = await read($, agents)\n    const crew = list.length", "    const crew = list.length")
    edit(R, "        onPress={() => update($, flow, () => null)}\n", "        onPress={() => void dismissBand($)}\n")
    # 12. El panel se reabre solo con cada lote nuevo (autoOpen any), no una vez por sesión;
    #     autoOpen never no lo abre nunca solo.
    edit(R, "    if (e.subagentType.startsWith('savvy-')) {\n      const f = await read($, flow)\n",
         "    if (options.autoOpen !== 'never' && e.subagentType.startsWith('savvy-')) {\n      const f = await read($, flow)\n")
    edit(R, "      await autoOpen($, 'any-agent')\n",
         "      // Una vez por lote: si se cerró, vuelve cuando arranca el lote siguiente.\n"
         "      await autoOpen($, `lote-${batchOf(await read($, agents), 0)[0]?.startedAt ?? 0}`)\n")
    # 13. Opción historial: sesion (como el original) o lote (el panel muestra solo el lote actual).
    edit(R, "    const { Box, Text, Button } = ui\n    const list = await read($, agents)\n    const f = await read($, flow)\n",
         "    const { Box, Text, Button } = ui\n"
         "    // historial lote: el panel muestra solo el lote actual, como un flujo nuevo del original.\n"
         "    const all = await read($, agents)\n"
         "    const list = options.historial === 'lote' ? batchOf(all, 0) : all\n"
         "    const f = await read($, flow)\n")
    edit(R, "source={rowSvg(f, width, isWorking)}", "source={rowSvg(f, width, isWorking, bandFigure(list, f, width, at))}")


def construir(original: Path, propios: Path, destino: Path, estilos: bool) -> None:
    if destino.exists():
        shutil.rmtree(destino)
    shutil.copytree(original, destino)
    aplicar(destino, estilos)
    for f in propios.rglob("*"):
        if f.is_file():
            target = destino / f.relative_to(propios)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(f, target)
    print(f"ok: {destino}")


def verificar(raiz: Path) -> int:
    fallas = []
    with tempfile.TemporaryDirectory() as tmp:
        hecho = Path(tmp) / "plugin"
        shutil.copytree(raiz / "original", hecho)
        aplicar(hecho)
        for rel in RECETA:
            a, b = hecho / rel, raiz / "plugin" / rel
            if not b.exists():
                fallas.append(f"falta en plugin/: {rel}")
            elif a.read_bytes() != b.read_bytes():
                diff = difflib.unified_diff(a.read_text(encoding="utf-8").splitlines(), b.read_text(encoding="utf-8").splitlines(), "receta/" + rel, "plugin/" + rel, lineterm="", n=1)
                fallas.append(f"difiere de la receta: {rel}\n" + "\n".join(list(diff)[:40]))
    for rel in QUITADOS:
        if (raiz / "plugin" / rel).exists():
            fallas.append(f"debería no estar: plugin/{rel}")
    if fallas:
        print("FALLA: plugin/ no es el original más la receta:")
        for f in fallas:
            print("  - " + f)
        return 1
    print("OK: plugin/ es exactamente original/ más los cambios de la receta (y los archivos propios).")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    args = sys.argv[1:]
    if args[:1] == ["verificar"]:
        sys.exit(verificar(Path(args[1]) if len(args) > 1 else Path(__file__).resolve().parent.parent))
    if args[:1] == ["construir"] and len(args) >= 4:
        construir(Path(args[1]), Path(args[2]), Path(args[3]), "--sin-estilos" not in args)
        sys.exit(0)
    print(__doc__)
    sys.exit(2)
