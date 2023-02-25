import { ConnectionEvent, Log, LogConnectionEvent, LogLevel } from "../utils/log";
import { EventCode } from "../models/keys.model";
import { HIDMsg, KeyCode, Shortcut, ShortcutCode } from "../models/keys.model";
import { getOS } from "../utils/platform";


const thresholdTime = 300;
const thresholdDistance = 10;

export type AxisType = 'left' | 'right'

class TouchData implements Touch {
    constructor(initial: Touch) {
        this.clientX        = initial.clientX
        this.clientY        = initial.clientY
        this.force          = initial.force
        this.identifier     = initial.identifier
        this.pageX          = initial.pageX
        this.pageY          = initial.pageY
        this.radiusX        = initial.radiusX
        this.radiusY        = initial.radiusY
        this.rotationAngle  = initial.rotationAngle
        this.screenX        = initial.screenX
        this.screenY        = initial.screenY
        this.target         = initial.target

        this.doMove = false
        this.holdTimeout = 0;
        this.leftMouseDown = true;
        this.startTime = new Date()
        this.touchStart = {
            clientX        : initial.clientX,
            clientY        : initial.clientY,
            force          : initial.force,
            identifier     : initial.identifier,
            pageX          : initial.pageX,
            pageY          : initial.pageY,
            radiusX        : initial.radiusX,
            radiusY        : initial.radiusY,
            rotationAngle  : initial.rotationAngle,
            screenX        : initial.screenX,
            screenY        : initial.screenY,
            target         : initial.target
        }
    }

    copyFromTouch(touch: Touch) {
        this.clientX        = touch.clientX
        this.clientY        = touch.clientY
        this.force          = touch.force
        this.identifier     = touch.identifier
        this.pageX          = touch.pageX
        this.pageY          = touch.pageY
        this.radiusX        = touch.radiusX
        this.radiusY        = touch.radiusY
        this.rotationAngle  = touch.rotationAngle
        this.screenX        = touch.screenX
        this.screenY        = touch.screenY
        this.target         = touch.target
    }

    public clientX: number;
    public clientY: number;
    public force: number;
    public identifier: number;
    public pageX: number;
    public pageY: number;
    public radiusX: number;
    public radiusY: number;
    public rotationAngle: number;
    public screenX: number;
    public screenY: number;
    public target: EventTarget; // neglect

    // custom data
    public readonly touchStart: Touch; 
    public doMove: boolean;
    public holdTimeout: number;
    public leftMouseDown: boolean;
    public startTime: Date;
}


class Screen {
    constructor() {
        this.ClientHeight = 0;
        this.ClientWidth = 0;
        this.ClientLeft = 0;
        this.ClientTop = 0;
        this.Streamheight = 0;
        this.StreamWidth = 0;
        this.desiredRatio = 0;
    }
    /*
    * client resolution display on client screen
    */
    public ClientWidth: number;
    public ClientHeight: number;
    /*
    * client resolution display on client screen
    */
    public ClientTop: number;
    public ClientLeft: number;

    public StreamWidth: number;
    public Streamheight: number;
    
    public desiredRatio: number;
}

export class HID {
    private prev_buttons : Map<number,boolean>;
    private prev_sliders : Map<number,number>;
    private prev_axis    : Map<number,number>;

    private onGoingTouchs: Map<number,TouchData>

    private shortcuts: Array<Shortcut>

    private relativeMouse : boolean
    private Screen : Screen;


    private video: HTMLVideoElement
    public SendFunc: ((data: string) => Promise<void>)

