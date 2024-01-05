import { DataChannel } from './datachannel/datachannel';
import { HID } from './hid/hid';
import {
    ConnectionEvent,
    Log,
    LogConnectionEvent,
    LogLevel
} from './utils/log';
import { WebRTC } from './webrtc/webrtc';
// import { Pipeline } from "./pipeline/pipeline";
import { getOS, getPlatform } from './utils/platform';
import { AudioMetrics, NetworkMetrics, VideoMetrics } from './qos/models';
import { SignalingConfig } from './signaling/config';
import { VideoWrapper } from './pipeline/sink/video/wrapper';
import { AudioWrapper } from './pipeline/sink/audio/wrapper';

type ChannelName = 'hid' | 'adaptive' | 'manual';

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
    private displays: {
        timestamp: Date;
        value: string[];
    };

    public hid: HID;
    public video: VideoWrapper;
    public audio: AudioWrapper;
    // private pipelines           : Map<string,Pipeline>
    private datachannels: Map<ChannelName, DataChannel>;

    private decoding: boolean;
    private videoConn: WebRTC;
    private audioConn: WebRTC;
    public ready(): boolean {
        return this.videoConn.connected && this.audioConn.connected;
    }

    private closed: boolean;

    public HandleMetrics: (metrics: Metrics) => Promise<void>;
    public HandleMetricRaw: (
        data: NetworkMetrics | VideoMetrics | AudioMetrics
    ) => Promise<void>;
    constructor(
        vid: VideoWrapper,
        audio: AudioWrapper,
        signalingConfig: SignalingConfig,
        WebRTCConfig: RTCConfiguration,
        {
            ads_period,
            scancode
        }: {
            ads_period?: number;
            scancode?: boolean;
        }
    ) {
        this.closed = false;
        this.decoding = false;
        this.video = vid;
        this.audio = audio;
        // this.pipelines = new Map<string,Pipeline>();
        this.HandleMetrics = async () => {};
        this.HandleMetricRaw = async () => {};
        this.displays = {
            timestamp: new Date(),
            value: []
        };

        this.hid = null;
        this.datachannels = new Map<ChannelName, DataChannel>();
        this.datachannels.set(
            'manual',
            new DataChannel(async (data: string) => {
                const result = JSON.parse(data) as {
                    type: 'displays';
                    value: any;
                };

                if ((result.type = 'displays')) {
                    this.displays = {
                        timestamp: new Date(),
                        value: result.value.filter(
                            (x) => x.length > 0
                        ) as string[]
                    };
                }
            })
        );
        this.datachannels.set(
            'adaptive',
            new DataChannel(async (data: string) => {
                const result = JSON.parse(data) as Metrics;
                if (result.type == 'VIDEO')
                    this.decoding = !result.decodefps.every((x) => x == 0);

                this.HandleMetrics(result);
            })
        );

        const webrtcConfig = {
            ...WebRTCConfig,
            iceTransportPolicy: 'relay' as any
        };
        const audioEstablishmentLoop = async () => {
            if (this.closed) return;

            this.audioConn = new WebRTC(
                signalingConfig.audioURL,
                webrtcConfig,
                this.handleIncomingTrack.bind(this),
                this.handleIncomingDataChannel.bind(this),
                audioEstablishmentLoop,
                {
                    audioMetricCallback: this.handleAudioMetric.bind(this),
                    videoMetricCallback: async () => {},
                    networkMetricCallback: this.handleNetworkMetric.bind(this)
                },
                false,
                'audio'
            );

            await new Promise((r) => setTimeout(r, 20000));
            if (!this.audioConn.connected) {
                this.audioConn.Close();
                return;
            } else if (this.videoConn.connected) return;

            await new Promise((r) => setTimeout(r, 20000));
            if (!this.videoConn.connected && this.audioConn.connected)
                await this.HardReset();
        };

        const videoEstablishmentLoop = async () => {
            if (this.closed) return;

            this.videoConn = new WebRTC(
                signalingConfig.videoURL,
                webrtcConfig,
                this.handleIncomingTrack.bind(this),
                this.handleIncomingDataChannel.bind(this),
                videoEstablishmentLoop,
                {
                    audioMetricCallback: async () => {},
                    videoMetricCallback: this.handleVideoMetric.bind(this),
                    networkMetricCallback: this.handleNetworkMetric.bind(this)
                },
                true,
                'video'
            );

            await new Promise((r) => setTimeout(r, 20000));
            if (!this.videoConn.connected || !this.decoding) {
                this.videoConn.Close();
                return;
            } else if (this.audioConn.connected) return;

            await new Promise((r) => setTimeout(r, 20000));
            if (!this.audioConn.connected && this.videoConn.connected)
                await this.HardReset();
        };

        Log(LogLevel.Infor, `Started remote desktop connection`);
        audioEstablishmentLoop();
        videoEstablishmentLoop();

        this.datachannels.set(
            'hid',
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

    private async handleIncomingTrack(evt: RTCTrackEvent): Promise<void> {
        if (this.closed) return;
        Log(LogLevel.Infor, `Incoming ${evt.track.kind} stream`);
        await LogConnectionEvent(
            evt.track.kind == 'video'
                ? ConnectionEvent.ReceivedVideoStream
                : ConnectionEvent.ReceivedAudioStream,
            JSON.stringify(
                evt.streams.map((x) =>
                    x.getTracks().map((x) => `${x.label} ${x.id}`)
                )
            )
        );

        if (evt.track.kind == 'video') {
            const stream = evt.streams.find(
                (val) => val.getVideoTracks().length > 0
            );
            if (Number.isNaN(parseInt(stream.id))) {
                console.log(`blocked video stream ${stream.id}`);
                return;
            } // RISK / black screen

            await this.video.assign(stream);
        } else if (evt.track.kind == 'audio') {
            await this.audio.assign(
                evt.streams.find((val) => val.getAudioTracks().length > 0)
            );
        }

        if (evt.track.kind == 'video') {
            this.ResetVideo();
            // let pipeline = new Pipeline('h264'); // TODO
            // pipeline.updateSource(evt.streams[0])
            // pipeline.updateTransform(new WebGLTransform());
            // pipeline.updateSink(new VideoSink(this.video.current as HTMLVideoElement))
            // this.pipelines.set(evt.track.id,pipeline);
        }
    }

    private async handleAudioMetric(a: AudioMetrics): Promise<void> {
        if (this.closed) return;
        await this.datachannels.get('adaptive').sendMessage(JSON.stringify(a));
        Log(LogLevel.Debug, `sending ${a.type} metric`);
        this.HandleMetricRaw(a);
    }
    private async handleVideoMetric(a: VideoMetrics): Promise<void> {
        if (this.closed) return;
        await this.datachannels.get('adaptive').sendMessage(JSON.stringify(a));
        Log(LogLevel.Debug, `sending ${a.type} metric`);
        this.HandleMetricRaw(a);
    }
    private async handleNetworkMetric(a: NetworkMetrics): Promise<void> {
        if (this.closed) return;
        // await this.datachannels.get('adaptive').sendMessage(JSON.stringify(a));
        // Log(LogLevel.Debug,`sending ${a.type} metric`)
        this.HandleMetricRaw(a);
    }

    public async SetPeriod(period: number) {
        if (this.closed) return;

        Log(LogLevel.Infor, `changing period to ${period}`);
        this.videoConn?.Ads?.SetPeriod(period);
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

    public async SwitchDisplay(
        selection: (displays: string[]) => Promise<{
            display: string;
            width: number;
            height: number;
            framerate: number;
        }>
    ) {
        if (this.closed) return;
        const timestamp = new Date();
        await this.datachannels.get('manual').sendMessage(
            JSON.stringify({
                type: 'displays',
                value: ''
            })
        );

        while (this.displays.timestamp < timestamp)
            await new Promise((r) => setTimeout(r, 100));

        const result = await selection(this.displays.value);
        await this.datachannels.get('manual').sendMessage(
            JSON.stringify({
                type: 'display',
                value: result
            })
        );
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
                type: 'reset'
            })
        );

        Log(LogLevel.Debug, `gen I frame`);
    }

    public async ResetAudio() {
        if (this.closed) return;
        await this.datachannels.get('manual').sendMessage(
            JSON.stringify({
                type: 'audio-reset'
            })
        );

        Log(LogLevel.Debug, `reset audio pipeline`);
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
        this.hid?.Close();
        this.videoConn?.Close();
        this.audioConn?.Close();
        this.video.video.srcObject = null;
        this.audio.internal().srcObject = null;
        this.datachannels = new Map<ChannelName, DataChannel>();
        Log(LogLevel.Infor, `Closed remote desktop connection`);
    }
}
