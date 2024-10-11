import {
    EventCode,
    HIDMsg,
    KeyCode,
    Shortcut,
    ShortcutCode
} from '../models/keys.model';
import { convertJSKey } from '../utils/convert';
import { requestFullscreen } from '../utils/screen';

const MOUSE_SPEED = 1.07;

export class HID {
    private prev_buttons: Map<number, boolean>;
    private prev_sliders: Map<number, number>;
    private prev_axis: Map<number, number>;

    private pressing_keys: number[];

    private shortcuts: Array<Shortcut>;

    private relativeMouse: boolean;
    public scancode: boolean;

    last_interact: Date;
    public last_active(): number {
        return (new Date().getTime() - this.last_interact.getTime()) / 1000;
    }

    private SendFunc: (...data: HIDMsg[]) => Promise<void>;
    public disable: boolean;

    private intervals: any[];

    private video: HTMLVideoElement;
    constructor(
        Sendfunc: (...data: HIDMsg[]) => Promise<void>,
        scancode?: boolean,
        video?: HTMLVideoElement
    ) {
        this.SendFunc = (...data: HIDMsg[]) =>
            !this.disable ? Sendfunc(...data) : null;
        this.video = video;

        this.prev_buttons = new Map<number, boolean>();
        this.prev_sliders = new Map<number, number>();
        this.prev_axis = new Map<number, number>();

        this.scancode = scancode ?? false;
        this.last_interact = new Date();

        this.intervals = [];
        this.pressing_keys = [];

        this.disableKeyWhileFullscreen();
        /**
         * video event
         */

        document.onwheel = this.mouseWheel.bind(this);
        document.onmousemove = this.mouseButtonMovement.bind(this);
        document.onmousedown = this.mouseButtonDown.bind(this);
        document.onmouseup = this.mouseButtonUp.bind(this);
        document.onkeydown = this.keydown.bind(this);
        document.onkeyup = this.keyup.bind(this);

        /**
         * shortcuts stuff
         */
        this.shortcuts = new Array<Shortcut>();
        this.shortcuts.push(
            new Shortcut(
                ShortcutCode.Fullscreen,
                [KeyCode.Ctrl, KeyCode.Shift, KeyCode.F],
                requestFullscreen
            ),
            new Shortcut(
                ShortcutCode.Fullscreen,
                [KeyCode.F11],
                requestFullscreen
            )
        );

        /**
         * gamepad stuff
         */
        Array.from(Array(16).keys()).forEach((x) => {
            this.prev_buttons.set(x, false);
            this.prev_sliders.set(x, 0);
            this.prev_axis.set(x, 0);
        });

        (async () => {
            while (!this.disable) {
                await this.runGamepad()
                await new Promise(r => setTimeout(r,10))
            }
        })()
        this.intervals.push(
            setInterval(
                () =>
                (this.relativeMouse =
                    document.pointerLockElement != null ||
                    (document as any).mozPointerLockElement != null ||
                    (document as any).webkitPointerLockElement != null),
                100
            )
        );
    }

    public Close() {
        this.intervals.forEach((x) => clearInterval(x));
        this.disable = true
        document.onwheel = null;
        document.onmousemove = null;
        document.onmousedown = null;
        document.onmouseup = null;
        document.onkeydown = null;
        this.shortcuts = new Array<Shortcut>();
    }

    public async PasteClipboard() {
        const code = EventCode.ClipboardPaste;
        await this.SendFunc(new HIDMsg(code, {}));
    }

    public handleIncomingData(data: string) {
        const fields = data.split('|');
        switch (fields.at(0)) {
            case 'grum':
                const index = Number(fields.at(1));
                const sMag = Number(fields.at(2)) / 255;
                const wMag = Number(fields.at(3)) / 255;
                if (sMag > 0 || wMag > 0) {
                    navigator.getGamepads().forEach((gamepad: any) => {
                        if (gamepad?.index === index)
                            gamepad?.vibrationActuator?.playEffect?.(
                                'dual-rumble',
                                {
                                    startDelay: 0,
                                    duration: 200,
                                    weakMagnitude: wMag,
                                    strongMagnitude: sMag
                                }
                            );
                    });
                }
                break;
            default:
                break;
        }
    }

    private async runGamepad() {
        const gamepads = navigator.getGamepads().filter(x => x != null)
        for (let gamepad_id = 0; gamepad_id < gamepads.length; gamepad_id++) {
            const { buttons, axes } = gamepads[gamepad_id];

            for (let index = 0; index < buttons.length; index++) {
                const { pressed, value } = buttons[index];
                if (index == 6 || index == 7) {
                    if (Math.abs(this.prev_sliders.get(index) - value) < 0.000001) return;
                    await this.SendFunc(
                        new HIDMsg(EventCode.GamepadSlide, {
                            gamepad_id: gamepad_id,
                            index: index,
                            val: value
                        })
                    );

                    this.prev_sliders.set(index, value);
                    this.last_interact = new Date();
                } else {
                    if (this.prev_buttons.get(index) == pressed) return;
                    await this.SendFunc(
                        new HIDMsg(
                            pressed
                                ? EventCode.GamepadButtonUp
                                : EventCode.GamepadButtonDown,
                            {
                                gamepad_id: gamepad_id,
                                index: index
                            }
                        )
                    );

                    this.prev_buttons.set(index, pressed);
                    this.last_interact = new Date();
                }
            }
            for (let index = 0; index < axes.length; index++) {
                const value = axes[index];
                if (Math.abs(this.prev_axis.get(index) - value) < 0.000001)
                    return;

                await this.SendFunc(
                    new HIDMsg(EventCode.GamepadAxis, {
                        gamepad_id: gamepad_id,
                        index: index,
                        val: value
                    })
                );

                this.prev_axis.set(index, value);
                this.last_interact = new Date();
            }
        }
    }

