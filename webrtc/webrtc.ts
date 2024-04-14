import { SignalingClientFetch } from '../signaling/fetch';
import { SignalingClientTR } from '../signaling/httptr';
import { msgString, SignalingMessage, SignalingType } from '../signaling/msg';
import { SignalingClient } from '../signaling/websocket';
import {
    ConnectionEvent,
    Log,
    LogConnectionEvent,
    LogLevel
} from '../utils/log';

export class WebRTC {
    private id: string;
    public connected: boolean;
    private Conn: RTCPeerConnection;
    private webrtcConfig: RTCConfiguration;
    private signaling: SignalingClientTR | SignalingClient | SignalingClientFetch;

    private rtrackHandler: (a: RTCTrackEvent) => any;
    private ltrackHandler: () => Promise<MediaStream | null>;
    private channelHandler: (a: RTCDataChannelEvent) => any;
    private closeHandler: () => void;

    constructor(
        id: string,
        signalingURL: string,
        webrtcConfig: RTCConfiguration,
        localTrack: () => Promise<MediaStream | null>,
        TrackHandler: (a: RTCTrackEvent) => Promise<void>,
        channelHandler: (a: RTCDataChannelEvent) => Promise<void>,
        CloseHandler: () => void,
    ) {
        this.connected = false;
        this.closeHandler = CloseHandler;
        this.rtrackHandler = TrackHandler;
        this.ltrackHandler = localTrack;
        this.channelHandler = channelHandler;
        this.webrtcConfig = webrtcConfig;
        this.id = id;

        Log(
            LogLevel.Infor,
            `Started connect to signaling server ${id}`
        );

        const protocol = signalingURL.split('://').at(0)
        if (protocol == 'ws' || protocol == 'wss')
            this.signaling = new SignalingClient(
                signalingURL,
                this.handleIncomingPacket.bind(this),
                this.SignalingOnClose.bind(this)
            );
        else if (protocol == 'https')
            this.signaling = new SignalingClientFetch(
                signalingURL,
                this.handleIncomingPacket.bind(this),
            );
        else if (protocol == 'http')
            this.signaling = new SignalingClientFetch(
                signalingURL,
                this.handleIncomingPacket.bind(this),
            );
    }

    private async SignalingOnClose() {
        if (this.connected) return;

        this.Close();
    }

    public Close() {
        Log(
            LogLevel.Infor,
            `Closed webrtc connection ${this.id}`
        );
        this.connected = false;
        this.Conn?.close();
        this.signaling?.Close();
        const close = this.closeHandler;
        this.rtrackHandler = () => { };
        this.channelHandler = () => { };
        this.closeHandler = () => { };
        close()
        LogConnectionEvent(
            ConnectionEvent.WebRTCConnectionClosed,
            'close',
            this.id as string
        );
    }

    private async handleIncomingPacket(pkt: SignalingMessage) {
        Log(LogLevel.Debug,this.id +' signaling out : ' + msgString(pkt))
        switch (pkt.type) {
            case SignalingType.TYPE_SDP:
                LogConnectionEvent(ConnectionEvent.ExchangingSignalingMessage);
                this.onIncomingSDP({
                    sdp: pkt.sdp.SDPData,
                    type: pkt.sdp.Type
                });
                break;
            case SignalingType.TYPE_ICE:
                LogConnectionEvent(ConnectionEvent.ExchangingSignalingMessage);
                this.onIncomingICE({
                    candidate: pkt.ice.Candidate,
                    sdpMid: pkt.ice.SDPMid != undefined ? pkt.ice.SDPMid : '',
                    sdpMLineIndex:
                        pkt.ice.SDPMLineIndex != undefined
                            ? pkt.ice.SDPMLineIndex
                            : 0
                });
                break;
            case SignalingType.START:
                this.SetupConnection(this.webrtcConfig);
                break;
            case SignalingType.END:
                this.signaling.Close();
                break;
            default:
                break;
        }
    }

    public SetupConnection(config: RTCConfiguration) {
        this.Conn = new RTCPeerConnection(config);
        this.Conn.ondatachannel = this.channelHandler;
        this.Conn.ontrack = this.rtrackHandler;
        this.Conn.onicecandidate = this.onICECandidates.bind(this);
        this.Conn.onconnectionstatechange =
            this.onConnectionStateChange.bind(this);
    }



