import { ConnectionEvent, Log, LogConnectionEvent, LogLevel } from "./utils/log";
import { Adaptive } from "./qos/qos";
import { SignalingMessage, SignalingType } from "./signaling/msg";

export class WebRTC 
{
    State: string;
    Conn: RTCPeerConnection;
    Ads : Adaptive

    private SignalingSendFunc : (msg : SignalingMessage) => Promise<void>
    private MetricHandler     : (Target : string) => (void)
    private TrackHandler      : (a : RTCTrackEvent) => (any)
    private channelHandler    : (a : RTCDataChannelEvent) => (any)

    constructor(sendFunc        : (msg : SignalingMessage) => Promise<void>,
                TrackHandler    : (a : RTCTrackEvent) => (any),
                channelHandler  : (a : RTCDataChannelEvent) => (any),
                metricHandler   : (a : string) => (void))
    {
        this.State = "Not setted up"
        this.SignalingSendFunc = sendFunc;
        this.MetricHandler     = metricHandler;
        this.TrackHandler      = TrackHandler;
        this.channelHandler    = channelHandler; 
    }


    public SetupConnection(config : RTCConfiguration) {
        this.Conn = new RTCPeerConnection(config);
        this.Ads = new Adaptive(this.Conn,this.MetricHandler);
        this.Conn.ondatachannel =               this.channelHandler.bind(this);    
        this.Conn.ontrack =                     this.TrackHandler.bind(this);
        this.Conn.onicecandidate =              this.onICECandidates.bind(this);
        this.Conn.onconnectionstatechange =     this.onConnectionStateChange.bind(this);
        this.State = "Not connected"
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
        var candidate = new RTCIceCandidate(ice);
        try{
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
    
        this.State = "Got SDP offer";        
    
        try{
            var Conn = this.Conn;
            await Conn.setRemoteDescription(sdp)
            var ans = await Conn.createAnswer()
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

        var init = this.Conn.localDescription;
        this.SignalingSendFunc({
            type: SignalingType.TYPE_SDP,
            Sdp: {
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

        var init = event.candidate.toJSON()
        this.SignalingSendFunc({
            type: SignalingType.TYPE_ICE,
            Ice: {
                SDPMid: init.sdpMid,
                Candidate: init.candidate,
                SDPMLineIndex: init.sdpMLineIndex
            }
        });
    }
}



