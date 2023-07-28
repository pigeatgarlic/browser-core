export class VideoWrapper {
    private isPlaying : boolean;
    private video : HTMLVideoElement

    constructor(vid: HTMLVideoElement) {
        this.video = vid
        this.isPlaying = true

        this.video.onplaying = (() => {
            this.isPlaying = true;
        }).bind(this);
        this.video.onpause = (() => {
            this.isPlaying = false;
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
        this.video.srcObject = null
        this.video.srcObject = provider
        await this.play()
    }

    internal() : HTMLVideoElement {
        return this.video
    }
}