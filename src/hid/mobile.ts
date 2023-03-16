import { EventCode, HIDMsg } from "../models/keys.model";
import { isFullscreen, requestFullscreen } from "../utils/screen";
import { thresholdDistance, thresholdTime, TouchData } from "../models/hid.model";

export class MobileTouch {
    private onGoingTouchs: Map<number,TouchData>

    private disable : boolean
    public Toggle (disable: boolean) {
        console.log(disable ? 'disable touch' : 'enable touch')
        this.disable = disable
        if (this.disable) 
            this.onGoingTouchs = new Map<number,TouchData>();
    }

    public SendFunc: ((data: string) => Promise<void>)
    constructor(Sendfunc: ((data: string)=>Promise<void>)){
        this.onGoingTouchs = new Map<number,TouchData>()
        this.SendFunc = Sendfunc;
        this.disable = false;

        document.addEventListener('touchstart',     this.handleStart.bind(this));
        document.addEventListener('touchend',       this.handleEnd.bind(this));
        document.addEventListener('touchmove',      this.handleMove.bind(this));
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


    private handleStart = (evt: TouchEvent) => {
        if (this.disable) 
            return;

        const touches = evt.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            this.onGoingTouchs.set(touches[i].identifier, new TouchData(touches[i]));
        }
    };
    private handleEnd = (evt: TouchEvent) => {
        if (this.disable) 
            return;

        const touches = evt.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const touch = this.onGoingTouchs.get(touches[i].identifier);
            touch != null ? this.handle_swipe(touch) : null;
            this.onGoingTouchs.delete(touches[i].identifier);
        }
    };

    private handleMove = async (evt: TouchEvent) => {
        if (this.disable) 
            return;

        const touches = evt.touches;
        for (let i = 0; i < touches.length; i++) {
            const touch = this.onGoingTouchs.get(touches[i].identifier);
            touch.clientX = touches[i].clientX;
            touch.clientY = touches[i].clientY;
            this.onGoingTouchs.set(touches[i].identifier, touch);
        }

        if (this.onGoingTouchs.size != 2) {
            return;
        }

        const firstFinger = this.onGoingTouchs.get(0);
        const secondFinger = this.onGoingTouchs.get(1);

        // Calculate the difference between the start and move coordinates
        const move = {
            first: firstFinger.clientX - firstFinger.touchStart.clientX,
            second: secondFinger.clientX - secondFinger.touchStart.clientX,
        };
        const distance = {
            now: firstFinger.clientX - secondFinger.clientX,
            prev:
                firstFinger.touchStart.clientX -
                secondFinger.touchStart.clientX,
        };

        // This threshold is device dependent as well as application specific
        const PINCH_THRESHOLD = document.documentElement.clientWidth / 10;

        // zoom
        if (
            !(
                Math.abs(move.first) > PINCH_THRESHOLD &&
                Math.abs(move.second) > PINCH_THRESHOLD
            )
        ) {
            return;
        }

        // zoom in
        if (
            Math.abs(distance.now) > Math.abs(distance.prev) &&
            !isFullscreen()
        ) {
            try {
                await requestFullscreen();
            } catch (e) {}
            return;
        }

        // zoom out
        if (
            Math.abs(distance.now) < Math.abs(distance.prev) &&
            isFullscreen()
        ) {
            try {
                await document.exitFullscreen();
            } catch (e) {}
            return;
        }
    };
}