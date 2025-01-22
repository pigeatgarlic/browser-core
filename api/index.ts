import { Body, Client, getClient, ResponseType } from '@tauri-apps/api/http';
import { Child, Command } from '@tauri-apps/api/shell';
import { v4 as uuidv4 } from 'uuid';
import {
    CAUSE,
    getDomain,
    getDomainURL,
    GLOBAL,
    LOCAL,
    PingSession,
    POCKETBASE,
    UserEvents,
    UserSession
} from './database';

const WS_PORT = 60000;

let client: Client | null = null;
const http_available = () =>
    client != null || new URL(window.location.href).protocol == 'http:';
export function ValidateIPaddress(ipaddress: string) {
    return ipaddress != undefined
        ? /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(
              ipaddress
          )
        : false;
}
const userHttp = (addr: string): boolean =>
    http_available() && ValidateIPaddress(addr);

getClient()
    .then((x) => (client = x))
    .catch((r) =>
        console.log(
            'You are not using on webbrowser, tauri API will be limited'
        )
    );
async function internalFetch<T>(
    address: string,
    command: string,
    body?: any
): Promise<T | Error> {
    const token = POCKETBASE.authStore.token;
    const user = POCKETBASE.authStore.model?.id;
    const url = userHttp(address)
        ? `http://${address}:${WS_PORT}/${command}`
        : `https://${address}/${command}`;

    if (client != null) {
        if (command == 'info') {
            const { data, ok } = await client.get<T>(url, {
                timeout: { secs: 3, nanos: 0 },
                headers: { Authorization: token, User: user },
                responseType: ResponseType.JSON
            });

            if (!ok) return new Error('fail to request');

            return data;
        } else {
            const { data, ok } = await client.post<T>(url, Body.json(body), {
                timeout: { secs: 60 * 60 * 24, nanos: 0 },
                headers: { Authorization: token, User: user },
                responseType: ResponseType.JSON
            });

            if (!ok)
                return new Error(`${JSON.stringify(data)}. Send it to admin!`);

            return data;
        }
    } else {
        if (command == 'info') {
            const resp = await fetch(url, {
                method: 'GET',
                headers: { Authorization: token, User: user }
            });
            if (!resp.ok)
                return new Error(
                    `${JSON.stringify(await resp.text())}. Send it to admin! `
                );

            return await resp.json();
        } else {
            const resp = await fetch(url, {
                method: 'POST',
                headers: { Authorization: token, User: user },
                body: JSON.stringify(body)
            });

            if (!resp.ok) {
                const msg = JSON.stringify(await resp.text());
                return new Error(`${msg}. Send it to admin!`);
            }
            const clonedResponse = resp.clone();

            try {
                return await clonedResponse.json();
            } catch (error) {
                return new Error(await resp.text());
            }
        }
    }
}

async function GetInfo(ip: string): Promise<Computer | Error> {
    return await internalFetch<Computer>(ip, 'info');
}

type Computer = {
    Hostname?: string;
    CPU?: string;
    RAM?: string;
    BIOS?: string;
    HideVM: boolean;

    Sessions?: Session[];
    Interfaces?: {
        publicIp?: string;
        privateIp?: string;
        name: string;
    }[];
    GPUs?: {
        Inuse: boolean;
        Tained: boolean;
        Type: string;
        Id: string;
    }[];
    Volumes?: string[];
};

type ProxyChain = {
    child?: ProxyChain;
    token?: string;
    sendaddress?: string;
    recvaddress: string;
};

type RemoteReqeust = {
    requestedCodec: string;
    requestedProtocol: string;
    displayRequired: boolean;

    audio: ProxyChain;
    video: ProxyChain;
    data: ProxyChain;
};

type Session = {
    id: string;
    target?: string;

    sunshine?: {
        username: string;
        password: string;
        port: string;
    };
    app?: {
        Type: string;
        Username: string;
        Credential: string;
    };
    s3bucket?: {
        bucket: string;
        mountPath: string;
    };

    thinkmay?: RemoteReqeust;
    vm?: Computer;
};

type RemoteCredential = {
    audioUrl: string;
    videoUrl: string;
    dataUrl: string;
    logUrl: string;
};

type callback = () => Promise<number>;
export function KeepaliveVolume(
    address: string,
    volume_id: string,
    total_time_callback?: (time_in_second: number) => Promise<void>
): callback {
    if (address == undefined) throw new Error('address is not defined');

    const now = () => new Date().getTime() / 1000;
    const start = now();
    let last_ping = now();

    return async (): Promise<number> => {
        total_time_callback ? total_time_callback(now() - start) : null;
        if (
            !(
                (await internalFetch<{}>(address, '_use', volume_id)) instanceof
                Error
            )
        )
            last_ping = now();

        return now() - last_ping;
    };
}

