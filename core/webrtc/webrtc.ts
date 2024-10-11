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
import { getBrowser } from '../utils/platform';

export type RTCMetric =
    | {
          codecId: string;
          mediaType: string;
          id: string;
          remoteId: string;
          kind: 'video';
          mid: string;
          trackIdentifier: string;
          transportId: string;
          type: string;

          bytesReceived: number;
          firCount: number;
          frameHeight: number;
          frameWidth: number;
          framesAssembledFromMultiplePackets: number;
          framesDecoded: number;
          framesDropped: number;
          framesPerSecond: number;
          framesReceived: number;
          freezeCount: number;
          headerBytesReceived: number;
          jitter: number;
          jitterBufferDelay: number;
          jitterBufferEmittedCount: number;
          jitterBufferMinimumDelay: number;
          jitterBufferTargetDelay: number;
          keyFramesDecoded: number;
          lastPacketReceivedTimestamp: number;
          nackCount: number;
          packetsLost: number;
          packetsReceived: number;
          pauseCount: number;
          pliCount: number;
          ssrc: number;
          timestamp: number;
          totalAssemblyTime: number;
          totalDecodeTime: number;
          totalFreezesDuration: number;
          totalInterFrameDelay: number;
          totalPausesDuration: number;
          totalProcessingDelay: number;
          totalSquaredInterFrameDelay: number;
      }
    | {
          kind: 'audio';

          totalSamplesReceived: number;
      };

export class WebRTC {
    private id: string;
    public connected: boolean;
    public closed: boolean;
    private Conn: RTCPeerConnection;
    private webrtcConfig: RTCConfiguration;
    private signaling:
        | SignalingClientTR
        | SignalingClient
        | SignalingClientFetch;
    private watch_loop: any;

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
        MetricsHandler: (val: RTCMetric) => void,
        CloseHandler: () => void
    ) {
        this.closed = false;
        this.connected = false;
        this.closeHandler = CloseHandler;
        this.rtrackHandler = TrackHandler;
        this.ltrackHandler = localTrack;
        this.channelHandler = channelHandler;
        this.webrtcConfig = webrtcConfig;
        this.id = id;

        Log(LogLevel.Infor, `Started connect to signaling server ${id}`);

        const using_tauri = (window as any).__TAURI_IPC__ != undefined;
        const protocol = signalingURL.split('://').at(0);
        if (protocol == 'ws' || protocol == 'wss')
            this.signaling = new SignalingClient(
                signalingURL,
                this.handleIncomingPacket.bind(this),
                this.SignalingOnClose.bind(this)
            );
        else if (using_tauri)
            this.signaling = new SignalingClientTR(
                signalingURL,
                this.handleIncomingPacket.bind(this)
            );
        else
            this.signaling = new SignalingClientFetch(
                signalingURL,
                this.handleIncomingPacket.bind(this)
            );

        this.watch_loop = setInterval(async () => {
            if (this.Conn == undefined) return;

            const stats = await this.Conn.getStats();
            stats.forEach((val) =>
                val.type == 'inbound-rtp' ? MetricsHandler(val) : () => {}
            );
        }, 2000);
    }

    private async SignalingOnClose() {
        if (this.connected) return;

        this.Close();
    }

    public Close() {
        Log(LogLevel.Infor, `Closed webrtc connection ${this.id}`);
        this.connected = false;
        this.closed = true;
        this.Conn?.close();
        this.DoneHandshake();
        this.rtrackHandler = () => {};
        this.channelHandler = () => {};
        clearInterval(this.watch_loop);
        const close = this.closeHandler;
        this.closeHandler = () => {};
        close();
    }

    private async handleIncomingPacket(pkt: SignalingMessage) {
        Log(LogLevel.Debug, this.id + ' signaling out : ' + msgString(pkt));
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
        this.Conn = new RTCPeerConnection({
            ...config,
            encodedInsertableStreams: getBrowser() != 'Safari'
        } as any);
        this.Conn.ondatachannel = this.channelHandler;
        this.Conn.ontrack = this.rtrackHandler;
        this.Conn.onicecandidate = this.onICECandidates.bind(this);
        this.Conn.onconnectionstatechange =
            this.onConnectionStateChange.bind(this);
    }

    private async AddLocalTrack(stream: MediaStream) {
        const tracks = stream.getTracks();
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
            this.connected = true;
            await new Promise((r) => setTimeout(r, 5000));
            await this.DoneHandshake();
        };

        switch (
            (eve.target as RTCPeerConnection)
                .connectionState as RTCPeerConnectionState
        ) {
            case 'connected':
                successHandler();
                break;
            case 'new':
            case 'connecting':
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
            if (track != null) await this.AddLocalTrack(track);

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
        const out: SignalingMessage = {
            type: SignalingType.TYPE_SDP,
            sdp: {
                Type: init.type,
                SDPData: init.sdp
            }
        };
        Log(LogLevel.Debug, this.id + ' signaling out : ' + msgString(out));
        this.signaling.SignallingSend(out);
    }

    private onICECandidates(event: RTCPeerConnectionIceEvent) {
        if (event.candidate == null) {
            Log(LogLevel.Infor, this.id + ' ICE Candidate was null, done');
            return;
        }

        const init = event.candidate.toJSON();
        const out: SignalingMessage = {
            type: SignalingType.TYPE_ICE,
            ice: {
                SDPMid: init.sdpMid,
                Candidate: init.candidate,
                SDPMLineIndex: init.sdpMLineIndex
            }
        };
        Log(LogLevel.Debug, this.id + ' signaling out : ' + msgString(out));
        this.signaling.SignallingSend(out);
    }

    private async DoneHandshake() {
        const out: SignalingMessage = { type: SignalingType.END };
        Log(LogLevel.Debug, this.id + ' signaling out : ' + msgString(out));
        this.signaling.SignallingSend(out);
        await new Promise((r) => setTimeout(r, 1000));
        this.signaling.Close();
    }
}
