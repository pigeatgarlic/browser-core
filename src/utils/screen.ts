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

	// TODO return video?.webkitDisplayingFullscreen
    if (browser == 'Safari') 
        return false
	
    // TODO test on firefox
    // if (browser == 'Firefox') 
    //     return document.mozFullScreenElement !== null

    return document.fullscreenElement !== null
}

// TODO figure out on IOS safari
export function requestFullscreen(video? : HTMLVideoElement): Promise<void> {
    const browser = getBrowser()

    // TODO figure out how to do this
	// return video.webkitRequestFullscreen() // or video.webkitEnterFullScreen()
    if (browser == 'Safari') 
        return
    
    // TODO test on firefox
    // if (browser == 'Firefox') 
    //     return document.documentElement.msRequestFullscreen()
    
    return document.documentElement.requestFullscreen()
}

