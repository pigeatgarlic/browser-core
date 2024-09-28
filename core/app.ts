import { DataChannel } from './datachannel/datachannel';
import { HID } from './hid/hid';
import { TouchHandler } from './hid/touch';
import { EventCode, HIDMsg } from './models/keys.model';
import { AudioWrapper } from './pipeline/sink/audio/wrapper';
import { VideoWrapper } from './pipeline/sink/video/wrapper';
import { SignalingConfig } from './signaling/config';
import {
    ConnectionEvent,
    Log,
    LogConnectionEvent,
    LogLevel
} from './utils/log';
import { RTCMetric, WebRTC } from './webrtc/webrtc';

const Timeout = () => new Promise((r) => setTimeout(r, 30 * 1000))
type ChannelName = 'hid' | 'manual';


export class RemoteDesktopClient {
    public hid: HID;
    public touch: TouchHandler;
    public video: VideoWrapper;
    public audio: AudioWrapper;
    public Metrics: {
        video: {
            timestamp : Date
            idrcount: {
                last: number
                current: number
            }
            packetloss: {
                last: number
                current: number
            },
            frame: {
                last: number
                current: number
            }
        },
        audio: {

        }
    };

    private missing_frame: any
    private countThread: any
    private async waitForNewFrame() {
        if (this.missing_frame != undefined)
            clearTimeout(this.missing_frame)

        const IDR = () => {
            this.ResetVideo()
            this.waitForNewFrame()
        }

        this.missing_frame = setTimeout(IDR, 100)
    }

    private countDecodedFrame() {
        if (this.countThread != undefined)
            clearInterval(this.countThread)

        const IDR = () => {
            this.ResetVideo()
        }

        let last_decoded_frame = this.Metrics.video.frame.last
        this.countThread = setInterval(() => {
            if (this.Metrics.video.frame.last == last_decoded_frame)
                IDR()

            last_decoded_frame = this.Metrics.video.frame.last
        }, 2000)
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
            scancode,microphone
        }: {
            scancode?: boolean;
            microphone?: boolean;
        }
    ) {
        this.closed = false;
        this.video = vid;
        this.audio = audio;
        this.Metrics = {
            audio: {},
            video: {
                timestamp: new Date(),
                idrcount: {
                    current: 0,
                    last: 0,
                },
                frame: {
                    current: 0,
                    last: 0,
                },
                packetloss: {
                    current: 0,
                    last: 0,
                }
            },
        }

        this.hid = null;
        this.datachannels = new Map<ChannelName, DataChannel>();
        this.datachannels.set('manual',
            new DataChannel(async (data: string) => { })
        );
        this.datachannels.set('hid',
            new DataChannel(async (data: string) => {
                if (this.closed) return;
                this.hid.handleIncomingData(data);
            })
        );

        const hid_channel = this.datachannels.get('hid');
        this.hid = new HID(((data: string) => {
            if (this.closed) return;
            hid_channel.sendMessage(data);
        }).bind(this), scancode, vid.video);
        this.touch = new TouchHandler( vid.video, 
            val => this.SendRawHID(val)
        );

        const handle_metrics = (val: RTCMetric) => {
            if (val.kind == 'video') {
                this.Metrics.video.timestamp = new Date()

                this.Metrics.video.frame.current = val.framesDecoded - this.Metrics.video.frame.last
                this.Metrics.video.frame.last    = val.framesDecoded

                this.Metrics.video.packetloss.current = val.packetsLost - this.Metrics.video.packetloss.last
                this.Metrics.video.packetloss.last    = val.packetsLost

                this.Metrics.video.idrcount.current = val.keyFramesDecoded - this.Metrics.video.idrcount.last
                this.Metrics.video.idrcount.last    = val.keyFramesDecoded
            }
        }

        const audioEstablishmentLoop = async () => {
            if (this.closed) return;

            this.audioConn = new WebRTC(
                'audio',
                signalingConfig.audioUrl,
                WebRTCConfig,
                microphone ? this.AcquireMicrophone.bind(this) : async () => null,
                this.handleIncomingAudio.bind(this),
                this.handleIncomingDataChannel.bind(this),
                _ => {},
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
                handle_metrics.bind(this),
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

    private async audioTransform(encodedFrame: RTCEncodedAudioFrame, controller: TransformStreamDefaultController<RTCEncodedAudioFrame>) {
        controller.enqueue(encodedFrame)
    }
    private async videoTransform(encodedFrame: RTCEncodedVideoFrame, controller: TransformStreamDefaultController<RTCEncodedVideoFrame>) {
        controller.enqueue(encodedFrame)
        this.waitForNewFrame()
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

        if (Number.isNaN(parseInt(stream.id)))
            return;

        try {
            const frameStreams = (evt.receiver as any).createEncodedStreams();
            frameStreams.readable
                .pipeThrough(new TransformStream({ transform: this.videoTransform.bind(this) }))
                .pipeTo(frameStreams.writable);

            this.waitForNewFrame()
        } catch { }

        this.countDecodedFrame()
        await this.video.assign(stream);
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

        const stream = evt.streams.find((val) => val.getAudioTracks().length > 0)
        try {
            const frameStreams = (evt.receiver as any).createEncodedStreams();
            frameStreams.readable
                .pipeThrough(new TransformStream({ transform: this.audioTransform.bind(this) }))
                .pipeTo(frameStreams.writable);
        } catch { }

        await this.audio.assign(stream);
    }

    private async AcquireMicrophone() {
        // Handles being called several times to update labels. Preserve values.
        let localStream: MediaStream = null;
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                // audio: true
            });
        } catch {
            return null;
        }

        const audioTracks = localStream.getAudioTracks();

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

    public async SendRawHID(data: string) {
        if (this.closed) return;
        await this.datachannels.get('hid').sendMessage(data);
    }
    public SetClipboard(val: string) {
        const code = EventCode.ClipboardSet;
        this.SendRawHID(
            new HIDMsg(code, {
                val: btoa(val)
            }).ToString()
        );
    }

    public Close() {
        this.closed = true;
        clearTimeout(this.missing_frame)
        clearInterval(this.countThread)
        this.hid?.Close();
        this.touch?.Close();
        this.videoConn?.Close();
        this.audioConn?.Close();
        this.video.video.srcObject = null;
        this.audio.internal().srcObject = null;
        this.datachannels = new Map<ChannelName, DataChannel>();
        Log(LogLevel.Infor, `Closed remote desktop connection`);
    }
}
