import { AudioMetrics, MetricCallback, NetworkMetrics, VideoMetrics } from "./models";

export class Adaptive {
    constructor(conn: RTCPeerConnection,
                callback : MetricCallback) {

        this.conn = conn;
        this.running = true;

        this.networkMetricCallback = callback.networkMetricCallback ;
        this.audioMetricCallback   = callback.audioMetricCallback   ;
        this.videoMetricCallback   = callback.videoMetricCallback   ;

        this.startCollectingStat(this.conn);
    }

    networkMetricCallback : (data: NetworkMetrics) => void;
    audioMetricCallback   : (data: AudioMetrics) => void;
    videoMetricCallback   : (data: VideoMetrics) => void;

    conn : RTCPeerConnection
    running : boolean


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




    async getConnectionStats(conn : RTCPeerConnection) 
    {
        let result = await conn.getStats()

        let network = this.filterNetwork(result);
        if (network != null)  
            this.networkMetricCallback(network);

        let audio   = this.filterAudio(result);
        if (audio != null) 
            this.audioMetricCallback(audio);
        
        let video   = this.filterVideo(result);
        if (video != null) 
            this.videoMetricCallback(video);
        
    }

    /**
     * 
     */
    startCollectingStat(conn: RTCPeerConnection)
    {
        var statsLoop = async () => {        
            await this.getConnectionStats(conn);
            setTimeout(statsLoop, 300);
        };

        statsLoop();
    }
}


