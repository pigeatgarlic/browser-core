import { Log, LogLevel } from "../../../utils/log";

export class AudioWrapper {
    private isPlaying : boolean;
    private audio : HTMLAudioElement

    constructor(vid: HTMLAudioElement) {
        this.audio = vid
        this.isPlaying = true

        this.audio.onplaying = (() => {
            this.isPlaying = true;
        }).bind(this);
        this.audio.onpause = (() => {
            this.isPlaying = false;
            this.play().catch(e => {
                Log(LogLevel.Error,`error playing audio ${e.message}`)
            })
        }).bind(this);
    }

    // Play audio function
    async play() {      
        if (this.audio.paused && !this.isPlaying) {
            return await this.audio.play();
        }
    } 

    // Pause audio function
    async pause() {     
        if (!this.audio.paused && this.isPlaying) {
            this.audio.pause();
        }
    }

    async assign(provider: MediaProvider) {
        await this.pause()
        this.audio.srcObject = null
        this.audio.srcObject = provider
        await this.play()
    }

    internal() : HTMLAudioElement {
        return this.audio
    }
}