import { Log, LogLevel } from "../utils/log";
import { EventCode } from "../models/keys.model";
import { HIDMsg, KeyCode, Shortcut, ShortcutCode } from "../models/keys.model";
import { getBrowser, getOS } from "../utils/platform";
import { AxisType } from "../models/hid.model";
import {Screen} from "../models/hid.model"
import { isFullscreen, requestFullscreen } from "../utils/screen";
import { MobileTouch } from "./mobile";
import { DesktopTouch } from "./desktop";



export class HID {
    private prev_buttons : Map<number,boolean>;
    private prev_sliders : Map<number,number>;
    private prev_axis    : Map<number,number>;


    private shortcuts: Array<Shortcut>

    private relativeMouse : boolean

    private disableKeyboard : boolean
    private disableMouse    : boolean
    public isTouchVideo    : boolean

    public DisableKeyboard (val: boolean) {
        this.disableKeyboard = val
    }
    public DisableMouse (val: boolean) {
        this.disableMouse = val
    }
    public DisableTouch (val: boolean) {
        this.platform.Toggle(val);
    }

    private Screen : Screen;
    private video: HTMLVideoElement

    private SendFunc: ((data: string) => void)
    private platform : MobileTouch | DesktopTouch

    private intervals : any[] 

    constructor(platform : 'mobile' | 'desktop',
                videoElement: HTMLVideoElement, 
                Sendfunc: ((data: string)=>void)){
        this.prev_buttons = new Map<number,boolean>();
        this.prev_sliders = new Map<number,number>();
        this.prev_axis    = new Map<number,number>();

        this.disableKeyboard = false;
        this.disableMouse = false;
        this.isTouchVideo = true;

        this.video = videoElement;
        this.SendFunc = Sendfunc;
        this.Screen = new Screen();
        this.intervals = []
        
        this.platform = platform == 'desktop' 
            ? new DesktopTouch(Sendfunc) 
            : new MobileTouch(videoElement,Sendfunc);
        if(platform == 'mobile')
            document.addEventListener('touchstart', event => this.isTouchVideo = event.target === this.video)
        /**
         * video event
         */
        this.video.addEventListener('contextmenu',  event => event.preventDefault()); ///disable content menu key on remote control

        /**
         * mouse event
         */
        document.addEventListener('wheel',          this.mouseWheel.bind(this));
        document.addEventListener('mousemove',      this.mouseButtonMovement.bind(this));
        document.addEventListener('mousedown',      this.mouseButtonDown.bind(this));
        document.addEventListener('mouseup',        this.mouseButtonUp.bind(this));
        
        /**
         * keyboard event
         */
        document.addEventListener('keydown',        this.keydown.bind(this));
        document.addEventListener('keyup',          this.keyup.bind(this));

        /**
         * shortcuts stuff
         */
        this.shortcuts = new Array<Shortcut>();
        this.shortcuts.push(new Shortcut(ShortcutCode.Fullscreen,[KeyCode.Ctrl,KeyCode.Shift,KeyCode.P],requestFullscreen))

        /**
         * gamepad stuff
         */
        this.intervals.push(setInterval(this.runButton.bind(this), 1));
        this.intervals.push(setInterval(this.runAxis  .bind(this), 1));
        this.intervals.push(setInterval(this.runSlider.bind(this), 1));

        this.intervals.push(setInterval(() => this.relativeMouse = document.pointerLockElement != null,100))
    }

    public Close() {
        this.intervals.forEach(x => clearInterval(x))
        document.removeEventListener('wheel',          this.mouseWheel.bind(this));
        document.removeEventListener('mousemove',      this.mouseButtonMovement.bind(this));
        document.removeEventListener('mousedown',      this.mouseButtonDown.bind(this));
        document.removeEventListener('mouseup',        this.mouseButtonUp.bind(this));
        document.removeEventListener('keydown',        this.keydown.bind(this));
    }



    public SetClipboard(val: string){
        const code = EventCode.ClipboardSet
        this.SendFunc((new HIDMsg(code,{
            val: btoa(val)
        })).ToString());
    }
    public PasteClipboard(){
        const code = EventCode.ClipboardPaste
        this.SendFunc((new HIDMsg(code,{})).ToString());
    }




