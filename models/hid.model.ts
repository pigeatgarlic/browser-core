
export const thresholdTime = 300;
export const thresholdDistance = 10;

export type AxisType = 'left' | 'right'

export class TouchData implements Touch {
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
    public holdTimeout: any;
    public leftMouseDown: boolean;
    public startTime: Date;
}


export class Screen {
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