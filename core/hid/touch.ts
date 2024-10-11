import { TouchData } from '../models/hid.model';
import { EventCode, HIDMsg } from '../models/keys.model';

const RADIUS = 50;
const BOTTOM_THRESHOLD_PERCENT = 100;
const MOUSE_SPEED = 3.5;
export class TouchHandler {
    private onGoingTouchs: Map<number, TouchData>;
    private events: string[] = [];

    public mode: 'gamepad' | 'trackpad' | 'none';

    private disable: boolean;
    private last_interact: Date;
    public last_active(): number {
        return (new Date().getTime() - this.last_interact.getTime()) / 1000;
    }

    private running: any;
    private SendFunc: (...data: HIDMsg[]) => Promise<void>;
    private video: HTMLVideoElement;
    constructor(
        video: HTMLVideoElement,
        Sendfunc: (...data: HIDMsg[]) => Promise<void>
    ) {
        this.onGoingTouchs = new Map<number, TouchData>();
        this.SendFunc = Sendfunc;

        this.mode = 'none';
        this.video = video;
        this.last_interact = new Date();
        this.video.ontouchstart = this.handleStart.bind(this);
        this.video.ontouchend = this.handleEnd.bind(this);
        this.video.ontouchmove = this.handleMove.bind(this);
        (async () => {
            while (!this.disable) {
                try {
                    await this.ListenEvents();
                } catch {}
                await new Promise((r) => setTimeout(r, 10));
            }
        })();
    }

    public Close() {
        this.video.ontouchstart = null;
        this.video.ontouchend = null;
        this.video.ontouchmove = null;
        clearInterval(this.running);
        this.disable = true;
    }

    private async ListenEvents() {
        if (this.mode == 'none') return;

        switch (this.events.pop()) {
            case 'short_right':
                await this.SendFunc(
                    new HIDMsg(EventCode.MouseDown, {
                        button: '2'
                    }),
                    new HIDMsg(EventCode.MouseUp, {
                        button: '2'
                    })
                );
                break;
            case 'short_generic':
                await this.SendFunc(
                    new HIDMsg(EventCode.MouseDown, {
                        button: '0'
                    }),
                    new HIDMsg(EventCode.MouseUp, {
                        button: '0'
                    })
                );
                break;
            default:
                break;
        }
    }

    private handleStart = (evt: TouchEvent) => {
        evt.preventDefault();
        this.last_interact = new Date();

        const touches = evt.changedTouches;
        for (let i = 0; i < touches.length; i++) {
            const key = touches[i].identifier;
            this.onGoingTouchs.set(key, new TouchData(touches[i]));
        }
    };
    private handleEnd = (evt: TouchEvent) => {
        evt.preventDefault();
        const touches = evt.changedTouches;

        for (let i = 0; i < touches.length; i++) {
            const key = touches[i].identifier;
            const touch = this.onGoingTouchs.get(key);
            if (touch == null) continue;
            else if (
                this.mode == 'trackpad' &&
                new Date().getTime() - touch.startTime.getTime() < 250 &&
                new Date().getTime() - touch.startTime.getTime() > 30 &&
                touches.length == 1 &&
                this.isTouchInBottomRight(touch)
            )
                this.events.push('short_right');
            else if (
                this.mode == 'trackpad' &&
                new Date().getTime() - touch.startTime.getTime() < 250 &&
                new Date().getTime() - touch.startTime.getTime() > 30 &&
                touches.length == 1
            )
                this.events.push('short_generic');

            this.onGoingTouchs.delete(key);
        }
    };

    private handleMove = async (evt: TouchEvent) => {
        evt.preventDefault();
        const touches = evt.touches;
        if (touches.length === 2) {
            await this.handleTwoFingerScroll(touches);
        }
        for (let i = 0; i < touches.length; i++) {
            const curr_touch = touches[i];
            const identifier = curr_touch.identifier;

            const prev_touch = this.onGoingTouchs.get(identifier);
            if (prev_touch == null) continue;

            // one finger only
            if (this.onGoingTouchs.size == 1 && this.mode == 'trackpad')
                await this.SendFunc(
                    new HIDMsg(EventCode.MouseMoveRel, {
                        dX:
                            MOUSE_SPEED *
                            Math.round(curr_touch.clientX - prev_touch.clientX),
                        dY:
                            MOUSE_SPEED *
                            Math.round(curr_touch.clientY - prev_touch.clientY)
                    })
                );

            prev_touch.copyFromTouch(curr_touch);
        }
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

    private async handleTwoFingerScroll(touches: TouchList) {
        if (this.isTwoFingerScrollingHorizontally(touches)) {
            // Calculate the horizontal scroll amount based on touch movement
            const deltaX = (touches[0].clientX - touches[1].clientX) * 0.7;
            const wheelValue = deltaX; // You can adjust the value as needed
            // Send a mouse wheel event with the horizontal scroll value
            await this.SendFunc(
                new HIDMsg(EventCode.MouseWheel, {
                    deltaX: -wheelValue
                })
            );
        } else {
            // Calculate the vertical scroll amount based on touch movement
            const deltaY = (touches[0].clientY - touches[1].clientY) * 0.7;
            const wheelValue = deltaY; // You can adjust the value as needed

            // Send a mouse wheel event with the vertical scroll value
            await this.SendFunc(
                new HIDMsg(EventCode.MouseWheel, {
                    deltaY: -wheelValue
                })
            );
        }
    }

    private isTouchInBottomRight(touch: Touch): boolean {
        const screenHeight = document.documentElement.clientHeight;
        const screenBottom =
            screenHeight * (1 - BOTTOM_THRESHOLD_PERCENT / 100);
        return (
            touch.clientY >= screenBottom &&
            touch.clientX >= document.documentElement.clientWidth / 2
        );
    }
}
