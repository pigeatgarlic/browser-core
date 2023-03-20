export class DataChannel
{
    private channel: RTCDataChannel | null;
    private opened : boolean = true

    constructor(chan: RTCDataChannel,
                handler: ((data: string) => (void))) {
        this.channel = chan;

        this.channel.onmessage = ((ev: MessageEvent) => {
            if (ev.data === "ping") {
                this.channel?.send("ping");
                return;
            }
            handler(ev.data);
        })

        this.channel.onerror = ((() => {
            this.opened = false
        }).bind(this))
        this.channel.onclose = ((() => {
            this.opened = false
        }).bind(this))
    }

    public sendMessage (message : string) {
        if (this.channel == null || !this.opened || this.channel.readyState != 'open')
            return;

        this.channel.send(message);
    }
}

