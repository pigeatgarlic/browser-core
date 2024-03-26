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
import { AudioWrapper } from './pipeline/sink/audio/wrapper';
import { VideoWrapper } from './pipeline/sink/video/wrapper';
import { AudioMetrics, NetworkMetrics, VideoMetrics } from './qos/models';
import { SignalingConfig } from './signaling/config';

const Timeout = () => new Promise((r) => setTimeout(r, 30 * 1000))
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
            scancode
        }: {
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
                {
                    audioMetricCallback: this.handleAudioMetric.bind(this),
                    videoMetricCallback: async () => {},
                    networkMetricCallback: this.handleNetworkMetric.bind(this)
                },
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
                {
                    audioMetricCallback: async () => {},
                    videoMetricCallback: this.handleVideoMetric.bind(this),
                    networkMetricCallback: this.handleNetworkMetric.bind(this)
                },
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

        await this.video.assign(stream);
        this.ResetVideo();
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

    private async handleAudioMetric(a: AudioMetrics): Promise<void> {
        if (this.closed) return;
        await this.datachannels.get('adaptive').sendMessage(JSON.stringify(a));
        this.HandleMetricRaw(a);
    }
    private async handleVideoMetric(a: VideoMetrics): Promise<void> {
        if (this.closed) return;
        await this.datachannels.get('adaptive').sendMessage(JSON.stringify(a));
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
