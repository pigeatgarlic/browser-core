import { AxisType } from '../models/hid.model';
import {
    EventCode,
    HIDMsg,
    KeyCode,
    Shortcut,
    ShortcutCode
} from '../models/keys.model';
import { convertJSKey } from '../utils/convert';
import { requestFullscreen } from '../utils/screen';
import { TouchHandler } from './touch';

const MOUSE_SPEED = 1.07;

export class HID {
    private prev_buttons: Map<number, boolean>;
    private prev_sliders: Map<number, number>;
    private prev_axis: Map<number, number>;

    private pressing_keys: number[];

    private shortcuts: Array<Shortcut>;

    private relativeMouse: boolean;
    public scancode: boolean;

    public setTouchMode(mode: 'gamepad' | 'trackpad' | 'mouse' | 'none') {
        if (mode == 'gamepad' || mode == 'trackpad') this.touch.mode = mode;
        else this.touch.mode = 'none';
    }

    last_interact: Date;
    public last_active(): number {
        return (new Date().getTime() - this.last_interact.getTime()) / 1000;
    }

    private SendFunc: (data: string) => void;

    private touch: TouchHandler;
    private intervals: any[];

    constructor(Sendfunc: (data: string) => void, scancode?: boolean) {
        this.SendFunc = Sendfunc;
        this.prev_buttons = new Map<number, boolean>();
        this.prev_sliders = new Map<number, number>();
        this.prev_axis = new Map<number, number>();

        this.scancode = scancode ?? false;
        this.last_interact = new Date();

        this.touch = new TouchHandler((data) => {
            this.SendFunc(data);
            this.last_interact = new Date();
        });
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
            ),
        );

        /**
         * gamepad stuff
         */
        this.intervals.push(setInterval(this.runButton.bind(this), 1));
        this.intervals.push(setInterval(this.runAxis.bind(this), 1));
        this.intervals.push(setInterval(this.runSlider.bind(this), 1));
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

        this.setTouchMode('trackpad');
    }

    public Close() {
        this.intervals.forEach((x) => clearInterval(x));
        document.onwheel = null;
        document.onmousemove = null;
        document.onmousedown = null;
        document.onmouseup = null;
        document.onkeydown = null;
        this.shortcuts = new Array<Shortcut>();
        this.touch?.Close();
    }

    public SetClipboard(val: string) {
        const code = EventCode.ClipboardSet;
        this.SendFunc(
            new HIDMsg(code, {
                val: btoa(val)
            }).ToString()
        );
    }
    public PasteClipboard() {
        const code = EventCode.ClipboardPaste;
        this.SendFunc(new HIDMsg(code, {}).ToString());
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

    private runButton(): void {
        navigator
            .getGamepads()
            .forEach((gamepad: Gamepad, gamepad_id: number) => {
                if (gamepad == null) return;

                gamepad.buttons.forEach(
                    (button: GamepadButton, index: number) => {
                        if (index == 6 || index == 7) {
                            // slider
                        } else {
                            const pressed = button.pressed;

                            if (this.prev_buttons.get(index) == pressed) return;

                            this.SendFunc(
                                new HIDMsg(
                                    pressed
                                        ? EventCode.GamepadButtonUp
                                        : EventCode.GamepadButtonDown,
                                    {
                                        gamepad_id: gamepad_id,
                                        index: index
                                    }
                                ).ToString()
                            );

                            this.prev_buttons.set(index, pressed);
                            this.last_interact = new Date();
                        }
                    }
                );
            });
    }
    private runSlider(): void {
        navigator
            .getGamepads()
            .forEach((gamepad: Gamepad, gamepad_id: number) => {
                if (gamepad == null) return;

                gamepad.buttons.forEach(
                    (button: GamepadButton, index: number) => {
                        if (index == 6 || index == 7) {
                            // slider
                            const value = button.value;

                            if (
                                Math.abs(this.prev_sliders.get(index) - value) <
                                0.000001
                            )
                                return;

                            this.SendFunc(
                                new HIDMsg(EventCode.GamepadSlide, {
                                    gamepad_id: gamepad_id,
                                    index: index,
                                    val: value
                                }).ToString()
                            );

                            this.prev_sliders.set(index, value);
                            this.last_interact = new Date();
                        }
                    }
                );
            });
    }
    private runAxis(): void {
        navigator
            .getGamepads()
            .forEach((gamepad: Gamepad, gamepad_id: number) => {
                if (gamepad == null) return;

                gamepad.axes.forEach((value: number, index: number) => {
                    if (Math.abs(this.prev_axis.get(index) - value) < 0.000001)
                        return;

                    this.SendFunc(
                        new HIDMsg(EventCode.GamepadAxis, {
                            gamepad_id: gamepad_id,
                            index: index,
                            val: value
                        }).ToString()
                    );

                    this.prev_axis.set(index, value);
                    this.last_interact = new Date();
                });
            });
    }

    public VirtualGamepadButtonSlider(isDown: boolean, index: number) {
        if (index == 6 || index == 7) {
            // slider
            this.SendFunc(
                new HIDMsg(EventCode.GamepadSlide, {
                    gamepad_id: 0,
                    index: index,
                    val: !isDown ? 0 : 1
                }).ToString()
            );
            return;
        }
        this.SendFunc(
            new HIDMsg(
                !isDown
                    ? EventCode.GamepadButtonDown
                    : EventCode.GamepadButtonUp,
                {
                    gamepad_id: 0,
                    index: index
                }
            ).ToString()
        );
    }

    public VirtualGamepadAxis(x: number, y: number, type: AxisType) {
        let axisx, axisy: number;
        switch (type) {
            case 'left':
                axisx = 0;
                axisy = 1;
                break;
            case 'right':
                axisx = 2;
                axisy = 3;
                break;
        }

        this.SendFunc(
            new HIDMsg(EventCode.GamepadAxis, {
                gamepad_id: 0,
                index: axisx,
                val: x
            }).ToString()
        );
        this.SendFunc(
            new HIDMsg(EventCode.GamepadAxis, {
                gamepad_id: 0,
                index: axisy,
                val: y
            }).ToString()
        );
    }

    public ResetKeyStuck() {
        this.SendFunc(new HIDMsg(EventCode.KeyReset, {}).ToString());
    }
    public TriggerKey(
        code: EventCode.KeyUp | EventCode.KeyDown,
        jsKey: string
    ) {
        const key = convertJSKey(jsKey, 0);
        if (key == undefined) return;

        this.SendFunc(new HIDMsg(code, { key }).ToString());
    }

    private keydown(event: KeyboardEvent) {
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
        this.SendFunc(new HIDMsg(code, { key }).ToString());
        this.pressing_keys.push(key);
        this.last_interact = new Date();
    }
    private keyup(event: KeyboardEvent) {
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
        this.SendFunc(new HIDMsg(code, { key }).ToString());
        this.pressing_keys.splice(
            this.pressing_keys.findIndex((x) => x == key)
        );
        this.last_interact = new Date();
    }
    private mouseWheel(event: WheelEvent) {
        if (
            getComputedStyle(event.target as HTMLElement).getPropertyValue(
                '--prefix'
            ).length > 0
        )
            return;

        const code = EventCode.MouseWheel;
        this.SendFunc(
            new HIDMsg(code, {
                deltaY: -Math.round(event.deltaY)
            }).ToString()
        );
    }
    public mouseMoveRel(event: { movementX: number; movementY: number }) {
        const code = EventCode.MouseMoveRel;
        this.SendFunc(
            new HIDMsg(code, {
                dX: event.movementX,
                dY: event.movementY
            }).ToString()
        );
    }
    private mouseButtonMovement(event: MouseEvent) {
        if (!this.relativeMouse) {
            this.SendFunc(
                new HIDMsg(EventCode.MouseMoveAbs, {
                    dX: this.clientToServerX(event.clientX),
                    dY: this.clientToServerY(event.clientY)
                }).ToString()
            );
        } else {
            this.SendFunc(
                new HIDMsg(EventCode.MouseMoveRel, {
                    dX: event.movementX * MOUSE_SPEED,
                    dY: event.movementY * MOUSE_SPEED
                }).ToString()
            );
        }

        this.last_interact = new Date();
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

    public MouseButtonDown(event: { button: number }) {
        const code = EventCode.MouseDown;
        this.SendFunc(
            new HIDMsg(code, {
                button: event.button
            }).ToString()
        );
    }
    public MouseButtonUp(event: { button: number }) {
        const code = EventCode.MouseUp;
        this.SendFunc(
            new HIDMsg(code, {
                button: event.button
            }).ToString()
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
            if (document.fullscreenElement) //@ts-ignore
                navigator.keyboard.lock(['Escape','F11']);
            else //@ts-ignore
                navigator.keyboard.unlock();
        }

        try {
            //@ts-ignore
            if ('keyboard' in navigator && 'lock' in navigator.keyboard)
                document.onfullscreenchange = block
            else
                document.onfullscreenchange = null;
        } catch { }
    }
}
