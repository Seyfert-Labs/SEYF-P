// `qrcode` llega como dependencia transitiva y no trae tipos; solo usamos toString.
declare module 'qrcode' {
  export function toString(
    text: string,
    options?: {
      type?: 'svg' | 'utf8' | 'terminal'
      width?: number
      margin?: number
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
      color?: { dark?: string; light?: string }
    },
  ): Promise<string>
}
