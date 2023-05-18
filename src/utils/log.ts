export enum LogLevel {
    Debug,
    Infor,
    Warning,
    Error,
    Fatal
}

function GetLogLevelString(level: LogLevel): string {
    switch (level) {
    case LogLevel.Debug:
        return "Debug"
    case LogLevel.Infor:
        return "Infor"
    case LogLevel.Warning:
        return "Warning"
    case LogLevel.Error:
        return "Error"
    case LogLevel.Fatal:
        return "Fatal"
    }
}



export enum ConnectionEvent {
    ApplicationStarted                = "Application Started",

    WebSocketConnecting               = "WebSocket Connecting",
    WebSocketConnected                = "WebSocket Connected",
    WebSocketDisconnected             = "WebSocket Disconnected",

    WaitingAvailableDevice            = "Waiting Available Device",
    WaitingAvailableDeviceSelection   = "Waiting Available Device Selection",

    ExchangingSignalingMessage        = "Exchanging Signaling Message",

    WebRTCConnectionChecking          = "WebRTC Connection Checking",
    WebRTCConnectionDoneChecking      = "WebRTC Connection Done Checking",
    WebRTCConnectionClosed            = "WebRTC Connection Closed",

    ReceivedVideoStream               = "Received Video Stream",
    ReceivedAudioStream               = "Received Audio Stream",
    ReceivedDatachannel               = "Received Datachannel",

    GamepadConnected                  = "Gamepad Connected",
    GamepadDisconnected               = "Gamepad Disconnected",
}



type LogCallback = (message :ConnectionEvent, text?: string) => Promise<void>

class Logger {
    logs: Array<string>
    Notifiers: Array<LogCallback>


    constructor() {
        this.logs = new Array<string>();
        this.Notifiers = new Array<LogCallback>();
    }

    filterEvent(data: string){
        this.logs.push(data);
    }

    

    async BroadcastEvent(event: ConnectionEvent, text?: string) {
        for (let index = 0; index < this.Notifiers.length; index++) {
            const x = this.Notifiers[index];
            await x(event,text);
        }
    }

    AddNotifier(notifier: ((message :string) => Promise<void>)) {
        this.Notifiers.push(notifier);
    }
}

var init = false;
var loggerSingleton: Logger;
function getLoggerSingleton(): Logger{
    if(!init) {
        loggerSingleton = new Logger();
        init = true;
    }

    return loggerSingleton;
}



export function AddNotifier(notifier: LogCallback){
    let logger = getLoggerSingleton()
    logger.AddNotifier(notifier);
}



export function Log(level : LogLevel, message: string) {
    if (level == LogLevel.Debug) 
        return
        
    console.log(`${GetLogLevelString(level)}: ${message}`)
}

export async function LogConnectionEvent(a : ConnectionEvent , text?: string) {
    let logger = getLoggerSingleton()
    await logger.BroadcastEvent(a,text);
}