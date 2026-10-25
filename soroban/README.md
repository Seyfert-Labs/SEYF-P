# SEYF — contratos Soroban

## `seyf_advance`

Adelanto del rendimiento de un vault USDC de **DeFindex**. El usuario bloquea en el contrato
acciones del vault que ya tiene (siguen rindiendo) y recibe hoy, en USDC, el rendimiento de un
plazo. El adelanto sale de la **tesorería del contrato** (su saldo de USDC), nunca del capital del
usuario. Plan: `docs/hackmeridian-12h.md` §Contrato tesorería del adelanto.

- **Adelanto:** A = floor(V × `apy_bps` × días / (10 000 × 365)), con tope de LTV
  (`max_advance_bps`), por usuario (`per_user_cap`) y global (`global_cap`).
- **Dos salidas:** `repay` devuelve A a la tesorería y desbloquea todas las acciones. Si no,
  `settle` (cualquiera, keeper incluido) procede solo cuando V_now ≥ V_open + A: retira del
  vault techo(A × acciones / V_now) acciones (≥ A en USDC) hacia la tesorería y devuelve el resto
  al usuario.
- **La pausa solo frena `open_advance`.** `repay`, `settle` y la tesorería siguen funcionando.

| Función | Quién | Qué hace |
|---|---|---|
| `quote(shares, term_days)` | lectura | `(V, A)` con todos los topes; falla igual que `open_advance` |
| `open_advance(user, shares, term_days, min_advance)` | usuario | bloquea las acciones y paga A desde la tesorería |
| `repay(user)` | usuario | devuelve A y recupera todas sus acciones (también en pausa) |
| `settle(user)` | cualquiera | cierra la posición cuando el rendimiento cubre A (también en pausa) |
| `position(user)` / `unlock_status(user)` | lectura | posición; `(V_now, V_open + A)` |
| `treasury()` / `outstanding()` | lectura | saldo libre de USDC; adelantos vivos |
| `fund_treasury(from, amount)` | cualquiera | aporta USDC a la tesorería |
| `withdraw_treasury(to, amount)` | admin | retira del saldo libre; las acciones bloqueadas no salen por aquí |
| `set_params` / `pause` / `unpause` / `set_allowed` | admin | parámetros, pausa y lista de permitidos |
| `propose_admin` / `accept_admin` | admin / admin nuevo | cambio de admin en dos pasos |

Sin `upgrade`: un cambio se publica con un despliegue nuevo.

### Desarrollo

```bash
cd soroban
cargo test                    # 17 pruebas (vault simulado con la forma de DeFindex)
stellar contract build        # → target/wasm32v1-none/release/seyf_advance.wasm (Stellar CLI 28.1)
```

`soroban-sdk` 29.0.1 ↔ Protocol 29 (mainnet, verificado con stellar-raven el 2026-10-25).
CI: `.github/workflows/contracts.yml` corre las pruebas, compila el wasm y lo sube como artefacto.

### Despliegues

Testnet y ciclo completo con hashes: [`DEPLOYMENTS.md`](DEPLOYMENTS.md).

### Antes de mainnet

- Sin auditoría: topes bajos (beta: 1 USDC por usuario, 2 USDC en total), lista de permitidos
  encendida y pausa disponible.
- `apy_bps` lo fija el admin con el APY medido del vault.
- El vault debe ser de **un solo activo** y ese activo debe ser el `asset` del constructor.

`seyf-lock`, el contrato anterior (desbloqueo por fecha), queda archivado en la rama
`archive/seyf-lock`.
