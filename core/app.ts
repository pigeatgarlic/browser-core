import { DataChannel } from './datachannel/datachannel';
import { HID } from './hid/hid';
import { TouchHandler } from './hid/touch';
import { AxisType } from './models/hid.model';
import { EventCode, HIDMsg } from './models/keys.model';
import { AudioWrapper } from './pipeline/sink/audio/wrapper';
import { VideoWrapper } from './pipeline/sink/video/wrapper';
import { SignalingConfig } from './signaling/config';
import { convertJSKey } from './utils/convert';
import {
    ConnectionEvent,
    Log,
    LogConnectionEvent,
    LogLevel
} from './utils/log';
import { RTCMetric, WebRTC } from './webrtc/webrtc';

const Timeout = () => new Promise((r) => setTimeout(r, 30 * 1000));
type ChannelName = 'hid' | 'manual';

export class RemoteDesktopClient {
    public hid: HID;
    public touch: TouchHandler;
    public video: VideoWrapper;
    public audio: AudioWrapper;
    public Metrics: {
        video: {
            timestamp: Date;
            idrcount: {
                last: number;
                current: number;
                strict_timing: boolean;
            };
            packetloss: {
                last: number;
                current: number;
            };
            bitrate: {
                total: number;
                persecond: number;
            };
            frame: {
                total: number;
                persecond: number;
                waitperiod: number;
            };
        };
        audio: {};
    };

    private missing_frame: any;
    private countThread: any;
    private waitForNewFrame() {
        if (this.missing_frame != undefined) clearTimeout(this.missing_frame);

        this.missing_frame = setTimeout(
            this.ResetVideo.bind(this),
            this.Metrics.video.frame.waitperiod
        );
    }

