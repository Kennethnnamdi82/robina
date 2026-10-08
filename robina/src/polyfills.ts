import { Buffer } from 'buffer';
// This module evaluates before application and SDK modules.
const browserGlobals = globalThis as typeof globalThis & { Buffer: typeof Buffer; global: typeof globalThis };
browserGlobals.Buffer = Buffer;
browserGlobals.global = globalThis;
