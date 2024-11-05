export class DataChannel {
    private channel: Map<number, RTCDataChannel>;
    private handler: (data: string) => void;

    constructor(handler?: (data: string) => void) {
        this.channel = new Map<number, RTCDataChannel>();
        this.handler = handler ?? (() => {});
    }

    public async sendMessage(message: string) {
        let sent = false;
        let retry = 0;
        while (!sent && retry <= 5) {
            const entries = Array.from(this.channel.entries()).sort((a, b) => b[0] - a[0]);
            for (const [key, value] of entries) {
                if (sent || value.readyState != 'open') continue;
                try {
                    value.send(message);
                    sent = true;
                } catch {
                    sent = false;
                }
                if (sent) break;
            }

            retry++;
        }
    }

    public SetSender(chan: RTCDataChannel) {
        const id = chan?.id || Date.now();

        const close = () => {
            this.channel.delete(id);
        };
        const open = () => {
            this.channel.set(id, chan);
        };
        const handler = (ev: MessageEvent) => this.handler(ev.data);

        chan.onopen = open.bind(this);
        chan.onerror = close.bind(this);
        chan.onclosing = close.bind(this);
        chan.onclose = close.bind(this);
        chan.onmessage = handler.bind(this);
    }
}
