// so `tsc --noEmit` can read the edge functions without the deno types package
// these run in supabase's isolate, not in node — nothing here is executed
declare var Deno: any;

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(a: string, b: string): any;
}
