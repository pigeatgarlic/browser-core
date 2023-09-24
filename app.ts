import { DataChannel } from "./datachannel/datachannel";
import { HID } from "./hid/hid"
import { ConnectionEvent, Log, LogConnectionEvent, LogLevel } from "./utils/log";
import { WebRTC } from "./webrtc/webrtc";
import { Pipeline } from "./pipeline/pipeline";
import { getOS, getPlatform } from "./utils/platform";
import { AudioMetrics, NetworkMetrics, VideoMetrics } from "./qos/models";
import { SignalingConfig } from "./signaling/config";
import { VideoWrapper } from "./pipeline/sink/video/wrapper";
import { AudioWrapper } from "./pipeline/sink/audio/wrapper";

type ChannelName = 'hid' | 'adaptive' | 'manual'


export type Metrics = {
	type                              : 'VIDEO'
    receivefps                        : number[]
    decodefps                         : number[]
    packetloss                        : number[]     
    bandwidth                         : number[]     
    buffer                            : number[] 
} | {
	type                             : 'AUDIO'
} | {
    type                             : 'NETWORK'
} | {
    type                             : 'FRAME_LOSS'
}

export class RemoteDesktopClient  {
    private readonly platform : 'desktop' | 'mobile'

    public  hid                 : HID 
    private video               : VideoWrapper
    private audio               : AudioWrapper 
    private pipelines           : Map<string,Pipeline>
    private datachannels        : Map<ChannelName,DataChannel>;

    private videoConn  : WebRTC
    private audioConn  : WebRTC

    private closed     : boolean

    public HandleMetrics   : (metrics: Metrics) => Promise<void>
    public HandleMetricRaw : (data: NetworkMetrics | VideoMetrics | AudioMetrics) => Promise<void>
    constructor(vid : VideoWrapper,
                audio: AudioWrapper,
                signalingConfig : SignalingConfig,
                WebRTCConfig : RTCConfiguration,
                { platform, no_video, no_mic ,turn, no_hid }: {
                    turn?: boolean,
                    platform?: 'mobile' | 'desktop',
                    no_video?: boolean,
                    no_mic?: boolean,
                    no_hid?: boolean,
                }) {

        this.closed = false
        this.video = vid;
        this.audio = audio;
        this.pipelines = new Map<string,Pipeline>();
        this.platform = platform ?? getPlatform()
        this.HandleMetrics   = async () => {}
        this.HandleMetricRaw = async () => {}
        
        this.hid = null;
        this.datachannels = new Map<ChannelName,DataChannel>();
        this.datachannels.set('manual',   new DataChannel())
        this.datachannels.set('adaptive', new DataChannel(async (data : string) => {
            const result = JSON.parse(data) as Metrics
            if (result.type == 'VIDEO' && result.decodefps.every(x => x == 0)) {
                console.log("black screen detected")
                this.videoConn.Close()
            }

            this.HandleMetrics(result)
        }))



        const webrtcConfig = {
            ...WebRTCConfig,
            iceTransportPolicy: ( turn ?? false) ? "relay" : "all" as any
        }
        const audioEstablishmentLoop = () => {
            if (this.closed) 
                return
            
            this.audioConn       = new WebRTC(signalingConfig.audioURL,webrtcConfig,
                                    this.handleIncomingTrack.bind(this),
                                    this.handleIncomingDataChannel.bind(this),
                                    audioEstablishmentLoop,{
                                        audioMetricCallback:    this.handleAudioMetric.bind(this),
                                        videoMetricCallback:    async () => {},
                                        networkMetricCallback:  this.handleNetworkMetric.bind(this)
                                    },no_mic,"audio");
        }

        const videoEstablishmentLoop = () => {
            if (this.closed) 
                return

            this.videoConn       = new WebRTC(signalingConfig.videoURL,webrtcConfig,
                                    this.handleIncomingTrack.bind(this),
                                    this.handleIncomingDataChannel.bind(this),
                                    videoEstablishmentLoop, {
                                        audioMetricCallback:    async () => {},
                                        videoMetricCallback:    this.handleVideoMetric.bind(this),
                                        networkMetricCallback:  this.handleNetworkMetric.bind(this),
                                    },true,"video");

        }

        audioEstablishmentLoop()
        if (!(no_video ?? false)) 
            videoEstablishmentLoop()

        this.datachannels.set('hid',      new DataChannel(async (data : string) => {
            if ((no_hid ?? false) || this.closed) 
                return 

            this.hid.handleIncomingData(data);
        }))

        const hid_channel = this.datachannels.get("hid")
        this.hid = new HID( this.platform, this.video.internal(), (data: string) => {
            if ((no_hid ?? false) || this.closed) 
                return 
            
            hid_channel.sendMessage(data);
        });
    }



