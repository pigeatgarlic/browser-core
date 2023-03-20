import { EventCode, HIDMsg } from "../models/keys.model";
import { Log, LogLevel } from "../utils/log";
import { isFullscreen } from "../utils/screen";
import { thresholdDistance, thresholdTime, TouchData } from "../models/hid.model";

export class DesktopTouch {
    private onGoingTouchs: Map<number,TouchData>
    public SendFunc: ((data: string) => void)

    private disable : boolean
    public Toggle (disable: boolean) {
        console.log(disable ? 'disable touch' : 'enable touch')
        this.disable = disable
        if (this.disable) 
            this.onGoingTouchs = new Map<number,TouchData>();
    }


    constructor(Sendfunc: ((data: string)=>void)){
        this.onGoingTouchs = new Map<number,TouchData>()
        this.SendFunc = Sendfunc;
        this.disable = false

        document.addEventListener('touchstart',     this.handleStart.bind(this));
        document.addEventListener('touchend',       this.handleEnd.bind(this));
        document.addEventListener('touchcancel',    this.handleCancel.bind(this));
        document.addEventListener('touchmove',      this.handleMove.bind(this));

        document.addEventListener("gamepadconnected",     this.connectGamepad.bind(this));
        document.addEventListener("gamepaddisconnected",  this.disconnectGamepad.bind(this));
        this.SendFunc((new HIDMsg(EventCode.GamepadConnect,{
            gamepad_id: "0",
        }).ToString()))
    }

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



    private handleMove(evt: TouchEvent) {
        evt.preventDefault();
        if (this.disable) 
            return;



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
                    setTimeout(() => {
                        this.SendFunc((new HIDMsg(EventCode.MouseWheel,{
                            deltaY: -120
                        })).ToString());
                    }, index * 30)
                }
			} else {
				// o.innerHTML = '';
			}
		}
    }



    private handleStart(evt: TouchEvent) {
        evt.preventDefault();
        if (this.disable) 
            return;


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
        if (this.disable) 
            return;


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
        if (this.disable) 
            return;

        
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
}