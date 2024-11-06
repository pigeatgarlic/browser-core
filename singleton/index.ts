import { EventCode, RemoteDesktopClient } from '../core';

export const SIZE = () =>
    CLIENT != null
        ? CLIENT.video.video.videoHeight * CLIENT.video.video.videoWidth
        : 1920 * 1080;
export const MAX_BITRATE = () => Math.round((15000 / (1920 * 1080)) * SIZE());
export const MIN_BITRATE = () => Math.round((500 / (1920 * 1080)) * SIZE());
export const MAX_FRAMERATE = 120; //240
export const MIN_FRAMERATE = 40;

export let CLIENT: RemoteDesktopClient | null = null;
export const Assign = (client: RemoteDesktopClient) => {
    if (CLIENT != null) CLIENT.Close();
    CLIENT = client;
};

export let PINGER = async (): Promise<number> => {
    return -999;
};
export const SetPinger = (fun: () => Promise<number>) => {
    PINGER = fun;
};

export const ready = async (): Promise<boolean> => {
    const now = () => new Date().getTime() / 1000;
    const start = now();
    while (CLIENT != null && !CLIENT.ready()) {
        await new Promise((r) => setTimeout(r, 1000));
        if (now() - start > 10 * 60) return false;
    }

    return true;
};

export async function keyboard(
    ...vals: { val: string; action: 'up' | 'down' }[]
) {
    await CLIENT?.VirtualKeyboard(
        ...vals.map(({ action, val }) => ({
            code: action == 'up' ? EventCode.KeyUp : EventCode.KeyDown,
            jsKey: val
        }))
    );
}
export async function gamepadButton(index: number, type: 'up' | 'down') {
    if ('vibrate' in navigator && type == 'down')
        navigator.vibrate([40, 30, 0]);
    await CLIENT?.VirtualGamepadButton(type == 'down', index);
}

export async function gamepadAxis(
    x: number,
    y: number,
    type: 'left' | 'right'
) {
    await CLIENT?.VirtualGamepadAxis(x, y, type);
}