    private countDecodedFrame() {
        if (this.countThread != undefined) clearInterval(this.countThread);

        let last_decoded_frame = this.Metrics.video.frame.total;
        this.countThread = setInterval(() => {
            if (this.Metrics.video.frame.total == last_decoded_frame)
                this.ResetVideo();

            last_decoded_frame = this.Metrics.video.frame.total;
        }, 2000);
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
            scancode,
            microphone
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
                    strict_timing: true,
                    current: 0,
                    last: 0
                },
                bitrate: {
                    persecond: 0,
                    total: 0
                },
                frame: {
                    waitperiod: 50,
                    persecond: 0,
                    total: 0
                },
                packetloss: {
                    current: 0,
                    last: 0
                }
            }
        };

        this.hid = null;
        this.datachannels = new Map<ChannelName, DataChannel>();
        this.datachannels.set(
            'manual',
            new DataChannel(async (data: string) => {})
        );
        this.datachannels.set(
            'hid',
            new DataChannel(async (data: string) => {
                if (this.closed) return;
                this.hid.handleIncomingData(data);
            })
        );

        const hid_channel = this.datachannels.get('hid');
        this.hid = new HID(
            ((data: string) => {
                if (this.closed) return;
                hid_channel.sendMessage(data);
            }).bind(this),
            scancode,
            vid.video
        );
        this.touch = new TouchHandler(vid.video, (val) => this.SendRawHID(val));

        const calculate_waitperiod = (fps: number) =>
            fps < 50
                ? 60
                : fps > 100
                  ? 50
                  : Math.round(50 + ((100 - fps) / 50) * 10);

        const handle_metrics = (val: RTCMetric) => {
            if (val.kind == 'video') {
                const now = new Date();

                this.Metrics.video.frame.persecond = Math.round(
                    (val.framesDecoded - this.Metrics.video.frame.total) /
                        ((now.getTime() -
                            this.Metrics.video.timestamp.getTime()) /
                            1000)
                );
                this.Metrics.video.frame.total = val.framesDecoded;

                this.Metrics.video.bitrate.persecond = Math.round(
                    (((val.bytesReceived - this.Metrics.video.bitrate.total) /
                        ((now.getTime() -
                            this.Metrics.video.timestamp.getTime()) /
                            1000)) *
                        8) /
                        1024
                );
                this.Metrics.video.bitrate.total = val.bytesReceived;

                this.Metrics.video.packetloss.current =
                    val.packetsLost - this.Metrics.video.packetloss.last;
                this.Metrics.video.packetloss.last = val.packetsLost;

                this.Metrics.video.idrcount.current =
                    val.keyFramesDecoded - this.Metrics.video.idrcount.last;
                this.Metrics.video.idrcount.last = val.keyFramesDecoded;

                this.Metrics.video.timestamp = now;

                const fps = this.Metrics.video.frame.persecond;
                this.Metrics.video.frame.waitperiod = this.Metrics.video
                    .idrcount.strict_timing
                    ? calculate_waitperiod(fps)
                    : 150;
            }
        };

        const audioEstablishmentLoop = async () => {
            if (this.closed) return;

            this.audioConn = new WebRTC(
                'audio',
                signalingConfig.audioUrl,
                WebRTCConfig,
                microphone
                    ? this.AcquireMicrophone.bind(this)
                    : async () => null,
                this.handleIncomingAudio.bind(this),
                this.handleIncomingDataChannel.bind(this),
                (_) => {},
                audioEstablishmentLoop
            );

            await Timeout();
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
                async () => {
                    return null;
                },
                this.handleIncomingVideo.bind(this),
                this.handleIncomingDataChannel.bind(this),
                handle_metrics.bind(this),
                videoEstablishmentLoop
            );

            await Timeout();
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

    private async audioTransform(
        encodedFrame: RTCEncodedAudioFrame,
        controller: TransformStreamDefaultController<RTCEncodedAudioFrame>
    ) {
        controller.enqueue(encodedFrame);
    }
    private async videoTransform(
        encodedFrame: RTCEncodedVideoFrame,
        controller: TransformStreamDefaultController<RTCEncodedVideoFrame>
    ) {
        this.waitForNewFrame();
        controller.enqueue(encodedFrame);
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

        if (evt.track.kind != 'video') return;

        const stream = evt.streams.find(
            (val) => val.getVideoTracks().length > 0
        );

        if (Number.isNaN(parseInt(stream.id))) return;

        try {
            const frameStreams = (evt.receiver as any).createEncodedStreams();
            frameStreams.readable
                .pipeThrough(
                    new TransformStream({
                        transform: this.videoTransform.bind(this)
                    })
                )
                .pipeTo(frameStreams.writable);

            this.waitForNewFrame();
        } catch {}

        this.countDecodedFrame();
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

        if (evt.track.kind != 'audio') return;

        const stream = evt.streams.find(
            (val) => val.getAudioTracks().length > 0
        );
        try {
            const frameStreams = (evt.receiver as any).createEncodedStreams();
            frameStreams.readable
                .pipeThrough(
                    new TransformStream({
                        transform: this.audioTransform.bind(this)
                    })
                )
                .pipeTo(frameStreams.writable);
        } catch {}

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

        return localStream;
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

    async SendRawHID(...data: HIDMsg[]) {
        if (this.closed) return;
        for (let index = 0; index < data.length; index++)
            await this.datachannels
                .get('hid')
                .sendMessage(data[index].ToString());
    }
    public SetClipboard(val: string) {
        if (this.closed) return;
        this.SendRawHID(
            new HIDMsg(EventCode.ClipboardSet, {
                val: btoa(val)
            })
        );
    }

    public VirtualGamepadButton(isDown: boolean, index: number) {
        const is_slider = index == 6 || index == 7;
        this.SendRawHID(
            new HIDMsg(
                is_slider
                    ? EventCode.GamepadSlide
                    : !isDown
                      ? EventCode.GamepadButtonDown
                      : EventCode.GamepadButtonUp,
                is_slider
                    ? {
                          gamepad_id: 0,
                          index: index,
                          val: !isDown ? 0 : 1
                      }
                    : {
                          gamepad_id: 0,
                          index: index
                      }
            )
        );
    }

    public VirtualGamepadAxis(x: number, y: number, type: AxisType) {
        let axisx, axisy: number;
        switch (type) {
            case 'left':
                axisx = 0;
                axisy = 1;
                break;
            case 'right':
                axisx = 2;
                axisy = 3;
                break;
        }

        this.SendRawHID(
            new HIDMsg(EventCode.GamepadAxis, {
                gamepad_id: 0,
                index: axisx,
                val: x
            }),
            new HIDMsg(EventCode.GamepadAxis, {
                gamepad_id: 0,
                index: axisy,
                val: y
            })
        );
    }

    public VirtualKeyboard = (
        ...keys: { code: EventCode; jsKey: string }[]
    ) => {
        for (let index = 0; index < keys.length; index++) {
            const { jsKey, code } = keys[index];
            const key = convertJSKey(jsKey, 0);
            if (key == undefined) return;
            this.SendRawHID(new HIDMsg(code, { key }));
        }
    };

    public Close() {
        this.closed = true;
        clearTimeout(this.missing_frame);
        clearInterval(this.countThread);
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
