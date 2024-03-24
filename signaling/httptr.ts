import { Body, getClient, ResponseType } from '@tauri-apps/api/http';
import {
    ConnectionEvent,
    Log,
    LogConnectionEvent,
    LogLevel
} from '../utils/log';
import { SignalingMessage } from './msg';

export class SignalingClientTR {
    private run: boolean;
    private url: string;

    private outcoming: SignalingMessage[] = []

    constructor(
        url: string,
        PacketHandler: (Data: SignalingMessage) => Promise<void>,
    ) {
        const u = new URL(url)
        u.searchParams.append("uniqueid", crypto.randomUUID())

        this.url = u.toString();
        this.run = true
        LogConnectionEvent(ConnectionEvent.WebSocketConnecting);

        (async () => {
            const client = await getClient()
            while (this.run) {
                await new Promise(r => setTimeout(r, 300))
                const copy = this.outcoming
                this.outcoming = []

                const { ok, data } = await client.post<SignalingMessage[]>(this.url, Body.json(copy), {
                    responseType: ResponseType.JSON
                })
                if (!ok) {
                    Log(LogLevel.Error, JSON.stringify(data))
                    continue
                }

                for (let index = 0; index < data.length; index++)
                    await PacketHandler(data[index])
            }
        })()
    }

    public Close() {
        this.run = false
    }

    /**
     * send messsage to signalling server
     */
    public SignallingSend(msg: SignalingMessage) {
        this.outcoming.push(msg)
    }
}
