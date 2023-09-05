import { EventCode, HIDMsg } from "../models/keys.model";
import { isFullscreen, requestFullscreen } from "../utils/screen";
import { thresholdDistance, thresholdTime, TouchData } from "../models/hid.model";
import { getOS, OS } from "../utils/platform";

export class MobileTouch {
    private onGoingTouchs: Map<number,TouchData>

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
        this.SendFunc((new HIDMsg(EventCode.GamepadConnect,{
            gamepad_id: "0",
        }).ToString()))
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
			const key = this.os == 'Android' ? touches[i].identifier : i;
			this.onGoingTouchs.set(key, new TouchData(touches[i]));

        }
    };
    private handleEnd = (evt: TouchEvent) => {
        if (this.disable) 
            return;

        const touches = evt.changedTouches;
        for (let i = 0; i < touches.length; i++) {
			const key = this.os == 'Android' ? touches[i].identifier : i;
			const touch = this.onGoingTouchs.get(key);
            touch != null ? this.handle_swipe(touch) : null;
            this.onGoingTouchs.delete(key);
        }
    };

    private handleMove = async (evt: TouchEvent) => {
        if (this.disable) 
            return;

        const touches = evt.touches;
        for (let i = 0; i < touches.length; i++) {
			const key = this.os == 'Android' ? touches[i].identifier : i;
            const touch = this.onGoingTouchs.get(key);
			if(!touch) return
            touch.clientX = touches[i].clientX;
            touch.clientY = touches[i].clientY;
            this.onGoingTouchs.set(key, touch);
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
            !isFullscreen(this.video)
        ) {	
            requestFullscreen();
            return;
        }

        // zoom out
        if (
            Math.abs(distance.now) < Math.abs(distance.prev) &&
            isFullscreen(this.video)
        ) {
			try {
				await document.exitFullscreen();
            } catch (e) {}
            return;
        }
    };
}