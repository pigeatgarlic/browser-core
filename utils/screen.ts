import { getBrowser } from "./platform";

export const VIDEO_ELEMENT_ID = 'videoElm'

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
    if (browser == 'Safari') {
        const videoElm = document.getElementById(VIDEO_ELEMENT_ID)
        videoElm.classList.toggle("fillVideoIos");
        return
    }
    
    // TODO test on firefox
    // if (browser == 'Firefox') 
    //     return document.documentElement.msRequestFullscreen()
    const elementToFullscreen = document.documentElement
    if (!document.fullscreenElement && elementToFullscreen?.requestFullscreen) {
        elementToFullscreen.requestFullscreen();
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }
}

