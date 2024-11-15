import { Log, LogLevel } from '../../../utils/log';

export class VideoWrapper {
    public video: HTMLVideoElement;

    constructor(vid: HTMLVideoElement) {
        this.video = vid;
    }

    // Play video function
    async play() {
        this.video.play().catch((e) => {
            Log(LogLevel.Error, `error playing video ${e.message}`);
            setTimeout(() => this.play(), 1000);
        });
    }

    async assign(provider: MediaProvider) {
        this.video.srcObject = null;
        this.video.srcObject = provider;
    }

    internal(): HTMLVideoElement {
        return this.video;
    }
}
