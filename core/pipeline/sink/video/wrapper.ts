import { Log, LogLevel } from '../../../utils/log';

export class VideoWrapper {
    private isPlaying: boolean;
    public video: HTMLVideoElement;

    constructor(vid: HTMLVideoElement) {
        this.video = vid;
        this.isPlaying = true;

        this.video.onplaying = (() => {
            this.isPlaying = true;
        }).bind(this);
        this.video.onpause = (() => {
            this.isPlaying = false;
            this.play().catch((e) => {
                Log(LogLevel.Error, `error playing video ${e.message}`);
            });
        }).bind(this);
    }

    // Play video function
    async play() {
        await this.video.play();
    }

    // Pause video function
    async pause() {
        if (!this.video.paused && this.isPlaying) {
            this.video.pause();
        }
    }

    async assign(provider: MediaProvider) {
        this.video.srcObject = null;
        this.video.srcObject = provider;
    }

    internal(): HTMLVideoElement {
        return this.video;
    }
}
