# SEYF en HackMeridian: plan de 12 horas

Oct 25, 2026 · @Clavely

## Resumen

En mainnet entregamos una sola cosa: ahorro para el retiro en un vault USDC de DeFindex, más un adelanto de rendimiento. El adelanto lo paga un contrato de SEYF que funciona como tesorería, y el ahorro del usuario se libera cuando el rendimiento cubre ese adelanto. La construcción va de las 19:00 a las 07:00 (12 horas, hora de Lisboa); a las 07:00 se congela el código y la entrega cierra el lunes 26 de octubre a las 12:00.

- **Lo que cambió con los mentores:** ya no se migra toda la app ni se lleva todo a `main`. Se hace una feature enfocada en la rama `meridian`, y `main` queda como está (`92e5b40`).
- **El adelanto:** sale de la tesorería del contrato. El capital del usuario no se toca, pero su ahorro queda bloqueado mientras el adelanto esté vivo.
- **Dos salidas:** si el usuario repaga antes, se desbloquea todo; si no, el contrato espera a que el rendimiento cubra el adelanto y lo liquida solo.
- **Este plan sustituye** al Claude Doc anterior y a `docs/hackmeridian-plan.md` en lo que resta del hackathon. Lo que no aparece aquí no se hace.

## Alcance

El MVP es una pantalla nueva y aislada (`/retiro`) sobre Stellar mainnet. El resto de la app no se toca: lo EVM se queda como está y simplemente no aparece en esta ruta.

| Entra (mainnet) | Queda fuera |
| --- | --- |
| Login con Pollar y sesión SEP-10 (fix a la API v3 de Pollar) | Migrar toda la app y quitar lo EVM (bloque B2 del plan de MarxMad) |
| Cuenta creada por Pollar y trustline USDC patrocinada, sin XLM para el usuario | Etherfuse, rampa MXN por SPEI, KYC y CETES |
| Recibir USDC (dirección G y QR) | Swaps con Soroswap |
| Depositar y retirar del vault USDC de DeFindex (estrategia Blend) | Trustless Work y `seyf-lock` tal como está |
| Ver el ahorro: saldo, rendimiento y proyección al retiro | Subir stellar-sdk a 16 o 17 y quitar Reflector (bloque B1) |
| Adelanto de rendimiento: cotizar, pedir, repagar y liquidar | Landing nueva (solo un botón hacia `/retiro`) |
| Liquidación automática con un keeper | Passkeys y smart accounts |
| README, video y deck con hashes de mainnet | Persistir el flujo nuevo en Supabase: la cadena es la fuente de verdad |

## Producto: el recorrido del usuario

El usuario ahorra para su retiro en tres pasos, sin comprar XLM ni guardar una frase semilla. El adelanto es opcional y nunca toca el capital.

&#91;embedded content: recorrido en /retiro · 3 pasos de ahorro, adelanto con 2 salidas\]

Mientras el ahorro está bloqueado, sigue rindiendo en Blend. Si el vault pierde valor, las acciones se quedan bloqueadas hasta que el usuario repague.

La ruta `/retiro` tiene cuatro pantallas: **Entrar**, **Fondear**, **Mi ahorro** (saldo, rendimiento y proyección al retiro) y **Adelanto** (cotizar, pedir, ver el bloqueo, repagar).

## Contrato tesorería del adelanto

Tomamos `seyf_advance` como base, porque ya cumple cinco de las seis reglas de los mentores y le falta solo una: que la tesorería viva dentro del contrato. Eso se resuelve en unas 2 horas sobre un contrato que ya pasa 14 pruebas. Llevar `seyf-lock` a estas reglas implicaría reescribir el desbloqueo, la salida anticipada y el depósito.

