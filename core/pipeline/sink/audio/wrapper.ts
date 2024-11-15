import { Log, LogLevel } from '../../../utils/log';

export class AudioWrapper {
    private audio: HTMLAudioElement;

    constructor(vid: HTMLAudioElement) {
        this.audio = vid;
    }

    // Play audio function
    async play() {
        this.audio.play().catch((e) => {
            Log(LogLevel.Error, `error playing audio ${e.message}`);
            setTimeout(() => this.play(), 1000);
        });
    }

    async assign(provider: MediaProvider) {
        this.audio.srcObject = null;
        this.audio.srcObject = provider;
    }

    internal(): HTMLAudioElement {
        return this.audio;
    }
}
