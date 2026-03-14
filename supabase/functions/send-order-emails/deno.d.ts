/** Type declarations for Deno/Supabase Edge Function imports (IDE only; runtime is Deno). */
declare module 'https://deno.land/std@0.224.0/http/server.ts' {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
    options?: { port?: number; hostname?: string; signal?: AbortSignal }
  ): void;
}

declare module 'npm:@supabase/supabase-js@2' {
  export function createClient(url: string, key: string): any;
}

declare module 'npm:nodemailer@6.10.0' {
  interface Transporter {
    sendMail(options: unknown, callback: (err: Error | null) => void): void;
    sendMail(options: unknown): Promise<unknown>;
  }
  function createTransport(options: object): Transporter;
  const out: { createTransport: typeof createTransport };
  export default out;
}

declare namespace Deno {
  export const env: {
    get(key: string): string | undefined;
  };
}