    constructor(videoElement: HTMLVideoElement, 
                Sendfunc: ((data: string)=>Promise<void>)){
        this.prev_buttons = new Map<number,boolean>();
        this.prev_sliders = new Map<number,number>();
        this.prev_axis    = new Map<number,number>();
        this.onGoingTouchs = new Map<number,TouchData>();


        this.video = videoElement;
        this.SendFunc = Sendfunc;
        this.Screen = new Screen();

        /**
         * video event
         */
        this.video.addEventListener('contextmenu',   ((event: Event) => {event.preventDefault()})); ///disable content menu key on remote control

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
        window.addEventListener('keydown',        this.keydown.bind(this));
        window.addEventListener('keyup',          this.keyup.bind(this));

        window.addEventListener("gamepadconnected",     this.connectGamepad.bind(this));
        window.addEventListener("gamepaddisconnected",  this.disconnectGamepad.bind(this));
        if (getOS() == "Android" || getOS() == "iOS") {
            this.SendFunc((new HIDMsg(EventCode.GamepadConnect,{
                gamepad_id: "0",
            }).ToString()))
        } else {
            document.addEventListener('touchstart',     this.handleStart.bind(this));
            document.addEventListener('touchend',       this.handleEnd.bind(this));
            document.addEventListener('touchcancel',    this.handleCancel.bind(this));
            document.addEventListener('touchmove',      this.handleMove.bind(this));
        }



        /**
         * mouse lock event
         */
        document.addEventListener('mouseleave',     this.mouseLeaveEvent.bind(this));
        document.addEventListener('mouseenter',     this.mouseEnterEvent.bind(this));



        this.shortcuts = new Array<Shortcut>();
        this.shortcuts.push(new Shortcut(ShortcutCode.Fullscreen,[KeyCode.Ctrl,KeyCode.Shift,KeyCode.F],(()=> { this.video.parentElement.requestFullscreen(); })))

        setInterval(() => this.runButton(), 1);
        setInterval(() => this.runAxis(), 1);
        setInterval(() => this.runSlider(), 1);
        setInterval(() => {
            const havingPtrLock = document.pointerLockElement != null
            this.relativeMouse = havingPtrLock;

            if (this.isFullscreen() && !havingPtrLock) {
                this.video.requestPointerLock();
            } else if (!this.isFullscreen() && havingPtrLock) {
                document.exitPointerLock();
            }
        }, 100);
    }

    public isFullscreen(): boolean { 
        return document.fullscreenElement != null;
    };



    private connectGamepad (event: GamepadEvent) : void {
        if (event.gamepad.mapping === "standard") {
            this.SendFunc((new HIDMsg(EventCode.GamepadConnect,{
                gamepad_id: event.gamepad.index,
            }).ToString()))
        } 
    };

    private disconnectGamepad (event: GamepadEvent) : void {
        if (event.gamepad.mapping === "standard") {
            this.SendFunc((new HIDMsg(EventCode.GamepadDisconnect,{
                gamepad_id: event.gamepad.index,
            }).ToString()))
        }
    };

