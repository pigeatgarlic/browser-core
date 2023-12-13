import { Log, LogLevel } from "../utils/log";

export enum EventCode{
    MouseWheel,
    MouseUp,
    MouseDown,

    MouseMoveRel,
    MouseMoveAbs,

    KeyUp,
    KeyDown,
    KeyUpScan,
    KeyDownScan,
    KeyPress,
    KeyReset,

    GamepadConnect,
    GamepadDisconnect,
    GamepadSlide,
    GamepadAxis,
    GamepadButtonUp,
    GamepadButtonDown,
    GamepadRumble,
   
    RelativeMouseOff,
    RelativeMouseOn,

    ClipboardSet,
    ClipboardPaste,
}

export enum ShortcutCode{
    Fullscreen,
}
export enum KeyCode{
    Shift = 0,
    Alt,
    Ctrl,

    F = "KeyF",
    P = "KeyP",
    F1 = "F1",
    F11 = "F11",
    Esc = "Escape",
}




export class Shortcut {
    code : ShortcutCode
    keys : Array<KeyCode>
    Handler: ((a: void) => (void))


    constructor(code: ShortcutCode,
                keys : Array<KeyCode>,
                Handler: ((a: void) => (void))){
        this.code = code;
        this.keys = keys;
        this.Handler = Handler;
    }

    public ManualTrigger(): void {
        this.Handler();
    }

    public HandleShortcut(event : KeyboardEvent) : Boolean {
        const shift = this.keys.includes(KeyCode.Shift) === event.shiftKey;
        const alt   = this.keys.includes(KeyCode.Alt)   === event.altKey;
        const ctrl  = this.keys.includes(KeyCode.Ctrl)  === event.ctrlKey;

        let key = false;
        this.keys.forEach(element => {
            if(element === event.code) {
                key = true; 
            }
        });

        if (shift && alt && ctrl && key) {
            event.preventDefault();
            Log(LogLevel.Infor,`shortcut fired with code ${this.code}`)
            this.Handler();
            return true;
        }
        return false;
    }
}



export class HIDMsg {
    code: EventCode
    data: any
    constructor(code: EventCode, data: any)
    {
        this.code = code;
        this.data = data;
    }

    public ToString() : string
    {
        switch (this.code) {
            case EventCode.KeyUp:
                return `ku|${this.data.key}`
            case EventCode.KeyDown:
                return `kd|${this.data.key}`
            case EventCode.KeyUpScan:
                return `kus|${this.data.key}`
            case EventCode.KeyDownScan:
                return `kds|${this.data.key}`
            case EventCode.KeyReset:
                return `kr`

            case EventCode.MouseUp:
                return `mu|${this.data.button}`
            case EventCode.MouseDown:
                return `md|${this.data.button}`

            case EventCode.MouseMoveRel:
                return `mmr|${this.data.dX}|${this.data.dY}`
            case EventCode.MouseMoveAbs:
                return `mma|${this.data.dX}|${this.data.dY}`
            case EventCode.MouseWheel:
                return `mw|${this.data.deltaY}`

            case EventCode.GamepadConnect:
                return `gcon|${this.data.gamepad_id}`
            case EventCode.GamepadDisconnect:
                return `gdis|${this.data.gamepad_id}`

            case EventCode.GamepadButtonUp:
                return `gb|${this.data.gamepad_id}|${this.data.index}|1`
            case EventCode.GamepadButtonDown:
                return `gb|${this.data.gamepad_id}|${this.data.index}|0`
            case EventCode.GamepadAxis:
                return `ga|${this.data.gamepad_id}|${this.data.index}|${this.data.val}`
            case EventCode.GamepadSlide:
                return `gs|${this.data.gamepad_id}|${this.data.index}|${this.data.val}`

            case EventCode.ClipboardSet:
                return `cs|${this.data.val}`
            case EventCode.ClipboardPaste:
                return `cp`
            default:
            return ""
        }
    }
}


