# savvy-progress-customized

Copia endurecida del mod [savvy-progress](https://github.com/johnnyvizz/claude-kit/tree/main/plugins/savvy-progress) de johnnyvizz (licencia MIT, ver `LICENSE`). Conserva sus gráficos y animaciones: el panel de subagentes con los cangrejos por tipo, las tarjetas de costo, tokens y tiempo, y la barra sobre el prompt. Se abre o cierra con `/agents-info`.

El README original del autor está en `README.upstream.md`.

## Origen

- Repositorio: `johnnyvizz/claude-kit`, carpeta `plugins/savvy-progress`, versión 1.2.1.
- Commit fijo: `af8902c493f0a8db6be5e44bb74b567571f7824f` (2026-10-12).
- El código se leyó completo antes de copiarlo. No se instala desde el marketplace, así que no se actualiza solo.

## Qué se cambió

1. **Sin herramientas para el modelo:** se quitaron `progress` y `step`, y sus manejadores. El modelo no ve ninguna herramienta nueva.
2. **Sin reescribir prompts:** el original añadía un párrafo al prompt de los subagentes `savvy-*`; aquí `agent.spawn` lo deja pasar tal cual.
3. **El panel se abre con cualquier subagente** (`autoOpen` por defecto `any`).
4. **Nombre propio** (`savvy-progress-customized`), para no chocar con el original si algún día se instala.
5. Se borraron el código y las pruebas que solo servían a esas herramientas. Las pruebas de costo y contexto del autor se conservan; `hooks/seguridad.test.ts` prueba lo anterior.

Lo que se pierde: el detalle de fases y tareas planificadas que la skill `savvy-flow` reportaba con la herramienta `progress`. La barra en sí vuelve en `1.2.1-seguro.3`, alimentada por los subagentes que el mod observa (ver abajo).

## Estilos de las figuras (versión `1.2.1-seguro.2`)

Pixel art propio, generado por código en `hooks/estilos.ts` (sin imágenes ni recursos externos). Un solo tema para todo el panel, elegido con la opción `estilo` (cómo cambiarlo, más abajo):

- **`cerveza`** (por defecto): el recipiente indica el tipo de agente (Explore vaso, Plan pinta, general jarra, otro jarra tradicional) y la cerveza, el modelo (trigo, rubia, roja, negra, dorada para Fable). Cada petición al modelo la llena un 5 %. Al terminar se desborda; si falla queda vacía, gris y rajada.
- **`boxeador`:** el ejercicio rota por orden (cuerda, pera, saco, flexiones, abdominales, correr, pesas). La pantaloneta indica el modelo y la banda, el tipo. ×N cuenta las peticiones al modelo. Suda con contexto > 70 %.
- **`cangrejo`:** el dibujo original del autor.

Las animaciones duran 1 s por ciclo y se atan al reloj, así siguen fluidas aunque la fila se redibuje cada segundo. Respetan `prefers-reduced-motion`.

**Cambiar de tema:** al instalar desde la terminal (pantalla de opciones), con `/config` → **Estilo de las figuras** en una sesión de terminal, o, en cualquier lugar incluida la app de escritorio, en `~/.claude/settings.json`:

```json
"pluginConfigs": {
  "savvy-progress-customized@savvy-progress-customized": { "options": { "estilo": "boxeador" } }
}
```

Si el panel no cambia, abre una sesión nueva. Un valor fuera de `cerveza`, `boxeador` o `cangrejo` vuelve a `cerveza`.

Cambios sobre el original para esto (todos en `register.tsx`, solo de dibujo): importar `hooks/estilos.ts`, leer la opción `estilo`, dibujar la figura en lugar del cangrejo en las filas y en la vista compacta, y correr el texto de la fila a `TX = 64` para dar sitio a la figura.

## Barra sobre el prompt (versión `1.2.1-seguro.3`)

La barra del original (relleno de píxeles, porcentaje y botón ×N) sin depender de savvy-flow: cuenta el **lote actual**, los subagentes desde la última vez que no corría ninguno, por ejemplo `Agents · Tasks 2/3 · 67%`.

- **×N** abre o cierra el panel con un clic (N es el total de subagentes de la sesión).
- **✕** oculta la barra hasta que arranque otro subagente, que empieza un lote nuevo.
- A la derecha va la figura del tema en pequeño: la cerveza se llena con el lote; el boxeador salta la cuerda.
- Si algún día se usa con un flujo que reporte su progreso, la barra muestra ese flujo como el original.

Cambios sobre el original para esto (en `register.tsx` y `types/index.d.ts`, solo de dibujo y estado propio): el hook de la barra usa el lote cuando no hay flujo reportado, `rowSvg` acepta la figura del tema en lugar del cangrejo y ✕ guarda `bandFrom` en el estado del panel.

## Opciones (versión `1.2.1-seguro.4`)

| Opción | Valores | Qué hace |
| --- | --- | --- |
| `estilo` | `cerveza` (defecto), `boxeador`, `cangrejo` | Tema de las figuras. |
| `barra` | `si` (defecto), `no` | Muestra u oculta siempre la barra sobre el prompt. |
| `autoOpen` | `any` (defecto), `savvy`, `never` | `any`: el panel se abre solo con cada lote nuevo de subagentes (si lo cerraste, vuelve con el siguiente); `never`: solo se abre con ×N o `/agents-info`. |
| `language` | `auto`, `en`, `ru`, `he` | Idioma del panel. |

Se cambian como el tema, por ejemplo `cmd /c 'echo {"barra":"no"}| claude plugin configure savvy-progress-customized@savvy-progress-customized --values-stdin'` (las opciones que no pongas conservan su valor).

## Qué puede hacer el mod

Solo lo que expone la API de Claude Code; un mod no tiene `fetch`, Node ni DOM. Este usa:

- **Eventos (solo observa):** inicio de sesión, su comando, llamadas a la herramienta Agent, inicio de subagentes, pasos y fin de turnos, y dibujo.
- **Llamadas:** reloj, registrar `/agents-info`, abrir y cerrar su panel, su propio estado, leer la configuración (solo usa `language`) y las variables `LANG`, `LC_ALL` y `LC_MESSAGES`.
- **Sin acceso a:** red, archivos, procesos, modelos, telemetría ni registro de herramientas.

El costo es una estimación con la tabla de precios del autor (`PRICES` en `hooks/register.tsx`, precios de lista al 2026-10-10), no la factura.

## Verificación

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File verificar.ps1
claude plugin test .
```

`verificar.ps1` falla si algún archivo no coincide con `huellas.sha256`, si aparece texto prohibido (`fetch`, `eval`, `import()`, `$.http`, `$.fs`, `$.process`…) o si el validador de Claude Code reporta eventos, llamadas, hosts de red o telemetría fuera de la lista permitida.

Límite: protege contra cambios no revisados, como una actualización o una copia equivocada. Quien pueda editar esta carpeta también puede editar `huellas.sha256`.
