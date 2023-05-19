import { AudioMetrics, MetricCallback, NetworkMetrics, VideoMetrics } from "./models";

export class Adaptive {
    private networkMetricCallback : (data: NetworkMetrics) => void;
    private audioMetricCallback   : (data: AudioMetrics) => void;
    private videoMetricCallback   : (data: VideoMetrics) => void;

    private conn : RTCPeerConnection
    private loopNumber: number;

    constructor(conn: RTCPeerConnection,
                callback : MetricCallback) {

        this.conn = conn;

        this.networkMetricCallback = callback.networkMetricCallback ;
        this.audioMetricCallback   = callback.audioMetricCallback   ;
        this.videoMetricCallback   = callback.videoMetricCallback   ;

        this.loopNumber = setInterval(this.getConnectionStats.bind(this),300)
    }


    filterNetwork(report : RTCStatsReport) : NetworkMetrics {
        let remoteCandidate = ""
        let localCandidate = ""
        let CandidatePair = ""

        report.forEach((value,key) => {
            if (value["type"] == "candidate-pair" &&
                value["state"] == "succeeded" &&
                value["writable"] == true) 
            {
                remoteCandidate = value["remoteCandidateId"];
                localCandidate = value["localCandidateId"];
                CandidatePair = key;
            }
        })

        if (CandidatePair == "") {
            return null;
        }



        let val = report.get(CandidatePair);

        let ret = new NetworkMetrics();

        ret.localIP = report.get(localCandidate)["ip"];
        ret.remoteIP = report.get(remoteCandidate)["ip"];

        ret.localPort = report.get(localCandidate)["port"];
        ret.remotePort = report.get(remoteCandidate)["port"];

        ret.packetsReceived  = val["packetsReceived"];
        ret.packetsSent  = val["packetsSent"];
        ret.bytesSent  = val["bytesSent"];
        ret.bytesReceived  = val["bytesReceived"];
        ret.availableIncomingBitrate  = val["availableIncomingBitrate"];
        ret.availableOutgoingBitrate  = val["availableOutgoingBitrate"];
        ret.currentRoundTripTime  = val["currentRoundTripTime"];
        ret.totalRoundTripTime  = val["totalRoundTripTime"];
        ret.priority  = val["priority"];
        ret.timestamp  = val["timestamp"];

        return ret;
    }



    filterVideo(report : RTCStatsReport) : VideoMetrics {

        let ret = null;

        report.forEach((val,key) => {
            if (val["type"] == "inbound-rtp" &&
                val["kind"] == "video") 
            {
                ret = new VideoMetrics();
                ret.frameWidth = val["frameWidth"];
                ret.frameHeight = val["frameHeight"];
                ret.codecId = val["codecId"];
                ret.decoderImplementation = val["decoderImplementation"];
                ret.totalSquaredInterFrameDelay = val["totalSquaredInterFrameDelay"];
                ret.totalInterFrameDelay = val["totalInterFrameDelay"];
                ret.totalProcessingDelay = val["totalProcessingDelay"];
                ret.totalDecodeTime = val["totalDecodeTime"];
                ret.keyFramesDecoded = val["keyFramesDecoded"];
                ret.framesDecoded = val["framesDecoded"];
                ret.framesReceived = val["framesReceived"];
                ret.headerBytesReceived = val["headerBytesReceived"];
                ret.bytesReceived = val["bytesReceived"];
                ret.packetsReceived = val["packetsReceived"];
                ret.framesDropped = val["framesDropped"];
                ret.packetsLost = val["packetsLost"];
                ret.jitterBufferEmittedCount = val["jitterBufferEmittedCount"];
                ret.jitterBufferDelay = val["jitterBufferDelay"];
                ret.jitter = val["jitter"];
                ret.timestamp = val["timestamp"];
            }
        });

        return ret;
    }

    filterAudio(report : RTCStatsReport) : AudioMetrics {

        let ret = null;
        report.forEach((val,key) => {
            if (val["type"] == "inbound-rtp" &&
                val["kind"] == "audio") 
            {
                ret = new AudioMetrics();
                ret.totalAudioEnergy = val["totalAudioEnergy"]
                ret.totalSamplesReceived = val["totalSamplesReceived"]
                ret.headerBytesReceived = val["headerBytesReceived"]
                ret.bytesReceived = val["bytesReceived"]
                ret.packetsReceived = val["packetsReceived"]
                ret.packetsLost = val["packetsLost"]
                ret.timestamp = val["timestamp"]
            }
        });

        return ret;
    }




    private async getConnectionStats() 
    {
        const result = await this.conn.getStats()

        const network = this.filterNetwork(result);
        if (network != null)  
            this.networkMetricCallback(network);

        const audio   = this.filterAudio(result);
        if (audio != null) 
            this.audioMetricCallback(audio);
        
        const video   = this.filterVideo(result);
        if (video != null) 
            this.videoMetricCallback(video);
    }

    public Close() {
        clearInterval(this.loopNumber)
    }
}


