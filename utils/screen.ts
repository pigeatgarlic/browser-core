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


export function isFullscreen(): boolean {
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
export function requestFullscreen()  {
    const elementToFullscreen = document.documentElement
    if (!document.fullscreenElement && elementToFullscreen?.requestFullscreen) {
        elementToFullscreen.requestFullscreen().catch(e => {});
    } else if (document.exitFullscreen) {
        document.exitFullscreen();
    }

    return
}

