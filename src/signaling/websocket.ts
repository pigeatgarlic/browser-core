import { UserRequest, UserResponse } from "../models/signaling.model";
import { ConnectionEvent, Log, LogConnectionEvent, LogLevel } from "../utils/log";
import {SignalingMessage} from "./msg"




export class SignallingClient
{
    private url                    : string
    private WebSocketConnection    : WebSocket | null;
    private PacketHandler          : (Data : SignalingMessage) => Promise<void>

    constructor (url : string,
                 PacketHandler : ((Data : SignalingMessage) => Promise<void>))
    {
        this.url =url
        this.PacketHandler = PacketHandler;

        LogConnectionEvent(ConnectionEvent.WebSocketConnecting)
        this.WebSocketConnection            = new WebSocket(url);
        this.WebSocketConnection.onopen     = this.onServerOpen.bind(this)
    }

    public Close () {
        this.WebSocketConnection?.close()
    }

    /**
     * Fired whenever the signalling websocket is opened.
     * Sends the peer id to the signalling server.
     */
    private onServerOpen()
    {
        LogConnectionEvent(ConnectionEvent.WebSocketConnected)
        this.WebSocketConnection.onmessage  = this.onServerMessage.bind(this)

        this.WebSocketConnection.onerror    = this.onServerError.bind(this)
        this.WebSocketConnection.onclose    = this.onServerError.bind(this)
    }
    /**
     * send messsage to signalling server
     */
    public SignallingSend(msg : SignalingMessage)
    {
        const data = JSON.stringify(msg)
        Log(LogLevel.Debug,`sending message (${this.url}) : ${data}`);
        this.WebSocketConnection.send(data);
    }

    /**
     * Fired whenever the signalling websocket emits and error.
     * Reconnects after 3 seconds.
     */
    private onServerError() 
    {
        Log(LogLevel.Warning,"websocket connection disconnected");
        this.WebSocketConnection = null
    }


    /**
     * handle message from signalling server during connection handshake
     * @returns 
     */
    private async onServerMessage(event : any) 
    {
        Log(LogLevel.Debug,`received signaling message (${this.url}): ${event.data}`);
        await this.PacketHandler(JSON.parse(event.data) as SignalingMessage);
    }
}



