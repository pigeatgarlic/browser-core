import { DataChannel } from "./datachannel/datachannel";
import { HID } from "./hid/hid"
import { ConnectionEvent, Log, LogConnectionEvent, LogLevel } from "./utils/log";
import { WebRTC } from "./webrtc/webrtc";
import { Pipeline } from "./pipeline/pipeline";
import { getPlatform } from "./utils/platform";
import { AudioMetrics, NetworkMetrics, VideoMetrics } from "./qos/models";
import { SignalingConfig } from "./signaling/config";

type ChannelName = 'hid' | 'adaptive' | 'manual'

export class RemoteDesktopClient  {
    private readonly platform : 'desktop' | 'mobile'

    public  hid                 : HID 
    private video               : HTMLVideoElement
    private audio               : HTMLAudioElement
    private pipelines           : Map<string,Pipeline>
    private datachannels        : Map<ChannelName,DataChannel>;

    private dataConn   : WebRTC
    private videoConn  : WebRTC
    private audioConn  : WebRTC

    constructor(signalingConfig : SignalingConfig,
                webrtcConfig    : RTCConfiguration,
                vid : HTMLVideoElement,
                audio: HTMLAudioElement,
                platform?: 'mobile' | 'desktop') {

        this.video = vid;
        this.audio = audio;
        this.pipelines = new Map<string,Pipeline>();
        this.platform = platform != null ? platform : getPlatform()
        
        this.hid = null;
        this.datachannels = new Map<ChannelName,DataChannel>();

        this.hid = new HID( this.platform, this.video, (data: string) => {
            this.datachannels.get("hid")?.sendMessage(data);
        });

        this.audioConn       = new WebRTC(signalingConfig.audioURL,webrtcConfig,
                                 this.handleIncomingTrack.bind(this),
                                 this.handleIncomingDataChannel.bind(this),{
                                    audioMetricCallback:    this.handleAudioMetric.bind(this),
                                    videoMetricCallback:    async () => {},
                                    networkMetricCallback:  async () => {}
                                 });

        this.videoConn       = new WebRTC(signalingConfig.videoURL,webrtcConfig,
                                 this.handleIncomingTrack.bind(this),
                                 this.handleIncomingDataChannel.bind(this),{
                                    audioMetricCallback:    async () => {},
                                    videoMetricCallback:    this.handleVideoMetric.bind(this),
                                    networkMetricCallback:  async () => {},
                                 });
        this.dataConn        = new WebRTC(signalingConfig.dataURL,webrtcConfig,
                                 this.handleIncomingTrack.bind(this),
                                 this.handleIncomingDataChannel.bind(this), {
                                    audioMetricCallback:    async () => {},
                                    videoMetricCallback:    async () => {},
                                    networkMetricCallback:  async () => {}
                                 });
    }

    private async handleIncomingTrack(evt: RTCTrackEvent) : Promise<void>
    {
        Log(LogLevel.Infor,`Incoming ${evt.track.kind} stream`);
        await LogConnectionEvent(evt.track.kind == 'video' 
            ? ConnectionEvent.ReceivedVideoStream 
            : ConnectionEvent.ReceivedAudioStream, 
            JSON.stringify(evt.streams.map(x => 
                x.getTracks().map(x => `${x.label} ${x.id}`
            ))));

        if (evt.track.kind == "video") 
            this.video.srcObject = evt.streams.find(val => val.getVideoTracks().length > 0)
        else if (evt.track.kind == "audio") 
            this.audio.srcObject = evt.streams.find(val => val.getAudioTracks().length > 0)

        if (evt.track.kind == "video")  {
            this.ResetVideo() 
            // let pipeline = new Pipeline('h264'); // TODO
            // pipeline.updateSource(evt.streams[0])
            // pipeline.updateTransform(new WebGLTransform());
            // pipeline.updateSink(new VideoSink(this.video.current as HTMLVideoElement))
            // this.pipelines.set(evt.track.id,pipeline);
        }

        // user must interact with the document first, by then, video can start to play. so we wait for use to interact
        if (evt.track.kind == "audio") 
            await this.audio.play()
        else if (evt.track.kind == "video") 
            await this.video.play()

    }

    private async handleAudioMetric(a: AudioMetrics): Promise<void> {
        this.datachannels.get('adaptive')?.sendMessage(JSON.stringify(a));
        Log(LogLevel.Debug,JSON.stringify(a))
    }
    private async handleVideoMetric(a: VideoMetrics): Promise<void> {
        this.datachannels.get('adaptive')?.sendMessage(JSON.stringify(a));
        Log(LogLevel.Debug,JSON.stringify(a))
    }
    private async handleNetworkMetric(a: NetworkMetrics): Promise<void> {
        this.datachannels.get('adaptive')?.sendMessage(JSON.stringify(a));
        Log(LogLevel.Debug,JSON.stringify(a))
    }

    private handleIncomingDataChannel(a: RTCDataChannelEvent): Promise<void> {
        if(a.channel?.label == undefined)
            return;

        LogConnectionEvent(ConnectionEvent.ReceivedDatachannel, a.channel.label)
        Log(LogLevel.Infor,`incoming data channel: ${a.channel.label}`)

        let handler = async (data) => { }
        const hidHandler = async (data : string) => {
            this.hid.handleIncomingData(data);
        }

        if (a.channel.label == 'hid' as ChannelName) 
            handler = hidHandler
            
        this.datachannels.set( 
            a.channel.label as ChannelName, 
            new DataChannel(a.channel,handler)
        );
    }



    public ChangeFramerate (framerate : number) {
        const dcName = "manual";
        let channel = this.datachannels.get(dcName)
        if (channel == undefined) {
            Log(LogLevel.Warning,`attempting to send message while data channel ${dcName} is ready`);
            return;
        }

        console.log(framerate)
        channel.sendMessage(JSON.stringify({
            type: "framerate",
            value: framerate
        }))

    }
    public ChangeBitrate (bitrate: number) {
        const dcName = "manual";
        let channel = this.datachannels.get(dcName)
        if (channel == undefined) {
            Log(LogLevel.Warning,`attempting to send message while data channel ${dcName} is ready`);
            return;
        }

        channel.sendMessage(JSON.stringify({
            type: "bitrate",
            value: bitrate
        }))
    }

    public ResetVideo () {
        const dcName = "manual";
        let channel = this.datachannels.get(dcName)
        if (channel == undefined) {
            Log(LogLevel.Warning,`attempting to send message while data channel ${dcName} is ready`);
            return;
        }

        channel.sendMessage(JSON.stringify({
            type: "reset",
        }))
    }

    public ResetAudio () {
        const dcName = "manual";
        let channel = this.datachannels.get(dcName)
        if (channel == undefined) {
            Log(LogLevel.Warning,`attempting to send message while data channel ${dcName} is ready`);
            return;
        }

        channel.sendMessage(JSON.stringify({
            type: "audio-reset",
        }))
    }
}