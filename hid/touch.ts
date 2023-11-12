import { EventCode, HIDMsg } from "../models/keys.model";
import { isFullscreen, requestFullscreen } from "../utils/screen";
import { thresholdDistance, thresholdTime, TouchData } from "../models/hid.model";


const RADIUS = 50
export class TouchHandler {
    private onGoingTouchs: Map<number,TouchData>
    private events : string[] = []

    public  mode : 'gamepad' | 'trackpad' | 'none'

    private lastTimeTouch: number;

    private video : HTMLVideoElement;
    public SendFunc: ((data: string) => void)
    constructor(videoElement : HTMLVideoElement,
                Sendfunc: ((data: string)=>void)){
        this.video = videoElement;
        this.onGoingTouchs = new Map<number,TouchData>()
        this.SendFunc = Sendfunc;

        document.addEventListener('touchstart',     this.handleStart  .bind(this));
        document.addEventListener('touchend',       this.handleEnd    .bind(this));
        document.addEventListener('touchmove',      this.handleMove   .bind(this));
        this.ListenEvents()
    }






    private async ListenEvents () {
        while (true) {
            const first = this.events.pop()
            if(this.mode != 'trackpad') {
                await new Promise(r => setTimeout(r,100))
                continue
            }

            if (first == "two_start") {
                //this.SendFunc((new HIDMsg(code,{
                //    deltaY: -Math.round(event.deltaY),
                //})).ToString())
                //await new Promise(r => setTimeout(r,200))
                //const sec   = this.events.pop()
                //const third = this.events.pop()
                //if (sec == "short" && third == "short") {
                //    this.SendFunc((new HIDMsg(EventCode.MouseDown, { button: '2' })).ToString());
                //    this.SendFunc((new HIDMsg(EventCode.MouseUp  , { button: '2' })).ToString());
                //}
            } else if (first == "short") {
                await new Promise(r => setTimeout(r, 100))
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
        const touches = evt.changedTouches;
        for (let i = 0; i < touches.length; i++) {
			const key = touches[i].identifier 
            this.onGoingTouchs.set(key, new TouchData(touches[i]));
        }
        if (new Date().getTime() - this.lastTimeTouch < 300) {
            this.events.push('long')
        }
        if (evt.touches.length == 2) 
            this.events.push("two_start")

    };
    private handleEnd = (evt: TouchEvent) => {
        const touches = evt.changedTouches;
        if (touches.length == 1) {
            const key = touches[0].identifier
            const touch = this.onGoingTouchs.get(key);
            this.lastTimeTouch = touch?.startTime?.getTime()
        }

        for (let i = 0; i < touches.length; i++) {
			const key = touches[i].identifier 
			const touch = this.onGoingTouchs.get(key);
            if(touch == null) 
                continue
            else if (
                new Date().getTime() - touch.startTime.getTime() < 250 &&
                new Date().getTime() - touch.startTime.getTime() > 50
            )
                this.events.push('short')


            if (this.mode == 'gamepad') 
                this.handleGamepad(touch.touchStart,touch)
            else if (this.mode == 'trackpad') 
                this.handleScroll(touch) 

            this.onGoingTouchs.delete(key);
        }
        

        this.SendFunc((new HIDMsg(EventCode.MouseUp, { button: '0' })).ToString());
    };

    private handleMove = async (evt: TouchEvent) => {
        const touches = evt.touches;
        if (touches.length === 2) {
            this.handleTwoFingerScroll(touches);
        }
        for (let i = 0; i < touches.length; i++) {
            const curr_touch = touches[i]
            const identifier = curr_touch.identifier;

            const prev_touch = this.onGoingTouchs.get(identifier);
            if (prev_touch == null) 
                continue;
            
            //if (new Date().getTime() - prev_touch.startTime.getTime() > 0 &&
            //    new Date().getTime() - prev_touch.startTime.getTime() < 200 &&
            //    //curr_touch.clientX   - prev_touch.touchStart.clientX < 10 &&
            //    //curr_touch.clientY   - prev_touch.touchStart.clientY < 10 &&
            //    !prev_touch.doMove
            //) {
            //    prev_touch.doMove = true
            //    this.events.push('long')
            //}


            // one finger only
            if (this.onGoingTouchs.size == 1 && this.mode == 'trackpad') 
                this.SendFunc((new HIDMsg(EventCode.MouseMoveRel, {
                    dX: 3 * Math.round(curr_touch.clientX - prev_touch.clientX),
                    dY: 3 * Math.round(curr_touch.clientY - prev_touch.clientY)
                })).ToString());
            else if (this.onGoingTouchs.size < 3 && this.mode == 'gamepad') 
                this.handleGamepad(curr_touch,prev_touch)
            
            prev_touch.copyFromTouch(curr_touch)
        }

        if (this.mode == 'trackpad')
            this.handleSwipe()
    };


    private isTwoFingerScrollingHorizontally(touches: TouchList): boolean {
        if (touches.length !== 2) {
            return false;
        }

        const firstTouch = touches[0];
        const secondTouch = touches[1];

        const deltaX = Math.abs(secondTouch.clientX - firstTouch.clientX);
        const deltaY = Math.abs(secondTouch.clientY - firstTouch.clientY);

        return deltaX > deltaY;
    }

    private handleTwoFingerScroll(touches: TouchList) {
        if (this.isTwoFingerScrollingHorizontally(touches)) {
            // Calculate the horizontal scroll amount based on touch movement
            const deltaX = (touches[0].clientX - touches[1].clientX) * 0.5;
            const wheelValue = deltaX; // You can adjust the value as needed
            // Send a mouse wheel event with the horizontal scroll value
            this.SendFunc((new HIDMsg(EventCode.MouseWheel, { deltaX: -wheelValue })).ToString());
        } else {
            // Calculate the vertical scroll amount based on touch movement
            console.log(touches);
            const deltaY = (touches[0].clientY - touches[1].clientY) * 0.5
            const wheelValue = deltaY; // You can adjust the value as needed
            console.log(deltaY);

            // Send a mouse wheel event with the vertical scroll value
            this.SendFunc((new HIDMsg(EventCode.MouseWheel, { deltaY: -wheelValue })).ToString());
        }
    }


    private handleGamepad(curr_touch: Touch, prev_touch: TouchData) {
        //return
        const pos = {
            x: curr_touch.clientX - prev_touch.touchStart.clientX,
            y: curr_touch.clientY - prev_touch.touchStart.clientY,
        }

        const raw = Math.sqrt(pos.x * pos.x + pos.y * pos.y)
        const rad = Math.sqrt((pos.x * pos.x + pos.y * pos.y) / (RADIUS * RADIUS))
        const final_rad = rad > 1 ? 1 : rad

        const x =   pos.x * (final_rad / raw)
        const y =   pos.y * (final_rad / raw)

        const group = prev_touch.touchStart.clientX > document.documentElement.clientWidth / 2 
            ? "right"
            : "left"

        let axisx, axisy : number
        switch (group) {
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