| Regla de los mentores | `seyf_advance` | `seyf-lock` |
| --- | --- | --- |
| El adelanto sale de la tesorería y no del capital del usuario | Sí, desde una cuenta de liquidez con allowance | Sí, desde un pool dentro del contrato |
| La tesorería es un contrato | No: es una cuenta aparte (cambio 1) | Sí |
| Se bloquea el ahorro que el usuario ya tiene | Sí: bloquea las acciones del vault que el usuario ya tiene | No: el usuario manda USDC nuevo y el contrato lo deposita |
| Si repaga antes, se desbloquea todo | Sí: `repay` devuelve el adelanto y recupera todas sus acciones | Sí, pero paga A menos el rendimiento, y ese rendimiento se va al pool |
| Si no repaga, sigue bloqueado hasta que el rendimiento cubra el adelanto | Sí: `settle` solo procede si V\_now ≥ V\_open + A | No: libera en una fecha fija aunque el rendimiento no alcance |
| El capital del usuario no se toca | Sí: `settle` retira solo las acciones que valen A | Sí, pero si falta rendimiento lo absorbe el pool |

**Fórmulas** (sin cambios): el adelanto es A = V × apy\_bps × días / (10 000 × 365), redondeado hacia abajo y con tope de LTV. Al liquidar, el contrato retira techo(A × acciones / V\_now) acciones hacia la tesorería y le devuelve el resto al usuario.

**Cambios al contrato** (frente C, unas 2 horas):

1. **Tesorería dentro del contrato:**
   - `fund_treasury(from, amount)`: cualquiera puede aportar.
   - `withdraw_treasury(to, amount)`: solo el admin y solo sobre el saldo libre.
   - Se quitan `liquidity` y el allowance. El contrato guarda en USDC solo la tesorería; las acciones bloqueadas no salen por esa función.
2. **`repay` también funciona en pausa:** hoy devuelve Paused; con el cambio, la pausa solo frena adelantos nuevos (esta regla viene de `seyf-lock`).
3. **`settle` lo puede llamar cualquiera**, incluido el keeper, y también en pausa. El mínimo de salida ya está fijo en A. Las dos cosas ya están en el código y no se tocan.
4. **Eventos nuevos:** `TreasuryFunded` y `TreasuryWithdrawn`.
5. **Sin `upgrade` en la beta.** Se mantienen la lista de permitidos, los topes por usuario y global, y el cambio de admin en dos pasos.
6. **Pruebas:** se ajustan las 14 y se agregan las de tesorería aislada y `repay` en pausa, para quedar en unas 17. El job de CI se adapta a `soroban/`.

**Parámetros de la beta en mainnet:** tesorería de 2 USDC, adelanto máximo de 1 USDC por usuario y 2 USDC en total, plazo de 1 a 30 días y la lista de permitidos encendida. El contrato admite una sola posición por usuario, así que el repago y el settle de la demo usan dos cuentas, las dos en la lista y con acciones del vault.

`apy_bps` se fija en un décimo del APY real del vault. Cubrir A tarda días × `apy_bps` / APY real, así que un adelanto de 1 día queda cubierto en unas 2.4 horas. El APY real se mide con el valor de la acción del vault entre las 23:30 y la 01:00, antes de abrir el primer adelanto. Esto es lo que permite mostrar un `settle` real en mainnet antes de grabar el video.

**Escala del adelanto:** con 20 USDC a 1 día y 100 bps, A = 0.00055 USDC; a 30 días y 400 bps, A = 0.066 USDC. En la beta los montos son centavos, así que el video y el deck muestran la cotización a escala (10 000 USDC a 30 días al 4% dan 32.88 USDC) y usan los hashes de mainnet como prueba de que funciona.

## Arquitectura y piezas que se reutilizan

El servidor nunca guarda fondos. Solo arma el XDR, el usuario lo firma con Pollar y nuestro sponsor paga la comisión con un fee-bump. El patrocinio propio de Pollar va apagado en su app de mainnet: si Pollar devolviera ya un fee-bump, nuestra ruta de envío lo rechazaría. Casi todo ya existe en `meridian`: lo nuevo es el contrato, las rutas del adelanto, la pantalla y el keeper.

