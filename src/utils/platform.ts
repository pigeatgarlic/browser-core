

type Platform = "Mac OS" | "iOS" | "Windows" | "Linux" | "Android" | "unknown"

export function getOS() : Platform {
    let OSName : Platform = "unknown";

    if (navigator.userAgent.indexOf("Win") != -1) OSName = "Windows";
    if (navigator.userAgent.indexOf("Mac") != -1) OSName = "Mac OS";
    if (navigator.userAgent.indexOf("Linux") != -1) OSName = "Linux";
    if (navigator.userAgent.indexOf("Android") != -1) OSName = "Android";
    if (navigator.userAgent.indexOf("like Mac") != -1) OSName = "iOS";

    return OSName
}