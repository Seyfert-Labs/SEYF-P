/**
 * Post-onramp auto-deploy — stub en Reyf hasta integrar ciclo de inversión on-chain.
 * El webhook de Etherfuse sigue respondiendo 200; CETES se acreditan en la wallet Stellar vía la rampa.
 */
export type EnqueueAutoDeployForDepositInput = {
  depositId: string;
  amountMxn: number | null;
  userId?: string | null;
};

export async function enqueueAutoDeployForDeposit(
  input: EnqueueAutoDeployForDepositInput,
): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.info("[reyf][etherfuse] onramp confirmed (auto-deploy stub)", input);
  }
}
