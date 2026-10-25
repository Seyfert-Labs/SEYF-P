# SEYF — contratos Soroban

## `seyf-lock`

Capital bloqueado en una bóveda **DeFindex** por un plazo fijo, con el **rendimiento futuro
adelantado** hoy. Reglas, diagramas y evidencia: `docs/hackmeridian-plan.md` §SeyfLock.

| Función | Quién | Qué hace |
|---|---|---|
| `quote(amount, term_secs)` | lectura | `amount × apy_bps × plazo/año × advance_bps`, tope 90% del capital |
| `lock(user, amount, term_secs, min_shares)` | usuario | deposita en DeFindex a nombre del contrato y paga el adelanto desde el pool |
| `position(user)` | lectura | valor actual, rendimiento generado, `owed_now` para salir hoy |
| `unlock(user, min_out)` | usuario | antes de vencer paga `adelanto − rendimiento`; recibe su capital |
| `settle(user, min_out)` | cualquiera (cron) | después de vencer: capital al usuario, rendimiento al pool |
| `bump(user)` | cualquiera (cron) | extiende el TTL del bloqueo |
| `fund_pool` / `withdraw_pool` | cualquiera / admin | pool de adelantos (no puede tocar capital bloqueado) |
| `set_params` / `set_paused` / `set_admin` / `upgrade` | admin | parámetros para bloqueos nuevos; la pausa nunca bloquea salidas |

### Desarrollo

```bash
cd soroban
cargo test                    # 16 tests (bóveda simulada con la misma forma de auth que DeFindex)
stellar contract build        # → target/wasm32v1-none/release/seyf_lock.wasm (Stellar CLI ≥ 28.1)
```

`soroban-sdk` 29.0.1 ↔ Protocol 29 (mainnet, verificado con stellar-raven el 2026-10-25).

### Testnet

| Contrato | Dirección |
|---|---|
| SeyfLock (XLM) | `CC5CLKMAJU7KHMUUJWXM7RJ6E7OCN6LPI66GPL26LJMH7YDTAU6XQ6BZ` |
| Bóveda DeFindex XLM | `CCLV4H7WTLJQ7ATLHBBQV2WW3OINF3FOY5XZ7VPHZO7NH3D2ZS4GFSF6` |
| SAC XLM nativo | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

Parámetros de testnet: APY 8%, adelanto 90%, plazo 60 s – 2 años, tope 10,000 XLM por bloqueo.

```bash
bash soroban/scripts/testnet-e2e.sh early   # bloqueo 1 año + salida anticipada
bash soroban/scripts/testnet-e2e.sh short   # bloqueo de 60 s
bash soroban/scripts/testnet-e2e.sh settle  # liquidar (firma un tercero)
```

### Antes de mainnet

- Sin auditoría: desplegar con `cap_per_lock` / `cap_total` bajos; auditoría vía SCF Audit Bank.
- `apy_bps` lo fija el admin: actualizarlo con el APY real de la bóveda antes de abrir bloqueos.
- La bóveda debe ser de **un solo activo** y ese activo debe ser el `asset` del constructor.
