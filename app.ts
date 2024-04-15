import { DataChannel } from './datachannel/datachannel';
import { HID } from './hid/hid';
import {
    ConnectionEvent,
    Log,
    LogConnectionEvent,
    LogLevel
} from './utils/log';
import { WebRTC } from './webrtc/webrtc';
import { AudioWrapper } from './pipeline/sink/audio/wrapper';
import { VideoWrapper } from './pipeline/sink/video/wrapper';
import { SignalingConfig } from './signaling/config';

const Timeout = () => new Promise((r) => setTimeout(r, 30 * 1000))
type ChannelName = 'hid' | 'manual';

export type Metrics =
    | {
        type: 'VIDEO';
        receivefps: number[];
        decodefps: number[];
        packetloss: number[];
        bandwidth: number[];
        buffer: number[];
    }
    | {
        type: 'AUDIO';
    }
    | {
        type: 'NETWORK';
    }
    | {
        type: 'FRAME_LOSS';
    };

export class RemoteDesktopClient {
    public hid: HID;
    public video: VideoWrapper;
    public audio: AudioWrapper;
    private missing_frame : any 
    private async waitForNewFrame() {
        if (this.missing_frame != undefined) 
            clearTimeout(this.missing_frame)

        const IDR = () => {
            this.ResetVideo()
            this.waitForNewFrame()
        }

        this.missing_frame = setTimeout(IDR, 200)
    }

    private videoConn: WebRTC;
    private audioConn: WebRTC;
    private datachannels: Map<ChannelName, DataChannel>;

    public ready(): boolean {
        return this.videoConn.connected && this.audioConn.connected;
    }

    private closed: boolean;

    constructor(
        vid: VideoWrapper,
        audio: AudioWrapper,
        signalingConfig: SignalingConfig,
        WebRTCConfig: RTCConfiguration,
        {
            scancode
        }: {
            scancode?: boolean;
        }
    ) {
        this.closed = false;
        this.video = vid;
        this.audio = audio;

        this.hid = null;
        this.datachannels = new Map<ChannelName, DataChannel>();
        this.datachannels.set( 'manual',
            new DataChannel(async (data: string) => { })
        );
        this.datachannels.set( 'hid',
            new DataChannel(async (data: string) => {
                if (this.closed) return;
                this.hid.handleIncomingData(data);
            })
        );        

        const hid_channel = this.datachannels.get('hid');
        this.hid = new HID((data: string) => {
            if (this.closed) return;
            hid_channel.sendMessage(data);
        }, scancode);

        const audioEstablishmentLoop = async () => {
            if (this.closed) return;

            this.audioConn = new WebRTC(
                'audio',
                signalingConfig.audioUrl,
                WebRTCConfig,
                this.AcquireMicrophone.bind(this),
                this.handleIncomingAudio.bind(this),
                this.handleIncomingDataChannel.bind(this),
                audioEstablishmentLoop, 
            );

            await Timeout()
            if (!this.audioConn.connected) {
                this.audioConn.Close();
                return;
            }

            Log(LogLevel.Infor, `Successfully establish audio stream`);
        };

        const videoEstablishmentLoop = async () => {
            if (this.closed) return;

            this.videoConn = new WebRTC(
                'video',
                signalingConfig.videoUrl,
                WebRTCConfig,
                async () => { return null },
                this.handleIncomingVideo.bind(this),
                this.handleIncomingDataChannel.bind(this),
                videoEstablishmentLoop,
            );

            await Timeout()
            if (!this.videoConn.connected) {
                this.videoConn.Close();
                return;
            }

            Log(LogLevel.Infor, `Successfully establish video stream`);
        };

        Log(LogLevel.Infor, `Started remote desktop connection`);
        audioEstablishmentLoop();
        videoEstablishmentLoop();
    }

    private async handleIncomingDataChannel(
        a: RTCDataChannelEvent
    ): Promise<void> {
        if (this.closed) return;
        LogConnectionEvent(
            ConnectionEvent.ReceivedDatachannel,
            a.channel.label
        );
        Log(LogLevel.Infor, `incoming data channel: ${a.channel.label}`);

        this.datachannels
            .get(a.channel.label as ChannelName)
            .SetSender(a.channel);
    }