    public handleIncomingData(data: string) {
        this.platform.handleIncomingData(data);
    }




    private runButton() : void {
        navigator.getGamepads().forEach((gamepad: Gamepad,gamepad_id: number) =>{
            if (gamepad == null) 
                return;
                
            
            gamepad.buttons.forEach((button: GamepadButton,index: number) => {
                if (index == 6 || index == 7) { // slider
                } else {
                    const pressed = button.pressed

                    if(this.prev_buttons.get(index) == pressed)
                        return;

                    this.SendFunc((new HIDMsg(pressed ?  EventCode.GamepadButtonUp : EventCode.GamepadButtonDown,{ 
                        gamepad_id: gamepad_id,
                        index: index
                    }).ToString()))

                    this.prev_buttons.set(index,pressed);
                }
            })
        })
    };
    private runSlider() : void {
        navigator.getGamepads().forEach((gamepad: Gamepad,gamepad_id: number) =>{
            if (gamepad == null) 
                return;

            gamepad.buttons.forEach((button: GamepadButton,index: number) => {
                if (index == 6 || index == 7) { // slider
                    const value = button.value

                    if(Math.abs(this.prev_sliders.get(index) - value) < 0.000001) 
                        return;
                    

                    this.SendFunc((new HIDMsg(EventCode.GamepadSlide, {
                        gamepad_id: gamepad_id,
                        index: index,
                        val: value
                    }).ToString()))

                    this.prev_sliders.set(index,value)
                } 
            })
        })
    };
    private runAxis() : void {
        navigator.getGamepads().forEach((gamepad: Gamepad,gamepad_id: number) =>{
            if (gamepad == null) 
                return;

            gamepad.axes.forEach((value: number, index: number) => {
                if(Math.abs(this.prev_axis.get(index) - value) < 0.000001) 
                    return;
                
                this.SendFunc((new HIDMsg(EventCode.GamepadAxis,{ 
                    gamepad_id: gamepad_id,
                    index: index,
                    val: value
                }).ToString()))

                this.prev_axis.set(index,value)
            })
        })
    };








    public VirtualGamepadButtonSlider(isDown: boolean, index: number) {
        if (index == 6 || index == 7) { // slider
            this.SendFunc((new HIDMsg(EventCode.GamepadSlide, {
                gamepad_id: 0,
                index: index,
                val: !isDown ? 0 : 1
            }).ToString()))
            return;
        }
        this.SendFunc((new HIDMsg(!isDown ?  EventCode.GamepadButtonDown : EventCode.GamepadButtonUp ,{ 
            gamepad_id: 0,
            index: index
        }).ToString()))
    }

    public VirtualGamepadAxis(x :number, y: number, type: AxisType) {
        let axisx, axisy : number
        switch (type) {
            case 'left':
                axisx = 0
                axisy = 1
                break;
            case 'right':
                axisx = 2
                axisy = 3
                break;
        }

        this.SendFunc((new HIDMsg(EventCode.GamepadAxis,{ 
            gamepad_id: 0,
            index: axisx,
            val: x 
        }).ToString()))
        this.SendFunc((new HIDMsg(EventCode.GamepadAxis,{ 
            gamepad_id: 0,
            index: axisy,
            val: y
        }).ToString()))
    }










    public ResetKeyStuck() {
        this.SendFunc((new HIDMsg(EventCode.KeyReset,{ }).ToString()))
    }
    public TriggerKey(code : EventCode.KeyUp | EventCode.KeyDown ,jsKey : string) {
        this.SendFunc((new HIDMsg(code ,{
            key: jsKey,
        })).ToString());
    }

