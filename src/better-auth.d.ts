// Type shim for better-auth's rolldown runtime virtual module
// The .d.mts files import from _virtual/rolldown_runtime.mjs which has no type declaration
declare module 'better-auth/dist/_virtual/rolldown_runtime.mjs' {
  export function __export(target: any, all: any): void
  export function __reExport(target: any, module: any): void
}

declare module 'better-auth' {
  export function betterAuth(options: any): any
  export type BetterAuthOptions = any
}

declare module 'better-auth/react' {
  export function createAuthClient(options?: any): any
}

declare module 'better-auth/adapters/drizzle' {
  export function drizzleAdapter(db: any, options?: any): any
}

declare module '@better-auth/passkey' {
  export function passkey(options?: any): any
}

declare module '@better-auth/passkey/client' {
  export function passkeyClient(options?: any): any
}
