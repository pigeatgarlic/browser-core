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
    return (
        (document.fullscreenElement && document.fullscreenElement !== null) ||
        (document.webkitFullscreenElement && document.webkitFullscreenElement !== null) ||
        (document.mozFullScreenElement && document.mozFullScreenElement !== null)
    );
}

// if (document['requestFullScreen']) {
//     // W3C API
//     document['requestFullScreen']();
// } else if (document['mozRequestFullScreen']) {
//     // Mozilla current API
//     document['mozRequestFullScreen']();
// } else if (document['webkitRequestFullScreen']) {
//     // Webkit current API
//     document['webkitRequestFullScreen']();
// } else if (document['webkitEnterFullScreen']) {
//     // This is the IOS Mobile edge case
//     document['webkitEnterFullScreen']();
// }