&#91;embedded content: arquitectura de /retiro · navegador, servidor, mainnet y keeper\]

El contrato recibe las acciones del vault y, al liquidar, retira del vault solo el monto A hacia su tesorería. El keeper puede llamar `settle` sin tener fondos de nadie.

| Pieza | Ya existe en `meridian` | Qué falta | Frente |
| --- | --- | --- | --- |
| Login | `SeyfPollarProvider`, `SeyfAuthBridge` | La app de Pollar en mainnet | I |
| Sesión SEP-10 | `src/lib/stellar/sep10.ts`, `sep10-client.ts`, `/api/auth/sep10` | Firmar el challenge con `/v3/stellar/sep10/sign` | A |
| Patrocinio | `src/lib/stellar/sponsor.ts`, `sponsor-client.ts`, `/api/stellar/sponsor/{create-account,trustline,submit}` | Restringirlo en la beta a la lista de permitidos y a transacciones del contrato, el vault y la trustline USDC, con tope al `resourceFee` (A); usarlo desde `/retiro` (U) | A y U |
| Vault | `src/lib/defindex/*`, `/api/defindex/{deposit,withdraw,positions,submit}` (usa la API de DeFindex) | Sin `DEFINDEX_API_KEY`: armar `deposit` y `withdraw` directo por RPC en `/api/vault/*` | B |
| Firma y envío Soroban | `src/lib/defindex/sign-and-submit.ts`, `prepare-xdr.ts` | Nada de red: el RPC que ya usa el código (mainnet.sorobanrpc.com) responde en Protocol 29 y está en la lista oficial; se fija por env, con gateway.fm de respaldo | A |
| Contrato | `contracts-soroban/seyf_advance` en la rama `feat/seyf-advance` del fork | Traerlo a `soroban/` en `meridian` con la tesorería dentro | C |
| Rutas del adelanto | Nada | `/api/advance/{quote,build,position}` | B |
| Pantalla | `ProjectionCard`, `ui.tsx` | `src/app/retiro/*`, con su propio layout que monte SeyfPollarProvider (hoy Pollar solo se monta en /app, junto con Privy) | U |
| Keeper | Nada | `scripts/keeper.mjs` y su workflow | K |
| Chequeo de mainnet | `scripts/check-mainnet.mjs` | Pedir solo el vault USDC y el contrato; quitar XLM, CETES, Soroswap y DEFINDEX\_API\_KEY | A |

## Decisiones cerradas

Las ocho decisiones quedaron cerradas el 25 de octubre antes de las 19:30, y en todas se tomó la recomendación. La revisión de las 19:45 ajustó la 2, 3, 4, 7 y 8 con datos verificados: el vault no necesita API key, el dominio de una rama necesita una excepción de protección, GitHub solo corre workflows programados en la rama por defecto y el patrocinio de Pollar choca con nuestro fee-bump. La alternativa queda anotada por si algún plan B la necesita.

| # | Decisión | Recomendación | Alternativa | Decide | Estado |
| --- | --- | --- | --- | --- | --- |
| 1 | Contrato del adelanto | `seyf_advance` con la tesorería dentro del contrato | `seyf-lock` tal como está, aunque libera por fecha | Ian y MarxMad | Decidido |
| 2 | Vault USDC en mainnet | Vault propio creado con la CLI desde la factory pública de DeFindex, que no pide API key, con vault\_fee en 0 | Un vault USDC público de DeFindex que ya exista (hay que preguntárselo a DeFindex) | MarxMad | Decidido |
| 3 | URL que ven los jueces | Dominio fijo para la rama `meridian` en Vercel, registrado en Pollar y en Deployment Protection Exceptions (si no, pide login de Vercel) | Quitar la protección de todos los previews de Vercel | MarxMad | Decidido |
| 4 | Repo que ven los jueces | `meridian` como rama por defecto mientras dura la evaluación (así corre el keeper programado y los jueces entran directo) + tag `pre-hackmeridian` en `f1d8e46` | Link directo a `tree/meridian` con `main` por defecto; el keeper corre desde el fork o con un cron externo | Ian | Decidido |
| 5 | Qué hacer con `seyf-lock` | Moverlo a la rama `archive/seyf-lock` y sacarlo de `meridian` | Dejarlo en el repo marcado como alternativa evaluada | MarxMad | Decidido |
| 6 | Margen de SEYF | Ninguno en la beta: la tesorería recupera exactamente A, como propuso el mentor | Cobrar una comisión al liquidar | Ian | Decidido |
| 7 | Keeper que liquida solo | GitHub Actions cada 10 minutos desde meridian como rama por defecto (decisión 4), llamando `settle` con una llave sin fondos de usuarios | Cron externo que llame una ruta en Vercel (el cron de Vercel en Hobby corre solo una vez al día, con ±59 min) | Ian | Decidido |
| 8 | Firma en mainnet | Pollar, con una app de mainnet propia y su patrocinio apagado: las comisiones las paga nuestro sponsor | Stellar Wallets Kit con Freighter, si Pollar falla a las 23:00 | Ian | Decidido |

