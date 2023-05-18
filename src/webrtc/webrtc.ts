import { ConnectionEvent, Log, LogConnectionEvent, LogLevel } from "../utils/log";
import { Adaptive } from "../qos/qos";
import { SignalingMessage, SignalingType } from "../signaling/msg";
import { SignallingClient } from "../signaling/websocket";
import { MetricCallback } from "../qos/models";

export class WebRTC 
{
    Conn: RTCPeerConnection;
    private webrtcConfig : RTCConfiguration
    private signaling : SignallingClient
    private Ads : Adaptive

    private MetricHandler     : MetricCallback
    private TrackHandler      : (a : RTCTrackEvent) => (any)
    private channelHandler    : (a : RTCDataChannelEvent) => (any)

    constructor(signalingURL    : string,
                webrtcConfig    : RTCConfiguration,
                TrackHandler    : (a : RTCTrackEvent) => Promise<void>,
                channelHandler  : (a : RTCDataChannelEvent) => Promise<void>,
                metricHandler   : MetricCallback)
    {
        this.MetricHandler     = metricHandler;
        this.TrackHandler      = TrackHandler;
        this.channelHandler    = channelHandler; 
        this.webrtcConfig      = webrtcConfig;

        Log(LogLevel.Infor,`Started oneplay app connect to signaling server ${signalingURL}`);
        this.signaling = new SignallingClient(signalingURL,
                                 this.handleIncomingPacket.bind(this));
    }

    private async handleIncomingPacket(pkt : SignalingMessage)
    {
        switch (pkt.type) {
            case SignalingType.TYPE_SDP:
                LogConnectionEvent(ConnectionEvent.ExchangingSignalingMessage)
                this.onIncomingSDP({
                    sdp: pkt.sdp.SDPData,
                    type: pkt.sdp.Type 
                })
                break;
            case SignalingType.TYPE_ICE:
                LogConnectionEvent(ConnectionEvent.ExchangingSignalingMessage)
                this.onIncomingICE({
                    candidate: pkt.ice.Candidate,
                    sdpMid: pkt.ice.SDPMid != undefined ? pkt.ice.SDPMid : "",
                    sdpMLineIndex: pkt.ice.SDPMLineIndex != undefined ? pkt.ice.SDPMLineIndex : 0,
                })
                break;
            case SignalingType.START:
                this.SetupConnection(this.webrtcConfig)
                break;
            case SignalingType.END:
                this.signaling.Close()
                break;
            default:
                break;
        }
    }

    public SetupConnection(config : RTCConfiguration) {
        this.Conn                          = new RTCPeerConnection(config);
        this.Ads                           = new Adaptive(this.Conn,this.MetricHandler);

        this.Conn.ondatachannel            = this.channelHandler;    
        this.Conn.ontrack                  = this.TrackHandler;
        this.Conn.onicecandidate           = this.onICECandidates.bind(this);
        this.Conn.onconnectionstatechange  = this.onConnectionStateChange.bind(this);
    }

    private onConnectionStateChange(eve: Event)
    {
        Log(LogLevel.Infor,`state change to ${JSON.stringify(eve)}`)
        switch ((eve.target as RTCPeerConnection).connectionState) { // "closed" | "connected" | "connecting" | "disconnected" | "failed" | "new";
            case "new":
                LogConnectionEvent(ConnectionEvent.WebRTCConnectionChecking)
                Log(LogLevel.Infor,"webrtc connection established");
                break;
            case "connecting":
                LogConnectionEvent(ConnectionEvent.WebRTCConnectionChecking)
                Log(LogLevel.Infor,"webrtc connection established");
                break;
            case "connected":
                setTimeout(this.DoneHandshake,5000)
                LogConnectionEvent(ConnectionEvent.WebRTCConnectionDoneChecking)
                Log(LogLevel.Infor,"webrtc connection established");
                break;
            case "closed":
                LogConnectionEvent(ConnectionEvent.WebRTCConnectionClosed)
                Log(LogLevel.Error,"webrtc connection establish failed");
                break;
            case "failed":
                LogConnectionEvent(ConnectionEvent.WebRTCConnectionClosed)
                Log(LogLevel.Error,"webrtc connection establish failed");
                break;
            case "disconnected":
                LogConnectionEvent(ConnectionEvent.WebRTCConnectionClosed)
                Log(LogLevel.Error,"webrtc connection establish failed");
                break;
            default:
                break;
        }
    }

    /**
     * 
     * @param {*} ice 
     */
    public async onIncomingICE(ice : RTCIceCandidateInit) {
        try{
            const candidate = new RTCIceCandidate(ice);
            await this.Conn.addIceCandidate(candidate)
        } catch(error)  {
            Log(LogLevel.Error,error);
        };
    }
    
    
    /**
     * Handles incoming SDP from signalling server.
     * Sets the remote description on the peer connection,
     * creates an answer with a local description and sends that to the peer.
     *
     * @param {RTCSessionDescriptionInit} sdp
     */
    public async onIncomingSDP(sdp : RTCSessionDescriptionInit) 
    {
        if (sdp.type != "offer")
            return;
    
        try{
            await this.Conn.setRemoteDescription(sdp)
            const ans = await this.Conn.createAnswer()
            await this.onLocalDescription(ans);
        } catch(error) {
            Log(LogLevel.Error,error);
        };
    }
    
    
    /**
     * Handles local description creation from createAnswer.
     *
     * @param {RTCSessionDescriptionInit} local_sdp
     */
    private async onLocalDescription(desc : RTCSessionDescriptionInit) {
        await this.Conn.setLocalDescription(desc)

        if (!this.Conn.localDescription)
            return;

        const init = this.Conn.localDescription;
        this.signaling.SignallingSend({
            type: SignalingType.TYPE_SDP,
            sdp: {
                Type: init.type,
                SDPData: init.sdp
            }
        });
    }
    
    
    
    private onICECandidates(event : RTCPeerConnectionIceEvent)
    {
        if (event.candidate == null) {
            Log(LogLevel.Infor,"ICE Candidate was null, done");
            return;
        }

        const init = event.candidate.toJSON()
        this.signaling.SignallingSend({
            type: SignalingType.TYPE_ICE,
            ice: {
                SDPMid: init.sdpMid,
                Candidate: init.candidate,
                SDPMLineIndex: init.sdpMLineIndex
            }
        });
    }

    private DoneHandshake() {
        this.signaling.SignallingSend({
            type : SignalingType.END
        })
    }
}



