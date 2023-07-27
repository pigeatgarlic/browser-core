export class VideoMetrics {
    type : 'video'

    frameWidth : number
    frameHeight : number

    codecId : string
    decoderImplementation : string

    totalSquaredInterFrameDelay : number
    totalInterFrameDelay : number

    totalProcessingDelay : number
    totalDecodeTime : number
    
    keyFramesDecoded : number
    framesDecoded : number
    framesReceived : number
    
    headerBytesReceived : number
    bytesReceived : number
    packetsReceived : number
    
    framesDropped : number
    packetsLost : number

    jitterBufferEmittedCount : number
    jitterBufferDelay : number
    jitter : number

    timestamp : number
}


export class AudioMetrics {
    type : 'audio'

    audioLevel : number
    totalAudioEnergy : number

    totalSamplesReceived : number
    headerBytesReceived : number

    bytesReceived : number
    packetsReceived : number

    packetsLost : number

    timestamp : number
}

export class NetworkMetrics {
    type : 'network'

    packetsReceived : number
    packetsSent : number

    bytesSent : number
    bytesReceived : number

    availableIncomingBitrate : number
    availableOutgoingBitrate : number

    currentRoundTripTime : number
    totalRoundTripTime : number

    localIP : string
    localPort : number

    remoteIP : string
    remotePort : number

    priority : number

    timestamp : number
}



export type MetricCallback = {
    networkMetricCallback : (data : NetworkMetrics) => Promise<void>,
    audioMetricCallback   : (data : AudioMetrics) => Promise<void>,
    videoMetricCallback   : (data : VideoMetrics) => Promise<void>,
}