    private keydown(event: KeyboardEvent) {
        event.preventDefault();

        let disable_send = false;
        this.shortcuts.forEach((element: Shortcut) => {
            const triggered = element.HandleShortcut(event);

            if (triggered) 
                disable_send = true;
        })



        if (disable_send || this.disableKeyboard) 
            return;


        const jsKey = event.key;
        const code = EventCode.KeyDown
        this.SendFunc((new HIDMsg(code,{
            key: jsKey == KeyCode.F1 ? KeyCode.Esc : jsKey,
        })).ToString());
    }
    private keyup(event: KeyboardEvent) {
        event.preventDefault();
        if (this.disableKeyboard) 
            return;

        const jsKey = event.key;
        const code = EventCode.KeyUp;
        this.SendFunc((new HIDMsg(code,{
            key: jsKey == KeyCode.F1 ? KeyCode.Esc : jsKey,
        })).ToString());
    }
    private mouseWheel(event: WheelEvent){
        const code = EventCode.MouseWheel
        this.SendFunc((new HIDMsg(code,{
            deltaY: -Math.round(event.deltaY),
        })).ToString());
    }
    public mouseMoveRel(event: {movementX: number, movementY: number}){
        const code = EventCode.MouseMoveRel
        this.SendFunc((new HIDMsg(code,{
            dX: event.movementX,
            dY: event.movementY,
        })).ToString());
    }
    private mouseButtonMovement(event: MouseEvent){
        if (this.disableMouse || !this.isTouchVideo) 
            return;

        if (!this.relativeMouse) {
            this.elementConfig(this.video)
            const code = EventCode.MouseMoveAbs
            const mousePosition_X = this.clientToServerX(event.clientX);
            const mousePosition_Y = this.clientToServerY(event.clientY);
            this.SendFunc((new HIDMsg(code,{
                dX: mousePosition_X,
                dY: mousePosition_Y,
            })).ToString());
        } else {
            const code = EventCode.MouseMoveRel
            this.SendFunc((new HIDMsg(code,{
                dX: event.movementX,
                dY: event.movementY,
            })).ToString());
        }
    }
    private mouseButtonDown(event: MouseEvent){
        if (this.disableMouse || !this.isTouchVideo) 
            return;

        this.MouseButtonDown(event)
    }
    private mouseButtonUp(event: MouseEvent){
        if (this.disableMouse || !this.isTouchVideo) 
            return;

        this.MouseButtonUp(event)
    }

    public MouseButtonDown(event: {button: number}){
        const code = EventCode.MouseDown
        this.SendFunc((new HIDMsg(code,{
            button: event.button
        })).ToString());
    }
    public MouseButtonUp(event: {button: number}){
        const code = EventCode.MouseUp
        this.SendFunc((new HIDMsg(code,{
            button: event.button
        })).ToString());
    }



    private clientToServerY(clientY: number): number
    {
        return (clientY - this.Screen.ClientTop) / this.Screen.ClientHeight;
    }

    private clientToServerX(clientX: number): number 
    {
        return (clientX - this.Screen.ClientLeft) / this.Screen.ClientWidth;
    }

    private elementConfig(VideoElement: HTMLVideoElement) 
    {
        this.Screen.ClientWidth  =  VideoElement.offsetWidth;
        this.Screen.ClientHeight =  VideoElement.offsetHeight;
        this.Screen.ClientTop    =  VideoElement.offsetTop;
        this.Screen.ClientLeft   =  VideoElement.offsetLeft;

        this.Screen.StreamWidth  =  VideoElement.videoWidth;
        this.Screen.Streamheight =  VideoElement.videoHeight;

        const desiredRatio = this.Screen.StreamWidth / this.Screen.Streamheight;
        const HTMLVideoElementRatio = this.Screen.ClientWidth / this.Screen.ClientHeight;
        const HTMLdocumentElementRatio = document.documentElement.scrollWidth / document.documentElement.scrollHeight;

        if (HTMLVideoElementRatio > desiredRatio) {
            const virtualWidth = this.Screen.ClientHeight * desiredRatio
            const virtualLeft = ( this.Screen.ClientWidth - virtualWidth ) / 2;

            this.Screen.ClientWidth = virtualWidth
            this.Screen.ClientLeft = virtualLeft
        } else if (HTMLdocumentElementRatio < desiredRatio) {
            const virtualHeight = document.documentElement.offsetWidth / desiredRatio
            const virtualTop    = ( this.Screen.ClientHeight - virtualHeight ) / 2;

            this.Screen.ClientHeight =virtualHeight 
            this.Screen.ClientTop = virtualTop 
        }
    }
    
}