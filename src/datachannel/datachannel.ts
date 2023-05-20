export class DataChannel
{
    private channel: Map<number,RTCDataChannel>;
    private handler: (data: string) => (void)

    constructor(handler?: ((data: string) => (void))) {
        this.channel = new Map<number,RTCDataChannel>();
        this.handler = handler ?? (() => {})
    }

    public sendMessage (message : string) {
        this.channel.forEach(chan => {
            chan.send(message);
        })
    }

    public SetSender(chan: RTCDataChannel) {
        const id = Date.now()

        const close = () => {
            this.channel.delete(id)
        }
        const open = () => {
            this.channel.set(id,chan)
        }

        chan.onopen    = open .bind(this)
        chan.onerror   = close.bind(this)
        chan.onclosing = close.bind(this)
        chan.onclose   = close.bind(this)
        chan.onmessage = ((ev: MessageEvent) => {
            this.handler(ev.data);
        }).bind(this)
    }
}

