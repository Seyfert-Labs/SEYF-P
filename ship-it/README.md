# Ship-It · Reto exprés «Bóveda» (BAF) — **solo testnet**

Carpeta aislada para el reto del hackathon Ship-It de BAF. **No toca nada de SEYF en mainnet.**

- Vive solo en la rama `ship-it`, que **nunca se fusiona** a `meridian` ni a `main`.
- Todo está dentro de `ship-it/`. No depende de `src/`, `soroban/` ni del `package.json` de la raíz.
- Usa solo identidades de testnet con prefijo `shipit-tn-` (el script rechaza cualquier otra).

```
ship-it/
  contract/         crate Soroban (soroban-sdk 29.0.1): bóveda que paga 5555 XLM con el código
  app/              Next.js 16 mínima: conectar wallet, escribir código, reclamar
  deploy.sh         deploy / fund / claim / balance en testnet
  deployments.json  contrato activo (lo lee la app; un commit de este archivo publica la app)
```

## El contrato

| Función | Qué hace |
|---|---|
| `__constructor(admin, token, code_hash)` | `token` = SAC de XLM nativo de testnet; `code_hash` = sha256("Ship It") |
| `fund(from, amount)` | `from.require_auth()`; deposita `amount` stroops; evento `funded`; devuelve el saldo nuevo |
| `claim(to, code)` | `to.require_auth()`; si sha256(code) coincide y hay ≥ 5555 XLM, paga 5555 XLM a `to`; evento `claimed` |
| `balance()` | saldo de la bóveda en stroops |
| `prize()`, `admin()`, `token()`, `code_hash()` | vistas |

Errores: `#1 WrongCode` (código incorrecto), `#2 InsufficientBalance` (menos de 5555 XLM), `#3 InvalidAmount`.

- **No tiene retiro para el admin.** Los XLM solo salen con el código.
- **No se cierra tras el primer reclamo.** Paga 5555 por reclamo mientras haya saldo. Si otro equipo reclama antes que los jueces, se recarga con `fund`.
- El código no está en el contrato, solo su hash. El código distingue mayúsculas y espacios internos. La app recorta los espacios de los extremos.

```bash
cd ship-it/contract
cargo test            # 8 pruebas: correcto, incorrecto, sin saldo, recarga, doble reclamo, auth, vistas
stellar contract build
```

> Requiere rustc ≥ 1.91 (soroban-sdk 29). En esta PC, el `cargo` del PATH es 1.88. Antes de compilar: `export PATH="$HOME/.cargo/bin:$PATH"` (rustup stable).

## La app

```bash
cd ship-it/app
npm install
npm run dev      # http://localhost:3000
npm run build
```

Lee el contrato de `ship-it/deployments.json` (`turbopack.root` apunta a `ship-it/`). Simula cada reclamo antes de pedir la firma y traduce los errores del contrato a español. Si la wallet no está en testnet, avisa y no deja reclamar.

## Paso a paso del jueves 26-nov (ventana 12:00–16:00 CDMX)

> El contrato **oficial** se despliega **dentro de la ventana**, no antes. Conviene hacerlo cerca de la hora de entrega para que otro equipo tenga menos tiempo de reclamar antes que los jueces.

1. **Ya preparado (no hace falta repetir):** las cuentas `shipit-tn-oficial` (deployer/admin), `shipit-tn-respaldo` y `shipit-tn-respaldo2` existen en testnet con 10 000 XLM cada una (friendbot, 26-nov 00:xx). Revisa: `./deploy.sh new-account shipit-tn-oficial` imprime la dirección sin crearla otra vez.
2. **Desplegar** (desde la raíz del repo, en la rama `ship-it`, con Git Bash):
   ```bash
   cd ship-it
   export PATH="$HOME/.cargo/bin:$PATH"
   ./deploy.sh deploy --label oficial
   ```
   Compila, sube el wasm, despliega, deposita 5555 XLM desde `shipit-tn-oficial`, escribe `deployments.json` e imprime el link de stellar.expert.
3. **Publicar la app con el contrato nuevo:**
   ```bash
   git add deployments.json
   git commit -m "feat(ship-it): contrato oficial del reto"
   git push upstream ship-it
   ```
   Vercel (proyecto aparte, rama de producción `ship-it`) vuelve a desplegar solo. Abre la app y confirma que el contract ID y el saldo de 5555 XLM coinciden.