    public async ResetKeyStuck() {
        await this.SendFunc(new HIDMsg(EventCode.KeyReset, {}));
    }

    private async keydown(event: KeyboardEvent) {
        this.last_interact = new Date();
        if (
            getComputedStyle(event.target as HTMLElement).getPropertyValue(
                '--prefix'
            ).length > 0
        )
            return;

        event.preventDefault();
        let disable_send = false;
        this.shortcuts.forEach((element: Shortcut) => {
            const triggered = element.HandleShortcut(event);

            if (triggered) disable_send = true;
        });

        if (disable_send) return;

        if (event.key == 'Meta') return;

        const key = convertJSKey(event.key, event.location);
        if (key == undefined) return;

        let code = EventCode.KeyDown;
        if (this.scancode) code += 2;
        await this.SendFunc(new HIDMsg(code, { key }));
        this.pressing_keys.push(key);
    }
    private async keyup(event: KeyboardEvent) {
        if (
            getComputedStyle(event.target as HTMLElement).getPropertyValue(
                '--prefix'
            ).length > 0
        )
            return;

        event.preventDefault();

        if (event.key == 'Meta') return;

        const key = convertJSKey(event.key, event.location);
        if (key == undefined) return;

        let code = EventCode.KeyUp;
        if (this.scancode) code += 2;
        await this.SendFunc(new HIDMsg(code, { key }));
        this.pressing_keys.splice(
            this.pressing_keys.findIndex((x) => x == key)
        );
    }
    private async mouseWheel(event: WheelEvent) {
        if (
            getComputedStyle(event.target as HTMLElement).getPropertyValue(
                '--prefix'
            ).length > 0
        )
            return;

        const code = EventCode.MouseWheel;
        await this.SendFunc(
            new HIDMsg(code, {
                deltaY: -Math.round(event.deltaY)
            })
        );
    }
    public async mouseMoveRel(event: { movementX: number; movementY: number }) {
        const code = EventCode.MouseMoveRel;
        await this.SendFunc(
            new HIDMsg(code, {
                dX: event.movementX,
                dY: event.movementY
            })
        );
    }
    private async mouseButtonMovement(event: MouseEvent) {
        this.last_interact = new Date();
        if (event.target != this.video) return;

        if (!this.relativeMouse) {
            await this.SendFunc(
                new HIDMsg(EventCode.MouseMoveAbs, {
                    dX: this.clientToServerX(event.clientX),
                    dY: this.clientToServerY(event.clientY)
                })
            );
        } else {
            await this.SendFunc(
                new HIDMsg(EventCode.MouseMoveRel, {
                    dX: event.movementX * MOUSE_SPEED,
                    dY: event.movementY * MOUSE_SPEED
                })
            );
        }
    }
    private mouseButtonDown(event: MouseEvent) {
        if (
            getComputedStyle(event.target as HTMLElement).getPropertyValue(
                '--prefix'
            ).length > 0
        )
            return;

        this.MouseButtonDown(event);
    }
    private mouseButtonUp(event: MouseEvent) {
        if (
            getComputedStyle(event.target as HTMLElement).getPropertyValue(
                '--prefix'
            ).length > 0
        )
            return;

        this.MouseButtonUp(event);
    }

    public async MouseButtonDown(event: { button: number }) {
        const code = EventCode.MouseDown;
        await this.SendFunc(
            new HIDMsg(code, {
                button: event.button
            })
        );
    }
    public async MouseButtonUp(event: { button: number }) {
        const code = EventCode.MouseUp;
        await this.SendFunc(
            new HIDMsg(code, {
                button: event.button
            })
        );
    }

    private clientToServerY(clientY: number): number {
        return clientY / document.documentElement.clientHeight;
    }

    private clientToServerX(clientX: number): number {
        return clientX / document.documentElement.clientWidth;
    }

    private disableKeyWhileFullscreen() {
        const block = async () => {
            if (document.fullscreenElement)
                //@ts-ignore
                navigator.keyboard.lock(['Escape', 'F11']);
            //@ts-ignore
            else navigator.keyboard.unlock();
        };

        try {
            //@ts-ignore
            if ('keyboard' in navigator && 'lock' in navigator.keyboard)
                document.onfullscreenchange = block;
            else document.onfullscreenchange = null;
        } catch { }
    }
}
