import { Log, LogLevel } from '../utils/log';
import { SignalingMessage } from './msg';

export class SignalingClient {
    private ping: any;
    private url: string;
    private WebSocketConnection: WebSocket | null;
    private PacketHandler: (Data: SignalingMessage) => Promise<void>;

    constructor(
        url: string,
        PacketHandler: (Data: SignalingMessage) => Promise<void>,
        onClose: () => Promise<void>
    ) {
        this.ping = null;
        this.url = url;
        this.PacketHandler = PacketHandler;

        const internalOnClose = () => {
            this.WebSocketConnection = undefined;
            clearInterval(this.ping);
            this.PacketHandler = async () => {};
            onClose();
        };

        this.WebSocketConnection = new WebSocket(url);
        this.WebSocketConnection.onopen = this.onServerOpen.bind(this);
        this.WebSocketConnection.onerror = internalOnClose;
        this.WebSocketConnection.onclose = internalOnClose;
    }

    public Close() {
        this.WebSocketConnection?.close();
    }

    /**
     * Fired whenever the signalling websocket is opened.
     * Sends the peer id to the signalling server.
     */
    private onServerOpen() {
        this.WebSocketConnection.onmessage = this.onServerMessage.bind(this);
        this.ping = setInterval(
            () => this.WebSocketConnection?.send('ping'),
            1000
        );
    }
    /**
     * send messsage to signalling server
     */
    public SignallingSend(msg: SignalingMessage) {
        const data = JSON.stringify(msg);
        Log(LogLevel.Debug, `sending message (${this.url}) : ${data}`);
        this.WebSocketConnection?.send(data);
    }

    /**
     * handle message from signalling server during connection handshake
     * @returns
     */
    private async onServerMessage(event: any) {
        Log(
            LogLevel.Debug,
            `received signaling message (${this.url}): ${event.data}`
        );
        await this.PacketHandler(JSON.parse(event.data) as SignalingMessage);
    }
}