4. **Entregar** en «Mi cuenta» de BAF: el link de la app y el del contrato (`./deploy.sh links` los vuelve a imprimir; con `SHIPIT_APP_URL=https://… ./deploy.sh links` incluye el de la app).

### Si alguien reclama antes que los jueces

```bash
./deploy.sh balance                               # 0 stroops = alguien ya reclamó
./deploy.sh fund                                  # recarga 5555 desde shipit-tn-respaldo
./deploy.sh fund --source shipit-tn-respaldo2     # segunda recarga
./deploy.sh new-account shipit-tn-respaldo3       # otra cuenta (friendbot, 10 000 XLM)
```

Cada cuenta de friendbot alcanza para **un** depósito de 5555. El script revisa el saldo antes de enviar y avisa si no alcanza. Se puede vigilar en vivo en la pestaña de eventos del contrato en stellar.expert (busca `claimed`).

### Probar un reclamo por CLI

```bash
./deploy.sh claim --source shipit-tn-juez --code "ship it"   # falla: Error(Contract, #1)
./deploy.sh claim --source shipit-tn-juez                    # paga 5555 con "Ship It"
```

## Ensayo en testnet (26-nov-2026, 00:05 CDMX)

Contrato de ensayo `CDE5VNKEGPORPF7BM4AT7SE2ZFVMNXCY66NYLXYENWPHIHGTVQ6HZ63P` (wasm `bb6dbe2c…cdf408`). **No es el oficial.**

| Paso | Resultado | Tx |
|---|---|---|
| upload wasm | ok | [08dffa24…](https://stellar.expert/explorer/testnet/tx/08dffa24d9ab5750cce210e524da8f58df83a29f053bb35c6ceea8bdb9c9120f) |
| deploy (constructor) | ok | [8591571f…](https://stellar.expert/explorer/testnet/tx/8591571fcbe6e9497fff6f71896c2bdb454c382dc30b5fcbb17947daefe417a4) |
| `fund` 5555 XLM | evento `funded` | [a38e72c3…](https://stellar.expert/explorer/testnet/tx/a38e72c38d1ec30e5c9d3e8e2cf41702f8889a9c954175cb8f581a609017394f) |
| `claim` con "ship it" | rechazado en simulación: `Error(Contract, #1)` | — |
| `claim` con "Ship It" | paga 5555; evento `claimed` | [21bd829e…](https://stellar.expert/explorer/testnet/tx/21bd829e20e896e02a252598cf4e8a37a2911fbd5942fb580e38dd484d61573a) |
| `claim` sin saldo | rechazado en simulación: `Error(Contract, #2)` | — |
| `fund` desde respaldo (recarga) | evento `funded` | [d94d3d44…](https://stellar.expert/explorer/testnet/tx/d94d3d4423b8927fc8c843cf242100a0fde619491d3b99a0350d4bb61570297a) |
| segundo `claim` | paga 5555 | [11d58d8b…](https://stellar.expert/explorer/testnet/tx/11d58d8be8eeae5b39380bb00b172187f45837128317076b4da654cdd0f6cd7c) |

Cuentas de ensayo, ya gastadas para depósitos: `shipit-tn-deployer`, `shipit-tn-backup`. `shipit-tn-juez` es la cuenta que reclama.

## Vercel (lo configura el usuario)

Proyecto **nuevo y aparte** del de SEYF:

- Repositorio `Seyfert-Labs/SEYF-P`, **rama de producción `ship-it`**.
- **Root Directory:** `ship-it/app`. Framework: Next.js.
- Deja activa «Include files outside of the Root Directory in the Build Step» (viene activa por defecto). La app importa `../deployments.json`.
- Público: **sin Deployment Protection** (Vercel Authentication apagada), para que los jueces entren sin cuenta.
- Sin variables de entorno: la app no tiene secretos.
- Opcional: dominio `shipit.seyf.app`.

> El push de `ship-it` también puede disparar un *preview* en el proyecto principal de SEYF. Es solo un preview, no producción. Puede fallar porque el `tsconfig` de la raíz también incluye `ship-it/app`. Se puede ignorar.