    private async videoTransform(encodedFrame: RTCEncodedVideoFrame, controller: TransformStreamDefaultController<RTCEncodedVideoFrame>) {
        this.waitForNewFrame()
        controller.enqueue(encodedFrame)
    }

    private async handleIncomingVideo(evt: RTCTrackEvent): Promise<void> {
        if (this.closed) return;
        Log(LogLevel.Infor, `Incoming ${evt.track.kind} stream`);
        await LogConnectionEvent(
            ConnectionEvent.ReceivedVideoStream,
            JSON.stringify(
                evt.streams.map((x) =>
                    x.getTracks().map((x) => `${x.label} ${x.id}`)
                )
            )
        );

        if (evt.track.kind != 'video')
            return

        const stream = evt.streams.find(
            (val) => val.getVideoTracks().length > 0
        );

        console.log(`incoming video stream ${stream.id}`);
        if (Number.isNaN(parseInt(stream.id))) {
            console.log(`blocked video stream ${stream.id}`);
            return;
        } // RISK / black screen

        const frameStreams = (evt.receiver as any).createEncodedStreams();
        frameStreams.readable
            .pipeThrough(new TransformStream({ transform : this.videoTransform.bind(this) }))
            .pipeTo(frameStreams.writable);

        await this.video.assign(stream);
        await new Promise(x => setTimeout(x,1000))
        this.waitForNewFrame()
        this.ResetVideo()
    }

    private async handleIncomingAudio(evt: RTCTrackEvent): Promise<void> {
        if (this.closed) return;
        Log(LogLevel.Infor, `Incoming ${evt.track.kind} stream`);
        await LogConnectionEvent(
            ConnectionEvent.ReceivedAudioStream,
            JSON.stringify(
                evt.streams.map((x) =>
                    x.getTracks().map((x) => `${x.label} ${x.id}`)
                )
            )
        );

        if (evt.track.kind != 'audio')
            return

        await this.audio.assign(
            evt.streams.find((val) => val.getAudioTracks().length > 0)
        );
    }

    private async AcquireMicrophone() {
        // Handles being called several times to update labels. Preserve values.
        let localStream: MediaStream = null;
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: true
            });
        } catch {
            console.log(`failed to acquire microphone`);
            return null;
        }

        const audioTracks = localStream.getAudioTracks();
        if (audioTracks.length > 0) {
            console.log(`Using Audio device: ${audioTracks[0].label}`);
        }

        return localStream
    }

    public async ChangeFramerate(framerate: number) {
        if (this.closed) return;
        await this.datachannels.get('manual').sendMessage(
            JSON.stringify({
                type: 'framerate',
                value: framerate
            })
        );

        Log(LogLevel.Infor, `changing framerate to ${framerate}`);
    }
    public async ChangeBitrate(bitrate: number) {
        if (this.closed) return;
        await this.datachannels.get('manual').sendMessage(
            JSON.stringify({
                type: 'bitrate',
                value: bitrate
            })
        );

        Log(LogLevel.Infor, `changing bitrate to ${bitrate}`);
    }

    public async PointerVisible(enable: boolean) {
        if (this.closed) return;
        await this.datachannels.get('manual').sendMessage(
            JSON.stringify({
                type: 'pointer',
                value: enable ? 1 : 0
            })
        );
    }

    public async ResetVideo() {
        if (this.closed) return;
        await this.datachannels.get('manual').sendMessage(
            JSON.stringify({
                type: 'reset',
                value: 1
            })
        );

        Log(LogLevel.Infor, `gen I frame`);
    }

    public async HardReset() {
        if (this.closed) return;
        await this.datachannels.get('manual').sendMessage(
            JSON.stringify({
                type: 'danger-reset'
            })
        );

        this.videoConn?.Close();
        this.audioConn?.Close();
        Log(LogLevel.Debug, `hard reset video stream`);
    }

    public Close() {
        this.closed = true;
        clearTimeout(this.missing_frame)
        this.hid?.Close();
        this.videoConn?.Close();
        this.audioConn?.Close();
        this.video.video.srcObject = null;
        this.audio.internal().srcObject = null;
        this.datachannels = new Map<ChannelName, DataChannel>();
        Log(LogLevel.Infor, `Closed remote desktop connection`);
    }
}
