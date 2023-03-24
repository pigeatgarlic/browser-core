import { UserRequest, UserResponse } from "../models/signaling.model";
import { ConnectionEvent, Log, LogConnectionEvent, LogLevel } from "../utils/log";
import {SignalingMessage} from "./msg"




export class SignallingClient
{
    private WebSocketConnection: WebSocket;
    PacketHandler : (Data : SignalingMessage) => Promise<void>

    constructor (url : string,
                 token : string,
                 PacketHandler : ((Data : SignalingMessage) => Promise<void>))
    {
        this.PacketHandler = PacketHandler;
        LogConnectionEvent(ConnectionEvent.WebSocketConnecting)
        this.WebSocketConnection = new WebSocket(`${url}?token=${token}`);
        this.WebSocketConnection.onopen     = ((eve : Event) => { 
            this.onServerOpen(eve)
        });
    }

    public Close () {
        this.WebSocketConnection.close()
    }

    /**
     * Fired whenever the signalling websocket is opened.
     * Sends the peer id to the signalling server.
     */
    private onServerOpen(event : Event)
    {
        LogConnectionEvent(ConnectionEvent.WebSocketConnected)
        this.WebSocketConnection.onerror    = ((eve : Event) => { 
            Log(LogLevel.Error,`websocket connection error : ${eve.type}`)
            this.onServerError()
        });
        this.WebSocketConnection.onmessage  = (async (eve : MessageEvent) => { 
            await this.onServerMessage(eve)
        });

        this.WebSocketConnection.onclose    = ((eve : Event) => { 
            Log(LogLevel.Error,`websocket connection closed : ${eve.type}`)
            this.onServerError()
        });
    }
    /**
     * send messsage to signalling server
     * @param {string} request_type 
     * @param {any} content 
     */
    public SignallingSend(msg : SignalingMessage)
    {
        Log(LogLevel.Debug,`sending message : ${msg}`);
        this.WebSocketConnection.send(JSON.stringify(msg));
    }

    /**
     * Fired whenever the signalling websocket emits and error.
     * Reconnects after 3 seconds.
     */
    private onServerError() 
    {
        Log(LogLevel.Warning,"websocket connection disconnected");
        // LogConnectionEvent(ConnectionEvent.WebSocketDisconnected)
    }


    /**
     * handle message from signalling server during connection handshake
     * @param {Event} event 
     * @returns 
     */
    private async onServerMessage(event : any) 
    {
        var msg = JSON.parse(event.data);
        Log(LogLevel.Debug,`received signaling message: ${msg}`);
        await this.PacketHandler(msg as SignalingMessage);
    }
}