    private async handleIncomingDataChannel(a: RTCDataChannelEvent): Promise<void> {
        if (this.closed) 
            return
        LogConnectionEvent(ConnectionEvent.ReceivedDatachannel, a.channel.label)
        Log(LogLevel.Infor,`incoming data channel: ${a.channel.label}`)

        this.datachannels.get( a.channel.label as ChannelName).SetSender(a.channel);
    }

    private async handleIncomingTrack(evt: RTCTrackEvent) : Promise<void>
    {
        if (this.closed) 
            return
        Log(LogLevel.Infor,`Incoming ${evt.track.kind} stream`);
        await LogConnectionEvent(evt.track.kind == 'video' 
            ? ConnectionEvent.ReceivedVideoStream 
            : ConnectionEvent.ReceivedAudioStream, 
            JSON.stringify(evt.streams.map(x => 
                x.getTracks().map(x => `${x.label} ${x.id}`
            ))));

        if (evt.track.kind == "video" ) {
            const stream = evt.streams.find(val => val.getVideoTracks().length > 0)
            if (Number.isNaN(parseInt(stream.id))) {
                console.log(`blocked video stream ${stream.id}`)
                return
            } // RISK / black screen

            await this.video.assign(stream)
        } else if (evt.track.kind == "audio") {
            await this.audio.assign(evt.streams.find(val => val.getAudioTracks().length > 0))
        }

        if (evt.track.kind == "video")  {
            this.ResetVideo() 
            // let pipeline = new Pipeline('h264'); // TODO
            // pipeline.updateSource(evt.streams[0])
            // pipeline.updateTransform(new WebGLTransform());
            // pipeline.updateSink(new VideoSink(this.video.current as HTMLVideoElement))
            // this.pipelines.set(evt.track.id,pipeline);
        }
    }

    private async handleAudioMetric(a: AudioMetrics): Promise<void> {
        if (this.closed) 
            return
        await this.datachannels.get('adaptive').sendMessage(JSON.stringify(a));
        Log(LogLevel.Debug,`sending ${a.type} metric`)
        this.HandleMetricRaw(a)
    }
    private async handleVideoMetric(a: VideoMetrics): Promise<void> {
        if (this.closed) 
            return
        await this.datachannels.get('adaptive').sendMessage(JSON.stringify(a));
        Log(LogLevel.Debug,`sending ${a.type} metric`)
        this.HandleMetricRaw(a)
    }
    private async handleNetworkMetric(a: NetworkMetrics): Promise<void> {
        if (this.closed) 
            return
        // await this.datachannels.get('adaptive').sendMessage(JSON.stringify(a));
        // Log(LogLevel.Debug,`sending ${a.type} metric`)
        this.HandleMetricRaw(a)
    }




    public async ChangeFramerate (framerate : number) {
        if (this.closed) 
            return
        await this.datachannels.get('manual').sendMessage(JSON.stringify({
            type: "framerate",
            value: framerate
        }))

        Log(LogLevel.Debug,`changing framerate to ${framerate}`)
    }
    public async ChangeBitrate (bitrate: number) {
        if (this.closed) 
            return
        await this.datachannels.get('manual').sendMessage(JSON.stringify({
            type: "bitrate",
            value: bitrate
        }))

        Log(LogLevel.Debug,`changing bitrate to ${bitrate}`)
    }
    public async PointerVisible (enable: boolean) {
        if (this.closed) 
            return
        await this.datachannels.get('manual').sendMessage(JSON.stringify({
            type: "pointer",
            value: enable ? 1 : 0
        }))
    }

    public async ResetVideo () {
        if (this.closed) 
            return
        await this.datachannels.get('manual').sendMessage(JSON.stringify({
            type: "reset",
        }))

        Log(LogLevel.Debug,`gen I frame`)
    }

    public async ResetAudio () {
        if (this.closed) 
            return
        await this.datachannels.get('manual').sendMessage(JSON.stringify({
            type: "audio-reset",
        }))

        Log(LogLevel.Debug,`reset audio pipeline`)
    }

    public async HardReset() {
        if (this.closed) 
            return
        await this.datachannels.get('manual').sendMessage(JSON.stringify({
            type: "danger-reset",
        }))

        this.videoConn?.Close()
        this.audioConn?.Close()
        Log(LogLevel.Debug,`hard reset video stream`)
    }


    public Close() {
        this.hid.Close()
        this.closed = true
    }
}