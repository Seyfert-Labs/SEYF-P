import { etherfuseFetch, etherfuseReadBody } from "./client";

export type EtherfuseAgreementCustomerInfo = {
  phone?: string;
  email?: string;
  occupation?: string;
  additionalInfo?: {
    curp?: string;
    rfc?: string;
  };
};

type AgreementEndpoint =
  | "/ramp/agreements/electronic-signature"
  | "/ramp/agreements/terms-and-conditions"
  | "/ramp/agreements/customer-agreement";

async function acceptAgreement(
  endpoint: AgreementEndpoint,
  params: { presignedUrl: string; customerInfo?: EtherfuseAgreementCustomerInfo },
): Promise<void> {
  const res = await etherfuseFetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      presignedUrl: params.presignedUrl,
      ...(params.customerInfo ? { customerInfo: params.customerInfo } : {}),
    }),
    retryable: false,
  });
  const { text } = await etherfuseReadBody(res);
  if (!res.ok) {
    throw new Error(`Etherfuse ${endpoint} falló (${res.status}): ${text.slice(0, 400)}`);
  }
}

/**
 * Acepta acuerdos en orden obligatorio.
 */
export async function acceptAllEtherfuseAgreements(params: {
  presignedUrl: string;
  customerInfo?: EtherfuseAgreementCustomerInfo;
}): Promise<void> {
  await acceptAgreement("/ramp/agreements/electronic-signature", params);
  await acceptAgreement("/ramp/agreements/terms-and-conditions", params);
  await acceptAgreement("/ramp/agreements/customer-agreement", params);
}
