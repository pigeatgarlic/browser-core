

export type OS = "Mac OS" | "iOS" | "Windows" | "Linux" | "Android" | "unknown"
export type Platform = 'desktop' | 'mobile'

export function getPlatform() : Platform {
    let os = getOS()
    return (os == 'Android' || os == 'iOS') ? 'mobile' :  'desktop' 
}

export function getOS() : OS {
    let OSName : OS = "unknown";

    if (navigator.userAgent.indexOf("Win") != -1) OSName = "Windows";
    if (navigator.userAgent.indexOf("Mac") != -1) OSName = "Mac OS";
    if (navigator.userAgent.indexOf("Linux") != -1) OSName = "Linux";
    if (navigator.userAgent.indexOf("Android") != -1) OSName = "Android";
    if (navigator.userAgent.indexOf("like Mac") != -1) OSName = "iOS";

    return OSName
}