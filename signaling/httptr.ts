import { Body, ResponseType, getClient } from '@tauri-apps/api/http';
import {
    ConnectionEvent,
    Log,
    LogConnectionEvent,
    LogLevel
} from '../utils/log';
import { SignalingMessage } from './msg';

export class SignallingClientTR {
    private ping?: any;
    private url: string;
    private onClose: () => Promise<void>

    private outcoming: SignalingMessage[] = []

    constructor(
        url: string,
        PacketHandler: (Data: SignalingMessage) => Promise<void>,
        onClose: () => Promise<void>
    ) {
        const u = new URL(url)
        u.searchParams.append("uniqueid", crypto.randomUUID())

        this.url = u.toString();
        this.onClose = onClose;
        LogConnectionEvent(ConnectionEvent.WebSocketConnecting);

        this.ping = setInterval(async () => {
            const client = await getClient()
            const copy = this.outcoming
            this.outcoming = []
            const { ok, data } = await client.post<SignalingMessage[]>(this.url, Body.json(copy), {
                responseType: ResponseType.JSON
            })
            if (!ok) {
                Log(LogLevel.Error, JSON.stringify(data))
                return
            }

            for (let index = 0; index < data.length; index++)
                await PacketHandler(data[index])

        }, 300)
    }

    public Close() {
        this.onClose()
        clearInterval(this.ping)
    }

    /**
     * send messsage to signalling server
     */
    public SignallingSend(msg: SignalingMessage) {
        this.outcoming.push(msg)
    }
}