export async function StartThinkmay(
    address: string,
    vm_request?: Computer,
    showStatus?: (status: string) => Promise<void>
): Promise<Error | Session> {
    const req = {
        id: uuidv4(),
        thinkmay: {
            displayRequired: true,
            requestedCodec: 'h264',
            requestedProtocol: 'webrtc'
        },
        vm: vm_request
    } as Session;

    type deployment_status = { status: string };
    let running = true;
    (async (_req: Session) => {
        await new Promise((r) => setTimeout(r, 3000));
        while (running) {
            const request_new = await internalFetch<deployment_status>(
                address,
                '_new',
                _req
            );
            if (!(request_new instanceof Error)) {
                showStatus(request_new.status);
                await new Promise((r) => setTimeout(r, 1000));
            }
        }
    })(req);

    let resp: Error | Session = new Error('unable to request');
    try {
        resp = await internalFetch<Session>(address, 'new', req);
    } catch (err) {
        running = false;
        return new Error(JSON.stringify(err));
    }
    running = false;
    return resp;
}

export async function LoginSteamOnVM(
    address: string,
    target: string,
    username: string,
    password: string
): Promise<Session | Error> {
    const id = uuidv4();
    const req: Session = {
        id,
        target,
        app: {
            Type: 'steam',
            Username: username,
            Credential: password
        }
    };

    const resp = await internalFetch<Session>(address, 'new', req);
    if (resp instanceof Error) throw resp;
    return req;
}
export async function LogoutSteamOnVM(
    address: string,
    req: Session
): Promise<'SUCCESS' | Error> {
    const resp = await internalFetch<Session>(address, 'closed', req);
    return resp instanceof Error ? resp : 'SUCCESS';
}

export async function MountOnVM(
    address: string,
    target: string,
    bucket_name: string
): Promise<Session | Error> {
    const id = uuidv4();
    const req: Session = {
        id,
        target,
        s3bucket: {
            bucket: bucket_name,
            mountPath: `C:/${uuidv4()}`
        }
    };

    const resp = await internalFetch<Session>(address, 'new', req);
    if (resp instanceof Error) throw resp;
    return req;
}
export async function UnmountOnVM(
    address: string,
    req: Session
): Promise<'SUCCESS' | Error> {
    if (address == undefined) return new Error('address is not defined');
    const resp = await internalFetch<Session>(address, 'closed', req);
    return resp instanceof Error ? resp : 'SUCCESS';
}

export function ParseRequest(
    address: string,
    session: Session
): RemoteCredential | Error {
    const { thinkmay } = session;
    if (thinkmay == undefined) throw new Error('thinkmay is not defined');
    return {
        logUrl: `https://${address}/log?target=${session.id}`,
        videoUrl: `wss://${address}/broadcasters/webrtc?cred=${
            session.vm.Sessions.at(0).thinkmay.video.token
        }`,
        audioUrl: `wss://${address}/broadcasters/webrtc?cred=${
            session.vm.Sessions.at(0).thinkmay.audio.token
        }`,
        dataUrl: `wss://${address}/broadcasters/webrtc?cred=${
            session.vm.Sessions.at(0).thinkmay.data.token
        }`
    };
}

type MoonlightStreamConfig = {
    bitrate?: number;
    width?: number;
    height?: number;
};
export async function StartMoonlight(
    address: string,
    options?: MoonlightStreamConfig,
    callback?: (type: 'stdout' | 'stderr', log: string) => void
): Promise<Child> {
    const PORT = getRandomInt(60000, 65530);
    const sunshine = {
        username: getRandomInt(0, 9999).toString(),
        password: getRandomInt(0, 9999).toString(),
        port: PORT.toString()
    };

    const id = uuidv4();
    const req = {
        id,
        sunshine
    };

    const resp = await internalFetch<Session>(address, 'new', req);
    if (resp instanceof Error) throw resp;

    const { username, password } = sunshine;
    const cmds = [
        '--address',
        address,
        '--port',
        `${PORT}`,
        '--width',
        `${options?.width ?? 1920}`,
        '--height',
        `${options?.height ?? 1080}`,
        '--bitrate',
        `${options?.bitrate ?? 6000}`,
        '--username',
        username,
        '--password',
        password
    ];

    const command = new Command('Moonlight', cmds);
    command.stderr.addListener('data', (data) =>
        callback != undefined ? callback('stderr', data) : console.log(data)
    );
    command.stdout.addListener('data', (data) =>
        callback != undefined ? callback('stdout', data) : console.log(data)
    );

    return await command.spawn();
}

export async function CloseSession(
    address: string,
    req: Session
): Promise<Error | 'SUCCESS'> {
    const resp = await internalFetch(address, 'closed', req);
    return resp instanceof Error ? resp : 'SUCCESS';
}

function getRandomInt(min: number, max: number) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
}
async function JoinZeroTier(network_id: string): Promise<string> {
    const command = await new Command('ZeroTier', [
        'leave',
        network_id
    ]).execute();
    return command.stdout + '\n' + command.stderr;
}
async function LeaveZeroTier(network_id: string): Promise<string> {
    const command = await new Command('ZeroTier', [
        'join',
        network_id
    ]).execute();
    return command.stdout + '\n' + command.stderr;
}
async function DiscordRichPresence(app_id: string): Promise<string> {
    const command = await new Command('Daemon', ['discord', app_id]).execute();
    return command.stdout + '\n' + command.stderr;
}

export {
    CAUSE,
    getDomain,
    getDomainURL,
    GetInfo,
    GLOBAL,
    LOCAL,
    PingSession,
    POCKETBASE,
    UserEvents,
    UserSession
};
export type { Computer, RemoteCredential, Session };
