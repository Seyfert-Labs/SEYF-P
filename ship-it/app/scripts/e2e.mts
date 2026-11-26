// Prueba el mismo código de la app (src/lib/vault.ts) contra testnet, sin wallet de navegador.
// La firma la hace stellar CLI con una identidad shipit-tn-* (la llave no sale del keystore).
//
//   cd ship-it/app
//   npx tsx scripts/e2e.mts balance
//   npx tsx scripts/e2e.mts prepare <G…> "<código>"     → XDR simulado y ensamblado, o error en español
//   npx tsx scripts/e2e.mts submit <xdr firmado>        → hash
//
// Reclamo completo:
//   X=$(npx tsx scripts/e2e.mts prepare $(stellar keys address shipit-tn-juez) "Ship It")
//   S=$(echo "$X" | stellar tx sign --sign-with-key shipit-tn-juez --network testnet)
//   npx tsx scripts/e2e.mts submit "$S"
import { prepareClaim, readBalance, submit } from "../src/lib/vault.ts";

const [cmd, a, b] = process.argv.slice(2);
try {
  if (cmd === "balance") console.log(String(await readBalance()));
  else if (cmd === "prepare") console.log(await prepareClaim(a, b.trim()));
  else if (cmd === "submit") console.log(await submit(a));
  else {
    console.error("uso: e2e.mts balance | prepare <G…> <código> | submit <xdr>");
    process.exit(1);
  }
} catch (e) {
  console.log("ERR: " + (e as Error).message);
  process.exit(2);
}
