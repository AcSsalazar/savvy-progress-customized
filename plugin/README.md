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

Lo que se pierde: la barra de progreso de la skill `savvy-flow`, que dependía de la herramienta `progress`.

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
