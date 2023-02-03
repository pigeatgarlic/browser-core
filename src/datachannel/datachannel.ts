export class DataChannel
{
    private channel: RTCDataChannel | null;

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

        this.channel.onerror = (() => {

        })

        this.channel.onclose = (() => {

        })
    }

    public sendMessage (message : string) {
        if (this.channel == null) {
            return;
        }

        this.channel.send(message);
    }
}

