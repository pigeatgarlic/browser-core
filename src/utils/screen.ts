import { getBrowser } from "./platform";

declare global {
    interface Document {
        mozCancelFullScreen?: () => Promise<void>;
        msExitFullscreen?: () => Promise<void>;
        webkitExitFullscreen?: () => Promise<void>;
        mozFullScreenElement?: Element;
        msFullscreenElement?: Element;
        webkitFullscreenElement?: Element;
    }
    interface HTMLElement {
        msRequestFullscreen?: () => Promise<void>;
        mozRequestFullscreen?: () => Promise<void>;
        webkitRequestFullscreen?: () => Promise<void>;
    }
}
export function isFullscreen(video?: HTMLVideoElement): boolean {
    const browser = getBrowser()
    if (browser == 'Safari') {
		return video?.webkitDisplayingFullscreen
	}
    
    // if (browser == 'Firefox') 
    //     return document.mozFullScreenElement !== null

    return document.fullscreenElement !== null
}

export function requestFullscreen(video? : HTMLVideoElement): Promise<void> {
    const browser = getBrowser()

    if (browser == 'Safari') {
		if(!video) return
		
		return video.webkitRequestFullscreen() // or video.webkitEnterFullScreen()
	}
    
    // if (browser == 'Firefox') 
    //     return document.documentElement.msRequestFullscreen()
    
    return document.documentElement.requestFullscreen()
}