## Equipo y frentes paralelos

Hay siete frentes que corren al mismo tiempo, y ninguno toca los archivos de otro. Ian coordina y desbloquea las dependencias; cada frente de código puede llevar su propia sesión de Claude. El equipo son dos personas, Ian y MarxMad. Sesiones de Claude escriben el código de los frentes de código, y cada persona revisa y mergea los PRs de sus frentes.

| Frente | Responsable | Archivos (solo los suyos) | Entrega |
| --- | --- | --- | --- |
| **C · Contrato** | Sesión de Claude, revisa y despliega MarxMad | `soroban/`, `.github/workflows/contracts.yml` | Contrato con unas 17 pruebas en verde, ciclo completo en testnet y despliegue en mainnet |
| **A · Auth y red** | Sesión de Claude, revisa Ian | `src/lib/pollar/client-api.ts`, `src/lib/stellar/sep10-client.ts`, `src/lib/stellar/network.ts`, `src/lib/defindex/{prepare-xdr,catalog}.ts`, `src/lib/stellar/path-payment.ts`, `src/lib/stellar/sponsor.ts`, `src/app/api/stellar/sponsor/*` | SEP-10 con Pollar v3 y la app apuntando a mainnet por env, sin emisores de testnet fijos en el código; sponsor restringido a la beta y con tope al resourceFee |
| **B · Backend del flujo** | Sesión de Claude, revisa MarxMad | `src/app/api/advance/*`, `src/lib/advance/*`, `src/app/api/vault/*` | Rutas que arman el XDR (el usuario firma con Pollar y el sponsor paga el fee-bump) y leen la posición |
| **U · Pantalla `/retiro`** | Sesión de Claude, revisa Ian | `src/app/retiro/*` (con su layout de Pollar), `src/components/retiro/*` | Las cuatro pantallas del recorrido, sin datos falsos |
| **K · Keeper** | Sesión de Claude, revisa MarxMad | `scripts/keeper.mjs`, `.github/workflows/keeper.yml` | `settle` automático de las posiciones que ya se pueden liquidar |
| **I · Infra y fondos** | MarxMad (Vercel, DeFindex) e Ian (Pollar, fondos) | Solo env y dashboards; nunca llaves en git | Todo lo de la ruta crítica, antes de su hora límite |
| **E · Entregables** | Ian, con todo el equipo | `README.md`, `docs/` | README, video, deck y formulario |

**Cómo se integra el trabajo:**

- **Primero, el PR #0 a `meridian`:** trae el arreglo del lockfile (`0cf26da`; sin él, `npm ci` falla en el CI de todos los PRs) y pone en `docs/hackmeridian-plan.md` y `docs/seyf-context.md` un aviso que apunte a este plan, porque las sesiones de Claude los leen desde `CLAUDE.md`.
- Cada frente trabaja en su rama `feat/<frente>`, que sale de `meridian`.
- Todo entra por PR a `meridian`. A `main` no se hace push.
- Antes de mergear: `npm run build` en verde y, para el contrato, `cargo test` en verde.
- Las llaves y los secretos solo van en Vercel o en el llavero local: nunca en git ni en el chat.

