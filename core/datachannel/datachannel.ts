export class DataChannel {
    private channel: Map<number, RTCDataChannel>;
    private handler: (data: string) => void;

    constructor(handler?: (data: string) => void) {
        this.channel = new Map<number, RTCDataChannel>();
        this.handler = handler ?? (() => {});
    }

    public async sendMessage(message: string) {
        for (const [key, value] of Array.from(this.channel.entries()).sort(
            (a, b) => b[0] - a[0]
        )) {
            if (value.readyState != 'open') continue;
            value.send(message);
            break;
        }
    }

    public SetSender(chan: RTCDataChannel) {
        const id = Date.now();

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
