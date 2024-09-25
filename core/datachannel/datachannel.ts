export class DataChannel {
    private channel: Map<number, RTCDataChannel>;
    private handler: (data: string) => void;

    constructor(handler?: (data: string) => void) {
        this.channel = new Map<number, RTCDataChannel>();
        this.handler = handler ?? (() => {});
    }

    public async sendMessage(message: string) {
        let sent = false;
        while (true) {
            this.channel.forEach((chan) => {
                if (sent || chan.readyState != 'open') return;

                chan.send(message);
                sent = true;
            });

            if (sent) return;
            else await new Promise((r) => setTimeout(r, 10));
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

        chan.onopen = open.bind(this);
        chan.onerror = close.bind(this);
        chan.onclosing = close.bind(this);
        chan.onclose = close.bind(this);
        chan.onmessage = ((ev: MessageEvent) => {
            this.handler(ev.data);
        }).bind(this);
    }
}
