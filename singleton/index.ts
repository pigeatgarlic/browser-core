import { RemoteDesktopClient } from '../core';

export const SIZE = () =>
    CLIENT != null
        ? CLIENT.video.video.videoHeight * CLIENT.video.video.videoWidth
        : 1920 * 1080;
export const MAX_BITRATE = () => (15000 / (1920 * 1080)) * SIZE();
export const MIN_BITRATE = () => (1000 / (1920 * 1080)) * SIZE();
export const MAX_FRAMERATE = 120; //240
export const MIN_FRAMERATE = 40;

export let CLIENT: RemoteDesktopClient | null = null;
export const Assign = (fun: () => RemoteDesktopClient) => {
    if (CLIENT != null) CLIENT.Close();
    CLIENT = fun();
};

export let PINGER = async () => {};
export const SetPinger = (fun: () => Promise<void>) => {
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
