// Validación de CLABE mexicana (18 dígitos + dígito verificador módulo 10
// con pesos 3-7-1). Dynerox rechaza con `Invalid CLABE` cualquier cuenta mal
// formada, así que validamos antes de gastar el round-trip.
//
// Existe la misma lógica en `services/junoService.ts` (static validateCLABE),
// pero esa es una clase orientada al navegador y esta rama mantiene Dynerox
// aislado de Juno (ver README). Se prefiere esta copia mínima y pura.

const WEIGHTS = [3, 7, 1] as const;

/** `true` si la CLABE tiene 18 dígitos y su dígito verificador cuadra. */
export function isValidClabe(clabe: string): boolean {
  if (!/^\d{18}$/.test(clabe)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += (Number(clabe[i]) * WEIGHTS[i % 3]) % 10;
  }
  return (10 - (sum % 10)) % 10 === Number(clabe[17]);
}

/** Quita espacios y guiones para aceptar CLABEs pegadas con formato. */
export function normalizeClabe(input: string): string {
  return input.replace(/[\s-]/g, '');
}
