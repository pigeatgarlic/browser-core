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