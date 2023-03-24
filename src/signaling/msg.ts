export enum SignalingType {
    TYPE_SDP = 0,
    TYPE_ICE,
    START,
    END,
}

export type ICE = {
    Candidate : string 
    SDPMid    : string 
    SDPMLineIndex : number
}
export type SDP = {
    Type : "answer" | "offer" | "pranswer" | "rollback"
    SDPData : string
}

export type SignalingMessage = {
    type : SignalingType.TYPE_SDP
    Sdp : SDP
} | {
    type : SignalingType.TYPE_ICE
    Ice : ICE
} | {
    type : SignalingType.END
} | {
    type : SignalingType.START
}