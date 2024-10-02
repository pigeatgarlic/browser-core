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

export async function SupabaseFuncInvoke<T>(
    funcName: string,
    body?: any,
    headers?: any
): Promise<Error | T> {
    const globalURL = import.meta.env.VITE_SUPABASE_GLOBAL_URL
    const globalKey = import.meta.env.VITE_SUPABASE_GLOBAL_KEY
    try {
        const response = await fetch(
            `${globalURL}/functions/v1/${funcName}`,
            {
                body: JSON.stringify(body ?? {}),
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${globalKey}`
                }
            }
        );
        if (response.ok === false) return new Error(await response.text());

        const data = (await response.json()) as T;
        return data;
    } catch (error: any) {
        return new Error(error.message);
    }
}
