import { v4 as uuidv4 } from 'uuid';
import { Log, LogLevel } from '../utils/log';
import { SignalingMessage } from './msg';

export class SignalingClientFetch {
    private run: boolean;
    private url: string;

    private outcoming: SignalingMessage[] = [];
    private last_msg: SignalingMessage[] = [];

    constructor(
        url: string,
        PacketHandler: (Data: SignalingMessage) => Promise<void>
    ) {
        const u = new URL(url);
        u.searchParams.append('uniqueid', uuidv4());

        this.url = u.toString();
        this.run = true;

        (async () => {
            while (
                this.run ||
                this.outcoming.length > 0 ||
                this.last_msg.length > 0
            ) {
                await new Promise((r) => setTimeout(r, 1000));
                const copy = this.outcoming;
                this.outcoming = [];

                try {
                    const resp = await fetch(this.url, {
                        method: 'POST',
                        body: JSON.stringify(copy)
                    });
                    const { ok } = resp;

                    if (!ok) {
                        Log(LogLevel.Error, await resp.text());
                        continue;
                    }

                    const data = (await resp.json()) as SignalingMessage[];
                    this.last_msg = data;
                    for (let index = 0; index < data.length; index++)
                        await PacketHandler(data[index]);
                } catch {}
            }
        })();
    }

    public Close() {
        this.run = false;
    }

    /**
     * send messsage to signalling server
     */
    public SignallingSend(msg: SignalingMessage) {
        this.outcoming.push(msg);
    }
}