    public handleIncomingData(data: string) {
        const fields = data.split("|")
        switch (fields.at(0)) {
            case 'grum':
                // window.navigator.vibrate()
                // TODO native rumble
                // navigator.getGamepads().forEach((gamepad: Gamepad,gamepad_id: number) =>{
                //     if (gamepad == null) 
                //         return;
                // })
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
                    var pressed = button.pressed

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
                    var value = button.value

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


    public VirtualGamepadButtonSlider(released: boolean, index: number) {
        if (index == 6 || index == 7) { // slider
            this.SendFunc((new HIDMsg(EventCode.GamepadSlide, {
                gamepad_id: 0,
                index: index,
                val: !released ? 1 : 0
            }).ToString()))
            return;
        }
        this.SendFunc((new HIDMsg(released ?  EventCode.GamepadButtonUp : EventCode.GamepadButtonDown,{ 
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










    private mouseEnterEvent(event: MouseEvent) {
        Log(LogLevel.Debug,"Mouse enter")
        this.SendFunc((new HIDMsg(EventCode.KeyReset,{ }).ToString()))
    }
    private mouseLeaveEvent(event: MouseEvent) {
        Log(LogLevel.Debug,"Mouse leave")
        this.SendFunc((new HIDMsg(EventCode.KeyReset,{ }).ToString()))
    }
    private keydown(event: KeyboardEvent) {
        event.preventDefault();

        let disable_send = false;
        this.shortcuts.forEach((element: Shortcut) => {
            let triggered = element.HandleShortcut(event);

            if (triggered) 
                disable_send = true;
        })



        if (disable_send) 
            return;


        let jsKey = event.key;
        let code = EventCode.KeyDown
        this.SendFunc((new HIDMsg(code,{
            key: jsKey,
        })).ToString());
    }
    private keyup(event: KeyboardEvent) {
        let jsKey = event.key;
        let code = EventCode.KeyUp;
        this.SendFunc((new HIDMsg(code,{
            key: jsKey,
        })).ToString());
        event.preventDefault();
    }
    private mouseWheel(event: WheelEvent){
        let code = EventCode.MouseWheel
        this.SendFunc((new HIDMsg(code,{
            deltaY: -Math.round(event.deltaY),
        })).ToString());
    }
    private mouseButtonMovement(event: MouseEvent){
        this.elementConfig(this.video)

        if (!this.relativeMouse) {
            let code = EventCode.MouseMoveAbs
            let mousePosition_X = this.clientToServerX(event.clientX);
            let mousePosition_Y = this.clientToServerY(event.clientY);
            this.SendFunc((new HIDMsg(code,{
                dX: mousePosition_X,
                dY: mousePosition_Y,
            })).ToString());
        } else {
            let code = EventCode.MouseMoveRel
            this.SendFunc((new HIDMsg(code,{
                dX: event.movementX,
                dY: event.movementY,
            })).ToString());
        }
    }
    private mouseButtonDown(event: MouseEvent){
        let code = EventCode.MouseDown
        this.SendFunc((new HIDMsg(code,{
            button: event.button
        })).ToString());
    }
    private mouseButtonUp(event: MouseEvent){
        let code = EventCode.MouseUp
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

        let desiredRatio = this.Screen.StreamWidth / this.Screen.Streamheight;
        let HTMLVideoElementRatio = this.Screen.ClientWidth / this.Screen.ClientHeight;

        if (HTMLVideoElementRatio > desiredRatio) {
            let virtualWidth = this.Screen.ClientHeight * desiredRatio
            let virtualLeft = ( this.Screen.ClientWidth - virtualWidth ) / 2;

            this.Screen.ClientWidth = virtualWidth
            this.Screen.ClientLeft = virtualLeft
        }
    }


    private handleMove(evt: TouchEvent) {
        evt.preventDefault();


        const touches = evt.touches;
        for (let i = 0; i < touches.length; i++) {
            const curr_touch = touches[i]
            const identifier = curr_touch.identifier;

            const prev_touch = this.onGoingTouchs.get(identifier);
            if (prev_touch.holdTimeout != 0) {
                clearTimeout(prev_touch.holdTimeout);
                prev_touch.holdTimeout = 0
            }

            if (prev_touch == null) {
                Log(LogLevel.Error,`cannot find touch identifier ${identifier}`);
                continue;
            }

            const diff = {
                movementX : Math.round(curr_touch.clientX - prev_touch.clientX),
                movementY : Math.round(curr_touch.clientY - prev_touch.clientY)
            }

            // one finger only
            if (identifier == 0) {
                let code = EventCode.MouseMoveRel
                this.SendFunc((new HIDMsg(code,{
                    dX: diff.movementX,
                    dY: diff.movementY,
                })).ToString());
            }

            prev_touch.copyFromTouch(curr_touch)
        }


        this.handle_pinch_zoom()
    }

    private async handle_swipe(touch: TouchData) : Promise<void>{
        const now = new Date().getTime();

		const deltaTime = now           - touch.startTime.getTime();
		const deltaX    = touch.clientX - touch.touchStart.clientX;
		const deltaY    = touch.clientY - touch.touchStart.clientY;

		/* work out what the movement was */
		if (deltaTime > thresholdTime) {
			/* gesture too slow */
			return;
		} else {
			if ((deltaX > thresholdDistance)&&(Math.abs(deltaY) < thresholdDistance)) {
				// o.innerHTML = 'swipe right';
			} else if ((-deltaX > thresholdDistance)&&(Math.abs(deltaY) < thresholdDistance)) {
				// o.innerHTML = 'swipe left';
			} else if ((deltaY > thresholdDistance)&&(Math.abs(deltaX) < thresholdDistance)) {
				// o.innerHTML = 'swipe down';
                for (let index = 0; index < 20; index++) {
                    this.SendFunc((new HIDMsg(EventCode.MouseWheel,{
                        deltaY: 120
                    })).ToString());
                }
			} else if ((-deltaY > thresholdDistance)&&(Math.abs(deltaX) < thresholdDistance)) {
				// o.innerHTML = 'swipe up';
                for (let index = 0; index < 20; index++) {
                    this.SendFunc((new HIDMsg(EventCode.MouseWheel,{
                        deltaY: -120
                    })).ToString());
                }
			} else {
				// o.innerHTML = '';
			}
		}
    }



    private handleStart(evt: TouchEvent) {
        evt.preventDefault();

        const touches = evt.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            let touch = new TouchData(touches[i])
            // hold for left click
            touch.holdTimeout = setTimeout(()=>{
                touch.leftMouseDown = true;
                this.SendFunc((new HIDMsg(EventCode.MouseDown,{
                    button: '0'
                })).ToString());
            },300)

            this.onGoingTouchs.set(touches[i].identifier, touch);
        }
    }
    private handleEnd(evt: TouchEvent) {
        evt.preventDefault();
        console.log('touchend.');

        const touches = evt.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = this.onGoingTouchs.get(touches[i].identifier);
            if (touch.leftMouseDown) {
                this.SendFunc((new HIDMsg(EventCode.MouseUp,{
                    button: '0'
                })).ToString());
            }

            this.handle_swipe(touch);
            this.onGoingTouchs.delete(touches[i].identifier);
        }
    }

    private handleCancel(evt: TouchEvent) {
        evt.preventDefault();
        
        Log(LogLevel.Debug ,'touchcancel.');
        const touches = evt.changedTouches;

        for (let i = 0; i < touches.length; i++) {
            const touch = this.onGoingTouchs.get(touches[i].identifier);
            if (touch.leftMouseDown) {
                this.SendFunc((new HIDMsg(EventCode.MouseUp,{
                    button: '0'
                })).ToString());
            }

            this.onGoingTouchs.delete(touches[i].identifier);  
        }
    }


    private async handle_pinch_zoom() : Promise<void>{
        if (this.onGoingTouchs.size === 2) {
            const firstFinger  = this.onGoingTouchs.get(0);
            const secondFinger = this.onGoingTouchs.get(1);

            // Calculate the difference between the start and move coordinates
            const move = {
                first  : firstFinger.clientX  - firstFinger.touchStart.clientX,
                second : secondFinger.clientX - secondFinger.touchStart.clientX
            }
            const distance = {
                now    : firstFinger.clientX  - secondFinger.clientX,
                prev   : firstFinger.touchStart.clientX - secondFinger.touchStart.clientX
            }

            // This threshold is device dependent as well as application specific
            const PINCH_THRESHOLD = this.video.clientWidth / 10;

            // zoom
            if((Math.abs(move.first)  >  PINCH_THRESHOLD) && 
               (Math.abs(move.second) >  PINCH_THRESHOLD)) 
            {
                // zoom in
                if(Math.abs(distance.now) > Math.abs(distance.prev) && !this.isFullscreen()) {
                    document.documentElement.requestFullscreen();
                } 

                // zoom out
                if(Math.abs(distance.now) < Math.abs(distance.prev) &&  this.isFullscreen()) {
                    document.exitFullscreen();
                }
            }
        }
    }
}