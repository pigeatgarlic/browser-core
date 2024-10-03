import { createClient } from '@supabase/supabase-js';
import PocketBase from 'pocketbase';

export enum CAUSE {
    UNKNOWN,
    OUT_OF_HARDWARE,
    MAXIMUM_DEPLOYMENT_REACHED,
    INVALID_AUTH_HEADER,
    API_CALL,
    LOCKED_RESOURCE,
    VM_BOOTING_UP,
    PERMISSION_REQUIRED,
    NEED_WAIT,
    INVALID_REQUEST,
    REMOTE_TIMEOUT,

    INVALID_REF
}

export const pb = new PocketBase(getDomainURL());
export const supabaseLocal = createClient(
    getDomainURL(),
    import.meta.env.VITE_SUPABASE_LOCAL_KEY
);
export const supabaseGlobal = createClient(
    import.meta.env.VITE_SUPABASE_GLOBAL_URL,
    import.meta.env.VITE_SUPABASE_GLOBAL_KEY
);

export function getDomainURL(): string {
    return window.location.host.includes('localhost') ||
        window.location.host.includes('tauri.localhost')
        ? 'https://play.thinkmay.net'
        : window.location.origin;
}
export function getDomain(): string {
    return window.location.host.includes('localhost') ||
        window.location.host.includes('tauri.localhost')
        ? 'play.thinkmay.net'
        : window.location.hostname;
}
