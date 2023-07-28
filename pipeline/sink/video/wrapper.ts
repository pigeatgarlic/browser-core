import { Log, LogLevel } from "../../../utils/log";

export class VideoWrapper {
    private isPlaying : boolean;
    private video : HTMLVideoElement
    private last_assign : Date

    constructor(vid: HTMLVideoElement) {
        this.video = vid
        this.isPlaying = true
        this.last_assign  = new Date()

        this.video.onplaying = (() => {
            this.isPlaying = true;
        }).bind(this);
        this.video.onpause = (() => {
            this.isPlaying = false;
            this.play().catch(e => {
                Log(LogLevel.Error,`error playing video ${e.message}`)
            })
        }).bind(this);
    }

    // Play video function
    async play() {      
        if (this.video.paused && !this.isPlaying) {
            return await this.video.play();
        }
    } 

    // Pause video function
    async pause() {     
        if (!this.video.paused && this.isPlaying) {
            this.video.pause();
        }
    }

    async assign(provider: MediaProvider) {
        if (new Date().getTime() - this.last_assign.getTime() < 1000) {
            Log(LogLevel.Warning,`reassign too quick, aborted`)
            return
        }
            
        
        this.video.srcObject = null
        this.video.srcObject = provider
        await this.play()
        this.last_assign = new Date()
    }

    internal() : HTMLVideoElement {
        return this.video
    }
}