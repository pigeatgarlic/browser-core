import { EventCode } from "../models/keys.model";
import { HIDMsg, KeyCode, Shortcut, ShortcutCode } from "../models/keys.model";
import { AxisType } from "../models/hid.model";
import {Screen} from "../models/hid.model"
import { requestFullscreen } from "../utils/screen";
import { TouchHandler } from "./touch";
import { convertJSKey } from "../utils/convert";

const MOUSE_SPEED = 1.07

export class HID {
    private prev_buttons : Map<number,boolean>;
    private prev_sliders : Map<number,number>;
    private prev_axis    : Map<number,number>;

    private pressing_keys : number[];

    private shortcuts: Array<Shortcut>

    private relativeMouse : boolean
    private disableKeyboard : boolean
    private disableMouse    : boolean
    private scancode        : boolean

    public setTouchMode (mode: 'gamepad' | 'trackpad' | 'mouse' | 'none') {
        if (mode == 'gamepad' || mode == 'trackpad')
            this.touch.mode = mode
        else 
            this.touch.mode = 'none'

        // if (mode == 'mouse') {
        //     this.video.addEventListener('pointermove',      this.mouseButtonMovement.bind(this));
        //     this.video.addEventListener('pointerdown',      this.mouseButtonDown.bind(this));
        //     this.video.addEventListener('pointerup',        this.mouseButtonUp.bind(this));
        // } else {
        //     this.video.removeEventListener('pointermove',   this.mouseButtonMovement.bind(this));
        //     this.video.removeEventListener('pointerdown',   this.mouseButtonDown.bind(this));
        //     this.video.removeEventListener('pointerup',     this.mouseButtonUp.bind(this));
        // }
    }

    private Screen : Screen;
    private video: HTMLVideoElement

    private SendFunc: ((data: string) => void)
    private touch : TouchHandler 

    private intervals : any[] 

    constructor(videoElement: HTMLVideoElement, 
                Sendfunc: ((data: string)=>void),
                scancode?: boolean){
        this.prev_buttons = new Map<number,boolean>();
        this.prev_sliders = new Map<number,number>();
        this.prev_axis    = new Map<number,number>();

        this.disableKeyboard = false;
        this.disableMouse = false;
        this.scancode = scancode ?? false

        this.video = videoElement;
        this.SendFunc = Sendfunc;

        this.touch = new TouchHandler (videoElement,Sendfunc);
        this.Screen = new Screen();
        this.intervals = []
        this.pressing_keys = []

        this.disableKeyWhileFullscreen()
        /**
         * video event
         */

        const ignore = event => event.preventDefault()
        this.video.addEventListener('contextmenu',  ignore)
        this.video.addEventListener('touchstart',   ignore) 
        this.video.addEventListener('touchend',     ignore) 
        this.video.addEventListener('touchmove',    ignore) 

        /**
         * mouse event
         */
        this.video.addEventListener('wheel',          this.mouseWheel.bind(this));
        this.video.addEventListener('mousemove',      this.mouseButtonMovement.bind(this));
        this.video.addEventListener('mousedown',      this.mouseButtonDown.bind(this));
        this.video.addEventListener('mouseup',        this.mouseButtonUp.bind(this));
        
        /**
         * keyboard event
         */
        document.addEventListener('keydown',        this.keydown.bind(this));
        document.addEventListener('keyup',          this.keyup.bind(this));

        /**
         * shortcuts stuff
         */
        this.shortcuts = new Array<Shortcut>();
        this.shortcuts.push(new Shortcut(ShortcutCode.Fullscreen, [KeyCode.Ctrl, KeyCode.Shift, KeyCode.F], requestFullscreen))

        /**
         * gamepad stuff
         */
        this.intervals.push(setInterval(this.runButton.bind(this), 1));
        this.intervals.push(setInterval(this.runAxis  .bind(this), 1));
        this.intervals.push(setInterval(this.runSlider.bind(this), 1));

        this.intervals.push(setInterval(() => this.relativeMouse = document.pointerLockElement != null,100))

        this.setTouchMode('trackpad')
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
        const fields = data.split("|")
        switch (fields.at(0)) {
            case 'grum':
                const index = Number(fields.at(1));
                const sMag = Number(fields.at(2)) / 255;
                const wMag = Number(fields.at(3)) / 255;
                if (sMag > 0 || wMag > 0) {
                    navigator.getGamepads().forEach((gamepad: any) =>{
                        if (gamepad?.index === index)
                        gamepad?.vibrationActuator?.playEffect?.("dual-rumble", {
                            startDelay: 0,
                            duration: 200,
                            weakMagnitude: wMag,
                            strongMagnitude: sMag,
                        });
                    })
                }
                break;
            default:
                break;
        }
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
        const key = convertJSKey(jsKey,0)
        if (key == undefined) 
            return

        this.SendFunc((new HIDMsg(code ,{ key, })).ToString());
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

        if (event.key == "Meta")
            return

        const key = convertJSKey(event.key,event.location)
        if (key == undefined) 
            return
            
       
        let code = EventCode.KeyDown
        if (this.scancode)
            code += 2
        this.SendFunc((new HIDMsg(code,{ key })).ToString());
        this.pressing_keys.push(key)
    }
    private keyup(event: KeyboardEvent) {
        event.preventDefault();
        if (this.disableKeyboard) 
            return;

        if (event.key == "Meta")
            return

        const key = convertJSKey(event.key,event.location)
        if (key == undefined) 
            return

        let code = EventCode.KeyUp;
        if (this.scancode)
            code += 2
        this.SendFunc((new HIDMsg(code,{ key })).ToString());
        this.pressing_keys.splice(this.pressing_keys.findIndex(x => x == key))
    }
    private mouseWheel(event: WheelEvent){
        event.preventDefault();
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
    private mouseButtonMovement(event: {clientX:number,clientY:number,movementX:number,movementY:number}){
        if (this.disableMouse) 
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
                dX: event.movementX * MOUSE_SPEED,
                dY: event.movementY * MOUSE_SPEED,
            })).ToString());
        }
    }
    private mouseButtonDown(event: MouseEvent){
        if (this.disableMouse) 
            return;

        this.MouseButtonDown(event)
    }
    private mouseButtonUp(event: MouseEvent){
        if (this.disableMouse) 
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
    
    private disableKeyWhileFullscreen() {
        const supportsKeyboardLock =
            //@ts-ignore
            ('keyboard' in navigator) && ('lock' in navigator.keyboard);

        if (supportsKeyboardLock) {
            document.addEventListener('fullscreenchange', async () => {
                if (document.fullscreenElement) {
                    // The magic happens here… 🦄
                    //@ts-ignore
                    await navigator.keyboard.lock(['Escape']);
                    //await navigator.keyboard.lock(['F11']);
                    console.log('Keyboard locked.');
                    return;
                }
                //@ts-ignore
                navigator.keyboard.unlock();
                console.log('Keyboard unlocked.');
            });
        }
    }
}