## Cronograma y puertas

El código se congela a las 07:00. De ahí hasta el cierre quedan 5 horas para el video, el deck y el envío, que sale a las 11:00 con una hora de margen. En azul está la ruta crítica: fondos, llaves, despliegue en mainnet y el flujo completo; si algo de ahí se atrasa, se atrasa todo.

&#91;embedded content: cronograma · 19:00 a 12:00, cinco puertas\]

El primer adelanto en mainnet se abre a la 01:00 desde la CLI, con una cuenta de CLI que ya tiene acciones del vault, porque la pantalla todavía no está lista. Con apy\_bps en un décimo del APY, el rendimiento lo cubre hacia las 03:30 y quedan cuatro horas de margen antes de grabar.

| Puerta | Hora | Hecho cuando |
| --- | --- | --- |
| P1 | 20:30 | Las ocho decisiones están cerradas; hay app de Pollar en mainnet; el PR #0 está en meridian y meridian es la rama por defecto |
| P2 | 22:30 | El contrato con la tesorería pasa unas 17 pruebas; SEP-10 v3 funciona en testnet; la app compila apuntando a mainnet por env |
| P3 | 01:00 | Hay vault USDC en mainnet con un depósito y un retiro chicos que pasaron por Blend. El contrato está desplegado con topes, con la tesorería fondeada, apy\_bps fijado con el APY medido y el primer adelanto abierto desde la CLI |
| P4 | 03:30 | `/retiro` completo en testnet: entrar, fondear, ahorrar, pedir el adelanto y repagar |
| P5 | 05:30 | El mismo recorrido en mainnet, con hashes, y el keeper corriendo |
| Congelado | 07:00 | En `meridian` solo entran arreglos de la demo, el README y docs/ |
| Entrega | 11:00 | Formulario enviado; el cierre es a las 12:00 |

**Descanso por turnos** (propuesta): Ian de 01:30 a 04:00, después de P3; MarxMad de 04:00 a 06:30.

## Ruta crítica: dependencias, llaves y fondos

Lo que más puede atrasar el plan no es el código: son los fondos en mainnet y la app de Pollar en mainnet (la API key de DeFindex ya no hace falta). Por eso estas tareas arrancan a las 19:00, en paralelo con todo lo demás, y cada una tiene un plan B que se activa a su hora límite.