    private async AddLocalTrack(
        stream: MediaStream,
    ) {
        const tracks = stream.getTracks();
        console.log('Adding Local Stream to peer connection');

        tracks.forEach((track) => this.Conn.addTrack(track, stream));

        const transceiver = this.Conn.getTransceivers().find(
            (t) => t?.sender?.track === stream.getAudioTracks()[0]
        );

        const codec = {
            clockRate: 48000,
            channels: 2,
            mimeType: 'audio/opus'
        };

        const { codecs } = RTCRtpSender.getCapabilities('audio');
        const selected = codecs.find((x) => x.mimeType == codec.mimeType);

        transceiver.setCodecPreferences([selected]);
    }

    private onConnectionStateChange(eve: Event) {
        const successHandler = async () => {
            await new Promise((r) => setTimeout(r, 5000));
            this.connected = true;
            this.DoneHandshake();
            LogConnectionEvent(
                ConnectionEvent.WebRTCConnectionDoneChecking,
                'done',
                this.id as string
            );
            Log(LogLevel.Infor, this.id +' webrtc connection established');
        };

        const connectingHandler = () => {
            LogConnectionEvent(
                ConnectionEvent.WebRTCConnectionChecking,
                'connecting',
                this.id as string
            );
            Log(LogLevel.Infor, this.id +' webrtc connection checking');
        };

        switch (
        (eve.target as RTCPeerConnection)
            .connectionState as RTCPeerConnectionState // "closed" | "connected" | "connecting" | "disconnected" | "failed" | "new";
        ) {
            case 'new':
            case 'connecting':
                connectingHandler();
                break;
            case 'connected':
                successHandler();
                break;
            case 'closed':
            case 'failed':
            case 'disconnected':
                this.Close();
                break;
            default:
                break;
        }
    }

    public async onIncomingICE(ice: RTCIceCandidateInit) {
        try {
            const candidate = new RTCIceCandidate(ice);
            await this.Conn.addIceCandidate(candidate);
        } catch (error) {
            Log(LogLevel.Error, this.id + ' ' + error);
        }
    }

    public async onIncomingSDP(sdp: RTCSessionDescriptionInit) {
        if (sdp.type != 'offer') return;

        try {
            await this.Conn.setRemoteDescription(sdp);
            const track = await this.ltrackHandler();
            if (track != null) 
                await this.AddLocalTrack(track)
                
            const ans = await this.Conn.createAnswer();
            await this.onLocalDescription(ans);
        } catch (error) {
            Log(LogLevel.Error, this.id + ' ' + error);
        }
    }

    private async onLocalDescription(desc: RTCSessionDescriptionInit) {
        await this.Conn.setLocalDescription(desc);

        if (!this.Conn.localDescription) return;

        const init = this.Conn.localDescription;
        const out : SignalingMessage = {
            type: SignalingType.TYPE_SDP,
            sdp: {
                Type: init.type,
                SDPData: init.sdp
            }
        }
        Log(LogLevel.Debug,this.id + ' signaling out : ' + msgString(out))
        this.signaling.SignallingSend(out);
    }

    private onICECandidates(event: RTCPeerConnectionIceEvent) {
        if (event.candidate == null) {
            Log(LogLevel.Infor, this.id +' ICE Candidate was null, done');
            return;
        }

        const init = event.candidate.toJSON();
        const out : SignalingMessage = {
            type: SignalingType.TYPE_ICE,
            ice: {
                SDPMid: init.sdpMid,
                Candidate: init.candidate,
                SDPMLineIndex: init.sdpMLineIndex
            }
        }
        Log(LogLevel.Debug,this.id + ' signaling out : ' + msgString(out))
        this.signaling.SignallingSend(out);
    }

    private async DoneHandshake() {
        const out : SignalingMessage = {
            type: SignalingType.END
        }
        Log(LogLevel.Debug,this.id + ' signaling out : ' + msgString(out))
        this.signaling.SignallingSend(out);
        await new Promise(r => setTimeout(r,1000))
        this.signaling.Close()
    }
}
