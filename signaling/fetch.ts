import {
    ConnectionEvent,
    Log,
    LogConnectionEvent,
    LogLevel
} from '../utils/log';
import { SignalingMessage } from './msg';

export class SignalingClientFetch {
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
            while (this.run) {
                await new Promise(r => setTimeout(r, 1000))
                const copy = this.outcoming
                this.outcoming = []

                const resp = await fetch(this.url,{
                    method: 'POST',
                    body: JSON.stringify(copy)
                })
                const {ok} = resp

                if (!ok) {
                    Log(LogLevel.Error, await resp.text())
                    continue
                }

                const data = await resp.json() as SignalingMessage[]
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