| Tarea | Para qué | Quién | Hora límite | Plan B | Avance |
| --- | --- | --- | --- | --- | --- |
| Comprar unos 60 USDC y 150 XLM en Coinbase, que soporta USDC por Stellar, y retirarlos por esa red: primero el XLM, que crea la cuenta; luego la trustline USDC; al final el USDC | Tesorería (2 USDC), depósitos de la demo en dos cuentas, sponsor, despliegue y keeper | Ian | Arranca 19:15; en cuenta 22:00 | Convertir XLM a USDC con un path payment en el SDEX | Pendiente |
| App de Pollar en mainnet: API key, dominio y redirect URIs, con el patrocinio de Pollar apagado. Preguntar cuánto XLM ponen en las wallets nuevas | Login y firma en mainnet | Ian | 20:30 | Stellar Wallets Kit con Freighter | Pendiente |
| Vault USDC propio creado con la CLI desde la factory pública (direcciones abajo): estrategia USDC Blend autocompound, 4 roles y vault\_fee en 0. No pide API key | El vault donde vive el ahorro | MarxMad | 23:00 | Vault USDC público que ya exista | Pendiente |
| RPC de mainnet: fijar por env el que ya usa el código, mainnet.sorobanrpc.com, con gateway.fm de respaldo (los dos están en la [lista oficial](https://developers.stellar.org/docs/data/apis/rpc/providers)); SDF no corre uno público en mainnet | Simular y enviar transacciones Soroban | Ian | 20:30 | Otro proveedor de la misma lista | Pendiente |
| Llaves de mainnet: admin del contrato, sponsor, firmante SEP-10 y keeper, generadas con `stellar keys generate --secure-store` | Desplegar, patrocinar, autenticar y liquidar | MarxMad e Ian | 21:00 | Admin de una sola llave con topes bajos, y se declara en el README | Pendiente |
| Dominio fijo para la rama `meridian`, registrado en Pollar y en Deployment Protection Exceptions; confirmar que la rama de producción de Vercel siga siendo main | URL de los jueces y dominio permitido en Pollar | MarxMad | 21:00 | Quitar la protección de todos los previews | Pendiente |
| Variables de entorno en Vercel solo para la rama `meridian`, y redeploy de producción desde 92e5b40 (hoy sirve 262da50) | Que el deploy de esa rama corra en mainnet | MarxMad | 22:00 | Ninguno: bloquea la demo | Pendiente |
| Metas del intake de Scale copiadas al README | Los jueces de Scale evalúan contra esas metas | Ian | 20:00 | Escribir las metas a partir de este plan | Pendiente |
| Tag `pre-hackmeridian` en `f1d8e46` (mismo árbol que `92e5b40`, pero ancestro de `meridian`) y `meridian` como rama por defecto | Separar el trabajo previo del hecho en el evento; que corra el keeper programado | Ian | 20:00 | Si no se puede cambiar la rama por defecto: keeper desde el fork o con un cron externo | Pendiente |

**Variables de mainnet:**

- Ya existen en `scripts/check-mainnet.mjs`: `NEXT_PUBLIC_POLLAR_API_KEY`, `NEXT_PUBLIC_STELLAR_NETWORK`, `NEXT_PUBLIC_POLLAR_STELLAR_NETWORK`, `NEXT_PUBLIC_SOROBAN_RPC_URL`, `NEXT_PUBLIC_DEFINDEX_VAULT_USDC`, `STELLAR_USDC_ISSUER`, `STELLAR_SPONSOR_SECRET`, `STELLAR_SPONSOR_MAX_FEE`, `SEP10_SERVER_SECRET`, `SEP10_HOME_DOMAIN`, `SEYF_AUTH_JWT_SECRET` y `DEFINDEX_API_KEY`.
- Nuevas: `NEXT_PUBLIC_STELLAR_ADVANCE_CONTRACT` y `KEEPER_SECRET`. Esta última va solo como secreto de GitHub. No se llama `NEXT_PUBLIC_SEYF_ADVANCE_CONTRACT` porque se confunde con `NEXT_PUBLIC_SEYF_ADVANCE_ADDRESS`, que es del contrato EVM. El vault USDC se fija en `NEXT_PUBLIC_DEFINDEX_VAULT_USDC` y en `NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS`, porque `catalog.ts` y `vaults.ts` leen nombres distintos.

**Direcciones de mainnet verificadas** el 25 de octubre, en los repos de DeFindex y Soroswap y en el ledger:

- Factory de DeFindex: `CDKFHFJIET3A73A2YN4KV7NSV32S6YGQMUFH3DNJXLBWL4SKEGVRNFKI` (124 vaults creados).
- Estrategia USDC Blend autocompound: `CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP`.
- Router de Soroswap, que la factory pide como parámetro: `CAG5LRYQ5JVEUI5TEID72EYOVX44TTUJT5BQR2J6J77FH65PCCFAJDDH`.
- USDC de Circle (contrato del activo): `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`.
- Roles del vault: 0 manager de emergencia, 1 receptor de comisiones, 2 manager, 3 manager de rebalanceo.
- RPC: `https://mainnet.sorobanrpc.com` y, de respaldo, `https://soroban-rpc.mainnet.stellar.gateway.fm`.

## Reglas de recorte

Cada puerta tiene un recorte ya decidido, para que nadie tenga que discutirlo a las 3 de la mañana. La regla que está por encima de todas: el depósito al vault en mainnet nunca se pone en riesgo por una pieza extra.

| Hora | Si no está listo… | Entonces |
| --- | --- | --- |
| 22:00 | Fondos en mainnet | Convertir XLM a USDC en el SDEX. Si no hay ni XLM, pedir unos USDC al equipo o a los mentores. |
| 22:30 | Contrato con la tesorería dentro, en verde | Se despliega `seyf_advance` sin cambios: tesorería en una cuenta con allowance, ya probada con 14 pruebas y CI. La tesorería como contrato se presenta como siguiente paso. |
| 22:30 | SEP-10 con Pollar v3 | Sin nuestro sponsor: Pollar ya crea y fondea la wallet, y el usuario firma su trustline con /tx/sign pagando su reserva. Si la wallet no trae XLM suficiente, se le manda desde la cuenta del equipo. La CLI no sirve aquí: no puede firmar por una wallet de Pollar. Nunca `SEYF_DB_AUTH_MODE=audit`. |
| 23:00 | Pollar firmando en mainnet | Stellar Wallets Kit con Freighter (unas 1.5 h). Si tampoco funciona: Pollar en testnet y la evidencia de mainnet con la CLI, y se declara así. |
| 01:00 | Vault USDC propio en mainnet | Usar un vault USDC público de DeFindex. Si no hay ninguno, todo el flujo queda en testnet y en mainnet solo cuenta, trustline y USDC; se declara. |
| 03:30 | `/retiro` completo en testnet | Se reduce a dos pantallas, Ahorro y Adelanto, sin proyección. La funcionalidad se mantiene. |
| 05:30 | Keeper automático | `settle` desde un botón en la app (cualquiera puede llamarlo), con evidencia por CLI; el keeper queda como siguiente paso. |
| 07:00 | Un `settle` real en mainnet (el rendimiento no alcanzó) | Se muestra el `settle` de testnet con rendimiento simulado y, en mainnet, `unlock_status` acercándose; se declara. |

Si un frente se pasa un 50% de su tiempo, se activa su plan B sin esperar a la puerta.

## Evidencia y entregables

Los jueces de Scale miden qué tan listo para producción está el producto, así que cada paso del recorrido deja un hash de mainnet en el README. Los entregables se escriben desde las 05:00, en paralelo con el cierre del código.

**Evidencia (cada hash va al README, en la sección Mainnet):**

| # | Operación | Red | Avance |
| --- | --- | --- | --- |
| 1 | Sesión SEP-10 con Pollar (sin transacción; va una captura) | mainnet | Pendiente |
| 2 | Wallet creada por Pollar y trustline USDC patrocinada | mainnet | Pendiente |
| 3 | USDC recibido desde un exchange | mainnet | Pendiente |
| 4 | Depósito al vault USDC de DeFindex | mainnet | Pendiente |
| 5 | Despliegue del contrato y `fund_treasury` | mainnet | Pendiente |
| 6 | `open_advance`: adelanto pagado y ahorro bloqueado (cuentas 1 y 2) | mainnet | Pendiente |
| 7 | `repay`: repago antes de tiempo y desbloqueo total (cuenta 2) | mainnet | Pendiente |
| 8 | `settle` del keeper cuando el rendimiento cubre el adelanto (cuenta 1, abierta a la 01:00) | mainnet | Pendiente |
| 9 | Retiro del vault | mainnet | Pendiente |
| 10 | Ciclo completo del contrato con rendimiento simulado | testnet | Pendiente |

**Entregables:**

| Entregable | Contenido | Quién | Listo a las |
| --- | --- | --- | --- |
| README (inglés, con resumen en español) | Problema, URL de la demo, cómo funciona, reglas del contrato, tabla de hashes, lo hecho en el evento (diff `pre-hackmeridian..meridian`), límites conocidos, cómo correrlo y roadmap para la SCF | Ian; cada frente aporta su parte | 07:30 |
| Video de 3 minutos | 0:00 el problema · 0:30 login sin frase semilla · 0:50 depósito al vault · 1:20 pedir el adelanto (cotización a escala y monto real de la beta) · 1:50 repagar y desbloquear · 2:20 `settle` automático y hashes en stellar.expert · 2:45 cierre | Ian graba y edita | 09:00 |
| Deck de 10 láminas | Problema, solución, demo, cómo funciona, contrato, por qué Stellar (los 3 ejes de Scale), metas del intake, lo hecho en el evento, modelo y roadmap, equipo | MarxMad | 10:00 |
| Formulario de entrega | Respuestas, links al repo (`tree/meridian`), video, deck y demo | Ian | Enviado 11:00 |

## Riesgos

Los tres riesgos más probables son externos: los fondos, Pollar en mainnet y el vault de DeFindex. Por eso los tres arrancan a las 19:00 y tienen su recorte ya decidido.

| Riesgo | Probabilidad | Impacto | Respuesta |
| --- | --- | --- | --- |
| El retiro del exchange tarda o pide verificación | Media | Alto | Arrancar a las 19:15; si no, XLM a USDC en el SDEX o fondos del equipo |
| `/stellar/sep10/sign` (v3) no acepta la sesión de Pollar 0.5.3 | Media | Alto | Probarlo en testnet a las 21:30. Si falla, recorte de las 22:30 (trustline firmada con /tx/sign, sin nuestro sponsor) y preguntarle a Pollar |
| Pollar apaga la API v1 durante la demo: hay cortes programados antes del 30 de noviembre | Baja | Alto | Pedirle a Pollar las fechas de esos cortes; plan B con Stellar Wallets Kit |
| Retrasos al crear el vault propio de DeFindex (ya no depende de la API key) | Media | Alto | Vault USDC público; preguntarle hoy al equipo de DeFindex cuál usar |
| El retiro a través de Blend nunca se probó: los vaults de testnet tenían todo ocioso | Media | Medio | A la 01:00 hacer en mainnet un depósito y un retiro chicos, antes de abrir adelantos |
| El rendimiento real no cubre el adelanto antes del video | Media | Medio | `apy_bps` en un décimo del APY medido y el primer adelanto abierto a la 01:00 (recorte de las 07:00) |
| Bug del contrato con fondos reales; no está auditado | Baja | Alto | Topes de 1 y 2 USDC, lista de permitidos y pausa (repagar y liquidar siguen funcionando). Sin `upgrade`: se redespliega. Se declara en el README |
| stellar-sdk 14.6 no entiende algún XDR de Protocol 29 | Baja | Medio | Verificado: la 14.6.1 decodifica sin errores transacciones Soroban recientes de mainnet. A las 21:30 se prueban simulate y submit; si fallan, subir a la 16.4.1 (`lts-16`) |
| Conflictos de merge o cansancio del equipo | Media | Medio | Archivos separados por frente, PRs chicos y turnos de descanso |
| Comisiones infladas en testnet (un despliegue costó unos 5 000 XLM) | Alta | Bajo | Cuentas nuevas fondeadas con friendbot, como ya se hizo |
| Límite de peticiones del RPC gratuito de mainnet | Baja | Medio | gateway.fm de respaldo, también en la lista oficial |
| Alguien vacía el sponsor: SEP-10 lo pasa cualquier cuenta Stellar, cada cuenta creada bloquea 1 XLM y el resourceFee no tiene tope | Media | Alto | Frente A: sponsor solo para la lista de permitidos y transacciones del contrato, el vault y la trustline USDC, con tope al resourceFee |
| Pollar devuelve un fee-bump y nuestra ruta de envío lo rechaza | Media | Alto | Patrocinio de Pollar apagado en la app de mainnet; se comprueba en la prueba de testnet de las 21:30 |
| El keeper programado se retrasa o GitHub lo descarta, como advierte su documentación | Media | Bajo | Cada 10 minutos, y botón de settle en la app (recorte de las 05:30) |
