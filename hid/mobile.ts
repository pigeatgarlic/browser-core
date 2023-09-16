import { EventCode, HIDMsg } from "../models/keys.model";
import { isFullscreen, requestFullscreen } from "../utils/screen";
import { thresholdDistance, thresholdTime, TouchData } from "../models/hid.model";
import { getOS, OS } from "../utils/platform";

export class MobileTouch {
    private onGoingTouchs: Map<number,TouchData>
    private events : string[] = []

	private os : OS
    private disable : boolean
    public Toggle (disable: boolean) {
        console.log(disable ? 'disable touch' : 'enable touch')
        this.disable = disable
        if (this.disable) 
            this.onGoingTouchs = new Map<number,TouchData>();
    }


    private video : HTMLVideoElement;
    public SendFunc: ((data: string) => void)
    constructor(videoElement : HTMLVideoElement,
                Sendfunc: ((data: string)=>void)){
        this.video = videoElement;
        this.onGoingTouchs = new Map<number,TouchData>()
        this.SendFunc = Sendfunc;
        this.disable = false;
		this.os = getOS()

        videoElement.addEventListener('touchstart',     this.handleStart.bind(this));
        videoElement.addEventListener('touchend',       this.handleEnd.bind(this));
        videoElement.addEventListener('touchmove',      this.handleMove.bind(this));
        this.ListenEvents()
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




    private async ListenEvents () {
        while (!this.disable) {
            const first = this.events.pop()
            if (first == "two_start") {
                await new Promise(r => setTimeout(r,200))
                const sec   = this.events.pop()
                const third = this.events.pop()
                if (sec == "short" && third == "short") {
                    this.SendFunc((new HIDMsg(EventCode.MouseDown, { button: '2' })).ToString());
                    this.SendFunc((new HIDMsg(EventCode.MouseUp  , { button: '2' })).ToString());
                }
            } else if (first == "short") {
                await new Promise(r => setTimeout(r,400))
                const sec = this.events.pop()
                if (sec == "short")  {
                    this.SendFunc((new HIDMsg(EventCode.MouseDown, { button: '0' })).ToString());
                    this.SendFunc((new HIDMsg(EventCode.MouseUp  , { button: '0' })).ToString());
                    this.SendFunc((new HIDMsg(EventCode.MouseDown, { button: '0' })).ToString());
                    this.SendFunc((new HIDMsg(EventCode.MouseUp  , { button: '0' })).ToString());
                } else if (sec == "long") {
                    this.SendFunc((new HIDMsg(EventCode.MouseDown, { button: '0' })).ToString());
                } else {
                    this.SendFunc((new HIDMsg(EventCode.MouseDown, { button: '0' })).ToString());
                    this.SendFunc((new HIDMsg(EventCode.MouseUp  , { button: '0' })).ToString());
                }
            } else
                await new Promise(r => setTimeout(r,100))
            
        }
    }


    private handleStart = (evt: TouchEvent) => {
        evt.preventDefault()

        if (this.disable) 
            return;

        const touches = evt.changedTouches;
        for (let i = 0; i < touches.length; i++) {
			const key = this.os == 'Android' ? touches[i].identifier : i;
			this.onGoingTouchs.set(key, new TouchData(touches[i]));
        }

        if (evt.touches.length == 2) 
            this.events.push("two_start")
    };
    private handleEnd = (evt: TouchEvent) => {
        evt.preventDefault()

        if (this.disable) 
            return;

        const touches = evt.changedTouches;
        for (let i = 0; i < touches.length; i++) {
			const key = this.os == 'Android' ? touches[i].identifier : i;
			const touch = this.onGoingTouchs.get(key);
            if(touch != null) 
                this.handleScroll(touch) 
            if (new Date().getTime() - touch.startTime.getTime() < 200)
                this.events.push('short')

            this.onGoingTouchs.delete(key);
        }
        

        this.SendFunc((new HIDMsg(EventCode.MouseUp, { button: '0' })).ToString());
    };

    private handleMove = async (evt: TouchEvent) => {
        evt.preventDefault()

        if (this.disable) 
            return;

        const touches = evt.touches;
        for (let i = 0; i < touches.length; i++) {
            const curr_touch = touches[i]
            const identifier = curr_touch.identifier;

            const prev_touch = this.onGoingTouchs.get(identifier);
            if (prev_touch == null) 
                continue;
            
            if (new Date().getTime() - prev_touch.startTime.getTime() > 200 && 
                curr_touch.clientX - prev_touch.touchStart.clientX < 10 &&
                curr_touch.clientY - prev_touch.touchStart.clientY < 10 &&
               !prev_touch.doMove) {
                prev_touch.doMove = true
                this.events.push('long')
            }

            const diff = {
                movementX: 3 * Math.round(curr_touch.clientX - prev_touch.clientX),
                movementY: 3 * Math.round(curr_touch.clientY - prev_touch.clientY)
            }

            // one finger only
            if (identifier == 0) {
                let code = EventCode.MouseMoveRel
                this.SendFunc((new HIDMsg(code, {
                    dX: diff.movementX,
                    dY: diff.movementY,
                })).ToString());
            }

            prev_touch.copyFromTouch(curr_touch)
        }

        this.handleSwipe()
    };










    private async handleSwipe() {
        if (this.onGoingTouchs.size != 2) 
            return;

        const firstFinger  = this.onGoingTouchs.get(0);
        const secondFinger = this.onGoingTouchs.get(1);

        // Calculate the difference between the start and move coordinates
        const move = {
            first  : firstFinger.clientX  - firstFinger.touchStart.clientX,
            second : secondFinger.clientX - secondFinger.touchStart.clientX,
        };
        const distance = {
            now     : firstFinger.clientX            - secondFinger.clientX,
            prev    : firstFinger.touchStart.clientX - secondFinger.touchStart.clientX,
        };

        // This threshold is device dependent as well as application specific
        const PINCH_THRESHOLD = document.documentElement.clientWidth / 10;

        // zoom
        if ( !( Math.abs(move.first) > PINCH_THRESHOLD &&
                Math.abs(move.second) > PINCH_THRESHOLD)) 
            return;

        // zoom in
        if ( Math.abs(distance.now) > Math.abs(distance.prev) &&
            !isFullscreen(this.video)) 	
            requestFullscreen();

        // zoom out
        if ( Math.abs(distance.now) < Math.abs(distance.prev) &&
            isFullscreen(this.video)) 
            document.exitFullscreen().catch(e => {});
    }

    private async handleScroll(touch: TouchData) {
        const now = new Date().getTime();
		const deltaTime = now           - touch.startTime.getTime();
		const deltaX    = touch.clientX - touch.touchStart.clientX;
		const deltaY    = touch.clientY - touch.touchStart.clientY;

		/* work out what the movement was */
		if (deltaTime > thresholdTime) 
			return;
        else if ((deltaX > thresholdDistance)&&(Math.abs(deltaY) < thresholdDistance)) { // 'swipe right';
            return
        } else if ((-deltaX > thresholdDistance)&&(Math.abs(deltaY) < thresholdDistance)) { // 'swipe left';
            return
        } 

        if ((deltaY > thresholdDistance)&&(Math.abs(deltaX) < thresholdDistance)) { // 'swipe down';
            for (let index = 0; index < 10; index++) {
                this.SendFunc((new HIDMsg(EventCode.MouseWheel,{ deltaY: 40 })).ToString());
                await new Promise(r => setTimeout(r,30))
            }
        } else if ((-deltaY > thresholdDistance)&&(Math.abs(deltaX) < thresholdDistance)) { // 'swipe up';
            for (let index = 0; index < 10; index++) {
                this.SendFunc((new HIDMsg(EventCode.MouseWheel,{ deltaY: -40 })).ToString());
                await new Promise(r => setTimeout(r,30))
            }
        }
    }
}