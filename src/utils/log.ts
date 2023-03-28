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
    ApplicationStarted,

    WebSocketConnecting,
    WebSocketConnected,
    WebSocketDisconnected,

    WaitingAvailableDevice,
    WaitingAvailableDeviceSelection,

    ExchangingSignalingMessage,

    WebRTCConnectionChecking,
    WebRTCConnectionDoneChecking,
    WebRTCConnectionClosed,

    ReceivedVideoStream,
    ReceivedAudioStream,
    ReceivedDatachannel,

    GamepadConnected,
    GamepadDisconnected,
}


export type EventMessage = 'ApplicationStarted' | 'WebSocketConnecting' | 'WebSocketConnected' | 'WebSocketDisconnected' | 'WaitingAvailableDevice' | 'WaitingAvailableDeviceSelection' | 'ExchangingSignalingMessage' | 'WebRTCConnectionChecking' | 'WebRTCConnectionDoneChecking' | 'WebRTCConnectionClosed' | 'ReceivedVideoStream' | 'ReceivedAudioStream' | 'ReceivedDatachannel' | 'GamepadConnected' | 'GamepadDisconnected' 
function GetEventMessage(event: ConnectionEvent): EventMessage {
    switch (event) {
    case ConnectionEvent.ApplicationStarted:
        return "ApplicationStarted"
    case ConnectionEvent.WebSocketConnecting:
        return "WebSocketConnecting"
    case ConnectionEvent.WebSocketConnected:
        return "WebSocketConnected"
    case ConnectionEvent.WebSocketDisconnected:
        return "WebSocketDisconnected"
    case ConnectionEvent.WaitingAvailableDevice:
        return "WaitingAvailableDevice"
    case ConnectionEvent.WaitingAvailableDeviceSelection:
        return "WaitingAvailableDeviceSelection"
    case ConnectionEvent.ExchangingSignalingMessage:
        return "ExchangingSignalingMessage"
    case ConnectionEvent.WebRTCConnectionChecking:
        return "WebRTCConnectionChecking"
    case ConnectionEvent.WebRTCConnectionDoneChecking:
        return "WebRTCConnectionDoneChecking"
    case ConnectionEvent.ReceivedVideoStream:
        return "ReceivedVideoStream"
    case ConnectionEvent.ReceivedAudioStream:
        return "ReceivedAudioStream"
    case ConnectionEvent.ReceivedDatachannel:
        return "ReceivedDatachannel"
    case ConnectionEvent.WebRTCConnectionClosed:
        return "WebRTCConnectionClosed"
    case ConnectionEvent.GamepadConnected:
        return "GamepadConnected"
    case ConnectionEvent.GamepadDisconnected:
        return "GamepadDisconnected"
    }
}




class Logger {
    logs: Array<string>
    Notifiers: Array<((message: EventMessage) => (void))>


    constructor() {
        this.logs = new Array<string>();
        this.Notifiers = new Array<((message: string) => (void))>();
    }

    filterEvent(data: string){
        this.logs.push(data);
    }

    

    BroadcastEvent(event: ConnectionEvent) {
        this.Notifiers.forEach(x => {
            x(GetEventMessage(event));
        })
    }

    AddNotifier(notifier: ((message :EventMessage) => (void))) {
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



export function AddNotifier(notifier: (message :EventMessage) => (void)){
    let logger = getLoggerSingleton()
    logger.AddNotifier(notifier);
}



export function Log(level : LogLevel, message: string) {
    // let logger = getLoggerSingleton()
    // logger.filterEvent(JSON.stringify(level));
    if (level == LogLevel.Debug) 
        return
        
    console.log(`${GetLogLevelString(level)}: ${message}`)
}

export function LogConnectionEvent(a : ConnectionEvent) {
    let logger = getLoggerSingleton()
    logger.BroadcastEvent(a);
}