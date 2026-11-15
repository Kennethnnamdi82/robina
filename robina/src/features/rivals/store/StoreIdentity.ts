import {createContext} from 'react';
// A lightweight projection of the existing authenticated account, not new auth.
// Hub is keyed by identity, so caches/dialogs cannot survive an account change.
export const StoreIdentity=createContext<string|null>(null);
