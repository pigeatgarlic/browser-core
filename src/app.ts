import { DataChannel } from "./datachannel/datachannel";
import { HID } from "./hid/hid"
import { AddNotifier, ConnectionEvent, EventMessage, Log, LogConnectionEvent, LogLevel } from "./utils/log";
import { DeviceSelection, DeviceSelectionResult } from "./models/devices.model";
import { WebRTC } from "./webrtc";
import { SignallingClient } from "./signaling/websocket";
import { Pipeline } from "./pipeline/pipeline";
import { getOS, getPlatform } from "./utils/platform";
import { SignalingMessage, SignalingType } from "./signaling/msg";



export class WebRTCClient  {
    public hid : HID | null
    private readonly platform : 'desktop' | 'mobile'

    private video : HTMLVideoElement
    private audio : HTMLAudioElement

    private webrtc : WebRTC
    private webrtcConfig : RTCConfiguration
    private signaling : SignallingClient
    private datachannels : Map<string,DataChannel>;

    private pipelines: Map<string,Pipeline>
    started : boolean
    constructor(signalingURL : string,
                token : string,
                webrtcConfig: RTCConfiguration,
                vid : HTMLVideoElement,
                audio: HTMLAudioElement,
                platform?: 'mobile' | 'desktop') {
        Log(LogLevel.Infor,`Started oneplay app connect to signaling server ${signalingURL}`);
        Log(LogLevel.Infor,`Session token: ${token}`);

        this.webrtcConfig = webrtcConfig
        this.started = false;
        this.video = vid;
        this.audio = audio;
        this.pipelines = new Map<string,Pipeline>();
        this.platform = platform != null ? platform : getPlatform()
        
        this.hid = null;
        this.datachannels = new Map<string,DataChannel>();

        



        this.signaling = new SignallingClient(signalingURL,token,
                                 this.handleIncomingPacket.bind(this));

        this.webrtc = new WebRTC(this.signaling.SignallingSend.bind(this.signaling),
                                 this.handleIncomingTrack.bind(this),
                                 this.handleIncomingDataChannel.bind(this),
                                 this.handleWebRTCMetric.bind(this));

    }

    private async handleIncomingTrack(evt: RTCTrackEvent) 
    {
        this.started = true;
        Log(LogLevel.Infor,`Incoming ${evt.track.kind} stream`);
        if (evt.track.kind == "audio")
        {
            await LogConnectionEvent(ConnectionEvent.ReceivedAudioStream);
            this.audio.srcObject = evt.streams[0]
            setInterval(async () => {  // user must interact with the document first, by then, audio can start to play. so we wait for use to interact
                try {
                    await this.audio.play()
                } catch (e) {
                    console.log(`error playing audio ${JSON.stringify(e)}`)
                }
            },1000)
        } else if (evt.track.kind == "video") {
            this.ResetVideo();
            setTimeout(() => { this.DoneHandshake(); },3000)
            await LogConnectionEvent(ConnectionEvent.ReceivedVideoStream);
            this.video.srcObject = evt.streams[0]
            setInterval(async () => {  // user must interact with the document first, by then, video can start to play. so we wait for use to interact
                try {
                    await this.video.play()
                } catch (e) {
                    console.log(`error playing video ${JSON.stringify(e)}`)
                }
            },1000)
            // let pipeline = new Pipeline('h264'); // TODO
            // pipeline.updateSource(evt.streams[0])
            // pipeline.updateTransform(new WebGLTransform());
            // pipeline.updateSink(new VideoSink(this.video.current as HTMLVideoElement))
            // this.pipelines.set(evt.track.id,pipeline);
        }
    }

    private handleWebRTCMetric(a: string)
    {
        Log(LogLevel.Debug,`metric : ${a}`)

        const dcName = "adaptive";
        let channel = this.datachannels.get(dcName)
        if (channel == null) {
            Log(LogLevel.Warning,`attempting to send message while data channel ${dcName} is ready`);
            return;
        }

        channel.sendMessage(a);
    }

    private handleIncomingDataChannel(a: RTCDataChannelEvent)
    {
        LogConnectionEvent(ConnectionEvent.ReceivedDatachannel)
        Log(LogLevel.Infor,`incoming data channel: ${a.channel.label}`)
        if(!a.channel)
            return;


        if(a.channel.label == "hid") {
            this.datachannels.set(a.channel.label,new DataChannel(a.channel,(data) => {
                this.hid.handleIncomingData(data);
            }));

            this.hid = new HID( this.platform, this.video, (data: string) => {
                    Log(LogLevel.Debug,data)

                    let channel = this.datachannels.get("hid")
                    if (channel == null) 
                        return;
                    
                    channel.sendMessage(data);
                });
            return
        }

        this.datachannels.set(a.channel.label,new DataChannel(a.channel,(data) => {
        }));
    }

    private async handleIncomingPacket(pkt : SignalingMessage)
    {
        switch (pkt.type) {
            case SignalingType.TYPE_SDP:
                LogConnectionEvent(ConnectionEvent.ExchangingSignalingMessage)
                this.webrtc.onIncomingSDP({
                    sdp: pkt.sdp.SDPData,
                    type: pkt.sdp.Type 
                })
                break;
            case SignalingType.TYPE_ICE:
                LogConnectionEvent(ConnectionEvent.ExchangingSignalingMessage)
                this.webrtc.onIncomingICE({
                    candidate: pkt.ice.Candidate,
                    sdpMid: pkt.ice.SDPMid != undefined ? pkt.ice.SDPMid : "",
                    sdpMLineIndex: pkt.ice.SDPMLineIndex != undefined ? pkt.ice.SDPMLineIndex : 0,
                })
                break;
            case SignalingType.START:
                this.webrtc.SetupConnection(this.webrtcConfig)
                break;
            case SignalingType.END:
                this.signaling.Close()
                break;
            default:
                break;
        }
    }


    public ChangeFramerate (framerate : number) {
        const dcName = "manual";
        let channel = this.datachannels.get(dcName)
        if (channel == null) {
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
        if (channel == null) {
            Log(LogLevel.Warning,`attempting to send message while data channel ${dcName} is ready`);
            return;
        }

        channel.sendMessage(JSON.stringify({
            type: "bitrate",
            value: bitrate
        }))
    }
    private DoneHandshake() {
        this.signaling.SignallingSend({
            type : SignalingType.END
        })
    }
    public ResetAudio () {
        const dcName = "manual";
        let channel = this.datachannels.get(dcName)
        if (channel == null) {
            Log(LogLevel.Warning,`attempting to send message while data channel ${dcName} is ready`);
            return;
        }

        channel.sendMessage(JSON.stringify({
            type: "audio-reset",
        }))
    }
    public ResetVideo () {
        const dcName = "manual";
        let channel = this.datachannels.get(dcName)
        if (channel == null) {
            Log(LogLevel.Warning,`attempting to send message while data channel ${dcName} is ready`);
            return;
        }

        channel.sendMessage(JSON.stringify({
            type: "reset",
        }))
    }
}